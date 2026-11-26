// Constants
import { soundGain } from "@/scripts/sound";

const THEME = "theme";
const LIGHT = "light";
const DARK = "dark";
const SYSTEM = "system";

type ThemeMode = typeof LIGHT | typeof DARK | typeof SYSTEM;

// Order the dial cycles through, matching the slot angles in header.css.
const THEME_ORDER: ThemeMode[] = [LIGHT, DARK, SYSTEM];

const isThemeMode = (value: string | null): value is ThemeMode =>
  value === LIGHT || value === DARK || value === SYSTEM;

function getPreferredMode(): ThemeMode {
  try {
    const stored = localStorage.getItem(THEME);
    if (isThemeMode(stored)) return stored;
  } catch {
    /* storage can be unavailable */
  }
  return SYSTEM;
}

const resolveMode = (mode: ThemeMode): string =>
  mode === SYSTEM
    ? window.matchMedia("(prefers-color-scheme: dark)").matches
      ? DARK
      : LIGHT
    : mode;

// Use existing theme value from inline script if available, otherwise detect
let themeValue: ThemeMode =
  (window.theme?.themeValue as ThemeMode | undefined) ?? getPreferredMode();
if (!isThemeMode(themeValue)) themeValue = getPreferredMode();

/**
 * Rotates the theme dial so the icon for `mode` swings into the button, the
 * way a rotary switch clicks into place. Each step advances one slot forward,
 * so repeated clicks keep spinning the same direction.
 */
function rotateThemeDials(mode: ThemeMode): void {
  const count = THEME_ORDER.length;
  const index = THEME_ORDER.indexOf(mode);
  if (index < 0) return;

  const stepAngle = 360 / count;

  document.querySelectorAll<HTMLElement>("[data-theme-dial]").forEach(dial => {
    const stored = dial.dataset.dialStep;
    const previous = stored === undefined ? index : Number(stored);
    // Always spin forward, so a mode change reads as a wheel click.
    const step = previous + ((((index - previous) % count) + count) % count);

    // The first paint and repeat renders jump into place; only a real mode
    // change (one slot forward) plays the swing.
    const instant = stored === undefined || step === previous;
    if (instant) dial.setAttribute("data-instant", "");

    dial.style.setProperty("--dial-angle", `${step * -stepAngle}deg`);
    dial.dataset.dialStep = String(step);

    if (instant) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => dial.removeAttribute("data-instant"));
      });
    } else {
      // A stale flag from a hidden-tab first paint must not swallow the swing.
      dial.removeAttribute("data-instant");
    }

    dial
      .querySelectorAll<HTMLElement>("[data-theme-icon]")
      .forEach(slot =>
        slot.toggleAttribute("data-active", slot.dataset.themeIcon === mode)
      );
  });
}

/* Short blip when the mode changes, mirroring the header's sound-effects
   toggle: rising for light, falling for dark, a flat tick for system. */
let themeAudio: AudioContext | null = null;

function playThemeCue(mode: ThemeMode): void {
  try {
    const volume = soundGain();
    if (volume <= 0) return;

    const AudioCtor =
      window.AudioContext ||
      (window as Window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtor) return;

    themeAudio ??= new AudioCtor();
    if (themeAudio.state === "suspended") void themeAudio.resume();

    const ctx = themeAudio;
    const now = ctx.currentTime;
    const [from, to] =
      mode === LIGHT ? [640, 990] : mode === DARK ? [640, 420] : [560, 720];

    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();

    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(from, now);
    oscillator.frequency.exponentialRampToValueAtTime(to, now + 0.08);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.2 * volume, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);

    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.14);
  } catch {
    /* audio is best-effort */
  }
}

function setPreference(): void {
  try {
    localStorage.setItem(THEME, themeValue);
  } catch {
    /* storage can be unavailable */
  }
  reflectPreference();
}

/* The theme-color meta only reflects browser chrome. Update it on first paint;
   on a user switch, wait for the palette animation so the read does not force a
   synchronous style flush mid-transition. */
let themeColorTimer: number | undefined;
let firstReflect = true;

function writeThemeColor(color: string): void {
  document
    .querySelector("meta[name='theme-color']")
    ?.setAttribute("content", color);
}

function syncThemeColor(delay = 340): void {
  window.clearTimeout(themeColorTimer);
  themeColorTimer = window.setTimeout(() => {
    writeThemeColor(
      window.getComputedStyle(document.documentElement).backgroundColor
    );
  }, delay);
}

function reflectPreference(): void {
  const root = document.firstElementChild;
  const resolvedTheme = resolveMode(themeValue);

  root?.setAttribute("data-theme", resolvedTheme);
  root?.setAttribute("data-theme-mode", themeValue);

  const label = themeValue;
  document
    .querySelectorAll<HTMLElement>("#theme-btn, #theme-btn-mobile")
    .forEach(button => {
      button.setAttribute("aria-label", label);
    });

  rotateThemeDials(themeValue);

  if (firstReflect) {
    firstReflect = false;
    writeThemeColor(
      window.getComputedStyle(document.documentElement).backgroundColor
    );
  } else {
    syncThemeColor();
  }
}

// Update the global theme API
if (window.theme) {
  window.theme.setPreference = setPreference;
  window.theme.reflectPreference = reflectPreference;
} else {
  window.theme = {
    themeValue,
    setPreference,
    reflectPreference,
    getTheme: () => themeValue,
    setTheme: (val: string) => {
      if (isThemeMode(val)) themeValue = val;
    },
  };
}

// Ensure theme is reflected (in case body wasn't ready when inline script ran)
reflectPreference();

function setThemeFeature(): void {
  // set on load so screen readers can get the latest value on the button
  reflectPreference();

  // now this script can find and listen for clicks on the control
  const toggleTheme = () => {
    themeValue =
      themeValue === LIGHT ? DARK : themeValue === DARK ? SYSTEM : LIGHT;
    window.theme?.setTheme(themeValue);
    setPreference();
    playThemeCue(themeValue);
  };

  const themeBtn = document.querySelector("#theme-btn");
  const themeBtnMobile = document.querySelector("#theme-btn-mobile");

  // Remove previous listeners to avoid duplicates on view transitions
  const freshBtn = themeBtn?.cloneNode(true) as Element | null;
  if (themeBtn && freshBtn) {
    themeBtn.replaceWith(freshBtn);
    freshBtn.addEventListener("click", toggleTheme);
  }

  const freshBtnMobile = themeBtnMobile?.cloneNode(true) as Element | null;
  if (themeBtnMobile && freshBtnMobile) {
    themeBtnMobile.replaceWith(freshBtnMobile);
    freshBtnMobile.addEventListener("click", toggleTheme);
  }
}

// Set up theme features after page load
setThemeFeature();

// Runs on view transitions navigation
document.addEventListener("astro:after-swap", setThemeFeature);

// Set theme-color value before page transition
// to avoid navigation bar color flickering in Android dark mode
document.addEventListener("astro:before-swap", event => {
  const astroEvent = event;

  // Carry the resolved theme (and accent) into the incoming document before
  // the swap, otherwise the new markup is styled with the light defaults for
  // a frame and every themed surface visibly flashes.
  const rootStyles = document.documentElement;
  const themeAttr = rootStyles.getAttribute("data-theme");
  const accentAttr = rootStyles.getAttribute("data-accent");
  if (themeAttr) {
    astroEvent.newDocument.documentElement.setAttribute(
      "data-theme",
      themeAttr
    );
  }
  if (accentAttr) {
    astroEvent.newDocument.documentElement.setAttribute(
      "data-accent",
      accentAttr
    );
  }

  const bgColor = document
    .querySelector("meta[name='theme-color']")
    ?.getAttribute("content");

  if (bgColor) {
    astroEvent.newDocument
      .querySelector("meta[name='theme-color']")
      ?.setAttribute("content", bgColor);
  }
});

// sync with system changes when the "system" mode is active
window
  .matchMedia("(prefers-color-scheme: dark)")
  .addEventListener("change", () => {
    if (themeValue !== SYSTEM) return;
    reflectPreference();
  });
