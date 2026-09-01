import { CHORD_TONES, TRIAD_OF, bassNote, voiceChord, type Chord } from './chords'
import { chartEnd, splitAtBars, type ChordChart, type ChordEvent } from './chart'
import type { ChordMark, Section, Song, SongNote } from './song'

export type ArrangementLevel = 'basic' | 'intermediate' | 'advanced'

export const ARRANGEMENTS: { id: ArrangementLevel; name: string; blurb: string }[] = [
  {
    id: 'basic',
    name: 'Basic',
    blurb: 'Every chord of the song in order, one block per bar. Play this and you have played the song.',
  },
  {
    id: 'intermediate',
    name: 'Intermediate',
    blurb: 'Chords now lean on each other — inversions so the hand barely moves — over a walking bass, with sevenths back in.',
  },
  {
    id: 'advanced',
    name: 'Advanced',
    blurb: 'Broken left-hand octaves under a running right-hand arpeggio, with the colour notes the chords imply.',
  },
]

/** Where each hand lives, so voicings never wander off into the extremes. */
const RH_LOW = 59
const RH_HIGH = 84
const LH_LOW = 36
const LH_HIGH = 55

/** Fingerings for a voicing read bottom to top. Hints, not gospel. */
const RH_FINGERS: Record<number, number[]> = {
  2: [1, 5], 3: [1, 3, 5], 4: [1, 2, 3, 5], 5: [1, 2, 3, 4, 5],
}

export function arrangeChart(
  chart: ChordChart,
  level: ArrangementLevel,
  meta: { id: string; title: string; artist: string; source: string },
): Song {
  const events = splitAtBars(chart.events, chart.beatsPerBar)
  const notes: SongNote[] = []
  const chords: ChordMark[] = []
  let previousVoicing: number[] = []
  let lastText = ''

  for (let i = 0; i < events.length; i++) {
    const e = events[i]
    const next = events[i + 1]
    if (e.chord.text !== lastText) {
      chords.push({ start: e.start, text: e.chord.text })
      lastText = e.chord.text
    }

    // Basic teaches chord shapes, so every chord stays in root position and is
    // recognisably itself. Voice leading — the thing that makes chords easy to
    // play but hides the shape — is what the intermediate level introduces.
    const intervals = level === 'basic' ? TRIAD_OF[e.chord.quality] : CHORD_TONES[e.chord.quality]
    const voicing = voiceChord(intervals, e.chord.root, {
      low: level === 'basic' ? 60 : RH_LOW,
      high: RH_HIGH,
      previous: level === 'basic' ? undefined : previousVoicing,
      rootPosition: level === 'basic',
      anchor: 64,
    })
    previousVoicing = voicing
    const root = bassNote(e.chord, LH_LOW, LH_HIGH)
    const fifth = fitFifth(root, e.chord)

    if (level === 'basic') notes.push(...basicBar(e, voicing, root))
    else if (level === 'intermediate') notes.push(...intermediateBar(e, voicing, root, fifth))
    else notes.push(...advancedBar(e, voicing, root, fifth, next))
  }

  const end = chartEnd(chart)
  const sections: Section[] = chart.sections.length
    ? chart.sections.map((s) => ({ name: s.name, start: s.start, end: s.end }))
    : [{ name: 'Whole song', start: 0, end }]

  const named = ARRANGEMENTS.find((a) => a.id === level)!
  return {
    id: `${meta.id}:${level}`,
    title: meta.title,
    composer: meta.artist,
    key: chart.key,
    timeSig: chart.timeSig,
    bpm: chart.bpm,
    level: 99,
    why: named.blurb,
    teaches: teachesFor(level, chart),
    notes: notes.sort((a, b) => a.start - b.start || a.midi - b.midi),
    sections,
    chords,
    source: meta.source,
  }
}

function teachesFor(level: ArrangementLevel, chart: ChordChart): string[] {
  const count = new Set(chart.events.map((e) => e.chord.text)).size
  if (level === 'basic') return [`${count} chords, in order`, 'Block chords', chart.key.name]
  if (level === 'intermediate') return ['Inversions', 'Alternating bass', 'Sevenths']
  return ['Broken octaves', 'Right-hand arpeggios', 'Ninths and colour tones']
}

/* -------------------------------------------------------------- levels */

/** One block chord per bar, held. The whole song, playable, with two hands. */
function basicBar(e: ChordEvent, voicing: number[], root: number): SongNote[] {
  const fingers = RH_FINGERS[voicing.length] ?? RH_FINGERS[3]
  return [
    ...voicing.map((midi, i) => ({
      midi, start: e.start, dur: e.dur, hand: 'R' as const, finger: fingers[i],
    })),
    { midi: root, start: e.start, dur: e.dur, hand: 'L' as const, finger: 5 },
  ]
}

/** Chord twice a bar over an alternating root-and-fifth bass. */
function intermediateBar(e: ChordEvent, voicing: number[], root: number, fifth: number): SongNote[] {
  const out: SongNote[] = []
  const fingers = RH_FINGERS[voicing.length] ?? RH_FINGERS[3]
  const half = e.dur / 2

  for (const at of [e.start, e.start + half]) {
    if (half < 0.5) break
    voicing.forEach((midi, i) => {
      out.push({ midi, start: at, dur: half, hand: 'R', finger: fingers[i] })
    })
  }
  if (half < 0.5) {
    voicing.forEach((midi, i) => out.push({ midi, start: e.start, dur: e.dur, hand: 'R', finger: fingers[i] }))
  }

  // Bass in quarter notes, root then fifth, for as long as the chord lasts.
  const beats = Math.max(1, Math.round(e.dur))
  for (let b = 0; b < beats; b++) {
    const onRoot = b % 2 === 0
    out.push({
      midi: onRoot ? root : fifth,
      start: e.start + b * (e.dur / beats),
      dur: e.dur / beats,
      hand: 'L',
      finger: onRoot ? 5 : 1,
    })
  }
  return out
}

/**
 * Broken octaves underneath a running arpeggio. This is as far as a chord
 * chart can honestly take you: it is the full harmony of the song, voiced the
 * way a pianist would play it, but it is not a transcription of the record.
 */
function advancedBar(
  e: ChordEvent, voicing: number[], root: number, fifth: number, next?: ChordEvent,
): SongNote[] {
  const out: SongNote[] = []
  const colour = withColour(voicing, e.chord)
  const shape = [...colour, ...colour.slice(0, -1).reverse()]
  const steps = Math.max(1, Math.round(e.dur / 0.5))

  for (let i = 0; i < steps; i++) {
    const midi = shape[i % shape.length]
    const finger = (RH_FINGERS[colour.length] ?? RH_FINGERS[4])[
      Math.min(i % shape.length, colour.length - 1)
    ]
    out.push({ midi, start: e.start + i * 0.5, dur: 0.5, hand: 'R', finger })
  }

  const beats = Math.max(1, Math.round(e.dur))
  const pattern = [root, fifth, root + 12, fifth]
  for (let b = 0; b < beats; b++) {
    let midi = pattern[b % pattern.length]
    // Walk a step towards the next chord on the last beat, the way a bass line does.
    if (next && b === beats - 1 && beats > 1) {
      const target = bassNote(next.chord, LH_LOW, LH_HIGH)
      if (Math.abs(target - root) > 2) midi = root + Math.sign(target - root) * 2
    }
    out.push({
      midi,
      start: e.start + b * (e.dur / beats),
      dur: e.dur / beats,
      hand: 'L',
      finger: midi >= root + 12 ? 1 : midi === root ? 5 : 2,
    })
  }
  return out
}

/** Add the ninth on top where the chord can carry one, for a fuller sound. */
function withColour(voicing: number[], chord: Chord): number[] {
  const takesNinth = ['maj7', 'min7', 'dom7', 'dom9', 'add9', 'maj6', 'min6'].includes(chord.quality)
  if (!takesNinth) return voicing
  const top = voicing[voicing.length - 1]
  const ninthPc = (chord.root + 2) % 12
  let ninth = top + ((((ninthPc - top) % 12) + 12) % 12)
  if (ninth === top) ninth += 12
  return ninth <= RH_HIGH ? [...voicing, ninth] : voicing
}

/** The fifth above the bass, kept inside the left hand's range. */
function fitFifth(root: number, chord: Chord): number {
  const pc = (chord.root + 7) % 12
  let n = root + ((((pc - root) % 12) + 12) % 12)
  if (n === root) n += 12
  if (n > LH_HIGH) n -= 12
  return n
}
