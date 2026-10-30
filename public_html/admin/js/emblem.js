/**
 * admin/js/emblem.js - the "Family emblem" and "Cover picture" cards on Tree Settings.
 * Pick a built-in mark and a colour, or upload your own. Saves through settings-api.php.
 */
let _em = { kind: 'none', id: 'banyan', color: '#D4A643', url: null };
let _emSlug = '';

function emRender() {
  const grid = document.getElementById('emGrid');
  const ids = Object.keys(window.FT_EMBLEMS || {});
  grid.innerHTML = ids.map(id => `
      <button type="button" class="em-tile ${_em.kind === 'builtin' && _em.id === id ? 'on' : ''}" title="${FT_EMBLEMS[id].name}" onclick="emPickBuiltin('${id}')">
        ${ftEmblemSvg(id, _em.color, 44)}<span>${FT_EMBLEMS[id].name}</span>
      </button>`).join('');
  document.getElementById('emColor').value = _em.color;
  document.getElementById('emColorHex').value = _em.color;
  const prev = document.getElementById('emPreview');
  if (_em.kind === 'builtin') prev.innerHTML = ftEmblemSvg(_em.id, _em.color, 96);
  else if (_em.kind === 'upload' && _em.url) prev.innerHTML = `<img src="${_em.url}" alt="Family emblem">`;
  else prev.innerHTML = `<span class="em-none">No emblem</span>`;
  document.getElementById('emUploadWrap').classList.toggle('on', _em.kind === 'upload');
  document.getElementById('emRemove').style.display = _em.kind === 'none' ? 'none' : '';
  if (typeof cvRender === 'function') cvRender();
}
function emPickBuiltin(id) { _em.kind = 'builtin'; _em.id = id; emRender(); }
function emColorChange(v) { if (/^#[0-9a-fA-F]{6}$/.test(v)) { _em.color = v.toUpperCase(); emRender(); } }
function emRemove() { _em.kind = 'none'; emRender(); }
async function emUpload(input) {
  const f = input.files && input.files[0]; if (!f) return;
  if (f.size > 400 * 1024) { emMsg('Keep the emblem under 400 KB (a square PNG or SVG is ideal).', false); return; }
  const dataUrl = await new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(f); });
  emMsg('Uploading…', null);
  const r = await csrfFetch('settings-api.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ emblem_upload: dataUrl }) });
  const d = await r.json();
  if (d.error) return emMsg(d.error, false);
  _em = d.settings.emblem; emRender(); emMsg('Uploaded and saved.', true);
  input.value = '';
}
function emMsg(t, ok) { const el = document.getElementById('emMsg'); el.textContent = t; el.className = 'dh-msg ' + (ok === true ? 'ok' : ok === false ? 'bad' : ''); }
async function emSave() {
  emMsg('Saving…', null);
  const r = await csrfFetch('settings-api.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ settings: { emblem: { kind: _em.kind, id: _em.id, color: _em.color } } }) });
  const d = await r.json();
  if (d.error) return emMsg(d.error, false);
  _em = d.settings.emblem; emRender();
  emMsg('Saved. ' + (_emSlug ? 'See it on /tree/' + _emSlug : ''), true);
}
async function loadBackups() {
  const el = document.getElementById('bkList'); if (!el) return;
  const d = await csrfFetch('backup-export.php?list=1').then(r => r.json()).catch(() => ({ error: 'Could not load backups.' }));
  if (d.error) { el.textContent = d.error; return; }
  el.innerHTML = d.backups.length
    ? d.backups.map(b => `<a href="backup-export.php?file=${b.date}" style="display:inline-block;margin:0 12px 6px 0">${new Date(b.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</a><small>${b.kb} KB</small>`).join('<br>')
    : 'No weekly backups yet. The first one is made on the next weekly run.';
}
async function loadEmblem() {
  loadBackups();
  try {
    const r = await csrfFetch('settings-api.php'); const d = await r.json();
    if (d.settings && d.settings.emblem) _em = d.settings.emblem;
    _cover = (d.settings && d.settings.cover) || null;
    _emSlug = d.slug || '';
    _look = (d.settings && d.settings.theme) || 'heritage';
    const hc = document.getElementById('lkHindu');
    if (hc) hc.checked = d.settings && d.settings.hindu_calendar !== undefined ? !!d.settings.hindu_calendar : !(d.settings && d.settings.demo);
    emRender(); lkRender(); cvRender();
  } catch (e) { emMsg('Could not load: ' + e.message, false); }
}

/* ── Cover picture on member cards ─────────────────────────────────────────── */
let _cover = null;
function cvRender() {
  const img = document.getElementById('cvImg'); if (!img) return;
  img.style.backgroundImage = _cover ? `url('${_cover}')` : '';
  img.classList.toggle('has-img', !!_cover);
  document.getElementById('cvRemove').style.display = _cover ? '' : 'none';
  const em = document.getElementById('cvEmblem');
  em.innerHTML = _em.kind === 'builtin' ? ftEmblemSvg(_em.id, _em.color, 32) : (_em.kind === 'upload' && _em.url ? `<img src="${_em.url}" alt="">` : '');
}
function cvMsg(t, ok) { const el = document.getElementById('cvMsg'); el.textContent = t; el.className = 'dh-msg ' + (ok === true ? 'ok' : ok === false ? 'bad' : ''); }
// shrink to at most 1600 px wide as a JPEG before sending, so phone photos upload fast
function cvShrink(file) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file), im = new Image();
    im.onload = () => {
      const w = Math.min(1600, im.naturalWidth), h = Math.round(im.naturalHeight * w / im.naturalWidth);
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      c.getContext('2d').drawImage(im, 0, 0, w, h);
      URL.revokeObjectURL(url);
      res({ data: c.toDataURL('image/jpeg', 0.85), w: im.naturalWidth });
    };
    im.onerror = () => { URL.revokeObjectURL(url); rej(new Error('That file is not a picture we can read.')); };
    im.src = url;
  });
}
async function cvUpload(input) {
  const f = input.files && input.files[0]; input.value = ''; if (!f) return;
  try {
    cvMsg('Uploading…', null);
    const { data, w } = await cvShrink(f);
    if (w < 400) return cvMsg('Use a picture at least 400 pixels wide.', false);
    const d = await csrfFetch('settings-api.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cover_upload: data }) }).then(r => r.json());
    if (d.error) return cvMsg(d.error, false);
    _cover = d.settings.cover; cvRender(); cvMsg('Saved. It shows on every member card.', true);
  } catch (e) { cvMsg(e.message, false); }
}
async function cvRemove() {
  cvMsg('Removing…', null);
  const d = await csrfFetch('settings-api.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cover_remove: true }) }).then(r => r.json()).catch(e => ({ error: e.message }));
  if (d.error) return cvMsg(d.error, false);
  _cover = null; cvRender(); cvMsg('Removed. Cards use the tint of your tree look.', true);
}

/* ── Tree look: pick one of the presets in assets/tree-themes.js ─────────── */
let _look = 'heritage';
// a tiny two-generation tree drawn in the look's light and dark palettes
function lkSwatch(t) {
  const half = (p, x) => {
    const card = (cx, cy, fill) => `<rect x="${cx}" y="${cy}" width="34" height="30" rx="${Math.min(t.rx / 2, 8)}" fill="${fill}" stroke="${p.stroke}"/><circle cx="${cx + 17}" cy="${cy + 11}" r="6" fill="${fill === p.female ? p.avFemale : p.avMale}" stroke="${p.alive}" stroke-width="1.5"/><rect x="${cx + 8}" y="${cy + 21}" width="18" height="3" rx="1.5" fill="${p.text}"/>`;
    return `<g transform="translate(${x},0)"><rect width="100" height="90" fill="${p.bg}"/>
      <path d="M33 25H67" stroke="${p.couple}" stroke-width="1.5"/><path d="M50 25V48M27 48H73M27 48V54M73 48V54" stroke="${p.line}" stroke-width="1.5" fill="none"/>
      ${card(8, 10, p.male)}${card(58, 10, p.female)}${card(10, 54, p.hl)}${card(56, 54, p.male)}
      <circle cx="90" cy="9" r="4" fill="${p.accent}"/></g>`;
  };
  return `<svg viewBox="0 0 200 90" aria-hidden="true">${half(t.light, 0)}${half(t.dark, 100)}</svg>`;
}
function lkRender() {
  const T = window.FT_TREE_THEMES || {};
  document.getElementById('lkGrid').innerHTML = Object.keys(T).map(id => `
    <button type="button" class="lk-tile ${_look === id ? 'on' : ''}" role="radio" aria-checked="${_look === id}" onclick="lkPick('${id}')">
      ${lkSwatch(T[id])}<span><b style="font-family:${T[id].font.replace(/"/g, '&quot;')}">${T[id].name}</b><small>${T[id].note}</small></span>
    </button>`).join('');
}
function lkPick(id) { _look = id; lkRender(); }
async function lkSave() {
  const el = document.getElementById('lkMsg'); el.className = 'dh-msg'; el.textContent = 'Saving…';
  const d = await csrfFetch('settings-api.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ settings: { theme: _look, hindu_calendar: !!document.getElementById('lkHindu')?.checked } }) }).then(r => r.json()).catch(e => ({ error: e.message }));
  if (d.error) { el.className = 'dh-msg bad'; el.textContent = d.error; return; }
  _look = d.settings.theme; lkRender();
  el.className = 'dh-msg ok'; el.textContent = 'Saved. ' + (_emSlug ? 'See it on /tree/' + _emSlug : '');
}
