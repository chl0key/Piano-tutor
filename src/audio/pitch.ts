import { freqToMidi } from '../music/theory'

/**
 * Monophonic pitch tracking from the microphone, so an unplugged acoustic or
 * digital piano still works — including on a phone, where Web MIDI does not exist.
 *
 * Uses normalised autocorrelation: robust on a piano's strong fundamental, and
 * cheap enough to run every animation frame. It hears one note at a time, so
 * chords are reported as their loudest partial — fine for the single-line
 * reading work this app is built around.
 */
export interface PitchEvent {
  midi: number
  cents: number
  clarity: number
}

const MIN_FREQ = 55 // A1
const MAX_FREQ = 1200 // ~D6

export class PitchDetector {
  private ctx: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private stream: MediaStream | null = null
  private buf = new Float32Array(2048)
  private raf = 0
  private lastMidi: number | null = null
  private stableCount = 0
  private silentFrames = 0

  onNoteOn: ((e: PitchEvent) => void) | null = null
  onNoteOff: ((midi: number) => void) | null = null
  /** Continuous readout for the tuner display; null when nothing is heard. */
  onPitch: ((e: PitchEvent | null) => void) | null = null

  get running(): boolean {
    return this.stream !== null
  }

  async start(ctx: AudioContext): Promise<void> {
    if (this.stream) return
    this.ctx = ctx
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    })
    const src = ctx.createMediaStreamSource(this.stream)
    this.analyser = ctx.createAnalyser()
    this.analyser.fftSize = 2048
    this.buf = new Float32Array(this.analyser.fftSize)
    src.connect(this.analyser)
    this.tick()
  }

  stop() {
    cancelAnimationFrame(this.raf)
    this.stream?.getTracks().forEach((t) => t.stop())
    this.stream = null
    this.analyser = null
    if (this.lastMidi !== null) this.onNoteOff?.(this.lastMidi)
    this.lastMidi = null
  }

  private tick = () => {
    this.raf = requestAnimationFrame(this.tick)
    if (!this.analyser || !this.ctx) return
    this.analyser.getFloatTimeDomainData(this.buf)
    const res = detect(this.buf, this.ctx.sampleRate)

    if (!res) {
      this.silentFrames++
      // A couple of quiet frames is a bow-change, not a release.
      if (this.silentFrames > 4 && this.lastMidi !== null) {
        this.onNoteOff?.(this.lastMidi)
        this.lastMidi = null
        this.stableCount = 0
        this.onPitch?.(null)
      }
      return
    }
    this.silentFrames = 0

    const exact = freqToMidi(res.freq)
    const midi = Math.round(exact)
    const cents = Math.round((exact - midi) * 100)
    const event: PitchEvent = { midi, cents, clarity: res.clarity }
    this.onPitch?.(event)

    if (midi === this.lastMidi) return
    // Require the same pitch on consecutive frames before committing, so an
    // attack transient is never reported as a wrong note.
    if (midi === this.pending) this.stableCount++
    else {
      this.pending = midi
      this.stableCount = 1
    }
    if (this.stableCount >= 3) {
      if (this.lastMidi !== null) this.onNoteOff?.(this.lastMidi)
      this.lastMidi = midi
      this.onNoteOn?.(event)
    }
  }

  private pending: number | null = null
}

/** Normalised autocorrelation. Returns null when the input is too quiet or noisy. */
export function detect(buf: Float32Array, sampleRate: number): { freq: number; clarity: number } | null {
  const n = buf.length
  let rms = 0
  for (let i = 0; i < n; i++) rms += buf[i] * buf[i]
  rms = Math.sqrt(rms / n)
  if (rms < 0.008) return null

  const minLag = Math.floor(sampleRate / MAX_FREQ)
  const maxLag = Math.min(Math.floor(sampleRate / MIN_FREQ), n - 1)

  let bestLag = -1
  let bestCorr = 0
  let prevCorr = 0
  let rising = false

  for (let lag = minLag; lag <= maxLag; lag++) {
    let corr = 0
    let normA = 0
    let normB = 0
    for (let i = 0; i < n - lag; i++) {
      corr += buf[i] * buf[i + lag]
      normA += buf[i] * buf[i]
      normB += buf[i + lag] * buf[i + lag]
    }
    const norm = Math.sqrt(normA * normB) || 1
    corr /= norm

    // Take the first strong peak rather than the global maximum: the global max
    // often sits an octave (or two) below the note actually played.
    if (!rising && corr > 0.5 && corr > prevCorr) rising = true
    if (rising) {
      if (corr > bestCorr) {
        bestCorr = corr
        bestLag = lag
      } else if (corr < bestCorr * 0.85 && bestLag > 0) {
        break
      }
    }
    prevCorr = corr
  }

  if (bestLag < 0 || bestCorr < 0.6) return null

  // Parabolic interpolation around the peak sharpens the estimate to well
  // under a cent, which matters for the in-tune readout.
  const refined = refineLag(buf, bestLag, n)
  return { freq: sampleRate / refined, clarity: bestCorr }
}

function corrAt(buf: Float32Array, lag: number, n: number): number {
  let c = 0
  for (let i = 0; i < n - lag; i++) c += buf[i] * buf[i + lag]
  return c
}

function refineLag(buf: Float32Array, lag: number, n: number): number {
  if (lag <= 1 || lag >= n - 2) return lag
  const y0 = corrAt(buf, lag - 1, n)
  const y1 = corrAt(buf, lag, n)
  const y2 = corrAt(buf, lag + 1, n)
  const denom = 2 * (2 * y1 - y0 - y2)
  if (denom === 0) return lag
  return lag + (y2 - y0) / denom
}
