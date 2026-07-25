import type { Mode, StoryBundle } from '@story/schema'
import { useEffect, useState } from 'react'
import { playBase64Mp3 } from '../audio'
import { PushToTalkButton } from '../components/PushToTalkButton'
import { useSession } from '../useSession'
import { BackgroundLayer } from '../components/BackgroundLayer'
import { ChallengeBanner } from '../components/ChallengeBanner'
import { CharacterRail } from '../components/CharacterRail'
import { ConversationSheet } from '../components/ConversationSheet'
import { InputDock } from '../components/InputDock'
import { Journal } from '../components/Journal'
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
  const [journalOpen, setJournalOpen] = useState(false)

  useEffect(() => {
    session.onAudio.current = playBase64Mp3
  }, [session.onAudio])

  return (
    <div className="relative mx-auto h-dvh max-w-md overflow-hidden bg-slate-950">
      <BackgroundLayer bundle={bundle} phase={time.phase} />

      {/* One flex column owns all stage chrome — nothing can overlap by construction. */}
      <div className="pointer-events-none absolute inset-0 z-20 flex flex-col p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))]">
        <TopBar
          bundle={bundle}
          state={state}
          time={time}
          clueCount={state.cluesFound.length}
          onOpenJournal={() => setJournalOpen(true)}
          onOpenSettings={() => setSettingsOpen(true)}
        />
        <ChallengeBanner bundle={bundle} state={state} />
        <div className="mt-3 flex min-h-0 flex-1">
          <CharacterRail bundle={bundle} state={state} onSelect={session.selectCharacter} />
        </div>
        <ConversationSheet
          bundle={bundle}
          state={state}
          busy={session.busy}
          stallLine={session.stallLine}
          failedMessage={session.failedMessage}
          onRetry={session.retry}
        />
        <InputDock bundle={bundle} session={session} voiceSlot={<PushToTalkButton session={session} />} />
      </div>

      <NarrationCard bundle={bundle} beatId={state.beatId} />
      <Journal
        bundle={bundle}
        state={state}
        time={time}
        session={session}
        open={journalOpen}
        onClose={() => setJournalOpen(false)}
      />
      <SettingsSheet bundle={bundle} session={session} open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  )
}
