// Render story/linear_script.txt (default path) into five episode MP3s via
// OpenAI TTS, one voice per character, for the #demo episode player.
//
//   node --env-file=.env scripts/generate-episode-audio.mjs            # all 5
//   node --env-file=.env scripts/generate-episode-audio.mjs 1 3        # ep1+ep3
//   node --env-file=.env scripts/generate-episode-audio.mjs --force    # regenerate
//
// Output: apps/web/public/demo-media/riya-calling/ep<N>.mp3 (git-ignored;
// same policy as server/audio — generated audio is too big for git).

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SCRIPT = join(ROOT, 'story/linear_script.txt')
const OUT_DIR = join(ROOT, 'apps/web/public/demo-media/riya-calling')
const KEY = process.env.OPENAI_API_KEY
if (!KEY) throw new Error('OPENAI_API_KEY missing — run with: node --env-file=.env')
const MODEL = process.env.TTS_MODEL || 'gpt-4o-mini-tts'
const CONCURRENCY = 6

const HINGLISH = 'Natural conversational Hinglish with an Indian accent. This is a scripted audio drama.'
const CAST = {
  NARRATOR: { voice: 'ash', base: `${HINGLISH} Deep, measured suspense-narrator; unhurried; lets silences land.` },
  ARJUN: { voice: 'verse', base: `${HINGLISH} Young man, low and tired; grief under control; goes quiet when scared, never loud.` },
  RIYA: { voice: 'nova', base: `${HINGLISH} 19-year-old girl, bright, quick, teasing; drags words playfully; whispers fiercely when afraid.` },
  ZOYA: { voice: 'coral', base: `${HINGLISH} Policewoman, clipped and dry; measured; unimpressed but listening.` },
  DEV: { voice: 'echo', base: `${HINGLISH} Nervous young man; earnest; voice cracks under pressure.` },
  ROHAN: { voice: 'ballad', base: `${HINGLISH} Low, controlled, amused menace; silk over stone; never raises his voice.` },
  MAA: { voice: 'sage', base: `${HINGLISH} Middle-aged mother, thin and worn with grief; gentle.` },
  SANA: { voice: 'shimmer', base: `${HINGLISH} Young woman, soft, unhurried, faintly distant; kind.` },
  KALIA: { voice: 'onyx', base: `${HINGLISH} Rough hired muscle; drunk swagger; lazy threat.` },
  INTRUDER: { voice: 'onyx', base: `${HINGLISH} Flat, muffled, patient; a man who has done this before.` },
  RAMDIN: { voice: 'onyx', base: `${HINGLISH} Old watchman, frightened, pleading.` },
}
const FALLBACK = { voice: 'alloy', base: HINGLISH }

// ---- parse the linear script into per-episode speech blocks ----
const lines = readFileSync(SCRIPT, 'utf8').split('\n')
const episodes = [] // [{n, title, blocks: [{speaker, note, text}]}]
let ep = null
let block = null
const flush = () => {
  if (block && block.text.trim()) ep.blocks.push(block)
  block = null
}
for (const raw of lines) {
  const line = raw.trim()
  const epHead = line.match(/^EPISODE (\d) — (.+)$/)
  if (epHead) {
    if (ep) flush()
    ep = { n: Number(epHead[1]), title: epHead[2], blocks: [] }
    episodes.push(ep)
    continue
  }
  if (!ep) continue
  if (!line) { flush(); continue }
  if (line.startsWith('[') || line.startsWith('=')) { flush(); continue }
  const head = line.match(/^([A-Z][A-Z .']*?)(?:\s*\(([^)]*)\))?:\s*(.*)$/)
  if (head && head[1] === head[1].toUpperCase() && head[1].length <= 20) {
    flush()
    block = { speaker: head[1].split(' ')[0], note: head[2] || '', text: head[3] }
  } else if (block) {
    block.text += ' ' + line
  }
  // lines outside any block (scene headings etc.) are dropped
}
if (ep) flush()

// ---- TTS ----
async function tts(speaker, note, text, attempt = 1) {
  const c = CAST[speaker] ?? FALLBACK
  const instructions = note ? `${c.base} Delivery for this line: ${note}.` : c.base
  const res = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: { authorization: `Bearer ${KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL, voice: c.voice, input: text, instructions, response_format: 'mp3' }),
  })
  if (!res.ok) {
    const err = await res.text()
    if (attempt < 4 && (res.status === 429 || res.status >= 500)) {
      await new Promise((r) => setTimeout(r, attempt * 4000))
      return tts(speaker, note, text, attempt + 1)
    }
    throw new Error(`TTS ${res.status} for ${speaker}: ${err.slice(0, 200)}`)
  }
  return Buffer.from(await res.arrayBuffer())
}

async function renderEpisode(e) {
  const out = join(OUT_DIR, `ep${e.n}.mp3`)
  if (existsSync(out) && !process.argv.includes('--force')) {
    console.log(`ep${e.n}: exists, skipping (use --force)`)
    return
  }
  console.log(`ep${e.n} "${e.title}": ${e.blocks.length} blocks`)
  const buffers = new Array(e.blocks.length)
  let next = 0
  let done = 0
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (next < e.blocks.length) {
        const i = next++
        const b = e.blocks[i]
        buffers[i] = await tts(b.speaker, b.note, b.text)
        if (++done % 10 === 0) console.log(`  ep${e.n}: ${done}/${e.blocks.length}`)
      }
    }),
  )
  // same-encoder MPEG frames concatenate cleanly for playback
  writeFileSync(out, Buffer.concat(buffers))
  console.log(`  ep${e.n}: wrote ${out} (${(Buffer.concat(buffers).length / 1e6).toFixed(1)} MB)`)
}

mkdirSync(OUT_DIR, { recursive: true })
const wanted = process.argv.slice(2).filter((a) => /^\d$/.test(a)).map(Number)
const todo = episodes.filter((e) => wanted.length === 0 || wanted.includes(e.n))
console.log(`Episodes parsed: ${episodes.map((e) => `${e.n}(${e.blocks.length})`).join(' ')}`)
for (const e of todo) await renderEpisode(e)
console.log('ALL DONE')
