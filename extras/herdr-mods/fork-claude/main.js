// Fork Claude: split the focused pane to the right with a fork of the Claude
// Code session running in it (`claude --resume <id> --fork-session`). The
// original conversation is untouched. Opened as an overlay by a key
// ("cmd-shift-f": "mod.open:fork-claude"); it does its work and closes itself.
// The session id comes from ~/.claude/sessions/<pid>.json, keyed by the pid of
// the focused terminal's foreground process (from `hc get --json`).

import { View, div } from "gpui-kit";
import { focused, hc, readTextFile, home, run, notify, props, closeOverlay } from "herdr";

function fail(body) {
  notify({ title: "Fork Claude", body, level: "warning" });
}

async function fork(target) {
  if (!target?.terminal || !target?.pane) return fail("No focused terminal.");
  const r = await hc(["get", "--json", target.terminal]);
  if (r.code !== 0) return fail(r.stderr.trim() || "hc get failed.");
  const fg = JSON.parse(r.stdout).foreground;
  const prog = (fg?.argv?.[0] ?? "").split(/[\\/]/).pop().replace(/\.(exe|cmd)$/i, "");
  if (!fg?.pid || prog !== "claude") return fail("The focused pane isn't running claude.");

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
