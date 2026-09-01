import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { spell, keyLabel, noteName, KEYS, isBlackKey } from '../music/theory'
import {
  BASS_CLEF_DOTS, BASS_CLEF_PATH, GRAND_HEIGHT, TREBLE_CLEF_PATH,
  glyphFor, ledgerLines, staffLines, staffY, type Clef,
} from '../music/notation'
import { Keyboard } from '../components/Keyboard'
import { rangeFor, whiteCount } from '../components/keyboardLayout'
import { input, useHeldNotes, useComputerKeyboard, useInputStatus } from '../input/input'
import { synth } from '../audio/synth'
import { progressStore, useProgress, weakNotes, useLogPracticeTime } from '../state/progress'

interface Preset {
  id: string
  name: string
  blurb: string
  clef: Clef | 'grand'
  notes: number[]
}

const range = (lo: number, hi: number, naturalsOnly = true) => {
  const out: number[] = []
  for (let m = lo; m <= hi; m++) if (!naturalsOnly || !isBlackKey(m)) out.push(m)
  return out
}

const PRESETS: Preset[] = [
  {
    id: 'landmarks',
    name: 'The five landmarks',
    blurb: 'Middle C, treble G, bass F, and the two outer Cs. Every other note is found from these.',
    clef: 'grand',
    notes: [48, 53, 60, 67, 72],
  },
  {
    id: 'treble-basic',
    name: 'Treble, C to G',
    blurb: 'The five notes under your right hand in home position.',
    clef: 'treble',
    notes: range(60, 67),
  },
  {
    id: 'treble',
    name: 'Treble staff',
    blurb: 'Everything on the top staff, lines and spaces.',
    clef: 'treble',
    notes: range(59, 77),
  },
  {
    id: 'bass',
    name: 'Bass staff',
    blurb: 'The left hand staff — the one most self-taught players never learn.',
    clef: 'bass',
    notes: range(40, 60),
  },
  {
    id: 'ledger',
    name: 'Around middle C',
    blurb: 'The ledger-line notes in the gap between the staves, where reading usually breaks down.',
    clef: 'grand',
    notes: range(55, 65),
  },
  {
    id: 'grand',
    name: 'Both staves',
    blurb: 'Full range, both hands. The real thing.',
    clef: 'grand',
    notes: range(45, 76),
  },
]

const ROUND_LENGTH = 20

interface Attempt { midi: number; ms: number; correct: boolean }

export function SightReading({ onExit }: { onExit: () => void }) {
  const [preset, setPreset] = useState<Preset>(PRESETS[0])
  const [current, setCurrent] = useState<number | null>(null)
  const [attempts, setAttempts] = useState<Attempt[]>([])
  const [revealed, setRevealed] = useState(false)
  const [missedThisNote, setMissedThisNote] = useState(false)
  const shownAt = useRef(performance.now())
  const progress = useProgress()
  const held = useHeldNotes()
  const status = useInputStatus()
  const bankTime = useLogPracticeTime()
  useComputerKeyboard(status.source === 'screen')
  useEffect(() => bankTime, [bankTime])

  const [low, high] = useMemo(() => rangeFor(preset.notes, 1), [preset])
  const whites = useMemo(() => whiteCount(low, high), [low, high])

  const pick = useCallback(
    (avoid: number | null) => {
      // Bias hard toward the notes she is slowest on: drilling what already
      // works is the most common way practice time gets wasted.
      const weak = weakNotes(progress, preset.notes, Math.max(3, Math.ceil(preset.notes.length / 3)))
      const pool = Math.random() < 0.6 ? weak : preset.notes
      const options = pool.filter((m) => m !== avoid)
      const from = options.length > 0 ? options : preset.notes
      return from[Math.floor(Math.random() * from.length)]
    },
    [preset, progress],
  )

  const next = useCallback(() => {
    setCurrent((c) => pick(c))
    setRevealed(false)
    setMissedThisNote(false)
    shownAt.current = performance.now()
  }, [pick])

  const startRound = useCallback(async () => {
    await synth.resume()
    setAttempts([])
    next()
  }, [next])

  useEffect(() => {
    setCurrent(null)
    setAttempts([])
  }, [preset])

  useEffect(() => {
    if (current === null) return
    return input.onNoteOn((midi) => {
      const ms = performance.now() - shownAt.current
      if (midi === current) {
        progressStore.recordNote(midi, !missedThisNote, ms)
        setAttempts((a) => [...a, { midi, ms, correct: !missedThisNote }])
        synth.blip(880, 0.05, 0.08)
        window.setTimeout(next, 180)
      } else {
        if (!missedThisNote) progressStore.recordNote(current, false, ms)
        setMissedThisNote(true)
        setRevealed(true)
        synth.blip(180, 0.06, 0.06)
      }
    })
  }, [current, missedThisNote, next])

  const done = attempts.length >= ROUND_LENGTH
  useEffect(() => {
    if (done) setCurrent(null)
  }, [done])

  const correct = attempts.filter((a) => a.correct).length
  const median = attempts.length
    ? [...attempts].map((a) => a.ms).sort((x, y) => x - y)[Math.floor(attempts.length / 2)]
    : 0

  return (
    <div className="drill">
      <header className="player-head">
        <button className="ghost" onClick={onExit} aria-label="Back">←</button>
        <div className="titles">
          <h1>Sight-reading</h1>
          <p>{preset.blurb}</p>
        </div>
        <div className="level-chip">
          <span className="level-num">{attempts.length}</span>
          <span className="level-name">of {ROUND_LENGTH}</span>
        </div>
      </header>

      <div className="preset-row">
        {PRESETS.map((p) => (
          <button key={p.id} className={p.id === preset.id ? 'on' : ''} onClick={() => setPreset(p)}>
            {p.name}
          </button>
        ))}
      </div>

      {current !== null ? (
        <DrillStaff midi={current} clef={preset.clef} revealed={revealed} />
      ) : (
        <div className="drill-idle">
          {done ? (
            <RoundResult correct={correct} total={attempts.length} median={median} onAgain={startRound} />
          ) : (
            <>
              <h2>{preset.name}</h2>
              <p>{preset.blurb}</p>
              <button className="primary" onClick={startRound}>Start {ROUND_LENGTH} notes</button>
            </>
          )}
        </div>
      )}

      <div className="board">
        <div className="board-inner" style={{ width: `max(100%, ${whites * 34}px)` }}>
          <Keyboard
            low={low}
            high={high}
            keySig={KEYS.C}
            held={held}
            targets={revealed && current !== null ? new Set([current]) : undefined}
            labels={revealed ? 'target' : 'c-only'}
            showTargets={revealed}
          />
        </div>
      </div>

      <WeakNoteReport />
    </div>
  )
}

function RoundResult({ correct, total, median, onAgain }: {
  correct: number; total: number; median: number; onAgain: () => void
}) {
  const pct = Math.round((correct / Math.max(total, 1)) * 100)
  return (
    <>
      <h2>{pct}% first time</h2>
      <p>
        {correct} of {total} without a hint, median {(median / 1000).toFixed(1)}s per note.
        {median > 2500 && ' Speed comes after accuracy — keep going.'}
        {median <= 2500 && median > 1200 && ' You are decoding. Next stop is recognising.'}
        {median <= 1200 && ' That is recognition, not counting. This is what reading feels like.'}
      </p>
      <button className="primary" onClick={onAgain}>Another {total}</button>
    </>
  )
}

/** Shows where reading is actually breaking down, note by note. */
function WeakNoteReport() {
  const progress = useProgress()
  const rows = Object.entries(progress.noteStats)
    .filter(([, s]) => s.seen >= 3)
    .map(([midi, s]) => ({ midi: Number(midi), ...s, acc: s.correct / s.seen }))
    .sort((a, b) => a.acc - b.acc || b.avgMs - a.avgMs)
    .slice(0, 6)
  if (rows.length === 0) return null
  return (
    <div className="weak-report">
      <h3>Slowest to find</h3>
      <ul>
        {rows.map((r) => (
          <li key={r.midi}>
            <span className="n">{noteName(r.midi)}</span>
            <span className="bar"><i style={{ width: `${Math.round(r.acc * 100)}%` }} /></span>
            <span className="v">{Math.round(r.acc * 100)}% · {(r.avgMs / 1000).toFixed(1)}s</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

const SP = 18

function DrillStaff({ midi, clef, revealed }: { midi: number; clef: Clef | 'grand'; revealed: boolean }) {
  const note = spell(midi, KEYS.C)
  const actual: Clef = clef === 'grand' ? (midi < 60 ? 'bass' : 'treble') : clef
  const showBoth = clef === 'grand'
  const top = SP * 5
  const y = top + staffY(note, actual) * SP
  const height = (showBoth ? GRAND_HEIGHT : 4) * SP + SP * 10
  const staves: Clef[] = showBoth ? ['treble', 'bass'] : [actual]
  const offset = showBoth ? 0 : actual === 'bass' ? -8 : 0
  const glyph = glyphFor(1)
  const x = 320

  return (
    <svg className="drill-staff" viewBox={`0 0 640 ${height}`} role="img"
      aria-label={`Read this note${revealed ? `: ${noteName(midi)}` : ''}`}>
      <g transform={`translate(0 ${offset * SP})`}>
        {staves.map((c) =>
          staffLines(c).map((l) => (
            <line key={`${c}${l}`} className="staff-line" x1={60} x2={600}
              y1={top + l * SP} y2={top + l * SP} />
          )),
        )}
        {staves.map((c) => {
          const anchor = c === 'treble' ? 3 : 9
          return (
            <g key={`clef${c}`} transform={`translate(${SP * 6} ${top + anchor * SP}) scale(${SP})`}>
              <path className="clef" d={c === 'treble' ? TREBLE_CLEF_PATH : BASS_CLEF_PATH}
                strokeWidth={0.2} />
              {c === 'bass' && BASS_CLEF_DOTS.map(([dx, dy], i) => (
                <circle key={i} className="clef-dot" cx={dx} cy={dy} r={0.17} />
              ))}
            </g>
          )
        })}
        <g className={`note drill-note ${revealed ? 'revealed' : ''}`} transform={`translate(${x} ${y})`}>
          {ledgerLines(staffY(note, actual), actual).map((l) => {
            const ly = (l - staffY(note, actual)) * SP
            return <line key={l} className="ledger" x1={-SP * 1.3} x2={SP * 1.3} y1={ly} y2={ly} />
          })}
          <line className="stem" x1={SP * 0.6} x2={SP * 0.6} y1={0} y2={-SP * 3.4} />
          <ellipse className={glyph.filled ? 'head filled' : 'head open'} rx={SP * 0.68} ry={SP * 0.5}
            transform="rotate(-18)" strokeWidth={SP * 0.16} />
          {revealed && (
            <text className="reveal" x={0} y={SP * 3} fontSize={SP * 1.4} textAnchor="middle">
              {keyLabel(midi)}
            </text>
          )}
        </g>
      </g>
    </svg>
  )
}
