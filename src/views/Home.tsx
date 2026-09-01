import { useMemo } from 'react'
import { Setup } from '../components/Setup'
import { InstallPrompt } from '../components/InstallPrompt'
import { useLibrary } from '../state/library'
import { DAILY_GOAL, dueCount, levelProgress, useTraining } from '../state/training'
import { buildBook, countByStatus, sortEntries } from '../state/songbook'
import { SONGS } from '../songs'
import { EXERCISES } from '../music/exercises'
import { SCAFFOLD_LEVELS, progressStore, streakOf, useProgress } from '../state/progress'
import type { Song } from '../music/song'

interface Props {
  onOpenSong: (song: Song) => void
  onOpenUserSong: (id: string) => void
  onOpenDrill: () => void
  onAddSong: () => void
  onOpenTraining: () => void
  onOpenSongbook: () => void
}

export function Home({
  onOpenSong, onOpenUserSong, onOpenDrill, onAddSong, onOpenTraining, onOpenSongbook,
}: Props) {
  const progress = useProgress()
  const trainingState = useTraining()
  const streak = streakOf(progress.practiceDays)
  const mine = useLibrary()
  const book = useMemo(() => sortEntries(buildBook(progress, mine)), [progress, mine])
  const counts = useMemo(() => countByStatus(book), [book])
  // Whatever is furthest along and unfinished is almost always what you want next.
  const inProgress = book.filter((e) => e.status === 'learning' && e.hasMusic).slice(0, 3)

  // Next up: the first piece not yet finished at the reading level.
  const nextSong =
    SONGS.find((s) => {
      const p = progress.songs[s.id]
      return !p || !p.completedAt
    }) ?? SONGS[SONGS.length - 1]

  const nextProgress = progressStore.song(nextSong.id)

  return (
    <div className="home">
      <header className="home-head">
        <div>
          <h1>Piano tutor</h1>
          <p className="tagline">Falling notes in, sheet music out.</p>
        </div>
        <div className="streak" title={`${progress.practiceDays.length} days practised in total`}>
          <strong>{streak}</strong>
          <span>day{streak === 1 ? '' : 's'} in a row</span>
        </div>
      </header>

      <InstallPrompt />

      <Setup />

      <section className="next-up" onClick={() => onOpenSong(nextSong)} role="button" tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && onOpenSong(nextSong)}>
        <p className="eyebrow">Next up</p>
        <h2>{nextSong.title}</h2>
        <p className="why">{nextSong.why}</p>
        <div className="ladder-mini" aria-label={`Currently at level ${nextProgress.scaffold}`}>
          {SCAFFOLD_LEVELS.map((l) => (
            <span key={l.level} className={l.level <= nextProgress.scaffold ? 'on' : ''} title={l.name} />
          ))}
          <em>{SCAFFOLD_LEVELS[nextProgress.scaffold - 1].name}</em>
        </div>
      </section>

      <section className="block">
        <div className="block-head">
          <div>
            <h2>Songbook</h2>
            <p className="sub">
              Everything you are learning, have learned, or mean to get to — the taught pieces and
              your own songs on the same shelf.
            </p>
          </div>
          <button className="primary" onClick={onAddSong}>Add</button>
        </div>

        <button className="wide-card songbook-card" onClick={onOpenSongbook}>
          <div className="shelf-counts">
            <span><b>{counts.learned}</b> learned</span>
            <span><b>{counts.learning}</b> learning</span>
            <span><b>{counts.want}</b> to come</span>
          </div>
          <span className="open-book">Open songbook →</span>
        </button>

        {inProgress.length > 0 && (
          <>
            <p className="sub continue-label">Pick up where you left off</p>
            <ul className="song-list">
              {inProgress.map((entry) => (
                <li key={entry.id}>
                  <button onClick={() => {
                    if (entry.origin === 'course' && entry.song) onOpenSong(entry.song)
                    else onOpenUserSong(entry.id)
                  }}>
                    <div className="song-main">
                      <strong>{entry.title}</strong>
                      <span className="composer">{entry.artist}</span>
                    </div>
                    <div className="song-side">
                      <div className="ladder-mini">
                        {SCAFFOLD_LEVELS.map((l) => (
                          <span key={l.level} className={l.level <= entry.scaffold ? 'on' : ''} />
                        ))}
                      </div>
                      <span className="level-word">
                        {SCAFFOLD_LEVELS[Math.max(0, entry.scaffold - 1)].name}
                      </span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className="block">
        <h2>Away from the piano</h2>
        <p className="sub">
          Reading is mostly decoding, and decoding trains anywhere — on a train, in a queue, three
          minutes at a time.
        </p>
        <button className="wide-card training-card" onClick={onOpenTraining}>
          <div>
            <strong>Training</strong>
            <span>
              Landmarks, intervals, key signatures and rhythm, mixed together and spaced so each one
              comes back just before you would forget it.
            </span>
          </div>
          <div className="training-side">
            <em>Level {levelProgress(trainingState.xp).level}</em>
            <span>
              {dueCount(trainingState) > 0
                ? `${dueCount(trainingState)} due`
                : `${trainingState.todayXp}/${DAILY_GOAL} today`}
            </span>
          </div>
        </button>
      </section>

      <section className="block">
        <h2>At the piano</h2>
        <p className="sub">Five minutes of this does more for reading than an hour of anything else.</p>
        <button className="wide-card" onClick={onOpenDrill}>
          <strong>Name that note</strong>
          <span>One note at a time, timed. The app keeps feeding you the ones you are slowest on.</span>
        </button>
      </section>

      <section className="block">
        <h2>Technique</h2>
        <p className="sub">Scales look like nothing on the page until you can read them — then everything else gets easier.</p>
        <ul className="song-list compact">
          {EXERCISES.map((ex) => (
            <li key={ex.id}>
              <button onClick={() => onOpenSong(ex)}>
                <div className="song-main">
                  <strong>{ex.title}</strong>
                  <span className="teaches">{ex.why}</span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <footer className="home-foot">
        <p>
          {Math.round(progress.totalMinutes)} minutes practised · {progress.practiceDays.length} days
        </p>
        <button className="ghost small" onClick={() => {
          if (confirm('Clear all progress, levels and reading stats? This cannot be undone.')) {
            progressStore.reset()
          }
        }}>Reset progress</button>
      </footer>
    </div>
  )
}
