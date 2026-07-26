import { fireEvent, render, screen } from '@testing-library/react'
import { useRef } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { StoryBundleSchema } from '@story/schema'
import { COACH_STEPS, CoachMarks } from '../src/fx/CoachMarks'
import { Stage } from '../src/screens/Stage'
import { useSession } from '../src/useSession'
import type { SessionApi } from '../src/useSession'

vi.mock('../src/api', () => ({ assetUrl: (id: string, p: string) => `http://x/${id}/${p}` }))
// Stage renders through the real useSession hook (network calls, timers, localStorage
// saves) — none of that is relevant to coach-mark wiring, so it's swapped for a stub per
// the pattern other Stage-adjacent tests use for their own heavy dependencies (mocking
// '../src/api', '../src/audio', etc.) rather than exercising the whole session machinery.
vi.mock('../src/useSession', () => ({ useSession: vi.fn() }))

type StepKey = (typeof COACH_STEPS)[number]['key']

function Harness({ onDone, missing }: { onDone: () => void; missing?: StepKey }) {
  const clockRef = useRef<HTMLElement | null>(null)
  const railRef = useRef<HTMLElement | null>(null)
  const dockRef = useRef<HTMLElement | null>(null)
  const journalRef = useRef<HTMLElement | null>(null)
  const targets = { clock: clockRef, rail: railRef, dock: dockRef, journal: journalRef }
  return (
    <div>
      {(['clock', 'rail', 'dock', 'journal'] as const)
        .filter((k) => k !== missing)
        .map((k) => (
          <div key={k} ref={targets[k] as React.RefObject<HTMLDivElement>} />
        ))}
      <CoachMarks targets={targets} onDone={onDone} />
    </div>
  )
}

describe('CoachMarks', () => {
  it("shows all four steps' copy in order via Next", () => {
    render(<Harness onDone={() => {}} />)
    expect(screen.getByText(COACH_STEPS[0].copy)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.queryByText(COACH_STEPS[0].copy)).not.toBeInTheDocument()
    expect(screen.getByText(COACH_STEPS[1].copy)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.queryByText(COACH_STEPS[1].copy)).not.toBeInTheDocument()
    expect(screen.getByText(COACH_STEPS[2].copy)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.queryByText(COACH_STEPS[2].copy)).not.toBeInTheDocument()
    expect(screen.getByText(COACH_STEPS[3].copy)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Got it' })).toBeInTheDocument()
  })

  it('"Got it" on the last step calls onDone', () => {
    const onDone = vi.fn()
    render(<Harness onDone={onDone} />)
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(onDone).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Got it' }))
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('Skip calls onDone immediately, from the first step', () => {
    const onDone = vi.fn()
    render(<Harness onDone={onDone} />)
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }))
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('skips a step whose target ref is missing/null', () => {
    render(<Harness onDone={() => {}} missing="rail" />)
    expect(screen.getByText(COACH_STEPS[0].copy)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    // step 1 ('rail') has no mounted target — skips straight through to step 2 ('dock')
    expect(screen.getByText(COACH_STEPS[2].copy)).toBeInTheDocument()
  })
})

const bundle = StoryBundleSchema.parse({
  meta: { id: 'cx', title: 'Cx', tagline: '', genre: 't', estimatedMinutes: 5, cover: 'c.svg', modes: ['text'] },
  clock: { realMinutesPerStoryDay: 5, totalStoryDays: 2, phases: ['day', 'night'] },
  scene: { id: 's', backgrounds: { day: 'd.svg', night: 'n.svg' } },
  characters: [
    { id: 'ann', name: 'Ann', role: 'r', portrait: 'p.svg', personality: 'k', greeting: 'g',
      voice: { voiceId: 'alloy' }, availability: { beats: ['*'], phases: ['*'] } },
  ],
  beats: [{ id: 'b1', narration: 'n', objective: 'o', characters: ['ann'] }],
  challenges: [],
  clues: [],
  endings: [{ id: 'e', when: { clockExpired: true }, title: 'E', text: 'e' }],
})

const baseState = {
  storyId: 'cx', mode: 'text' as const, beatId: 'b1', beatsVisited: ['b1'], flags: [], cluesFound: [],
  resolvedChallenges: [], elapsedRealMs: 0, pauseReasons: [], activeChallenge: null,
  activeCharacterId: null, transcripts: {}, suggestedReplies: [], endingId: null,
}

function fakeSession(): SessionApi {
  return {
    state: baseState,
    time: { day: 1, phase: 'day', expired: false, hour: 0, minute: 0 },
    busy: false,
    stallLine: null,
    failedMessage: null,
    send: vi.fn(),
    retry: vi.fn(),
    pick: vi.fn(),
    selectCharacter: vi.fn(),
    closeConversation: vi.fn(),
    setMode: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    onAudio: { current: null },
    onEffect: { current: null },
    getAudio: () => undefined,
  }
}

describe('Stage — coach marks', () => {
  let session: SessionApi

  beforeEach(() => {
    localStorage.clear()
    session = fakeSession()
    vi.mocked(useSession).mockReturnValue(session)
  })

  it('shows the overlay and pauses with its own "coach" reason when the flag is absent', () => {
    render(<Stage bundle={bundle} mode="text" resume={false} onEnded={() => {}} onLeave={() => {}} onRestart={() => {}} />)
    expect(screen.getByText(COACH_STEPS[0].copy)).toBeInTheDocument()
    expect(session.pause).toHaveBeenCalledWith('coach')
  })

  it('does not show the overlay (and does not pause for it) when the coach flag is already set', () => {
    localStorage.setItem('sf-coached', '1')
    render(<Stage bundle={bundle} mode="text" resume={false} onEnded={() => {}} onLeave={() => {}} onRestart={() => {}} />)
    expect(screen.queryByText(COACH_STEPS[0].copy)).not.toBeInTheDocument()
    expect(session.pause).not.toHaveBeenCalledWith('coach')
  })

  it('writes the flag, resumes its "coach" reason, and hides on "Got it" at the last step', () => {
    render(<Stage bundle={bundle} mode="text" resume={false} onEnded={() => {}} onLeave={() => {}} onRestart={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    fireEvent.click(screen.getByRole('button', { name: 'Got it' }))

    expect(localStorage.getItem('sf-coached')).toBe('1')
    expect(screen.queryByText(COACH_STEPS[3].copy)).not.toBeInTheDocument()
    expect(session.resume).toHaveBeenCalledWith('coach')
  })

  it('writes the flag, resumes its "coach" reason, and hides immediately on Skip', () => {
    render(<Stage bundle={bundle} mode="text" resume={false} onEnded={() => {}} onLeave={() => {}} onRestart={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }))

    expect(localStorage.getItem('sf-coached')).toBe('1')
    expect(screen.queryByText(COACH_STEPS[0].copy)).not.toBeInTheDocument()
    expect(session.resume).toHaveBeenCalledWith('coach')
  })

  it('holds "coach" distinct from Settings\' own "settings" reason — opening and closing Settings on top of the coach overlay does not unpause it', () => {
    render(<Stage bundle={bundle} mode="text" resume={false} onEnded={() => {}} onLeave={() => {}} onRestart={() => {}} />)
    expect(session.pause).toHaveBeenCalledWith('coach')

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    expect(session.pause).toHaveBeenCalledWith('settings')

    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(session.resume).toHaveBeenCalledWith('settings')

    // The coach overlay's own pause was never touched by that Settings open/close cycle —
    // no reference counting needed since each layer holds a distinct reason.
    expect(session.resume).not.toHaveBeenCalledWith('coach')
    expect(screen.getByText(COACH_STEPS[0].copy)).toBeInTheDocument()
  })

  it('"Replay tips" (via Settings) closes Settings and re-shows the coach overlay through the real Stage wiring', () => {
    localStorage.setItem('sf-coached', '1')
    render(<Stage bundle={bundle} mode="text" resume={false} onEnded={() => {}} onLeave={() => {}} onRestart={() => {}} />)
    expect(screen.queryByText(COACH_STEPS[0].copy)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    fireEvent.click(screen.getByRole('button', { name: 'Replay tips' }))

    // Settings closed...
    expect(screen.queryByRole('button', { name: 'Replay tips' })).not.toBeInTheDocument()
    // ...and the coach overlay is back, from its first step.
    expect(screen.getByText(COACH_STEPS[0].copy)).toBeInTheDocument()
  })
})
