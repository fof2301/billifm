import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import Database from 'better-sqlite3'

export interface SessionsDb {
  upsert(row: {
    sessionId: string
    deviceId: string
    storyId: string
    stateJson: string
    endingId: string | null
  }): void
  listByDevice(deviceId: string): {
    sessionId: string
    storyId: string
    endingId: string | null
    updatedAt: number
  }[]
  get(sessionId: string, deviceId: string): { stateJson: string } | undefined
}

export function createSessionsDb(path: string): SessionsDb {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true })
  const db = new Database(path)
  db.pragma('journal_mode = WAL')
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      session_id TEXT PRIMARY KEY,
      device_id  TEXT NOT NULL,
      story_id   TEXT NOT NULL,
      state_json TEXT NOT NULL,
      ending_id  TEXT,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_device ON sessions(device_id, updated_at DESC);
  `)
  const upsert = db.prepare(`
    INSERT INTO sessions (session_id, device_id, story_id, state_json, ending_id, updated_at)
    VALUES (@sessionId, @deviceId, @storyId, @stateJson, @endingId, @updatedAt)
    ON CONFLICT(session_id) DO UPDATE SET
      state_json = excluded.state_json, ending_id = excluded.ending_id, updated_at = excluded.updated_at
  `)
  const list = db.prepare(`
    SELECT session_id AS sessionId, story_id AS storyId, ending_id AS endingId, updated_at AS updatedAt
    FROM sessions WHERE device_id = ? ORDER BY updated_at DESC LIMIT 50
  `)
  const getOne = db.prepare(
    `SELECT state_json AS stateJson FROM sessions WHERE session_id = ? AND device_id = ?`,
  )
  return {
    upsert: (row) => upsert.run({ ...row, updatedAt: Date.now() }),
    listByDevice: (deviceId) => list.all(deviceId) as ReturnType<SessionsDb['listByDevice']>,
    get: (sessionId, deviceId) => getOne.get(sessionId, deviceId) as { stateJson: string } | undefined,
  }
}
