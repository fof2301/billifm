import { afterEach, describe, expect, it, vi } from 'vitest'
import { stt } from '../src/api'

function stubFetchOk() {
  const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
    new Response(JSON.stringify({ text: 'hi' }), { status: 200 }),
  )
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('stt', () => {
  it('names the upload speech.webm for a webm blob', async () => {
    const fetchMock = stubFetchOk()
    await stt(new Blob(['x'], { type: 'audio/webm' }))
    const [, init] = fetchMock.mock.calls[0]!
    const form = init!.body as FormData
    expect((form.get('audio') as File).name).toBe('speech.webm')
  })

  it('names the upload speech.mp4 for an mp4 blob (iOS Safari MediaRecorder output)', async () => {
    const fetchMock = stubFetchOk()
    await stt(new Blob(['x'], { type: 'audio/mp4' }))
    const [, init] = fetchMock.mock.calls[0]!
    const form = init!.body as FormData
    expect((form.get('audio') as File).name).toBe('speech.mp4')
  })
})
