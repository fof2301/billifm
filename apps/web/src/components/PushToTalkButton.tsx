import { useEffect, useRef, useState } from 'react'
import { stt } from '../api'
import { createRecorder } from '../audio'
import type { SessionApi } from '../useSession'

type Phase = 'idle' | 'recording' | 'transcribing' | 'error'

function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-6 w-6" aria-hidden="true">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <path d="M12 18v3" />
    </svg>
  )
}

/** Tap to record, tap again to send — voice-memo style rather than press-and-hold. */
export function PushToTalkButton({ session }: { session: SessionApi }) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [seconds, setSeconds] = useState(0)
  const rec = useRef<ReturnType<typeof createRecorder> | null>(null)
  const disabled = session.busy || !session.state.activeCharacterId

  useEffect(() => {
    if (phase !== 'recording') {
      setSeconds(0)
      return
    }
    const id = setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => clearInterval(id)
  }, [phase])

  const begin = async () => {
    // 'error' must be a valid starting phase — otherwise one failed transcription permanently disables voice input
    if (disabled || (phase !== 'idle' && phase !== 'error')) return
    try {
      rec.current = createRecorder()
      await rec.current.start()
      setPhase('recording')
    } catch {
      setPhase('error')
    }
  }

  const finish = async () => {
    if (phase !== 'recording' || !rec.current) return
    setPhase('transcribing')
    try {
      const blob = await rec.current.stop()
      const { text } = await stt(blob)
      if (!text.trim()) throw new Error('empty')
      session.send(text)
      setPhase('idle')
    } catch {
      setPhase('error')
    }
  }

  const toggle = () => (phase === 'recording' ? finish() : begin())
  const recording = phase === 'recording'

  return (
    <div className="flex flex-col items-center gap-1.5">
      <button
        onClick={toggle}
        disabled={disabled || phase === 'transcribing'}
        aria-label={recording ? 'Stop and send' : 'Record a message'}
        className="relative flex h-16 w-16 items-center justify-center rounded-full text-white shadow-lg transition disabled:opacity-40"
      >
        {recording && (
          <>
            <span className="absolute inset-0 animate-ping rounded-full bg-red-500/40" aria-hidden="true" />
            <span className="absolute -inset-2 animate-pulse rounded-full border border-red-400/40" aria-hidden="true" />
          </>
        )}
        <span
          className={`relative flex h-16 w-16 items-center justify-center rounded-full transition ${
            recording
              ? 'bg-red-500'
              : phase === 'transcribing'
                ? 'bg-slate-700'
                : 'bg-gradient-to-br from-indigo-500 to-violet-600'
          }`}
        >
          {recording ? (
            <span className="h-5 w-5 rounded-[4px] bg-white" aria-hidden="true" />
          ) : phase === 'transcribing' ? (
            <span className="flex gap-1" aria-hidden="true">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white [animation-delay:0ms]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white [animation-delay:120ms]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white [animation-delay:240ms]" />
            </span>
          ) : (
            <MicIcon />
          )}
        </span>
      </button>
      <p className="text-[11px] text-slate-400">
        {disabled && phase !== 'transcribing'
          ? 'pick someone to talk to'
          : recording
            ? `0:${String(seconds).padStart(2, '0')} · tap to send`
            : phase === 'transcribing'
              ? 'listening…'
              : phase === 'error'
                ? "Didn't catch that — try again, or switch mode from ⚙︎"
                : 'tap to speak'}
      </p>
    </div>
  )
}
