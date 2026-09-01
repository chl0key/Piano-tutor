/**
 * Spaced repetition for the away-from-the-piano drills.
 *
 * Modelled on FSRS rather than the older SM-2: each item carries a difficulty
 * and a stability instead of one "ease" number, and reviews are scheduled for
 * the moment recall is predicted to fall to a target. The published FSRS has
 * twenty-one parameters fitted to hundreds of millions of reviews; this is the
 * same three-component shape with hand-set constants, which is the honest thing
 * to do without that data behind it.
 *
 * The property worth keeping is the one that makes spacing work: an item
 * recalled when it had nearly been forgotten gains far more stability than one
 * drilled while still fresh. Answering the same note ten times in a row teaches
 * almost nothing, and this maths says so.
 */

export type Grade = 'again' | 'hard' | 'good' | 'easy'

export interface Memory {
  /** 1 = trivial, 10 = this one keeps catching you out. */
  difficulty: number
  /** Days until recall is predicted to drop to 90%. */
  stability: number
  /** Epoch ms of the last review. */
  last: number
  /** Epoch ms this becomes due. */
  due: number
  reps: number
  lapses: number
}

const DAY = 86_400_000
/** Reviews are scheduled for the point recall is predicted to reach this. */
const TARGET_RETENTION = 0.9
const DECAY = Math.log(TARGET_RETENTION)

const GRADE_INDEX: Record<Grade, number> = { again: 1, hard: 2, good: 3, easy: 4 }
/** Starting stability in days, by first grade. */
const INITIAL_STABILITY: Record<Grade, number> = { again: 0.3, hard: 1.0, good: 2.5, easy: 6.0 }
/**
 * Starting difficulty. An item missed on sight starts well above the middle and
 * an item answered instantly starts below it, so the first encounter says
 * something rather than filing everything near the baseline.
 */
const INITIAL_DIFFICULTY: Record<Grade, number> = { again: 7.5, hard: 6, good: 5, easy: 3.5 }
const GRADE_FACTOR: Record<Grade, number> = { again: 0, hard: 0.6, good: 1, easy: 1.45 }

export function newMemory(grade: Grade, now = Date.now()): Memory {
  const stability = INITIAL_STABILITY[grade]
  return {
    difficulty: clampDifficulty(INITIAL_DIFFICULTY[grade]),
    stability,
    last: now,
    due: now + stability * DAY,
    reps: 1,
    lapses: grade === 'again' ? 1 : 0,
  }
}

/** Predicted chance of getting this right now: 1 immediately after a review, decaying with time. */
export function retrievability(memory: Memory, now = Date.now()): number {
  const elapsedDays = Math.max(0, (now - memory.last) / DAY)
  return Math.exp((DECAY * elapsedDays) / Math.max(memory.stability, 0.01))
}

export function review(memory: Memory, grade: Grade, now = Date.now()): Memory {
  const r = retrievability(memory, now)
  const difficulty = nextDifficulty(memory.difficulty, grade)
  const stability =
    grade === 'again'
      ? lapseStability(memory.stability, difficulty)
      : gainStability(memory.stability, difficulty, r, grade)

  return {
    difficulty,
    stability,
    last: now,
    due: now + intervalDays(stability) * DAY,
    reps: memory.reps + 1,
    lapses: memory.lapses + (grade === 'again' ? 1 : 0),
  }
}

/**
 * Difficulty drifts back towards the middle after good answers rather than
 * staying permanently marked by one bad day.
 */
function nextDifficulty(difficulty: number, grade: Grade): number {
  const moved = difficulty - 1.0 * (GRADE_INDEX[grade] - 3)
  return clampDifficulty(0.9 * moved + 0.1 * 5)
}

function gainStability(stability: number, difficulty: number, r: number, grade: Grade): number {
  // Three multipliers: easy items gain more, already-stable items gain
  // proportionally less, and — the important one — an item recalled when its
  // retrievability had fallen gains far more than one reviewed while fresh.
  const byDifficulty = (11 - difficulty) / 9
  const damping = Math.pow(Math.max(stability, 0.1), -0.25)
  const spacingBonus = Math.exp(1.7 * (1 - r)) - 1
  const grown = stability * (1 + byDifficulty * damping * spacingBonus * GRADE_FACTOR[grade] * 3)
  return Math.min(365 * 5, Math.max(stability * 1.05, grown))
}

function lapseStability(stability: number, difficulty: number): number {
  // Forgetting costs most of the progress but never all of it.
  return Math.max(0.2, stability * 0.35 * ((11 - difficulty) / 10))
}

function clampDifficulty(d: number): number {
  return Math.min(10, Math.max(1, d))
}

/** Days until retrievability is predicted to reach the target. */
export function intervalDays(stability: number): number {
  return Math.max(0.02, stability)
}

/**
 * Turn a drill answer into a grade. Correctness decides pass or fail; how long
 * it took decides how well, because reading fluently means recognising a note
 * rather than working it out.
 */
export function gradeFor(correct: boolean, ms: number, fastMs: number, slowMs: number): Grade {
  if (!correct) return 'again'
  if (ms <= fastMs) return 'easy'
  if (ms >= slowMs) return 'hard'
  return 'good'
}

/**
 * How firmly an item is known, 0 to 1. Three weeks of predicted retention counts
 * as learned — long enough to have survived real forgetting.
 */
export function mastery(memory: Memory | undefined): number {
  if (!memory) return 0
  return Math.min(1, memory.stability / 21)
}

/** Overdue items first, then the closest to due. Ties broken by difficulty. */
export function urgency(memory: Memory, now = Date.now()): number {
  return (now - memory.due) / DAY + memory.difficulty / 100
}
