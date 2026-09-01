import { Setup } from '../components/Setup'
import { library, useLibrary } from '../state/library'
import { SONGS } from '../songs'
import { EXERCISES } from '../music/exercises'
import { SCAFFOLD_LEVELS, progressStore, streakOf, useProgress } from '../state/progress'
import type { Song } from '../music/song'

interface Props {
  onOpenSong: (song: Song) => void
  onOpenUserSong: (id: string) => void
  onOpenDrill: () => void
  onAddSong: () => void
}

export function Home({ onOpenSong, onOpenUserSong, onOpenDrill, onAddSong }: Props) {
  const progress = useProgress()
  const streak = streakOf(progress.practiceDays)
  const mine = useLibrary()

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
            <h2>Your songs</h2>
            <p className="sub">
              Any song you like, in three levels: all the chords in order, then a bit more, then the
              whole thing.
            </p>
          </div>
          <button className="primary" onClick={onAddSong}>Add a song</button>
        </div>
        {mine.length === 0 ? (
          <button className="wide-card dashed" onClick={onAddSong}>
            <strong>Add your first song</strong>
            <span>
              Find it on Spotify, then paste its chords or drop in a MIDI file. You get sheet music
              at three levels of difficulty.
            </span>
          </button>
        ) : (
          <ul className="song-list">
            {mine.map((s) => (
              <li key={s.id}>
                <button onClick={() => onOpenUserSong(s.id)}>
                  <div className="song-main">
                    <strong>{s.title}</strong>
                    <span className="composer">{s.artist || 'Added by you'}</span>
                    <span className="teaches">
                      {s.key.name} · {s.bpm} bpm · {s.origin === 'midi' ? 'from MIDI' : 'from chords'}
                    </span>
                  </div>
                  <div className="song-side">
                    <span className="level-word">Basic · Int · Adv</span>
                  </div>
                </button>
                <button
                  className="ghost small remove"
                  aria-label={`Remove ${s.title}`}
                  onClick={() => {
                    if (confirm(`Remove "${s.title}" from your songs?`)) library.remove(s.id)
                  }}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="block">
        <h2>Pieces</h2>
        <p className="sub">Each one is played five times over, with a little less help each time.</p>
        <ul className="song-list">
          {SONGS.map((song) => {
            const p = progressStore.song(song.id)
            return (
              <li key={song.id}>
                <button onClick={() => onOpenSong(song)}>
                  <div className="song-main">
                    <strong>{song.title}</strong>
                    <span className="composer">{song.composer}</span>
                    <span className="teaches">{song.teaches.join(' · ')}</span>
                  </div>
                  <div className="song-side">
                    <div className="ladder-mini">
                      {SCAFFOLD_LEVELS.map((l) => (
                        <span key={l.level} className={l.level <= p.scaffold ? 'on' : ''} />
                      ))}
                    </div>
                    <span className="level-word">
                      {p.completedAt ? 'Read it ✓' : SCAFFOLD_LEVELS[p.scaffold - 1].name}
                    </span>
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      </section>

      <section className="block">
        <h2>Reading drills</h2>
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
