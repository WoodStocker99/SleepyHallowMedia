// Sleepy Hollow Media — Magazine Script (Hot-fix)
// - Correct clickable links for lead/top/grid
// - Accept /newsletters/<file> and newsletters/<file> in ?article=...
// - Keep theme toggle, search, categories, tags, trending, share, etc.

// ---- Config ----
const MANIFEST = 'newsletters/index.json';
const NEWS_DIR = 'newsletters/';
const DEFAULT_THUMB = 'thumbnails/placeholder.png';
const HOMEPAGE_LATEST_LIMIT = 12;
const SIDEBAR_LATEST_LIMIT = 8;

// =================== THEME ===================
const THEME_COOKIE = 'theme';
function getCookie(name){
  const m = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/([$?*|{}()[\]\\/+^])/g,'\\$1') + '=([^;]*)'));
  return m ? decodeURIComponent(m[1]) : '';
}
function setCookie(name, value, days=365){
  const maxAge = days * 24 * 60 * 60;
  document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; Max-Age=${maxAge}; Path=/; SameSite=Lax`;
}
function getStoredTheme(){
  const c = getCookie(THEME_COOKIE);
  if (c === 'dark' || c === 'light') return c;
  try{
    const s = localStorage.getItem(THEME_COOKIE);
    if (s === 'dark' || s === 'light') return s;
  }catch{}
  return (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
}
function applyTheme(theme){
  const root = document.documentElement;
  root.setAttribute('data-theme', theme);
  const btn = document.getElementById('theme-toggle');
  if (btn){
    btn.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
    const icon = btn.querySelector('.theme-icon');
    if (icon) icon.textContent = theme === 'dark' ? '☀️' : '🌙';
    btn.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
  }
}
function initTheme(){
  applyTheme(getStoredTheme());
  const btn = document.getElementById('theme-toggle');
  if (btn){
    btn.addEventListener('click', ()=>{
      const next = (document.documentElement.getAttribute('data-theme') === 'dark') ? 'light' : 'dark';
      applyTheme(next);
      try{ localStorage.setItem(THEME_COOKIE, next); }catch{}
      setCookie(THEME_COOKIE, next, 365);
    });
  }
  const explicit = getCookie(THEME_COOKIE) || (()=>{try{return localStorage.getItem(THEME_COOKIE)}catch{return null}})();
  if (!explicit && window.matchMedia){
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener?.('change', e => applyTheme(e.matches ? 'dark':'light'));
  }
}
// ================= END THEME =================

// ---- Utils ----
function escapeHtml(str){
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/'/g, '&#39;');
}

// IMPORTANT: accept absolute or relative newsletter paths safely
function sanitizeFilename(filename){
  if (!filename || typeof filename !== 'string') return '';
  // normalize slashes and trim
  let f = filename.replace(/\\/g, '/').trim();

  // strip ONE leading slash (/newsletters/foo.txt -> newsletters/foo.txt)
  if (f.startsWith('/')) f = f.slice(1);

  // still block traversal and external URLs
  if (f.includes('..') || f.startsWith('http:') || f.startsWith('https:')) return '';

  // allow "newsletters/..." or just "foo.txt"
  return f || '';
}

function parseFrontmatter(text){
  let src = String(text ?? '')
    .replace(/\r/g, '')
    .replace(/^\uFEFF/, '')
    .replace(/^\s+/, '');
  if (!src.startsWith('---\n') && src !== '---') {
    return { meta: {}, body: src.trim() };
  }
  const lines = src.split('\n');
  const meta = {};
  let i = 1;
  for (; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === '---') { i++; break; }
    if (!line) continue;
    const m = line.match(/^([^:]+)\s*:\s*(.*)$/);
    if (m) meta[m[1].trim()] = m[2].trim();
  }
  const body = lines.slice(i).join('\n').trim();
  return { meta, body };
}

async function loadManifest(){
  try{
    const res = await fetch(MANIFEST, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Manifest not found: ${MANIFEST}`);
    const data = await res.json();
    if (!Array.isArray(data)) return [];
    return data.map(sanitizeFilename).filter(Boolean);
  }catch(err){
    console.warn('Could not load manifest:', err);
    return [];
  }
}

async function loadNewsletter(filename){
  const f = sanitizeFilename(filename);
  if (!f) throw new Error('Invalid filename');
  const path = f.startsWith('newsletters/') ? f : `${NEWS_DIR}${f}`;
  const res = await fetch(path, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to fetch ${path}`);
  const text = await res.text();
  return parseFrontmatter(text);
}

function formatDate(dateStr){
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString();
}

function resolveThumbPath(t){
  if (!t) return DEFAULT_THUMB;
  const s = String(t).trim();
  if (/^(https?:)?\/\//i.test(s)) return s;
  if (s.startsWith('/')) return s;
  if (s.startsWith('thumbnails/') || s.startsWith('newsletters/')) return s;
  return s;
}

function isTruthy(v){
  if (v === true) return true;
  if (typeof v === 'string') return /^(true|yes|1)$/i.test(v.trim());
  if (typeof v === 'number') return v !== 0;
  return false;
}

function splitTags(value){
  if (!value) return [];
  return String(value)
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
}

function renderMarkdownSafe(text){
  if (typeof window !== 'undefined' && window.marked && window.DOMPurify) {
    const raw = window.marked.parse(String(text ?? ''));
    return window.DOMPurify.sanitize(raw, { ALLOWED_ATTR: ['href','src','alt','title','class'] });
  }
  return String(text ?? '').split(/\n\s*\n/).map(p => `<p>${escapeHtml(p.trim())}</p>`).join('');
}

// ---- Chrome ----
function markCurrentNav(){
  const file = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  const map = { 'index.html': 'home', 'newsletters.html': 'newsletters' };
  const key = map[file];
  document.querySelectorAll(`[data-nav="${key}"]`).forEach(a => a.setAttribute('aria-current','page'));
}
function initMobile(){
  const btn = document.querySelector('.nav-toggle');
  const menu = document.getElementById('mobile-menu');
  if (btn && menu){
    btn.addEventListener('click', ()=>{
      const open = menu.classList.toggle('active');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }
}
function hijackHeaderSearch(){
  const form = document.getElementById('site-search');
  if (!form) return;
  form.addEventListener('submit',(e)=>{
    const input = form.querySelector('input[name="q"]');
    if (!input || !input.value.trim()){
      e.preventDefault();
    }
  });
}

// ---- Data helpers ----
async function loadVisibleSorted(){
  const manifest = await loadManifest();
  if (!manifest.length) return [];
  const items = (await Promise.all(
    manifest.map(async f=>{
      try{
        const {meta, body} = await loadNewsletter(f);
        meta._dateObj = meta.Date ? new Date(meta.Date) : null;
        meta._tags = splitTags(meta.Tags);
        return { file: f, meta, body };
      }catch{
        return null;
      }
    })
  )).filter(Boolean);

  const visible = items.filter(r => !isTruthy(r.meta.Hidden));
  visible.sort((a,b)=>{
    const ad=a.meta._dateObj, bd=b.meta._dateObj;
    const aOk=ad && !Number.isNaN(ad.getTime()), bOk=bd && !Number.isNaN(bd.getTime());
    if (aOk && bOk) return bd - ad;
    if (aOk) return -1;
    if (bOk) return 1;
    return b.file.localeCompare(a.file);
  });
  return visible;
}

// ---- Search ranking ----
function normalize(str){ return String(str ?? '').toLowerCase(); }
function itemScore(item, q){
  const { meta, body } = item;
  const nQ = normalize(q);
  let score = 0;
  const addIf = (cond, weight)=>{ if (cond) score += weight; };
  addIf(normalize(meta.Title).includes(nQ), 8);
  addIf(normalize(meta.Subtitle).includes(nQ), 5);
  addIf(normalize(meta.Author).includes(nQ), 4);
  addIf(normalize(meta.Category).includes(nQ), 4);
  addIf((meta._tags || []).some(t=>normalize(t).includes(nQ)), 3);
  addIf(normalize(body).slice(0, 800).includes(nQ), 1);
  return score;
}
function searchItems(items, query){
  const q = query?.trim();
  if (!q) return items;
  const ranked = items
    .map(it => ({ it, s: itemScore(it, q) }))
    .filter(x => x.s > 0)
    .sort((a,b)=> b.s - a.s || (b.it.meta._dateObj - a.it.meta._dateObj));
  return ranked.map(x => x.it);
}

// ---- Card builders (VALID <a> + <img>) ----
function leadCardHTML(item){
  const { file, meta } = item;
  const title  = meta.Title || file;
  const cat    = meta.Category || '';
  const date   = formatDate(meta.Date);
  const author = meta.Author || 'Staff';
  const img    = resolveThumbPath(meta.Thumbnail);
  const url    = `article.html?article=${encodeURIComponent(file)}`;

  // One stretched link overlay to cover the entire card (no nested anchors)
  return `
    <img class="lead-bg" src="${encodeURI(img)}" alt="" loading="eager" decoding="async">
    <div class="lead-body">
      ${cat ? `<span class="kicker">${escapeHtml(cat)}</span>` : ''}
      <h2 class="lead-title"><a href="${url}">${escapeHtml(title)}</a></h2>
      <div class="lead-meta">${escapeHtml(date)}${date ? ' • ' : ''}${escapeHtml(author)}</div>
    </div>
    <a class="stretched-link" href="${url}" aria-label="${escapeHtml(title)}"></a>
  `;
}

function topCardHTML(item){
  const { file, meta } = item;
  const title  = meta.Title || file;
  const img    = resolveThumbPath(meta.Thumbnail);
  const date   = formatDate(meta.Date);
  const author = meta.Author || 'Staff';
  const url    = `article.html?article=${encodeURIComponent(file)}`;

  // Separate anchors for image and title (both point to article)
  return `
    <a href="${url}" aria-label="${escapeHtml(title)}">
      <img class="top-thumb" src="${encodeURI(img)}" alt="" loading="lazy" decoding="async">
    </a>
    <div class="top-body">
      <h3 class="top-title"><a href="${url}">${escapeHtml(title)}</a></h3>
      <div class="top-meta">${escapeHtml(date)}${date ? ' • ' : ''}${escapeHtml(author)}</div>
    </div>`;
}

function gridCard(item){
  const { file, meta } = item;
  const img    = resolveThumbPath(meta.Thumbnail);
  const title  = meta.Title || file;
  const date   = formatDate(meta.Date);
  const author = meta.Author || 'Staff';
  const chip   = meta.Category ? `<span class="chip">${escapeHtml(meta.Category)}</span>` : '';
  const tags   = (meta._tags || []).slice(0,2).map(t=>`<span class="chip" title="Tag">${escapeHtml(t)}</span>`).join('');
  const sub    = meta.Subtitle ? `<p class="card-sub">${escapeHtml(meta.Subtitle)}</p>` : '';
  const url    = `article.html?article=${encodeURIComponent(file)}`;

  const a = document.createElement('a');
  a.className = 'card';
  a.href = url;
  a.setAttribute('aria-label', title);
  a.innerHTML = `
    <img class="card-img" src="${encodeURI(img)}" alt="" loading="lazy" decoding="async">
    <div class="card-body">
      ${chip}${tags}
      <h3 class="card-title">${escapeHtml(title)}</h3>
      <div class="card-meta">${escapeHtml(date)}${date ? ' • ' : ''}${escapeHtml(author)}</div>
      ${sub}
    </div>`;
  return a;
}

// ---- Homepage render ----
async function renderHome(){
  const data = await loadVisibleSorted();
  if (!data.length) return;

  // Lead + top stories
  const leadEl = document.getElementById('lead-story');
  const topEl  = document.getElementById('top-stories');
  if (leadEl) leadEl.innerHTML = leadCardHTML(data[0]);
  if (topEl){
    topEl.innerHTML = '';
    for (const item of data.slice(1,5)){
      const card = document.createElement('article');
      card.className = 'top-card';
      card.innerHTML = topCardHTML(item);
      topEl.appendChild(card);
    }
  }

  // Latest grid
  const latest = document.getElementById('latest-grid');
  if (latest){
    latest.innerHTML = '';
    for (const item of data.slice(5, 5 + HOMEPAGE_LATEST_LIMIT)){
      latest.appendChild(gridCard(item));
    }
  }

  // Sidebar latest
  const sList = document.getElementById('sidebar-latest');
  if (sList){
    sList.innerHTML = '';
    for (const item of data.slice(5, 5 + SIDEBAR_LATEST_LIMIT)){
      const li = document.createElement('li');
      const date = formatDate(item.meta.Date);
      const url  = `article.html?article=${encodeURIComponent(item.file)}`;
      li.innerHTML = `<a href="${url}">${escapeHtml(item.meta.Title || item.file)}</a>
        <div class="muted" style="font-size:.85rem">${escapeHtml(date)}</div>`;
      sList.appendChild(li);
    }
  }

  // Trending topics (by Category frequency)
  const trend = document.getElementById('trend-topics');
  if (trend){
    const counts = new Map();
    for (const it of data){
      const cat = (it.meta.Category || '').trim();
      if (!cat) continue;
      counts.set(cat, (counts.get(cat) || 0) + 1);
    }
    const tags = [...counts.entries()]
      .sort((a,b)=>b[1]-a[1])
      .slice(0,6)
      .map(([k]) => `<a class="top-link" href="newsletters.html?category=${encodeURIComponent(k)}">${escapeHtml(k)}</a>`)
      .join('');
    trend.innerHTML = tags || '<span class="muted">No trending topics yet</span>';
  }
}

// ---- List page (search + filter) ----
async function renderListPage(){
  const container = document.getElementById('news-list');
  if (!container) return;

  const params = new URLSearchParams(location.search);
  const q = params.get('q')?.trim();
  const activeCat = params.get('category')?.trim();

  const data = await loadVisibleSorted();

  // Category chips
  const chipWrap = document.getElementById('category-chips');
  if (chipWrap){
    const cats = [...new Set(data.map(i => (i.meta.Category || '').trim()).filter(Boolean))].sort();
    chipWrap.innerHTML = cats.map(c => `<a href="newsletters.html?category=${encodeURIComponent(c)}">${escapeHtml(c)}</a>`).join('');
  }

  // Filter + search
  let filtered = activeCat
    ? data.filter(i => (i.meta.Category || '').trim().toLowerCase() === activeCat.toLowerCase())
    : data;
  if (q) filtered = searchItems(filtered, q);

  // Summary
  const info = document.getElementById('active-filter');
  if (info){
    if (q && activeCat) info.textContent = `${filtered.length} result(s) for “${q}” in ${activeCat}`;
    else if (q) info.textContent = `${filtered.length} result(s) for “${q}”`;
    else if (activeCat) info.textContent = `Filtering by category: ${activeCat} (${filtered.length})`;
    else info.textContent = '';
  }

  // Render
  container.innerHTML = '';
  if (!filtered.length){
    container.innerHTML = `<p class="muted">No items found${q ? ` for “${escapeHtml(q)}”` : ''}${activeCat ? ` in ${escapeHtml(activeCat)}` : ''}.</p>`;
    return;
  }
  for (const item of filtered){
    container.appendChild(gridCard(item));
  }
}

// ---- Article page (no next/prev) ----
function readingTimeFromText(text, wpm = 200){
  const words = String(text ?? '').trim().split(/\s+/).filter(Boolean).length;
  return `${Math.max(1, Math.round(words / wpm))} min read`;
}
function populateArticleHero(meta){
  const bgDiv   = document.querySelector('.a-hero-bg');
  const titleEl = document.getElementById('article-title');
  const subEl   = document.getElementById('article-subtitle');
  const metaEl  = document.getElementById('article-meta');
  const catEl   = document.getElementById('article-category');

  const title  = meta.Title || 'Untitled';
  const date   = formatDate(meta.Date);
  const author = meta.Author || 'Staff';
  const cat    = (meta.Category || '').trim();

  titleEl.textContent = title;
  subEl.textContent   = meta.Subtitle || '';
  metaEl.textContent  = `${date}${date ? ' • ' : ''}${author}`;
  if (cat){ catEl.hidden = false; catEl.textContent = cat; } else { catEl.hidden = true; }

  const img = resolveThumbPath(meta.Thumbnail);
  if (bgDiv){
    bgDiv.style.backgroundImage = `url("${encodeURI(img)}")`;
    bgDiv.style.backgroundSize = 'cover';
    bgDiv.style.backgroundPosition = 'center';
  }
}

function buildShareLinks(title){
  const url = location.href;
  const email = document.querySelector('[data-share="email"]');
  const reddit = document.querySelector('[data-share="reddit"]');
  const x = document.querySelector('[data-share="x"]');
  const copy = document.querySelector('[data-share="copy"]');
  const fb = document.getElementById('share-feedback');

  if (email)  email.href  = `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(url)}`;
  if (reddit) reddit.href = `https://www.reddit.com/submit?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}`;
  if (x)      x.href      = `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`;

  if (copy){
    copy.addEventListener('click', async ()=>{
      try{
        await navigator.clipboard.writeText(url);
        if (fb){ fb.textContent = 'Link copied!'; setTimeout(()=> fb.textContent = '', 1400); }
      }catch{
        if (fb){ fb.textContent = 'Copy failed.'; setTimeout(()=> fb.textContent = '', 1400); }
      }
    });
  }
}

function renderArticle(container, filename, meta, body){
  populateArticleHero(meta);

  const reading = readingTimeFromText(body, 200);
  const rt = document.getElementById('article-reading-time');
  if (rt) rt.textContent = ` • ${reading}`;

  const bodyHtml = renderMarkdownSafe(body);
  const date = formatDate(meta.Date);
  const author = meta.Author || 'Staff';
  const metaLine = `${date}${date ? ' • ' : ''}${author}`;

  container.innerHTML = `
    ${meta.Subtitle ? `<p class="muted" style="margin:.2rem 0 1rem 0">${escapeHtml(meta.Subtitle)}</p>` : ''}
    <p class="muted" style="margin:.2rem 0 1rem 0">${escapeHtml(metaLine)} • ${escapeHtml(reading)}</p>
    <div>${bodyHtml}</div>
  `;

  document.title = `${meta.Title || filename} — Sleepy Hollow Media`;
}

async function initArticlePage(){
  const content = document.getElementById('article-content');
  if (!content) return;

  const params = new URLSearchParams(window.location.search);
  const raw = params.get('article');
  const file = sanitizeFilename(raw);
  if (!file){
    content.innerHTML = `<p class="muted">Missing or invalid article parameter.</p>`;
    return;
  }

  try{
    const parsed = await loadNewsletter(file);
    renderArticle(content, file, parsed.meta, parsed.body);
    buildShareLinks(parsed.meta.Title || file);
    // No next/prev by design
  }catch(e){
    console.error(e);
    content.innerHTML = `<p class="muted">Could not load this article.</p>`;
  }
}

// ---- Boot ----
document.addEventListener('DOMContentLoaded', async ()=>{
  initTheme();
  initMobile();
  markCurrentNav();
  hijackHeaderSearch();

  await renderHome();
  await renderListPage();
  await initArticlePage();
});