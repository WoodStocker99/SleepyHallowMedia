// script.js — Sleepy Hollow Media (Magazine)
// Builds lead story, top stories, latest grid, sidebar latest, trending topics.
// Keeps your article rendering and newsletters list. Safe markdown + DOMPurify remain.

const MANIFEST = 'newsletters/index.json';
const NEWS_DIR = 'newsletters/';
const DEFAULT_THUMB = 'thumbnails/placeholder.png';
const HOMEPAGE_LATEST_LIMIT = 12;
const SIDEBAR_LATEST_LIMIT = 8;

// ---------- Utilities ----------
function escapeHtml(str){ if(str==null) return ''; return String(str).replace(/&/g,'&').replace(/</g,'<').replace(/>/g,'>').replace(/"/g,'"').replace(/'/g,'&#39;'); }
function sanitizeFilename(filename){
  if(!filename || typeof filename!=='string') return '';
  const normalized = filename.replace(/\\/g,'/').trim();
  if(normalized.includes('..') || normalized.startsWith('/') || normalized.startsWith('http:') || normalized.startsWith('https:')) return '';
  return normalized || '';
}
function parseFrontmatter(text){
  let src = String(text??'').replace(/\r/g,'').replace(/^\uFEFF/,'').replace(/^\s+/, '');
  if(!src.startsWith('---\n') && src!=='---'){ return {meta:{}, body:src.trim()}; }
  const lines = src.split('\n'); const meta={}; let i=1;
  for(; i<lines.length; i++){ const line=lines[i].trim(); if(line==='---'){ i++; break; } if(!line) continue;
    const m=line.match(/^([^:]+)\s*:\s*(.*)$/); if(m) meta[m[1].trim()]=m[2].trim(); }
  const body = lines.slice(i).join('\n').trim(); return {meta, body};
}
async function loadManifest(){
  try{ const res=await fetch(MANIFEST,{cache:'no-store'}); if(!res.ok) throw new Error('No manifest'); const data=await res.json(); return Array.isArray(data)?data.map(sanitizeFilename).filter(Boolean):[]; }
  catch(e){ console.warn('Manifest error', e); return []; }
}
async function loadNewsletter(filename){
  const f=sanitizeFilename(filename); if(!f) throw new Error('Bad filename');
  const res=await fetch(`${NEWS_DIR}${f}`, {cache:'no-store'}); if(!res.ok) throw new Error('Fetch fail');
  return parseFrontmatter(await res.text());
}
function formatDate(d){ if(!d) return ''; const x=new Date(d); return Number.isNaN(x.getTime())?'':x.toLocaleDateString(); }
function resolveThumbPath(t){ if(!t) return DEFAULT_THUMB; const s=String(t).trim(); if(/^(https?:)?\/\//i.test(s) || s.startsWith('/') || s.startsWith('thumbnails/') || s.startsWith('newsletters/')) return s; return s; }
function isTruthy(v){ if(v===true) return true; if(typeof v==='string') return /^(true|yes|1)$/i.test(v.trim()); if(typeof v==='number') return v!==0; return false; }

function renderMarkdownSafe(text){
  if(typeof window!=='undefined' && window.marked && window.DOMPurify){
    const raw = window.marked.parse(String(text??''));
    return window.DOMPurify.sanitize(raw, { ALLOWED_ATTR: ['href','src','alt','title','class'] });
  }
  // Paragraph fallback
  return String(text??'').split(/\n\s*\n/).map(p=>`<p>${escapeHtml(p.trim())}</p>`).join('');
}

// ---------- Common: current nav + mobile ----------
function markCurrentNav(){
  const file=(location.pathname.split('/').pop()||'index.html').toLowerCase();
  const map={ 'index.html':'home', 'newsletters.html':'newsletters' };
  const key=map[file];
  document.querySelectorAll(`[data-nav="${key}"]`).forEach(a=>a.setAttribute('aria-current','page'));
}
function initMobile(){
  const btn=document.querySelector('.nav-toggle'); const menu=document.getElementById('mobile-menu');
  if(btn && menu){ btn.addEventListener('click',()=>{ const open=menu.classList.toggle('active'); btn.setAttribute('aria-expanded', open?'true':'false'); }); }
}

// ---------- Data helpers ----------
async function loadVisibleSorted(){
  const manifest=await loadManifest(); if(!manifest.length) return [];
  const items=(await Promise.all(manifest.map(async f=>{
    try{ const {meta, body}=await loadNewsletter(f); return { file:f, meta, body }; }
    catch{ return null; }
  }))).filter(Boolean);
  const visible=items.filter(r=>!isTruthy(r.meta.Hidden));
  visible.sort((a,b)=>{
    const ad=a.meta.Date?new Date(a.meta.Date):null; const bd=b.meta.Date?new Date(b.meta.Date):null;
    const aOk=ad && !Number.isNaN(ad.getTime()); const bOk=bd && !Number.isNaN(bd.getTime());
    if(aOk && bOk) return bd-ad; if(aOk) return -1; if(bOk) return 1; return b.file.localeCompare(a.file);
  });
  return visible;
}

// ---------- Home: Lead + Top stories ----------
function leadCardTemplate(item){
  const {file, meta}=item;
  const title=meta.Title||file; const cat=meta.Category||''; const date=formatDate(meta.Date); const author=meta.Author||'Staff';
  const img=resolveThumbPath(meta.Thumbnail);
  return `
    <a class="lead-bg" href="article.html?article=${encodeURIComponent(file)}" style="background-image:url('${encodeURI(img)}')"></a>
    <div class="lead-body">
      ${cat?`<span class="kicker">${escapeHtml(cat)}</span>`:''}
      <h2 class="lead-title"><a href="article.html?article=${encodeURIComponent(file)}" style="color:#fff;text-decoration:none">${escapeHtml(title)}</a></h2>
      <div class="lead-meta">${escapeHtml(date)}${date?' • ':''}${escapeHtml(author)}</div>
    </div>
  `;
}
function topCardTemplate(item){
  const {file, meta}=item;
  const title=meta.Title||file; const img=resolveThumbPath(meta.Thumbnail);
  const date=formatDate(meta.Date); const author=meta.Author||'Staff';
  return `
    <a class="top-thumb" href="article.html?article=${encodeURIComponent(file)}" style="background-image:url('${encodeURI(img)}')"></a>
    <div class="top-body">
      <h3 class="top-title"><a href="article.html?article=${encodeURIComponent(file)}">${escapeHtml(title)}</a></h3>
      <div class="top-meta">${escapeHtml(date)}${date?' • ':''}${escapeHtml(author)}</div>
    </div>
  `;
}
async function renderHome(){
  const data=await loadVisibleSorted();
  // Lead + top stories
  const leadEl=document.getElementById('lead-story');
  const topEl=document.getElementById('top-stories');
  if(leadEl && data[0]) leadEl.innerHTML = leadCardTemplate(data[0]);
  if(topEl){
    topEl.innerHTML='';
    for(const item of data.slice(1,5)){
      const card=document.createElement('article');
      card.className='top-card';
      card.innerHTML=topCardTemplate(item);
      topEl.appendChild(card);
    }
  }
  // Latest grid
  const latest=document.getElementById('latest-grid');
  if(latest){
    latest.innerHTML='';
    for(const item of data.slice(5, 5+HOMEPAGE_LATEST_LIMIT)){
      latest.appendChild(gridCard(item));
    }
  }
  // Sidebar latest
  const sList=document.getElementById('sidebar-latest');
  if(sList){
    sList.innerHTML='';
    for(const item of data.slice(5, 5+SIDEBAR_LATEST_LIMIT)){
      const li=document.createElement('li');
      const date=formatDate(item.meta.Date);
      li.innerHTML=`<a href="article.html?article=${encodeURIComponent(item.file)}">${escapeHtml(item.meta.Title||item.file)}</a>
      <div class="muted" style="font-size:.85rem">${escapeHtml(date)}</div>`;
      sList.appendChild(li);
    }
  }
  // Trending topics (by Category frequency)
  const trend=document.getElementById('trend-topics');
  if(trend){
    const counts=new Map();
    for(const i of data){ if(i.meta.Category){ const k=i.meta.Category.trim(); counts.set(k,(counts.get(k)||0)+1); } }
    const top=[...counts.entries()].sort((a,b)=>b[1]-a[1]).slice(0,6).map(([k])=>k);
    trend.innerHTML = top.map(k=>`<a href="newsletters.html?category=${encodeURIComponent(k)}">${escapeHtml(k)}</a>`).join('');
  }
}

// Cards used on grids
function gridCard(item){
  const {file, meta}=item;
  const img=resolveThumbPath(meta.Thumbnail);
  const title=meta.Title||file;
  const date=formatDate(meta.Date); const author=meta.Author||'Staff';
  const el=document.createElement('a');
  el.className='card';
  el.href=`article.html?article=${encodeURIComponent(file)}`;
  el.innerHTML=`
    <div class="card-img" style="background-image:url('${encodeURI(img)}')"></div>
    <div class="card-body">
      <h3 class="card-title">${escapeHtml(title)}</h3>
      <div class="card-meta">${escapeHtml(date)}${date?' • ':''}${escapeHtml(author)}</div>
      ${meta.Subtitle?`<p class="card-sub">${escapeHtml(meta.Subtitle)}</p>`:''}
    </div>`;
  return el;
}

// ---------- Newsletters list page (optional category filter) ----------
async function renderListPage(){
  const container=document.getElementById('news-list'); if(!container) return;
  const params=new URLSearchParams(location.search);
  const activeCat=params.get('category')?.trim();
  const data=await loadVisibleSorted();
  const filtered = activeCat ? data.filter(i=>(i.meta.Category||'').trim().toLowerCase()===activeCat.toLowerCase()) : data;

  const info=document.getElementById('active-filter');
  if(info) info.textContent = activeCat ? `Filtering by category: ${activeCat}` : '';

  container.innerHTML='';
  for(const item of filtered){
    container.appendChild(gridCard(item));
  }
  if(filtered.length===0){
    container.innerHTML = `<p class="muted">No items found${activeCat?` for “${escapeHtml(activeCat)}”`:''}.</p>`;
  }
}

// ---------- Article page ----------
function readingTimeFromText(text, wpm=200){
  const words=String(text??'').trim().split(/\s+/).filter(Boolean).length;
  return `${Math.max(1, Math.round(words/wpm))} min read`;
}
function populateArticleHero(meta){
  const bg=document.querySelector('.a-hero-bg');
  const titleEl=document.getElementById('article-title');
  const subEl=document.getElementById('article-subtitle');
  const metaEl=document.getElementById('article-meta');
  const catEl=document.getElementById('article-category');

  const title=meta.Title||'Untitled';
  titleEl.textContent=title;
  subEl.textContent=meta.Subtitle||'';
  const date=formatDate(meta.Date); const author=meta.Author||'Staff';
  metaEl.textContent=`${date}${date?' • ':''}${author}`;

  const cat=meta.Category?.trim(); if(cat){ catEl.hidden=false; catEl.textContent=cat; } else { catEl.hidden=true; }

  const img=resolveThumbPath(meta.Thumbnail);
  if(bg) bg.style.backgroundImage=`url("${encodeURI(img)}")`;
}
function buildShareLinks(title){
  const url=location.href;
  const email=document.querySelector('[data-share="email"]');
  const reddit=document.querySelector('[data-share="reddit"]');
  const x=document.querySelector('[data-share="x"]');
  const copy=document.querySelector('[data-share="copy"]');
  const fb=document.getElementById('share-feedback');

  if(email) email.href=`mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(url)}`;
  if(reddit) reddit.href=`https://www.reddit.com/submit?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}`;
  if(x) x.href=`https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`;

  if(copy){
    copy.addEventListener('click', async ()=>{
      try{ await navigator.clipboard.writeText(url); if(fb){ fb.textContent='Link copied!'; setTimeout(()=>fb.textContent='',1500); } }
      catch{ if(fb){ fb.textContent='Copy failed.'; setTimeout(()=>fb.textContent='',1500); } }
    });
  }
}
function renderArticle(container, filename, meta, body){
  populateArticleHero(meta);
  const reading=readingTimeFromText(body, 200);
  const rt=document.getElementById('article-reading-time'); if(rt) rt.textContent=` • ${reading}`;

  const bodyHtml=renderMarkdownSafe(body);
  const date=formatDate(meta.Date); const author=meta.Author||'Staff';
  const metaLine=`${date}${date?' • ':''}${author}`;

  container.innerHTML = `
    ${meta.Subtitle?`<p class="muted" style="margin:.2rem 0 1rem 0">${escapeHtml(meta.Subtitle)}</p>`:''}
    <p class="muted" style="margin:.2rem 0 1rem 0">${escapeHtml(metaLine)} • ${escapeHtml(reading)}</p>
    <div>${bodyHtml}</div>`;
  document.title = `${meta.Title||filename} — Sleepy Hollow Media`;
}
async function initArticlePage(){
  const content=document.getElementById('article-content'); if(!content) return;
  const params=new URLSearchParams(location.search);
  const file=sanitizeFilename(params.get('article'));
  if(!file){ content.innerHTML='<p class="muted">Missing or invalid article parameter.</p>'; return; }
  try{
    const parsed=await loadNewsletter(file);
    renderArticle(content, file, parsed.meta, parsed.body);
    buildShareLinks(parsed.meta.Title||file);

    // Next/Prev using manifest order
    const manifest=await loadManifest();
    const idx=manifest.indexOf(file);
    const prev=document.getElementById('prev-article');
    const next=document.getElementById('next-article');
    if(prev && idx>0){ prev.href=`article.html?article=${encodeURIComponent(manifest[idx-1])}`; prev.hidden=false; }
    if(next && idx>=0 && idx<manifest.length-1){ next.href=`article.html?article=${encodeURIComponent(manifest[idx+1])}`; next.hidden=false; }
  }catch(e){ console.error(e); content.innerHTML='<p class="muted">Could not load this article.</p>'; }
}

// ---------- Boot ----------
document.addEventListener('DOMContentLoaded', async ()=>{
  initMobile();
  markCurrentNav();
  await renderHome();
  await renderListPage();
  await initArticlePage();
});