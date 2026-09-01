import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'piano-tutor.progress.v1'

/**
 * How much help the app is giving. The whole app is built around walking this
 * number down: level 1 is watching hands, level 5 is reading music.
 */
export const SCAFFOLD_LEVELS = [
  {
    level: 1,
    name: 'Watch',
    blurb: 'Falling notes lead, letters on every key. Learn the shape of the piece.',
  },
  {
    level: 2,
    name: 'Connect',
    blurb: 'The staff lights up with the falling notes. Start linking dot to key.',
  },
  {
    level: 3,
    name: 'Fade',
    blurb: 'Falling notes become ghosts. The staff is now the thing you follow.',
  },
  {
    level: 4,
    name: 'Read',
    blurb: 'Staff only. A key lights up just after a wrong note, never before.',
  },
  {
    level: 5,
    name: 'Perform',
    blurb: 'Staff only, no help, up to tempo. This is reading music.',
  },
] as const

export type ScaffoldLevel = 1 | 2 | 3 | 4 | 5

export interface SongProgress {
  scaffold: ScaffoldLevel
  bestAccuracy: number
  /** Consecutive clean run-throughs at the current level. */
  cleanRuns: number
  playCount: number
  completedAt?: string
}

export interface NoteStat {
  seen: number
  correct: number
  /** Mean time to find the key, in ms — the real measure of reading fluency. */
  avgMs: number
}

export interface Progress {
  songs: Record<string, SongProgress>
  /** Per-MIDI-note reading stats, keyed by note number, driving drill selection. */
  noteStats: Record<string, NoteStat>
  /** ISO dates (YYYY-MM-DD) on which some practice happened. */
  practiceDays: string[]
  totalMinutes: number
  lastSongId?: string
}

const EMPTY: Progress = { songs: {}, noteStats: {}, practiceDays: [], totalMinutes: 0 }

export function defaultSongProgress(): SongProgress {
  return { scaffold: 1, bestAccuracy: 0, cleanRuns: 0, playCount: 0 }
}

function load(): Progress {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return EMPTY
    return { ...EMPTY, ...(JSON.parse(raw) as Progress) }
  } catch {
    // Private windows and cleared storage both land here; practising still works.
    return EMPTY
  }
}

function save(p: Progress) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p))
  } catch {
    /* storage unavailable — keep going in memory */
  }
}

let current = load()
const listeners = new Set<(p: Progress) => void>()

function commit(next: Progress) {
  current = next
  save(next)
  for (const fn of listeners) fn(next)
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

/** Length of the run of consecutive days ending today or yesterday. */
export function streakOf(days: string[]): number {
  if (days.length === 0) return 0
  const set = new Set(days)
  const d = new Date()
  // A streak survives until the end of tomorrow, so practising at 1am still counts.
  if (!set.has(iso(d))) d.setDate(d.getDate() - 1)
  if (!set.has(iso(d))) return 0
  let n = 0
  while (set.has(iso(d))) {
    n++
    d.setDate(d.getDate() - 1)
  }
  return n
}

function iso(d: Date): string {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

export const progressStore = {
  get: () => current,

  subscribe(fn: (p: Progress) => void): () => void {
    listeners.add(fn)
    return () => {
      listeners.delete(fn)
    }
  },

  song(id: string): SongProgress {
    return current.songs[id] ?? defaultSongProgress()
  },

  updateSong(id: string, patch: Partial<SongProgress>) {
    const prev = this.song(id)
    commit({ ...current, songs: { ...current.songs, [id]: { ...prev, ...patch } }, lastSongId: id })
  },

  /** Record one attempt at reading a single note. */
  recordNote(midi: number, correct: boolean, ms: number) {
    const key = String(midi)
    const prev = current.noteStats[key] ?? { seen: 0, correct: 0, avgMs: ms }
    const seen = prev.seen + 1
    const stat: NoteStat = {
      seen,
      correct: prev.correct + (correct ? 1 : 0),
      // Running mean, so old attempts fade without storing a history.
      avgMs: prev.avgMs + (ms - prev.avgMs) / seen,
    }
    commit({ ...current, noteStats: { ...current.noteStats, [key]: stat } })
  },

  logPractice(minutes: number) {
    const day = todayISO()
    const days = current.practiceDays.includes(day)
      ? current.practiceDays
      : [...current.practiceDays, day]
    commit({ ...current, practiceDays: days, totalMinutes: current.totalMinutes + minutes })
  },

  reset() {
    commit({ ...EMPTY })
  },
}

export function useProgress(): Progress {
  const [p, setP] = useState(progressStore.get())
  useEffect(() => progressStore.subscribe(setP), [])
  return p
}

/** The notes this reader is slowest or least accurate on, worst first. */
export function weakNotes(p: Progress, candidates: number[], count: number): number[] {
  const scored = candidates.map((midi) => {
    const s = p.noteStats[String(midi)]
    if (!s || s.seen < 2) return { midi, score: 0.5 } // untested notes deserve a look
    const accuracy = s.correct / s.seen
    const slowness = Math.min(s.avgMs / 3000, 1)
    return { midi, score: (1 - accuracy) * 0.7 + slowness * 0.3 }
  })
  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, count).map((s) => s.midi)
}

export function useLogPracticeTime() {
  // Bank practice minutes when the view unmounts, so a session is only counted once.
  const [start] = useState(() => Date.now())
  return useCallback(() => {
    const minutes = (Date.now() - start) / 60000
    if (minutes >= 0.5) progressStore.logPractice(minutes)
  }, [start])
}
