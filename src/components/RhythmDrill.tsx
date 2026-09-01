import { useCallback, useEffect, useRef, useState } from 'react'
import { synth } from '../audio/synth'
import { flagPath, glyphFor } from '../music/notation'

export interface RhythmResult {
  /** Notes landed on, as a fraction of the pattern. */
  accuracy: number
  /** Mean distance from the beat, in beats. */
  meanError: number
  hits: number
  total: number
}

interface Props {
  pattern: number[]
  bpm: number
  onDone: (result: RhythmResult) => void
}

type Phase = 'idle' | 'count-in' | 'playing' | 'done'

/** How far off a tap can be and still count as that note. */
const WINDOW_BEATS = 0.4
const COUNT_IN_BEATS = 4

/**
 * Tap each note as it arrives, on the note itself rather than clapping along
 * beside the music. Tying the tap to the notehead is what teaches the symbol its
 * length; counting out loud leaves the two only loosely connected.
 */
export function RhythmDrill({ pattern, bpm, onDone }: Props) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [hitIndices, setHitIndices] = useState<Set<number>>(new Set())
  const [countIn, setCountIn] = useState(0)
  const playheadRef = useRef<SVGLineElement>(null)
  const startRef = useRef(0)
  const tapsRef = useRef<number[]>([])
  const rafRef = useRef(0)

  // Where each note falls, in beats from the start of the bar.
  const onsets = pattern.reduce<number[]>((acc, _, i) => {
    acc.push(i === 0 ? 0 : acc[i - 1] + pattern[i - 1])
    return acc
  }, [])
  const totalBeats = pattern.reduce((a, b) => a + b, 0)
  const msPerBeat = 60000 / bpm

  const finish = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    setPhase('done')

    // Match each note to its nearest unclaimed tap. Greedy in beat order is
    // enough: taps are near their own notes or they are not hits at all.
    const taps = [...tapsRef.current]
    const errors: number[] = []
    let hits = 0
    for (const onset of onsets) {
      let bestIndex = -1
      let bestDistance = WINDOW_BEATS
      taps.forEach((tap, i) => {
        const distance = Math.abs(tap - onset)
        if (distance < bestDistance) {
          bestDistance = distance
          bestIndex = i
        }
      })
      if (bestIndex >= 0) {
        hits++
        errors.push(bestDistance)
        taps.splice(bestIndex, 1)
      }
    }
    onDone({
      accuracy: hits / onsets.length,
      meanError: errors.length ? errors.reduce((a, b) => a + b, 0) / errors.length : WINDOW_BEATS,
      hits,
      total: onsets.length,
    })
  }, [onsets, onDone])

  const start = useCallback(async () => {
    await synth.resume()
    tapsRef.current = []
    setHitIndices(new Set())
    setPhase('count-in')
    startRef.current = performance.now()

    let clicked = -1
    const tick = () => {
      rafRef.current = requestAnimationFrame(tick)
      const elapsed = (performance.now() - startRef.current) / msPerBeat
      const beat = elapsed - COUNT_IN_BEATS

      // Metronome through the count-in and the bar itself.
      const wholeBeat = Math.floor(elapsed)
      if (wholeBeat > clicked && wholeBeat < COUNT_IN_BEATS + totalBeats) {
        clicked = wholeBeat
        const downbeat = wholeBeat === 0 || wholeBeat === COUNT_IN_BEATS
        synth.blip(downbeat ? 1320 : 880, 0.04, downbeat ? 0.14 : 0.09)
        if (wholeBeat < COUNT_IN_BEATS) setCountIn(COUNT_IN_BEATS - wholeBeat)
      }

      if (beat >= 0) {
        setPhase((p) => (p === 'count-in' ? 'playing' : p))
        if (playheadRef.current) {
          playheadRef.current.setAttribute('x1', String(beat))
          playheadRef.current.setAttribute('x2', String(beat))
          playheadRef.current.style.opacity = '1'
        }
      }
      // A short tail so a late tap on the final note still counts.
      if (beat > totalBeats + WINDOW_BEATS) finish()
    }
    rafRef.current = requestAnimationFrame(tick)
  }, [msPerBeat, totalBeats, finish])

  useEffect(() => () => cancelAnimationFrame(rafRef.current), [])

  const tap = useCallback(() => {
    if (phase !== 'playing' && phase !== 'count-in') return
    const beat = (performance.now() - startRef.current) / msPerBeat - COUNT_IN_BEATS
    tapsRef.current.push(beat)
    synth.blip(2200, 0.03, 0.07)
    // Light up the note it landed on, so the feedback is immediate.
    const index = onsets.findIndex((o) => Math.abs(o - beat) < WINDOW_BEATS)
    if (index >= 0) setHitIndices((prev) => new Set(prev).add(index))
  }, [phase, msPerBeat, onsets])

  const width = totalBeats + 1.2

  return (
    <div className="rhythm-drill">
      <svg className="rhythm-staff" viewBox={`-0.6 -2.6 ${width} 5.2`} preserveAspectRatio="xMidYMid meet"
        role="img" aria-label="Rhythm to tap">
        <line className="rhythm-line" x1={-0.4} x2={totalBeats + 0.4} y1={0} y2={0} strokeWidth={0.05} />
        {[...Array(Math.floor(totalBeats) + 1)].map((_, i) => (
          <line key={i} className="rhythm-beat" x1={i} x2={i} y1={-0.35} y2={0.35} strokeWidth={0.04} />
        ))}
        {onsets.map((onset, i) => {
          const glyph = glyphFor(pattern[i])
          return (
            <g key={i} className={`rhythm-note ${hitIndices.has(i) ? 'hit' : ''}`}
              transform={`translate(${onset} 0)`}>
              {glyph.stem && <line x1={0.34} x2={0.34} y1={0} y2={-2} strokeWidth={0.08} />}
              {glyph.flags > 0 && (
                <g transform="translate(0.34 -2) scale(0.55)">
                  {Array.from({ length: glyph.flags }, (_, f) => (
                    <path key={f} className="flag" d={flagPath(-1, f)} />
                  ))}
                </g>
              )}
              <ellipse className={glyph.filled ? 'head filled' : 'head open'} rx={0.34} ry={0.26}
                transform="rotate(-18)" strokeWidth={0.09} />
              {glyph.dotted && <circle className="dot" cx={0.6} cy={-0.15} r={0.09} />}
            </g>
          )
        })}
        <line ref={playheadRef} className="rhythm-playhead" x1={0} x2={0} y1={-2.3} y2={1.4}
          strokeWidth={0.06} style={{ opacity: 0 }} />
      </svg>

      {phase === 'idle' ? (
        <button className="primary tap-start" onClick={start}>
          Start — four clicks, then tap each note
        </button>
      ) : (
        <button
          className={`tap-pad ${phase}`}
          onPointerDown={(e) => {
            e.preventDefault()
            tap()
          }}
          aria-label="Tap in time"
        >
          {phase === 'count-in' ? <span className="count">{countIn || 4}</span> : <span>Tap</span>}
        </button>
      )}
    </div>
  )
}
