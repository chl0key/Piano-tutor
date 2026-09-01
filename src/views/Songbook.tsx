import { useMemo, useState } from 'react'
import { SCAFFOLD_LEVELS, useProgress, type SongStatus } from '../state/progress'
import { library, useLibrary } from '../state/library'
import { buildBook, countByStatus, setStatus, sortEntries, STATUS_LABELS, type BookEntry } from '../state/songbook'
import type { Song } from '../music/song'

type Shelf = SongStatus | 'all'

const SHELVES: { id: Shelf; label: string; empty: string }[] = [
  { id: 'all', label: 'Everything', empty: 'Nothing here yet.' },
  { id: 'want', label: 'Want to learn', empty: 'Nothing on the list. Add a song — you can save it with just a name and find the chords later.' },
  { id: 'learning', label: 'Learning', empty: 'Nothing on the go. Open something from the list and play a few bars.' },
  { id: 'learned', label: 'Learned', empty: 'Nothing finished yet. A song lands here once you play it through at the reading level.' },
]

interface Props {
  onOpenSong: (song: Song) => void
  onOpenUserSong: (id: string) => void
  onEditSong: (id: string) => void
  onAddSong: () => void
  onExit: () => void
}

export function Songbook({ onOpenSong, onOpenUserSong, onEditSong, onAddSong, onExit }: Props) {
  const progress = useProgress()
  const mine = useLibrary()
  const [shelf, setShelf] = useState<Shelf>('all')

  const entries = useMemo(() => sortEntries(buildBook(progress, mine)), [progress, mine])
  const counts = useMemo(() => countByStatus(entries), [entries])
  const shown = shelf === 'all' ? entries : entries.filter((e) => e.status === shelf)
  const current = SHELVES.find((s) => s.id === shelf)!

  return (
    <div className="songbook">
      <header className="player-head">
        <button className="ghost" onClick={onExit} aria-label="Back">←</button>
        <div className="titles">
          <h1>Songbook</h1>
          <p>{counts.learned} learned · {counts.learning} on the go · {counts.want} to come</p>
        </div>
        <button className="primary small" onClick={onAddSong}>Add</button>
      </header>

      <div className="shelf-row">
        {SHELVES.map((s) => (
          <button key={s.id} className={shelf === s.id ? 'on' : ''} onClick={() => setShelf(s.id)}>
            {s.label} <em>{counts[s.id]}</em>
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="shelf-empty">{current.empty}</p>
      ) : (
        <ul className="book-list">
          {shown.map((entry) => (
            <BookRow
              key={entry.id}
              entry={entry}
              onOpen={() => {
                if (entry.origin === 'course' && entry.song) onOpenSong(entry.song)
                else if (entry.hasMusic) onOpenUserSong(entry.id)
                else onEditSong(entry.id)
              }}
              onEdit={() => onEditSong(entry.id)}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

function BookRow({ entry, onOpen, onEdit }: { entry: BookEntry; onOpen: () => void; onEdit: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const levelName = entry.scaffold > 0 ? SCAFFOLD_LEVELS[entry.scaffold - 1].name : null

  return (
    <li className={`book-row status-${entry.status}`}>
      <button className="book-main" onClick={onOpen}>
        <div className="book-title">
          <strong>{entry.title}</strong>
          <span className="composer">{entry.artist}</span>
        </div>
        <div className="book-meta">
          {!entry.hasMusic ? (
            <span className="needs-chords">No chords yet — tap to add them</span>
          ) : (
            <>
              {levelName && <span className="pill">{levelName}</span>}
              {entry.playCount > 0 && <span>{entry.playCount} play{entry.playCount === 1 ? '' : 's'}</span>}
              {entry.bestAccuracy > 0 && <span>best {Math.round(entry.bestAccuracy * 100)}%</span>}
              {entry.learnedAt
                ? <span className="learned-on">learned {shortDate(entry.learnedAt)}</span>
                : entry.lastPlayedAt && <span>last played {shortDate(entry.lastPlayedAt)}</span>}
            </>
          )}
        </div>
        {entry.hasMusic && (
          <div className="ladder-mini" aria-hidden="true">
            {SCAFFOLD_LEVELS.map((l) => (
              <span key={l.level} className={l.level <= entry.scaffold ? 'on' : ''} />
            ))}
          </div>
        )}
      </button>

      <button className="book-menu ghost" aria-label={`Options for ${entry.title}`}
        onClick={() => setMenuOpen(!menuOpen)}>⋯</button>

      {menuOpen && (
        <div className="book-actions" role="group">
          <span className="label">Move to</span>
          {(['want', 'learning', 'learned'] as SongStatus[]).map((s) => (
            <button key={s} className={entry.status === s ? 'on' : ''}
              onClick={() => { setStatus(entry.id, s); setMenuOpen(false) }}>
              {STATUS_LABELS[s]}
            </button>
          ))}
          {entry.pinned && (
            <button onClick={() => { setStatus(entry.id, null); setMenuOpen(false) }}>
              Work it out for me
            </button>
          )}
          {entry.origin === 'yours' && (
            <>
              <button onClick={() => { setMenuOpen(false); onEdit() }}>Edit chords</button>
              <button className="danger" onClick={() => {
                if (confirm(`Remove "${entry.title}" from your songbook?`)) library.remove(entry.id)
              }}>Remove</button>
            </>
          )}
        </div>
      )}
    </li>
  )
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}
