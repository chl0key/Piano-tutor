import { useEffect, useRef } from 'react'
import type { ChordMark } from '../music/song'

/**
 * The song's chords in order, with the current one lit. At the basic level this
 * is the lesson: get through the strip and you have played the whole song.
 */
export function ChordStrip({ chords, dueBeat }: { chords: ChordMark[]; dueBeat: number | null }) {
  const ref = useRef<HTMLDivElement>(null)
  const current = dueBeat === null
    ? -1
    : chords.reduce((best, c, i) => (c.start <= dueBeat + 1e-6 ? i : best), -1)

  useEffect(() => {
    const el = ref.current?.querySelector<HTMLElement>('.chip.on')
    if (!el || !ref.current) return
    const box = ref.current
    const want = el.offsetLeft - box.clientWidth / 2 + el.offsetWidth / 2
    box.scrollTo({ left: Math.max(0, want), behavior: 'smooth' })
  }, [current])

  if (chords.length === 0) return null

  return (
    <div className="chord-strip" ref={ref} aria-label="Chords in order">
      {chords.map((c, i) => (
        <span key={i} className={`chip ${i === current ? 'on' : ''} ${i < current ? 'done' : ''}`}>
          {c.text}
        </span>
      ))}
    </div>
  )
}
