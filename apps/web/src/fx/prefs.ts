const KEY = 'sf-effects'

export function effectsEnabled(): boolean {
  return localStorage.getItem(KEY) !== 'off'
}

export function setEffectsEnabled(on: boolean): void {
  localStorage.setItem(KEY, on ? 'on' : 'off')
}
