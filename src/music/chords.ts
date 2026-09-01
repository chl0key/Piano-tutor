import { keyFor, type KeySignature } from './theory'

/**
 * Chord symbols, and how to turn one into actual keys under the hands.
 * This is the layer that lets a chord chart become playable music.
 */

export type Quality =
  | 'maj' | 'min' | 'dim' | 'aug' | 'sus2' | 'sus4'
  | 'maj6' | 'min6' | 'dom7' | 'maj7' | 'min7' | 'min7b5' | 'dim7' | 'add9' | 'dom9'

/** Semitones above the root. */
export const CHORD_TONES: Record<Quality, number[]> = {
  maj: [0, 4, 7],
  min: [0, 3, 7],
  dim: [0, 3, 6],
  aug: [0, 4, 8],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
  maj6: [0, 4, 7, 9],
  min6: [0, 3, 7, 9],
  dom7: [0, 4, 7, 10],
  maj7: [0, 4, 7, 11],
  min7: [0, 3, 7, 10],
  min7b5: [0, 3, 6, 10],
  dim7: [0, 3, 6, 9],
  add9: [0, 4, 7, 14],
  dom9: [0, 4, 7, 10, 14],
}

/** Everything reduces to a plain triad at the basic level. */
export const TRIAD_OF: Record<Quality, number[]> = {
  maj: [0, 4, 7], min: [0, 3, 7], dim: [0, 3, 6], aug: [0, 4, 8],
  sus2: [0, 2, 7], sus4: [0, 5, 7],
  maj6: [0, 4, 7], min6: [0, 3, 7],
  dom7: [0, 4, 7], maj7: [0, 4, 7], min7: [0, 3, 7],
  min7b5: [0, 3, 6], dim7: [0, 3, 6],
  add9: [0, 4, 7], dom9: [0, 4, 7],
}

export interface Chord {
  /** Pitch class 0–11. */
  root: number
  quality: Quality
  /** Pitch class of a slash bass, when the symbol names one. */
  bass?: number
  /** The symbol exactly as it was written, for display above the staff. */
  text: string
}

const LETTER_PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }

/**
 * Suffix table, longest first so 'maj7' is not read as 'maj' with a stray 7.
 * Covers the spellings that actually turn up in chord sheets on the web.
 */
const SUFFIXES: [string, Quality][] = [
  ['maj7', 'maj7'], ['maj9', 'maj7'], ['M7', 'maj7'], ['Δ7', 'maj7'], ['Δ', 'maj7'],
  ['m7b5', 'min7b5'], ['min7b5', 'min7b5'], ['ø7', 'min7b5'], ['ø', 'min7b5'],
  ['dim7', 'dim7'], ['°7', 'dim7'], ['dim', 'dim'], ['°', 'dim'],
  ['m6', 'min6'], ['min6', 'min6'],
  ['m9', 'min7'], ['m11', 'min7'], ['m7', 'min7'], ['min7', 'min7'], ['-7', 'min7'],
  ['sus2', 'sus2'], ['sus4', 'sus4'], ['sus', 'sus4'],
  ['add9', 'add9'], ['add2', 'add9'],
  ['aug', 'aug'], ['+', 'aug'],
  ['13', 'dom9'], ['11', 'dom9'], ['9', 'dom9'], ['7', 'dom7'],
  ['6', 'maj6'],
  ['min', 'min'], ['m', 'min'], ['-', 'min'],
  ['maj', 'maj'], ['M', 'maj'], ['', 'maj'],
]

/** Parse one chord token. Returns null when the token is not a chord at all. */
export function parseChord(token: string): Chord | null {
  const raw = token.trim()
  if (!raw) return null
  const m = /^([A-Ga-g])([#b♯♭]?)(.*)$/.exec(raw)
  if (!m) return null
  const [, letter, accidental, rest] = m
  let root = LETTER_PC[letter.toUpperCase()]
  if (accidental === '#' || accidental === '♯') root += 1
  if (accidental === 'b' || accidental === '♭') root -= 1
  root = ((root % 12) + 12) % 12

  // Split off a slash bass before matching the quality suffix.
  let body = rest
  let bass: number | undefined
  const slash = body.indexOf('/')
  if (slash >= 0) {
    const bassPart = body.slice(slash + 1)
    body = body.slice(0, slash)
    const bm = /^([A-Ga-g])([#b♯♭]?)$/.exec(bassPart.trim())
    if (!bm) return null
    let b = LETTER_PC[bm[1].toUpperCase()]
    if (bm[2] === '#' || bm[2] === '♯') b += 1
    if (bm[2] === 'b' || bm[2] === '♭') b -= 1
    bass = ((b % 12) + 12) % 12
  }

  const hit = SUFFIXES.find(([suffix]) => body === suffix)
  if (!hit) return null
  return { root, quality: hit[1], bass, text: raw }
}

/** Pitch classes a chord contains, used for key detection and MIDI matching. */
export function chordPitchClasses(chord: Chord): number[] {
  return CHORD_TONES[chord.quality].map((i) => (chord.root + i) % 12)
}

/**
 * Place a chord's tones as actual keys, choosing the inversion that moves the
 * least from the previous voicing. Smooth voice leading is the single change
 * that makes chord-by-chord playing sound like music instead of like exercises.
 */
export function voiceChord(
  intervals: number[],
  root: number,
  opts: { low: number; high: number; previous?: number[]; rootPosition?: boolean; anchor?: number },
): number[] {
  const { low, high, previous, rootPosition } = opts
  const pcs = intervals.map((i) => (root + i) % 12)
  const candidates: number[][] = []

  const inversions = rootPosition ? 1 : pcs.length
  for (let inv = 0; inv < inversions; inv++) {
    const order = [...pcs.slice(inv), ...pcs.slice(0, inv)]
    for (let octave = 0; octave < 3; octave++) {
      const first = low + 12 * octave + (((order[0] - low) % 12) + 12) % 12
      const voicing = [first]
      for (let i = 1; i < order.length; i++) {
        let n = voicing[i - 1] + ((((order[i] - order[i - 1]) % 12) + 12) % 12)
        if (n === voicing[i - 1]) n += 12
        voicing.push(n)
      }
      if (voicing[voicing.length - 1] <= high && voicing[0] >= low) candidates.push(voicing)
    }
  }
  if (candidates.length === 0) return pcs.map((pc, i) => low + 12 + ((pc - low) % 12 + 12) % 12 + i * 0)

  const centre = (low + high) / 2
  const cost = (v: number[]) => {
    // Root position: keep the root itself near the anchor, so the same chord
    // always lands under roughly the same part of the hand.
    if (rootPosition) return Math.abs(v[0] - (opts.anchor ?? centre))
    if (previous && previous.length > 0) {
      // Distance from each new voice to the nearest old one: cheap, and it
      // picks the inversion a pianist would actually reach for.
      return v.reduce((sum, n) => sum + Math.min(...previous.map((p) => Math.abs(p - n))), 0)
    }
    const mid = (v[0] + v[v.length - 1]) / 2
    return Math.abs(mid - centre)
  }
  return candidates.reduce((best, v) => (cost(v) < cost(best) ? v : best))
}

/**
 * The bass note under a chord. Picking the octave nearest a fixed anchor keeps
 * the left hand in one place instead of leaping an octave between neighbouring
 * chords just because of where their roots fall.
 */
export function bassNote(chord: Chord, low = 36, high = 55, anchor = 45): number {
  const pc = chord.bass ?? chord.root
  let best = low + ((((pc - low) % 12) + 12) % 12)
  for (let n = best; n <= high; n += 12) {
    if (Math.abs(n - anchor) < Math.abs(best - anchor)) best = n
  }
  return best
}

/* ------------------------------------------------------------------ *
 * Key detection: score every major and minor key by how much of the
 * progression sits inside it, weighted by how long each chord sounds.
 * ------------------------------------------------------------------ */

const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11]
const MINOR_SCALE = [0, 2, 3, 5, 7, 8, 10]

export function detectKey(chords: { chord: Chord; dur: number }[]): KeySignature {
  if (chords.length === 0) return keyFor(0)
  let best = { pc: 0, minor: false, score: -Infinity }

  for (let pc = 0; pc < 12; pc++) {
    for (const minor of [false, true]) {
      const scale = new Set((minor ? MINOR_SCALE : MAJOR_SCALE).map((d) => (pc + d) % 12))
      let score = 0
      for (const { chord, dur } of chords) {
        const tones = chordPitchClasses(chord)
        const inside = tones.filter((t) => scale.has(t)).length / tones.length
        score += dur * (inside * 2 - 1)
        // The tonic chord carries far more weight than any other match.
        if (chord.root === pc) score += dur * (minor ? 1.4 : 1.5)
        if (chord.root === (pc + 7) % 12) score += dur * 0.8
      }
      // Starting or ending on the tonic is a strong hint, but only a hint:
      // plenty of songs end on the dominant, ready to go round again.
      if (chords[0].chord.root === pc) score += 1.2
      if (chords[chords.length - 1].chord.root === pc) score += 1.5
      if (score > best.score) best = { pc, minor, score }
    }
  }
  return keyFor(best.pc, best.minor)
}
