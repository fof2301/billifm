import type { Mode, StoryBundle } from '@story/schema'
import { useState } from 'react'
import { useSession } from '../useSession'
import { BackgroundLayer } from '../components/BackgroundLayer'
import { ChallengeBanner } from '../components/ChallengeBanner'
import { CharacterRail } from '../components/CharacterRail'
import { ClueDrawer } from '../components/ClueDrawer'
import { ConversationSheet } from '../components/ConversationSheet'
import { InputDock } from '../components/InputDock'
import { NarrationCard } from '../components/NarrationCard'
import { SettingsSheet } from '../components/SettingsSheet'
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
  const [settingsOpen, setSettingsOpen] = useState(false)

  return (
    <div className="relative mx-auto h-dvh max-w-md overflow-hidden bg-slate-950">
      <BackgroundLayer bundle={bundle} phase={time.phase} />
      <TopBar bundle={bundle} state={state} time={time} onOpenSettings={() => setSettingsOpen(true)} />
      <CharacterRail bundle={bundle} state={state} onSelect={session.selectCharacter} />
      <ChallengeBanner bundle={bundle} state={state} />
      <ClueDrawer bundle={bundle} state={state} />
      <NarrationCard bundle={bundle} beatId={state.beatId} />
      <ConversationSheet
        bundle={bundle}
        state={state}
        busy={session.busy}
        stallLine={session.stallLine}
        failedMessage={session.failedMessage}
        onRetry={session.retry}
      />
      <InputDock bundle={bundle} session={session} />
      <SettingsSheet bundle={bundle} session={session} open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  )
}
