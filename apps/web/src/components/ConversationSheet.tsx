import type { SessionState, StoryBundle } from '@story/schema'
import { useEffect, useRef } from 'react'
import { TypewriterText } from '../fx/TypewriterText'

export function ConversationSheet({
  bundle,
  state,
  busy,
  stallLine,
  failedMessage,
  onRetry,
}: {
  bundle: StoryBundle
  state: SessionState
  busy: boolean
  stallLine: string | null
  failedMessage: string | null
  onRetry: () => void
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const charId = state.activeCharacterId
  const entries = charId ? (state.transcripts[charId] ?? []) : []
  const character = bundle.characters.find((c) => c.id === charId)

  const scrollToBottom = () => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }

  useEffect(() => {
    scrollToBottom()
  }, [entries.length, stallLine])

  if (!charId) return null
  return (
    <div className="pointer-events-auto mb-2 flex max-h-[42dvh] min-h-0 flex-col rounded-2xl border border-white/10 bg-slate-950/80">
      <p className="px-4 pt-3 text-[11px] uppercase tracking-wide text-slate-400">
        {character?.name} — {character?.role}
      </p>
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto p-3">
        {entries.map((e, i) => {
          // Only the newest line, and only when it's the character speaking, types out —
          // once a later entry arrives, this one is no longer last and renders as plain
          // text from then on (it never restarts, since it's simply not wrapped anymore).
          const isTyping = i === entries.length - 1 && e.role === 'character'
          return (
            <p
              key={i}
              className={`my-1 max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                e.role === 'player' ? 'ml-auto bg-indigo-600 text-white' : 'bg-white/10 text-slate-100'
              }`}
            >
              {isTyping ? <TypewriterText text={e.text} onStep={scrollToBottom} /> : e.text}
            </p>
          )
        })}
        {busy && <p className="my-1 max-w-[85%] rounded-xl bg-white/5 px-3 py-2 text-sm italic text-slate-400">{stallLine ?? '…'}</p>}
        {failedMessage && (
          <button onClick={onRetry} className="my-1 w-full rounded-xl border border-red-500/40 bg-red-950/40 px-3 py-2 text-xs text-red-200">
            Couldn't reach them — tap to retry
          </button>
        )}
      </div>
    </div>
  )
}
