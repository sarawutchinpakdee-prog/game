# V2.6.3 Announcer Fix
- Prevents announcement speech from overlapping by cancelling the current utterance before starting the newest one.
- Adds a separate AI announcement profile (different pitch/rate and, when available, a different Thai voice).
- Falls back safely if the browser exposes only one Thai voice.
- Keeps normal player announcements separate from AI announcements.
