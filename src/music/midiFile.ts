import type { SongNote } from './song'

/**
 * A small Standard MIDI File reader. A MIDI of a song carries the actual notes
 * and the actual timing, which is the only honest way to get "the full song"
 * onto a stave — chord charts can give the harmony but never the melody.
 */

export interface RawNote {
  midi: number
  start: number // beats
  dur: number
  track: number
}

export interface MidiTrack {
  index: number
  name: string
  noteCount: number
  low: number
  high: number
  /** Average pitch, used to guess which hand a track belongs to. */
  centre: number
  drums: boolean
}

export interface MidiFileData {
  tracks: MidiTrack[]
  notes: RawNote[]
  bpm: number
  timeSig: [number, number]
  name: string
}

class Reader {
  pos = 0
  constructor(private view: DataView) {}
  u8() { return this.view.getUint8(this.pos++) }
  u16() { const v = this.view.getUint16(this.pos); this.pos += 2; return v }
  u32() { const v = this.view.getUint32(this.pos); this.pos += 4; return v }
  bytes(n: number) {
    const out = new Uint8Array(this.view.buffer, this.view.byteOffset + this.pos, n)
    this.pos += n
    return out
  }
  varInt() {
    let value = 0
    for (;;) {
      const b = this.u8()
      value = (value << 7) | (b & 0x7f)
      if ((b & 0x80) === 0) return value
    }
  }
  get done() { return this.pos >= this.view.byteLength }
}

export function parseMidiFile(buffer: ArrayBuffer): MidiFileData {
  const r = new Reader(new DataView(buffer))
  if (r.u32() !== 0x4d546864) throw new Error('That is not a MIDI file — the header is missing.')
  const headerLength = r.u32()
  r.u16() // format; both 0 and 1 are read the same way here
  const trackCount = r.u16()
  const division = r.u16()
  r.pos += headerLength - 6
  if (division & 0x8000) throw new Error('This MIDI uses SMPTE timing, which this reader does not handle.')

  const notes: RawNote[] = []
  const trackNames: string[] = []
  const trackDrums: boolean[] = []
  let bpm = 0
  let timeSig: [number, number] = [4, 4]

  for (let t = 0; t < trackCount && !r.done; t++) {
    if (r.u32() !== 0x4d54726b) break
    const length = r.u32()
    const end = r.pos + length
    let tick = 0
    let status = 0
    // Notes waiting for their note-off, keyed by pitch and channel.
    const open = new Map<number, { start: number; velocity: number }[]>()
    trackNames[t] = ''
    trackDrums[t] = false

    while (r.pos < end) {
      tick += r.varInt()
      let byte = r.u8()
      if (byte < 0x80) {
        // Running status: reuse the last command byte.
        r.pos--
        byte = status
      } else {
        status = byte
      }
      const command = byte & 0xf0
      const channel = byte & 0x0f

      if (byte === 0xff) {
        const type = r.u8()
        const len = r.varInt()
        const data = r.bytes(len)
        if (type === 0x03 && !trackNames[t]) trackNames[t] = decodeText(data)
        if (type === 0x51 && len === 3 && bpm === 0) {
          const us = (data[0] << 16) | (data[1] << 8) | data[2]
          bpm = Math.round(60000000 / us)
        }
        if (type === 0x58 && len >= 2) timeSig = [data[0], 2 ** data[1]]
      } else if (byte === 0xf0 || byte === 0xf7) {
        r.pos += r.varInt()
      } else if (command === 0x90 || command === 0x80) {
        const note = r.u8()
        const velocity = r.u8()
        const key = channel * 128 + note
        if (command === 0x90 && velocity > 0) {
          if (channel === 9) trackDrums[t] = true
          const list = open.get(key) ?? []
          list.push({ start: tick, velocity })
          open.set(key, list)
        } else {
          const list = open.get(key)
          const started = list?.shift()
          if (started && channel !== 9) {
            notes.push({
              midi: note,
              start: started.start / division,
              dur: Math.max((tick - started.start) / division, 0.05),
              track: t,
            })
          }
        }
      } else if (command === 0xc0 || command === 0xd0) {
        r.pos += 1
      } else if (command < 0xf0) {
        r.pos += 2
      }
    }
    r.pos = end
  }

  const tracks: MidiTrack[] = []
  for (let t = 0; t < trackCount; t++) {
    const own = notes.filter((n) => n.track === t)
    if (own.length === 0) continue
    const pitches = own.map((n) => n.midi)
    tracks.push({
      index: t,
      name: trackNames[t] || `Track ${t + 1}`,
      noteCount: own.length,
      low: Math.min(...pitches),
      high: Math.max(...pitches),
      centre: pitches.reduce((a, b) => a + b, 0) / pitches.length,
      drums: trackDrums[t],
    })
  }

  return { tracks, notes, bpm: bpm || 100, timeSig, name: trackNames.find(Boolean) ?? '' }
}

function decodeText(bytes: Uint8Array): string {
  try {
    return new TextDecoder().decode(bytes).trim()
  } catch {
    return ''
  }
}

const WRITABLE = [4, 3, 2, 1.5, 1, 0.75, 0.5, 0.25]

export interface BuildOptions {
  /** Track indices to keep. */
  tracks: number[]
  /** Tracks forced to the left hand; anything else is split by pitch. */
  leftHand?: number[]
  /** Notes below this go to the left hand when no track split is given. */
  splitPoint?: number
  /** Most notes either hand may be asked to play at once. */
  maxVoices?: number
}

/**
 * Turn raw MIDI into something a person can read and play: quantised so the
 * notation is writable, thinned so neither hand is asked for a ten-note chord,
 * and shifted so the piece starts at beat zero.
 */
export function buildFromMidi(data: MidiFileData, opts: BuildOptions): SongNote[] {
  const keep = new Set(opts.tracks)
  const left = new Set(opts.leftHand ?? [])
  const maxVoices = opts.maxVoices ?? 4
  const chosen = data.notes.filter((n) => keep.has(n.track))
  if (chosen.length === 0) return []

  // Prefer whatever the file already knows: only fall back to a pitch threshold
  // when no track has been named as the left hand.
  const splitPoint = opts.splitPoint ?? guessSplit(chosen)
  const offset = Math.min(...chosen.map((n) => n.start))

  const quantised: SongNote[] = chosen.map((n) => {
    const hand: 'L' | 'R' = left.size > 0
      ? (left.has(n.track) ? 'L' : 'R')
      : (n.midi < splitPoint ? 'L' : 'R')
    return {
      midi: n.midi,
      start: Math.round((n.start - offset) * 4) / 4,
      dur: nearestWritable(n.dur),
      hand,
    }
  })

  // Thin each simultaneous stack: the outer voices carry the tune and the bass.
  const byOnset = new Map<string, SongNote[]>()
  for (const n of quantised) {
    const key = `${n.hand}@${n.start}`
    const list = byOnset.get(key) ?? []
    list.push(n)
    byOnset.set(key, list)
  }
  const out: SongNote[] = []
  for (const [key, list] of byOnset) {
    if (list.length <= maxVoices) {
      out.push(...dedupe(list))
      continue
    }
    const sorted = [...list].sort((a, b) => a.midi - b.midi)
    const kept = key.startsWith('R') ? sorted.slice(-maxVoices) : sorted.slice(0, maxVoices)
    out.push(...dedupe(kept))
  }

  return out.sort((a, b) => a.start - b.start || a.midi - b.midi)
}

function dedupe(notes: SongNote[]): SongNote[] {
  const seen = new Set<number>()
  return notes.filter((n) => (seen.has(n.midi) ? false : (seen.add(n.midi), true)))
}

function nearestWritable(dur: number): number {
  return WRITABLE.reduce((best, d) => (Math.abs(d - dur) < Math.abs(best - dur) ? d : best), 0.25)
}

/**
 * Pick the pitch that separates the hands. The median splits the notes evenly,
 * which is right for a solo piano part and close enough for anything else.
 */
function guessSplit(notes: RawNote[]): number {
  const pitches = notes.map((n) => n.midi).sort((a, b) => a - b)
  const median = pitches[Math.floor(pitches.length / 2)]
  return Math.max(52, Math.min(67, median))
}

/**
 * A sensible default: the piano tracks if the file names any, otherwise the two
 * busiest. Also guesses which of them is the left hand, because a file that
 * already separates the hands knows better than any pitch threshold can.
 */
export function suggestTracks(tracks: MidiTrack[]): { tracks: number[]; leftHand: number[] } {
  const usable = tracks.filter((t) => !t.drums && t.noteCount > 2)
  const pool = usable.length > 0 ? usable : tracks.slice(0, 1)
  const named = pool.filter((t) => /piano|keys|klavier|clavier/i.test(t.name))
  const chosen = named.length > 0
    ? named
    : [...pool].sort((a, b) => b.noteCount - a.noteCount).slice(0, 2)

  return { tracks: chosen.map((t) => t.index), leftHand: guessLeftHand(chosen) }
}

/**
 * Two tracks a clear distance apart in pitch are a right hand and a left hand.
 * Anything closer than a fifth on average is more likely two voices of the same
 * part, and is better split by pitch note-by-note.
 */
export function guessLeftHand(tracks: MidiTrack[]): number[] {
  if (tracks.length !== 2) return []
  const [a, b] = [...tracks].sort((x, y) => x.centre - y.centre)
  return b.centre - a.centre >= 7 ? [a.index] : []
}
