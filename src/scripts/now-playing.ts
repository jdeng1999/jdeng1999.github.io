import { soundGain } from "@/scripts/sound";

type LyricLine = { at: number; text: string };

type MusicTrack = {
  title: string;
  artist: string;
  album: string;
  cover: string;
  url: string;
  src: string;
  isLocal: boolean;
  spotifyUri: string;
  duration: number;
  lyrics: LyricLine[];
};

type MusicLabels = {
  eyebrow: string;
  enjoy: string;
  open: string;
  play: string;
  pause: string;
  restart: string;
  seek: string;
  preview: string;
  previous: string;
  next: string;
  mode: string;
  order: string;
  repeat: string;
  shuffle: string;
};

type MusicPayload = {
  tracks: MusicTrack[];
  labels: MusicLabels;
};

type SpotifyPlaybackData = {
  isPaused: boolean;
  isBuffering: boolean;
  duration: number;
  position: number;
};

type SpotifyEmbedController = {
  play: () => void;
  pause: () => void;
  resume: () => void;
  togglePlay: () => void;
  seek: (seconds: number) => void;
  addListener: (
    event: string,
    callback: (event: { data: SpotifyPlaybackData }) => void
  ) => void;
  destroy: () => void;
  loadUri?: (uri: string) => void;
};

type SpotifyIframeApi = {
  createController: (
    element: HTMLElement,
    options: {
      uri: string;
      width?: string | number;
      height?: string | number;
    },
    callback: (controller: SpotifyEmbedController) => void
  ) => void;
};

type SpotifyWindow = Window & {
  SpotifyIframeApi?: SpotifyIframeApi;
  onSpotifyIframeApiReady?: (api: SpotifyIframeApi) => void;
};

type MusicState = {
  index: number;
  count: number;
  title: string;
  artist: string;
  album: string;
  playing: boolean;
  current: number;
  duration: number;
  source: "local" | "spotify";
  isPreview: boolean;
  isLocal: boolean;
  lyrics: string[];
};

type BlogMusicApi = {
  tracks: {
    title: string;
    artist: string;
    album: string;
    duration: number;
    lyrics: string[];
    isLocal: boolean;
  }[];
  getState: () => MusicState;
  play: (index?: number) => void;
  pause: () => void;
  toggle: () => void;
  next: () => void;
  previous: () => void;
  seek: (seconds: number) => void;
};

declare global {
  interface Window {
    __blogMusic?: BlogMusicApi;
  }
}

let spotifyApi: SpotifyIframeApi | null = null;
let apiPromise: Promise<SpotifyIframeApi> | null = null;
let mediaKeysCleanup: AbortController | null = null;

const MUSIC_STATE_KEY = "jdeng:music-state";

const localeOfPath = (pathname: string) =>
  pathname === "/zh" || pathname.startsWith("/zh/")
    ? "zh"
    : pathname === "/es" || pathname.startsWith("/es/")
      ? "es"
      : "en";

type PlayMode = "order" | "repeat" | "shuffle";
type StoredMusicState = {
  trackIndex: number;
  position: number;
  playing: boolean;
  mode: PlayMode;
  browseIndex: number;
  source: "local" | "spotify";
};
type GlobalMusicPlayer = {
  audio: HTMLAudioElement;
  trackIndex: number;
  positionMs: number;
  playing: boolean;
  mode: PlayMode;
  browseIndex: number;
  source: "local" | "spotify";
  started: boolean;
  listeners: AbortController | null;
  lifecycle: AbortController | null;
  spotifyController: SpotifyEmbedController | null;
  spotifyUri: string;
  spotifyDuration: number;
  spotifyUpdate: ((playback: SpotifyPlaybackData) => void) | null;
};

const getGlobalMusicPlayer = (): GlobalMusicPlayer => {
  const holder = window as Window & {
    __devosferaMusicPlayer?: GlobalMusicPlayer;
  };
  if (!holder.__devosferaMusicPlayer) {
    const audio = new Audio();
    audio.preload = "metadata";
    holder.__devosferaMusicPlayer = {
      audio,
      trackIndex: 0,
      positionMs: 0,
      playing: false,
      mode: "order",
      browseIndex: 0,
      source: "local",
      started: false,
      listeners: null,
      lifecycle: null,
      spotifyController: null,
      spotifyUri: "",
      spotifyDuration: 0,
      spotifyUpdate: null,
    };
  }
  return holder.__devosferaMusicPlayer;
};

// The Spotify iframe lives outside <body> so ClientRouter swaps can never
// detach it. Moving or recreating the iframe would interrupt playback.
const getSpotifyEngine = (): HTMLElement => {
  let engine = document.getElementById("devosfera-spotify-engine");
  if (!engine) {
    engine = document.createElement("div");
    engine.id = "devosfera-spotify-engine";
    engine.setAttribute("aria-hidden", "true");
    engine.style.cssText =
      "position:fixed;left:0;bottom:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none;clip-path:inset(50%);";
    document.documentElement.appendChild(engine);
  }
  return engine;
};

let gearAudioContext: AudioContext | null = null;
let gearNoiseBuffer: AudioBuffer | null = null;
let gearLastPlayedAt = 0;

// A short metallic double ratchet: two closely spaced mechanical clicks
// built from inharmonic bar partials, a narrow high-frequency ring and a
// filtered noise transient. Synthesised locally, no audio asset is loaded.
const playGearSwitch = () => {
  try {
    const volume = soundGain();
    if (volume <= 0) return;
    const nowMs = performance.now();
    if (nowMs - gearLastPlayedAt < 40) return;
    gearLastPlayedAt = nowMs;

    const AudioCtor =
      window.AudioContext ||
      (window as Window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtor) return;
    gearAudioContext ??= new AudioCtor();
    if (gearAudioContext.state === "suspended") {
      void gearAudioContext.resume();
    }

    const ctx = gearAudioContext;
    const now = ctx.currentTime;

    if (!gearNoiseBuffer) {
      const length = Math.ceil(ctx.sampleRate * 0.14);
      gearNoiseBuffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = gearNoiseBuffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) {
        data[i] = Math.random() * 2 - 1;
      }
    }

    const playClick = (offset: number, levelScale: number) => {
      const start = now + 0.012 + offset;
      const master = ctx.createGain();
      master.gain.value = 1.8 * levelScale * volume;
      master.connect(ctx.destination);

      const transient = ctx.createBufferSource();
      transient.buffer = gearNoiseBuffer;
      const transientHighPass = ctx.createBiquadFilter();
      transientHighPass.type = "highpass";
      transientHighPass.frequency.value = 1700;
      transientHighPass.Q.value = 0.7;
      const transientPresence = ctx.createBiquadFilter();
      transientPresence.type = "peaking";
      transientPresence.frequency.value = 3600;
      transientPresence.Q.value = 1.1;
      transientPresence.gain.value = 7;
      const transientGain = ctx.createGain();
      transientGain.gain.setValueAtTime(0.024, start);
      transientGain.gain.exponentialRampToValueAtTime(0.0001, start + 0.02);
      transient.connect(transientHighPass);
      transientHighPass.connect(transientPresence);
      transientPresence.connect(transientGain);
      transientGain.connect(master);
      transient.start(start);
      transient.stop(start + 0.03);

      const ring = ctx.createBufferSource();
      ring.buffer = gearNoiseBuffer;
      const ringFilter = ctx.createBiquadFilter();
      ringFilter.type = "bandpass";
      ringFilter.frequency.value = 4600;
      ringFilter.Q.value = 12;
      const ringGain = ctx.createGain();
      ringGain.gain.setValueAtTime(0.0001, start);
      ringGain.gain.exponentialRampToValueAtTime(0.008, start + 0.004);
      ringGain.gain.exponentialRampToValueAtTime(0.0001, start + 0.065);
      ring.connect(ringFilter);
      ringFilter.connect(ringGain);
      ringGain.connect(master);
      ring.start(start);
      ring.stop(start + 0.075);

      const base = 410;
      const partials: Array<[number, number, number]> = [
        [0.5, 0.008, 0.06],
        [1, 0.016, 0.115],
        [2.756, 0.009, 0.08],
        [5.404, 0.006, 0.06],
        [8.933, 0.0035, 0.045],
      ];
      partials.forEach(([ratio, level, decay]) => {
        const oscillator = ctx.createOscillator();
        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(
          base * ratio * (1 + (Math.random() - 0.5) * 0.006),
          start
        );
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(level, start + 0.004);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + decay);
        oscillator.connect(gain);
        gain.connect(master);
        oscillator.start(start);
        oscillator.stop(start + decay + 0.02);
      });

      window.setTimeout(() => master.disconnect(), 400);
    };

    playClick(0, 1);
    playClick(0.038, 0.58);
  } catch {
    /* audio is best-effort */
  }
};

const readStoredMusicState = (): StoredMusicState | null => {
  try {
    const raw = sessionStorage.getItem(MUSIC_STATE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<StoredMusicState>;
    if (
      typeof value.trackIndex !== "number" ||
      typeof value.position !== "number" ||
      typeof value.playing !== "boolean" ||
      typeof value.browseIndex !== "number" ||
      (value.source !== "local" && value.source !== "spotify")
    ) {
      return null;
    }
    const mode: PlayMode =
      value.mode === "repeat" || value.mode === "shuffle"
        ? value.mode
        : "order";
    return {
      trackIndex: value.trackIndex,
      position: value.position,
      playing: value.playing,
      mode,
      browseIndex: value.browseIndex,
      source: value.source,
    };
  } catch {
    return null;
  }
};

const loadSpotifyApi = (): Promise<SpotifyIframeApi> => {
  if (spotifyApi) return Promise.resolve(spotifyApi);
  if (apiPromise) return apiPromise;

  const w = window as SpotifyWindow;
  if (w.SpotifyIframeApi) {
    spotifyApi = w.SpotifyIframeApi;
    return Promise.resolve(spotifyApi);
  }

  apiPromise = new Promise<SpotifyIframeApi>((resolve, reject) => {
    const timeout = window.setTimeout(
      () => reject(new Error("Spotify embed API timed out")),
      12000
    );

    w.onSpotifyIframeApiReady = (embedApi: SpotifyIframeApi) => {
      window.clearTimeout(timeout);
      spotifyApi = embedApi;
      resolve(embedApi);
    };

    let script = document.getElementById(
      "spotify-iframe-api"
    ) as HTMLScriptElement | null;

    if (!script) {
      script = document.createElement("script");
      script.id = "spotify-iframe-api";
      script.src = "https://open.spotify.com/embed/iframe-api/v1";
      script.async = true;
      script.addEventListener("error", () => {
        window.clearTimeout(timeout);
        reject(new Error("Spotify embed API failed to load"));
      });
      document.head.appendChild(script);
    }
  });

  apiPromise.catch(() => {
    apiPromise = null;
  });

  return apiPromise;
};

const readData = (): MusicPayload | null => {
  const el = document.querySelector<HTMLScriptElement>("[data-np-data]");
  if (!el?.textContent) return null;

  try {
    return JSON.parse(el.textContent) as MusicPayload;
  } catch {
    return null;
  }
};

const formatTime = (ms: number) => {
  const total = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const initNowPlaying = () => {
  const root = document.querySelector<HTMLElement>("[data-np]");
  if (!root || root.dataset.npReady === "true") return;

  const data = readData();
  if (!data?.tracks.length) return;

  // Validate the markup before touching any shared state: a half-rendered
  // card should not mark the component ready or abort the previous player.
  const stack = root.querySelector<HTMLElement>("[data-np-stack]");
  const stage = root.querySelector<HTMLElement>("[data-np-stage]");
  const serverCard = root.querySelector<HTMLElement>("[data-np-card]");
  const embedHost = root.querySelector<HTMLElement>("[data-np-embed]");
  if (!stack || !stage || !serverCard || !embedHost) return;

  const globalPlayer = getGlobalMusicPlayer();
  const liveState = globalPlayer.started;
  const storedState = liveState ? null : readStoredMusicState();

  globalPlayer.listeners?.abort();
  const audioListeners = new AbortController();
  globalPlayer.listeners = audioListeners;

  root.dataset.npReady = "true";

  globalPlayer.lifecycle?.abort();
  const lifecycle = new AbortController();
  globalPlayer.lifecycle = lifecycle;

  let labels = data.labels;
  const tracks = data.tracks;
  const visibleCount = Math.min(tracks.length, 4);
  let expandedDialog: HTMLDialogElement | null = null;
  // Front, then the next three tracks stacked above it. Keeping the window
  // aligned with the expanded carousel makes every card keep the same
  // above/below relation in both states.
  const deckSlotOffsets = [0, 1, 2, 3];

  root.querySelector<HTMLAudioElement>("[data-np-audio]")?.remove();

  const audio = globalPlayer.audio;

  // One full card per track. Cloning the server card keeps the complete
  // markup in a single place while giving the deck four independent layers.
  const deckCards: HTMLElement[] = [serverCard];
  for (let i = 1; i < visibleCount; i++) {
    const clone = serverCard.cloneNode(true) as HTMLElement;
    clone.classList.add("np-clone");
    clone.removeAttribute("data-np-card");
    clone.querySelectorAll("[id]").forEach(node => node.removeAttribute("id"));
    stage.appendChild(clone);
    deckCards.push(clone);
  }

  let activeCard = deckCards[0]!;
  const initialTrackIndex = Math.min(
    Math.max(
      (liveState ? globalPlayer.trackIndex : storedState?.trackIndex) ?? 0,
      0
    ),
    tracks.length - 1
  );
  const initialBrowseIndex = Math.min(
    Math.max(
      (liveState ? globalPlayer.browseIndex : storedState?.browseIndex) ?? 0,
      0
    ),
    tracks.length - 1
  );
  let index = initialBrowseIndex;
  let playbackIndex = initialTrackIndex;

  const getBody = (card: HTMLElement) =>
    card.querySelector<HTMLElement>("[data-np-body]");

  const setText = (card: HTMLElement, selector: string, value: string) => {
    const node = card.querySelector<HTMLElement>(selector);
    if (node) node.textContent = value;
  };

  const applyCardContent = (
    card: HTMLElement,
    track: MusicTrack,
    trackIndex: number
  ) => {
    card.dataset.npTrackIndex = String(trackIndex);

    const coverEl = card.querySelector<HTMLImageElement>("[data-np-cover]");
    if (coverEl) coverEl.src = track.cover;
    setText(card, "[data-np-title]", track.title);
    setText(card, "[data-np-hover-title]", track.title);
    setText(card, "[data-np-artist]", track.artist);
    setText(card, "[data-np-album]", track.album);
    setText(
      card,
      "[data-np-count]",
      `${String(trackIndex + 1).padStart(2, "0")} / ${String(
        tracks.length
      ).padStart(2, "0")}`
    );
    setText(card, "[data-np-total]", formatTime(track.duration * 1000));

    const link = card.querySelector<HTMLAnchorElement>("[data-np-link]");
    if (link) link.href = track.url;
  };

  deckCards.forEach((card, slot) => {
    const offset = deckSlotOffsets[slot] ?? 0;
    const trackIndex =
      (((index + offset) % tracks.length) + tracks.length) % tracks.length;
    applyCardContent(card, tracks[trackIndex]!, trackIndex);
  });

  const setActiveCard = (card: HTMLElement) => {
    activeCard = card;
    index = Number(card.dataset.npTrackIndex) || 0;

    deckCards.forEach(other => {
      const body = getBody(other);
      if (!body) return;
      const isActive = other === activeCard;
      other.classList.toggle("np-active", isActive);
      body.toggleAttribute("inert", !isActive);
      if (isActive) body.removeAttribute("aria-hidden");
      else body.setAttribute("aria-hidden", "true");
    });
  };

  let source: "local" | "spotify" = "local";
  let isPlaying = false;
  let isDragging = false;
  let positionMs = 0;
  let durationMs = tracks[initialTrackIndex]!.duration * 1000;
  let requestedPlay = false;
  let connecting = false;
  let pendingSpotify: {
    track: MusicTrack;
    autoplay: boolean;
    startAtSeconds: number;
  } | null = null;
  let spotifySeekToken = 0;
  let localPlayToken = 0;
  let spotifyController: SpotifyEmbedController | null =
    globalPlayer.spotifyController;
  let spotifyUri = globalPlayer.spotifyUri;
  let localFailed = false;
  let endedHandled = false;
  let spotifyAdvanceGuardUntil = 0;
  let playMode: PlayMode = "order";
  let restorePositionMs = 0;
  let restoreWantsPlayback = false;
  let restorePending = Boolean(storedState);

  if (liveState) {
    source = globalPlayer.source;
    playMode = globalPlayer.mode;
    if (source === "local") {
      positionMs = Number.isFinite(audio.currentTime)
        ? audio.currentTime * 1000
        : globalPlayer.positionMs;
      durationMs =
        Number.isFinite(audio.duration) && audio.duration > 0
          ? audio.duration * 1000
          : tracks[initialTrackIndex]!.duration * 1000;
      isPlaying = !audio.paused;
    } else {
      positionMs = globalPlayer.positionMs;
      isPlaying = globalPlayer.playing;
      if (globalPlayer.spotifyDuration > 0) {
        durationMs = globalPlayer.spotifyDuration;
      }
    }
  } else if (storedState) {
    source = storedState.source;
    playMode = storedState.mode;
    positionMs = storedState.position * 1000;
    restorePositionMs = positionMs;
    restoreWantsPlayback = storedState.playing;
    isPlaying = false;
  }

  const cardTrackIndex = (card: HTMLElement) =>
    Number(card.dataset.npTrackIndex) || 0;

  const paintCardState = (card: HTMLElement) => {
    const trackIndex = cardTrackIndex(card);
    const isCurrent = trackIndex === playbackIndex;
    const cardPlaying = isCurrent && isPlaying;
    const playingValue = String(cardPlaying);
    const currentValue = String(isCurrent);

    // Only touch the DOM when something actually changed. Repainting every
    // stacked card on play/pause made the blurred layers re-rasterize and
    // flash, so unchanged cards must stay completely untouched.
    if (card.dataset.npPlaying !== playingValue) {
      card.dataset.npPlaying = playingValue;
    }
    if (card.dataset.npCurrent !== currentValue) {
      card.dataset.npCurrent = currentValue;
    }

    const toggle = card.querySelector<HTMLButtonElement>("[data-np-toggle]");
    if (toggle) {
      if (toggle.getAttribute("aria-pressed") !== playingValue) {
        toggle.setAttribute("aria-pressed", playingValue);
      }
      const toggleLabel = cardPlaying ? labels.pause : labels.play;
      if (toggle.getAttribute("aria-label") !== toggleLabel) {
        toggle.setAttribute("aria-label", toggleLabel);
      }
    }
  };

  // Visible progress values keyed per card. Unchanged cards skip every DOM
  // write, which keeps the blurred carousel layers stable while browsing.
  const paintedProgress = new WeakMap<HTMLElement, string>();

  const paintCardProgress = (card: HTMLElement) => {
    const trackIndex = cardTrackIndex(card);
    const track = tracks[trackIndex];
    if (!track) return;
    const isCurrent = trackIndex === playbackIndex;
    const total = isCurrent ? durationMs : track.duration * 1000;
    const position = isCurrent ? clamp(positionMs, 0, total) : 0;
    const hasProgress = isCurrent && position > 0;
    const ratio = total > 0 ? position / total : 0;
    const currentLabel = formatTime(position);
    const totalLabel = formatTime(total);
    const signature = `${currentLabel}|${totalLabel}|${hasProgress ? 1 : 0}|${
      isCurrent ? 1 : 0
    }|${Math.round(position)}`;
    if (paintedProgress.get(card) === signature) return;
    paintedProgress.set(card, signature);

    const seek = card.querySelector<HTMLElement>("[data-np-seek]");
    const fill = card.querySelector<HTMLElement>("[data-np-fill]");
    const currentText = card.querySelector<HTMLElement>("[data-np-current]");
    const totalText = card.querySelector<HTMLElement>("[data-np-total]");

    const progressValue = hasProgress ? "active" : "empty";
    if (card.dataset.npProgress !== progressValue) {
      card.dataset.npProgress = progressValue;
    }
    if (totalText && totalText.textContent !== totalLabel) {
      totalText.textContent = totalLabel;
    }
    if (currentText && currentText.textContent !== currentLabel) {
      currentText.textContent = currentLabel;
    }
    seek?.style.setProperty("--np-p", `${ratio * 100}%`);
    seek?.setAttribute("aria-valuemax", String(Math.round(total / 1000)));
    seek?.setAttribute("aria-valuenow", String(Math.round(position / 1000)));
    seek?.setAttribute("aria-valuetext", currentLabel);
    if (fill) {
      const fillOpacity = hasProgress ? "1" : "0";
      if (fill.style.opacity !== fillOpacity) {
        fill.style.opacity = fillOpacity;
      }
    }
  };

  const paintCard = (card: HTMLElement) => {
    paintCardState(card);
    paintCardProgress(card);
  };

  const paintAllCards = () => {
    deckCards.forEach(paintCard);
    expandedCards.forEach(({ el }) => paintCard(el));
  };

  const emitState = () => {
    window.dispatchEvent(
      new CustomEvent("blog-music:state", { detail: getState() })
    );
  };

  let lastPersistAt = 0;
  const saveMusicState = (persist = false) => {
    globalPlayer.trackIndex = playbackIndex;
    globalPlayer.browseIndex = index;
    globalPlayer.mode = playMode;
    globalPlayer.playing = isPlaying;
    globalPlayer.source = source;
    globalPlayer.started = true;
    globalPlayer.positionMs =
      source === "local" && Number.isFinite(audio.currentTime)
        ? audio.currentTime * 1000
        : positionMs;

    const now = performance.now();
    if (!persist && now - lastPersistAt < 800) return;
    lastPersistAt = now;
    try {
      const stored: StoredMusicState = {
        trackIndex: playbackIndex,
        position: globalPlayer.positionMs / 1000,
        playing: isPlaying,
        mode: playMode,
        browseIndex: index,
        source,
      };
      sessionStorage.setItem(MUSIC_STATE_KEY, JSON.stringify(stored));
    } catch {
      /* private browsing can disable sessionStorage */
    }
  };

  const paintPlaybackCards = () => {
    const paint = (card: HTMLElement) => {
      if (cardTrackIndex(card) === playbackIndex) paintCardProgress(card);
    };
    deckCards.forEach(paint);
    expandedCards.forEach(({ el }) => paint(el));
  };

  const setPlaying = (playing: boolean) => {
    const changed =
      isPlaying !== playing || root.dataset.npPlaying !== String(playing);
    isPlaying = playing;
    if (!changed) return;
    root.dataset.npPlaying = String(playing);
    expandedDialog?.classList.toggle("is-playing", playing);
    paintAllCards();
    saveMusicState();
    emitState();
  };

  const paintDuration = () => {
    paintPlaybackCards();
  };

  const paintProgress = (ms: number) => {
    positionMs = clamp(ms, 0, Math.max(durationMs, 0));
    paintPlaybackCards();
  };

  const stopLocalAudio = () => {
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
  };

  const pauseSpotify = () => {
    spotifyController?.pause();
  };

  const handleSpotifyPlayback = (playback: SpotifyPlaybackData) => {
    // The embed keeps emitting while a local file is playing; its paused state
    // must not overwrite the local transport.
    if (source !== "spotify") return;

    const atEnd =
      playback.duration > 0 && playback.position >= playback.duration - 400;

    if (playback.duration > 0) {
      durationMs = playback.duration;
      paintDuration();
    }

    if (typeof playback.position === "number" && !isDragging) {
      paintProgress(playback.position);
    }

    // A finished preview stays parked at its last position, but the embed can
    // keep reporting `isPaused: false`. Never let that resurrect the play UI.
    if (atEnd && performance.now() < spotifyAdvanceGuardUntil) {
      // Updates from the URI we just left still describe the old end state.
      return;
    }

    setPlaying(atEnd ? false : !playback.isPaused);
    root.dataset.npSource = "spotify";

    if (atEnd) {
      if (!endedHandled) {
        endedHandled = true;
        spotifyAdvanceGuardUntil = performance.now() + 1200;
        advanceByMode();
      }
    } else if (playback.position < playback.duration - 1500) {
      endedHandled = false;
    }
  };

  globalPlayer.spotifyUpdate = handleSpotifyPlayback;

  const connectSpotify = async (
    track: MusicTrack,
    autoplay: boolean,
    startAtSeconds = 0
  ): Promise<SpotifyEmbedController | null> => {
    if (!track.spotifyUri) {
      root.dataset.npUnavailable = "true";
      return null;
    }

    if (spotifyController) {
      if (track.spotifyUri !== spotifyUri) {
        if (typeof spotifyController.loadUri === "function") {
          spotifyController.pause();
          spotifyController.loadUri(track.spotifyUri);
          spotifyUri = track.spotifyUri;
          globalPlayer.spotifyUri = spotifyUri;
          globalPlayer.playing = false;
          globalPlayer.spotifyDuration = track.duration * 1000;
          globalPlayer.positionMs = startAtSeconds * 1000;

          // `loadUri` is asynchronous; seeking immediately can land on the
          // previous track. Re-seat once the new URI has had time to attach.
          const seekToken = ++spotifySeekToken;
          window.setTimeout(() => {
            if (
              seekToken !== spotifySeekToken ||
              spotifyUri !== track.spotifyUri
            ) {
              return;
            }
            spotifyController?.seek(startAtSeconds);
          }, 220);
        } else {
          // Older controllers cannot swap URIs. Tear the stale embed down and
          // fall through to create one for the requested track.
          try {
            spotifyController.destroy();
          } catch {
            /* the embed may already be gone */
          }
          spotifyController = null;
          globalPlayer.spotifyController = null;
          spotifyUri = "";
          globalPlayer.spotifyUri = "";
          globalPlayer.playing = false;
        }
      } else if (startAtSeconds > 0 && !globalPlayer.playing) {
        spotifyController.seek(startAtSeconds);
        globalPlayer.positionMs = startAtSeconds * 1000;
      }

      if (spotifyController) {
        if (autoplay && !globalPlayer.playing) {
          requestedPlay = true;
          spotifyController.play();
        }

        return spotifyController;
      }
    }

    if (connecting) {
      // A track change raced the first embed creation: remember the latest
      // request and apply it as soon as the controller exists.
      pendingSpotify = { track, autoplay, startAtSeconds };
      return null;
    }

    connecting = true;
    root.dataset.npLoading = "true";

    try {
      const api = await loadSpotifyApi();

      // The page was swapped while the API loaded; this player is detached.
      if (lifecycle.signal.aborted) return null;

      const requestedUri = track.spotifyUri;
      let settled = false;

      await new Promise<void>((resolve, reject) => {
        const guard = window.setTimeout(() => {
          settled = true;
          reject(new Error("Spotify controller timed out"));
        }, 12000);

        const host = document.createElement("div");
        getSpotifyEngine().replaceChildren(host);

        api.createController(
          host,
          {
            uri: requestedUri,
            width: "100%",
            height: 152,
          },
          embed => {
            window.clearTimeout(guard);

            // The timeout already reported failure, or the page was replaced
            // while the embed was booting: discard it so it cannot start audio
            // behind an "unavailable" card or hijack the next page's player.
            if (settled || lifecycle.signal.aborted) {
              try {
                embed.destroy();
              } catch {
                /* ignore */
              }
              return;
            }

            settled = true;
            spotifyController = embed;
            spotifyUri = requestedUri;
            globalPlayer.spotifyController = embed;
            globalPlayer.spotifyUri = spotifyUri;
            root.dataset.npLoading = "false";
            root.dataset.npUnavailable = "false";
            resolve();

            embed.addListener("playback_update", event => {
              const playback = event.data;

              // Warm-up embeds stay paused in the background. Mirror their
              // transport into the shared player only while Spotify is the
              // active source, otherwise a stray event flips the local UI.
              if (source === "spotify") {
                const atEnd =
                  playback.duration > 0 &&
                  playback.position >= playback.duration - 400;
                if (playback.duration > 0) {
                  globalPlayer.spotifyDuration = playback.duration;
                }
                if (typeof playback.position === "number") {
                  globalPlayer.positionMs = playback.position;
                }
                globalPlayer.playing = !playback.isPaused && !atEnd;
                globalPlayer.source = "spotify";
                globalPlayer.started = true;
              }

              globalPlayer.spotifyUpdate?.(playback);
            });

            if (startAtSeconds > 0) {
              embed.seek(startAtSeconds);
            }

            if (autoplay || requestedPlay) {
              requestedPlay = false;
              embed.play();
            }
          }
        );
      });
    } catch {
      root.dataset.npLoading = "false";
      root.dataset.npUnavailable = "true";
      setPlaying(false);
    } finally {
      connecting = false;

      if (pendingSpotify && !lifecycle.signal.aborted) {
        const next = pendingSpotify;
        pendingSpotify = null;
        void connectSpotify(next.track, next.autoplay, next.startAtSeconds);
      }
    }

    return spotifyController;
  };

  const playLocal = (track: MusicTrack) => {
    const token = ++localPlayToken;
    void audio.play().catch(error => {
      // Ignore a rejection from a track that has already been switched away
      // from (or a newer play attempt for the same card).
      if (token !== localPlayToken) return;
      if (tracks[playbackIndex] !== track) return;
      // Autoplay policies reject `play()` without a user gesture. That is not
      // a broken file: keep the local source ready and wait for a tap instead
      // of silently dropping into the 30s Spotify preview.
      if (error instanceof DOMException && error.name === "NotAllowedError") {
        setPlaying(false);
        return;
      }
      localFailed = true;
      source = "spotify";
      void connectSpotify(track, true);
    });
  };

  const loadPlaybackTrack = (targetIndex: number, autoplay: boolean) => {
    const track = tracks[targetIndex];
    if (!track) return;

    playbackIndex = targetIndex;
    localPlayToken += 1;
    // `endedHandled` intentionally survives a Spotify end-of-preview handoff:
    // stale playback updates from the previous URI must not skip a track.
    // The next update below the end threshold clears it again.
    localFailed = false;
    durationMs = track.duration * 1000;
    positionMs = 0;
    setPlaying(false);
    paintAllCards();

    if (track.isLocal && !localFailed) {
      source = "local";
      pauseSpotify();
      audio.pause();
      audio.src = track.src;
      audio.currentTime = 0;
      audio.load();
      root.dataset.npSource = "local";

      if (autoplay) {
        setPlaying(true);
        playLocal(track);
      } else {
        setPlaying(false);
      }
      emitState();
      return;
    }

    source = "spotify";
    stopLocalAudio();
    root.dataset.npSource = "spotify";
    if (spotifyController) {
      void connectSpotify(track, autoplay);
    } else if (autoplay) {
      requestedPlay = true;
      void connectSpotify(track, true);
    } else {
      setPlaying(false);
    }
    if (autoplay) setPlaying(true);
    emitState();
  };

  const pauseCurrent = () => {
    localPlayToken += 1;
    if (source === "local") audio.pause();
    else spotifyController?.pause();
  };

  const getCardHeight = () => serverCard.offsetHeight || 0;

  const syncStageHeight = () => {
    const height = getCardHeight();
    if (height > 0) stage.style.height = `${height}px`;
  };

  const applyDeckWindow = () => {
    const count = tracks.length;
    if (!count) return;

    deckCards.forEach((card, slot) => {
      const offset = deckSlotOffsets[slot] ?? 0;
      const trackIndex = (((index + offset) % count) + count) % count;
      if (Number(card.dataset.npTrackIndex) === trackIndex) return;
      applyCardContent(card, tracks[trackIndex]!, trackIndex);
    });
    syncStageHeight();
  };

  const unitRem = () =>
    Number.parseFloat(getComputedStyle(document.documentElement).fontSize) ||
    16;

  // Natural deck slots. Role 0 is the front; the other roles are the three
  // complete cards stacked above it, from nearest to deepest.
  let remSize = 16;
  const slotYRem = [0, -1.5, -2.55, -3.45];
  const slotScale = [1, 0.975, 0.95, 0.925];
  const slotOpacity = [1, 0.95, 0.84, 0.72];
  const slotBlur = [0, 0.18, 0.55, 1];
  const slotRotate = [0, -1.15, -2.15, -3.05];
  const slotZ = [4, 3, 2, 1];
  const lastRole = visibleCount - 1;
  let deckSuspended = false;
  // While the expanded carousel is open, the footer deck is only visible as
  // a blurred backdrop, so its content swap is deferred until close.
  let deckPendingCenter: number | null = null;

  const measureDeck = () => {
    remSize = unitRem();
    syncStageHeight();
  };

  const slotAt = (role: number) => {
    const i = Math.min(Math.max(role, 0), 3);
    return {
      y: slotYRem[i]! * remSize,
      scale: slotScale[i]!,
      opacity: slotOpacity[i]!,
      blur: slotBlur[i]!,
      rotate: slotRotate[i]!,
      z: slotZ[i]!,
    };
  };

  const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const smoothstep = (edge0: number, edge1: number, value: number) => {
    const t = clamp01((value - edge0) / (edge1 - edge0));
    return t * t * (3 - 2 * t);
  };

  const renderDeck = () => {
    if (deckSuspended) return;
    const phase = deckOffset;
    const settled =
      !draggingDeck && !springing && Math.abs(deckTarget - deckOffset) < 0.001;

    deckCards.forEach((card, role) => {
      const from = role;
      let to = role;
      let t = 0;

      card.dataset.npRole = String(role);

      if (phase > 0.001) {
        t = clamp01(phase);
        to = role === 0 ? lastRole : role - 1;
      } else if (phase < -0.001) {
        t = clamp01(-phase);
        to = role === lastRole ? 0 : role + 1;
      }

      const a = slotAt(from);
      const b = slotAt(to);

      let y = lerp(a.y, b.y, t);
      // The outgoing front card first follows the finger down, then tucks
      // up into the back of the stack while it fades.
      if (phase > 0.001 && role === 0) {
        y += 2.4 * remSize * Math.sin(Math.PI * t);
      }

      const scale = lerp(a.scale, b.scale, t);
      const opacity = lerp(a.opacity, b.opacity, t);
      const blur = lerp(a.blur, b.blur, t);
      const rotate = lerp(a.rotate, b.rotate, t);

      // Keep the card that owns the gesture on top while it shrinks; only
      // hand the front z-index to the incoming card near the end. This
      // prevents the next card from flashing over it mid-gesture.
      let z: number;
      if (phase > 0.001) {
        if (role === 0) {
          z = 4 - 3 * smoothstep(0.55, 0.95, t);
        } else if (role === 1) {
          z = 3 + smoothstep(0.45, 0.9, t);
        } else {
          z = lerp(a.z, b.z, t);
        }
      } else if (phase < -0.001) {
        if (role === 0) {
          z = 4 - smoothstep(0.5, 0.9, t);
        } else if (role === lastRole) {
          z = 1 + 3 * smoothstep(0.4, 0.9, t);
        } else {
          z = lerp(a.z, b.z, t);
        }
      } else {
        z = a.z;
      }

      card.style.transform = `translate3d(0, ${y}px, 0) scale(${scale}) rotate(${rotate}deg)`;
      card.style.opacity = String(opacity);
      card.style.filter = blur > 0.01 ? `blur(${blur}px)` : "none";
      card.style.zIndex = String(Math.round(z));
    });

    root.dataset.npMoving = String(!settled);
  };

  let deckOffset = 0;
  let deckTarget = 0;
  let deckFrame = 0;
  let deckVelocity = 0;
  let springing = false;

  let draggingDeck = false;
  let dragPointerId = -1;
  let dragStartY = 0;
  let dragStartOffset = 0;
  let dragLastRaw = 0;
  let dragLastTime = 0;
  let dragVelocity = 0;
  let deckDownTarget: EventTarget | null = null;
  let deckDownTime = 0;
  let deckTapCandidate = false;
  let deckMoved = false;

  let wheelAccum = 0;
  let wheelTimer = 0;
  let wheelLocked = false;
  let wheelUnlockTimer = 0;

  const pendingMoves: Array<{ direction: 1 | -1 }> = [];

  const clampDrag = (value: number) => Math.max(-1, Math.min(1, value));

  const startDeck = () => {
    if (!deckFrame) deckFrame = requestAnimationFrame(deckTick);
  };

  const commitIfNeeded = () => {
    let moved = 0;
    const count = tracks.length;

    while (deckOffset >= 1) {
      deckCards.push(deckCards.shift()!);
      deckOffset -= 1;
      deckTarget -= 1;
      moved += 1;
    }

    while (deckOffset <= -1) {
      deckCards.unshift(deckCards.pop()!);
      deckOffset += 1;
      deckTarget += 1;
      moved -= 1;
    }

    if (!moved) return false;

    const previousIndex = index;
    deckOffset = 0;
    deckTarget = 0;
    deckVelocity = 0;
    springing = false;

    setActiveCard(deckCards[0]!);
    index = (((previousIndex + moved) % count) + count) % count;
    applyDeckWindow();
    paintAllCards();
    syncStageHeight();
    saveMusicState();
    return true;
  };

  const deckTick = () => {
    if (draggingDeck) {
      const diff = deckTarget - deckOffset;
      deckOffset += diff * 0.3;
      if (Math.abs(diff) < 0.001) deckOffset = deckTarget;
    } else if (springing) {
      deckVelocity = (deckVelocity + (deckTarget - deckOffset) * 0.16) * 0.78;
      deckOffset += deckVelocity;

      if (deckTarget !== 0) {
        if (
          (deckTarget > 0 && deckOffset >= deckTarget) ||
          (deckTarget < 0 && deckOffset <= deckTarget)
        ) {
          deckOffset = deckTarget;
          commitIfNeeded();
        }
      } else if (
        Math.abs(deckOffset) < 0.004 &&
        Math.abs(deckVelocity) < 0.003
      ) {
        deckOffset = 0;
        deckVelocity = 0;
        springing = false;
      }
    } else {
      const diff = deckTarget - deckOffset;
      deckOffset += diff * 0.26;
      if (Math.abs(diff) < 0.001) deckOffset = deckTarget;
      if (deckOffset >= 1 || deckOffset <= -1) commitIfNeeded();
    }

    renderDeck();

    const moving =
      draggingDeck || springing || Math.abs(deckTarget - deckOffset) > 0.0005;

    if (moving) {
      deckFrame = requestAnimationFrame(deckTick);
    } else {
      deckFrame = 0;
      if (pendingMoves.length) {
        const next = pendingMoves.shift()!;
        slideToTrack(next.direction);
      }
    }
  };

  const slideToTrack = (direction: 1 | -1) => {
    if (visibleCount < 2) return;
    springing = false;
    deckVelocity = 0;
    const base = Math.round(deckOffset);
    deckTarget = clampDrag(base + direction);
    startDeck();
  };

  const requestMove = (direction: 1 | -1) => {
    const busy =
      draggingDeck || springing || Math.abs(deckTarget - deckOffset) > 0.0005;

    if (busy) {
      if (pendingMoves.length < 6) {
        pendingMoves.push({ direction });
      }
      return;
    }

    slideToTrack(direction);
  };

  const resumePlayback = () => {
    const track = tracks[playbackIndex];
    if (!track) return;
    if (source === "local" && audio.getAttribute("src")) {
      if (audio.paused) playLocal(track);
      return;
    }
    if (spotifyController) {
      spotifyController.play();
      return;
    }
    requestedPlay = true;
    void connectSpotify(track, true);
  };

  const revealExpandedTarget = (target: number) => {
    if (!expandedOpen || expandedClosing) return;
    applyExpandedCenter(target);
  };

  const jumpToTrack = (targetIndex: number, autoplay: boolean) => {
    const count = tracks.length;
    if (!count) return;
    const target = ((targetIndex % count) + count) % count;
    setDeckWindow(target);
    revealExpandedTarget(target);
    if (target === playbackIndex) {
      if (autoplay) resumePlayback();
      else pauseCurrent();
    } else {
      loadPlaybackTrack(target, autoplay);
    }
  };

  // Re-seat the four-card footer deck on any track in the full collection
  // without touching playback. Card browsing is independent from the song
  // that is currently sounding.
  const applyDeckWindowContent = () => {
    const count = tracks.length;
    if (!count) return;
    deckCards.forEach((card, slot) => {
      const offset = deckSlotOffsets[slot] ?? 0;
      const trackIndex = (((index + offset) % count) + count) % count;
      applyCardContent(card, tracks[trackIndex]!, trackIndex);
    });
  };

  function setDeckWindow(centerIndex: number) {
    const count = tracks.length;
    if (!count) return;

    const next = ((centerIndex % count) + count) % count;
    const deferContent = expandedOpen && !expandedClosing;
    index = next;
    if (deferContent) {
      deckPendingCenter = next;
    } else {
      deckPendingCenter = null;
      applyDeckWindowContent();
    }

    deckOffset = 0;
    deckTarget = 0;
    deckVelocity = 0;
    springing = false;
    draggingDeck = false;
    dragPointerId = -1;
    pendingMoves.length = 0;
    wheelAccum = 0;
    setActiveCard(deckCards[0]!);
    if (deferContent) {
      // The front card still shows the previous track, so setActiveCard
      // restored the old index. Keep the browsed one for state and for the
      // deferred content flush on close.
      index = next;
    } else {
      applyDeckWindow();
    }
    renderDeck();
    paintAllCards();
    syncStageHeight();
    saveMusicState();
  }

  const skipTarget = (direction: 1 | -1, fromIndex: number): number | null => {
    const count = tracks.length;
    if (count < 2) return null;
    if (playMode === "shuffle") {
      let target = fromIndex;
      while (target === fromIndex) {
        target = Math.floor(Math.random() * count);
      }
      return target;
    }

    const raw = fromIndex + direction;
    if (raw < 0) return playMode === "order" ? null : count - 1;
    if (raw >= count) return playMode === "order" ? null : 0;
    return raw;
  };

  const skipPlayback = (
    direction: 1 | -1,
    fromIndex: number,
    autoplay: boolean
  ) => {
    const target = skipTarget(direction, fromIndex);
    if (target === null) return;
    setDeckWindow(target);
    revealExpandedTarget(target);
    if (target === playbackIndex) {
      if (autoplay) resumePlayback();
    } else {
      loadPlaybackTrack(target, autoplay);
    }
  };

  const nextTrack = (forceAutoplay?: boolean) => {
    skipPlayback(1, index, forceAutoplay ?? isPlaying);
  };

  const previousTrack = () => {
    skipPlayback(-1, index, isPlaying);
  };

  const advanceByMode = () => {
    if (playMode === "repeat") {
      seekToSeconds(0);
      if (source === "local") {
        const track = tracks[playbackIndex];
        if (track) playLocal(track);
      } else {
        spotifyController?.play();
      }
      endedHandled = false;
      return;
    }

    if (playMode === "shuffle" && tracks.length > 1) {
      let target = playbackIndex;
      while (target === playbackIndex) {
        target = Math.floor(Math.random() * tracks.length);
      }
      setDeckWindow(target);
      revealExpandedTarget(target);
      loadPlaybackTrack(target, true);
      return;
    }

    const target = playbackIndex + 1;
    if (target < tracks.length) {
      setDeckWindow(target);
      revealExpandedTarget(target);
      loadPlaybackTrack(target, true);
    } else {
      setPlaying(false);
    }
  };

  const setMode = (mode: "order" | "repeat" | "shuffle") => {
    playMode = mode;
    const modeButtons = [
      ...Array.from(root.querySelectorAll<HTMLButtonElement>("[data-np-mode]")),
      ...Array.from(
        expandedDialog?.querySelectorAll<HTMLButtonElement>("[data-np-mode]") ??
          []
      ),
    ];
    modeButtons.forEach(button => {
      button.dataset.mode = mode;
      const label =
        mode === "repeat"
          ? labels.repeat
          : mode === "shuffle"
            ? labels.shuffle
            : labels.order;
      button.setAttribute("aria-label", `${labels.mode}: ${label}`);
    });
    saveMusicState();
  };

  const togglePlayback = (targetIndex = index) => {
    if (targetIndex !== playbackIndex) {
      localFailed = false;
      loadPlaybackTrack(targetIndex, true);
      return;
    }

    if (source === "local" && audio.getAttribute("src")) {
      if (audio.paused) {
        const track = tracks[playbackIndex];
        setPlaying(true);
        if (track) playLocal(track);
      } else {
        audio.pause();
      }
      return;
    }

    if (spotifyController) {
      setPlaying(!isPlaying);
      spotifyController.togglePlay();
      return;
    }

    const track = tracks[playbackIndex];
    if (track) {
      requestedPlay = true;
      void connectSpotify(track, true);
    }
  };

  const restartTrack = (targetIndex = index) => {
    if (targetIndex !== playbackIndex) {
      localFailed = false;
      loadPlaybackTrack(targetIndex, true);
      return;
    }
    seekToSeconds(0);
    if (source === "local") {
      if (audio.getAttribute("src")) {
        const track = tracks[playbackIndex];
        setPlaying(true);
        if (track) playLocal(track);
      } else {
        loadPlaybackTrack(targetIndex, true);
      }
    } else if (spotifyController) {
      setPlaying(true);
      spotifyController.seek(0);
      spotifyController.play();
    } else {
      const track = tracks[playbackIndex];
      if (track) {
        setPlaying(true);
        void connectSpotify(track, true);
      }
    }
  };

  const seekToSeconds = (seconds: number) => {
    const ms = clamp(seconds * 1000, 0, durationMs);
    paintProgress(ms);

    if (source === "local") {
      if (Number.isFinite(audio.duration)) {
        audio.currentTime = Math.min(seconds, audio.duration);
      }
      return;
    }

    spotifyController?.seek(seconds);
  };

  const seekToRatio = (ratio: number) => {
    seekToSeconds((ratio * durationMs) / 1000);
  };

  const ratioFromPointer = (event: PointerEvent, seek: HTMLElement) => {
    const rect = seek.getBoundingClientRect();
    if (!rect.width) return 0;
    return clamp((event.clientX - rect.left) / rect.width, 0, 1);
  };

  const getState = (): MusicState => {
    const track = tracks[playbackIndex]!;
    return {
      index: playbackIndex,
      count: tracks.length,
      title: track.title,
      artist: track.artist,
      album: track.album,
      playing: isPlaying,
      current: positionMs / 1000,
      duration: durationMs / 1000,
      source,
      isPreview: source === "spotify",
      isLocal: source === "local",
      lyrics: track.lyrics.map(line => line.text),
    };
  };

  // ── Local audio events ────────────────────────────────────────
  const audioEventOptions = { signal: audioListeners.signal };
  audio.addEventListener("play", () => setPlaying(true), audioEventOptions);
  audio.addEventListener("pause", () => setPlaying(false), audioEventOptions);
  audio.addEventListener(
    "ended",
    () => {
      setPlaying(false);
      advanceByMode();
    },
    audioEventOptions
  );
  audio.addEventListener(
    "loadedmetadata",
    () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        durationMs = audio.duration * 1000;
        paintDuration();
      }
      if (restorePending) {
        restorePending = false;
        const target = clamp(
          restorePositionMs / 1000,
          0,
          Number.isFinite(audio.duration)
            ? audio.duration
            : Number.MAX_SAFE_INTEGER
        );
        audio.currentTime = target;
        positionMs = target * 1000;
        paintAllCards();
        if (restoreWantsPlayback) {
          restoreWantsPlayback = false;
          resumePlayback();
        }
      }
    },
    audioEventOptions
  );
  audio.addEventListener(
    "timeupdate",
    () => {
      if (!isDragging) paintProgress(audio.currentTime * 1000);
      saveMusicState();
    },
    audioEventOptions
  );
  audio.addEventListener(
    "error",
    () => {
      if (source !== "local") return;
      localFailed = true;
      source = "spotify";
      const track = tracks[playbackIndex];
      if (track) void connectSpotify(track, isPlaying);
    },
    audioEventOptions
  );

  const canStartDeckDrag = (target: EventTarget | null) =>
    !(target instanceof Element) ||
    !target.closest("button, a, input, [role='slider'], [role='button']");

  stack.addEventListener("pointerdown", event => {
    if (event.button !== 0 || !canStartDeckDrag(event.target)) return;
    if (visibleCount < 2) return;

    event.preventDefault();
    draggingDeck = true;
    springing = false;
    deckVelocity = 0;
    pendingMoves.length = 0;
    dragPointerId = event.pointerId;
    dragStartY = event.clientY;
    dragStartOffset = deckOffset;
    dragLastRaw = deckOffset;
    dragLastTime = performance.now();
    dragVelocity = 0;
    deckTarget = deckOffset;
    deckDownTarget = event.target;
    deckDownTime = performance.now();
    deckTapCandidate =
      event.target instanceof Element &&
      Boolean(event.target.closest("[data-np-card], .np-clone"));
    deckMoved = false;

    try {
      stack.setPointerCapture?.(event.pointerId);
    } catch {
      /* pointer may already be gone on very fast taps */
    }
    startDeck();
  });

  stack.addEventListener("pointermove", event => {
    if (!draggingDeck || event.pointerId !== dragPointerId) return;

    const height = getCardHeight();
    if (!height) return;

    const now = performance.now();
    const dt = Math.max(8, now - dragLastTime);
    const raw = dragStartOffset + (event.clientY - dragStartY) / height;

    dragVelocity = (raw - dragLastRaw) / dt;
    dragLastRaw = raw;
    dragLastTime = now;

    if (Math.abs(event.clientY - dragStartY) > 6) deckMoved = true;

    deckTarget = clampDrag(raw);
    startDeck();
  });

  const endDeckDrag = (event: PointerEvent) => {
    if (!draggingDeck || event.pointerId !== dragPointerId) return;
    draggingDeck = false;
    dragPointerId = -1;

    try {
      if (stack.hasPointerCapture?.(event.pointerId)) {
        stack.releasePointerCapture(event.pointerId);
      }
    } catch {
      /* capture may have been released by the browser */
    }

    const wasTap =
      event.type === "pointerup" &&
      deckTapCandidate &&
      !deckMoved &&
      performance.now() - deckDownTime < 500;
    const tapTarget = deckDownTarget instanceof Element ? deckDownTarget : null;
    deckTapCandidate = false;
    deckDownTarget = null;

    if (performance.now() - dragLastTime > 90) dragVelocity = 0;
    const projected = deckOffset + dragVelocity * 200;
    let target = 0;
    if (projected > 0.5) target = 1;
    else if (projected < -0.5) target = -1;

    deckTarget = target;
    deckVelocity = Math.max(-0.16, Math.min(0.16, dragVelocity * 18));
    springing = true;
    startDeck();

    if (!wasTap || !tapTarget) return;

    const pressedCard = tapTarget.closest<HTMLElement>(
      "[data-np-card], .np-clone"
    );
    const pressedRole = pressedCard ? deckCards.indexOf(pressedCard) : -1;

    if (pressedRole === 0) {
      openExpanded();
    } else if (pressedRole === 1) {
      requestMove(1);
    } else if (pressedRole === 2) {
      requestMove(1);
      requestMove(1);
    }
    // The deepest card (role 3) intentionally stays inert on hover/click;
    // it still participates in the drag gesture.
  };

  stack.addEventListener("pointerup", endDeckDrag);
  stack.addEventListener("pointercancel", endDeckDrag);

  root.addEventListener(
    "wheel",
    event => {
      event.preventDefault();
      if (visibleCount < 2) return;

      if (wheelLocked) {
        window.clearTimeout(wheelUnlockTimer);
        wheelUnlockTimer = window.setTimeout(() => {
          wheelLocked = false;
          wheelAccum = 0;
        }, 220);
        return;
      }

      wheelAccum += event.deltaY;
      window.clearTimeout(wheelTimer);
      wheelTimer = window.setTimeout(() => {
        if (Math.abs(wheelAccum) >= 24) {
          requestMove(wheelAccum > 0 ? -1 : 1);
        }
        wheelAccum = 0;
        wheelLocked = true;
        wheelUnlockTimer = window.setTimeout(() => {
          wheelLocked = false;
        }, 220);
      }, 90);
    },
    { passive: false }
  );

  // ── Per-card controls ─────────────────────────────────────────
  const wireCard = (card: HTMLElement) => {
    const body = getBody(card);
    if (!body) return;

    const toggle = body.querySelector<HTMLButtonElement>("[data-np-toggle]");
    const prevButton = body.querySelector<HTMLButtonElement>("[data-np-prev]");
    const nextButton = body.querySelector<HTMLButtonElement>("[data-np-next]");
    const restartButton =
      body.querySelector<HTMLButtonElement>("[data-np-restart]");
    const modeButton = body.querySelector<HTMLButtonElement>("[data-np-mode]");
    const seek = body.querySelector<HTMLElement>("[data-np-seek]");

    const cardIndex = () => cardTrackIndex(card);
    const isPlaybackCard = () => cardIndex() === playbackIndex;

    toggle?.addEventListener("click", () => {
      if (card !== activeCard) return;
      togglePlayback(cardIndex());
    });
    prevButton?.addEventListener("click", () => {
      if (card !== activeCard) return;
      previousTrack();
    });
    nextButton?.addEventListener("click", () => {
      if (card !== activeCard) return;
      nextTrack();
    });
    restartButton?.addEventListener("click", () => {
      if (card !== activeCard) return;
      restartTrack(cardIndex());
    });
    modeButton?.addEventListener("click", () => {
      if (card !== activeCard) return;
      const order = ["order", "repeat", "shuffle"] as const;
      const next = order[(order.indexOf(playMode) + 1) % order.length]!;
      setMode(next);
    });

    if (seek) {
      seek.addEventListener("pointerdown", event => {
        if (event.button !== 0) return;
        if (card !== activeCard || !isPlaybackCard()) return;
        isDragging = true;
        seek.dataset.dragging = "true";
        seek.setPointerCapture?.(event.pointerId);
        paintProgress(ratioFromPointer(event, seek) * durationMs);
      });

      seek.addEventListener("pointermove", event => {
        if (card !== activeCard || !isDragging || !isPlaybackCard()) return;
        paintProgress(ratioFromPointer(event, seek) * durationMs);
      });

      const endSeek = (event: PointerEvent) => {
        if (!isDragging) return;
        const wasPlaybackCard = card === activeCard && isPlaybackCard();
        isDragging = false;
        delete seek.dataset.dragging;
        if (wasPlaybackCard) seekToRatio(ratioFromPointer(event, seek));

        if (seek.hasPointerCapture?.(event.pointerId)) {
          seek.releasePointerCapture(event.pointerId);
        }
      };

      seek.addEventListener("pointerup", endSeek);
      seek.addEventListener("pointercancel", endSeek);
      seek.addEventListener("keydown", event => {
        if (card !== activeCard || !isPlaybackCard()) return;
        let next = positionMs / 1000;
        if (event.key === "ArrowRight") next += 5;
        else if (event.key === "ArrowLeft") next -= 5;
        else if (event.key === "Home") next = 0;
        else if (event.key === "End") next = durationMs / 1000;
        else return;

        event.preventDefault();
        seekToSeconds(next);
      });
    }
  };

  deckCards.forEach(wireCard);

  // ── Expanded nine-card carousel ───────────────────────────────
  type ExpandedCard = { el: HTMLElement; trackIndex: number };

  let expandedStage: HTMLElement | null = null;
  let expandedWheel: HTMLElement | null = null;
  let expandedCards: ExpandedCard[] = [];
  let expandedOpen = false;
  let expandedClosing = false;
  let expandedCenter = 0;
  let expandedBaseW = 0;
  let expandedBaseH = 0;
  let expandedCenterScale = 1.2;
  let expandedStep = 70;
  let expandedBelowSteps: number[] = [];
  let expandedWheelShift = 0;
  let expandedOpenTimer = 0;
  let expandedCloseTimer = 0;
  let expandedReturnFocus: HTMLElement | null = null;
  let expandedPreviousOverflow = "";
  let expandedFly: HTMLElement | null = null;
  let expandedInteractionReady = false;
  let expandedRevealTimers: number[] = [];
  let expandedSuppressClickUntil = 0;
  let expandedMobileDrag = false;
  let expandedMobileMoved = false;
  let expandedMobileTriggered = false;
  let expandedMobileStartY = 0;
  let expandedMobileStartX = 0;
  let expandedMobileAxis: "pending" | "vertical" | "horizontal" = "pending";
  let expandedMobilePointer = -1;
  let deckReturnFinals: Array<{
    card: HTMLElement;
    opacity: string;
    filter: string;
  }> = [];

  const settleDeck = () => {
    draggingDeck = false;
    dragPointerId = -1;
    deckOffset = 0;
    deckTarget = 0;
    deckVelocity = 0;
    springing = false;
    pendingMoves.length = 0;
    renderDeck();
  };

  const expandedTargetRect = () => {
    const width = expandedBaseW * expandedCenterScale;
    const height = expandedBaseH * expandedCenterScale;
    return {
      left: (window.innerWidth - width) / 2,
      top: (window.innerHeight - height) / 2,
      width,
      height,
    };
  };

  const makeFlyCard = (trackIndex: number) => {
    const fly = serverCard.cloneNode(true) as HTMLElement;
    fly.classList.add("np-fly-card");
    fly.removeAttribute("data-np-card");
    fly.removeAttribute("data-np-role");
    fly.removeAttribute("data-np-track-index");
    fly.querySelectorAll("[id]").forEach(node => node.removeAttribute("id"));
    const body = getBody(fly);
    if (body) {
      body.setAttribute("inert", "");
      body.setAttribute("aria-hidden", "true");
    }
    applyCardContent(fly, tracks[trackIndex]!, trackIndex);
    const flySeek = fly.querySelector<HTMLElement>("[data-np-seek]");
    const flyCurrent = fly.querySelector<HTMLElement>("[data-np-current]");
    const flyRatio = durationMs > 0 ? positionMs / durationMs : 0;
    flySeek?.style.setProperty("--np-p", `${flyRatio * 100}%`);
    if (flyCurrent) flyCurrent.textContent = formatTime(positionMs);
    fly.style.transform = "";
    fly.style.opacity = "";
    fly.style.filter = "";
    fly.style.zIndex = "";
    return fly;
  };

  const createExpanded = () => {
    if (expandedDialog) return;
    let wheelAccum = 0;

    const astroScope = serverCard
      .getAttributeNames()
      .find(name => name.startsWith("data-astro-cid-"));
    const scope = (el: Element) => {
      if (astroScope) el.setAttribute(astroScope, "");
    };

    const dialog = document.createElement("dialog");
    dialog.className = "np-expand";
    dialog.tabIndex = -1;
    dialog.setAttribute("aria-label", "Music cards");
    scope(dialog);

    const glass = document.createElement("div");
    glass.className = "np-expand-glass";
    scope(glass);

    const stage = document.createElement("div");
    stage.className = "np-expand-stage";
    scope(stage);

    const wheel = document.createElement("div");
    wheel.className = "np-expand-wheel";
    wheel.tabIndex = 0;
    wheel.setAttribute("role", "slider");
    wheel.setAttribute("aria-label", "Music carousel");
    wheel.setAttribute("aria-valuemin", "0");
    wheel.setAttribute("aria-valuemax", String(tracks.length - 1));
    scope(wheel);

    const viewport = document.createElement("div");
    viewport.className = "np-wheel-viewport";
    scope(viewport);

    const tickLayer = document.createElement("div");
    tickLayer.className = "np-wheel-ticks";
    scope(tickLayer);
    viewport.appendChild(tickLayer);

    const wheelPointer = document.createElement("span");
    wheelPointer.className = "np-wheel-pointer";
    wheelPointer.setAttribute("aria-hidden", "true");
    scope(wheelPointer);

    wheel.append(viewport, wheelPointer);

    const halo = document.createElement("div");
    halo.className = "np-expand-halo";
    scope(halo);

    let wheelDragging = false;
    let wheelDragStartY = 0;
    let wheelDragStartCenter = 0;
    let wheelDragStep = 0;

    wheel.addEventListener("pointerdown", event => {
      if (!expandedOpen || expandedClosing || !expandedInteractionReady) return;
      event.preventDefault();
      event.stopPropagation();
      wheelDragging = true;
      wheelDragStartY = event.clientY;
      wheelDragStartCenter = expandedCenter;
      wheelDragStep = 0;
      wheel.classList.add("is-dragging");
      try {
        wheel.setPointerCapture?.(event.pointerId);
      } catch {
        /* pointer may already be gone */
      }
    });

    wheel.addEventListener("pointermove", event => {
      if (!wheelDragging) return;
      const step = Math.trunc((event.clientY - wheelDragStartY) / 22);
      if (step === wheelDragStep) return;
      wheelDragStep = step;
      selectExpanded(wheelDragStartCenter - step);
    });

    const endWheelDrag = (event: PointerEvent) => {
      if (!wheelDragging) return;
      wheelDragging = false;
      wheel.classList.remove("is-dragging");
      try {
        if (wheel.hasPointerCapture?.(event.pointerId)) {
          wheel.releasePointerCapture(event.pointerId);
        }
      } catch {
        /* capture may already be released */
      }
    };

    wheel.addEventListener("pointerup", endWheelDrag);
    wheel.addEventListener("pointercancel", endWheelDrag);

    const close = document.createElement("button");
    close.type = "button";
    close.className = "np-expand-close";
    close.setAttribute("aria-label", "Close");
    close.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';
    scope(close);

    const hint = document.createElement("p");
    hint.className = "np-expand-hint";
    hint.textContent = "↑ ↓ · ESC";
    scope(hint);

    dialog.append(glass, halo, stage, wheel, close, hint);

    close.addEventListener("click", () => closeExpanded());
    dialog.addEventListener("cancel", event => {
      event.preventDefault();
      if (!expandedClosing) closeExpanded();
    });
    dialog.addEventListener("keydown", event => {
      if (!expandedOpen || expandedClosing || !expandedInteractionReady) return;

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "a") {
        event.preventDefault();
        return;
      }

      if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
        event.preventDefault();
        selectExpanded(expandedCenter + 1);
      } else if (event.key === "ArrowDown" || event.key === "ArrowRight") {
        event.preventDefault();
        selectExpanded(expandedCenter - 1);
      }
    });

    let cardWheelUntil = 0;

    dialog.addEventListener(
      "wheel",
      event => {
        if (!expandedOpen || expandedClosing) return;
        event.preventDefault();
        if (!expandedInteractionReady) return;

        const target = event.target instanceof Element ? event.target : null;
        const wheelRect = expandedWheel?.getBoundingClientRect();
        const centerCard = expandedCards.find(
          item => item.el.dataset.center === "true"
        )?.el;
        const centerRect = centerCard?.getBoundingClientRect();
        const x = event.clientX;
        const overWheel = Boolean(target?.closest(".np-expand-wheel"));
        const overCard = Boolean(target?.closest(".np-expand-card"));
        const rightZone =
          overWheel || Boolean(wheelRect && x >= wheelRect.left - 4);

        if (overCard) {
          const now = performance.now();
          const discrete =
            Math.abs(event.deltaY) >= 40 ||
            event.deltaMode !== WheelEvent.DOM_DELTA_PIXEL;
          if (discrete) {
            cardWheelUntil = now + 80;
            selectExpanded(expandedCenter - Math.sign(event.deltaY));
          } else if (now >= cardWheelUntil) {
            cardWheelUntil = now + 260;
            selectExpanded(expandedCenter - Math.sign(event.deltaY));
          }
          return;
        }

        if (rightZone) {
          wheelAccum += event.deltaY;
          const step = Math.trunc(wheelAccum / 22);
          if (!step) return;
          wheelAccum -= step * 22;
          selectExpanded(expandedCenter - Math.max(-3, Math.min(3, step)));
          return;
        }

        if (centerRect && x < centerRect.left) {
          wheelAccum = 0;
          return;
        }
        if (!event.deltaY) return;
        wheelAccum = 0;

        const now = performance.now();
        const discrete =
          Math.abs(event.deltaY) >= 40 ||
          event.deltaMode !== WheelEvent.DOM_DELTA_PIXEL;

        if (discrete) {
          cardWheelUntil = now + 80;
          selectExpanded(expandedCenter - Math.sign(event.deltaY));
          return;
        }

        if (now < cardWheelUntil) return;
        cardWheelUntil = now + 260;
        selectExpanded(expandedCenter - Math.sign(event.deltaY));
      },
      { passive: false }
    );

    document.addEventListener(
      "keydown",
      event => {
        if (!expandedOpen) return;
        if (
          (event.ctrlKey || event.metaKey) &&
          event.key.toLowerCase() === "a"
        ) {
          event.preventDefault();
        }
      },
      { signal: lifecycle.signal }
    );

    expandedDialog = dialog;
    expandedStage = stage;
    expandedWheel = wheel;

    expandedCards = tracks.map((track, trackIndex) => {
      const el = serverCard.cloneNode(true) as HTMLElement;
      el.classList.add("np-expand-card");
      el.removeAttribute("data-np-card");
      el.removeAttribute("data-np-role");
      el.removeAttribute("data-np-track-index");
      el.querySelectorAll("[id]").forEach(node => node.removeAttribute("id"));

      const body = getBody(el);
      if (body) {
        body.setAttribute("inert", "");
        body.setAttribute("aria-hidden", "true");
      }
      applyCardContent(el, track, trackIndex);
      el.dataset.npExpandOffset = "0";

      const isCenter = () =>
        expandedOpen &&
        !expandedClosing &&
        expandedInteractionReady &&
        Number(el.dataset.npExpandOffset || "0") === 0;
      const isPlaybackCenter = () =>
        isCenter() && expandedCenter === playbackIndex;

      const wireButton = (selector: string, action: () => void) => {
        const button = body?.querySelector<HTMLButtonElement>(selector);
        button?.addEventListener("click", event => {
          if (!isCenter()) return;
          event.stopPropagation();
          action();
        });
      };

      wireButton("[data-np-toggle]", () => togglePlayback(expandedCenter));
      wireButton("[data-np-prev]", () =>
        skipPlayback(-1, expandedCenter, isPlaying)
      );
      wireButton("[data-np-next]", () =>
        skipPlayback(1, expandedCenter, isPlaying)
      );
      wireButton("[data-np-restart]", () => restartTrack(expandedCenter));
      wireButton("[data-np-mode]", () => {
        const order = ["order", "repeat", "shuffle"] as const;
        const next = order[(order.indexOf(playMode) + 1) % order.length]!;
        setMode(next);
      });

      const expandedSeek = body?.querySelector<HTMLElement>("[data-np-seek]");
      if (expandedSeek) {
        expandedSeek.addEventListener("pointerdown", event => {
          if (event.button !== 0) return;
          if (!isPlaybackCenter()) return;
          event.preventDefault();
          event.stopPropagation();
          isDragging = true;
          expandedSeek.dataset.dragging = "true";
          expandedSeek.setPointerCapture?.(event.pointerId);
          paintProgress(ratioFromPointer(event, expandedSeek) * durationMs);
        });
        expandedSeek.addEventListener("pointermove", event => {
          if (!isPlaybackCenter() || !isDragging) return;
          paintProgress(ratioFromPointer(event, expandedSeek) * durationMs);
        });
        const endExpandedSeek = (event: PointerEvent) => {
          if (!isDragging) return;
          const wasPlaybackCenter = isPlaybackCenter();
          isDragging = false;
          delete expandedSeek.dataset.dragging;
          if (wasPlaybackCenter)
            seekToRatio(ratioFromPointer(event, expandedSeek));
          if (expandedSeek.hasPointerCapture?.(event.pointerId)) {
            expandedSeek.releasePointerCapture(event.pointerId);
          }
        };
        expandedSeek.addEventListener("pointerup", endExpandedSeek);
        expandedSeek.addEventListener("pointercancel", endExpandedSeek);
        expandedSeek.addEventListener("keydown", event => {
          if (!isCenter()) return;
          let next = positionMs / 1000;
          if (event.key === "ArrowRight") next += 5;
          else if (event.key === "ArrowLeft") next -= 5;
          else if (event.key === "Home") next = 0;
          else if (event.key === "End") next = durationMs / 1000;
          else return;
          event.preventDefault();
          seekToSeconds(next);
        });
      }

      el.addEventListener("click", () => {
        if (!expandedInteractionReady) return;
        if (!expandedOpen || expandedClosing) return;
        const offset = Number(el.dataset.npExpandOffset || "0");
        if (offset === 0 || Math.abs(offset) > 3) return;
        selectExpanded(trackIndex);
      });
      el.addEventListener("keydown", event => {
        if (event.key !== "Enter" && event.key !== " ") return;
        if (!expandedInteractionReady) return;
        if (!expandedOpen || expandedClosing) return;
        const offset = Number(el.dataset.npExpandOffset || "0");
        if (offset === 0 || Math.abs(offset) > 3) return;
        event.preventDefault();
        selectExpanded(trackIndex);
      });

      stage.appendChild(el);
      return { el, trackIndex };
    });

    dialog.addEventListener(
      "pointerdown",
      event => {
        if (event.button !== 0) return;
        if (!expandedOpen || expandedClosing || !expandedInteractionReady)
          return;
        const target = event.target;
        // Sliders already own their gesture (and stop propagation), so only
        // plain inputs need to be excluded here. Control buttons stay in the
        // gesture: a tap runs them, a vertical drag browses the carousel.
        if (
          target instanceof Element &&
          target.closest(
            "input, textarea, select, [role='slider'], [data-np-seek], .np-expand-wheel"
          )
        ) {
          return;
        }

        // Only a drag that starts on the focused card flips the carousel;
        // the empty space and the blurred cards around it stay inert.
        const centerCard = expandedCards.find(
          item => item.trackIndex === expandedCenter
        )?.el;
        const bounds = centerCard?.getBoundingClientRect();
        if (
          !bounds ||
          event.clientX < bounds.left ||
          event.clientX > bounds.right ||
          event.clientY < bounds.top ||
          event.clientY > bounds.bottom
        ) {
          return;
        }

        expandedMobileDrag = true;
        expandedMobileMoved = false;
        expandedMobileTriggered = false;
        expandedMobileAxis = "pending";
        expandedMobilePointer = event.pointerId;
        expandedMobileStartY = event.clientY;
        expandedMobileStartX = event.clientX;
      },
      { passive: true }
    );

    dialog.addEventListener(
      "pointermove",
      event => {
        if (!expandedMobileDrag || event.pointerId !== expandedMobilePointer)
          return;

        const dy = event.clientY - expandedMobileStartY;
        const dx = event.clientX - expandedMobileStartX;

        if (expandedMobileAxis === "pending") {
          if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
          expandedMobileAxis =
            Math.abs(dy) > Math.abs(dx) ? "vertical" : "horizontal";
          if (expandedMobileAxis === "horizontal") {
            // Horizontal gestures belong to the content under the finger.
            expandedMobileDrag = false;
            expandedMobilePointer = -1;
            return;
          }
        }

        if (expandedMobileAxis !== "vertical") return;

        if (Math.abs(dy) > 6) {
          expandedMobileMoved = true;
          // Keep the press from becoming a click on a control button once
          // the gesture reads as a swipe.
          expandedSuppressClickUntil = performance.now() + 600;
        }

        if (!expandedMobileTriggered && Math.abs(dy) > 30) {
          expandedMobileTriggered = true;
          selectExpanded(expandedCenter + (dy < 0 ? -1 : 1));
        }

        if (expandedMobileMoved && event.cancelable) event.preventDefault();
      },
      { passive: false }
    );

    const endExpandedSwipe = (event: PointerEvent) => {
      if (!expandedMobileDrag || event.pointerId !== expandedMobilePointer)
        return;
      const dy = event.clientY - expandedMobileStartY;
      const moved = expandedMobileMoved || expandedMobileAxis === "vertical";
      let suppressClick = moved;
      if (!expandedMobileTriggered && Math.abs(dy) > 30) {
        expandedMobileTriggered = true;
        suppressClick = true;
        selectExpanded(expandedCenter + (dy < 0 ? -1 : 1));
      }
      expandedMobileDrag = false;
      expandedMobileMoved = false;
      expandedMobileTriggered = false;
      expandedMobileAxis = "pending";
      expandedMobilePointer = -1;
      if (suppressClick) expandedSuppressClickUntil = performance.now() + 350;
    };

    dialog.addEventListener("pointerup", endExpandedSwipe);
    dialog.addEventListener("pointercancel", endExpandedSwipe);

    dialog.addEventListener(
      "click",
      event => {
        if (performance.now() >= expandedSuppressClickUntil) return;
        // A swipe that began on a control button must not also trigger that
        // button when the finger lifts.
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
      },
      { capture: true }
    );

    const host = document.getElementById("np-expand-host");
    const persistId = host?.getAttribute("data-astro-transition-persist");
    if (host && persistId) {
      dialog.setAttribute("data-astro-transition-persist", persistId);
      host.replaceWith(dialog);
    } else {
      document.body.appendChild(dialog);
    }
  };

  const measureExpanded = () => {
    expandedBaseW = serverCard.offsetWidth || 480;
    expandedBaseH = serverCard.offsetHeight || 200;

    const maxWidth = Math.min(window.innerWidth * 0.94, 940);
    expandedCenterScale = clamp(maxWidth / expandedBaseW, 1.02, 1.3);

    const outerHalf = (expandedBaseH * expandedCenterScale * 0.56) / 2;
    const maxHalf = window.innerHeight * 0.43;
    expandedStep = clamp((maxHalf - outerHalf) / 4, 36, 88);
    const centerHeight = expandedBaseH * expandedCenterScale;
    expandedBelowSteps = [0.86, 1.2, 1.46, 1.68].map(
      factor => factor * centerHeight
    );

    if (expandedWheel) {
      const half = (expandedBaseW * expandedCenterScale) / 2;
      const wheelWidth = expandedWheel.offsetWidth || 36;
      const idealLeft = window.innerWidth / 2 + half + 50;
      const maxLeft = window.innerWidth - wheelWidth - 16;
      const fits = idealLeft <= maxLeft;
      // Keep the indicator fully on screen; hide it when the card leaves no
      // room instead of letting the ticks get clipped by the viewport.
      expandedWheel.style.left = `${fits ? idealLeft : maxLeft}px`;
      expandedWheel.style.opacity = fits ? "" : "0";
      expandedWheel.style.pointerEvents = fits ? "" : "none";
    }

    expandedDialog?.style.setProperty("--np-expand-h", `${expandedBaseH}px`);
    expandedStage?.style.setProperty("--np-expand-w", `${expandedBaseW}px`);
  };

  const renderExpanded = () => {
    if (!expandedStage) return;

    const count = tracks.length;
    const scaleFactors = [1, 0.9, 0.78, 0.66, 0.56];
    const opacityFactors = [1, 0.94, 0.74, 0.48, 0.24];
    const blurFactors = [0, 0.8, 2.2, 4.2, 7];

    expandedCards.forEach(({ el, trackIndex }) => {
      let offset = trackIndex - expandedCenter;
      if (offset > count / 2) offset -= count;
      if (offset < -count / 2) offset += count;

      const abs = Math.abs(offset);
      if (abs > 4) {
        el.hidden = true;
        el.dataset.clickable = "false";
        el.tabIndex = -1;
        return;
      }

      el.hidden = false;
      const sign = Math.sign(offset);
      const scale = scaleFactors[abs]!;
      const angle = sign * abs * 7;
      const offsetY =
        offset === 0
          ? 0
          : offset > 0
            ? -offset * expandedStep
            : (expandedBelowSteps[abs - 1] ?? 0);

      // The card is laid out at its enlarged size via zoom instead of being
      // transform-scaled up: transformed text was re-rastered at the small
      // layout size and looked blurry. Transforms below stay relative.
      el.style.zoom = String(expandedCenterScale);
      const zoom = expandedCenterScale || 1;
      el.style.transform = `translate(-50%, -50%) translateY(${
        offsetY / zoom
      }px) translateZ(${(-abs * 18) / zoom}px) rotateX(${angle}deg) scale(${scale})`;
      el.style.opacity = String(opacityFactors[abs]!);
      el.style.filter =
        abs === 0
          ? "none"
          : blurFactors[abs]! > 0.01
            ? `blur(${blurFactors[abs]}px)`
            : "none";
      el.style.zIndex = abs === 0 ? "50" : String(Math.max(1, 50 - offset));
      el.dataset.npExpandOffset = String(offset);

      const clickable = abs >= 1 && abs <= 3;
      el.dataset.clickable = String(clickable);
      el.dataset.center = String(abs === 0);
      el.style.pointerEvents = clickable || abs === 0 ? "auto" : "none";
      el.tabIndex = clickable ? 0 : -1;
      el.setAttribute("role", clickable ? "button" : "group");

      if (clickable) {
        const track = tracks[trackIndex]!;
        el.setAttribute("aria-label", `${track.title} — ${track.artist}`);
      } else {
        el.removeAttribute("aria-label");
      }

      const body = getBody(el);
      if (body) {
        const isCenter = abs === 0 && expandedInteractionReady;
        body.toggleAttribute("inert", !isCenter);
        if (isCenter) body.removeAttribute("aria-hidden");
        else body.setAttribute("aria-hidden", "true");
      }
    });

    expandedWheel?.setAttribute("aria-valuenow", String(expandedCenter));
  };

  type ExpandedFinalStyle = {
    transform: string;
    opacity: string;
    filter: string;
    zIndex: string;
  };
  const expandedFinalStyles = new Map<HTMLElement, ExpandedFinalStyle>();

  const captureExpandedFinals = () => {
    expandedFinalStyles.clear();
    expandedCards.forEach(({ el }) => {
      expandedFinalStyles.set(el, {
        transform: el.style.transform,
        opacity: el.style.opacity || "1",
        filter: el.style.filter || "none",
        zIndex: el.style.zIndex || "50",
      });
    });
  };

  const hideExpandedForIntro = () => {
    expandedCards.forEach(({ el }) => {
      el.style.visibility = "hidden";
      el.style.opacity = "0";
      el.style.filter = "blur(7px)";
      el.tabIndex = -1;
      el.setAttribute("aria-hidden", "true");
      const body = getBody(el);
      body?.setAttribute("inert", "");
      body?.setAttribute("aria-hidden", "true");
    });
  };

  const showExpandedCenter = () => {
    const center = expandedCards.find(
      item => item.trackIndex === expandedCenter
    );
    if (!center) return;
    const final = expandedFinalStyles.get(center.el);
    center.el.style.visibility = "visible";
    center.el.style.opacity = final?.opacity ?? "1";
    center.el.style.filter = "none";
    center.el.style.zIndex = "50";
    center.el.tabIndex = -1;
    center.el.removeAttribute("aria-hidden");
  };

  const setExpandedCenterInteractive = (active: boolean) => {
    const center = expandedCards.find(
      item => item.trackIndex === expandedCenter
    );
    if (!center) return;
    const body = getBody(center.el);
    body?.toggleAttribute("inert", !active);
    if (active) body?.removeAttribute("aria-hidden");
    else body?.setAttribute("aria-hidden", "true");
  };

  const revealExpandedPair = (distance: number) => {
    const centerTransform = `translate(-50%, -50%) translateY(0px) translateZ(0px) rotateX(0deg) scale(0.96)`;

    expandedCards.forEach(({ el }) => {
      if (Math.abs(Number(el.dataset.npExpandOffset || "0")) !== distance)
        return;
      const final = expandedFinalStyles.get(el);
      if (!final) return;

      el.style.visibility = "visible";
      el.style.opacity = final.opacity;
      el.style.filter = final.filter;
      el.style.transform = final.transform;
      el.style.zIndex = final.zIndex;
      el.tabIndex = distance <= 3 ? 0 : -1;
      el.removeAttribute("aria-hidden");

      if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        el.animate(
          [
            {
              transform: centerTransform,
              opacity: 0,
              filter: "blur(7px)",
            },
            {
              transform: final.transform,
              opacity: Number(final.opacity),
              filter: final.filter === "none" ? "blur(0px)" : final.filter,
            },
          ],
          {
            duration: 340,
            easing: "cubic-bezier(0.16, 1, 0.3, 1)",
            fill: "backwards",
          }
        );
      }
    });
  };

  const clearExpandedTimers = () => {
    expandedRevealTimers.forEach(timer => window.clearTimeout(timer));
    expandedRevealTimers = [];
    window.clearTimeout(expandedOpenTimer);
    window.clearTimeout(expandedCloseTimer);
  };

  const finishExpandedReveal = () => {
    if (!expandedOpen || expandedClosing) return;
    expandedInteractionReady = true;
    setExpandedCenterInteractive(true);
    expandedDialog?.setAttribute("data-ready", "true");
    expandedDialog?.classList.add("is-wheel-ready", "is-ui-ready");
  };

  const revealExpandedRing = () => {
    expandedRevealTimers.push(
      window.setTimeout(() => revealExpandedPair(1), 40)
    );
    expandedRevealTimers.push(
      window.setTimeout(() => revealExpandedPair(2), 105)
    );
    expandedRevealTimers.push(
      window.setTimeout(() => revealExpandedPair(3), 170)
    );
    expandedRevealTimers.push(
      window.setTimeout(() => revealExpandedPair(4), 235)
    );
  };

  const shiftExpandedWheel = (delta: number) => {
    if (!expandedWheel || !delta) return;
    const tickLayer =
      expandedWheel.querySelector<HTMLElement>(".np-wheel-ticks");
    if (!tickLayer) return;
    const tickGap = 5;
    expandedWheelShift -= delta * tickGap;
    tickLayer.style.setProperty("--np-wheel-shift", `${expandedWheelShift}px`);
  };

  function applyExpandedCenter(target: number) {
    const count = tracks.length;
    if (!count) return;
    const next = ((target % count) + count) % count;
    const previous = expandedCenter;
    let delta = next - previous;
    if (delta > count / 2) delta -= count;
    if (delta < -count / 2) delta += count;
    expandedCenter = next;
    playGearSwitch();
    shiftExpandedWheel(delta);
    setDeckWindow(next);
    renderExpanded();
    paintAllCards();
    syncExpandedProgress();
  }

  const selectExpanded = (trackIndex: number) => {
    if (!expandedOpen || expandedClosing || !expandedInteractionReady) return;
    const count = tracks.length;
    if (!count) return;

    const next = ((trackIndex % count) + count) % count;
    if (next === expandedCenter) return;
    applyExpandedCenter(next);
  };

  const syncExpandedProgress = () => {
    paintAllCards();
  };

  // Closing and reopening in quick succession used to leave the dialog stuck
  // in its finished-close state. Rolling the close transition back before
  // starting a new opening keeps both directions interruptible.
  const cancelExpandedClose = () => {
    if (!expandedClosing) return;

    expandedClosing = false;
    clearExpandedTimers();

    if (expandedFly) {
      expandedFly.remove();
      expandedFly = null;
    }

    expandedCards.forEach(({ el }) => {
      if (el.style.visibility === "hidden") el.style.visibility = "";
    });

    deckReturnFinals.forEach(entry => {
      entry.card.style.opacity = entry.opacity;
      entry.card.style.filter = entry.filter;
    });
    deckReturnFinals = [];

    delete root!.dataset.npReturning;
    deckSuspended = false;
    expandedOpen = false;
    expandedInteractionReady = false;
    document.body.style.overflow = expandedPreviousOverflow;
    expandedDialog?.classList.remove("is-closing");
  };

  function openExpanded() {
    if (expandedClosing) cancelExpandedClose();
    if (expandedOpen) return;

    deckSuspended = false;
    settleDeck();
    deckSuspended = true;
    createExpanded();
    if (!expandedDialog || !expandedStage) {
      deckSuspended = false;
      return;
    }

    clearExpandedTimers();
    if (root!.dataset.npReturning === "true") {
      delete root!.dataset.npReturning;
      deckReturnFinals = [];
    }
    measureExpanded();
    expandedCenter = index;
    expandedWheelShift = 0;
    expandedWheel
      ?.querySelector<HTMLElement>(".np-wheel-ticks")
      ?.style.setProperty("--np-wheel-shift", "0px");
    expandedInteractionReady = false;
    renderExpanded();
    captureExpandedFinals();
    hideExpandedForIntro();
    syncExpandedProgress();

    expandedReturnFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    expandedPreviousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    expandedOpen = true;

    expandedDialog.classList.remove(
      "is-open",
      "is-closing",
      "is-wheel-ready",
      "is-ui-ready"
    );
    expandedDialog.classList.toggle("is-playing", isPlaying);
    expandedDialog.removeAttribute("data-ready");
    const hint = expandedDialog.querySelector<HTMLElement>(".np-expand-hint");
    if (hint) {
      hint.textContent = window.matchMedia("(max-width: 860px)").matches
        ? "SWIPE · TAP ×"
        : "↑ ↓ · ESC";
    }
    if (!expandedDialog.open) expandedDialog.showModal();
    expandedDialog.focus({ preventScroll: true });

    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (reduce) {
      expandedDialog.classList.add("is-open");
      expandedCards.forEach(({ el }) => {
        const final = expandedFinalStyles.get(el);
        if (!final) return;
        el.style.visibility = "visible";
        el.style.opacity = final.opacity;
        el.style.filter = final.filter;
        el.style.transform = final.transform;
        el.style.zIndex = final.zIndex;
        el.removeAttribute("aria-hidden");
      });
      showExpandedCenter();
      expandedDialog.setAttribute("data-ready", "true");
      expandedInteractionReady = true;
      setExpandedCenterInteractive(true);
      expandedDialog.classList.add("is-wheel-ready", "is-ui-ready");
      return;
    }

    const source = activeCard.getBoundingClientRect();
    const centerCard = expandedCards.find(
      item => item.trackIndex === expandedCenter
    )?.el;
    const target = centerCard
      ? centerCard.getBoundingClientRect()
      : expandedTargetRect();
    const fly = makeFlyCard(index);
    fly.style.width = `${expandedBaseW}px`;
    fly.style.left = `${source.left}px`;
    fly.style.top = `${source.top}px`;
    fly.style.opacity = "0";
    fly.style.transform = `scale(${source.width / expandedBaseW})`;

    expandedDialog.appendChild(fly);
    expandedFly = fly;

    requestAnimationFrame(() => {
      expandedDialog?.classList.add("is-open");
      expandedRevealTimers.push(
        window.setTimeout(() => {
          if (expandedFly !== fly) return;
          fly.style.opacity = "1";
          fly.style.transform = `translate(${
            target.left - source.left
          }px, ${target.top - source.top}px) scale(${
            target.width / expandedBaseW
          })`;
        }, 45)
      );
    });

    const finishOpen = () => {
      window.clearTimeout(expandedOpenTimer);
      if (expandedFly !== fly) return;
      fly.remove();
      expandedFly = null;
      showExpandedCenter();
      expandedDialog?.classList.add("is-open");
      finishExpandedReveal();
      expandedRevealTimers.push(
        window.setTimeout(() => revealExpandedRing(), 20)
      );
    };

    fly.addEventListener("transitionend", event => {
      if (event.propertyName === "transform") finishOpen();
    });
    expandedOpenTimer = window.setTimeout(finishOpen, 560);
  }

  function closeExpanded() {
    if (!expandedOpen || expandedClosing) return;
    expandedClosing = true;
    expandedInteractionReady = false;
    deckSuspended = true;
    setExpandedCenterInteractive(false);
    clearExpandedTimers();

    if (expandedFly) {
      expandedFly.remove();
      expandedFly = null;
    }

    const dialog = expandedDialog;
    if (!dialog) {
      expandedOpen = false;
      expandedClosing = false;
      document.body.style.overflow = expandedPreviousOverflow;
      return;
    }

    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    deckReturnFinals = deckCards.map(card => ({
      card,
      opacity: card.style.opacity || "1",
      filter: card.style.filter || "none",
    }));
    root!.dataset.npReturning = "true";
    deckCards.forEach(card => {
      card.style.opacity = "0";
      card.style.filter = "blur(2px)";
    });

    // Flush any deck content deferred while the carousel was open, now that
    // the footer cards are invisible for the close transition.
    if (deckPendingCenter !== null) {
      index = deckPendingCenter;
      deckPendingCenter = null;
      applyDeckWindowContent();
      setActiveCard(deckCards[0]!);
      paintAllCards();
    }

    measureExpanded();
    const center = expandedCards.find(
      item => item.trackIndex === expandedCenter
    );
    const source = center
      ? center.el.getBoundingClientRect()
      : expandedTargetRect();
    const target = activeCard.getBoundingClientRect();
    const fly = makeFlyCard(expandedCenter);
    fly.style.width = `${expandedBaseW}px`;
    fly.style.left = `${source.left}px`;
    fly.style.top = `${source.top}px`;
    fly.style.transform = `scale(${source.width / expandedBaseW})`;

    if (center) center.el.style.visibility = "hidden";

    dialog.appendChild(fly);
    expandedFly = fly;
    dialog.classList.remove("is-open");
    dialog.classList.add("is-closing");

    const revealDeck = (index: number) => {
      if (index >= deckReturnFinals.length) {
        expandedRevealTimers.push(
          window.setTimeout(() => {
            if (!expandedOpen) delete root!.dataset.npReturning;
            deckSuspended = false;
          }, 240)
        );
        return;
      }

      const entry = deckReturnFinals[index]!;
      entry.card.style.opacity = entry.opacity;
      entry.card.style.filter = entry.filter;
      expandedRevealTimers.push(
        window.setTimeout(() => revealDeck(index + 1), index === 0 ? 20 : 65)
      );
    };

    const finishClose = () => {
      window.clearTimeout(expandedCloseTimer);
      if (expandedFly !== fly) return;
      fly.remove();
      expandedFly = null;
      if (dialog.open) dialog.close();
      dialog.classList.remove(
        "is-open",
        "is-closing",
        "is-wheel-ready",
        "is-ui-ready"
      );
      dialog.removeAttribute("data-ready");
      expandedCards.forEach(({ el }) => {
        if (el.style.visibility === "hidden") el.style.visibility = "";
      });
      document.body.style.overflow = expandedPreviousOverflow;
      expandedOpen = false;
      expandedClosing = false;
      expandedReturnFocus?.focus({ preventScroll: true });
      expandedReturnFocus = null;

      if (reduce) {
        deckReturnFinals.forEach(entry => {
          entry.card.style.opacity = entry.opacity;
          entry.card.style.filter = entry.filter;
        });
        delete root!.dataset.npReturning;
        deckSuspended = false;
      } else {
        revealDeck(0);
      }
    };

    if (reduce) {
      finishClose();
      return;
    }

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        fly.style.transform = `translate(${
          target.left - source.left
        }px, ${target.top - source.top}px) scale(${
          target.width / expandedBaseW
        })`;
      });
    });

    fly.addEventListener("transitionend", event => {
      if (event.propertyName === "transform") finishClose();
    });
    expandedCloseTimer = window.setTimeout(finishClose, 560);
  }

  window.addEventListener(
    "resize",
    () => {
      if (!expandedOpen || expandedClosing) return;
      measureExpanded();
      renderExpanded();
      if (!expandedInteractionReady) captureExpandedFinals();
    },
    { signal: lifecycle.signal }
  );

  // ── Media keyboard shortcuts ──────────────────────────────────
  if (mediaKeysCleanup) mediaKeysCleanup.abort();
  mediaKeysCleanup = new AbortController();

  const isTypingTarget = (target: EventTarget | null) =>
    target instanceof HTMLElement &&
    (target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.tagName === "SELECT" ||
      target.isContentEditable);

  const hasBlockingOverlay = () => {
    if (expandedOpen) return true;
    const terminal = document.querySelector<HTMLElement>("[data-terminal]");
    if (terminal && !terminal.hidden) return true;
    const search = document.getElementById("search-modal");
    if (search && search.classList.contains("active")) return true;
    const shortcuts = document.querySelector<HTMLElement>("[data-shortcuts]");
    if (shortcuts && !shortcuts.hidden) return true;
    return false;
  };

  document.addEventListener(
    "keydown",
    event => {
      if (event.defaultPrevented) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTypingTarget(event.target) || hasBlockingOverlay()) return;

      if (event.key.toLowerCase() === "k") {
        event.preventDefault();
        togglePlayback();
        return;
      }

      if (event.shiftKey && event.key === "ArrowLeft") {
        event.preventDefault();
        previousTrack();
        return;
      }

      if (event.shiftKey && event.key === "ArrowRight") {
        event.preventDefault();
        nextTrack();
      }
    },
    { signal: mediaKeysCleanup.signal }
  );

  // ── Initialise ────────────────────────────────────────────────
  setActiveCard(deckCards[0]!);
  setMode(playMode);

  if (liveState) {
    globalPlayer.started = true;
    if (source === "local" && audio.getAttribute("src")) {
      root.dataset.npSource = "local";
      positionMs = Number.isFinite(audio.currentTime)
        ? audio.currentTime * 1000
        : globalPlayer.positionMs;
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        durationMs = audio.duration * 1000;
      }
      setPlaying(!audio.paused);
    } else if (source === "local") {
      loadPlaybackTrack(playbackIndex, false);
    } else {
      root.dataset.npSource = "spotify";
      positionMs = globalPlayer.positionMs;
      isPlaying = false;
      paintAllCards();
      const track = tracks[playbackIndex];
      if (track) {
        void connectSpotify(
          track,
          globalPlayer.playing,
          globalPlayer.positionMs / 1000
        );
      }
    }
  } else if (storedState) {
    if (source === "local") {
      loadPlaybackTrack(playbackIndex, false);
    } else {
      restorePending = false;
      positionMs = storedState.position * 1000;
      isPlaying = false;
      paintAllCards();
      const track = tracks[playbackIndex];
      if (track) {
        void connectSpotify(track, storedState.playing, storedState.position);
      }
    }
  } else {
    loadPlaybackTrack(0, false);
  }

  paintDuration();
  paintProgress(positionMs);
  saveMusicState(true);
  syncStageHeight();
  measureDeck();
  renderDeck();

  // Locale switches update only the text and accessible labels of the
  // persisted player. Replacing the markup would recreate the deck, reset its
  // transforms and interrupt playback, so labels are applied in place.
  const applyMusicLabels = (next: Partial<MusicLabels>) => {
    labels = { ...labels, ...next };

    const setLabel = (node: HTMLElement | null, value: string) => {
      if (node && node.textContent !== value) node.textContent = value;
    };
    const setLabelAttr = (node: Element | null, value: string) => {
      if (node && node.getAttribute("aria-label") !== value) {
        node.setAttribute("aria-label", value);
      }
    };

    const applyToCard = (card: HTMLElement) => {
      setLabel(
        card.querySelector<HTMLElement>("[data-np-eyebrow]"),
        labels.eyebrow
      );
      setLabel(card.querySelector<HTMLElement>(".np-enjoy"), labels.enjoy);
      setLabelAttr(card.querySelector("[data-np-link]"), labels.open);
      setLabelAttr(card.querySelector("[data-np-seek]"), labels.seek);
      setLabelAttr(card.querySelector("[data-np-prev]"), labels.previous);
      setLabelAttr(card.querySelector("[data-np-next]"), labels.next);
      setLabelAttr(card.querySelector("[data-np-restart]"), labels.restart);
    };

    if (root.getAttribute("aria-label") !== labels.eyebrow) {
      root.setAttribute("aria-label", labels.eyebrow);
    }

    deckCards.forEach(applyToCard);
    expandedCards.forEach(({ el }) => applyToCard(el));
    if (expandedFly) applyToCard(expandedFly);

    // Play/pause and mode labels depend on the live state, so repaint them
    // from the new labels instead of hard-coding the server defaults.
    deckCards.forEach(paintCardState);
    expandedCards.forEach(({ el }) => paintCardState(el));
    setMode(playMode);

    // Keep the inline JSON in sync in case the player is ever initialised
    // again (for example by a full reload or a page without persistence).
    const dataEl = (
      root.closest<HTMLElement>("#site-music-player") ?? root
    ).querySelector<HTMLScriptElement>("[data-np-data]");
    if (dataEl) dataEl.textContent = JSON.stringify({ tracks, labels });
  };

  root.addEventListener("blog-music:labels", event => {
    const next = (event as CustomEvent<Partial<MusicLabels>>).detail;
    if (next) applyMusicLabels(next);
  });

  applyMusicLabels({});

  let stageObserver: ResizeObserver | null = null;
  let warmObserver: IntersectionObserver | null = null;

  document.addEventListener(
    "astro:before-swap",
    event => {
      saveMusicState(true);

      // A locale switch only changes the surrounding page. Keep the mounted
      // player, deck transforms, open carousel and audio listeners untouched so
      // playback and the card layout survive the swap.
      if (
        localeOfPath(event.from.pathname) !== localeOfPath(event.to.pathname)
      ) {
        return;
      }

      clearExpandedTimers();
      if (deckFrame) {
        cancelAnimationFrame(deckFrame);
        deckFrame = 0;
      }
      window.clearTimeout(wheelTimer);
      window.clearTimeout(wheelUnlockTimer);
      wheelTimer = 0;
      wheelUnlockTimer = 0;
      pendingMoves.length = 0;
      stageObserver?.disconnect();
      stageObserver = null;
      warmObserver?.disconnect();
      warmObserver = null;
      if (expandedFly) {
        expandedFly.remove();
        expandedFly = null;
      }
      if (expandedDialog) {
        expandedDialog.classList.remove(
          "is-open",
          "is-closing",
          "is-wheel-ready",
          "is-ui-ready"
        );
        if (expandedDialog.open) expandedDialog.close();
        expandedDialog.remove();
        expandedDialog = null;
        expandedStage = null;
        expandedWheel = null;
        expandedCards = [];
        expandedFinalStyles.clear();
      }
      expandedOpen = false;
      expandedClosing = false;
      expandedInteractionReady = false;
      expandedWheelShift = 0;
      deckSuspended = false;
      deckPendingCenter = null;
      delete root!.dataset.npReturning;
      deckReturnFinals = [];
      document.body.style.overflow = expandedPreviousOverflow;
      // Stop any in-flight embed boot or delayed seek owned by this page.
      lifecycle.abort();
    },
    { signal: lifecycle.signal }
  );

  document.addEventListener("astro:after-swap", () => {
    if (!root.isConnected || !expandedOpen) return;
    document.body.style.overflow = "hidden";

    // Persisting the dialog through the page swap can drop it from the top
    // layer in some browsers even though it is still `open`; restore the
    // modal state without rebuilding the carousel.
    if (
      expandedDialog &&
      expandedDialog.open &&
      !expandedDialog.matches(":modal")
    ) {
      try {
        expandedDialog.close();
        expandedDialog.showModal();
      } catch {
        /* the dialog may already be gone */
      }
    }
  });

  if ("ResizeObserver" in window) {
    stageObserver = new ResizeObserver(() => {
      if (deckSuspended) return;
      measureDeck();
      renderDeck();
    });
    stageObserver.observe(serverCard);
  }

  // Warm up Spotify and the cover art only when the card enters the viewport.
  if ("IntersectionObserver" in window) {
    warmObserver = new IntersectionObserver(
      entries => {
        if (!entries.some(entry => entry.isIntersecting)) return;
        warmObserver?.disconnect();
        warmObserver = null;
        const track = tracks[index];
        if (track && !track.isLocal) void connectSpotify(track, false);

        // Decode covers before the user browses, so switching cards does not
        // flash an empty or half-painted artwork.
        window.setTimeout(() => {
          tracks.forEach(entry => {
            const img = new Image();
            img.decoding = "async";
            img.src = entry.cover;
          });
        }, 250);
      },
      { rootMargin: "240px 0px" }
    );
    warmObserver.observe(root);
  }

  // ── Public API used by the hero terminal ──────────────────────
  window.__blogMusic = {
    tracks: tracks.map(track => ({
      title: track.title,
      artist: track.artist,
      album: track.album,
      duration: track.duration,
      lyrics: track.lyrics.map(line => line.text),
      isLocal: track.isLocal,
    })),
    getState,
    play: (nextIndex?: number) => {
      if (typeof nextIndex === "number" && tracks[nextIndex]) {
        const wasPlaying = isPlaying;
        jumpToTrack(nextIndex, wasPlaying);
        if (!wasPlaying) togglePlayback();
        return;
      }

      if (!isPlaying) togglePlayback();
    },
    pause: () => {
      if (source === "local") audio.pause();
      else spotifyController?.pause();
    },
    toggle: togglePlayback,
    next: nextTrack,
    previous: previousTrack,
    seek: seekToSeconds,
  };

  emitState();
};

document.addEventListener("astro:page-load", initNowPlaying);
window.addEventListener("pagehide", () => {
  const player = getGlobalMusicPlayer();
  try {
    sessionStorage.setItem(
      MUSIC_STATE_KEY,
      JSON.stringify({
        trackIndex: player.trackIndex,
        position: player.positionMs / 1000,
        playing: player.playing,
        mode: player.mode,
        browseIndex: player.browseIndex,
        source: player.source,
      })
    );
  } catch {
    /* storage can be unavailable */
  }
});
initNowPlaying();
