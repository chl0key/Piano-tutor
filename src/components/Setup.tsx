import { useState } from 'react'
import { input, useInputStatus } from '../input/input'
import { synth } from '../audio/synth'
import { noteName } from '../music/theory'

/**
 * Choosing how the app hears her. The microphone is the default suggestion
 * because it is the only option that works on a phone with an unplugged piano.
 */
export function Setup() {
  const s = useInputStatus()
  // Open on first run: the right answer depends on the room, not on a default.
  const [open, setOpen] = useState(!s.chosen)

  const choose = async (which: 'screen' | 'midi' | 'mic') => {
    await synth.resume()
    if (which === 'screen') await input.useScreen()
    if (which === 'midi') await input.useMidi()
    if (which === 'mic') await input.useMic()
  }

  const label = !s.chosen
    ? 'not set up yet'
    : s.source === 'midi' ? 'MIDI keyboard' : s.source === 'mic' ? 'Microphone' : 'On screen'

  return (
    <section className={`setup ${open ? 'open' : ''}`}>
      <button className="setup-toggle" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className={`dot ${s.chosen ? s.source : ''}`} /> Listening: <strong>{label}</strong>
        <span className="chev">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="setup-body">
          <div className="options">
            <button className={s.source === 'mic' && s.chosen ? 'on' : ''} onClick={() => choose('mic')}>
              <strong>Microphone {!s.chosen && <em className="rec">start here</em>}</strong>
              <span>Play your keyboard out loud and let the phone or laptop listen. Nothing to plug in.</span>
            </button>
            <button className={s.source === 'midi' && s.chosen ? 'on' : ''} onClick={() => choose('midi')}
              disabled={!s.midiSupported}>
              <strong>MIDI cable</strong>
              <span>
                {s.midiSupported
                  ? 'Most exact. Connect the keyboard by USB, then pick this.'
                  : 'Not available in this browser — Safari on iPhone and iPad has no MIDI.'}
              </span>
            </button>
            <button className={s.source === 'screen' && s.chosen ? 'on' : ''} onClick={() => choose('screen')}>
              <strong>On screen</strong>
              <span>Tap the keys, or use the computer keyboard: A–L is C to D, with the black keys above.</span>
            </button>
          </div>

          {s.source === 'midi' && s.midiDevices.length > 0 && (
            <p className="hint">Connected: {s.midiDevices.join(', ')}</p>
          )}
          {s.source === 'midi' && s.midiDevices.length === 0 && (
            <p className="hint">No MIDI device is being seen yet. Plug the keyboard in and switch it on, then pick MIDI again.</p>
          )}
          {s.source === 'mic' && (
            <p className="hint">
              Play a note to check the tuner:{' '}
              {s.heardMidi !== null ? (
                <strong>{noteName(s.heardMidi)} {s.cents !== null && `${s.cents > 0 ? '+' : ''}${s.cents}¢`}</strong>
              ) : (
                <em>listening…</em>
              )}
              {' '}One note at a time — the microphone cannot separate a chord.
            </p>
          )}
          {s.error && <p className="error">{s.error}</p>}
        </div>
      )}
    </section>
  )
}
