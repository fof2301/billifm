import { describe, expect, it, vi } from 'vitest'
import { createRecorder } from '../src/audio'

class FakeMediaRecorder {
  static instances: FakeMediaRecorder[] = []
  ondataavailable: ((e: { data: Blob }) => void) | null = null
  onstop: (() => void) | null = null
  mimeType = 'audio/webm'
  constructor(public stream: { getTracks(): { stop(): void }[] }) {
    FakeMediaRecorder.instances.push(this)
  }
  start() {}
  stop() {
    this.ondataavailable?.({ data: new Blob(['x'], { type: this.mimeType }) })
    this.onstop?.()
  }
}

describe('createRecorder', () => {
  it('records a webm blob and releases the mic', async () => {
    const stop = vi.fn()
    vi.stubGlobal('MediaRecorder', FakeMediaRecorder)
    vi.stubGlobal('navigator', {
      mediaDevices: { getUserMedia: vi.fn(async () => ({ getTracks: () => [{ stop }] })) },
    })
    const rec = createRecorder()
    await rec.start()
    const blob = await rec.stop()
    expect(blob.type).toBe('audio/webm')
    expect(stop).toHaveBeenCalled()
    vi.unstubAllGlobals()
  })

  it('labels the blob with the recorder\'s real mimeType (iOS Safari MediaRecorder produces audio/mp4)', async () => {
    const stop = vi.fn()
    vi.stubGlobal('MediaRecorder', FakeMediaRecorder)
    vi.stubGlobal('navigator', {
      mediaDevices: { getUserMedia: vi.fn(async () => ({ getTracks: () => [{ stop }] })) },
    })
    const rec = createRecorder()
    await rec.start()
    FakeMediaRecorder.instances.at(-1)!.mimeType = 'audio/mp4'
    const blob = await rec.stop()
    expect(blob.type).toBe('audio/mp4')
    vi.unstubAllGlobals()
  })

  it('releases the mic if MediaRecorder construction fails', async () => {
    const stop = vi.fn()
    const FailingMediaRecorder = vi.fn(() => {
      throw new Error('recorder init failed')
    })
    vi.stubGlobal('MediaRecorder', FailingMediaRecorder)
    vi.stubGlobal('navigator', {
      mediaDevices: { getUserMedia: vi.fn(async () => ({ getTracks: () => [{ stop }] })) },
    })
    const rec = createRecorder()
    await expect(rec.start()).rejects.toThrow('recorder init failed')
    expect(stop).toHaveBeenCalled()
    vi.unstubAllGlobals()
  })
})
