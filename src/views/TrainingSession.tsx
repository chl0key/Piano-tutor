import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MiniStaff } from '../components/MiniStaff'
import { RhythmDrill, type RhythmResult } from '../components/RhythmDrill'
import { Keyboard } from '../components/Keyboard'
import { rangeFor, whiteCount } from '../components/keyboardLayout'
import { input, useHeldNotes } from '../input/input'
import { synth } from '../audio/synth'
import { KEYS, noteName } from '../music/theory'
import { LETTER_KEYS, getSkill, type Question } from '../train/skills'
import { gradeFor, type Grade } from '../train/srs'
import { buildSession, levelProgress, training, useTraining, xpFor } from '../state/training'
import { progressStore } from '../state/progress'

const INTERVAL_LABELS: Record<number, string> = {
  2: '2nd', 3: '3rd', 4: '4th', 5: '5th', 6: '6th', 7: '7th', 8: 'Octave',
}
const VALUE_OPTIONS = [
  { dur: 4, label: '4' }, { dur: 3, label: '3' }, { dur: 2, label: '2' },
  { dur: 1.5, label: '1½' }, { dur: 1, label: '1' }, { dur: 0.5, label: '½' },
]

interface Answered {
  correct: boolean
  detail: string
}

export function TrainingSession({ onExit }: { onExit: () => void }) {
  const state = useTraining()
  const [questions, setQuestions] = useState<Question[]>(() => buildSession(state))
  const [index, setIndex] = useState(0)
  const [answered, setAnswered] = useState<Answered | null>(null)
  const [combo, setCombo] = useState(0)
  const [bestCombo, setBestCombo] = useState(0)
  const [correctCount, setCorrectCount] = useState(0)
  const [earned, setEarned] = useState(0)
  const askedAt = useRef(performance.now())
  const startedAt = useRef(Date.now())

  const question = questions[index]
  const done = index >= questions.length

  useEffect(() => {
    askedAt.current = performance.now()
  }, [index])

  const submit = useCallback(
    (correct: boolean, detail: string, gradeOverride?: Grade) => {
      if (answered || !question) return
      const skill = getSkill(question.skill)
      const ms = performance.now() - askedAt.current
      const grade = gradeOverride ?? gradeFor(correct, ms, skill.fastMs, skill.slowMs)
      const nextCombo = correct ? combo + 1 : 0
      const xp = xpFor(correct, grade, combo)

      training.answer(question.itemId, grade, xp)
      setAnswered({ correct, detail })
      setCombo(nextCombo)
      setBestCombo((b) => Math.max(b, nextCombo))
      setEarned((e) => e + xp)
      if (correct) setCorrectCount((c) => c + 1)
      void synth.resume().then(() => synth.blip(correct ? 990 : 190, 0.05, correct ? 0.09 : 0.06))

      // A missed item comes back before the round is over — one more retrieval
      // while it is still fresh is worth more than reading the answer twice.
      if (!correct) {
        setQuestions((qs) =>
          qs.filter((q) => q.itemId === question.itemId).length < 3 ? [...qs, question] : qs,
        )
      }

      // Longer on a miss: the right answer needs a moment to be seen.
      window.setTimeout(() => {
        setAnswered(null)
        setIndex((i) => i + 1)
      }, correct ? 620 : 1500)
    },
    [answered, question, combo],
  )

  useEffect(() => {
    if (!done) return
    training.finishSession(bestCombo)
    const minutes = (Date.now() - startedAt.current) / 60000
    if (minutes >= 0.5) progressStore.logPractice(minutes)
  }, [done, bestCombo])

  if (done) {
    return (
      <SessionSummary
        total={questions.length}
        correct={correctCount}
        earned={earned}
        bestCombo={bestCombo}
        onAgain={() => {
          setQuestions(buildSession(training.get()))
          setIndex(0)
          setCorrectCount(0)
          setEarned(0)
          setCombo(0)
          setBestCombo(0)
          startedAt.current = Date.now()
        }}
        onExit={onExit}
      />
    )
  }

  if (!question) {
    return (
      <div className="session empty">
        <p>Nothing is due yet. Come back later, or unlock another skill by practising.</p>
        <button className="primary" onClick={onExit}>Back</button>
      </div>
    )
  }

  return (
    <div className="session">
      <header className="session-head">
        <button className="ghost" onClick={onExit} aria-label="Leave session">✕</button>
        <div className="session-bar" aria-label={`Question ${index + 1} of ${questions.length}`}>
          <div className="fill" style={{ transform: `scaleX(${index / questions.length})` }} />
        </div>
        <div className={`combo ${combo >= 3 ? 'hot' : ''}`}>
          {combo >= 3 ? `${combo} in a row` : `+${earned}`}
        </div>
      </header>

      <p className="session-prompt">{question.prompt}</p>

      <div className={`question ${answered ? (answered.correct ? 'right' : 'wrong') : ''}`}>
        <QuestionBody question={question} answered={answered} onAnswer={submit} />
      </div>

      {answered && (
        <p className={`verdict ${answered.correct ? 'right' : 'wrong'}`} role="status">
          {answered.correct ? 'Yes' : answered.detail}
        </p>
      )}
    </div>
  )
}

function QuestionBody({
  question, answered, onAnswer,
}: {
  question: Question
  answered: Answered | null
  onAnswer: (correct: boolean, detail: string, grade?: Grade) => void
}) {
  switch (question.kind) {
    case 'name-note':
      return (
        <>
          <MiniStaff notes={[{ midi: question.midi, state: 'ask' }]} clef={question.clef} />
          <div className="keypad letters">
            {LETTER_KEYS.map((letter) => (
              <button key={letter} disabled={!!answered}
                onClick={() => onAnswer(letter === question.answer, `It was ${question.answer}`)}>
                {letter}
              </button>
            ))}
          </div>
        </>
      )

    case 'interval':
      return (
        <>
          <MiniStaff notes={[{ midi: question.low }, { midi: question.high }]} clef={question.clef} />
          <div className="keypad">
            {[2, 3, 4, 5, 6, 7, 8].map((size) => (
              <button key={size} disabled={!!answered}
                onClick={() => onAnswer(size === question.answer, `It was a ${INTERVAL_LABELS[question.answer]}`)}>
                {INTERVAL_LABELS[size]}
              </button>
            ))}
          </div>
        </>
      )

    case 'key-signature':
      return (
        <>
          <MiniStaff notes={[]} clef="grand" keySig={question.keySig} signatureOnly />
          <div className="keypad wide">
            {question.options.map((name) => (
              <button key={name} disabled={!!answered}
                onClick={() => onAnswer(name === question.answer, `It was ${question.answer}`)}>
                {name}
              </button>
            ))}
          </div>
        </>
      )

    case 'note-value':
      return (
        <>
          <MiniStaff notes={[{ midi: 71, dur: question.dur, rest: question.rest, state: 'ask' }]} />
          <div className="keypad">
            {VALUE_OPTIONS.map((option) => (
              <button key={option.label} disabled={!!answered}
                onClick={() => onAnswer(option.dur === question.answer,
                  `It was ${VALUE_OPTIONS.find((v) => v.dur === question.answer)?.label} beat(s)`)}>
                {option.label}
              </button>
            ))}
          </div>
        </>
      )

    case 'find-key':
      return <FindKey question={question} answered={answered} onAnswer={onAnswer} />

    case 'rhythm':
      return (
        <RhythmDrill
          key={question.itemId}
          pattern={question.pattern}
          bpm={question.bpm}
          onDone={(result: RhythmResult) => {
            // Landing most of the notes is a pass; how tight decides how well.
            const grade: Grade =
              result.accuracy >= 0.85 && result.meanError < 0.12 ? 'easy'
                : result.accuracy >= 0.7 ? 'good'
                  : result.accuracy >= 0.5 ? 'hard'
                    : 'again'
            onAnswer(
              grade !== 'again',
              `${result.hits} of ${result.total} notes landed`,
              grade,
            )
          }}
        />
      )
  }
}

function FindKey({
  question, answered, onAnswer,
}: {
  question: Extract<Question, { kind: 'find-key' }>
  answered: Answered | null
  onAnswer: (correct: boolean, detail: string) => void
}) {
  const held = useHeldNotes()
  const [low, high] = useMemo(() => rangeFor([question.low, question.high], 0), [question])
  const whites = useMemo(() => whiteCount(low, high), [low, high])

  useEffect(() => {
    if (answered) return
    return input.onNoteOn((midi) => {
      onAnswer(midi === question.midi, `It was ${noteName(question.midi)}`)
    })
  }, [question, answered, onAnswer])

  return (
    <>
      <MiniStaff notes={[{ midi: question.midi, state: 'ask' }]} clef={question.clef} />
      <div className="board">
        <div className="board-inner" style={{ width: `max(100%, ${whites * 30}px)` }}>
          <Keyboard
            low={low}
            high={high}
            keySig={KEYS.C}
            held={held}
            targets={answered && !answered.correct ? new Set([question.midi]) : undefined}
            labels="c-only"
            showTargets={!!answered && !answered.correct}
          />
        </div>
      </div>
    </>
  )
}

function SessionSummary({
  total, correct, earned, bestCombo, onAgain, onExit,
}: {
  total: number; correct: number; earned: number; bestCombo: number
  onAgain: () => void; onExit: () => void
}) {
  const state = useTraining()
  const { level, into, needed } = levelProgress(state.xp)
  const pct = Math.round((correct / Math.max(total, 1)) * 100)

  return (
    <div className="summary">
      <h1>+{earned} XP</h1>
      <p className="sub">{correct} of {total} right · best run {bestCombo}</p>

      <div className="level-bar">
        <div className="level-bar-track">
          <div className="fill" style={{ width: `${(into / needed) * 100}%` }} />
        </div>
        <span>Level {level} · {into}/{needed} to level {level + 1}</span>
      </div>

      <p className="closing">
        {pct >= 90
          ? 'Those are answers, not calculations. That is what reading feels like.'
          : pct >= 60
            ? 'The ones you missed are already scheduled to come back sooner.'
            : 'Missing things is the point — every miss moves that item to the front of the queue.'}
      </p>

      <div className="summary-actions">
        <button className="primary" onClick={onAgain}>Another round</button>
        <button onClick={onExit}>Done for now</button>
      </div>
    </div>
  )
}
