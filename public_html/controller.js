// controller.js - Shared controller for the tree views

class FamilyTreeController {
  constructor(viewType) {
    this.viewType = viewType; // 'custom' or 'd3'
    this.rawData = [];
    this.familyData = [];
    this.initialized = false;
    this.currentTheme = 'dark';
  }
  
  /**
   * Initialize the controller
   */
  async init() {
    try {
      await this.loadData();
      this.initializeControls();
      this.initializeTheme();
      this.initialized = true;
      return true;
    } catch (error) {
      console.error('Controller initialization failed:', error);
      this.handleError(error);
      return false;
    }
  }
  
  /**
   * Load data from API
   */
  async loadData() {
    const treeRoot = document.getElementById('tree-root');
    uiUtils.showLoading(treeRoot);
    
    try {
      const response = await fetch(CONFIG.API_ENDPOINT);
      
      if (!response.ok) {
        throw new Error(`API returned ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      this.rawData = Array.isArray(data) ? data : [];
      
      // Sanitize and validate data
      this.familyData = this.rawData
        .map(node => dataUtils.sanitizeNode(node))
        .filter(Boolean);
      
      if (this.familyData.length === 0) {
        throw new Error('No valid family data found');
      }
      return this.familyData;
      
    } catch (error) {
      console.error('Failed to load family data:', error);
      throw error;
    }
  }
  
  /**
   * Update statistics display
   */
updateStats() {
  const prefix = this.viewType === 'd3' ? 'd3' : this.viewType === 'custom' ? 'custom' : '';
  // BUGFIX: element ids are camelCase (customTotalMembers) — the old
  // `${prefix}totalMembers` lookup never matched, so stats always showed 0.
  const totalEl = document.getElementById(prefix ? `${prefix}TotalMembers` : 'totalMembers');
  const genEl = document.getElementById(prefix ? `${prefix}TotalGenerations` : 'totalGenerations');
  let maxGen = null;

  if (totalEl) {
    totalEl.textContent = this.familyData.length;
  }

  if (genEl) {
    maxGen = dataUtils.calculateGenerations(this.familyData);
    genEl.textContent = maxGen;
  }
}

  
  /**
   * Initialize theme handling (only via global header themeToggle)
   */
  initializeTheme() {
    const html = document.documentElement;
    const themeToggle = document.getElementById('themeToggle');
    
    // Get saved theme or use default
    const savedTheme = window.FT_FORCE_THEME || storage.get(CONFIG.STORAGE_KEYS.theme, CONFIG.DEFAULT_THEME);
    this.currentTheme = savedTheme;
    
    // Apply theme
    this.applyTheme(savedTheme);
    
    // Wire global header toggle
    if (themeToggle) {
      themeToggle.addEventListener('click', () => {
        const newTheme = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        this.applyTheme(newTheme);
      });
    }
  }
  
  /**
   * Apply theme to UI and tree
   */
  applyTheme(theme) {
    const html = document.documentElement;
    
    html.setAttribute('data-theme', theme);
    this.currentTheme = theme;
    
    // a theme forced by an embed (?theme=) is for that frame only, never the visitor's own choice
    if (!window.FT_FORCE_THEME) storage.set(CONFIG.STORAGE_KEYS.theme, theme);

    // Notify tree view to update
    this.onThemeChange(theme);
  }
  
  /**
   * Initialize shared controls
   */
  initializeControls() {
    // No export buttons in panel anymore

    // View-specific controls
    if (this.viewType === 'd3') {
      this.initD3Controls();
    }
    // 'custom' view wires its own controls in shell.js after DOMContentLoaded
  }
  
  
  /**
   * Initialize D3-specific controls
   */
  initD3Controls() {
    // Reuse same expandSwitch id for D3
    const expandSwitch = document.getElementById('expandSwitch');
    // Center button intentionally NOT present in D3 panel

    if (expandSwitch) {
      expandSwitch.checked = true; // Default to expanded
      expandSwitch.addEventListener('change', (e) => {
        this.onExpandChange(e.target.checked);
      });
    }
  }
  
  /**
   * Handle errors
   */
  handleError(error) {
    console.error('FamilyTreeController error:', error);
    const treeRoot = document.getElementById('tree-root');
    uiUtils.showError(treeRoot, error.message || CONFIG.MESSAGES.error);
  }
  
  // Override these methods in view-specific implementations
  onThemeChange(theme) {
  }
  
  onExpandChange(isExpanded) {
  }
  
  onOrientationChange(orientation) {
  }
  
  onCenter() {
  }
}
