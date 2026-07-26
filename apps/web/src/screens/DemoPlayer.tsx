import { useEffect, useState } from 'react'

/**
 * Desktop demo screen (open with `#demo`, e.g. http://localhost:5173/#demo).
 *
 * Left: an episode-wise audio player for the produced show (five episodes,
 * default path). Right: the Billi FM mobile module, live in a phone frame —
 * pick a story, talk to its characters (each has its own persona), meet the
 * ancestors and the dead in the family tree, answer checkpoints by MCQ,
 * text or voice.
 *
 * Episode audio lives at `/demo-media/riya-calling/ep<N>.mp3` — generate it
 * with `node --env-file=.env scripts/generate-episode-audio.mjs`. Episodes
 * that exist appear in the list; the rest show as "not rendered".
 */

const COVER = '/stories/riya-calling/assets/cover.svg'

const EPISODES = [
  { n: 1, title: 'Missed Call', hook: 'Teen din baad, 2:07 AM — Riya 💜 calling…' },
  { n: 2, title: 'Teen Din, Teen Raat', hook: 'Brake kati hui thi. Yeh accident nahi tha.' },
  { n: 3, title: 'Parchhaai', hook: 'Ghar mein koi hai. Saans mat lena.' },
  { n: 4, title: 'Kaanch Ka Mahal', hook: 'Chaddha showroom ke records — raat mein.' },
  { n: 5, title: '11:58', hook: 'Wahi raat. Aakhri call.' },
] as const

const epSrc = (n: number) => `/demo-media/riya-calling/ep${n}.mp3`

export function DemoPlayer() {
  const [available, setAvailable] = useState<Set<number> | null>(null)
  const [selected, setSelected] = useState<number>(1)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const found = new Set<number>()
      await Promise.all(
        EPISODES.map(async (e) => {
          try {
            const res = await fetch(epSrc(e.n), { method: 'HEAD' })
            const type = res.headers.get('content-type') ?? ''
            // Vite's SPA fallback answers missing files with index.html —
            // only accept a response that is actually audio.
            if (res.ok && type.startsWith('audio/')) found.add(e.n)
          } catch {
            /* not rendered */
          }
        }),
      )
      if (!cancelled) {
        setAvailable(found)
        const first = EPISODES.find((e) => found.has(e.n))
        if (first) setSelected(first.n)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const current = EPISODES.find((e) => e.n === selected)!
  const playable = available?.has(selected) ?? false

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
        {/* LEFT — the produced show, episode-wise */}
        <section className="flex min-w-0 flex-1 flex-col justify-center gap-5">
          <div className="flex gap-6 rounded-xl border border-neutral-800 bg-black p-6 shadow-2xl">
            <img src={COVER} alt="Riya Calling" className="hidden max-h-[46dvh] w-56 shrink-0 rounded-lg object-cover lg:block" />
            <div className="flex min-w-0 flex-1 flex-col">
              <h1 className="font-serif text-3xl">Riya Calling</h1>
              <p className="mt-1 text-sm text-neutral-400">Jo teen din pehle chali gayi… uska phone aa raha hai.</p>

              <ol className="mt-5 flex flex-col gap-2">
                {EPISODES.map((e) => {
                  const has = available?.has(e.n) ?? false
                  const active = e.n === selected
                  return (
                    <li key={e.n}>
                      <button
                        onClick={() => setSelected(e.n)}
                        disabled={!has}
                        className={`w-full rounded-lg border px-4 py-2.5 text-left transition ${
                          active
                            ? 'border-red-500/60 bg-red-500/10'
                            : has
                              ? 'border-neutral-800 hover:border-neutral-600'
                              : 'border-neutral-900 opacity-40'
                        }`}
                      >
                        <span className="flex items-baseline gap-3">
                          <span className="font-serif text-lg text-red-400">EP {e.n}</span>
                          <span className="font-medium">{e.title}</span>
                          {!has && <span className="ml-auto text-xs text-neutral-600">not rendered</span>}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-neutral-500">{e.hook}</span>
                      </button>
                    </li>
                  )
                })}
              </ol>

              <div className="mt-5">
                {playable ? (
                  <audio key={selected} className="w-full" controls src={epSrc(selected)} />
                ) : (
                  <p className="text-xs text-neutral-500">
                    {available === null
                      ? 'Checking episodes…'
                      : `EP ${current.n} isn't rendered yet — run node --env-file=.env scripts/generate-episode-audio.mjs`}
                  </p>
                )}
              </div>
            </div>
          </div>

          <p className="max-w-xl text-sm leading-relaxed text-neutral-500">
            5 episodes · 30 paths · 5 endings. Listen to the produced episodes here — then live the story on the
            phone: talk to every character (each has its own persona), call the dead and the ancestors for their
            side of the story, and steer the plot at the checkpoints by choice, text or voice.
          </p>
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
