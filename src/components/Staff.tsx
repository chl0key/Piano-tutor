import { useEffect, useMemo, useRef } from 'react'
import { keyLabel, spell, type KeySignature } from '../music/theory'
import {
  AccidentalTracker, BASS_CLEF_DOTS, BASS_CLEF_PATH, GRAND_HEIGHT, TREBLE_CLEF_PATH,
  clefFor, flagPath, glyphFor, keySignatureMarks, ledgerLines, staffLines, staffY,
  type Clef,
} from '../music/notation'
import type { ChordMark, SongNote } from '../music/song'
import { useSize } from './useMeasure'

interface Props {
  notes: SongNote[]
  keySig: KeySignature
  timeSig: [number, number]
  /** Live playback position, read every frame without re-rendering React. */
  beatRef: React.MutableRefObject<number>
  /** Beat of the note the learner must play next; highlighted on the staff. */
  dueBeat: number | null
  pxPerBeat: number
  /** Staff space size in px — the one number that scales the whole rendering. */
  sp?: number
  showLetters: boolean
  /** Chord symbols printed above the top staff, when the piece came from a chart. */
  chords?: ChordMark[]
  /** Headroom above and below the staves, in spaces. Trimmed on short screens. */
  pad?: [number, number]
}

/** Room above and below the staves for ledger lines, stems and letter cues. */
const PAD_TOP = 4.6
const PAD_BOTTOM = 4
/** Distance from the playhead to the left edge of the notes, in px. */
const LEAD = 44

export function Staff({
  notes, keySig, timeSig, beatRef, dueBeat, pxPerBeat, sp = 12, showLetters, chords,
  pad = [PAD_TOP, PAD_BOTTOM],
}: Props) {
  const [wrapRef, { width }] = useSize<HTMLDivElement>()
  const scrollRef = useRef<SVGGElement>(null)

  // A right-hand-only piece gets a right-hand-only staff. An empty bass staff
  // is just something else to ignore while learning to look at the right place.
  const grand = useMemo(() => notes.some((n) => n.hand === 'L'), [notes])
  const span = grand ? GRAND_HEIGHT : 4
  const clefs: Clef[] = grand ? ['treble', 'bass'] : ['treble']

  const top = pad[0] * sp
  const height = (pad[0] + span + pad[1]) * sp

  const headerW = useMemo(() => (6.2 + Math.abs(keySig.fifths) * 0.9 + 2.8) * sp, [keySig, sp])
  const playheadX = headerW + LEAD

  useEffect(() => {
    let raf = 0
    const tick = () => {
      raf = requestAnimationFrame(tick)
      const g = scrollRef.current
      if (g) g.setAttribute('transform', `translate(${playheadX - beatRef.current * pxPerBeat} 0)`)
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [beatRef, pxPerBeat, playheadX])

  const beatsPerBar = timeSig[0] * (4 / timeSig[1])

  const engraved = useMemo(() => {
    const tracker = new AccidentalTracker(keySig, beatsPerBar)
    const ordered = [...notes].sort((a, b) => a.start - b.start || b.midi - a.midi)
    return ordered.map((n, i) => {
      const clef = clefFor(n.hand)
      const note = spell(n.midi, keySig)
      return {
        key: i,
        n,
        clef,
        y: staffY(note, clef),
        accidental: tracker.check(n.midi, n.start),
        glyph: glyphFor(n.dur),
      }
    })
  }, [notes, keySig, beatsPerBar])

  const bounds = useMemo(() => {
    let first = 0
    let last = 0
    for (const n of notes) {
      first = Math.min(first, n.start)
      last = Math.max(last, n.start + n.dur)
    }
    return { first, last }
  }, [notes])

  const barlines = useMemo(() => {
    const out: number[] = []
    for (let b = 0; b <= bounds.last + beatsPerBar; b += beatsPerBar) out.push(b)
    return out
  }, [bounds.last, beatsPerBar])

  // Memoised so neither the scroll nor the highlight rebuilds the engraving.
  const noteLayer = useMemo(
    () =>
      engraved.map(({ key, n, clef, y, accidental, glyph }) => (
        <NoteHead
          key={key}
          x={n.start * pxPerBeat}
          ySpaces={y}
          top={top}
          clef={clef}
          sp={sp}
          glyph={glyph}
          accidental={accidental}
          hand={n.hand}
          label={showLetters ? keyLabel(n.midi, keySig) : null}
        />
      )),
    [engraved, pxPerBeat, sp, top, showLetters, keySig],
  )

  const chordLayer = useMemo(
    () =>
      (chords ?? []).map((c, i) => (
        <text key={i} className="chord-symbol" x={c.start * pxPerBeat} y={top - sp * 1.6}
          fontSize={sp * 1.5}>{c.text}</text>
      )),
    [chords, pxPerBeat, top, sp],
  )

  const due = dueBeat === null ? [] : engraved.filter((e) => Math.abs(e.n.start - dueBeat) < 1e-6)

  return (
    <div className="staff-wrap" ref={wrapRef} style={{ height }}>
      {width > 0 && (
        <svg className="staff" width={width} height={height} viewBox={`0 0 ${width} ${height}`}
          role="img" aria-label="Sheet music">
          {clefs.map((clef) =>
            staffLines(clef).map((l) => (
              <line key={`${clef}${l}`} className="staff-line"
                x1={0} x2={width} y1={top + l * sp} y2={top + l * sp} />
            )),
          )}
          {grand && (
            <line className="staff-brace" x1={1} x2={1} y1={top} y2={top + span * sp} />
          )}

          <g ref={scrollRef}>
            {barlines.map((b) => (
              <line key={b} className="barline"
                x1={b * pxPerBeat} x2={b * pxPerBeat} y1={top} y2={top + span * sp} />
            ))}
            {due.map((e) => (
              <circle key={`due${e.key}`} className="due-halo"
                cx={e.n.start * pxPerBeat} cy={top + e.y * sp} r={sp * 1.4} />
            ))}
            {noteLayer}
            {chordLayer}
          </g>

          {/* The header sits on top and swallows notes as they scroll off. */}
          <g className="staff-header">
            <rect x={0} y={0} width={headerW} height={height} className="header-bg" />
            {clefs.map((clef) => (
              <ClefMark key={clef} clef={clef} sp={sp} top={top} keySig={keySig}
                timeSig={timeSig} headerW={headerW} />
            ))}
            {clefs.map((clef) =>
              staffLines(clef).map((l) => (
                <line key={`h${clef}${l}`} className="staff-line"
                  x1={0} x2={headerW} y1={top + l * sp} y2={top + l * sp} />
              )),
            )}
            <line className="header-edge" x1={headerW} x2={headerW} y1={top} y2={top + span * sp} />
          </g>

          <line className="playhead" x1={playheadX} x2={playheadX}
            y1={top - sp * 1.5} y2={top + (span + 1.5) * sp} />
        </svg>
      )}
    </div>
  )
}

function ClefMark({ clef, sp, top, keySig, timeSig, headerW }: {
  clef: Clef; sp: number; top: number; keySig: KeySignature
  timeSig: [number, number]; headerW: number
}) {
  // The clef is drawn from the line it names: G4 for treble, F3 for bass.
  const anchor = clef === 'treble' ? 3 : 9
  const marks = keySignatureMarks(keySig, clef)
  const tsX = headerW - sp * 1.5
  const upper = clef === 'treble' ? 1 : 9
  return (
    <g>
      <g transform={`translate(${sp * 2.6} ${top + anchor * sp}) scale(${sp})`}>
        <path className="clef" d={clef === 'treble' ? TREBLE_CLEF_PATH : BASS_CLEF_PATH}
          strokeWidth={0.2} />
        {clef === 'bass' &&
          BASS_CLEF_DOTS.map(([dx, dy], i) => (
            <circle key={i} className="clef-dot" cx={dx} cy={dy} r={0.16} />
          ))}
      </g>
      {marks.map((m, i) => (
        <text key={i} className="accidental key-sig"
          x={sp * (5.6 + i * 0.9)} y={top + m.y * sp} fontSize={sp * 2.6}>
          {m.glyph}
        </text>
      ))}
      <text className="time-sig" x={tsX} y={top + upper * sp} fontSize={sp * 2.4}>{timeSig[0]}</text>
      <text className="time-sig" x={tsX} y={top + (upper + 2) * sp} fontSize={sp * 2.4}>{timeSig[1]}</text>
    </g>
  )
}

function NoteHead({
  x, ySpaces, top, clef, sp, glyph, accidental, hand, label,
}: {
  x: number; ySpaces: number; top: number; sp: number
  clef: Clef
  glyph: ReturnType<typeof glyphFor>
  accidental: string | null
  hand: 'L' | 'R'
  label: string | null
}) {
  // Stems point away from the middle line of the note's own staff, as engraved.
  const middle = clef === 'treble' ? 2 : 10
  const stemDown = ySpaces < middle
  const dir = stemDown ? 1 : -1
  const stemX = stemDown ? -sp * 0.6 : sp * 0.6
  const stemLen = sp * 3.3
  const y = top + ySpaces * sp

  return (
    <g className={`note hand-${hand}`} transform={`translate(${x} ${y})`}>
      {ledgerLines(ySpaces, clef).map((l) => {
        const ly = (l - ySpaces) * sp
        return <line key={l} className="ledger" x1={-sp * 1.15} x2={sp * 1.15} y1={ly} y2={ly} />
      })}
      {glyph.stem && <line className="stem" x1={stemX} x2={stemX} y1={0} y2={dir * stemLen} />}
      {glyph.flags > 0 && (
        <g transform={`translate(${stemX} ${dir * stemLen})`}>
          {Array.from({ length: glyph.flags }, (_, i) => (
            <path key={i} className="flag" d={flagPath(dir, i)} transform={`scale(${sp})`} />
          ))}
        </g>
      )}
      <ellipse className={glyph.filled ? 'head filled' : 'head open'}
        rx={sp * 0.66} ry={sp * 0.48} transform="rotate(-18)" strokeWidth={sp * 0.17} />
      {glyph.dotted && <circle className="dot" cx={sp * 1.1} cy={-sp * 0.25} r={sp * 0.16} />}
      {accidental && (
        <text className="accidental" x={-sp * 1.4} y={0} fontSize={sp * 2.3} textAnchor="end">
          {accidental}
        </text>
      )}
      {label && (
        <text className="note-label" x={0} y={dir === -1 ? sp * 2.3 : -sp * 1.9}
          fontSize={sp * 1.05} textAnchor="middle">{label}</text>
      )}
    </g>
  )
}
