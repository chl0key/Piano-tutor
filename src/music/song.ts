import type { KeySignature } from './theory'

export type Hand = 'L' | 'R'

export interface SongNote {
  midi: number
  /** Beat (quarter-note) the note starts on. Can be negative for pickups. */
  start: number
  /** Length in quarter-note beats. */
  dur: number
  hand: Hand
  /** 1 = thumb ... 5 = little finger. Shown on the keyboard as a visual cue. */
  finger?: number
}

export interface Section {
  name: string
  start: number
  end: number
}

export interface Song {
  id: string
  title: string
  composer: string
  key: KeySignature
  timeSig: [number, number]
  bpm: number
  /** Ordered by difficulty within the curriculum. */
  level: number
  /** One line on why this piece is next. */
  why: string
  /** Reading concepts this piece introduces. */
  teaches: string[]
  notes: SongNote[]
  sections: Section[]
  /** Provenance, so it is clear everything here is free to use. */
  source: string
}

/** An item in a hand's sequence: [midi | rest, duration, finger?]. */
export type Step = [number | null, number] | [number | null, number, number]

/**
 * Lay out one hand's line note-by-note from a start beat. Durations accumulate,
 * so a rhythm can be edited in one place without renumbering everything after it.
 */
export function line(startBeat: number, hand: Hand, steps: Step[]): SongNote[] {
  const out: SongNote[] = []
  let t = startBeat
  for (const [midi, dur, finger] of steps) {
    if (midi !== null) out.push({ midi, start: t, dur, hand, finger })
    t += dur
  }
  return out
}

/** Sort a song's notes into playback order once, at definition time. */
export function assemble(...groups: SongNote[][]): SongNote[] {
  return groups.flat().sort((a, b) => a.start - b.start || a.midi - b.midi)
}

export function songEnd(song: Song): number {
  return song.notes.reduce((m, n) => Math.max(m, n.start + n.dur), 0)
}

export function songStart(song: Song): number {
  return song.notes.reduce((m, n) => Math.min(m, n.start), 0)
}

/** Notes required to sound at a given beat, used by wait-mode gating. */
export function notesAt(song: Song, beat: number, eps = 1e-6): SongNote[] {
  return song.notes.filter((n) => Math.abs(n.start - beat) < eps)
}

/** Ascending list of distinct onset beats — the "steps" a learner moves through. */
export function onsets(song: Song): number[] {
  const set = new Set<number>()
  for (const n of song.notes) set.add(Math.round(n.start * 1000) / 1000)
  return [...set].sort((a, b) => a - b)
}
