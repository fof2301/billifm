import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { StoryBundle, StorySecrets } from '@story/schema'
import { SecretsSchema, StoryBundleSchema } from '@story/schema'

export type StoryRegistry = Map<string, { bundle: StoryBundle; secrets: StorySecrets; dir: string }>

export function loadStories(dir: string): StoryRegistry {
  const registry: StoryRegistry = new Map()
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const storyDir = join(dir, entry.name)
    try {
      const bundle = StoryBundleSchema.parse(
        JSON.parse(readFileSync(join(storyDir, 'story.json'), 'utf8')),
      )
      const secrets = SecretsSchema.parse(
        JSON.parse(readFileSync(join(storyDir, 'secrets.json'), 'utf8')),
      )
      registry.set(bundle.meta.id, { bundle, secrets, dir: storyDir })
    } catch (err) {
      throw new Error(`invalid story "${entry.name}": ${(err as Error).message}`)
    }
  }
  return registry
}
