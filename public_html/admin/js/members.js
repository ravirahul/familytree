// admin/js/members.js

// A big tree's table is drawn TABLE_PAGE rows at a time (thousands of rows made every
// search keystroke and sort take seconds); "Show more" adds the next page.
const TABLE_PAGE = 500;
let tableLimit = TABLE_PAGE;

async function fetchMembers() {
    try {
        const res = await csrfFetch('admin-api.php');
        members = await res.json();
        applyFilters();
        fillDropdowns();
        fillUserMemberDropdown(); // users dropdown depends on members list
    } catch (err) {
        console.error('Failed to fetch members', err);
    }
}

function applyFilters() {
    tableLimit = TABLE_PAGE;
    const text = (document.getElementById('tableSearch')?.value || '').trim().toLowerCase();
    const byId = Object.fromEntries(members.map(m => [m.id, m]));
    filteredMembers = members.filter(m => {
        if (!text) return true;
        const father = m.fid ? byId[m.fid]?.name : '';
        const mother = m.mid ? byId[m.mid]?.name : '';
        const partner = Array.isArray(m.pids)
            ? m.pids.map(pid => byId[pid]?.name || '').join(' ')
            : (m.pids ? (byId[m.pids]?.name || '') : '');
        const haystack = [
            m.id,
            m.name || '',
            m.nickname || '',
            m.gender || '',
            father || '',
            mother || '',
            partner || ''
        ].join(' ').toLowerCase();
        return haystack.includes(text);
    });
    renderTable();
}

function renderTable() {
    const tbody = document.querySelector('#membersTable tbody');
    if (!tbody) return;
    const byId = Object.fromEntries(members.map(m => [m.id, m]));
    const rows = [...filteredMembers];

    rows.sort((a, b) => {
        const col = sortState.column;
        let va, vb;
        switch (col) {
            case 'name':
                va = (a.name || '').toLowerCase();
                vb = (b.name || '').toLowerCase();
                break;
            case 'nickname':
                va = (a.nickname || '').toLowerCase();
                vb = (b.nickname || '').toLowerCase();
                break;
            case 'gender':
                va = (a.gender || '').toLowerCase();
                vb = (b.gender || '').toLowerCase();
                break;
            default:
                va = Number(a.id);
                vb = Number(b.id);
                break;
        }
        if (va < vb) return sortState.dir === 'asc' ? -1 : 1;
        if (va > vb) return sortState.dir === 'asc' ? 1 : -1;
        return 0;
    });

    // one innerHTML for the whole table and one click handler: a row element + listener each was slow at thousands of members
    tbody.closest('table').removeAttribute('aria-busy');
    tbody.innerHTML = rows.slice(0, tableLimit).map(m => {
        const father = m.fid ? (byId[m.fid]?.name || m.fid) : '';
        const mother = m.mid ? (byId[m.mid]?.name || m.mid) : '';
        const partner = Array.isArray(m.pids) && m.pids.length
            ? m.pids.map(pid => byId[pid]?.name || pid).join(', ')
            : (m.pids ? (byId[m.pids]?.name || m.pids) : '');
        const statusBadge = m.is_alive
            ? '<span class="badge alive-badge">Alive</span>'
            : '<span class="badge dead-badge">Deceased</span>';
        const wikiText = m.wiki || '';
        const wikiPreview = wikiText.length > 30 ? wikiText.substring(0, 30) + '...' : wikiText;
        const thumbUrl = m.img || '';
        const thumbHtml = thumbUrl
            ? `<img src="${thumbUrl}" alt="" loading="lazy" style="width:26px;height:26px;border-radius:999px;object-fit:cover;background:var(--bg-stripe);border:1px solid var(--border);">`
            : `<div style="width:26px;height:26px;border-radius:999px;background:var(--bg-stripe);border:1px dashed var(--border-strong);"></div>`;

        return `<tr data-id="${m.id}">
            <td>${m.id}</td>
            <td>${thumbHtml}</td>
            <td>${m.name || ''}</td>
            <td>${m.nickname || ''}</td>
            <td>${m.gender || ''}</td>
            <td>${statusBadge}</td>
            <td>${father || ''}</td>
            <td>${mother || ''}</td>
            <td>${partner || ''}</td>
            <td title="${(wikiText || '').replace(/"/g, '&quot;')}">${wikiPreview}</td>
        </tr>`;
    }).join('') + (rows.length > tableLimit
        ? `<tr class="table-more"><td colspan="10" style="text-align:center;"><button type="button" class="btn btn-ghost" data-more>Show ${Math.min(TABLE_PAGE, rows.length - tableLimit)} more · ${rows.length - tableLimit} not shown</button></td></tr>`
        : '');
    tbody.onclick = (e) => {
        if (e.target.closest('[data-more]')) { tableLimit += TABLE_PAGE; renderTable(); return; }
        const tr = e.target.closest('tr[data-id]'); if (tr) editMember(tr.dataset.id);
    };

    const badge = document.getElementById('countBadge');
    if (badge) badge.textContent = rows.length;
}

function getPartnerOptionsHtml(excludeId = null) {
    let html = '<option value="">None</option>';
    members.forEach(m => {
        if (excludeId && String(m.id) === String(excludeId)) return;
        const baseName = m.name || '';
        const nickPart = m.nickname ? ` (${m.nickname})` : '';
        const label = `${baseName}${nickPart} [${m.id}]`;
        html += `<option value="${m.id}">${label}</option>`;
    });
    return html;
}

function addSpouseSelect(selectedId = '') {
    const container = document.getElementById('spousesContainer');
    if (!container) return;
    const currentMemberId = document.getElementById('memberId')?.value || '';
    const row = document.createElement('div');
    row.className = 'spouse-select-row';
    row.style.cssText = 'display:flex;gap:6px;align-items:center;';

    const sel = document.createElement('select');
    sel.className = 'partner-select';
    sel.style.flex = '1'; sel.style.minWidth = '0';
    sel.innerHTML = getPartnerOptionsHtml(currentMemberId);
    if (selectedId) sel.value = String(selectedId);

    const remBtn = document.createElement('button');
    remBtn.type = 'button';
    remBtn.className = 'btn btn-ghost';
    remBtn.style.cssText = 'flex:none;padding:4px 8px;font-size:12px;color:var(--red);border-color:color-mix(in srgb,var(--red) 30%,transparent);';
    remBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
    remBtn.title = 'Remove spouse';
    remBtn.onclick = () => {
        row.remove();
        if (container.children.length === 0) {
            addSpouseSelect();
        }
    };

    row.appendChild(sel);
    row.appendChild(remBtn);
    container.appendChild(row);

    const married = document.getElementById('ismarried')?.checked;
    sel.disabled = !married;
    remBtn.disabled = !married;
}

function renderSpouses(pids = []) {
    const container = document.getElementById('spousesContainer');
    if (!container) return;
    container.innerHTML = '';
    const arr = Array.isArray(pids) ? pids.filter(Boolean) : (pids ? [pids] : []);
    if (arr.length === 0) {
        addSpouseSelect('');
    } else {
        arr.forEach(id => addSpouseSelect(id));
    }
}

function fillDropdowns() {
    const fatherSel = document.getElementById('fid');
    const motherSel = document.getElementById('mid');
    if (!fatherSel || !motherSel) return;

    // the father/mother lists only change when the member list does: skip rebuilding them on every row click
    if (fillDropdowns._for !== members || fillDropdowns._n !== members.length) {
        fillDropdowns._for = members; fillDropdowns._n = members.length;
        const esc = v => String(v ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
        // build each list as one string: `innerHTML +=` per option re-parsed the whole list every time (O(n²))
        let fathers = '<option value="">None</option>', mothers = fathers;
        members.forEach(m => {
            const label = `${esc(m.name)}${m.nickname ? ` (${esc(m.nickname)})` : ''} [${m.id}]`;
            const opt = `<option value="${m.id}">${label}</option>`;
            if (m.gender === 'male') fathers += opt;
            if (m.gender === 'female') mothers += opt;
        });
        fatherSel.innerHTML = fathers;
        motherSel.innerHTML = mothers;
    }

    // Refresh options of existing partner dropdowns
    const currentMemberId = document.getElementById('memberId')?.value || '';
    const opts = getPartnerOptionsHtml(currentMemberId);
    document.querySelectorAll('.partner-select').forEach(sel => {
        const val = sel.value;
        sel.innerHTML = opts;
        sel.value = val;
    });
}

function toggleDeathFields() {
    const aliveInput = document.getElementById('isalive');
    const deathFields = document.getElementById('deathfields');
    if (!aliveInput || !deathFields) return;
    const isAlive = aliveInput.checked;
    if (isAlive) {
        deathFields.style.display = 'none';
        const d1 = document.getElementById('COL14');
        const d2 = document.getElementById('COL15');
        if (d1) d1.value = '';
        if (d2) d2.value = '';
    } else {
        deathFields.style.display = 'grid';
    }
}

function toggleMarriageUI() {
    const marriedInput = document.getElementById('ismarried');
    const row = document.getElementById('marriageRow');
    if (!marriedInput || !row) return;
    const married = marriedInput.checked;
    row.style.opacity = married ? '1' : '0.4';
    row.querySelectorAll('select,input,button').forEach(el => {
        el.disabled = !married;
    });
    if (!married) {
        renderSpouses([]);
        const anniv = document.getElementById('COL13');
        if (anniv) anniv.value = '';
    }
}

function setFormHeader(m) {
    const avatar = document.getElementById('memberAvatar');
    const titleEl = document.getElementById('formTitle');
    const subEl = document.getElementById('formSubtitle');
    if (!avatar || !titleEl || !subEl) return;

    // Quick-add bar: visible only while editing an existing member
    window._quickAddBase = (m && m.id) ? m : null;
    const qBar = document.getElementById('quickAddBar');
    const qName = document.getElementById('quickAddName');
    if (qBar) qBar.style.display = (m && m.id) ? 'flex' : 'none';
    if (qName && m) qName.textContent = m.name || ('#' + m.id);

    if (!m || !m.id) {
        avatar.style.display = 'none';
        titleEl.innerHTML = 'Add <span style="font-weight:600;">Member</span>';
        subEl.textContent = '';
        return;
    }

    const fullName = m.name || '';
    const nickPart = m.nickname ? ` (${m.nickname})` : '';
    const displayName = `${fullName}${nickPart}`.trim();

    titleEl.innerHTML =
        `<span style="font-size:12px;font-weight:400;color:var(--text-muted);">Edit</span> ` +
        `<span style="font-weight:600;">${displayName || 'member'}</span>`;

    subEl.textContent = 'ID: ' + m.id;

    if (m.img) {
        avatar.src = m.img;
        avatar.style.display = 'inline-block';
    } else {
        avatar.style.display = 'none';
    }
}

function startNew() {
    const form = document.getElementById('memberForm');
    if (form) form.reset();
    const idEl = document.getElementById('memberId');
    if (idEl) idEl.value = '';
    const alive = document.getElementById('isalive');
    if (alive) alive.checked = true;
    const married = document.getElementById('ismarried');
    if (married) married.checked = false;
    const delBtn = document.getElementById('deleteBtn');
    if (delBtn) delBtn.style.display = 'none';

    ['wiki','COL10','COL11','COL12','COL13','COL14','COL15'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });

    fillDropdowns();
    renderSpouses([]);
    toggleDeathFields();
    toggleMarriageUI();
    updateWikiCharCount();
    setFormHeader(null);
}

/**
 * Quick-add: start a new member pre-linked to the member being edited.
 * kind = 'spouse' | 'child'
 */
function startNewRelated(kind) {
    const base = window._quickAddBase;
    if (!base || !base.id) return;

    startNew();

    const baseGender = (base.gender || '').toLowerCase();
    const spouseId = Array.isArray(base.pids) && base.pids[0] ? String(base.pids[0]) : '';

    if (kind === 'spouse') {
        const married = document.getElementById('ismarried');
        if (married) married.checked = true;
        toggleMarriageUI();
        renderSpouses([String(base.id)]);
        const genderSel = document.getElementById('gender');
        if (genderSel && baseGender) {
            genderSel.value = baseGender === 'male' ? 'female' : 'male';
        }
    } else if (kind === 'child') {
        const fidSel = document.getElementById('fid');
        const midSel = document.getElementById('mid');
        if (baseGender === 'female') {
            if (midSel) midSel.value = String(base.id);
            if (fidSel && spouseId) fidSel.value = spouseId;
        } else {
            if (fidSel) fidSel.value = String(base.id);
            if (midSel && spouseId) midSel.value = spouseId;
        }
    }

    const subEl = document.getElementById('formSubtitle');
    if (subEl) subEl.textContent = 'New ' + kind + ' of ' + (base.name || ('#' + base.id));
    document.getElementById('name')?.focus();
}

function fillForm(m) {
    const map = {
        memberId: m.id,
        name: m.name || '',
        nickname: m.nickname || '',
        birthdate: m.birth_date || m.birthdate || '',
        birthlocation: m.birth_location || m.birthlocation || '',
        gender: m.gender || '',
        img: m.img || '',
        fid: m.fid || '',
        mid: m.mid || '',
        COL13: m.anniversarydate || m.anniversary_date || '',
        COL10: m.currentlocation || m.current_location || '',
        COL11: m.instaurl || m.insta_url || '',
        COL12: m.fburl || m.fb_url || '',
        COL14: m.deathdate || m.death_date || '',
        COL15: m.deathlocation || m.death_location || '',
        wiki: m.wiki || ''
    };
    Object.entries(map).forEach(([id, val]) => {
        const el = document.getElementById(id);
        if (el) el.value = val;
    });

    const aliveInput = document.getElementById('isalive');
    if (aliveInput) aliveInput.checked = m.is_alive == 1 || m.isalive == 1 || m.is_alive === true;

    const hasSpouse = Array.isArray(m.pids) && m.pids.length > 0;
    const marriedInput = document.getElementById('ismarried');
    if (marriedInput) marriedInput.checked = hasSpouse;
    renderSpouses(hasSpouse ? m.pids : []);

    const delBtn = document.getElementById('deleteBtn');
    if (delBtn) delBtn.style.display = 'inline-flex';

    toggleDeathFields();
    toggleMarriageUI();
    updateWikiCharCount();
    setFormHeader(m);
}

function editMember(id) {
    const m = members.find(x => x.id == id);
    if (!m) return;
    fillDropdowns();
    fillForm(m);
}

async function saveMember(e) {
    e.preventDefault();

    const id = document.getElementById('memberId')?.value || '';
    const wikiEl = document.getElementById('wiki');
    const wiki = wikiEl ? wikiEl.value.trim() : '';
    if (wiki.length > 750) {
        alert('Wiki biography must be 750 characters or less.');
        return;
    }

    const married = document.getElementById('ismarried')?.checked || false;
    const spouseSelects = Array.from(document.querySelectorAll('.partner-select'));
    const spouseIds = spouseSelects
        .map(s => parseInt(s.value, 10))
        .filter(pid => !isNaN(pid) && pid > 0);
    const uniqueSpouseIds = Array.from(new Set(spouseIds));
    const anniversaryVal = document.getElementById('COL13')?.value || null;

    const payload = {
        name: (document.getElementById('name')?.value || '').trim(),
        nickname: (document.getElementById('nickname')?.value || '').trim() || null,
        birthdate: document.getElementById('birthdate')?.value || null,
        birthlocation: (document.getElementById('birthlocation')?.value || '').trim() || null,
        gender: document.getElementById('gender')?.value || null,
        img: (document.getElementById('img')?.value || '').trim() || null,
        fid: document.getElementById('fid')?.value || null,
        mid: document.getElementById('mid')?.value || null,
        pids: married ? uniqueSpouseIds : [],
        isalive: document.getElementById('isalive')?.checked ? 1 : 0,
        wiki: wiki || null,
        currentlocation: (document.getElementById('COL10')?.value || '').trim() || null,
        instaurl: (document.getElementById('COL11')?.value || '').trim() || null,
        fburl: (document.getElementById('COL12')?.value || '').trim() || null,
        anniversarydate: married ? (anniversaryVal || null) : null,
        deathdate: document.getElementById('COL14')?.value || null,
        deathlocation: (document.getElementById('COL15')?.value || '').trim() || null
    };

    const method = id ? 'PUT' : 'POST';
    const url = id ? 'admin-api.php?id=' + encodeURIComponent(id) : 'admin-api.php';

    try {
        const res = await csrfFetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.error) {
            alert('Save failed: ' + data.error);
            return;
        }
        await fetchMembers();
        if (!id) {
            startNew();
        } else {
            editMember(id);
        }
        alert(id ? 'Member updated successfully!' : 'Member created successfully!');
    } catch (err) {
        console.error('Save error', err);
        alert('Save failed.');
    }
}

async function deleteMember() {
    const id = document.getElementById('memberId')?.value || '';
    if (!id) return;
    if (!confirm('Delete this member? This cannot be undone.')) return;

    try {
        const res = await csrfFetch('admin-api.php?id=' + encodeURIComponent(id), {
            method: 'DELETE'
        });
        if (!res.ok && res.status !== 204) {
            const data = await res.json().catch(() => ({}));
            if (data.error) alert('Delete failed: ' + data.error);
            return;
        }
        await fetchMembers();
        startNew();
        alert('Member deleted successfully.');
    } catch (err) {
        console.error('Delete error', err);
        alert('Delete failed.');
    }
}

/* Export */
function exportJSON() {
    const dataStr = JSON.stringify(members, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'family-data-' + new Date().toISOString().split('T')[0] + '.json';
    a.click();
    URL.revokeObjectURL(url);
}

function exportCSV() {
    const rows = members;
    const headers = [
        'id','name','nickname','gender','birth_date','birth_location',
        'current_location','insta_url','fb_url','anniversary_date',
        'death_date','death_location','fid','mid','pids','is_alive'
    ];
    const csvRows = [];
    csvRows.push(headers.join(','));

    rows.forEach(m => {
        const line = headers.map(h => {
            let val;
            if (h === 'pids') {
                val = Array.isArray(m.pids) ? m.pids.join('|') : (m.pids || '');
            } else {
                val = m[h] ?? '';
            }
            val = String(val).replace(/"/g, '""');
            if (val.includes(',') || val.includes('"') || val.includes('\n')) {
                return `"${val}"`;
            }
            return val;
        }).join(',');
        csvRows.push(line);
    });

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'family-data-' + new Date().toISOString().split('T')[0] + '.csv';
    a.click();
    URL.revokeObjectURL(url);
}

function toggleExportMenu() {
    const menu = document.getElementById('exportMenu');
    if (!menu) return;
    menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
}

document.addEventListener('click', e => {
    const menu = document.getElementById('exportMenu');
    if (!menu) return;
    if (!menu.contains(e.target) && !e.target.closest('.dropdown')) {
        menu.style.display = 'none';
    }
});

function updateWikiCharCount() {
    const wiki = document.getElementById('wiki');
    const countEl = document.getElementById('wikiCharCount');
    if (!wiki || !countEl) return;
    const len = wiki.value.length;
    countEl.textContent = len + '/750';
    countEl.style.color = len > 750 ? 'var(--red)' : 'var(--text-muted)';
}

function clearImageField() {
    const imgInput = document.getElementById('img');
    if (imgInput) imgInput.value = '';
    const fileInput = document.getElementById('imgFile');
    if (fileInput) fileInput.value = '';
    const m = {
        id: document.getElementById('memberId')?.value || null,
        name: (document.getElementById('name')?.value || '').trim(),
        nickname: (document.getElementById('nickname')?.value || '').trim(),
        img: ''
    };
    setFormHeader(m);
}

/* Event listeners */
document.getElementById('tableSearch')?.addEventListener('input', applyFilters);
document.getElementById('isalive')?.addEventListener('change', toggleDeathFields);
document.getElementById('ismarried')?.addEventListener('change', toggleMarriageUI);
document.getElementById('wiki')?.addEventListener('input', updateWikiCharCount);

/* Sorting for members table */
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('#membersTable thead th').forEach(th => {
        th.addEventListener('click', () => {
            const col = th.getAttribute('data-col');
            if (!col || col === 'photo' || col === 'status' || col === 'father' || col === 'mother' || col === 'partner' || col === 'wiki') {
                return;
            }
            if (sortState.column === col) {
                sortState.dir = sortState.dir === 'asc' ? 'desc' : 'asc';
            } else {
                sortState.column = col;
                sortState.dir = 'asc';
            }
            renderTable();
        });
    });
});

/* Ctrl+S to save active page form (members/users) */
document.addEventListener('keydown', function(e) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        // New page system: check active admin-page
        const membersActive = document.getElementById('pageMembers')?.classList.contains('active');
        const usersActive   = document.getElementById('pageUsers')?.classList.contains('active');
        // Legacy fallback
        const membersVisible = membersActive ||
            (document.getElementById('tabMembersContent')?.style.display !== 'none');
        const usersVisible   = usersActive ||
            (document.getElementById('tabUsersContent')?.style.display !== 'none');

        if (membersVisible) {
            const form = document.getElementById('memberForm');
            if (!form) return;
            e.preventDefault();
            if (form.requestSubmit) form.requestSubmit();
            else saveMember(new Event('submit'));
        } else if (usersVisible) {
            const form = document.getElementById('userForm');
            if (!form) return;
            e.preventDefault();
            if (form.requestSubmit) form.requestSubmit();
            else saveUser(new Event('submit'));
        }
    }
});

/* Image upload (no alerts) */
document.getElementById('imgFile')?.addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('image', file);
    try {
        const res = await csrfFetch('upload-image.php', {
            method: 'POST',
            body: formData
        });
        if (res.ok) {
            const data = await res.json();
            if (data.url) {
                const imgInput = document.getElementById('img');
                if (imgInput) imgInput.value = data.url;
                const m = {
                    id: document.getElementById('memberId')?.value || null,
                    name: (document.getElementById('name')?.value || '').trim(),
                    nickname: (document.getElementById('nickname')?.value || '').trim(),
                    img: data.url
                };
                setFormHeader(m);
            }
        }
    } catch (err) {
        console.error('Upload error', err);
    }
});
