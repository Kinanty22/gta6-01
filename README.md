# SOLMARA — Streets of Gold

[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/c/gta6-01)
[![rank](https://make.fun/badge/gta6-01/Kinanty22/gta6-01/rank.svg)](https://make.fun/c/gta6-01)
[![reward](https://make.fun/badge/gta6-01/Kinanty22/gta6-01/reward.svg)](https://make.fun/c/gta6-01)

An open-world crime game in the spirit of GTA 6, built for the
[make.fun gta6-01 bounty](https://make.fun/c/gta6-01). A complete, original,
offline browser game: explore the sun-soaked city of Solmara on foot or by
car, steal cars, dodge the police, and run three story missions for the fixer
Mara Voss.

## Play

Serve `game/` with any static server and open it in desktop Chrome:

```sh
node serve.ts
# then open http://localhost:8080
```

No build step, no network requests — every file the game loads lives under
`game/`, and all sound is synthesized with WebAudio.

## Controls

| Keys | Action |
| --- | --- |
| WASD / arrows | Move on foot, drive in a car |
| SHIFT | Run |
| E | Enter / exit a car |
| SPACE | Punch on foot, handbrake in a car |
| ENTER | Start the next mission |
| P | Pause |
| M | Mute |

## The game

- **A city to explore** — five districts (Downtown, Old Town, Marina, Suburbs,
  Palm Beach), a park, a beach and a marina, with traffic and pedestrians.
- **Cars to steal and drive** — traffic cars, taxis and parked cars, with
  acceleration, steering, handbrake drifts, collisions and damage.
- **A wanted system** — 0–5 stars. Stealing cars, hitting pedestrians and
  punching cops raise the heat; cop cars chase and ram you, foot cops chase
  you down and bust you. Lay low and the heat fades.
- **Three story missions** — Hot Wheels (steal a car, reach the marina),
  The Package (a timed dock-to-downtown delivery), and Heat Wave (lose a
  3-star wanted level at the safehouse) — plus 10 hidden cash stashes.
- **HUD with minimap** — cash, health, wanted stars, mission banner and
  timer, speed and car health, and a live minimap with the mission marker,
  police blips and your position.
- **Save** — cash, missions and stashes save to localStorage automatically.

## Layout

- `game/index.html` — the page; `game/src/` is the game, one job per file:
  `config.js` (tuning), `random.js` (seeded RNG), `city.js` (map),
  `input.js` (keyboard), `audio.js` (synth sound), `world.js` (rules:
  player, cars, traffic, police, wanted level, missions), `render.js`
  (camera, city, HUD, minimap), `shots.js` (screenshot scenes),
  `main.js` (boot and game loop).
- `screenshots/` — four real renders of the game running in a browser.
- `main.ts` — the entry program: copies `game/` and `screenshots/` to
  `/output` and writes `dossier.json` with `vendor/makefun-game.ts`.

## License

MIT — see [LICENSE](LICENSE). Solmara, its characters, city and story are
entirely original.
