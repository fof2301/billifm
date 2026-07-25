import type { Mode, StoryBundle } from '@story/schema'
import { useState } from 'react'
import { Intro } from './screens/Intro'
import { Library } from './screens/Library'

export type Route =
  | { name: 'library' }
  | { name: 'intro'; storyId: string }
  | { name: 'stage'; bundle: StoryBundle; mode: Mode; resume: boolean }
  | { name: 'ending'; bundle: StoryBundle; endingId: string }

export default function App() {
  const [route, setRoute] = useState<Route>({ name: 'library' })

  switch (route.name) {
    case 'library':
      return <Library onPick={(storyId) => setRoute({ name: 'intro', storyId })} />
    case 'intro':
      return (
        <Intro
          storyId={route.storyId}
          onBack={() => setRoute({ name: 'library' })}
          onStart={(bundle, mode, resume) => setRoute({ name: 'stage', bundle, mode, resume })}
        />
      )
    case 'stage':
      return <p className="p-8">Stage: coming in Task 13</p>
    case 'ending':
      return <p className="p-8">Ending: coming in Task 16</p>
  }
}
