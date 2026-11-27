import { navigate } from "astro:transitions/client";
import { prefetch } from "astro:prefetch";
import {
  SOUND_KEY,
  SOUND_LEVEL_KEY,
  getSoundLevel,
  setSoundLevel,
  type SoundLevel,
} from "@/scripts/sound";

let scrollCleanup: AbortController | null = null;
let mobileNavCleanup: AbortController | null = null;
let moreCleanup: AbortController | null = null;
let languageCleanup: AbortController | null = null;

const MENU_LANGUAGE_KEY = "mobile-menu-open-after-language";

let appearanceBound = false;
let soundBound = false;
let soundLevel: SoundLevel = 0;
let audioContext: AudioContext | null = null;

function readStored(key: string, fallback = "") {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function writeStored(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage can be unavailable in private mode */
  }
}

function playSoundCue(level: SoundLevel) {
  try {
    const AudioCtor =
      window.AudioContext ||
      (window as Window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;

    if (!AudioCtor) return;
    audioContext ??= new AudioCtor();

    if (audioContext.state === "suspended") {
      void audioContext.resume();
    }

    const now = audioContext.currentTime;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();

    oscillator.type = "sine";
    if (level === 0) {
      oscillator.frequency.setValueAtTime(600, now);
      oscillator.frequency.exponentialRampToValueAtTime(250, now + 0.05);
    } else {
      oscillator.frequency.setValueAtTime(520, now);
      oscillator.frequency.exponentialRampToValueAtTime(1040, now + 0.06);
    }

    // Level 1 is quieter than level 2, but still clearly audible; muting still
    // gives a soft click.
    const peak = level === 0 ? 0.08 : level === 1 ? 0.14 : 0.24;
    gain.gain.setValueAtTime(peak, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.08);
  } catch {
    /* audio is best-effort */
  }
}

function syncSoundToggles() {
  document
    .querySelectorAll<HTMLElement>("[data-sound-toggle]")
    .forEach(button => {
      const enabled = soundLevel > 0;
      button.dataset.soundLevel = String(soundLevel);
      button.classList.toggle("active", enabled);
      button.classList.toggle("muted", !enabled);
      button.setAttribute("aria-pressed", String(enabled));

      const label = button.querySelector<HTMLElement>("[data-sound-label]");
      if (!label) return;

      const on =
        button.dataset.labelOn ?? button.getAttribute("data-label-on") ?? "On";
      const off =
        button.dataset.labelOff ??
        button.getAttribute("data-label-off") ??
        "Muted";
      label.textContent = enabled ? on : off;
    });
}

function setupSoundFx() {
  soundLevel = getSoundLevel();
  syncSoundToggles();

  if (soundBound) return;
  soundBound = true;

  document.addEventListener(
    "click",
    event => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const toggle = target.closest<HTMLElement>("[data-sound-toggle]");
      if (toggle) {
        soundLevel = ((soundLevel + 1) % 3) as SoundLevel;
        setSoundLevel(soundLevel);
        syncSoundToggles();
        playSoundCue(soundLevel);
        return;
      }
    },
    true
  );

  document.addEventListener("astro:page-load", syncSoundToggles);

  window.addEventListener("storage", event => {
    if (event.key !== SOUND_KEY && event.key !== SOUND_LEVEL_KEY) return;
    soundLevel = getSoundLevel();
    syncSoundToggles();
  });
}

function setupAppearance() {
  const storedAccent = readStored("accent", "blue");
  const accent = [
    "blue",
    "purple",
    "green",
    "amber",
    "rose",
    "cyan",
    "teal",
    "orange",
    "pink",
    "indigo",
  ].includes(storedAccent)
    ? storedAccent
    : "blue";
  document.documentElement.setAttribute("data-accent", accent);
  document.documentElement.style.removeProperty("--accent");

  if (appearanceBound) return;
  appearanceBound = true;

  document.addEventListener(
    "click",
    event => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const swatch = target.closest<HTMLElement>("[data-accent-color]");
      if (!swatch) return;

      const nextAccent = swatch.dataset.accentColor || "blue";
      document.documentElement.setAttribute("data-accent", nextAccent);
      document.documentElement.style.removeProperty("--accent");
      writeStored("accent", nextAccent);
    },
    true
  );
}

function setupScrollPhysics() {
  if (scrollCleanup) scrollCleanup.abort();
  scrollCleanup = new AbortController();
  const { signal } = scrollCleanup;

  const header = document.getElementById("main-header");
  if (!header) return;

  let rafPending = false;
  const handleScroll = () => {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(() => {
      // Past 80px the floater pulls toward the centre of the page: its
      // max-width shrinks and the glass surface fades in (both in CSS).
      // The class is only toggled on threshold crossings, so the bar keeps
      // a single steady compact state instead of tracking every scroll tick.
      const scrolled = window.scrollY > 80;
      header.classList.toggle("header-scrolled", scrolled);
      rafPending = false;
    });
  };

  window.addEventListener("scroll", handleScroll, { passive: true, signal });
  handleScroll(); // Init instantly
}

function setupMobileNav() {
  if (mobileNavCleanup) mobileNavCleanup.abort();
  mobileNavCleanup = new AbortController();
  const { signal } = mobileNavCleanup;

  const menuBtn = document.querySelector("#menu-btn");
  const mobileMenu = document.querySelector<HTMLDivElement>("#mobile-menu");
  const backdrop = document.querySelector(".mobile-menu-backdrop");

  if (!menuBtn || !mobileMenu) return;

  const labelOpen = menuBtn.getAttribute("data-label-open") || "Open Menu";
  const labelClose = menuBtn.getAttribute("data-label-close") || "Close Menu";
  const menuLanguageKey = MENU_LANGUAGE_KEY;

  // The header persists across language switches; keep the state-managed
  // trigger label in the current language without resetting the menu state.
  menuBtn.setAttribute(
    "aria-label",
    mobileMenu.classList.contains("is-open") ? labelClose : labelOpen
  );

  // The dimming backdrop must start below the sticky header, otherwise it
  // darkens the header band and the sheet no longer looks fused with it.
  const syncMenuTop = () => {
    const header = document.getElementById("main-header");
    const top = header?.offsetHeight ?? 0;
    mobileMenu.style.setProperty("--menu-top", `${top}px`);
  };

  const closeMenu = () => {
    menuBtn.setAttribute("aria-expanded", "false");
    menuBtn.setAttribute("aria-label", labelOpen);
    mobileMenu.classList.remove("is-open");
    mobileMenu.setAttribute("aria-hidden", "true");
  };

  const openMenu = (instant = false) => {
    syncMenuTop();
    if (instant) mobileMenu.classList.add("is-instant");
    menuBtn.setAttribute("aria-expanded", "true");
    menuBtn.setAttribute("aria-label", labelClose);
    mobileMenu.classList.add("is-open");
    mobileMenu.setAttribute("aria-hidden", "false");
    if (instant) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => mobileMenu.classList.remove("is-instant"));
      });
    }
  };

  syncMenuTop();
  window.addEventListener("resize", syncMenuTop, { passive: true, signal });

  menuBtn.addEventListener(
    "click",
    () => {
      const isOpen = menuBtn.getAttribute("aria-expanded") === "true";
      if (isOpen) {
        closeMenu();
      } else {
        openMenu();
      }
    },
    { signal }
  );

  if (backdrop) {
    backdrop.addEventListener("click", closeMenu, { signal });
  }

  mobileMenu.querySelectorAll("a").forEach(link => {
    link.addEventListener(
      "click",
      () => {
        if (link.hasAttribute("data-lang-toggle")) return;
        closeMenu();
      },
      { signal }
    );
  });

  // A language switch navigates, but the menu was open when the user pressed
  // the toggle. Restore it already-expanded, without replaying the animation.
  if (window.matchMedia("(max-width: 1023px)").matches) {
    let reopenAfterLanguage = false;
    try {
      reopenAfterLanguage = sessionStorage.getItem(menuLanguageKey) === "1";
      if (reopenAfterLanguage) sessionStorage.removeItem(menuLanguageKey);
    } catch {
      /* storage can be unavailable */
    }
    if (reopenAfterLanguage && !mobileMenu.classList.contains("is-open")) {
      openMenu(true);
    }
  }
}

function setupMorePopover() {
  if (moreCleanup) moreCleanup.abort();
  moreCleanup = new AbortController();
  const { signal } = moreCleanup;

  const moreBtn = document.getElementById("more-btn");
  const morePopover = document.getElementById("more-popover");

  if (!moreBtn || !morePopover) return;

  const openPopover = () => {
    moreBtn.setAttribute("aria-expanded", "true");
    morePopover.classList.remove("hidden");
  };

  const closePopover = () => {
    moreBtn.setAttribute("aria-expanded", "false");
    morePopover.classList.add("hidden");
  };

  moreBtn.addEventListener(
    "click",
    e => {
      e.stopPropagation();
      const isExpanded = moreBtn.getAttribute("aria-expanded") === "true";
      if (isExpanded) {
        closePopover();
      } else {
        openPopover();
      }
    },
    { signal }
  );

  // Close when clicking outside
  document.addEventListener(
    "click",
    e => {
      const target = e.target as HTMLElement;
      if (
        !morePopover.classList.contains("hidden") &&
        !morePopover.contains(target) &&
        target !== moreBtn &&
        !moreBtn.contains(target)
      ) {
        closePopover();
      }
    },
    { signal }
  );

  // Close popover on Escape key
  document.addEventListener(
    "keydown",
    e => {
      if (e.key === "Escape" && !morePopover.classList.contains("hidden")) {
        closePopover();
        moreBtn.focus();
      }
    },
    { signal }
  );

  // Close popover on scroll. A language switch restores the scroll position
  // on the incoming page; that synthetic scroll must not close a popover the
  // user had open (the header itself is persisted).
  window.addEventListener(
    "scroll",
    () => {
      if (document.documentElement.dataset.langSwitching === "1") return;
      closePopover();
    },
    { passive: true, signal }
  );

  // Close popover when focus leaves the container
  morePopover.addEventListener(
    "focusout",
    e => {
      const relatedTarget = e.relatedTarget as HTMLElement;
      if (
        relatedTarget &&
        !morePopover.contains(relatedTarget) &&
        relatedTarget !== moreBtn
      ) {
        closePopover();
      }
    },
    { signal }
  );

  // Close popover when a link inside is clicked
  morePopover.querySelectorAll("a").forEach(link => {
    link.addEventListener("click", closePopover, { signal });
  });
}

function setupLanguageRoll() {
  if (languageCleanup) languageCleanup.abort();
  languageCleanup = new AbortController();
  const { signal } = languageCleanup;
  const reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  const links = Array.from(
    document.querySelectorAll<HTMLAnchorElement>("a[data-lang-toggle]")
  );
  if (!links.length) return;

  let switching = false;
  let resetTimer = 0;

  const clearRoll = () => {
    document.querySelectorAll<HTMLElement>("[data-lang-roll]").forEach(item => {
      const targetCurrent = item.dataset.langNextCurrent;
      const targetNext = item.dataset.langNextNext;
      const current = item.querySelector<HTMLElement>("[data-lang-current]");
      const upcoming = item.querySelector<HTMLElement>(".lang-roll-item--next");

      if (targetCurrent !== undefined || targetNext !== undefined) {
        if (current && targetCurrent !== undefined) {
          current.textContent = targetCurrent;
        }
        if (upcoming && targetNext !== undefined) {
          upcoming.textContent = targetNext;
        }
        const items = item.querySelectorAll<HTMLElement>(".lang-roll-item");
        items.forEach(el => (el.style.transition = "none"));
        item.classList.remove("is-switching");
        void item.offsetHeight;
        items.forEach(el => (el.style.transition = ""));
      } else {
        item.classList.remove("is-switching");
      }

      delete item.dataset.switchStart;
      delete item.dataset.langNextCurrent;
      delete item.dataset.langNextNext;
      delete item.dataset.langRollActive;
    });
    delete document.documentElement.dataset.langRollRequest;
  };

  links.forEach(link => {
    const href = link.href;

    // Warm the counterpart page before the click so the route swap does not
    // wait for a cold HTML request. `prefetch` already respects data-saver
    // mode and slow connections.
    const warm = () => prefetch(href);
    link.addEventListener("pointerenter", warm, { signal });
    link.addEventListener("focus", warm, { signal });
    link.addEventListener("pointerdown", warm, { signal });

    link.addEventListener(
      "click",
      event => {
        if (event.defaultPrevented) return;
        if (
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey
        ) {
          return;
        }

        // Keep a rapid second tap from starting another language navigation.
        // The roll can outlive the route swap now that the header persists,
        // so the class itself is part of the guard.
        if (
          switching ||
          document.querySelector(
            "[data-lang-roll].is-switching, [data-lang-roll][data-lang-roll-active]"
          )
        ) {
          event.preventDefault();
          return;
        }
        switching = true;

        if (document.querySelector("#mobile-menu.is-open")) {
          try {
            sessionStorage.setItem(MENU_LANGUAGE_KEY, "1");
          } catch {
            /* storage can be unavailable */
          }
        }

        event.preventDefault();

        // The header persists across the route swap, so the CN/EN roll starts
        // on the incoming document (after the swap) instead of racing it.
        if (!reduceMotion) {
          document.documentElement.dataset.langRollRequest = "1";
        }

        // Start the route change immediately; the chip roll is feedback while
        // the prefetched document is prepared, not a gate in front of it.
        void navigate(href).catch(() => {
          switching = false;
          window.clearTimeout(resetTimer);
          clearRoll();
        });

        // If the navigation is interrupted (offline, aborted), release the
        // guard so the toggle keeps working.
        resetTimer = window.setTimeout(() => {
          switching = false;
          clearRoll();
        }, 2500);
      },
      { signal }
    );
  });

  // The language link can also be opened from the mobile menu; prefetch as
  // soon as that menu is invoked instead of only on hover/focus.
  document
    .querySelectorAll<HTMLElement>("[aria-controls='mobile-menu']")
    .forEach(button =>
      button.addEventListener("click", () => prefetch(links[0]!.href), {
        signal,
      })
    );

  // Quietly warm the counterpart page once the current page has settled.
  const warmAfterIdle = () => prefetch(links[0]!.href);
  const requestIdle = (
    window as Window & {
      requestIdleCallback?: (
        callback: () => void,
        options?: { timeout?: number }
      ) => number;
    }
  ).requestIdleCallback;
  if (requestIdle) {
    requestIdle(warmAfterIdle, { timeout: 1800 });
  } else {
    window.setTimeout(warmAfterIdle, 900);
  }
}

export function initHeader() {
  setupScrollPhysics();
  setupMobileNav();
  setupMorePopover();
  setupLanguageRoll();
  setupAppearance();
  setupSoundFx();
}
