export type SoundLevel = 0 | 1 | 2;

export const SOUND_KEY = "sound-fx";
export const SOUND_LEVEL_KEY = "sound-fx-level";

/**
 * The stored `sound-fx` flag stays the on/off source of truth for older parts
 * of the site. The separate level key refines an enabled state into 1 or 2.
 */
export function getSoundLevel(): SoundLevel {
  try {
    if (localStorage.getItem(SOUND_KEY) !== "true") return 0;
    return localStorage.getItem(SOUND_LEVEL_KEY) === "1" ? 1 : 2;
  } catch {
    return 0;
  }
}

export function setSoundLevel(level: SoundLevel): void {
  try {
    localStorage.setItem(SOUND_KEY, String(level > 0));
    if (level > 0) localStorage.setItem(SOUND_LEVEL_KEY, String(level));
  } catch {
    /* storage can be unavailable */
  }
}

/** 1 for the loud level, 0.5 for the quiet level, 0 when muted. */
export function soundGain(): number {
  const level = getSoundLevel();
  return level === 2 ? 1 : level === 1 ? 0.5 : 0;
}
