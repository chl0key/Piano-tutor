import { CHORD_TONES, detectKey, parseChord, type Chord, type Quality } from './chords'
import type { SongNote } from './song'
import type { KeySignature } from './theory'

export interface ChordEvent {
  chord: Chord
  /** Beat the chord starts on. */
  start: number
  /** Length in beats. Never longer than one bar. */
  dur: number
}

export interface ChartSection {
  name: string
  start: number
  end: number
}

export interface ChordChart {
  events: ChordEvent[]
  sections: ChartSection[]
  key: KeySignature
  timeSig: [number, number]
  bpm: number
  beatsPerBar: number
  /** Lines that were not chords, so the person pasting can see what was ignored. */
  ignored: string[]
}

const SECTION_RE = /^\s*(?:\[([^\]]+)\]|([A-Za-z][A-Za-z0-9 '’-]{0,24}):)\s*$/
const NOISE = /^(x\s*\d+|\d+x|N\.?C\.?|%|\||-+|:)$/i

/**
 * Reads a chord chart the way people actually write them: bracketed section
 * names, bars separated by pipes, or just chords on a line. Anything that is
 * not a chord — lyrics, tab, capo notes — is ignored rather than rejected, so
 * a chord sheet copied off the web can be pasted in whole.
 */
export function parseChart(
  text: string,
  opts: { timeSig?: [number, number]; bpm?: number; key?: KeySignature } = {},
): ChordChart {
  const timeSig = opts.timeSig ?? [4, 4]
  const beatsPerBar = timeSig[0] * (4 / timeSig[1])

  const events: ChordEvent[] = []
  const sections: ChartSection[] = []
  const ignored: string[] = []
  let beat = 0
  let sectionName = ''
  let sectionStart = 0
  let previous: Chord | null = null

  const closeSection = () => {
    if (sectionName && beat > sectionStart) {
      sections.push({ name: sectionName, start: sectionStart, end: beat })
    }
  }

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line) continue

    const header = SECTION_RE.exec(line)
    if (header) {
      closeSection()
      sectionName = (header[1] ?? header[2]).trim()
      sectionStart = beat
      continue
    }

    // Bars are pipe-delimited when pipes are present, one chord per bar otherwise.
    const bars = line.includes('|')
      ? line.split('|').map((b) => b.trim()).filter(Boolean)
      : line.split(/\s+/).filter(Boolean).map((t) => t)

    const parsedBars: (Chord | null)[][] = []
    let looksLikeChords = true
    let tokenCount = 0

    for (const bar of bars) {
      const tokens = bar.split(/\s+/).filter(Boolean).filter((t) => !NOISE.test(t))
      if (tokens.length === 0) continue
      const chords = tokens.map((t) => parseChord(stripDecoration(t)))
      tokenCount += chords.length
      if (chords.some((c) => c === null)) looksLikeChords = false
      parsedBars.push(chords)
    }

    if (!looksLikeChords || tokenCount === 0) {
      ignored.push(line)
      continue
    }

    for (const bar of parsedBars) {
      const chords = bar.filter((c): c is Chord => c !== null)
      if (chords.length === 0) continue
      const each = beatsPerBar / chords.length
      for (const chord of chords) {
        events.push({ chord, start: beat, dur: each })
        previous = chord
        beat += each
      }
    }
  }

  closeSection()
  if (sections.length === 0 && beat > 0) sections.push({ name: 'Whole song', start: 0, end: beat })
  void previous

  return {
    events: mergeRepeats(events),
    sections,
    key: opts.key ?? detectKey(events.map((e) => ({ chord: e.chord, dur: e.dur }))),
    timeSig,
    bpm: opts.bpm ?? 84,
    beatsPerBar,
    ignored,
  }
}

/** Trim brackets and trailing punctuation that chord sheets sprinkle around symbols. */
function stripDecoration(token: string): string {
  return token.replace(/^[([{]+/, '').replace(/[)\]},.]+$/, '')
}

/**
 * Two identical chords back to back inside one bar are one chord held longer.
 * Merging them keeps the notation honest and stops the lesson demanding the
 * same chord twice in a row for no musical reason.
 */
function mergeRepeats(events: ChordEvent[]): ChordEvent[] {
  const out: ChordEvent[] = []
  for (const e of events) {
    const last = out[out.length - 1]
    if (
      last &&
      last.chord.root === e.chord.root &&
      last.chord.quality === e.chord.quality &&
      last.chord.bass === e.chord.bass &&
      Math.abs(last.start + last.dur - e.start) < 1e-6
    ) {
      last.dur += e.dur
    } else {
      out.push({ ...e })
    }
  }
  return out
}

/** Split any chord that straddles a barline, so every note stays writable. */
export function splitAtBars(events: ChordEvent[], beatsPerBar: number): ChordEvent[] {
  const out: ChordEvent[] = []
  for (const e of events) {
    let start = e.start
    const end = e.start + e.dur
    while (start < end - 1e-6) {
      const barEnd = (Math.floor(start / beatsPerBar) + 1) * beatsPerBar
      const stop = Math.min(end, barEnd)
      out.push({ chord: e.chord, start, dur: stop - start })
      start = stop
    }
  }
  return out
}

export function chartEnd(chart: ChordChart): number {
  return chart.events.reduce((m, e) => Math.max(m, e.start + e.dur), 0)
}

/* ------------------------------------------------------------------ *
 * Reading the harmony back out of played notes, so an imported MIDI can
 * also produce the simpler levels rather than only the full arrangement.
 * ------------------------------------------------------------------ */

/** Qualities worth guessing. Anything rarer is better described as one of these. */
const CANDIDATES: Quality[] = ['maj', 'min', 'dom7', 'maj7', 'min7', 'min7b5', 'dim', 'sus4']

/**
 * How likely each quality is to be what a song actually plays. Without this the
 * scorer reaches for sus4 and diminished chords constantly, because they happen
 * to fit whatever two notes are sounding.
 */
const QUALITY_PRIOR: Record<string, number> = {
  maj: 0.07, min: 0.06, dom7: 0.02, min7: 0.01, maj7: 0, sus4: -0.05, dim: -0.06, min7b5: -0.05,
}

const PC_LABEL = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B']
const QUALITY_LABEL: Record<Quality, string> = {
  maj: '', min: 'm', dim: 'dim', aug: 'aug', sus2: 'sus2', sus4: 'sus4',
  maj6: '6', min6: 'm6', dom7: '7', maj7: 'maj7', min7: 'm7',
  min7b5: 'm7♭5', dim7: 'dim7', add9: 'add9', dom9: '9',
}

/**
 * Guess the chord in each half-bar from the notes sounding in it, then merge
 * neighbours that agree. Half-bar windows catch the two-chords-a-bar songs
 * without inventing changes in the ones that hold a chord for four beats.
 */
export function detectChords(notes: SongNote[], beatsPerBar: number): ChordEvent[] {
  if (notes.length === 0) return []
  const end = notes.reduce((m, n) => Math.max(m, n.start + n.dur), 0)
  const window = beatsPerBar / 2
  const events: ChordEvent[] = []

  const weightsFor = (from: number, to: number) => {
    const weight = new Array(12).fill(0)
    let bassPc = -1
    let bassPitch = Infinity
    for (const n of notes) {
      const overlap = Math.min(n.start + n.dur, to) - Math.max(n.start, from)
      if (overlap <= 0) continue
      weight[n.midi % 12] += overlap
      if (n.midi < bassPitch) {
        bassPitch = n.midi
        bassPc = n.midi % 12
      }
    }
    return { weight, bassPc, total: weight.reduce((a, b) => a + b, 0) }
  }

  for (let start = 0; start < end - 1e-6; start += window) {
    const stop = start + window
    let w = weightsFor(start, stop)

    // A thin half-bar cannot name a chord on its own. Widen to the whole bar
    // before guessing: a sparse texture is a reason to look further, not to
    // invent a chord out of two notes.
    if (w.weight.filter((x) => x > 0).length < 3) {
      const barStart = Math.floor(start / beatsPerBar) * beatsPerBar
      w = weightsFor(barStart, barStart + beatsPerBar)
    }
    if (w.total < window * 0.2) {
      const previous = events[events.length - 1]
      if (previous) events.push({ chord: previous.chord, start, dur: window })
      continue
    }

    const { weight, bassPc, total } = w
    let best: { chord: Chord; score: number } | null = null
    for (let root = 0; root < 12; root++) {
      for (const quality of CANDIDATES) {
        const tones = new Set(CHORD_TONES[quality].map((i) => (root + i) % 12))
        let inside = 0
        for (const pc of tones) inside += weight[pc]
        const outside = total - inside
        const score =
          inside / total -
          0.6 * (outside / total) +
          (root === bassPc ? 0.35 : 0) +
          (QUALITY_PRIOR[quality] ?? 0) -
          0.03 * tones.size
        if (!best || score > best.score) {
          best = {
            score,
            chord: { root, quality, text: `${PC_LABEL[root]}${QUALITY_LABEL[quality]}` },
          }
        }
      }
    }
    if (best) events.push({ chord: best.chord, start, dur: window })
  }

  return mergeRepeats(events)
}

/** Wrap detected chords as a chart, so the same arranger can build the easier levels. */
export function chartFromNotes(
  notes: SongNote[],
  timeSig: [number, number],
  bpm: number,
): ChordChart {
  const beatsPerBar = timeSig[0] * (4 / timeSig[1])
  const events = detectChords(notes, beatsPerBar)
  return {
    events,
    sections: [{ name: 'Whole song', start: 0, end: events.reduce((m, e) => Math.max(m, e.start + e.dur), 0) }],
    key: detectKey(events.map((e) => ({ chord: e.chord, dur: e.dur }))),
    timeSig,
    bpm,
    beatsPerBar,
    ignored: [],
  }
}
