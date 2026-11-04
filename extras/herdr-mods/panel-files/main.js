// Key target for the right-hand panel: "mod.open:panel-files" in keys.json.
// Does what the tab bar's Files button does (show this panel, or hide it if
// it's already showing), then closes its own popup. A key can only pass one
// argument and layout.select needs two, hence a mod per panel.
import { View, div } from "gpui-kit";
import { run, layout, props, closeOverlay } from "herdr";

const ID = "files";

function find(node, id) {
  if (node?.id === id) return node;
  for (const child of node?.children ?? []) {
    const found = find(child, id);
    if (found) return found;
  }
  return null;
}

export default class TogglePanel extends View {
  init(_props, _cx) {
    const root = layout(), panel = find(root, "panel"), body = find(root, "panel-body");
    if (panel && body) {
      if (!panel.hidden && body.active === ID) run("layout.hide", { id: "panel" });
      else { run("layout.select", { stack: "panel-body", child: ID }); run("layout.show", { id: "panel" }); }
    }
    closeOverlay(props().overlay);
  }

  render() {
    return div();
  }
}
