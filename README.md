# Solmara — Streets of Gold

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/Kinanty22/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/Kinanty22/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An open-world crime game in the spirit of GTA 6, built for
[make.fun](https://make.fun)'s "Make GTA 6" bounty. Everything is original: the
city of Solmara, its people, its cars, its story. Nothing from Rockstar Games.

## The game

Solmara is a sun-soaked coastal city, 3600×2600 of streets, districts and
beach: Downtown, Old Town, the Marina, the Suburbs and Palm Beach, with a park,
a pond and the sea along the south edge. Walk it on foot or steal a car and
drive it — traffic, taxis and pedestrians fill the roads.

The law is watching. Steal a car, hit a pedestrian or deck a cop and your
wanted level climbs, 0 to 5 stars: cop cars chase you down the road grid and
ram you, foot patrols chase you down and bust you. Lay low and the heat fades;
lose it at the safehouse and you are clean again. Get busted or wasted and you
wake up at Police HQ or the hospital, lighter by a fine.

Mara Voss, the fixer, has three jobs for you: **Hot Wheels** (steal a car,
bring it to the Marina, $300), **The Package** (a timed delivery from the docks
to the Solmara Tower, $600) and **Heat Wave** (lose a 3-star wanted level at the
safehouse, $900). Ten hidden cash stashes ($150 each) are scattered around the
city. Finish all three jobs and Solmara is yours.

## How to play

Open `game/index.html` in a desktop browser, or serve the game folder:

```sh
node serve.ts
# then open http://localhost:8080
```

No build step, no network: every file the game loads sits under `game/`.

| Key | Action |
| --- | --- |
| WASD / arrows | Move / drive |
| E | Enter or leave a car |
| F | Punch |
| Shift | Run |
| Space | Handbrake |
| Enter | Start / accept a mission |
| P | Pause |
| M | Mute |

Progress (cash, missions, stashes) saves to your browser's local storage.

## Sound

All sound is synthesised with WebAudio: engine hum, sirens, punches, crashes
and mission jingles. No audio files.

## Built with

Plain HTML, CSS and JavaScript — no libraries, no build step. The entry program
`main.ts` (Node 22, standard library only) copies `game/` and `screenshots/`
and writes the dossier the judge reads.

Referral code: `mjp730py`
