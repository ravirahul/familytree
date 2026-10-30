/**
 * admin/js/settings.js
 * Phase 3: Privacy & Visibility Settings Tab
 */

const FIELD_LABELS = {
    birth_date:       'Date of Birth',
    birth_location:   'Birth Location',
    death_date:       'Death Date',
    death_location:   'Death Location',
    current_location: 'Current Location',
    social_media:     'Social Media (Instagram / Facebook)',
    photos:           'Photos',
    bio:              'Biography / Wiki',
    anniversary_date: 'Marriage Anniversary',
};

// Fields auto-protected for living people (shown with a lock badge)
const LIVING_PROTECTED = ['birth_date', 'birth_location', 'current_location', 'social_media'];

let _privacySettings = {}; // loaded state

/**
 * Load settings from the API and populate the UI.
 */
async function loadPrivacySettings() {
    try {
        const res  = await fetch('settings-api.php', { credentials: 'same-origin' });
        const data = await res.json();

        // 1. Tree visibility
        const vis = data.visibility || 'private';
        const radios = document.querySelectorAll('input[name="visibility"]');
        radios.forEach(r => { r.checked = (r.value === vis); });

        // 2. Per-field table
        _privacySettings = data.field_settings || {};
        renderFieldPrivacyTable(_privacySettings);

    } catch (err) {
        console.error('loadPrivacySettings:', err);
    }
}

/**
 * Build the per-field privacy table rows.
 */
function renderFieldPrivacyTable(settings) {
    const tbody = document.getElementById('fieldPrivacyBody');
    if (!tbody) return;

    tbody.innerHTML = '';
    tbody.closest('table').removeAttribute('aria-busy');

    Object.entries(FIELD_LABELS).forEach(([key, label]) => {
        const current  = settings[key] || 'members';
        const isLiving = LIVING_PROTECTED.includes(key);
        const lockBadge = isLiving
            ? '<span title="Auto-protected for living members" style="display:inline-flex;align-items:center;gap:3px;margin-left:5px;font-size:11px;color:var(--brass-ink);background:var(--brass-soft);border:1px solid color-mix(in srgb,var(--brass) 28%,transparent);border-radius:4px;padding:1px 5px;vertical-align:middle;"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>living</span>'
            : '';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${label}${lockBadge}</td>
            ${['public','members','private'].map(vis => `
            <td>
                <input type="radio"
                       name="fp_${key}"
                       value="${vis}"
                       ${current === vis ? 'checked' : ''}
                       onchange="_privacySettings['${key}'] = this.value">
            </td>`).join('')}
        `;
        tbody.appendChild(tr);
    });
}

/**
 * Save settings to the API.
 */
async function savePrivacySettings() {
    const btn = document.getElementById('saveSettingsBtn');
    const msg = document.getElementById('settingsSaveMsg');
    if (!btn) return;

    // Collect visibility
    const visRadio = document.querySelector('input[name="visibility"]:checked');
    const visibility = visRadio ? visRadio.value : 'private';

    // Collect per-field settings from DOM (in case user changed without triggering onchange)
    const fieldSettings = {};
    Object.keys(FIELD_LABELS).forEach(key => {
        const checked = document.querySelector(`input[name="fp_${key}"]:checked`);
        if (checked) fieldSettings[key] = checked.value;
    });

    const csrfMeta = document.querySelector('meta[name="csrf-token"]');
    const csrf     = csrfMeta ? csrfMeta.content : '';

    btn.disabled    = true;
    btn.textContent = 'Saving…';
    if (msg) msg.style.display = 'none';

    try {
        const res = await fetch('settings-api.php', {
            method:  'POST',
            headers: {
                'Content-Type':  'application/json',
                'X-CSRF-Token':  csrf,
            },
            credentials: 'same-origin',
            body: JSON.stringify({ visibility, field_settings: fieldSettings }),
        });
        const data = await res.json();
        if (data.ok) {
            if (msg) { msg.style.display = 'inline'; setTimeout(() => { msg.style.display = 'none'; }, 3000); }
        } else {
            alert('Save failed: ' + (data.error || 'Unknown error'));
        }
    } catch (err) {
        alert('Network error saving settings.');
        console.error(err);
    } finally {
        btn.disabled    = false;
        btn.textContent = 'Save Settings';
    }
}
