import { midiToFreq } from '../music/theory'

/**
 * A small additive piano voice. Real samples would sound better but would mean
 * megabytes of assets; this keeps the app instant to load on a phone.
 */
export class Synth {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private active = new Map<number, { osc: OscillatorNode[]; gain: GainNode }>()

  /** Must be called from a user gesture — browsers block audio otherwise. */
  async resume(): Promise<AudioContext> {
    if (!this.ctx) {
      const Ctor = window.AudioContext || (window as any).webkitAudioContext
      this.ctx = new Ctor()
      this.master = this.ctx.createGain()
      this.master.gain.value = 0.5
      this.master.connect(this.ctx.destination)
    }
    if (this.ctx.state === 'suspended') await this.ctx.resume()
    return this.ctx
  }

  get ready(): boolean {
    return this.ctx !== null && this.ctx.state === 'running'
  }

  setVolume(v: number) {
    if (this.master) this.master.gain.value = v
  }

  noteOn(midi: number, velocity = 0.8) {
    if (!this.ctx || !this.master) return
    this.noteOff(midi, 0.02)
    const now = this.ctx.currentTime
    const freq = midiToFreq(midi)
    const gain = this.ctx.createGain()

    // Piano-ish: fast attack, quick initial decay, long quiet tail.
    const peak = 0.22 * velocity
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(peak, now + 0.006)
    gain.gain.exponentialRampToValueAtTime(peak * 0.35, now + 0.25)
    gain.gain.exponentialRampToValueAtTime(peak * 0.12, now + 1.6)
    gain.connect(this.master)

    // Three partials, quieter and slightly detuned as they rise: warmth without a sample.
    const partials: [number, number, OscillatorType][] = [
      [1, 1.0, 'triangle'],
      [2.01, 0.32, 'sine'],
      [3.02, 0.12, 'sine'],
    ]
    const oscs: OscillatorNode[] = []
    for (const [mult, amp, type] of partials) {
      const osc = this.ctx.createOscillator()
      osc.type = type
      osc.frequency.value = freq * mult
      const g = this.ctx.createGain()
      g.gain.value = amp
      osc.connect(g).connect(gain)
      osc.start(now)
      oscs.push(osc)
    }
    this.active.set(midi, { osc: oscs, gain })
  }

  noteOff(midi: number, release = 0.35) {
    const v = this.active.get(midi)
    if (!v || !this.ctx) return
    const now = this.ctx.currentTime
    const g = v.gain.gain
    g.cancelScheduledValues(now)
    g.setValueAtTime(Math.max(g.value, 0.0001), now)
    g.exponentialRampToValueAtTime(0.0001, now + release)
    for (const o of v.osc) o.stop(now + release + 0.05)
    this.active.delete(midi)
  }

  /** Short blip used for the metronome and for correct/wrong feedback. */
  blip(freq: number, dur = 0.06, vol = 0.15) {
    if (!this.ctx || !this.master) return
    const now = this.ctx.currentTime
    const osc = this.ctx.createOscillator()
    const g = this.ctx.createGain()
    osc.type = 'square'
    osc.frequency.value = freq
    g.gain.setValueAtTime(0.0001, now)
    g.gain.exponentialRampToValueAtTime(vol, now + 0.004)
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur)
    osc.connect(g).connect(this.master)
    osc.start(now)
    osc.stop(now + dur + 0.02)
  }

  allOff() {
    for (const midi of [...this.active.keys()]) this.noteOff(midi, 0.08)
  }
}

export const synth = new Synth()
