// admin/js/users.js

async function fetchUsers() {
    try {
        const res = await csrfFetch('users-api.php');
        users = await res.json();
        applyUserFilters();
        fillUserMemberDropdown();
    } catch (err) {
        console.error('Failed to fetch users', err);
    }
}

function applyUserFilters() {
    const input = document.getElementById('userSearch');
    const text = input ? input.value.trim().toLowerCase() : '';
    filteredUsers = users.filter(u => {
        if (!text) return true;
        const memberLabel = buildMemberLabel(u.member_name, u.member_nickname, u.member_id);
        const haystack = [
            u.id,
            u.email || '',
            u.display_name || '',
            u.role || '',
            memberLabel || ''
        ].join(' ').toLowerCase();
        return haystack.includes(text);
    });
    renderUsersTable();
}

function renderUsersTable() {
    const tbody = document.querySelector('#usersTable tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    tbody.closest('table').removeAttribute('aria-busy');

    const rows = [...filteredUsers];
    rows.sort((a, b) => {
        const col = userSortState.column;
        let va, vb;
        switch (col) {
            case 'display_name':
                va = (a.display_name || '').toLowerCase();
                vb = (b.display_name || '').toLowerCase();
                break;
            case 'email':
                va = (a.email || '').toLowerCase();
                vb = (b.email || '').toLowerCase();
                break;
            case 'role':
                va = (a.role || '').toLowerCase();
                vb = (b.role || '').toLowerCase();
                break;
            case 'member':
                va = buildMemberLabel(a.member_name, a.member_nickname, a.member_id).toLowerCase();
                vb = buildMemberLabel(b.member_name, b.member_nickname, b.member_id).toLowerCase();
                break;
            case 'last_login_at':
                va = a.last_login_at || '';
                vb = b.last_login_at || '';
                break;
            default:
                va = Number(a.id);
                vb = Number(b.id);
                break;
        }
        if (va < vb) return userSortState.dir === 'asc' ? -1 : 1;
        if (va > vb) return userSortState.dir === 'asc' ? 1 : -1;
        return 0;
    });

    rows.forEach(u => {
        const tr = document.createElement('tr');
        const memberLabel = buildMemberLabel(u.member_name, u.member_nickname, u.member_id);
        tr.innerHTML = `
            <td>${u.id}</td>
            <td>${u.display_name || ''}</td>
            <td>${u.email || ''}</td>
            <td>${u.role || ''}</td>
            <td>${memberLabel || ''}</td>
            <td>${u.last_login_at || ''}</td>
        `;
        tr.onclick = () => editUser(u.id);
        tbody.appendChild(tr);
    });

    const badge = document.getElementById('userCountBadge');
    if (badge) badge.textContent = rows.length;
}

function fillUserMemberDropdown() {
    const sel = document.getElementById('userMemberId');
    if (!sel) return;
    const prev = sel.value;
    sel.innerHTML = '<option value="">None</option>';
    members.forEach(m => {
        const label = buildMemberLabel(m.name, m.nickname, m.id);
        const opt = document.createElement('option');
        opt.value = m.id;
        opt.textContent = label;
        sel.appendChild(opt);
    });
    if (prev) sel.value = prev;
}

function startNewUser() {
    const form = document.getElementById('userForm');
    if (form) form.reset();
    const idEl = document.getElementById('userId');
    if (idEl) idEl.value = '';
    const title = document.getElementById('userFormTitle');
    const sub = document.getElementById('userFormSubtitle');
    if (title) title.textContent = 'Add User';
    if (sub) sub.textContent = '';
    const delBtn = document.getElementById('deleteUserBtn');
    if (delBtn) delBtn.style.display = 'none';
    const help = document.getElementById('userPasswordHelp');
    if (help) {
        help.textContent = 'For new users this is required. For existing users, fill only to change password.';
    }
}

function fillUserForm(u) {
    const map = {
        userId: u.id,
        userDisplayName: u.display_name || '',
        userEmail: u.email || ''
    };
    Object.entries(map).forEach(([id, val]) => {
        const el = document.getElementById(id);
        if (el) el.value = val;
    });

    const roleSel = document.getElementById('userRole');
    if (roleSel) roleSel.value = u.role || 'viewer';

    const memberSel = document.getElementById('userMemberId');
    if (memberSel) memberSel.value = u.member_id || '';

    const perms = u.permissions || {};
    const permEdit = document.getElementById('permEditMembers');
    const permStats = document.getElementById('permViewStats');
    const permMedia = document.getElementById('permManageMedia');
    if (permEdit) permEdit.checked = !!perms.can_edit_members;
    if (permStats) permStats.checked = !!perms.can_view_stats;
    if (permMedia) permMedia.checked = !!perms.can_manage_media;

    const pwd = document.getElementById('userPassword');
    if (pwd) pwd.value = '';

    const title = document.getElementById('userFormTitle');
    const sub = document.getElementById('userFormSubtitle');
    if (title) title.textContent = 'Edit User';
    if (sub) sub.textContent = 'ID: ' + u.id;

    const delBtn = document.getElementById('deleteUserBtn');
    if (delBtn) delBtn.style.display = 'inline-flex';

    const help = document.getElementById('userPasswordHelp');
    if (help) {
        help.textContent = 'Leave blank to keep current password. Fill to set a new password.';
    }
}

async function editUser(id) {
    try {
        const res = await csrfFetch('users-api.php?id=' + encodeURIComponent(id));
        const u = await res.json();
        if (u.error) {
            alert('User not found');
            return;
        }
        fillUserForm(u);
    } catch (err) {
        console.error('Edit user error', err);
        alert('Failed to load user');
    }
}

async function saveUser(e) {
    e.preventDefault();

    const id = document.getElementById('userId')?.value || '';
    const displayName = (document.getElementById('userDisplayName')?.value || '').trim();
    const email = (document.getElementById('userEmail')?.value || '').trim();
    const role = document.getElementById('userRole')?.value || 'viewer';
    const memberId = document.getElementById('userMemberId')?.value || null;
    const password = document.getElementById('userPassword')?.value || '';

    if (!displayName || !email) {
        alert('Display name and email are required');
        return;
    }
    if (!id && !password) {
        alert('Password is required for new users');
        return;
    }

    const permissions = {
        can_edit_members: document.getElementById('permEditMembers')?.checked || false,
        can_view_stats: document.getElementById('permViewStats')?.checked || false,
        can_manage_media: document.getElementById('permManageMedia')?.checked || false
    };

    const payload = {
        display_name: displayName,
        email,
        role,
        member_id: memberId ? Number(memberId) : null,
        permissions
    };
    if (password) payload.password = password;

    const method = id ? 'PUT' : 'POST';
    const url = id ? 'users-api.php?id=' + encodeURIComponent(id) : 'users-api.php';

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
        await fetchUsers();
        if (!id) startNewUser();
        else editUser(id);
        alert(id ? 'User updated successfully!' : 'User created successfully!');
    } catch (err) {
        console.error('Save user error', err);
        alert('Save failed');
    }
}

async function deleteUser() {
    const id = document.getElementById('userId')?.value || '';
    if (!id) return;
    if (!confirm('Delete this user? This cannot be undone.')) return;

    try {
        const res = await csrfFetch('users-api.php?id=' + encodeURIComponent(id), {
            method: 'DELETE'
        });
        if (!res.ok && res.status !== 204) {
            const data = await res.json().catch(() => ({}));
            if (data.error) alert('Delete failed: ' + data.error);
            return;
        }
        await fetchUsers();
        startNewUser();
        alert('User deleted successfully.');
    } catch (err) {
        console.error('Delete user error', err);
        alert('Delete failed');
    }
}

/* Listeners */
document.getElementById('userSearch')?.addEventListener('input', applyUserFilters);

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('#usersTable thead th').forEach(th => {
        th.addEventListener('click', () => {
            const col = th.getAttribute('data-ucol');
            if (!col) return;
            if (userSortState.column === col) {
                userSortState.dir = userSortState.dir === 'asc' ? 'desc' : 'asc';
            } else {
                userSortState.column = col;
                userSortState.dir = 'asc';
            }
            renderUsersTable();
        });
    });
});
