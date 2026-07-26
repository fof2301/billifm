import type { Mode, StoryBundle } from '@story/schema'
import { useState } from 'react'
import { Ending } from './screens/Ending'
import { Intro } from './screens/Intro'
import { Library } from './screens/Library'
import { Stage } from './screens/Stage'

export type Route =
  | { name: 'library' }
  | { name: 'intro'; storyId: string }
  | { name: 'stage'; bundle: StoryBundle; mode: Mode; resume: boolean }
  | { name: 'ending'; bundle: StoryBundle; endingId: string }

export default function App() {
  const [route, setRoute] = useState<Route>({ name: 'library' })
  // Bumping this remounts the Stage, which is how "start over" gets a fresh session.
  const [runId, setRunId] = useState(0)

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
      return (
        <Stage
          key={`${route.bundle.meta.id}-${runId}`}
          bundle={route.bundle}
          mode={route.mode}
          resume={route.resume}
          onEnded={(endingId) => setRoute({ name: 'ending', bundle: route.bundle, endingId })}
          onLeave={() => setRoute({ name: 'library' })}
          onRestart={() => {
            localStorage.removeItem(`sf-session-${route.bundle.meta.id}`)
            setRoute({ ...route, resume: false })
            setRunId((n) => n + 1)
          }}
        />
      )
    case 'ending':
      return (
        <Ending
          bundle={route.bundle}
          endingId={route.endingId}
          onReplay={() => setRoute({ name: 'intro', storyId: route.bundle.meta.id })}
          onLibrary={() => setRoute({ name: 'library' })}
        />
      )
  }
}
