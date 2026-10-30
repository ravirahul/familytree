/**
 * admin/js/datahome.js - the "Where your family's data lives" card on Tree Settings.
 * Talks to datahome-api.php. Secrets are never echoed back; blank means "keep".
 */
const DH_KINDS = {
    here:     { label: 'FamilyTree’s database', note: 'Nothing to set up. Your data lives with this site.' },
    mysql:    { label: 'My own MySQL / MariaDB', note: 'Any host you control, including free tiers (Aiven, PlanetScale, your hosting plan).' },
    pgsql:    { label: 'My own Postgres', note: 'Neon, Supabase and others have free tiers.' },
    sqlite:   { label: 'A SQLite file on this server', note: 'One file inside the storage folder. Good for a self-hosted single family.' },
    sheets:   { label: 'A Google Sheet', note: 'Free. Two tabs, Members and Media, that your family can also open and edit by hand.' },
    airtable: { label: 'An Airtable base', note: 'Free up to 1,000 records per base.' },
    json:     { label: 'A JSON file', note: 'One readable file. On the desktop app it can sit in a Drive, Dropbox or OneDrive folder.' },
};
let _dh = { kind: 'here', config: {} };

function dhField(label, name, type, value, hint, extra) {
    return `<label class="dh-field"><span>${label}</span><input type="${type}" name="${name}" value="${value == null ? '' : String(value).replace(/"/g, '&quot;')}" ${extra || ''}>${hint ? `<small>${hint}</small>` : ''}</label>`;
}
function dhForm(kind, c) {
    c = c || {};
    const secret = (v) => v === '••••••' ? '' : (v || '');
    const keep = _dh.kind === kind ? 'leave blank to keep the saved one' : '';
    switch (kind) {
        case 'mysql': case 'pgsql': return `
            <div class="dh-grid">${dhField('Host', 'host', 'text', c.host || '', '')}${dhField('Port', 'port', 'number', c.port || (kind === 'pgsql' ? 5432 : 3306), '')}</div>
            ${dhField('Database name', 'name', 'text', c.name || '', '')}
            <div class="dh-grid">${dhField('User', 'user', 'text', c.user || '', '')}${dhField('Password', 'pass', 'password', '', keep)}</div>
            <label class="dh-check"><input type="checkbox" name="ssl" ${c.ssl ? 'checked' : ''}> Connect over TLS (most managed hosts)</label>
            <p class="dh-hint">Your database user needs CREATE TABLE once (press <b>Set up</b>), then SELECT, INSERT, UPDATE, DELETE.</p>`;
        case 'sqlite': return dhField('File', 'file', 'text', c.file || '', 'Inside the storage folder; leave blank for a default name');
        case 'json':   return dhField('File', 'file', 'text', c.file || '', 'Inside the storage folder; leave blank for a default name');
        case 'sheets': return `
            ${dhField('Sheet link or ID', 'sheet_id', 'text', c.sheet_id || '', 'Paste the URL of a blank Google Sheet')}
            <label class="dh-field"><span>Service account key (JSON)</span><textarea name="service_account" rows="4" placeholder='{"type":"service_account", ... }'></textarea><small>${keep || 'From Google Cloud: a project, Sheets API on, a service account, a JSON key. Share the sheet with its client_email as Editor.'}</small></label>`;
        case 'airtable': return `
            ${dhField('Base ID', 'base_id', 'text', c.base_id || '', 'Starts with app, from the base URL')}
            ${dhField('Personal access token', 'token', 'password', '', keep || 'Scopes: data.records:read, data.records:write, schema.bases:read, schema.bases:write')}`;
        default: return '';
    }
}
function dhRead() {
    const kind = document.querySelector('input[name=dh_kind]:checked')?.value || 'here';
    const cfg = { type: kind };
    document.querySelectorAll('#dhForm [name]').forEach(el => {
        if (el.type === 'checkbox') cfg[el.name] = el.checked;
        else if (el.value !== '') cfg[el.name] = el.value;
    });
    return cfg;
}
function dhMsg(text, ok) {
    const el = document.getElementById('dhMsg');
    el.textContent = text; el.className = 'dh-msg ' + (ok === true ? 'ok' : ok === false ? 'bad' : '');
}
function dhRender() {
    const kinds = Object.keys(DH_KINDS);
    const sel = document.getElementById('dhKinds');
    sel.innerHTML = kinds.map(k => `
        <label class="dh-kind ${k === _dh.kind ? 'current' : ''}">
            <input type="radio" name="dh_kind" value="${k}" ${k === (_dh.pick || _dh.kind) ? 'checked' : ''} onchange="dhPick('${k}')">
            <b>${DH_KINDS[k].label}</b><small>${DH_KINDS[k].note}</small>${k === _dh.kind ? '<em>current</em>' : ''}
        </label>`).join('');
    dhPick(_dh.pick || _dh.kind, true);
}
function dhPick(kind, silent) {
    _dh.pick = kind;
    document.getElementById('dhForm').innerHTML = dhForm(kind, kind === _dh.kind ? _dh.config : {});
    const same = kind === _dh.kind;
    document.getElementById('dhActions').style.display = kind === 'here' && same ? 'none' : '';
    document.getElementById('dhSetupBtn').style.display = kind === 'here' ? 'none' : '';
    document.getElementById('dhTestBtn').style.display = kind === 'here' ? 'none' : '';
    document.getElementById('dhSaveBtn').textContent = kind === 'here' ? 'Move back to FamilyTree’s database' : (same ? 'Save changes' : 'Switch to this');
    document.getElementById('dhCopyWrap').style.display = same ? 'none' : '';
    if (!silent) dhMsg('', null);
}
async function loadDataHome() {
    try {
        const r = await csrfFetch('datahome-api.php');
        const d = await r.json();
        const st = document.getElementById('dhStatus');
        st.removeAttribute('aria-busy'); st.textContent = '';
        if (d.error) { dhMsg(d.error, false); return; }
        _dh = { kind: d.kind, config: d.config || {}, pick: null };
        st.innerHTML = `Now: <b>${DH_KINDS[d.kind]?.label || d.kind}</b> · ${d.counts ? `${d.counts.members} members, ${d.counts.media} photos` : ''}`
                     + (d.status === 'error' ? ` <span class="bad">· not reachable: ${d.message}</span>` : '')
                     + (!d.has_app_key && d.kind !== 'here' ? ' <span class="bad">· set APP_KEY in .env so saved passwords are encrypted</span>' : '');
        dhRender();
    } catch (e) { dhMsg('Could not load: ' + e.message, false); }
}
async function dhCall(action, extra) {
    const body = Object.assign({ action, config: dhRead() }, extra || {});
    const r = await csrfFetch('datahome-api.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return r.json();
}
async function dhTest() {
    dhMsg('Testing…', null);
    const d = await dhCall('test');
    if (d.error) return dhMsg(d.error, false);
    if (d.ok) dhMsg(`Connected. It holds ${d.counts.members} members and ${d.counts.media} photos.`, true);
    else dhMsg(d.message + (d.needs_setup ? ' — press Set up to create the tables.' : ''), false);
}
async function dhSetup() {
    dhMsg('Setting up…', null);
    const d = await dhCall('setup');
    if (d.error) return dhMsg(d.error, false);
    dhMsg(`Ready. It holds ${d.counts.members} members and ${d.counts.media} photos.`, true);
}
async function dhSave() {
    const kind = _dh.pick || _dh.kind;
    const copy = document.getElementById('dhCopy').checked;
    if (kind !== _dh.kind && !confirm(copy
        ? 'Copy everything to the new home and switch? The old copy stays where it is.'
        : 'Switch without copying? The tree will show whatever the new home already holds.')) return;
    dhMsg('Saving…', null);
    const d = kind === 'here' ? await dhCall('reset', { copy }) : await dhCall('save', { copy });
    if (d.error) return dhMsg(d.error, false);
    dhMsg(`Done. The tree now reads from ${DH_KINDS[d.kind].label} (${d.counts.members} members, ${d.counts.media} photos).`, true);
    loadDataHome();
}
