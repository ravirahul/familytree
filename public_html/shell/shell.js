// shell/shell.js - Refactored shell with unified controls and vector icons

// FamilyTree's own logo mark: same drawing as FT_MARK_PATHS in includes/brand.php (size it with CSS)
const FT_LOGO = '<svg class="ft-mark" width="18" height="18" viewBox="3 3 22 23.5" aria-hidden="true" focusable="false"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 25V15.5M14 21l-5.2-5.2M14 18.5l5.2-5.2M14 15.5V9.6M9.5 25h9"/><circle cx="7.2" cy="14.2" r="2.4"/><circle cx="20.8" cy="11.7" r="2.4"/><circle cx="14" cy="7" r="2.4"/></g></svg>';

const ICONS = {
  tree: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22v-8"/><path d="M12 14c-3 0-5.5-2.2-5.5-5 0-3.5 3-6.5 5.5-6.5s5.5 3 5.5 6.5c0 2.8-2.5 5-5.5 5z"/><path d="M6.5 10c-2.5 0-4 1.5-4 3.5 0 2 1.5 3.5 4 3.5h1.5"/><path d="M17.5 10c2.5 0 4 1.5 4 3.5 0 2-1.5 3.5-4 3.5h-1.5"/><path d="M7 22h10"/></svg>`,
  users: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
  dna: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="5" r="3"/><line x1="12" y1="8" x2="12" y2="14"/><line x1="6" y1="14" x2="18" y2="14"/><line x1="6" y1="14" x2="6" y2="18"/><line x1="18" y1="14" x2="18" y2="18"/><circle cx="6" cy="20" r="2"/><circle cx="18" cy="20" r="2"/></svg>`,
  tools: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>`,
  share: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>`,
  theme: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>`,
  admin: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
  key: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2l-2 2m-1.5 1.5L14 9m-1.5 1.5L9 14l-5 5 1 1 2-2 1 1 2-2-1-1 3-3"/><circle cx="15.5" cy="8.5" r="2.5"/></svg>`,
  sprout: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 20h10"/><path d="M12 20v-8"/><path d="M12 12a5 5 0 0 1 5-5h2v2a5 5 0 0 1-5 5h-2z"/><path d="M12 12a5 5 0 0 0-5-5H5v2a5 5 0 0 0 5 5h2z"/></svg>`,
  lightbulb: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#d4af37" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .4 1.9 1.5 3.5.76.76 1.23 1.52 1.41 2.5"/></svg>`,
  close: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
  plus: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
  minus: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
  center: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>`,
  maximize: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>`,
  minimize: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/></svg>`,
  link: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`,
  edit: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
  copy: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`,
  check: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
  search: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
  swap: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="7 10 12 15 17 10"/><polyline points="17 14 12 9 7 14"/></svg>`,
  pin: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>`,
  heart: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`,
  arrowDown: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>`,
  male: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="14" r="5"/><line x1="19" y1="5" x2="13.6" y2="10.4"/><polyline points="15 5 19 5 19 9"/></svg>`,
  female: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="9" r="5"/><line x1="12" y1="14" x2="12" y2="21"/><line x1="9" y1="18" x2="15" y2="18"/></svg>`,
  calendar: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
  globe: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`,
  book: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>`,
  timeline: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="2" y1="12" x2="22" y2="12"/><circle cx="6" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="18" cy="12" r="2"/></svg>`,
  list: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>`,
  image: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`,
  video: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>`,
  mic: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>`,
  chevronLeft: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>`,
  chevronRight: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`
};

window.updateFullscreenUI = function(isFullscreen) {
  const fsBtn = document.getElementById('btnCustomFullscreen');
  if (fsBtn) {
    fsBtn.innerHTML = isFullscreen
      ? `${ICONS.minimize} Exit fullscreen`
      : `${ICONS.maximize} Fullscreen`;
  }
  const fabBtn = document.getElementById('fabFullscreen');
  if (fabBtn) {
    fabBtn.innerHTML = isFullscreen ? ICONS.minimize : ICONS.maximize;
    fabBtn.title = isFullscreen ? 'Exit Fullscreen (Esc)' : 'Toggle Fullscreen';
    fabBtn.setAttribute('aria-label', fabBtn.title);
  }
};

document.addEventListener('DOMContentLoaded', () => {
  const root = document.getElementById('app-shell');
  if (!root) {
    console.error('app-shell element not found');
    return;
  }

  const view = root.dataset.view || 'custom'; // 'custom' | 'd3'

  // Phase 4: use injected tree name when available
  const treeName  = (typeof window !== 'undefined' && window.FT_TREE_NAME) ? window.FT_TREE_NAME : 'Family Tree';
  const treeSlug  = (typeof window !== 'undefined' && window.FT_TREE_SLUG) ? window.FT_TREE_SLUG : '';

  const viewTitle = view === 'd3' ? treeName + ' · Lineage' : treeName;
  const emblemHtml = ftEmblemMarkup(40);
  const viewSubtitle = view === 'd3'
    ? 'Lineage from father\'s side using D3, read-only.'
    : 'Full family tree — couples, children, all branches. Read-only.';
  const viewHint = view === 'd3'
    ? 'This chart only shows lineages from father side using D3.'
    : 'Click any person to see details. Use search to jump to any member.';

  // Render shell
  root.innerHTML = `
    <div class="app-shell">
      <header class="app-header">
        <div class="title-block">
          <a href="/" class="title-icon ${emblemHtml ? 'has-emblem' : ''}" title="FamilyTree home" aria-label="FamilyTree home">${emblemHtml || FT_LOGO}</a>
          <div>
            <h1>${viewTitle}</h1>
            <div class="stat-chips">
              <span class="stat-chip">${ICONS.users} <b id="${view === 'd3' ? 'd3TotalMembers' : view === 'custom' ? 'customTotalMembers' : 'totalMembers'}"></b> members</span>
              <span class="stat-chip">${ICONS.dna} <b id="${view === 'd3' ? 'd3TotalGenerations' : view === 'custom' ? 'customTotalGenerations' : 'totalGenerations'}"></b> generations</span>
            </div>
          </div>
        </div>

        <button type="button" class="hdr-menu-btn" id="hdrMenuBtn" aria-label="Open menu" aria-expanded="false" aria-controls="hdrMenu">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="17" x2="20" y2="17"/></svg>
        </button>
        ${(typeof window !== 'undefined' && window.FT_EMBED) ? `<a class="btn btn-ghost btn-sm embed-open" href="/tree/${treeSlug}${view === 'custom' ? '' : '/' + view}" target="_blank" rel="noopener">Open full tree ↗</a>` : ''}
        <div class="header-right" id="hdrMenu">
          ${(typeof window !== 'undefined' && window.FT_CAN_EDIT) ? `
            <button id="btnBuilderMode" class="btn btn-sm btn-builder" title="Toggle interactive flowchart editing">
              ${ICONS.tools} <span id="builderModeLabel">Build Mode</span>
            </button>
          ` : ''}
          ${(treeSlug && !window.FT_EMBED) ? `<a href="/tree/${treeSlug}/poster" class="btn btn-ghost btn-sm" title="Print a poster or a family book"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9V3h12v6"/><rect x="6" y="14" width="12" height="7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/></svg> <span>Print</span></a>` : ''}
          <button id="shareBtn" class="btn btn-ghost btn-sm" title="Share this tree">${ICONS.share} <span>Share</span></button>
          <button id="themeToggle" class="btn btn-ghost btn-sm" title="Switch light / dark theme">${ICONS.theme}</button>
          ${(typeof window !== 'undefined' && window.FT_CAN_EDIT) ? `
            <a href="/admin/" class="btn btn-ghost btn-sm" title="Admin panel">${ICONS.admin} Admin</a>
          ` : `
            <a href="/admin/" class="btn btn-ghost btn-sm" title="Log in to edit">${ICONS.key} Log in</a>
          `}
        </div>
      </header>

      <div id="quickTip" class="quick-tip" hidden>
        <span>${ICONS.lightbulb} ${CONFIG.MESSAGES.quickTip || viewHint}</span>
        <button type="button" id="quickTipClose" aria-label="Dismiss tip">${ICONS.close}</button>
      </div>

      <div class="toolbar-row">
        ${treeSlug ? generateViewTabs(view, treeSlug) : ''}
        ${generateControlsBar(view)}
      </div>

      <div class="tree-layout">
        <div class="tree-shell">
          <div id="tree-root">${uiUtils.skeleton(view)}</div>
          ${view === 'custom' ? `
          <div id="nodeCreatorPopover" class="node-creator-popover" hidden>
            <div class="ncp-header">
              <span class="ncp-title" id="ncpTitle">Add Relative</span>
              <button type="button" class="ncp-close" id="ncpCloseBtn" aria-label="Close">${ICONS.close}</button>
            </div>
            <form id="ncpForm">
              <div class="ncp-field">
                <input type="text" id="ncpName" placeholder="Full name..." required autocomplete="off">
              </div>
              <div class="ncp-field ncp-row">
                <div class="ncp-gender-toggle">
                  <label class="ncp-gender-btn">
                    <input type="radio" name="ncpGender" value="male" id="ncpGenderMale" checked>
                    <span>${ICONS.male} Male</span>
                  </label>
                  <label class="ncp-gender-btn">
                    <input type="radio" name="ncpGender" value="female" id="ncpGenderFemale">
                    <span>${ICONS.female} Female</span>
                  </label>
                </div>
                <label class="ncp-status-toggle">
                  <input type="checkbox" id="ncpIsAlive" checked>
                  <span>Living</span>
                </label>
              </div>
              <div class="ncp-actions">
                <button type="submit" class="btn btn-gold btn-sm ncp-submit" id="ncpSubmitBtn">
                  <span>${ICONS.plus} Add Relative</span>
                  <kbd>↵</kbd>
                </button>
              </div>
            </form>
          </div>
          <div class="tree-fab" aria-label="Tree zoom controls">
            <button type="button" id="fabZoomIn" title="Zoom in" aria-label="Zoom in">${ICONS.plus}</button>
            <button type="button" id="fabZoomOut" title="Zoom out" aria-label="Zoom out">${ICONS.minus}</button>
            <button type="button" id="fabFit" title="Fit to screen" aria-label="Fit to screen">${ICONS.center}</button>
            <button type="button" id="fabFullscreen" title="Toggle Fullscreen (Esc)" aria-label="Toggle Fullscreen">${ICONS.maximize}</button>
          </div>` : ''}
        </div>

        ${generateMemberPanel()}
      </div>

      <footer class="app-footer">
        ${(typeof window !== 'undefined' && window.FT_EMBED)
          ? `<a class="ft-made" href="${location.origin}/" target="_blank" rel="noopener">${FT_LOGO} Made with FamilyTree</a> · free and open source`
          : window.FT_CAN_EDIT
          ? `You can edit this tree. Turn on Build Mode to add people, or open <a href="/admin/" style="color:inherit;text-decoration:underline;">Admin</a> · <a href="/guide" style="color:inherit;text-decoration:underline;">Guide</a>`
          : `${CONFIG.MESSAGES.readOnly} · ${CONFIG.MESSAGES.contactForEdits}`}
      </footer>
    </div>
  `;

  // ── Header menu (phones) ────────────────────────────────────────────────
  const hdrBtn = document.getElementById('hdrMenuBtn');
  const hdr    = root.querySelector('.app-header');
  if (hdrBtn && hdr) {
    hdrBtn.addEventListener('click', () => {
      const open = hdr.classList.toggle('menu-open');
      hdrBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
      hdrBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    });
    document.addEventListener('click', (e) => {
      if (hdr.classList.contains('menu-open') && !hdr.contains(e.target)) hdr.classList.remove('menu-open');
    });
  }

  // ── One-time dismissible tip ────────────────────────────────────────────
  const tipEl = document.getElementById('quickTip');
  if (tipEl && !localStorage.getItem('ft_tip_dismissed')) {
    tipEl.hidden = false;
    document.getElementById('quickTipClose')?.addEventListener('click', () => {
      tipEl.hidden = true;
      localStorage.setItem('ft_tip_dismissed', '1');
    });
  }

  // ── Floating zoom controls (custom view) ───────────────────────────────
  if (view === 'custom') {
    document.getElementById('fabZoomIn') ?.addEventListener('click', () => window.customTreeView?.zoomIn?.());
    document.getElementById('fabZoomOut')?.addEventListener('click', () => window.customTreeView?.zoomOut?.());
    document.getElementById('fabFit')    ?.addEventListener('click', () => window.customTreeView?.onCenter?.());
    document.getElementById('fabFullscreen')?.addEventListener('click', () => window.customTreeView?.toggleFullscreen?.());

    // ── Node creator popover close & submit ───────────────────────────────
    document.getElementById('ncpCloseBtn')?.addEventListener('click', () => {
      window.customTreeView?.closeCreatorPopover();
    });
    document.getElementById('ncpForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      window.customTreeView?.submitCreatorPopover();
    });

    // ── Builder Mode toggle ───────────────────────────────────────────────
    const builderBtn = document.getElementById('btnBuilderMode');
    if (builderBtn) {
      if (typeof window !== 'undefined' && window.FT_CAN_EDIT) {
        builderBtn.classList.add('active');
        const label = document.getElementById('builderModeLabel');
        if (label) label.textContent = 'Build Mode: ON';
      }
      builderBtn.addEventListener('click', () => {
        const active = window.customTreeView?.toggleBuilderMode();
        builderBtn.classList.toggle('active', active);
        const label = document.getElementById('builderModeLabel');
        if (label) label.textContent = active ? 'Build Mode: ON' : 'Build Mode';

        // Re-sync open member panel so Edit and Add buttons update immediately
        if (window._mpCurrentMemberId && window.customTreeView?.familyData) {
          const curMember = window.customTreeView.familyData.find(m => m.id === window._mpCurrentMemberId);
          if (curMember && typeof openMemberPanel === 'function') {
            openMemberPanel(curMember, dataUtils.findRelatives(curMember, window.customTreeView.familyData));
          }
        }
      });
    }
  }

  // ── Share: a dialog with the link, WhatsApp, the phone's share sheet, and embed code ──────
  const shareBtn = document.getElementById('shareBtn');
  if (shareBtn) shareBtn.addEventListener('click', openShareDialog);

  // Attach Find relation button
  const relBtn = document.getElementById('btnRelationshipFinder');
  if (relBtn) {
    relBtn.addEventListener('click', () => {
      openRelationshipFinder();
    });
  }

  // Custom-tree specific controls
  if (view === 'custom') {
    const centerBtn = document.getElementById('btnCustomCenter');
    if (centerBtn) centerBtn.addEventListener('click', () => window.customTreeView?.onCenter());

    const fsBtn = document.getElementById('btnCustomFullscreen');
    if (fsBtn) {
      fsBtn.addEventListener('click', () => {
        window.customTreeView?.toggleFullscreen();
      });
    }

    const expandBtn = document.getElementById('btnExpandToggle');
    if (expandBtn) {
      expandBtn.addEventListener('click', () => {
        const next = expandBtn.dataset.expanded !== '1';
        expandBtn.dataset.expanded = next ? '1' : '0';
        expandBtn.innerHTML = next ? `${ICONS.minus} Collapse all` : `${ICONS.plus} Expand all`;
        window.customTreeView?.onExpandChange(next);
      });
    }

    // Global escape key handler to exit fullscreen or dismiss popups
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' || e.key === 'Esc') {
        const ncp = document.getElementById('nodeCreatorPopover');
        if (ncp && !ncp.hidden) {
          window.customTreeView?.closeCreatorPopover();
          return;
        }
        const relModal = document.getElementById('relationshipModal');
        if (relModal && relModal.style.display !== 'none') {
          closeRelationshipFinder();
          return;
        }
        const editModal = document.getElementById('memberEditModal');
        if (editModal && !editModal.hidden) {
          editModal.hidden = true;
          return;
        }
        if (window.customTreeView?.isFullscreen) {
          window.customTreeView.exitFullscreen();
        }
      }
    });

    const searchInput = document.getElementById('customSearchInput');
    const searchSuggestions = document.getElementById('searchSuggestions');
    let activeSuggestionIndex = -1;

    const esc = s => String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

    function renderSuggestions(matches) {
      if (!searchSuggestions) return;
      if (!matches || matches.length === 0) {
        searchSuggestions.innerHTML = '<div class="search-no-results">No relatives found</div>';
        searchSuggestions.hidden = false;
        activeSuggestionIndex = -1;
        return;
      }

      searchSuggestions.innerHTML = matches.slice(0, 8).map((m, idx) => {
        const nick = m.nickname ? ` <span class="sugg-nick">"${esc(m.nickname)}"</span>` : '';
        const b = m.birth_date ? String(m.birth_date).substring(0, 4) : '';
        const d = m.death_date ? String(m.death_date).substring(0, 4) : (m.is_alive ? 'Present' : '');
        const dates = (b || d) ? `<span class="sugg-dates">${b ? b : ''}${d ? ' – ' + d : ''}</span>` : '';
        const initial = (m.name || '?').charAt(0).toUpperCase();
        const avatarHtml = m.img
          ? `<img src="${esc(m.img)}" class="sugg-avatar" alt="">`
          : `<div class="sugg-avatar-initial ${m.gender || 'male'}">${initial}</div>`;
        return `
          <div class="search-suggestion-item" data-id="${m.id}" data-idx="${idx}">
            ${avatarHtml}
            <div class="sugg-info">
              <div class="sugg-name">${esc(m.name)}${nick}</div>
              <div class="sugg-meta">${dates}</div>
            </div>
            <span class="sugg-arrow">→</span>
          </div>
        `;
      }).join('');

      searchSuggestions.hidden = false;
      activeSuggestionIndex = -1;

      searchSuggestions.querySelectorAll('.search-suggestion-item').forEach(item => {
        item.addEventListener('click', () => {
          const id = parseInt(item.dataset.id, 10);
          if (id) selectPerson(id);
        });
      });
    }

    function selectPerson(id) {
      if (searchSuggestions) searchSuggestions.hidden = true;
      const member = window.customTreeView?.familyData?.find(m => m.id === id);
      if (member) {
        if (searchInput) searchInput.value = member.name;
        window.customTreeView?.focusOnPerson(id);
      }
    }

    function hideSuggestions() {
      if (searchSuggestions) searchSuggestions.hidden = true;
      activeSuggestionIndex = -1;
    }

    function updateActiveItem(items) {
      items.forEach((it, i) => {
        it.classList.toggle('active', i === activeSuggestionIndex);
        if (i === activeSuggestionIndex) it.scrollIntoView({ block: 'nearest' });
      });
    }

    if (searchInput) {
      let _debounce;
      searchInput.addEventListener('input', () => {
        clearTimeout(_debounce);
        const q = searchInput.value.trim().toLowerCase();
        if (!q) {
          hideSuggestions();
          window.customTreeView?.searchAndHighlight('');
          return;
        }
        _debounce = setTimeout(() => {
          const data = window.customTreeView?.familyData || [];
          const matches = data.filter(m =>
            (m.name || '').toLowerCase().includes(q) ||
            (m.nickname || '').toLowerCase().includes(q) ||
            (m.wiki || '').toLowerCase().includes(q)
          );
          renderSuggestions(matches);
          window.customTreeView?.searchAndHighlight(q);
        }, 200);
      });

      searchInput.addEventListener('keydown', (e) => {
        if (!searchSuggestions || searchSuggestions.hidden) {
          if (e.key === 'Escape') {
            searchInput.value = '';
            window.customTreeView?.searchAndHighlight('');
          }
          return;
        }

        const items = searchSuggestions.querySelectorAll('.search-suggestion-item');
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          activeSuggestionIndex = (activeSuggestionIndex + 1) % items.length;
          updateActiveItem(items);
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          activeSuggestionIndex = (activeSuggestionIndex - 1 + items.length) % items.length;
          updateActiveItem(items);
        } else if (e.key === 'Enter') {
          e.preventDefault();
          if (activeSuggestionIndex >= 0 && items[activeSuggestionIndex]) {
            const id = parseInt(items[activeSuggestionIndex].dataset.id, 10);
            if (id) selectPerson(id);
          }
        } else if (e.key === 'Escape') {
          hideSuggestions();
        }
      });
    }

    document.addEventListener('click', (e) => {
      if (searchSuggestions && !e.target.closest('.search-input-wrap')) {
        hideSuggestions();
      }
    });

    // Global keyboard navigation
    document.addEventListener('keydown', (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;

      if (e.key === '/') {
        e.preventDefault();
        searchInput?.focus();
        searchInput?.select();
      } else if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        window.customTreeView?.zoomIn?.();
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        window.customTreeView?.zoomOut?.();
      } else if (e.key === '0' || e.key.toLowerCase() === 'f') {
        e.preventDefault();
        window.customTreeView?.onCenter?.();
      } else if (e.key === 'Escape') {
        const panel = document.getElementById('memberDetailPanel');
        if (panel && !panel.classList.contains('member-panel-hidden')) {
          panel.classList.add('member-panel-hidden');
        }
      }
    });
  }

});

/** Share dialog: copy the link, WhatsApp, native share, and an embed snippet that updates as you choose */
function openShareDialog() {
  const slug = window.FT_TREE_SLUG || '';
  const name = window.FT_TREE_NAME || 'Family Tree';
  const view = (document.getElementById('app-shell') || {}).dataset?.view || 'custom';
  const link = location.origin + '/tree/' + slug + (view === 'custom' ? '' : '/' + view);
  let dlg = document.getElementById('shareDialog');
  if (!dlg) {
    dlg = document.createElement('dialog');
    dlg.id = 'shareDialog';
    dlg.className = 'share-dialog';
    dlg.setAttribute('aria-labelledby', 'shareTitle');
    dlg.innerHTML = `
      <div class="share-head"><h3 id="shareTitle">Share this tree</h3><button type="button" class="share-x" aria-label="Close">${ICONS.close}</button></div>
      <div class="share-body">
        <label class="share-label" for="shareLink">Link</label>
        <div class="share-row"><input id="shareLink" readonly><button type="button" class="btn btn-soft" data-copy="shareLink">Copy</button></div>
        <div class="share-row share-apps">
          <a class="btn btn-soft" id="shareWa" target="_blank" rel="noopener">WhatsApp</a>
          ${navigator.share ? '<button type="button" class="btn btn-soft" id="shareNative">More apps</button>' : ''}
        </div>
        <hr>
        <h4>Embed on your website</h4>
        <p class="share-note">Paste this into any page: a blog, a family website, Notion, WordPress, Google Sites. Only public and unlisted trees can be embedded.</p>
        <div class="share-opts">
          <label>View <select id="embView"><option value="">Tree</option><option value="events">Timeline</option><option value="map">Map</option><option value="memories">Memories</option><option value="relation">How are we related</option></select></label>
          <label>Theme <select id="embTheme"><option value="">Visitor's choice</option><option value="light">Light</option><option value="dark">Dark</option></select></label>
          <label>Look <select id="embLook"><option value="">The family's look</option>${Object.entries(window.FT_TREE_THEMES || {}).map(([k, t]) => `<option value="${k}">${t.name}</option>`).join('')}</select></label>
          <label>Height <select id="embHeight"><option>480</option><option selected>600</option><option>760</option></select></label>
        </div>
        <textarea id="embCode" rows="4" readonly></textarea>
        <div class="share-row"><button type="button" class="btn btn-soft" data-copy="embCode">Copy code</button><a id="embPreview" target="_blank" rel="noopener">Preview</a></div>
      </div>`;
    document.body.appendChild(dlg);
    dlg.querySelector('.share-x').addEventListener('click', () => dlg.close());
    dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
    dlg.querySelectorAll('[data-copy]').forEach(b => b.addEventListener('click', () => {
      const el = document.getElementById(b.dataset.copy);
      navigator.clipboard.writeText(el.value).then(() => { const t = b.textContent; b.textContent = 'Copied'; setTimeout(() => b.textContent = t, 1600); })
        .catch(() => { el.select(); });
    }));
    const upd = () => {
      const v = document.getElementById('embView').value, th = document.getElementById('embTheme').value, lk = document.getElementById('embLook').value, h = document.getElementById('embHeight').value;
      const src = location.origin + '/embed/' + slug + (v ? '/' + v : '') + ((th || lk) ? '?' + [th && 'theme=' + th, lk && 'look=' + lk].filter(Boolean).join('&') : '');
      const safe = name.replace(/"/g, '&quot;');
      document.getElementById('embCode').value = `<iframe src="${src}" title="${/family/i.test(safe) ? safe : safe + ' family'} tree" width="100%" height="${h}" style="border:0;border-radius:12px" loading="lazy" allow="fullscreen"></iframe>`;
      document.getElementById('embPreview').href = src;
    };
    ['embView', 'embTheme', 'embLook', 'embHeight'].forEach(id => document.getElementById(id).addEventListener('change', upd));
    const nat = document.getElementById('shareNative');
    if (nat) nat.addEventListener('click', () => navigator.share({ title: name, url: document.getElementById('shareLink').value }).catch(() => {}));
    dlg._update = upd;
  }
  document.getElementById('shareLink').value = link;
  document.getElementById('shareWa').href = 'https://wa.me/?text=' + encodeURIComponent('Explore the ' + name + ' family tree: ' + link);
  document.getElementById('embView').value = view === 'custom' ? '' : view;
  dlg._update();
  dlg.showModal();
}

/**
 * Sub-view tabs: Tree · Events · Map · Memories  (only for /tree/{slug} pages)
 */
function generateViewTabs(view, slug) {
  const base = (window.FT_EMBED ? '/embed/' : '/tree/') + slug;
  const tabs = [
    { key: 'custom',   href: base,               icon: ICONS.tree,     label: 'Tree' },
    { key: 'events',   href: base + '/events',   icon: ICONS.calendar, label: 'Events' },
    { key: 'map',      href: base + '/map',      icon: ICONS.globe,    label: 'Map' },
    { key: 'memories', href: base + '/memories', icon: ICONS.book,     label: 'Memories' },
  ];
  return `<nav class="view-tabs" aria-label="Tree sections">${tabs.map(t =>
    `<a href="${t.href}" class="view-tab${t.key === view ? ' active' : ''}"${t.key === view ? ' aria-current="page"' : ''}>${t.icon}<span>${t.label}</span></a>`
  ).join('')}</nav>`;
}

/**
 * Controls bar
 */
/** The search box on the events, map and memories views. Typing fires a 'ft:viewsearch' event
 *  on window with { q } (debounced); each view filters itself. Esc clears it. */
function viewSearchBox(placeholder) {
  return `<div class="controls-section controls-section-search">
          <div class="search-input-wrap">
            <input id="viewSearchInput" type="search" class="ctrl-search" placeholder="${placeholder}" autocomplete="off" aria-label="${placeholder}">
          </div>
        </div>`;
}
function wireViewSearch() {
  const input = document.getElementById('viewSearchInput');
  if (!input || input.dataset.wired) return;
  input.dataset.wired = '1';
  let t = 0;
  const fire = () => window.dispatchEvent(new CustomEvent('ft:viewsearch', { detail: { q: input.value.trim() } }));
  input.addEventListener('input', () => { clearTimeout(t); t = setTimeout(fire, 150); });
  input.addEventListener('keydown', e => { if (e.key === 'Escape' && input.value) { input.value = ''; fire(); } });
  input.addEventListener('search', fire);   // the clear (x) button on type=search
}
if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', () => setTimeout(wireViewSearch, 0));

function generateControlsBar(view) {
  if (view === 'relation') return '';     // the relation page has its own top bar
  if (view === 'events') {
    return `
      <div class="controls-bar">
        <div class="controls-section">
          <div class="controls-label">View</div>
          <div class="seg" role="tablist" id="evViewSeg">
            <button type="button" class="seg-btn active" data-view="timeline" role="tab">${ICONS.timeline} Timeline</button>
            <button type="button" class="seg-btn" data-view="list" role="tab">${ICONS.list} List</button>
            <button type="button" class="seg-btn" data-view="calendar" role="tab">${ICONS.calendar} Calendar</button>
          </div>
        </div>
        <div class="controls-section" id="evFilters">
          <label class="chip-check"><input type="checkbox" data-type="birthday" checked><span class="dot dot-birthday"></span>Birthdays</label>
          <label class="chip-check"><input type="checkbox" data-type="anniversary" checked><span class="dot dot-anniversary"></span>Anniversaries</label>
          <label class="chip-check"><input type="checkbox" data-type="death" checked><span class="dot dot-death"></span>Remembrance</label>
          <label class="chip-check"><input type="checkbox" data-type="custom" checked><span class="dot dot-custom"></span>Family events</label>
        </div>
        ${viewSearchBox('Search people or events...')}
      </div>`;
  }
  if (view === 'map') {
    return `
      <div class="controls-bar">
        <div class="controls-section">
          <div class="controls-label">Show</div>
          <div class="seg" id="mapModeSeg">
            <button type="button" class="seg-btn active" data-mode="current">${ICONS.pin} Living now</button>
            <button type="button" class="seg-btn" data-mode="birth">${ICONS.sprout} Birthplaces</button>
            <button type="button" class="seg-btn" data-mode="all">${ICONS.globe} Everything</button>
          </div>
        </div>
        <div class="controls-section"><span class="controls-label" id="mapStatusText"></span></div>
        ${viewSearchBox('Search people or places...')}
      </div>`;
  }
  if (view === 'memories') {
    return `
      <div class="controls-bar">
        <div class="controls-section">
          <div class="controls-label">Show</div>
          <div class="seg" id="memTypeSeg">
            <button type="button" class="seg-btn active" data-type="all">All</button>
            <button type="button" class="seg-btn" data-type="image">${ICONS.image} Photos</button>
            <button type="button" class="seg-btn" data-type="video">${ICONS.video} Videos</button>
            <button type="button" class="seg-btn" data-type="audio">${ICONS.mic} Voice notes</button>
          </div>
        </div>
        <div class="controls-section controls-section-search">
          <select id="memPersonFilter" class="ctrl-select" aria-label="Filter by person"><option value="">Everyone</option></select>
        </div>
        ${viewSearchBox('Search captions or people...')}
      </div>`;
  }

  if (view === 'custom') {
    return `
      <div class="controls-bar">
        <div class="controls-section">
          <div class="controls-label">View</div>

          <button class="btn btn-soft" id="btnExpandToggle" data-expanded="1" title="Collapse or expand every branch">${ICONS.minus} Collapse all</button>

          <button class="btn btn-soft" id="btnCustomCenter">${ICONS.center} Fit screen</button>
          <button class="btn btn-soft" id="btnCustomFullscreen">${ICONS.maximize} Fullscreen</button>
          <button class="btn btn-soft" id="btnRelationshipFinder">${ICONS.link} Find relation</button>
        </div>
        <div class="controls-section controls-section-search">
          <div class="search-input-wrap">
            <input id="customSearchInput" type="search" class="ctrl-search"
              placeholder="Search name, nickname..." autocomplete="off">
            <div id="searchSuggestions" class="search-suggestions" hidden></div>
          </div>
        </div>
      </div>
    `;
  }

  if (view === 'd3') {
    return `
      <div class="controls-bar">
        <div class="controls-section">
          <div class="controls-label">View</div>

          <label class="toggle-wrapper">
            <input id="expandSwitch" class="toggle-checkbox" type="checkbox">
            <span class="toggle-label toggle-label-left">Collapse</span>
            <span class="toggle-label toggle-label-right">Expand</span>
            <span class="toggle-container">
              <span class="toggle-button"></span>
            </span>
          </label>

          <button class="btn btn-soft" id="btnRelationshipFinder">${ICONS.link} Find relation</button>
        </div>
      </div>
    `;
  }

  return `
    <div class="controls-bar">
      <div class="controls-section">
        <div class="controls-label">View</div>

        <label class="toggle-wrapper">
          <input id="expandSwitch" class="toggle-checkbox" type="checkbox">
          <span class="toggle-label toggle-label-left">Collapse</span>
          <span class="toggle-label toggle-label-right">Expand</span>
          <span class="toggle-container">
            <span class="toggle-button"></span>
          </span>
        </label>

        <button class="btn btn-soft" id="btnRelationshipFinder">${ICONS.link} Find relation</button>
      </div>
    </div>
  `;
}

/**
 * Member detail panel
 */
/** The family's emblem as markup (built-in SVG in its colour, or the uploaded image), or '' when none. */
function ftEmblemMarkup(size) {
  const e = (typeof window !== 'undefined' && window.FT_SETTINGS && window.FT_SETTINGS.emblem) || null;
  if (!e || e.kind === 'none') return '';
  if (e.kind === 'upload' && e.url) return `<img class="ft-emblem" src="${e.url}" width="${size}" height="${size}" alt="Family emblem">`;
  if (e.kind === 'builtin' && typeof window.ftEmblemSvg === 'function') return window.ftEmblemSvg(e.id, e.color, size);
  return '';
}

/** The tree's cover picture for member cards (Tree Settings > Cover picture), or '' for the default tint. */
function ftCoverUrl() {
  const c = (typeof window !== 'undefined' && window.FT_SETTINGS && window.FT_SETTINGS.cover) || '';
  return /^\/admin\/uploads\/covers\/[A-Za-z0-9-]+\.(jpg|png|webp)(\?v=\d+)?$/.test(c) ? c : '';
}

function generateMemberPanel() {
  return `
    <aside id="memberDetailPanel" class="member-panel member-panel-hidden">
      <div class="member-panel-header">
        <div class="mp-cover${ftCoverUrl() ? ' has-img' : ''}" id="mpCover"${ftCoverUrl() ? ` style="background-image:url('${ftCoverUrl()}')"` : ''} aria-hidden="true">
          <div class="mp-emblem">${ftEmblemMarkup(30)}</div>
        </div>
        <div class="mp-id">
          <div class="mp-avatar" id="mpAvatar"></div>
          <div class="member-panel-actions no-export">
          <button type="button" class="member-panel-edit" id="mpEditBtn" style="display:none;" title="Edit member details">${ICONS.edit} Edit</button>
          <div class="export-menu">
            <button type="button" class="member-panel-export" id="mpExportBtn" title="Save this card as PNG or PDF">${ICONS.copy} Export</button>
            <div class="export-menu-list" id="mpExportMenu">
              <button type="button" data-format="png">PNG</button>
              <button type="button" data-format="pdf">PDF</button>
            </div>
          </div>
          <button type="button" class="member-panel-close" id="mpCloseBtn" aria-label="Close panel">${ICONS.close}</button>
          </div>
        </div>
        <div class="member-panel-title" id="mpName">Select a person</div>
      </div>

      <nav class="mp-views no-export" id="mpViews" aria-label="See this person in another view"></nav>

      <div class="member-panel-body">
        <div class="member-panel-row">
          <span class="mp-label">Nickname</span>
          <span class="mp-value" id="mpNickname">—</span>
        </div>
        <div class="member-panel-row">
          <span class="mp-label">Born</span>
          <span class="mp-value" id="mpDob">—</span>
        </div>
        <div class="member-panel-row">
          <span class="mp-label">Birthplace</span>
          <span class="mp-value" id="mpPob">—</span>
        </div>
        <div class="member-panel-row">
          <span class="mp-label">Died</span>
          <span class="mp-value" id="mpDod">—</span>
        </div>
        <div class="member-panel-row">
          <span class="mp-label">Place of death</span>
          <span class="mp-value" id="mpDeathPlace">—</span>
        </div>
        <div class="member-panel-row">
          <span class="mp-label">Age & timeline</span>
          <span class="mp-value" id="mpStatus">—</span>
        </div>
        <div class="member-panel-row section-break">
          <span class="mp-label">Father</span>
          <span class="mp-value" id="mpFather">—</span>
        </div>
        <div class="member-panel-row">
          <span class="mp-label">Mother</span>
          <span class="mp-value" id="mpMother">—</span>
        </div>
        <div class="member-panel-row">
          <span class="mp-label">Spouses</span>
          <span class="mp-value" id="mpSpouses">—</span>
        </div>
        <div class="member-panel-row">
          <span class="mp-label">Children</span>
          <span class="mp-value" id="mpChildren">—</span>
        </div>
        <div class="member-panel-row">
          <span class="mp-label">Siblings</span>
          <span class="mp-value" id="mpSiblings">—</span>
        </div>
        <div class="member-panel-row section-break">
          <span class="mp-label">About</span>
          <span class="mp-value" id="mpWiki">—</span>
        </div>
        <div class="member-panel-row section-break">
          <span class="mp-label">Gender</span>
          <span class="mp-value" id="mpGender">—</span>
        </div>
        <div class="member-panel-row">
          <span class="mp-label">Anniversary</span>
          <span class="mp-value" id="mpAnniversary">—</span>
        </div>
        <div class="member-panel-row">
          <span class="mp-label">Lives in</span>
          <span class="mp-value" id="mpLocation">—</span>
        </div>
        <div class="member-panel-row">
          <span class="mp-label">Contacts</span>
          <span class="mp-value" id="mpContacts">—</span>
        </div>

        <div class="mp-actions-row no-export">
          <button type="button" class="btn btn-ghost btn-sm" id="mpFindRelBtn" title="Find how this person is related to someone else">${ICONS.link} Find relation</button>
          <button type="button" class="btn btn-ghost btn-sm" id="mpCopyLinkBtn" title="Copy a direct link to this person">${ICONS.copy} Copy link</button>
          ${(typeof window !== 'undefined' && window.FT_CAN_EDIT) ? `<a class="btn btn-ghost btn-sm" id="mpHistoryLink" href="/admin/#tidy" title="Every change to this person, with Undo">History</a>` : ''}
        </div>

        <div class="member-panel-gallery-row">
          <div class="mp-label">Gallery</div>
          <div class="mp-gallery" id="mpGallery"></div>
        </div>
      </div>
    </aside>
  `;
}

/**
 * Create Relationship Finder modal via JS
 */
function ensureRelationshipModalExists() {
  if (document.getElementById('relationshipModal')) return;

  const modalHtml = `
  <div id="relationshipModal" class="modal" style="display: none;">
    <div class="modal-overlay"></div>
    <div class="modal-content" style="max-width: 600px;">
      <div class="modal-header">
        <h3>Find Relationship</h3>
        <button class="modal-close" onclick="closeRelationshipFinder()" aria-label="Close">${ICONS.close}</button>
      </div>
      
      <div class="modal-body">
        <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 20px;">
          Discover how two family members are connected
        </p>
        
        <div class="person-selector-wrapper">
          <label>First Person</label>
          <input 
            type="text" 
            id="relationPerson1Input" 
            class="person-search-input" 
            placeholder="Search by name..."
            autocomplete="off"
          />
          <div id="relationPerson1Suggestions" class="person-suggestions"></div>
          <input type="hidden" id="relationPerson1" />
        </div>
        
        <div style="text-align: center; margin: 16px 0;">
          <button type="button" class="btn btn-ghost btn-sm" onclick="swapRelationPersons()"
                  title="Swap the two people">${ICONS.swap} Swap</button>
        </div>
        
        <div class="person-selector-wrapper">
          <label>Second Person</label>
          <input 
            type="text" 
            id="relationPerson2Input" 
            class="person-search-input" 
            placeholder="Search by name..."
            autocomplete="off"
          />
          <div id="relationPerson2Suggestions" class="person-suggestions"></div>
          <input type="hidden" id="relationPerson2" />
        </div>
        
        <button class="btn btn-primary" onclick="findRelationship()" style="width: 100%; margin-top: 16px;">
          ${ICONS.search} Find Connection
        </button>
        
        <div id="relationshipResult" style="margin-top: 24px;"></div>
      </div>
    </div>
  </div>
`;

  const wrapper = document.createElement('div');
  wrapper.innerHTML = modalHtml;
  document.body.appendChild(wrapper.firstElementChild);
}

/**
 * Relationship Finder open/close
 */
// The finder is its own page now: /tree/{slug}/relation?a=ID (the modal below is unused)
function openRelationshipFinder(prefillId) {
  const now = new URLSearchParams(location.search), q = new URLSearchParams();
  ['look', 'theme', 'accent'].forEach(k => { if (now.get(k)) q.set(k, now.get(k)); });   // an embed keeps its look
  const id = parseInt(prefillId, 10);
  if (id) q.set('a', id);
  location.href = (window.FT_EMBED ? '/embed/' : '/tree/') + encodeURIComponent(window.FT_TREE_SLUG || '') + '/relation' + (q.toString() ? '?' + q : '');
}

function openRelationshipFinderModal(prefillId) {
  ensureRelationshipModalExists();

  const modal = document.getElementById('relationshipModal');
  if (!modal) {
    console.warn('relationshipModal element not found');
    return;
  }

  const customView = window.customTreeView;
  const d3View = window.d3TreeView;
  const allMembers = customView?.familyData || d3View?.familyData || [];

  if (!allMembers.length) {
    alert('No family data loaded');
    return;
  }

  // NEW: Setup search instead of populate dropdowns
  setupPersonSearch('relationPerson1', allMembers);
  setupPersonSearch('relationPerson2', allMembers);

  // Prefill person 1 (e.g. launched from a member panel)
  if (prefillId) {
    const p = allMembers.find(m => m.id === Number(prefillId));
    if (p) {
      const hid = document.getElementById('relationPerson1');
      const inp = document.getElementById('relationPerson1Input');
      if (hid) hid.value = p.id;
      if (inp) inp.value = p.name;
      // Put the cursor where the user actually needs to type
      setTimeout(() => document.getElementById('relationPerson2Input')?.focus(), 80);
    }
  }

  const resultDiv = document.getElementById('relationshipResult');
  if (resultDiv) resultDiv.innerHTML = '';

  modal.style.display = 'flex';
}

/**
 * Swap the two selected people in the relationship finder
 */
function swapRelationPersons() {
  const h1 = document.getElementById('relationPerson1');
  const h2 = document.getElementById('relationPerson2');
  const i1 = document.getElementById('relationPerson1Input');
  const i2 = document.getElementById('relationPerson2Input');
  if (!h1 || !h2 || !i1 || !i2) return;
  [h1.value, h2.value] = [h2.value, h1.value];
  [i1.value, i2.value] = [i2.value, i1.value];
}

function closeRelationshipFinder() {
  const modal = document.getElementById('relationshipModal');
  if (modal) modal.style.display = 'none';
}

/**
 * Setup search functionality for person selectors
 */
function setupPersonSearch(fieldPrefix, members) {
  const inputEl = document.getElementById(fieldPrefix + 'Input');
  const suggestionsEl = document.getElementById(fieldPrefix + 'Suggestions');
  const hiddenEl = document.getElementById(fieldPrefix);
  
  if (!inputEl || !suggestionsEl || !hiddenEl) return;

  const sorted = [...members]
    .filter(m => m.name && m.name !== 'name')
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  inputEl.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase().trim();
    
    if (query.length < 1) {
      suggestionsEl.classList.remove('show');
      hiddenEl.value = '';
      return;
    }

    const matches = sorted.filter(m => {
      const name = (m.name || '').toLowerCase();
      const nickname = (m.nickname || '').toLowerCase();
      return name.includes(query) || nickname.includes(query);
    }).slice(0, 10);

    if (matches.length === 0) {
      suggestionsEl.innerHTML = '<div class="person-suggestion-empty">No matches found</div>';
      suggestionsEl.classList.add('show');
      hiddenEl.value = '';
      return;
    }

    suggestionsEl.innerHTML = matches.map(m => {
      const nickname = m.nickname ? ` (${m.nickname})` : '';
      const status = m.is_alive ? '' : ' †';
      const avatar = m.img || '';
      
      return `
        <div class="person-suggestion-item" data-id="${m.id}">
          ${avatar ? 
            `<img src="${avatar}" class="person-suggestion-avatar" alt="">` :
            `<div class="person-suggestion-avatar" style="display:flex;align-items:center;justify-content:center;font-size:16px;">
              ${m.name.charAt(0).toUpperCase()}
            </div>`
          }
          <div class="person-suggestion-info">
            <div class="person-suggestion-name">${m.name}${nickname}${status}</div>
            <div class="person-suggestion-meta">
              ${m.birth_date ? `Born ${m.birth_date}` : 'Date unknown'}
            </div>
          </div>
        </div>
      `;
    }).join('');

    suggestionsEl.classList.add('show');

    // Add click handlers
    suggestionsEl.querySelectorAll('.person-suggestion-item').forEach(item => {
      item.addEventListener('click', () => {
        const id = item.dataset.id;
        const person = sorted.find(m => m.id == id);
        if (person) {
          const nickname = person.nickname ? ` (${person.nickname})` : '';
          inputEl.value = person.name + nickname;
          hiddenEl.value = person.id;
          suggestionsEl.classList.remove('show');
        }
      });
    });
  });

  // Close suggestions when clicking outside
  document.addEventListener('click', (e) => {
    if (!inputEl.contains(e.target) && !suggestionsEl.contains(e.target)) {
      suggestionsEl.classList.remove('show');
    }
  });
}

if (typeof window !== 'undefined') {
  window.openRelationshipFinder = openRelationshipFinder;
  window.swapRelationPersons = swapRelationPersons;
  window.closeRelationshipFinder = closeRelationshipFinder;
}

/**
 * Relationship calculation UI
 */
function findRelationship() {
  const person1Id = parseInt(document.getElementById('relationPerson1').value);
  const person2Id = parseInt(document.getElementById('relationPerson2').value);
  const resultDiv = document.getElementById('relationshipResult');

  if (!person1Id || !person2Id) {
    alert('Please select both people');
    return;
  }

  if (person1Id === person2Id) {
    resultDiv.innerHTML = `
      <div class="relationship-no-path">
        Please select two different people
      </div>
    `;
    return;
  }

  // works on every view: tree, timeline, map, memories
  const allMembers = (typeof ftFamily === 'function' ? ftFamily() : null) || window.customTreeView?.familyData || window.d3TreeView?.familyData || [];

  resultDiv.innerHTML = '<div class="search-loading">Calculating relationship...</div>';

  setTimeout(() => {
    const calculator = new RelationshipCalculator(allMembers);
    const relationship = calculator.calculateRelationship(person1Id, person2Id);

    if (!relationship) {
      resultDiv.innerHTML = `
        <div class="relationship-no-path">
          <div style="margin-bottom: 12px; color: var(--gold); display: flex; justify-content: center;">${ICONS.search}</div>
          <div style="font-weight: 600; margin-bottom: 8px;">No Relationship Found</div>
          <div>These two people may be from different family branches or the connection data is incomplete.</div>
        </div>
      `;
      return;
    }

    renderEnhancedRelationship(relationship, allMembers);
    // the Indian word for it: Mama, Bua, Tau, Bhabhi...
    const hi = window.ftIndianTerm ? window.ftIndianTerm(person1Id, person2Id, allMembers) : null;
    const box = resultDiv.querySelector('.relationship-summary');
    if (hi && box) {
      const b = allMembers.find(m => m.id === person2Id), a = allMembers.find(m => m.id === person1Id);
      const esc = s => String(s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
      box.insertAdjacentHTML('beforeend', `<p class="rel-indian"><span class="rel-indian-l">In Hindi</span> <span class="rel-indian-word">${esc(hi.roman)} <span lang="hi">${esc(hi.hindi)}</span></span> <small>· ${esc(hi.english)}</small></p>`);
    }
  }, 300);
}

/**
 * Enhanced relationship rendering with type-specific UI
 */
function renderEnhancedRelationship(rel) {
  const resultDiv = document.getElementById('relationshipResult');
  
  let html = `
    <div class="relationship-path">
      <div class="relationship-summary" data-type="${rel.type}">
        <div class="relationship-summary-title" style="font-size: 24px; margin-bottom: 8px;">
          ${rel.description}
        </div>
        <div class="relationship-summary-desc" style="font-size: 14px;">
          ${rel.details}
        </div>
        <div class="relationship-type-badge" data-type="${rel.type}">
          <span>${rel.type.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>
        </div>
  `;
  
  // Generation badge for grandparent/grandchild
  if (rel.type === 'grandparent' || rel.type === 'grandchild') {
    const generations = rel.description.split('-').filter(s => s === 'Great').length + 2;   // a grandchild is two generations down
    html += `
      <div class="generation-badge">
        ${ICONS.dna} ${generations} Generation${generations > 1 ? 's' : ''} ${rel.type === 'grandparent' ? 'Up' : 'Down'}
      </div>
    `;
  }
  
  // Cousin degree indicator
  if (rel.type === 'cousin') {
    const degree = rel.description.match(/First|Second|Third|Fourth|\d+th/)?.[0] || '';
    const removed = rel.description.includes('Removed') ? 
      (rel.description.match(/(Once|Twice|\d+ Times) Removed/)?.[1] || '') : '';
    
    html += `
      <div class="cousin-degree-indicator">
        <strong>${degree} Cousin</strong>
        ${removed ? `<span style="color: var(--text-muted);">${removed} Removed</span>` : ''}
      </div>
    `;
  }
  
//   Age difference calculation
  if (rel.path && rel.path.length >= 2) {
    const person1 = rel.path[0];
    const person2 = rel.path[rel.path.length - 1];
    const ageDiff = calculateAgeDifference(person1.birth_date, person2.birth_date);
    
    if (ageDiff) {
      html += `
        <div class="age-difference-box">
          ${ageDiff}
        </div>
      `;
    }
  }
  
  html += `</div>`; // close relationship-summary
  
  // Common ancestor hint for cousins
  if (rel.type === 'cousin' && rel.path && rel.path.length > 2) {
    const middleIndex = Math.floor(rel.path.length / 2);
    const ancestor = rel.path[middleIndex];
    html += `
      <div class="common-ancestor-box">
        <strong>Common Ancestor:</strong> ${ancestor.name}
        ${ancestor.nickname ? ` (${ancestor.nickname})` : ''}
      </div>
    `;
  }
  
  // Path visualization
  if (rel.path && rel.path.length > 1) {
    html += `<div style="margin-top: 20px;"><strong style="font-size: 14px; color: var(--text-main);">Connection Path:</strong></div>`;
    
    for (let i = 0; i < rel.path.length; i++) {
      const person = rel.path[i];
      const avatar = person.img || '';
      const nickname = person.nickname ? ` (${person.nickname})` : '';
      const isSpouseLink = rel.type === 'in-law' && i === 1;
      
      let stepDescription = '';
      if (i === 0) stepDescription = `${ICONS.pin} Starting person`;
      else if (i === rel.path.length - 1) stepDescription = `${ICONS.center} Target person`;
      else if (isSpouseLink) stepDescription = `${ICONS.heart} Through marriage`;
      else stepDescription = `${ICONS.link} Through`;
      
      html += `
        <div class="relationship-step" ${isSpouseLink ? 'data-role="spouse-link"' : ''}>
          ${avatar ? 
            `<img src="${avatar}" class="relationship-step-avatar" alt="">` :
            `<div class="relationship-step-avatar" style="display:flex;align-items:center;justify-content:center;font-size:20px;">
              ${person.name.charAt(0).toUpperCase()}
            </div>`
          }
          <div class="relationship-step-info">
            <div class="relationship-step-name">${person.name}${nickname}</div>
            <div class="relationship-step-relation" style="color: var(--text-muted);">${stepDescription}</div>
          </div>
          ${i < rel.path.length - 1 ? `<div class="relationship-step-arrow">${ICONS.arrowDown}</div>` : ''}
        </div>
      `;
    }
  }
  
  html += `</div>`;
  resultDiv.innerHTML = html;
}

/**
 * Calculate age difference between two dates
 */
function calculateAgeDifference(date1, date2) {
  if (!date1 || !date2 || date1 === '0000-00-00' || date2 === '0000-00-00') {
    return null;
  }
  
  try {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    
    if (isNaN(d1.getTime()) || isNaN(d2.getTime())) {
      return null;
    }
    
    let older = d1;
    let younger = d2;
    let olderLabel = 'Person 1';
    let youngerLabel = 'Person 2';
    
    if (d2 < d1) {
      older = d2;
      younger = d1;
      olderLabel = 'Person 2';
      youngerLabel = 'Person 1';
    }
    
    // Calculate difference
    let years = younger.getFullYear() - older.getFullYear();
    let months = younger.getMonth() - older.getMonth();
    let days = younger.getDate() - older.getDate();
    
    if (days < 0) {
      months--;
      const prevMonth = new Date(younger.getFullYear(), younger.getMonth(), 0);
      days += prevMonth.getDate();
    }
    
    if (months < 0) {
      years--;
      months += 12;
    }
    
    const parts = [];
    if (years > 0) parts.push(`${years} year${years !== 1 ? 's' : ''}`);
    if (months > 0) parts.push(`${months} month${months !== 1 ? 's' : ''}`);
    if (days > 0) parts.push(`${days} day${days !== 1 ? 's' : ''}`);
    
    if (parts.length === 0) {
      return 'Born on the same day!';
    }
    
    return `<strong>Age Difference:</strong> ${parts.join(', ')} ${youngerLabel === 'Person 1' ? 'younger' : 'older'}`;
  } catch (e) {
    console.error('Error calculating age difference:', e);
    return null;
  }
}

/**
 * Nav highlight
 */
function highlightActiveNav() {
  const path = window.location.pathname;
  document.querySelectorAll('.nav-link').forEach(link => {
    const page = link.dataset.page;
    if ((page === 'custom' && (path.includes('/custom') || path.includes('/tree/'))) ||
        (page === 'd3' && path.includes('/d3'))) {
      link.classList.add('active');
    }
  });
}
