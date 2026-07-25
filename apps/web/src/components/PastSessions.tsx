import type { SessionState } from '@story/schema'
import { useEffect, useState } from 'react'
import { getSession, listSessions } from '../api'

export function PastSessions({ onOpen }: { onOpen: (state: SessionState, storyId: string) => void }) {
  const [sessions, setSessions] = useState<{ sessionId: string; storyId: string; endingId: string | null; updatedAt: number }[]>([])
  useEffect(() => {
    listSessions().then(setSessions).catch(() => {})
  }, [])
  if (sessions.length === 0) return null
  return (
    <div className="mt-10">
      <h2 className="text-sm font-semibold text-slate-400">Past plays</h2>
      <div className="mt-2 flex flex-col gap-2">
        {sessions.map((s) => (
          <button
            key={s.sessionId}
            onClick={() => getSession(s.sessionId).then((st) => onOpen(st, s.storyId)).catch(() => {})}
            className="flex items-center justify-between rounded-xl border border-slate-800 px-4 py-3 text-left text-sm"
          >
            <span>{s.storyId}</span>
            <span className="text-xs text-slate-500">{s.endingId ?? 'unfinished'}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
