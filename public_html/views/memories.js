// views/memories.js — Memory Book: photos, videos and voice notes of the family, as one masonry wall.
// Media comes from /api-media.php (type = image | video | audio). Newest first, no year groups.

class MemoriesView extends FamilyTreeController {
  constructor() {
    super('memories');
    this.media = [];
    this.type = 'all';
    this.person = '';
    this.root = null;
    this._list = [];      // currently visible items, for lightbox prev/next
    this._lbIndex = -1;
  }

  async init() {
    const ok = await super.init();
    if (!ok) return false;
    this.updateStats();
    this.root = document.getElementById('tree-root');
    uiUtils.showLoading(this.root, 'Opening the memory book…');
    try {
      const r = await fetch('/api-media.php?tree=' + encodeURIComponent(window.FT_TREE_SLUG || ''));
      this.media = await r.json();
      if (!Array.isArray(this.media)) this.media = [];
    } catch (e) { console.error('media load failed', e); this.media = []; }
    const t = m => Date.parse(String(m.created_at || '').replace(' ', 'T')) || 0;
    this.media.sort((a, b) => t(b) - t(a));

    // Person filter: only people who are tagged on something
    const sel = document.getElementById('memPersonFilter');
    if (sel) {
      const tagged = new Map();
      this.media.forEach(m => m.members.forEach(p => tagged.set(p.id, p.name)));
      [...tagged.entries()].sort((a, b) => a[1].localeCompare(b[1]))
        .forEach(([id, name]) => sel.insertAdjacentHTML('beforeend', `<option value="${id}">${this.esc(name)}</option>`));
      sel.addEventListener('change', () => this.setFocus(Number(sel.value) || null));
    }
    document.querySelectorAll('#memTypeSeg .seg-btn').forEach(b => b.addEventListener('click', () => {
      document.querySelectorAll('#memTypeSeg .seg-btn').forEach(x => x.classList.toggle('active', x === b));
      this.type = b.dataset.type; this.render();
    }));
    window.ftFocusMember = id => this.setFocus(id);
    // toolbar search: captions and the names of the people tagged. Results are announced from a
    // region that lives outside the wall, since the wall is re-rendered on every change.
    this.q = ''; this.rawQ = '';
    this.live = document.createElement('div');
    this.live.className = 'sr-only'; this.live.setAttribute('role', 'status'); this.live.setAttribute('aria-live', 'polite');
    document.body.appendChild(this.live);
    window.addEventListener('ft:viewsearch', e => {
      this.rawQ = String((e.detail && e.detail.q) || '').trim();
      this.q = this.norm(this.rawQ);
      this.render();
    });
    const fp = ftFocusParam();
    if (fp) this.person = String(fp);
    this.syncSelect();
    this.render();
    this.updateChip();
    return true;
  }

  // ─── Focus: a person's memories (from the member card or the filter) ──────

  setFocus(id) {
    this.person = id ? String(id) : '';
    ftSetFocusUrl(id || null);
    this.syncSelect(); this.render(); this.updateChip();
  }
  syncSelect() {
    const sel = document.getElementById('memPersonFilter');
    if (!sel) return;
    if (this.person && !sel.querySelector(`option[value="${this.person}"]`)) {
      const m = this.familyData.find(x => x.id === Number(this.person));
      if (m) sel.insertAdjacentHTML('beforeend', `<option value="${m.id}">${this.esc(m.name)}</option>`);
    }
    sel.value = this.person;
  }
  updateChip() {
    if (!this.person) return ftFocusChip(null);
    const m = this.familyData.find(x => x.id === Number(this.person)); if (!m) return ftFocusChip(null);
    const n = this.media.filter(x => x.members.some(p => p.id === m.id)).length;
    ftFocusChip(n ? `Memories with <b>${this.esc(m.name)}</b> · ${n}` : `No memories of <b>${this.esc(m.name)}</b> yet`,
      () => { this.person = ''; this.syncSelect(); this.render(); });
  }

  visible() {
    return this.media.filter(m =>
      (this.type === 'all' || m.type === this.type) &&
      (!this.person || m.members.some(p => p.id === Number(this.person))) &&
      (!this.q || this.norm([m.title, m.description, ...m.members.map(p => p.name)].join(' ')).includes(this.q)));
  }
  norm(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
  clearSearch() {
    const input = document.getElementById('viewSearchInput');
    if (input) { input.value = ''; input.focus(); }
    window.dispatchEvent(new CustomEvent('ft:viewsearch', { detail: { q: '' } }));
  }

  fmt(d) { return d ? new Date(d.replace(' ', 'T')).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : ''; }
  esc(s) { return String(s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

  // Deterministic pseudo-waveform per voice note (no decoding needed)
  wave(seed, n = 30) {
    let s = seed * 9301 + 49297, out = '';
    for (let i = 0; i < n; i++) { s = (s * 233280 + 1) % 2147483647; const h = 25 + (s % 70); out += `<i style="height:${h}%"></i>`; }
    return out;
  }

  // the faces of the people tagged in a memory, as a small overlapping stack
  faces(m, max = 4) {
    const byId = new Map(this.familyData.map(p => [p.id, p]));
    const ppl = [...m.members].sort((a, b) => (b.id === Number(this.person)) - (a.id === Number(this.person)));
    const shown = ppl.slice(0, max).map(p => {
      const full = byId.get(p.id), img = full && full.img;
      const cls = 'mem-face' + (p.id === Number(this.person) ? ' is-focus' : '');
      return `<button type="button" class="${cls}" data-person="${p.id}" title="${this.esc(p.name)}" aria-label="${this.esc(p.name)}">${img ? `<img src="${img}" alt="" loading="lazy">` : this.esc((p.name || '?')[0])}</button>`;
    }).join('');
    return shown ? `<span class="mem-faces">${shown}${ppl.length > max ? `<span class="mem-face more">+${ppl.length - max}</span>` : ''}</span>` : '';
  }

  card(m, idx) {
    const title = m.title || (m.members[0] ? m.members[0].name : '');
    const meta = `<div class="mem-meta">${title ? `<b>${this.esc(title)}</b>` : '<span></span>'}${this.faces(m)}</div>`;
    if (m.type === 'audio') {
      return `
      <figure class="mem-card mem-audio-card" data-id="${m.id}">
        <div class="mem-audio">
          <button type="button" class="mem-play" data-audio="${idx}" aria-label="Play ${this.esc(title || 'voice note')}">${ICONS.mic}</button>
          <div class="mem-wave" aria-hidden="true">${this.wave(m.id)}</div>
          <audio src="${m.url}" preload="none"></audio>
        </div>
        ${meta}
      </figure>`;
    }
    const media = m.type === 'video'
      ? `<video src="${m.url}#t=0.1" preload="metadata" muted playsinline></video><span class="mem-play-badge" aria-hidden="true"></span>`
      : `<img src="${m.url}" alt="${this.esc(m.title || 'Family photo')}" loading="lazy" decoding="async">`;
    return `
      <figure class="mem-card mem-${m.type}" data-id="${m.id}">
        <button type="button" class="mem-open" data-idx="${idx}" aria-label="Open ${this.esc(title || (m.type === 'video' ? 'video' : 'photo'))}">${media}</button>
        ${meta}
      </figure>`;
  }

  render() {
    const items = this.visible();
    this._list = items;
    const total = this.media.length, filtered = items.length !== total;
    const countText = `${items.length} of ${total} ${total === 1 ? 'memory' : 'memories'}`;
    if (this.live) this.live.textContent = this.q ? (items.length ? `${countText} match "${this.rawQ}"` : `No memories match "${this.rawQ}"`) : '';
    if (!items.length && this.q && total) {
      this.root.innerHTML = `<div class="ev-empty mem-search-empty"><h3>No memories match “${this.esc(this.rawQ)}”</h3><p>Search looks at captions and the names of the people tagged${this.type !== 'all' || this.person ? ', within the type and person you picked' : ''}.</p><button type="button" class="btn btn-soft btn-sm mem-search-clear" style="margin-top:14px">Clear search</button></div>`;
      this.root.querySelector('.mem-search-clear').addEventListener('click', () => this.clearSearch());
      return;
    }
    if (!items.length) {
      const guest = !window.FT_CAN_EDIT;
      this.root.innerHTML = `<div class="ev-empty"><h3>${this.media.length ? 'Nothing matches this filter' : 'The memory book is empty'}</h3><p>${
        this.media.length ? 'Try another type or person.' :
        guest ? 'This family has not shared any memories publicly yet.' :
        'Upload photos, videos and voice notes from Admin → Photos, tag the people in them, and they appear here. Set Photos to Public in Privacy settings for guests to see them.'}</p>${
        !guest ? `<a class="btn btn-cta btn-sm" href="/admin/photos.php" style="margin-top:14px">${ICONS.plus} Add a memory</a>` : ''}</div>`;
      return;
    }
    const n = t => this.media.filter(m => m.type === t).length;
    this.root.innerHTML = `
      <div class="mem-wrap">
        <div class="mem-head">
          <div class="mem-counts">
            <span>${ICONS.image}<b>${n('image')}</b> photos</span>
            ${n('video') ? `<span>${ICONS.video}<b>${n('video')}</b> videos</span>` : ''}
            ${n('audio') ? `<span>${ICONS.mic}<b>${n('audio')}</b> voice notes</span>` : ''}
            ${filtered ? `<span class="mem-match">Showing <b>${items.length}</b> of ${total}${this.q ? ` for “${this.esc(this.rawQ)}”` : ''}${this.q ? ' <button type="button" class="mem-search-clear">Clear</button>' : ''}</span>` : ''}
          </div>
          ${window.FT_CAN_EDIT ? `<a class="btn btn-cta btn-sm" href="/admin/photos.php">${ICONS.plus} Add a memory</a>` : ''}
        </div>
        <div class="mem-wall">${items.map((m, i) => this.card(m, i)).join('')}</div>
      </div>
      <div class="mem-lightbox" id="memLightbox" hidden role="dialog" aria-modal="true" aria-label="Memory">
        <button type="button" class="mem-lb-close" aria-label="Close">${ICONS.close}</button>
        <button type="button" class="mem-lb-nav mem-lb-prev" aria-label="Previous">${ICONS.chevronLeft}</button>
        <figure><div class="mem-lb-media"></div><figcaption class="mem-lb-cap"></figcaption></figure>
        <button type="button" class="mem-lb-nav mem-lb-next" aria-label="Next">${ICONS.chevronRight}</button>
      </div>`;

    const clr = this.root.querySelector('.mem-search-clear');
    if (clr) clr.addEventListener('click', () => this.clearSearch());
    // faces → that person's card
    this.root.querySelectorAll('.mem-face[data-person]').forEach(b => b.addEventListener('click', (e) => {
      e.stopPropagation(); this.openPerson(Number(b.dataset.person));
    }));
    // voice notes play in place
    this.root.querySelectorAll('.mem-play').forEach(b => b.addEventListener('click', () => {
      const card = b.closest('.mem-card'), a = card.querySelector('audio');
      this.root.querySelectorAll('.mem-audio-card audio').forEach(x => { if (x !== a) { x.pause(); x.closest('.mem-card').classList.remove('is-playing'); } });
      if (a.paused) { a.play(); card.classList.add('is-playing'); } else { a.pause(); card.classList.remove('is-playing'); }
      a.onended = () => card.classList.remove('is-playing');
    }));
    // lightbox
    const lb = document.getElementById('memLightbox');
    this.root.querySelectorAll('.mem-open').forEach(b => b.addEventListener('click', () => this.openLightbox(Number(b.dataset.idx))));
    lb.querySelector('.mem-lb-close').addEventListener('click', () => this.closeLightbox());
    lb.querySelector('.mem-lb-prev').addEventListener('click', () => this.stepLightbox(-1));
    lb.querySelector('.mem-lb-next').addEventListener('click', () => this.stepLightbox(1));
    lb.addEventListener('click', e => { if (e.target === lb) this.closeLightbox(); });
    if (!this._keys) {
      this._keys = true;
      document.addEventListener('keydown', e => {
        const box = document.getElementById('memLightbox');
        if (!box || box.hidden) return;
        if (e.key === 'Escape') this.closeLightbox();
        if (e.key === 'ArrowLeft') this.stepLightbox(-1);
        if (e.key === 'ArrowRight') this.stepLightbox(1);
      });
    }
  }

  openPerson(id) {
    const m = this.familyData.find(x => x.id === id);
    if (m && typeof openMemberPanel === 'function') openMemberPanel(m, dataUtils.findRelatives(m, this.familyData));
  }

  // Lightbox walks through photos and videos, in wall order
  viewIndices() { return this._list.map((m, i) => m.type !== 'audio' ? i : -1).filter(i => i >= 0); }
  openLightbox(idx) {
    const lb = document.getElementById('memLightbox'); const m = this._list[idx]; if (!lb || !m) return;
    this._lbIndex = idx;
    lb.querySelector('.mem-lb-media').innerHTML = m.type === 'video'
      ? `<video src="${m.url}" controls autoplay playsinline></video>`
      : `<img src="${m.url}" alt="${this.esc(m.title || 'Family photo')}">`;
    const people = m.members.map(p => `<button type="button" class="mem-lb-person" data-person="${p.id}">${this.esc(p.name)}</button>`).join('');
    lb.querySelector('.mem-lb-cap').innerHTML = `${m.title ? `<b>${this.esc(m.title)}</b>` : ''}${m.description ? `<p>${this.esc(m.description)}</p>` : ''}<div class="mem-lb-foot">${people}${m.created_at ? `<small>${this.fmt(m.created_at)}</small>` : ''}</div>`
      ;
    lb.querySelectorAll('.mem-lb-person').forEach(b => b.addEventListener('click', () => { this.closeLightbox(); this.openPerson(Number(b.dataset.person)); }));
    const ix = this.viewIndices(), pos = ix.indexOf(idx);
    lb.querySelector('.mem-lb-prev').hidden = pos <= 0;
    lb.querySelector('.mem-lb-next').hidden = pos >= ix.length - 1;
    lb.hidden = false;
    lb.querySelector('.mem-lb-close').focus();
  }
  stepLightbox(dir) {
    const ix = this.viewIndices(), pos = ix.indexOf(this._lbIndex);
    const next = ix[pos + dir]; if (next !== undefined) this.openLightbox(next);
  }
  closeLightbox() { const lb = document.getElementById('memLightbox'); if (lb) { lb.hidden = true; lb.querySelector('.mem-lb-media').innerHTML = ''; } }
}

document.addEventListener('DOMContentLoaded', () => {
  const view = new MemoriesView();
  view.init().catch(err => console.error('Memories init failed:', err));
  window.memoriesView = view;
});
