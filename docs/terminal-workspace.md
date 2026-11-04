# Terminal workspace (Tier 1 layout pass)

Goal: someone used to the VS Code Claude/Codex extensions gets the **real, full CLI** in the middle of the window, with project navigation and review panels around it. Use built-in Herdr pieces only; no custom mods.

1. **Layout:** keep the shipped **Herdr/main** layout. Spaces and agents are on the left, terminals in the center, Files and Changes on the right. Make one space per project folder, named after the project.
2. **Starting agents:** use Herdr's built-in new-tab / agent menu. Claude and Codex appear when installed (Herdr's `knownAgents`). If one is missing from the menu but runs in Git Bash, add a `programs.json` entry with a `run` command, per Herdr's guide. Don't use aliases for this; the launcher doesn't expand them.
3. **Open a shell:** a new tab with no program is a Git Bash shell in the space's folder, separate from any running agent.
4. **Theme and font:** pick a theme from `herdr/themes/` or a built-in one. Use a readable installed monospace font and leave font settings alone otherwise.
5. **Keys:** leave `keys.json` untouched (see README). Teach these: Ctrl+C goes to the program, Herdr's copy/paste bindings, and Ctrl+Shift+F for terminal search.

Before calling it done, check that:
- Claude and Codex both start in the selected project and take typing.
- Scrolling and resizing work.
- The Files and Changes panels open and close.
- The default layout is still in use.
- The window is usable at laptop width.

Leave the user a 5-line note covering:
- how to pick a project
- how to start Claude or Codex
- how to open a shell
- `pwd`, `ls`, `cd`, `git status`
- how to get back to the agent tab
