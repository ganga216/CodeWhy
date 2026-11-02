'use strict';

const $ = (selector, root=document) => root.querySelector(selector);
const $$ = (selector, root=document) => Array.from(root.querySelectorAll(selector));
const state = { repo:null, graph:{nodes:[],edges:[],source:'demo'}, mode:'demo', answer:null, activeQuestion:'Why is the retry limit set to three?', activeDecisionId:'d_retry', view:'ask', inspectedNodeId:null, showFullGraph:false, busy:false };

function esc(value='') { return String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])); }
function shortDate(value) { if (!value) return 'Date not recorded'; const d = new Date(value); if (Number.isNaN(d.getTime())) return String(value).slice(0,10); return d.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}); }
function relativeDate(value) { if (!value) return 'Not recorded'; const ms=Date.now()-new Date(value).getTime(); if (!Number.isFinite(ms)||ms<0) return 'Just now'; const days=Math.floor(ms/86400000); if (days===0) return 'Today'; if(days===1)return 'Yesterday'; if(days<30)return `${days} days ago`; if(days<365)return `${Math.floor(days/30)} months ago`; return `${Math.floor(days/365)}y ago`; }
function iconFor(type) { return ({decision:'◇',repository:'▱',incident:'!',issue:'!',pull_request:'⇧',commit:'⌘',code:'{}',person:'●',document:'≡',discussion:'↳'})[type] || '•'; }
function typeLabel(type) { return ({decision:'Decision',repository:'Repository',incident:'Incident',issue:'Issue',pull_request:'Pull request',commit:'Commit',code:'Code entity',person:'Contributor',document:'Design document',discussion:'Discussion'})[type] || 'Evidence'; }
function getNode(id) { return state.graph.nodes.find(n=>n.id===id); }
function decisionNodes() { return state.graph.nodes.filter(n=>n.type==='decision'); }
function nodeNeighbors(id) { const ids = state.graph.edges.filter(e=>e.source===id||e.target===id).map(e=>e.source===id?e.target:e.source); return [...new Set(ids)].map(getNode).filter(Boolean); }
function isDemo() { return state.mode==='demo'; }

async function api(path, body) {
  const options = body ? {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)} : {};
  const r = await fetch(path, options);
  const data = await r.json().catch(()=>({}));
  if (!r.ok) throw new Error(data.error || data.message || `Request failed (${r.status})`);
  return data;
}

function setRepoHeader() {
  const repo=state.repo||{};
  const name=repo.name||'payments-platform';
  $('#sidebarRepoName').textContent=name;
  $('#sidebarRepoOwner').textContent=repo.mode==='live' ? (repo.owner||repo.fullName?.split('/')[0]||'GitHub')+' / live index' : 'acme / sample workspace';
  $('#repoAvatar').textContent=(name[0]||'R').toUpperCase();
  $('#breadcrumbRepo').textContent=name.toUpperCase();
  $('#repoModeChip').textContent=isDemo()?'DEMO GRAPH':'LIVE GITHUB INDEX';
  $('#sidebarStatus').textContent=isDemo()?'Illustrative sample data':'Public GitHub data';
  $('#indexStatus').textContent=isDemo()?'Graph indexed':'Live index ready';
  $('#lastIndexed').textContent=isDemo()?'Just now':relativeDate(state.repo?.lastIndexed);
  $('#footerMode').textContent=isDemo()?'Demo data is illustrative · connect a public repo for live indexing':'Live GitHub history · heuristic evidence extraction · AuraDB/GraphRAG not connected';
}
function renderStats() {
  const nodes=state.graph.nodes||[]; const edges=state.graph.edges||[];
  const decisions=nodes.filter(n=>n.type==='decision');
  const superseded=decisions.filter(n=>n.status==='superseded').length;
  $('#metricDecisions').textContent=String(decisions.length).padStart(2,'0');
  $('#metricEdges').textContent=String(edges.length).padStart(2,'0');
  $('#metricSuperseded').textContent=String(superseded).padStart(2,'0');
  $('#graphCount').textContent=`${nodes.length} nodes`;
  if (!state.answer?.decision && decisions.length) state.activeDecisionId=decisions.find(n=>n.status!=='superseded')?.id||decisions[0].id;
}

function edgeTouches(edge,id) { return edge.source===id || edge.target===id; }
function getVisibleGraphNodes() {
  const all=state.graph.nodes; const edges=state.graph.edges;
  if (state.showFullGraph || state.view==='graph') {
    const selected = new Set();
    const priority = ['repository','decision','incident','pull_request','issue','document','code','commit','discussion','person'];
    for (const t of priority) for (const n of all.filter(x=>x.type===t)) { if (selected.size<21) selected.add(n.id); }
    const selectedNodes=all.filter(n=>selected.has(n.id));
    return {nodes:selectedNodes,edges:edges.filter(e=>selected.has(e.source)&&selected.has(e.target)),full:true};
  }
  const focusId=state.answer?.decision?.id || state.activeDecisionId || decisionNodes()[0]?.id;
  const focus=getNode(focusId);
  if (!focus) return {nodes:all.slice(0,12),edges:edges.slice(0,10),full:false};
  const selected=new Set([focusId]);
  for (const e of edges) if (edgeTouches(e,focusId)) selected.add(e.source===focusId?e.target:e.source);
  // Show source authors and commit/file context one hop beyond the decision's direct links.
  for (const id of [...selected]) {
    const n=getNode(id);
    if (!n) continue;
    if (['pull_request','incident','issue','commit','document'].includes(n.type)) {
      for (const e of edges) if (edgeTouches(e,id)) { const other=getNode(e.source===id?e.target:e.source); if (other && ['person','code','commit'].includes(other.type)) selected.add(other.id); }
    }
  }
  const nodes=all.filter(n=>selected.has(n.id)).slice(0,13);
  const ids=new Set(nodes.map(n=>n.id));
  return {nodes,edges:edges.filter(e=>ids.has(e.source)&&ids.has(e.target)),full:false};
}
function getPositions(nodes) {
  const positions={};
  const focusId=state.answer?.decision?.id || state.activeDecisionId;
  const focusNode=nodes.find(n=>n.id===focusId) || nodes.find(n=>n.type==='decision') || nodes[0];
  positions[focusNode?.id]={x:410,y:230};
  const slots={
    repository:[[410,62],[410,72]], incident:[[155,145],[145,265]], issue:[[155,145],[145,265]],
    pull_request:[[650,115],[650,225]], commit:[[660,315],[570,390]], document:[[155,345],[250,390]],
    code:[[410,405],[275,400]], person:[[700,400],[720,300]], discussion:[[505,355],[260,250]], decision:[[160,72],[660,65],[710,190]]
  };
  const counters={};
  for (const n of nodes) {
    if (n.id===focusNode?.id) continue;
    const type=n.type||'issue'; const count=counters[type]||0; counters[type]=count+1;
    const options=slots[type]||[[180+((count*127)%450),105+((count*61)%270)]];
    let point=options[count%options.length];
    // Spread multiple nodes of one type vertically instead of overlapping them.
    if (count>=options.length) point=[Math.max(75,Math.min(745,point[0]+(count%2?24:-24))),Math.max(45,Math.min(425,point[1]+Math.floor(count/options.length)*40))];
    positions[n.id]={x:point[0],y:point[1]};
  }
  return positions;
}
function svgSafeLabel(v) { return esc(String(v||'')).replace(/\n/g,' '); }
function renderGraph() {
  const svg=$('#graphSvg'); if (!svg) return;
  const {nodes,edges,full}=getVisibleGraphNodes();
  if (!nodes.length) { svg.innerHTML='<text x="410" y="230" text-anchor="middle" fill="#8292a5">No graph nodes available.</text>'; return; }
  const focusId=state.answer?.decision?.id || state.activeDecisionId;
  // Keep the focused node in scope for the graph footer. Previously this was
  // referenced below without being declared, which threw a ReferenceError
  // during startup before the dashboard's global button handlers were wired.
  const focusNode=nodes.find(n=>n.id===focusId) || nodes.find(n=>n.type==='decision') || nodes[0];
  const positions=getPositions(nodes);
  let defs='<defs><marker id="edgeArrow" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#5c7181"/></marker><filter id="softGlow" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="5" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>';
  let edgeMarkup='';
  for (const e of edges) {
    const a=positions[e.source],b=positions[e.target]; if (!a||!b) continue;
    const midX=(a.x+b.x)/2, midY=(a.y+b.y)/2;
    const sx=a.x, sy=a.y, tx=b.x, ty=b.y;
    const mx=(sx+tx)/2 + ((sy===ty)?0:((ty-sy)>0?7:-7)); const my=(sy+ty)/2;
    const cls=e.type==='supersedes'?'edge supersedes':'edge';
    edgeMarkup+=`<g><path class="${cls}" d="M ${sx} ${sy} Q ${mx} ${my} ${tx} ${ty}" marker-end="url(#edgeArrow)"/><title>${svgSafeLabel(e.label||'related')}</title></g>`;
    if (nodes.length<10 && e.label && (e.source===focusId || e.target===focusId)) edgeMarkup+=`<text class="edge-label" x="${midX}" y="${midY-5}">${svgSafeLabel(e.label)}</text>`;
  }
  let nodeMarkup='';
  for (const n of nodes) {
    const p=positions[n.id]; if (!p) continue;
    const type=n.type||'issue';
    const groupClass=[type==='decision'?'decision':['incident','issue','pull_request','commit','document','discussion','repository'].includes(type)?'source':type==='code'?'code':type==='person'?'person':'',n.status==='superseded'?'superseded':'',n.id===focusId?'selected':''].filter(Boolean).join(' ');
    let label=n.label||n.title||n.id; if (label.length>23) label=label.slice(0,21)+'…';
    let sub=n.subtitle||typeLabel(type); if (sub.length>22) sub=sub.slice(0,20)+'…';
    const radius=n.id===focusId?24:18;
    nodeMarkup+=`<g class="node ${groupClass}" data-node-id="${esc(n.id)}" tabindex="0" role="button" aria-label="Inspect ${svgSafeLabel(n.title||label)}"><circle class="node-ring" cx="${p.x}" cy="${p.y}" r="${radius}"/><text class="node-icon" x="${p.x}" y="${p.y}">${iconFor(type)}</text><text class="node-label" x="${p.x}" y="${p.y+radius+15}">${svgSafeLabel(label)}</text><text class="node-sub" x="${p.x}" y="${p.y+radius+27}">${svgSafeLabel(sub)}</text></g>`;
  }
  svg.innerHTML=defs+edgeMarkup+nodeMarkup;
  $$('.node',svg).forEach(g=>{
    const open=()=>inspectNode(g.getAttribute('data-node-id'));
    g.addEventListener('click',open);
    g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open();}});
  });
  $('#graphFocusLabel').textContent=focusNode?.title ? focusNode.title.slice(0,42) : 'Current decision';
  $('#graphFocusHint').textContent=full?`— showing ${nodes.length} graph nodes`:`is connected to ${Math.max(0,nodes.length-1)} nearby nodes`;
  $('#showAllNodesBtn').innerHTML=state.showFullGraph||state.view==='graph'?'Show focused graph <span>→</span>':'Show full graph <span>→</span>';
}

function renderActivity() {
  const events=state.graph.nodes.filter(n=>['decision','incident','issue','pull_request','commit','document'].includes(n.type)).sort((a,b)=>new Date(b.date||0)-new Date(a.date||0)).slice(0,5);
  $('#activityList').innerHTML=events.map((n,i)=>`<div class="activity-item" style="animation-delay:${i*45}ms"><div class="activity-marker ${esc(n.type)}">${iconFor(n.type)}</div><div class="activity-item-text"><strong>${esc(n.title||n.label)}</strong><small>${esc(typeLabel(n.type))}${n.author?' · '+esc(n.author):''}${n.status==='superseded'?' · Superseded':''}</small></div><span class="activity-date">${esc(n.date?shortDate(n.date):'—')}</span></div>`).join('')||'<div class="empty-evidence">No dated source records found in this index.</div>';
}
function evidenceTypeIcon(type){return iconFor(type);}
function renderAnswer(answer) {
  state.answer=answer;
  $('#answerPanelTitle').textContent=answer===null?'Ready when you are':answer.supported?'Here’s why.':'Not enough evidence.';
  const stateEl=$('#answerState');
  if(answer===null){ stateEl.textContent='READY';stateEl.classList.remove('refused');$('#answerBody').innerHTML='<div class="answer-empty"><div class="answer-empty-icon">⌕</div><strong>Ask a question worth tracing.</strong><p>CodeWhy will connect a decision to the discussion, contributor, date, and code entity behind it.</p><div class="answer-small-note">Every claim should have a source. No source, no confident answer.</div></div>'; $('#trustRows').innerHTML=trustMarkup(0); renderGraph(); return; }
  if(!answer.supported){
    stateEl.textContent='REFUSED';stateEl.classList.add('refused');
    $('#answerBody').innerHTML=`<div class="question-echo">QUESTION · ${esc(state.activeQuestion)}</div><div class="refusal-card"><strong>There isn’t enough evidence to answer this responsibly.</strong><p>${esc(answer.message||'No decision node has enough linked evidence for this question.')}</p><div class="refusal-reason">${esc(answer.reason||'Evidence threshold not met.')}</div></div><div class="confidence-rail"><div class="confidence-ring" style="--progress:0%"><span>—</span></div><div class="confidence-copy"><strong>No grounded answer returned</strong><small>${Number(answer.sourcesSearched||state.graph.nodes.length)} records checked · answer withheld rather than invented.</small></div></div><div class="evidence-heading"><strong>WHAT THE GRAPH CAN SUPPORT</strong><span>TRY A DIFFERENT QUERY</span></div><div class="empty-evidence">Ask about a term, file, incident, migration, configuration or decision that appears in the indexed sources.</div>`;
    $('#trustRows').innerHTML=trustMarkup(0); renderGraph(); return;
  }
  stateEl.textContent='SUPPORTED';stateEl.classList.remove('refused');
  const d=answer.decision||{}; state.activeDecisionId=d.id||state.activeDecisionId;
  const confidence=Math.round((answer.confidence||0)*100); const status=d.status||'supported';
  const statusClass=status==='superseded'?'superseded-state':'active-state';
  const statusLabel=status==='superseded'?'SUPERSEDED':status==='active'?'ACTIVE DECISION':status.toUpperCase();
  const meta=`<div class="decision-meta"><span class="${statusClass}">${esc(statusLabel)}</span><span>${esc(d.date?shortDate(d.date):'Date not recorded')}</span>${d.author?`<span>OWNER · ${esc(d.author)}</span>`:''}</div>`;
  let supersession='';
  if(answer.supersession){supersession=`<div class="supersession-alert"><span class="supersession-icon">↻</span><div><strong>Supersession detected</strong><p>Earlier record “${esc(answer.supersession.old||'previous decision')}” was replaced by the current decision. The older reasoning is retained as context, not treated as current policy.</p></div></div>`;}
  else if(status==='superseded'){supersession=`<div class="supersession-alert"><span class="supersession-icon">↻</span><div><strong>This decision is not current</strong><p>${esc(answer.supersession?.current||'A later change may have replaced this record. Inspect linked evidence before relying on it.')}</p></div></div>`;}
  const evidence=(answer.chain||[]).filter(n=>n.id!==d.id).slice(0,5);
  const evidenceHtml=evidence.length?evidence.map((n,i)=>`<button type="button" class="evidence-item" data-inspect-id="${esc(n.id)}"><span class="evidence-type-icon ${esc(n.type)}">${evidenceTypeIcon(n.type)}</span><span class="evidence-item-copy"><strong>${esc(n.title||n.label||typeLabel(n.type))}</strong><small>${esc(n.label||typeLabel(n.type))}${n.date?' · '+esc(shortDate(n.date)):''}${n.author?' · '+esc(n.author):''}</small></span><span class="evidence-arrow">↗</span></button>`).join(''):'<div class="empty-evidence">No source records were linked directly to this decision.</div>';
  $('#answerBody').innerHTML=`<div class="question-echo">QUESTION · ${esc(state.activeQuestion)}</div><p class="answer-copy">${esc(answer.answer||d.title||'Evidence found, but no concise summary is available.')}</p><div class="decision-callout"><div class="callout-kicker">CURRENT REASONING RECORD</div><strong>${esc(d.title||d.label||'Decision candidate')}</strong>${meta}</div>${supersession}<p class="answer-rationale">${esc(answer.rationale||'This answer was assembled from linked evidence records.')}</p><div class="confidence-rail"><div class="confidence-ring" style="--progress:${confidence}%"><span>${confidence}%</span></div><div class="confidence-copy"><strong>${confidence>=80?'Strong evidence coverage':confidence>=60?'Moderate evidence coverage':'Limited evidence coverage'}</strong><small>Confidence uses source coverage and linkage; it is not a guarantee of truth.</small></div></div><div class="evidence-heading"><strong>EVIDENCE CHAIN</strong><span>${evidence.length} LINKED RECORD${evidence.length===1?'':'S'}</span></div><div class="evidence-list">${evidenceHtml}</div>`;
  $('#trustRows').innerHTML=trustMarkup(confidence);
  $$('[data-inspect-id]', $('#answerBody')).forEach(b=>b.addEventListener('click',()=>inspectNode(b.getAttribute('data-inspect-id'))));
  renderGraph();
}
function trustMarkup(confidence) {
  if (!confidence) return `<div class="trust-row"><span>Source traceability</span><div class="trust-track"><i style="width:0%"></i></div><b>—</b></div><div class="trust-row"><span>Decision recency</span><div class="trust-track"><i style="width:0%"></i></div><b>—</b></div><div class="trust-row"><span>Supersession check</span><div class="trust-track"><i style="width:0%"></i></div><b>Pending</b></div>`;
  const recency=state.answer?.decision?.date?Math.max(35,100-Math.min(65,(Date.now()-new Date(state.answer.decision.date).getTime())/(86400000*18))):45;
  const superseded=state.answer?.supersession||state.answer?.decision?.status==='superseded';
  return `<div class="trust-row"><span>Source traceability</span><div class="trust-track"><i style="width:${Math.min(100,confidence+3)}%"></i></div><b>${Math.min(100,confidence+3)}%</b></div><div class="trust-row"><span>Decision recency</span><div class="trust-track"><i style="width:${Math.round(recency)}%"></i></div><b>${Math.round(recency)}%</b></div><div class="trust-row"><span>Supersession check</span><div class="trust-track"><i style="width:100%"></i></div><b>${superseded?'Found':'Done'}</b></div>`;
}
function renderInspector(nodeId) {
  const node=getNode(nodeId); if(!node)return;
  state.inspectedNodeId=nodeId;
  const neighbors=nodeNeighbors(nodeId);
  $('#answerPanelTitle').textContent='Node details'; $('#answerState').textContent='INSPECTING';$('#answerState').classList.remove('refused');
  const body=esc(node.body||node.rationale||'No additional description was recorded for this node.');
  const title=esc(node.title||node.label||node.id);
  const stateMeta=node.status?`<span class="${node.status==='superseded'?'superseded-state':'active-state'}">${esc(node.status.toUpperCase())}</span>`:'';
  const link=node.url?`<a class="source-link" href="${esc(node.url)}" target="_blank" rel="noopener noreferrer">Open source record <span>↗</span></a>`:'';
  const neighborHtml=neighbors.slice(0,7).map(n=>`<button type="button" class="evidence-item" data-inspect-id="${esc(n.id)}"><span class="evidence-type-icon ${esc(n.type)}">${iconFor(n.type)}</span><span class="evidence-item-copy"><strong>${esc(n.title||n.label)}</strong><small>${esc(typeLabel(n.type))}${n.date?' · '+esc(shortDate(n.date)):''}</small></span><span class="evidence-arrow">↗</span></button>`).join('');
  $('#answerBody').innerHTML=`<button class="back-to-answer" type="button" data-action="back-answer">← Return to answer</button><div class="inspect-node-type">${iconFor(node.type)} <span>${esc(typeLabel(node.type))}</span> ${stateMeta}</div><h3 class="inspect-title">${title}</h3><div class="inspect-meta">${node.date?`<span>${esc(shortDate(node.date))}</span>`:''}${node.author?`<span>BY ${esc(node.author)}</span>`:''}</div><p class="answer-copy inspect-body">${body}</p>${node.rationale?`<div class="answer-rationale">${esc(node.rationale)}</div>`:''}${link}<div class="evidence-heading"><strong>CONNECTED NODES</strong><span>${neighbors.length} RELATIONSHIPS</span></div><div class="evidence-list">${neighborHtml||'<div class="empty-evidence">No connected nodes found.</div>'}</div><div class="inspect-footer-note">A node is only as reliable as its source records. Open the source before making a production decision.</div>`;
  $$('[data-inspect-id]', $('#answerBody')).forEach(b=>b.addEventListener('click',()=>inspectNode(b.getAttribute('data-inspect-id'))));
  $('[data-action="back-answer"]',$('#answerBody')).addEventListener('click',()=>{state.inspectedNodeId=null;renderAnswer(state.answer);});
}
function inspectNode(nodeId) { renderInspector(nodeId); }

function renderView() {
  const body=$('#primaryBody');
  if (state.view==='ask'||state.view==='graph') {
    if (!$('#graphSvg',body)) body.innerHTML=`<div class="graph-legend"><span><i class="legend-dot decision-dot"></i>Decision</span><span><i class="legend-dot source-dot"></i>Source</span><span><i class="legend-dot code-dot"></i>Code entity</span><span><i class="legend-dot person-dot"></i>Person</span><div class="legend-spacer"></div><span class="graph-live"><i></i> RELATIONSHIPS</span></div><div id="graphCanvasWrap" class="graph-canvas-wrap"><div class="graph-grid-bg"></div><svg id="graphSvg" class="graph-svg" viewBox="0 0 820 470" role="img" aria-label="Interactive decision evidence graph"></svg><div class="graph-hint"><span>↖</span> Select any node to inspect its evidence</div><div id="graphLoading" class="graph-loading hidden"><span class="loader-ring"></span> Rebuilding evidence graph…</div></div><div class="graph-footer"><span><i class="mini-circle"></i><strong id="graphFocusLabel">Current decision</strong> <span id="graphFocusHint">linked source records</span></span><button type="button" id="showAllNodesBtn">Show full graph <span>→</span></button></div>`;
    $('#primaryKicker').textContent=state.view==='graph'?'EXPLORE RELATIONSHIPS':'RELATIONSHIP MAP';
    $('#primaryTitle').innerHTML=state.view==='graph'?'Explore the decision graph <span class="count-pill" id="graphCount">'+state.graph.nodes.length+' nodes</span>':'Decision graph <span class="count-pill" id="graphCount">'+state.graph.nodes.length+' nodes</span>';
    $('#primaryDescription').textContent=state.view==='graph'?'Select any node to inspect provenance, relationships, and the records behind it.':'Follow the reasoning from decision → discussion → code.';
    $('#focusGraphBtn').innerHTML=state.view==='graph'?'Return to focused view <span>↙</span>':'Focus graph <span>↗</span>';
    $('#expandGraphBtn').classList.remove('hidden');
    const showAll=$('#showAllNodesBtn'); if(showAll) showAll.onclick=()=>{state.showFullGraph=!state.showFullGraph;state.view=state.showFullGraph?'graph':'ask';setActiveNav();renderView();};
    const expand=$('#expandGraphBtn'); if(expand) expand.onclick=()=>$('#primaryPanel').classList.toggle('expanded');
    renderGraph(); return;
  }
  $('#expandGraphBtn').classList.add('hidden');
  $('#focusGraphBtn').innerHTML='Return to graph <span>↗</span>';
  if (state.view==='timeline') {
    $('#primaryKicker').textContent='DECISION HISTORY';$('#primaryTitle').innerHTML='What changed, and when? <span class="count-pill">chronological</span>';$('#primaryDescription').textContent='Review the records that shaped current behavior, including older decisions later replaced.';
    const items=state.graph.nodes.filter(n=>['decision','incident','issue','pull_request','commit','document','discussion'].includes(n.type)).sort((a,b)=>new Date(b.date||0)-new Date(a.date||0));
    body.innerHTML=`<div class="view-list">${items.slice(0,20).map(n=>`<div class="view-row"><span class="view-icon ${esc(n.type)}">${iconFor(n.type)}</span><span><strong>${esc(n.title||n.label)}</strong><small>${esc(typeLabel(n.type))}${n.author?' · '+esc(n.author):''}${n.status==='superseded'?' · Superseded by later decision':''}</small></span><span class="view-meta">${esc(n.date?shortDate(n.date):'—')}</span></div>`).join('')||'<div class="empty-evidence">No dated history was found.</div>'}</div>`;
  } else if (state.view==='people') {
    $('#primaryKicker').textContent='HUMAN CONTEXT';$('#primaryTitle').innerHTML='People & decision owners <span class="count-pill">contributors</span>';$('#primaryDescription').textContent='Find who authored or discussed the source records linked to each decision.';
    const people=state.graph.nodes.filter(n=>n.type==='person');
    body.innerHTML=`<div class="people-list">${people.map(p=>{const related=state.graph.edges.filter(e=>e.source===p.id||e.target===p.id).length;const authored=decisionNodes().filter(d=>d.author===p.label||d.author===p.title).length;return `<div class="person-card"><div class="person-head"><span class="person-avatar">${esc((p.label||'?').split(/[ ._-]/).map(s=>s[0]||'').join('').slice(0,2).toUpperCase())}</span><span><strong>${esc(p.title||p.label)}</strong><small>${related} linked relationships</small></span></div><p>${authored?`${authored} decision record(s) attributed in this graph.`:'Contributor connected to commits or discussions. Decision ownership is not inferred without a source.'}</p><button type="button" data-inspect-id="${esc(p.id)}">Inspect contributor ↗</button></div>`}).join('')||'<div class="empty-evidence">No contributor nodes found in this index.</div>'}</div>`;
    $$('[data-inspect-id]',body).forEach(b=>b.addEventListener('click',()=>inspectNode(b.dataset.inspectId)));
  } else if (state.view==='repository') {
    const r=state.repo||{}; const nodeCount=state.graph.nodes.length; const edges=state.graph.edges.length;const commits=state.graph.nodes.filter(n=>n.type==='commit').length;const prs=state.graph.nodes.filter(n=>n.type==='pull_request').length;const issues=state.graph.nodes.filter(n=>n.type==='issue'||n.type==='incident').length;const docs=state.graph.nodes.filter(n=>n.type==='document').length;
    $('#primaryKicker').textContent='REPOSITORY INDEX';$('#primaryTitle').innerHTML=`Repository overview <span class="count-pill">${esc(r.mode==='live'?'live':'demo')}</span>`;$('#primaryDescription').textContent='Index status, source coverage, and the provenance boundary for this workspace.';
    body.innerHTML=`<div class="repository-summary"><div class="repo-summary-hero"><div class="repo-summary-logo">${esc((r.name||'R')[0].toUpperCase())}</div><div><h3>${esc(r.fullName||'acme/payments-platform')}</h3><p>${esc(r.description||'Illustrative sample repository')}<br>${r.url?`<a href="${esc(r.url)}" target="_blank" rel="noopener noreferrer" class="inline-link">Open repository ↗</a>`:''}</p></div></div><div class="summary-grid"><div class="summary-box"><span>GRAPH NODES</span><strong>${nodeCount}</strong><small>All indexed entity types</small></div><div class="summary-box"><span>RELATIONSHIPS</span><strong>${edges}</strong><small>Linked provenance paths</small></div><div class="summary-box"><span>COMMITS</span><strong>${commits}</strong><small>Available commit records</small></div><div class="summary-box"><span>ISSUES / PULL REQUESTS</span><strong>${issues} / ${prs}</strong><small>Source discussions</small></div></div><div class="repo-note">${isDemo()?'Illustrative demo graph. These people, incidents, decisions, dates, and file paths are sample content for demonstrating the workflow; they are not factual claims about a real repository.':'Live public GitHub metadata. Decision extraction and supersession detection are heuristic candidates that should be reviewed; Neo4j AuraDB and LLM GraphRAG are not connected in this build.'}</div><div class="repo-actions"><button type="button" class="outline-button" id="repoInspectConnect">Connect another repository ↗</button>${r.url?`<a class="outline-button" target="_blank" rel="noopener noreferrer" href="${esc(r.url)}">Open on GitHub ↗</a>`:''}</div></div>`;
    $('#repoInspectConnect').addEventListener('click',openRepoModal);
  }
}
function setActiveNav() { $$('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.view===state.view)); }
function switchView(view) {
  state.view=view; state.inspectedNodeId=null; state.showFullGraph=view==='graph'; setActiveNav();
  const titles={ask:['Understand <em>why</em> the code is like this.','The reasoning behind your codebase, reconstructed from the history that shaped it.'],graph:['See the connections behind the code.','Explore how decisions, discussions, people, and code entities connect.'],timeline:['Every decision has a history.','Trace what changed, when it changed, and which old assumptions were replaced.'],people:['Find the people behind the reasoning.','Follow source authors and decision owners without guessing who knows what.'],repository:['One codebase. Its full context.','Review the indexed sources, graph coverage, and evidence boundaries.']};
  $('#pageTitle').innerHTML=titles[view][0]; $('#pageSubtitle').textContent=titles[view][1];
  renderView();
}
async function ask(question) {
  if (state.busy) return;
  const q=String(question||'').trim(); if(!q)return;
  state.activeQuestion=q; $('#questionInput').value=q; $('#askSubmit').disabled=true; $('#askSubmit').innerHTML='Tracing… <span class="loader-ring" style="width:11px;height:11px;border-width:1.5px;vertical-align:-2px"></span>';
  $('#answerPanelTitle').textContent='Tracing the evidence…';$('#answerState').textContent='SEARCHING';$('#answerState').classList.remove('refused');
  $('#answerBody').innerHTML='<div class="answer-placeholder"><span class="loader-ring"></span><p>Following decision → discussion → code…</p></div>';
  try { const answer=await api('/api/ask',{question:q}); state.inspectedNodeId=null; renderAnswer(answer); if(state.view==='timeline'||state.view==='people'||state.view==='repository') { state.view='ask';setActiveNav();switchView('ask');renderAnswer(answer); } }
  catch(e) { renderAnswer({supported:false,message:`The evidence service could not be reached: ${e.message}`,reason:'API request failed.'}); }
  finally { $('#askSubmit').disabled=false;$('#askSubmit').innerHTML='Ask CodeWhy <span>↗</span>'; }
}
function openRepoModal(){ $('#repoModal').classList.remove('hidden'); $('#ingestError').classList.add('hidden'); $('#repoUrlInput').focus(); }
function closeRepoModal(){ $('#repoModal').classList.add('hidden'); }
function setStep(index,status){const el=$(`.ingest-step[data-step="${index}"]`);if(el){el.classList.remove('running','done');if(status)el.classList.add(status);}}
function showToast(message){const t=$('#toast');t.textContent=message;t.classList.add('show');clearTimeout(showToast.timer);showToast.timer=setTimeout(()=>t.classList.remove('show'),3400);}
async function ingestRepository(event){
  event.preventDefault(); if(state.busy)return;
  const repoUrl=$('#repoUrlInput').value.trim(); if(!repoUrl)return;
  state.busy=true;$('#startIngestBtn').disabled=true;$('#startIngestBtn').innerHTML='Indexing history… <span class="loader-ring" style="width:13px;height:13px;border-width:1.5px"></span>';
  $('#ingestError').classList.add('hidden');[1,2,3].forEach(n=>setStep(n,''));setStep(1,'running');$('#graphLoading')?.classList.remove('hidden');
  const timers=[setTimeout(()=>{setStep(1,'done');setStep(2,'running');},700),setTimeout(()=>{setStep(2,'done');setStep(3,'running');},1800)];
  try {
    const result=await api('/api/ingest',{repoUrl});
    timers.forEach(clearTimeout);[1,2,3].forEach(n=>setStep(n,'done'));
    state.repo=result.repo;state.graph=result.graph;state.mode='live';state.answer=null;state.inspectedNodeId=null;state.activeDecisionId=decisionNodes().find(n=>n.status!=='superseded')?.id||decisionNodes()[0]?.id;state.showFullGraph=false;
    setRepoHeader();renderStats();renderActivity();switchView('graph');renderAnswer(null);closeRepoModal();
    showToast(`Indexed ${result.repo.fullName}: ${result.graph.nodes.length} nodes and ${result.graph.edges.length} relationships.`);
    if(result.notice) console.info(result.notice);
  } catch(e) {
    timers.forEach(clearTimeout);setStep(1,'');setStep(2,'');setStep(3,'');$('#ingestError').textContent=e.message||'Indexing failed. Please check the repository URL and try again.';$('#ingestError').classList.remove('hidden');
  } finally {
    state.busy=false;$('#startIngestBtn').disabled=false;$('#startIngestBtn').innerHTML='Index repository <span>→</span>';$('#graphLoading')?.classList.add('hidden');
  }
}
async function init(){
  // Wire persistent controls before first render. A rendering exception should
  // never leave navigation, question chips, and dialogs without click handlers.
  $('#askForm').addEventListener('submit',e=>{e.preventDefault();ask($('#questionInput').value);});
  $$('[data-question]').forEach(b=>b.addEventListener('click',()=>ask(b.dataset.question)));
  $$('.nav-item').forEach(b=>b.addEventListener('click',()=>switchView(b.dataset.view)));
  $$('[data-go-view]').forEach(b=>b.addEventListener('click',()=>switchView(b.dataset.goView)));
  $('#connectRepoBtn').addEventListener('click',openRepoModal);
  $('#sidebarRepoBtn').addEventListener('click',openRepoModal);
  $('#closeRepoModal').addEventListener('click',closeRepoModal);
  $('#repoModal').addEventListener('click',e=>{if(e.target===$('#repoModal'))closeRepoModal();});
  $('#repoForm').addEventListener('submit',ingestRepository);
  $('#aboutBtn').addEventListener('click',()=>$('#infoModal').classList.remove('hidden'));
  $('#closeInfoModal').addEventListener('click',()=>$('#infoModal').classList.add('hidden'));
  $('#closeInfoPrimary').addEventListener('click',()=>$('#infoModal').classList.add('hidden'));
  $('#infoModal').addEventListener('click',e=>{if(e.target===$('#infoModal'))$('#infoModal').classList.add('hidden');});
  $('#shortcutsBtn').addEventListener('click',()=>showToast('Shortcut: press / to focus the question box · Esc closes dialogs.'));
  $('#focusGraphBtn').addEventListener('click',()=>switchView(state.view==='graph'?'ask':'graph'));
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'){$('#repoModal').classList.add('hidden');$('#infoModal').classList.add('hidden');$('#primaryPanel').classList.remove('expanded');}
    if(e.key==='/'&&!e.ctrlKey&&!e.metaKey&&!['INPUT','TEXTAREA'].includes(document.activeElement.tagName)){e.preventDefault();$('#questionInput').focus();}
  });

  // Fetch the active graph after controls are ready, then paint the workspace.
  try {
    const data=await api('/api/graph');
    state.repo=data.repo;state.graph=data.graph;state.mode=data.mode||data.graph.source||'demo';
  } catch(e) {
    console.error('Could not load graph data:',e);
    showToast('Could not load graph data. Check that the CodeWhy server is running.');
  }
  setRepoHeader();renderStats();renderActivity();renderView();
  // Default answer is intentionally pre-filled so judges can immediately see the product's main interaction.
  await ask(state.activeQuestion);
}
init();
