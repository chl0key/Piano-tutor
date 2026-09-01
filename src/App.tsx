import { useEffect, useState } from 'react'
import { Home } from './views/Home'
import { SongPlayer } from './views/SongPlayer'
import { SightReading } from './views/SightReading'
import { AddSong } from './views/AddSong'
import { Training } from './views/Training'
import { TrainingSession } from './views/TrainingSession'
import { buildVariants, library, type Variant } from './state/library'
import { completeLogin } from './spotify/spotify'
import type { Song } from './music/song'

type View =
  | { name: 'home' }
  | { name: 'song'; song: Song }
  | { name: 'user-song'; variants: Variant[] }
  | { name: 'drill' }
  | { name: 'add' }
  | { name: 'training' }
  | { name: 'session' }

export default function App() {
  const [view, setView] = useState<View>({ name: 'home' })
  const [notice, setNotice] = useState<string | null>(null)
  const home = () => setView({ name: 'home' })

  // Spotify sends the browser back here with a code in the address bar.
  useEffect(() => {
    void completeLogin().then((result) => {
      if (result !== 'nothing' && result !== 'signed-in') setNotice(result)
    })
  }, [])

  const openUserSong = (id: string) => {
    const user = library.get(id)
    if (user) setView({ name: 'user-song', variants: buildVariants(user) })
  }

  if (view.name === 'song') return <SongPlayer song={view.song} onExit={home} />
  if (view.name === 'user-song') {
    return <SongPlayer song={view.variants[0].song} variants={view.variants} onExit={home} />
  }
  if (view.name === 'drill') return <SightReading onExit={home} />
  if (view.name === 'add') return <AddSong onCancel={home} onDone={openUserSong} />
  if (view.name === 'training') {
    return <Training onStart={() => setView({ name: 'session' })} onExit={home} />
  }
  if (view.name === 'session') {
    return <TrainingSession onExit={() => setView({ name: 'training' })} />
  }

  return (
    <>
      {notice && (
        <p className="banner" role="status">
          {notice} <button className="small" onClick={() => setNotice(null)}>Dismiss</button>
        </p>
      )}
      <Home
        onOpenSong={(song) => setView({ name: 'song', song })}
        onOpenUserSong={openUserSong}
        onOpenDrill={() => setView({ name: 'drill' })}
        onAddSong={() => setView({ name: 'add' })}
        onOpenTraining={() => setView({ name: 'training' })}
      />
    </>
  )
}
