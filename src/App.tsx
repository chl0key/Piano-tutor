import { useState } from 'react'
import { Home } from './views/Home'
import { SongPlayer } from './views/SongPlayer'
import { SightReading } from './views/SightReading'
import type { Song } from './music/song'

type View = { name: 'home' } | { name: 'song'; song: Song } | { name: 'drill' }

export default function App() {
  const [view, setView] = useState<View>({ name: 'home' })
  const home = () => setView({ name: 'home' })

  if (view.name === 'song') return <SongPlayer song={view.song} onExit={home} />
  if (view.name === 'drill') return <SightReading onExit={home} />
  return (
    <Home
      onOpenSong={(song) => setView({ name: 'song', song })}
      onOpenDrill={() => setView({ name: 'drill' })}
    />
  )
}
