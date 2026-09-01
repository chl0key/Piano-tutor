import { songEnd, songStart, type Song } from './song'

const WRITABLE_DURATIONS = [4, 3, 2, 1.5, 1, 0.75, 0.5, 0.25]
const LOWEST_KEY = 21
const HIGHEST_KEY = 108

/**
 * Checks that a hand-written song is playable and engravable. Every one of
 * these has a specific failure mode: overlapping notes in one hand mean a
 * mistyped duration somewhere upstream, and the lesson will then wait forever
 * for a note the learner has already played.
 */
export function songProblems(song: Song): string[] {
  const out: string[] = []

  for (const hand of ['L', 'R'] as const) {
    const notes = song.notes.filter((n) => n.hand === hand).sort((a, b) => a.start - b.start)
    for (let i = 1; i < notes.length; i++) {
      const prev = notes[i - 1]
      const cur = notes[i]
      if (cur.start < prev.start + prev.dur - 1e-6 && cur.start > prev.start + 1e-6) {
        out.push(
          `${hand} hand: ${prev.midi} at beat ${prev.start} (${prev.dur} beats) runs past ` +
            `${cur.midi} at beat ${cur.start} — a duration is probably wrong`,
        )
      }
    }
  }

  for (const n of song.notes) {
    if (n.midi < LOWEST_KEY || n.midi > HIGHEST_KEY) {
      out.push(`note ${n.midi} at beat ${n.start} is off the end of an 88-key piano`)
    }
    if (!WRITABLE_DURATIONS.some((d) => Math.abs(d - n.dur) < 1e-6)) {
      out.push(`duration ${n.dur} at beat ${n.start} has no standard notehead`)
    }
    if (n.finger !== undefined && (n.finger < 1 || n.finger > 5)) {
      out.push(`finger ${n.finger} at beat ${n.start} is not a finger`)
    }
  }

  const start = songStart(song)
  const end = songEnd(song)
  for (const s of song.sections) {
    if (s.start < start - 1e-6 || s.end > end + 1e-6) {
      out.push(`section "${s.name}" (${s.start}–${s.end}) falls outside the piece (${start}–${end})`)
    }
    if (s.end <= s.start) out.push(`section "${s.name}" ends before it starts`)
  }

  return out
}

export function reportSongProblems(songs: Song[]): void {
  for (const song of songs) {
    const problems = songProblems(song)
    if (problems.length > 0) {
      console.warn(`[piano-tutor] "${song.title}" has ${problems.length} problem(s):`)
      for (const p of problems) console.warn(`  · ${p}`)
    }
  }
}
