export const SITE = {
  website: "https://jdeng1999.github.io/",
  author: "J. Deng (邓佳)",
  profile:
    (typeof process !== "undefined" && process.env?.PUBLIC_SOCIAL_GITHUB) ||
    (import.meta.env?.PUBLIC_SOCIAL_GITHUB ?? ""), // set in .env
  desc: "一名 Java 后端开发者，记录技术实践、项目探索与个人成长。",
  title: "J. Deng (邓佳)",
  ogImage: "jdeng-og.png", // located in the public folder
  lightAndDarkMode: true,
  postPerIndex: 6,
  postPerPage: 12,
  scheduledPostMargin: 15 * 60 * 1000, // 15 minutes
  showArchives: true,
  showGalleries: true,
  showGalleriesInIndex: true, // Show galleries in the general paginated list (only if showGalleries is true)
  showBackButton: true, // show back button in post detail
  showTagsInCards: true, // show tag pills at the bottom of post cards
  showCoverImages: false, // show cover images (OG) in post cards (requires pnpm build in dev mode)
  indexPostsGrid: false, // show recent/featured posts in grid layout on the home page (like /posts page)
  heroTerminalPrompt: {
    prefix: "~", // highlighted part on the left
    path: "/ready-to-go", // central prompt text
    suffix: "$", // terminal symbol on the right
  },
  backdropEffects: {
    cursorGlow: true, // cursor tracking with soft halo
    grain: true, // background visual noise layer
  },
  editPost: {
    enabled: true,
    text: "Edit this post",
    url: process.env.PUBLIC_EDIT_POST_URL ?? "", // set in .env
  },
  dynamicOgImage: true,
  dir: "ltr", // "rtl" | "auto"
  lang: "en", // html lang code. Set this empty and default will be "en"
  timezone: "Asia/Shanghai", // Default global timezone (IANA format) https://en.wikipedia.org/wiki/List_of_tz_database_time_zones
  introAudio: {
    enabled: false, // the hero/compact player is intentionally disabled; the footer music card is the only player
    // src: path to file (relative to /public or absolute URL). Example: "/intro.mp3" or "https://example.com/stream"
    src: "https://fluxfm.streamabc.net/flx-chillhop-mp3-128-8581707",
    // src: "/audio/intro-web.mp3",
    isStream: true, // true for radio/live stream URLs (example: https://fluxfm.streamabc.net/flx-chillhop-mp3-128-8581707)
    label: "LOFI", // display label in player
    duration: 30, // duration in seconds (used for local files, ignored on streams)
  },
  spotify: {
    enabled: true, // show/hide the custom music card in the footer
    // To give every visitor the full song (not just Spotify's 30s preview),
    // place the audio files in `public/audio/` and keep the `src` paths below.
    // If a local file is missing, that track falls back to Spotify's preview.
    tracks: [
      {
        title: "青花瓷",
        artist: "周杰伦",
        album: "我很忙",
        cover: "/spotify/qinghuaci.jpg",
        url: "https://open.spotify.com/track/479lquEL4Mzh3tQLtnHVfL",
        src: "/audio/qinghuaci.mp3",
        duration: 237, // fallback duration in seconds, refined by the player
        lyrics: ["素胚勾勒出青花笔锋浓转淡", "瓶身描绘的牡丹一如你初妆"],
      },
      {
        title: "兰亭序",
        artist: "周杰伦",
        album: "魔杰座",
        cover: "/spotify/lantingxu.jpg",
        url: "https://open.spotify.com/track/2k3NAOhrpY4DJJlt5XjDKF",
        src: "/audio/lantingxu.mp3",
        duration: 319,
        lyrics: ["兰亭临帖 行书如行云流水", "月下门推 心细如你脚步碎"],
      },
    ],
  },
  likes: {
    enabled: true, // show/hide the local like button in the footer
    base: 3744, // displayed count before the visitor likes the site
  },
} as const;
