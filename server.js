'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { URL } = require('node:url');

const ROOT = __dirname;
const PUBLIC = path.join(ROOT, 'public');
const PORT = Number(process.env.PORT || 8787);

const seed = makeDemoGraph();
const store = { graph: seed.graph, repo: seed.repo, mode: 'demo', ingestedAt: null, ingestLog: [] };

function makeDemoGraph() {
  const repo = {
    owner: 'acme', name: 'payments-platform', fullName: 'acme/payments-platform',
    url: 'https://github.com/acme/payments-platform', branch: 'main',
    description: 'Illustrative payment-service repository for the interactive prototype',
    mode: 'demo', lastIndexed: new Date().toISOString(),
    note: 'Illustrative sample graph — not real repository history'
  };
  const nodes = [
    { id:'repo', type:'repository', label:'payments-platform', subtitle:'Repository', title:'acme/payments-platform', date:'', url:repo.url, body:repo.note },
    { id:'d_retry_old', type:'decision', label:'Retry cap = 5', subtitle:'D-008 · Superseded', title:'Retry provider calls up to five times', date:'2023-11-03', status:'superseded', author:'Eli Turner', confidence:0.61, body:'Earlier policy retried transient payment-provider failures up to five times. It was later replaced after retry amplification contributed to provider throttling.', rationale:'The older policy aimed to recover transient network failures, but it did not adequately account for correlated retries and rate-limit pressure.', url:'', sourceLabel:'Decision record D-008', sourceExcerpt:'Use up to five retries for transient provider failures.', evidenceCount:2 },
    { id:'d_retry', type:'decision', label:'Retry cap = 3', subtitle:'D-042 · Active', title:'Cap provider retries at three attempts', date:'2024-12-12', status:'active', author:'Maya Chen', confidence:0.94, body:'Cap transient payment-provider retries at three attempts, then use exponential backoff with jitter. This limits retry amplification during provider degradation.', rationale:'Incident INC-024 showed synchronized retries increased pressure on the provider rate limit. The team reduced the cap, added jitter, and kept retries limited to transient failures so idempotent operations remain safe.', url:'', sourceLabel:'Decision record D-042', sourceExcerpt:'Three attempts maximum; exponential backoff and jitter; retry only transient failures.', evidenceCount:4 },
    { id:'incident_retry', type:'incident', label:'Retry storm', subtitle:'INC-024 · Incident', title:'Provider rate-limit spike during payment degradation', date:'2024-12-09', author:'On-call rotation', confidence:0.92, body:'A provider slowdown caused multiple application workers to retry in sync. Request volume increased while the provider was already rate-limiting the service.', url:'', sourceLabel:'Incident INC-024', sourceExcerpt:'Synchronized retries amplified outbound requests during an upstream slowdown.' },
    { id:'pr_retry', type:'pull_request', label:'PR #421', subtitle:'Discussion · Merged', title:'Cap provider retries and add jitter', date:'2024-12-12', author:'Maya Chen', confidence:0.96, body:'The discussion proposed lowering the retry ceiling from five to three, applying exponential backoff and jitter, and restricting retries to transient transport/provider errors. Reviewers linked the change to INC-024.', url:'', sourceLabel:'Pull request #421', sourceExcerpt:'Lower the ceiling to three; jitter prevents every worker retrying on the same schedule.' },
    { id:'commit_retry', type:'commit', label:'a81c2f0', subtitle:'Commit · 2024-12-12', title:'Add bounded retries with jitter', date:'2024-12-12', author:'Maya Chen', confidence:0.95, body:'Implements bounded retry attempts and exponential delay with jitter for provider calls.', url:'', sourceLabel:'Commit a81c2f0', sourceExcerpt:'Add bounded retries and jitter to provider requests.' },
    { id:'file_retry', type:'code', label:'retryPolicy.ts', subtitle:'Code entity · File', title:'src/providers/retryPolicy.ts', date:'', body:'Retry configuration and backoff implementation. The path is illustrative demo data.', url:'', sourceLabel:'Code entity', sourceExcerpt:'src/providers/retryPolicy.ts' },
    { id:'person_maya', type:'person', label:'Maya Chen', subtitle:'Contributor · Decision owner', title:'Maya Chen', date:'', body:'Illustrative contributor profile. In a live repository, this would be derived from GitHub identities.', url:'', sourceLabel:'Contributor', sourceExcerpt:'Authored the illustrative retry-policy change.' },
    { id:'doc_retry', type:'document', label:'Reliability notes', subtitle:'Design note · Document', title:'docs/reliability/retries.md', date:'2024-12-11', author:'Maya Chen', confidence:0.83, body:'For upstream provider failures, prefer bounded retries with exponential backoff and jitter. Avoid retrying validation errors or requests that are not safe to repeat.', url:'', sourceLabel:'Design note', sourceExcerpt:'Bound retries, add jitter, and avoid retrying non-transient errors.' },
    { id:'d_auth', type:'decision', label:'Defer auth migration', subtitle:'D-031 · Active', title:'Keep the legacy auth adapter until webhook v2 is adopted', date:'2024-08-19', status:'active', author:'Eli Turner', confidence:0.82, body:'The team deferred replacing the legacy authentication adapter until partner webhook v2 was deployed. A dual-write / dual-verify period was considered necessary for safe migration.', rationale:'The webhook v2 rollout was an explicit dependency. Migrating earlier would split authentication behavior between current API requests and partner callbacks, making failures harder to diagnose.', url:'', sourceLabel:'Decision record D-031', sourceExcerpt:'Do not remove the adapter before webhook v2 adoption and a verification window.', evidenceCount:3 },
    { id:'pr_auth', type:'pull_request', label:'PR #588', subtitle:'Discussion · Deferred', title:'Prepare auth adapter migration', date:'2024-08-19', author:'Eli Turner', confidence:0.85, body:'Reviewers agreed to leave the adapter in place until webhook v2 adoption reached the required threshold and rollback checks were documented.', url:'', sourceLabel:'Pull request #588', sourceExcerpt:'Hold the final switch until the webhook v2 rollout is stable.' },
    { id:'file_auth', type:'code', label:'legacyAdapter.ts', subtitle:'Code entity · File', title:'src/auth/legacyAdapter.ts', date:'', body:'Legacy authentication adapter kept during the staged webhook migration. Illustrative demo path.', url:'', sourceLabel:'Code entity', sourceExcerpt:'src/auth/legacyAdapter.ts' },
    { id:'person_eli', type:'person', label:'Eli Turner', subtitle:'Contributor · Decision owner', title:'Eli Turner', date:'', body:'Illustrative contributor profile. In a live repository, this would be derived from GitHub identities.', url:'', sourceLabel:'Contributor', sourceExcerpt:'Authored the illustrative auth migration discussion.' },
    { id:'d_cache_old', type:'decision', label:'TTL-only cache', subtitle:'D-014 · Superseded', title:'Rely on time-to-live cache expiration', date:'2024-02-05', status:'superseded', author:'Priya Shah', confidence:0.57, body:'The old cache approach relied on a fixed TTL to expire values after writes.', rationale:'Simple to implement, but it allowed stale product information to remain visible until expiry.', url:'', sourceLabel:'Decision record D-014', sourceExcerpt:'Use TTL as the primary cache invalidation mechanism.', evidenceCount:2 },
    { id:'d_cache', type:'decision', label:'Invalidate on write', subtitle:'D-027 · Active', title:'Invalidate product cache after successful writes', date:'2024-05-16', status:'active', author:'Priya Shah', confidence:0.89, body:'After a successful product update, invalidate the affected cache key rather than relying only on fixed TTL expiry. TTL remains a fallback.', rationale:'The incident review found that stale product data was visible after an update. Explicit invalidation closes the normal stale-data window while TTL remains a safety net.', url:'', sourceLabel:'Decision record D-027', sourceExcerpt:'Delete affected keys after successful writes; TTL remains as a fallback.', evidenceCount:3 },
    { id:'issue_cache', type:'issue', label:'Issue #302', subtitle:'Issue · Stale reads', title:'Stale product response after update', date:'2024-05-10', author:'Priya Shah', confidence:0.85, body:'Users occasionally received old product data immediately after an update because cache entries were still within their TTL.', url:'', sourceLabel:'Issue #302', sourceExcerpt:'Cache returned a previous value after a successful product update.' },
    { id:'file_cache', type:'code', label:'productCache.ts', subtitle:'Code entity · File', title:'src/catalog/productCache.ts', date:'', body:'Product cache adapter and invalidation hooks. Illustrative demo path.', url:'', sourceLabel:'Code entity', sourceExcerpt:'src/catalog/productCache.ts' },
    { id:'person_priya', type:'person', label:'Priya Shah', subtitle:'Contributor · Decision owner', title:'Priya Shah', date:'', body:'Illustrative contributor profile. In a live repository, this would be derived from GitHub identities.', url:'', sourceLabel:'Contributor', sourceExcerpt:'Authored the illustrative cache invalidation change.' },
    { id:'doc_arch', type:'document', label:'Architecture notes', subtitle:'Design note · Document', title:'docs/architecture/decisions.md', date:'2024-12-12', author:'Engineering', confidence:0.78, body:'Architecture decisions should link the observed problem, the chosen trade-off, the implementation and any later replacement. This file is illustrative seed content.', url:'', sourceLabel:'Design note', sourceExcerpt:'Record why a decision was made and link subsequent changes.' }
  ];
  const edges = [
    {source:'repo',target:'d_retry',label:'contains decision'}, {source:'d_retry_old',target:'d_retry',label:'superseded by',type:'supersedes'},
    {source:'d_retry',target:'incident_retry',label:'motivated by'}, {source:'d_retry',target:'pr_retry',label:'implemented in'}, {source:'d_retry',target:'doc_retry',label:'documented in'},
    {source:'pr_retry',target:'commit_retry',label:'merged as'}, {source:'commit_retry',target:'file_retry',label:'changes'}, {source:'pr_retry',target:'person_maya',label:'authored by'},
    {source:'d_retry',target:'file_retry',label:'governs'}, {source:'incident_retry',target:'file_retry',label:'root cause traced to'}, {source:'doc_arch',target:'d_retry',label:'records rationale'},
    {source:'repo',target:'d_auth',label:'contains decision'}, {source:'d_auth',target:'pr_auth',label:'discussed in'}, {source:'d_auth',target:'file_auth',label:'governs'}, {source:'pr_auth',target:'person_eli',label:'authored by'},
    {source:'repo',target:'d_cache',label:'contains decision'}, {source:'d_cache_old',target:'d_cache',label:'superseded by',type:'supersedes'}, {source:'d_cache',target:'issue_cache',label:'motivated by'},
    {source:'d_cache',target:'file_cache',label:'governs'}, {source:'d_cache',target:'person_priya',label:'decision owner'}, {source:'issue_cache',target:'file_cache',label:'reproduced in'}
  ];
  return { repo, graph:{ nodes, edges, source:'demo', generatedAt:new Date().toISOString() } };
}

const MIME = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.json':'application/json; charset=utf-8', '.svg':'image/svg+xml' };
function send(res, status, payload, type='application/json; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control':'no-store', 'Access-Control-Allow-Origin':'*', 'Access-Control-Allow-Headers':'Content-Type', 'Access-Control-Allow-Methods':'GET,POST,OPTIONS' });
  res.end(type.startsWith('application/json') ? JSON.stringify(payload) : payload);
}
function readBody(req) {
  return new Promise((resolve, reject) => { let raw=''; req.on('data', c => { raw += c; if (raw.length > 1_000_000) reject(new Error('Request body too large')); }); req.on('end', () => { try { resolve(JSON.parse(raw || '{}')); } catch { reject(new Error('Invalid JSON')); } }); req.on('error', reject); });
}
function htmlEscape(s='') { return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function compact(s, n=420) { s=String(s||'').replace(/\s+/g,' ').trim(); return s.length>n ? s.slice(0,n-1)+'…' : s; }
function tokens(s) { return String(s||'').toLowerCase().replace(/[^a-z0-9_./#-]/g,' ').split(/\s+/).filter(x=>x.length>2 && !STOP.has(x)); }
const STOP = new Set('the and for with that this from into after before were was are why what how when does did have has had can could would should like code line file function service system decision reason current latest old new about until have been being its our your they them then than onto their there which while because'.split(' '));
function unique(arr) { return [...new Set(arr)]; }
function dateOf(n) { return n.date || ''; }

async function ghGet(url) {
  const r = await fetch(url, { headers: { 'Accept':'application/vnd.github+json', 'User-Agent':'WhyCode-Hackathon-Prototype', 'X-GitHub-Api-Version':'2022-11-28' }, signal: AbortSignal.timeout(12000) });
  if (!r.ok) {
    const err = new Error(`GitHub returned ${r.status} for ${url}`);
    err.status = r.status;
    if (r.status === 403 || r.status === 429) err.message = 'GitHub API rate limit reached. Wait a little or retry with a GitHub token configured on the server.';
    if (r.status === 404) err.message = 'Repository or resource not found. Check that the URL is public and spelled correctly.';
    throw err;
  }
  return r.json();
}
function repoFromUrl(value) {
  let u;
  try { u = new URL(value); } catch { throw new Error('Enter a valid GitHub repository URL, such as https://github.com/fastapi/fastapi'); }
  if (u.hostname !== 'github.com') throw new Error('Only public GitHub repository URLs are supported in this prototype.');
  const parts = u.pathname.split('/').filter(Boolean);
  if (parts.length < 2) throw new Error('Use a repository URL in the form https://github.com/owner/repository.');
  const owner = parts[0], name = parts[1].replace(/\.git$/,'');
  if (!/^[A-Za-z0-9_.-]+$/.test(owner) || !/^[A-Za-z0-9_.-]+$/.test(name)) throw new Error('The owner or repository name contains unsupported characters.');
  return { owner, name, fullName:`${owner}/${name}`, url:`https://github.com/${owner}/${name}` };
}

async function ingestRepository(repoUrl) {
  const parsed = repoFromUrl(repoUrl);
  const api = `https://api.github.com/repos/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.name)}`;
  const meta = await ghGet(api);
  if (meta.private) throw new Error('This prototype supports public repositories only.');
  const branch = meta.default_branch || 'main';
  const [commits, issues, treeResult] = await Promise.all([
    ghGet(`${api}/commits?per_page=18`),
    ghGet(`${api}/issues?state=all&sort=updated&direction=desc&per_page=24`),
    ghGet(`${api}/git/trees/${encodeURIComponent(branch)}?recursive=1`).catch(() => ({tree:[],truncated:false}))
  ]);
  const tree = treeResult.tree || [];
  const sourceItems = [];
  const nodes = [];
  const edges = [];
  const nodeIds = new Set();
  const addNode = n => { if (!nodeIds.has(n.id)) { nodes.push(n); nodeIds.add(n.id); } return n.id; };
  const addEdge = (source,target,label,type='related') => { if (source && target && source!==target && nodeIds.has(source) && nodeIds.has(target) && !edges.some(e=>e.source===source&&e.target===target&&e.label===label)) edges.push({source,target,label,type}); };
  const repoNodeId = 'repository';
  addNode({ id:repoNodeId, type:'repository', label:parsed.name, subtitle:'Repository', title:parsed.fullName, date:'', url:parsed.url, body:meta.description||'Public GitHub repository', stars:meta.stargazers_count, language:meta.language, branch });

  // Fetch a bounded number of commit details so code paths are actual changed files.
  const commitDetails = await Promise.all(commits.slice(0,8).map(c => ghGet(`${api}/commits/${c.sha}`).catch(()=>null)));
  const pathsByCommit = new Map();
  for (let i=0; i<commits.length; i++) {
    const c = commits[i]; const detail = commitDetails[i];
    const id = `commit_${c.sha.slice(0,8)}`;
    const message = c.commit?.message || 'Commit';
    const author = c.author?.login || c.commit?.author?.name || 'Unknown contributor';
    const date = c.commit?.author?.date || '';
    const url = c.html_url || '';
    const paths = (detail?.files||[]).map(f=>f.filename).slice(0,30);
    pathsByCommit.set(id, paths);
    addNode({id,type:'commit',label:c.sha.slice(0,7),subtitle:`Commit · ${date.slice(0,10)}`,title:compact(message,160),date,author,url,body:message,files:paths,sourceExcerpt:compact(message,220)});
    addEdge(repoNodeId,id,'contains');
    const pId = `person_${slug(author)}`;
    addNode({id:pId,type:'person',label:author,subtitle:'Contributor',title:author,body:`Contributor identity from GitHub: ${author}`,url:c.author?.html_url||''});
    addEdge(id,pId,'authored by');
    for (const p of paths) {
      const fId = `file_${slug(p)}`;
      addNode({id:fId,type:'code',label:path.basename(p),subtitle:'Code entity · File',title:p,body:`Changed in commit ${c.sha.slice(0,7)}. File path supplied by GitHub commit metadata.`,url:`${parsed.url}/blob/${branch}/${p}`});
      addEdge(id,fId,'changes');
    }
    sourceItems.push({ id, kind:'commit', text:message, title:message, body:message, author, date, url, paths, comments:[] });
  }

  const issueItems = issues.filter(i => i && i.pull_request ? true : true);
  // Pull requests and issues are returned together by the issues endpoint.
  const discussionCandidates = issueItems.slice(0,18);
  for (const i of discussionCandidates) {
    const isPR = Boolean(i.pull_request);
    const id = `${isPR?'pr':'issue'}_${i.number}`;
    const title = i.title || (isPR?'Pull request':'Issue');
    const body = i.body || '';
    const date = i.updated_at || i.created_at || '';
    const author = i.user?.login || 'Unknown contributor';
    const url = i.html_url || '';
    const textBlob = `${title}\n${body}`;
    const incident = !isPR && /incident|outage|regression|production down|service unavailable|rate.?limit|data loss/i.test(textBlob);
    addNode({id,type:incident?'incident':(isPR?'pull_request':'issue'),label:`${isPR?'PR':'Issue'} #${i.number}`,subtitle:`${isPR?'Pull request':'Issue'} · ${i.state}`,title,date,author,url,body:compact(body,900),state:i.state,sourceExcerpt:compact(body||title,260)});
    addEdge(repoNodeId,id,'tracks');
    const pId = `person_${slug(author)}`;
    addNode({id:pId,type:'person',label:author,subtitle:'Contributor',title:author,body:`Contributor identity from GitHub: ${author}`,url:i.user?.html_url||''});
    addEdge(id,pId,'opened by');
    const comments = [];
    sourceItems.push({ id, kind:isPR?'pull_request':'issue', title, body, text:textBlob, author, date, url, paths:[], comments, number:i.number, comments_url:i.comments_url, state:i.state });
  }

  // Read a few likely design/architecture docs from the tree, without crawling the whole repo.
  const docCandidates = tree.filter(x=>x.type==='blob' && /(^|\/)(readme|adr|architecture|design|decision|rfc|contributing|reliability)[^/]*\.(md|mdx|rst|txt)$/i.test(x.path) && (x.path.split('/').length<=4)).slice(0,4);
  for (const d of docCandidates) {
    let body='';
    try { body = await fetch(`https://raw.githubusercontent.com/${parsed.owner}/${parsed.name}/${encodeURIComponent(branch)}/${d.path}`, {headers:{'User-Agent':'WhyCode-Hackathon-Prototype'},signal:AbortSignal.timeout(9000)}).then(r=>r.ok?r.text():'').then(t=>t.slice(0,16000)); } catch {}
    const id = `doc_${slug(d.path)}`;
    addNode({id,type:'document',label:path.basename(d.path),subtitle:'Repository document',title:d.path,date:'',url:`${parsed.url}/blob/${branch}/${d.path}`,body:compact(body,1200),sourceExcerpt:compact(body,260)});
    addEdge(repoNodeId,id,'documents');
    if (body) sourceItems.push({id,kind:'document',title:d.path,body,text:body,author:'Repository documentation',date:'',url:`${parsed.url}/blob/${branch}/${d.path}`,paths:[d.path],comments:[]});
  }

  // Add discussion comments to the most recent relevant issues/PRs, with bounded API use.
  const commentCandidates = discussionCandidates.filter(i=>Number(i.comments)>0).slice(0,5);
  await Promise.all(commentCandidates.map(async i => {
    const parentId = `${i.pull_request?'pr':'issue'}_${i.number}`;
    let comments=[]; try { comments = await ghGet(`${api}/issues/${i.number}/comments?per_page=8`); } catch {}
    for (const c of comments.slice(0,8)) {
      const id = `comment_${i.number}_${c.id}`;
      const author = c.user?.login || 'Unknown contributor';
      const text = c.body || '';
      addNode({id,type:'discussion',label:`Comment · #${i.number}`,subtitle:`Discussion · ${String(c.created_at||'').slice(0,10)}`,title:compact(text,110),date:c.created_at||'',author,url:c.html_url||i.html_url,body:compact(text,800),sourceExcerpt:compact(text,260)});
      addEdge(parentId,id,'discussion');
      const pId=`person_${slug(author)}`;
      addNode({id:pId,type:'person',label:author,subtitle:'Contributor',title:author,body:`Contributor identity from GitHub: ${author}`,url:c.user?.html_url||''});
      addEdge(id,pId,'commented by');
      const parent = sourceItems.find(s=>s.id===parentId);
      if (parent) parent.comments.push({id,author,date:c.created_at||'',text,url:c.html_url||i.html_url});
      sourceItems.push({id,kind:'discussion',title:`Comment on #${i.number}`,body:text,text,author,date:c.created_at||'',url:c.html_url||i.html_url,paths:[],comments:[],parentId});
    }
  }));

  // Extract candidate decision records from source text with lightweight, explainable heuristics.
  // A live LLM/GraphRAG layer can replace this extractor; the raw evidence links remain intact.
  const decisionSignals = /\b(decision|decided|because|trade.?off|we chose|we should|we will|we won't|defer|deferred|instead|replace|replaced|supersed|revert|deprecat|retry|backoff|rate.?limit|compatib|rollback|migrat|avoid|must remain|keep .* until|only if|root cause|incident|regression|outage|not safe|rather than)\b/i;
  const decisionSources = sourceItems.filter(s=>decisionSignals.test(`${s.title||''}\n${s.body||''}`));
  const decisions = [];
  for (const s of decisionSources.slice(0,22)) {
    const title = compact(s.title||s.text||'Engineering decision',115);
    const id = `decision_${slug(s.id)}`;
    const body = compact(s.body||s.text||'',980);
    const evidence = compact((s.body||s.text||'').split(/(?<=[.!?])\s+/).find(t=>decisionSignals.test(t)) || body,340);
    const decision = { id,type:'decision',label:compact(title,45),subtitle:`Decision candidate · ${s.date?String(s.date).slice(0,10):'date unknown'}`,title,date:s.date||'',author:s.author||'',confidence:0.48,status:'candidate',body,rationale:evidence,url:s.url||'',sourceLabel:sourceLabelFor(s),sourceExcerpt:evidence,evidenceCount:1,sourceId:s.id };
    addNode(decision); addEdge(id,s.id,'derived from evidence');
    if (s.author) { const pId=`person_${slug(s.author)}`; addNode({id:pId,type:'person',label:s.author,subtitle:'Contributor',title:s.author,body:`Contributor identity from GitHub: ${s.author}`}); addEdge(id,pId,'mentioned author'); }
    // Link source-path and file mentions; changed paths are direct, named paths in text are weaker links.
    for (const p of (s.paths||[]).slice(0,6)) { const fId=`file_${slug(p)}`; if (nodeIds.has(fId)) addEdge(id,fId,'affects'); }
    const blob = `${s.title||''} ${s.body||s.text||''}`.toLowerCase();
    const terms = new Set(tokens(blob));
    const matchedFiles = nodes.filter(n=>n.type==='code' && (terms.has(path.basename(n.title||'').toLowerCase().split('.')[0]) || (n.title||'').split('/').some(seg=>seg && terms.has(seg.toLowerCase().split('.')[0])))).slice(0,3);
    for (const f of matchedFiles) addEdge(id,f.id,'mentions');
    decisions.push(decision);
  }
  // Supersession detection is conservative: require an explicit change/replacement signal and lexical overlap.
  const supersessionCue = /\b(supersed|replace[ds]?|instead|revert|deprecat|no longer|switch(?:ed)? to|changed to|remove[ds]?|migrat(?:e|ed|ion))\b/i;
  for (const newer of decisions) {
    const newerText = `${newer.title} ${newer.body}`;
    if (!supersessionCue.test(newerText)) continue;
    for (const older of decisions) {
      if (older.id===newer.id || !older.date || !newer.date || older.date>=newer.date) continue;
      const a = new Set(tokens(`${older.title} ${older.body}`)); const b = new Set(tokens(newerText));
      const overlap = [...a].filter(t=>b.has(t)).length / Math.max(1,Math.min(a.size,b.size));
      if (overlap >= 0.24 && (older.sourceId!==newer.sourceId)) {
        older.status='superseded'; older.supersededBy=newer.id;
        addEdge(older.id,newer.id,'superseded by','supersedes');
      }
    }
  }
  // Evidence quality is driven by provenance and graph connectivity, not the wording of a model response.
  for (const d of decisions) {
    const related = edges.filter(e=>e.source===d.id||e.target===d.id);
    const hardEvidence = related.filter(e=>{ const n=nodes.find(x=>x.id===(e.source===d.id?e.target:e.source)); return n && ['commit','pull_request','issue','incident','discussion','document'].includes(n.type); }).length;
    d.evidenceCount = hardEvidence;
    d.confidence = Math.min(0.91, 0.42 + hardEvidence*0.11 + (d.date?0.04:0));
    if (hardEvidence>=2 && d.status==='candidate') d.status='supported';
  }
  const graph = { nodes, edges, source:'live', generatedAt:new Date().toISOString(), ingestion:{ commitCount:commits.length, issueCount:issueItems.filter(i=>!i.pull_request).length, pullRequestCount:issueItems.filter(i=>i.pull_request).length, documentCount:docCandidates.length, commentCount:commentCandidates.length } };
  return { graph, repo:{...parsed, description:meta.description||'', branch, language:meta.language, stars:meta.stargazers_count, forks:meta.forks_count, openIssues:meta.open_issues_count, mode:'live', lastIndexed:new Date().toISOString(), note:'Indexed from public GitHub API. Decision extraction is heuristic in this prototype.'} };
}
function sourceLabelFor(s) { return ({commit:`Commit ${s.id.replace('commit_','')}`,pull_request:`Pull request #${s.number}`,issue:`Issue #${s.number}`,discussion:'Discussion comment',document:`Document ${s.title}`})[s.kind] || 'Repository evidence'; }
function slug(s='') { return String(s).toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'').slice(0,70)||'item'; }

const demoAnswers = [
  { pattern:/retry|backoff|rate.?limit|attempts?/i, decision:'d_retry', answer:'The retry ceiling is three attempts because the previous five-retry policy amplified traffic during an upstream provider slowdown. The current decision adds exponential backoff and jitter, and limits retries to transient failures.', rationale:'The incident record links synchronized retries to provider rate-limit pressure. PR #421 then lowered the ceiling and added jitter. The older five-attempt decision is explicitly marked superseded in this sample graph.', evidence:['d_retry','incident_retry','pr_retry','commit_retry','doc_retry','d_retry_old','file_retry','person_maya'] },
  { pattern:/migration|migrat|legacy auth|adapter|webhook/i, decision:'d_auth', answer:'The authentication migration was deferred because partner webhook v2 was a dependency. The team wanted the new webhook flow deployed and verified before removing the legacy adapter, reducing the chance of split authentication behavior.', rationale:'The decision record and PR discussion both point to webhook v2 adoption and a rollback/verification window as gating conditions.', evidence:['d_auth','pr_auth','file_auth','person_eli'] },
  { pattern:/cache|stale|ttl|product data/i, decision:'d_cache', answer:'The system now invalidates the affected product cache key after a successful write instead of relying only on TTL expiry. TTL remains as a fallback.', rationale:'Issue #302 described stale product data immediately after updates. The newer decision explicitly supersedes the older TTL-only approach.', evidence:['d_cache','issue_cache','file_cache','person_priya','d_cache_old'] }
];
function answerQuestion(question) {
  const q = String(question||'').trim();
  if (!q) return { supported:false, confidence:0, message:'Enter a question about a code path, configuration, migration, incident, or engineering decision.' };
  if (store.mode==='demo') {
    const match = demoAnswers.find(a=>a.pattern.test(q));
    if (!match) return { supported:false, confidence:0, message:'I can’t substantiate that from the current graph. This demo graph only contains the retry-policy, auth-migration, and cache-invalidation examples. Connect a public repository to query its indexed history.', reason:'No decision node has enough matching evidence.', sourcesSearched:store.graph.nodes.length, sourceMode:'illustrative demo' };
    const nodes = store.graph.nodes;
    const decision = nodes.find(n=>n.id===match.decision);
    const chain = match.evidence.map(id=>nodes.find(n=>n.id===id)).filter(Boolean).map(n=>({id:n.id,type:n.type,title:n.title||n.label,label:n.sourceLabel||n.subtitle||n.type,date:n.date||'',author:n.author||'',excerpt:n.sourceExcerpt||n.body||'',url:n.url||'',status:n.status||'',confidence:n.confidence||null}));
    const supersedes = chain.find(n=>n.id==='d_retry_old'||n.id==='d_cache_old');
    return { supported:true, answer:match.answer, rationale:match.rationale, confidence:decision.confidence||0.9, decision, chain, supersession:supersedes?{old:supersedes.title,current:decision.title,oldId:supersedes.id}:null, sourceMode:'illustrative demo' };
  }
  const ts = tokens(q);
  if (!ts.length) return { supported:false, confidence:0, message:'Add a specific topic, file name, configuration key, incident, or decision term to make the query searchable.' };
  const nodes = store.graph.nodes;
  const decisions = nodes.filter(n=>n.type==='decision');
  const scored = decisions.map(n=>{
    const relatedIds = store.graph.edges.filter(e=>e.source===n.id||e.target===n.id).map(e=>e.source===n.id?e.target:e.source);
    const related = relatedIds.map(id=>nodes.find(x=>x.id===id)).filter(Boolean);
    const blob = `${n.title} ${n.label} ${n.body} ${n.rationale||''} ${related.map(x=>`${x.title} ${x.label} ${x.body}`).join(' ')}`.toLowerCase();
    const hits = ts.filter(t=>blob.includes(t));
    const uniqueHits = unique(hits);
    const score = uniqueHits.length / Math.max(1,ts.length);
    const evidence = related.filter(x=>['commit','pull_request','issue','incident','discussion','document'].includes(x.type));
    return {n, score, hits:uniqueHits, evidence, related};
  }).sort((a,b)=>b.score-a.score);
  const best = scored[0];
  if (!best || best.score < 0.28 || best.evidence.length===0) return { supported:false, confidence:0, message:'I can’t substantiate an answer from the indexed evidence. No decision has enough direct source links for this question, so I won’t infer intent from code alone.', reason:'Evidence threshold not met.', sourcesSearched:nodes.length, sourceMode:'live repository index' };
  const decision = best.n;
  const confidence = Math.min(0.92, Math.max(0.52, 0.48 + best.score*0.35 + Math.min(best.evidence.length,3)*0.06));
  const currentReplacement = decision.supersededBy ? nodes.find(n=>n.id===decision.supersededBy) : null;
  const evidenceNodes = [decision, ...best.evidence.slice(0,4), ...(currentReplacement?[currentReplacement]:[])];
  const chain = unique(evidenceNodes.map(n=>n.id)).map(id=>nodes.find(n=>n.id===id)).filter(Boolean).map(n=>({id:n.id,type:n.type,title:n.title||n.label,label:n.sourceLabel||n.subtitle||n.type,date:n.date||'',author:n.author||'',excerpt:n.sourceExcerpt||n.body||'',url:n.url||'',status:n.status||'',confidence:n.confidence||null}));
  const statusText = decision.status==='superseded' ? ` This record is marked superseded${currentReplacement?` by “${currentReplacement.title}”`:''}; use that later record as the current position.` : '';
  const answer = decision.rationale || compact(decision.body,600) || decision.title;
  return { supported:true, answer:`${answer}${statusText}`, rationale:`Matched ${best.hits.length} query terms and found ${best.evidence.length} linked source records. This is keyword-based evidence retrieval, not an LLM-generated causal explanation.`, confidence, decision, chain, supersession:decision.status==='superseded'?{old:decision.title,current:currentReplacement?.title||'No replacement identified',oldId:decision.id}:null, sourceMode:'live repository index' };
}

const server = http.createServer(async (req,res) => {
  if (req.method==='OPTIONS') return send(res,204,{});
  const parsedUrl = new URL(req.url, `http://${req.headers.host||'localhost'}`);
  if (parsedUrl.pathname==='/api/health' && req.method==='GET') return send(res,200,{ok:true,mode:store.mode,repo:store.repo.fullName,nodeCount:store.graph.nodes.length,edgeCount:store.graph.edges.length});
  if (parsedUrl.pathname==='/api/graph' && req.method==='GET') return send(res,200,{repo:store.repo,graph:store.graph,mode:store.mode,ingestLog:store.ingestLog});
  if (parsedUrl.pathname==='/api/ask' && req.method==='POST') {
    try { const body=await readBody(req); return send(res,200,answerQuestion(body.question)); }
    catch(e) { return send(res,400,{supported:false,message:e.message}); }
  }
  if (parsedUrl.pathname==='/api/ingest' && req.method==='POST') {
    try {
      const body=await readBody(req);
      const started=Date.now();
      const ingested=await ingestRepository(body.repoUrl||'');
      store.graph=ingested.graph; store.repo=ingested.repo; store.mode='live'; store.ingestedAt=new Date().toISOString();
      store.ingestLog.push({repo:store.repo.fullName,at:store.ingestedAt,nodeCount:store.graph.nodes.length,edgeCount:store.graph.edges.length});
      return send(res,200,{ok:true,repo:store.repo,graph:store.graph,mode:store.mode,elapsedMs:Date.now()-started,ingestion:store.graph.ingestion,notice:'Public GitHub history indexed. Decision nodes and supersession candidates use transparent heuristics; this prototype does not yet call Neo4j AuraDB or an LLM.'});
    } catch(e) { return send(res,e.status||400,{ok:false,error:e.message||'Ingestion failed',hint:'Check the public GitHub repository URL and try again.'}); }
  }
  let filePath = parsedUrl.pathname==='/' ? path.join(PUBLIC,'index.html') : path.join(PUBLIC,decodeURIComponent(parsedUrl.pathname));
  if (!filePath.startsWith(PUBLIC)) return send(res,403,'Forbidden','text/plain; charset=utf-8');
  fs.readFile(filePath,(err,content)=>{
    if (err) return send(res,404,'Not found','text/plain; charset=utf-8');
    send(res,200,content,MIME[path.extname(filePath)]||'application/octet-stream');
  });
});
server.listen(PORT,()=>console.log(`Why Code prototype running at http://localhost:${PORT}`));
