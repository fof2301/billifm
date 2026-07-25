// Event Track types. This mirrors content/event_track.json and the schema the
// annotation agent emits (director/schema.py) - if you change one, change both.

export type EffectType =
  | 'volume_duck'
  | 'screen_dim'
  | 'screen_blackout'
  | 'flashlight'
  | 'haptic'
  | 'fake_call'
  | 'mic_listen';

export type HapticPattern = 'knock_x3' | 'heartbeat_rising';
export type FlashlightPattern = 'flicker_then_on';

export interface BaseEvent {
  id: string;
  t: number; // seconds into the episode audio
  type: EffectType;
  cue?: string; // the line of script that justifies this effect
  why?: string; // directorial reasoning (the agent writes this too)
}

export interface VolumeDuckEvent extends BaseEvent {
  type: 'volume_duck';
  to: number; // 0..1 gain on OUR player, never system volume
  ramp_ms: number;
  hold_s: number;
  restore_ms: number;
}

export interface ScreenDimEvent extends BaseEvent {
  type: 'screen_dim';
  opacity: number;
  hold_s: number;
  fade_ms: number;
}

export interface ScreenBlackoutEvent extends BaseEvent {
  type: 'screen_blackout';
  duration_s: number;
}

export interface FlashlightEvent extends BaseEvent {
  type: 'flashlight';
  pattern: FlashlightPattern;
  hold_s: number;
}

export interface HapticEvent extends BaseEvent {
  type: 'haptic';
  pattern: HapticPattern;
}

export interface FakeCallEvent extends BaseEvent {
  type: 'fake_call';
  from: string;
  agent: string;
  pause_audio: boolean;
  ring_timeout_s: number;
  decision_id: string;
}

export interface MicListenEvent extends BaseEvent {
  type: 'mic_listen';
  duration_s: number;
  threshold_db: number;
  branch: { quiet: string; noise: string };
}

export type TrackEvent =
  | VolumeDuckEvent
  | ScreenDimEvent
  | ScreenBlackoutEvent
  | FlashlightEvent
  | HapticEvent
  | FakeCallEvent
  | MicListenEvent;

export interface EventTrack {
  episode: number;
  title: string;
  audio: string;
  duration_s: number;
  events: TrackEvent[];
}

/**
 * What an effect handler is allowed to do. Handlers get this and nothing else -
 * no effect imports another effect (rules.md 3).
 */
export interface EffectContext {
  /** Ramp our own player gain. 0..1. */
  setVolume(to: number, rampMs: number): Promise<void>;
  /** Show/hide the overlay. blockTouches is for blackout only. */
  setOverlay(opacity: number, blockTouches: boolean, fadeMs: number): void;
  /** Suspend the position ticker and pause audio (fake_call). */
  pauseAudio(): Promise<void>;
  resumeAudio(): Promise<void>;
  /** Swap the audio source and restart the timeline from 0 (branch events). */
  swapAudio(file: string): Promise<void>;
  /** Hand control to a full-screen route; resolves when that route is done. */
  presentFakeCall(event: FakeCallEvent): Promise<void>;
  log(message: string): void;
}
