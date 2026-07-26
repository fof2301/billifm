import type { Mode, StoryBundle } from '@story/schema'
import { useEffect, useMemo, useRef, useState } from 'react'
import { assetUrl } from '../api'
import { playBase64Mp3 } from '../audio'
import { PushToTalkButton } from '../components/PushToTalkButton'
import { getAudioBackend } from '../fx/audio'
import { useFxEvents } from '../fx/events'
import { effectsEnabled } from '../fx/prefs'
import { createSoundController } from '../fx/sound'
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

  const sound = useMemo(() => createSoundController(getAudioBackend(), effectsEnabled), [])
  useFxEvents(session, (e) => sound.handle(e))

  useEffect(() => {
    sound.tickCheck(state.activeChallenge ? state.activeChallenge.deadlineMs - state.elapsedRealMs : null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.elapsedRealMs])

  useEffect(() => {
    sound.startAmbient(bundle.scene.id, bundle.scene.ambientAudio && assetUrl(bundle.meta.id, bundle.scene.ambientAudio))
    return () => sound.stopAmbient()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Settings only writes the Effects pref (fx/prefs) — re-sync ambient here on close
  // rather than reacting to the pref directly, since there's no change event for
  // localStorage writes from the same tab.
  const settingsWasOpen = useRef(settingsOpen)
  useEffect(() => {
    if (settingsWasOpen.current && !settingsOpen) {
      if (effectsEnabled()) {
        sound.startAmbient(bundle.scene.id, bundle.scene.ambientAudio && assetUrl(bundle.meta.id, bundle.scene.ambientAudio))
      } else {
        sound.stopAmbient()
      }
    }
    settingsWasOpen.current = settingsOpen
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsOpen])

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
