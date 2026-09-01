import { useEffect, useRef } from 'react'
import type { SongNote } from '../music/song'
import { keyboardLayout } from './keyboardLayout'

interface Props {
  notes: SongNote[]
  beatRef: React.MutableRefObject<number>
  low: number
  high: number
  /** How many beats of music are visible in the lane at once. */
  beatsVisible: number
  /** 1 at the watching levels, lower as the scaffold fades, 0 when reading. */
  opacity: number
  dueBeat: number | null
}

const COLORS = {
  R: { fill: 'rgba(94, 178, 255, 0.85)', edge: 'rgba(180, 220, 255, 0.95)' },
  L: { fill: 'rgba(255, 156, 108, 0.85)', edge: 'rgba(255, 205, 175, 0.95)' },
}

/**
 * The view she already learns from: blocks falling onto the keys they belong to.
 * It is deliberately the layer that disappears as the scaffold levels rise.
 */
export function FallingNotes({ notes, beatRef, low, high, beatsVisible, opacity, dueBeat }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const dueRef = useRef(dueBeat)
  dueRef.current = dueBeat

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const { keys, whites } = keyboardLayout(low, high)
    // Index once; the draw loop must not allocate.
    const rects = new Map(keys.map((k) => [k.midi, k]))

    let raf = 0
    let w = 0
    let h = 0

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const rect = canvas.getBoundingClientRect()
      // Refuse absurd sizes: a canvas whose pixel width feeds back into layout
      // can otherwise run away, and a huge backing store will not allocate.
      w = Math.min(rect.width, 6000)
      h = Math.min(rect.height, 2000)
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    const draw = () => {
      raf = requestAnimationFrame(draw)
      if (w === 0 || h === 0) return
      const beat = beatRef.current
      const ppb = h / beatsVisible
      const unit = w / whites
      ctx.clearRect(0, 0, w, h)

      // Faint lane guides behind the notes, one per white key.
      ctx.strokeStyle = 'rgba(255,255,255,0.045)'
      ctx.lineWidth = 1
      for (let i = 1; i < whites; i++) {
        ctx.beginPath()
        ctx.moveTo(i * unit, 0)
        ctx.lineTo(i * unit, h)
        ctx.stroke()
      }

      ctx.globalAlpha = opacity
      for (const n of notes) {
        const bottom = h - (n.start - beat) * ppb
        const top = bottom - n.dur * ppb
        if (bottom < -20 || top > h + 20) continue
        const k = rects.get(n.midi)
        if (!k) continue
        const x = k.x * unit + 1.5
        const bw = Math.max(k.w * unit - 3, 4)
        const bh = Math.max(bottom - top, 6)
        const c = COLORS[n.hand]
        const isDue = dueRef.current !== null && Math.abs(n.start - dueRef.current) < 1e-6

        ctx.fillStyle = c.fill
        roundRect(ctx, x, top, bw, bh, Math.min(5, bw / 2))
        ctx.fill()
        ctx.strokeStyle = isDue ? '#fff' : c.edge
        ctx.lineWidth = isDue ? 2.5 : 1
        ctx.stroke()
      }
      ctx.globalAlpha = 1

      // The strike line: where a note has arrived and must be played.
      ctx.fillStyle = 'rgba(255,255,255,0.5)'
      ctx.fillRect(0, h - 2, w, 2)
    }
    draw()

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [notes, beatRef, low, high, beatsVisible, opacity])

  return <canvas ref={canvasRef} className="falling" aria-hidden="true" />
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}
