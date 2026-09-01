import { KEYS, midiFromLetter, type KeySignature } from './theory'
import { assemble, line, type Song, type Step } from './song'

const MAJOR = [0, 2, 4, 5, 7, 9, 11, 12]
const MINOR = [0, 2, 3, 5, 7, 8, 10, 12]

/** Standard fingerings. F major is the one that breaks the pattern. */
function rhFingering(rootName: string): number[] {
  return rootName === 'F' ? [1, 2, 3, 4, 1, 2, 3, 4] : [1, 2, 3, 1, 2, 3, 4, 5]
}
const LH_FINGERING = [5, 4, 3, 2, 1, 3, 2, 1]

interface ScaleSpec {
  id: string
  title: string
  rootName: string
  root: number
  key: KeySignature
  minor?: boolean
}

const SCALES: ScaleSpec[] = [
  { id: 'c', title: 'C major', rootName: 'C', root: midiFromLetter('C', 0, 4), key: KEYS.C },
  { id: 'g', title: 'G major', rootName: 'G', root: midiFromLetter('G', 0, 3), key: KEYS.G },
  { id: 'f', title: 'F major', rootName: 'F', root: midiFromLetter('F', 0, 3), key: KEYS.F },
  { id: 'd', title: 'D major', rootName: 'D', root: midiFromLetter('D', 0, 4), key: KEYS.D },
  { id: 'a-minor', title: 'A minor', rootName: 'A', root: midiFromLetter('A', 0, 3), key: KEYS.Am, minor: true },
]

/**
 * A one-octave scale, up and back down, both hands an octave apart. Reading a
 * scale is the fastest way to stop decoding notes one at a time and start
 * seeing steps.
 */
export function scaleExercise(spec: ScaleSpec): Song {
  const steps = spec.minor ? MINOR : MAJOR
  const up = steps.map((s) => spec.root + s)
  const down = [...up].reverse().slice(1)
  const pitches = [...up, ...down]
  const rh = rhFingering(spec.rootName)
  const rhFingers = [...rh, ...[...rh].reverse().slice(1)]
  const lhFingers = [...LH_FINGERING, ...[...LH_FINGERING].reverse().slice(1)]

  const rhSteps: Step[] = pitches.map((m, i) => [m, 1, rhFingers[i]])
  const lhSteps: Step[] = pitches.map((m, i) => [m - 12, 1, lhFingers[i]])

  return {
    id: `scale-${spec.id}`,
    title: `${spec.title} scale`,
    composer: 'Technique',
    key: spec.key,
    timeSig: [4, 4],
    bpm: 72,
    level: 0,
    why: 'Steps on the page, steps under the hand. Learn to read the shape, not the letters.',
    teaches: ['Thumb tucks', `Key signature: ${spec.key.name}`, 'Both hands in parallel'],
    source: 'Generated',
    sections: [
      { name: 'Going up', start: 0, end: 8 },
      { name: 'Coming down', start: 8, end: 15 },
    ],
    notes: assemble(line(0, 'R', rhSteps), line(0, 'L', lhSteps)),
  }
}

/**
 * Right hand moves twice as fast as the left. Hands doing different things is
 * a separate skill from either hand alone, and it needs its own drill.
 */
export function handIndependenceExercise(): Song {
  const c4 = midiFromLetter('C', 0, 4)
  const pattern = [0, 2, 4, 5, 4, 2, 0, 2]
  const rhSteps: Step[] = []
  for (let bar = 0; bar < 4; bar++) {
    for (const p of pattern) rhSteps.push([c4 + p, 0.5, fingerFor(p)])
  }
  const lhRoots = [0, -5, -7, 0]
  const lhSteps: Step[] = lhRoots.map((r) => [c4 - 12 + r, 4, r === 0 ? 5 : 3])

  return {
    id: 'hand-independence',
    title: 'Two speeds at once',
    composer: 'Technique',
    key: KEYS.C,
    timeSig: [4, 4],
    bpm: 66,
    level: 0,
    why: 'Left hand holds, right hand moves. The hardest easy thing on the piano.',
    teaches: ['Eighth notes against whole notes', 'Steady left hand', 'Counting in 4'],
    source: 'Generated',
    sections: [
      { name: 'Bars 1–2', start: 0, end: 8 },
      { name: 'Bars 3–4', start: 8, end: 16 },
    ],
    notes: assemble(line(0, 'R', rhSteps), line(0, 'L', lhSteps)),
  }
}

function fingerFor(offset: number): number {
  return { 0: 1, 2: 2, 4: 3, 5: 4, 7: 5 }[offset] ?? 1
}

export const EXERCISES: Song[] = [
  ...SCALES.map(scaleExercise),
  handIndependenceExercise(),
]
