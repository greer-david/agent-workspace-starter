#!/usr/bin/env -S python3 -I
# Claude Code / Codex Stop hook: names Herdr tabs "<n> · <session title>".
#
# Outside Herdr (no HC_TERMINAL_ID) it does nothing. Inside, it gives its own
# tab the session's title (Claude Code's ai-title, or Codex's thread_name from
# ~/.codex/session_index.jsonl), then re-prefixes every named tab in the same
# space with its cmd-<n> position so the numbers recover after a tab closes.
# Names set by hand (F2) keep their text; only the number in front changes.
# Unnamed tabs already show their number, so they're left alone.
#
# Wired up as a Stop hook in ~/.claude/settings.json and ~/.codex/hooks.json:
#   "Stop": [{ "hooks": [{ "type": "command", "command": "~/bin/herdr-tab-title" }] }]
import json, os, re, subprocess, sys

PREFIX = re.compile(r"^\d+ · (.*)$")
STATE = os.path.expanduser("~/.local/state/herdr-tab-title")
CODEX_INDEX = os.path.expanduser("~/.codex/session_index.jsonl")


def herdr(*args):
    out = subprocess.run(["herdr-app", *args], capture_output=True, text=True, timeout=5)
    return json.loads(out.stdout) if out.returncode == 0 else None


def codex_title(session):
    title = None
    try:
        with open(CODEX_INDEX) as f:
            for line in f:
                if session in line:
                    entry = json.loads(line)
                    if entry.get("id") == session:
                        title = entry.get("thread_name") or title
    except (OSError, ValueError):
        pass
    return title


def claude_title(transcript):
    title = None
    try:
        with open(transcript) as f:
            for line in f:
                if '"ai-title"' in line:
                    title = json.loads(line).get("aiTitle") or title
    except (OSError, ValueError):
        pass
    return title


def codex_terminal(cwd, title):
    # Codex hooks run from its app-server daemon with a scrubbed environment,
    # so nothing in our process tree knows the tab. Ask herdr-core instead:
    # the Codex terminal in this folder, or, if there are several, the one
    # whose screen shows this thread's name (Codex puts it in its status line).
    out = subprocess.run(["hc", "ls", "--json"], capture_output=True, text=True, timeout=5)
    if out.returncode != 0:
        return None
    codex = [t["address"] for t in json.loads(out.stdout).get("terminals", [])
             if t.get("agent") == "codex" and t.get("state") == "live"
             and (not cwd or t.get("cwd") == cwd)]
    if len(codex) == 1:
        return codex[0]
    if not title:
        return None
    for address in codex:
        screen = subprocess.run(["hc", "read", address], capture_output=True, text=True, timeout=5)
        if title in screen.stdout[-4000:]:
            return address
    return None


def main():
    try:
        hook = json.load(sys.stdin)
    except ValueError:
        hook = {}
    session = hook.get("session_id") or ""
    title = (codex_title(session) if session else None) or claude_title(hook.get("transcript_path") or "")
    terminal = os.environ.get("HC_TERMINAL_ID")
    if not terminal and "/.codex/" in (hook.get("transcript_path") or "").replace("\\", "/"):
        terminal = codex_terminal(hook.get("cwd"), title)
    if not terminal:
        return
    listing = herdr("ls")
    if not listing:
        return

    space = next((s for s in listing["spaces"]
                  for t in s["tabs"] for term in t["terminals"]
                  if term["terminal"] == terminal), None)
    if not space:
        return

    os.makedirs(STATE, exist_ok=True)
    for n, tab in enumerate(space["tabs"], 1):
        name = tab["name"]
        match = PREFIX.match(name)
        base = match.group(1) if match else (None if name.isdigit() else name)

        mine = any(term["terminal"] == terminal for term in tab["terminals"])
        if mine and title:
            # Only replace a base this hook wrote before, never one typed by hand.
            stamp = os.path.join(STATE, tab["id"])
            try:
                previous = open(stamp).read()
            except OSError:
                previous = None
            if base is None or base == previous:
                base = title
                with open(stamp, "w") as f:
                    f.write(title)

        if base is None:
            continue
        wanted = f"{n} · {base}"
        if wanted != name:
            herdr("do", "tab.rename", json.dumps({"id": tab["id"], "name": wanted}))


if __name__ == "__main__":
    try:
        main()
    except Exception:
        pass  # a naming hiccup must never block the agent
