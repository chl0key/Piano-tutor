import { useCallback, useMemo, useRef, useState } from 'react'
import { buildFromMidi, parseMidiFile, suggestTracks, type MidiFileData } from '../music/midiFile'
import { chartEnd, parseChart } from '../music/chart'
import { ARRANGEMENTS, type ArrangementLevel } from '../music/arrange'
import { keyFor, type KeySignature } from '../music/theory'
import { buildVariants, keyOfNotes, library, MAX_NOTES, type UserSong } from '../state/library'
import { SpotifyPicker } from '../components/SpotifyPicker'
import { ChordBuilder } from '../components/ChordBuilder'
import { Staff } from '../components/Staff'
import { usePreview } from '../audio/preview'
import type { SongNote } from '../music/song'

/** How the notes are being supplied. Tapping and pasting both make a chord chart. */
type Mode = 'build' | 'paste' | 'midi'

const EXAMPLE = `[Verse]
| C | G | Am | F |
| C | G | F  | F |

[Chorus]
Am F C G
Am F C G`

const TIME_SIGS: [number, number][] = [[4, 4], [3, 4], [6, 8], [2, 4]]

export function AddSong({ onDone, onCancel }: { onDone: (id: string) => void; onCancel: () => void }) {
  const [title, setTitle] = useState('')
  const [artist, setArtist] = useState('')
  const [spotifyId, setSpotifyId] = useState<string>()
  const [art, setArt] = useState<string>()
  const [picked, setPicked] = useState(false)

  const [mode, setMode] = useState<Mode>('build')
  const [chartText, setChartText] = useState('')
  const [midi, setMidi] = useState<MidiFileData | null>(null)
  const [tracks, setTracks] = useState<number[]>([])
  const [leftTracks, setLeftTracks] = useState<number[]>([])
  const [midiError, setMidiError] = useState<string | null>(null)

  const [timeSig, setTimeSig] = useState<[number, number]>([4, 4])
  const [bpm, setBpm] = useState(84)
  const [key, setKey] = useState<KeySignature>(keyFor(0))
  const [keyTouched, setKeyTouched] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [previewLevel, setPreviewLevel] = useState<ArrangementLevel>('basic')
  const fileRef = useRef<HTMLInputElement>(null)
  const preview = usePreview()

  const beatsPerBar = timeSig[0] * (4 / timeSig[1])
  const origin: 'chords' | 'midi' = mode === 'midi' ? 'midi' : 'chords'

  const chart = useMemo(
    () => (origin === 'chords' ? parseChart(chartText, { timeSig, bpm }) : null),
    [origin, chartText, timeSig, bpm],
  )

  const midiNotes: SongNote[] = useMemo(() => {
    if (origin !== 'midi' || !midi || tracks.length === 0) return []
    return buildFromMidi(midi, { tracks, leftHand: leftTracks }).slice(0, MAX_NOTES)
  }, [origin, midi, tracks, leftTracks])

  const suggestedKey = useMemo(() => {
    if (origin === 'chords') return chart?.key ?? keyFor(0)
    return midiNotes.length ? keyOfNotes(midiNotes, beatsPerBar) : keyFor(0)
  }, [origin, chart, midiNotes, beatsPerBar])
  const activeKey = keyTouched ? key : suggestedKey

  const onFile = useCallback(async (file: File) => {
    setMidiError(null)
    try {
      const data = parseMidiFile(await file.arrayBuffer())
      if (data.tracks.length === 0) throw new Error('That MIDI file has no notes in it.')
      setMidi(data)
      const suggestion = suggestTracks(data.tracks)
      setTracks(suggestion.tracks)
      setLeftTracks(suggestion.leftHand)
      setBpm(data.bpm)
      setTimeSig(data.timeSig)
      if (!title) setTitle(file.name.replace(/\.midi?$/i, '').replace(/[_-]+/g, ' '))
    } catch (e) {
      setMidi(null)
      setMidiError(e instanceof Error ? e.message : 'That file could not be read as MIDI.')
    }
  }, [title])

  const hasMusic = origin === 'chords' ? (chart?.events.length ?? 0) > 0 : midiNotes.length > 0
  const ready = title.trim().length > 0 && hasMusic

  const draft: UserSong | null = ready
    ? {
        id: `user-${Date.now().toString(36)}`,
        title: title.trim(),
        artist: artist.trim(),
        addedAt: new Date().toISOString(),
        timeSig,
        bpm,
        key: activeKey,
        origin,
        chartText: origin === 'chords' ? chartText : undefined,
        midiNotes: origin === 'midi' ? midiNotes : undefined,
        spotifyId,
        art,
      }
    : null

  const variants = useMemo(() => (draft ? buildVariants(draft) : []), [draft])
  const previewSong = variants.find((v) => v.id === previewLevel)?.song
  const previewPxPerBeat = useMemo(() => {
    if (!previewSong) return 46
    const shortest = previewSong.notes.reduce((m, n) => Math.min(m, n.dur), 4)
    return Math.round(Math.min(140, Math.max(46, 28 / shortest)))
  }, [previewSong])

  const save = () => {
    if (!draft) return
    preview.stop()
    try {
      library.add(draft)
      onDone(draft.id)
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'That song could not be saved.')
    }
  }

  return (
    <div className="add-song">
      <header className="player-head">
        <button className="ghost" onClick={onCancel} aria-label="Back">←</button>
        <div className="titles">
          <h1>Add a song</h1>
          <p>Name it, give it chords, hear it, keep it.</p>
        </div>
      </header>

      <section className="step">
        <h2><span className="step-num">1</span> Which song?</h2>
        <SpotifyPicker
          onPick={(t) => {
            setTitle(t.title)
            setArtist(t.artist)
            setSpotifyId(t.id)
            setArt(t.art)
            setPicked(true)
          }}
        />
        <div className="field-row">
          <label className="field">
            <span>Title</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Song title" />
          </label>
          <label className="field">
            <span>Artist</span>
            <input value={artist} onChange={(e) => setArtist(e.target.value)} placeholder="Artist" />
          </label>
        </div>
        {picked && (
          <p className="readout ok picked-note">
            Got the song. Spotify cannot hand over the notes — no app can, the audio is encrypted —
            so the chords come from you below. Tapping four of them is usually enough to play it.
          </p>
        )}
      </section>

      <section className="step">
        <h2><span className="step-num">2</span> Key and tempo</h2>
        <p className="sub">
          Set the key first and every chord offered will belong to it. Paste or import instead, and
          both of these are worked out from the music.
        </p>
        <div className="field-row">
          <label className="field">
            <span>Key</span>
            <select
              value={activeKey.name}
              onChange={(e) => {
                setKeyTouched(true)
                const found = ALL_KEYS.find((k) => k.name === e.target.value)
                if (found) setKey(found)
              }}
            >
              {ALL_KEYS.map((k) => <option key={k.name} value={k.name}>{k.name}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Tempo — {bpm} bpm</span>
            <input type="range" min={40} max={180} value={bpm}
              onChange={(e) => setBpm(Number(e.target.value))} />
          </label>
          <label className="field">
            <span>Time signature</span>
            <select value={timeSig.join('/')}
              onChange={(e) => setTimeSig(e.target.value.split('/').map(Number) as [number, number])}>
              {TIME_SIGS.map((t) => <option key={t.join('/')} value={t.join('/')}>{t[0]}/{t[1]}</option>)}
            </select>
          </label>
        </div>
      </section>

      <section className="step">
        <h2><span className="step-num">3</span> The chords</h2>
        <div className="seg wide">
          <button className={mode === 'build' ? 'on' : ''} onClick={() => setMode('build')}>Tap them in</button>
          <button className={mode === 'paste' ? 'on' : ''} onClick={() => setMode('paste')}>Paste a chart</button>
          <button className={mode === 'midi' ? 'on' : ''} onClick={() => setMode('midi')}>MIDI file</button>
        </div>

        {mode === 'build' && (
          <ChordBuilder keySig={activeKey} value={chartText} onChange={setChartText} />
        )}

        {mode === 'paste' && (
          <>
            <p className="sub">
              Paste a chord sheet from anywhere. Section names in brackets become loop points, bars
              can be split with <code>|</code>, and any line that is not chords — lyrics, tab, capo
              notes — is ignored rather than rejected.
            </p>
            <textarea className="chart-input" value={chartText} rows={9} spellCheck={false}
              placeholder={EXAMPLE} onChange={(e) => setChartText(e.target.value)} />
            <div className="row-actions">
              <button className="small" onClick={() => setChartText(EXAMPLE)}>Use the example</button>
              {chartText && <button className="small" onClick={() => setChartText('')}>Clear</button>}
            </div>
          </>
        )}

        {mode === 'midi' && (
          <>
            <p className="sub">
              A MIDI of the song carries the real notes and the real timing, so the Advanced level
              becomes the actual arrangement rather than a guess at it.
            </p>
            <input ref={fileRef} type="file" accept=".mid,.midi,audio/midi" className="file-input"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void onFile(f)
              }} />
            {midiError && <p className="error">{midiError}</p>}
            {midi && (
              <div className="tracks">
                <p className="sub">Pick the parts to learn — for piano, usually one or two.</p>
                {midi.tracks.map((t) => {
                  const on = tracks.includes(t.index)
                  return (
                    <div key={t.index} className={`track ${on ? 'on' : ''}`}>
                      <label className="track-main">
                        <input type="checkbox" checked={on} onChange={() =>
                          setTracks((prev) => prev.includes(t.index)
                            ? prev.filter((i) => i !== t.index) : [...prev, t.index])} />
                        <span className="track-name">{t.name}{t.drums && ' (drums)'}</span>
                        <span className="track-meta">{t.noteCount} notes · {noteRange(t.low, t.high)}</span>
                      </label>
                      {on && (
                        <button className={`hand-toggle ${leftTracks.includes(t.index) ? 'left' : ''}`}
                          onClick={() => setLeftTracks((prev) => prev.includes(t.index)
                            ? prev.filter((i) => i !== t.index) : [...prev, t.index])}>
                          {leftTracks.includes(t.index) ? 'Left hand' : 'Right hand'}
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}

        {chart && chartText.trim() && mode !== 'midi' && (
          <div className={`readout ${chart.events.length ? 'ok' : 'bad'}`}>
            {chart.events.length === 0 ? (
              <p>No chords recognised yet. They look like <code>C</code>, <code>Am</code>, <code>F♯m7</code>.</p>
            ) : (
              <>
                <p>
                  <strong>{chart.events.length} chords</strong> over{' '}
                  {Math.ceil(chartEnd(chart) / beatsPerBar)} bars
                </p>
                <p className="chord-preview">
                  {chart.events.slice(0, 32).map((e, i) => <span key={i}>{e.chord.text}</span>)}
                  {chart.events.length > 32 && <span className="more">…</span>}
                </p>
              </>
            )}
          </div>
        )}
      </section>

      {previewSong && (
        <section className="step preview-step">
          <h2><span className="step-num">4</span> Hear it</h2>
          <div className="seg wide">
            {ARRANGEMENTS.map((a) => (
              <button key={a.id} className={previewLevel === a.id ? 'on' : ''}
                onClick={() => { preview.stop(); setPreviewLevel(a.id) }}>{a.name}</button>
            ))}
          </div>
          <p className="sub">{variants.find((v) => v.id === previewLevel)?.blurb}</p>

          <Staff
            notes={previewSong.notes}
            keySig={previewSong.key}
            timeSig={previewSong.timeSig}
            beatRef={preview.beatRef}
            dueBeat={null}
            pxPerBeat={previewPxPerBeat}
            sp={11}
            showLetters={false}
            chords={previewSong.chords}
          />

          <div className="row-actions">
            <button className="primary" onClick={() =>
              preview.playing ? preview.stop() : void preview.play(previewSong)}>
              {preview.playing ? 'Stop' : 'Play it'}
            </button>
            <span className="muted">
              {previewSong.notes.length} notes · {previewSong.sections.length} section(s)
            </span>
          </div>
        </section>
      )}

      {saveError && <p className="error">{saveError}</p>}

      <div className="add-actions">
        <button className="primary" disabled={!ready} onClick={save}>
          {ready ? 'Save and start learning' : !title.trim() ? 'Give it a title first' : 'Add some chords first'}
        </button>
        <button onClick={() => { preview.stop(); onCancel() }}>Cancel</button>
      </div>
    </div>
  )
}

const NOTE_LETTERS = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B']
function noteRange(low: number, high: number): string {
  const name = (m: number) => `${NOTE_LETTERS[m % 12]}${Math.floor(m / 12) - 1}`
  return `${name(low)}–${name(high)}`
}

const ALL_KEYS: KeySignature[] = [
  ...Array.from({ length: 12 }, (_, pc) => keyFor(pc, false)),
  ...Array.from({ length: 12 }, (_, pc) => keyFor(pc, true)),
]
