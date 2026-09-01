import {
  diatonicIndex, keyAlterations, spell,
  FLAT_ORDER, SHARP_ORDER,
  type Accidental, type KeySignature, type Letter, type SpelledNote,
} from './theory'

/**
 * Staff geometry, all measured in staff spaces (`sp`) so the renderer can pick
 * any size. A staff is a diatonic ladder: one step = half a space.
 */

/** Diatonic index of the treble staff's top line, F5. */
const TREBLE_TOP = diatonicIndex({ letter: 'F', octave: 5 } as SpelledNote)
/** Diatonic index of the bass staff's top line, A3. */
const BASS_TOP = diatonicIndex({ letter: 'A', octave: 3 } as SpelledNote)

export const TREBLE_Y = 0
export const BASS_Y = 8
/** Total height of a grand staff, in spaces, from treble top line to bass bottom line. */
export const GRAND_HEIGHT = 12

export type Clef = 'treble' | 'bass'

/** Which staff a note belongs on — the hand decides, so middle C can sit on either. */
export function clefFor(hand: 'L' | 'R'): Clef {
  return hand === 'L' ? 'bass' : 'treble'
}

/** Vertical position of a note on the grand staff, in spaces from the top line of the treble staff. */
export function staffY(note: SpelledNote, clef: Clef): number {
  const idx = diatonicIndex(note)
  return clef === 'treble'
    ? TREBLE_Y + (TREBLE_TOP - idx) * 0.5
    : BASS_Y + (BASS_TOP - idx) * 0.5
}

/** Y of each of the five lines of a staff. */
export function staffLines(clef: Clef): number[] {
  const top = clef === 'treble' ? TREBLE_Y : BASS_Y
  return [0, 1, 2, 3, 4].map((i) => top + i)
}

/**
 * Ledger lines needed for a note: the whole-line positions between the staff
 * and the note, inclusive of the note's own line if it sits on one.
 */
export function ledgerLines(y: number, clef: Clef): number[] {
  const top = clef === 'treble' ? TREBLE_Y : BASS_Y
  const bottom = top + 4
  const out: number[] = []
  if (y < top - 0.4) for (let l = top - 1; l >= y - 0.1; l--) out.push(l)
  if (y > bottom + 0.4) for (let l = bottom + 1; l <= y + 0.1; l++) out.push(l)
  return out
}

export type NoteGlyph = {
  /** Filled notehead (quarter and shorter) vs. open (half and longer). */
  filled: boolean
  /** Whether the note gets a stem at all. */
  stem: boolean
  /** 0 = none, 1 = eighth, 2 = sixteenth. */
  flags: number
  dotted: boolean
}

export function glyphFor(dur: number): NoteGlyph {
  const table: [number, NoteGlyph][] = [
    [4, { filled: false, stem: false, flags: 0, dotted: false }],
    [3, { filled: false, stem: true, flags: 0, dotted: true }],
    [2, { filled: false, stem: true, flags: 0, dotted: false }],
    [1.5, { filled: true, stem: true, flags: 0, dotted: true }],
    [1, { filled: true, stem: true, flags: 0, dotted: false }],
    [0.75, { filled: true, stem: true, flags: 1, dotted: true }],
    [0.5, { filled: true, stem: true, flags: 1, dotted: false }],
    [0.25, { filled: true, stem: true, flags: 2, dotted: false }],
  ]
  // Snap to the nearest written value so odd durations still draw something sane.
  let best = table[table.length - 1]
  let bestDiff = Infinity
  for (const [d, g] of table) {
    const diff = Math.abs(d - dur)
    if (diff < bestDiff) {
      bestDiff = diff
      best = [d, g]
    }
  }
  return best[1]
}

export const ACCIDENTAL_GLYPH: Record<string, string> = { '1': '♯', '-1': '♭', '0': '♮' }

/**
 * Decide which accidentals actually get printed. A note only shows one when it
 * departs from the key signature, and only the first time in its bar — the rule
 * that makes real sheet music readable, and confusing until someone says it.
 */
export class AccidentalTracker {
  private alt: Partial<Record<Letter, Accidental>>
  private barAccidentals = new Map<string, Accidental>()
  private bar = -1

  constructor(private key: KeySignature, private beatsPerBar: number) {
    this.alt = keyAlterations(key)
  }

  /** Returns the glyph to print, or null. */
  check(midi: number, beat: number): string | null {
    const bar = Math.floor(beat / this.beatsPerBar)
    if (bar !== this.bar) {
      this.bar = bar
      this.barAccidentals.clear()
    }
    const note = spell(midi, this.key)
    const id = `${note.letter}${note.octave}`
    const shown = this.barAccidentals.get(id)
    const implied = shown !== undefined ? shown : (this.alt[note.letter] ?? 0)
    if (note.accidental === implied) return null
    this.barAccidentals.set(id, note.accidental)
    return ACCIDENTAL_GLYPH[String(note.accidental)]
  }
}

/** Positions of the key signature accidentals on a given staff, in spaces. */
export function keySignatureMarks(key: KeySignature, clef: Clef): { y: number; glyph: string }[] {
  if (key.fifths === 0) return []
  const sharp = key.fifths > 0
  const letters = (sharp ? SHARP_ORDER : FLAT_ORDER).slice(0, Math.abs(key.fifths))
  // Octaves chosen to keep every mark inside the staff, as engravers do.
  const octaves: Record<Letter, [number, number]> = {
    //          treble, bass
    F: [5, 3], C: [5, 3], G: [5, 3], D: [5, 3], A: [4, 2], E: [5, 3], B: [4, 2],
  }
  const flatOctaves: Record<Letter, [number, number]> = {
    B: [4, 2], E: [5, 3], A: [4, 2], D: [5, 3], G: [4, 2], C: [5, 3], F: [4, 2],
  }
  const table = sharp ? octaves : flatOctaves
  return letters.map((letter) => {
    const octave = table[letter][clef === 'treble' ? 0 : 1]
    const y = staffY({ letter, octave, accidental: 0, midi: 0 }, clef)
    return { y, glyph: sharp ? '♯' : '♭' }
  })
}

/* ------------------------------------------------------------------ *
 * Clefs, drawn as line art rather than loaded from a music font, so the
 * app has no font dependency and looks the same everywhere.
 * Coordinates are in staff spaces relative to the clef's anchor line.
 * ------------------------------------------------------------------ */

/** Anchored on the G4 line (second line up on the treble staff). */
export const TREBLE_CLEF_PATH = [
  'M -0.50 2.85',
  'C -0.95 2.80 -1.00 2.20 -0.55 2.00',
  'C -0.20 1.85 0.05 1.55 0.15 1.10',
  'C 0.30 0.30 0.35 -1.20 0.20 -2.20',
  'C 0.10 -2.90 0.05 -3.40 -0.05 -3.85',
  'C -0.20 -4.30 -0.75 -4.30 -0.90 -3.80',
  'C -1.05 -3.20 -0.85 -2.55 -0.50 -2.05',
  'C -0.10 -1.45 0.55 -1.05 0.85 -0.45',
  'C 1.15 0.15 1.05 0.95 0.45 1.35',
  'C -0.15 1.75 -0.95 1.45 -1.10 0.80',
  'C -1.25 0.15 -0.85 -0.45 -0.30 -0.50',
  'C 0.20 -0.55 0.55 -0.15 0.45 0.25',
  'C 0.35 0.60 0.00 0.70 -0.15 0.45',
].join(' ')

/** Anchored on the F3 line (fourth line up on the bass staff). */
export const BASS_CLEF_PATH = [
  'M -1.45 2.75',
  'C -0.45 2.25 0.45 1.35 0.60 0.35',
  'C 0.75 -0.55 0.35 -1.35 -0.35 -1.35',
  'C -0.85 -1.35 -1.15 -0.95 -1.10 -0.55',
  'C -1.05 -0.15 -0.65 0.05 -0.40 -0.10',
].join(' ')

/** The two dots that straddle the F line. */
export const BASS_CLEF_DOTS: [number, number][] = [
  [1.05, -0.5],
  [1.05, 0.5],
]

/** A flag hanging off a stem end. `dir` is -1 for an up-stem, 1 for a down-stem. */
export function flagPath(dir: number, index: number): string {
  const o = index * 0.75 * -dir
  return [
    `M 0 ${o}`,
    `C 0.55 ${o + dir * 0.35} 0.85 ${o + dir * 0.85} 0.60 ${o + dir * 1.55}`,
    `C 0.95 ${o + dir * 0.85} 0.55 ${o + dir * 0.45} 0 ${o + dir * 0.95}`,
    'Z',
  ].join(' ')
}
