#!/usr/bin/env bash
# Check a Windows machine's agent workspace setup. Read-only: it reports, it
# never installs, edits or logs in. Run from Git Bash (a NEW Herdr pane is best):
#
#   bash verify.sh                      # workspace checks
#   bash verify.sh --repo <work-clone>  # also run that repo's scripts/check-setup.sh
#
# Each line is ok, WARN or FAIL with a -> hint. Exit 1 if any FAIL.
# Runs on macOS/Linux too, but the Windows-only checks are skipped there.

set -u

repo=""
while [ $# -gt 0 ]; do
  case $1 in
    --repo) repo=${2:-}; shift 2 ;;
    -h|--help) sed -n '2,10p' "$0"; exit 0 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done

fails=0
warns=0
ok()   { printf '  ok    %s\n' "$1"; }
fail() { printf '  FAIL  %s\n        -> %s\n' "$1" "$2"; fails=$((fails + 1)); }
warn() { printf '  WARN  %s\n        -> %s\n' "$1" "$2"; warns=$((warns + 1)); }
has()  { command -v "$1" >/dev/null 2>&1; }

case "$(uname -s)" in
  MINGW*|MSYS*|CYGWIN*) win=1 ;;
  *) win=0 ;;
esac

# Native jq.exe turns LF into CRLF in Git Bash; -b stops it. Fall back to
# stripping \r so this script itself never compares "value\r".
jqr() {
  if [ "$win" = 1 ]; then
    jq -b "$@" | tr -d '\r'
    return "${PIPESTATUS[0]}"
  fi
  jq "$@"
}

# Windows-side lookup (what native apps and hooks see), not Git Bash's PATH.
winwhere() { cmd.exe //d //c "where $1" 2>/dev/null | tr -d '\r'; }

claude_dir=${CLAUDE_CONFIG_DIR:-$HOME/.claude}
codex_dir=${CODEX_HOME:-$HOME/.codex}

# ── Shell ────────────────────────────────────────────────────────────────────
echo "Shell"
if [ "$win" = 1 ]; then
  ok "Git Bash ($(uname -s))"
  if [ -n "${BASH_VERSION:-}" ]; then ok "bash $BASH_VERSION"; fi
  if shopt -q login_shell; then ok "login shell"
  else warn "not a login shell" "Herdr's shell should be ['...\\Git\\bin\\bash.exe', '--login', '-i'] (windows/herdr-core.config.toml)."; fi

  if [ -n "${USERPROFILE:-}" ] && has cygpath; then
    up=$(cygpath -u "$USERPROFILE")
    if [ "$HOME" = "$up" ]; then ok "HOME matches USERPROFILE"
    else fail "HOME ($HOME) differs from USERPROFILE ($up)" "Native Claude/Codex/gh use USERPROFILE; Bash '~' uses HOME. Resolve before writing any ~/ file."; fi
  fi

  if winwhere sh >/dev/null; then ok "sh on the Windows PATH (herdr-core needs it)"
  else fail "sh not on the Windows PATH" "herdr-core needs sh for templates/quoted commands. Add Git's usr\\bin to the user PATH, or reinstall Git with 'Git and optional Unix tools'."; fi

  first_bash=$(winwhere bash | head -1)
  case "$first_bash" in
    "") warn "bash not on the Windows PATH" "Hooks run by native Codex that call bare 'bash' (e.g. the work repo's git-guard) won't start. Test the guard in Codex." ;;
    *[Ss]ystem32*) fail "Windows 'bash' is WSL ($first_bash)" "Native Codex hooks calling 'bash' would run in WSL. Put Git's bin before System32 in the user PATH, or use an absolute Git Bash path in hooks." ;;
    *) ok "Windows 'bash' is $first_bash" ;;
  esac
else
  warn "not Git Bash ($(uname -s))" "Windows checks skipped; run this on the Windows machine."
fi

# ── Startup files ────────────────────────────────────────────────────────────
echo "Startup files"
login=""
for f in .bash_profile .bash_login .profile; do
  if [ -f "$HOME/$f" ]; then login=$f; break; fi
done
if [ -z "$login" ]; then
  warn "no ~/.bash_profile, ~/.bash_login or ~/.profile" "Git for Windows creates ~/.bash_profile on first login; open a new Git Bash once."
else
  if grep -Eq '(\.|source)[[:space:]]+("?(~|\$HOME|\$\{HOME\})/)?\.bashrc' "$HOME/$login" \
     || { [ "$login" = .bash_profile ] && [ -f "$HOME/.profile" ] && grep -q '\.profile' "$HOME/.bash_profile" \
          && grep -Eq '(\.|source)[[:space:]]+.*\.bashrc' "$HOME/.profile"; }; then
    ok "~/$login loads ~/.bashrc"
  else
    fail "~/$login doesn't load ~/.bashrc" "Append the line in windows/bash_profile.snippet to ~/$login."
  fi
fi
for f in .bashrc "$login"; do
  [ -n "$f" ] && [ -f "$HOME/$f" ] || continue
  if bash -n "$HOME/$f" 2>/dev/null; then ok "~/$f syntax"
  else fail "~/$f has a syntax error" "bash -n ~/$f, fix it (back it up first)."; fi
  if grep -q $'\r' "$HOME/$f"; then fail "~/$f has CRLF line endings" "Convert to LF (dos2unix ~/$f) after backing up."; fi
done
if [ -f "$HOME/.bashrc" ]; then
  n=$(grep -c '^# >>> agent-workspace >>>' "$HOME/.bashrc")
  case $n in
    1) ok "managed block present once" ;;
    0) fail "managed block missing from ~/.bashrc" "Merge windows/bashrc.block." ;;
    *) fail "managed block appears $n times" "Keep one copy between the markers." ;;
  esac
else
  fail "no ~/.bashrc" "Create it with windows/bashrc.block."
fi
# A fresh login-interactive shell: loads once, prints nothing, no PATH repeats.
out=$(bash -lic 'echo "__PATH__=$PATH"' 2>/dev/null </dev/null)
noise=$(printf '%s\n' "$out" | grep -v '^__PATH__=' | grep -v '^[[:space:]]*$' | head -3)
if [ -n "$noise" ]; then warn "startup prints output" "Agents and hooks see it too; move echo/banners behind a check. First lines: $noise"
else ok "startup is quiet"; fi
p=$(printf '%s\n' "$out" | sed -n 's/^__PATH__=//p')
dups=$(printf '%s' "$p" | tr ':' '\n' | grep -v '^$' | sort | uniq -d | head -3 | tr '\n' ' ')
if [ -n "$dups" ]; then warn "PATH has repeated entries: $dups" "Something is sourced twice (e.g. .profile and .bash_profile both load .bashrc)."
else ok "PATH has no repeats"; fi

# ── Tools ────────────────────────────────────────────────────────────────────
echo "Tools"
tool() { # name, hint, level
  if has "$1"; then ok "$1 ($(command -v "$1"))"
  elif [ "${3:-fail}" = warn ]; then warn "$1 not on PATH" "$2"
  else fail "$1 not on PATH" "$2"; fi
}
tool git    "winget install --id Git.Git -e"
tool gh     "winget install --id GitHub.cli -e"
tool jq     "winget install --id jqlang.jq -e"
tool uv     "winget install --id astral-sh.uv -e"
tool claude "Native installer: https://code.claude.com/docs/en/setup"
tool codex  "https://developers.openai.com/codex/"
tool herdr-app "https://herdr.dev/download/"
tool hc     "Comes with Herdr (herdr-core); reopen Git Bash after installing Herdr."
tool node   "Only for plugins that need it (custom-visuals' pbiviz MCP): winget install --id OpenJS.NodeJS.LTS -e" warn

if has jq; then
  if [ "$win" = 1 ] && [ "$(jq -n -r '"x"' | od -c | grep -c '\\r')" -gt 0 ]; then
    if [ "$(jq -b -n -r '"x"' 2>/dev/null | od -c | grep -c '\\r')" -eq 0 ]; then
      warn "jq writes CRLF unless -b" "Scripts that read jq output need jq -b (managed block aliases it for interactive use only)."
    else
      fail "jq writes CRLF and has no -b" "Install jq 1.7+."
    fi
  else
    ok "jq output is plain LF"
  fi
fi

# Python: a real interpreter, not the Microsoft Store alias.
py=""
for c in python3 python py; do
  if has "$c"; then
    path=$(command -v "$c")
    case "$path" in
      *WindowsApps*) warn "$c is the Microsoft Store alias ($path)" "Settings > Apps > Advanced app settings > App execution aliases: turn off python/python3, then install: winget install --id Python.Python.3.12 -e" ;;
      *) if [ -z "$py" ] && "$c" -c 'import sys; sys.exit(0 if sys.version_info >= (3, 9) else 1)' >/dev/null 2>&1; then py=$c; fi ;;
    esac
  fi
done
if [ -n "$py" ]; then ok "python: $py ($(command -v "$py"), $("$py" -c 'import platform; print(platform.python_version())'))"
else fail "no working Python 3.9+" "winget install --id Python.Python.3.12 -e"; fi

# ── Herdr ────────────────────────────────────────────────────────────────────
echo "Herdr"
if [ "$win" = 1 ] && [ -n "${APPDATA:-}" ]; then
  core_cfg="${XDG_CONFIG_HOME:+$XDG_CONFIG_HOME/herdr-core/config.toml}"
  [ -n "$core_cfg" ] || core_cfg="$(cygpath -u "$APPDATA")/herdr-core/config.toml"
  if [ -f "$core_cfg" ] && grep -Eq "^[[:space:]]*shell[[:space:]]*=" "$core_cfg"; then
    exe=$(sed -n "s/^[[:space:]]*shell[[:space:]]*=[[:space:]]*\[[[:space:]]*['\"]\([^'\"]*\)['\"].*/\1/p" "$core_cfg" | head -1)
    case "$exe" in
      *[Gg]it*bash.exe)
        if [ -f "$(cygpath -u "$exe")" ]; then ok "herdr-core shell: $exe"
        else fail "herdr-core shell points to a missing file: $exe" "Use the real Git for Windows bin\\bash.exe path."; fi ;;
      *) fail "herdr-core shell is not Git Bash: ${exe:-unparsed}" "Use windows/herdr-core.config.toml." ;;
    esac
    if grep -Eq '^[[:space:]]*shell[[:space:]]*=.*--login' "$core_cfg"; then :; else
      warn "herdr-core shell has no --login" "Without it ~/.bash_profile and Git Bash's /etc/profile don't run."; fi
  else
    fail "no shell setting in $core_cfg" "Merge windows/herdr-core.config.toml (top level)."
  fi
fi
if has hc; then
  if hc ls --json >/dev/null 2>&1; then ok "herdr-core answers (hc ls)"
  else warn "hc ls failed" "Is Herdr running? Start it, then re-run."; fi
fi
if [ -n "${HC_TERMINAL_ID:-}" ]; then ok "running inside a Herdr terminal"
else warn "not inside a Herdr terminal" "Re-run from a NEW Herdr pane to test what Herdr actually starts."; fi

# ── Claude Code ──────────────────────────────────────────────────────────────
echo "Claude Code"
cs="$claude_dir/settings.json"
if [ -f "$cs" ] && has jq; then
  if jq empty "$cs" 2>/dev/null; then ok "settings.json parses"
  else fail "$cs is not valid JSON" "Restore the backup or fix it."; fi
  id=claude-hud@claude-hud
  {
    if [ "$(jqr -r --arg id "$id" '.enabledPlugins[$id] // false' "$cs" 2>/dev/null)" = true ]; then ok "$id enabled"
    else fail "$id not enabled" "claude plugin marketplace add jarrodwatts/claude-hud; claude plugin install claude-hud@claude-hud; then /claude-hud:setup"; fi
  }
  sl=$(jqr -r '.statusLine.command // empty' "$cs" 2>/dev/null)
  case "$sl" in
    "") fail "no statusLine (HUD won't render)" "Run /claude-hud:setup in Claude Code." ;;
    */opt/homebrew*|*/usr/local/Cellar*) fail "statusLine uses a macOS path" "Re-run /claude-hud:setup on this machine." ;;
    *) ok "statusLine set" ;;
  esac
  if jqr -r '[.hooks.Stop[]?.hooks[]?.command] | join("\n")' "$cs" 2>/dev/null | grep -q 'herdr-tab-title'; then ok "tab-title Stop hook (Claude)"
  else warn "no tab-title Stop hook (Claude)" "Tier 2: see README 'Tab titles'."; fi
  if has claude; then
    if claude plugin list --json 2>/dev/null | jqr -e '.[] | select(.id == "claude-hud@claude-hud")' >/dev/null 2>&1; then ok "claude-hud installed"
    else warn "claude-hud not in 'claude plugin list'" "claude plugin install claude-hud@claude-hud"; fi
  fi
elif [ ! -f "$cs" ]; then
  fail "no $cs" "Start claude once and sign in, then merge claude/settings.recommended.json."
fi

# ── Codex ────────────────────────────────────────────────────────────────────
echo "Codex"
if [ -f "$codex_dir/config.toml" ]; then
  ok "config.toml exists ($codex_dir)"
  for key in '^model[[:space:]]*=' '^\[tui\]' 'status_line[[:space:]]*='; do
    grep -Eq "$key" "$codex_dir/config.toml" || warn "config.toml lacks $key" "Merge codex/config.toml."
  done
  if grep -Eq '^\[marketplaces\.power-bi-agentic-development\]' "$codex_dir/config.toml"; then
    warn "Power BI marketplace is pinned in config.toml" "Install it from the work repo's pin with 'codex plugin marketplace add' instead, so the two can't disagree."
  fi
else
  fail "no $codex_dir/config.toml" "Start codex once and sign in, then merge codex/config.toml."
fi
if [ -f "$codex_dir/hooks.json" ] && grep -q 'herdr-tab-title' "$codex_dir/hooks.json"; then ok "tab-title Stop hook (Codex)"
else warn "no tab-title Stop hook (Codex)" "Tier 2: see README 'Tab titles'."; fi

# ── GitHub ───────────────────────────────────────────────────────────────────
echo "GitHub"
if has gh; then
  if gh auth status >/dev/null 2>&1; then ok "gh signed in ($(gh api user --jq .login 2>/dev/null | tr -d '\r'))"
  else fail "gh not signed in" "The user runs: gh auth login"; fi
fi
if [ -n "$(git config --global user.name)" ] && [ -n "$(git config --global user.email)" ]; then ok "git identity set"
else fail "git user.name / user.email not set" "The user chooses: git config --global user.name ... / user.email ..."; fi
if [ "$win" = 1 ]; then
  ac=$(git config --global core.autocrlf)
  ok "core.autocrlf=${ac:-unset} (repos with .gitattributes eol rules are unaffected)"
fi

# ── Work repo ────────────────────────────────────────────────────────────────
if [ -n "$repo" ]; then
  echo "Work repo ($repo)"
  if [ -f "$repo/scripts/check-setup.sh" ]; then
    # Its own report follows; its FAILs are listed separately from ours.
    ( cd "$repo" && bash scripts/check-setup.sh ) | sed 's/^/  | /'
    rc=${PIPESTATUS[0]}
    if [ "$rc" -eq 0 ]; then ok "work repo checker passed"
    else fail "work repo checker reported FAIL" "Work through its list (the check-setup skill). If EVERY plugin fails, suspect jq CRLF before reinstalling."; fi
  else
    fail "no scripts/check-setup.sh in $repo" "Pass the work repo clone's root."
  fi
fi

cat <<'EOF'
Check by hand (a script can't see these)
  - In a NEW Herdr pane: start claude and codex; both open, take typing, and the
    Claude HUD renders at the bottom.
  - Make an agent wait for input: the sidebar shows it as blocked/needs you.
  - Open Shell (new tab) gives Git Bash in the project folder; a path with spaces works.
  - Files and Changes open and close on the right.
  - Work repo only: a guarded command (e.g. git push --force --dry-run on a scratch
    branch) is denied in BOTH Claude and Codex.
  - Tier 2 only: after a turn, the tab title changes to "<n> · <task>".
EOF

echo
echo "Result: $fails fail, $warns warn"
[ "$fails" -eq 0 ]
