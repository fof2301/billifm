import type { SessionState, StoryBundle, TranscriptEntry } from '@story/schema'

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8787'

export function deviceId(): string {
  let id = localStorage.getItem('sf-device-id')
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem('sf-device-id', id)
  }
  return id
}

export const assetUrl = (storyId: string, path: string) => `${BASE}/stories/${storyId}/${path}`

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      ...(init?.body && !(init.body instanceof FormData)
        ? { 'content-type': 'application/json' }
        : {}),
      'x-device-id': deviceId(),
      ...init?.headers,
    },
  })
  if (!res.ok) throw new Error(`api ${path} failed: ${res.status}`)
  return res.json() as Promise<T>
}

export const listStories = () =>
  req<{ stories: StoryBundle['meta'][] }>('/api/stories').then((r) => r.stories)

export const getStory = (id: string) => req<StoryBundle>(`/api/stories/${id}`)

export interface DialogueResponse {
  text: string
  suggestedReplies?: string[]
  audioBase64?: string
}

export const dialogue = (body: {
  storyId: string
  characterId: string
  session: { beatId: string; flags: string[]; cluesFound: string[]; day: number; phase: string }
  transcriptTail: TranscriptEntry[]
  playerMessage: string
  wantAudio: boolean
  wantSuggestions: boolean
}) => req<DialogueResponse>('/api/dialogue', { method: 'POST', body: JSON.stringify(body) })

export const judge = (body: {
  storyId: string
  challengeId: string
  transcriptTail: TranscriptEntry[]
}) => req<{ success: boolean; feedback: string }>('/api/judge', { method: 'POST', body: JSON.stringify(body) })

export const stt = (blob: Blob) => {
  // iOS Safari's MediaRecorder produces audio/mp4, not audio/webm — name the upload to
  // match what was actually recorded so it isn't mislabeled to the server / Whisper.
  const ext = blob.type.includes('mp4') ? 'mp4' : 'webm'
  const form = new FormData()
  form.append('audio', blob, `speech.${ext}`)
  return req<{ text: string }>('/api/stt', { method: 'POST', body: form })
}

export const snapshot = (sessionId: string, storyId: string, state: SessionState) =>
  req<{ ok: true }>('/api/sessions/snapshot', {
    method: 'POST',
    body: JSON.stringify({ sessionId, storyId, state }),
  })

export const listSessions = () =>
  req<{ sessions: { sessionId: string; storyId: string; endingId: string | null; updatedAt: number }[] }>(
    '/api/sessions',
  ).then((r) => r.sessions)

export const getSession = (id: string) =>
  req<{ state: SessionState }>(`/api/sessions/${id}`).then((r) => r.state)
