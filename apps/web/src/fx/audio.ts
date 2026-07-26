/**
 * Thin Web Audio backend — UNTESTED (jsdom has no AudioContext). Every method silently
 * no-ops until `unlock()` has successfully created a context, so this is safe to call
 * from anywhere without feature-detection at each call site. The tested decision layer
 * that decides WHICH of these to call lives in fx/sound.ts.
 */
export interface AudioBackend {
  unlock(): void
  playSting(): void
  playResolve(): void
  playThud(): void
  playBell(): void
  playTick(): void
  startAmbient(sceneId: string, fileUrl?: string): void
  duckAmbient(): void
  stopAmbient(): void
}

type AmbientSynth = { source: AudioBufferSourceNode; drone?: OscillatorNode; gain: GainNode }
type AmbientFile = { el: HTMLAudioElement }

const DUCK_MS = 1500
const DUCK_LEVEL = 0.2
// Every oscillator note releases to near-zero over this final window instead of
// stopping at whatever amplitude it was holding — an abrupt stop at nonzero gain is
// an audible click/pop, worst on the 30ms square-wave tick (fires up to ~29 times per
// countdown).
const RELEASE_S = 0.008

function createAudioBackend(): AudioBackend {
  let ctx: AudioContext | null = null
  let master: GainNode | null = null
  let ambient: AmbientSynth | AmbientFile | null = null
  let ambientBaseGain = 0
  let duckTimer: ReturnType<typeof setTimeout> | null = null
  let fileRampInterval: ReturnType<typeof setInterval> | null = null

  function unlock(): void {
    if (ctx) {
      void ctx.resume()
      return
    }
    const w = globalThis as unknown as {
      AudioContext?: typeof AudioContext
      webkitAudioContext?: typeof AudioContext
    }
    const Ctor = w.AudioContext ?? w.webkitAudioContext
    if (!Ctor) return // no Web Audio support (or jsdom) — stay locked, every call below no-ops
    ctx = new Ctor()
    master = ctx.createGain()
    master.gain.value = 0.5
    master.connect(ctx.destination)
  }

  // Plays a single oscillator note through the master gain. `freqEnd` !== `freqStart`
  // sweeps the pitch linearly; `decay: 'exp'` ramps the gain down exponentially from
  // `gainStart` to (near) zero, `decay: 'linear'` ramps it linearly to `gainEnd`.
  function note(opts: {
    shape: OscillatorType
    freqStart: number
    freqEnd?: number
    duration: number
    gainStart: number
    gainEnd?: number
    decay: 'linear' | 'exp'
    startAt?: number
  }): void {
    if (!ctx || !master) return
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = opts.shape
    const now = ctx.currentTime + (opts.startAt ?? 0)
    const end = now + opts.duration
    osc.frequency.setValueAtTime(opts.freqStart, now)
    if (opts.freqEnd !== undefined && opts.freqEnd !== opts.freqStart) {
      osc.frequency.linearRampToValueAtTime(opts.freqEnd, end)
    }
    gain.gain.setValueAtTime(opts.gainStart, now)
    if (opts.decay === 'exp') {
      // The whole note IS the decay (thud/bell) — already reaches near-zero exactly
      // at `end`, so no separate release tail is needed.
      gain.gain.exponentialRampToValueAtTime(0.0001, end)
    } else {
      const target = opts.gainEnd ?? 0
      if (target > 0) {
        // A held/swept-to-nonzero note (resolve, tick): sustain at `target` until
        // just before the stop time, then release to near-zero over a short final
        // window so the oscillator never stops while still sounding.
        const release = Math.min(RELEASE_S, opts.duration / 3)
        const releaseStart = end - release
        gain.gain.linearRampToValueAtTime(target, releaseStart)
        gain.gain.linearRampToValueAtTime(0.0001, end)
      } else {
        // Envelope already ramps to true zero across the full duration (sting) —
        // nothing left to release.
        gain.gain.linearRampToValueAtTime(0, end)
      }
    }
    osc.connect(gain)
    gain.connect(master)
    osc.start(now)
    osc.stop(end)
  }

  function playSting(): void {
    if (!ctx) return
    note({ shape: 'sawtooth', freqStart: 110, freqEnd: 55, duration: 0.25, gainStart: 0.3, gainEnd: 0, decay: 'linear' })
  }

  function playResolve(): void {
    if (!ctx) return
    note({ shape: 'sine', freqStart: 523, duration: 0.12, gainStart: 0.2, gainEnd: 0.2, decay: 'linear' })
    note({ shape: 'sine', freqStart: 659, duration: 0.12, gainStart: 0.2, gainEnd: 0.2, decay: 'linear', startAt: 0.12 })
  }

  function playThud(): void {
    if (!ctx) return
    note({ shape: 'sine', freqStart: 70, duration: 0.3, gainStart: 0.4, decay: 'exp' })
  }

  function playBell(): void {
    if (!ctx) return
    note({ shape: 'triangle', freqStart: 880, duration: 1.2, gainStart: 0.25, decay: 'exp' })
  }

  function playTick(): void {
    if (!ctx) return
    note({ shape: 'square', freqStart: 1500, duration: 0.03, gainStart: 0.15, gainEnd: 0.15, decay: 'linear' })
  }

  function stopSynth(a: AmbientSynth): void {
    try {
      a.source.stop()
    } catch {
      // already stopped — fine
    }
    a.drone?.stop()
  }

  function stopAmbient(): void {
    if (duckTimer) {
      clearTimeout(duckTimer)
      duckTimer = null
    }
    if (fileRampInterval) {
      clearInterval(fileRampInterval)
      fileRampInterval = null
    }
    if (!ambient) return
    if ('el' in ambient) {
      ambient.el.pause()
      ambient.el.currentTime = 0
    } else {
      stopSynth(ambient)
    }
    ambient = null
  }

  // Generates a noise buffer: `brownish` runs a leaky random-walk integrator (brown
  // noise), otherwise it's plain white noise (uniform random samples).
  function noiseBuffer(brownish: boolean): AudioBuffer {
    const c = ctx!
    const length = c.sampleRate * 2 // 2s loop
    const buffer = c.createBuffer(1, length, c.sampleRate)
    const data = buffer.getChannelData(0)
    let last = 0
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1
      if (brownish) {
        last = (last + 0.02 * white) / 1.02
        data[i] = last * 3.5 // compensate for the integrator's lower amplitude
      } else {
        data[i] = white
      }
    }
    return buffer
  }

  function startSynthAmbient(sceneId: string): void {
    const c = ctx!
    const m = master!
    const isCellar = sceneId === 'cellar'

    const source = c.createBufferSource()
    source.buffer = noiseBuffer(isCellar)
    source.loop = true

    const filter = c.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = isCellar ? 120 : 800

    const gain = c.createGain()
    gain.gain.value = isCellar ? 0.05 : 0.03
    ambientBaseGain = gain.gain.value

    source.connect(filter)
    filter.connect(gain)
    gain.connect(m)
    source.start()

    let drone: OscillatorNode | undefined
    if (isCellar) {
      drone = c.createOscillator()
      drone.type = 'sine'
      drone.frequency.value = 55
      const droneGain = c.createGain()
      droneGain.gain.value = 0.02
      drone.connect(droneGain)
      droneGain.connect(m)
      drone.start()
    }

    ambient = { source, drone, gain }
  }

  function startFileAmbient(sceneId: string, fileUrl: string): void {
    const el = new Audio(fileUrl)
    el.loop = true
    el.volume = 0.25
    ambientBaseGain = el.volume
    const entry: AmbientFile = { el }
    ambient = entry
    void el.play().catch(() => {
      // iOS (and other un-gestured browser contexts) reject HTMLAudioElement.play() even
      // though the Web Audio context is already unlocked — the unlocked synth ambient
      // would happily play, but a silent rejection here left the scene with no ambient
      // bed at all. Fall back to the synth ambient for this scene instead. Guard against
      // `ambient` having already moved on (stopAmbient/startAmbient ran again before this
      // rejection arrived) so a stale fallback can't clobber whatever's playing now.
      if (ambient !== entry) return
      el.pause()
      startSynthAmbient(sceneId)
    })
  }

  function startAmbient(sceneId: string, fileUrl?: string): void {
    if (!ctx || !master) return
    stopAmbient()
    if (fileUrl) startFileAmbient(sceneId, fileUrl)
    else startSynthAmbient(sceneId)
  }

  // HTMLAudioElement.volume isn't an AudioParam — it has no built-in ramp, so this
  // steps it in small increments over `ms` to approximate the same 50ms fade the
  // synth path gets via linearRampToValueAtTime, instead of an instant jump.
  function fadeVolume(el: HTMLAudioElement, to: number, ms: number): void {
    if (fileRampInterval) {
      clearInterval(fileRampInterval)
      fileRampInterval = null
    }
    const from = el.volume
    const steps = 5
    const stepMs = ms / steps
    let step = 0
    fileRampInterval = setInterval(() => {
      step++
      el.volume = from + (to - from) * (step / steps)
      if (step >= steps && fileRampInterval) {
        clearInterval(fileRampInterval)
        fileRampInterval = null
      }
    }, stepMs)
  }

  function duckAmbient(): void {
    if (!ctx || !ambient) return
    if (duckTimer) clearTimeout(duckTimer)

    if ('el' in ambient) {
      const el = ambient.el
      fadeVolume(el, ambientBaseGain * DUCK_LEVEL, 50)
      duckTimer = setTimeout(() => {
        fadeVolume(el, ambientBaseGain, 50)
        duckTimer = null
      }, DUCK_MS)
      return
    }

    const gainParam = ambient.gain.gain
    const now = ctx.currentTime
    gainParam.cancelScheduledValues(now)
    gainParam.setValueAtTime(ambientBaseGain, now)
    gainParam.linearRampToValueAtTime(ambientBaseGain * DUCK_LEVEL, now + 0.05)
    duckTimer = setTimeout(() => {
      if (!ctx || !ambient || 'el' in ambient) return
      const t = ctx.currentTime
      ambient.gain.gain.cancelScheduledValues(t)
      ambient.gain.gain.setValueAtTime(ambient.gain.gain.value, t)
      ambient.gain.gain.linearRampToValueAtTime(ambientBaseGain, t + 0.05)
      duckTimer = null
    }, DUCK_MS)
  }

  return {
    unlock,
    playSting,
    playResolve,
    playThud,
    playBell,
    playTick,
    startAmbient,
    duckAmbient,
    stopAmbient,
  }
}

let singleton: AudioBackend | null = null

export function getAudioBackend(): AudioBackend {
  if (!singleton) singleton = createAudioBackend()
  return singleton
}
