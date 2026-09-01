import { useEffect, useState } from 'react'

/**
 * Spotify, used for the one thing it can still do well: finding the song.
 *
 * Spotify withdrew the audio-features and audio-analysis endpoints from new
 * applications in November 2024, and playback audio is encrypted, so nothing
 * here can listen to a track or transcribe it. What it can do is search, read
 * your playlists and saved songs, and see what is playing right now — which is
 * how you say "this one" without typing a title.
 *
 * Authorisation uses PKCE, so there is no client secret and nothing to keep
 * private in a page that ships to the browser.
 */

const AUTH_URL = 'https://accounts.spotify.com/authorize'
const TOKEN_URL = 'https://accounts.spotify.com/api/token'
const API = 'https://api.spotify.com/v1'

const SCOPES = [
  'user-read-private',
  'user-library-read',
  'playlist-read-private',
  'playlist-read-collaborative',
  'user-read-currently-playing',
  'user-read-playback-state',
].join(' ')

const STORE = {
  clientId: 'piano-tutor.spotify.clientId',
  verifier: 'piano-tutor.spotify.verifier',
  token: 'piano-tutor.spotify.token',
}

interface StoredToken {
  access: string
  refresh?: string
  expiresAt: number
}

export interface SpotifyTrack {
  id: string
  title: string
  artist: string
  album: string
  art?: string
  durationMs: number
}

export function getClientId(): string {
  try {
    return localStorage.getItem(STORE.clientId) ?? ''
  } catch {
    return ''
  }
}

export function setClientId(id: string) {
  try {
    localStorage.setItem(STORE.clientId, id.trim())
  } catch { /* storage unavailable */ }
}

/** The exact address to register in the Spotify dashboard. */
export function redirectUri(): string {
  return window.location.origin + window.location.pathname
}

function readToken(): StoredToken | null {
  try {
    const raw = localStorage.getItem(STORE.token)
    return raw ? (JSON.parse(raw) as StoredToken) : null
  } catch {
    return null
  }
}

function writeToken(t: StoredToken | null) {
  try {
    if (t) localStorage.setItem(STORE.token, JSON.stringify(t))
    else localStorage.removeItem(STORE.token)
  } catch { /* storage unavailable */ }
}

function base64url(bytes: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function challengeFor(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return base64url(digest)
}

export async function login(): Promise<void> {
  const clientId = getClientId()
  if (!clientId) throw new Error('Add your Spotify client ID first.')
  const verifier = base64url(crypto.getRandomValues(new Uint8Array(48)).buffer)
  localStorage.setItem(STORE.verifier, verifier)
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri(),
    code_challenge_method: 'S256',
    code_challenge: await challengeFor(verifier),
    scope: SCOPES,
  })
  window.location.href = `${AUTH_URL}?${params}`
}

/**
 * Completes the login if the page was just returned to from Spotify.
 * Call once on start-up; it cleans the code out of the address bar either way.
 */
export async function completeLogin(): Promise<'signed-in' | 'nothing' | string> {
  const url = new URL(window.location.href)
  const error = url.searchParams.get('error')
  const code = url.searchParams.get('code')
  if (!code && !error) return 'nothing'

  url.searchParams.delete('code')
  url.searchParams.delete('error')
  url.searchParams.delete('state')
  window.history.replaceState({}, '', url.toString())
  if (error) return error === 'access_denied' ? 'Spotify access was declined.' : error
  if (!code) return 'nothing'

  const verifier = localStorage.getItem(STORE.verifier)
  const clientId = getClientId()
  if (!verifier || !clientId) return 'The sign-in could not be finished. Try connecting again.'

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri(),
      code_verifier: verifier,
    }),
  })
  if (!res.ok) return `Spotify refused the sign-in (${res.status}). Check the redirect URI matches exactly.`
  const json = await res.json()
  writeToken({
    access: json.access_token,
    refresh: json.refresh_token,
    expiresAt: Date.now() + json.expires_in * 1000,
  })
  localStorage.removeItem(STORE.verifier)
  notify()
  return 'signed-in'
}

async function accessToken(): Promise<string | null> {
  const t = readToken()
  if (!t) return null
  if (Date.now() < t.expiresAt - 30000) return t.access
  if (!t.refresh) {
    writeToken(null)
    notify()
    return null
  }
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: getClientId(),
      grant_type: 'refresh_token',
      refresh_token: t.refresh,
    }),
  })
  if (!res.ok) {
    writeToken(null)
    notify()
    return null
  }
  const json = await res.json()
  writeToken({
    access: json.access_token,
    refresh: json.refresh_token ?? t.refresh,
    expiresAt: Date.now() + json.expires_in * 1000,
  })
  notify()
  return json.access_token
}

export function isSignedIn(): boolean {
  return readToken() !== null
}

export function logout() {
  writeToken(null)
  notify()
}

async function api<T>(path: string): Promise<T> {
  const token = await accessToken()
  if (!token) throw new Error('Not connected to Spotify.')
  const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` } })
  if (res.status === 401) {
    writeToken(null)
    notify()
    throw new Error('Spotify signed you out. Connect again.')
  }
  if (res.status === 429) throw new Error('Spotify is rate limiting. Wait a moment and retry.')
  if (!res.ok) throw new Error(`Spotify returned ${res.status}.`)
  return (await res.json()) as T
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function toTrack(t: any): SpotifyTrack {
  return {
    id: t.id,
    title: t.name,
    artist: (t.artists ?? []).map((a: any) => a.name).join(', '),
    album: t.album?.name ?? '',
    art: t.album?.images?.[t.album.images.length - 1]?.url,
    durationMs: t.duration_ms ?? 0,
  }
}

export async function searchTracks(query: string, limit = 20): Promise<SpotifyTrack[]> {
  if (!query.trim()) return []
  const data = await api<any>(`/search?q=${encodeURIComponent(query)}&type=track&limit=${limit}`)
  return (data.tracks?.items ?? []).map(toTrack)
}

export async function savedTracks(limit = 50): Promise<SpotifyTrack[]> {
  const data = await api<any>(`/me/tracks?limit=${limit}`)
  return (data.items ?? []).map((i: any) => toTrack(i.track)).filter((t: SpotifyTrack) => t.id)
}

export interface SpotifyPlaylist { id: string; name: string; total: number }

export async function playlists(limit = 50): Promise<SpotifyPlaylist[]> {
  const data = await api<any>(`/me/playlists?limit=${limit}`)
  return (data.items ?? []).map((p: any) => ({ id: p.id, name: p.name, total: p.tracks?.total ?? 0 }))
}

export async function playlistTracks(id: string, limit = 100): Promise<SpotifyTrack[]> {
  const data = await api<any>(`/playlists/${id}/tracks?limit=${limit}`)
  return (data.items ?? [])
    .map((i: any) => i.track)
    .filter((t: any) => t && t.id)
    .map(toTrack)
}

export async function nowPlaying(): Promise<SpotifyTrack | null> {
  const token = await accessToken()
  if (!token) return null
  const res = await fetch(`${API}/me/player/currently-playing`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (res.status === 204 || !res.ok) return null
  const data = await res.json()
  return data?.item ? toTrack(data.item) : null
}
/* eslint-enable @typescript-eslint/no-explicit-any */

const listeners = new Set<() => void>()
function notify() {
  for (const fn of listeners) fn()
}

export function useSpotifyStatus(): { signedIn: boolean; clientId: string } {
  const [state, setState] = useState(() => ({ signedIn: isSignedIn(), clientId: getClientId() }))
  useEffect(() => {
    const update = () => setState({ signedIn: isSignedIn(), clientId: getClientId() })
    listeners.add(update)
    return () => {
      listeners.delete(update)
    }
  }, [])
  return state
}

/** Let the settings panel re-render after the client ID is typed in. */
export function announceChange() {
  notify()
}
