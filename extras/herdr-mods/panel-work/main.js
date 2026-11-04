// Key target for the Work pane: "mod.open:panel-work" in keys.json.
// Closes the Work pane if this tab has one, else splits one in on the
// right, then closes its own popup.
import { View, div } from "gpui-kit";
import { run, panes, focused, props, closeOverlay } from "herdr";

export default class ToggleWork extends View {
  init(_props, _cx) {
    const open = panes().find((p) => p.tab === focused()?.tab && p.mod === "Work");
    if (open) run("pane.close", { pane: open.pane });
    else run("pane.split", { direction: "right", mod: "Work" });
    const overlay = props()?.overlay;
    if (overlay) closeOverlay(overlay);
  }

  render() {
    return div();
  }
}
