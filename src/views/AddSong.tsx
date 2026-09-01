import { useCallback, useMemo, useRef, useState } from 'react'
import {
  buildFromMidi, parseMidiFile, suggestTracks,
  type MidiFileData,
} from '../music/midiFile'
import { chartEnd, parseChart } from '../music/chart'
import { keyFor, type KeySignature } from '../music/theory'
import { buildVariants, keyOfNotes, library, MAX_NOTES, type UserSong } from '../state/library'
import { SpotifyPicker } from '../components/SpotifyPicker'
import type { SongNote } from '../music/song'

type Origin = 'chords' | 'midi'

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

  const [origin, setOrigin] = useState<Origin>('chords')
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
  const fileRef = useRef<HTMLInputElement>(null)

  const beatsPerBar = timeSig[0] * (4 / timeSig[1])

  const chart = useMemo(
    () => (origin === 'chords' ? parseChart(chartText, { timeSig, bpm }) : null),
    [origin, chartText, timeSig, bpm],
  )

  const midiNotes: SongNote[] = useMemo(() => {
    if (origin !== 'midi' || !midi || tracks.length === 0) return []
    return buildFromMidi(midi, { tracks, leftHand: leftTracks }).slice(0, MAX_NOTES)
  }, [origin, midi, tracks, leftTracks])

  // The detected key is a suggestion until she overrides it, then hers wins.
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
      const picked = suggestTracks(data.tracks)
      setTracks(picked.tracks)
      setLeftTracks(picked.leftHand)
      setBpm(data.bpm)
      setTimeSig(data.timeSig)
      if (!title) setTitle(file.name.replace(/\.midi?$/i, '').replace(/[_-]+/g, ' '))
    } catch (e) {
      setMidi(null)
      setMidiError(e instanceof Error ? e.message : 'That file could not be read as MIDI.')
    }
  }, [title])

  const ready =
    title.trim().length > 0 &&
    (origin === 'chords' ? (chart?.events.length ?? 0) > 0 : midiNotes.length > 0)

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

  const preview = useMemo(() => (draft ? buildVariants(draft) : []), [draft])

  const save = () => {
    if (!draft) return
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
          <p>Pick it, give it chords or a MIDI file, and it becomes three levels of sheet music.</p>
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
      </section>

      <section className="step">
        <h2><span className="step-num">2</span> Where do the notes come from?</h2>
        <div className="seg wide">
          <button className={origin === 'chords' ? 'on' : ''} onClick={() => setOrigin('chords')}>
            Paste chords
          </button>
          <button className={origin === 'midi' ? 'on' : ''} onClick={() => setOrigin('midi')}>
            Import a MIDI file
          </button>
        </div>

        {origin === 'chords' ? (
          <>
            <p className="sub">
              Paste a chord sheet from anywhere. Section names in brackets become loop points, bars
              can be split with <code>|</code>, and any line that is not chords — lyrics, tab, capo
              notes — is ignored rather than rejected.
            </p>
            <textarea
              className="chart-input"
              value={chartText}
              onChange={(e) => setChartText(e.target.value)}
              placeholder={EXAMPLE}
              spellCheck={false}
              rows={10}
            />
            <div className="row-actions">
              <button className="small" onClick={() => setChartText(EXAMPLE)}>Use the example</button>
              {chartText && <button className="small" onClick={() => setChartText('')}>Clear</button>}
            </div>
            {chart && chartText.trim() && (
              <div className={`readout ${chart.events.length ? 'ok' : 'bad'}`}>
                {chart.events.length === 0 ? (
                  <p>No chords were recognised. Chords look like <code>C</code>, <code>Am</code>, <code>F♯m7</code>, <code>G/B</code>.</p>
                ) : (
                  <>
                    <p>
                      <strong>{chart.events.length} chords</strong> over{' '}
                      {Math.ceil(chartEnd(chart) / beatsPerBar)} bars ·{' '}
                      {chart.sections.map((s) => s.name).join(', ')}
                    </p>
                    <p className="chord-preview">
                      {chart.events.slice(0, 24).map((e, i) => (
                        <span key={i}>{e.chord.text}</span>
                      ))}
                      {chart.events.length > 24 && <span className="more">…</span>}
                    </p>
                    {chart.ignored.length > 0 && (
                      <p className="muted">{chart.ignored.length} line(s) ignored as lyrics or notes.</p>
                    )}
                  </>
                )}
              </div>
            )}
          </>
        ) : (
          <>
            <p className="sub">
              A MIDI of the song carries the real notes and the real timing, so the Advanced level
              becomes the actual arrangement rather than a guess at it. Free MIDIs exist for most
              popular songs.
            </p>
            <input
              ref={fileRef}
              type="file"
              accept=".mid,.midi,audio/midi"
              className="file-input"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void onFile(f)
              }}
            />
            {midiError && <p className="error">{midiError}</p>}
            {midi && (
              <div className="tracks">
                <p className="sub">
                  Pick the parts to learn. A band MIDI has a track for every instrument; for piano
                  you usually want one or two.
                </p>
                {midi.tracks.map((t) => {
                  const on = tracks.includes(t.index)
                  return (
                    <div key={t.index} className={`track ${on ? 'on' : ''}`}>
                      <label className="track-main">
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() =>
                            setTracks((prev) =>
                              prev.includes(t.index)
                                ? prev.filter((i) => i !== t.index)
                                : [...prev, t.index],
                            )
                          }
                        />
                        <span className="track-name">{t.name}{t.drums && ' (drums)'}</span>
                        <span className="track-meta">
                          {t.noteCount} notes · {noteRange(t.low, t.high)}
                        </span>
                      </label>
                      {on && (
                        <button
                          className={`hand-toggle ${leftTracks.includes(t.index) ? 'left' : ''}`}
                          onClick={() =>
                            setLeftTracks((prev) =>
                              prev.includes(t.index)
                                ? prev.filter((i) => i !== t.index)
                                : [...prev, t.index],
                            )
                          }
                        >
                          {leftTracks.includes(t.index) ? 'Left hand' : 'Right hand'}
                        </button>
                      )}
                    </div>
                  )
                })}
                <p className="muted">
                  {leftTracks.length === 0
                    ? 'No track is marked for the left hand, so the hands are split by pitch.'
                    : 'Marked tracks go to the left hand; the rest go to the right.'}
                  {midiNotes.length >= MAX_NOTES && ` Trimmed to the first ${MAX_NOTES} notes.`}
                </p>
              </div>
            )}
          </>
        )}
      </section>

      <section className="step">
        <h2><span className="step-num">3</span> Key and tempo</h2>
        <p className="sub">
          Both are guessed from the music. Spotify no longer tells anyone a song's key or tempo, so
          correct them here if they sound wrong.
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
              {ALL_KEYS.map((k) => (
                <option key={k.name} value={k.name}>{k.name}</option>
              ))}
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
              {TIME_SIGS.map((t) => (
                <option key={t.join('/')} value={t.join('/')}>{t[0]}/{t[1]}</option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {preview.length > 0 && (
        <section className="step">
          <h2><span className="step-num">4</span> Three levels, ready</h2>
          <ul className="variant-list">
            {preview.map((v) => (
              <li key={v.id}>
                <strong>{v.name}</strong>
                <span>{v.blurb}</span>
                <em>{v.song.notes.length} notes · {v.song.sections.length} sections</em>
              </li>
            ))}
          </ul>
        </section>
      )}

      {saveError && <p className="error">{saveError}</p>}

      <div className="add-actions">
        <button className="primary" disabled={!ready} onClick={save}>
          {ready ? 'Save to my songs' : 'Add a title and some music first'}
        </button>
        <button onClick={onCancel}>Cancel</button>
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
