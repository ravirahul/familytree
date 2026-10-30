/* admin/js/dashboard.js — Dashboard page logic */

var _dashLoaded = false;

function loadDashboard() {
    if (_dashLoaded) return;
    _dashLoaded = true;
    fetchDashboard();
}

function fetchDashboard() {
    csrfFetch('dashboard-api.php')
        .then(function(r) { return r.json(); })
        .then(function(data) {
            renderDashStats(data.stats || {}, data.limits || {});
            renderDashActivity(data.activity || []);
            renderDashEvents(data.events || []);
            renderDashUsage(data.stats || {});
        })
        .catch(function(e) {
            console.error('Dashboard load error:', e);
        });
}

function renderDashStats(stats, limits) {
    var el = function(id) { return document.getElementById(id); };
    if (el('dashStats')) el('dashStats').removeAttribute('aria-busy');

    if (el('statMembers')) el('statMembers').textContent = stats.members ?? '—';
    if (el('statUsers'))   el('statUsers').textContent   = stats.users   ?? '—';
    if (el('statMedia'))   el('statMedia').textContent   = stats.media   ?? '—';
    if (el('statEvents'))  el('statEvents').textContent  = stats.events  ?? '—';

    if (el('statMembersLimit') && limits.members) {
        var pct = Math.round((stats.members / limits.members) * 100);
        el('statMembersLimit').textContent = stats.members + ' / ' + limits.members + ' (' + pct + '%)';
    }
    if (el('statUsersLimit') && limits.users) {
        el('statUsersLimit').textContent = stats.users + ' / ' + limits.users;
    }
}

function renderDashActivity(items) {
    var el = document.getElementById('dashActivity');
    if (!el) return;

    if (!items.length) {
        el.innerHTML = '<div class="empty-state"><div class="empty-emoji"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg></div><p>No activity recorded yet.</p></div>';
        return;
    }

    var html = '<div class="activity-list">';
    items.slice(0, 8).forEach(function(item) {
        html += buildActivityItem(item);
    });
    html += '</div>';
    el.innerHTML = html;
}

function renderDashEvents(items) {
    var el = document.getElementById('dashEvents');
    if (!el) return;

    if (!items.length) {
        el.innerHTML = '<div class="empty-state"><div class="empty-emoji"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></div><p>No upcoming events in the next 30 days.</p></div>';
        return;
    }

    var html = '<div class="event-list">';
    items.forEach(function(ev) {
        var daysText = ev.days_left === 0 ? 'Today!' : (ev.days_left === 1 ? 'Tomorrow' : 'in ' + ev.days_left + 'd');
        html += '<div class="event-item">' +
            '<div class="event-date-box">' +
                '<span class="event-day">' + ev.day + '</span>' +
                '<span class="event-month">' + escHtml(ev.month) + '</span>' +
            '</div>' +
            '<div class="event-info">' +
                '<div class="event-name">' + escHtml(ev.name) + (ev.nickname ? ' (' + escHtml(ev.nickname) + ')' : '') + '</div>' +
                '<div class="event-type">' + escHtml(ev.type) + '</div>' +
            '</div>' +
            '<div class="event-days-left">' + daysText + '</div>' +
        '</div>';
    });
    html += '</div>';
    el.innerHTML = html;
}

function renderDashUsage(stats) {
    var el = document.getElementById('dashUsage');
    if (!el) return;
    el.innerHTML = [['Members', stats.members || 0], ['Users', stats.users || 0]].map(function(r) {
        return '<div class="usage-row"><div class="usage-meta"><span class="usage-label">' + r[0] + '</span><span class="usage-count">' + r[1] + '</span></div></div>';
    }).join('');
}

/* ── Shared: build activity item HTML ─────────────────────────── */
function buildActivityItem(item) {
    var action = item.action || '';
    var dot = 'default';
    var icon = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>';

    if (action.indexOf('add') !== -1 || action.indexOf('create') !== -1 || action.indexOf('upload') !== -1) {
        dot = 'add'; icon = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';
    } else if (action.indexOf('update') !== -1 || action.indexOf('edit') !== -1) {
        dot = 'edit'; icon = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>';
    } else if (action.indexOf('delete') !== -1 || action.indexOf('remove') !== -1) {
        dot = 'delete'; icon = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"/></svg>';
    } else if (action.indexOf('login') !== -1) {
        dot = 'login'; icon = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>';
    } else if (action.indexOf('media') !== -1 || action.indexOf('photo') !== -1) {
        dot = 'upload'; icon = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>';
    }

    var who   = item.display_name || item.email || 'System';
    var what  = formatAction(action);
    var when  = formatTime(item.created_at);
    var extra = '';
    if (item.changes && item.changes.name) {
        extra = ' <span class="text-muted">— ' + escHtml(item.changes.name) + '</span>';
    }

    return '<div class="activity-item">' +
        '<div class="activity-dot ' + dot + '">' + icon + '</div>' +
        '<div class="activity-text">' +
            '<div class="activity-title"><strong>' + escHtml(who) + '</strong> ' + what + extra + '</div>' +
            '<div class="activity-meta">' + when + '</div>' +
        '</div>' +
    '</div>';
}

function formatAction(action) {
    var map = {
        member_add:    'added a member',
        member_update: 'updated a member',
        member_delete: 'deleted a member',
        user_add:      'added a user',
        user_update:   'updated a user',
        user_delete:   'deleted a user',
        media_upload:  'uploaded media',
        login:         'logged in',
        settings_save: 'saved settings',
    };
    return map[action] || action.replace(/_/g, ' ');
}

function formatTime(ts) {
    if (!ts) return '';
    var d = new Date(ts.replace(' ', 'T') + 'Z');
    if (isNaN(d)) d = new Date(ts);
    var now = new Date();
    var diff = Math.floor((now - d) / 1000);
    if (diff < 60)   return 'Just now';
    if (diff < 3600) return Math.floor(diff/60) + 'm ago';
    if (diff < 86400) return Math.floor(diff/3600) + 'h ago';
    if (diff < 604800) return Math.floor(diff/86400) + 'd ago';
    return d.toLocaleDateString();
}

function escHtml(s) {
    if (!s) return '';
    return String(s)
        .replace(/&/g,'&amp;')
        .replace(/</g,'&lt;')
        .replace(/>/g,'&gt;')
        .replace(/"/g,'&quot;');
}
