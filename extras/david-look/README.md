# David's look: reference for replicating it

A snapshot of David's own Herdr layout, Herdr settings, Claude HUD settings and Codex footer, taken from his Mac. **It's reference material, not a tested Windows setup.** The user's agent should replicate the look and feel on this machine, adapt whatever doesn't work, and change or add anything the user wants. The result belongs to the user; it doesn't have to match David's exactly.

Do Tier 1 (and Tier 2 tab titles) first. They're the base this builds on.

## What's here

| Path | What it is | Notes for Windows |
|---|---|---|
| `herdr/layouts/main-insights-graph.json` | David's main Herdr layout. It extends the shipped Herdr/main layout with a usage strip, an insights pane, a git graph and custom tab/window chrome. | Copy to `~/.config/herdr-app/layouts/` under a personal name. Don't edit shipped layouts; updates overwrite them. |
| `herdr/mods/usage-strip/` | An always-visible bar with Claude and Codex usage: session tokens, 5-hour and weekly limits, as progress bars. Reads Codex session files and a file the Claude HUD writes. | Needs `claude/claude-hud-config.json`'s `externalUsageWritePath` set to this machine's `~/.config/herdr-app/data/usage-strip/claude.json`. |
| `herdr/mods/tabs-graph/` | A tab bar with window controls, used by the layout. | |
| `herdr/mods/workspace-chrome/`, `workspace-chrome-spacing/` | Sidebar and workspace chrome (spaces, agents, panels) used by the layout. | Check icons render with the installed font. |
| `herdr/mods/workspace-status/` | A workspace status bar. | Optional. |
| `herdr/mods/worktree/` | Git worktree helper. | Already handles Windows home paths. |
| `herdr/settings.json` | Zoom 0.8, JetBrainsMono NL Nerd Font Mono, sounds on, no ligatures. | Install the font or choose another installed Nerd Font. |
| `herdr/keys.json` | David's macOS shortcuts (`cmd-…`). | **Don't copy as-is.** Any edit to `keys.json` freezes Herdr's defaults. Only add the custom actions the user wants, using Windows keys that don't collide with Herdr's defaults or terminal keys (Ctrl+C, Ctrl+V, Ctrl+Alt = AltGr). |
| `claude/claude-hud-config.json` | David's claude-hud display settings: git status, tools, agents, todos, skills, session name; cost and duration off. | Merge into `~/.claude/plugins/claude-hud/config.json`. Replace `<HOME>`, or turn `externalUsageWritePath` off if the usage strip isn't installed. |
| `claude/statusline-command.reference.txt` | The status line command `/claude-hud:setup` generated on David's Mac (it uses Homebrew `bun`). | Reference only. Run `/claude-hud:setup` on this machine instead. |
| `codex/tui.toml` | David's current Codex footer and terminal title. | Merge into the `[tui]` table of `~/.codex/config.toml`. Validate items against the installed Codex. |

Two mods in the layout are third-party. Install them from their own repositories instead of copying David's copies:

- `insights`: https://github.com/GaganSD/coding-agent-toolkit/tree/main/herdr-insights
- `git-graph`: https://github.com/rabeeh-ta/herdr-git-graph

David's other personal mods are in `../herdr-mods/` (Work, Capture, Fork-Claude, panel shortcuts). Offer them separately; each needs adapting (see the main README, Tier 3).

## How to approach it

1. Read Herdr's installed guide (`~/.config/herdr-app/AGENTS.md`, `herdr-app --skill`) and installed type files first. Mods follow the installed Herdr version's API, and David's may be on a different version.
2. Install the mods and the layout under personal names, then switch to the layout. Keep Herdr/main reachable as a fallback.
3. Run `herdr-app check` on each mod, and read any `.error` file Herdr writes. Fix Windows problems in the user's copy.
4. Merge the HUD and Codex footer settings, then restart the agents and look at them.
5. Show the user the result, including a screenshot if the user agrees. Ask what they want changed, removed or added, and make those changes. Keep track of what differs from David's version.

Back up every file before changing it, keep existing user customizations, and never copy David's credentials or account data (there are none here).
