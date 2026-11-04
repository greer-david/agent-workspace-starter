# Copy-paste setup prompts

If onboarding to a work repository, add its URL to either prompt. The agent must inspect its current setup instructions and `check-setup` workflow alongside this starter.

## Fresh machine

```text
Set up my Windows machine using https://github.com/greer-david/agent-workspace-starter.

Fetch the latest version and read README.md, docs/project-setup.md and docs/terminal-workspace.md. Inspect first, then perform the setup. This is a fresh onboarding; reuse anything already installed correctly.

Use Git Bash as Herdr Desktop's default interactive shell and native Windows Claude Code and Codex. Configure and validate Bash startup files, repairing incorrect configuration after backing it up and preserving useful customizations. Keep PowerShell available for Windows tasks.

If I supplied a work repository, read its agent instructions, current setup docs, check-setup skill and checker script. Use the coworker's authenticated work account, verify access/SSO, and inspect or clone its default development branch. Run its setup checks from its root inside Git Bash. Let that repo govern required tools, plugin selection and pinned versions. Avoid duplicate global skills that the project already supplies. Preserve its hooks and guardrails. Use the public starter for personal workspace configuration.

Install missing supported tools and apply safe local configuration under this request. I will handle interactive login, SSO, admin prompts and identity choices when needed. Use my accounts; never copy someone else's credentials or identity.

Keep the full Claude/Codex terminal central, with project/agent navigation, visible Start Claude/Start Codex/Open Shell actions and collapsible Files/Changes panels. Open Shell must create a separate Git Bash session. Follow the repository's layout guide and preserve full terminal functionality.

Complete both the work repo's setup/manual checks and the starter's workspace checks. Clearly report fixed, deferred, blocked and unverified items, plus login/reload/restart steps. Keep personal setup records local; do not change project source or cloud resources for onboarding.
```

## Paused setup

Use the fresh-machine prompt above, replacing its opening instruction with:

```text
Continue a paused Windows setup using https://github.com/greer-david/agent-workspace-starter. Fetch its latest version. Before changing anything, inspect prior changes, backups, running installers and existing sessions. Preserve correct completed work and repair incomplete or incorrect setup after backing it up. Follow the README's paused-setup audit, then continue from the first unmet requirement rather than reinstalling everything.
```
