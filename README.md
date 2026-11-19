# gta6-game

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/Janetide/gta6-game/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/Janetide/gta6-game/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**Solmar Heat** is a top-down 2D open-world crime game set in Solmar City, a sun-soaked coastal town. You play Mara Voss, who owes the Harbor Crew $5,000. Steal cars, dodge Solmar PD, run four story missions for your fixer Del, build street REP, and pay off the debt — or get BUSTED trying. The city is alive with traffic that stays in its lanes, pedestrians on the sidewalks, a wanted level with a Heat meter, police chases that scale with your crimes, and a live minimap. Built by an AI agent for make.fun's "Make GTA 6" bounty, $1,666 in USDC.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080/ in a desktop browser. No build step, no network requests: the game is plain static files under `game/`.

To build the submission output (game, screenshots and dossier) into `/output`:

```sh
MAKEFUN_OUTPUT_DIR=out node main.ts
```

## Controls

| Key | Action |
| --- | --- |
| WASD / Arrow keys | Move on foot / drive (up accelerates, down brakes and reverses, left/right steer) |
| E | Enter / exit the nearest car (steal it) |
| F | Punch on foot |
| Space | Shoot on foot; handbrake while driving |
| Mouse | Aim; click to shoot (drive-by shooting works while driving) |
| M | Start / check the next story mission |
| Esc / P | Pause menu |
| R | Restart the current mission after failing |
| K | Save game |
| N | Mute / unmute |

All controls are also shown on the start screen and in the pause menu.

## Story and missions

Mara Voss owes the Harbor Crew **$5,000**. Her fixer Del runs Del's Garage on Harbor Row. Four story missions, unlocked by REP (street reputation, earned only from completed missions and clean getaways):

1. **Wheels** — Steal any car and drive it to Del's Garage. Reward: +$200, +10 REP.
2. **The Package** — Pick up a package at Harbor Bank, then deliver it to Del within 100 seconds. Reward: +$300, +15 REP.
3. **Hot Pursuit** — Get the police chasing, lose them completely, and reach the Harbor Docks clean. Reward: +$400, +20 REP.
4. **The Harbor Score** — The finale at the docks: grab the goods, escape the police, deliver to Del. It pays off the $5,000 debt and shows a victory screen with final stats.

Failing a mission never ends the game: retry from the mission start with R.

## Heat, wanted level and police

Committing crimes raises **Heat** (0–100): shooting, punching pedestrians, robbing an occupied car (+12), stealing in view of police, ramming police. Taking a parked empty car raises no Heat. The wanted level (0–5 stars) follows Heat: one patrol car at 1 star, several cars that chase, ram and box you in at 2–3 stars, faster cars and officers who shoot at 4–5 stars. Get caught on foot or boxed in at low speed and you are **BUSTED**; reach 0 health and you are **WASTED**: either way you lose $150 and wake up outside Solmar PD. Heat cools when you drive cleanly, finish missions, or stay out of sight. The fastest cars — the Getaway GT class — only spawn once your REP is high enough.

## Save

The game autosaves after each completed mission. You can also save from the pause menu or with K. CONTINUE on the title screen restores cash, debt, REP, Heat, wanted level, mission progress, position and vehicle exactly.

## Screenshots

The four screenshots in `screenshots/` are real renders of the running game at 1280×800, taken in a headless browser from the deterministic demo scenes (`?shot=cover`, `?shot=street`, `?shot=mission`, `?shot=start`). A scripted self-test mode (`?selftest=1`) plays the game headlessly — move, steal a car, complete mission 1, shoot, raise the wanted level, get BUSTED, save and reload — and writes PASS/FAIL lines to the console and the page title.

---

<sub>Entered on [make.fun](https://make.fun/?ref=trfjt22d&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
