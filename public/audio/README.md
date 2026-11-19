# Local music files

The footer music card is designed to play full tracks from local files, so that
every visitor gets the whole song instead of Spotify's 30-second preview.

Add your own legally obtained files here:

- `qinghuaci.mp3` — 青花瓷
- `lantingxu.mp3` — 兰亭序

The paths are configured in `src/config.ts` under `SITE.spotify.tracks[].src`.
If a file is missing, that track gracefully falls back to the Spotify embed
(30-second preview for anonymous visitors).

The files are deliberately not committed to this repository because the songs
are copyrighted.
