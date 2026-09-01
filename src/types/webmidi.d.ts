// Minimal Web MIDI surface. TypeScript's DOM library does not ship these, and
// pulling in @types/webmidi for four shapes is not worth the dependency.
interface MIDIMessageEvent extends Event {
  readonly data: Uint8Array | null
}

interface MIDIPort {
  readonly id: string
  readonly name: string | null
  readonly state: 'connected' | 'disconnected'
}

interface MIDIInput extends MIDIPort {
  onmidimessage: ((e: MIDIMessageEvent) => void) | null
}

interface MIDIAccess {
  readonly inputs: ReadonlyMap<string, MIDIInput>
  onstatechange: ((e: Event) => void) | null
}

interface Navigator {
  requestMIDIAccess(options?: { sysex?: boolean }): Promise<MIDIAccess>
}


/** Chromium's install prompt. Not in the DOM library, and iOS never fires it. */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

interface WindowEventMap {
  beforeinstallprompt: BeforeInstallPromptEvent
}
