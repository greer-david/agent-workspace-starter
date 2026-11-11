// Fork session: split the focused pane with a Claude Code or Codex fork.
// Codex uses an exact thread-name match, otherwise its interactive fork picker.
// Claude: split the focused pane to the right with a fork of the Claude
// Code session running in it (`claude --resume <id> --fork-session`). The
// original conversation is untouched. Opened as an overlay by a key
// ("cmd-shift-f": "mod.open:fork-claude"); it does its work and closes itself.
// The session id comes from ~/.claude/sessions/<pid>.json, keyed by the pid of
// the focused terminal's foreground process (from `hc get --json`).

import { View, div } from "gpui-kit";
import { focused, hc, readTextFile, home, run, notify, props, closeOverlay, spaces } from "herdr";

function fail(body) {
  notify({ title: "Fork session", body, level: "warning" });
}

async function fork(target) {
  if (!target?.terminal || !target?.pane) return fail("No focused terminal.");
  const r = await hc(["get", "--json", target.terminal]);
  if (r.code !== 0) return fail(r.stderr.trim() || "hc get failed.");
  const fg = JSON.parse(r.stdout).foreground;
  const prog = (fg?.argv?.[0] ?? "").split("/").pop();
  if (prog === "codex") {
    // Native OSC title is supplied by tui.terminal_title's "thread" item.
    const nativeTitle = (JSON.parse(r.stdout).title ?? "").replace(/^[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]\s*/, "");
    const titles = nativeTitle.split(" | ").map(s => s.trim());
    const byId = new Map();
    try {
      const index = await readTextFile(`${home()}/.codex/session_index.jsonl`);
      for (const line of index.split("\n")) {
        try {
          const entry = JSON.parse(line);
          if (entry.id && entry.thread_name) byId.set(entry.id, entry.thread_name);
        } catch { /* Ignore incomplete index lines. */ }
      }
    } catch { /* The fork picker also works without the local index. */ }
    let matches = [...byId].filter(([, title]) => titles.includes(title));
    if (matches.length === 0) {
      // A running TUI may still use its pre-change OSC title. Trust only a
      // name this hook wrote, rather than treating a manual tab name as an ID.
      const tab = spaces().flatMap(s => s.tabs).find(t => t.id === target.tab);
      const base = tab?.name?.replace(/^\d+ · /, "");
      if (base) {
        try {
          const stamp = await readTextFile(`${home()}/.local/state/herdr-tab-title/${tab.id}`);
          if (stamp === base) matches = [...byId].filter(([, title]) => title === base);
        } catch { /* Use the picker if the tab wasn't named by the hook. */ }
      }
    }
    const argv = ["codex", "--no-daemon", "fork"];
    if (matches.length === 1) argv.push(matches[0][0]);
    run("pane.split", { direction: "right", pane: target.pane, argv });
    return;
  }
  if (!fg?.pid || prog !== "claude") return fail("Focus a Claude Code or Codex terminal first.");

  let session;
  try {
    session = JSON.parse(await readTextFile(`${home()}/.claude/sessions/${fg.pid}.json`));
  } catch {
    return fail(`No Claude session file for pid ${fg.pid}.`);
  }
  if (!session?.sessionId) return fail("Claude session file has no sessionId.");

  run("pane.split", {
    direction: "right",
    pane: target.pane,
    argv: ["claude", "--resume", session.sessionId, "--fork-session"],
  });
}

export default class ForkClaude extends View {
  init(_props, cx) {
    const target = focused();
    cx.spawn(async () => {
      try {
        await fork(target);
      } catch (e) {
        fail(String(e?.message ?? e));
      } finally {
        const overlay = props()?.overlay;
        if (overlay) closeOverlay(overlay);
      }
    });
  }
  render() {
    return div();
  }
}
