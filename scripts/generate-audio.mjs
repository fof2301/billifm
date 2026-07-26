// Content pipeline: generate ambient room-tone loops for story scenes via the
// ElevenLabs sound-generation API, keep them as story assets, and point each
// story.json's scene.ambientAudio at the file. The web player treats these
// files as overrides — without them it falls back to synthesized room-tone,
// so deleting a file cleanly reverts a story to the license-free base layer.
// Usage: node --env-file=.env scripts/generate-audio.mjs [--force]
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const KEY = process.env.ELEVENLABS_API_KEY
if (!KEY) throw new Error('ELEVENLABS_API_KEY required (run with: node --env-file=.env scripts/generate-audio.mjs)')
const FORCE = process.argv.includes('--force')

const AMBIENTS = {
  'kidnapping-escape':
    'Low ominous basement room tone: deep concrete rumble, faint electrical hum from a bare bulb, occasional distant water drip, claustrophobic and tense. Seamless loop, no melody, no voices.',
  'ancestor-tree':
    'Warm quiet attic room tone: soft wood creaks, gentle muffled wind outside, faint dust-settling stillness, nostalgic and calm. Seamless loop, no melody, no voices.',
}

async function generateSound(prompt) {
  const res = await fetch('https://api.elevenlabs.io/v1/sound-generation', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'xi-api-key': KEY },
    body: JSON.stringify({ text: prompt, duration_seconds: 20, prompt_influence: 0.3 }),
  })
  if (!res.ok) throw new Error(`sound-generation ${res.status}: ${(await res.text()).slice(0, 300)}`)
  return Buffer.from(await res.arrayBuffer())
}

for (const [storyId, prompt] of Object.entries(AMBIENTS)) {
  const rel = 'assets/ambient.mp3'
  const abs = join(ROOT, 'stories', storyId, rel)
  if (existsSync(abs) && !FORCE) {
    console.log(`skip ${storyId}/${rel} (exists)`)
  } else {
    console.log(`generating ${storyId}/${rel} …`)
    const audio = await generateSound(prompt)
    writeFileSync(abs, audio)
    console.log(`  wrote ${(audio.length / 1024).toFixed(0)} KB`)
  }
  const storyPath = join(ROOT, 'stories', storyId, 'story.json')
  const story = JSON.parse(readFileSync(storyPath, 'utf8'))
  story.scene.ambientAudio = rel
  writeFileSync(storyPath, JSON.stringify(story, null, 2) + '\n')
  console.log(`updated ${storyId}/story.json (scene.ambientAudio)`)
}
console.log('done')
