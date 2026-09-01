import { useMemo } from 'react'
import { pitchClassName, tonicOf, type KeySignature } from '../music/theory'

interface Props {
  keySig: KeySignature
  value: string
  onChange: (next: string) => void
}

/** Scale degrees and the chord quality built on each, for a major and a minor key. */
const MAJOR_DEGREES: { steps: number; suffix: string; roman: string }[] = [
  { steps: 0, suffix: '', roman: 'I' },
  { steps: 2, suffix: 'm', roman: 'ii' },
  { steps: 4, suffix: 'm', roman: 'iii' },
  { steps: 5, suffix: '', roman: 'IV' },
  { steps: 7, suffix: '', roman: 'V' },
  { steps: 9, suffix: 'm', roman: 'vi' },
  { steps: 11, suffix: 'dim', roman: 'vii°' },
]
const MINOR_DEGREES: { steps: number; suffix: string; roman: string }[] = [
  { steps: 0, suffix: 'm', roman: 'i' },
  { steps: 2, suffix: 'dim', roman: 'ii°' },
  { steps: 3, suffix: '', roman: 'III' },
  { steps: 5, suffix: 'm', roman: 'iv' },
  // Songs in a minor key almost always raise the fifth chord to major.
  { steps: 7, suffix: '', roman: 'V' },
  { steps: 8, suffix: '', roman: 'VI' },
  { steps: 10, suffix: '', roman: 'VII' },
]

/** Progressions that a very large share of popular songs are actually built on. */
const PRESETS: { name: string; note: string; degrees: number[] }[] = [
  { name: 'Four chords', note: 'I–V–vi–IV. Hundreds of pop songs are this.', degrees: [0, 4, 5, 3] },
  { name: 'Doo-wop', note: 'I–vi–IV–V. Fifties ballads and half of Motown.', degrees: [0, 5, 3, 4] },
  { name: 'Sad four', note: 'vi–IV–I–V. The same loop starting on the minor.', degrees: [5, 3, 0, 4] },
  { name: 'Canon', note: 'I–V–vi–iii–IV–I–IV–V. Pachelbel, and everything since.', degrees: [0, 4, 5, 2, 3, 0, 3, 4] },
  { name: '12-bar blues', note: 'I I I I IV IV I I V IV I V.', degrees: [0, 0, 0, 0, 3, 3, 0, 0, 4, 3, 0, 4] },
]

/**
 * Building a progression by tapping, rather than typing a chord sheet. On a
 * phone this is the difference between adding a song and giving up on it — and
 * naming the chords by degree as well as by letter means the shape of the
 * progression is visible, not just its spelling in one key.
 */
export function ChordBuilder({ keySig, value, onChange }: Props) {
  const { pc, minor } = useMemo(() => tonicOf(keySig), [keySig])
  const preferFlats = keySig.fifths < 0

  const chords = useMemo(() => {
    const degrees = minor ? MINOR_DEGREES : MAJOR_DEGREES
    return degrees.map((d) => ({
      roman: d.roman,
      name: pitchClassName((pc + d.steps) % 12, preferFlats) + d.suffix,
    }))
  }, [pc, minor, preferFlats])

  const append = (text: string) => {
    const trimmed = value.replace(/\s+$/, '')
    onChange(trimmed ? `${trimmed} ${text}` : text)
  }

  const undo = () => {
    const parts = value.trim().split(/\s+/)
    parts.pop()
    onChange(parts.join(' '))
  }

  const addPreset = (degrees: number[]) => {
    const base = minor ? MINOR_DEGREES : MAJOR_DEGREES
    const bars = degrees.map((d) => pitchClassName((pc + base[d].steps) % 12, preferFlats) + base[d].suffix)
    append(bars.join(' '))
  }

  return (
    <div className="chord-builder">
      <p className="sub">
        Tap chords to build the song, one bar at a time. Every chord here belongs to{' '}
        <strong>{keySig.name}</strong>, so anything you tap will sound right together.
      </p>

      <div className="chord-palette">
        {chords.map((c) => (
          <button key={c.roman} onClick={() => append(c.name)}>
            <strong>{c.name}</strong>
            <em>{c.roman}</em>
          </button>
        ))}
      </div>

      <div className="builder-actions">
        <button className="small" onClick={() => append('\n[Chorus]')}>+ Section</button>
        <button className="small" onClick={undo} disabled={!value.trim()}>Undo</button>
        <button className="small" onClick={() => onChange('')} disabled={!value.trim()}>Clear</button>
      </div>

      <details className="presets">
        <summary>Start from a common progression</summary>
        <div className="preset-list">
          {PRESETS.map((p) => (
            <button key={p.name} onClick={() => addPreset(p.degrees)}>
              <strong>{p.name}</strong>
              <span>{p.note}</span>
            </button>
          ))}
        </div>
      </details>
    </div>
  )
}
