import { useCallback, useEffect, useRef, useState } from 'react'
import { synth } from './synth'
import { songEnd, songStart, type Song } from '../music/song'

/**
 * Plays a generated arrangement so it can be heard before it is committed to.
 * Hearing a chart is the fastest way to catch a wrong chord — far quicker than
 * reading it back, and it is what tells you the app understood the song.
 */
export function usePreview() {
  const [playing, setPlaying] = useState(false)
  const beatRef = useRef(0)
  const rafRef = useRef(0)
  const timersRef = useRef<number[]>([])

  const stop = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    for (const t of timersRef.current) window.clearTimeout(t)
    timersRef.current = []
    synth.allOff()
    setPlaying(false)
  }, [])

  const play = useCallback(
    async (song: Song) => {
      stop()
      await synth.resume()
      const from = songStart(song)
      const to = songEnd(song)
      const beatsPerSecond = song.bpm / 60
      const startedAt = performance.now()
      beatRef.current = from - 1
      setPlaying(true)

      const sounded = new Set<number>()
      const tick = () => {
        rafRef.current = requestAnimationFrame(tick)
        const beat = from - 1 + ((performance.now() - startedAt) / 1000) * beatsPerSecond
        beatRef.current = beat

        song.notes.forEach((note, i) => {
          if (sounded.has(i) || note.start > beat) return
          sounded.add(i)
          synth.noteOn(note.midi, note.hand === 'R' ? 0.85 : 0.55)
          timersRef.current.push(
            window.setTimeout(() => synth.noteOff(note.midi), (note.dur / beatsPerSecond) * 1000),
          )
        })

        if (beat > to + 0.5) stop()
      }
      rafRef.current = requestAnimationFrame(tick)
    },
    [stop],
  )

  useEffect(() => stop, [stop])
  return { playing, play, stop, beatRef }
}
