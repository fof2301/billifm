import type { SessionState, StoryBundle } from '@story/schema'

export function ChallengeBanner({
  bundle,
  state,
  outcome,
  lastPrompt,
}: {
  bundle: StoryBundle
  state: SessionState
  outcome?: 'success' | 'timeout' | null
  lastPrompt?: string | null
}) {
  const active = state.activeChallenge
    ? bundle.challenges.find((c) => c.id === state.activeChallenge!.id)
    : undefined
  // The engine clears activeChallenge immediately on success/timeout, so during the ~1.2s
  // outcome window it may already be null — Stage hands back the just-resolved prompt so
  // the banner can stay mounted long enough to show the outcome styling.
  const prompt = active?.prompt ?? (outcome ? lastPrompt : undefined)
  if (!prompt) return null

  // Chained challenges: the engine can resolve challenge A and activate B in the same
  // dispatch, so Stage's `outcome`/`lastPrompt` can still be A's for up to 1.2s while
  // `active` already points at B. Outcome styling only ever applies on the lastPrompt
  // fallback path (no live challenge) — a live challenge always renders neutral, even if a
  // stale outcome prop hasn't cleared yet.
  const effectiveOutcome = active ? null : outcome
  const outcomeClass =
    effectiveOutcome === 'success'
      ? 'bg-emerald-950/70 text-emerald-200'
      : effectiveOutcome === 'timeout'
        ? 'bg-red-950/70 text-red-200 animate-[shake_0.4s_ease-in-out]'
        : 'bg-red-950/70 text-red-200'

  return (
    <p className={`pointer-events-none mt-2 rounded-xl px-4 py-2 text-center text-xs ${outcomeClass}`}>
      {prompt}
    </p>
  )
}
