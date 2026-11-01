# Voice clips

Drop MP3 files here, named exactly as below. Each one replaces the phone's robot voice for that line.
Lines without a file are still spoken by the phone's built-in text-to-speech, so you can record them one at a time.

## How to record

- Record on your phone in a quiet room, about a hand's length from your mouth.
- One line per file. Leave half a second of silence at the start and end, no more.
- Export as MP3, mono, 64–96 kbps. Each clip should be under 50 KB so it loads fast on mobile data.
- Say it with energy. These are shouted from the roadside.

## Files

| File | Line | When it plays |
|---|---|---|
| `hype_1.mp3` | This luxury don land! Who get am?! | A featured luxury car passes |
| `hype_2.mp3` | Ehn ehn! See money! | " |
| `hype_3.mp3` | Clear road! Big man dey pass! | " |
| `hype_4.mp3` | This one na correct whip o! | " |
| `hype_5.mp3` | Who get this ride? E too clean! | " |
| `hype_6.mp3` | Oga, bless us small! | " |
| `police_slow.mp3` | Oya, slow down! Wait, wait! | Approaching a police or FRSC checkpoint |
| `police_explain.mp3` | Okay, I be policeman. Slow down. Wait till they pass. You understand? | Still too fast near the checkpoint |
| `police_stop.mp3` | How far? Where your people pass? | You stop at the checkpoint |
| `police_go.mp3` | Oya, move! | Waved through |
| `military_stop.mp3` | Everybody come down! Open your boot! | Military stop and search |
| `clear_road.mp3` | Hey! Come off the road now! | Spare line for road scenes |
| `first_scene.mp3` | You need to be the first at the scene. Everyone get back! | Passing a roadside breakdown with a mechanic |
| `rear_end.mp3` | Haba! Who jam me from back?! | Another car knocks you from behind |

Keep hype lines brand-free: hype the car and the money, never the badge.
To add a new line, add it to `VOICE_LINES` in `src/game/voice.ts` and drop in a matching MP3.
