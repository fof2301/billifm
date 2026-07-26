// Generic content pipeline: give a story an `assets.json` of prompts and this
// generates its portraits, per-phase backgrounds, cover (OpenAI images) and
// ambient loop (ElevenLabs sound generation), then points story.json at them.
// Usage: node --env-file=.env scripts/generate-story-assets.mjs [storyId ...]
//        (no args = every story that has an assets.json)
// Existing files are skipped unless --force.
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const STORIES = join(ROOT, 'stories')
const OPENAI_KEY = process.env.OPENAI_API_KEY
const ELEVEN_KEY = process.env.ELEVENLABS_API_KEY
if (!OPENAI_KEY) throw new Error('OPENAI_API_KEY required')
const FORCE = process.argv.includes('--force')
const only = process.argv.slice(2).filter((a) => !a.startsWith('--'))

const PORTRAIT_STYLE =
  'oil-painted portrait, head and shoulders, plain dark background, museum-quality brushwork, moody lighting, no text, no watermark'
const SCENE_STYLE =
  'painterly digital illustration, cinematic lighting, no people, no text, no watermark, vertical mobile composition'

async function image(prompt, size) {
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${OPENAI_KEY}` },
    body: JSON.stringify({ model: 'gpt-image-1', prompt, size, quality: 'medium', output_format: 'jpeg' }),
  })
  if (!res.ok) throw new Error(`images ${res.status}: ${(await res.text()).slice(0, 200)}`)
  return Buffer.from((await res.json()).data[0].b64_json, 'base64')
}

async function sound(prompt) {
  const res = await fetch('https://api.elevenlabs.io/v1/sound-generation', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'xi-api-key': ELEVEN_KEY },
    body: JSON.stringify({ text: prompt, duration_seconds: 20, prompt_influence: 0.3 }),
  })
  if (!res.ok) throw new Error(`sound ${res.status}: ${(await res.text()).slice(0, 200)}`)
  return Buffer.from(await res.arrayBuffer())
}

/** One retry — the images API occasionally drops a connection mid-read. */
async function withRetry(label, fn) {
  try {
    return await fn()
  } catch (err) {
    console.warn(`  ${label} failed (${(err.message ?? err).toString().slice(0, 80)}), retrying once…`)
    return fn()
  }
}

const storyIds = (only.length ? only : readdirSync(STORIES, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
).filter((id) => existsSync(join(STORIES, id, 'assets.json')))

for (const id of storyIds) {
  const dir = join(STORIES, id)
  const out = join(dir, 'assets')
  mkdirSync(out, { recursive: true })
  const prompts = JSON.parse(readFileSync(join(dir, 'assets.json'), 'utf8'))
  const story = JSON.parse(readFileSync(join(dir, 'story.json'), 'utf8'))
  console.log(`\n=== ${id} ===`)

  for (const [charId, desc] of Object.entries(prompts.portraits ?? {})) {
    const file = `${charId}.jpg`
    if (existsSync(join(out, file)) && !FORCE) { console.log(`skip ${file}`); continue }
    console.log(`portrait ${charId} …`)
    writeFileSync(join(out, file), await withRetry(file, () => image(`${desc}. ${PORTRAIT_STYLE}`, '1024x1024')))
    const c = story.characters.find((x) => x.id === charId)
    if (c) c.portrait = `assets/${file}`
  }

  for (const [phase, desc] of Object.entries(prompts.scenes ?? {})) {
    const file = `${phase}.jpg`
    if (existsSync(join(out, file)) && !FORCE) { console.log(`skip ${file}`); continue }
    console.log(`scene ${phase} …`)
    writeFileSync(join(out, file), await withRetry(file, () => image(`${desc}. ${SCENE_STYLE}`, '1024x1536')))
    story.scene.backgrounds[phase] = `assets/${file}`
  }

  if (prompts.cover && (!existsSync(join(out, 'cover.jpg')) || FORCE)) {
    console.log('cover …')
    writeFileSync(join(out, 'cover.jpg'), await withRetry('cover', () => image(`${prompts.cover}. ${SCENE_STYLE}`, '1024x1536')))
  }
  if (existsSync(join(out, 'cover.jpg'))) story.meta.cover = 'assets/cover.jpg'

  if (prompts.ambient && ELEVEN_KEY && (!existsSync(join(out, 'ambient.mp3')) || FORCE)) {
    console.log('ambient …')
    writeFileSync(join(out, 'ambient.mp3'), await withRetry('ambient', () => sound(prompts.ambient)))
  }
  if (existsSync(join(out, 'ambient.mp3'))) story.scene.ambientAudio = 'assets/ambient.mp3'

  writeFileSync(join(dir, 'story.json'), JSON.stringify(story, null, 2) + '\n')
  console.log(`updated ${id}/story.json`)
}
console.log('\ndone')
