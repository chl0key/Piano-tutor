import { useEffect, useState } from 'react'
import { mastery, newMemory, review, urgency, type Grade, type Memory } from '../train/srs'
import { SKILLS, buildQuestion, getSkill, type Question, type Skill, type SkillId } from '../train/skills'

const STORAGE_KEY = 'piano-tutor.training.v1'

export interface TrainingState {
  memories: Record<string, Memory>
  xp: number
  sessions: number
  /** Best run of consecutive correct answers, across all time. */
  bestStreak: number
  /** XP earned today, for the daily goal ring. */
  todayXp: number
  todayDate: string
}

export const DAILY_GOAL = 100
export const SESSION_LENGTH = 12
/** New items introduced per session — enough to progress, few enough to stick. */
const NEW_PER_SESSION = 3

const EMPTY: TrainingState = {
  memories: {}, xp: 0, sessions: 0, bestStreak: 0, todayXp: 0, todayDate: '',
}

function today(): string {
  const d = new Date()
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

function load(): TrainingState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? { ...EMPTY, ...(JSON.parse(raw) as TrainingState) } : EMPTY
    // A new day resets the goal ring but nothing else.
    return parsed.todayDate === today() ? parsed : { ...parsed, todayXp: 0, todayDate: today() }
  } catch {
    return EMPTY
  }
}

let current = load()
const listeners = new Set<(s: TrainingState) => void>()

function commit(next: TrainingState) {
  current = next
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch { /* storage unavailable — the session still works in memory */ }
  for (const fn of listeners) fn(next)
}

export const training = {
  get: () => current,

  subscribe(fn: (s: TrainingState) => void): () => void {
    listeners.add(fn)
    return () => {
      listeners.delete(fn)
    }
  },

  /** Record one answer: update the item's schedule and bank the points. */
  answer(itemId: string, grade: Grade, xp: number) {
    const existing = current.memories[itemId]
    const memory = existing ? review(existing, grade) : newMemory(grade)
    const day = today()
    const sameDay = current.todayDate === day
    commit({
      ...current,
      memories: { ...current.memories, [itemId]: memory },
      xp: current.xp + xp,
      todayXp: (sameDay ? current.todayXp : 0) + xp,
      todayDate: day,
    })
  },

  finishSession(bestStreakThisSession: number) {
    commit({
      ...current,
      sessions: current.sessions + 1,
      bestStreak: Math.max(current.bestStreak, bestStreakThisSession),
    })
  },

  reset() {
    commit({ ...EMPTY, todayDate: today() })
  },
}

export function useTraining(): TrainingState {
  const [s, setS] = useState(current)
  useEffect(() => training.subscribe(setS), [])
  return s
}

/* ----------------------------------------------------------- progress */

export function levelFor(xp: number): number {
  return Math.floor(Math.sqrt(xp / 40)) + 1
}

export function xpForLevel(level: number): number {
  return 40 * (level - 1) ** 2
}

export function levelProgress(xp: number): { level: number; into: number; needed: number } {
  const level = levelFor(xp)
  const base = xpForLevel(level)
  const next = xpForLevel(level + 1)
  return { level, into: xp - base, needed: next - base }
}

/** Mean mastery across a skill's items — unseen items count as zero. */
export function skillMastery(state: TrainingState, skill: Skill): number {
  const total = skill.items.reduce((sum, id) => sum + mastery(state.memories[id]), 0)
  return total / skill.items.length
}

export function isUnlocked(state: TrainingState, skill: Skill): boolean {
  return skill.requires.every((r) => skillMastery(state, getSkill(r.skill)) >= r.mastery)
}

export function unlockedSkills(state: TrainingState): Skill[] {
  return SKILLS.filter((s) => isUnlocked(state, s))
}

/** What is holding a locked skill back, phrased for a person. */
export function lockReason(state: TrainingState, skill: Skill): string | null {
  const blocking = skill.requires.find((r) => skillMastery(state, getSkill(r.skill)) < r.mastery)
  if (!blocking) return null
  const need = getSkill(blocking.skill)
  const have = Math.round(skillMastery(state, need) * 100)
  return `Unlocks at ${Math.round(blocking.mastery * 100)}% on ${need.name} — you are at ${have}%`
}

export function dueCount(state: TrainingState, now = Date.now()): number {
  let n = 0
  for (const skill of unlockedSkills(state)) {
    for (const id of skill.items) {
      const memory = state.memories[id]
      if (memory && memory.due <= now) n++
    }
  }
  return n
}

/* ------------------------------------------------------------ session */

/**
 * Choose what to ask. Anything overdue comes first, a few new items are
 * introduced, and the result is shuffled so consecutive questions come from
 * different skills — interleaving beats drilling one skill in a block, because
 * having to work out *which* kind of question this is is part of the skill.
 */
export function buildSession(state: TrainingState, length = SESSION_LENGTH, now = Date.now()): Question[] {
  const available = unlockedSkills(state)
  const seen: { id: string; urgency: number }[] = []
  const unseenBySkill = new Map<SkillId, string[]>()

  for (const skill of available) {
    const unseen: string[] = []
    for (const id of skill.items) {
      const memory = state.memories[id]
      if (memory) seen.push({ id, urgency: urgency(memory, now) })
      else unseen.push(id)
    }
    if (unseen.length > 0) unseenBySkill.set(skill.id, shuffleInPlace(unseen))
  }

  seen.sort((a, b) => b.urgency - a.urgency)
  const due = seen.filter((s) => s.urgency >= 0).map((s) => s.id)
  const notYetDue = seen.filter((s) => s.urgency < 0).map((s) => s.id)

  // With a review backlog, introduce sparingly. With nothing due — a first
  // session, or everything already learned — introduce more, because repeating
  // three items twelve times teaches far less than meeting six.
  const newBudget = due.length === 0 ? NEW_PER_SESSION * 2 : NEW_PER_SESSION
  const newItems = takeRoundRobin(unseenBySkill, newBudget)

  const chosen: string[] = []
  for (const id of due) {
    if (chosen.length >= length - newItems.length) break
    chosen.push(id)
  }
  chosen.push(...newItems)
  for (const id of notYetDue) {
    if (chosen.length >= length) break
    chosen.push(id)
  }

  // A first session would otherwise be a handful of questions. New items are
  // repeated to fill the round, which is also how they are learned: seen
  // several times close together, then handed to the schedule to space out.
  const ordered = padToLength(interleave(chosen), [...newItems, ...due], length)
  return ordered
    .map((id) => buildQuestion(id))
    .filter((q): q is Question => q !== null)
}

/** One item from each skill in turn, so a new round is never all one drill. */
function takeRoundRobin(bySkill: Map<SkillId, string[]>, budget: number): string[] {
  const out: string[] = []
  const groups = [...bySkill.values()]
  let round = 0
  while (out.length < budget && groups.some((g) => g.length > round)) {
    for (const group of groups) {
      if (out.length >= budget) break
      if (group.length > round) out.push(group[round])
    }
    round++
  }
  return out
}

/**
 * Top up a short round by repeating items. The gap has to be smaller than the
 * pool or nothing is ever eligible and the round stays short.
 */
function padToLength(ordered: string[], pool: string[], length: number): string[] {
  if (pool.length === 0) return ordered
  const gap = Math.max(1, Math.min(3, pool.length - 1))
  const out = [...ordered]
  let cursor = 0
  let attempts = 0
  while (out.length < length && attempts < length * 8) {
    attempts++
    const candidate = pool[cursor % pool.length]
    cursor++
    if (out.slice(-gap).includes(candidate)) continue
    out.push(candidate)
  }
  return out
}

/** Reorder so the same skill rarely appears twice running. */
function interleave(itemIds: string[]): string[] {
  const bySkill = new Map<SkillId, string[]>()
  for (const id of shuffleInPlace([...itemIds])) {
    const skill = SKILLS.find((s) => s.items.includes(id))
    if (!skill) continue
    const list = bySkill.get(skill.id) ?? []
    list.push(id)
    bySkill.set(skill.id, list)
  }

  const out: string[] = []
  let lastSkill: SkillId | null = null
  while (out.length < itemIds.length) {
    // Take from the fullest group that is not the one just used.
    const groups = [...bySkill.entries()].filter(([, list]) => list.length > 0)
    if (groups.length === 0) break
    groups.sort((a, b) => b[1].length - a[1].length)
    const next = groups.find(([id]) => id !== lastSkill) ?? groups[0]
    out.push(next[1].shift()!)
    lastSkill = next[0]
  }
  return out
}

function shuffleInPlace<T>(list: T[]): T[] {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[list[i], list[j]] = [list[j], list[i]]
  }
  return list
}

/** Points for one answer: correctness first, then speed, then the run. */
export function xpFor(correct: boolean, grade: Grade, combo: number): number {
  if (!correct) return 0
  const base = 10
  const speed = grade === 'easy' ? 5 : grade === 'good' ? 2 : 0
  const run = Math.min(5, Math.floor(combo / 3))
  return base + speed + run
}
