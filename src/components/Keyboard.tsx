import { useCallback, useMemo, useRef } from 'react'
import { isBlackKey, keyLabel, type KeySignature } from '../music/theory'
import { input } from '../input/input'
import { keyboardLayout } from './keyboardLayout'
import { useSize } from './useMeasure'

export type KeyLabelMode = 'none' | 'all' | 'c-only' | 'target'

interface Props {
  low: number
  high: number
  keySig: KeySignature
  held: Set<number>
  /** Notes the learner should be playing right now. */
  targets?: Set<number>
  /** Notes played that were not wanted — shown only as after-the-fact feedback. */
  wrong?: Set<number>
  /** Finger numbers to print on the target keys. */
  fingers?: Map<number, number>
  labels: KeyLabelMode
  /** Off during the reading levels, so the keys stop giving the answer away. */
  showTargets: boolean
  interactive?: boolean
}

/** Black key height as a fraction of a white key. */
const BLACK_RATIO = 0.62

export function Keyboard({
  low, high, keySig, held, targets, wrong, fingers, labels, showTargets, interactive = true,
}: Props) {
  const [wrapRef, { width, height }] = useSize<HTMLDivElement>()
  const { keys, whites } = useMemo(() => keyboardLayout(low, high), [low, high])
  const pressed = useRef(new Map<number, number>())

  const down = useCallback(
    (e: React.PointerEvent, midi: number) => {
      if (!interactive) return
      e.preventDefault()
      ;(e.target as Element).setPointerCapture?.(e.pointerId)
      pressed.current.set(e.pointerId, midi)
      input.press(midi)
    },
    [interactive],
  )

  const up = useCallback((e: React.PointerEvent) => {
    const midi = pressed.current.get(e.pointerId)
    if (midi === undefined) return
    pressed.current.delete(e.pointerId)
    input.release(midi)
  }, [])

  // One user unit is one white key wide. Deriving the height from the measured
  // width keeps the aspect ratio honest, so nothing on the keys is stretched.
  const unit = width / Math.max(whites, 1)
  const vbHeight = unit > 0 ? height / unit : 0
  const fontScale = Math.min(0.42, vbHeight * 0.09)

  return (
    <div className="keyboard-wrap" ref={wrapRef}>
      {unit > 0 && height > 0 && (
        <svg className="keyboard" width={width} height={height}
          viewBox={`0 0 ${whites} ${vbHeight}`} role="group" aria-label="Piano keyboard">
          {keys.map((k) => {
            const isTarget = showTargets && targets?.has(k.midi)
            const isHeld = held.has(k.midi)
            const isWrong = wrong?.has(k.midi)
            const cls = [
              'key', k.black ? 'black' : 'white',
              isTarget ? 'target' : '', isHeld ? 'held' : '', isWrong ? 'wrong' : '',
            ].filter(Boolean).join(' ')
            const h = k.black ? vbHeight * BLACK_RATIO : vbHeight
            const label = labelFor(labels, k.midi, keySig, !!isTarget)
            const finger = isTarget ? fingers?.get(k.midi) : undefined
            return (
              <g key={k.midi} className={cls}>
                <rect x={k.x} y={0} width={k.w} height={h} rx={0.08}
                  onPointerDown={(e) => down(e, k.midi)} onPointerUp={up} onPointerCancel={up} />
                {label && (
                  <text className="key-label" x={k.x + k.w / 2} y={h - fontScale * 0.7}
                    fontSize={fontScale * (k.black ? 0.8 : 1)} textAnchor="middle">{label}</text>
                )}
                {finger !== undefined && (
                  <g className="finger-mark">
                    <circle cx={k.x + k.w / 2} cy={h - fontScale * 2.9} r={fontScale * 0.72} />
                    <text x={k.x + k.w / 2} y={h - fontScale * 2.9 + fontScale * 0.34}
                      fontSize={fontScale} textAnchor="middle">{finger}</text>
                  </g>
                )}
              </g>
            )
          })}
        </svg>
      )}
    </div>
  )
}

function labelFor(mode: KeyLabelMode, midi: number, keySig: KeySignature, isTarget: boolean): string | null {
  if (mode === 'none') return null
  if (mode === 'target') return isTarget ? keyLabel(midi, keySig) : null
  // Black keys are named only when they are the answer; otherwise they are noise.
  if (mode === 'all') return isBlackKey(midi) ? (isTarget ? keyLabel(midi, keySig) : null) : keyLabel(midi, keySig)
  // 'c-only': the anchor every other note is found from.
  return midi % 12 === 0 ? `C${Math.floor(midi / 12) - 1}` : null
}
