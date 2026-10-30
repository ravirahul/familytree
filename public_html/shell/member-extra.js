/**
 * shell/member-extra.js - the details kept in a member's `extra` JSON (see ft_extra in includes/store.php):
 * name in Hindi or another script, native village, gotra, approximate dates, Hindu (tithi) dates,
 * adoptive / step parents, partnership dates and divorce, and sources.
 *   ftExtraCard(member)              fills the member card
 *   ftExtraMount(modal, member, all) adds the sections to the edit window
 *   ftExtraCollect(modal, member)    reads them back as the extra object to save
 */
(function () {
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const P = () => window.FTPanchang || null;
  const MASAS = ['Chaitra', 'Vaishakh', 'Jyeshtha', 'Ashadh', 'Shravan', 'Bhadrapad', 'Ashwin', 'Kartik', 'Margashirsh', 'Paush', 'Magh', 'Phalgun'];
  const TITHIS = ['Pratipada', 'Dwitiya', 'Tritiya', 'Chaturthi', 'Panchami', 'Shashthi', 'Saptami', 'Ashtami', 'Navami', 'Dashami', 'Ekadashi', 'Dwadashi', 'Trayodashi', 'Chaturdashi'];
  const masaName = m => (P() && P().MASA_NAMES ? P().MASA_NAMES[m - 1] : MASAS[m - 1]) || '';
  const tithiName = (p, t) => t === 15 ? (p === 'S' ? 'Purnima' : 'Amavasya') : ((P() && P().TITHI_NAMES ? P().TITHI_NAMES[t - 1] : TITHIS[t - 1]) || '');

  /** "about 1890", "before 1902", "between 1880 and 1885" */
  function approxLabel(a) {
    if (!a || !a.y) return '';
    return { abt: `about ${a.y}`, bef: `before ${a.y}`, aft: `after ${a.y}`, bet: `between ${a.y} and ${a.y2 || '?'}`, year: `${a.y}` }[a.q] || `${a.y}`;
  }
  /** a hand-entered tithi: "Kartik Krishna Ashtami (VS 1990)" */
  function tithiLabel(t) {
    if (!t || !t.m) return '';
    return `${masaName(t.m)} ${t.p === 'S' ? 'Shukla' : 'Krishna'} ${tithiName(t.p, t.t)}${t.vs ? ` (VS ${t.vs})` : ''}`;
  }
  /** the tithi of a known Gregorian date, if the panchang module is loaded */
  function tithiOfDate(iso) {
    if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso) || !P() || !P().tithiOf) return '';
    try { return P().tithiOf(String(iso).slice(0, 10)).label || ''; } catch (e) { return ''; }
  }
  const kindWord = k => ({ adoptive: 'adoptive', step: 'step', foster: 'foster' }[k] || '');
  const partnerLine = p => {
    if (!p) return '';
    const y = d => d ? String(d).slice(0, 4) : '';
    const bits = [];
    if (p.married) bits.push('m. ' + y(p.married));
    if (p.end) bits.push({ divorce: 'divorced', separated: 'separated', widowed: 'widowed' }[p.end] + (p.ended ? ' ' + y(p.ended) : ''));
    else if (p.ended) bits.push('ended ' + y(p.ended));
    return bits.join(' · ');
  };
  /** work out tithis from English dates? A tree setting; on by default, off for the demo trees */
  const autoTithi = () => { const s = window.FT_SETTINGS || {}; return s.hindu_calendar !== undefined ? !!s.hindu_calendar : !s.demo; };
  window.ftAutoTithi = autoTithi;
  window.ftApproxLabel = approxLabel;
  window.ftTithiLabel = tithiLabel;
  window.ftTithiOfDate = tithiOfDate;

  /* ── the member card ───────────────────────────────────────────────────── */

  // a card row created on demand, placed after an existing row
  function row(id, label, afterId) {
    let span = document.getElementById(id);
    if (!span) {
      const after = document.getElementById(afterId);
      const prev = after && after.closest('.member-panel-row');
      if (!prev) return null;
      prev.insertAdjacentHTML('afterend', `<div class="member-panel-row"><span class="mp-label">${label}</span><span class="mp-value" id="${id}">—</span></div>`);
      span = document.getElementById(id);
    }
    return span;
  }
  function show(id, label, afterId, html) {
    const span = row(id, label, afterId); if (!span) return;
    const r = span.closest('.member-panel-row');
    if (html) { span.innerHTML = html; r.style.display = ''; } else { span.textContent = '—'; r.style.display = 'none'; }
  }

  window.ftExtraCard = function (m) {
    const x = (m && m.extra && typeof m.extra === 'object' && !Array.isArray(m.extra)) ? m.extra : {};
    // name in another script, under the name
    const nameEl = document.getElementById('mpName');
    if (nameEl) {
      let loc = document.getElementById('mpNameLocal');
      if (!loc) { nameEl.insertAdjacentHTML('afterend', '<div class="mp-name-local" id="mpNameLocal" lang="hi"></div>'); loc = document.getElementById('mpNameLocal'); }
      loc.textContent = x.name_local || ''; loc.hidden = !x.name_local;
    }
    // approximate dates fill Born / Died when there's no exact date
    if (!m.birth_date && x.birth_approx) show('mpDob', 'Born', 'mpDob', esc(approxLabel(x.birth_approx)));
    if (!m.death_date && x.death_approx) show('mpDod', 'Died', 'mpDod', esc(approxLabel(x.death_approx)));
    // Hindu dates: typed by hand, else worked out from the exact date
    const bt = x.birth_tithi ? tithiLabel(x.birth_tithi) : (autoTithi() ? tithiOfDate(m.birth_date) : '');
    const dt = x.death_tithi ? tithiLabel(x.death_tithi) : (autoTithi() ? tithiOfDate(m.death_date) : '');
    show('mpBirthTithi', 'Born (tithi)', 'mpDob', bt ? esc(bt) : '');
    show('mpDeathTithi', 'Shraddh tithi', 'mpDod', dt ? esc(dt) : '');
    // roots
    show('mpNative', 'Native place', 'mpPob', x.native_place ? esc(x.native_place) : '');
    show('mpGotra', 'Gotra', 'mpNative', x.gotra ? esc(x.gotra) : '');
    // adoptive / step parents
    for (const [k, id] of [['father_kind', 'mpFather'], ['mother_kind', 'mpMother']]) {
      const el = document.getElementById(id);
      if (el && kindWord(x[k]) && !el.querySelector('.mp-kind')) {
        const link = el.querySelector('.mp-link');
        if (link) link.insertAdjacentHTML('afterend', ` <span class="mp-kind">${kindWord(x[k])}</span>`);
      }
    }
    // partnership dates and how it ended, beside each partner
    const sp = document.getElementById('mpSpouses');
    if (sp && x.partners) sp.querySelectorAll('.mp-link[data-rel-id]').forEach(b => {
      const t = partnerLine(x.partners[b.dataset.relId]);
      if (t && !(b.nextElementSibling && b.nextElementSibling.classList.contains('mp-partner'))) b.insertAdjacentHTML('afterend', ` <span class="mp-partner">${esc(t)}</span>`);
    });
    // sources
    const src = Array.isArray(x.sources) ? x.sources : [];
    show('mpSources', 'Sources', 'mpWiki', src.length ? '<ol class="mp-sources">' + src.map(s => {
      const what = { birth: 'Birth', death: 'Death', marriage: 'Marriage', name: 'Name', place: 'Place', parents: 'Parents', other: '' }[s.fact] || '';
      const title = s.url ? `<a href="${esc(s.url)}" target="_blank" rel="noopener nofollow">${esc(s.title || s.url)}</a>` : esc(s.title || '');
      return `<li>${what ? `<b>${what}:</b> ` : ''}${title}${s.page ? `, ${esc(s.page)}` : ''}${s.note ? `<small>${esc(s.note)}</small>` : ''}</li>`;
    }).join('') + '</ol>' : '');
  };

  /* ── the edit window ───────────────────────────────────────────────────── */

  const opts = (list, sel) => list.map(([v, t]) => `<option value="${v}"${String(v) === String(sel ?? '') ? ' selected' : ''}>${t}</option>`).join('');
  const Q = [['', 'Exact date'], ['abt', 'About'], ['bef', 'Before'], ['aft', 'After'], ['bet', 'Between'], ['year', 'Only the year']];

  function approxHtml(key, a) {
    a = a || {};
    return `<div class="mx-approx" data-approx="${key}">
      <label class="mx-inline"><span>If you don't know the exact date</span>
        <select class="mem-edit-select mx-q">${opts(Q, a.q || '')}</select></label>
      <input type="number" class="mem-edit-input mx-y" min="1" max="2999" placeholder="Year" value="${a.y || ''}" ${a.q ? '' : 'hidden'} aria-label="Year">
      <input type="number" class="mem-edit-input mx-y2" min="1" max="2999" placeholder="and year" value="${a.y2 || ''}" ${a.q === 'bet' ? '' : 'hidden'} aria-label="Second year">
    </div>`;
  }
  function tithiHtml(key, t, label) {
    t = t || {};
    const masas = MASAS.map((n, i) => [i + 1, masaName(i + 1) || n]);
    const tithis = Array.from({ length: 15 }, (_, i) => [i + 1, i === 14 ? 'Purnima / Amavasya' : (TITHIS[i])]);
    return `<details class="mx-tithi" data-tithi="${key}"${t.m ? ' open' : ''}>
      <summary>${label} <span class="mx-tithi-auto"></span></summary>
      <div class="mx-row">
        <select class="mem-edit-select mx-m" aria-label="Month">${opts([['', 'Month (maas)'], ...masas], t.m)}</select>
        <select class="mem-edit-select mx-p" aria-label="Fortnight">${opts([['', 'Paksha'], ['S', 'Shukla'], ['K', 'Krishna']], t.p)}</select>
        <select class="mem-edit-select mx-t" aria-label="Tithi">${opts([['', 'Tithi'], ...tithis], t.t)}</select>
        <input type="number" class="mem-edit-input mx-vs" min="1000" max="3000" placeholder="Samvat year" value="${t.vs || ''}" aria-label="Vikram Samvat year">
      </div>
      <small class="mx-hint">Use this if you know the Hindu date but not the English one. The tree reminds you of it every year.</small>
    </details>`;
  }
  function partnerRows(box, member, all, x) {
    const ids = [...box.closest('form').querySelectorAll('.mem-spouse-select')].map(s => Number(s.value)).filter(Boolean);
    const cur = {};
    box.querySelectorAll('[data-partner]').forEach(r => { cur[r.dataset.partner] = readPartner(r); });   // keep what was typed
    box.innerHTML = ids.length ? ids.map(id => {
      const p = cur[id] || (x.partners || {})[id] || {};
      const who = (all.find(n => n.id === id) || {}).name || 'Partner';
      return `<div class="mx-partner" data-partner="${id}">
        <b>${esc(who)}</b>
        <label><span>Married</span><input type="date" class="mem-edit-input mx-married" value="${p.married || ''}"></label>
        <label><span>Ended</span><select class="mem-edit-select mx-end">${opts([['', 'Still together'], ['divorce', 'Divorced'], ['separated', 'Separated'], ['widowed', 'Widowed']], p.end)}</select></label>
        <label class="mx-ended"${p.end ? '' : ' hidden'}><span>On</span><input type="date" class="mem-edit-input mx-ended-d" value="${p.ended || ''}"></label>
      </div>`;
    }).join('') : '<small class="mx-hint">Pick a partner above to add the wedding date or a divorce.</small>';
  }
  function readPartner(r) {
    return { married: r.querySelector('.mx-married').value || null, end: r.querySelector('.mx-end').value || null, ended: r.querySelector('.mx-ended-d').value || null };
  }
  function sourceRow(s) {
    s = s || {};
    const facts = [['birth', 'Birth'], ['death', 'Death'], ['marriage', 'Marriage'], ['name', 'Name'], ['place', 'Place'], ['parents', 'Parents'], ['other', 'Other']];
    return `<div class="mx-source">
      <select class="mem-edit-select mx-fact" aria-label="What it proves">${opts(facts, s.fact || 'birth')}</select>
      <input type="text" class="mem-edit-input mx-title" placeholder="e.g. School leaving certificate" value="${esc(s.title)}" aria-label="Source">
      <input type="url" class="mem-edit-input mx-url" placeholder="Link (optional)" value="${esc(s.url)}" aria-label="Link">
      <input type="text" class="mem-edit-input mx-note" placeholder="Note or page (optional)" value="${esc(s.note || s.page)}" aria-label="Note">
      <button type="button" class="btn btn-ghost btn-sm mx-del" aria-label="Remove this source">&times;</button>
    </div>`;
  }

  window.ftExtraMount = function (modal, member, all) {
    const x = (member.extra && typeof member.extra === 'object' && !Array.isArray(member.extra)) ? member.extra : {};
    const sections = modal.querySelectorAll('.mem-edit-section');
    const after = (el, html) => { if (el) el.insertAdjacentHTML('afterend', html); };
    // roots, after Identity & Status
    after(sections[1], `<div class="mem-edit-section" id="mxRoots">
      <div class="mem-edit-section-title">Name & roots</div>
      <div class="mem-edit-row">
        <div class="mem-edit-fg"><label for="mxNameLocal">Name in Hindi (or another script)</label><input type="text" id="mxNameLocal" class="mem-edit-input" lang="hi" value="${esc(x.name_local)}" placeholder="e.g. मोहन कर्ण"></div>
        <div class="mem-edit-fg"><label for="mxGotra">Gotra</label><input type="text" id="mxGotra" class="mem-edit-input" value="${esc(x.gotra)}" placeholder="e.g. Kashyap"></div>
      </div>
      <div class="mem-edit-fg"><label for="mxNative">Native village / place (gaon)</label><input type="text" id="mxNative" class="mem-edit-input" value="${esc(x.native_place)}" placeholder="e.g. Madhubani, Bihar, India"></div>
    </div>`);
    // approximate and Hindu dates
    const bd = modal.querySelector('#memEditBirthDate'), dd = modal.querySelector('#memEditDeathDate');
    after(bd && bd.closest('.mem-edit-row'), approxHtml('birth', x.birth_approx) + tithiHtml('birth', x.birth_tithi, 'Hindu date of birth (tithi)'));
    after(modal.querySelector('#memEditDeathFields'), `<div id="mxDeathExtra"${Number(member.is_alive) === 1 ? ' hidden' : ''}>${approxHtml('death', x.death_approx)}${tithiHtml('death', x.death_tithi, 'Shraddh / barsi tithi')}</div>`);
    const alive = modal.querySelector('#memEditIsAlive');
    if (alive) alive.addEventListener('change', () => { modal.querySelector('#mxDeathExtra').hidden = alive.checked; });
    modal.querySelectorAll('.mx-approx').forEach(a => {
      const q = a.querySelector('.mx-q');
      q.addEventListener('change', () => { a.querySelector('.mx-y').hidden = !q.value; a.querySelector('.mx-y2').hidden = q.value !== 'bet'; });
    });
    // the tithi of an exact date, shown beside the heading
    const autoT = (input, key) => {
      const out = modal.querySelector(`[data-tithi="${key}"] .mx-tithi-auto`); if (!out || !input) return;
      const upd = () => { const t = tithiOfDate(input.value); out.textContent = t ? `· that day was ${t}` : ''; };
      input.addEventListener('change', upd); upd();
    };
    autoT(bd, 'birth'); autoT(dd, 'death');
    // adoptive / step parents
    const fid = modal.querySelector('#memEditFid');
    const kinds = [['', 'Birth parent'], ['adoptive', 'Adoptive'], ['step', 'Step'], ['foster', 'Foster']];
    after(fid && fid.closest('.mem-edit-row'), `<div class="mem-edit-row mx-kinds">
      <div class="mem-edit-fg"><label for="mxFatherKind">Father is</label><select id="mxFatherKind" class="mem-edit-select">${opts(kinds, x.father_kind)}</select></div>
      <div class="mem-edit-fg"><label for="mxMotherKind">Mother is</label><select id="mxMotherKind" class="mem-edit-select">${opts(kinds, x.mother_kind)}</select></div>
    </div>`);
    // partnership dates, kept in step with the spouse pickers
    const list = modal.querySelector('#memEditSpousesList');
    // one wedding date per partner replaces the single anniversary field; seed it from the old value
    const ann = modal.querySelector('#memEditAnniversary');
    if (ann) {
      ann.closest('.mem-edit-fg').style.display = 'none';
      if (ann.value && !Object.keys(x.partners || {}).length && (member.pids || []).length) x.partners = { [member.pids[0]]: { married: ann.value } };
    }
    if (list) {
      list.insertAdjacentHTML('afterend', '<div class="mx-partners" id="mxPartners"></div>');
      const box = modal.querySelector('#mxPartners');
      const redraw = () => partnerRows(box, member, all, x);
      list.addEventListener('change', redraw);
      new MutationObserver(redraw).observe(list, { childList: true });
      box.addEventListener('change', e => { const r = e.target.closest('.mx-partner'); if (r && e.target.classList.contains('mx-end')) r.querySelector('.mx-ended').hidden = !e.target.value; });
      redraw();
    }
    // sources, before the biography
    const bio = modal.querySelector('#memEditWiki');
    const bioSec = bio && bio.closest('.mem-edit-section');
    if (bioSec) bioSec.insertAdjacentHTML('beforebegin', `<div class="mem-edit-section" id="mxSources">
      <div class="mem-edit-section-title">Sources</div>
      <small class="mx-hint">Where a fact comes from: a certificate, a family register, a gravestone, Grandma's memory.</small>
      <div class="mx-source-list">${(x.sources || []).map(sourceRow).join('')}</div>
      <button type="button" class="btn btn-ghost btn-sm" id="mxAddSource">+ Add a source</button>
    </div>`);
    const sl = modal.querySelector('.mx-source-list');
    modal.querySelector('#mxAddSource')?.addEventListener('click', () => { sl.insertAdjacentHTML('beforeend', sourceRow()); sl.lastElementChild.querySelector('.mx-title').focus(); });
    sl?.addEventListener('click', e => { if (e.target.closest('.mx-del')) e.target.closest('.mx-source').remove(); });
  };

  /** the anniversary the rest of the app uses: the wedding date of a partnership that hasn't ended */
  window.ftExtraAnniversary = function (extra) {
    const ps = Object.values((extra && extra.partners) || {});
    if (!ps.length) return undefined;
    const cur = ps.find(p => p.married && !p.end) || ps.find(p => p.married);
    return cur ? cur.married : null;
  };

  window.ftExtraCollect = function (modal, member) {
    const x = Object.assign({}, (member.extra && typeof member.extra === 'object' && !Array.isArray(member.extra)) ? member.extra : {});
    const v = sel => (modal.querySelector(sel)?.value || '').trim();
    x.name_local = v('#mxNameLocal'); x.gotra = v('#mxGotra'); x.native_place = v('#mxNative');
    x.father_kind = v('#mxFatherKind'); x.mother_kind = v('#mxMotherKind');
    for (const key of ['birth', 'death']) {
      const a = modal.querySelector(`[data-approx="${key}"]`);
      const q = a?.querySelector('.mx-q').value, y = Number(a?.querySelector('.mx-y').value), y2 = Number(a?.querySelector('.mx-y2').value);
      x[key + '_approx'] = q && y ? { q, y, ...(q === 'bet' && y2 ? { y2 } : {}) } : null;
      const t = modal.querySelector(`[data-tithi="${key}"]`);
      const m = Number(t?.querySelector('.mx-m').value), p = t?.querySelector('.mx-p').value, d = Number(t?.querySelector('.mx-t').value), vs = Number(t?.querySelector('.mx-vs').value);
      x[key + '_tithi'] = m && p && d ? { m, p, t: d, ...(vs ? { vs } : {}) } : null;
    }
    if (modal.querySelector('#memEditIsAlive')?.checked) { x.death_approx = null; x.death_tithi = null; }
    const partners = {};
    modal.querySelectorAll('.mx-partner').forEach(r => { const p = readPartner(r); if (p.married || p.end || p.ended) partners[r.dataset.partner] = p; });
    x.partners = partners;
    x.sources = [...modal.querySelectorAll('.mx-source')].map(r => ({ fact: r.querySelector('.mx-fact').value, title: r.querySelector('.mx-title').value.trim(), url: r.querySelector('.mx-url').value.trim(), note: r.querySelector('.mx-note').value.trim() }))
      .filter(s => s.title || s.url || s.note);
    return x;
  };
})();
