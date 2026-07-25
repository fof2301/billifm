/**
 * Thin client for the one FastAPI server. Four endpoints plus static audio.
 * No websockets (architecture.md 5) - the app polls /state when it resumes.
 *
 * Point BASE at your laptop's LAN IP when running on the demo phone.
 * `localhost` is the phone, not your machine.
 */
export const BASE = process.env.EXPO_PUBLIC_SERVER_URL ?? 'http://192.168.1.10:8000';

const LISTENER_ID = 'demo'; // one hardcoded listener (rules.md 2)

/**
 * Audio streams from the server rather than shipping in the bundle, so Content
 * can drop a new ep8.mp3 without an app rebuild. During the hackathon that is
 * worth more than offline playback (which is explicitly out of scope).
 */
export function audioUrl(file: string) {
  return `${BASE}/audio/${file}`;
}

export async function fetchEventTrack(episode = 8) {
  const res = await fetch(`${BASE}/event_track/${episode}`);
  if (!res.ok) throw new Error(`event track ${episode}: ${res.status}`);
  return res.json();
}

export async function fetchState() {
  const res = await fetch(`${BASE}/state?listener_id=${LISTENER_ID}`);
  if (!res.ok) throw new Error(`state: ${res.status}`);
  return res.json();
}

/** Ephemeral token for a browser/app-side OpenAI Realtime session. */
export async function createRealtimeSession(agent: string, decisionId: string) {
  const res = await fetch(`${BASE}/realtime_session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ listener_id: LISTENER_ID, agent, decision_id: decisionId }),
  });
  if (!res.ok) throw new Error(`realtime_session: ${res.status}`);
  return res.json() as Promise<{ client_secret: string; model: string; voice: string }>;
}

export async function postCallEnded(transcript: string, decisionId: string) {
  await fetch(`${BASE}/call_ended`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ listener_id: LISTENER_ID, transcript, decision_id: decisionId }),
  });
}

export async function postSilenceResult(result: 'quiet' | 'noise') {
  await fetch(`${BASE}/silence_result`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ listener_id: LISTENER_ID, result }),
  });
}

export async function postEpisodeComplete(episode: number, path: 'safe' | 'caught') {
  await fetch(`${BASE}/episode_complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ listener_id: LISTENER_ID, episode, path }),
  });
}
