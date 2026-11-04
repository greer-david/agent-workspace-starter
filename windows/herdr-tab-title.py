#!/usr/bin/env -S python3 -I
# Windows: run as  <python.exe> -X utf8 -I "<absolute path to this file>"
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
# Errors are swallowed on purpose; check visible titles, not hook output.
import json, os, re, subprocess, sys

PREFIX = re.compile(r"^\d+ · (.*)$")
STATE = os.path.expanduser("~/.local/state/herdr-tab-title")
CODEX_HOME = os.environ.get("CODEX_HOME") or os.path.expanduser("~/.codex")
CODEX_INDEX = os.path.join(CODEX_HOME, "session_index.jsonl")
UTF8 = dict(encoding="utf-8", errors="replace")


def same_path(a, b):
    # Windows paths arrive as C:\x, c:/x or with a trailing slash.
    norm = lambda p: os.path.normcase(os.path.normpath(p.replace("\\", "/"))) if p else ""
    return norm(a) == norm(b)


def is_codex(transcript):
    t = os.path.normcase((transcript or "").replace("\\", "/"))
    return "/.codex/" in t or (bool(t) and t.startswith(os.path.normcase(CODEX_HOME.replace("\\", "/"))))


def herdr(*args):
    out = subprocess.run(["herdr-app", *args], capture_output=True, text=True, timeout=10, **UTF8)
    return json.loads(out.stdout) if out.returncode == 0 else None


def codex_title(session):
    title = None
    try:
        with open(CODEX_INDEX, **UTF8) as f:
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
        with open(transcript, **UTF8) as f:
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
    out = subprocess.run(["hc", "ls", "--json"], capture_output=True, text=True, timeout=10, **UTF8)
    if out.returncode != 0:
        return None
    codex = [t["address"] for t in json.loads(out.stdout).get("terminals", [])
             if t.get("agent") == "codex" and t.get("state") == "live"
             and (not cwd or same_path(t.get("cwd"), cwd))]
    if len(codex) == 1:
        return codex[0]
    if not title:
        return None
    for address in codex:
        screen = subprocess.run(["hc", "read", address], capture_output=True, text=True, timeout=10, **UTF8)
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
    if not terminal and is_codex(hook.get("transcript_path")):
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
                previous = open(stamp, **UTF8).read()
            except OSError:
                previous = None
            if base is None or base == previous:
                base = title
                with open(stamp, "w", encoding="utf-8") as f:
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
