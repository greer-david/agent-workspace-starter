# Copy-paste setup prompts

Paste one into Claude Code or Codex on the Windows machine. Replace `<WORK_REPO_URL>` with the work repository, or delete that paragraph.

## New machine

```text
Set up my Windows machine using https://github.com/greer-david/agent-workspace-starter.

Clone or update it, read README.md, and do the Tier 1 setup: install missing tools, use Git Bash as Herdr's shell with native Claude Code and Codex, set up my Bash startup files (back up first; keep my working customizations), and apply the recommended Claude/Codex settings. Keep PowerShell available.

Work repo: <WORK_REPO_URL>. Use my work GitHub account, clone or inspect its default branch without changing my local work, and follow docs/project-setup.md: its check-setup script and plugin pin decide the Power BI plugins and project tools.

Run `bash verify.sh --repo <clone>` from a new Herdr pane and fix what it reports. I'll do logins, SSO and admin prompts when you ask; never ask me for tokens or passwords.

When Tier 1 passes, tell me what's left in "Check by hand", then offer Tier 2 (tab titles). Report what's fixed, what's waiting on me, and any warnings you left, and keep the setup record on this machine.
```

## Paused or partial setup

```text
Continue my paused Windows setup using https://github.com/greer-david/agent-workspace-starter.

Update the clone and read README.md. Before changing anything, check for running installers or agent sessions and ask me before stopping any. Then run `bash verify.sh` (add `--repo <clone>` for <WORK_REPO_URL> if it's cloned) and fix what it reports in order, backing up each file first. Keep working installs, plugins, logins and correct customizations. The target is Git Bash as Herdr's shell with native Claude Code and Codex; if an earlier step chose PowerShell as the default, change only that setting.

Re-run verify.sh until it passes, then walk me through "Check by hand" and report fixed, waiting-on-me and remaining warnings.
```

## Getting help remotely

If David is helping from another machine, have the agent post `verify.sh` output and blockers as comments on a GitHub issue he names. Remote Control may be disabled for the work account.
