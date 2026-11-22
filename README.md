[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![Rank](https://make.fun/badge/gta6-01/Kinanty22/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01)
[![Reward](https://make.fun/badge/gta6-01/Kinanty22/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01)

# SOLMARA — Streets of Gold

A complete 2D top-down open-world crime game in the spirit of GTA 6, built
for the [make.fun](https://make.fun/bounty/gta6-01) bounty **gta6-01**. Plain
HTML and JavaScript, no libraries, no build step, no network request: it
runs offline in a desktop browser from the static files under `game/`.

## The city

Solmara is a 3600×2600 coastal city with five districts — Downtown, Old
Town, Marina, Suburbs and Palm Beach — a road grid, a park with a pond, a
beach and the sea, about 70 buildings, traffic (16 cars plus taxis) and 42
pedestrians going about their day.

## What you can do

- **On foot:** walk and run, punch, pick up hidden cash stashes ($150 each).
- **Driving:** steal any car with **E** (parked cars, traffic, even a police
  car), drive with acceleration, steering and handbrake drifts. Cars take
  damage, smoke and wreck.
- **Wanted system, 0–5 stars:** stealing, hitting pedestrians, punching
  cops and ramming police cars raise your heat. Cop cars chase you on the
  road grid and ram; foot cops chase and bust you. Lay low and the heat
  fades. Busted or wasted means a $100 fine and a respawn — the game goes on.
- **Missions for fixer Mara Voss:** Hot Wheels (steal a car, reach the
  Marina, $300), The Package (a timed dock-to-downtown delivery, $600) and
  Heat Wave (earn 3 stars, then lose the cops at the safehouse, $900).
  Finish all three and Solmara is yours.
- **HUD:** cash, health, wanted stars, mission banner with a timer, message
  feed, speed and car health, and a live minimap (roads, mission marker,
  police blips, player arrow). Progress saves to localStorage.
- **Sound:** WebAudio synth only — engine hum, sirens, punches, crashes and
  mission jingles. No audio files.

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Move / drive |
| SHIFT | Run |
| E | Steal / exit car |
| SPACE | Punch (on foot) / handbrake (driving) |
| ENTER | Start mission / start game |
| P | Pause |
| M | Mute |

## Run it

```sh
node serve.ts
# open http://localhost:8080
```

Screenshots are real renders of the game in a browser
(`?shot=chase|street|delivery|beach&seed=7`).

## License

MIT — see [LICENSE](LICENSE).
