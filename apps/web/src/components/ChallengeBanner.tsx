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

  const outcomeClass =
    outcome === 'success'
      ? 'bg-emerald-950/70 text-emerald-200'
      : outcome === 'timeout'
        ? 'bg-red-950/70 text-red-200 animate-[shake_0.4s_ease-in-out]'
        : 'bg-red-950/70 text-red-200'

  return (
    <p className={`pointer-events-none mt-2 rounded-xl px-4 py-2 text-center text-xs ${outcomeClass}`}>
      {prompt}
    </p>
  )
}
