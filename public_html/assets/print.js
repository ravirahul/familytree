/**
 * assets/print.js - the printable poster (/tree/{slug}/poster) and family book (/tree/{slug}/book).
 *
 * Data comes only from the public APIs (api-family.php, api-media.php), so whatever
 * privacy the tree applies elsewhere applies here too.
 *
 * Poster: our own tidy layout (couple units, contour packing) drawn as one SVG in
 * millimetres, the same SVG is the on-screen preview and, through jsPDF + svg2pdf.js,
 * a vector PDF with the app's own TTF fonts embedded.
 * Book: plain HTML with print CSS; the browser's "Save as PDF" does the rest.
 */
(function () {
  'use strict';
  const SLUG = window.FT_TREE_SLUG, NAME = window.FT_TREE_NAME || 'Family Tree';
  const SET = window.FT_SETTINGS || {};
  const root = document.getElementById('pr-root');
  const SITE = location.host;
  const SERIF = 'PrSerif', SANS = 'PrSans';            // our TTFs, same names in the preview and the PDF
  const LIBS = {
    jspdf: 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js',
    svg2pdf: 'https://cdn.jsdelivr.net/npm/svg2pdf.js@2.2.4/dist/svg2pdf.umd.min.js',
  };
  const FONTS = { [SERIF]: '/assets/fonts/PlayfairDisplay-Bold.ttf', [SANS]: '/assets/fonts/PlusJakartaSans-Medium.ttf' };

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const year = d => { const m = /^(-?\d{3,4})/.exec(String(d || '')); return m ? +m[1] : null; };
  const hidden = p => !p || +p.is_private === 1;
  const THIS_YEAR = new Date().getFullYear();
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  function niceDate(d) {
    const m = /^(\d{3,4})(?:-(\d{2})(?:-(\d{2}))?)?/.exec(String(d || ''));
    if (!m) return '';
    if (m[2] && +m[2] && m[3] && +m[3]) return `${+m[3]} ${MONTHS[+m[2] - 1]} ${m[1]}`;
    if (m[2] && +m[2]) return `${MONTHS[+m[2] - 1]} ${m[1]}`;
    return m[1];
  }
  function lifeYears(p) {
    const b = year(p.birth_date), d = year(p.death_date);
    if (b && d) return `${b}–${d}`;
    if (b) return +p.is_alive ? `b. ${b}` : `${b}–`;
    if (d) return `d. ${d}`;
    return '';
  }
  const initial = n => (String(n || '?').trim()[0] || '?').toUpperCase();

  // ── data ───────────────────────────────────────────────────────────────────
  async function getJSON(url) {
    const r = await fetch(url, { credentials: 'same-origin' });
    if (!r.ok) throw new Error(r.status === 403 ? 'This tree is private.' : 'Could not load the tree (' + r.status + ').');
    return r.json();
  }
  function index(members) {
    const byId = new Map(), kids = new Map();
    members.forEach(p => byId.set(p.id, p));
    members.forEach(p => [p.fid, p.mid].forEach(par => {
      if (par != null && byId.has(par)) { if (!kids.has(par)) kids.set(par, []); kids.get(par).push(p.id); }
    }));
    const byBirth = (a, b) => (year(byId.get(a).birth_date) ?? 9999) - (year(byId.get(b).birth_date) ?? 9999);
    kids.forEach(list => list.sort(byBirth));
    const partners = p => [...new Set((p.pids || []).filter(id => byId.has(id) && id !== p.id))];
    const parents = p => [p.fid, p.mid].filter(id => id != null && byId.has(id));
    return { byId, kids, partners, parents, byBirth };
  }

  /** Generation number for every member: parents + 1, partners share a row, top = 0. */
  function generations(members, ix) {
    const g = new Map(members.map(p => [p.id, 0]));
    for (let pass = 0; pass < 40; pass++) {
      let changed = false;
      members.forEach(p => {
        const par = ix.parents(p);
        let v = par.length ? Math.max(...par.map(id => g.get(id))) + 1 : Math.max(0, ...ix.partners(p).filter(id => ix.parents(ix.byId.get(id)).length).map(id => g.get(id)));
        if (v > 60) v = 60;                                          // loops in bad data stop here
        if (v !== g.get(p.id)) { g.set(p.id, v); changed = true; }
      });
      if (!changed) break;
    }
    return g;
  }

  function countDesc(ix, id, seen = new Set()) {
    if (seen.has(id)) return 0; seen.add(id);
    let n = 1; (ix.kids.get(id) || []).forEach(k => { n += countDesc(ix, k, seen); });
    ix.partners(ix.byId.get(id)).forEach(pid => seen.add(pid));
    return n;
  }
  function countAnc(ix, id, seen = new Set()) {
    if (seen.has(id)) return 0; seen.add(id);
    let n = 1; ix.parents(ix.byId.get(id)).forEach(pid => { n += countAnc(ix, pid, seen); });
    return n;
  }
  function autoRoot(members, ix, dir) {
    let best = null, bestN = -1;
    members.forEach(p => {
      if (hidden(p)) return;
      if (dir === 'desc' && ix.parents(p).length) return;           // topmost ancestors only
      const n = dir === 'desc' ? countDesc(ix, p.id) : countAnc(ix, p.id);
      const by = year(p.birth_date) ?? (dir === 'desc' ? 9999 : -9999);
      const bb = best ? (year(best.birth_date) ?? (dir === 'desc' ? 9999 : -9999)) : 0;
      if (n > bestN || (n === bestN && (dir === 'desc' ? by < bb : by > bb))) { best = p; bestN = n; }
    });
    return best ? best.id : (members[0] && members[0].id);
  }

  // ── hide rules: "below X" / "above X", kept in the URL as ?hide=b21,a45 ──────
  // A rule cuts X off from its descendants (below) or its ancestors (above); everyone
  // who was linked to X before but can no longer be reached from X is hidden. So
  // spouses, in-laws and (for "above") siblings and cousins go with the cut side.
  const QS = new URLSearchParams(location.search);
  const RULES = (QS.get('hide') || '').split(',').map(s => /^([ab])(\d+)$/.exec(s)).filter(Boolean).map(m => ({ dir: m[1] === 'b' ? 'below' : 'above', id: +m[2] }));
  function neighbours(ix, id) {
    const p = ix.byId.get(id);
    return p ? [...ix.parents(p), ...(ix.kids.get(id) || []), ...ix.partners(p)] : [];
  }
  function reach(ix, start, blocked) {
    const seen = new Set([start]), todo = [start];
    while (todo.length) neighbours(ix, todo.pop()).forEach(n => { if (!seen.has(n) && !blocked.has(n)) { seen.add(n); todo.push(n); } });
    return seen;
  }
  function lineOf(ix, id, dir) {                                     // descendants or ancestors of id, not id itself
    const out = new Set(), todo = [id];
    while (todo.length) {
      const cur = todo.pop();
      (dir === 'below' ? ix.kids.get(cur) || [] : ix.parents(ix.byId.get(cur))).forEach(n => { if (n !== id && !out.has(n)) { out.add(n); todo.push(n); } });
    }
    return out;
  }
  function hiddenByRules(ix) {
    const gone = new Set();
    RULES.forEach(r => {
      if (!ix.byId.has(r.id)) return;
      const before = reach(ix, r.id, new Set()), after = reach(ix, r.id, lineOf(ix, r.id, r.dir));
      before.forEach(id => { if (!after.has(id)) gone.add(id); });
    });
    return gone;
  }
  /** Members left after the hide rules, and an index over just them. */
  function applyRules(members, ixAll) {
    const gone = hiddenByRules(ixAll);
    const kept = members.filter(p => !gone.has(p.id));
    return { kept, ix: index(kept) };
  }
  /** Keep the URL (and the kind tabs) in step, so a copied link prints the same thing. */
  function syncUrl(extra = {}) {
    const q = new URLSearchParams(location.search);
    ['slug', 'kind'].forEach(k => q.delete(k));
    const hide = RULES.map(r => r.dir[0] + r.id).join(',');
    hide ? q.set('hide', hide) : q.delete('hide');
    Object.entries(extra).forEach(([k, v]) => (v == null || v === '' ? q.delete(k) : q.set(k, v)));
    const s = q.toString();
    history.replaceState(null, '', location.pathname + (s ? '?' + s : ''));
    document.querySelectorAll('.pr-tabs a').forEach(a => {
      const u = new URL(a.href, location.href);
      hide ? u.searchParams.set('hide', hide) : u.searchParams.delete('hide');
      a.href = u.pathname + u.search;
    });
  }
  const shortName = p => (p ? String(p.name || 'Unknown').split(',')[0] : 'someone');
  /** The "Hide people" block for every options panel. */
  function hidePanel(members) {
    const people = members.filter(p => !hidden(p)).sort((a, b) => String(a.name).localeCompare(String(b.name)));
    return `<fieldset class="pr-field pr-hide"><legend>Hide people</legend>
        <label class="pr-sub" for="hdWho">Pick a person</label>
        <input id="hdWho" list="hdPeople" autocomplete="off" placeholder="Type a name…">
        <datalist id="hdPeople">${people.map(p => `<option value="${esc(p.name + (lifeYears(p) ? ' (' + lifeYears(p) + ')' : ''))}"></option>`).join('')}</datalist>
        <div class="pr-hide-btns">
          <button type="button" class="pr-btn2" data-hd="below">Hide everyone below</button>
          <button type="button" class="pr-btn2" data-hd="above">Hide everyone above</button>
        </div>
        <p class="pr-hint" id="hdHint">Below hides their children's lines. Above hides their parents' side.</p>
        <ul class="pr-chips" id="hdChips" aria-label="Hide rules"></ul>
        <p class="pr-count" id="hdCount" role="status" aria-live="polite"></p>
      </fieldset>`;
  }
  /** Wires the block; onChange() re-renders. Returns refresh(kept) to update the count. */
  function wireHide(members, ixAll, onChange) {
    const $ = id => document.getElementById(id);
    const byLabel = new Map(members.filter(p => !hidden(p)).map(p => [p.name + (lifeYears(p) ? ' (' + lifeYears(p) + ')' : ''), p.id]));
    const pick = () => {
      const v = $('hdWho').value.trim();
      if (byLabel.has(v)) return byLabel.get(v);
      const hit = members.filter(p => !hidden(p) && String(p.name).toLowerCase() === v.toLowerCase());
      return hit.length ? hit[0].id : null;
    };
    const chips = () => {
      $('hdChips').innerHTML = RULES.map((r, i) => `<li><span>${r.dir === 'below' ? 'Below' : 'Above'} ${esc(shortName(ixAll.byId.get(r.id)))}</span><button type="button" data-rm="${i}" aria-label="Remove rule: ${r.dir} ${esc(shortName(ixAll.byId.get(r.id)))}">×</button></li>`).join('');
    };
    document.querySelectorAll('[data-hd]').forEach(b => {
      b.onclick = () => {
        const id = pick();
        if (id == null) { $('hdHint').textContent = 'Pick a name from the list first.'; $('hdWho').focus(); return; }
        if (!RULES.some(r => r.id === id && r.dir === b.dataset.hd)) RULES.push({ dir: b.dataset.hd, id });
        $('hdWho').value = ''; $('hdHint').textContent = 'Added. Pick another person to hide more.';
        chips(); onChange();
      };
    });
    $('hdWho').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); document.querySelector('[data-hd=below]').click(); } });
    $('hdChips').onclick = e => {
      const b = e.target.closest('[data-rm]'); if (!b) return;
      RULES.splice(+b.dataset.rm, 1); chips(); onChange();
      $('hdWho').focus();
    };
    chips();
    return kept => { $('hdCount').textContent = `Showing ${kept.length} of ${members.length} people`; };
  }
  /** @page rules differ per kind, so they are set here rather than in print.css. */
  function setPage(css) {
    let el = document.getElementById('prPage');
    if (!el) { el = document.createElement('style'); el.id = 'prPage'; document.head.appendChild(el); }
    el.textContent = css;
  }
  /** Resolves once every <img> inside el has loaded or failed (failed ones are removed). */
  function waitImages(el, progress) {
    const imgs = [...el.querySelectorAll('img')];
    let done = 0;
    return new Promise(ok => {
      if (!imgs.length) return ok();
      const tick = () => { done++; progress && progress(done, imgs.length); if (done >= imgs.length) ok(); };
      imgs.forEach(im => {
        if (im.complete && im.naturalWidth) return tick();
        im.addEventListener('load', tick, { once: true });
        im.addEventListener('error', () => { (im.closest('figure') || im).remove(); tick(); }, { once: true });
        if (im.complete) { (im.closest('figure') || im).remove(); tick(); }
      });
    });
  }
  const PAGES = { A4: [210, 297], Letter: [216, 279], A3: [297, 420] };

  // ── fonts, images, libs ──────────────────────────────────────────────────────
  const fontB64 = {};
  async function loadFonts() {
    await Promise.all(Object.entries(FONTS).map(async ([fam, url]) => {
      const buf = await (await fetch(url)).arrayBuffer();
      const ff = new FontFace(fam, buf); await ff.load(); document.fonts.add(ff);
      let s = ''; const b = new Uint8Array(buf);
      for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
      fontB64[fam] = btoa(s);
    }));
  }
  const ctx = document.createElement('canvas').getContext('2d');
  const textW = (t, px, fam) => { ctx.font = `${px}px ${fam}`; return ctx.measureText(t).width; };

  const imgCache = new Map();                                       // url -> Promise<dataURL|null>
  function photo(url, size = 200, square = true) {
    if (!url) return Promise.resolve(null);
    if (!imgCache.has(url + size)) imgCache.set(url + size, (async () => {
      try {
        const u = new URL(url, location.href);
        if (u.origin !== location.origin) return null;               // same-origin only: no tainted canvas, no tracking
        const r = await fetch(u.href, { credentials: 'same-origin' });
        if (!r.ok) return null;
        const bmp = await createImageBitmap(await r.blob());
        const c = document.createElement('canvas');
        if (square) {
          const s = Math.min(bmp.width, bmp.height);
          c.width = c.height = Math.min(size, s);
          // portraits: keep the top of the frame (faces), centre sideways
          const sx = (bmp.width - s) / 2, sy = bmp.height > bmp.width ? Math.min((bmp.height - s) * 0.2, bmp.height - s) : 0;
          c.getContext('2d').drawImage(bmp, sx, sy, s, s, 0, 0, c.width, c.height);
        } else {
          const k = Math.min(1, size / Math.max(bmp.width, bmp.height));
          c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
          c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
        }
        return c.toDataURL(square ? 'image/jpeg' : 'image/png', 0.86);
      } catch (e) { return null; }
    })());
    return imgCache.get(url + size);
  }
  async function pool(items, n, fn) {
    let i = 0; await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) await fn(items[i++]); }));
  }
  function loadScript(src) {
    return new Promise((ok, fail) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => fail(new Error('Could not load ' + src)); document.head.appendChild(s); });
  }

  // ── emblem (inline SVG, or the uploaded image as a data URL) ────────────────
  async function emblemSvg(x, y, size, color) {
    const e = SET.emblem || {};
    if (e.kind === 'builtin' && window.ftEmblemSvg) {
      const inner = window.ftEmblemSvg(e.id, e.color).replace(/^<svg[^>]*>|<\/svg>$/g, '').replace(/currentColor/g, e.color || color);
      return `<g transform="translate(${x} ${y}) scale(${size / 100})">${inner}</g>`;
    }
    if (e.kind === 'upload' && e.url) {
      const d = await photo(e.url, 512, false);
      if (d) return `<image x="${x}" y="${y}" width="${size}" height="${size}" href="${d}" preserveAspectRatio="xMidYMid meet"/>`;
    }
    return '';
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  POSTER
  // ═════════════════════════════════════════════════════════════════════════
  // Two chart shapes. "Down": tall cards, generations as rows. "Across": short wide cards,
  // generations as columns, which packs about twice the people into the same breadth.
  // Layout code works in (breadth, depth); BW/BD are a card's size along each.
  const SHAPES = {
    down:   { BW: 132, BD: 140, GAP_C: 16, GAP_SIB: 16, GAP_FAM: 26, PITCH: 206, across: false },
    across: { BW: 58, BD: 214, GAP_C: 8, GAP_SIB: 10, GAP_FAM: 18, PITCH: 270, across: true },
  };
  let G = SHAPES.down;
  const PAPERS = { A3: [297, 420], A2: [420, 594], A1: [594, 841], A0: [841, 1189] };
  const NAME_PX = 14.5;
  const MIN_PT = 7, MAX_PT = 15;                                    // names: smallest readable size, largest we bother with

  /** Descendant tree as couple units: { cards:[ids], main:index, kids:[unit], anchor:x } */
  function buildDesc(ix, rootId, maxGen) {
    const placed = new Set();
    function unit(id, depth) {
      placed.add(id);
      const p = ix.byId.get(id), parts = ix.partners(p);
      // two or more partners: one on each side; else person then partner
      const cards = parts.length >= 2 ? [parts[0], id, ...parts.slice(1)] : [id, ...parts];
      const main = cards.indexOf(id);
      const u = { cards, main, kids: [], depth };
      if (maxGen && depth + 1 >= maxGen) return u;
      const kids = (ix.kids.get(id) || []).filter(k => !placed.has(k));
      kids.forEach(k => placed.add(k));
      const groups = new Map();                                      // card index of other parent (or main) -> kids
      kids.forEach(k => {
        const c = ix.byId.get(k), other = c.fid === id ? c.mid : c.fid;
        const ci = other != null ? cards.indexOf(other) : -1;
        const key = ci > -1 && ci !== main ? ci : main;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(k);
      });
      [...groups.keys()].sort((a, b) => anchorX(u, a) - anchorX(u, b)).forEach(key => {
        groups.get(key).forEach(k => { const c = unit(k, depth + 1); c.anchorKey = key; u.kids.push(c); });
      });
      return u;
    }
    return unit(rootId, 0);
  }
  /** Ancestor tree: each person a unit, parents (father, mother) as its "kids", drawn upwards. */
  function buildAnc(ix, rootId, maxGen) {
    const seen = new Set();
    function unit(id, depth) {
      seen.add(id);
      const u = { cards: [id], main: 0, kids: [], depth };
      if (maxGen && depth + 1 >= maxGen) return u;
      ix.parents(ix.byId.get(id)).forEach(pid => { if (!seen.has(pid)) { const c = unit(pid, depth + 1); c.anchorKey = 0; u.kids.push(c); } });
      return u;
    }
    return unit(rootId, 0);
  }
  const unitW = u => u.cards.length * G.BW + (u.cards.length - 1) * G.GAP_C;
  const cardX = (u, i) => -unitW(u) / 2 + i * (G.BW + G.GAP_C);        // near edge along the breadth, relative to unit centre
  function anchorX(u, key) {                                          // where a child group hangs from
    const cx = i => cardX(u, i) + G.BW / 2;
    if (key === u.main) return cx(u.main);
    if (Math.abs(key - u.main) === 1) return (cx(key) + cx(u.main)) / 2;
    return cx(key);
  }

  /**
   * Children become "slots": a subtree, or (when stack > 1) a column of up to `stack`
   * childless siblings hung off a spine, which keeps big families from getting too wide.
   */
  const INDENT = 18;
  function slotsOf(u, stack) {
    const slots = [];
    // only families whose children are all childless: a column elsewhere would block the cousins below it
    const allLeaves = stack > 1 && u.kids.length > 2 && u.kids.every(k => !k.kids.length);
    u.kids.forEach(k => {
      const prev = slots[slots.length - 1];
      const leaf = allLeaves && !k.kids.length;
      if (leaf && prev && prev.stack && prev.anchorKey === k.anchorKey && prev.units.length < stack) prev.units.push(k);
      else slots.push({ units: [k], stack: leaf, anchorKey: k.anchorKey });
    });
    // a "column" of one is just a card
    slots.forEach(s => { if (s.stack && s.units.length === 1) s.stack = false; s.w = s.stack ? INDENT + Math.max(...s.units.map(unitW)) : 0; });
    return slots;
  }
  const slotMain = s => s.stack ? -s.w / 2 + INDENT / 2 : cardX(s.units[0], s.units[0].main) + G.BW / 2;

  /** Tidy layout with contour packing. Sets slot.off (x of slot centre relative to the parent unit centre). */
  function layout(u, stack) {
    const w = unitW(u);
    const own = [{ l: -w / 2, r: w / 2 }];
    u.slots = slotsOf(u, stack);
    if (!u.slots.length) return (u.contour = own);
    let acc = null; const offs = [];
    u.slots.forEach(s => {
      const c = s.stack ? s.units.map(() => ({ l: -s.w / 2, r: s.w / 2 })) : layout(s.units[0], stack);
      if (!acc) { offs.push(0); acc = c.map(e => ({ ...e })); return; }
      let shift = -Infinity;
      for (let d = 0; d < Math.min(acc.length, c.length); d++) shift = Math.max(shift, acc[d].r - c[d].l + (d === 0 ? G.GAP_SIB : G.GAP_FAM));
      offs.push(shift);
      c.forEach((e, d) => {
        if (d < acc.length) { acc[d].l = Math.min(acc[d].l, e.l + shift); acc[d].r = Math.max(acc[d].r, e.r + shift); }
        else acc.push({ l: e.l + shift, r: e.r + shift });
      });
    });
    // centre the children (by their own blood-line card) under the point they hang from
    const first = u.slots[0], last = u.slots[u.slots.length - 1];
    const mid = (offs[0] + slotMain(first) + offs[offs.length - 1] + slotMain(last)) / 2;
    const target = (anchorX(u, first.anchorKey) + anchorX(u, last.anchorKey)) / 2;
    const dx = target - mid;
    u.slots.forEach((s, i) => { s.off = offs[i] + dx; });
    return (u.contour = own.concat(acc.map(e => ({ l: e.l + dx, r: e.r + dx }))));
  }
  function place(u, x, row, list = []) {
    u.x = x; u.row = row; list.push(u);
    u.slots.forEach(s => {
      const sx = x + s.off;
      s.x = sx;
      if (s.stack) s.units.forEach((m, j) => { m.slots = []; m.x = sx - s.w / 2 + INDENT + unitW(m) / 2; m.row = row + 1 + j; list.push(m); });
      else place(s.units[0], sx, row + 1, list);
    });
    return list;
  }

  /** Two lines at most; titles after a comma go first when space is short. */
  function nameLines(name, px, maxW) {
    const fit = t => textW(t, px, SERIF) <= maxW;
    const wrap = text => {
      const words = text.split(/\s+/); const lines = [''];
      words.forEach(w => { const t = lines[lines.length - 1] ? lines[lines.length - 1] + ' ' + w : w; if (fit(t) || !lines[lines.length - 1]) lines[lines.length - 1] = t; else lines.push(w); });
      return lines;
    };
    let lines = wrap(name);
    if (lines.length > 2 && name.includes(',')) lines = wrap(name.split(',')[0]);
    if (lines.length > 2) { lines = lines.slice(0, 2); lines[1] += '…'; }
    lines = lines.map(l => { if (fit(l)) return l; let s = l.replace(/…$/, ''); while (s.length > 1 && !fit(s + '…')) s = s.slice(0, -1); return s + '…'; });
    return lines;
  }

  /** The chart in px units. Returns { svg, w, h, ids:Set, gens }. */
  function drawChart(tree, ix, pal, photos, dir, stack, shape) {
    G = SHAPES[shape];
    layout(tree, dir === 'anc' ? 1 : stack);
    const units = place(tree, 0, 0);
    let minB = Infinity, maxB = -Infinity, maxD = 0, maxGen = 0;
    units.forEach(u => { const w = unitW(u); minB = Math.min(minB, u.x - w / 2); maxB = Math.max(maxB, u.x + w / 2); maxD = Math.max(maxD, u.row); maxGen = Math.max(maxGen, u.depth); });
    const pad = 8, BRE = maxB - minB + pad * 2, DEP = maxD * G.PITCH + G.BD + pad * 2;
    const flip = dir === 'anc' && !G.across;                          // ancestors grow upwards on a "down" chart
    const B = b => b - minB + pad;                                    // breadth -> chart px
    const D = r => pad + (flip ? maxD - r : r) * G.PITCH;             // row -> near edge along the depth
    const P = (b, d) => G.across ? `${d} ${b}` : `${b} ${d}`;         // (breadth, depth) -> "x y"
    const rx = Math.min(pal.rx || 10, G.across ? 10 : 16);
    const ids = new Set();
    let lines = '', cards = '', clips = '', n = 0;
    const gap = G.PITCH - G.BD, sgn = flip ? -1 : 1;

    units.forEach(u => {
      const near = D(u.row), left = B(u.x);
      const out = flip ? near : near + G.BD;                          // the edge the next generation leaves from
      if (u.slots.length) {
        const groups = new Map();
        u.slots.forEach(s => { if (!groups.has(s.anchorKey)) groups.set(s.anchorKey, []); groups.get(s.anchorKey).push(s); });
        let gi = 0;
        groups.forEach((ss, key) => {
          const ab = left + anchorX(u, key);
          const sb = s => B(s.x) + slotMain(s);
          const bs = ss.map(sb).concat(ab);
          const bus = out + sgn * (gap / 2 + gi * 5), end = out + sgn * gap;
          let d = `M${P(ab, out)}L${P(ab, bus)}M${P(Math.min(...bs), bus)}L${P(Math.max(...bs), bus)}`;
          ss.forEach(s => {
            if (!s.stack) { d += `M${P(sb(s), bus)}L${P(sb(s), end)}`; return; }
            // spine alongside the column, a short tick into each card
            const mid = m => D(m.row) + G.BD / 2;
            d += `M${P(sb(s), bus)}L${P(sb(s), mid(s.units[s.units.length - 1]))}`;
            s.units.forEach(m => { d += `M${P(sb(s), mid(m))}L${P(B(m.x) - unitW(m) / 2, mid(m))}`; });
          });
          lines += `<path d="${d}"/>`;
          gi++;
        });
      }
      // couple links
      u.cards.forEach((id, i) => {
        if (i === u.main) return;
        const a = Math.min(i, u.main), b = Math.max(i, u.main), adj = b - a === 1;
        const b1 = left + cardX(u, adj ? a : b - 1) + G.BW, b2 = left + cardX(u, b), dm = near + (G.across ? 29 : G.BD / 2);
        lines += `<path d="M${P(b1, dm)}L${P(b2, dm)}" stroke="${pal.couple}"${adj ? '' : ' stroke-dasharray="3 3"'}/>`;
        const [cx, cy] = P((b1 + b2) / 2, dm).split(' ');
        cards += `<circle cx="${cx}" cy="${cy}" r="${G.across ? 2.6 : 3.6}" fill="${pal.card}" stroke="${pal.couple}" stroke-width="1.3"/>`;
      });
      // cards
      u.cards.forEach((id, i) => {
        const p = ix.byId.get(id); ids.add(id);
        const [x, y] = P(left + cardX(u, i), near).split(' ').map(Number);
        const w = G.across ? G.BD : G.BW, h = G.across ? G.BW : G.BD;
        const priv = hidden(p), female = String(p.gender || '').toLowerCase().startsWith('f');
        cards += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${pal.card}" stroke="${pal.stroke}" stroke-width="1"/>`;
        const r = G.across ? 20 : 26, ax = G.across ? x + 29 : x + w / 2, ay = G.across ? y + h / 2 : y + 40;
        const img = !priv && photos && photos.get(id);
        if (img) {
          const cid = 'c' + (n++);
          clips += `<clipPath id="${cid}"><circle cx="${ax}" cy="${ay}" r="${r}"/></clipPath>`;
          cards += `<image x="${ax - r}" y="${ay - r}" width="${r * 2}" height="${r * 2}" href="${img}" clip-path="url(#${cid})" preserveAspectRatio="xMidYMid slice"/>`;
          cards += `<circle cx="${ax}" cy="${ay}" r="${r}" fill="none" stroke="${pal.stroke}" stroke-width="1.2"/>`;
        } else {
          cards += `<circle cx="${ax}" cy="${ay}" r="${r}" fill="${female ? pal.avFemale : pal.avMale}"/>`;
          cards += `<text x="${ax}" y="${ay + r * 0.3}" text-anchor="middle" font-family="${SERIF}" font-size="${r * 0.85}" fill="${pal.muted}">${esc(priv ? '·' : initial(p.name))}</text>`;
        }
        const yrs = priv ? '' : lifeYears(p);
        const nm = nameLines(priv ? 'Private' : (p.name || 'Unknown'), NAME_PX, G.across ? w - 66 : w - 14);
        if (G.across) {
          const tx = x + 58, lh = 16, block = nm.length * lh + (yrs ? 13 : 0);
          let ty = y + (h - block) / 2 + 12;
          nm.forEach(l => { cards += `<text x="${tx}" y="${ty}" font-family="${SERIF}" font-size="${NAME_PX}" fill="${pal.text}">${esc(l)}</text>`; ty += lh; });
          if (yrs) cards += `<text x="${tx}" y="${ty + 1}" font-family="${SANS}" font-size="10.5" fill="${pal.muted}">${esc(yrs)}</text>`;
        } else {
          const cx = x + w / 2, ny = nm.length === 1 ? y + 94 : y + 87;
          nm.forEach((l, j) => { cards += `<text x="${cx}" y="${ny + j * 17}" text-anchor="middle" font-family="${SERIF}" font-size="${NAME_PX}" fill="${pal.text}">${esc(l)}</text>`; });
          if (yrs) cards += `<text x="${cx}" y="${ny + (nm.length - 1) * 17 + 21}" text-anchor="middle" font-family="${SANS}" font-size="11" fill="${pal.muted}">${esc(yrs)}</text>`;
        }
      });
    });
    const svg = `<defs>${clips}</defs><g fill="none" stroke="${pal.line}" stroke-width="1.3" stroke-linejoin="round" stroke-linecap="round">${lines}</g><g>${cards}</g>`;
    return G.across ? { svg, w: DEP, h: BRE, ids, gens: maxGen + 1 } : { svg, w: BRE, h: DEP, ids, gens: maxGen + 1 };
  }

  /** Best orientation and scale (mm per chart px) for a paper size. */
  function fitPaper(chart, size, head) {
    if (size === 'banner') {                                         // roll paper: 841 mm tall, as long as the tree needs
      const H = 841, L0 = frame(H * 2, H, head);
      let s = Math.min(L0.ah / chart.h, 9 * 25.4 / 72 / NAME_PX);
      const W = Math.round(Math.min(5000, Math.max(1189, chart.w * s + 2 * L0.m + 8 * L0.u)));
      const L = frame(W, H, head);
      s = Math.min(s, L.aw / chart.w, L.ah / chart.h);
      return { W, H, s, L, land: true, size: 'Banner', namePt: NAME_PX * s * 72 / 25.4 };
    }
    let best = null;
    [false, true].forEach(land => {
      const [a, b] = PAPERS[size], W = land ? b : a, H = land ? a : b;
      const L = frame(W, H, head);
      const s = Math.min(L.aw / chart.w, L.ah / chart.h);
      if (!best || s > best.s) best = { W, H, s, L, land, size };
    });
    best.namePt = NAME_PX * best.s * 72 / 25.4;
    return best;
  }
  function frame(W, H, head) {
    const u = Math.min(W, H) / 297;                                  // 1 at A3
    const m = 16 * u;
    const headH = (head.emblem ? 24 : 0) * u + (head.tagline ? 42 : 36) * u;
    const footH = 12 * u;
    return { u, m, headH, footH, ax: m + 4 * u, ay: m + headH, aw: W - 2 * m - 8 * u, ah: H - 2 * m - headH - footH };
  }
  function choosePaper(chart, want, head) {
    if (want !== 'auto') return fitPaper(chart, want, head);
    let pick = null;
    for (const size of Object.keys(PAPERS)) { pick = fitPaper(chart, size, head); if (pick.namePt >= MIN_PT) break; }
    return pick;
  }

  async function composePage(chart, fit, pal, head) {
    const { W, H, L } = fit, u = L.u;
    const s = Math.min(fit.s, MAX_PT * 25.4 / 72 / NAME_PX);           // small trees don't balloon
    const cw = chart.w * s, ch = chart.h * s;
    const tx = L.ax + (L.aw - cw) / 2, ty = L.ay + Math.max(0, (L.ah - ch) / 2.4);
    let y = L.m + 6 * u, out = '';
    out += `<rect x="0" y="0" width="${W}" height="${H}" fill="${pal.bg}"/>`;
    out += `<rect x="${L.m * 0.55}" y="${L.m * 0.55}" width="${W - L.m * 1.1}" height="${H - L.m * 1.1}" fill="none" stroke="${pal.accent}" stroke-width="${0.5 * u}" opacity=".55"/>`;
    out += `<rect x="${L.m * 0.55 + 1.6 * u}" y="${L.m * 0.55 + 1.6 * u}" width="${W - L.m * 1.1 - 3.2 * u}" height="${H - L.m * 1.1 - 3.2 * u}" fill="none" stroke="${pal.accent}" stroke-width="${0.2 * u}" opacity=".45"/>`;
    if (head.emblem) { const es = 20 * u; out += await emblemSvg(W / 2 - es / 2, y, es, pal.accent); y += es + 4 * u; }
    y += 13 * u;
    out += `<text x="${W / 2}" y="${y}" text-anchor="middle" font-family="${SERIF}" font-size="${15 * u}" fill="${pal.text}">${esc(head.title)}</text>`;
    y += 8 * u;
    out += `<text x="${W / 2}" y="${y}" text-anchor="middle" font-family="${SANS}" font-size="${4.3 * u}" fill="${pal.accent}">${esc(head.sub)}</text>`;
    if (head.tagline) { y += 6 * u; out += `<text x="${W / 2}" y="${y}" text-anchor="middle" font-family="${SANS}" font-size="${3.6 * u}" fill="${pal.muted}">${esc(head.tagline)}</text>`; }
    const ry = L.ay - 5 * u;
    out += `<path d="M${W / 2 - 30 * u} ${ry}H${W / 2 - 4 * u}M${W / 2 + 4 * u} ${ry}H${W / 2 + 30 * u}" stroke="${pal.line}" stroke-width="${0.35 * u}"/><circle cx="${W / 2}" cy="${ry}" r="${1.1 * u}" fill="${pal.accent}"/>`;
    out += `<g transform="translate(${tx} ${ty}) scale(${s})">${chart.svg}</g>`;
    out += `<text x="${W / 2}" y="${H - L.m - 1 * u}" text-anchor="middle" font-family="${SANS}" font-size="${3 * u}" fill="${pal.muted}">Made with FamilyTree · ${SITE}</text>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${W} ${H}" width="${W}mm" height="${H}mm">${out}</svg>`;
  }

  async function poster(members, ixAll) {
    const looks = window.FT_TREE_THEMES || {};
    const visible = members.filter(p => !hidden(p));
    const st = { root: 'auto', dir: 'desc', shape: 'auto', gens: 0, paper: 'auto', photos: true, look: SET.theme && looks[SET.theme] ? SET.theme : 'heritage' };
    if (/^\d+$/.test(QS.get('from') || '') && ixAll.byId.has(+QS.get('from'))) st.root = QS.get('from');
    if (QS.get('show') === 'anc') st.dir = 'anc';
    if ([2, 3, 4, 5, 6, 7, 8, 10, 12].includes(+QS.get('gens'))) st.gens = +QS.get('gens');
    const people = visible.slice().sort((a, b) => String(a.name).localeCompare(String(b.name)));
    root.innerHTML = `
      <aside class="pr-panel" aria-label="Poster options">
        <h1>Tree poster</h1>
        <p class="pr-lede">One large chart of the family, ready to print.</p>
        <label class="pr-field"><span>Start from</span>
          <select id="poRoot"><option value="auto">Automatic</option>${people.map(p => `<option value="${p.id}"${String(p.id) === st.root ? ' selected' : ''}>${esc(p.name)}${lifeYears(p) ? ' (' + esc(lifeYears(p)) + ')' : ''}</option>`).join('')}</select></label>
        <fieldset class="pr-field pr-seg"><legend>Show</legend>
          <label><input type="radio" name="poDir" value="desc"${st.dir === 'desc' ? ' checked' : ''}><span>Descendants</span></label>
          <label><input type="radio" name="poDir" value="anc"${st.dir === 'anc' ? ' checked' : ''}><span>Ancestors</span></label></fieldset>
        ${hidePanel(members)}
        <label class="pr-field"><span>Layout</span>
          <select id="poShape"><option value="auto">Automatic</option><option value="down">Top to bottom</option><option value="across">Left to right</option></select></label>
        <label class="pr-field"><span>Generations</span>
          <select id="poGens"><option value="0">All</option>${[2, 3, 4, 5, 6, 7, 8, 10, 12].map(n => `<option value="${n}"${n === st.gens ? ' selected' : ''}>${n}</option>`).join('')}</select></label>
        <label class="pr-field"><span>Paper</span>
          <select id="poPaper"><option value="auto">Automatic</option>${Object.keys(PAPERS).map(k => `<option value="${k}">${k} · ${PAPERS[k][0]} × ${PAPERS[k][1]} mm</option>`).join('')}<option value="banner">Long banner · 841 mm tall, roll paper</option></select></label>
        <label class="pr-field"><span>Look</span>
          <select id="poLook">${Object.keys(looks).map(k => `<option value="${k}"${k === st.look ? ' selected' : ''}>${esc(looks[k].name)}</option>`).join('')}</select></label>
        <label class="pr-check"><input type="checkbox" id="poPhotos" checked><span>Include photos</span></label>
        <button type="button" class="pr-btn" id="poDownload" disabled>Download PDF</button>
        <p class="pr-status" id="poStatus" role="status" aria-live="polite">Laying out the tree…</p>
      </aside>
      <section class="pr-stage" aria-label="Preview"><div class="pr-paper" id="poPreview"></div></section>`;
    const $ = id => document.getElementById(id);
    const status = t => { $('poStatus').innerHTML = t; };
    let current = null, busy = 0;

    let refreshCount = () => {};
    async function render() {
      const job = ++busy;
      syncUrl({ from: st.root === 'auto' ? null : st.root, show: st.dir === 'anc' ? 'anc' : null, gens: st.gens || null });
      const pal = window.ftTreePalette(st.look);
      const { kept, ix } = applyRules(members, ixAll);
      refreshCount(kept);
      const rootHidden = st.root !== 'auto' && !ix.byId.has(+st.root);
      const rootId = st.root === 'auto' || rootHidden ? autoRoot(kept, ix, st.dir) : +st.root;
      if (rootId == null || !ix.byId.has(rootId)) { status('No one left to draw. Remove a hide rule.'); $('poPreview').innerHTML = ''; return; }
      const tree = st.dir === 'desc' ? buildDesc(ix, rootId, st.gens) : buildAnc(ix, rootId, st.gens);
      // photos for everyone on the chart (cached after the first time)
      const onChart = []; (function walk(u) { u.cards.forEach(id => onChart.push(id)); u.kids.forEach(walk); })(tree);
      const photos = new Map();
      if (st.photos) {
        const withImg = onChart.filter(id => ix.byId.get(id).img && !hidden(ix.byId.get(id)));
        let done = 0;
        await pool(withImg, 8, async id => {
          const d = await photo(ix.byId.get(id).img, 160);
          if (d) photos.set(id, d);
          if (++done % 20 === 0 && job === busy) status(`Fetching photos ${done} of ${withImg.length}…`);
        });
      }
      if (job !== busy) return;
      // wide families: try hanging childless siblings in columns, keep whichever prints largest
      const headGuess = { emblem: (SET.emblem || {}).kind && SET.emblem.kind !== 'none', tagline: SET.tagline };
      let chart = null, bestS = 0;
      for (const shape of st.shape === 'auto' ? ['down', 'across'] : [st.shape]) for (const stack of st.dir === 'anc' ? [1] : [1, 2, 3, 4, 6]) {
        const c = drawChart(tree, ix, pal, photos, st.dir, stack, shape);
        const s = fitPaper(c, st.paper === 'auto' ? 'A0' : st.paper, headGuess).s;
        if (s > bestS * 1.04) { chart = c; bestS = s; }
      }
      const yearsAll = [...chart.ids].map(id => ix.byId.get(id)).filter(p => !hidden(p));
      const ys = []; let alive = false;
      yearsAll.forEach(p => { const b = year(p.birth_date), d = year(p.death_date); if (b) ys.push(b); if (d) ys.push(d); if (+p.is_alive) alive = true; });
      if (alive && ys.length) ys.push(THIS_YEAR);
      const span = ys.length ? `${Math.min(...ys)}–${Math.max(...ys)}` : '';
      const rp = ix.byId.get(rootId);
      const head = {
        emblem: (SET.emblem || {}).kind && SET.emblem.kind !== 'none',
        title: NAME,
        sub: [`${chart.ids.size} ${chart.ids.size === 1 ? 'person' : 'people'}`, `${chart.gens} generation${chart.gens === 1 ? '' : 's'}`, span].filter(Boolean).join('  ·  ')
          + (st.root !== 'auto' || st.dir === 'anc' ? `  ·  ${st.dir === 'anc' ? 'ancestors of' : 'from'} ${rp.name}` : ''),
        tagline: SET.tagline || '',
      };
      const fit = choosePaper(chart, st.paper, head);
      const svg = await composePage(chart, fit, pal, head);
      if (job !== busy) return;
      $('poPreview').innerHTML = svg;
      $('poPreview').style.aspectRatio = `${fit.W} / ${fit.H}`;
      current = { fit, pal };
      const pt = Math.min(fit.namePt, MAX_PT);
      const warn = fit.namePt < MIN_PT ? `<br><b>Names will print small.</b> Try fewer generations, start from someone further down, or pick Long banner for a print shop roll.` : '';
      const note = rootHidden ? '<br><b>Your start person is hidden by a rule</b>, so the chart starts automatically.' : '';
      status(`${fit.size === 'Banner' ? 'Long banner' : fit.size + (fit.land ? ' landscape' : ' portrait')} · ${fit.W} × ${fit.H} mm · names print at about ${pt.toFixed(pt < 10 ? 1 : 0)} pt${warn}${note}`);
      $('poDownload').disabled = false;
    }
    let t = null;
    const later = () => { clearTimeout(t); $('poDownload').disabled = true; t = setTimeout(render, 120); };
    $('poRoot').onchange = e => { st.root = e.target.value; later(); };
    document.querySelectorAll('input[name=poDir]').forEach(r => { r.onchange = e => { st.dir = e.target.value; later(); }; });
    $('poShape').onchange = e => { st.shape = e.target.value; later(); };
    $('poGens').onchange = e => { st.gens = +e.target.value; later(); };
    $('poPaper').onchange = e => { st.paper = e.target.value; later(); };
    $('poLook').onchange = e => { st.look = e.target.value; later(); };
    $('poPhotos').onchange = e => { st.photos = e.target.checked; later(); };
    refreshCount = wireHide(members, ixAll, later);

    $('poDownload').onclick = async () => {
      if (!current) return;
      const btn = $('poDownload'); btn.disabled = true; const label = btn.textContent; btn.textContent = 'Making the PDF…';
      try {
        if (!window.jspdf) await loadScript(LIBS.jspdf);
        if (!window.svg2pdf) await loadScript(LIBS.svg2pdf);
        const { W, H, land, size } = current.fit;
        const doc = new window.jspdf.jsPDF({ unit: 'mm', format: [Math.min(W, H), Math.max(W, H)], orientation: land ? 'landscape' : 'portrait', compress: true });
        Object.keys(FONTS).forEach(f => { doc.addFileToVFS(f + '.ttf', fontB64[f]); doc.addFont(f + '.ttf', f, 'normal'); });
        doc.setProperties({ title: `${NAME} · family tree`, creator: `FamilyTree · ${SITE}` });
        await doc.svg($('poPreview').querySelector('svg'), { x: 0, y: 0, width: W, height: H });
        doc.save(`${SLUG}-family-tree-${size}.pdf`);
        status($('poStatus').innerHTML.replace(/<br>Saved.*$/, '') + '<br>Saved. Check your downloads.');
      } catch (e) {
        console.error(e); status('Could not make the PDF: ' + esc(e.message || e) + '. Please try again.');
      } finally { btn.textContent = label; btn.disabled = false; }
    };
    await render();
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  SHARED: a panel on the left, a printable document on the right
  // ═════════════════════════════════════════════════════════════════════════
  const seg = (name, opts, val) => opts.map(([v, t]) => `<label><input type="radio" name="${name}" value="${v}"${v === val ? ' checked' : ''}><span>${t}</span></label>`).join('');
  const check = (id, text, on) => `<label class="pr-check"><input type="checkbox" id="${id}"${on ? ' checked' : ''}><span>${text}</span></label>`;
  function docShell(title, lede, label, opts) {
    root.innerHTML = `
      <aside class="pr-panel no-print" aria-label="${label} options">
        <h1>${title}</h1>
        <p class="pr-lede">${lede}</p>
        ${opts}
        <button type="button" class="pr-btn" id="dcPrint" disabled>Print / Save as PDF</button>
        <p class="pr-status" id="dcStatus" role="status" aria-live="polite">Preparing…</p>
      </aside>
      <section class="pr-stage pr-docstage" aria-label="Preview"><div id="dcDoc"></div></section>`;
    document.getElementById('dcPrint').onclick = () => window.print();
  }
  const dcStatus = t => { document.getElementById('dcStatus').innerHTML = t; };
  function lifeSpan(people) {
    const ys = []; let alive = false;
    people.forEach(p => { const b = year(p.birth_date), d = year(p.death_date); if (b) ys.push(b); if (d) ys.push(d); if (+p.is_alive) alive = true; });
    if (alive && ys.length) ys.push(THIS_YEAR);
    return ys.length ? `${Math.min(...ys)}–${Math.max(...ys)}` : '';
  }
  /** Paper + orientation controls, and the matching @page rule. */
  const paperOpts = (st, sizes) => `
        <label class="pr-field"><span>Paper</span>
          <select id="dcPaper">${sizes.map(k => `<option value="${k}"${k === st.paper ? ' selected' : ''}>${k} · ${PAGES[k][0]} × ${PAGES[k][1]} mm</option>`).join('')}</select></label>
        <fieldset class="pr-field pr-seg"><legend>Turn the page</legend>${seg('dcOrient', [['portrait', 'Portrait'], ['landscape', 'Landscape']], st.orient)}</fieldset>`;
  function wirePaper(st, onChange) {
    document.getElementById('dcPaper').onchange = e => { st.paper = e.target.value; onChange(); };
    document.querySelectorAll('input[name=dcOrient]').forEach(r => { r.onchange = e => { st.orient = e.target.value; onChange(); }; });
  }
  const MARGIN = 14;
  function pageBox(st) {
    const [a, b] = PAGES[st.paper], W = st.orient === 'landscape' ? b : a, H = st.orient === 'landscape' ? a : b;
    setPage(`@page { size: ${st.paper} ${st.orient}; margin: ${MARGIN}mm; }`);
    const doc = document.getElementById('dcDoc');
    doc.style.setProperty('--doc-w', W + 'mm'); doc.style.setProperty('--doc-pad', MARGIN + 'mm');
    return { W, H, aw: W - 2 * MARGIN, ah: H - 2 * MARGIN };
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  FAMILY BOOK
  // ═════════════════════════════════════════════════════════════════════════
  async function book(members, ixAll, media) {
    const pal = window.ftTreePalette();
    const r = document.documentElement.style;
    [['--bk-accent', pal.accent], ['--bk-text', pal.text], ['--bk-muted', pal.muted], ['--bk-line', pal.stroke], ['--bk-soft', pal.bg], ['--bk-av', pal.avMale], ['--bk-av-f', pal.avFemale]].forEach(([k, v]) => r.setProperty(k, v));
    setPage(`@page { size: A4; margin: 16mm 16mm 18mm; @bottom-center { content: counter(page); font: 9pt 'Plus Jakarta Sans', sans-serif; color: #888; } }
      @page :first { margin: 0; @bottom-center { content: none; } }`);
    const photosOf = new Map();
    (media || []).forEach(m => { if (m.type !== 'image') return; (m.members || []).forEach(t => { if (!photosOf.has(t.id)) photosOf.set(t.id, []); photosOf.get(t.id).push(m); }); });
    const emblem = await (async () => { const e = SET.emblem || {}; if (!e.kind || e.kind === 'none') return ''; const s = await emblemSvg(0, 0, 100, pal.accent); return s ? `<svg class="bk-emblem" viewBox="0 0 100 100" aria-hidden="true">${s}</svg>` : ''; })();
    const today = niceDate(new Date().toISOString().slice(0, 10));
    docShell('Family book', 'Every person on their own entry, by generation. Prints on A4.', 'Book', hidePanel(members));
    let job = 0;

    async function render() {
      const my = ++job;
      syncUrl();
      document.getElementById('dcPrint').disabled = true;
      const { kept, ix } = applyRules(members, ixAll);
      refresh(kept);
      const people = kept.filter(p => !hidden(p));
      const doc = document.getElementById('dcDoc');
      if (!people.length) { doc.innerHTML = ''; dcStatus('No one left to print. Remove a hide rule.'); return; }
      const gen = generations(people, ix);
      const minG = Math.min(...people.map(p => gen.get(p.id)));
      const byGen = new Map();
      people.slice().sort((a, b) => (gen.get(a.id) - gen.get(b.id)) || ((year(a.birth_date) ?? 9999) - (year(b.birth_date) ?? 9999)) || String(a.name).localeCompare(String(b.name)))
        .forEach(p => { const g = gen.get(p.id) - minG + 1; if (!byGen.has(g)) byGen.set(g, []); byGen.get(g).push(p); });
      const span = lifeSpan(people);
      const nameLink = id => { const p = ix.byId.get(id); return hidden(p) ? '' : `<a href="#p${p.id}">${esc(p.name)}</a>`; };
      const list = ids => ids.map(nameLink).filter(Boolean).join(', ');
      const gens = [...byGen.keys()];
      const person = p => {
        const born = [niceDate(p.birth_date), p.birth_location].filter(Boolean).join(', ');
        const died = [niceDate(p.death_date), p.death_location].filter(Boolean).join(', ');
        const kids = ix.kids.get(p.id) || [];
        const rows = [
          born && ['Born', esc(born)], died && ['Died', esc(died)],
          p.current_location && ['Lives in', esc(p.current_location)],
          ix.parents(p).length && list(ix.parents(p)) && [ix.parents(p).length > 1 ? 'Parents' : 'Parent', list(ix.parents(p))],
          ix.partners(p).length && list(ix.partners(p)) && ['Partner' + (ix.partners(p).length > 1 ? 's' : ''), list(ix.partners(p))],
          kids.length && list(kids) && [kids.length > 1 ? 'Children' : 'Child', list(kids)],
        ].filter(Boolean);
        const pics = (photosOf.get(p.id) || []).filter(m => m.url !== p.img).slice(0, 6);
        const yrs = lifeYears(p);
        return `<article class="bk-person" id="p${p.id}">
          <header class="bk-phead">
            ${p.img ? `<img class="bk-portrait" src="${esc(p.img)}" alt="">` : `<div class="bk-portrait bk-initial${String(p.gender || '').toLowerCase().startsWith('f') ? ' f' : ''}" aria-hidden="true">${esc(initial(p.name))}</div>`}
            <div><h3>${esc(p.name)}</h3>
              ${p.nickname ? `<p class="bk-nick">Known as ${esc(p.nickname)}</p>` : ''}
              ${yrs ? `<p class="bk-years">${esc(yrs)}</p>` : ''}</div>
          </header>
          ${rows.length ? `<dl class="bk-facts">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>` : ''}
          ${p.wiki ? `<p class="bk-bio">${esc(p.wiki)}</p>` : ''}
          ${pics.length ? `<div class="bk-photos">${pics.map(m => `<figure><img src="${esc(m.url)}" alt="${esc(m.title || '')}">${m.title ? `<figcaption>${esc(m.title)}</figcaption>` : ''}</figure>`).join('')}</div>` : ''}
        </article>`;
      };
      const genSpan = ps => { const y = ps.map(p => year(p.birth_date)).filter(Boolean); return y.length ? `born ${Math.min(...y)}${Math.max(...y) !== Math.min(...y) ? '–' + Math.max(...y) : ''}` : ''; };
      doc.innerHTML = `
        <article class="book">
          <section class="bk-cover">
            ${emblem}
            <p class="bk-kicker">A family book</p>
            <h1>${esc(NAME)}</h1>
            ${SET.tagline ? `<p class="bk-tagline">${esc(SET.tagline)}</p>` : ''}
            <p class="bk-counts">${people.length} people · ${gens.length} generation${gens.length === 1 ? '' : 's'}${span ? ' · ' + span : ''}</p>
            <p class="bk-made">Compiled ${esc(today)}<br>Made with FamilyTree · ${SITE}</p>
          </section>
          <section class="bk-contents">
            <h2>Contents</h2>
            ${gens.map(g => `<div class="bk-toc-gen"><h3><a href="#g${g}">Generation ${g}</a> <span>${esc(genSpan(byGen.get(g)))}</span></h3>
              <ol>${byGen.get(g).map(p => `<li><a href="#p${p.id}">${esc(p.name)}</a>${lifeYears(p) ? ` <span>${esc(lifeYears(p))}</span>` : ''}</li>`).join('')}</ol></div>`).join('')}
          </section>
          ${gens.map(g => `<section class="bk-gen" id="g${g}"><h2 class="bk-gen-title"><span>Generation ${g}</span><small>${byGen.get(g).length} ${byGen.get(g).length === 1 ? 'person' : 'people'}${genSpan(byGen.get(g)) ? ' · ' + esc(genSpan(byGen.get(g))) : ''}</small></h2>${byGen.get(g).map(person).join('')}</section>`).join('')}
          <p class="bk-end">Made with FamilyTree · ${SITE}</p>
        </article>`;
      // print only once every picture has arrived (or failed)
      await waitImages(doc, (d, n) => { if (my === job) dcStatus(`Preparing photos ${d} of ${n}…`); });
      if (my !== job) return;
      dcStatus(`${people.length} people. Choose A4 and turn on "Background graphics" in the print dialog.`);
      document.getElementById('dcPrint').disabled = false;
    }
    const refresh = wireHide(members, ixAll, render);
    await render();
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  TIMELINE
  // ═════════════════════════════════════════════════════════════════════════
  // Custom family events (api-events.php) are added in boot() when EVENTS_API is set;
  // each row needs { date: 'YYYY-MM-DD' (or YYYY / YYYY-MM), title, place?, members?: [ids] }.
  const EVENTS_API = '/api-events.php?tree=';
  function dateKey(d) {
    const m = /^(-?\d{3,4})(?:-(\d{2})(?:-(\d{2}))?)?/.exec(String(d || ''));
    return m ? { y: +m[1], m: +(m[2] || 0), d: +(m[3] || 0) } : null;
  }
  const TL_TYPES = { birth: 'Born', marriage: 'Married', death: 'Died', event: 'Family event' };
  function timelineEvents(people, ix, extra) {
    const out = [], seen = new Set();
    people.forEach(p => {
      const b = dateKey(p.birth_date); if (b) out.push({ type: 'birth', k: b, date: p.birth_date, who: [p], place: p.birth_location });
      const d = dateKey(p.death_date);
      if (d) { const by = year(p.birth_date); out.push({ type: 'death', k: d, date: p.death_date, who: [p], place: p.death_location, note: by ? `aged about ${d.y - by}` : '' }); }
      const a = dateKey(p.anniversary_date);
      if (a) {
        const sp = ix.partners(p).map(id => ix.byId.get(id)).filter(s => !hidden(s));
        const s = sp.find(x => x.anniversary_date === p.anniversary_date) || sp[0];
        const key = s ? [p.id, s.id].sort().join('_') + p.anniversary_date : p.id + p.anniversary_date;
        if (!seen.has(key)) { seen.add(key); out.push({ type: 'marriage', k: a, date: p.anniversary_date, who: s ? [p, s] : [p] }); }
      }
    });
    (extra || []).forEach(e => {
      const k = dateKey(e.date); if (!k) return;
      const who = (e.members || []).map(id => ix.byId.get(+id)).filter(p => p && !hidden(p));
      if ((e.members || []).length && !who.length) return;            // only about hidden people
      out.push({ type: 'event', k, date: e.date, who, title: e.title, place: e.place });
    });
    return out.sort((x, y) => x.k.y - y.k.y || x.k.m - y.k.m || x.k.d - y.k.d);
  }
  async function timeline(members, ixAll, extra) {
    const st = { birth: true, marriage: true, death: true, event: true, photos: true, paper: 'A4', orient: 'portrait' };
    const types = extra && extra.length ? ['birth', 'marriage', 'death', 'event'] : ['birth', 'marriage', 'death'];
    docShell('Timeline', 'Births, marriages and deaths in date order, by decade.', 'Timeline', `
        <fieldset class="pr-field"><legend>Include</legend>${types.map(t => check('tl_' + t, { birth: 'Births', marriage: 'Marriages', death: 'Deaths', event: 'Family events' }[t], true)).join('')}</fieldset>
        ${check('tlPhotos', 'Include photos', true)}
        ${paperOpts(st, ['A4', 'Letter'])}
        ${hidePanel(members)}`);
    let job = 0;
    async function render() {
      const my = ++job;
      syncUrl();
      document.getElementById('dcPrint').disabled = true;
      pageBox(st);
      const { kept, ix } = applyRules(members, ixAll);
      refresh(kept);
      const people = kept.filter(p => !hidden(p));
      const evs = timelineEvents(people, ix, extra).filter(e => st[e.type]);
      const doc = document.getElementById('dcDoc');
      const decades = new Map();
      evs.forEach(e => { const dk = Math.floor(e.k.y / 10) * 10; if (!decades.has(dk)) decades.set(dk, []); decades.get(dk).push(e); });
      const names = who => who.map(p => `<b>${esc(p.name)}</b>`).join(' and ');
      const shortDate = e => niceDate(e.date).replace(/ (\d{3,4})$/, '').replace(/^(\d{3,4})$/, '') || '';
      const row = e => {
        const pic = st.photos && e.who.find(p => p.img);
        const what = e.type === 'event' ? `<b>${esc(e.title || 'Family event')}</b>${e.who.length ? ' · ' + e.who.map(p => esc(p.name)).join(', ') : ''}` : names(e.who);
        return `<li class="tl-row tl-${e.type}">
          <span class="tl-date"><b>${e.k.y}</b>${shortDate(e) ? `<span>${esc(shortDate(e))}</span>` : ''}</span>
          <span class="tl-dot" aria-hidden="true"></span>
          ${pic ? `<img class="tl-pic" src="${esc(pic.img)}" alt="">` : ''}
          <span class="tl-text"><span class="tl-type">${TL_TYPES[e.type]}</span> ${what}${e.place ? `<span class="tl-place">${esc(e.place)}</span>` : ''}${e.note ? `<span class="tl-place">${esc(e.note)}</span>` : ''}</span>
        </li>`;
      };
      const span = lifeSpan(people);
      doc.innerHTML = `<article class="pr-doc tl-doc${st.orient === 'landscape' ? ' tl-wide' : ''}">
          <header class="dc-head">
            <p class="bk-kicker">A family timeline</p>
            <h1>${esc(NAME)}</h1>
            <p class="dc-sub">${evs.length} moment${evs.length === 1 ? '' : 's'} · ${people.length} people${span ? ' · ' + span : ''}</p>
          </header>
          ${evs.length ? '<div class="tl-body">' + [...decades.entries()].map(([dk, list]) => `<section class="tl-decade"><h2>${dk}s</h2><ol class="tl-list">${list.map(row).join('')}</ol></section>`).join('') + '</div>'
            : '<p class="dc-empty">No dated births, marriages or deaths to show. Add dates to people, or remove a hide rule.</p>'}
          <p class="bk-end">Made with FamilyTree · ${SITE}</p>
        </article>`;
      await waitImages(doc, (d, n) => { if (my === job) dcStatus(`Preparing photos ${d} of ${n}…`); });
      if (my !== job) return;
      dcStatus(`${evs.length} moments. In the print dialog pick ${st.paper} ${st.orient} and turn on "Background graphics".`);
      document.getElementById('dcPrint').disabled = false;
    }
    types.forEach(t => { document.getElementById('tl_' + t).onchange = e => { st[t] = e.target.checked; render(); }; });
    document.getElementById('tlPhotos').onchange = e => { st.photos = e.target.checked; render(); };
    wirePaper(st, render);
    const refresh = wireHide(members, ixAll, render);
    await render();
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  MAP
  // ═════════════════════════════════════════════════════════════════════════
  // Vector map: world-atlas country outlines (TopoJSON) drawn with d3-geo as inline SVG,
  // numbered pins, and a legend. No map tiles, so nothing is blocked or blurry in print.
  // Places come from api-geo.php, the same server-side Nominatim cache the map view uses.
  const GEO_LIBS = [
    'https://cdn.jsdelivr.net/npm/d3-array@3.2.4/dist/d3-array.min.js',
    'https://cdn.jsdelivr.net/npm/d3-geo@3.1.1/dist/d3-geo.min.js',
    'https://cdn.jsdelivr.net/npm/topojson-client@3.1.0/dist/topojson-client.min.js',
  ];
  const WORLD = 'https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json';
  let worldP = null;
  function loadWorld() {
    if (!worldP) worldP = (async () => {
      for (const s of GEO_LIBS) await loadScript(s);
      const topo = await (await fetch(WORLD)).json();
      return { land: window.topojson.feature(topo, topo.objects.countries), borders: window.topojson.mesh(topo, topo.objects.countries, (a, b) => a !== b) };
    })().catch(e => { console.warn('map outline unavailable', e); worldP = null; return null; });
    return worldP;
  }
  async function loadPlaces() {
    for (let i = 0; i < 8; i++) {                                     // api-geo looks up a few new places per call
      const r = await getJSON('/api-geo.php?tree=' + encodeURIComponent(SLUG));
      if (!r.pending) return r.places || {};
      dcStatus(`Finding places on the map… ${r.pending} left`);
      await new Promise(ok => setTimeout(ok, 1500));
    }
    return (await getJSON('/api-geo.php?tree=' + encodeURIComponent(SLUG))).places || {};
  }
  const MAP_KINDS = { birth: 'Born', current: 'Lives', death: 'Died' };
  function mapSvg(world, clusters, w, h) {
    const d3 = window.d3, pts = clusters.flatMap(c => c.places.map(p => [p.ll[1], p.ll[0]]));
    const lons = pts.map(p => p[0]), lats = pts.map(p => p[1]);
    const spanLon = Math.max(...lons) - Math.min(...lons), spanLat = Math.max(...lats) - Math.min(...lats);
    let proj;
    if (spanLon > 140 || spanLat > 70) proj = d3.geoNaturalEarth1().fitExtent([[2, 2], [w - 2, h - 2]], { type: 'Sphere' });
    else {
      // region: pad the box so pins are not on the edge, and never zoom closer than ~6 degrees
      const cx = (Math.max(...lons) + Math.min(...lons)) / 2, cy = (Math.max(...lats) + Math.min(...lats)) / 2;
      const hx = Math.max(3, spanLon * 0.65), hy = Math.max(3, spanLat * 0.65);
      const box = { type: 'MultiPoint', coordinates: [[cx - hx, Math.max(-80, cy - hy)], [cx + hx, Math.min(80, cy + hy)]] };
      proj = d3.geoMercator().fitExtent([[6, 6], [w - 6, h - 6]], box);
    }
    const path = d3.geoPath(proj);
    clusters.forEach(c => { const [x, y] = proj([c.places[0].ll[1], c.places[0].ll[0]]); c.x = x; c.y = y; });
    // merge pins that would sit on top of each other
    const R = 3.2, merged = [];
    clusters.forEach(c => { const m = merged.find(o => Math.hypot(o.x - c.x, o.y - c.y) < R * 2); if (m) m.places.push(...c.places); else merged.push(c); });
    merged.sort((a, b) => String(a.places[0].name).localeCompare(String(b.places[0].name))).forEach((c, i) => { c.n = i + 1; });
    // labels: place name beside the pin where it fits
    const taken = merged.map(c => ({ x: c.x - R, y: c.y - R, w: 2 * R, h: 2 * R }));
    const hit = b => b.x < 0 || b.y < 0 || b.x + b.w > w || b.y + b.h > h || taken.some(t => b.x < t.x + t.w && t.x < b.x + b.w && b.y < t.y + t.h && t.y < b.y + b.h);
    let labels = '';
    merged.forEach(c => {
      const t = c.places[0].name.split(',')[0] + (c.places.length > 1 ? ` +${c.places.length - 1}` : '');
      const tw = textW(t, 3, 'Plus Jakarta Sans') * 1.05, th = 3.6;
      for (const [bx, by, anchor] of [[c.x + R + 1, c.y - th / 2, 'start'], [c.x - R - 1 - tw, c.y - th / 2, 'end'], [c.x - tw / 2, c.y - R - 1 - th, 'middle'], [c.x - tw / 2, c.y + R + 1, 'middle']]) {
        const b = { x: bx, y: by, w: tw, h: th };
        if (hit(b)) continue;
        taken.push(b);
        const tx = anchor === 'start' ? bx : anchor === 'end' ? bx + tw : bx + tw / 2;
        const at = `x="${tx.toFixed(2)}" y="${(by + th * 0.78).toFixed(2)}" text-anchor="${anchor}"`;
        labels += `<text ${at} class="mp-halo">${esc(t)}</text><text ${at} class="mp-label">${esc(t)}</text>`;   // separate halo: paint-order is lost in PDF
        break;
      }
    });
    const pins = merged.map(c => `<g class="mp-pin"><circle cx="${c.x.toFixed(2)}" cy="${c.y.toFixed(2)}" r="${R}"/><text x="${c.x.toFixed(2)}" y="${(c.y + 1.05).toFixed(2)}" text-anchor="middle">${c.n}</text></g>`).join('');
    const svg = `<svg class="mp-svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="Map with ${merged.length} numbered pins; the list below names each one">
      <defs><clipPath id="mpClip"><rect width="${w}" height="${h}"/></clipPath></defs>
      <g clip-path="url(#mpClip)">
        <rect width="${w}" height="${h}" class="mp-sea"/>
        ${world ? `<path d="${path({ type: 'Sphere' })}" class="mp-sphere"/><path d="${path(d3.geoGraticule10())}" class="mp-grat"/><path d="${path(world.land)}" class="mp-land"/><path d="${path(world.borders)}" class="mp-border"/>` : ''}
        ${labels}${pins}
      </g></svg>`;
    return { svg, merged };
  }
  async function placeMap(members, ixAll) {
    const st = { birth: true, current: true, death: true, paper: 'A4', orient: 'landscape' };
    docShell('Map', 'Where the family was born, lives and died, with a list of every place.', 'Map', `
        <fieldset class="pr-field"><legend>Places to show</legend>${check('mp_birth', 'Where born', true)}${check('mp_current', 'Where they live now', true)}${check('mp_death', 'Where died', true)}</fieldset>
        ${paperOpts(st, ['A4', 'Letter', 'A3'])}
        ${hidePanel(members)}`);
    dcStatus('Finding places on the map…');
    const [coords, world] = await Promise.all([loadPlaces().catch(() => ({})), loadWorld()]);
    if (!world || !window.d3) dcStatus('Could not load the world outline. The list still has every place.');
    let job = 0;
    async function render() {
      const my = ++job;
      syncUrl();
      document.getElementById('dcPrint').disabled = true;
      const box = pageBox(st);
      const { kept } = applyRules(members, ixAll);
      refresh(kept);
      const byPlace = new Map();
      kept.filter(p => !hidden(p)).forEach(p => {
        [['birth', p.birth_location], ['current', +p.is_alive ? p.current_location : ''], ['death', p.death_location]].forEach(([k, v]) => {
          v = String(v || '').trim(); if (!v || !st[k]) return;
          if (!byPlace.has(v)) byPlace.set(v, { name: v, ll: coords[v] || null, who: { birth: [], current: [], death: [] } });
          byPlace.get(v).who[k].push(p);
        });
      });
      const places = [...byPlace.values()];
      const onMap = places.filter(p => p.ll), off = places.filter(p => !p.ll).sort((a, b) => a.name.localeCompare(b.name));
      const mapH = Math.round(box.ah - 34);                           // the map fills page one under the heading
      // busiest places first, so a merged pin is named after the place most people share
      const size = pl => Object.values(pl.who).reduce((n, l) => n + l.length, 0);
      onMap.sort((a, b) => size(b) - size(a) || a.name.localeCompare(b.name));
      const m = onMap.length && window.d3 ? mapSvg(world, onMap.map(p => ({ places: [p] })), box.aw, mapH) : { svg: '', merged: [] };
      const whoLine = pl => Object.keys(MAP_KINDS).filter(k => pl.who[k].length).map(k => `<span class="mp-kind mp-${k}">${MAP_KINDS[k]}</span> ${pl.who[k].map(p => esc(p.name)).join(', ')}`).join('<br>');
      const total = new Set(places.flatMap(pl => Object.values(pl.who).flat().map(p => p.id))).size;
      const doc = document.getElementById('dcDoc');
      doc.innerHTML = `<article class="pr-doc mp-doc">
          <section class="mp-page1">
            <header class="dc-head dc-row"><div><p class="bk-kicker">Where the family lived</p><h1>${esc(NAME)}</h1></div>
              <p class="dc-sub">${places.length} place${places.length === 1 ? '' : 's'} · ${total} people</p></header>
            ${m.svg ? `<div class="mp-map" style="aspect-ratio:${box.aw} / ${mapH}">${m.svg}</div>` : `<p class="dc-empty">${places.length ? 'The map could not be drawn here; every place is listed below.' : 'No places recorded for the people shown. Add birth or home places to people, or remove a hide rule.'}</p>`}
          </section>
          ${m.merged.length ? `<section class="mp-legend"><h2>Places on the map</h2><ol>${m.merged.map(c => `<li><span class="mp-num" aria-hidden="true">${c.n}</span><div><span class="sr-only">Pin ${c.n}: </span>${c.places.map(pl => `<div class="mp-pl"><p class="mp-place">${esc(pl.name)}</p><p class="mp-who">${whoLine(pl)}</p></div>`).join('')}</div></li>`).join('')}</ol></section>` : ''}
          ${off.length ? `<section class="mp-legend mp-off"><h2>Not on the map</h2><p class="dc-sub">These places could not be found yet.</p><ol>${off.map(pl => `<li><div><p class="mp-place">${esc(pl.name)}</p><p class="mp-who">${whoLine(pl)}</p></div></li>`).join('')}</ol></section>` : ''}
          <p class="bk-end">Map outline: Natural Earth via world-atlas · Places: OpenStreetMap Nominatim · Made with FamilyTree · ${SITE}</p>
        </article>`;
      if (my !== job) return;
      if (world || !onMap.length) dcStatus(`${places.length} places, ${m.merged.length} pins. In the print dialog pick ${st.paper} ${st.orient} and turn on "Background graphics".`);
      document.getElementById('dcPrint').disabled = false;
    }
    ['birth', 'current', 'death'].forEach(k => { document.getElementById('mp_' + k).onchange = e => { st[k] = e.target.checked; render(); }; });
    wirePaper(st, render);
    const refresh = wireHide(members, ixAll, render);
    await render();
  }

  // ── boot ─────────────────────────────────────────────────────────────────────
  async function boot() {
    try {
      const kind = window.FT_PRINT_KIND;
      const q = encodeURIComponent(SLUG);
      const [members, media, , extra] = await Promise.all([
        getJSON('/api-family.php?tree=' + q),
        kind === 'book' ? getJSON('/api-media.php?tree=' + q).catch(() => []) : Promise.resolve([]),
        kind === 'poster' ? loadFonts() : Promise.resolve(),
        kind === 'timeline' && EVENTS_API ? getJSON(EVENTS_API + q).then(r => (Array.isArray(r) ? r : r.events || []).map(e => ({ ...e, members: e.members || e.people || [] }))).catch(() => []) : Promise.resolve([]),
      ]);
      if (!Array.isArray(members) || !members.length) { root.innerHTML = '<p class="pr-loading">This tree has no one in it yet.</p>'; return; }
      const ix = index(members);
      if (kind === 'book') await book(members, ix, media);
      else if (kind === 'timeline') await timeline(members, ix, extra);
      else if (kind === 'map') await placeMap(members, ix);
      else await poster(members, ix);
    } catch (e) {
      console.error(e);
      root.innerHTML = `<p class="pr-loading">${esc(e.message || 'Something went wrong.')}</p>`;
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
