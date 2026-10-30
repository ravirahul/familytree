/**
 * admin/js/import.js - the Members page's Import dialog (import-api.php).
 * Choose a file, see what it holds, then add it alongside or replace the tree.
 */
function openImport() {
  const d = document.getElementById('importDialog');
  document.getElementById('impFile').value = '';
  document.getElementById('impDropText').textContent = 'Choose a .ged, .json or .zip file (up to 20 MB)';
  document.getElementById('impPreview').hidden = true;
  document.getElementById('impModes').hidden = true;
  document.getElementById('impGo').disabled = true;
  impMsg('', null);
  d.showModal();
}
function impMsg(t, ok) {
  const el = document.getElementById('impMsg');
  el.textContent = t; el.className = 'imp-msg ' + (ok === true ? 'ok' : ok === false ? 'bad' : '');
}
async function impSend(mode) {
  const file = document.getElementById('impFile').files[0];
  const fd = new FormData();
  fd.append('file', file); fd.append('mode', mode);
  const r = await csrfFetch('import-api.php', { method: 'POST', body: fd });
  const d = await r.json().catch(() => ({ error: 'The server sent an unexpected answer.' }));
  if (!r.ok || d.error) throw new Error(d.error || 'Import failed');
  return d;
}
const impEsc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
async function importPreview() {
  const file = document.getElementById('impFile').files[0];
  if (!file) return;
  document.getElementById('impDropText').textContent = file.name;
  document.getElementById('impGo').disabled = true;
  impMsg('Reading the file…', null);
  try {
    const d = await impSend('preview');
    const s = d.stats;
    const box = document.getElementById('impPreview');
    box.innerHTML = `<dl>
        <div><dt>People</dt><dd>${s.people.toLocaleString()}</dd></div>
        <div><dt>Exact births</dt><dd>${s.exact_births.toLocaleString()}</dd></div>
        <div><dt>Places</dt><dd>${s.places.toLocaleString()}</dd></div></dl>
      <div>${impEsc(d.format)}${s.families != null ? ` · ${s.families.toLocaleString()} families` : ''}${s.photos ? ` · ${s.photos} online photo${s.photos === 1 ? '' : 's'}` : ''}${s.approximate_dates ? ` · ${s.approximate_dates} approximate dates kept in biographies` : ''}</div>
      <div style="margin-top:4px;color:var(--text-secondary)">${d.sample.map(impEsc).join(', ')}${s.people > d.sample.length ? ', …' : ''}</div>
      ${s.warnings && s.warnings.length ? '<ul>' + s.warnings.map(w => `<li>${impEsc(w)}</li>`).join('') + '</ul>' : ''}`;
    box.hidden = false;
    document.getElementById('impModes').hidden = false;
    if (d.existing === 0) document.querySelector('input[name=impMode][value=add]').checked = true;
    document.getElementById('impGo').disabled = false;
    impMsg(d.existing ? `This tree has ${d.existing} people now.` : 'This tree is empty, so the file becomes the tree.', null);
  } catch (e) { impMsg(e.message, false); }
}
async function importRun() {
  const mode = document.querySelector('input[name=impMode]:checked').value;
  if (mode === 'replace' && !confirm('Replace everyone in this tree with the file? This cannot be undone. Export a backup first if unsure.')) return;
  const go = document.getElementById('impGo');
  go.disabled = true; go.textContent = 'Importing…';
  try {
    const d = await impSend(mode);
    impMsg(`Done: ${d.imported.toLocaleString()} people imported. The tree now has ${d.total.toLocaleString()}.`, true);
    if (typeof fetchMembers === 'function') fetchMembers();
    setTimeout(() => document.getElementById('importDialog').close(), 1800);
  } catch (e) { impMsg(e.message, false); go.disabled = false; }
  go.textContent = 'Import';
}
