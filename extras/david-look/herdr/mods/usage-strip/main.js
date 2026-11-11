import { View, div } from 'gpui-kit';
import { h_flex } from 'gpui-base';
import * as fs from 'fs/promises';
import { home, appHome, theme, agents, panes, spaces, run, nextCommand, watchFolder, exec } from 'herdr';
import { records, codexUsage, windowValue, selectedContext, resolveCodexSession } from './data.mjs';
const compact = n => n === null ? '—' : n >= 1e6 ? `${(n/1e6).toFixed(2)}M` : n >= 1000 ? `${(n/1000).toFixed(1)}k` : String(n);
const age = ms => !ms ? 'unknown age' : Date.now()-ms < 60000 ? 'just now' : `${Math.floor((Date.now()-ms)/60000)}m ago`;
const remaining = ms => !Number.isFinite(ms) ? 'reset unknown' : ms <= Date.now() ? 'awaiting reset update' : `resets in ${Math.floor((ms-Date.now())/3600000)}h ${Math.floor((ms-Date.now())/60000)%60}m`;
const readContext = async path => {
  const script = `import json,sys
from pathlib import Path
p=Path(sys.argv[1])
with p.open('rb') as f:
 head=f.readline()
 f.seek(0,2); size=f.tell(); f.seek(max(0,size-8*1024*1024))
 tail=f.read().splitlines()
 if size>8*1024*1024: tail=tail[1:]
 events=[]
 for line in reversed(tail):
  try: r=json.loads(line)
  except (ValueError,UnicodeDecodeError): continue
  if r.get('type')=='compacted' or (r.get('type')=='event_msg' and r.get('payload',{}).get('type')=='token_count' and r.get('payload',{}).get('info') is not None):
   events=[r]; break
 print(head.decode().strip())
 for r in events: print(json.dumps(r))`;
  const result=await exec('python3',['-c',script,path]);
  return result.code===0?codexUsage(result.stdout):null;
};
const read = async path => { try { return await fs.readFile(path,'utf8'); } catch { return ''; } };
function insights() {
  const ids = new Set(spaces().find(s=>s.active)?.tabs.map(t=>t.id) ?? []);
  const p = panes().find(p=>p.mod==='insights' && ids.has(p.tab));
  if (!p) return run('tab.new',{name:'Insights',mod:'insights'});
  const z=panes().find(q=>q.tab===p.tab && q.zoomed);
  if (z && z.pane!==p.pane) run('pane.zoom',{pane:z.pane});
  return run('pane.focus',{pane:p.pane});
}
export default class UsageStrip extends View {
  init(_props,cx) {
    this.session=null; this.codex=null; this.claude=null; this.target=''; this.files=[]; this.discovered=0; this.cache=new Map(); this.dirty=new Set();
    cx.spawn(async cx=>{
      const root=`${home()}/.codex/sessions`;
      try { for (;;) {
        const paths=await watchFolder(root);
        for(const path of paths) {
          if(path===root) {this.cache.clear();this.discovered=0;}
          else if(path.endsWith('.jsonl')) {this.dirty.add(path);if(!this.files.includes(path))this.files.push(path);}
        }
        cx.notify();
      }} catch {this.watchFailed=true;}
    });
    this.refresh(cx);
    cx.timer.every(2000,cx=>this.refresh(cx));
    cx.spawn(async cx=>{ for (;;) { const c=await nextCommand(); if(c.replace(/^usage-strip\./,'')==='insights') insights(); else if(c==='refresh') this.refresh(cx); cx.notify(); } });
  }
  async discover() {
    if(Date.now()-this.discovered<60000) return;
    const files=[];
    const root=`${home()}/.codex/sessions`;
    // Recent daily folders plus exact session dates from the index, never source prompts.
    const dates=new Set();
    for(let i=0;i<7;i++){const d=new Date(Date.now()-i*86400000).toISOString().slice(0,10); dates.add(d.replaceAll('-','/'));}
    this.index=records(await read(`${home()}/.codex/session_index.jsonl`));
    for(const d of dates) {
      const path=`${root}/${d}`;
      try { for(const f of await fs.readdir(path)) if(f.endsWith('.jsonl')) files.push(`${path}/${f}`); } catch {}
    }
    this.files=files; this.discovered=Date.now();
  }
  refresh(cx) {
    if(this.busy) return;
    this.busy=true;
    cx.spawn(async cx=>{
      try {
        await this.discover();
        this.index=records(await read(`${home()}/.codex/session_index.jsonl`));
        const active=agents().find(a=>a.focused && a.app==='codex');
        const id=resolveCodexSession(active,this.index);
        const paths=id?this.files.filter(p=>p.endsWith(`-${id}.jsonl`)):[];
        this.contextUsage=paths.length===1?await readContext(paths[0]):null;
        let latest=null;
        for(const path of this.files) {
          if(this.watchFailed || !this.cache.has(path) || this.dirty.has(path)) {
            this.dirty.delete(path);
            this.cache.set(path,codexUsage(await read(path)));
          }
          const u=this.cache.get(path);
          if(u.limits && (!latest || u.sampled>latest.sampled)) latest=u;
        }
        let claude; try {claude=JSON.parse(await read(`${appHome()}/data/usage-strip/claude.json`));} catch {}
        this.codex=latest; this.claude=claude; this.error=null;
      } catch(e) {this.error=String(e?.message??e);} finally {this.busy=false;cx.notify();}
    });
  }
  meter(id,label,value,t,provider) {
    const color=!value || value.stale ? t.dim : value.pct>=90 ? t.blocked : value.pct>=70 ? t.ansi3 : t.muted;
    const W=72;
    return h_flex().id(id).gap(6).items_center().flex_none().text_color(color)
      .tooltip(value ? `${provider} ${label}: ${Math.round(value.pct)}% used; ${remaining(value.resets)}. Observed ${age(value.sampled)}.${value.stale?' Reset has passed: waiting for the next provider update.':''}` : `${provider} ${label}: waiting for local provider usage data.`)
      .child(div().text_color(t.dim).child(label))
      .child(div().w(W).h(5).rounded(3).bg(t.border).when(Boolean(value),el=>el.child(div().w(Math.round(W*Math.min(100,value.pct)/100)).h(5).rounded(3).bg(color))))
      .child(div().w(30).child(value?`${Math.round(value.pct)}%`:'—'));
  }
  render(cx) {
    const t=theme(), c=this.codex, l=this.claude;
    const cw=(key,minutes)=>{const w=c?.limits?.[key];return w?.window_minutes===minutes?windowValue(w.used_percent,w.resets_at,c.sampled):null;};
    const lw=key=>windowValue(l?.[key]?.used_percentage,l?.[key]?.resets_at,Date.parse(l?.updated_at));
    const needs=agents().filter(a=>a.status==='blocked').length;
    const agent=agents().find(a=>a.focused);
    const ctx=selectedContext(agent,this.index??[],[this.contextUsage].filter(Boolean));
    const name=n=>div().text_color(t.foreground).flex_none().child(n);
    return h_flex().size_full().min_w(0).px(12).gap(14).items_center().bg(t.chrome).border_t(1).border_color(t.border).text_size(11.5).text_color(t.muted)
      .child(name('Codex'))
      .child(this.meter('codex-five','5h',cw('primary',300),t,'Codex'))
      .child(this.meter('codex-week','wk',cw('secondary',10080),t,'Codex'))
      .child(div().w(1).h(14).bg(t.border).flex_none())
      .child(name('Claude'))
      .child(this.meter('claude-five','5h',lw('five_hour'),t,'Claude'))
      .child(this.meter('claude-week','wk',lw('seven_day'),t,'Claude'))
      .child(div().flex_1())
      .when(agent?.app==='codex',el=>el.child(div().id('codex-context').flex_none().text_color(t.foreground)
        .tooltip(ctx ? `Selected Codex session ${ctx.id}. Latest reported context, including cached input; matches Codex /status. Updated ${age(ctx.sampled)}. Percentage uses Codex's 12K baseline; not cumulative session usage.` : 'Context unavailable: waiting for a unique Codex terminal/tab title match and a token-count event. Never selects the globally newest session.')
        .child(ctx?`Context ${compact(ctx.used)} / ${compact(ctx.window)} · ${ctx.pct}% used`:'Context unavailable')))
      .when(Boolean(this.error),el=>el.child(div().id('usage-error').text_color(t.dim).tooltip(this.error).child('!')))
      .when(needs>0,el=>el.child(div().text_color(t.blocked).child(`${needs} need${needs===1?'s':''} you`)));
  }
}
