import { useMemo } from 'react'
import { spell, type KeySignature, KEYS } from '../music/theory'
import {
  BASS_CLEF_DOTS, BASS_CLEF_PATH, BASS_Y, GRAND_HEIGHT, TREBLE_CLEF_PATH,
  flagPath, glyphFor, keySignatureMarks, ledgerLines, staffLines, staffY,
  type Clef,
} from '../music/notation'

export interface MiniNote {
  midi: number
  /** Beats. Omit for a plain quarter-note head. */
  dur?: number
  rest?: boolean
  /** Marks the note being asked about, or the one just answered. */
  state?: 'ask' | 'right' | 'wrong'
  label?: string
}

interface Props {
  notes: MiniNote[]
  clef?: Clef | 'grand'
  keySig?: KeySignature
  /** Draw the signature but no notes — for the key-signature drill. */
  signatureOnly?: boolean
  /** Stack the notes on one beat instead of spacing them out. */
  stacked?: boolean
  className?: string
}

const PAD_TOP = 4
const PAD_BOTTOM = 4
const SLOT = 4.2

/**
 * A small, static staff for a single drill question. Everything is measured in
 * staff spaces and scaled by the container, so the same component works at the
 * size of a phone card or a full-width panel.
 */
export function MiniStaff({
  notes, clef = 'treble', keySig = KEYS.C, signatureOnly = false, stacked = false, className = '',
}: Props) {
  const grand = clef === 'grand'
  const staves: Clef[] = grand ? ['treble', 'bass'] : [clef]
  const span = grand ? GRAND_HEIGHT : 4
  const top = PAD_TOP

  // Staff positions are measured on the whole grand staff, so a bass-only
  // staff arrives eight spaces too low and has to be lifted back up.
  const shift = !grand && clef === 'bass' ? BASS_Y : 0

  const headerW = 6.2 + Math.abs(keySig.fifths) * 0.9 + 1.2
  const slots = signatureOnly ? 1 : stacked ? 1 : notes.length
  const width = headerW + slots * SLOT + 2
  const height = PAD_TOP + span + PAD_BOTTOM

  const placed = useMemo(
    () =>
      notes.map((n, i) => {
        const noteClef: Clef = grand ? (n.midi < 60 ? 'bass' : 'treble') : (clef as Clef)
        const spelled = spell(n.midi, keySig)
        return {
          ...n,
          key: i,
          clef: noteClef,
          y: staffY(spelled, noteClef),
          x: headerW + 1.2 + (stacked ? 0 : i) * SLOT,
          glyph: glyphFor(n.dur ?? 1),
        }
      }),
    [notes, grand, clef, keySig, headerW, stacked],
  )

  return (
    <svg className={`mini-staff ${className}`} viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid meet" role="img" aria-label="Music notation">
      <g transform={`translate(0 ${-shift})`}>
      {staves.map((c) =>
        staffLines(c).map((l) => (
          <line key={`${c}${l}`} className="staff-line" x1={0.4} x2={width - 0.4}
            y1={top + l} y2={top + l} strokeWidth={0.09} />
        )),
      )}
      {grand && (
        <line className="staff-brace" x1={0.4} x2={0.4} y1={top} y2={top + span} strokeWidth={0.2} />
      )}

      {staves.map((c) => {
        const anchor = c === 'treble' ? 3 : 9
        return (
          <g key={`clef${c}`}>
            <g transform={`translate(2.6 ${top + anchor})`}>
              <path className="clef" d={c === 'treble' ? TREBLE_CLEF_PATH : BASS_CLEF_PATH}
                strokeWidth={0.2} />
              {c === 'bass' && BASS_CLEF_DOTS.map(([dx, dy], i) => (
                <circle key={i} className="clef-dot" cx={dx} cy={dy} r={0.16} />
              ))}
            </g>
            {keySignatureMarks(keySig, c).map((m, i) => (
              <text key={i} className="accidental" x={5.6 + i * 0.9} y={top + m.y}
                fontSize={2.6}>{m.glyph}</text>
            ))}
          </g>
        )
      })}

      {!signatureOnly && placed.map((n) => (
        <g key={n.key} className={`note mini-note ${n.state ?? ''}`}
          transform={`translate(${n.x} ${top + (n.rest ? (n.clef === 'bass' ? 10 : 2) : n.y)})`}>
          {n.rest ? (
            <Rest dur={n.dur ?? 1} />
          ) : (
            <>
              {ledgerLines(n.y, n.clef).map((l) => (
                <line key={l} className="ledger" x1={-1.15} x2={1.15}
                  y1={l - n.y} y2={l - n.y} strokeWidth={0.09} />
              ))}
              <Head glyph={n.glyph} stemDown={n.y < (n.clef === 'treble' ? 2 : 10)} />
            </>
          )}
          {n.label && (
            <text className="mini-label" x={0} y={n.rest ? 3.4 : 3.6} fontSize={1.3}
              textAnchor="middle">{n.label}</text>
          )}
        </g>
      ))}
      </g>
    </svg>
  )
}

function Head({ glyph, stemDown }: { glyph: ReturnType<typeof glyphFor>; stemDown: boolean }) {
  const dir = stemDown ? 1 : -1
  const stemX = stemDown ? -0.6 : 0.6
  return (
    <>
      {glyph.stem && <line className="stem" x1={stemX} x2={stemX} y1={0} y2={dir * 3.3} strokeWidth={0.14} />}
      {glyph.flags > 0 && (
        <g transform={`translate(${stemX} ${dir * 3.3})`}>
          {Array.from({ length: glyph.flags }, (_, i) => (
            <path key={i} className="flag" d={flagPath(dir, i)} />
          ))}
        </g>
      )}
      <ellipse className={glyph.filled ? 'head filled' : 'head open'} rx={0.66} ry={0.48}
        transform="rotate(-18)" strokeWidth={0.17} />
      {glyph.dotted && <circle className="dot" cx={1.1} cy={-0.25} r={0.16} />}
    </>
  )
}

/**
 * Rests, drawn simply. The quarter rest is the one people find hard to place,
 * so it gets the full zigzag rather than a shorthand.
 */
function Rest({ dur }: { dur: number }) {
  if (dur >= 4) return <rect className="rest-block" x={-0.45} y={-1} width={0.9} height={0.32} />
  if (dur >= 2) return <rect className="rest-block" x={-0.45} y={-0.32} width={0.9} height={0.32} />
  if (dur >= 0.75) {
    return (
      <path className="rest-stroke" d="M -0.15 -1.15 L 0.3 -0.4 L -0.2 0.15 L 0.32 0.85"
        strokeWidth={0.24} fill="none" />
    )
  }
  return (
    <g className="rest-eighth">
      <circle cx={0.18} cy={-0.5} r={0.2} />
      <path d="M 0.34 -0.55 L -0.1 0.85" strokeWidth={0.16} fill="none" />
    </g>
  )
}
