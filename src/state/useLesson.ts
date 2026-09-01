import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { input } from '../input/input'
import { synth } from '../audio/synth'
import { notesAt, onsets, songEnd, songStart, type Section, type Song, type SongNote } from '../music/song'
import { progressStore } from './progress'

export type LessonMode = 'wait' | 'flow' | 'listen'

export interface LessonState {
  running: boolean
  finished: boolean
  dueIndex: number
  dueBeat: number | null
  required: SongNote[]
  matched: Set<number>
  wrong: Set<number>
  hits: number
  misses: number
  /** Live accuracy for this run-through, 0–1. */
  accuracy: number
}

/** How far off the beat a note can be in flow mode and still count, in beats. */
const FLOW_TOLERANCE = 0.35

export function useLesson(song: Song, opts: { mode: LessonMode; tempoScale: number; loop: Section | null }) {
  const { mode, tempoScale, loop } = opts

  const beatRef = useRef(0)
  const start = useMemo(() => songStart(song), [song])
  const end = useMemo(() => songEnd(song), [song])
  const points = useMemo(() => onsets(song), [song])

  const from = loop ? loop.start : start
  const to = loop ? loop.end : end

  const [state, setState] = useState<LessonState>(() => initial(song, points, from))
  const stateRef = useRef(state)
  stateRef.current = state

  // The moment the current note became due, for measuring reading speed.
  const dueSinceRef = useRef(performance.now())
  const scheduledRef = useRef(new Set<SongNote>())

  const reset = useCallback(() => {
    beatRef.current = from - 1 // a beat of lead-in before the first note
    scheduledRef.current.clear()
    synth.allOff()
    setState(initial(song, points, from))
    dueSinceRef.current = performance.now()
  }, [song, points, from])

  useEffect(reset, [reset, mode])

  const [running, setRunning] = useState(false)

  const advance = useCallback(
    (nextIndex: number) => {
      dueSinceRef.current = performance.now()
      setState((s) => ({
        ...s,
        dueIndex: nextIndex,
        dueBeat: points[nextIndex] ?? null,
        required: points[nextIndex] === undefined ? [] : notesAt(song, points[nextIndex]),
        matched: new Set(),
        wrong: new Set(),
        finished: points[nextIndex] === undefined || points[nextIndex] >= to,
      }))
    },
    [points, song, to],
  )

  /* --- input handling ------------------------------------------------- */
  useEffect(() => {
    if (!running || mode === 'listen') return
    const off = input.onNoteOn((midi) => {
      const s = stateRef.current
      if (s.finished) return
      const wanted = new Set(s.required.map((n) => n.midi))
      const ms = performance.now() - dueSinceRef.current

      if (wanted.has(midi) && !s.matched.has(midi)) {
        progressStore.recordNote(midi, true, ms)
        const matched = new Set(s.matched).add(midi)
        if (matched.size >= wanted.size) {
          setState((p) => ({ ...p, hits: p.hits + 1 }))
          advance(s.dueIndex + 1)
        } else {
          setState((p) => ({ ...p, matched }))
        }
      } else if (!wanted.has(midi)) {
        // Only the first wrong note per attempt counts against her; hammering
        // the same wrong key while hunting should not tank the score.
        if (s.wrong.size === 0) {
          for (const n of s.required) progressStore.recordNote(n.midi, false, ms)
        }
        setState((p) => ({ ...p, wrong: new Set(p.wrong).add(midi), misses: p.misses + 1 }))
        synth.blip(180, 0.05, 0.06)
      }
    })
    return off
  }, [running, mode, advance])

  /* --- transport ------------------------------------------------------ */
  useEffect(() => {
    if (!running) return
    let raf = 0
    let last = performance.now()

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick)
      const dt = Math.min((now - last) / 1000, 0.1)
      last = now
      const bps = (song.bpm * tempoScale) / 60
      const s = stateRef.current

      if (mode === 'wait' && s.dueBeat !== null) {
        // Move at tempo up to the next note, then hold until it is played.
        const next = Math.min(beatRef.current + dt * bps, s.dueBeat)
        beatRef.current = next
      } else {
        beatRef.current += dt * bps
      }

      if (mode === 'listen') {
        // Sound the piece so she can hear what she is aiming at.
        for (const n of song.notes) {
          if (scheduledRef.current.has(n)) continue
          if (n.start <= beatRef.current) {
            scheduledRef.current.add(n)
            synth.noteOn(n.midi, n.hand === 'R' ? 0.85 : 0.55)
            const ms = (n.dur / bps) * 1000
            window.setTimeout(() => synth.noteOff(n.midi), ms)
          }
        }
      }

      if (mode === 'flow' && s.dueBeat !== null && beatRef.current > s.dueBeat + FLOW_TOLERANCE) {
        // The moment passed unplayed — count it and move on rather than stall.
        if (s.matched.size === 0) {
          setState((p) => ({ ...p, misses: p.misses + 1 }))
          for (const n of s.required) progressStore.recordNote(n.midi, false, 3000)
        }
        advance(s.dueIndex + 1)
      }

      if (beatRef.current >= to + 1) {
        if (loop) {
          beatRef.current = from - 1
          scheduledRef.current.clear()
          advance(indexOfBeat(points, from))
        } else {
          setRunning(false)
          setState((p) => ({ ...p, finished: true }))
        }
      }
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      synth.allOff()
    }
  }, [running, mode, tempoScale, song, to, from, loop, points, advance])

  const play = useCallback(async () => {
    await synth.resume()
    if (stateRef.current.finished) reset()
    setRunning(true)
  }, [reset])

  const pause = useCallback(() => {
    setRunning(false)
    synth.allOff()
  }, [])

  const restart = useCallback(() => {
    reset()
    setRunning(true)
  }, [reset])

  const accuracy = state.hits + state.misses === 0 ? 1 : state.hits / (state.hits + state.misses)

  return {
    beatRef,
    state: { ...state, running, accuracy },
    play,
    pause,
    restart,
    progressFraction: clamp((beatRef.current - from) / Math.max(to - from, 1)),
  }
}

function initial(song: Song, points: number[], from: number): LessonState {
  const idx = indexOfBeat(points, from)
  const beat = points[idx]
  return {
    running: false,
    finished: false,
    dueIndex: idx,
    dueBeat: beat ?? null,
    required: beat === undefined ? [] : notesAt(song, beat),
    matched: new Set(),
    wrong: new Set(),
    hits: 0,
    misses: 0,
    accuracy: 1,
  }
}

function indexOfBeat(points: number[], beat: number): number {
  const i = points.findIndex((p) => p >= beat - 1e-6)
  return i < 0 ? 0 : i
}

function clamp(x: number) {
  return Math.max(0, Math.min(1, x))
}
