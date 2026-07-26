import { useEffect, useState } from 'react'

/**
 * Desktop demo screen (open with `#demo`, e.g. http://localhost:5173/#demo).
 *
 * Left: a video/audio player for the produced episode media.
 * Right: the Billi FM mobile module, live in a phone frame — pick a story,
 * talk to its characters (each has its own persona), meet the ancestors and
 * the dead in the family tree, answer checkpoints by MCQ, text or voice.
 *
 * Media lookup: the first of `/demo-media/riya-calling.mp4` / `.mp3` that
 * exists is played (drop files into apps/web/public/demo-media/). If neither
 * exists the cover art is shown instead — the phone side works regardless.
 */

const MEDIA_CANDIDATES = [
  { src: '/demo-media/riya-calling.mp4', kind: 'video' as const },
  { src: '/demo-media/riya-calling.mp3', kind: 'audio' as const },
]

const COVER = '/stories/riya-calling/assets/cover.svg'

type Media = { src: string; kind: 'video' | 'audio' } | 'none' | 'loading'

export function DemoPlayer() {
  const [media, setMedia] = useState<Media>('loading')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      for (const c of MEDIA_CANDIDATES) {
        try {
          const res = await fetch(c.src, { method: 'HEAD' })
          const type = res.headers.get('content-type') ?? ''
          // Vite's SPA fallback answers missing files with index.html — only
          // accept a response that is actually media.
          if (res.ok && (type.startsWith('video/') || type.startsWith('audio/'))) {
            if (!cancelled) setMedia(c)
            return
          }
        } catch {
          /* try next candidate */
        }
      }
      if (!cancelled) setMedia('none')
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="flex h-dvh flex-col bg-neutral-950 text-neutral-100">
      <header className="flex items-baseline gap-3 border-b border-neutral-800 px-6 py-3">
        <span className="font-serif text-xl tracking-widest text-red-500">BILLI FM</span>
        <span className="text-sm text-neutral-400">Sutradhar · interactive story demo</span>
        <a href="/" className="ml-auto text-sm text-neutral-500 underline-offset-2 hover:text-neutral-300 hover:underline">
          open full app ↗
        </a>
      </header>

      <main className="flex min-h-0 flex-1 items-stretch gap-8 p-6 lg:p-10">
        {/* LEFT — the produced episode */}
        <section className="flex min-w-0 flex-1 flex-col justify-center gap-5">
          <div className="relative overflow-hidden rounded-xl border border-neutral-800 bg-black shadow-2xl">
            {media !== 'none' && media !== 'loading' && media.kind === 'video' && (
              <video className="max-h-[62dvh] w-full" controls poster={COVER} src={media.src} />
            )}
            {media !== 'none' && media !== 'loading' && media.kind === 'audio' && (
              <div className="flex flex-col items-center gap-4 p-6">
                <img src={COVER} alt="Riya Calling" className="max-h-[46dvh] rounded-lg" />
                <audio className="w-full" controls src={media.src} />
              </div>
            )}
            {media === 'none' && (
              <div className="flex flex-col items-center gap-3 p-6">
                <img src={COVER} alt="Riya Calling" className="max-h-[52dvh] rounded-lg" />
                <p className="pb-2 text-center text-xs text-neutral-500">
                  Drop the produced episode as{' '}
                  <code className="text-neutral-400">apps/web/public/demo-media/riya-calling.mp4</code> (or .mp3) to
                  play it here.
                </p>
              </div>
            )}
            {media === 'loading' && <div className="flex h-64 items-center justify-center text-neutral-600">…</div>}
          </div>

          <div>
            <h1 className="font-serif text-3xl">Riya Calling</h1>
            <p className="mt-1 text-neutral-400">Jo teen din pehle chali gayi… uska phone aa raha hai.</p>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-neutral-500">
              5 episodes · 30 paths · 5 endings. Watch the produced episode here — then live it on the phone:
              talk to every character (each has its own persona), call the dead and the ancestors for their side
              of the story, and steer the plot at the checkpoints by choice, text or voice.
            </p>
          </div>
        </section>

        {/* RIGHT — the Billi FM mobile module, live */}
        <section className="flex shrink-0 items-center">
          <div className="rounded-[3rem] border-[10px] border-neutral-800 bg-black shadow-2xl">
            <div className="relative h-[min(812px,82dvh)] w-[375px] overflow-hidden rounded-[2.4rem]">
              <div className="absolute left-1/2 top-2 z-10 h-5 w-28 -translate-x-1/2 rounded-full bg-black" />
              <iframe src="/" title="Billi FM mobile module" className="h-full w-full border-0 bg-neutral-950" />
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
