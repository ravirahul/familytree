// views/relation.js - "How are we related?" (/tree/{slug}/relation?a=ID&b=ID)
// Pick two people (searchable picker or tap in the drawing) and see the answer, the Indian word,
// and the path drawn on a small family tree. Only the relevant part of the tree is drawn:
// the two people, the path between them through the closest shared ancestor couple (or through
// a spouse), the partners that explain each step, and a few siblings for context.

(function () {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const yr = d => { const y = parseInt(String(d || '').slice(0, 4), 10); return y > 0 ? y : null; };
  const fold = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const TITLE = /^(prince|princess|king|queen|lady|lord|sir|duke|duchess|grand|tsar|tsarina|tsarevich|tsarevna|emperor|empress|maharaja|maharani|raja|rani|nawab|dr\.?|mr\.?|mrs\.?|ms\.?|shri|smt\.?)$/i;
  // "Prince William of Wales" -> "Prince William", "Irène Joliot-Curie" -> "Irène"
  function shortName(m) {
    const t = String((m && m.name) || '?').trim().split(/\s+/);
    let i = 0; while (i < t.length - 1 && TITLE.test(t[i])) i++;
    return t.slice(0, i + 1).join(' ').replace(/[,;:]+$/, '');
  }
  const fullName = m => String((m && m.name) || '?').split(',')[0].trim();   // "Prince Harry, Duke of Sussex" -> "Prince Harry"
  function lifeYears(m) {
    const b = yr(m.birth_date), d = yr(m.death_date);
    if (b && d) return b + '–' + d;
    if (b) return 'b. ' + b;
    if (d) return 'd. ' + d;
    return '';
  }
  const isF = m => (m && m.gender) === 'female';
  const ordinal = n => ['', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth'][n] || n + 'th';

  // B's relation to A by blood, from generations to the shared ancestor (dA for A, dB for B)
  function bloodTerm(dA, dB, b) {
    const f = isF(b), g = n => n <= 0 ? '' : 'great-'.repeat(n);
    if (dB === 0) return dA === 1 ? (f ? 'mother' : 'father') : g(dA - 2) + (f ? 'grandmother' : 'grandfather');
    if (dA === 0) return dB === 1 ? (f ? 'daughter' : 'son') : g(dB - 2) + (f ? 'granddaughter' : 'grandson');
    if (dA === 1 && dB === 1) return f ? 'sister' : 'brother';
    if (dA === 1) return (dB === 2 ? '' : g(dB - 3) + 'grand-') + (f ? 'niece' : 'nephew');
    if (dB === 1) return (dA === 2 ? '' : g(dA - 3) + 'great-') + (f ? 'aunt' : 'uncle');
    const deg = Math.min(dA, dB) - 1, rem = Math.abs(dA - dB);
    return ordinal(deg) + ' cousin' + (rem ? ' ' + (rem === 1 ? 'once' : rem === 2 ? 'twice' : rem + ' times') + ' removed' : '');
  }

  class RelationView extends FamilyTreeController {
    constructor() {
      super('relation');
      this.a = null; this.b = null;
      this.el = null;
      window.relationView = this;
    }

    async init() {
      const ok = await super.init();
      if (!ok) return false;
      this.updateStats();
      const data = this.familyData;
      this.byId = new Map(data.map(m => [m.id, m]));
      this.kids = new Map();
      data.forEach(m => [m.fid, m.mid].forEach(p => {
        if (!p) return;
        if (!this.kids.has(p)) this.kids.set(p, []);
        const k = this.kids.get(p); if (k[k.length - 1] !== m) k.push(m);
      }));
      this.partners = new Map();
      const link = (x, y) => { if (!x || !y || x === y || !this.byId.has(x) || !this.byId.has(y)) return; [[x, y], [y, x]].forEach(([p, q]) => { if (!this.partners.has(p)) this.partners.set(p, new Set()); this.partners.get(p).add(q); }); };
      data.forEach(m => (m.pids || []).forEach(p => link(m.id, p)));   // one-sided links count too
      data.forEach(m => link(m.fid, m.mid));                           // parents of a child together, married or not
      this.index = data.map(m => ({ m, key: fold(m.name + ' ' + (m.nickname || '')) })).sort((x, y) => x.key.localeCompare(y.key));
      this.calc = new RelationshipCalculator(data);

      const q = new URLSearchParams(location.search);
      const pick = k => { const id = parseInt(q.get(k), 10); return this.byId.has(id) ? id : null; };
      this.a = pick('a'); this.b = pick('b');
      if (!this.a && this.b) { this.a = this.b; this.b = null; }

      this.mount();
      this.applyPalette();
      this.render();
      let w = innerWidth;
      addEventListener('resize', () => { clearTimeout(this._rz); this._rz = setTimeout(() => { if ((innerWidth < 600) !== (w < 600)) { w = innerWidth; this.draw(); } }, 150); });
      return true;
    }

    onThemeChange() { this.applyPalette(); }

    // the tree's look (Tree Settings > Tree look) in light or dark, as CSS variables on the page
    applyPalette() {
      if (!this.el || typeof ftTreePalette !== 'function') return;
      const p = ftTreePalette();
      const look = (window.FT_TREE_THEMES || {})[document.documentElement.getAttribute('data-tree-look') || 'heritage'] || {};
      const hex = p.accent.replace('#', ''), n = parseInt(hex.length === 3 ? hex.replace(/./g, '$&$&') : hex, 16);
      const lum = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
      const v = { '--r-bg': p.bg, '--r-card': p.card, '--r-stroke': p.stroke, '--r-line': p.line, '--r-accent': p.accent,
        '--r-on-accent': lum > 0.6 ? '#141414' : '#ffffff', '--r-text': p.text, '--r-muted': p.muted,
        '--r-av': p.avMale, '--r-av-f': p.avFemale, '--r-serif': look.display || "'Playfair Display', Georgia, serif" };
      for (const k in v) this.el.style.setProperty(k, v[k]);
    }

    base() { return (window.FT_EMBED ? '/embed/' : '/tree/') + encodeURIComponent(window.FT_TREE_SLUG || ''); }

    mount() {
      const root = document.getElementById('tree-root');
      root.innerHTML = `
        <div class="rel" id="relRoot">
          <div class="rel-bar">
            <a class="rel-back" id="relBack" href="${this.base()}"><svg aria-hidden="true" width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4l-5 5 5 5"/></svg>Full tree</a>
            <div class="rel-title"><h2>How are we related?</h2><span>${esc(window.FT_TREE_NAME || '')} · pick or tap any two people</span></div>
            <div class="rel-picks">
              <button type="button" class="rel-chip" data-slot="1" aria-haspopup="dialog"></button>
              <button type="button" class="rel-btn rel-btn-g" id="relSwap" aria-label="Swap the two people"><svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4v16M3 8l4-4 4 4M17 20V4M13 16l4 4 4-4"/></svg><span>Swap</span></button>
              <button type="button" class="rel-chip" data-slot="2" aria-haspopup="dialog"></button>
              <button type="button" class="rel-btn rel-btn-s" id="relClear">Clear</button>
            </div>
          </div>
          <div class="rel-main">
            <div class="rel-canvas" id="relCanvas"><div class="rel-stage" id="relStage"></div></div>
            <aside class="rel-panel" id="relPanel" aria-live="polite"></aside>
          </div>
        </div>
        <dialog class="rel-picker" id="relPicker" aria-labelledby="relPickTitle">
          <div class="rel-pick-head"><h2 id="relPickTitle">Choose a person</h2>
            <button type="button" class="rel-btn rel-btn-g rel-pick-x" id="relPickClose" aria-label="Close"><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg></button></div>
          <label class="rel-sr" for="relPickInput">Search by name</label>
          <input id="relPickInput" class="rel-pick-input" type="search" placeholder="Type a name…" autocomplete="off" spellcheck="false"
            role="combobox" aria-expanded="true" aria-controls="relPickList" aria-autocomplete="list">
          <p class="rel-pick-hint" id="relPickHint"></p>
          <ul class="rel-pick-list" id="relPickList" role="listbox" aria-label="People"></ul>
        </dialog>`;
      this.el = document.getElementById('relRoot');
      this.el.querySelectorAll('.rel-chip').forEach(c => c.addEventListener('click', () => this.openPicker(Number(c.dataset.slot))));
      document.getElementById('relSwap').addEventListener('click', () => { if (this.a && this.b) { [this.a, this.b] = [this.b, this.a]; this.render(); } });
      document.getElementById('relClear').addEventListener('click', () => { this.a = this.b = null; this.render(); });
      document.getElementById('relStage').addEventListener('click', e => {
        const n = e.target.closest('[data-id]'); if (!n) return;
        const id = Number(n.dataset.id);
        if (!this.a || this.b) { this.a = id; this.b = null; } else if (id !== this.a) this.b = id;
        this.render();
      });
      document.getElementById('relPanel').addEventListener('click', e => {
        const t = e.target.closest('[data-act]'); if (!t) return;
        const act = t.dataset.act;
        if (act === 'pick1') this.openPicker(1);
        else if (act === 'pick2') this.openPicker(2);
        else if (act === 'share') this.share();
        else if (act === 'copy') this.copy(this.link(), 'Link copied');
      });
      this.wirePicker();
    }

    // ─── state ─────────────────────────────────────────────────────────────
    render() {
      const u = new URL(location.href);
      ['a', 'b'].forEach(k => { if (this[k]) u.searchParams.set(k, this[k]); else u.searchParams.delete(k); });
      history.replaceState(null, '', u);
      document.getElementById('relBack').href = this.base() + (this.a ? '?focus=' + this.a : '');
      this.el.querySelectorAll('.rel-chip').forEach(c => {
        const m = this.byId.get(c.dataset.slot === '1' ? this.a : this.b);
        const waiting = !m && (c.dataset.slot === '1' || this.a);
        c.classList.toggle('is-empty', !m);
        c.classList.toggle('is-next', waiting && !(c.dataset.slot === '2' && !this.a));
        c.setAttribute('aria-label', (m ? `Person ${c.dataset.slot}: ${m.name}. Change` : `Choose person ${c.dataset.slot}`));
        c.innerHTML = `<b aria-hidden="true">${c.dataset.slot}</b>${m ? this.avatar(m, 'rel-chip-av') : ''}<span class="rel-chip-name">${m ? esc(m.name) : 'Choose a person'}</span>`;
      });
      document.getElementById('relSwap').disabled = !(this.a && this.b);
      document.getElementById('relClear').disabled = !(this.a || this.b);
      this.rel = this.a && this.b ? this.findRelation(this.byId.get(this.a), this.byId.get(this.b)) : null;
      this.draw();
      this.renderPanel();
    }

    avatar(m, cls) {
      const ini = esc((m.name || '?').trim().charAt(0).toUpperCase());
      return `<span class="${cls}${isF(m) ? ' is-f' : ''}" aria-hidden="true">${ini}${m.img ? `<img src="${esc(m.img)}" alt="" loading="lazy" decoding="async" onerror="this.remove()">` : ''}</span>`;
    }

    // ─── the relationship ──────────────────────────────────────────────────
    // husbands, wives, and the other parent of any of their children: married first
    spousesOf(m) { return [...(this.partners.get(m.id) || [])].map(id => this.byId.get(id)).filter(Boolean); }
    married(x, y) { return (x.pids || []).includes(y.id) || (y.pids || []).includes(x.id); }
    parentsOf(m) { return [m.fid, m.mid].map(id => this.byId.get(id)).filter(Boolean); }
    // the other parent of `child` besides `p`
    coParent(p, child) { const id = child.fid === p.id ? child.mid : child.mid === p.id ? child.fid : null; return id ? this.byId.get(id) || null : null; }

    // every ancestor of m with its distance and the step below it (to walk back down)
    ancestors(m) {
      const out = new Map([[m.id, { d: 0, below: null }]]);
      let front = [m];
      for (let d = 1; front.length && d < 40; d++) {
        const next = [];
        for (const x of front) for (const p of this.parentsOf(x)) {
          if (out.has(p.id)) continue;
          out.set(p.id, { d, below: x.id }); next.push(p);
        }
        front = next;
      }
      return out;
    }
    chainDown(anc, topId) {   // [top, ..., start]
      const c = [this.byId.get(topId)];
      for (let id = anc.get(topId).below; id; id = anc.get(id).below) c.push(this.byId.get(id));
      return c;
    }
    // closest shared ancestor of x and y; null when they are not related by blood
    blood(x, y) {
      const ax = this.ancestors(x), ay = this.ancestors(y);
      let best = null;
      ax.forEach((v, id) => { const w = ay.get(id); if (w && (!best || v.d + w.d < best.dx + best.dy)) best = { id, dx: v.d, dy: w.d }; });
      if (!best) return null;
      const chainX = this.chainDown(ax, best.id), chainY = this.chainDown(ay, best.id);
      const top = chainX[0];
      let pair = null;   // the ancestor's partner, when both are ancestors of both (full relations)
      if (best.dx && best.dy) {
        const other = this.coParent(top, chainX[1]);
        if (other && (chainY[1].fid === other.id || chainY[1].mid === other.id)) pair = other;
      }
      return { dx: best.dx, dy: best.dy, chainX, chainY, top, pair };
    }

    findRelation(a, b) {
      if (a.id === b.id) return { kind: 'self' };
      if (this.spousesOf(a).some(s => s.id === b.id)) return { kind: 'spouse' };
      const r = this.blood(a, b);
      if (r) return { kind: 'blood', r };
      // by marriage: through A's spouse, B's spouse, or both - the shortest wins
      let best = null;
      const consider = (s, t) => {
        const x = this.blood(s || a, t || b); if (!x) return;
        const len = x.dx + x.dy + (s ? 1 : 0) + (t ? 1 : 0);
        if (!best || len < best.len) best = { kind: 'marriage', r: x, sa: s, tb: t, len };
      };
      const SA = this.spousesOf(a), TB = this.spousesOf(b);
      SA.forEach(s => consider(s, null));
      TB.forEach(t => consider(null, t));
      if (!best) SA.forEach(s => TB.forEach(t => { if (s.id !== t.id) consider(s, t); }));
      if (best) return best;
      const calc = this.calc.calculateRelationship(a.id, b.id);
      if (calc && calc.path && calc.path.length > 1) return { kind: 'path', path: calc.path, calc };
      return { kind: 'none' };
    }

    // the people on the path, in order from A to B, for the chips ("X & Y" for a shared couple)
    pathChips(rel, a, b) {
      const n = m => shortName(m);
      if (rel.kind === 'spouse') return [n(a), n(b)];
      if (rel.kind === 'path') return rel.path.map(n);
      if (rel.kind !== 'blood' && rel.kind !== 'marriage') return [];
      const r = rel.r;
      const up = r.chainX.slice().reverse(), down = r.chainY;
      let mid;
      if (r.dx && r.dy) mid = [...up.slice(0, -1).map(n), r.pair ? n(r.top) + ' & ' + n(r.pair) : n(r.top), ...down.slice(1).map(n)];
      else if (!r.dx) mid = down.map(n);
      else mid = up.map(n);
      return [...(rel.sa ? [n(a)] : []), ...mid, ...(rel.tb ? [n(b)] : [])];
    }

    // "great-great-great-great-grandfather" reads better as "4× great-grandfather"
    sentence(rel, a, b) {
      const s = this.sentenceRaw(rel, a, b);
      s.text = s.text.replace(/(great-){3,}/gi, m => (m.length / 6) + '× great-');
      return s;
    }
    sentenceRaw(rel, a, b) {
      const A = shortName(a), B = shortName(b), Bf = fullName(b);
      const sp = (m, to) => this.married(m, to) ? (isF(m) ? 'wife' : 'husband') : 'partner';
      if (rel.kind === 'self') return { text: 'That’s the same person.', how: '' };
      if (rel.kind === 'none') return { text: `We couldn’t find a recorded connection between ${A} and ${B}.`, how: '' };
      // the calculator's words where they are reliable; its uncle/aunt and niece/nephew greats are not, so those come from the path
      const calc = rel.calc || this.calc.calculateRelationship(a.id, b.id);
      const said = calc && !['distant', 'self', 'aunt-uncle', 'niece-nephew'].includes(calc.type) ? calc.description.toLowerCase() : null;
      if (rel.kind === 'spouse') return { text: `${Bf} is ${A}’s ${said || sp(b, a)}.`, how: this.married(a, b) ? 'by marriage' : 'as partners' };
      if (rel.kind === 'blood') return { text: `${Bf} is ${A}’s ${said || bloodTerm(rel.r.dx, rel.r.dy, b)}.`, how: 'by blood' };
      if (rel.kind === 'marriage') {
        const r = rel.r, s = rel.sa, t = rel.tb;
        if (said) return { text: `${Bf} is ${A}’s ${said}.`, how: 'by marriage' };
        if (s && !t) {
          const inner = bloodTerm(r.dx, r.dy, b);       // B to A's spouse
          if (inner === 'son' || inner === 'daughter') return { text: `${Bf} is ${A}’s step${inner}, the ${inner} of ${isF(a) ? 'her' : 'his'} ${sp(s, a)}, ${shortName(s)}.`, how: 'by marriage' };
          return { text: `${Bf} is the ${inner} of ${A}’s ${sp(s, a)}, ${shortName(s)}.`, how: 'by marriage' };
        }
        if (t && !s) {
          const inner = bloodTerm(r.dx, r.dy, t);       // B's spouse to A
          if (inner === 'father' || inner === 'mother') return { text: `${Bf} is ${A}’s step${isF(b) ? 'mother' : 'father'}, married to ${A}’s ${inner} ${shortName(t)}.`, how: 'by marriage' };
          return { text: `${Bf} is the ${sp(b, t)} of ${A}’s ${inner}, ${shortName(t)}.`, how: 'by marriage' };
        }
        const inner = bloodTerm(r.dx, r.dy, t);
        return { text: `${Bf} is the ${sp(b, t)} of the ${inner} of ${A}’s ${sp(s, a)}, ${shortName(s)}.`, how: 'by marriage' };
      }
      // a longer chain: say it step by step ("son's wife's mother's father") while that stays readable
      const P = rel.path, words = [];
      for (let i = 1; i < P.length; i++) {
        const p = P[i - 1], c = P[i];
        words.push(p.fid === c.id || p.mid === c.id ? (isF(c) ? 'mother' : 'father')
          : c.fid === p.id || c.mid === p.id ? (isF(c) ? 'daughter' : 'son') : sp(c, p));
      }
      if (words.length <= 5) return { text: `${Bf} is ${A}’s ${words.join('’s ')}.`, how: 'by marriage' };
      return { text: `${Bf} is a relative of ${A} by marriage, ${words.length} steps apart.`, how: 'by marriage' };
    }

    ageGap(a, b) {
      const ya = yr(a.birth_date), yb = yr(b.birth_date);
      if (!ya || !yb) return null;
      const full = d => /^\d{4}-\d{2}-\d{2}/.test(String(d || '')) && !/-00/.test(String(d).slice(4, 10));
      let older = a, younger = b;
      if (yb < ya || (yb === ya && full(a.birth_date) && full(b.birth_date) && b.birth_date < a.birth_date)) { older = b; younger = a; }
      let years = Math.abs(ya - yb);
      if (full(a.birth_date) && full(b.birth_date) && String(younger.birth_date).slice(5, 10) < String(older.birth_date).slice(5, 10)) years--;
      if (years <= 0) return { value: 'Same age', label: ya === yb ? 'born the same year' : 'less than a year apart' };
      return { value: `${years} year${years === 1 ? '' : 's'}`, label: `${fullName(older)} is older` };
    }

    // ─── the answer panel ──────────────────────────────────────────────────
    renderPanel() {
      const P = document.getElementById('relPanel');
      const a = this.byId.get(this.a), b = this.byId.get(this.b);
      if (!a) {
        P.innerHTML = `<div><span class="rel-eyebrow">Step 1 of 2</span><h3 class="rel-sentence">Pick the first person.</h3>
          <p class="rel-note">Search by name, or open someone’s card on the tree and press Find relation.</p></div>
          <button type="button" class="rel-btn rel-btn-p" data-act="pick1">Choose person 1</button>`;
        return;
      }
      if (!b) {
        P.innerHTML = `<div><span class="rel-eyebrow">Step 2 of 2</span><h3 class="rel-sentence">Now pick someone to compare with ${esc(shortName(a))}.</h3>
          <p class="rel-note">Tap a relative in the drawing, or search the whole tree.</p></div>
          <button type="button" class="rel-btn rel-btn-p" data-act="pick2">Choose person 2</button>`;
        return;
      }
      const rel = this.rel, s = this.sentence(rel, a, b);
      this.answer = s.text;
      if (rel.kind === 'self') {
        P.innerHTML = `<div><span class="rel-eyebrow">Same person</span><h3 class="rel-sentence">${esc(s.text)}</h3><p class="rel-note">Pick someone else as person 2.</p></div>
          <button type="button" class="rel-btn rel-btn-p" data-act="pick2">Choose person 2</button>`;
        return;
      }
      if (rel.kind === 'none') {
        P.innerHTML = `<div><span class="rel-eyebrow">No link found</span><h3 class="rel-sentence">${esc(s.text)}</h3>
          <p class="rel-note">They may be on branches that aren’t joined yet. Open the full tree to look for a missing parent or marriage, or ask the family’s admin to add it.</p></div>
          <div class="rel-actions"><a class="rel-btn rel-btn-p" href="${this.base()}?focus=${a.id}">Check the tree</a><button type="button" class="rel-btn rel-btn-s" data-act="pick2">Pick someone else</button></div>`;
        return;
      }
      const hi = window.ftIndianTerm ? window.ftIndianTerm(a.id, b.id, this.familyData) : null;
      this.answerHi = hi ? `${hi.roman} (${hi.hindi})` : '';
      const chips = this.pathChips(rel, a, b);
      const r = rel.r;
      const shared = rel.kind === 'spouse' ? (this.married(a, b) ? 'None needed · married' : 'None needed · partners')
        : rel.kind !== 'blood' ? 'None · joined by marriage'
        : (r.dx && r.dy) ? [r.top, r.pair].filter(Boolean).map(m => esc(fullName(m))).join(' and ')
        : 'None needed · direct line';
      const age = this.ageGap(a, b);
      P.innerHTML = `
        <div><span class="rel-eyebrow">Result · ${s.how}</span><h3 class="rel-sentence">${esc(s.text)}</h3></div>
        ${hi ? `<p class="rel-hi"><span class="rel-hi-l">In Hindi</span><span class="rel-hi-word">${esc(hi.roman)} <span lang="hi">${esc(hi.hindi)}</span></span><span class="rel-hi-path">${esc(hi.english)}</span></p>` : ''}
        <div><h4 class="rel-h4">The path, also drawn on the tree</h4>
          <ol class="rel-path">${chips.map((c, i) => `<li><span class="rel-pchip${i === 0 || i === chips.length - 1 ? ' is-end' : ''}">${esc(c)}</span>${i < chips.length - 1 ? '<span aria-hidden="true" class="rel-sep">›</span>' : ''}</li>`).join('')}</ol></div>
        <div class="rel-card">
          <div><div class="rel-num">${chips.length - 1}</div><div class="rel-lbl">step${chips.length === 2 ? '' : 's'} apart</div></div>
          <div><div class="rel-shared">${shared}</div><div class="rel-lbl">closest shared ancestors</div></div>
          ${age ? `<div class="rel-age"><div class="rel-shared">${esc(age.value)}</div><div class="rel-lbl">${esc(age.label)}</div></div>` : ''}
        </div>
        <div class="rel-actions">
          <button type="button" class="rel-btn rel-btn-p" data-act="share"><svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>Share this answer</button>
          <button type="button" class="rel-btn rel-btn-s" data-act="copy"><svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/></svg>Copy link</button>
        </div>
        <p class="rel-toast" id="relToast" role="status"></p>`;
    }

    link() {
      return location.origin + '/tree/' + encodeURIComponent(window.FT_TREE_SLUG || '') + '/relation?a=' + this.a + '&b=' + this.b;
    }
    toast(t) {
      const el = document.getElementById('relToast'); if (!el) return;
      el.textContent = t; clearTimeout(this._toast); this._toast = setTimeout(() => { el.textContent = ''; }, 3000);
    }
    copy(text, done) {
      const ok = () => this.toast(done);
      if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(ok, () => window.prompt('Copy this:', text));
      else window.prompt('Copy this:', text);
    }
    share() {
      const text = this.answer + (this.answerHi ? ' ' + this.answerHi + '.' : '');
      const url = this.link();
      if (navigator.share) { navigator.share({ title: 'How are we related?', text, url }).catch(() => {}); return; }
      window.open('https://wa.me/?text=' + encodeURIComponent(text + ' ' + url), '_blank', 'noopener');
      this.copy(text + ' ' + url, 'Answer copied · opening WhatsApp');
    }

    // ─── the picker ────────────────────────────────────────────────────────
    wirePicker() {
      const dlg = document.getElementById('relPicker'), input = document.getElementById('relPickInput'), list = document.getElementById('relPickList');
      document.getElementById('relPickClose').addEventListener('click', () => dlg.close());
      dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
      dlg.addEventListener('close', () => { const c = this.el.querySelector(`.rel-chip[data-slot="${this.slot}"]`); if (c) c.focus(); });
      input.addEventListener('input', () => this.search(input.value));
      input.addEventListener('keydown', e => {
        const items = [...list.querySelectorAll('[role="option"]')];
        if (!items.length) return;
        let i = items.findIndex(x => x.getAttribute('aria-selected') === 'true');
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault();
          i = e.key === 'ArrowDown' ? (i + 1) % items.length : (i - 1 + items.length) % items.length;
          this.activate(items, i);
        } else if (e.key === 'Enter') {
          e.preventDefault();
          this.choose(Number(items[Math.max(i, 0)].dataset.id));
        }
      });
      list.addEventListener('click', e => { const o = e.target.closest('[role="option"]'); if (o) this.choose(Number(o.dataset.id)); });
    }
    activate(items, i) {
      items.forEach((x, k) => x.setAttribute('aria-selected', k === i ? 'true' : 'false'));
      const input = document.getElementById('relPickInput');
      if (items[i]) { input.setAttribute('aria-activedescendant', items[i].id); items[i].scrollIntoView({ block: 'nearest' }); }
    }
    openPicker(slot) {
      this.slot = slot;
      const dlg = document.getElementById('relPicker'), input = document.getElementById('relPickInput');
      document.getElementById('relPickTitle').textContent = `Choose person ${slot}`;
      input.value = '';
      this.search('');
      dlg.showModal();
      input.focus();
    }
    choose(id) {
      const other = this.slot === 1 ? this.b : this.a;
      if (id === other) { [this.a, this.b] = [this.b, this.a]; }   // picking the other person swaps them
      else if (this.slot === 1) this.a = id; else this.b = id;
      if (!this.a && this.b) { this.a = this.b; this.b = null; }
      document.getElementById('relPicker').close();
      this.render();
    }
    search(raw) {
      const q = fold(raw).trim(), list = document.getElementById('relPickList'), hint = document.getElementById('relPickHint');
      let rows, note;
      if (!q) {
        // nothing typed yet: the other person's close family, the likeliest next pick
        const other = this.byId.get(this.slot === 1 ? this.b : this.a);
        if (other) {
          const seen = new Set([other.id]);
          rows = [...this.parentsOf(other), ...this.spousesOf(other), ...(this.calc.getSiblings(other)), ...(this.kids.get(other.id) || [])]
            .filter(m => !seen.has(m.id) && seen.add(m.id)).slice(0, 30);
          note = rows.length ? `Close family of ${shortName(other)} · or type any name` : `Type a name · ${this.familyData.length.toLocaleString()} people`;
        } else { rows = this.index.slice(0, 30).map(x => x.m); note = `Type a name · ${this.familyData.length.toLocaleString()} people in this tree`; }
      } else {
        const words = q.split(/\s+/);
        const hits = [];
        for (const x of this.index) {
          if (!words.every(w => x.key.includes(w))) continue;
          const score = x.key.startsWith(words[0]) ? 0 : x.key.includes(' ' + words[0]) ? 1 : 2;
          hits.push([score, x.m]);
        }
        hits.sort((p, r) => p[0] - r[0]);   // stable: alphabetical within each score
        rows = hits.slice(0, 50).map(h => h[1]);
        note = hits.length ? (hits.length > 50 ? `First 50 of ${hits.length.toLocaleString()} matches · keep typing` : `${hits.length} match${hits.length === 1 ? '' : 'es'}`) : 'Nobody by that name. Check the spelling, or try a nickname.';
      }
      hint.textContent = note;
      list.innerHTML = rows.map(m => {
        const tag = m.id === this.a ? 'Person 1' : m.id === this.b ? 'Person 2' : '';
        return `<li role="option" id="relOpt${m.id}" data-id="${m.id}" aria-selected="false">${this.avatar(m, 'rel-opt-av')}
          <span class="rel-opt-txt"><span class="rel-opt-name">${esc(m.name)}${m.nickname ? ` <i>“${esc(m.nickname)}”</i>` : ''}</span><span class="rel-opt-meta">${esc(lifeYears(m))}</span></span>${tag ? `<span class="rel-opt-tag">${tag}</span>` : ''}</li>`;
      }).join('');
      document.getElementById('relPickInput').removeAttribute('aria-activedescendant');
      if (q && rows.length) this.activate([...list.children], 0);
    }

    // ─── the drawing ───────────────────────────────────────────────────────
    // A unit is a person (a), the partner who explains the next step down (b), an extra spouse on the
    // path (x), and children units. On A's (left) and B's (right) branch, partners sit on the outer side.
    unit(m, extra) { return Object.assign({ a: m, b: null, x: null, kids: [], hot: [], side: null, couple: false, hotX: false }, extra || {}); }

    // the units for one side: chain = [top, ..., end]; returns the unit just below the top
    branch(chain, side, lit, context, partners) {
      let below = null;
      for (let i = chain.length - 1; i >= 1; i--) {
        const m = chain[i], u = this.unit(m, { side });
        lit.add(m.id);
        if (below) { u.b = partners ? this.coParent(m, chain[i + 1]) : null; u.kids = [below]; u.hot = [below]; }
        if (context && i > 1) {   // one brother or sister of each person on short paths (the top's other children are added separately)
          const sib = (this.kids.get(chain[i - 1].id) || []).find(k => k.id !== m.id && k.id !== (chain[i + 1] || {}).id && !lit.has(k.id));
          if (sib) u.ctxSib = this.unit(sib);
        }
        below = u;
      }
      return below;
    }
    // put each unit's context sibling beside it, on the outer side
    addSiblings(u) {
      u.kids.slice().forEach(k => {
        this.addSiblings(k);
        if (k.ctxSib) { const i = u.kids.indexOf(k); u.kids.splice(k.side === 'A' ? i : i + 1, 0, k.ctxSib); }
      });
    }

    buildTree(phone) {
      const a = this.byId.get(this.a), b = this.byId.get(this.b), rel = this.rel, lit = new Set();
      if (!a) return null;
      if (!b || !rel || rel.kind === 'self') {
        // only person 1: their close family, to tap the second person
        const [f, mo] = [this.byId.get(a.fid), this.byId.get(a.mid)];
        const me = this.unit(a, { b: this.spousesOf(a)[0] || null });
        me.kids = (this.kids.get(a.id) || []).slice(0, phone ? 4 : 6).map(k => this.unit(k));
        if (!f && !mo) return { root: me, lit };
        const top = this.unit(f || mo, { b: f && mo ? mo : null });
        const sibs = this.calc.getSiblings(a).slice(0, phone ? 2 : 4).map(s => this.unit(s));
        const half = Math.ceil(sibs.length / 2);
        top.kids = [...sibs.slice(0, half), me, ...sibs.slice(half)];
        return { root: top, lit };
      }
      if (rel.kind === 'none') return { root: null, lit, apart: [a, b] };
      if (rel.kind === 'path') return { path: rel.path };
      if (rel.kind === 'spouse') {
        const both = (this.kids.get(a.id) || []).filter(k => k.fid === b.id || k.mid === b.id).slice(0, 3);
        return { root: this.unit(a, { b, couple: true, kids: both.map(k => this.unit(k)) }), lit: new Set([a.id, b.id]) };
      }
      const r = rel.r, short = !phone && Math.max(r.dx, r.dy) <= 2;   // phones get the path and the shared couple only
      const top = this.unit(r.top);
      lit.add(r.top.id);
      if (r.pair) { top.b = r.pair; top.couple = true; lit.add(r.pair.id); }
      else if (!phone && (!r.dx || !r.dy)) { const c = (r.dx ? r.chainX : r.chainY)[1]; if (c) top.b = this.coParent(r.top, c); }
      const left = r.dx ? this.branch(r.chainX, 'A', lit, short, !phone) : null;
      const right = r.dy ? this.branch(r.chainY, 'B', lit, short, !phone) : null;
      // the shared ancestors' other children, a couple at most, between the two lines
      const onPath = new Set([left, right].filter(Boolean).map(u => u.a.id));
      const extras = (r.dx && r.dy) ? (this.kids.get(r.top.id) || []).filter(k => !onPath.has(k.id) && (!r.pair || k.fid === r.pair.id || k.mid === r.pair.id)).slice(0, phone ? 0 : short ? 2 : 1).map(k => this.unit(k)) : [];
      top.kids = [left, ...extras, right].filter(Boolean);
      top.hot = [left, right].filter(Boolean);
      // an attached spouse sits beside the end of the blood line
      const endOf = (u, m) => { if (!u) return null; if (u.a.id === m.id) return u; for (const k of u.hot) { const f = endOf(k, m); if (f) return f; } return null; };
      if (rel.sa) { const u = endOf(top, rel.r.chainX[rel.r.chainX.length - 1]); u.x = a; u.hotX = true; lit.add(a.id); }
      if (rel.tb) { const u = endOf(top, rel.r.chainY[rel.r.chainY.length - 1]); u.x = b; u.hotX = true; lit.add(b.id); }
      if (short) this.addSiblings(top);
      return { root: top, lit };
    }

    draw() {
      const stage = document.getElementById('relStage'), canvas = document.getElementById('relCanvas');
      const phone = innerWidth < 600;
      const S = phone ? { NW: 100, NH: 104, SG: 10, HG: 14, VG: 44 } : { NW: 128, NH: 116, SG: 16, HG: 24, VG: 56 };
      const tree = this.buildTree(phone);
      if (!tree) {
        stage.style.width = stage.style.height = '';
        stage.innerHTML = `<div class="rel-empty"><p>Pick two people to see how they’re related.</p>
          <button type="button" class="rel-btn rel-btn-p" onclick="relationView.openPicker(1)">Choose person 1</button></div>`;
        return;
      }
      const nodes = [], segs = [], hot = [];
      const seg = (x, y, w, h, list) => (list || segs).push([x, y, w, h]);
      const ends = { [this.a]: 1, [this.b]: 2 };
      const found = !!(this.b && this.rel && this.rel.kind !== 'self');
      const lit = tree.lit || new Set();
      const node = (m, cx, top, role) => nodes.push({ m, cx, top, role });
      let W, H;

      if (tree.path) {
        // a long chain (in-laws of in-laws): one step per column, up and down by generation
        const P = tree.path, row = [0], col = [0];
        let dir = 0;
        for (let i = 1; i < P.length; i++) {
          const p = P[i - 1], c = P[i];
          const d = p.fid === c.id || p.mid === c.id ? -1 : c.fid === p.id || c.mid === p.id ? 1 : 0;
          row[i] = row[i - 1] + d;
          col[i] = col[i - 1] + (d === 0 || (dir && d !== dir) ? 1 : 0);   // a new column for a marriage or a turn
          dir = d;
        }
        const min = Math.min(...row), step = S.NW + S.HG;
        P.forEach((m, i) => node(m, col[i] * step + S.NW / 2, (row[i] - min) * (S.NH + S.VG), 'lit'));
        for (let i = 1; i < P.length; i++) {
          const p = nodes[i - 1], c = nodes[i];
          if (p.top === c.top) seg(p.cx, p.top + S.NH / 2 - 2.5, c.cx - p.cx, 5, hot);
          else {
            const hi = p.top < c.top ? p : c, lo = p.top < c.top ? c : p, bus = hi.top + S.NH + S.VG / 2;
            seg(hi.cx - 2.5, hi.top + S.NH - 6, 5, bus - hi.top - S.NH + 6, hot);
            seg(Math.min(hi.cx, lo.cx) - 2.5, bus - 2.5, Math.abs(hi.cx - lo.cx) + 5, 5, hot);
            seg(lo.cx - 2.5, bus, 5, lo.top + 6 - bus, hot);
          }
        }
        W = (col[col.length - 1] + 1) * step - S.HG; H = (Math.max(...row) - min + 1) * (S.NH + S.VG) - S.VG;
      } else if (tree.apart) {
        node(tree.apart[0], S.NW / 2, 0, 'lit'); node(tree.apart[1], S.NW * 1.5 + S.HG * 4, 0, 'lit');
        W = S.NW * 2 + S.HG * 4; H = S.NH;
      } else {
        const { NW, NH, SG, HG, VG } = S;
        const people = u => (u.side === 'A' ? [u.x, u.b, u.a] : u.side === 'B' ? [u.a, u.b, u.x] : [u.x, u.a, u.b]).filter(Boolean);
        const measure = u => {
          const n = people(u).length; u.uw = n * NW + (n - 1) * SG;
          let kw = 0; u.kids.forEach((k, i) => { measure(k); kw += k.sw + (i ? HG : 0); });
          u.kw = kw; u.sw = Math.max(u.uw, kw);
        };
        let depth = 0;
        const place = (u, c0, d) => {
          depth = Math.max(depth, d + NH);
          const uc = c0 + (u.sw - u.uw) / 2, row = people(u), pos = new Map();
          row.forEach((m, i) => {
            const cx = uc + i * (NW + SG) + NW / 2; pos.set(m, cx);
            node(m, cx, d, ends[m.id] ? 'end' : lit.has(m.id) ? 'lit' : 'ctx');
          });
          const ax = pos.get(u.a), my = d + NH / 2;
          for (let i = 1; i < row.length; i++) seg(pos.get(row[i - 1]), my - 1, NW + SG, 2);
          if (u.couple) seg(Math.min(ax, pos.get(u.b)), my - 2.5, NW + SG, 5, hot);
          if (u.hotX) seg(Math.min(ax, pos.get(u.x)), my - 2.5, NW + SG, 5, hot);
          const mid = u.b ? (ax + pos.get(u.b)) / 2 : ax, mtop = u.b ? my : d + NH - 6, bus = d + NH + VG / 2;
          if (!u.kids.length) return;
          seg(mid - 1, mtop, 2, bus - mtop);
          let kc = c0 + (u.sw - u.kw) / 2, lo = mid, hi = mid;
          u.kids.forEach(k => {
            place(k, kc, d + NH + VG);
            const kx = k.ax;
            seg(kx - 1, bus, 2, d + NH + VG + 6 - bus);
            lo = Math.min(lo, kx); hi = Math.max(hi, kx);
            kc += k.sw + HG;
          });
          seg(lo - 1, bus - 1, hi - lo + 2, 2);
          if (u.hot.length) {
            if (u.b && !u.couple) seg(Math.min(ax, mid), my - 2.5, Math.abs(mid - ax), 5, hot);   // from the person to where the line drops
            seg(mid - 2.5, mtop, 5, bus - mtop, hot);
            u.hot.forEach(k => {
              seg(Math.min(mid, k.ax) - 2.5, bus - 2.5, Math.abs(mid - k.ax) + 5, 5, hot);
              seg(k.ax - 2.5, bus, 5, d + NH + VG + 6 - bus, hot);
            });
          }
        };
        measure(tree.root);
        // where each unit's person sits, so a parent knows where its lines land
        const pre = (u, c0) => {
          const uc = c0 + (u.sw - u.uw) / 2; u.ax = uc + people(u).indexOf(u.a) * (NW + SG) + NW / 2;
          let kc = c0 + (u.sw - u.kw) / 2; u.kids.forEach(k => { pre(k, kc); kc += k.sw + HG; });
        };
        pre(tree.root, 0);
        place(tree.root, 0, 0);
        W = tree.root.sw; H = depth;
      }

      stage.style.width = W + 'px'; stage.style.height = H + 'px';
      stage.style.setProperty('--nw', S.NW + 'px'); stage.style.setProperty('--nh', S.NH + 'px');
      const box = ([x, y, w, h], cls) => `<span class="${cls}" aria-hidden="true" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px"></span>`;
      stage.innerHTML = segs.map(s => box(s, 'rel-ln')).join('') + hot.map(s => box(s, 'rel-ln is-hot')).join('') +
        nodes.map(({ m, cx, top, role }) => {
          const end = ends[m.id], cls = end ? 'is-end' : role === 'lit' && found ? 'is-lit' : found && role === 'ctx' ? 'is-ctx' : '';
          const yrs = lifeYears(m);
          return `<button type="button" class="rel-node ${cls}" data-id="${m.id}" style="left:${cx - S.NW / 2}px;top:${top}px" title="${esc(m.name)}${yrs ? ' · ' + yrs : ''}"
            aria-label="${esc(m.name)}${yrs ? ', ' + yrs : ''}${end ? ', person ' + end : ''}"${end ? ' aria-pressed="true"' : ''}>
            ${end ? `<span class="rel-badge" aria-hidden="true">${end}</span>` : ''}${this.avatar(m, 'rel-av')}
            <span class="rel-nm">${esc(m.name)}</span>${yrs ? `<span class="rel-yr">${esc(yrs)}</span>` : ''}</button>`;
        }).join('') + (tree.apart ? `<span class="rel-gap" style="left:${S.NW}px;top:${S.NH / 2 - 12}px;width:${S.HG * 4}px">no recorded link</span>` : '');

      // big drawings shrink a little to fit (not on phones, where names would get too small),
      // then the two people are scrolled into view
      const cs = getComputedStyle(canvas), padX = parseFloat(cs.paddingLeft) * 2, padY = parseFloat(cs.paddingTop) * 2;
      const z = phone ? 1 : Math.max(0.8, Math.min(1, (canvas.clientWidth - padX) / W, (canvas.clientHeight - padY) / H));
      stage.style.zoom = z === 1 ? '' : z;
      const picked = nodes.filter(n => ends[n.m.id]);
      if (W * z > canvas.clientWidth - padX) {
        const cx = picked.length ? picked.reduce((s, n) => s + n.cx, 0) / picked.length : W / 2;
        canvas.scrollLeft = padX / 2 + cx * z - canvas.clientWidth / 2;
      } else canvas.scrollLeft = 0;
      if (!phone && H * z > canvas.clientHeight - padY && picked.length) canvas.scrollTop = padY / 2 + (Math.max(...picked.map(n => n.top)) + S.NH) * z - canvas.clientHeight + padY / 2;
      else canvas.scrollTop = 0;
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    const view = new RelationView();
    view.init().catch(err => console.error('Relation finder failed:', err));
  });
})();
