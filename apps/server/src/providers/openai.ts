import OpenAI, { toFile } from 'openai'
import type { Providers } from './types'

export function createOpenAiProviders(cfg: {
  apiKey: string
  dialogueModel: string
  sttModel: string
  ttsModel: string
}): Providers {
  const client = new OpenAI({ apiKey: cfg.apiKey })
  return {
    dialogue: {
      async complete({ system, messages, json }) {
        const res = await client.chat.completions.create({
          model: cfg.dialogueModel,
          messages: [{ role: 'system', content: system }, ...messages],
          ...(json ? { response_format: { type: 'json_object' as const } } : {}),
        })
        return res.choices[0]?.message?.content ?? ''
      },
    },
    stt: {
      async transcribe(audio, mimeType) {
        const ext = mimeType.includes('webm') ? 'webm' : 'mp4'
        const res = await client.audio.transcriptions.create({
          file: await toFile(audio, `speech.${ext}`),
          model: cfg.sttModel,
        })
        return res.text
      },
    },
    tts: {
      async speak(text, voiceId, instructions) {
        const res = await client.audio.speech.create({
          model: cfg.ttsModel,
          voice: voiceId,
          input: text,
          ...(instructions ? { instructions } : {}),
        })
        return Buffer.from(await res.arrayBuffer())
      },
    },
  }
}
