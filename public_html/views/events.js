// views/events.js — Family events: timeline (D3) · list · calendar
// Events are derived from member data already returned by api-family.php:
//   birth_date → birthday, anniversary_date → anniversary, death_date → remembrance.
// Family events (type 'custom') are the days the family adds by hand, from api-events.php;
// editors add, change and remove them through admin/events-api.php.
// Privacy still applies: guests only see what the tree's settings expose.

const EV_KINDS = {
  celebration: { label: 'Celebration', color: '#c2410c' },
  remembrance: { label: 'Remembrance', color: '#6b5b95' },
  milestone:   { label: 'Milestone',   color: '#0f766e' },
  gathering:   { label: 'Gathering',   color: '#1d4ed8' },
  other:       { label: 'Event',       color: '#a16207' },
};
const EV_TRASH = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/></svg>';
const evEsc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

class EventsView extends FamilyTreeController {
  constructor() {
    super('events');
    this.events  = [];           // { type, date:Date, month, day, year, member, spouse? } · custom: { type:'custom', kind, c, title, people, yearly }
    this.custom  = [];           // family events as the API returns them
    this.mode    = 'timeline';
    this.enabled = { birthday: true, anniversary: true, death: true, custom: true };
    this.q = '';
    this.calMonth = new Date(); this.calMonth.setDate(1);
    this.root = null;
    this._zoom = null; this._svg = null; this._x0 = null;
  }

  async init() {
    const ok = await super.init();
    if (!ok) return false;
    this.root = document.getElementById('tree-root');
    this.updateStats();
    await this.loadCustom();
    this.buildEvents();
    this.wireControls();
    this.focusId = ftFocusParam();
    window.ftFocusMember = id => this.setFocus(id);
    if (this.focusId) this.jumpCalendar();
    this.render();
    this.updateChip();
    return true;
  }

  async loadCustom() {
    try {
      const r = await fetch('/api-events.php?tree=' + encodeURIComponent(window.FT_TREE_SLUG || ''));
      const d = r.ok ? await r.json() : [];
      this.custom = Array.isArray(d) ? d : [];
    } catch (e) { this.custom = []; }
  }

  // ─── Focus: one person's events stand out, the rest fade ────────────────

  isFocus(e) {
    if (!this.focusId) return false;
    if (e.type === 'custom') return e.people.some(p => p.id === this.focusId);
    return e.member.id === this.focusId || (e.spouse && e.spouse.id === this.focusId);
  }
  setFocus(id) {
    this.focusId = id || null;
    ftSetFocusUrl(this.focusId);
    if (this.focusId) this.jumpCalendar();
    this.render(); this.updateChip();
  }
  jumpCalendar() {
    const t = new Date(), mine = this.events.filter(e => this.isFocus(e));
    if (!mine.length) return;
    const key = d => d < 0 ? 1e6 - d : d;      // past one-off events last
    const next = mine.map(e => ({ e, ...this.upcoming(e, t) })).sort((a, b) => key(a.days) - key(b.days))[0].next;
    this.calMonth = new Date(next.getFullYear(), next.getMonth(), 1);
  }
  updateChip() {
    if (!this.focusId) return ftFocusChip(null);
    const m = this.familyData.find(x => x.id === this.focusId); if (!m) return ftFocusChip(null);
    const n = this.events.filter(e => this.isFocus(e)).length;
    const name = String(m.name || '').replace(/[<>&]/g, '');
    ftFocusChip(n ? `Highlighting <b>${name}</b> · ${n} event${n === 1 ? '' : 's'}` : `<b>${name}</b> has no dated events yet`, () => { this.focusId = null; this.render(); });
  }

  // ─── Data ────────────────────────────────────────────────────────────────

  buildEvents() {
    this.events = [];
    const byId = new Map(this.familyData.map(m => [m.id, m]));
    const seenAnniv = new Set();
    const parse = d => {
      if (!d || !/^\d{4}-\d{2}-\d{2}/.test(String(d))) return null;
      const [y, m, dd] = String(d).slice(0, 10).split('-').map(Number);
      if (!m || !dd) return null;
      return { year: y, month: m, day: dd, date: new Date(y, m - 1, dd) };
    };
    this.familyData.forEach(m => {
      const b = parse(m.birth_date);
      if (b) this.events.push({ type: 'birthday', member: m, ...b });
      const d = parse(m.death_date);
      if (d) this.events.push({ type: 'death', member: m, ...d });
      const a = parse(m.anniversary_date);
      if (a) {
        const spouse = (m.pids || []).map(id => byId.get(id)).find(Boolean);
        const key = spouse ? [m.id, spouse.id].sort().join('_') : String(m.id);
        if (!seenAnniv.has(key)) { seenAnniv.add(key); this.events.push({ type: 'anniversary', member: m, spouse, ...a }); }
      }
    });
    // approximate dates: placed mid-year (or mid-range) and drawn dashed, only on the timeline
    const approxDate = a => {
      if (!a || !a.y) return null;
      const y = a.q === 'bet' && a.y2 ? Math.round((a.y + a.y2) / 2) : a.y;
      return { year: y, month: 7, day: 1, date: new Date(y, 6, 1) };
    };
    this.familyData.forEach(m => {
      const x = (m.extra && typeof m.extra === 'object') ? m.extra : {};
      if (!m.birth_date && x.birth_approx) { const d = approxDate(x.birth_approx); if (d) this.events.push({ type: 'birthday', member: m, approx: window.ftApproxLabel ? ftApproxLabel(x.birth_approx) : '', ...d }); }
      if (!m.death_date && x.death_approx) { const d = approxDate(x.death_approx); if (d) this.events.push({ type: 'death', member: m, approx: window.ftApproxLabel ? ftApproxLabel(x.death_approx) : '', ...d }); }
    });
    // family events: a yearly one without a year has no place on the timeline (date null)
    this.custom.forEach(c => {
      const p = /^(\d{4}|-)-(\d{2})-(\d{2})$/.exec(c.date || ''); if (!p) return;
      const year = p[1] === '-' ? null : Number(p[1]), month = Number(p[2]), day = Number(p[3]);
      const people = (c.people || []).map(id => byId.get(id)).filter(Boolean);
      this.events.push({ type: 'custom', kind: EV_KINDS[c.kind] ? c.kind : 'other', c, title: c.title, people, member: people[0] || null,
        yearly: !!c.yearly, year, month, day, date: year ? new Date(year, month - 1, day) : null });
    });
    this.events.sort((x, y) => (x.date || Infinity) - (y.date || Infinity) || 0);
    this.buildTithis();
  }

  // Hindu dates that come round every year: shraddh / barsi by the death tithi, and birthdays kept by tithi.
  // A tithi typed by hand wins; otherwise the death date's own tithi is used.
  buildTithis() {
    this.tithis = [];
    const P = window.FTPanchang; if (!P) return;
    this.familyData.forEach(m => {
      const x = (m.extra && typeof m.extra === 'object') ? m.extra : {};
      const add = (type, t) => { if (t && t.m && t.p && t.t) this.tithis.push({ type, member: m, t }); };
      if (x.death_tithi) add('death', x.death_tithi);
      else if ((!window.ftAutoTithi || window.ftAutoTithi()) && Number(m.is_alive) === 0 && /^\d{4}-\d{2}-\d{2}/.test(m.death_date || '')) {
        try { const o = P.tithiOf(String(m.death_date).slice(0, 10)); add('death', { m: o.masa, p: o.paksha, t: o.tithi }); } catch (e) {}
      }
      if (x.birth_tithi) add('birthday', x.birth_tithi);
    });
  }
  // the next day a tithi falls on, from a date
  tithiNext(item, from) {
    const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    try { const s = window.FTPanchang.nextTithiDate(item.t.m, item.t.p, item.t.t, iso(from)); if (!s) return null; const [y, mo, d] = s.split('-').map(Number); return new Date(y, mo - 1, d); }
    catch (e) { return null; }
  }
  tithiName(item) { return window.ftTithiLabel ? ftTithiLabel({ m: item.t.m, p: item.t.p, t: item.t.t }) : ''; }

  // ─── Search ──────────────────────────────────────────────────────────────

  matches(e) {
    if (!this.q) return true;
    const hay = [this.label(e), this.typeName(e), e.member && e.member.name, e.spouse && e.spouse.name,
      ...(e.people || []).map(p => p.name), e.c && e.c.place, e.c && e.c.note].filter(Boolean).join(' ').toLowerCase();
    return hay.includes(this.q);
  }
  tithiMatches(t) { return !this.q || `${t.member.name} ${t.type === 'death' ? 'shraddh remembrance' : 'birthday'} tithi`.toLowerCase().includes(this.q); }

  visible() { return this.events.filter(e => this.enabled[e.type] && this.matches(e)); }

  label(e) {
    if (e.type === 'custom') return e.title;
    if (e.type === 'anniversary') return e.spouse ? `${e.member.name} & ${e.spouse.name}` : e.member.name;
    return e.member.name;
  }
  typeName(e) { return e.type === 'custom' ? EV_KINDS[e.kind].label : { birthday: 'Born', anniversary: 'Married', death: 'Passed away' }[e.type]; }
  colorOf(e, col) { return e.type === 'custom' ? EV_KINDS[e.kind].color : col[e.type]; }
  dotClass(e) { return e.type === 'custom' ? `k-${e.kind}` : e.type; }
  // "12 Mar 1998", "12 Mar · every year"
  customDate(e, withYear = true) {
    const d = new Date(e.year || 2000, e.month - 1, e.day);
    const s = d.toLocaleDateString(undefined, e.year && withYear ? { day: 'numeric', month: 'short', year: 'numeric' } : { day: 'numeric', month: 'short' });
    return e.yearly ? `${s} · every year` : s;
  }

  // Next occurrence of a recurring month/day from today; returns { next:Date, days, years }
  // a one-off family event happens once: days is negative once it has passed
  upcoming(e, today = new Date()) {
    const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    if (e.type === 'custom' && !e.yearly) return { next: e.date, days: Math.round((e.date - t0) / 864e5), years: 0, once: true };
    let next = new Date(t0.getFullYear(), e.month - 1, e.day);
    if (next < t0) next = new Date(t0.getFullYear() + 1, e.month - 1, e.day);
    return { next, days: Math.round((next - t0) / 864e5), years: e.year ? next.getFullYear() - e.year : null };
  }

  openMember(m) {
    if (typeof openMemberPanel === 'function') openMemberPanel(m, dataUtils.findRelatives(m, this.familyData));
  }

  // ─── Controls ────────────────────────────────────────────────────────────

  wireControls() {
    document.querySelectorAll('#evViewSeg .seg-btn').forEach(b => b.addEventListener('click', () => {
      document.querySelectorAll('#evViewSeg .seg-btn').forEach(x => x.classList.toggle('active', x === b));
      this.mode = b.dataset.view; this.render();
    }));
    document.querySelectorAll('#evFilters input').forEach(c => c.addEventListener('change', () => {
      this.enabled[c.dataset.type] = c.checked; this.render();
    }));
    window.addEventListener('ft:viewsearch', e => { this.q = String((e.detail && e.detail.q) || '').trim().toLowerCase(); this.render(); });
    const filters = document.getElementById('evFilters');
    if (window.FT_CAN_EDIT && filters && !document.getElementById('evAdd')) {
      // at the end of the filter chips, so it doesn't sit alone on its own row
      filters.insertAdjacentHTML('beforeend', `<button type="button" class="btn btn-cta btn-sm" id="evAdd">${ICONS.plus} Add event</button>`);
      document.getElementById('evAdd').addEventListener('click', () => this.openForm());
    }
  }

  clearSearch() {
    const input = document.getElementById('viewSearchInput');
    if (input) input.value = '';
    window.dispatchEvent(new CustomEvent('ft:viewsearch', { detail: { q: '' } }));
  }
  emptySearch() {
    this.root.innerHTML = `<div class="ev-empty"><h3>No events match “${evEsc(this.q)}”</h3><p>Try a name, a place or a word from the event.</p><button type="button" class="btn btn-soft btn-sm ev-clear-search">Clear search</button></div>`;
    this.root.querySelector('.ev-clear-search').addEventListener('click', () => this.clearSearch());
  }

  render() {
    if (!this.root) return;
    this.hideTip();
    if (!this.visible().length) {
      if (this.q) return this.emptySearch();
      const add = window.FT_CAN_EDIT ? ' Or press <b>Add event</b> to add a family event.' : '';
      this.root.innerHTML = `<div class="ev-empty"><h3>No dated events yet</h3><p>${this.events.length ? 'All event types are hidden. Turn one back on above.' : 'Add birth, anniversary or death dates to members and they appear here. Guests only see dates the tree\'s privacy settings make public.' + add}</p></div>`;
      return;
    }
    if (this.mode === 'timeline') this.renderTimeline();
    else if (this.mode === 'list') this.renderList();
    else this.renderCalendar();
  }

  // ─── Timeline: decade bands, avatar nodes, always-on labels, overview brush ──

  renderTimeline() {
    const ev = this.visible().filter(e => e.date);
    if (!ev.length) {
      this.root.innerHTML = '<div class="ev-empty"><h3>Nothing to place on the timeline</h3><p>These events have no year, so they are not on the timeline. Switch to <b>List</b> or <b>Calendar</b> to see them.</p></div>';
      return;
    }
    this.root.innerHTML = `
      <div class="ev-timeline">
        <svg id="evSvg"></svg>
        <div class="ev-legend">
          <span><i class="dot dot-birthday"></i>Born</span>
          <span><i class="dot dot-anniversary"></i>Married</span>
          <span><i class="dot dot-death"></i>Passed away</span>
          ${this.custom.length ? '<span><i class="dot dot-custom"></i>Family events</span>' : ''}
        </div>
        <div class="ev-fab">
          <button type="button" id="evZoomIn" title="Zoom in" aria-label="Zoom in">${ICONS.plus}</button>
          <button type="button" id="evZoomOut" title="Zoom out" aria-label="Zoom out">${ICONS.minus}</button>
          <button type="button" id="evFit" title="Fit everything" aria-label="Fit everything">${ICONS.center}</button>
        </div>
        <div class="ev-tip" id="evTip" hidden></div>
        <div class="ev-hint">Scroll or pinch to zoom · drag to pan · drag the strip below to jump · click a person or event to open it</div>
      </div>`;
    const box = this.root.querySelector('.ev-timeline').getBoundingClientRect();
    const W = Math.max(320, box.width), H = Math.max(300, box.height);
    const OV_H = 46, AXIS_H = 30, PAD = 28;               // overview strip, axis, side padding
    const mainH = H - OV_H - AXIS_H - 16;
    const svg = d3.select('#evSvg').attr('width', W).attr('height', H);
    this._svg = svg;

    const dark = document.documentElement.getAttribute('data-theme') !== 'light';
    const col  = {
      birthday: '#4d7c0f', anniversary: '#c26d8c', death: '#8a7f68',
      axis: dark ? '#6b5f49' : '#b5a98e', text: dark ? '#a3977f' : '#635543', ink: dark ? '#ede5d4' : '#332e24',
      band: dark ? 'rgba(212,166,67,0.045)' : 'rgba(176,131,43,0.06)', bg: dark ? '#15110d' : '#fffdf6',
      today: dark ? '#e5c158' : '#b0832b',
    };
    const colOf = e => this.colorOf(e, col);
    const isC = e => e.type === 'custom';
    const [minD, maxD] = d3.extent(ev, e => e.date);
    const span = Math.max(maxD - minD, 10 * 365 * 864e5);
    const domain = [new Date(+minD - span * 0.06), new Date(Math.max(+maxD, Date.now()) + span * 0.06)];
    const x0 = d3.scaleTime().domain(domain).range([PAD, W - PAD]);
    this._x0 = x0;

    // clip so nodes never draw over the overview strip
    svg.append('defs').append('clipPath').attr('id', 'evClip').append('rect').attr('x', 0).attr('y', 0).attr('width', W).attr('height', mainH + 8);
    const bands = svg.append('g').attr('clip-path', 'url(#evClip)');
    const g     = svg.append('g').attr('clip-path', 'url(#evClip)');
    const axisG = svg.append('g').attr('transform', `translate(0,${mainH + 4})`);

    // avatar pattern defs (photos)
    const defs = svg.select('defs');
    const made = new Set();
    const pattern = m => {
      if (!m || !m.img || made.has(m.id)) return; made.add(m.id);
      defs.append('pattern').attr('id', `evp${m.id}`).attr('patternUnits', 'objectBoundingBox').attr('width', 1).attr('height', 1)
        .append('image').attr('href', m.img).attr('width', 36).attr('height', 36).attr('preserveAspectRatio', 'xMidYMid slice');
    };

    const R = 16, LABEL_W = 96, ROW_H = 58;
    const baseY = Math.round(mainH * 0.5);
    const placed = ev.map((e, i) => ({ e, i, lane: 0 }));
    // Lane packing keyed on label width so names never collide; lanes alternate above/below the spine
    // a highlighted person's events get the two lanes next to the spine; everyone else stacks beyond
    const layout = (x) => {
      const laneEnd = [], focusEnd = [];
      placed.forEach(p => {
        const px = x(p.e.date), mine = this.isFocus(p.e), ends = mine ? focusEnd : laneEnd;
        let l = 0;
        while (ends[l] !== undefined && px - ends[l] < LABEL_W) l++;
        ends[l] = px; p.lane = this.focusId ? (mine ? l : l + 2) : l;
      });
    };
    const laneY = (l) => baseY + (l % 2 ? 1 : -1) * (ROW_H / 2 + Math.floor(l / 2) * ROW_H);
    const open = e => isC(e) ? this.openCustom(e) : this.openMember(e.member);

    const draw = (x) => {
      layout(x);
      bands.selectAll('*').remove(); g.selectAll('*').remove();
      // decade bands + labels
      const [d0, d1] = x.domain();
      const y0 = Math.floor(d0.getFullYear() / 10) * 10, y1 = d1.getFullYear();
      const pxPerYear = x(new Date(2001, 0, 1)) - x(new Date(2000, 0, 1));
      const step = pxPerYear * 10 > 70 ? 10 : pxPerYear * 50 > 70 ? 50 : 100;
      for (let y = Math.floor(y0 / step) * step; y <= y1; y += step) {
        const a = x(new Date(y, 0, 1)), b = x(new Date(y + step, 0, 1));
        if ((y / step) % 2 === 0) bands.append('rect').attr('x', a).attr('y', 0).attr('width', b - a).attr('height', mainH).attr('fill', col.band);
        bands.append('text').attr('x', a + 6).attr('y', 16).attr('fill', col.text).attr('font-size', 11).attr('font-family', 'Georgia, serif').attr('opacity', .8).text(y + 's');
      }
      // spine + today
      g.append('line').attr('x1', 0).attr('x2', W).attr('y1', baseY).attr('y2', baseY).attr('stroke', col.axis).attr('stroke-width', 1.5);
      const tx = x(new Date());
      if (tx > 0 && tx < W) {
        g.append('line').attr('x1', tx).attr('x2', tx).attr('y1', 22).attr('y2', mainH).attr('stroke', col.today).attr('stroke-dasharray', '3,4');
        g.append('text').attr('x', tx + 4).attr('y', 34).attr('fill', col.today).attr('font-size', 10).attr('font-weight', 700).text('TODAY');
      }
      // nodes
      const shown = placed.filter(p => { const px = x(p.e.date); return px > -LABEL_W && px < W + LABEL_W; });
      shown.forEach(p => { if (!isC(p.e)) pattern(p.e.member); });
      const nodes = g.selectAll('.ev-node').data(shown).enter().append('g')
        .attr('class', p => 'ev-node' + (isC(p.e) ? ' ev-node-custom' : '') + (this.focusId ? (this.isFocus(p.e) ? ' is-focus' : ' is-dim') : ''))
        .attr('transform', p => `translate(${x(p.e.date)},${laneY(p.lane)})`)
        .attr('tabindex', 0).attr('role', 'button').attr('aria-label', p => `${this.label(p.e)}, ${this.typeName(p.e)} ${p.e.year}`)
        .on('click', (_, p) => open(p.e))
        .on('keydown', (evt, p) => { if (evt.key === 'Enter' || evt.key === ' ') { evt.preventDefault(); open(p.e); } })
        .on('mouseenter', (evt, p) => this.showTip(evt, p.e))
        .on('mousemove', (evt) => this.moveTip(evt))
        .on('mouseleave', () => this.hideTip());
      nodes.append('line').attr('y1', 0).attr('y2', p => baseY - laneY(p.lane)).attr('stroke', col.axis).attr('stroke-dasharray', '2,3');
      nodes.append('circle').attr('r', 3).attr('cy', p => baseY - laneY(p.lane)).attr('fill', p => colOf(p.e));
      // people: round avatar · family events: a rounded square with the event's first letter
      const ppl = nodes.filter(p => !isC(p.e)), cus = nodes.filter(p => isC(p.e));
      ppl.append('circle').attr('r', R).attr('fill', p => p.e.member.img ? `url(#evp${p.e.member.id})` : (dark ? '#2a2218' : '#f1e9d8'));
      cus.append('rect').attr('x', -R).attr('y', -R).attr('width', R * 2).attr('height', R * 2).attr('rx', 7).attr('fill', dark ? '#2a2218' : '#f1e9d8');
      nodes.filter(p => isC(p.e) || !p.e.member.img).append('text').attr('text-anchor', 'middle').attr('dominant-baseline', 'central')
        .attr('fill', p => isC(p.e) ? colOf(p.e) : col.ink).attr('font-family', 'Georgia, serif').attr('font-weight', 700).attr('font-size', 14)
        .text(p => (isC(p.e) ? p.e.title : (p.e.member.name || '?'))[0].toUpperCase());
      ppl.append('circle').attr('class', 'ev-ring').attr('r', R).attr('fill', 'none').attr('stroke', p => colOf(p.e)).attr('stroke-width', 2.5)
        .attr('stroke-dasharray', p => p.e.approx ? '4,3' : null);
      cus.append('rect').attr('class', 'ev-ring').attr('x', -R).attr('y', -R).attr('width', R * 2).attr('height', R * 2).attr('rx', 7)
        .attr('fill', 'none').attr('stroke', p => colOf(p.e)).attr('stroke-width', 2.5);
      nodes.filter(p => this.isFocus(p.e)).insert('circle', ':first-child').attr('class', 'ev-halo').attr('r', R + 7).attr('fill', 'none').attr('stroke', col.today).attr('stroke-width', 2);
      nodes.filter('.is-focus').raise();
      nodes.append('text').attr('y', p => (p.lane % 2 ? R + 14 : -R - 6)).attr('text-anchor', 'middle')
        .attr('fill', col.ink).attr('font-size', 11).attr('font-family', 'Georgia, serif').attr('font-weight', 700)
        .text(p => { const t = this.label(p.e); return t.length > 15 ? t.slice(0, 14) + '…' : t; });
      nodes.append('text').attr('y', p => (p.lane % 2 ? R + 26 : -R - 18)).attr('text-anchor', 'middle')
        .attr('fill', col.text).attr('font-size', 10).text(p => p.e.approx ? `${this.typeName(p.e)} ${p.e.approx}` : `${this.typeName(p.e)} ${p.e.year}`);
      axisG.call(d3.axisBottom(x).ticks(Math.max(4, Math.floor(W / 100))).tickSizeOuter(0))
        .call(a => a.selectAll('text').attr('fill', col.text).attr('font-size', 11))
        .call(a => a.selectAll('line,path').attr('stroke', col.axis));
      ovWindow(x);
    };

    // overview strip with brush
    const ovY = H - OV_H;
    const ov = svg.append('g').attr('transform', `translate(0,${ovY})`);
    ov.append('rect').attr('x', PAD).attr('y', 6).attr('width', W - PAD * 2).attr('height', OV_H - 12).attr('rx', 8).attr('fill', col.band).attr('stroke', col.axis);
    ov.selectAll('circle').data(ev).enter().append('circle').attr('cx', e => x0(e.date)).attr('cy', OV_H / 2)
      .attr('r', e => this.isFocus(e) ? 5.5 : 3).attr('fill', e => colOf(e)).attr('opacity', e => this.focusId && !this.isFocus(e) ? .3 : 1);
    const win = ov.append('rect').attr('y', 6).attr('height', OV_H - 12).attr('rx', 8).attr('fill', 'rgba(212,166,67,0.18)').attr('stroke', col.today).attr('stroke-width', 1.5).style('cursor', 'grab');
    const ovWindow = (x) => {
      const [a, b] = x.domain().map(x0);
      win.attr('x', Math.max(PAD, a)).attr('width', Math.max(12, Math.min(W - PAD, b) - Math.max(PAD, a)));
    };
    // drag the window → pan
    win.call(d3.drag().on('drag', (evt) => {
      const k = d3.zoomTransform(svg.node()).k;
      svg.call(zoom.translateBy, -evt.dx * k, 0);
    }));
    // click on strip → centre there
    ov.on('click', (evt) => {
      const [mx] = d3.pointer(evt);
      const t = d3.zoomTransform(svg.node());
      const target = x0.invert(mx);
      const cur = t.rescaleX(x0);
      const dx = cur(target) - W / 2;
      svg.call(zoom.translateBy, -dx / t.k, 0);
    });

    const zoom = d3.zoom().scaleExtent([1, 80]).translateExtent([[0, 0], [W, H]]).extent([[0, 0], [W, H]])
      .filter(evt => evt.type !== 'wheel' || true)
      .on('zoom', (evt) => draw(evt.transform.rescaleX(x0)));
    this._zoom = zoom;
    svg.call(zoom).on('dblclick.zoom', null);
    draw(x0);
    // zoom to the focused person's span of life
    const mine = ev.filter(e => this.isFocus(e));
    if (mine.length) {
      const [a, b] = d3.extent(mine, e => x0(e.date));
      const k = Math.max(1, Math.min(80, (W - PAD * 2) / Math.max(b - a + LABEL_W * 3, 1)));
      svg.call(zoom.transform, d3.zoomIdentity.translate(W / 2, 0).scale(k).translate(-(a + b) / 2, 0));
    }

    document.getElementById('evZoomIn').onclick  = () => svg.transition().duration(200).call(zoom.scaleBy, 1.5);
    document.getElementById('evZoomOut').onclick = () => svg.transition().duration(200).call(zoom.scaleBy, 1 / 1.5);
    document.getElementById('evFit').onclick     = () => svg.transition().duration(250).call(zoom.transform, d3.zoomIdentity);
  }

  showTip(evt, e) {
    const tip = document.getElementById('evTip'); if (!tip) return;
    if (e.type === 'custom') {
      const who = e.people.map(p => evEsc(p.name)).slice(0, 4).join(', ') + (e.people.length > 4 ? ' and others' : '');
      tip.innerHTML = `<b>${evEsc(e.title)}</b><span>${this.typeName(e)} · ${this.customDate(e)}</span>${who ? `<span>${who}</span>` : ''}${e.c.place ? `<span>${evEsc(e.c.place)}</span>` : ''}`;
    } else {
      const d = e.date.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
      const up = this.upcoming(e);
      const extra = e.type === 'death' ? `${up.years} years ago` : e.type === 'birthday' && Number(e.member.is_alive) === 1 ? `turns ${up.years} in ${up.days} day${up.days === 1 ? '' : 's'}` : `${up.years} years`;
      tip.innerHTML = `<b>${evEsc(this.label(e))}</b><span>${this.typeName(e)} · ${d}</span><span>${extra}</span>`;
    }
    tip.hidden = false; this.moveTip(evt);
  }
  moveTip(evt) {
    const tip = document.getElementById('evTip'); if (!tip) return;
    const r = this.root.getBoundingClientRect();
    tip.style.left = Math.min(evt.clientX - r.left + 14, r.width - 210) + 'px';
    tip.style.top  = Math.max(8, evt.clientY - r.top - 64) + 'px';
  }
  hideTip() { const t = document.getElementById('evTip'); if (t) t.hidden = true; }

  // ─── List: upcoming, then the full chronology ────────────────────────────

  customRow(e, right) {
    const c = e.c, canEdit = !!window.FT_CAN_EDIT;
    return `
      <div class="ev-row ev-row-custom${this.focusId && this.isFocus(e) ? ' is-focus' : ''}">
        <span class="dot dot-${this.dotClass(e)}"></span>
        <span class="ev-row-main">
          <button type="button" class="ev-row-title" data-cid="${c.id}"><b>${evEsc(c.title)}</b></button>
          <small>${this.typeName(e)} · ${this.customDate(e)}${c.place ? ' · ' + evEsc(c.place) : ''}</small>
          ${c.note ? `<span class="ev-note">${evEsc(c.note)}</span>` : ''}
          ${e.people.length ? `<span class="ev-chips">${e.people.map(p => `<button type="button" class="ev-chip" data-id="${p.id}">${evEsc(p.name)}</button>`).join('')}</span>` : ''}
        </span>
        <span class="ev-row-right">${right}${canEdit ? `<span class="ev-acts">
          <button type="button" class="ev-act" data-edit="${c.id}" aria-label="Edit ${evEsc(c.title)}" title="Edit">${ICONS.edit}</button>
          <button type="button" class="ev-act ev-act-del" data-del="${c.id}" aria-label="Delete ${evEsc(c.title)}" title="Delete">${EV_TRASH}</button></span>` : ''}</span>
      </div>`;
  }

  renderList() {
    const ev = this.visible().filter(e => !e.approx && (!this.focusId || this.isFocus(e)));
    if (!ev.length) { this.root.innerHTML = '<div class="ev-empty"><h3>No dated events for this person</h3><p>Clear the highlight above to see everyone.</p></div>'; return; }
    const up = ev.map(e => ({ e, ...this.upcoming(e) })).filter(u => u.days >= 0).sort((a, b) => a.days - b.days).slice(0, 12);
    const fmt = e => e.date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
    const row = (e, right) => e.type === 'custom' ? this.customRow(e, right) : `
      <button type="button" class="ev-row" data-id="${e.member.id}">
        <span class="dot dot-${e.type}"></span>
        <span class="ev-row-main"><b>${evEsc(this.label(e))}</b><small>${this.typeName(e)} · ${fmt(e)}</small></span>
        <span class="ev-row-right">${right}</span>
      </button>`;
    const when = u => (u.days === 0 ? 'Today' : `in ${u.days} day${u.days === 1 ? '' : 's'}`) + (u.e.type === 'custom'
      ? `<small>${u.once ? 'once' : u.years ? `${u.years} yrs` : 'every year'}</small>`
      : `<small>${u.e.type === 'death' ? `${u.years} yrs` : `turns ${u.years}`}</small>`);
    // tithi days in the next year, sorted in with the rest
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tUp = (this.tithis || []).filter(t => this.enabled[t.type] && this.tithiMatches(t) && (!this.focusId || t.member.id === this.focusId))
      .map(t => ({ t, next: this.tithiNext(t, today) })).filter(x => x.next)
      .map(x => ({ ...x, days: Math.round((x.next - today) / 864e5) }));
    const tRow = x => `
      <button type="button" class="ev-row ev-row-tithi" data-id="${x.t.member.id}">
        <span class="dot dot-${x.t.type}"></span>
        <span class="ev-row-main"><b>${evEsc(x.t.member.name)}</b><small>${x.t.type === 'death' ? 'Shraddh' : 'Birthday'} by tithi · ${this.tithiName(x.t)} · ${x.next.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</small></span>
        <span class="ev-row-right">${x.days === 0 ? 'Today' : `in ${x.days} day${x.days === 1 ? '' : 's'}`}<small>tithi</small></span>
      </button>`;
    const merged = [...up.map(u => ({ days: u.days, html: row(u.e, when(u)) })),
                    ...tUp.map(x => ({ days: x.days, html: tRow(x) }))].sort((a, b) => a.days - b.days).slice(0, 16);
    const upHtml = merged.map(x => x.html).join('');
    let year;
    const allHtml = ev.map(e => {
      const k = e.year || 'Every year, year not known';
      return (k !== year ? `<div class="ev-year">${year = k}</div>` : '') + row(e, e.year ? `${e.year}` : '');
    }).join('');
    this.root.innerHTML = `<div class="ev-list">${upHtml ? `<h3>Coming up</h3>${upHtml}` : ''}<h3>Every event</h3>${allHtml}</div>`;
    this.root.querySelectorAll('.ev-row[data-id], .ev-chip[data-id]').forEach(b => b.addEventListener('click', () => {
      const m = this.familyData.find(x => x.id === Number(b.dataset.id)); if (m) this.openMember(m);
    }));
    this.wireCustomButtons(this.root);
  }

  // edit / delete / open buttons of family events inside a container
  wireCustomButtons(box) {
    const find = id => this.events.find(e => e.type === 'custom' && e.c.id === Number(id));
    box.querySelectorAll('[data-cid]').forEach(b => b.addEventListener('click', () => { const e = find(b.dataset.cid); if (e) this.openCustom(e); }));
    box.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => { const e = find(b.dataset.edit); if (e) this.openForm(e.c); }));
    box.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => { const e = find(b.dataset.del); if (e) this.deleteCustom(e.c); }));
  }

  // ─── Calendar: month grid, recurring by month/day ────────────────────────

  renderCalendar() {
    const y = this.calMonth.getFullYear(), m = this.calMonth.getMonth();
    const today = new Date();
    const first = new Date(y, m, 1).getDay(), days = new Date(y, m + 1, 0).getDate();
    const byDay = {};
    this.visible().filter(e => !e.approx && e.month === m + 1 && (e.type !== 'custom' || e.yearly || e.year === y))
      .forEach(e => (byDay[e.day] = byDay[e.day] || []).push(e));
    (this.tithis || []).filter(t => this.enabled[t.type] && this.tithiMatches(t)).forEach(t => {
      const d = this.tithiNext(t, new Date(y, m, 1));
      if (d && d.getMonth() === m && d.getFullYear() === y) (byDay[d.getDate()] = byDay[d.getDate()] || []).push({ type: t.type, member: t.member, tithi: t, year: '' });
    });
    const focusCls = e => this.focusId ? (this.isFocus(e) ? ' is-focus' : ' is-dim') : '';
    let cells = '';
    for (let i = 0; i < first; i++) cells += '<div class="cal-cell cal-pad"></div>';
    for (let d = 1; d <= days; d++) {
      const isToday = today.getFullYear() === y && today.getMonth() === m && today.getDate() === d;
      const evs = byDay[d] || [];
      cells += `<div class="cal-cell${isToday ? ' cal-today' : ''}${evs.length ? ' cal-has' : ''}"><span class="cal-day">${d}</span>${
        evs.map(e => e.tithi
          ? `<button type="button" class="cal-ev cal-ev-tithi dot-bg-${e.type}" data-id="${e.member.id}" title="${e.type === 'death' ? 'Shraddh' : 'Birthday'} by tithi · ${this.tithiName(e.tithi)}">${evEsc(e.member.name)}</button>`
          : e.type === 'custom'
          ? `<button type="button" class="cal-ev cal-ev-custom dot-bg-${this.dotClass(e)}${focusCls(e)}" data-cid="${e.c.id}" title="${evEsc(this.typeName(e) + ' · ' + e.title)}">${evEsc(e.title)}</button>`
          : `<button type="button" class="cal-ev dot-bg-${e.type}${focusCls(e)}" data-id="${e.member.id}" title="${evEsc(`${this.typeName(e)} · ${this.label(e)} (${e.year})`)}">${evEsc(this.label(e))}</button>`).join('')}</div>`;
    }
    const title = this.calMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    this.root.innerHTML = `
      <div class="ev-cal">
        <div class="cal-head">
          <button type="button" class="btn btn-soft btn-sm" id="calPrev" aria-label="Previous month">${ICONS.chevronLeft}</button>
          <h3>${title}</h3>
          <button type="button" class="btn btn-soft btn-sm" id="calToday">Today</button>
          <button type="button" class="btn btn-soft btn-sm" id="calNext" aria-label="Next month">${ICONS.chevronRight}</button>
        </div>
        <div class="cal-grid">${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => `<div class="cal-dow">${d}</div>`).join('')}${cells}</div>
      </div>`;
    document.getElementById('calPrev').onclick  = () => { this.calMonth.setMonth(m - 1); this.render(); };
    document.getElementById('calNext').onclick  = () => { this.calMonth.setMonth(m + 1); this.render(); };
    document.getElementById('calToday').onclick = () => { this.calMonth = new Date(); this.calMonth.setDate(1); this.render(); };
    this.root.querySelectorAll('.cal-ev[data-id]').forEach(b => b.addEventListener('click', () => {
      const mem = this.familyData.find(x => x.id === Number(b.dataset.id)); if (mem) this.openMember(mem);
    }));
    this.wireCustomButtons(this.root);
  }

  // ─── Family events: details, add / edit, delete ──────────────────────────

  dialog(id, title, body) {
    document.getElementById(id)?.remove();
    const dlg = document.createElement('dialog');
    dlg.id = id; dlg.className = 'share-dialog ev-dlg';
    dlg.setAttribute('aria-labelledby', id + 'T');
    dlg.innerHTML = `<div class="share-head"><h3 id="${id}T">${title}</h3><button type="button" class="share-x" aria-label="Close">${ICONS.close}</button></div><div class="share-body">${body}</div>`;
    document.body.appendChild(dlg);
    dlg.querySelector('.share-x').addEventListener('click', () => dlg.close());
    dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
    dlg.addEventListener('close', () => dlg.remove());
    dlg.showModal();
    return dlg;
  }

  openCustom(e) {
    const c = e.c;
    const dlg = this.dialog('evShow', evEsc(c.title), `
      <p class="ev-dlg-meta"><span class="dot dot-${this.dotClass(e)}"></span>${this.typeName(e)} · ${this.customDate(e)}</p>
      ${c.place ? `<p class="ev-dlg-line">${ICONS.pin} ${evEsc(c.place)}</p>` : ''}
      ${c.note ? `<p class="ev-dlg-note">${evEsc(c.note)}</p>` : ''}
      ${e.people.length ? `<div class="ev-chips">${e.people.map(p => `<button type="button" class="ev-chip" data-id="${p.id}">${evEsc(p.name)}</button>`).join('')}</div>` : ''}
      ${window.FT_CAN_EDIT ? `<div class="share-row ev-dlg-acts"><button type="button" class="btn btn-soft" data-edit="${c.id}">${ICONS.edit} Edit</button><button type="button" class="btn btn-soft ev-act-del" data-del="${c.id}">${EV_TRASH} Delete</button></div>` : ''}`);
    dlg.querySelectorAll('.ev-chip').forEach(b => b.addEventListener('click', () => {
      const m = this.familyData.find(x => x.id === Number(b.dataset.id)); dlg.close(); if (m) this.openMember(m);
    }));
    dlg.querySelector('[data-edit]')?.addEventListener('click', () => { dlg.close(); this.openForm(c); });
    dlg.querySelector('[data-del]')?.addEventListener('click', () => this.deleteCustom(c, dlg));
  }

  openForm(c = null) {
    const noYear = !!(c && c.date.startsWith('--'));
    const dateVal = c ? (noYear ? new Date().getFullYear() + c.date.slice(1) : c.date) : '';
    const picked = new Set(c ? c.people : []);
    const err = f => `<p class="ev-err" id="evErr-${f}" hidden></p>`;
    const dlg = this.dialog('evForm', c ? 'Edit family event' : 'Add a family event', `
      <form class="ev-form" novalidate>
        <label class="ev-f"><span>Name</span><input name="title" maxlength="120" required placeholder="Diwali puja at Nani's house" aria-describedby="evErr-title" value="${c ? evEsc(c.title) : ''}">${err('title')}</label>
        <div class="ev-f-row">
          <label class="ev-f"><span>Kind</span><select name="kind" aria-describedby="evErr-kind">${Object.entries(EV_KINDS).map(([k, v]) => `<option value="${k}"${(c ? c.kind : 'celebration') === k ? ' selected' : ''}>${k === 'other' ? 'Other' : v.label}</option>`).join('')}</select>${err('kind')}</label>
          <label class="ev-f"><span>Date</span><input type="date" name="date" required aria-describedby="evErr-date" value="${dateVal}">${err('date')}</label>
        </div>
        <div class="ev-f-checks">
          <label class="chip-check"><input type="checkbox" name="yearly"${c && c.yearly ? ' checked' : ''}> Repeats every year</label>
          <label class="chip-check"><input type="checkbox" name="noyear"${noYear ? ' checked' : ''}${c && c.yearly ? '' : ' disabled'}> Year not known</label>
        </div>
        <fieldset class="ev-f ev-people" aria-describedby="evErr-people">
          <legend>People <small>(optional)</small></legend>
          <div class="ev-chips ev-picked" aria-live="polite"></div>
          <input type="search" class="ev-pick-q" placeholder="Find a person" aria-label="Find a person to add" autocomplete="off">
          <div class="ev-pick-list"></div>
          ${err('people')}
        </fieldset>
        <label class="ev-f"><span>Place <small>(optional)</small></span><input name="place" maxlength="255" aria-describedby="evErr-place" value="${c ? evEsc(c.place) : ''}">${err('place')}</label>
        <label class="ev-f"><span>Note <small>(optional)</small></span><textarea name="note" rows="3" maxlength="2000" aria-describedby="evErr-note">${c ? evEsc(c.note) : ''}</textarea>${err('note')}</label>
        <p class="ev-err" id="evErr-form" role="alert" hidden></p>
        <div class="share-row ev-dlg-acts">
          <button type="button" class="btn btn-soft" data-cancel>Cancel</button>
          <button type="submit" class="btn btn-cta">${c ? 'Save changes' : 'Add event'}</button>
        </div>
      </form>`);
    const form = dlg.querySelector('form');
    const yearly = form.elements.yearly, noyear = form.elements.noyear;
    yearly.addEventListener('change', () => { noyear.disabled = !yearly.checked; if (!yearly.checked) noyear.checked = false; });
    dlg.querySelector('[data-cancel]').addEventListener('click', () => dlg.close());

    // people picker: chips for the chosen, a filtered list of checkboxes for the rest
    const people = [...this.familyData].sort((a, b) => String(a.name).localeCompare(String(b.name)));
    const pickedBox = dlg.querySelector('.ev-picked'), list = dlg.querySelector('.ev-pick-list'), q = dlg.querySelector('.ev-pick-q');
    const drawPicked = () => {
      pickedBox.innerHTML = [...picked].map(id => this.familyData.find(m => m.id === id)).filter(Boolean)
        .map(m => `<button type="button" class="ev-chip ev-chip-x" data-id="${m.id}" aria-label="Remove ${evEsc(m.name)}">${evEsc(m.name)} <span aria-hidden="true">×</span></button>`).join('');
      pickedBox.querySelectorAll('button').forEach(b => b.addEventListener('click', () => { picked.delete(Number(b.dataset.id)); drawPicked(); drawList(); }));
    };
    const drawList = () => {
      const s = q.value.trim().toLowerCase();
      const hits = people.filter(m => !s || String(m.name).toLowerCase().includes(s));
      list.innerHTML = hits.slice(0, 40).map(m => `<label class="ev-pick"><input type="checkbox" value="${m.id}"${picked.has(m.id) ? ' checked' : ''}> ${evEsc(m.name)}</label>`).join('')
        + (hits.length > 40 ? `<p class="ev-pick-more">${hits.length - 40} more. Type to narrow the list.</p>` : '') + (hits.length ? '' : '<p class="ev-pick-more">Nobody by that name.</p>');
      list.querySelectorAll('input').forEach(i => i.addEventListener('change', () => { i.checked ? picked.add(Number(i.value)) : picked.delete(Number(i.value)); drawPicked(); }));
    };
    q.addEventListener('input', drawList);
    q.addEventListener('keydown', e => { if (e.key === 'Enter') e.preventDefault(); });
    drawPicked(); drawList();

    const showErr = (field, msg) => {
      const p = dlg.querySelector('#evErr-' + field) || dlg.querySelector('#evErr-form');
      p.textContent = msg; p.hidden = false;
      const input = form.elements[field];
      if (input && input.focus) { input.setAttribute('aria-invalid', 'true'); input.focus(); }
    };
    form.addEventListener('submit', async ev => {
      ev.preventDefault();
      dlg.querySelectorAll('.ev-err').forEach(p => { p.hidden = true; p.textContent = ''; });
      form.querySelectorAll('[aria-invalid]').forEach(i => i.removeAttribute('aria-invalid'));
      const f = form.elements;
      if (!f.title.value.trim()) return showErr('title', 'Give the event a name.');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(f.date.value)) return showErr('date', 'Choose a date.');
      const body = { title: f.title.value.trim(), kind: f.kind.value, yearly: f.yearly.checked,
        date: f.noyear.checked ? '--' + f.date.value.slice(5) : f.date.value,
        people: [...picked], place: f.place.value.trim(), note: f.note.value.trim() };
      const btn = form.querySelector('[type=submit]'); btn.disabled = true;
      try {
        const r = await fetch('/admin/events-api.php' + (c ? '?id=' + c.id : ''), {
          method: c ? 'PUT' : 'POST', credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': window.FT_CSRF_TOKEN || '' }, body: JSON.stringify(body) });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) {
          btn.disabled = false;
          return showErr(d.field || 'form', r.status === 401 ? 'You are signed out. Sign in again to save.' : (d.error || 'Could not save the event. Please try again.'));
        }
        if (c) this.custom = this.custom.map(x => x.id === d.id ? d : x); else this.custom.push(d);
        dlg.close();
        this.buildEvents(); this.render(); this.updateChip();
      } catch (e) { btn.disabled = false; showErr('form', 'Could not reach the server. Check your connection and try again.'); }
    });
  }

  async deleteCustom(c, dlg = null) {
    if (!confirm(`Delete “${c.title}”? This cannot be undone.`)) return;
    try {
      const r = await fetch('/admin/events-api.php?id=' + c.id, { method: 'DELETE', credentials: 'same-origin', headers: { 'X-CSRF-Token': window.FT_CSRF_TOKEN || '' } });
      if (!r.ok && r.status !== 404) { const d = await r.json().catch(() => ({})); alert(d.error || 'Could not delete the event.'); return; }
      this.custom = this.custom.filter(x => x.id !== c.id);
      if (dlg) dlg.close();
      this.buildEvents(); this.render(); this.updateChip();
    } catch (e) { alert('Could not reach the server. Check your connection and try again.'); }
  }

  onThemeChange() { if (this.mode === 'timeline') this.render(); }
}

document.addEventListener('DOMContentLoaded', () => {
  const view = new EventsView();
  view.init().catch(err => console.error('Events init failed:', err));
  window.eventsView = view;
  new MutationObserver(() => view.onThemeChange()).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  let rt; window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (view.mode === 'timeline') view.render(); }, 150); });
});
if (typeof module !== "undefined") module.exports = { EventsView };
