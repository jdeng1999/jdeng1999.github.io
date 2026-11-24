let scrollCleanup: AbortController | null = null;
let mobileNavCleanup: AbortController | null = null;
let moreCleanup: AbortController | null = null;

let appearanceBound = false;
let soundBound = false;
let soundEnabled = false;
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

function playBlip(
  frequency = 520,
  duration = 0.045,
  volume = 0.028,
  type: OscillatorType = "sine"
) {
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

    oscillator.type = type;
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
  } catch {
    /* audio is best-effort */
  }
}

function playMuteAlert(enabled: boolean) {
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
    if (enabled) {
      oscillator.frequency.setValueAtTime(520, now);
      oscillator.frequency.exponentialRampToValueAtTime(1040, now + 0.06);
    } else {
      oscillator.frequency.setValueAtTime(600, now);
      oscillator.frequency.exponentialRampToValueAtTime(250, now + 0.05);
    }

    gain.gain.setValueAtTime(0.055, now);
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
      button.classList.toggle("active", soundEnabled);
      button.classList.toggle("muted", !soundEnabled);
      button.setAttribute("aria-pressed", String(soundEnabled));

      const label = button.querySelector<HTMLElement>("[data-sound-label]");
      if (!label) return;

      const on =
        button.dataset.labelOn ?? button.getAttribute("data-label-on") ?? "On";
      const off =
        button.dataset.labelOff ??
        button.getAttribute("data-label-off") ??
        "Muted";
      label.textContent = soundEnabled ? on : off;
    });
}

function setupSoundFx() {
  soundEnabled = readStored("sound-fx", "false") === "true";
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
        soundEnabled = !soundEnabled;
        writeStored("sound-fx", String(soundEnabled));
        syncSoundToggles();
        playMuteAlert(soundEnabled);
        return;
      }

      if (!soundEnabled) return;
      if (!target.closest("a, button, summary, [role='button']")) return;
      playBlip();
    },
    true
  );

  document.addEventListener("astro:page-load", syncSoundToggles);

  window.addEventListener("storage", event => {
    if (event.key !== "sound-fx") return;
    soundEnabled = readStored("sound-fx", "false") === "true";
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
  const borderLine = document.getElementById("header-border");

  if (!header || !borderLine) return;

  let rafPending = false;
  const handleScroll = () => {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(() => {
      const scrolled = window.scrollY > 15;
      // Only the surface changes on scroll; the header keeps its height so
      // navigation targets never shift under the pointer.
      header.classList.toggle("header-scrolled", scrolled);
      borderLine.classList.toggle("opacity-0", !scrolled);
      borderLine.classList.toggle("opacity-100", scrolled);
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
  const mobileMenu = document.querySelector("#mobile-menu");
  const backdrop = document.querySelector(".mobile-menu-backdrop");

  if (!menuBtn || !mobileMenu) return;

  const labelOpen = menuBtn.getAttribute("data-label-open") || "Open Menu";
  const labelClose = menuBtn.getAttribute("data-label-close") || "Close Menu";

  const closeMenu = () => {
    menuBtn.setAttribute("aria-expanded", "false");
    menuBtn.setAttribute("aria-label", labelOpen);
    mobileMenu.classList.remove("is-open");
    mobileMenu.setAttribute("aria-hidden", "true");
  };

  menuBtn.addEventListener(
    "click",
    () => {
      const isOpen = menuBtn.getAttribute("aria-expanded") === "true";
      if (isOpen) {
        closeMenu();
      } else {
        menuBtn.setAttribute("aria-expanded", "true");
        menuBtn.setAttribute("aria-label", labelClose);
        mobileMenu.classList.add("is-open");
        mobileMenu.setAttribute("aria-hidden", "false");
      }
    },
    { signal }
  );

  if (backdrop) {
    backdrop.addEventListener("click", closeMenu, { signal });
  }

  mobileMenu.querySelectorAll("a").forEach(link => {
    link.addEventListener("click", closeMenu, { signal });
  });
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

  // Close popover on scroll
  window.addEventListener("scroll", closePopover, { passive: true, signal });

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

export function initHeader() {
  setupScrollPhysics();
  setupMobileNav();
  setupMorePopover();
  setupAppearance();
  setupSoundFx();
}
