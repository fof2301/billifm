import type { Mode, StoryBundle } from '@story/schema'
import { useSession } from '../useSession'
import { BackgroundLayer } from '../components/BackgroundLayer'
import { ChallengeBanner } from '../components/ChallengeBanner'
import { CharacterRail } from '../components/CharacterRail'
import { ClueDrawer } from '../components/ClueDrawer'
import { NarrationCard } from '../components/NarrationCard'
import { TopBar } from '../components/TopBar'

export function Stage({
  bundle,
  mode,
  resume,
  onEnded,
}: {
  bundle: StoryBundle
  mode: Mode
  resume: boolean
  onEnded: (endingId: string) => void
}) {
  const session = useSession(bundle, mode, resume, onEnded)
  const { state, time } = session

  return (
    <div className="relative mx-auto h-dvh max-w-md overflow-hidden bg-slate-950">
      <BackgroundLayer bundle={bundle} phase={time.phase} />
      <TopBar bundle={bundle} state={state} time={time} onOpenSettings={() => {}} />
      <CharacterRail bundle={bundle} state={state} onSelect={session.selectCharacter} />
      <ChallengeBanner bundle={bundle} state={state} />
      <ClueDrawer bundle={bundle} state={state} />
      <NarrationCard bundle={bundle} beatId={state.beatId} />
      {/* conversation sheet + input dock: Task 14 */}
    </div>
  )
}
