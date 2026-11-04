// Quick capture into the vault's Inbox: "mod.open:capture" in keys.json
// (cmd-shift-n). First line is the note's title (its file name), the rest is
// the body. Writes only `created:` frontmatter; /enrich-inbox adds the rest.
// Never overwrites: a taken name gets " 2", " 3", ...
import { View, div } from "gpui-kit";
import { v_flex, h_flex, TextareaState, Textarea } from "gpui-base";
import { home, theme, props, closeOverlay, notify, writeTextFile, readTextFile, nextCommand } from "herdr";

const INBOX = () => `${home()}/Notes/Inbox`;

const pad = (n) => String(n).padStart(2, "0");
const today = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// Obsidian-safe file name: no path or link characters, at most 80 chars.
function fileName(title, d) {
  const clean = title.replace(/[\\/:*?"<>|#^[\]]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80).trim();
  return clean || `Quick note ${today(d)} ${pad(d.getHours())}${pad(d.getMinutes())}`;
}

export default class Capture extends View {
  init(_props, cx) {
    this.text = ""; this.error = null; this.saving = false;
    this.area = TextareaState.new({ placeholder: "Title on the first line\n\nThen whatever you want to remember…" });
    this.area.set_auto_grow(6, 16);
    this.area.on("change", (_e, cx) => { this.text = this.area.value(); cx.notify(); });
    this.area.focus();
    cx.timer.after(300, () => this.area.focus());
    cx.spawn(async (cx) => {
      for (;;) { if ((await nextCommand()) === "save") this.save(cx); }
    });
  }

  dismiss() {
    const overlay = props()?.overlay;
    if (overlay) closeOverlay(overlay);
  }

  save(cx) {
    const text = this.area.value();
    if (!text.trim() || this.saving) return;
    this.saving = true; cx.notify();
    cx.spawn(async (cx) => {
      const d = new Date(), [first, ...rest] = text.split("\n");
      const base = fileName(first.replace(/^#+\s*/, ""), d);
      const body = `---\ncreated: ${today(d)}\n---\n${rest.join("\n").trim()}\n`;
      try {
        let name = base;
        for (let n = 2; await readTextFile(`${INBOX()}/${name}.md`).catch(() => null) !== null; n++) name = `${base} ${n}`;
        await writeTextFile(`${INBOX()}/${name}.md`, body, null);
        notify({ title: "Saved to Inbox", body: name, level: "success", timeout: 4000 });
        this.dismiss();
      } catch (e) {
        this.error = String(e.message || e); this.saving = false; cx.notify();
      }
    });
  }

  render(cx) {
    const t = theme(), ready = this.text.trim() && !this.saving;
    return v_flex().w_full().p(16).gap(10).bg(t.popover).text_size(13)
      .child(h_flex().justify_between().items_center()
        .child(div().font_semibold().text_color(t.foreground).child("Capture to Inbox"))
        .child(div().text_size(11).text_color(t.dim).child("Notes/Inbox")))
      .child(Textarea.new(this.area).w_full().p(10).rounded(8).border(1).border_color(t.input)
        .bg(t.background).text_color(t.foreground))
      .when(this.error, (el) => el.child(div().text_size(12).text_color(t.blocked).child(this.error)))
      .child(h_flex().gap(8).items_center()
        .child(div().flex_1().text_size(11).text_color(t.dim).child("⌘↩ save · esc cancel"))
        .child(div().id("cancel").px(12).py(5).rounded(6).cursor_pointer().text_color(t.muted)
          .hover((s) => s.bg(t.hover)).on_click(() => this.dismiss()).child("Cancel"))
        .child(div().id("save").px(12).py(5).rounded(6).cursor_pointer()
          .bg(ready ? t.solid : t.raised).text_color(ready ? t.solid_foreground : t.dim)
          .on_click((_e, cx) => this.save(cx)).child(this.saving ? "Saving…" : "Save")));
  }
}
