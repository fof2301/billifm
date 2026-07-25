import type { EffectContext, FlashlightEvent } from '../types';

/**
 * M2 - the torch takeover. The single loudest moment in the demo.
 *
 * flicker_then_on = 80ms x3 pulses, 400ms gap, then solid for hold_s (Design.md 5).
 *
 * The torch itself is a prop on a mounted <CameraView> in PlayerScreen, not an
 * imperative call - expo-camera 16 removed `Camera.setTorchAsync`. So this handler
 * stays pure and just drives ctx.setTorch().
 *
 * There is no torch in Expo Go. This needs a dev build on the exact demo phone,
 * and that is the Phase 0 gate: if it does not work there, nothing else in M2
 * matters.
 */
export async function run(event: FlashlightEvent, ctx: EffectContext) {
  try {
    // Three quick pulses - her thumb working an old switch.
    for (let i = 0; i < 3; i++) {
      ctx.setTorch(true);
      await sleep(80);
      ctx.setTorch(false);
      await sleep(400);
    }

    // Then it catches and holds.
    ctx.setTorch(true);
    await sleep(event.hold_s * 1000);
    ctx.setTorch(false);
  } catch (err) {
    ctx.log(`torch failed: ${String(err)}`);
    ctx.setTorch(false);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
