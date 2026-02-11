/* Sleepy Hollow Media — Stable script
   Minimal, safe fixes:
   - Real <a> and <img> everywhere (no plain text URLs)
   - Featured (lead) has a full-card overlay link
   - No layout logic changes; original page setup preserved
*/

'use strict';

/* ---------- Config ---------- */
const MANIFEST = 'newsletters/index.json';
const NEWS_DIR = 'newsletters/';
const DEFAULT_THUMB = 'thumbnails/placeholder.png';
const HOMEPAGE_LATEST_LIMIT = 12;
const SIDEBAR_LATEST_LIMIT = 8;

/* ---------- Theme ---------- */
const THEME_COOKIE = 'theme';
function getCookie(name){ const m=document.cookie.match(new RegExp('(?:^|; )'+name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'=([^;]*)')); return m?decodeURIComponent(m[1]):''; }
function setCookie(name,value,days=365){ const maxAge=days*24*60*60; document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; Max-Age=${maxAge}; Path=/; SameSite=Lax`; }
function getStoredTheme(){ const c=getCookie(THEME_COOKIE); if(c==='dark'||c==='light') return c; try{ const s=localStorage.getItem(THEME_COOKIE); if(s==='dark'||s==='light') return s; }catch{} return (window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches)?'dark':'light'; }
function applyTheme(theme){ document.documentElement.setAttribute('data-theme', theme); const btn=document.getElementById('theme-toggle'); if(btn){ btn.setAttribute('aria-pressed', theme==='dark'?'true':'false'); const icon=btn.querySelector('.theme-icon'); if(icon) icon.textContent = theme==='dark'?'☀️':'🌙'; btn.setAttribute('aria-label', theme==='dark'?'Switch to light mode':'Switch to dark mode'); } }
function initTheme(){ applyTheme(getStoredTheme()); const btn=document.getElementById('theme-toggle'); if(btn){ btn.addEventListener('click',()=>{ const next=(document.documentElement.getAttribute('data-theme')==='dark')?'light':'dark'; applyTheme(next); try{localStorage.setItem(THEME_COOKIE,next);}catch{} setCookie(THEME_COOKIE,next,365); }); } }

/* ---------- Utilities ---------- */
function escapeHtml(str){ if(str==null) return ''; return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
function sanitizeFilename(filename){ if(!filename||typeof filename!=='string') return ''; let f=filename.replace(/\\/g,'/').trim(); if(f.startsWith('/')) f=f.slice(1); if(f.includes('..')||/^https?:/i.test(f)) return ''; return f||''; }
function parseFrontmatter(text){
  let src=String(text??'').replace(/\r/g,'').replace(/^\uFEFF/,'').replace(/^\s+/,'');
  if(!src.startsWith('---\n') && src!=='---') return { meta:{}, body:src.trim() };
  const lines=src.split('\n'); const meta={}; let i=1;
  for(;i<lines.length;i++){ const line=lines[i].trim(); if(line==='---'){ i++; break; } if(!line) continue; const m=line.match(/^([^:]+)\s*:\s*(.*)$/); if(m) meta[m[1].trim()] = m[2].trim(); }
  return { meta, body: lines.slice(i).join('\n').trim() };
}
async function loadManifest(){ try{ const res=await fetch(MANIFEST,{cache:'no-store'}); if(!res.ok) throw new Error(); const data=await res.json(); return Array.isArray(data)?data.map(sanitizeFilename).filter(Boolean):[]; }catch{ return []; } }
async function loadNewsletter(filename){ const f=sanitizeFilename(filename); if(!f) throw new Error('Invalid filename'); const path=f.startsWith('newsletters/')?f:`${NEWS_DIR}${f}`; const res=await fetch(path,{cache:'no-store'}); if(!res.ok) throw new Error(`Failed ${path}`); const text=await res.text(); return parseFrontmatter(text); }
function formatDate(d){ if(!d) return ''; const x=new Date(d); return Number.isNaN(x.getTime())?'':x.toLocaleDateString(); }
function resolveThumbPath(t){ if(!t) return DEFAULT_THUMB; const s=String(t).trim(); if(/^(https?:)?\/\//i.test(s)) return s; if(s.startsWith('/')) return s; if(s.startsWith('thumbnails/')||s.startsWith('newsletters/')) return s; return s; }
function isTruthy(v){ if(v===true) return true; if(typeof v==='string') return /^(true|yes|1)$/i.test(v.trim()); if(typeof v==='number') return v!==0; return false; }
function splitTags(v){ if(!v) return []; return String(v).split(',').map(s=>s.trim()).filter(Boolean); }
function renderMarkdownSafe(text){
  if(typeof window!=='undefined' && window.marked && window.DOMPurify){
    const raw = window.marked.parse(String(text??'')); 
    return window.DOMPurify.sanitize(raw, { ALLOWED_ATTR:['href','src','alt','title','class'] });
  }
  return String(text??'').split(/\n\s*\n/).map(p=>`<p>${escapeHtml(p.trim())}</p>`).join('');
}

/* ---------- Nav helpers ---------- */
function markCurrentNav(){ const file=(location.pathname.split('/').pop()||'index.html').toLowerCase(); const map={'index.html':'home','newsletters.html':'newsletters'}; const key=map[file]; document.querySelectorAll(`[data-nav="${key}"]`).forEach(a=>a.setAttribute('aria-current','page')); }
function initMobile(){ const btn=document.querySelector('.nav-toggle'); const menu=document.getElementById('mobile-menu'); if(btn&&menu){ btn.addEventListener('click',()=>{ const open=menu.classList.toggle('active'); btn.setAttribute('aria-expanded', open?'true':'false'); }); } }
function hijackHeaderSearch(){ const form=document.getElementById('site-search'); if(!form) return; form.addEventListener('submit',(e)=>{ const q=form.querySelector('input[name="q"]'); if(!q||!q.value.trim()) e.preventDefault(); }); }

/* ---------- Data ---------- */
async function loadVisibleSorted(){
  const manifest=await loadManifest();
  if(!manifest.length) return [];
  const rows=(await Promise.all(manifest.map(async f=>{ try{ const {meta,body}=await loadNewsletter(f); meta._dateObj = meta.Date?new Date(meta.Date):null; meta._tags=splitTags(meta.Tags); return {file:f, meta, body}; }catch{ return null; } }))).filter(Boolean);
  const visible=rows.filter(r=>!isTruthy(r.meta.Hidden));
  visible.sort((a,b)=>{ const ad=a.meta._dateObj, bd=b.meta._dateObj; const aOk=ad&&!Number.isNaN(ad.getTime()); const bOk=bd&&!Number.isNaN(bd.getTime()); if(aOk&&bOk) return bd-ad; if(aOk) return -1; if(bOk) return 1; return b.file.localeCompare(a.file); });
  return visible;
}

/* ---------- Builders (explicit anchors & imgs) ---------- */
function leadCardHTML(item){
  const { file, meta } = item;
  const url = `article.html?article=${encodeURIComponent(file)}`;
  const title = meta.Title || file;
  const cat = meta.Category || '';
  const date = formatDate(meta.Date);
  const author = meta.Author || 'Staff';
  const img = resolveThumbPath(meta.Thumbnail);

  return `
    <a class="card-overlay" href="${url}" aria-label="${escapeHtml(title)}"></a>
    <img class="lead-bg" src="${encodeURI(img)}" alt="" loading="eager" decoding="async">
    <div class="lead-body">
      ${cat ? `<span class="kicker">${escapeHtml(cat)}</span>` : ''}
      <h2 class="lead-title"><a href="${url}">${escapeHtml(title)}</a></h2>
      <div class="lead-meta">${escapeHtml(date)}${date?' • ':''}${escapeHtml(author)}</div>
    </div>
  `;
}

function topCardHTML(item){
  const { file, meta } = item;
  const url = `article.html?article=${encodeURIComponent(file)}`;
  const title = meta.Title || file;
  const img = resolveThumbPath(meta.Thumbnail);
  const date = formatDate(meta.Date);
  const author = meta.Author || 'Staff';

  return `
    <a href="${url}" aria-label="${escapeHtml(title)}">
      <img class="top-thumb" src="${encodeURI(img)}" alt="" loading="lazy" decoding="async">
    </a>
    <div class="top-body">
      <h3 class="top-title"><a href="${url}">${escapeHtml(title)}</a></h3>
      <div class="top-meta">${escapeHtml(date)}${date?' • ':''}${escapeHtml(author)}</div>
    </div>
  `;
}

function gridCard(item){
  const { file, meta } = item;
  const url = `article.html?article=${encodeURIComponent(file)}`;
  const title = meta.Title || file;
  const img = resolveThumbPath(meta.Thumbnail);
  const date = formatDate(meta.Date);
  const author = meta.Author || 'Staff';
  const chip = meta.Category ? `<span class="chip" title="Category">${escapeHtml(meta.Category)}</span>` : '';
  const tags = (meta._tags||[]).slice(0,2).map(t=>`<span class="chip" title="Tag">${escapeHtml(t)}</span>`).join('');
  const sub  = meta.Subtitle?`<p class="card-sub">${escapeHtml(meta.Subtitle)}</p>`:'';

  const a=document.createElement('a');
  a.className='card';
  a.href=url;
  a.setAttribute('aria-label', title);
  a.innerHTML=`
    <img class="card-img" src="${encodeURI(img)}" alt="" loading="lazy" decoding="async">
    <div class="card-body">
      ${chip}${tags}
      <h3 class="card-title"><a href="${url}">${escapeHtml(title)}</a></h3>
      <div class="card-meta">${escapeHtml(date)}${date?' • ':''}${escapeHtml(author)}</div>
      ${sub}
    </div>`;
  return a;
}

/* ---------- Homepage render (layout unchanged) ---------- */
async function renderHome(){
  const data=await loadVisibleSorted();
  if(!data.length) return;

  const leadEl=document.getElementById('lead-story');
  const topEl=document.getElementById('top-stories');

  if(leadEl){ leadEl.innerHTML = leadCardHTML(data[0]); }

  if(topEl){
    topEl.innerHTML='';
    for(const item of data.slice(1,5)){
      const card=document.createElement('article');
      card.className='top-card';
      card.innerHTML=topCardHTML(item);
      topEl.appendChild(card);
    }
  }

  const latest=document.getElementById('latest-grid');
  if(latest){
    latest.innerHTML='';
    for(const item of data.slice(5, 5 + HOMEPAGE_LATEST_LIMIT)){
      latest.appendChild(gridCard(item));
    }
  }

  const sList=document.getElementById('sidebar-latest');
  if(sList){
    sList.innerHTML='';
    for(const item of data.slice(5, 5 + SIDEBAR_LATEST_LIMIT)){
      const date=formatDate(item.meta.Date);
      const url=`article.html?article=${encodeURIComponent(item.file)}`;
      const li=document.createElement('li');
      li.innerHTML = `<a href="${url}">${escapeHtml(item.meta.Title || item.file)}</a>
        <div class="muted" style="font-size:.85rem">${escapeHtml(date)}</div>`;
      sList.appendChild(li);
    }
  }

  // Trending TAGS (top 6)
  const trend=document.getElementById('trend-topics');
  if(trend){
    const counts=new Map();
    for(const it of data){
      for(const t of (it.meta._tags||[])){ const k=t.trim(); if(!k) continue; counts.set(k,(counts.get(k)||0)+1); }
    }
    const topTags=[...counts.entries()].sort((a,b)=>b[1]-a[1]).slice(0,6);
    trend.innerHTML = topTags.length
      ? topTags.map(([k])=>`<a href="newsletters.html?tag=${encodeURIComponent(k)}">${escapeHtml(k)}</a>`).join('')
      : '<span class="muted">No trending tags yet</span>';
  }
}

/* ---------- List page (unchanged, explicit anchors) ---------- */
function parseTagsParam(v){ if(!v) return []; return v.split(',').map(s=>s.trim()).filter(Boolean); }

function normalize(str){ return String(str??'').toLowerCase(); }
function itemScore(item,q){
  const {meta, body}=item; const n=normalize(q); let s=0;
  const add=(c,w)=>{ if(c) s+=w; };
  add(normalize(meta.Title).includes(n),8);
  add(normalize(meta.Subtitle).includes(n),5);
  add(normalize(meta.Author).includes(n),4);
  add(normalize(meta.Category).includes(n),4);
  add((meta._tags||[]).some(t=>normalize(t).includes(n)),3);
  add(normalize(body).slice(0,800).includes(n),1);
  return s;
}
function searchItems(items, q){
  const t=q?.trim(); if(!t) return items;
  return items.map(it=>({it, s:itemScore(it,t)})).filter(x=>x.s>0).sort((a,b)=>b.s-a.s||(b.it.meta._dateObj-a.it.meta._dateObj)).map(x=>x.it);
}

async function renderListPage(){
  const container=document.getElementById('news-list'); if(!container) return;

  const params=new URLSearchParams(location.search);
  const q=params.get('q')?.trim();
  const activeCat=params.get('category')?.trim();
  const tagParam=params.get('tag')?.trim();
  const activeTags=parseTagsParam(tagParam).map(t=>t.toLowerCase());

  const data=await loadVisibleSorted();

  const chipWrap=document.getElementById('category-chips');
  if(chipWrap){
    const cats=[...new Set(data.map(i=>(i.meta.Category||'').trim()).filter(Boolean))].sort();
    chipWrap.innerHTML=cats.map(c=>`<a href="newsletters.html?category=${encodeURIComponent(c)}">${escapeHtml(c)}</a>`).join('');
  }

  const tagWrap=document.getElementById('tag-cloud');
  if(tagWrap){
    const counts=new Map();
    for(const i of data){ for(const t of (i.meta._tags||[])){ const k=t.trim(); if(!k) continue; counts.set(k,(counts.get(k)||0)+1); } }
    const list=[...counts.entries()].sort((a,b)=>b[1]-a[1]).slice(0,20);
    tagWrap.innerHTML = list.length
      ? list.map(([t])=>{
          const on=activeTags.includes(t.toLowerCase());
          const url=new URL(location.href);
          const cur=parseTagsParam(url.searchParams.get('tag')||'').map(x=>x.toLowerCase());
          const next=on?cur.filter(x=>x!==t.toLowerCase()):[...new Set([...cur,t.toLowerCase()])];
          if(next.length) url.searchParams.set('tag', next.join(',')); else url.searchParams.delete('tag');
          return `<a href="${url.pathname+url.search}">${escapeHtml(t)}</a>`;
        }).join('')
      : '<span class="muted">No tags yet</span>';
  }

  let filtered = activeCat ? data.filter(i=>(i.meta.Category||'').trim().toLowerCase()===activeCat.toLowerCase()) : data;
  if(activeTags.length){ filtered=filtered.filter(i=>{ const tags=(i.meta._tags||[]).map(t=>t.toLowerCase()); return activeTags.some(t=>tags.includes(t)); }); }
  if(q) filtered = searchItems(filtered, q);

  const info=document.getElementById('active-filter');
  if(info){
    const parts=[]; if(q) parts.push(`“${q}”`); if(activeCat) parts.push(`Category: ${activeCat}`); if(activeTags.length) parts.push(`Tags: ${activeTags.join(', ')}`);
    info.textContent = parts.length?`${filtered.length} result(s) — ${parts.join(' • ')}`:'';
  }

  container.innerHTML='';
  if(!filtered.length){
    container.innerHTML = `<p class="muted">No items found${q?` for “${escapeHtml(q)}”`:''}${activeCat?` in ${escapeHtml(activeCat)}`:''}${activeTags.length?` with tags: ${escapeHtml(activeTags.join(', '))}`:''}.</p>`;
    return;
  }
  for(const item of filtered) container.appendChild(gridCard(item));
}

/* ---------- Article view (unchanged) ---------- */
function readingTimeFromText(text,wpm=200){ const words=String(text??'').trim().split(/\s+/).filter(Boolean).length; return `${Math.max(1,Math.round(words/wpm))} min read`; }
function populateArticleHero(meta){
  const bg=document.querySelector('.a-hero-bg');
  const titleEl=document.getElementById('article-title');
  const subEl=document.getElementById('article-subtitle');
  const metaEl=document.getElementById('article-meta');
  const catEl=document.getElementById('article-category');

  const title=meta.Title||'Untitled';
  const date=formatDate(meta.Date);
  const author=meta.Author||'Staff';
  const cat=(meta.Category||'').trim();

  if(titleEl) titleEl.textContent=title;
  if(subEl)   subEl.textContent  =meta.Subtitle||'';
  if(metaEl)  metaEl.textContent =`${date}${date?' • ':''}${author}`;
  if(catEl){ if(cat){ catEl.hidden=false; catEl.textContent=cat; } else { catEl.hidden=true; } }

  const img=resolveThumbPath(meta.Thumbnail);
  if(bg){ bg.setAttribute('src', encodeURI(img)); bg.setAttribute('loading','eager'); bg.setAttribute('decoding','async'); bg.setAttribute('alt',''); }
}
function buildShareLinks(title){
  const url=location.href;
  const email=document.querySelector('[data-share="email"]');
  const reddit=document.querySelector('[data-share="reddit"]');
  const x=document.querySelector('[data-share="x"]');
  const copy=document.querySelector('[data-share="copy"]');
  const fb=document.getElementById('share-feedback');
  if(email)  email.href = `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(url)}`;
  if(reddit) reddit.href= `https://www.reddit.com/submit?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}`;
  if(x)      x.href     = `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`;
  if(copy){ copy.addEventListener('click', async()=>{ try{ await navigator.clipboard.writeText(url); if(fb){ fb.textContent='Link copied!'; setTimeout(()=>fb.textContent='',1400); } }catch{ if(fb){ fb.textContent='Copy failed.'; setTimeout(()=>fb.textContent='',1400); } } }); }
}
function renderArticle(container, filename, meta, body){
  populateArticleHero(meta);
  const reading=readingTimeFromText(body,200);
  const rt=document.getElementById('article-reading-time'); if(rt) rt.textContent=` • ${reading}`;
  const bodyHtml=renderMarkdownSafe(body);
  const date=formatDate(meta.Date);
  const author=meta.Author||'Staff';
  const metaLine=`${date}${date?' • ':''}${author}`;
  container.innerHTML = `
    ${meta.Subtitle?`<p class="muted" style="margin:.2rem 0 1rem 0">${escapeHtml(meta.Subtitle)}</p>`:''}
    <p class="muted" style="margin:.2rem 0 1rem 0">${escapeHtml(metaLine)} • ${escapeHtml(reading)}</p>
    <div>${bodyHtml}</div>
  `;
  document.title = `${meta.Title || filename} — Sleepy Hollow Media`;
}
async function initArticlePage(){
  const content=document.getElementById('article-content'); if(!content) return;
  const params=new URLSearchParams(window.location.search);
  const raw=params.get('article');
  const file=sanitizeFilename(raw);
  if(!file){ content.innerHTML=`<p class="muted">Missing or invalid article parameter.</p>`; return; }
  try{ const parsed=await loadNewsletter(file); renderArticle(content,file,parsed.meta,parsed.body); buildShareLinks(parsed.meta.Title||file); }
  catch{ content.innerHTML=`<p class="muted">Could not load this article.</p>`; }
}

/* ---------- Boot ---------- */
document.addEventListener('DOMContentLoaded', ()=>{
  initTheme();
  initMobile();
  markCurrentNav();
  hijackHeaderSearch();

  renderHome();
  renderListPage();
  initArticlePage();
});