import type { EffectContext, EffectType, EventTrack, TrackEvent } from '../types';

/**
 * The engine is deliberately dumb (rules.md 3): it compares audio position to
 * event.t and calls the handler. Every directorial decision lives in the JSON.
 *
 * Two rules that are easy to get wrong:
 *  1. Events fire exactly once - tracked in `fired`.
 *  2. `pause_audio` events suspend the ticker until they resolve, so a 90-second
 *     villain call does not cause every later event to fire at once on resume.
 *
 * The handler lookup is injected rather than imported so this file pulls in NO
 * native modules - which is what lets harness/engine.test.mjs run the real engine
 * in plain Node and catch ordering bugs before the phone exists.
 */
export const TICK_MS = 250;

export type EffectHandler = (event: any, ctx: EffectContext) => Promise<void>;
export type HandlerResolver = (type: EffectType) => EffectHandler | undefined;

export class EventEngine {
  private fired = new Set<string>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private suspended = false;

  constructor(
    private track: EventTrack,
    private ctx: EffectContext,
    private getPositionMs: () => number,
    private resolve: HandlerResolver
  ) {}

  start() {
    if (this.timer) return;
    this.timer = setInterval(() => this.tick(), TICK_MS);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** Branch events swap the audio source, so the timeline restarts. */
  resetFor(track: EventTrack) {
    this.track = track;
    this.fired.clear();
  }

  private tick() {
    if (this.suspended) return;
    const positionS = this.getPositionMs() / 1000;

    for (const event of this.track.events) {
      if (this.fired.has(event.id)) continue;
      if (positionS < event.t) continue;
      this.fired.add(event.id);
      void this.dispatch(event);
    }
  }

  private async dispatch(event: TrackEvent) {
    const handler = this.resolve(event.type);
    if (!handler) {
      this.ctx.log(`no handler for effect type "${event.type}" - skipping ${event.id}`);
      return;
    }

    // A blocking effect owns the phone until it resolves. Nothing else fires.
    const blocking = event.type === 'fake_call' || event.type === 'mic_listen';
    if (blocking) this.suspended = true;

    try {
      this.ctx.log(`fire ${event.id} ${event.type} @${event.t}s`);
      await handler(event, this.ctx);
    } catch (err) {
      // A dead effect must never take the episode down with it - the audio is
      // the product; the effect is the garnish.
      this.ctx.log(`effect ${event.id} failed: ${String(err)}`);
    } finally {
      if (blocking) this.suspended = false;
    }
  }
}
