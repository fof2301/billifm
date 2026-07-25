import type { SessionState, StoryBundle } from '@story/schema'

export function ChallengeBanner({ bundle, state }: { bundle: StoryBundle; state: SessionState }) {
  if (!state.activeChallenge) return null
  const ch = bundle.challenges.find((c) => c.id === state.activeChallenge!.id)
  if (!ch) return null
  return (
    <p className="pointer-events-none mt-2 rounded-xl bg-red-950/70 px-4 py-2 text-center text-xs text-red-200">
      {ch.prompt}
    </p>
  )
}
