import { Camera } from 'expo-camera';
import type { EffectContext, FlashlightEvent } from '../types';

/**
 * M2 - the torch takeover. The single loudest moment in the demo.
 *
 * flicker_then_on = 80ms x3 pulses, 400ms gap, then solid for hold_s (Design.md 5).
 * There is no torch API in Expo Go - this requires a dev build. That is the
 * Phase 0 gate, and if it does not work on the exact demo phone, nothing else
 * in M2 matters.
 */
export async function run(event: FlashlightEvent, ctx: EffectContext) {
  try {
    await torch(true);
    await sleep(80);
    await torch(false);
    await sleep(400);
    await torch(true);
    await sleep(80);
    await torch(false);
    await sleep(400);

    await torch(true);
    await sleep(event.hold_s * 1000);
    await torch(false);
  } catch (err) {
    ctx.log(`torch failed: ${String(err)}`);
    await torch(false).catch(() => {});
  }
}

// Kept private to this file - no effect imports another effect (rules.md 3).
async function torch(on: boolean) {
  await Camera.setTorchAsync?.(on);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
