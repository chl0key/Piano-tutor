import { ARRANGEMENTS } from '../music/arrange'
import { SONGS } from '../songs'
import type { Song } from '../music/song'
import { hasMusic, type UserSong } from './library'
import { progressStore, type Progress, type SongStatus } from './progress'

/**
 * One shelf for everything: the taught pieces and the songs you brought
 * yourself, filed by where you are with them rather than where they came from.
 */
export interface BookEntry {
  id: string
  title: string
  artist: string
  origin: 'course' | 'yours'
  status: SongStatus
  /** True when the status was pinned by hand rather than worked out. */
  pinned: boolean
  hasMusic: boolean
  /** Furthest scaffold level reached, across every arrangement. */
  scaffold: number
  bestAccuracy: number
  playCount: number
  learnedAt?: string
  lastPlayedAt?: string
  addedAt?: string
  /** The taught piece, when this came from the course. */
  song?: Song
  /** Your own song, when it did not. */
  user?: UserSong
}

export const STATUS_LABELS: Record<SongStatus, string> = {
  want: 'Want to learn',
  learning: 'Learning',
  learned: 'Learned',
}

/** Progress ids belonging to a song: one per arrangement for your own songs. */
function progressIds(entry: { origin: 'course' | 'yours'; id: string }): string[] {
  return entry.origin === 'course' ? [entry.id] : ARRANGEMENTS.map((a) => `${entry.id}:${a.id}`)
}

function summarise(progress: Progress, ids: string[]) {
  let scaffold = 0
  let bestAccuracy = 0
  let playCount = 0
  let learnedAt: string | undefined
  let lastPlayedAt: string | undefined
  for (const id of ids) {
    const p = progress.songs[id]
    if (!p) continue
    scaffold = Math.max(scaffold, p.scaffold)
    bestAccuracy = Math.max(bestAccuracy, p.bestAccuracy)
    playCount += p.playCount
    if (p.completedAt && (!learnedAt || p.completedAt < learnedAt)) learnedAt = p.completedAt
    if (p.lastPlayedAt && (!lastPlayedAt || p.lastPlayedAt > lastPlayedAt)) lastPlayedAt = p.lastPlayedAt
  }
  return { scaffold, bestAccuracy, playCount, learnedAt, lastPlayedAt }
}

/**
 * Work out where a song sits. Finishing it at the reading level means learned;
 * having played it at all means learning; anything else is still a plan. A
 * status set by hand overrides all of that.
 */
function statusFor(
  id: string, progress: Progress, stats: { learnedAt?: string; playCount: number; lastPlayedAt?: string },
): { status: SongStatus; pinned: boolean } {
  const pinned = progress.statuses[id]
  if (pinned) return { status: pinned, pinned: true }
  if (stats.learnedAt) return { status: 'learned', pinned: false }
  // Having touched it at all counts. Sitting down with a song for ten minutes
  // and not reaching the end is still learning it, not planning to.
  if (stats.playCount > 0 || stats.lastPlayedAt) return { status: 'learning', pinned: false }
  return { status: 'want', pinned: false }
}

export function buildBook(progress: Progress, mine: UserSong[]): BookEntry[] {
  const entries: BookEntry[] = []

  for (const user of mine) {
    const ids = progressIds({ origin: 'yours', id: user.id })
    const stats = summarise(progress, ids)
    entries.push({
      id: user.id,
      title: user.title,
      artist: user.artist || 'Added by you',
      origin: 'yours',
      hasMusic: hasMusic(user),
      addedAt: user.addedAt,
      user,
      ...stats,
      ...statusFor(user.id, progress, stats),
    })
  }

  for (const song of SONGS) {
    const stats = summarise(progress, [song.id])
    entries.push({
      id: song.id,
      title: song.title,
      artist: song.composer,
      origin: 'course',
      hasMusic: true,
      song,
      ...stats,
      ...statusFor(song.id, progress, stats),
    })
  }

  return entries
}

/** Most recently touched first, so whatever you are working on stays on top. */
export function sortEntries(entries: BookEntry[]): BookEntry[] {
  return [...entries].sort((a, b) => {
    const played = (b.lastPlayedAt ?? '').localeCompare(a.lastPlayedAt ?? '')
    if (played !== 0) return played
    if (a.playCount !== b.playCount) return b.playCount - a.playCount
    return (b.addedAt ?? '').localeCompare(a.addedAt ?? '')
  })
}

export function countByStatus(entries: BookEntry[]): Record<SongStatus | 'all', number> {
  const counts = { all: entries.length, want: 0, learning: 0, learned: 0 }
  for (const e of entries) counts[e.status]++
  return counts
}

export function setStatus(id: string, status: SongStatus | null) {
  progressStore.setStatus(id, status)
}
