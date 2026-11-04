// Work items pane: my open Jira work, my PRs, PRs waiting on my review, and
// GitHub issues involving me (every gh account). Opened beside the shell by
// panel-work (cmd-shift-j). Click a row to expand it (description, latest
// comment, linked GitHub items); ↗ opens it in the browser; ▶ Claude starts
// Claude in a new tab with the item as its first message. GitHub tabs filter
// by repo. Jira rows show GitHub items whose titles match theirs. Polls every
// 5 minutes and posts a toast when a new review request shows up.
import { View, div } from "gpui-kit";
import { v_flex, h_flex, TextView } from "gpui-base";
import { exec, run, notify, theme, spaces, panes, home, shared, setShared, readTextFile, props } from "herdr";

const POLL = 5 * 60 * 1000;
const JQL = "assignee = currentUser() AND statusCategory != Done ORDER BY updated DESC";
const GH_FIELDS = "number,title,repository,url,updatedAt";
const MONO = "JetBrainsMonoNL Nerd Font Mono";
const DETAIL_CHARS = 1500;

const TABS = [
  { id: "jira", label: "Jira" },
  { id: "prs", label: "My PRs" },
  { id: "reviews", label: "Reviews" },
  { id: "issues", label: "Issues" },
];

function ago(iso) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (!isFinite(s)) return "";
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))}m`;
  if (s < 86400) return `${Math.round(s / 3600)}h`;
  return `${Math.round(s / 86400)}d`;
}

// The tab name ▶ Claude gives an item; the tab-title hook may prefix "3 · ".
const tabName = (item) => item.key.startsWith("#") ? `${item.where}${item.key}` : item.key;

const clip = (text) => text.length > DETAIL_CHARS ? text.slice(0, DETAIL_CHARS) + "…" : text;

async function json(cmd, args) {
  const r = await exec(cmd, args);
  if (r.code !== 0) throw new Error((r.stderr || r.stdout).trim().split("\n").pop());
  return JSON.parse(r.stdout);
}

// --- Matching Jira items to GitHub items by title words ---------------------

const STOP = new Set(("the and for with from into that this are was not but all any via its our new add use " +
  "make fix update review report model models data").split(" "));

function words(title) {
  return new Set(title.toLowerCase().replace(/[^a-z0-9/]+/g, " ").split(/[\s/]+/)
    .filter((w) => w.length > 2 && !STOP.has(w)));
}

// Related when they share 3+ meaningful words covering half the shorter title.
function related(a, b) {
  let shared = 0;
  for (const w of a) if (b.has(w)) shared++;
  return shared >= 3 && shared / Math.min(a.size, b.size) >= 0.5;
}

// --- Jira -------------------------------------------------------------------

async function jira() {
  const out = await json("twg", ["-o", "json", "--output-summary", "none", "jira", "workitem", "query", "--jql", JQL, "--limit", "50"]);
  return (out.data?.issues ?? []).map((i) => ({
    id: i.key, key: i.key, title: i.summary, url: i.url, updated: i.updated,
    where: i.project?.key, status: i.status?.name, cat: i.status?.statusCategory?.key,
    type: i.issueType?.name, priority: i.priority?.name,
  }));
}

// Atlassian Document Format to plain text: block nodes on their own lines.
function adf(node) {
  if (!node) return "";
  if (node.type === "text") return node.text ?? "";
  if (node.type === "hardBreak") return "\n";
  const inner = (node.content ?? []).map(adf).join("");
  if (node.type === "listItem") return `- ${inner.trim()}\n`;
  return ["paragraph", "heading", "codeBlock", "blockquote"].includes(node.type) ? `${inner}\n\n` : inner;
}

async function jiraDetail(item) {
  const out = await json("twg", ["-o", "json", "--output-summary", "none", "jira", "workitem", "get", item.key]);
  const x = Array.isArray(out.data) ? out.data[0] : out.data;
  const last = x?.comment?.comments?.at(-1);
  const body = adf(x?.description).trim();
  return {
    body,
    comment: last && { author: last.author?.displayName ?? "", when: last.created, text: adf(last.body).trim() },
    refs: [...new Set([...body.matchAll(/#(\d+)\b/g)].map((m) => m[1]))],
  };
}

// --- GitHub -----------------------------------------------------------------

// Every account `gh auth` knows (work + personal), each searched with its own
// token so "@me" means that account. Accounts come from gh's hosts.yml
// (`gh auth status` would validate each token online, ~0.6 s); tokens are
// looked up once per refresh and shared by every search.
async function ghTokens() {
  const hosts = await readTextFile(`${home()}/.config/gh/hosts.yml`).catch(() => "");
  const block = /^github\.com:\n([\s\S]*?)(?=^\S|$(?![\s\S]))/m.exec(hosts)?.[1] ?? "";
  const users = [...block.matchAll(/^ {8}([\w-]+):\s*$/gm)].map((m) => m[1]);
  const tokens = await Promise.all(users.map((u) => exec("gh", ["auth", "token", "--hostname", "github.com", "--user", u])));
  return tokens.filter((t) => t.code === 0).map((t) => t.stdout.trim());
}

async function gh(tokens, kind, filter) {
  const seen = new Map();
  const results = await Promise.all(tokens.map((token) =>
    json("env", [`GH_TOKEN=${token}`, "gh", "search", kind, ...filter, "--state", "open", "--json", GH_FIELDS, "--limit", "100"])));
  for (const out of results) {
    for (const i of out) seen.set(i.url, {
      id: i.url, key: `#${i.number}`, number: i.number, title: i.title, url: i.url, updated: i.updatedAt,
      repo: i.repository?.nameWithOwner, where: i.repository?.nameWithOwner?.split("/").pop(), status: null,
    });
  }
  return [...seen.values()].sort((a, b) => b.updated.localeCompare(a.updated));
}

// Whichever account can see the repo answers; issues and PRs share this API.
async function ghDetail(item, tokens) {
  let lastError;
  for (const token of tokens) {
    try {
      const api = (path) => json("env", [`GH_TOKEN=${token}`, "gh", "api", path]);
      const [issue, comments] = await Promise.all([
        api(`repos/${item.repo}/issues/${item.number}`),
        api(`repos/${item.repo}/issues/${item.number}/comments?per_page=100`),
      ]);
      const last = comments.at(-1);
      return {
        body: (issue.body ?? "").trim(),
        comment: last && { author: last.user?.login ?? "", when: last.created_at, text: (last.body ?? "").trim() },
        refs: [],
      };
    } catch (e) { lastError = e; }
  }
  throw lastError ?? new Error("No GitHub account can see this repo");
}

const SOURCES = {
  jira: () => jira(),
  prs: (tokens) => gh(tokens, "prs", ["--author", "@me"]),
  reviews: (tokens) => gh(tokens, "prs", ["--review-requested", "@me"]),
  issues: (tokens) => gh(tokens, "issues", ["--involves", "@me"]),
};

// Last results, shared so a newly opened pane (a new copy) draws them at once
// and refreshes behind them. Shared state is saved, so it survives restarts.
const CACHE = "work-items.cache";

export default class WorkItems extends View {
  init(_props, cx) {
    this.tab = localStorage.getItem("tab") || "jira";
    this.repo = JSON.parse(localStorage.getItem("repo") || "{}");
    const cached = shared(CACHE);
    this.items = { ...(cached?.items ?? {}) }; this.errors = {}; this.loading = false;
    this.updated = cached?.updated ? new Date(cached.updated) : null;
    this.seenReviews = cached?.items?.reviews ? new Set(cached.items.reviews.map((p) => p.id)) : null;
    this.open = null; this.details = {};
    // props.open: a Jira key or GitHub URL to show expanded (pane.split {mod, props}).
    const wanted = props()?.open;
    if (wanted) {
      const id = wanted, tab = Object.keys(this.items).find((k) => this.items[k]?.some((i) => i.id === id));
      if (tab) this.tab = tab;
      this.open = id; this.loadDetail(this.findItem(id) ?? (/^[A-Z]+-\d+$/.test(id) ? { id, key: id } : null), cx);
    }
    this.refresh(cx);
    cx.timer.every(POLL, (cx) => this.refresh(cx));
  }

  refresh(cx) {
    if (this.loading) return;
    this.loading = true; cx.notify();
    cx.spawn(async (cx) => {
      this.tokens = ghTokens();
      await Promise.all(Object.entries(SOURCES).map(async ([id, load]) => {
        try { this.items[id] = await load(id === "jira" ? null : await this.tokens); this.errors[id] = null; }
        catch (e) { this.errors[id] = String(e.message || e); }
        cx.notify();
      }));
      this.announceReviews();
      this.details = {};
      if (this.open) this.loadDetail(this.findItem(this.open), cx);
      this.loading = false; this.updated = new Date();
      setShared(CACHE, { items: this.items, updated: this.updated.toISOString() });
      cx.notify();
    });
  }

  // First load just remembers; later loads toast anything new.
  announceReviews() {
    const now = this.items.reviews;
    if (!now) return;
    if (this.seenReviews) {
      for (const pr of now.filter((p) => !this.seenReviews.has(p.id))) {
        notify({ title: `Review requested · ${pr.where} ${pr.key}`, body: pr.title, level: "info", timeout: 10000 });
      }
    }
    this.seenReviews = new Set(now.map((p) => p.id));
  }

  findItem(id) {
    return Object.values(this.items).flat().find((i) => i.id === id);
  }

  ghItems() {
    const seen = new Map();
    for (const tab of ["prs", "reviews", "issues"]) for (const i of this.items[tab] ?? []) seen.set(i.id, i);
    return [...seen.values()];
  }

  // GitHub items whose titles match this Jira item's, computed once per refresh.
  relatedTo(item) {
    if (this.relatedFor !== this.items) {
      this.relatedFor = this.items; this.relatedCache = {};
      const gh = this.ghItems().map((g) => ({ g, w: words(g.title) }));
      for (const j of this.items.jira ?? []) {
        const w = words(j.title);
        this.relatedCache[j.id] = gh.filter((x) => related(w, x.w)).map((x) => x.g);
      }
    }
    return this.relatedCache[item.id] ?? [];
  }

  toggle(item, cx) {
    this.open = this.open === item.id ? null : item.id;
    if (this.open) this.loadDetail(item, cx);
    cx.notify();
  }

  loadDetail(item, cx) {
    if (!item || this.details[item.id]) return;
    this.details[item.id] = { loading: true };
    cx.spawn(async (cx) => {
      try {
        this.details[item.id] = item.repo ? await ghDetail(item, await (this.tokens ?? ghTokens())) : await jiraDetail(item);
      } catch (e) { this.details[item.id] = { error: String(e.message || e) }; }
      cx.notify();
    });
  }

  // Where Claude starts: the space for the item's repo (spaces are named after
  // their repo), else ~/repos/<repo>, else the space you're in. Never ~, which
  // makes Claude ask whether to trust the whole home folder.
  async start(item) {
    const task = `Let's work on ${item.key}: ${item.title}\n${item.url}\nRead it first and propose a plan.`;
    const name = tabName(item);
    const all = spaces(), current = all.find((s) => s.active);
    const repoSpace = item.where && all.find((s) => s.name === item.where && !s.machine);
    // A space's folder is where it was made; its terminals' cwd is where it is now.
    const liveFolder = (s) => {
      const tabs = new Set(s.tabs.map((t) => t.id));
      return panes().find((p) => tabs.has(p.tab) && p.cwd && p.cwd !== home())?.cwd;
    };
    if (repoSpace) return run("tab.new", { name, space: repoSpace.id, folder: liveFolder(repoSpace), argv: ["claude"], task });
    const clone = item.where && `${home()}/repos/${item.where}`;
    const cloned = clone && (await exec("test", ["-d", clone])).code === 0;
    const folder = cloned ? clone : current && liveFolder(current);
    if (!folder) return notify({ title: "No repo folder found", body: `Open a space in ${item.where ?? "the project"}'s repo first.`, level: "warning" });
    run("tab.new", { name, space: current?.id, folder, argv: ["claude"], task });
  }

  // The tab ▶ Claude started for this item, if it's still open.
  agentTab(item) {
    const name = tabName(item);
    for (const space of spaces()) for (const tab of space.tabs) {
      if (tab.name === name || tab.name.endsWith(` · ${name}`)) return tab;
    }
    return null;
  }

  // An item with a tab shows that tab's agent status instead of ▶ Claude;
  // clicking it goes to the tab.
  agentButton(item, t) {
    const tab = this.agentTab(item);
    if (!tab) return this.button(`go-${item.id}`, "▶ Claude", t, () => this.start(item));
    const status = tab.status ?? "idle", color = t[status] ?? t.idle;
    return h_flex().id(`tab-of-${item.id}`).gap(5).px(6).py(2).rounded(4).items_center().cursor_pointer()
      .text_color(color).hover((s) => s.bg(t.hover))
      .on_click((_e, cx) => { cx.stop_propagation(); run("tab.select", { id: tab.id }); })
      .child(div().w(7).h(7).rounded(4).bg(color)
        .when(status === "working" || status === "blocked", (el) => el.loop("opacity", { from: 0.35, to: 1, period: 1200 })))
      .child(div().child(status));
  }

  statusColor(item, t) {
    if (item.cat === "indeterminate") return t.working;
    if (item.cat === "new") return t.idle;
    if (/block/i.test(item.status ?? "")) return t.blocked;
    return t.muted;
  }

  renderTabs(t) {
    return h_flex().gap(2).px(8).py(6).border_b(1).border_color(t.border).children([
      ...TABS.map(({ id, label }) => {
        const on = id === this.tab, n = this.items[id]?.length;
        return h_flex().id(`tab-${id}`).gap(5).px(8).py(3).rounded(5).cursor_pointer()
          .bg(on ? t.selected : "#00000000").hover((s) => s.bg(on ? t.selected : t.hover))
          .text_color(on ? t.foreground : t.muted)
          .on_click((_e, cx) => { this.tab = id; localStorage.setItem("tab", id); cx.notify(); })
          .child(div().child(label))
          .when(n > 0, (el) => el.child(
            div().px(5).rounded(8).text_size(10).bg(id === "reviews" ? t.blocked : t.raised)
              .text_color(id === "reviews" ? t.background : t.muted).child(String(n))));
      }),
      div().flex_1(),
      div().id("refresh").px(6).py(3).rounded(5).cursor_pointer().text_color(t.dim)
        .hover((s) => s.bg(t.hover).text_color(t.foreground))
        .on_click((_e, cx) => this.refresh(cx))
        .child(this.loading ? div().frames(["◐", "◓", "◑", "◒"], 120) : "↻"),
    ]);
  }

  // Repo filter for the GitHub tabs, only when there's more than one repo.
  renderRepos(items, t) {
    const counts = new Map();
    for (const i of items) counts.set(i.where, (counts.get(i.where) ?? 0) + 1);
    if (counts.size < 2) return null;
    const chosen = this.repo[this.tab] ?? null;
    const chip = (repo, label, n) => {
      const on = chosen === repo;
      return h_flex().id(`repo-${label}`).gap(4).px(7).py(1).rounded(10).cursor_pointer().text_size(11)
        .border(1).border_color(on ? t.accent : t.border).text_color(on ? t.foreground : t.muted)
        .bg(on ? t.selected : "#00000000").hover((s) => s.bg(t.hover))
        .on_click((_e, cx) => {
          this.repo[this.tab] = repo; localStorage.setItem("repo", JSON.stringify(this.repo)); cx.notify();
        })
        .child(div().child(label)).child(div().text_color(t.dim).child(String(n)));
    };
    return h_flex().flex_wrap().gap(5).px(10).py(6).border_b(1).border_color(t.border).children([
      chip(null, "All", items.length),
      ...[...counts].sort((a, b) => b[1] - a[1]).map(([repo, n]) => chip(repo, repo, n)),
    ]);
  }

  button(id, label, t, onClick) {
    return div().id(id).px(6).py(2).rounded(4).text_color(t.dim).cursor_pointer()
      .hover((s) => s.bg(t.solid).text_color(t.solid_foreground))
      .on_click((_e, cx) => { cx.stop_propagation(); onClick(cx); })
      .child(label);
  }

  linkChip(g, t, prefix) {
    return h_flex().id(`${prefix}-${g.id}`).gap(4).px(6).rounded(4).cursor_pointer().text_size(11)
      .bg(t.raised).hover((s) => s.bg(t.hover))
      .on_click((_e, cx) => { cx.stop_propagation(); exec("open", [g.url]); })
      .child(div().font_family(MONO).text_color(t.accent).child(`${g.where}${g.key}`))
      .child(div().max_w(220).truncate().text_color(t.muted).child(g.title));
  }

  renderDetail(item, t) {
    const d = this.details[item.id];
    const box = v_flex().gap(8).px(14).py(8).bg(t.background).border_b(1).border_color(t.border);
    if (!d || d.loading) return box.child(div().text_color(t.dim).child("Loading details…"));
    if (d.error) return box.child(div().text_color(t.blocked).child(d.error));
    const byNumber = new Map(this.ghItems().map((g) => [String(g.number), g]));
    const refs = (d.refs ?? []).map((n) => byNumber.get(n)).filter(Boolean);
    return box
      .child(d.body
        ? div().text_size(12).text_color(t.foreground).child(TextView.markdown(`body-${item.id}`, clip(d.body)).selectable())
        : div().text_color(t.dim).child("No description."))
      .when(refs.length, (el) => el.child(v_flex().gap(4)
        .child(div().text_size(10).text_color(t.dim).child("MENTIONED IN DESCRIPTION"))
        .child(h_flex().flex_wrap().gap(4).children(refs.map((g) => this.linkChip(g, t, "ref"))))))
      .when(d.comment, (el) => el.child(v_flex().gap(3).pl(8).border_l(2).border_color(t.border)
        .child(div().text_size(10).text_color(t.dim).child(`LATEST COMMENT · ${d.comment.author} · ${ago(d.comment.when)}`))
        .child(div().text_size(12).text_color(t.muted).child(TextView.markdown(`comment-${item.id}`, clip(d.comment.text)).selectable()))));
  }

  renderRow(item, t) {
    const color = this.statusColor(item, t), open = this.open === item.id;
    const links = item.repo ? [] : this.relatedTo(item);
    const row = h_flex().id(`row-${item.id}`).gap(8).px(10).py(6).items_center().cursor_pointer()
      .bg(open ? t.selected : "#00000000").border_b(1).border_color(t.border).hover((s) => s.bg(open ? t.selected : t.hover))
      .on_click((_e, cx) => this.toggle(item, cx))
      .child(div().w(3).h(28).rounded(2).bg(item.status ? color : t.accent))
      .child(v_flex().flex_1().min_w(0).gap(2)
        .child(h_flex().gap(6).items_center().text_size(11)
          .child(div().text_color(t.dim).child(open ? "▾" : "▸"))
          .child(div().font_family(MONO).text_color(t.accent).child(item.key))
          .when(item.status, (el) => el.child(
            div().px(6).rounded(8).border(1).border_color(color).text_color(color).text_size(10).child(item.status)))
          .when(item.type === "Epic", (el) => el.child(div().text_color(t.ansi5).text_size(10).child("epic")))
          .child(div().flex_1())
          .child(div().text_color(t.dim).child(`${item.where ?? ""} · ${ago(item.updated)}`)))
        .child(div().truncate().text_size(13).text_color(t.foreground).child(item.title))
        .when(links.length, (el) => el.child(h_flex().flex_wrap().gap(4).pt(2)
          .child(div().text_size(11).text_color(t.dim).child("↳"))
          .children(links.slice(0, 3).map((g) => this.linkChip(g, t, `rel-${item.id}`))))))
      .child(this.button(`web-${item.id}`, "↗", t, () => exec("open", [item.url])))
      .child(this.agentButton(item, t));
    return open ? v_flex().child(row).child(this.renderDetail(item, t)) : row;
  }

  render() {
    const t = theme(), all = this.items[this.tab], error = this.errors[this.tab];
    const chosen = this.repo[this.tab];
    const items = all && chosen && all.some((i) => i.where === chosen) ? all.filter((i) => i.where === chosen) : all;
    let body;
    if (error) body = div().p(14).text_color(t.blocked).text_size(12).child(error);
    else if (!items) body = div().p(14).text_color(t.dim).child("Loading…");
    else if (!items.length) body = div().p(14).text_color(t.dim).child("Nothing here. Nice.");
    else body = v_flex().children(items.map((i) => this.renderRow(i, t)));

    return v_flex().size_full().bg(t.surface).text_size(12)
      .child(this.renderTabs(t))
      .when(all && this.tab !== "jira", (el) => {
        const repos = this.renderRepos(all, t);
        return repos ? el.child(repos) : el;
      })
      .child(div().id("list").flex_1().overflow_y_scrollbar().child(body))
      .when(this.updated, (el) => el.child(
        div().px(10).py(4).border_t(1).border_color(t.border).text_size(10).text_color(t.dim)
          .child(`updated ${this.updated.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} · click to expand · ↗ browser · ▶ start Claude`)));
  }
}
