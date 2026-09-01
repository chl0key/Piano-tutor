import { useCallback, useEffect, useState } from 'react'
import {
  announceChange, login, logout, nowPlaying, playlistTracks, playlists,
  redirectUri, savedTracks, searchTracks, setClientId, useSpotifyStatus,
  type SpotifyPlaylist, type SpotifyTrack,
} from '../spotify/spotify'

type Tab = 'search' | 'playing' | 'saved' | 'playlists'

/**
 * Finds the song on Spotify so it does not have to be typed. Spotify cannot
 * supply the notes — see the note in spotify.ts — so this picker's whole job is
 * turning "that one" into a title and an artist.
 */
export function SpotifyPicker({ onPick }: { onPick: (track: SpotifyTrack) => void }) {
  const { signedIn, clientId } = useSpotifyStatus()
  const [open, setOpen] = useState(false)
  const [idDraft, setIdDraft] = useState(clientId)
  const [tab, setTab] = useState<Tab>('search')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SpotifyTrack[]>([])
  const [lists, setLists] = useState<SpotifyPlaylist[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [picked, setPicked] = useState<string | null>(null)

  const run = useCallback(async (fn: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    try {
      await fn()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Spotify did not answer.')
    } finally {
      setBusy(false)
    }
  }, [])

  useEffect(() => {
    if (!signedIn || !open) return
    if (tab === 'saved') void run(async () => setResults(await savedTracks()))
    if (tab === 'playing') void run(async () => {
      const t = await nowPlaying()
      setResults(t ? [t] : [])
      if (!t) setError('Nothing is playing on Spotify right now.')
    })
    if (tab === 'playlists') void run(async () => setLists(await playlists()))
    if (tab === 'search') setResults([])
  }, [tab, signedIn, open, run])

  const choose = (t: SpotifyTrack) => {
    setPicked(t.id)
    onPick(t)
  }

  if (!signedIn) {
    return (
      <div className="spotify-panel">
        <button className="spotify-connect" onClick={() => setOpen(!open)} aria-expanded={open}>
          <SpotifyMark /> Pick from Spotify instead of typing
          <span className="chev">{open ? '▲' : '▼'}</span>
        </button>
        {open && (
          <div className="spotify-setup">
            <p className="sub">
              Spotify needs a free developer app of your own — a one-time setup that takes about two
              minutes and keeps this app entirely yours.
            </p>
            <ol className="steps">
              <li>Open <a href="https://developer.spotify.com/dashboard" target="_blank" rel="noreferrer">developer.spotify.com/dashboard</a> and create an app.</li>
              <li>
                Add this exact redirect URI:
                <code className="uri">{redirectUri()}</code>
              </li>
              <li>Tick <strong>Web API</strong>, save, then copy the app's Client ID below.</li>
            </ol>
            <div className="field-row">
              <label className="field grow">
                <span>Client ID</span>
                <input value={idDraft} onChange={(e) => setIdDraft(e.target.value)}
                  placeholder="e.g. 4c2f…" spellCheck={false} />
              </label>
              <button
                className="primary"
                disabled={idDraft.trim().length < 8}
                onClick={() => {
                  setClientId(idDraft)
                  announceChange()
                  void login().catch((e) => setError(String(e.message ?? e)))
                }}
              >
                Connect
              </button>
            </div>
            {error && <p className="error">{error}</p>}
            <p className="muted">
              Spotify withdrew its key and tempo endpoints from new apps in 2024, and playback audio
              is encrypted, so nothing can transcribe a track from Spotify. This is for finding the
              song; the notes come from the next step.
            </p>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="spotify-panel signed-in">
      <button className="spotify-connect" onClick={() => setOpen(!open)} aria-expanded={open}>
        <SpotifyMark /> {open ? 'Browse your Spotify' : 'Pick from Spotify'}
        <span className="chev">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="spotify-body">
          <div className="seg wide">
            {(['search', 'playing', 'saved', 'playlists'] as Tab[]).map((t) => (
              <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>
                {t === 'search' ? 'Search' : t === 'playing' ? 'Playing now' : t === 'saved' ? 'Liked' : 'Playlists'}
              </button>
            ))}
          </div>

          {tab === 'search' && (
            <form
              className="search-row"
              onSubmit={(e) => {
                e.preventDefault()
                void run(async () => setResults(await searchTracks(query)))
              }}
            >
              <input value={query} onChange={(e) => setQuery(e.target.value)}
                placeholder="Song or artist" aria-label="Search Spotify" />
              <button className="primary" type="submit">Search</button>
            </form>
          )}

          {busy && <p className="muted">Asking Spotify…</p>}
          {error && <p className="error">{error}</p>}

          {tab === 'playlists' && lists.length > 0 && (
            <div className="playlist-row">
              {lists.map((p) => (
                <button key={p.id} className="small"
                  onClick={() => void run(async () => setResults(await playlistTracks(p.id)))}>
                  {p.name} <em>{p.total}</em>
                </button>
              ))}
            </div>
          )}

          {results.length > 0 && (
            <ul className="track-list">
              {results.map((t) => (
                <li key={t.id}>
                  <button className={picked === t.id ? 'on' : ''} onClick={() => choose(t)}>
                    {t.art && <img src={t.art} alt="" width={36} height={36} />}
                    <span className="track-title">
                      <strong>{t.title}</strong>
                      <em>{t.artist}</em>
                    </span>
                    <span className="pick">{picked === t.id ? 'Picked' : 'Use'}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <button className="small ghost-line" onClick={() => { logout(); setOpen(false) }}>
            Disconnect Spotify
          </button>
        </div>
      )}
    </div>
  )
}

function SpotifyMark() {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true" className="spotify-mark">
      <circle cx="12" cy="12" r="11" fill="#1DB954" />
      <g stroke="#0b1016" strokeWidth="1.9" strokeLinecap="round" fill="none">
        <path d="M6.6 9.1c3.6-1 7.4-.7 10.6 1" />
        <path d="M7.3 12.3c3-.8 6.2-.5 8.9.9" />
        <path d="M8 15.4c2.4-.6 4.9-.4 7.1.8" />
      </g>
    </svg>
  )
}
