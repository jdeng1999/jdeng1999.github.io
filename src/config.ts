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
        lyrics: [
          { at: 0.19, text: "素胚勾勒出青花笔锋浓转淡" },
          { at: 0.22, text: "瓶身描绘的牡丹一如你初妆" },
          { at: 0.245, text: "冉冉檀香透过窗心事我了然" },
          { at: 0.27, text: "宣纸上走笔至此搁一半" },
          { at: 0.295, text: "釉色渲染仕女图韵味被私藏" },
          { at: 0.32, text: "而你嫣然的一笑如含苞待放" },
          { at: 0.35, text: "你的美一缕飘散 去到我去不了的地方" },
          { at: 0.386, text: "天青色等烟雨 而我在等你" },
          { at: 0.41, text: "炊烟袅袅升起 隔江千万里" },
          { at: 0.435, text: "在瓶底书汉隶仿前朝的飘逸" },
          { at: 0.46, text: "就当我为遇见你伏笔" },
          { at: 0.49, text: "月色被打捞起 晕开了结局" },
        ],
      },
      {
        title: "兰亭序",
        artist: "周杰伦",
        album: "魔杰座",
        cover: "/spotify/lantingxu.jpg",
        url: "https://open.spotify.com/track/2k3NAOhrpY4DJJlt5XjDKF",
        src: "/audio/lantingxu.mp3",
        duration: 319,
        lyrics: [
          { at: 0.088, text: "兰亭临帖 行书如行云流水" },
          { at: 0.107, text: "月下门推 心细如你脚步碎" },
          { at: 0.125, text: "忙不迭 千年碑易拓" },
          { at: 0.141, text: "却难拓你的美" },
          { at: 0.16, text: "真迹绝 真心能给谁" },
          { at: 0.179, text: "牧笛横吹 黄酒小菜又几碟" },
          { at: 0.197, text: "夕阳余晖 如你的羞怯似醉" },
          { at: 0.216, text: "摹本易写 而墨香不退" },
          { at: 0.235, text: "悬笔一绝 那岸边浪千叠" },
          { at: 0.254, text: "情字何解 怎落笔都不对" },
          { at: 0.273, text: "而我独缺 你一生的了解" },
        ],
      },
      {
        title: "发如雪",
        artist: "周杰伦",
        album: "十一月的萧邦",
        cover: "/spotify/faruxue.jpg",
        url: "https://open.spotify.com/track/1jEAOrekJF0h2Rvf6mpCLd",
        src: "/audio/faruxue.mp3",
        duration: 302,
        lyrics: [
          { at: 0.116, text: "狼牙月 伊人憔悴" },
          { at: 0.136, text: "我举杯 饮尽了风雪" },
          { at: 0.156, text: "是谁打翻前世柜" },
          { at: 0.172, text: "惹尘埃是非" },
          { at: 0.192, text: "缘字诀 几番轮回" },
          { at: 0.212, text: "你锁眉 哭红颜唤不回" },
          { at: 0.232, text: "纵然青史已经成灰" },
          { at: 0.248, text: "我爱不灭" },
          { at: 0.268, text: "繁华如三千东流水" },
          { at: 0.288, text: "我只取一瓢爱了解" },
        ],
      },
      {
        title: "东风破",
        artist: "周杰伦",
        album: "叶惠美",
        cover: "/spotify/dongfengpo.jpg",
        url: "https://open.spotify.com/track/3WTd8qNJhJHAgRG6FhdSPZ",
        src: "/audio/dongfengpo.mp3",
        duration: 313,
        lyrics: [
          { at: 0.09, text: "一盏离愁孤单伫立在窗口" },
          { at: 0.115, text: "我在门后假装你人还没走" },
          { at: 0.14, text: "旧地如重游月圆更寂寞" },
          { at: 0.165, text: "夜半清醒的烛火不忍苛责我" },
        ],
      },
      {
        title: "七里香",
        artist: "周杰伦",
        album: "七里香",
        cover: "/spotify/qilixiang.jpg",
        url: "https://open.spotify.com/track/3kwqNLXvsjSrIXbVsRBj8q",
        src: "",
        duration: 295,
        lyrics: [
          { at: 0.12, text: "窗外的麻雀 在电线杆上多嘴" },
          { at: 0.16, text: "你说这一句 很有夏天的感觉" },
          { at: 0.2, text: "手中的铅笔 在纸上来来回回" },
          { at: 0.24, text: "我用几行字形容你是我的谁" },
        ],
      },
      {
        title: "晴天",
        artist: "周杰伦",
        album: "叶惠美",
        cover: "/spotify/qingtian.jpg",
        url: "https://open.spotify.com/track/7iTlFxFUDlqAb4I4wcY9cr",
        src: "",
        duration: 269,
        lyrics: [
          { at: 0.1, text: "故事的小黄花 从出生那年就飘着" },
          { at: 0.14, text: "童年的荡秋千 随记忆一直晃到现在" },
          { at: 0.18, text: "吹着前奏望着天空" },
          { at: 0.22, text: "我想起花瓣试着掉落" },
        ],
      },
      {
        title: "夜曲",
        artist: "周杰伦",
        album: "十一月的萧邦",
        cover: "/spotify/yequ.jpg",
        url: "https://open.spotify.com/track/32nainF4TXsMpuFOGCkzzM",
        src: "",
        duration: 227,
        lyrics: [
          { at: 0.09, text: "一群嗜血的蚂蚁 被腐肉所吸引" },
          { at: 0.13, text: "我面无表情 看孤独的风景" },
          { at: 0.17, text: "失去你 爱恨开始分明" },
          { at: 0.21, text: "失去你 还有什么事好关心" },
        ],
      },
      {
        title: "稻香",
        artist: "周杰伦",
        album: "魔杰座",
        cover: "/spotify/daoxiang.jpg",
        url: "https://open.spotify.com/track/6Uq8BnOxvXJsQiJ2XqfO5P",
        src: "",
        duration: 223,
        lyrics: [
          { at: 0.1, text: "对这个世界如果你有太多的抱怨" },
          { at: 0.14, text: "跌倒了就不敢继续往前走" },
          { at: 0.18, text: "为什么人要这么的脆弱 堕落" },
          { at: 0.22, text: "请你打开电视看看" },
        ],
      },
      {
        title: "告白气球",
        artist: "周杰伦",
        album: "周杰伦的床边故事",
        cover: "/spotify/gaobaiqiqui.jpg",
        url: "https://open.spotify.com/track/2tqF9MPNdYdJU70U0ULO23",
        src: "",
        duration: 215,
        lyrics: [
          { at: 0.1, text: "塞纳河畔 左岸的咖啡" },
          { at: 0.14, text: "我手一杯 品尝你的美" },
          { at: 0.18, text: "留下唇印的嘴" },
          { at: 0.22, text: "花店玫瑰 名字写错谁" },
        ],
      },
    ],
  },
  likes: {
    enabled: true, // show/hide the shared like button in the footer
    // Fallback total painted before the counter API answers (and the seed if
    // the remote key ever has to be recreated). Nudge it up now and then so a
    // first visit starts close to the live number.
    base: 3751,
  },
} as const;
