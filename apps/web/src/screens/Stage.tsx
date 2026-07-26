import type { Mode, StoryBundle } from '@story/schema'
import { useEffect, useMemo, useRef, useState } from 'react'
import { assetUrl } from '../api'
import { playBase64Mp3 } from '../audio'
import { PushToTalkButton } from '../components/PushToTalkButton'
import { getAudioBackend } from '../fx/audio'
import { useFxEvents } from '../fx/events'
import { effectsEnabled } from '../fx/prefs'
import { createHapticsController } from '../fx/haptics'
import { createSoundController } from '../fx/sound'
import { CoachMarks } from '../fx/CoachMarks'
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
import { PhaseToast } from '../fx/PhaseToast'

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

  // First-play coach marks: shown once per browser (localStorage flag), gating on the
  // clock chip, character rail, input dock, and journal button in turn. Mirrors the
  // Journal/SettingsSheet pattern below — an effect keyed on the "open" boolean drives
  // pause/resume, rather than calling them directly from event handlers.
  const [showCoach, setShowCoach] = useState(() => !localStorage.getItem('sf-coached'))
  const clockRef = useRef<HTMLElement | null>(null)
  const railRef = useRef<HTMLElement | null>(null)
  const dockRef = useRef<HTMLElement | null>(null)
  const journalRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (showCoach) session.pause('settings')
    else session.resume('settings')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showCoach])

  const finishCoach = () => {
    localStorage.setItem('sf-coached', '1')
    setShowCoach(false)
  }

  const replayTips = () => {
    setSettingsOpen(false)
    setShowCoach(true)
  }

  useEffect(() => {
    session.onAudio.current = playBase64Mp3
  }, [session.onAudio])

  const sound = useMemo(() => createSoundController(getAudioBackend(), effectsEnabled), [])
  const haptics = useMemo(() => createHapticsController(effectsEnabled), [])

  // Phase toast + challenge-outcome banner styling: both are transient, fx-event-driven
  // state that Stage owns and clears on its own timeout (extending the same single fx
  // fan-out sound/haptics already use, per the seam fx/events.ts establishes).
  const [phaseToast, setPhaseToast] = useState<{ day: number; phase: string } | null>(null)
  const phaseToastTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [challengeOutcome, setChallengeOutcome] = useState<'success' | 'timeout' | null>(null)
  const [lastChallengePrompt, setLastChallengePrompt] = useState<string | null>(null)
  const outcomeTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  useFxEvents(session, (e) => {
    sound.handle(e)
    haptics.handle(e)
    if (e.type === 'phase-changed') {
      setPhaseToast({ day: e.day, phase: e.phase })
      if (phaseToastTimeout.current) clearTimeout(phaseToastTimeout.current)
      phaseToastTimeout.current = setTimeout(() => setPhaseToast(null), 2500)
    }
    if (e.type === 'challenge-started') {
      // Chained challenges: the engine can resolve the previous challenge and activate
      // this one in the same dispatch, so a still-pending outcome/timeout from the one
      // that just resolved must not bleed onto this new challenge's banner.
      setChallengeOutcome(null)
      if (outcomeTimeout.current) {
        clearTimeout(outcomeTimeout.current)
        outcomeTimeout.current = null
      }
    }
    if (e.type === 'challenge-succeeded' || e.type === 'challenge-timed-out') {
      const ch = bundle.challenges.find((c) => c.id === e.challengeId)
      setLastChallengePrompt(ch?.prompt ?? null)
      setChallengeOutcome(e.type === 'challenge-succeeded' ? 'success' : 'timeout')
      if (outcomeTimeout.current) clearTimeout(outcomeTimeout.current)
      outcomeTimeout.current = setTimeout(() => setChallengeOutcome(null), 1200)
    }
  })

  // Clear any pending toast/outcome timers on unmount so they don't fire setState after
  // the Stage is gone.
  useEffect(() => {
    return () => {
      if (phaseToastTimeout.current) clearTimeout(phaseToastTimeout.current)
      if (outcomeTimeout.current) clearTimeout(outcomeTimeout.current)
    }
  }, [])

  const remaining = state.activeChallenge ? state.activeChallenge.deadlineMs - state.elapsedRealMs : null
  useEffect(() => {
    sound.tickCheck(remaining)
    haptics.tickCheck(remaining)
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

      {/* Tension vignette: a decorative, non-interactive red inset glow once the active
          challenge's deadline is under 10s. Fixed (not absolute) per spec so it always
          covers the viewport even though the stage frame itself is capped at max-w-md. */}
      {remaining !== null && remaining < 10_000 && (
        <div className="pointer-events-none fixed inset-0 z-30 animate-pulse shadow-[inset_0_0_120px_40px_rgba(220,38,38,0.35)]" />
      )}

      {/* One flex column owns all stage chrome — nothing can overlap by construction. */}
      <div className="pointer-events-none absolute inset-0 z-20 flex flex-col p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))]">
        <TopBar
          bundle={bundle}
          state={state}
          time={time}
          clueCount={state.cluesFound.length}
          onOpenJournal={() => setJournalOpen(true)}
          onOpenSettings={() => setSettingsOpen(true)}
          clockRef={clockRef}
          journalRef={journalRef}
        />
        <ChallengeBanner bundle={bundle} state={state} outcome={challengeOutcome} lastPrompt={lastChallengePrompt} />
        <div ref={(el) => (railRef.current = el)} className="mt-3 flex min-h-0 flex-1">
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
        <div ref={(el) => (dockRef.current = el)}>
          <InputDock bundle={bundle} session={session} voiceSlot={<PushToTalkButton session={session} />} />
        </div>
      </div>

      <PhaseToast toast={phaseToast} />
      <NarrationCard bundle={bundle} beatId={state.beatId} />
      <Journal
        bundle={bundle}
        state={state}
        time={time}
        session={session}
        open={journalOpen}
        onClose={() => setJournalOpen(false)}
      />
      <SettingsSheet
        bundle={bundle}
        session={session}
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onReplayTips={replayTips}
      />
      {showCoach && (
        <CoachMarks
          targets={{ clock: clockRef, rail: railRef, dock: dockRef, journal: journalRef }}
          onDone={finishCoach}
        />
      )}
    </div>
  )
}
