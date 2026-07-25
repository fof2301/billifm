import { useRef, useState } from 'react'
import { stt } from '../api'
import { createRecorder } from '../audio'
import type { SessionApi } from '../useSession'

type Phase = 'idle' | 'recording' | 'transcribing' | 'error'

export function PushToTalkButton({ session }: { session: SessionApi }) {
  const [phase, setPhase] = useState<Phase>('idle')
  const rec = useRef<ReturnType<typeof createRecorder> | null>(null)
  const disabled = session.busy || !session.state.activeCharacterId

  const begin = async () => {
    // 'error' must be a valid starting phase — otherwise one failed transcription permanently disables push-to-talk
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

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        onPointerDown={begin}
        onPointerUp={finish}
        onPointerCancel={finish}
        disabled={disabled}
        aria-label="Hold to talk"
        className={`h-16 w-16 touch-none rounded-full text-2xl transition ${
          phase === 'recording' ? 'scale-110 bg-red-500 ring-8 ring-red-500/25' : 'bg-red-600'
        } disabled:opacity-40`}
      >
        🎙
      </button>
      <p className="text-[11px] text-slate-400">
        {disabled
          ? 'pick someone to talk to'
          : phase === 'recording'
            ? 'release to send'
            : phase === 'transcribing'
              ? 'listening…'
              : phase === 'error'
                ? "Didn't catch that — try again, or switch mode from ⚙︎"
                : 'hold to talk'}
      </p>
    </div>
  )
}
