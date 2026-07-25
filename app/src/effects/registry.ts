import type { EffectContext, EffectType, TrackEvent } from '../types';
import * as volumeDuck from './volumeDuck';
import * as screen from './screen';
import * as flashlight from './flashlight';
import * as haptics from './haptics';
import * as fakeCall from './fakeCall';
import * as micListen from './micListen';

type Handler = (event: any, ctx: EffectContext) => Promise<void>;

/**
 * The only place effect modules are referenced together. Handlers themselves
 * never import each other (rules.md 3) - this map is the seam.
 */
const HANDLERS: Record<EffectType, Handler> = {
  volume_duck: volumeDuck.run,
  screen_dim: screen.run,
  screen_blackout: screen.run,
  flashlight: flashlight.run,
  haptic: haptics.run,
  fake_call: fakeCall.run,
  mic_listen: micListen.run,
};

export function handlerFor(type: TrackEvent['type']): Handler | undefined {
  return HANDLERS[type];
}
