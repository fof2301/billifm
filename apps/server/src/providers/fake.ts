import type { Providers } from './types'

export function createFakeProviders(overrides: Partial<Providers> = {}): Providers {
  return {
    dialogue: { complete: async () => JSON.stringify({ reply: 'fake reply' }) },
    stt: { transcribe: async () => 'fake transcript' },
    tts: { speak: async () => Buffer.from('fake-audio') },
    ...overrides,
  }
}
