import { z } from 'zod'

export const SecretsSchema = z
  .object({
    characters: z
      .record(
        z.object({ secrets: z.string(), hardLimits: z.string().optional() }).strict(),
      )
      .default({}),
    judging: z.record(z.object({ rubric: z.string() }).strict()).default({}),
  })
  .strict()
export type StorySecrets = z.infer<typeof SecretsSchema>
