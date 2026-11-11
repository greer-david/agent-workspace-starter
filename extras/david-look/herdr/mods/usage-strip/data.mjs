export function records(text, needle) {
  const out=[];
  for(const line of text.split('\n')) {
    if(needle && !line.includes(needle)) continue;
    try {out.push(JSON.parse(line));} catch {}
  }
  return out;
}
const count=v=>Number.isFinite(v)?Math.max(0,v):0;
export function resolveCodexSession(agent,index) {
  // A custom Herdr tab name can differ from Codex's own session title.
  const tab=agent?.tab_name?.replace(/^\d+\s*·\s*/, '');
  const terminal=agent?.title?.split(' | ')[0]?.trim();
  const undecorated=terminal?.replace(/^[\u2800-\u28ff✓✔●○◦•✦✧✳✻✽✶✢]\s+/u, '');
  const titles=new Set([tab,terminal,undecorated].filter(Boolean));
  const latest=new Map(index.map(r=>[r.id,r]));
  const matches=[...latest.values()].filter(r=>titles.has(r.thread_name));
  return matches.length===1?matches[0].id:null;
}
export function codexUsage(text) {
  let tokens=null,context=null,cacheRead=null,input=null,output=null,limits=null,sampled=0;
  let sessionId=null, occupancy=null, window=null, contextSampled=0;
  for(const r of records(text)) {
    if(r.type==='session_meta') sessionId=r.payload?.id??null;
    if(r.type==='compacted') {context=null;occupancy=null;contextSampled=0;}
    if(r.type!=='event_msg' || r.payload?.type!=='token_count') continue;
    const p=r.payload, total=p.info?.total_token_usage,last=p.info?.last_token_usage;
    if(Number.isFinite(last?.total_tokens) && last.total_tokens>=0) {
      occupancy=last.total_tokens;
      window=Number.isFinite(p.info?.model_context_window)?p.info.model_context_window:null;
      contextSampled=Date.parse(r.timestamp)||0;
    }
    if(Number.isFinite(total?.total_tokens)) {
      tokens=total.total_tokens; input=count(total.input_tokens);output=count(total.output_tokens);cacheRead=count(total.cached_input_tokens);
    }
    // This is the input of the most recent request, an estimate rather than live context occupancy.
    if(Number.isFinite(last?.input_tokens)) context=last.input_tokens;
    if(p.rate_limits && (!p.rate_limits.limit_id || p.rate_limits.limit_id==='codex')) {limits=p.rate_limits;sampled=Date.parse(r.timestamp)||0;}
  }
  return {tokens,context,cacheRead,input,output,limits,sampled,sessionId,occupancy,window,contextSampled};
}
export function claudeUsage(text,sessionId) {
  const usage=new Map();let context=null;
  for(const r of records(text)) {
    if(r.type==='system' && r.subtype==='compact_boundary') context=null;
    if(sessionId && r.sessionId && r.sessionId!==sessionId) continue;
    const m=r.message,u=m?.usage;
    if(r.type!=='assistant' || !m?.id || !u || r.isSidechain) continue;
    const values=[u.input_tokens,u.output_tokens,u.cache_read_input_tokens,u.cache_creation_input_tokens].map(count);
    const prev=usage.get(m.id)??[0,0,0,0];
    const next=values.map((v,i)=>Math.max(v,prev[i]));usage.set(m.id,next);
    context=next[0]+next[2]+next[3];
  }
  if(!usage.size) return {tokens:null,context:null,cacheRead:null,input:null,output:null,cacheWrite:null};
  const sums=[0,0,0,0];for(const row of usage.values()) row.forEach((v,i)=>sums[i]+=v);
  return {tokens:sums.reduce((a,b)=>a+b,0),context,input:sums[0],output:sums[1],cacheRead:sums[2],cacheWrite:sums[3]};
}
export function claudeTokens(text) {return claudeUsage(text).tokens;}
export function windowValue(pct,reset,sampled,now=Date.now()) {
  const resets=typeof reset==='number'?reset*1000:Date.parse(reset);
  if(!Number.isFinite(pct)||pct<0||pct>100)return null;
  return {pct,resets,sampled,stale:!sampled||(Number.isFinite(resets)&&resets<=now)};
}

// Match Codex 0.166 /status: latest total, with a 12K baseline for percent.
export function selectedContext(agent,index,usages) {
  if(agent?.app!=='codex') return null;
  const id=resolveCodexSession(agent,index);
  if(!id) return null;
  const matches=[...usages].filter(u=>u.sessionId===id);
  if(matches.length!==1) return null;
  const u=matches[0];
  if(!Number.isFinite(u.occupancy)||!Number.isFinite(u.window)||u.window<=12000||!u.contextSampled) return null;
  const remaining=Math.round(Math.min(100,Math.max(0,(u.window-12000-Math.max(0,u.occupancy-12000))/(u.window-12000)*100)));
  return {used:u.occupancy,window:u.window,pct:100-remaining,sampled:u.contextSampled,id};
}
