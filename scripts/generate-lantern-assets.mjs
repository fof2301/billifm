// One-off pipeline for the lantern-line bundle: 6 character portraits + 4 phase
// backgrounds + cover, via the OpenAI images API. Portraits are generated rather
// than museum-sourced because the tree screen shows all six faces at once and
// open-access search kept returning the same painting for different queries.
// Usage: node --env-file=.env scripts/generate-lantern-assets.mjs
import { existsSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'stories/lantern-line/assets')
const KEY = process.env.OPENAI_API_KEY
if (!KEY) throw new Error('OPENAI_API_KEY required')

const PORTRAIT_STYLE =
  'oil-painted portrait, head and shoulders, plain dark background, museum-quality brushwork, melancholy lighting, no text, no watermark'
const SCENE_STYLE =
  'painterly digital illustration, cinematic lighting, no people, no text, no watermark, vertical mobile composition'

const PORTRAITS = {
  sera: 'A woman in her late seventies, silver hair pinned back, sharp amused eyes, cardigan, 1990s Britain',
  nadia: 'A severe woman in her sixties, dark high-collared dress, spectacles on a chain, 1950s, bookkeeper',
  tomas: 'A very old man, ninety, thin white hair, gentle bewildered eyes, 1970s cardigan',
  ilsa: 'A hard-faced woman of thirty-five, dark shawl, hair scraped back, 1890s rural Europe, unforgiving expression',
  marren: 'A young woman of twenty, pale, damp dark hair, calm faraway expression, 1890s, faint watery light on her skin',
  wren: 'A woman of forty with kind tired eyes, modern minimal clothing, soft futuristic light, mid-21st century',
}

const SCENES = {
  dusk: 'A cluttered Victorian parlour at dusk: heavy armchair, writing desk, framed photographs, a brass oil lantern glowing on a side table, last blue light at the window',
  midnight: 'The same parlour at midnight: only the brass lantern lit, deep shadows swallowing the furniture, photographs catching the flame',
  'small-hours': 'The same parlour in the small hours: lantern burning low, cold grey seeping under the door, an open ledger on the desk',
  dawn: 'The same parlour at first light: pale dawn through lace curtains, lantern extinguished and smoking faintly, dust in the air',
}

async function image(prompt, size) {
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${KEY}` },
    body: JSON.stringify({ model: 'gpt-image-1', prompt, size, quality: 'medium', output_format: 'jpeg' }),
  })
  if (!res.ok) throw new Error(`images ${res.status}: ${(await res.text()).slice(0, 200)}`)
  return Buffer.from((await res.json()).data[0].b64_json, 'base64')
}

for (const [id, desc] of Object.entries(PORTRAITS)) {
  const path = join(OUT, `${id}.jpg`)
  if (existsSync(path) && process.argv.includes('--skip-existing')) continue
  console.log(`portrait ${id} …`)
  writeFileSync(path, await image(`${desc}. ${PORTRAIT_STYLE}`, '1024x1024'))
}
for (const [phase, desc] of Object.entries(SCENES)) {
  console.log(`scene ${phase} …`)
  writeFileSync(join(OUT, `${phase}.jpg`), await image(`${desc}. ${SCENE_STYLE}`, '1024x1536'))
}
console.log('cover …')
writeFileSync(
  join(OUT, 'cover.jpg'),
  await image(
    `A brass oil lantern burning alone on a dark Victorian side table, faint translucent figures of several generations receding into the shadows behind it, ominous and tender. ${SCENE_STYLE}`,
    '1024x1536',
  ),
)
console.log('done')
