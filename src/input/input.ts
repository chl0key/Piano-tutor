import { useEffect, useState } from 'react'
import { PitchDetector } from '../audio/pitch'
import { synth } from '../audio/synth'

export type InputSource = 'screen' | 'midi' | 'mic'

export interface InputStatus {
  source: InputSource
  midiDevices: string[]
  midiSupported: boolean
  micActive: boolean
  /** False until a source has been picked, so the app can prompt on first run. */
  chosen: boolean
  error: string | null
  /** Live tuner readout while the mic is listening. */
  cents: number | null
  heardMidi: number | null
}

type NoteListener = (midi: number, velocity: number) => void

/**
 * One place that answers "what note is being played right now", whichever way
 * it arrived: a USB keyboard, the microphone, the on-screen keys, or the
 * computer's own keyboard. Everything downstream listens here and does not care.
 */
class InputManager {
  readonly held = new Set<number>()
  private onListeners = new Set<NoteListener>()
  private offListeners = new Set<(midi: number) => void>()
  private statusListeners = new Set<(s: InputStatus) => void>()
  private detector = new PitchDetector()
  private midiAccess: MIDIAccess | null = null

  status: InputStatus = {
    source: 'screen',
    midiDevices: [],
    midiSupported: typeof navigator !== 'undefined' && 'requestMIDIAccess' in navigator,
    micActive: false,
    chosen: false,
    error: null,
    cents: null,
    heardMidi: null,
  }

  onNoteOn(fn: NoteListener): () => void {
    this.onListeners.add(fn)
    return () => {
      this.onListeners.delete(fn)
    }
  }

  onNoteOff(fn: (midi: number) => void): () => void {
    this.offListeners.add(fn)
    return () => {
      this.offListeners.delete(fn)
    }
  }

  onStatus(fn: (s: InputStatus) => void): () => void {
    this.statusListeners.add(fn)
    return () => {
      this.statusListeners.delete(fn)
    }
  }

  private patch(p: Partial<InputStatus>) {
    this.status = { ...this.status, ...p }
    for (const fn of this.statusListeners) fn(this.status)
  }

  /** Called by every source. `sound` is false when the piano itself made the sound. */
  press(midi: number, velocity = 0.8, sound = true) {
    if (this.held.has(midi)) return
    this.held.add(midi)
    if (sound) synth.noteOn(midi, velocity)
    for (const fn of this.onListeners) fn(midi, velocity)
  }

  release(midi: number, sound = true) {
    if (!this.held.delete(midi)) return
    if (sound) synth.noteOff(midi)
    for (const fn of this.offListeners) fn(midi)
  }

  async useScreen() {
    await this.stopMic()
    this.patch({ source: 'screen', chosen: true, error: null })
  }

  async useMidi(): Promise<void> {
    if (!this.status.midiSupported) {
      this.patch({
        error: 'This browser has no Web MIDI. Safari on iPhone and iPad never does — use the microphone there, or Chrome on a laptop.',
      })
      return
    }
    await this.stopMic()
    try {
      this.midiAccess = await navigator.requestMIDIAccess()
      this.bindMidi()
      this.midiAccess.onstatechange = () => this.bindMidi()
      this.patch({ source: 'midi', chosen: true, error: null })
    } catch {
      this.patch({ error: 'Could not reach MIDI. Check the cable, then reload and allow MIDI access.' })
    }
  }

  private bindMidi() {
    if (!this.midiAccess) return
    const names: string[] = []
    this.midiAccess.inputs.forEach((port) => {
      names.push(port.name ?? 'Unnamed device')
      port.onmidimessage = (e: MIDIMessageEvent) => this.handleMidi(e)
    })
    this.patch({ midiDevices: names })
  }

  private handleMidi(e: MIDIMessageEvent) {
    const data = e.data
    if (!data || data.length < 3) return
    const [statusByte, note, velocity] = data
    const command = statusByte & 0xf0
    // A digital piano makes its own sound, but a silent controller does not,
    // so the app always sounds the note too. Mute the app if it doubles up.
    if (command === 0x90 && velocity > 0) this.press(note, velocity / 127)
    else if (command === 0x80 || (command === 0x90 && velocity === 0)) this.release(note)
  }

  async useMic(): Promise<void> {
    try {
      const ctx = await synth.resume()
      this.detector.onNoteOn = (e) => this.press(e.midi, 0.8, false)
      this.detector.onNoteOff = (midi) => this.release(midi, false)
      this.detector.onPitch = (e) =>
        this.patch({ cents: e?.cents ?? null, heardMidi: e?.midi ?? null })
      await this.detector.start(ctx)
      this.patch({ source: 'mic', micActive: true, chosen: true, error: null })
    } catch {
      this.patch({
        error: 'The microphone was blocked. Allow mic access in the address bar, and note that phones need the page served over https.',
      })
    }
  }

  private async stopMic() {
    if (this.detector.running) this.detector.stop()
    this.patch({ micActive: false, cents: null, heardMidi: null })
  }
}

export const input = new InputManager()

export function useInputStatus(): InputStatus {
  const [s, setS] = useState(input.status)
  useEffect(() => input.onStatus(setS), [])
  return s
}

/** Re-renders when the set of held notes changes. */
export function useHeldNotes(): Set<number> {
  const [held, setHeld] = useState<Set<number>>(new Set())
  useEffect(() => {
    const update = () => setHeld(new Set(input.held))
    const a = input.onNoteOn(update)
    const b = input.onNoteOff(update)
    return () => {
      a()
      b()
    }
  }, [])
  return held
}

/** QWERTY fallback so the app is usable on a laptop with nothing plugged in. */
const KEY_MAP: Record<string, number> = {
  a: 60, w: 61, s: 62, e: 63, d: 64, f: 65, t: 66, g: 67,
  y: 68, h: 69, u: 70, j: 71, k: 72, o: 73, l: 74, p: 75, ';': 76,
}

export function useComputerKeyboard(enabled: boolean, octaveShift = 0) {
  useEffect(() => {
    if (!enabled) return
    const down = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return
      const midi = KEY_MAP[e.key.toLowerCase()]
      if (midi === undefined) return
      e.preventDefault()
      input.press(midi + octaveShift * 12)
    }
    const up = (e: KeyboardEvent) => {
      const midi = KEY_MAP[e.key.toLowerCase()]
      if (midi === undefined) return
      input.release(midi + octaveShift * 12)
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [enabled, octaveShift])
}
