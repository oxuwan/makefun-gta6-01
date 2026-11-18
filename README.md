[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/oxuwan/makefun-gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/oxuwan/makefun-gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# Porto Verde — an open-world crime game

Rico Alvarez drove getaway cars for the Marisol crew — until a job went
wrong and the crew left him holding the bag. Now he drives for anyone who
pays, one job at a time, across the sun-soaked city of Porto Verde, while
Detective Maren Voss and the Porto Verde police close in.

Explore a procedural city on foot and by car: steal cars (walk up, press
E), outrun traffic, build a wanted level from 1 to 5 stars as the police
send chase cars after you, and work through five linked story missions —
a fare across town, a stolen Comet, a getaway under sirens, a warehouse
standoff, and one last run to the harbour boat. Punch and shoot, pick up
cash, lose the heat, and save your progress automatically.

Everything is original and procedural: the city, the characters, the cars,
the story, the art and the synthesized sound — no libraries, no network
requests, no external assets. Just vanilla canvas JavaScript and WebAudio.

## Controls

| Key | Action |
| --- | ------ |
| WASD / arrows | Move on foot, drive the car |
| Shift | Run |
| Space | Handbrake |
| E | Steal / exit a car |
| F | Punch |
| Click or G | Shoot toward the mouse |
| Q | Take the next job |
| H | Car horn |
| Tab | Zoom the minimap |
| P | Pause (R restarts the current job) |
| M | Mute |

## Missions — five jobs for Rico Alvarez

| # | Job | Client | Pay | What happens |
| - | --- | ------ | --- | ------------ |
| 1 | The Fare | Lena Ortiz | $400 | Pick Lena up at the blue marker, drive her to the marina |
| 2 | Hot Wheels | Tomas Rook | $650 | Steal the red Comet in the north lot, deliver it to the garage |
| 3 | Smoke and Sirens | Lena Ortiz | $900 | Shake a 2-star police chase, then meet Lena at the boatyard |
| 4 | The Standoff | Tomas Rook | $1,200 | Clear the warehouse crew in a shootout, escape with the ledger |
| 5 | The Last Run | Lena Ortiz | $2,000 | Grab the money at the plaza, break the cordon, reach the harbour boat |

Jobs are taken with Q, tracked on the HUD with a pulsing marker and an
off-screen arrow, and paid in cash on completion. Failing a job is not
the end: pause with P and press R to restart it from the beginning.

## Features

- **A living procedural city** — a 3840×3840 road lattice of blocks,
  buildings, parks, plazas and a harbour, seeded so `?seed=N` reproduces
  the same Porto Verde every time.
- **On foot and behind the wheel** — walk, run, punch, shoot, steal any
  car (E) and drive it with arcade physics: handbrake turns, collisions,
  crash damage and a horn (H).
- **Traffic and pedestrians** — 30 civilian cars cruising the lanes and
  48 residents strolling the sidewalks, crossing roads and fleeing
  gunfire, carjackings and police chases.
- **Wanted level and police** — 1 to 5 stars; police cars spawn, chase,
  ram and set the pace, and the heat decays once you break line of sight
  and stay clear for 12 seconds.
- **HUD and minimap** — wanted stars, health, cash, clock, mission
  objective with a running timer, speedometer, FPS display and a live
  minimap (Tab zooms it) showing roads, cars, police and the mission
  marker.
- **Sound, all synthesized** — WebAudio engine hum, two-tone sirens,
  gunshots, crashes, pickups, mission stingers and a bass-line music
  loop. No audio files, no network requests. M mutes.
- **Screens and saves** — title screen over the living city, pause,
  BUSTED / WASTED game over, autosave every few seconds and a best-cash
  record.
- **Deterministic scenes** — `?shot=start|drive|chase|mission&seed=1`
  stages fixed screenshot scenes through the real rules, and
  `?selftest=1` simulates 600 frames and reports `SELFTEST OK`.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in a desktop browser.

Deterministic scenes for screenshots: `?shot=start|drive|chase|mission&seed=1`.
Headless self-test: `?selftest=1` writes `SELFTEST OK` (or the failure) into
the page title after simulating 600 frames.

<sub>Entered on [make.fun](https://make.fun/?ref=xk6tgtt0&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
