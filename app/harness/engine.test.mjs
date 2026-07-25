/**
 * Headless test of the REAL event engine. No phone, no audio, no Expo.
 *
 *     npm run test:engine
 *
 * Why this exists: the engine is the one piece where a bug is invisible until it
 * ruins a live demo - an effect firing twice, a whole timeline dumping at once
 * after the villain call, an event silently skipped. Those are all deterministic
 * logic bugs, so they can be caught here at hour 1 instead of at hour 16 in a
 * dark room with judges watching.
 *
 * It compiles src/engine/eventEngine.ts (which imports no native modules, by
 * design) and drives it with a fake clock and recording mock handlers.
 */

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, '..');

// --- compile the engine to plain JS -------------------------------------------
const out = mkdtempSync(join(tmpdir(), 'sutradhar-engine-'));
execFileSync(
  join(APP, 'node_modules/.bin/tsc'),
  [
    join(APP, 'src/engine/eventEngine.ts'),
    '--outDir', out,
    '--module', 'es2022',
    '--target', 'es2022',
    '--moduleResolution', 'bundler',
    '--rootDir', join(APP, 'src'),
    '--skipLibCheck',
  ],
  { stdio: 'inherit' }
);
// tsc mirrors the tree under rootDir, so src/engine/... lands at engine/...
const { EventEngine, TICK_MS } = await import(join(out, 'engine/eventEngine.js'));

// --- harness ------------------------------------------------------------------
let failures = 0;
const results = [];

function check(name, condition, detail = '') {
  results.push({ name, ok: !!condition, detail });
  if (!condition) failures++;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Runs a track against the engine on a fake clock.
 * `speed` compresses episode time: 60 means 1 real second == 60 episode seconds.
 */
async function run(track, { speed = 120, blockingMs = 60 } = {}) {
  const fired = [];
  let positionMs = 0;
  let paused = false;

  const ctx = {
    setVolume: async () => {},
    setTorch: () => {},
    setOverlay: () => {},
    pauseAudio: async () => { paused = true; },
    resumeAudio: async () => { paused = false; },
    swapAudio: async () => {},
    presentFakeCall: async () => { await sleep(blockingMs); },
    log: () => {},
  };

  // Every handler records the position at which it fired, then blocking ones
  // hold the phone for a while - exactly like a real 90-second call.
  const resolve = (type) => async (event) => {
    fired.push({ id: event.id, type, atS: positionMs / 1000 });
    if (type === 'fake_call' || type === 'mic_listen') await sleep(blockingMs);
  };

  const engine = new EventEngine(track, ctx, () => positionMs, resolve);
  engine.start();

  const lastT = Math.max(...track.events.map((e) => e.t));
  const realMsNeeded = ((lastT + 5) / speed) * 1000;
  const startedAt = Date.now();

  // Advance the fake clock only while not paused, like a real audio ticker.
  while (Date.now() - startedAt < realMsNeeded + blockingMs * 4) {
    await sleep(TICK_MS / 4);
    if (!paused) positionMs += (TICK_MS / 4) * speed;
  }
  engine.stop();

  return fired;
}

const TRACK = JSON.parse(readFileSync(join(APP, '../content/event_track.json'), 'utf8'));

// --- 1. every event fires, exactly once, in order -----------------------------
{
  const fired = await run(TRACK);
  const ids = fired.map((f) => f.id);
  const expected = TRACK.events.map((e) => e.id);

  check('all 8 events fire', ids.length === expected.length, `got ${ids.length}: ${ids.join(',')}`);
  check('each fires exactly once', new Set(ids).size === ids.length, `dupes in ${ids.join(',')}`);
  check('fires in timeline order', ids.join(',') === expected.join(','), `${ids.join(',')} vs ${expected.join(',')}`);
}

// --- 2. blocking events suspend the timeline ----------------------------------
// This is the bug that would ruin the demo: if fake_call did not suspend the
// ticker, mic_listen at t=300 would fire the instant the call ended.
{
  const fired = await run(TRACK, { speed: 120, blockingMs: 400 });
  const call = fired.find((f) => f.type === 'fake_call');
  const mic = fired.find((f) => f.type === 'mic_listen');

  check('fake_call fired', !!call);
  check('mic_listen fired', !!mic);
  if (call && mic) {
    // 210 -> 300 is 90 episode-seconds; the gap must survive the blocking call.
    const gap = mic.atS - call.atS;
    check('mic_listen still ~90s after the call', gap > 60, `gap was ${gap.toFixed(1)}s`);
  }
}

// --- 3. a thrown handler must not take the episode down -----------------------
{
  const track = { ...TRACK, events: TRACK.events.slice(0, 4) };
  const fired = [];
  let positionMs = 0;
  const ctx = {
    setVolume: async () => {}, setTorch: () => {}, setOverlay: () => {},
    pauseAudio: async () => {}, resumeAudio: async () => {}, swapAudio: async () => {},
    presentFakeCall: async () => {}, log: () => {},
  };
  // The torch handler explodes, as it would on a device with a broken camera.
  const resolve = (type) => async (event) => {
    if (type === 'haptic') throw new Error('simulated device failure');
    fired.push(event.id);
  };

  const engine = new EventEngine(track, ctx, () => positionMs, resolve);
  engine.start();
  // Jump the clock past every event, then let several real ticks land. Advancing
  // in a tight loop races the 250ms ticker and tells you nothing.
  positionMs = 200_000;
  await sleep(TICK_MS * 4);
  engine.stop();

  check('a failing effect does not stop later effects', fired.includes('e4'), `fired ${fired.join(',')}`);
  check('the throwing effect is the only one missing', !fired.includes('e3'), `fired ${fired.join(',')}`);
}

// --- 4. missing handler is skipped, not crashed -------------------------------
{
  const track = { ...TRACK, events: [{ id: 'x1', t: 1, type: 'teleport_listener' }, TRACK.events[0]] };
  const fired = [];
  let positionMs = 0;
  const ctx = {
    setVolume: async () => {}, setTorch: () => {}, setOverlay: () => {},
    pauseAudio: async () => {}, resumeAudio: async () => {}, swapAudio: async () => {},
    presentFakeCall: async () => {}, log: () => {},
  };
  const resolve = (type) => (type === 'volume_duck' ? async (e) => { fired.push(e.id); } : undefined);

  const engine = new EventEngine(track, ctx, () => positionMs, resolve);
  engine.start();
  positionMs = 200_000;
  await sleep(TICK_MS * 4);
  engine.stop();

  check('unknown effect type is skipped safely', fired.includes('e1'), `fired ${fired.join(',')}`);
}

// --- report -------------------------------------------------------------------
console.log('\nengine harness\n');
for (const r of results) {
  console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.ok ? '' : `\n         ${r.detail}`}`);
}
console.log(`\n${results.length - failures}/${results.length} passed\n`);
process.exit(failures ? 1 : 0);
