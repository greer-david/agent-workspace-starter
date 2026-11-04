# Terminal-centered workspace

## Goal

Configure a familiar project workspace for someone accustomed to the VS Code Claude/Codex extensions who wants to learn the terminal. Keep the real, fully interactive Claude Code or Codex terminal as the main pane. Surround it with navigation and review controls. The user can always open a Git Bash shell, run arbitrary commands, and use the agents' complete CLI interfaces.

## Apply on the coworker's machine

Complete and verify basic Git Bash/agent setup first. Inspect the current Herdr version, `herdr-app --skill`, installed type files and layout before changing UI. Use the installed schemas and supported commands; examples in online documentation may be newer than the installed version.

1. Start with the shipped **Herdr/main** layout, which currently provides spaces/agents on the left, terminal panes in the center, and Files/Changes on the right. Reuse these controls when they meet the requirements. Avoid adding a custom mod for something already available.
2. Configure readable text, a restrained theme and a monospace font with the symbols actually needed. Use an installed font or install an appropriate font through supported mechanisms. Prefer a simple Git Bash prompt with current directory and Git branch. Preserve existing prompt customization and use Git for Windows' installed prompt helpers where available rather than adding a prompt framework by default.
3. Keep project/space and agent navigation visible on the left. Label projects clearly using the coworker's folders. Preserve the full agents list and its actual status, including waiting for input. Tab titles should communicate the task rather than just a process name.
4. Keep the real terminal in the center, occupying the majority of available width. Preserve input focus, text selection, scrolling, agent commands, slash commands and keyboard navigation. Keep Ctrl+C available to the foreground program; use Herdr's supported copy/paste bindings. Avoid global bindings that consume essential shell or agent shortcuts.
5. Keep Files and Changes accessible on the right and easy to collapse. Open Files initially if screen width allows; show Changes on demand. The Work panel is optional and should remain useful with GitHub alone if Jira tooling is unavailable. Keep the terminal usable at normal laptop widths; collapse supporting panels before crowding the main pane.
6. Expose visible actions named **Start Claude**, **Start Codex**, **Open Shell**, **Files**, and **Changes**. Reuse built-in actions or menus first. Start agents and shells in the selected project's working directory. Open Shell creates a separate Git Bash tab or split and leaves the running agent untouched. A launch button should create a deliberate new session, never send a command into a busy terminal. Disable or explain unavailable agent launchers and missing project directories.
7. If existing controls do not make the actions discoverable enough, clone the shipped layout under a personal name such as `terminal-workspace`; clone only the mod whose code must change. Use supported argv launch APIs with discovered executable paths and correctly handled Windows directories, including spaces. Shipped files are overwritten on updates; edit only personal copies. If a matching personal layout already exists, inspect and update it instead of making another clone.
8. Retain the command palette, normal shell access and the default layout as an escape route. Keep existing sessions and panes alive during layout changes. Do not replace the agent with custom chat bubbles, a prompt form, filtered output, or a restricted command wrapper.

Reference: https://github.com/herdrdev/herdr-app#make-it-yours

## Validate before calling it done

- Open Claude, Codex and a plain Git Bash shell through the visible controls. Confirm each starts in the selected project; test a path with spaces.
- Type directly into both actual agent terminals and confirm their normal interactive controls work. Test copy/paste, scrolling, resizing and focus changes. Check interrupt behavior in a disposable shell command, not by interrupting a running user task.
- In the shell, run `pwd`, `git status` in a repository, and a harmless arbitrary command. Confirm Open Shell did not replace the active agent.
- Open/collapse Files and Changes, navigate another project, and confirm controls follow the selected project. Verify genuine agent status changes where supported; UI labels alone do not establish status integration.
- If a custom mod was required, run the installed `herdr-app check` command for it, inspect `.error` files, and exercise asynchronous/interactive states in the actual app. Syntax checks alone are insufficient.
- Inspect the rendered window with the supported screenshot command or user-assisted visual review. Check normal laptop dimensions, readable labels, unclipped controls and a terminal that remains the main workspace.
- Test that the default layout is still reachable. Record the selected layout, shortcuts, changes made and anything requiring user verification. Do not publish screenshots or personal configuration back to the public starter.

## Small handoff

Leave a short local quick reference: choose a project, Start Claude/Codex, Open Shell, `pwd`, `ls`, `cd`, `git status`, Files/Changes, and how to return focus to the agent. Show the commands as commands the user can type; keep full terminal functionality available. Distinguish typing a shell command in Git Bash from sending a message to an agent.

Stop when these controls and checks are satisfied. Broader dashboards, replacement chat interfaces and unrelated window-management changes are outside this setup.
