// Constants
const THEME = "theme";
const LIGHT = "light";
const DARK = "dark";
const SYSTEM = "system";

type ThemeMode = typeof LIGHT | typeof DARK | typeof SYSTEM;

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

function setPreference(): void {
  try {
    localStorage.setItem(THEME, themeValue);
  } catch {
    /* storage can be unavailable */
  }
  reflectPreference();
}

function reflectPreference(): void {
  const root = document.firstElementChild;
  root?.setAttribute("data-theme", resolveMode(themeValue));
  root?.setAttribute("data-theme-mode", themeValue);

  const label = themeValue;
  document
    .querySelectorAll<HTMLElement>("#theme-btn, #theme-btn-mobile")
    .forEach(button => {
      button.setAttribute("aria-label", label);
    });

  // Get a reference to the body element
  const body = document.body;

  // Check if the body element exists before using getComputedStyle
  if (body) {
    // Get the computed styles for the body element
    const computedStyles = window.getComputedStyle(body);

    // Get the background color property
    const bgColor = computedStyles.backgroundColor;

    // Set the background color in <meta theme-color ... />
    document
      .querySelector("meta[name='theme-color']")
      ?.setAttribute("content", bgColor);
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
