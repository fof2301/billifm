import type { StoryBundle } from '@story/schema'
import { useState, type ReactNode } from 'react'
import type { SessionApi } from '../useSession'

export function InputDock({
  bundle,
  session,
  voiceSlot,
}: {
  bundle: StoryBundle
  session: SessionApi
  voiceSlot?: ReactNode
}) {
  const { state, busy } = session
  const [draft, setDraft] = useState('')
  const noCharacter = !state.activeCharacterId

  const mcqChallenge =
    state.activeChallenge != null
      ? bundle.challenges.find((c) => c.id === state.activeChallenge!.id && c.type === 'mcq')
      : undefined

  const STARTERS = ['Who are you?', 'What is this place?', 'What do you want from me?']
  const chips = state.suggestedReplies.length > 0 ? state.suggestedReplies : noCharacter ? [] : STARTERS

  const submit = () => {
    const text = draft.trim()
    if (!text || busy || noCharacter) return
    session.send(text)
    setDraft('')
  }

  return (
    <div className="absolute inset-x-0 bottom-0 z-20 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      {state.mode === 'mcq' && (
        <div className="flex flex-col gap-2">
          {mcqChallenge?.type === 'mcq'
            ? mcqChallenge.options.map((o) => (
                <button
                  key={o.id}
                  disabled={busy}
                  onClick={() => session.pick(o.id)}
                  className="rounded-full border border-indigo-500/60 bg-indigo-950/80 px-4 py-2.5 text-sm text-indigo-100 disabled:opacity-50"
                >
                  {o.text}
                </button>
              ))
            : chips.map((s) => (
                <button
                  key={s}
                  disabled={busy || noCharacter}
                  onClick={() => session.send(s)}
                  className="rounded-full border border-white/15 bg-black/60 px-4 py-2.5 text-sm text-slate-100 disabled:opacity-50"
                >
                  {s}
                </button>
              ))}
          {!mcqChallenge && chips.length === 0 && (
            <p className="text-center text-xs text-slate-400">Pick someone to talk to</p>
          )}
        </div>
      )}

      {state.mode === 'text' && (
        <div className="flex items-center gap-2">
          <input
            value={draft}
            disabled={busy || noCharacter}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder={noCharacter ? 'Pick someone to talk to' : 'Say something…'}
            className="min-w-0 flex-1 rounded-full bg-white/10 px-4 py-2.5 text-sm placeholder:text-slate-500 disabled:opacity-50"
          />
          <button
            onClick={submit}
            disabled={busy || noCharacter}
            className="h-10 w-10 shrink-0 rounded-full bg-indigo-600 text-white disabled:opacity-50"
            aria-label="Send"
          >
            ➤
          </button>
        </div>
      )}

      {state.mode === 'voice' &&
        (voiceSlot ?? (
          <p className="text-center text-xs text-slate-500">voice unavailable</p>
        ))}
    </div>
  )
}
