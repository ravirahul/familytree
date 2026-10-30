// shell/member-card.js - Refactored member card with relative navigation, age/wiki, children, gallery, and export

function parseDateSafe(value) {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

// Returns {years, months, days} between two dates
function diffYMD(startDate, endDate) {
  const start = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  const end = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());

  let years = end.getFullYear() - start.getFullYear();
  let months = end.getMonth() - start.getMonth();
  let days = end.getDate() - start.getDate();

  if (days < 0) {
    months -= 1;
    const prevMonth = (end.getMonth() - 1 + 12) % 12;
    const yearForPrev = prevMonth === 11 ? end.getFullYear() - 1 : end.getFullYear();
    const daysInPrevMonth = new Date(yearForPrev, prevMonth + 1, 0).getDate();
    days += daysInPrevMonth;
  }

  if (months < 0) {
    years -= 1;
    months += 12;
  }

  return { years, months, days };
}

// normalize text values; return null for "empty"
function clean(value) {
  if (value == null) return null;
  const v = String(value).trim();
  return v === '' || v === '—' ? null : v;
}

function setRowText(rowSpanId, value) {
  const span = document.getElementById(rowSpanId);
  const row = span && span.closest('.member-panel-row');
  if (!span || !row) return;

  if (value == null || value === '') {
    row.style.display = 'none';
    span.textContent = '—';
  } else {
    row.style.display = '';
    span.textContent = value;
  }
}

/** The row's label in the singular for one person, plural otherwise ("Spouse" / "Spouses"). */
function setRowLabel(rowSpanId, count, one, many) {
  const span = document.getElementById(rowSpanId);
  const label = span && span.closest('.member-panel-row') && span.closest('.member-panel-row').querySelector('.mp-label');
  if (label) label.textContent = count === 1 ? one : many;
}

function setRowHTML(rowSpanId, html) {
  const span = document.getElementById(rowSpanId);
  const row = span && span.closest('.member-panel-row');
  if (!span || !row) return;

  if (!html) {
    row.style.display = 'none';
    span.textContent = '—';
  } else {
    row.style.display = '';
    span.innerHTML = html;
  }
}

/**
 * Open member detail panel
 */
function openMemberPanel(member, relatives = {}) {
  const panel = document.getElementById('memberDetailPanel');
  if (!panel || !member) return;
  
  const { father, mother, spouses, children, siblings } = relatives;

  // Remember who's open — used by the Find-relation / Copy-link actions
  window._mpCurrentMemberId = member.id;

  // Avatar — photo, or a serif initial as fallback
  const avatar = document.getElementById('mpAvatar');
  if (avatar) {
    if (member.img) {
      avatar.style.backgroundImage = `url(${member.img})`;
      avatar.textContent = '';
    } else {
      avatar.style.backgroundImage = 'none';
      avatar.textContent = (member.name || '?').charAt(0).toUpperCase();
      avatar.style.display = 'flex';
      avatar.style.alignItems = 'center';
      avatar.style.justifyContent = 'center';
      avatar.style.fontFamily = 'Georgia, "Times New Roman", serif';
      avatar.style.fontSize = '28px';
      avatar.style.fontWeight = '700';
    }
  }
  
  // Name
  const nameEl = document.getElementById('mpName');
  if (nameEl) nameEl.textContent = uiUtils.displayValue(member.name);
  
  // Nickname
  setRowText('mpNickname', clean(member.nickname));
  
  const canEdit = Boolean(
    window.customTreeView ? window.customTreeView.builderMode : (
      typeof window !== 'undefined' && window.FT_CAN_EDIT
    )
  );

  const editBtn = document.getElementById('mpEditBtn');
  if (editBtn) {
    editBtn.style.display = canEdit ? 'inline-flex' : 'none';
  }

  // Father
  let fatherHtml = '';
  if (father) {
    fatherHtml = `<button class="mp-link" data-rel-id="${father.id}" data-rel-type="father">${father.name}</button>`;
  } else if (canEdit) {
    fatherHtml = `<button type="button" class="btn-mp-inline-add" data-qa-type="parent" data-qa-gender="male">+ Add Father</button>`;
  }
  setRowHTML('mpFather', fatherHtml);
  
  // Mother
  let motherHtml = '';
  if (mother) {
    motherHtml = `<button class="mp-link" data-rel-id="${mother.id}" data-rel-type="mother">${mother.name}</button>`;
  } else if (canEdit) {
    motherHtml = `<button type="button" class="btn-mp-inline-add" data-qa-type="parent" data-qa-gender="female">+ Add Mother</button>`;
  }
  setRowHTML('mpMother', motherHtml);
  
  // Spouses
  let spouseHtml = spouses && spouses.length
    ? spouses.map(s =>
        `<button class="mp-link" data-rel-id="${s.id}" data-rel-type="spouse">${s.name}</button>`
      ).join(' ')
    : '';
  if (canEdit) {
    spouseHtml += ` <button type="button" class="btn-mp-inline-add" data-qa-type="spouse">+ Add</button>`;
  }
  setRowHTML('mpSpouses', spouseHtml.trim());
  setRowLabel('mpSpouses', (spouses || []).length, 'Spouse', 'Spouses');

  // Children
  const childrenArr = children || [];
  let childrenHtml = childrenArr.length
    ? childrenArr.map(c =>
        `<button class="mp-link" data-rel-id="${c.id}" data-rel-type="child">${c.name}</button>`
      ).join(' ')
    : '';
  if (canEdit) {
    childrenHtml += ` <button type="button" class="btn-mp-inline-add" data-qa-type="child">+ Add</button>`;
  }
  setRowHTML('mpChildren', childrenHtml.trim());
  setRowLabel('mpChildren', childrenArr.length, 'Child', 'Children');

  // Siblings
  const siblingsArr = siblings || [];
  let siblingsHtml = siblingsArr.length
    ? siblingsArr.map(s =>
        `<button class="mp-link" data-rel-id="${s.id}" data-rel-type="sibling">${s.name}</button>`
      ).join(' ')
    : '';
  if (canEdit) {
    siblingsHtml += ` <button type="button" class="btn-mp-inline-add" data-qa-type="sibling">+ Add</button>`;
  }
  setRowHTML('mpSiblings', siblingsHtml.trim());
  setRowLabel('mpSiblings', siblingsArr.length, 'Sibling', 'Siblings');

  // Dates and places
  const dobRaw = member.birth_date || member.dob;
  const dob = parseDateSafe(dobRaw);
  const dobText = dobRaw ? uiUtils.formatDate(dobRaw) : '';
  setRowText('mpDob', dobText);
  
  const pob = member.birth_location || member.birth_place || member.pob;
  setRowText('mpPob', clean(pob));
  
  // Gender
  setRowText('mpGender', clean(member.gender));
  
  // Location (current)
  const loc = member.current_location || member.location;
  setRowText('mpLocation', clean(loc));
  
  // Contacts
  const contactsPieces = [];
  if (member.insta_url) {
    contactsPieces.push(
      `<a href="${member.insta_url}" target="_blank" rel="noopener" class="mp-link">Instagram</a>`
    );
  }
  if (member.fb_url) {
    contactsPieces.push(
      `<a href="${member.fb_url}" target="_blank" rel="noopener" class="mp-link">Facebook</a>`
    );
  }
  const contactsHtml = contactsPieces.join(' · ');
  setRowHTML('mpContacts', contactsHtml);

  // Anniversary
  const annRaw = member.anniversary_date;
  const annText = annRaw ? uiUtils.formatDate(annRaw) : '';
  setRowText('mpAnniversary', annText);

  // DOD + death location
  const dodRaw = member.death_date || member.dod;
  const dod = parseDateSafe(dodRaw);
  const dodText = dodRaw ? uiUtils.formatDate(dodRaw) : '';
  setRowText('mpDod', dodText);

  const deathLoc = member.death_location || member.death_place;
  setRowText('mpDeathPlace', clean(deathLoc));
  
  // Wiki (rich HTML + expandable)
  const wikiValue = member.wiki || member.wikipedia;
  const wikiPreview = member.wiki_preview;
  const wikiSpan = document.getElementById('mpWiki');
  const wikiRow = wikiSpan && wikiSpan.closest('.member-panel-row');
  
  if (wikiSpan && wikiRow) {
    if (!wikiValue && !wikiPreview) {
      wikiRow.style.display = 'none';
      wikiSpan.textContent = '—';
    } else {
      wikiRow.style.display = '';
      const html = wikiValue || wikiPreview || '';
      wikiSpan.innerHTML =
        `<span class="mp-wiki-text">${html}</span>` +
        (html.length > 260 ? '<button type="button" class="mp-wiki-more">Read more</button>' : '');
    }
  }
  
  // Age & timeline
  const ageSpan = document.getElementById('mpStatus');
  const ageRow = ageSpan && ageSpan.closest('.member-panel-row');
  if (ageSpan && ageRow) {
    let text = '';
    
    if (dob && member.is_alive == 1) {
      const now = new Date();
      const ageNow = diffYMD(dob, now);
      text = `Age: ${ageNow.years}y ${ageNow.months}m ${ageNow.days}d`;
    } else if (dob && dod && member.is_alive == 0) {
      const now = new Date();
      const ageAtDeath = diffYMD(dob, dod);
      const currentAge = diffYMD(dob, now);
      const sinceDeath = diffYMD(dod, now);
      
      text =
        `Age at death: ${ageAtDeath.years}y ${ageAtDeath.months}m ${ageAtDeath.days}d\n` +
        `Would be today: ${currentAge.years}y ${currentAge.months}m ${currentAge.days}d\n` +
        `Time since passing: ${sinceDeath.years}y ${sinceDeath.months}m ${sinceDeath.days}d ago`;
    }
    
    if (text) {
      ageRow.style.display = '';
      ageSpan.textContent = text;
    } else {
      ageRow.style.display = 'none';
      ageSpan.textContent = '—';
    }
  }

  // Gallery
  const galleryEl = document.getElementById('mpGallery');
  const galleryRow = galleryEl && galleryEl.closest('.member-panel-gallery-row');

  if (galleryEl && galleryRow) {
    const photos = Array.isArray(member.photos) ? member.photos : [];

    if (!photos.length) {
      galleryRow.style.display = 'none';
      galleryEl.innerHTML = '';
    } else {
      galleryRow.style.display = '';
      galleryEl.innerHTML = photos.map((p, idx) => `
        <button class="mp-gallery-item" type="button" data-photo-index="${idx}">
          <img src="${p.url}" alt="${uiUtils.displayValue(member.name)} photo ${idx + 1}">
        </button>
      `).join('');
    }
  }

  // Remember current member id for gallery/export
  window.currentMemberId = member.id;

  if (window.ftExtraCard) window.ftExtraCard(member);
  ftRenderSeeIn(member);
  const hl = document.getElementById('mpHistoryLink'); if (hl) hl.href = '/admin/#tidy/member/' + member.id;
  panel._openedAt = Date.now();   // the click that opened it must not also close it
  panel.classList.remove('member-panel-hidden');
}

/* ── "See in" row: open this person in another view, highlighted ───────────── */
const FT_VIEWS = [['custom', 'Tree', 'tree'], ['events', 'Timeline', 'calendar'], ['map', 'Map', 'globe'], ['memories', 'Memories', 'book']];

function ftViewHref(view, id) {
  const base = (window.FT_EMBED ? '/embed/' : '/tree/') + encodeURIComponent(window.FT_TREE_SLUG || '');
  return base + (view && view !== 'custom' ? '/' + view : '') + '?focus=' + id;
}
function ftFamily() {
  const v = window.customTreeView || window.eventsView || window.mapView || window.memoriesView || window.relationView;
  return (v && v.familyData) || [];
}
// the memory book, fetched once per page (the Memories view already has it)
let _ftMedia = null;
function ftMediaList() {
  if (window.memoriesView && Array.isArray(window.memoriesView.media) && window.memoriesView.media.length) return Promise.resolve(window.memoriesView.media);
  if (!_ftMedia) _ftMedia = fetch('/api-media.php?tree=' + encodeURIComponent(window.FT_TREE_SLUG || ''))
    .then(r => r.json()).then(a => Array.isArray(a) ? a : []).catch(() => []);
  return _ftMedia;
}
// how much each view has on this person: dated events, places
function ftMemberCounts(m) {
  const dated = d => d && /^\d{4}-\d{2}-\d{2}/.test(String(d));
  let events = (dated(m.birth_date) ? 1 : 0) + (dated(m.death_date) ? 1 : 0) + (dated(m.anniversary_date) ? 1 : 0);
  if (!dated(m.anniversary_date)) events += ftFamily().filter(s => s.id !== m.id && dated(s.anniversary_date) && (s.pids || []).includes(m.id)).length ? 1 : 0;
  const places = new Set([m.birth_location, Number(m.is_alive) === 1 ? m.current_location : null, m.death_location].filter(Boolean).map(s => s.trim()));
  return { events, map: places.size };
}
function ftRenderSeeIn(m) {
  const box = document.getElementById('mpViews'); if (!box) return;
  const here = window.FT_VIEW || 'custom';
  const c = ftMemberCounts(m);
  // the first name, past titles like Smt., Shri, Late, Dr.
  const first = String(m.name || '').split(/\s+/).find(w => !/^(late|lt|shri|sri|smt|kumari|km|mr|mrs|ms|miss|dr|prof|sir|dame|lady|lord)\.?$/i.test(w)) || 'them';
  box.innerHTML = `<span class="mp-views-label">See ${uiUtils.displayValue(first)} in</span><div class="mp-views-row">` + FT_VIEWS.map(([k, label, icon]) => {
    const n = k === 'custom' ? null : k === 'memories' ? '' : c[k];
    const inner = `${ICONS[icon]}<span>${label}</span>${n !== null ? `<small data-count="${k}">${n === '' ? '<i class="sk sk-num" aria-hidden="true"></i>' : n}</small>` : ''}`;
    const empty = n === 0 ? ' is-empty' : '';
    return k === here
      ? `<button type="button" class="mp-view is-here${empty}" data-focus-here="${m.id}" title="Highlight here">${inner}</button>`
      : `<a class="mp-view${empty}" href="${ftViewHref(k, m.id)}">${inner}</a>`;
  }).join('') + '</div>';
  ftMediaList().then(list => {
    if (window._mpCurrentMemberId !== m.id) return;
    const n = list.filter(x => (x.members || []).some(p => p.id === m.id)).length;
    const el = box.querySelector('[data-count="memories"]'); if (!el) return;
    el.textContent = n; el.closest('.mp-view').classList.toggle('is-empty', n === 0);
  });
}
// each view sets window.ftFocusMember; the tree's comes from here
function ftFocusHere(id) {
  if (typeof window.ftFocusMember === 'function') return window.ftFocusMember(id);
  if (window.customTreeView && window.customTreeView.focusOnPerson) window.customTreeView.focusOnPerson(id);
}
// a small "Highlighting X" pill over the view, with a clear button
function ftFocusChip(html, onClear) {
  let chip = document.getElementById('ftFocusChip');
  if (!html) { if (chip) chip.remove(); return; }
  const host = document.getElementById('tree-root');
  if (!chip && host) {
    chip = document.createElement('div');
    chip.id = 'ftFocusChip'; chip.className = 'ft-focus-chip'; chip.setAttribute('role', 'status');
    if (getComputedStyle(host.parentElement).position === 'static') host.parentElement.style.position = 'relative';
    host.parentElement.appendChild(chip);
  }
  if (!chip) return;
  chip.innerHTML = `<span>${html}</span><button type="button" aria-label="Clear the highlight">${ICONS.close}</button>`;
  chip.querySelector('button').onclick = () => {
    chip.remove();
    const u = new URL(location.href); u.searchParams.delete('focus'); history.replaceState(null, '', u);
    onClear && onClear();
  };
}
function ftSetFocusUrl(id) {
  const u = new URL(location.href);
  if (id) u.searchParams.set('focus', id); else u.searchParams.delete('focus');
  history.replaceState(null, '', u);
}
function ftFocusParam() { return parseInt(new URLSearchParams(location.search).get('focus') || new URLSearchParams(location.search).get('person'), 10) || null; }

/**
 * Close member detail panel
 */
function closeMemberPanel() {
  const panel = document.getElementById('memberDetailPanel');
  if (panel) {
    panel.classList.add('member-panel-hidden');
  }
}

/**
 * Navigate to a relative in the tree
 */
function navigateToRelative(relativeId) {
  const customView = window.customTreeView;
  const d3View     = window.d3TreeView;

  if (customView && customView.personToUnit) {
    // Expand path then centre
    let unitId = customView.personToUnit.get(relativeId);
    while (unitId) {
      const u = customView.units.get(unitId);
      if (!u) break;
      u._collapsed = false;
      unitId = u.parentUnitId;
    }
    customView.highlightedId = relativeId;
    customView.computeLayout();
    customView.render();
    customView._centerOnPersonId(relativeId);
    const member = customView.familyData.find(m => m.id === relativeId);
    if (member) customView.showMemberDetails(member);

  } else if (d3View && d3View.rootHierarchy) {
    const node = d3View.rootHierarchy.descendants()
      .find(d => d.data.id === relativeId);
    if (node) {
      d3View.expandPath(node);
      d3View.update(d3View.rootHierarchy);
      d3View.centerOn(node);
      const member = d3View.familyData.find(m => m.id === relativeId);
      if (member) d3View.showMemberDetails(member);
    }
  } else {
    // timeline, map and memories: just open the relative's card
    const member = ftFamily().find(m => m.id === relativeId);
    if (member) openMemberPanel(member, dataUtils.findRelatives(member, ftFamily()));
  }
}

/**
 * Initialize member card event listeners
 */
document.addEventListener('DOMContentLoaded', () => {
  const panel = document.getElementById('memberDetailPanel');
  
  // Close panel when clicking outside
  document.addEventListener('click', (e) => {
    if (!panel || panel.classList.contains('member-panel-hidden')) return;
    
    if (Date.now() - (panel._openedAt || 0) < 400) return;
    if (panel.contains(e.target) ||
        e.target.closest('.bft-node') ||
        e.target.closest('g.node') ||
        e.target.closest('.ct-card') ||
        e.target.classList.contains('mp-link')) {
      return;
    }
    
    closeMemberPanel();
  });
  
  // Close panel on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeMemberPanel();
    }
  });
  
  // Close button
  document.addEventListener('click', (e) => {
    if (e.target.id === 'mpCloseBtn') {
      closeMemberPanel();
    }
  });
  
  // Relative / child chip clicks
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('mp-link')) {
      e.preventDefault();
      e.stopPropagation();
      
      const relativeId = Number(e.target.dataset.relId);
      const relativeType = e.target.dataset.relType;
      
      if (relativeId && !isNaN(relativeId)) {
        navigateToRelative(relativeId);
      }
    }
  });

  // Quick Add relative from member panel
  document.addEventListener('click', (e) => {
    const qaBtn = e.target.closest('[data-qa-type]');
    if (!qaBtn) return;
    e.preventDefault();
    e.stopPropagation();

    const type = qaBtn.dataset.qaType;
    const presetGender = qaBtn.dataset.qaGender || null;
    const curId = window._mpCurrentMemberId || window.currentMemberId;
    const targetMember = window.customTreeView?.familyData?.find(m => m.id === curId);

    if (window.customTreeView && targetMember) {
      window.customTreeView.openCreatorPopover(null, {
        type: type,
        targetPerson: targetMember,
        presetGender: presetGender
      });
    }
  });

  // Wiki "Read more"
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.mp-wiki-more');
    if (!btn) return;

    const span = btn.previousElementSibling; // .mp-wiki-text
    if (!span) return;

    span.classList.add('mp-wiki-expanded');
    btn.remove();
  });

  // Gallery thumbnail clicks
  document.addEventListener('click', (e) => {
    const item = e.target.closest('.mp-gallery-item');
    if (!item) return;

    const memberId = window.currentMemberId;
    const allMembers = ((window.customTreeView || window.eventsView || window.mapView || window.memoriesView || window.relationView || window.d3TreeView)?.familyData || []);
    const member = allMembers.find(m => m.id === memberId);
    if (!member || !Array.isArray(member.photos)) return;

    const index = Number(item.dataset.photoIndex);
    const photo = member.photos[index];
    if (photo && photo.url) {
      window.open(photo.url, '_blank', 'noopener');
    }
  });

  // Toggle export menu
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('#mpExportBtn');
    const menu = document.getElementById('mpExportMenu');

    if (btn) {
      e.stopPropagation();
      if (menu) {
        menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
      }
      return;
    }

    if (menu && !menu.contains(e.target)) {
      menu.style.display = 'none';
    }
  });

// Export choice (PNG / PDF)
    // Export choice (PNG / PDF)
document.addEventListener('click', async (e) => {
  const choice = e.target.closest('#mpExportMenu button');
  if (!choice) return;

  const format = choice.dataset.format; // 'png' or 'pdf'
  const panel = document.getElementById('memberDetailPanel');
  const menu = document.getElementById('mpExportMenu');
  if (menu) menu.style.display = 'none';

  if (!panel) return;
  if (typeof html2canvas === 'undefined' || !window.jspdf) {
    choice.disabled = true;
    try {
      await loadExportLibs();
    } catch (err) {
      console.error('Export libs failed to load', err);
      alert('Export tools could not be loaded. Check your connection and try again.');
      return;
    } finally { choice.disabled = false; }
  }

  const actions = panel.querySelectorAll('.no-export');
  actions.forEach(el => el.style.visibility = 'hidden');

  try {
    // Capture panel
    const canvas = await html2canvas(panel, {
      backgroundColor: null,
      scale: 2
    });
    const imgData = canvas.toDataURL('image/png');

    const nameEl = document.getElementById('mpName');
    const safeName = (nameEl?.textContent || 'member').replace(/\s+/g, '_');

    // Build footer text
    const now = new Date();
    const pad = n => String(n).padStart(2, '0');
    const dateStr = `${pad(now.getDate())}:${pad(now.getMonth() + 1)}:${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

    const ipText = ''; // optional
    const leftFooter = `Exported at: ${dateStr}${ipText ? ' (' + ipText + ')' : ''}`;
    const rightFooterLine1 = location.origin;
    const rightFooterLine2 = 'made with care by Ravi Rahul';

    if (format === 'png') {
      const footerHeight = 40;
      const exportCanvas = document.createElement('canvas');
      exportCanvas.width = canvas.width;
      exportCanvas.height = canvas.height + footerHeight;
      const ctx = exportCanvas.getContext('2d');

      // Draw card
      ctx.drawImage(canvas, 0, 0);

      // Footer background
      ctx.fillStyle = '#020617';
      ctx.fillRect(0, canvas.height, exportCanvas.width, footerHeight);

      // Footer text
      ctx.fillStyle = '#e5e7eb';
      ctx.font = '12px system-ui';
      ctx.textBaseline = 'top';

      const footerTop = canvas.height + 6;
      const lineGap = 14;

      // Left text (one line)
      ctx.fillText(leftFooter, 10, footerTop);

      // Right text: 2 lines, right‑aligned
      const line1Width = ctx.measureText(rightFooterLine1).width;
      const line2Width = ctx.measureText(rightFooterLine2).width;
      const rightX1 = exportCanvas.width - 10 - line1Width;
      const rightX2 = exportCanvas.width - 10 - line2Width;

      ctx.fillText(rightFooterLine1, rightX1, footerTop);
      ctx.fillText(rightFooterLine2, rightX2, footerTop + lineGap);

      const finalImg = exportCanvas.toDataURL('image/png');

      const link = document.createElement('a');
      link.href = finalImg;
      link.download = `${safeName}_card.png`;
      link.click();
    } else if (format === 'pdf') {
      const { jsPDF } = window.jspdf;

      // Card size -> page size
      const cardWidthPt = canvas.width * 0.75;
      const cardHeightPt = canvas.height * 0.75;

      const margin = 40;
      const footerSpace = 40;
      const pageHeight = cardHeightPt + margin * 2 + footerSpace;
      const pageWidth = cardWidthPt + margin * 2;

      const pdf = new jsPDF({
        orientation: 'p',
        unit: 'pt',
        format: [pageWidth, pageHeight]
      });

      const x = margin;
      const y = margin;

      pdf.addImage(imgData, 'PNG', x, y, cardWidthPt, cardHeightPt);

      // Footer
      pdf.setFontSize(7);
      pdf.setTextColor(148, 163, 184);

      const footerBaseY = y + cardHeightPt + 12;
      const lineGap = 10;
      const leftX = margin;
      const rightX = pageWidth - margin;

      // Left (one line)
      pdf.text(leftFooter, leftX, footerBaseY);

      // Right line 1
      const w1 = pdf.getTextWidth(rightFooterLine1);
      pdf.text(rightFooterLine1, rightX - w1, footerBaseY);

      // Right line 2
      const w2 = pdf.getTextWidth(rightFooterLine2);
      pdf.text(rightFooterLine2, rightX - w2, footerBaseY + lineGap);

      pdf.save(`${safeName}_card.pdf`);
    }
  } catch (err) {
    console.error('Failed to export member card:', err);
    alert('Export failed, please try again.');
  } finally {
    actions.forEach(el => el.style.visibility = '');
  }
});


});

// ── Member panel quick actions: Find relation + Copy link ──────────────────
document.addEventListener('click', (e) => {
  // Open the relationship finder with this person prefilled as Person 1
  if (e.target.closest('#mpFindRelBtn')) {
    const id = window._mpCurrentMemberId;
    if (id && typeof window.openRelationshipFinder === 'function') {
      window.openRelationshipFinder(id);
    }
    return;
  }

  // Copy a shareable deep link — opens the tree centred on this person
  const copyBtn = e.target.closest('#mpCopyLinkBtn');
  if (copyBtn) {
    const id = window._mpCurrentMemberId;
    if (!id) return;
    const url = location.origin + ftViewHref(window.FT_VIEW, id);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(() => {
        copyBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:4px;"><polyline points="20 6 9 17 4 12"/></svg>Copied!';
        setTimeout(() => { copyBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:4px;"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>Copy link'; }, 1800);
      }).catch(() => { prompt('Copy this link:', url); });
    } else {
      prompt('Copy this link:', url);
    }
    return;
  }

  // "See in" button for the view we are already on: highlight here
  const here = e.target.closest('[data-focus-here]');
  if (here) {
    ftFocusHere(Number(here.dataset.focusHere));
    if (window.innerWidth < 760) closeMemberPanel();
    return;
  }

  // Edit member button (beside export)
  const editBtn = e.target.closest('#mpEditBtn');
  if (editBtn) {
    const id = window._mpCurrentMemberId || window.currentMemberId;
    if (id) openMemberEditModal(id);
    return;
  }
});

/**
 * Full Member Edit Modal (Build Mode)
 */
function openMemberEditModal(memberId) {
  const allNodes = (window.customTreeView || window.eventsView || window.mapView || window.memoriesView || window.relationView)?.familyData || [];
  const member = allNodes.find(m => m.id === memberId);
  if (!member) return;

  let modal = document.getElementById('memberEditModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'memberEditModal';
    modal.className = 'modal';
    modal.style.display = 'none';
    document.body.appendChild(modal);
  }

  const isAlive = member.is_alive != null ? Boolean(Number(member.is_alive)) : true;
  const currentSpouseIds = Array.isArray(member.pids) ? member.pids : [];
  const isMarried = currentSpouseIds.length > 0;

  // Build select options excluding self and descendants
  const getMemberOptions = (selectedId, excludeIds = []) => {
    return allNodes
      .filter(n => !excludeIds.includes(n.id))
      .map(n => `<option value="${n.id}" ${n.id == selectedId ? 'selected' : ''}>${uiUtils.displayValue(n.name)}${n.nickname ? ' (' + n.nickname + ')' : ''}</option>`)
      .join('');
  };

  modal.innerHTML = `
    <div class="modal-overlay" id="memEditOverlay"></div>
    <div class="mem-edit-modal-content">
      <div class="mem-edit-header">
        <h3>Edit Member Details</h3>
        <button type="button" class="modal-close" id="memEditCloseBtn" aria-label="Close"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
      </div>
      <form id="memEditForm" class="mem-edit-body" autocomplete="off" onsubmit="return false;">
        <!-- Photo & Avatar -->
        <div class="mem-edit-section">
          <div class="mem-edit-section-title">Photo</div>
          <div class="mem-edit-avatar-box">
            <div class="mem-edit-avatar-preview" id="memEditAvatarPrev"></div>
            <div>
              <input type="file" id="memEditFileInput" accept="image/*" style="display:none;">
              <div style="display:flex;gap:8px;flex-wrap:wrap;">
                <button type="button" class="btn btn-ghost btn-sm" id="memEditUploadBtn"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:4px;"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>Change Photo</button>
                <button type="button" class="btn btn-ghost btn-sm" id="memEditRemovePhotoBtn" style="color:var(--red,#ef4444);display:${member.img ? 'inline-flex' : 'none'};">Remove Photo</button>
              </div>
              <input type="hidden" id="memEditImgVal" value="${member.img || ''}">
              <div style="font-size:11px;color:var(--text-muted);margin-top:6px;">Square photo recommended (JPG, PNG, WebP)</div>
            </div>
          </div>
        </div>

        <!-- Identity -->
        <div class="mem-edit-section">
          <div class="mem-edit-section-title">Identity & Status</div>
          <div class="mem-edit-row">
            <div class="mem-edit-fg">
              <label>Full Name *</label>
              <input type="text" id="memEditName" class="mem-edit-input" required value="${clean(member.name) || ''}">
            </div>
            <div class="mem-edit-fg">
              <label>Nickname / Known As</label>
              <input type="text" id="memEditNickname" class="mem-edit-input" value="${clean(member.nickname) || ''}">
            </div>
          </div>
          <div class="mem-edit-row">
            <div class="mem-edit-fg">
              <label>Gender</label>
              <select id="memEditGender" class="mem-edit-select">
                <option value="male" ${member.gender === 'male' ? 'selected' : ''}>Male</option>
                <option value="female" ${member.gender === 'female' ? 'selected' : ''}>Female</option>
                <option value="other" ${member.gender === 'other' ? 'selected' : ''}>Other</option>
              </select>
            </div>
            <div class="mem-edit-fg">
              <label>Life Status</label>
              <div style="display:flex;align-items:center;gap:8px;height:38px;">
                <input type="checkbox" id="memEditIsAlive" style="width:18px;height:18px;accent-color:var(--accent,#d4a643);" ${isAlive ? 'checked' : ''}>
                <label for="memEditIsAlive" style="margin:0;cursor:pointer;font-weight:600;">Living</label>
              </div>
            </div>
          </div>
        </div>

        <!-- Dates & Places -->
        <div class="mem-edit-section">
          <div class="mem-edit-section-title">Dates & Locations</div>
          <div class="mem-edit-row">
            <div class="mem-edit-fg">
              <label>Birth Date</label>
              <input type="date" id="memEditBirthDate" class="mem-edit-input" value="${member.birth_date ? member.birth_date.substring(0, 10) : ''}">
            </div>
            <div class="mem-edit-fg">
              <label>Birth Location</label>
              <input type="text" id="memEditBirthLoc" class="mem-edit-input" value="${clean(member.birth_location) || ''}" placeholder="e.g. City, Country">
            </div>
          </div>
          <div class="mem-edit-row" id="memEditDeathFields" style="display:${isAlive ? 'none' : 'grid'};">
            <div class="mem-edit-fg">
              <label>Death Date</label>
              <input type="date" id="memEditDeathDate" class="mem-edit-input" value="${member.death_date ? member.death_date.substring(0, 10) : ''}">
            </div>
            <div class="mem-edit-fg">
              <label>Death Location</label>
              <input type="text" id="memEditDeathLoc" class="mem-edit-input" value="${clean(member.death_location) || ''}" placeholder="e.g. City, Country">
            </div>
          </div>
          <div class="mem-edit-fg">
            <label>Current Location</label>
            <input type="text" id="memEditLocation" class="mem-edit-input" value="${clean(member.current_location) || ''}" placeholder="Where they currently reside">
          </div>
        </div>

        <!-- Parents -->
        <div class="mem-edit-section">
          <div class="mem-edit-section-title">Parents</div>
          <div class="mem-edit-row">
            <div class="mem-edit-fg">
              <label>Father</label>
              <select id="memEditFid" class="mem-edit-select">
                <option value="">— None —</option>
                ${getMemberOptions(member.fid, [member.id])}
              </select>
            </div>
            <div class="mem-edit-fg">
              <label>Mother</label>
              <select id="memEditMid" class="mem-edit-select">
                <option value="">— None —</option>
                ${getMemberOptions(member.mid, [member.id])}
              </select>
            </div>
          </div>
        </div>

        <!-- Spouses (Multi-spouse support!) -->
        <div class="mem-edit-section">
          <div class="mem-edit-section-title">Spouses & Partners</div>
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
            <input type="checkbox" id="memEditIsMarried" style="width:18px;height:18px;accent-color:var(--accent,#d4a643);" ${isMarried ? 'checked' : ''}>
            <label for="memEditIsMarried" style="margin:0;cursor:pointer;font-weight:600;font-size:0.85rem;">Married / Has Partner(s)</label>
          </div>
          <div id="memEditMarriageContainer" style="display:${isMarried ? 'block' : 'none'};">
            <label style="font-size:0.78rem;font-weight:600;margin-bottom:6px;display:block;">Spouse(s)</label>
            <div id="memEditSpousesList" style="display:flex;flex-direction:column;gap:8px;margin-bottom:8px;"></div>
            <button type="button" class="btn btn-ghost btn-sm" id="memEditAddSpouseBtn" style="font-size:11px;margin-bottom:12px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:4px;"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>Add Another Spouse</button>
            <div class="mem-edit-fg" style="max-width:260px;">
              <label>Anniversary Date</label>
              <input type="date" id="memEditAnniversary" class="mem-edit-input" value="${member.anniversary_date ? member.anniversary_date.substring(0, 10) : ''}">
            </div>
          </div>
        </div>

        <!-- Social Links -->
        <div class="mem-edit-section">
          <div class="mem-edit-section-title">Social Links</div>
          <div class="mem-edit-row">
            <div class="mem-edit-fg">
              <label>Instagram URL</label>
              <input type="url" id="memEditInsta" class="mem-edit-input" value="${clean(member.insta_url) || ''}" placeholder="https://instagram.com/...">
            </div>
            <div class="mem-edit-fg">
              <label>Facebook URL</label>
              <input type="url" id="memEditFb" class="mem-edit-input" value="${clean(member.fb_url) || ''}" placeholder="https://facebook.com/...">
            </div>
          </div>
        </div>

        <!-- Wiki Biography -->
        <div class="mem-edit-section">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
            <div class="mem-edit-section-title" style="margin:0;">Biography / Notes</div>
            <span id="memEditWikiCount" style="font-size:11px;color:var(--text-muted);">0 / 750</span>
          </div>
          <div class="mem-edit-fg">
            <textarea id="memEditWiki" class="mem-edit-textarea" maxlength="750" placeholder="Biographical story, notable achievements, memories...">${member.wiki || ''}</textarea>
          </div>
        </div>
      </form>
      <div class="mem-edit-footer">
        <button type="button" class="btn btn-danger btn-sm" id="memEditDeleteBtn" style="background:transparent;border:1px solid rgba(239,68,68,0.5);color:#ef4444;cursor:pointer;">Delete Member</button>
        <div style="display:flex;gap:8px;">
          <button type="button" class="btn btn-ghost btn-sm" id="memEditCancelBtn">Cancel</button>
          <button type="button" class="btn btn-primary btn-sm" id="memEditSaveBtn" style="background:var(--accent,#d4a643);color:#1a1612;font-weight:700;padding:6px 18px;cursor:pointer;">Save Changes</button>
        </div>
      </div>
    </div>
  `;

  if (window.ftExtraMount) window.ftExtraMount(modal, member, allNodes);

  // Attach controls & logic
  const closeModal = () => {
    modal.style.display = 'none';
  };

  modal.querySelector('#memEditCloseBtn').onclick = closeModal;
  modal.querySelector('#memEditOverlay').onclick = closeModal;
  modal.querySelector('#memEditCancelBtn').onclick = closeModal;

  // Avatar preview
  const avatarPrev = modal.querySelector('#memEditAvatarPrev');
  const updateAvatarPrev = (url) => {
    if (url) {
      avatarPrev.style.backgroundImage = `url(${url})`;
      avatarPrev.textContent = '';
    } else {
      avatarPrev.style.backgroundImage = 'none';
      avatarPrev.textContent = (clean(member.name) || '?').charAt(0).toUpperCase();
    }
  };
  updateAvatarPrev(member.img);

  // Photo file upload & removal
  const fileInput = modal.querySelector('#memEditFileInput');
  const uploadBtn = modal.querySelector('#memEditUploadBtn');
  const removeBtn = modal.querySelector('#memEditRemovePhotoBtn');
  const imgVal = modal.querySelector('#memEditImgVal');

  uploadBtn.onclick = () => fileInput.click();
  fileInput.onchange = () => {
    const file = fileInput.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        updateAvatarPrev(e.target.result);
        removeBtn.style.display = 'inline-flex';
      };
      reader.readAsDataURL(file);
    }
  };
  removeBtn.onclick = () => {
    fileInput.value = '';
    imgVal.value = '';
    updateAvatarPrev('');
    removeBtn.style.display = 'none';
  };

  // Life status toggle
  const isAliveCb = modal.querySelector('#memEditIsAlive');
  const deathFields = modal.querySelector('#memEditDeathFields');
  isAliveCb.onchange = () => {
    deathFields.style.display = isAliveCb.checked ? 'none' : 'grid';
  };

  // Marriage status toggle
  const isMarriedCb = modal.querySelector('#memEditIsMarried');
  const marriageCont = modal.querySelector('#memEditMarriageContainer');
  isMarriedCb.onchange = () => {
    marriageCont.style.display = isMarriedCb.checked ? 'block' : 'none';
  };

  // Spouses rows
  const spousesList = modal.querySelector('#memEditSpousesList');
  const renderSpouseRow = (spouseId) => {
    const row = document.createElement('div');
    row.className = 'mem-edit-spouse-row';
    row.innerHTML = `
      <select class="mem-edit-select mem-spouse-select" style="flex:1;">
        <option value="">— Select spouse / partner —</option>
        ${getMemberOptions(spouseId, [member.id])}
      </select>
      <button type="button" class="btn btn-ghost btn-sm" style="padding:4px 8px;color:var(--red,#ef4444);cursor:pointer;" title="Remove spouse"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
    `;
    row.querySelector('button').onclick = () => row.remove();
    spousesList.appendChild(row);
  };

  if (currentSpouseIds.length) {
    currentSpouseIds.forEach(id => renderSpouseRow(id));
  } else {
    renderSpouseRow(null);
  }

  modal.querySelector('#memEditAddSpouseBtn').onclick = () => renderSpouseRow(null);

  // Wiki char count
  const wikiTa = modal.querySelector('#memEditWiki');
  const wikiCount = modal.querySelector('#memEditWikiCount');
  const updateWikiCount = () => {
    wikiCount.textContent = `${wikiTa.value.length} / 750`;
  };
  wikiTa.oninput = updateWikiCount;
  updateWikiCount();

  // Delete member handler
  modal.querySelector('#memEditDeleteBtn').onclick = async () => {
    if (!confirm(`Are you sure you want to delete "${member.name}" from the family tree?\n\nThis will remove their profile and un-link their relationships.`)) {
      return;
    }
    try {
      const res = await fetch(`/admin/admin-api.php?id=${member.id}`, {
        method: 'DELETE',
        headers: {
          'X-CSRF-Token': (typeof window !== 'undefined' && window.FT_CSRF_TOKEN) ? window.FT_CSRF_TOKEN : ''
        }
      });
      if (res.status === 401) {
        alert('You must be logged into admin to delete members.');
        return;
      }

      // Remove from local memory
      if (window.customTreeView && Array.isArray(window.customTreeView.familyData)) {
        const idx = window.customTreeView.familyData.findIndex(m => m.id === member.id);
        if (idx !== -1) window.customTreeView.familyData.splice(idx, 1);

        // Remove references in other members
        window.customTreeView.familyData.forEach(m => {
          if (m.fid === member.id) m.fid = null;
          if (m.mid === member.id) m.mid = null;
          if (Array.isArray(m.pids)) {
            m.pids = m.pids.filter(pid => pid !== member.id);
          }
        });

        window.customTreeView.updateStats();
        window.customTreeView.buildFamilyUnits();
        window.customTreeView.computeLayout();
        window.customTreeView.render();
      }

      closeMemberPanel();
      closeModal();
      if (window.customTreeView?._showNotification) {
        window.customTreeView._showNotification(`Deleted ${member.name} from tree.`);
      }
    } catch (err) {
      console.error('Failed to delete member:', err);
      alert('Error deleting member: ' + (err.message || 'Unknown error'));
    }
  };

  // Save changes handler
  const saveBtn = modal.querySelector('#memEditSaveBtn');
  saveBtn.onclick = async () => {
    const nameVal = modal.querySelector('#memEditName').value.trim();
    if (!nameVal) {
      alert('Please enter a name for the member.');
      return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving…';

    try {
      let finalImg = imgVal.value || null;

      // 1. Upload photo if selected
      if (fileInput.files && fileInput.files[0]) {
        const formData = new FormData();
        formData.append('image', fileInput.files[0]);

        const upRes = await fetch('/admin/upload-image.php', {
          method: 'POST',
          headers: {
            'X-CSRF-Token': (typeof window !== 'undefined' && window.FT_CSRF_TOKEN) ? window.FT_CSRF_TOKEN : ''
          },
          body: formData
        });

        if (upRes.ok) {
          const upData = await upRes.json();
          if (upData.url) finalImg = upData.url;
        } else {
          console.warn('Image upload failed, saving text fields only.');
        }
      }

      // 2. Gather spouses
      const spouseSelects = Array.from(spousesList.querySelectorAll('.mem-spouse-select'));
      const spouseIds = spouseSelects
        .map(s => parseInt(s.value, 10))
        .filter(pid => !isNaN(pid) && pid > 0 && pid !== member.id);
      const uniqueSpouseIds = Array.from(new Set(spouseIds));

      const fidVal = modal.querySelector('#memEditFid').value;
      const midVal = modal.querySelector('#memEditMid').value;
      const isAliveChecked = isAliveCb.checked;
      const isMarriedChecked = isMarriedCb.checked;

      const payload = {
        name: nameVal,
        nickname: modal.querySelector('#memEditNickname').value.trim() || null,
        birthdate: modal.querySelector('#memEditBirthDate').value || null,
        birthlocation: modal.querySelector('#memEditBirthLoc').value.trim() || null,
        gender: modal.querySelector('#memEditGender').value || null,
        img: finalImg,
        fid: fidVal ? parseInt(fidVal, 10) : null,
        mid: midVal ? parseInt(midVal, 10) : null,
        pids: isMarriedChecked ? uniqueSpouseIds : [],
        isalive: isAliveChecked ? 1 : 0,
        currentlocation: modal.querySelector('#memEditLocation').value.trim() || null,
        instaurl: modal.querySelector('#memEditInsta').value.trim() || null,
        fburl: modal.querySelector('#memEditFb').value.trim() || null,
        anniversarydate: isMarriedChecked ? (modal.querySelector('#memEditAnniversary').value || null) : null,
        deathdate: !isAliveChecked ? (modal.querySelector('#memEditDeathDate').value || null) : null,
        deathlocation: !isAliveChecked ? (modal.querySelector('#memEditDeathLoc').value.trim() || null) : null,
        wiki: wikiTa.value.trim().substring(0, 750) || null
      };
      if (window.ftExtraCollect) {
        payload.extra = window.ftExtraCollect(modal, member);
        const ann = window.ftExtraAnniversary(payload.extra);
        if (ann !== undefined && isMarriedChecked) payload.anniversarydate = ann;
      }

      const res = await fetch(`/admin/admin-api.php?id=${member.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': (typeof window !== 'undefined' && window.FT_CSRF_TOKEN) ? window.FT_CSRF_TOKEN : ''
        },
        body: JSON.stringify(payload)
      });

      if (res.status === 401) {
        alert('You must be logged into admin to save changes.');
        return;
      }

      const resData = await res.json().catch(() => ({}));
      if (!res.ok || resData.error) {
        throw new Error(resData.error || 'Failed to save changes');
      }

      // 3. Update local memory
      if (resData.extra !== undefined) member.extra = resData.extra;
      member.name = payload.name;
      member.nickname = payload.nickname;
      member.birth_date = payload.birthdate;
      member.birth_location = payload.birthlocation;
      member.gender = payload.gender;
      member.img = payload.img;
      member.fid = payload.fid;
      member.mid = payload.mid;
      member.is_alive = payload.isalive;
      member.current_location = payload.currentlocation;
      member.insta_url = payload.instaurl;
      member.fb_url = payload.fburl;
      member.anniversary_date = payload.anniversarydate;
      member.death_date = payload.deathdate;
      member.death_location = payload.deathlocation;
      member.wiki = payload.wiki;

      // Reciprocal spouse sync in local memory
      const prevSpouseIds = Array.isArray(member.pids) ? [...member.pids] : [];
      member.pids = [...payload.pids];

      // Remove from unlinked spouses
      const removedSpouseIds = prevSpouseIds.filter(id => !payload.pids.includes(id));
      removedSpouseIds.forEach(sId => {
        const s = allNodes.find(n => n.id === sId);
        if (s && Array.isArray(s.pids)) {
          s.pids = s.pids.filter(pid => pid !== member.id);
        }
      });

      // Add to new spouses
      payload.pids.forEach(sId => {
        const s = allNodes.find(n => n.id === sId);
        if (s) {
          if (!Array.isArray(s.pids)) s.pids = [];
          if (!s.pids.includes(member.id)) s.pids.push(member.id);
        }
      });

      // 4. Rebuild tree
      if (window.customTreeView) {
        window.customTreeView.updateStats();
        window.customTreeView.buildFamilyUnits();
        window.customTreeView.computeLayout();
        window.customTreeView.render();
      }

      // 5. Re-sync member panel
      openMemberPanel(member, dataUtils.findRelatives(member, allNodes));

      closeModal();
      if (window.customTreeView?._showNotification) {
        window.customTreeView._showNotification(`Saved changes for ${member.name}!`);
      }

    } catch (err) {
      console.error('Error saving member:', err);
      alert('Error saving changes: ' + (err.message || 'Unknown error'));
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save Changes';
    }
  };

  modal.style.display = 'flex';
}

// Lazy-load html2canvas + jsPDF (about 400 KB) only when someone exports.
function loadExportLibs() {
  const add = (src) => new Promise((res, rej) => {
    if (document.querySelector(`script[src="${src}"]`)) return res();
    const el = document.createElement('script');
    el.src = src; el.onload = res; el.onerror = () => rej(new Error(src));
    document.head.appendChild(el);
  });
  return add('https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js')
    .then(() => add('https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js'));
}
