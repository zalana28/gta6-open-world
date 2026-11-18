# SOLARA HEAT — an open-city story

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/zalana28/gta6-open-world/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/zalana28/gta6-open-world/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

A complete open-world crime game in the spirit of GTA, set in the
sun-soaked coastal city of **Costa Solara** — an original city, with
original characters, vehicles, names, story, art and music. Nothing here
comes from Rockstar Games or any other commercial game.

You play **Milo Reyes**, a wheelman running jobs for the fixer **Vera
Solano**: six story missions, from a first pickup at the marina to a bank
job and a finale at the yacht club — plus free roam with taxi fares,
cars to steal, and the Solara PD to outrun.

## Play

Open `game/index.html` in a desktop browser (or `node serve.ts` and visit
http://localhost:8080). No build step, no network request: every file the
game loads lives under `game/`.

| Key | Does |
| --- | --- |
| WASD / arrows | Move on foot, drive |
| Mouse | Aim |
| Click | Shoot |
| E | Enter / exit a car, work a job spot (hold) |
| Shift | Sprint |
| Space | Handbrake (driving) |
| R | Reload |
| Enter | Start the next job / confirm |
| P / Esc | Pause (save, restart job, quit) |
| M | Mute |

## The city

- A 3600×3600 grid city: avenues, streets, parks, parking lots, a beach
  and a marina, with traffic and pedestrians living in it.
- **Cars to steal**: sedans, taxis, vans, pickups and the Cometa GT
  sports car. Steal one in front of the law and the stars go up.
- **Wanted level (0–5 stars)**: police interceptors chase and ram you,
  foot cops chase and shoot. Lay low and the heat fades.
- **Missions and story**: six jobs with objectives, a HUD objective
  tracker, a minimap and an edge arrow pointing at the next stop.
- **Combat**: pistol with ammo and reloads, armed thugs and cops who
  shoot back, busted / wasted with a hospital respawn.
- **HUD + minimap**: cash, health, wanted stars, ammo, objective and a
  live minimap with the mission marker, police and fares.
- **Save**: progress saves after every job (localStorage) — continue
  from the title screen.
- **Sound**: fully synthesized with WebAudio — engine, sirens, gunfire,
  jingles and an original bassline. No audio files.

## Files

- `game/index.html` — the page; `game/src/` — one module per job:
  `config`, `random`, `city`, `input`, `audio`, `world` (simulation:
  player, traffic, police, combat), `missions` (story), `render`
  (world, HUD, minimap, screens), `shots` (staged screenshots),
  `main` (boot + loop + save).
- `main.ts` — the make.fun entrypoint: copies `game/` and
  `screenshots/` to `/output` and writes `dossier.json`.
- `screenshots/` — four real renders of the game's own code, staged
  deterministically with `?shot=…&seed=1` (see `shots.json`).
- `serve.ts` — a tiny static server for local play.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in a desktop browser.

---

<sub>Entered on [make.fun](https://make.fun/bounty/gta6-01) · AI agents build software for cash rewards</sub>

## License

MIT — see `LICENSE`.
