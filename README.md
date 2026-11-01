# ✻ ccradar

[![ci](https://github.com/amirhosseinghanipour/ccradar/actions/workflows/ci.yml/badge.svg)](https://github.com/amirhosseinghanipour/ccradar/actions/workflows/ci.yml)
[![license: MIT](https://img.shields.io/badge/license-MIT-cba6f7)](LICENSE)

**A live, colorful radar for Claude Code.** See what every agent is doing right now, what it changed in git, and how busy your session is, in a card that floats over your session, painted in your favorite Neovim color theme.

```
╭─ ✻ ccradar ────────────────────────── ⎇ main ↑2 ─╮
│ ◆ AGENTS                               90s ⟶ now │
│ ● main      ──●━━●────●━━━━●━━   ◐ Bash npm test │
│ ├ Explore        ●━━━━━━●        ✓ Grep 12s      │
│ ╰ fix-auth           ●━━━●━━━●   ◐ Edit auth.ts  │
│                                                  │
│ ◆ ACTIVITY  42 calls · 90s                       │
│     ▂▅    ▃▇█▆▃           ▂▄▇                    │
│ ▁▂▃▅██▆▃▂▄█████▆▄▂▁▁▁▂▃▅▇███▆▄▂▁                 │
│                                                  │
│ ◆ CHANGES  5 files  +128 −34                     │
│ M auth.ts             ████████████▊───── +42 −8  │
│ + notes.md            ███─────────────── new     │
│                                                  │
│ ◆ COMMITS                                        │
│ ◉ a1b2c3d fix: session refresh               5m  │
│ ○ 9f8e7d6 feat: login flow                   1h  │
╰──────────────────────────────────────────────────╯
 ✻ ⎇ main ↑2  │  ◐ main, fix-auth  │  5 files +128 −34  │  ▁▂▅█▃▂▁▃▅▇
```

## Features

- **Agent lanes**: one colored lane per agent (the main session and every subagent) over the last 90 seconds. `●` marks a new action, `━` work in progress, `✕` a failure. The right side shows what each agent is doing now, with a spinner.
- **Activity sparkline**: a two-row, 16-level graph of tool calls, colored from cool to hot.
- **Git changes**: branch, commits ahead/behind, and each changed file with a gradient bar of added and removed lines, refreshed right after every edit or shell command.
- **Recent commits**: the last three, HEAD highlighted.
- **Overlay**: the card floats over the bottom-right of your session and takes no columns. A one-line strip above the prompt keeps the essentials visible.
- **8 themes**: `catppuccin` (default), `tokyonight`, `gruvbox`, `rosepine`, `kanagawa`, `nord`, `dracula`, `claude`. Cells keep your terminal's own background, so there's no gray box.

## Install

At the prompt of a Claude Code terminal session:

```
/plugin install ccradar --marketplace amirhosseinghanipour/ccradar
```

Answer `y` to add the marketplace, then pick a scope (the user scope makes it load in every session).

From a shell:

```sh
claude plugin install ccradar --marketplace amirhosseinghanipour/ccradar
```

In the Claude desktop app: click **+** next to the prompt box → **Plugins** → **Add marketplace** with `amirhosseinghanipour/ccradar` → **Add plugin**.

## Usage

| Command | What it does |
| --- | --- |
| `/ccradar` | Cycle the view: overlay → strip only → off |
| `/ccradar overlay` · `strip` · `off` | Pick a view directly |
| `/ccradar theme <name>` | Switch theme, e.g. `/ccradar theme tokyonight` |
| `/ccradar theme` | Cycle to the next theme |

Your view and theme are remembered across sessions.

Start Claude Code inside a git repository to see branch, changes and commits; agent activity shows anywhere.

## Requirements

- Claude Code with function-hook mods (2.1.316 or newer)
- A terminal with true color (Windows Terminal, iTerm2, kitty, Ghostty, WezTerm, Alacritty and most modern terminals)
- `git` on your `PATH`
- 40+ columns for the card; narrower terminals get the strip only

## How it works

ccradar is a single hooks module. It watches tool calls (`tool.call`) to build the agent lanes, runs read-only `git status`, `git diff --numstat` and `git log` for the git sections, and paints the card as one `Raster` of colored cells in the band above the prompt. It never blocks or changes a tool call, and it never writes to your repository.

## Development

```sh
git clone https://github.com/amirhosseinghanipour/ccradar
claude --plugin-dir ./ccradar     # run it from the folder, with hot reload
claude plugin validate ./ccradar  # check the manifest and hooks
claude plugin test ./ccradar      # run the render tests
```

Themes live in [`hooks/themes.ts`](hooks/themes.ts). Adding one is a single palette object; PRs welcome.

### Releasing

1. Add your notes under `## Unreleased` in [`CHANGELOG.md`](CHANGELOG.md) and commit them.
2. Run `./scripts/release.sh X.Y.Z`. It validates, tests, bumps the version, tags, pushes and creates the GitHub release.
3. Users get it with `claude plugin update ccradar`.

CI runs validate and the tests on Linux, macOS and Windows, against the oldest supported Claude Code and the latest.

## License

[MIT](LICENSE) © Amirhossein Ghanipour
