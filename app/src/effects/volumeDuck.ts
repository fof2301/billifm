import type { EffectContext, VolumeDuckEvent } from '../types';

/**
 * M1 - the whisper duck.
 *
 * D4: we attenuate OUR OWN player gain, never system volume. Zero permissions,
 * identical perceived effect. Never hard-cut - the ramp is the drama.
 */
export async function run(event: VolumeDuckEvent, ctx: EffectContext) {
  await ctx.setVolume(event.to, event.ramp_ms);
  await sleep(event.hold_s * 1000);
  await ctx.setVolume(1.0, event.restore_ms);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
