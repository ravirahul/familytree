/* admin/js/account.js — Profile & password change */

function loadAccount() {
    // Profile fields come from the PHP session; the trees for the delete sections are fetched
    loadDeletePlan();
    csrfFetch('account-api.php?digest=1').then(r => r.json()).then(d => { const c = document.getElementById('digestOn'); if (c) c.checked = !!d.digest; }).catch(() => {});
}
function saveDigest(on) {
    csrfFetch('account-api.php', { method: 'POST', body: JSON.stringify({ action: 'digest', on }) }).then(r => r.json())
        .then(d => { if (typeof showToast === 'function') showToast(d.error || (on ? 'Weekly email on' : 'Weekly email off'), d.error ? 'error' : 'success'); });
}

function saveProfile() {
    var name  = (document.getElementById('accDisplayName') || {}).value || '';
    var email = (document.getElementById('accEmail')       || {}).value || '';

    var alertEl = document.getElementById('accountAlert');
    clearAlert(alertEl);

    if (!name.trim() || !email.trim()) {
        showAlert(alertEl, 'Name and email are required.', 'error');
        return;
    }

    csrfFetch('account-api.php', {
        method: 'POST',
        body: JSON.stringify({ action: 'update_profile', display_name: name, email: email })
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
        if (data.error) {
            showAlert(alertEl, data.error, 'error');
        } else {
            showAlert(alertEl, 'Profile updated successfully.', 'success');
            // Update sidebar name
            var sbName = document.querySelector('.sb-user-name');
            if (sbName) sbName.textContent = data.display_name || name;
            // Update top bar if needed
            if (typeof showToast === 'function') showToast('Profile saved', 'success');
        }
    })
    .catch(function() {
        showAlert(alertEl, 'Failed to save profile. Please try again.', 'error');
    });
}

function changePassword() {
    var current = (document.getElementById('accCurrentPw') || {}).value || '';
    var newPw   = (document.getElementById('accNewPw')     || {}).value || '';
    var confirm = (document.getElementById('accConfirmPw') || {}).value || '';

    var alertEl = document.getElementById('pwAlert');
    clearAlert(alertEl);

    if (!current || !newPw || !confirm) {
        showAlert(alertEl, 'All password fields are required.', 'error');
        return;
    }
    if (newPw.length < 8) {
        showAlert(alertEl, 'New password must be at least 8 characters.', 'error');
        return;
    }
    if (newPw !== confirm) {
        showAlert(alertEl, 'New passwords do not match.', 'error');
        return;
    }

    csrfFetch('account-api.php', {
        method: 'POST',
        body: JSON.stringify({
            action:           'change_password',
            current_password: current,
            new_password:     newPw,
            confirm_password: confirm,
        })
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
        if (data.error) {
            showAlert(alertEl, data.error, 'error');
        } else {
            showAlert(alertEl, 'Password updated successfully.', 'success');
            // Clear fields
            ['accCurrentPw','accNewPw','accConfirmPw'].forEach(function(id) {
                var el = document.getElementById(id);
                if (el) el.value = '';
            });
            if (typeof showToast === 'function') showToast('Password changed', 'success');
        }
    })
    .catch(function() {
        showAlert(alertEl, 'Failed to update password. Please try again.', 'error');
    });
}

function confirmLogoutAll() {
    if (!confirm('This will end all active sessions and log you out. Continue?')) return;
    window.location.href = 'index.php?logout=1';
}

/* ── Alert helpers ─────────────────────────────────────────────── */
function showAlert(el, msg, type) {
    if (!el) return;
    el.className = 'alert alert-' + (type || 'info');
    el.textContent = msg;
    el.style.display = 'flex';
}
function clearAlert(el) {
    if (!el) return;
    el.style.display = 'none';
    el.textContent = '';
}

/* ── Deleting a tree / the account ─────────────────────────────── */
var deletePlan = [];

function accEl(tag, props, kids) {
    var e = document.createElement(tag);
    Object.keys(props || {}).forEach(function(k) { if (k === 'text') e.textContent = props[k]; else e.setAttribute(k, props[k]); });
    (kids || []).forEach(function(c) { e.appendChild(c); });
    return e;
}

function loadDeletePlan() {
    return csrfFetch('account-api.php?delete_plan=1')
        .then(function(r) { return r.json(); })
        .then(function(d) { deletePlan = d.trees || []; })
        .catch(function() {});
}


function startDeleteAccount() {
    loadDeletePlan().then(function() {
        var box = document.getElementById('delTrees');
        box.innerHTML = '';
        var need = deletePlan.filter(function(t) { return t.needs_choice; });
        if (need.length) box.appendChild(accEl('p', { style: 'font-size:13px;margin:0 0 8px;font-weight:600;', text: 'Your trees: choose what happens to each' }));
        need.forEach(function(t) {
            var sel = accEl('select', { class: 'form-control', 'data-tree': t.id, style: 'max-width:340px;', 'aria-label': 'What happens to ' + t.display_name });
            sel.appendChild(accEl('option', { value: '', text: 'Choose…' }));
            if (t.can_delete) sel.appendChild(accEl('option', { value: 'delete', text: 'Delete this tree and everything in it' }));
            t.candidates.forEach(function(c) { sel.appendChild(accEl('option', { value: String(c.id), text: 'Hand it to ' + c.display_name + ' (' + c.role + ')' })); });
            box.appendChild(accEl('div', { class: 'form-group', style: 'margin-bottom:10px;' }, [
                accEl('label', { class: 'form-label', text: t.display_name + '  ·  /tree/' + t.slug }), sel
            ]));
        });
        document.getElementById('delStart').style.display = 'none';
        document.getElementById('delForm').hidden = false;
    });
}

function cancelDeleteAccount() {
    document.getElementById('delForm').hidden = true;
    document.getElementById('delStart').style.display = '';
    clearAlert(document.getElementById('delAlert'));
}

function deleteAccount() {
    var alertEl = document.getElementById('delAlert');
    clearAlert(alertEl);
    var choices = {}, missing = false;
    document.querySelectorAll('#delTrees select[data-tree]').forEach(function(s) {
        if (!s.value) missing = true;
        choices[s.getAttribute('data-tree')] = s.value === 'delete' ? 'delete' : parseInt(s.value, 10);
    });
    if (missing) { showAlert(alertEl, 'Choose what happens to each of your trees.', 'error'); return; }
    if (document.getElementById('delConfirm').value.trim() !== 'DELETE') { showAlert(alertEl, 'Type DELETE to confirm.', 'error'); return; }
    var pw = document.getElementById('delPw').value;
    if (!pw) { showAlert(alertEl, 'Enter your password.', 'error'); return; }
    var go = document.getElementById('delGo');
    go.disabled = true;
    csrfFetch('account-api.php', { method: 'POST', body: JSON.stringify({ action: 'delete_account', confirm: 'DELETE', password: pw, choices: choices }) })
        .then(function(r) { return r.json(); })
        .then(function(d) {
            if (d.error) { go.disabled = false; showAlert(alertEl, d.error, 'error'); return; }
            window.location.href = '/?account_deleted=1';
        })
        .catch(function() { go.disabled = false; showAlert(alertEl, 'Could not delete the account. Please try again.', 'error'); });
}
