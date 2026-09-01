import { KEYS, isBlackKey, keyFor, noteName, type KeySignature, type Letter } from '../music/theory'
import type { Clef } from '../music/notation'

/**
 * The drills, and the reason each one exists.
 *
 * These are the sub-skills that reading is actually made of. Eye-tracking work
 * on sight-reading finds that amateurs move through a score note by note while
 * experts group notes into chunks and take in the key signature deliberately —
 * so intervals and key signatures get drilled in their own right rather than
 * being left to emerge from playing pieces.
 *
 * Mnemonics are deliberately absent. "Every Good Boy Deserves Fudge" works, but
 * it inserts a recitation between seeing a note and knowing it, and that step
 * never fully goes away. Landmarks and intervals is the approach that ends in
 * recognition instead.
 */

export type SkillId =
  | 'landmarks' | 'notes-treble' | 'notes-bass' | 'intervals'
  | 'key-signatures' | 'note-values' | 'rhythm' | 'find-key'

export interface Skill {
  id: SkillId
  name: string
  blurb: string
  why: string
  items: string[]
  /** Unlocked once these skills reach the given mastery. */
  requires: { skill: SkillId; mastery: number }[]
  /** Answering inside this counts as recognition; beyond the slow mark it counts as working it out. */
  fastMs: number
  slowMs: number
}

const NATURALS: Letter[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B']
export const LETTER_KEYS = NATURALS

const naturalsBetween = (low: number, high: number) => {
  const out: number[] = []
  for (let m = low; m <= high; m++) if (!isBlackKey(m)) out.push(m)
  return out
}

/** The anchors everything else is measured from. */
const LANDMARKS: { midi: number; clef: Clef; name: string }[] = [
  { midi: 43, clef: 'bass', name: 'Bass G' },
  { midi: 53, clef: 'bass', name: 'Bass F' },
  { midi: 60, clef: 'bass', name: 'Middle C, below' },
  { midi: 60, clef: 'treble', name: 'Middle C, above' },
  { midi: 67, clef: 'treble', name: 'Treble G' },
  { midi: 77, clef: 'treble', name: 'Treble F' },
]

export const RHYTHM_PATTERNS: number[][] = [
  [1, 1, 1, 1],
  [2, 2],
  [2, 1, 1],
  [1, 1, 2],
  [4],
  [3, 1],
  [1, 0.5, 0.5, 1, 1],
  [0.5, 0.5, 1, 1, 1],
  [1.5, 0.5, 2],
  [1, 1, 0.5, 0.5, 1],
  [0.5, 0.5, 0.5, 0.5, 2],
  [2, 0.5, 0.5, 1],
]

export const NOTE_VALUES: { dur: number; rest: boolean }[] = [
  { dur: 4, rest: false }, { dur: 3, rest: false }, { dur: 2, rest: false },
  { dur: 1.5, rest: false }, { dur: 1, rest: false }, { dur: 0.5, rest: false },
  { dur: 4, rest: true }, { dur: 2, rest: true }, { dur: 1, rest: true }, { dur: 0.5, rest: true },
]

export const SKILLS: Skill[] = [
  {
    id: 'landmarks',
    name: 'Landmarks',
    blurb: 'Six anchor notes, cold.',
    why: 'Fluent readers do not count lines. They know a handful of notes on sight and measure everything else from them. These are those notes.',
    items: LANDMARKS.map((l) => `lm:${l.clef}:${l.midi}`),
    requires: [],
    fastMs: 1400,
    slowMs: 3500,
  },
  {
    id: 'note-values',
    name: 'Note values',
    blurb: 'How long is this note held?',
    why: 'Half of reading is rhythm, and it is the half that needs no piano at all.',
    items: NOTE_VALUES.map((v) => `val:${v.dur}:${v.rest ? 'r' : 'n'}`),
    requires: [],
    fastMs: 1600,
    slowMs: 4000,
  },
  {
    id: 'notes-treble',
    name: 'Treble staff',
    blurb: 'Every note on the top staff.',
    why: 'The right hand lives here. Reading it without thinking is the single biggest speed gain available.',
    items: naturalsBetween(59, 81).map((m) => `note:treble:${m}`),
    requires: [{ skill: 'landmarks', mastery: 0.3 }],
    fastMs: 1300,
    slowMs: 3500,
  },
  {
    id: 'intervals',
    name: 'Steps and skips',
    blurb: 'How far apart are these two notes?',
    why: 'Experts read groups, not letters. Seeing a third as a third — line to the next line — is what turns note-by-note decoding into reading.',
    items: [2, 3, 4, 5, 6, 7, 8].map((n) => `int:${n}`),
    requires: [{ skill: 'landmarks', mastery: 0.4 }],
    fastMs: 1600,
    slowMs: 4000,
  },
  {
    id: 'notes-bass',
    name: 'Bass staff',
    blurb: 'Every note on the bottom staff.',
    why: 'The staff most self-taught players never really learn, which is why the left hand stays guesswork.',
    items: naturalsBetween(40, 60).map((m) => `note:bass:${m}`),
    requires: [{ skill: 'notes-treble', mastery: 0.25 }],
    fastMs: 1300,
    slowMs: 3500,
  },
  {
    id: 'key-signatures',
    name: 'Key signatures',
    blurb: 'What key is this?',
    why: 'Eye-tracking shows expert readers look at the key signature on purpose and amateurs skip it. Knowing it on sight stops every sharp being a surprise.',
    items: [-4, -3, -2, -1, 0, 1, 2, 3, 4].map((f) => `key:${f}`),
    requires: [{ skill: 'notes-treble', mastery: 0.3 }],
    fastMs: 2000,
    slowMs: 5000,
  },
  {
    id: 'rhythm',
    name: 'Rhythm tapping',
    blurb: 'Tap the notes as they come.',
    why: 'Tapping each notehead for its own length ties the symbol to the duration, which counting out loud never quite does.',
    items: RHYTHM_PATTERNS.map((p) => `rhy:${p.join(',')}`),
    requires: [{ skill: 'note-values', mastery: 0.35 }],
    fastMs: 0,
    slowMs: 0,
  },
  {
    id: 'find-key',
    name: 'Find the key',
    blurb: 'Which key is this note?',
    why: 'The last link in the chain: dot on the page to key under the finger, practised without needing the piano in front of you.',
    items: naturalsBetween(48, 79).map((m) => `find:${m}`),
    requires: [{ skill: 'notes-treble', mastery: 0.35 }],
    fastMs: 2200,
    slowMs: 5000,
  },
]

export function skillOf(itemId: string): Skill | undefined {
  return SKILLS.find((s) => s.items.includes(itemId))
}

export function getSkill(id: SkillId): Skill {
  return SKILLS.find((s) => s.id === id)!
}

/* ------------------------------------------------------------------ *
 * Turning an item into an actual question.
 * ------------------------------------------------------------------ */

export type Question =
  | { kind: 'name-note'; itemId: string; skill: SkillId; clef: Clef; midi: number; answer: Letter; prompt: string }
  | { kind: 'interval'; itemId: string; skill: SkillId; clef: Clef; low: number; high: number; answer: number; prompt: string }
  | { kind: 'key-signature'; itemId: string; skill: SkillId; keySig: KeySignature; options: string[]; answer: string; prompt: string }
  | { kind: 'note-value'; itemId: string; skill: SkillId; dur: number; rest: boolean; answer: number; prompt: string }
  | { kind: 'find-key'; itemId: string; skill: SkillId; clef: Clef; midi: number; low: number; high: number; prompt: string }
  | { kind: 'rhythm'; itemId: string; skill: SkillId; pattern: number[]; bpm: number; prompt: string }

const pick = <T,>(list: T[]): T => list[Math.floor(Math.random() * list.length)]

export function buildQuestion(itemId: string): Question | null {
  const skill = skillOf(itemId)
  if (!skill) return null
  const [kind, ...rest] = itemId.split(':')

  if (kind === 'lm' || kind === 'note') {
    const clef = rest[0] as Clef
    const midi = Number(rest[1])
    return {
      kind: 'name-note',
      itemId,
      skill: skill.id,
      clef,
      midi,
      answer: noteName(midi, KEYS.C)[0] as Letter,
      prompt: kind === 'lm' ? 'Name this landmark' : 'Name this note',
    }
  }

  if (kind === 'int') {
    const size = Number(rest[0])
    // Place the pair anywhere it fits, so the interval is recognised by its
    // shape rather than by memorising one position on the staff.
    const clef: Clef = Math.random() < 0.5 ? 'treble' : 'bass'
    const range = clef === 'treble' ? [59, 79] : [41, 60]
    const naturals = naturalsBetween(range[0], range[1])
    const startIndex = Math.floor(Math.random() * Math.max(1, naturals.length - size))
    const low = naturals[startIndex]
    const high = naturals[Math.min(naturals.length - 1, startIndex + size - 1)]
    return { kind: 'interval', itemId, skill: skill.id, clef, low, high, answer: size, prompt: 'How far apart?' }
  }

  if (kind === 'key') {
    const fifths = Number(rest[0])
    const keySig = keyFromFifths(fifths)
    // Distractors come from next door on the circle of fifths, which is where
    // the confusion actually is: one sharp either way, not a random key.
    const neighbours = [fifths - 2, fifths - 1, fifths + 1, fifths + 2]
      .filter((f) => f >= -6 && f <= 6)
      .map((f) => keyFromFifths(f).name)
    const options = shuffle([keySig.name, ...shuffle(neighbours).slice(0, 3)])
    return { kind: 'key-signature', itemId, skill: skill.id, keySig, options, answer: keySig.name, prompt: 'Which key is this?' }
  }

  if (kind === 'val') {
    const dur = Number(rest[0])
    const isRest = rest[1] === 'r'
    return {
      kind: 'note-value',
      itemId,
      skill: skill.id,
      dur,
      rest: isRest,
      answer: dur,
      prompt: isRest ? 'How many beats of silence?' : 'How many beats?',
    }
  }

  if (kind === 'find') {
    const midi = Number(rest[0])
    return {
      kind: 'find-key',
      itemId,
      skill: skill.id,
      clef: midi < 60 ? 'bass' : 'treble',
      midi,
      low: 48,
      high: 84,
      prompt: 'Tap this note on the keyboard',
    }
  }

  if (kind === 'rhy') {
    const pattern = rest[0].split(',').map(Number)
    return { kind: 'rhythm', itemId, skill: skill.id, pattern, bpm: pick([66, 72, 80]), prompt: 'Tap each note as it arrives' }
  }

  return null
}

function keyFromFifths(fifths: number): KeySignature {
  // Tonic pitch class is the number of fifths, wrapped: each fifth is 7 semitones.
  const pc = ((fifths * 7) % 12 + 12) % 12
  return keyFor(pc, false)
}

function shuffle<T>(list: T[]): T[] {
  const out = [...list]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

export { shuffle }
