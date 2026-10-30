// views/map.js — Where the family is (Leaflet + OpenStreetMap tiles).
// Coordinates come from /api-geo.php, which caches Nominatim lookups server-side.

class MapView extends FamilyTreeController {
  constructor() {
    super('map');
    this.map = null; this.layer = null;
    this.coords = {};          // place → [lat, lng]
    this.mode = 'current';     // current | birth | all
    this.q = '';               // toolbar search, normalised
  }

  async init() {
    const ok = await super.init();
    if (!ok) return false;
    this.updateStats();
    const root = document.getElementById('tree-root');
    root.innerHTML = '<div id="ftMap" class="ft-map"></div>';
    if (typeof L === 'undefined') { uiUtils.showError(root, 'Map library failed to load. Check your connection and refresh.'); return false; }

    this.map = L.map('ftMap', { worldCopyJump: true, zoomControl: true }).setView([22, 78], 4);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(this.map);
    this.layer = L.layerGroup().addTo(this.map);

    document.querySelectorAll('#mapModeSeg .seg-btn').forEach(b => b.addEventListener('click', () => {
      document.querySelectorAll('#mapModeSeg .seg-btn').forEach(x => x.classList.toggle('active', x === b));
      this.mode = b.dataset.mode; this.draw();
    }));
    // toolbar search: show only people whose name (or place) matches
    const st = document.getElementById('mapStatusText');
    if (st) { st.setAttribute('role', 'status'); st.setAttribute('aria-live', 'polite'); }
    window.addEventListener('ft:viewsearch', e => this.search(e.detail && e.detail.q));
    this.focusId = ftFocusParam();
    window.ftFocusMember = id => this.setFocus(id);

    // A tree with nobody living somewhere known (a historical family) opens on everything instead of an empty map
    const anyLiving = (this.familyData || []).some(m => m.current_location && Number(m.is_alive) === 1);
    if (!anyLiving) {
      this.mode = 'all';
      document.querySelectorAll('#mapModeSeg .seg-btn').forEach(x => x.classList.toggle('active', x.dataset.mode === 'all'));
    }
    if (this.focusId) this.setMode('all');
    await this.loadCoords();
    this.draw();
    this.updateChip();
    return true;
  }

  async loadCoords(attempt = 0) {
    this.status('Locating places…');
    try {
      const r = await fetch('/api-geo.php?tree=' + encodeURIComponent(window.FT_TREE_SLUG || ''));
      const j = await r.json();
      Object.assign(this.coords, j.places || {});
      if (j.pending > 0 && attempt < 10) { this.draw(attempt === 0); await new Promise(res => setTimeout(res, 1500)); return this.loadCoords(attempt + 1); }
    } catch (e) { console.error('geo load failed', e); }
    this.status('');
  }

  status(t) { const el = document.getElementById('mapStatusText'); if (el) { el.textContent = t; el.title = t; } }

  norm(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
  search(q) {
    const next = this.norm(q).trim();
    this._rawQ = String(q || '').trim().replace(/["“”]/g, '');
    if (next === this.q) return;
    if (!this.q && next) this._preView = { c: this.map.getCenter(), z: this.map.getZoom() };   // restored when the search is cleared
    this.q = next;
    this.map.closePopup();
    if (!next && this._preView) { this.draw(false); this.map.setView(this._preView.c, this._preView.z); this._preView = null; }
    else this.draw(true);
  }

  // Group members by place for the active mode
  groups() {
    const pick = m => {
      const out = [];
      if (this.mode !== 'birth' && m.current_location && Number(m.is_alive) === 1) out.push({ place: m.current_location, kind: 'current' });
      if (this.mode !== 'current' && m.birth_location) out.push({ place: m.birth_location, kind: 'birth' });
      if (this.mode === 'all' && m.death_location) out.push({ place: m.death_location, kind: 'death' });
      return out;
    };
    const g = new Map();
    const hit = (m, place) => !this.q || this.norm(m.name).includes(this.q) || this.norm(place).includes(this.q);
    this.familyData.forEach(m => pick(m).forEach(({ place, kind }) => {
      if (!hit(m, place)) return;
      const key = place.trim();
      if (!g.has(key)) g.set(key, []);
      g.get(key).push({ m, kind });
    }));
    return g;
  }

  // ─── Focus: one person's places stand out, joined in life order ─────────

  setFocus(id) {
    this.focusId = id || null;
    ftSetFocusUrl(this.focusId);
    if (this.focusId && this.mode !== 'all') this.setMode('all');
    this.draw(true); this.updateChip();
  }
  setMode(mode) {
    this.mode = mode;
    document.querySelectorAll('#mapModeSeg .seg-btn').forEach(x => x.classList.toggle('active', x.dataset.mode === mode));
  }
  // the person's places in life order: born, lived, died
  focusPlaces() {
    const m = this.focusId && this.familyData.find(x => x.id === this.focusId);
    if (!m) return [];
    return [[m.birth_location, 'birth'], [Number(m.is_alive) === 1 ? m.current_location : null, 'current'], [m.death_location, 'death']]
      .filter(([p]) => p).map(([p, kind]) => ({ place: p.trim(), kind }));
  }
  updateChip() {
    if (!this.focusId) return ftFocusChip(null);
    const m = this.familyData.find(x => x.id === this.focusId); if (!m) return ftFocusChip(null);
    const name = String(m.name || '').replace(/[<>&]/g, '');
    const n = this.focusPlaces().filter(p => this.coords[p.place]).length;
    ftFocusChip(n ? `Highlighting <b>${name}</b> · ${n} place${n === 1 ? '' : 's'}` : `<b>${name}</b> has no places on the map yet`, () => { this.focusId = null; this.draw(true); });
  }

  // a pin is the faces of the people there: one photo, or up to three overlapping with a count
  pinHtml(people, focus) {
    const seen = new Set(), faces = [];
    const order = [...people].sort((a, b) => (b.m.id === this.focusId) - (a.m.id === this.focusId) || (!!b.m.img) - (!!a.m.img));
    order.forEach(({ m }) => { if (!seen.has(m.id)) { seen.add(m.id); faces.push(m); } });
    const face = m => m.img
      ? `<img src="${m.img}" alt="" loading="lazy" decoding="async">`
      : `<i>${(m.name || '?').charAt(0).toUpperCase()}</i>`;
    const shown = faces.slice(0, faces.length > 1 ? 3 : 1);
    const n = faces.length;
    const kind = n === 1 ? people[0].kind : 'many';
    return { n, w: n === 1 ? 38 : 30 + (shown.length - 1) * 15, h: n === 1 ? 38 : 30,
      html: `<span class="ft-face-pin k-${kind}${n > 1 ? ' is-group' : ''}${focus ? ' is-focus' : ''}">${shown.map(face).join('')}${n > 1 ? `<b>${n}</b>` : ''}</span>` };
  }

  draw(refit = true) {
    if (!this.layer) return;
    this.layer.clearLayers();
    const groups = this.groups();
    const bounds = [], focusBounds = [], markers = [], matched = new Set();
    let unresolved = 0;
    const kindLabel = { current: 'lives here', birth: 'born here', death: 'passed away here' };
    const esc = s => String(s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

    groups.forEach((people, place) => {
      const ll = this.coords[place];
      if (!ll) { unresolved++; return; }
      bounds.push(ll);
      people.forEach(p => matched.add(p.m.id));
      const isFocus = !!this.focusId && people.some(p => p.m.id === this.focusId);
      if (isFocus) focusBounds.push(ll);
      const pin = this.pinHtml(people, isFocus);
      const icon = L.divIcon({ className: 'ft-pin' + (this.focusId && !isFocus ? ' is-dim' : ''), html: pin.html, iconSize: [pin.w, pin.h], iconAnchor: [pin.w / 2, pin.h / 2] });
      const list = () => people.map(({ m, kind }) => `
        <button type="button" class="ft-pop-row${m.id === this.focusId ? ' is-focus' : ''}" data-id="${m.id}">
          ${m.img ? `<img src="${m.img}" alt="">` : `<span class="ft-pop-initial">${esc((m.name || '?')[0])}</span>`}
          <span><b>${esc(m.name)}</b><small>${kindLabel[kind]}</small></span>
        </button>`).join('');
      const marker = L.marker(ll, { icon, zIndexOffset: isFocus ? 1000 : 0, title: `${place} · ${pin.n} ${pin.n === 1 ? 'person' : 'people'}` })
        .bindPopup(() => `<div class="ft-pop"><div class="ft-pop-place">${esc(place)}</div><div class="ft-pop-list">${list()}</div></div>`, { maxWidth: 280 });
      marker.on('popupopen', (e) => {
        e.popup.getElement().querySelectorAll('.ft-pop-row').forEach(b => b.addEventListener('click', () => {
          const m = this.familyData.find(x => x.id === Number(b.dataset.id));
          if (m && typeof openMemberPanel === 'function') openMemberPanel(m, dataUtils.findRelatives(m, this.familyData));
        }));
      });
      this.layer.addLayer(marker);
      markers.push(marker);
    });

    // the focused person's journey: born → lived → died
    const path = this.focusPlaces().map(p => this.coords[p.place]).filter(Boolean);
    if (path.length > 1) {
      const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#b0832b';
      this.layer.addLayer(L.polyline(path, { color: accent, weight: 3, opacity: .85, dashArray: '6 8', interactive: false }));
    }

    if (refit && this.q) {
      // one person: fly to their pin(s) and open the popup; several: fit them all
      if (matched.size === 1) {
        this.map.once('moveend', () => markers[0].openPopup());
        if (bounds.length === 1) this.map.flyTo(bounds[0], Math.max(this.map.getZoom(), 7), { duration: .8 });
        else this.map.flyToBounds(bounds, { padding: [70, 70], maxZoom: 7, duration: .8 });
      } else if (bounds.length) this.map.flyToBounds(bounds, { padding: [50, 50], maxZoom: 8, duration: .8 });
    } else if (refit) {
      if (focusBounds.length) this.map.fitBounds(focusBounds, { padding: [70, 70], maxZoom: focusBounds.length > 1 ? 7 : 6 });
      else if (bounds.length) this.map.fitBounds(bounds, { padding: [40, 40], maxZoom: 8 });
    }
    const shown = groups.size - unresolved;
    this.status(groups.size === 0
      ? 'No locations recorded for this view.'
      : `${shown} place${shown === 1 ? '' : 's'}${unresolved ? ` · ${unresolved} could not be located` : ''}`);
    if (this.q) {
      const q = this._rawQ || this.q;
      if (!matched.size) {
        const elsewhere = this.mode !== 'all' && this.familyData.some(m => this.norm(m.name).includes(this.q));
        this.status(groups.size ? `Found "${q}", but those places could not be located` : `No one matches "${q}"${elsewhere ? ' here. Try Everything' : ''}`);
      } else this.status(`${matched.size} ${matched.size === 1 ? "person matches" : "people match"} "${q}" · ${shown} place${shown === 1 ? '' : 's'}`);
      return;
    }
    if (groups.size === 0 && this.familyData.length) {
      this.status(this.mode === 'current' ? 'No living members have a current location recorded (or it is private).' : 'No locations recorded for this view.');
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const view = new MapView();
  view.init().catch(err => console.error('Map init failed:', err));
  window.mapView = view;
});
