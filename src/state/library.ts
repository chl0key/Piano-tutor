import { useEffect, useState } from 'react'
import { arrangeChart, ARRANGEMENTS, type ArrangementLevel } from '../music/arrange'
import { chartFromNotes, detectChords, parseChart } from '../music/chart'
import { detectKey } from '../music/chords'
import type { Section, Song, SongNote } from '../music/song'
import type { KeySignature } from '../music/theory'

const STORAGE_KEY = 'piano-tutor.library.v1'
/** A ceiling on stored notes: browser storage is small and a lesson this long is not one lesson. */
export const MAX_NOTES = 4000

export interface UserSong {
  id: string
  title: string
  artist: string
  addedAt: string
  timeSig: [number, number]
  bpm: number
  key: KeySignature
  /** Where the music came from: a pasted chart, or an imported MIDI file. */
  origin: 'chords' | 'midi'
  /** Kept as written so the chart can be edited again later. */
  chartText?: string
  midiNotes?: SongNote[]
  spotifyId?: string
  art?: string
}

function load(): UserSong[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as UserSong[]) : []
  } catch {
    return []
  }
}

let current = load()
const listeners = new Set<(songs: UserSong[]) => void>()

function commit(next: UserSong[]) {
  current = next
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // Almost always the storage quota. Say so rather than failing silently.
    throw new Error('There is no room left in this browser to save another song. Remove one first.')
  }
  for (const fn of listeners) fn(next)
}

export const library = {
  all: () => current,
  get: (id: string) => current.find((s) => s.id === id),
  add(song: UserSong) {
    commit([song, ...current.filter((s) => s.id !== song.id)])
  },
  remove(id: string) {
    commit(current.filter((s) => s.id !== id))
  },
  subscribe(fn: (songs: UserSong[]) => void): () => void {
    listeners.add(fn)
    return () => {
      listeners.delete(fn)
    }
  },
}

export function useLibrary(): UserSong[] {
  const [songs, setSongs] = useState(current)
  useEffect(() => library.subscribe(setSongs), [])
  return songs
}

export interface Variant {
  id: ArrangementLevel
  name: string
  blurb: string
  song: Song
}

/**
 * Build all three levels of a saved song.
 *
 * A pasted chart gives the harmony, and all three levels are generated from it.
 * An imported MIDI gives the actual performance, so Advanced is those notes as
 * played, while Basic and Intermediate are rebuilt from the chords read back
 * out of them — the same ladder either way.
 */
export function buildVariants(user: UserSong): Variant[] {
  const meta = {
    id: user.id,
    title: user.title,
    artist: user.artist || 'Added by you',
    source: user.origin === 'midi' ? 'Imported MIDI file' : 'Chord chart you provided',
  }

  const chart =
    user.origin === 'midi' && user.midiNotes
      ? chartFromNotes(user.midiNotes, user.timeSig, user.bpm)
      : parseChart(user.chartText ?? '', { timeSig: user.timeSig, bpm: user.bpm, key: user.key })

  const variants: Variant[] = ARRANGEMENTS.map((a) => ({
    id: a.id,
    name: a.name,
    blurb: a.blurb,
    song: arrangeChart({ ...chart, key: user.key, bpm: user.bpm }, a.id, meta),
  }))

  if (user.origin === 'midi' && user.midiNotes && user.midiNotes.length > 0) {
    variants[2] = {
      id: 'advanced',
      name: 'Advanced',
      blurb: 'The song as it is actually played, note for note, from the MIDI you imported.',
      song: songFromNotes(user, meta),
    }
  }
  return variants
}

function songFromNotes(user: UserSong, meta: { id: string; title: string; artist: string; source: string }): Song {
  const notes = user.midiNotes ?? []
  const beatsPerBar = user.timeSig[0] * (4 / user.timeSig[1])
  const chords = detectChords(notes, beatsPerBar)
  return {
    id: `${user.id}:advanced`,
    title: meta.title,
    composer: meta.artist,
    key: user.key,
    timeSig: user.timeSig,
    bpm: user.bpm,
    level: 99,
    why: 'The song as it is actually played, note for note.',
    teaches: ['The real arrangement', 'Full rhythm', 'Both hands as written'],
    notes,
    sections: chunkSections(notes, beatsPerBar),
    chords: chords.map((c) => ({ start: c.start, text: c.chord.text })),
    source: meta.source,
  }
}

/**
 * A three-minute song is not one practice target. Cut it into workable spans
 * so a section can be looped without hunting for where the phrase started.
 */
function chunkSections(notes: SongNote[], beatsPerBar: number): Section[] {
  const end = notes.reduce((m, n) => Math.max(m, n.start + n.dur), 0)
  const totalBars = Math.max(1, Math.ceil(end / beatsPerBar))
  let barsPer = 16
  while (totalBars / barsPer > 12) barsPer *= 2

  const out: Section[] = []
  for (let bar = 0; bar < totalBars; bar += barsPer) {
    const last = Math.min(bar + barsPer, totalBars)
    out.push({
      name: `Bars ${bar + 1}–${last}`,
      start: bar * beatsPerBar,
      end: last * beatsPerBar,
    })
  }
  return out
}

/** Key detection over a set of notes, for prefilling the form on import. */
export function keyOfNotes(notes: SongNote[], beatsPerBar: number): KeySignature {
  const events = detectChords(notes, beatsPerBar)
  return detectKey(events.map((e) => ({ chord: e.chord, dur: e.dur })))
}
