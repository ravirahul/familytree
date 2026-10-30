/**
 * common.js — Shared utilities for all admin pages
 *
 * csrfFetch, theme toggle, shared helpers
 */

/* ── CSRF fetch wrapper ─────────────────────────────────────────── */
function getCsrfToken() {
    const meta = document.querySelector('meta[name="csrf-token"]');
    return meta ? meta.content : '';
}

async function csrfFetch(url, options = {}) {
    const method = (options.method || 'GET').toUpperCase();
    const isMultipart = options.body instanceof FormData;

    if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
        options.headers = options.headers || {};
        if (!isMultipart) {
            options.headers['Content-Type'] = options.headers['Content-Type'] || 'application/json';
        }
        options.headers['X-CSRF-Token'] = getCsrfToken();
    }
    return fetch(url, options);
}

/* ── Global state ───────────────────────────────────────────────── */
let members = [];
let filteredMembers = [];
let sortState = { column: 'id', dir: 'asc' };

let users = [];
let filteredUsers = [];
let userSortState = { column: 'id', dir: 'asc' };

/* ── Theme ──────────────────────────────────────────────────────── */
(function initTheme() {
    // Default theme is light; only go dark if explicitly saved
    const saved = localStorage.getItem('familyAdminTheme') || 'light';
    applyTheme(saved);
})();

function toggleTheme() {
    const isDark = document.body.classList.contains('dark');
    applyTheme(isDark ? 'light' : 'dark');
}

function applyTheme(theme) {
    const body = document.body;
    const icon = document.getElementById('themeIcon');

    if (theme === 'dark') {
        body.classList.add('dark');
        document.documentElement.setAttribute('data-theme', 'dark');
        if (icon) {
            // Sun icon — click to switch to light
            icon.innerHTML = '<path fill="currentColor" d="M12 4a1 1 0 0 1-1-1V2a1 1 0 0 1 2 0v1a1 1 0 0 1-1 1zm0 18a1 1 0 0 1-1-1v-1a1 1 0 0 1 2 0v1a1 1 0 0 1-1 1zm8-9a1 1 0 0 1 1-1h1a1 1 0 0 1 0 2h-1a1 1 0 0 1-1-1zm-18 0a1 1 0 0 1 1-1H4a1 1 0 0 1 0 2H3a1 1 0 0 1-1-1zm14.95-6.95a1 1 0 0 1 1.41 0l.71.71a1 1 0 1 1-1.41 1.41l-.71-.71a1 1 0 0 1 0-1.41zM4.34 19.66a1 1 0 0 1 1.41 0l.71.71a1 1 0 0 1-1.41 1.41l-.71-.71a1 1 0 0 1 0-1.41zm0-13.66.71-.71A1 1 0 0 1 6.46 6.7l-.71.71A1 1 0 0 1 4.34 6l.71-.71zM17.66 19.66l.71.71a1 1 0 0 1-1.41 1.41l-.71-.71a1 1 0 0 1 1.41-1.41zM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10z"/>';
        }
    } else {
        body.classList.remove('dark');
        document.documentElement.setAttribute('data-theme', 'light');
        if (icon) {
            // Moon icon — click to switch to dark
            icon.innerHTML = '<path fill="currentColor" d="M21 12.79A9 9 0 0 1 11.21 3 7 7 0 1 0 21 12.79z"/>';
        }
    }
    localStorage.setItem('familyAdminTheme', theme);
}

/* ── Skeleton placeholders while a page fetches ─────────────────
   Put data-sk="rows|lines|grid|cards|table" (and data-n="count") on an empty container.
   The shimmer is .sk in /assets/brand.css; the shapes are in admin.css. Rendering the real
   content replaces the busy wrapper (tables: the renderer drops aria-busy on the <table>). */
function skHtml(kind, n) {
    const one = {
        rows:  '<div class="sk-row"><span class="sk sk-circle"></span><div class="sk-grow"><span class="sk sk-line w60"></span><span class="sk sk-line w40"></span></div></div>',
        lines: '<span class="sk sk-line w80"></span><span class="sk sk-line w60"></span>',
        grid:  '<span class="sk sk-card"></span>',
        cards: '<span class="sk sk-card"></span>'
    }[kind] || '';
    return '<div class="sk-wrap sk-' + kind + '" role="status" aria-busy="true" aria-label="Loading">' + one.repeat(n || 4) + '</div>';
}
function skFill(root) {
    (root || document).querySelectorAll('[data-sk]').forEach(function (el) {
        const n = Number(el.dataset.n) || 4;
        if (el.dataset.sk === 'table') {
            const table = el.closest('table');
            const cols = table ? table.querySelectorAll('thead th').length || 4 : 4;
            if (table) table.setAttribute('aria-busy', 'true');
            el.innerHTML = ('<tr class="sk-tr" aria-hidden="true">' + '<td><span class="sk sk-line"></span></td>'.repeat(cols) + '</tr>').repeat(n);
        } else {
            el.innerHTML = skHtml(el.dataset.sk, n);
        }
    });
}
skFill();

/* ── Password toggle (login page) ───────────────────────────────── */
function togglePwVis(id, btn) {
    const inp = document.getElementById(id);
    if (!inp) return;
    inp.type = inp.type === 'password' ? 'text' : 'password';
}

/* ── Member label helper ────────────────────────────────────────── */
function buildMemberLabel(name, nick, id) {
    if (!name && !nick && !id) return '';
    const base = name || '';
    const np = nick ? ` (${nick})` : '';
    return `${base}${np}${id ? ' [' + id + ']' : ''}`;
}

/* ── Legacy shim: toggleUserMenu (now sidebar handles this) ─────── */
function toggleUserMenu(event) {
    if (event) event.stopPropagation();
    const menu = document.getElementById('userMenu');
    if (menu) menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
}

