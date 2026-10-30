/**
 * assets/tree-themes.js - the looks a family can pick for its tree (Tree Settings > Tree look).
 * Each look has a light and a dark palette. The tree renderer reads ftTreePalette();
 * the page chrome gets the same colours through CSS variables on <html>.
 * Heritage is the default and changes nothing.
 */
(function () {
  const SERIF = 'Georgia, "Times New Roman", serif';
  const T = {
    heritage: { name: 'Heritage', note: 'Warm parchment and candlelight', rx: 12, font: SERIF,
      light: { bg: '#fbf8f2', card: '#fffdf6', stroke: '#ddd2b8', accent: '#a16207', line: '#b5a98e', text: '#332e24', muted: '#8a7f68', couple: '#c26d8c', male: '#f2f4e8', female: '#fbf1ec', hl: '#fdf3d7', avMale: '#dde3c9', avFemale: '#f3d9cf', alive: '#4d7c0f', dead: '#a8a29e' },
      dark:  { bg: '#0d0a07', card: '#262019', stroke: '#4a3f2e', accent: '#d4a643', line: '#6b5f49', text: '#ede5d4', muted: '#a3977f', couple: '#d98ca6', male: '#232a20', female: '#2e2126', hl: '#3a301a', avMale: '#3a4634', avFemale: '#54353f', alive: '#4d7c0f', dead: '#a8a29e' } },
    banyan: { name: 'Banyan', note: 'Leaf greens, like an old tree', rx: 16, font: SERIF, display: "'Playfair Display', Georgia, serif",
      light: { bg: '#f1f5ec', card: '#fbfdf7', stroke: '#c5d5b6', accent: '#3d7a35', line: '#9db38f', text: '#1e2a1b', muted: '#5d6e55', couple: '#b0607a', male: '#eaf2e2', female: '#f6efe8', hl: '#e3f0cf', avMale: '#cfe0bd', avFemale: '#ecd8cc', alive: '#2f7d32', dead: '#9aa596' },
      dark:  { bg: '#09110a', card: '#16211a', stroke: '#2e4532', accent: '#86c46f', line: '#4b664f', text: '#e2eddd', muted: '#9db198', couple: '#d590a8', male: '#18261b', female: '#271f22', hl: '#26391f', avMale: '#2f4a33', avFemale: '#4a3439', alive: '#6cbf4f', dead: '#7d8a7a' } },
    royal: { name: 'Royal', note: 'Midnight blue and gold leaf', rx: 6, font: "'Cinzel', Georgia, serif", display: "'Cinzel', Georgia, serif",
      light: { bg: '#f3f2f9', card: '#ffffff', stroke: '#cbc7e4', accent: '#3f2f94', line: '#a7a2c9', text: '#1b1838', muted: '#5f5a85', couple: '#a8326e', male: '#eef0fb', female: '#f8eef5', hl: '#fbf3d9', avMale: '#d5d8f1', avFemale: '#ecd3e2', alive: '#2e7d4f', dead: '#a29fb5' },
      dark:  { bg: '#080816', card: '#151530', stroke: '#33336b', accent: '#d8b552', line: '#4a4a82', text: '#ecebf8', muted: '#a3a2c7', couple: '#d98cb4', male: '#16183a', female: '#251a33', hl: '#2e2a17', avMale: '#2b2f63', avFemale: '#4a2c4f', alive: '#59b37d', dead: '#7f7d99' } },
    minimal: { name: 'Minimal', note: 'Plain, quiet, modern', rx: 8, font: "'Plus Jakarta Sans', system-ui, sans-serif", display: "'Plus Jakarta Sans', system-ui, sans-serif",
      light: { bg: '#fafafa', card: '#ffffff', stroke: '#e1e1e1', accent: '#18181b', line: '#c8c8c8', text: '#18181b', muted: '#71717a', couple: '#a1a1aa', male: '#ffffff', female: '#ffffff', hl: '#f4f4f5', avMale: '#e4e4e7', avFemale: '#e4e4e7', alive: '#16a34a', dead: '#a1a1aa' },
      dark:  { bg: '#0e0e10', card: '#1a1a1d', stroke: '#323236', accent: '#f4f4f5', line: '#45454a', text: '#f4f4f5', muted: '#a1a1aa', couple: '#71717a', male: '#1a1a1d', female: '#1a1a1d', hl: '#27272a', avMale: '#2e2e33', avFemale: '#2e2e33', alive: '#22c55e', dead: '#6b6b73' } },
    parchment: { name: 'Parchment', note: 'Sepia ink on an old register', rx: 3, font: "'Playfair Display', Georgia, serif", display: "'Playfair Display', Georgia, serif",
      light: { bg: '#ece0c4', card: '#f6ecd6', stroke: '#bfa77a', accent: '#7a4517', line: '#a08758', text: '#38270f', muted: '#6e5a3a', couple: '#8f3b2e', male: '#f1e7cd', female: '#f5e6d3', hl: '#efd9a6', avMale: '#ddcca3', avFemale: '#e6c9ab', alive: '#556b2f', dead: '#9c8b6c' },
      dark:  { bg: '#16100a', card: '#2a2014', stroke: '#5b4528', accent: '#d9a45b', line: '#6e5634', text: '#efe0c2', muted: '#b39c78', couple: '#c9766a', male: '#2a2215', female: '#2f2118', hl: '#3d2d14', avMale: '#4a3b22', avFemale: '#553724', alive: '#8fa85a', dead: '#8c7a5c' } },
    marigold: { name: 'Marigold', note: 'Saffron and maroon, for celebrations', rx: 18, font: "'Playfair Display', Georgia, serif", display: "'Playfair Display', Georgia, serif",
      light: { bg: '#fff6e9', card: '#fffdf8', stroke: '#f0c993', accent: '#c2410c', line: '#e0a96a', text: '#3a1a0c', muted: '#8a5a3c', couple: '#be123c', male: '#fff0d8', female: '#fde6e4', hl: '#ffe1a8', avMale: '#fcd9a4', avFemale: '#f8c6c3', alive: '#15803d', dead: '#b49a86' },
      dark:  { bg: '#140a06', card: '#26140c', stroke: '#5e2f16', accent: '#f59e0b', line: '#7a4421', text: '#fbe9d7', muted: '#c9a184', couple: '#fb7185', male: '#2b190c', female: '#301519', hl: '#3d2608', avMale: '#5a3412', avFemale: '#5e2128', alive: '#4ade80', dead: '#8f7462' } },
  };

  // the look in use: ?look= on an embed or preview, else the family's saved choice
  function current() {
    const q = new URLSearchParams(location.search).get('look');
    const id = q || (window.FT_SETTINGS && window.FT_SETTINGS.theme) || 'heritage';
    return T[id] ? id : 'heritage';
  }
  const isDark = () => document.documentElement.getAttribute('data-theme') !== 'light';

  window.FT_TREE_THEMES = T;
  window.ftTreePalette = function (id) {
    const t = T[id || current()];
    return Object.assign({ isDark: isDark(), rx: t.rx, font: t.font }, isDark() ? t.dark : t.light);
  };

  // page chrome: heritage keeps style.css as it is; other looks override its tokens
  const VARS = ['--bg', '--bg-surface', '--bg-elevated', '--card-bg', '--card-border', '--gold', '--gold-light', '--gold-warm', '--accent', '--rose', '--text-main', '--text-muted', '--border-subtle', '--border-gold', '--font-display'];
  window.ftApplyTreeLook = function () {
    const id = current(), el = document.documentElement, s = el.style;
    el.setAttribute('data-tree-look', id);
    VARS.forEach(v => s.removeProperty(v));
    if (id !== 'heritage') {
      const t = T[id], p = isDark() ? t.dark : t.light, a = p.accent;
      const set = { '--bg': p.bg, '--bg-surface': p.card, '--bg-elevated': p.male, '--card-bg': p.card, '--card-border': p.stroke,
        '--gold': a, '--gold-light': a, '--gold-warm': a, '--accent': a, '--rose': p.couple,
        '--text-main': p.text, '--text-muted': p.muted, '--border-subtle': p.stroke, '--border-gold': p.line };
      if (t.display) set['--font-display'] = t.display;
      for (const k in set) s.setProperty(k, set[k]);
    }
  };
  if (window.FT_SETTINGS) {   // the tree pages; the admin only borrows the palettes
    window.ftApplyTreeLook();
    new MutationObserver(window.ftApplyTreeLook).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  }
})();
