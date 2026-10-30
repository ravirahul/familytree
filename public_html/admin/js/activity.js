/* admin/js/activity.js — Activity log page */

var _activityOffset = 0;
var _activityLimit  = 50;
var _activityTotal  = 0;
var _activityRows   = [];

function loadActivity(reset) {
    if (reset) _activityOffset = 0;

    var action = (document.getElementById('activityFilter') || {}).value || '';
    var q      = (document.getElementById('activitySearch') || {}).value || '';

    var url = 'activity-api.php?limit=' + _activityLimit + '&offset=' + _activityOffset;
    if (action) url += '&action=' + encodeURIComponent(action);
    if (q)      url += '&q='      + encodeURIComponent(q);

    var list = document.getElementById('activityList');
    if (list && _activityOffset === 0) {
        list.innerHTML = skHtml('rows', 6);
    }

    csrfFetch(url)
        .then(function(r) { return r.json(); })
        .then(function(data) {
            _activityRows  = data.rows  || [];
            _activityTotal = data.total || 0;
            renderActivityList(_activityRows);
            renderActivityPager();
        })
        .catch(function(e) {
            console.error('Activity load error:', e);
            if (list) list.innerHTML = '<div class="alert alert-error">Failed to load activity log.</div>';
        });
}

function filterActivity() {
    loadActivity(true);
}

function renderActivityList(rows) {
    var list = document.getElementById('activityList');
    if (!list) return;

    if (!rows.length) {
        list.innerHTML = '<div class="empty-state"><div class="empty-emoji"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg></div><h3>No activity found</h3><p>Actions will appear here as you use the admin panel.</p></div>';
        return;
    }

    var html = '<div class="activity-list">';
    rows.forEach(function(item) {
        // Use buildActivityItem from dashboard.js (shared)
        if (typeof buildActivityItem === 'function') {
            html += buildActivityItem(item);
        } else {
            html += '<div class="activity-item"><div class="activity-text"><div class="activity-title">' +
                escHtml(item.action) + '</div><div class="activity-meta">' + escHtml(item.created_at) + '</div></div></div>';
        }
    });
    html += '</div>';
    list.innerHTML = html;
}

function renderActivityPager() {
    var pager = document.getElementById('activityPager');
    if (!pager) return;

    var totalPages = Math.ceil(_activityTotal / _activityLimit);
    var curPage    = Math.floor(_activityOffset / _activityLimit) + 1;

    if (totalPages <= 1) { pager.innerHTML = ''; return; }

    var html = '<span class="text-muted text-sm" style="margin-right:auto;">' +
        'Showing ' + (_activityOffset + 1) + '–' + Math.min(_activityOffset + _activityLimit, _activityTotal) +
        ' of ' + _activityTotal + '</span>';

    html += '<button class="btn btn-ghost btn-sm" ' + (curPage <= 1 ? 'disabled' : '') +
        ' onclick="_activityOffset -= _activityLimit; loadActivity();">← Prev</button>';
    html += '<button class="btn btn-ghost btn-sm" ' + (curPage >= totalPages ? 'disabled' : '') +
        ' onclick="_activityOffset += _activityLimit; loadActivity();">Next →</button>';

    pager.innerHTML = html;
}

// escHtml is defined in dashboard.js, but define a fallback here too
if (typeof escHtml === 'undefined') {
    function escHtml(s) {
        if (!s) return '';
        return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }
}
