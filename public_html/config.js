// config.js - Centralized configuration for the family tree app

const CONFIG = {
  // API Configuration
  // Phase 4: if FT_TREE_SLUG is injected by tree.php, route to the correct tenant
  API_ENDPOINT: (typeof window !== 'undefined' && window.FT_TREE_SLUG)
    ? '/api-family.php?tree=' + encodeURIComponent(window.FT_TREE_SLUG)
    : '/api-family.php',
  
  // Default Settings
  DEFAULT_FOCUS_ID: null,   // per-tenant focus comes from the tree itself (largest root)
  DEFAULT_THEME: 'light',   // Heritage design is light-first; saved prefs still win
  
  // Contact Information (per-tenant; kept empty for the portal — the tree
  // owner is shown via tenant data, not hardcoded here)
  CONTACT_PERSON: '',
  CONTACT_EMAIL: '',
  
  // Tree Settings
  TREE_SETTINGS: {
    custom: {
      cardWidth:   164,
      cardHeight:  76,
      coupleGap:   22,
      hGap:        44,
      vGap:        64,
      avatarRadius: 22,
      zoom: { min: 0.08, max: 4 },
      animation: { duration: 600 }
    },

    d3: {
      nodeSize: [60, 180],
      cardWidth: 150,
      cardHeight: 50,
      avatarRadius: 14,
      zoom: {
        min: 0.3,
        max: 3
      },
      animation: {
        duration: 350
      }
    }
  },
  
  // UI Messages
  MESSAGES: {
    loading: 'Loading family tree...',
    error: 'Failed to load family tree. Please refresh the page.',
    noData: 'No family data available.',
    loginAdminOnly: 'Log in to edit this tree. Public view is read-only.',
    readOnly: 'You are viewing this tree as a guest.',
    contactForEdits: 'To suggest corrections or new members, contact the tree owner.',
    quickTip: 'Tap any person to see their details. Pinch or use the +/− buttons to zoom, drag to pan, and use search to jump to anyone.'
  },
  
  // Storage Keys
  STORAGE_KEYS: {
    theme: 'family_tree_theme',
    lastView: 'family_tree_last_view'
  }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CONFIG;
}