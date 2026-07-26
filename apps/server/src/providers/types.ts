export interface DialogueProvider {
  complete(opts: {
    system: string
    messages: { role: 'user' | 'assistant'; content: string }[]
    json?: boolean
  }): Promise<string>
}

export interface SttProvider {
  transcribe(audio: Buffer, mimeType: string): Promise<string>
}

export interface TtsProvider {
  speak(text: string, voiceId: string, instructions?: string): Promise<Buffer>
}

export interface Providers {
  dialogue: DialogueProvider
  stt: SttProvider
  tts: TtsProvider
}
