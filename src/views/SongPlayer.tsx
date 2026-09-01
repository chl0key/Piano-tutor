import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { Staff } from '../components/Staff'
import { FallingNotes } from '../components/FallingNotes'
import { Keyboard, type KeyLabelMode } from '../components/Keyboard'
import { rangeFor, whiteCount, whiteOffset } from '../components/keyboardLayout'
import { useHeldNotes, useComputerKeyboard, useInputStatus } from '../input/input'
import { songEnd, songStart, type Section, type Song } from '../music/song'
import { useLesson, type LessonMode } from '../state/useLesson'
import { SCAFFOLD_LEVELS, progressStore, useLogPracticeTime, type ScaffoldLevel } from '../state/progress'

/** Never squeeze a key narrower than this; below it the keyboard stops being tappable. */
const MIN_KEY_PX = 34

/** How much help each scaffold level gives. This table is the curriculum. */
function scaffold(level: ScaffoldLevel) {
  switch (level) {
    case 1: return { fallingOpacity: 1, labels: 'all' as KeyLabelMode, targets: true, fingers: true, staffLetters: true, staffSize: 10 }
    case 2: return { fallingOpacity: 0.9, labels: 'target' as KeyLabelMode, targets: true, fingers: true, staffLetters: true, staffSize: 12 }
    case 3: return { fallingOpacity: 0.28, labels: 'c-only' as KeyLabelMode, targets: true, fingers: false, staffLetters: false, staffSize: 13 }
    case 4: return { fallingOpacity: 0, labels: 'c-only' as KeyLabelMode, targets: false, fingers: false, staffLetters: false, staffSize: 14 }
    case 5: return { fallingOpacity: 0, labels: 'none' as KeyLabelMode, targets: false, fingers: false, staffLetters: false, staffSize: 14 }
  }
}

export function SongPlayer({ song, onExit }: { song: Song; onExit: () => void }) {
  const stored = progressStore.song(song.id)
  const [level, setLevel] = useState<ScaffoldLevel>(stored.scaffold)
  const [mode, setMode] = useState<LessonMode>('wait')
  const [tempoScale, setTempoScale] = useState(1)
  const [loop, setLoop] = useState<Section | null>(null)
  const [levelUpOffer, setLevelUpOffer] = useState(false)
  const bankTime = useLogPracticeTime()
  const boardRef = useRef<HTMLDivElement>(null)

  const cfg = scaffold(level)
  const compact = useCompact()
  const status = useInputStatus()
  useComputerKeyboard(status.source === 'screen')

  const { beatRef, state, play, pause, restart } = useLesson(song, { mode, tempoScale, loop })
  const held = useHeldNotes()

  const [low, high] = useMemo(() => rangeFor(song.notes.map((n) => n.midi)), [song])
  const whites = useMemo(() => whiteCount(low, high), [low, high])

  // Horizontal space on the staff is time, so the notes line up with the lane
  // below them. A piece full of sixteenths therefore needs a wider beat than a
  // piece of quarter notes, or the noteheads collide into an unreadable clump.
  const shortest = useMemo(
    () => song.notes.reduce((m, n) => Math.min(m, n.dur), 4),
    [song],
  )
  const pxPerBeat = Math.round(Math.min(140, Math.max(46, 28 / shortest)) * (compact ? 0.75 : 1))
  // Likewise the lane: show fewer beats at once when the notes are short.
  const beatsVisible = Math.min(8, Math.max(3, shortest * 12))
  const targets = useMemo(() => new Set(state.required.map((n) => n.midi)), [state.required])
  const fingers = useMemo(() => {
    const m = new Map<number, number>()
    for (const n of state.required) if (n.finger) m.set(n.midi, n.finger)
    return m
  }, [state.required])

  // At the reading levels the keys only light up once a wrong note is played,
  // so a hint is always something she asked for by getting it wrong.
  const showTargets = cfg.targets || (level === 4 && state.wrong.size > 0)

  useEffect(() => bankTime, [bankTime])

  // Keep the notes she has to play on screen when the keyboard is wider than
  // the window, without yanking the view around on every single note.
  useEffect(() => {
    const el = boardRef.current
    if (!el || state.required.length === 0) return
    const overflow = el.scrollWidth - el.clientWidth
    if (overflow <= 1) return
    const unit = el.scrollWidth / whites
    const centres = state.required.map((n) => (whiteOffset(low, n.midi) + 0.5) * unit)
    const want = (Math.min(...centres) + Math.max(...centres)) / 2 - el.clientWidth / 2
    const target = Math.max(0, Math.min(overflow, want))
    if (Math.abs(target - el.scrollLeft) > el.clientWidth * 0.25) {
      el.scrollTo({ left: target, behavior: 'smooth' })
    }
  }, [state.required, low, whites])

  // Two clean runs at a level is the signal to take a scaffold away.
  useEffect(() => {
    if (!state.finished || state.hits === 0) return
    const p = progressStore.song(song.id)
    const clean = state.accuracy >= 0.9
    const cleanRuns = clean ? p.cleanRuns + 1 : 0
    progressStore.updateSong(song.id, {
      playCount: p.playCount + 1,
      bestAccuracy: Math.max(p.bestAccuracy, state.accuracy),
      cleanRuns,
      completedAt: level === 5 && clean ? new Date().toISOString() : p.completedAt,
    })
    if (cleanRuns >= 2 && level < 5) setLevelUpOffer(true)
  }, [state.finished, state.accuracy, state.hits, song.id, level])

  const acceptLevelUp = () => {
    const next = Math.min(level + 1, 5) as ScaffoldLevel
    setLevel(next)
    progressStore.updateSong(song.id, { scaffold: next, cleanRuns: 0 })
    setLevelUpOffer(false)
    restart()
  }

  const meta = SCAFFOLD_LEVELS[level - 1]

  return (
    <div className="player">
      <header className="player-head">
        <button className="ghost" onClick={onExit} aria-label="Back to songs">←</button>
        <div className="titles">
          <h1>{song.title}</h1>
          <p>{song.composer} · {song.key.name} · {song.timeSig[0]}/{song.timeSig[1]}</p>
        </div>
        <div className="level-chip" title={meta.blurb}>
          <span className="level-num">{level}</span>
          <span className="level-name">{meta.name}</span>
        </div>
      </header>

      <p className="level-blurb">{meta.blurb}</p>

      <Staff
        notes={song.notes}
        keySig={song.key}
        timeSig={song.timeSig}
        beatRef={beatRef}
        dueBeat={state.dueBeat}
        pxPerBeat={pxPerBeat}
        sp={compact ? cfg.staffSize * 0.75 : cfg.staffSize}
        showLetters={cfg.staffLetters}
      />

      {/* Lane and keyboard share one scroller so a note always sits directly
          above the key it belongs to, even when the piece is wider than a phone. */}
      <div className="board" ref={boardRef}>
        <div className="board-inner" style={{ width: `max(100%, ${whites * MIN_KEY_PX}px)` }}>
          <div className="lane" style={{ opacity: cfg.fallingOpacity === 0 ? 0 : 1 }}>
            <FallingNotes
              notes={song.notes}
              beatRef={beatRef}
              low={low}
              high={high}
              beatsVisible={beatsVisible}
              opacity={cfg.fallingOpacity}
              dueBeat={state.dueBeat}
            />
          </div>
          <Keyboard
            low={low}
            high={high}
            keySig={song.key}
            held={held}
            targets={targets}
            wrong={state.wrong}
            fingers={cfg.fingers ? fingers : undefined}
            labels={cfg.labels}
            showTargets={showTargets}
          />
        </div>
      </div>

      <PieceProgress beatRef={beatRef} from={loop ? loop.start : songStart(song)}
        to={loop ? loop.end : songEnd(song)} />

      <div className="controls">
        <button className="primary" onClick={state.running ? pause : play}>
          {state.running ? 'Pause' : state.finished ? 'Play again' : 'Play'}
        </button>
        <button onClick={restart}>Restart</button>
        <button onClick={() => { setMode('listen'); void play() }} title="Hear the piece before you play it">
          Hear it
        </button>

        <div className="seg" role="group" aria-label="Practice mode">
          {(['wait', 'flow'] as const).map((m) => (
            <button key={m} className={mode === m ? 'on' : ''} onClick={() => setMode(m)}>
              {m === 'wait' ? 'Wait for me' : 'Keep time'}
            </button>
          ))}
        </div>

        <div className="seg" role="group" aria-label="Tempo">
          {[0.6, 0.8, 1].map((t) => (
            <button key={t} className={tempoScale === t ? 'on' : ''} onClick={() => setTempoScale(t)}>
              {Math.round(t * 100)}%
            </button>
          ))}
        </div>

        <div className="score">
          <strong>{Math.round(state.accuracy * 100)}%</strong>
          <span>{state.hits} right · {state.misses} wrong</span>
        </div>
      </div>

      <div className="sections">
        <span className="label">Loop:</span>
        <button className={loop === null ? 'on' : ''} onClick={() => setLoop(null)}>Whole piece</button>
        {song.sections.map((s) => (
          <button key={s.name} className={loop?.name === s.name ? 'on' : ''} onClick={() => setLoop(s)}>
            {s.name}
          </button>
        ))}
      </div>

      <div className="ladder">
        {SCAFFOLD_LEVELS.map((l) => (
          <button
            key={l.level}
            className={`rung ${l.level === level ? 'on' : ''} ${l.level < level ? 'done' : ''}`}
            onClick={() => {
              setLevel(l.level as ScaffoldLevel)
              progressStore.updateSong(song.id, { scaffold: l.level as ScaffoldLevel })
            }}
            title={l.blurb}
          >
            <span className="rung-num">{l.level}</span> {l.name}
          </button>
        ))}
      </div>

      {levelUpOffer && (
        <div className="offer" role="dialog" aria-label="Ready for less help">
          <h2>Two clean runs. Ready for less help?</h2>
          <p>{SCAFFOLD_LEVELS[Math.min(level, 4)].blurb}</p>
          <div className="offer-actions">
            <button className="primary" onClick={acceptLevelUp}>Take a scaffold away</button>
            <button onClick={() => setLevelUpOffer(false)}>Stay here a bit longer</button>
          </div>
        </div>
      )}
    </div>
  )
}

/** Phone-sized layouts get a smaller staff and a slower-scrolling one. */
function useCompact(): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia('(max-width: 620px)')
      mq.addEventListener('change', cb)
      return () => mq.removeEventListener('change', cb)
    },
    () => window.matchMedia('(max-width: 620px)').matches,
    () => false,
  )
}

/** Its own component so the playhead can animate without re-rendering the page. */
function PieceProgress({ beatRef, from, to }: { beatRef: React.MutableRefObject<number>; from: number; to: number }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let raf = 0
    const tick = () => {
      raf = requestAnimationFrame(tick)
      const f = Math.max(0, Math.min(1, (beatRef.current - from) / Math.max(to - from, 1)))
      if (ref.current) ref.current.style.transform = `scaleX(${f})`
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [beatRef, from, to])
  return (
    <div className="piece-progress"><div ref={ref} className="fill" /></div>
  )
}
