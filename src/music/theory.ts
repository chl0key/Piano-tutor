// Core music theory: MIDI numbers in, spelled notes and staff positions out.

export type Letter = 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B'
export const LETTERS: Letter[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B']

/** Semitone offset of each natural letter above C. */
const LETTER_SEMITONE: Record<Letter, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }

/** Accidental as a semitone adjustment: -1 flat, 0 natural, +1 sharp. */
export type Accidental = -1 | 0 | 1

export interface SpelledNote {
  letter: Letter
  accidental: Accidental
  octave: number
  midi: number
}

/** Sharp/flat spelling tables for the 12 pitch classes. */
const SHARP_SPELL: [Letter, Accidental][] = [
  ['C', 0], ['C', 1], ['D', 0], ['D', 1], ['E', 0], ['F', 0],
  ['F', 1], ['G', 0], ['G', 1], ['A', 0], ['A', 1], ['B', 0],
]
const FLAT_SPELL: [Letter, Accidental][] = [
  ['C', 0], ['D', -1], ['D', 0], ['E', -1], ['E', 0], ['F', 0],
  ['G', -1], ['G', 0], ['A', -1], ['A', 0], ['B', -1], ['B', 0],
]

/**
 * Key signature expressed the way it is written: a positive count of sharps
 * or a negative count of flats, plus the tonic for display.
 */
export interface KeySignature {
  /** +n = n sharps, -n = n flats, 0 = C major / A minor. */
  fifths: number
  name: string
}

export const KEYS: Record<string, KeySignature> = {
  C: { fifths: 0, name: 'C major' },
  G: { fifths: 1, name: 'G major' },
  D: { fifths: 2, name: 'D major' },
  A: { fifths: 3, name: 'A major' },
  F: { fifths: -1, name: 'F major' },
  Bb: { fifths: -2, name: 'B♭ major' },
  Eb: { fifths: -3, name: 'E♭ major' },
  Am: { fifths: 0, name: 'A minor' },
  Em: { fifths: 1, name: 'E minor' },
  Dm: { fifths: -1, name: 'D minor' },
}

/** Fifths for each major tonic, by pitch class. Flat spellings where they read better. */
const MAJOR_FIFTHS = [0, -5, 2, -3, 4, -1, 6, 1, -4, 3, -2, 5]

const PC_NAME_SHARP = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B']
const PC_NAME_FLAT = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B']

/** Build a key signature for any tonic, which generated songs need. */
export function keyFor(tonicPc: number, minor = false): KeySignature {
  const pc = ((tonicPc % 12) + 12) % 12
  // A minor key carries its relative major's signature: three semitones up.
  const fifths = MAJOR_FIFTHS[minor ? (pc + 3) % 12 : pc]
  const names = fifths < 0 ? PC_NAME_FLAT : PC_NAME_SHARP
  return { fifths, name: `${names[pc]} ${minor ? 'minor' : 'major'}` }
}

/** Order sharps and flats appear in a key signature. */
export const SHARP_ORDER: Letter[] = ['F', 'C', 'G', 'D', 'A', 'E', 'B']
export const FLAT_ORDER: Letter[] = ['B', 'E', 'A', 'D', 'G', 'C', 'F']

/** Which letters the key signature already alters, and in which direction. */
export function keyAlterations(key: KeySignature): Partial<Record<Letter, Accidental>> {
  const out: Partial<Record<Letter, Accidental>> = {}
  if (key.fifths > 0) for (let i = 0; i < key.fifths; i++) out[SHARP_ORDER[i]] = 1
  if (key.fifths < 0) for (let i = 0; i < -key.fifths; i++) out[FLAT_ORDER[i]] = -1
  return out
}

/** Spell a MIDI note sensibly for a key: flat keys get flats, sharp keys sharps. */
export function spell(midi: number, key: KeySignature = KEYS.C): SpelledNote {
  const pc = ((midi % 12) + 12) % 12
  const table = key.fifths < 0 ? FLAT_SPELL : SHARP_SPELL
  const [letter, accidental] = table[pc]
  // Octave is measured from the letter's own C, so Cb/B# edge cases stay sane.
  const octave = Math.floor(midi / 12) - 1
  return { letter, accidental, octave, midi }
}

/**
 * Diatonic staff index: counts letter-steps from C0 upward, ignoring accidentals.
 * Two notes one staff-step apart differ by exactly 1 here, which is what a
 * staff renderer needs (a staff is a diatonic ladder, not a chromatic one).
 */
export function diatonicIndex(n: SpelledNote): number {
  return n.octave * 7 + LETTERS.indexOf(n.letter)
}

export function midiFromLetter(letter: Letter, accidental: Accidental, octave: number): number {
  return (octave + 1) * 12 + LETTER_SEMITONE[letter] + accidental
}

export function noteName(midi: number, key: KeySignature = KEYS.C): string {
  const s = spell(midi, key)
  const acc = s.accidental === 1 ? '♯' : s.accidental === -1 ? '♭' : ''
  return `${s.letter}${acc}${s.octave}`
}

/** Letter name without octave — what goes on a key cap. */
export function keyLabel(midi: number, key: KeySignature = KEYS.C): string {
  const s = spell(midi, key)
  const acc = s.accidental === 1 ? '♯' : s.accidental === -1 ? '♭' : ''
  return `${s.letter}${acc}`
}

export function isBlackKey(midi: number): boolean {
  return [1, 3, 6, 8, 10].includes(((midi % 12) + 12) % 12)
}

export function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12)
}

export function freqToMidi(freq: number): number {
  return 69 + 12 * Math.log2(freq / 440)
}

export const MIDDLE_C = 60
