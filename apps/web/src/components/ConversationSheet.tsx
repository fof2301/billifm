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
  onClose,
  getAudio,
  onReplay,
}: {
  bundle: StoryBundle
  state: SessionState
  busy: boolean
  stallLine: string | null
  failedMessage: string | null
  onRetry: () => void
  onClose?: () => void
  getAudio?: (characterId: string, index: number) => string | undefined
  onReplay?: (b64: string) => void
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
    <div className="pointer-events-auto mb-2 flex max-h-[42dvh] min-h-0 animate-[slideup_0.25s_ease-out] flex-col rounded-2xl border border-white/10 bg-slate-950/80">
      <div className="flex items-start justify-between gap-2 px-4 pt-3">
        <p className="min-w-0 text-[11px] uppercase tracking-wide text-slate-400">
          {character?.name} — {character?.role}
        </p>
        {onClose && (
          <button
            onClick={onClose}
            aria-label="Close conversation"
            className="-mr-1 -mt-1 shrink-0 rounded-full px-2 py-1 text-sm leading-none text-slate-400 transition hover:bg-white/10 hover:text-slate-100"
          >
            ✕
          </button>
        )}
      </div>
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto p-3">
        {entries.map((e, i) => {
          // Only the newest line, and only when it's the character speaking, types out —
          // once a later entry arrives, this one is no longer last and renders as plain
          // text from then on (it never restarts, since it's simply not wrapped anymore).
          const isTyping = i === entries.length - 1 && e.role === 'character'
          const audio = e.role === 'character' && charId ? getAudio?.(charId, i) : undefined
          return (
            <p
              key={i}
              className={`my-1 max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                e.role === 'player' ? 'ml-auto bg-indigo-600 text-white' : 'bg-white/10 text-slate-100'
              }`}
            >
              {isTyping ? <TypewriterText text={e.text} onStep={scrollToBottom} /> : e.text}
              {audio && onReplay && (
                <button
                  onClick={() => onReplay(audio)}
                  aria-label="Replay line"
                  className="ml-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/10 align-middle text-[10px] transition hover:bg-white/20"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" className="h-3 w-3" aria-hidden="true">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </button>
              )}
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
