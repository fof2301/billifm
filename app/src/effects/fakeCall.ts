import type { EffectContext, FakeCallEvent } from '../types';

/**
 * M4 - the fake incoming call.
 *
 * This handler owns almost no logic: it pauses the episode and hands the phone
 * to the full-screen call route (screens/FakeCallScreen.tsx), which is where the
 * OpenAI Realtime session actually lives. The engine stays suspended for the
 * whole call because the event is marked blocking.
 *
 * A missed call is canon, not a failure - Meera has a panic variant. So we never
 * throw here; whatever the call screen resolves with, the episode resumes.
 */
export async function run(event: FakeCallEvent, ctx: EffectContext) {
  if (event.pause_audio) await ctx.pauseAudio();

  try {
    await ctx.presentFakeCall(event);
  } catch (err) {
    ctx.log(`call screen failed - treating as missed: ${String(err)}`);
  }

  if (event.pause_audio) await ctx.resumeAudio();
}
