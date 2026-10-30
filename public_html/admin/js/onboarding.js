/**
 * onboarding.js — First-run guided setup wizard (Phase 5 Tier 1)
 *
 * Shown automatically when the tree has 0 members.
 * Walks the owner through: You → Parents → Grandparents,
 * then creates all members with correct fid/mid/pids links
 * via the existing admin-api.php endpoints (spouse links are
 * mirrored server-side).
 */

(function () {
    'use strict';

    let SKIP_KEY = 'ft_onboarding_done';

    document.addEventListener('DOMContentLoaded', init);

    async function init() {
        // ADMIN_USER is defined by an inline script after JS includes;
        // by DOMContentLoaded it is available.
        if (typeof ADMIN_USER === 'undefined' || !ADMIN_USER) return;
        // Per user AND per tree — a newly created second tree gets the wizard too
        SKIP_KEY = 'ft_onboarding_done_' + ADMIN_USER.id + '_' + (ADMIN_USER.tenant_id || 'default');
        if (localStorage.getItem(SKIP_KEY)) return;

        // Only trigger on an empty tree
        try {
            const res = await csrfFetch('admin-api.php');
            const rows = await res.json();
            if (!Array.isArray(rows) || rows.length > 0) return;
        } catch (e) {
            return; // fail silently — normal admin still works
        }

        render();
    }

    // ── State ───────────────────────────────────────────────────────────
    let step = 1; // 1 = you, 2 = parents, 3 = grandparents

    const data = {
        self:   { name: '', gender: '', birthdate: '', birthplace: '' },
        father: { name: '' },
        mother: { name: '' },
        pgf: { name: '' }, pgm: { name: '' },   // paternal grandparents
        mgf: { name: '' }, mgm: { name: '' }    // maternal grandparents
    };

    // ── Rendering ───────────────────────────────────────────────────────
    function render() {
        // Prefill the owner's name on first render
        if (!data.self.name && typeof ADMIN_USER !== 'undefined' && ADMIN_USER && ADMIN_USER.display_name) {
            data.self.name = ADMIN_USER.display_name;
        }
        let ov = document.getElementById('obOverlay');
        if (!ov) {
            ov = document.createElement('div');
            ov.id = 'obOverlay';
            ov.className = 'ob-overlay';
            document.body.appendChild(ov);
        }
        ov.innerHTML = `
          <div class="ob-card" role="dialog" aria-modal="true" aria-label="Set up your family tree">
            <div class="ob-head">
              <div class="ob-emoji"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 20h10"/><path d="M12 20v-8"/><path d="M12 12a5 5 0 0 1 5-5h2v2a5 5 0 0 1-5 5h-2z"/><path d="M12 12a5 5 0 0 0-5-5H5v2a5 5 0 0 0 5 5h2z"/></svg></div>
              <h2>Let's plant your family tree</h2>
              <p>Three quick steps — you can add everyone else later.</p>
              <div class="ob-dots">
                ${[1,2,3].map(n => `<span class="ob-dot${n === step ? ' active' : ''}${n < step ? ' done' : ''}">${n < step ? '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>' : n}</span>`).join('<span class="ob-dot-line"></span>')}
              </div>
            </div>
            <div class="ob-body">${stepHtml()}</div>
            <div class="ob-foot">
              ${step > 1 ? '<button type="button" class="btn btn-ghost" id="obBack">← Back</button>' : '<button type="button" class="btn btn-ghost" id="obSkip">Skip setup</button>'}
              <button type="button" class="btn btn-primary" id="obNext">${step === 3 ? 'Create my tree' : 'Continue →'}</button>
            </div>
          </div>`;

        bind();
    }

    function stepHtml() {
        if (step === 1) {
            return `
              <h3 class="ob-step-title">Step 1 · About you</h3>
              <div class="ob-grid">
                <div class="ob-field ob-span2">
                  <label>Your full name <span class="ob-req">*</span></label>
                  <input id="ob_self_name" type="text" value="${esc(data.self.name)}" placeholder="e.g. Ravi Rahul" autocomplete="name">
                </div>
                <div class="ob-field">
                  <label>Gender <span class="ob-req">*</span></label>
                  <select id="ob_self_gender">
                    <option value="">Select…</option>
                    <option value="male"${data.self.gender === 'male' ? ' selected' : ''}>Male</option>
                    <option value="female"${data.self.gender === 'female' ? ' selected' : ''}>Female</option>
                  </select>
                </div>
                <div class="ob-field">
                  <label>Birth date <small>(optional)</small></label>
                  <input id="ob_self_birthdate" type="date" value="${esc(data.self.birthdate)}">
                </div>
                <div class="ob-field ob-span2">
                  <label>Birth place <small>(optional)</small></label>
                  <input id="ob_self_birthplace" type="text" value="${esc(data.self.birthplace)}" placeholder="City, State, Country">
                </div>
              </div>`;
        }
        if (step === 2) {
            return `
              <h3 class="ob-step-title">Step 2 · Your parents</h3>
              <p class="ob-hint">Leave blank to skip — you can always add them later.</p>
              <div class="ob-grid">
                <div class="ob-field">
                  <label>Father's name</label>
                  <input id="ob_father_name" type="text" value="${esc(data.father.name)}" placeholder="Father's full name">
                </div>
                <div class="ob-field">
                  <label>Mother's name</label>
                  <input id="ob_mother_name" type="text" value="${esc(data.mother.name)}" placeholder="Mother's full name">
                </div>
              </div>`;
        }
        // step 3
        const noParents = !data.father.name && !data.mother.name;
        if (noParents) {
            return `
              <h3 class="ob-step-title">Step 3 · Grandparents</h3>
              <p class="ob-hint">Add a parent first to link grandparents — or finish now and grow your tree from the Members page.</p>`;
        }
        return `
          <h3 class="ob-step-title">Step 3 · Your grandparents <small>(optional)</small></h3>
          ${data.father.name ? `
          <div class="ob-group-label">Father's parents</div>
          <div class="ob-grid">
            <div class="ob-field">
              <label>Grandfather</label>
              <input id="ob_pgf_name" type="text" value="${esc(data.pgf.name)}" placeholder="Paternal grandfather">
            </div>
            <div class="ob-field">
              <label>Grandmother</label>
              <input id="ob_pgm_name" type="text" value="${esc(data.pgm.name)}" placeholder="Paternal grandmother">
            </div>
          </div>` : ''}
          ${data.mother.name ? `
          <div class="ob-group-label">Mother's parents</div>
          <div class="ob-grid">
            <div class="ob-field">
              <label>Grandfather</label>
              <input id="ob_mgf_name" type="text" value="${esc(data.mgf.name)}" placeholder="Maternal grandfather">
            </div>
            <div class="ob-field">
              <label>Grandmother</label>
              <input id="ob_mgm_name" type="text" value="${esc(data.mgm.name)}" placeholder="Maternal grandmother">
            </div>
          </div>` : ''}`;
    }

    // ── Events ──────────────────────────────────────────────────────────
    function bind() {
        document.getElementById('obSkip')?.addEventListener('click', () => {
            localStorage.setItem(SKIP_KEY, '1');
            document.getElementById('obOverlay')?.remove();
        });
        document.getElementById('obBack')?.addEventListener('click', () => {
            collect();
            step--;
            render();
        });
        document.getElementById('obNext')?.addEventListener('click', onNext);
        document.getElementById('ob_self_name')?.focus();
    }

    function collect() {
        const val = id => (document.getElementById(id)?.value || '').trim();
        if (step === 1) {
            data.self.name       = val('ob_self_name');
            data.self.gender     = val('ob_self_gender');
            data.self.birthdate  = val('ob_self_birthdate');
            data.self.birthplace = val('ob_self_birthplace');
        } else if (step === 2) {
            data.father.name = val('ob_father_name');
            data.mother.name = val('ob_mother_name');
        } else {
            data.pgf.name = val('ob_pgf_name');
            data.pgm.name = val('ob_pgm_name');
            data.mgf.name = val('ob_mgf_name');
            data.mgm.name = val('ob_mgm_name');
        }
    }

    async function onNext() {
        collect();

        if (step === 1) {
            if (!data.self.name)   { shake('ob_self_name');   return; }
            if (!data.self.gender) { shake('ob_self_gender'); return; }
        }

        if (step < 3) { step++; render(); return; }

        await createAll();
    }

    function shake(id) {
        const el = document.getElementById(id);
        if (!el) return;
        el.classList.add('ob-shake');
        el.focus();
        setTimeout(() => el.classList.remove('ob-shake'), 500);
    }

    // ── Creation ────────────────────────────────────────────────────────
    async function createMember(payload) {
        const res = await csrfFetch('admin-api.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const row = await res.json();
        if (!row || row.error || !row.id) throw new Error(row && row.error ? row.error : 'Create failed');
        return row.id;
    }

    async function createAll() {
        const btn = document.getElementById('obNext');
        if (btn) { btn.disabled = true; btn.textContent = 'Creating your tree…'; }

        try {
            let pgfId = null, pgmId = null, mgfId = null, mgmId = null;
            let fatherId = null, motherId = null;

            // 1. Paternal grandparents (spouse link mirrored server-side)
            if (data.father.name && data.pgf.name) pgfId = await createMember({ name: data.pgf.name, gender: 'male' });
            if (data.father.name && data.pgm.name) pgmId = await createMember({ name: data.pgm.name, gender: 'female', pids: pgfId ? [pgfId] : [] });

            // 2. Maternal grandparents
            if (data.mother.name && data.mgf.name) mgfId = await createMember({ name: data.mgf.name, gender: 'male' });
            if (data.mother.name && data.mgm.name) mgmId = await createMember({ name: data.mgm.name, gender: 'female', pids: mgfId ? [mgfId] : [] });

            // 3. Parents
            if (data.father.name) fatherId = await createMember({ name: data.father.name, gender: 'male',   fid: pgfId, mid: pgmId });
            if (data.mother.name) motherId = await createMember({ name: data.mother.name, gender: 'female', fid: mgfId, mid: mgmId, pids: fatherId ? [fatherId] : [] });

            // 4. You
            await createMember({
                name: data.self.name,
                gender: data.self.gender,
                birthdate: data.self.birthdate || null,
                birthlocation: data.self.birthplace || null,
                fid: fatherId,
                mid: motherId
            });

            localStorage.setItem(SKIP_KEY, '1');
            showDone();
        } catch (err) {
            console.error('Onboarding create failed:', err);
            if (btn) { btn.disabled = false; btn.textContent = 'Create my tree'; }
            if (typeof showToast === 'function') showToast('Something went wrong — please try again.', 'error');
        }
    }

    function showDone() {
        const count = 1
            + (data.father.name ? 1 : 0) + (data.mother.name ? 1 : 0)
            + (data.father.name && data.pgf.name ? 1 : 0) + (data.father.name && data.pgm.name ? 1 : 0)
            + (data.mother.name && data.mgf.name ? 1 : 0) + (data.mother.name && data.mgm.name ? 1 : 0);

        const ov = document.getElementById('obOverlay');
        if (!ov) return;
        ov.innerHTML = `
          <div class="ob-card ob-done">
            <div class="ob-emoji ob-emoji-big"><svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22v-7"/><path d="M12 15a7 7 0 0 0 7-7c0-2-1.5-3.5-3.5-3.5A6 6 0 0 0 4 8c0 3.87 3.58 7 8 7z"/></svg></div>
            <h2>Your tree is alive!</h2>
            <p>${count} family member${count > 1 ? 's' : ''} added. Keep growing it — add siblings,
               children, photos and stories from the Members page.</p>
            <div class="ob-done-actions">
              <button type="button" class="btn btn-primary" id="obGoMembers">+ Add more members</button>
              <button type="button" class="btn btn-ghost" id="obClose">Go to dashboard</button>
            </div>
          </div>`;

        document.getElementById('obGoMembers')?.addEventListener('click', () => {
            ov.remove();
            if (typeof fetchMembers === 'function') fetchMembers();
            if (typeof showPage === 'function') showPage('members');
        });
        document.getElementById('obClose')?.addEventListener('click', () => {
            ov.remove();
            if (typeof loadDashboard === 'function') loadDashboard();
        });
    }

    // ── Utils ───────────────────────────────────────────────────────────
    function esc(s) {
        return String(s || '').replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));
    }
})();
