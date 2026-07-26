import type { StoryBundle } from '@story/schema'
import { useEffect, useState, type ReactNode } from 'react'
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

  const [online, setOnline] = useState(navigator.onLine)
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  // Chips mount at opacity-0/translate-y-1 then flip to visible right after first paint,
  // each with its own transitionDelay (i * 60ms) — a one-shot staggered entrance, not a
  // keyframe, so it composes with each chip's own transition duration.
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(id)
  }, [])
  const chipTransitionClass = `transition duration-300 ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-1 opacity-0'}`

  const mcqChallenge =
    state.activeChallenge != null
      ? bundle.challenges.find((c) => c.id === state.activeChallenge!.id && c.type === 'mcq')
      : undefined

  const STARTERS = ['Who are you?', 'What is this place?', 'What do you want from me?']
  const chips = state.suggestedReplies.length > 0 ? state.suggestedReplies : noCharacter ? [] : STARTERS

  const submit = () => {
    const text = draft.trim()
    if (!text || busy || noCharacter || !online) return
    session.send(text)
    setDraft('')
  }

  return (
    <div className="pointer-events-auto">
      {!online && (
        <p className="mb-2 rounded-xl bg-amber-950/70 px-3 py-2 text-center text-xs text-amber-200">
          You're offline — hang tight.
        </p>
      )}

      {state.mode === 'mcq' && (
        <div className="flex flex-col gap-2">
          {mcqChallenge?.type === 'mcq'
            ? mcqChallenge.options.map((o, i) => (
                <button
                  key={o.id}
                  disabled={busy || !online}
                  onClick={() => session.pick(o.id)}
                  style={{ transitionDelay: `${i * 60}ms` }}
                  className={`rounded-full border border-indigo-500/60 bg-indigo-950/80 px-4 py-2.5 text-sm text-indigo-100 disabled:opacity-50 ${chipTransitionClass}`}
                >
                  {o.text}
                </button>
              ))
            : chips.map((s, i) => (
                <button
                  key={s}
                  disabled={busy || noCharacter || !online}
                  onClick={() => session.send(s)}
                  style={{ transitionDelay: `${i * 60}ms` }}
                  className={`rounded-full border border-white/15 bg-black/60 px-4 py-2.5 text-sm text-slate-100 disabled:opacity-50 ${chipTransitionClass}`}
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
            disabled={busy || noCharacter || !online}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder={noCharacter ? 'Pick someone to talk to' : 'Say something…'}
            className="min-w-0 flex-1 rounded-full bg-white/10 px-4 py-2.5 text-sm placeholder:text-slate-500 disabled:opacity-50"
          />
          <button
            onClick={submit}
            disabled={busy || noCharacter || !online}
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
