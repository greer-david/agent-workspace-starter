# Agent workspace starter

A sanitized snapshot of David Greer's Herdr, Claude Code and Codex setup, intended for an agent to adapt on a coworker's Windows machine. This is a fresh repository with no original dotfiles history, credentials, personal project paths, work identity, or saved hook approvals.

**Windows execution has not been tested.** These are reference assets, not a one-click installer. The setup agent must complete the platform adaptations and verify them locally. No existing user configuration should be overwritten wholesale.

## Included

- `codex/config.toml`: actual reusable model, effort, automatic approval reviewer, footer, terminal title and plugin settings. Power BI plugins reference v26.40.2 to match the source setup.
- `claude/settings.reference.json`: shared plugins, model/effort, UI and workflow preferences. Private plugins, HEY, clerk, Rex and machine-specific status commands are excluded.
- `shell/`: merge-only Bash startup templates for Git Bash.
- `docs/terminal-workspace.md`: required layout workflow that keeps full agent terminals central with familiar navigation and review panels.
- `herdr/`: themes, shortcut reference, Files/Changes/Work panels, quick capture, fork-Claude.
- `scripts/herdr-tab-title.py`: numbered tab-title helper for Claude and Codex; runs only against a detected Herdr terminal.

## Instructions for the setup agent

The user authorizes installation and configuration of this workspace. Inspect first, back up before edits, merge existing customizations, and perform the setup. Ask only for information or manual authentication that is actually needed. Follow organization policy and existing sandbox restrictions.

### 0. Resume a paused setup

This may be a continuation of a setup paused midway. Before any installation, edit, service restart or rollback:

1. Read the current chat, any local setup record, recent installer results and existing backups. Summarize completed work, incomplete work, and the next pending action. Treat the local machine as the source of truth.
2. Inspect running installers, package managers and agent sessions. A paused agent may have left a child process running. Let a safe installation finish or report a blocked state; obtain confirmation before terminating a process or interrupting an active installer.
3. Snapshot current relevant configs and record their paths before editing. Compare existing state with this guide. Resume idempotently from the first unmet requirement rather than repeating the initial bootstrap.
4. The updated target is **Git Bash as Herdr's default interactive shell, with native Windows Claude Code and Codex**. Keep PowerShell installed for Windows tasks. An already-installed PowerShell 7 is useful and need not be removed. Preserve working native agent installs and completed plugin/auth setup.
5. If prior work selected PowerShell as the default, change only the necessary shell/config portions. If it introduced WSL, inspect where tools, repositories and credentials actually live; explain any migration and obtain confirmation before moving projects, removing installations or discarding config. Preserve existing files and sessions.
6. The latest user direction supersedes an earlier recommendation to use PowerShell as the default. Audit pending actions against this target before continuing; report any action whose intent cannot be established.

### 1. Inspect and install

Inspect Windows architecture, installed versions, PowerShell, Git Bash, WSL, PATH and config-directory overrides. Install Git for Windows if missing. Use its Git Bash as the default interactive shell in Herdr, while keeping agents and Windows tools native. Do not introduce WSL without explaining an actual dependency. Never configure a Linux installation while launching its Windows counterpart, or vice versa.

Read current official installation instructions and install missing Herdr, Claude Code, Codex, Git, Python and plugin runtimes as needed. Check available package managers; do not assume winget is installed. Install Node or Bun only as required by selected plugins.

Official references:
- Herdr: https://herdr.dev/download/
- Claude Code: https://code.claude.com/docs/en/setup
- Codex: https://developers.openai.com/codex/
- Codex config: https://learn.chatgpt.com/docs/config-file/config-reference
- Claude HUD: https://github.com/jarrodwatts/claude-hud

Herdr's official page currently supplies a Windows PowerShell installer and a Start menu application. Recheck the page rather than running a stale command from memory. After installation read Herdr's installed agent guide (`~/.config/herdr-app/AGENTS.md` per its docs) and establish its actual Windows config path.

### 1a. Configure Git Bash and startup files

Read this section before editing Herdr shell settings or Bash startup files. The user prefers Bash/Zsh command conventions; Git Bash is the chosen Windows shell. PowerShell remains available for Windows-specific operations.

1. Locate Git for Windows' actual `bash.exe`; distinguish it from a WSL launcher. Check HOME and the Windows user profile resolve to the intended files. Read existing `.bashrc`, `.bash_profile`, `.bash_login`, and `.profile`, including their source chains.
2. Read the installed Herdr desktop/core guide and current core config. Current [herdr-core documentation](https://github.com/herdrdev/herdr-core#default-shell) specifies `%APPDATA%\herdr-core\config.toml`, or `$XDG_CONFIG_HOME/herdr-core/config.toml` when set, with a top-level executable/argument array:

   ```toml
   shell = ['C:\Program Files\Git\bin\bash.exe', '--login', '-i']
   ```

   Substitute the discovered executable path. Merge into the proper TOML scope, preserving other settings. Verify against the installed version. Inspect desktop, workspace and launch-template overrides if a new pane still opens PowerShell. Test in a NEW pane; keep existing sessions running. A quoted executable string inside the array must not contain extra shell quote characters.
3. Back up startup files and merge `shell/bashrc.reference` into `.bashrc`. Use one identifiable managed block; update it on rerun rather than appending duplicates. Preserve the user's aliases, prompt and other setup. Only add verified tool directories; translate discovered Windows paths with `cygpath` where needed. Keep Git Bash's standard inherited PATH. Ensure `claude`, `codex`, `git`, `hc`, `herdr-app` and the chosen Python/runtime resolve correctly.
4. Merge `shell/bash-profile.reference` into the active login startup file only if it does not already source `.bashrc`. Bash reads the first available `.bash_profile`, `.bash_login`, or `.profile`; preserve that chain. Do not create a new `.bash_profile` that shadows an existing `.profile` without preserving the latter's behavior. Avoid duplicate or recursive sourcing.
5. Keep tokens, auto-login commands, agent auto-launch, global MSYS path-conversion switches, and package-install commands out of startup files. Optional prompt tools can be retained if already installed; they are not prerequisites. Hooks may run noninteractively and cannot rely on `.bashrc` or its aliases: give them explicit executable paths and required environment separately. Do not assume selecting Git Bash in Herdr selects Codex's internal command shell.
6. Validate startup syntax with the discovered Git Bash `bash.exe -n` for each changed file. In a fresh Herdr pane, confirm `$BASH_VERSION`, `$0`, `shopt -q login_shell`, working directory, executable lookup and actual agent launches. Source the managed block twice in a controlled interactive shell and confirm PATH entries do not accumulate. Keep output free of tokens and unrelated environment values.

### 2. Configure Codex

Merge `codex/config.toml` into the active user configuration. Respect CODEX_HOME if set. Validate all fields and footer items against the installed version. Preserve the requested model if available; report incompatibilities instead of silently replacing it. Install marketplaces/plugins through supported commands or UI; config entries alone may not install them.

Explain `approvals_reviewer = "auto_review"` using the installed version's documentation before applying it. Preserve sandbox restrictions and managed policy. Do not trust the user's entire home directory or fabricate hook trust hashes. Let the user approve specific projects and hooks through normal mechanisms.

### 3. Configure Claude Code

Merge the reference settings. Register marketplaces and install enabled plugins through supported commands. Check version compatibility before applying preferences such as disabling auto-compaction, automatic memory, bundled skills or tools. Explain the effects of the permission deny list; these are source preferences, not prerequisites for Herdr. Preserve a coworker's existing policy settings.

Install claude-hud as a plugin and run its supported setup workflow (currently `/claude-hud:setup`; verify). Generate the Windows statusLine command for the selected shell/runtime. Do not use macOS Homebrew paths. Configure runtime dependencies and verify the HUD actually renders.

### 4. Configure Herdr

Merge themes and desired mods into the active config directory. Preserve unrelated mods and app-generated state. Use the installed Herdr guide to validate API compatibility.

`herdr/keys.json` is the original macOS shortcut reference, NOT a Windows file to copy unchanged. Use Windows defaults for standard application actions, then map custom actions to supported, non-conflicting Windows shortcuts. Check both global and terminal bindings; naive Cmd-to-Ctrl replacement collides with existing space shortcuts and terminal control keys. Update shortcut hints in mods to match.

Windows adaptations still required:
- Work mod: resolve browser opening through a Windows-compatible mechanism. For `env` and `test`, either use verified Git for Windows executables with explicit paths or implement supported native equivalents; Herdr mod subprocesses do not inherit Bash aliases and cannot assume its startup files ran. Discover GitHub CLI's actual Windows config directory, including GH_CONFIG_DIR; do not assume `~/.config/gh`. Pass tokens through a supported environment mechanism, never print them or store them in files. Work data must be fetched from the coworker's own authenticated accounts.
- Work Jira integration requires the `twg` CLI and its authentication. If unavailable, make the GitHub portion work and disable/explain Jira; do not assume access to David's internal tooling or accounts.
- Capture defaults to `~/Notes/Inbox`. Ask for the desired destination, create it if authorized, and change the path and displayed label together. Preserve duplicate-name behavior and prevent overwrites.
- Fork-Claude checks foreground process and session files. The bundled filename check accepts Windows separators and exe/cmd suffixes, but verify actual Windows process/session discovery. If Claude runs through a wrapper, adapt detection using installed tool documentation. Forking shares the working tree; it does not create a worktree.
- Read the installed guide for agent status integration. Configure it for both agents; do not equate tab naming with working/waiting/completed status.

### 4a. Make the workspace approachable while retaining full terminal access

After Git Bash and both agents work, read and carry out [the terminal workspace guide](docs/terminal-workspace.md). This is part of the requested setup. Keep real Claude/Codex terminals central; use visible project/agent navigation, launch actions, Files/Changes and a separate Open Shell action. Reuse built-in controls first. Verify the resulting layout on the coworker's machine; the guide is an implementation brief, not an already installed layout.

### 5. Wire tab titles

Install `scripts/herdr-tab-title.py` in a stable user tools directory. Wire the supported Stop hook in BOTH Claude and Codex to an explicit Python executable and the script's quoted absolute Windows path. Preserve existing hooks. Read current hook schemas before editing; do not assume both agents use identical casing or event fields.

Do not rely on the script's Unix shebang. Resolve `herdr-app` and `hc` from the actual hook environment, including executable extensions if required. The helper normalizes transcript separators for Codex detection, but further Windows adaptations may be needed. Read the script: its errors intentionally do not block agents, so absence of hook errors does NOT prove tab titles work. Verify visible title changes. Exercise multiple sessions in the same directory to avoid renaming the wrong tab. Preserve manually named tabs.

### 6. Verify and finish

Complete the acceptance checks in `docs/terminal-workspace.md`, including visible launch controls, a separate Git Bash shell, retained interactive terminal behavior and laptop-sized layout review.

Verify a NEW Herdr pane opens login-interactive Git Bash, startup files load once, and tools resolve without depending on the old PowerShell session. Verify actual launches of both agents inside Herdr; footer/HUD rendering; agent activity status; tab-title updates after turns; Files, Changes and Work panels; quick capture into the chosen destination; fork-Claude; keyboard shortcuts; plugin loading and runtime dependencies. Authenticate using the coworker's own accounts; never request credentials in chat.

Record checks actually performed separately from checks needing user interaction. Save a local setup record of versions, changed files, backup locations, shortcuts, any unsupported features, and login/restart steps. Do not claim Windows compatibility based only on static inspection.

## Scope

No Git identity, SSH configuration, Windows VM bridge, window-manager setup, browser bookmarks, private session history, private plugin, account token, or saved trust decision is included. Do not publish any of the coworker's generated configuration or personal setup record back to this repository.
