/**
 * admin/js/tidy.js - the "Tidy up" page (admin/tidy.php, tidy-api.php):
 * possible duplicates with a side-by-side merge, the bin, and history with Undo.
 */
const tdEsc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const tdWhen = d => d ? new Date(String(d).replace(' ', 'T')).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';
const tdYear = d => d ? String(d).slice(0, 4) : '';
const TD_LABELS = { name: 'Name', nickname: 'Nickname', gender: 'Gender', birth_date: 'Born', birth_location: 'Birthplace', death_date: 'Died', death_location: 'Place of death',
  is_alive: 'Living', current_location: 'Lives in', img: 'Photo', insta_url: 'Instagram', fb_url: 'Facebook', anniversary_date: 'Anniversary', wiki: 'Biography',
  fid: 'Father', mid: 'Mother', pids: 'Partners', extra: 'More details', is_private: 'Private', privacy_override: 'Privacy override' };
let _tdPairs = [];
let _tdFocusMember = null;

function tdDismissed() { try { return JSON.parse(localStorage.getItem('ft_td_not_same') || '[]'); } catch (e) { return []; } }
function tdDismiss(a, b) { const k = [a, b].sort((x, y) => x - y).join('-'); const d = tdDismissed(); d.push(k); try { localStorage.setItem('ft_td_not_same', JSON.stringify(d.slice(-500))); } catch (e) {} }

function tdAvatar(p) {
  return p.img ? `<span class="td-av" style="background-image:url('${tdEsc(p.img)}')"></span>` : `<span class="td-av">${tdEsc((p.name || '?')[0])}</span>`;
}
function tdPerson(p) {
  const life = [p.birth_date ? 'b. ' + tdEsc(p.birth_date) : '', p.death_date ? 'd. ' + tdEsc(p.death_date) : ''].filter(Boolean).join(' · ');
  const parents = [p.father, p.mother].filter(Boolean).map(tdEsc).join(' & ');
  return `<div class="td-person">${tdAvatar(p)}<div style="min-width:0"><b>${tdEsc(p.name)}</b>
    <small>${life || 'no dates'}${p.birth_location ? ' · ' + tdEsc(p.birth_location) : ''}</small>
    <small>${parents ? 'child of ' + parents : 'no parents linked'}${p.pids && p.pids.length ? ' · ' + p.pids.length + ' partner' + (p.pids.length > 1 ? 's' : '') : ''}</small></div></div>`;
}

async function tdLoadDups() {
  const box = document.getElementById('tdDups');
  const d = await csrfFetch('tidy-api.php?what=duplicates').then(r => r.json()).catch(e => ({ error: e.message }));
  if (d.error) { box.innerHTML = `<div class="td-empty">${tdEsc(d.error)}</div>`; return; }
  const gone = new Set(tdDismissed());
  _tdPairs = d.pairs.filter(p => !gone.has([p.a.id, p.b.id].sort((x, y) => x - y).join('-')));
  document.getElementById('tdDupCount').textContent = _tdPairs.length || '';
  box.innerHTML = _tdPairs.length ? _tdPairs.map((p, i) => `
    <article class="td-pair" data-i="${i}">
      <div class="td-pair-top">${tdPerson(p.a)}<div class="td-vs"><b>${p.score}%</b>alike</div>${tdPerson(p.b)}</div>
      <div class="td-why">${p.why.map(w => `<span>${tdEsc(w)}</span>`).join('')}</div>
      <div class="td-actions">
        <button type="button" class="btn btn-primary btn-sm" onclick="tdCompare(${i})">Compare and merge</button>
        <button type="button" class="btn btn-ghost btn-sm" onclick="tdNotSame(${i})">Not the same person</button>
      </div>
      <div class="td-compare" hidden></div>
    </article>`).join('')
    : `<div class="td-empty">No likely duplicates among ${d.people} people. If you know two entries are the same person, open one in the tree and check the other's details.</div>`;
}
function tdNotSame(i) { const p = _tdPairs[i]; tdDismiss(p.a.id, p.b.id); tdLoadDups(); }

function tdCompare(i) {
  const p = _tdPairs[i], el = document.querySelector(`.td-pair[data-i="${i}"] .td-compare`);
  if (!el.hidden) { el.hidden = true; return; }
  // keep the one with more links by default
  const links = x => (x.fid ? 1 : 0) + (x.mid ? 1 : 0) + (x.pids || []).length;
  const keepA = links(p.a) >= links(p.b);
  const show = (f, v) => f === 'img' ? (v ? `<img src="${tdEsc(v)}" alt="" style="width:40px;height:40px;border-radius:50%;object-fit:cover">` : '') : f === 'is_alive' ? (Number(v) === 1 ? 'Yes' : 'No') : tdEsc(v);
  const rows = Object.keys(TD_LABELS).filter(f => !['fid', 'mid', 'pids', 'extra', 'is_private', 'privacy_override'].includes(f))
    .filter(f => (p.a[f] ?? '') !== '' || (p.b[f] ?? '') !== '')
    .map(f => {
      const av = p.a[f] ?? '', bv = p.b[f] ?? '';
      if (String(av) === String(bv)) return `<tr><th>${TD_LABELS[f]}</th><td colspan="2">${show(f, av)}</td></tr>`;
      return `<tr><th>${TD_LABELS[f]}</th>
        <td><label><input type="radio" name="td${i}_${f}" value="a"${(av !== '' && (keepA || bv === '')) ? ' checked' : ''}${av === '' ? ' disabled' : ''}> ${show(f, av) || '<em>empty</em>'}</label></td>
        <td><label><input type="radio" name="td${i}_${f}" value="b"${(bv !== '' && (!keepA || av === '')) ? ' checked' : ''}${bv === '' ? ' disabled' : ''}> ${show(f, bv) || '<em>empty</em>'}</label></td></tr>`;
    }).join('');
  el.innerHTML = `
    <div class="td-keep"><span>Keep the entry of</span>
      <label><input type="radio" name="td${i}_keep" value="a"${keepA ? ' checked' : ''}> ${tdEsc(p.a.name)} (#${p.a.id})</label>
      <label><input type="radio" name="td${i}_keep" value="b"${keepA ? '' : ' checked'}> ${tdEsc(p.b.name)} (#${p.b.id})</label></div>
    <table><tbody>${rows}</tbody></table>
    <p class="td-note">Parents, partners, children, photo tags and accounts of the other entry all move to the one you keep. Sources and other details are combined. You can undo this from History.</p>
    <div class="td-actions"><button type="button" class="btn btn-primary btn-sm" onclick="tdMerge(${i})">Merge into one person</button></div>`;
  el.hidden = false;
}
async function tdMerge(i) {
  const p = _tdPairs[i];
  const keepIsA = document.querySelector(`input[name="td${i}_keep"]:checked`).value === 'a';
  const keep = keepIsA ? p.a : p.b, drop = keepIsA ? p.b : p.a;
  const choices = {};
  document.querySelectorAll(`.td-pair[data-i="${i}"] input[type=radio]:checked`).forEach(r => {
    const f = r.name.split('_').slice(1).join('_'); if (f === 'keep') return;
    if ((r.value === 'a') !== keepIsA) choices[f] = 'drop';     // the value picked belongs to the entry being removed
  });
  if (!confirm(`Merge "${drop.name}" into "${keep.name}"? You can undo it from History.`)) return;
  const d = await csrfFetch('tidy-api.php', { method: 'POST', body: JSON.stringify({ action: 'merge', keep: keep.id, drop: drop.id, choices }) }).then(r => r.json());
  if (d.error) { showToast(d.error, 'error'); return; }
  showToast(`Merged. ${d.relinked} relative${d.relinked === 1 ? '' : 's'} relinked.`, 'success');
  tdLoadDups(); _tdLoaded.history = _tdLoaded.bin = false;
}

async function tdLoadBin() {
  const box = document.getElementById('tdBin');
  const d = await csrfFetch('tidy-api.php?what=bin').then(r => r.json()).catch(e => ({ error: e.message }));
  if (d.error) { box.innerHTML = `<div class="td-empty">${tdEsc(d.error)}</div>`; return; }
  document.getElementById('tdBinCount').textContent = d.bin.length || '';
  box.innerHTML = d.bin.length ? d.bin.map(b => `
    <div class="td-row">${tdAvatar(b)}<div class="td-row-main"><b>${tdEsc(b.name)}</b>
      <small>${b.birth_date ? 'born ' + tdEsc(tdYear(b.birth_date)) + ' · ' : ''}deleted by ${tdEsc(b.deleted_by || 'someone')}, ${tdWhen(b.deleted_at)}</small></div>
      <button type="button" class="btn btn-ghost btn-sm" onclick="tdUndo('${b.batch}', 'Restored ${tdEsc(b.name).replace(/'/g, '')} with their links.')">Restore</button></div>`).join('')
    : '<div class="td-empty">The bin is empty. Anyone deleted from the tree shows up here, ready to be restored.</div>';
}

function tdDescribe(rows) {
  // a merge: someone deleted and a namesake edited in the same action
  const del = rows.find(r => r.action === 'delete'), kept = del && rows.find(r => r.action === 'update' && r.name === del.name && r.member_id !== del.member_id);
  if (del && kept) return `<li>Merged two entries of <b>${tdEsc(del.name)}</b> into one${rows.length > 2 ? ` (${rows.length - 2} relative${rows.length === 3 ? '' : 's'} relinked)` : ''}</li>`;
  return rows.map(r => {
    const who = `<b>${tdEsc(r.name || 'someone')}</b>`;
    if (r.action === 'create') return `<li>Added ${who}</li>`;
    if (r.action === 'delete') return `<li>Deleted ${who}</li>`;
    if (r.action === 'import') return `<li>Imported ${r.summary ? r.summary.people + ' people' : 'a file'}</li>`;
    const ch = Object.entries(r.changes || {}).map(([f, [o, n]]) => {
      if (['fid', 'mid', 'pids', 'extra'].includes(f)) return TD_LABELS[f] || f;
      const s = v => v === null || v === '' ? 'empty' : tdEsc(String(v).slice(0, 60));
      return `${TD_LABELS[f] || f}: <s>${s(o)}</s> &rarr; ${s(n)}`;
    });
    return `<li>Edited ${who}${ch.length ? ': ' + ch.join('; ') : ''}</li>`;
  }).join('');
}
async function tdLoadHistory() {
  const box = document.getElementById('tdHistory');
  const q = _tdFocusMember ? '&member=' + _tdFocusMember : '';
  const d = await csrfFetch('tidy-api.php?what=history' + q).then(r => r.json()).catch(e => ({ error: e.message }));
  if (d.error) { box.innerHTML = `<div class="td-empty">${tdEsc(d.error)}</div>`; return; }
  // group rows of one action (batch) together, newest first
  const batches = [];
  d.history.forEach(r => { const last = batches[batches.length - 1]; if (last && last.batch === r.batch) last.rows.push(r); else batches.push({ batch: r.batch, rows: [r] }); });
  const head = _tdFocusMember ? `<div class="td-actions" style="margin:0 0 8px"><span class="td-note" style="margin:0">Changes to one person.</span> <button type="button" class="btn btn-ghost btn-sm" onclick="_tdFocusMember=null;tdLoadHistory()">Show the whole tree</button></div>` : '';
  box.innerHTML = head + (batches.length ? batches.map(b => {
    const r0 = b.rows[0], undone = b.rows.every(r => r.undone);
    return `<div class="td-row${undone ? ' is-undone' : ''}"><div class="td-row-main">
      <small>${tdWhen(r0.at)} · ${tdEsc(r0.user || 'someone')}${undone ? ' · undone' : ''}</small>
      <ul class="td-changes">${tdDescribe(b.rows.slice().reverse())}</ul></div>
      ${undone ? '' : `<button type="button" class="btn btn-ghost btn-sm" onclick="tdUndo('${b.batch}', 'Undone.')">Undo</button>`}</div>`;
  }).join('') : '<div class="td-empty">No changes recorded yet. From now on every edit shows here and can be undone.</div>');
}

async function tdUndo(batch, msg) {
  const d = await csrfFetch('tidy-api.php', { method: 'POST', body: JSON.stringify({ action: 'undo', batch }) }).then(r => r.json());
  if (d.error) { showToast(d.error, 'error'); return; }
  showToast(msg || 'Undone.', 'success');
  tdLoadBin(); tdLoadHistory(); tdLoadDups();
}

const _tdLoaded = {};
function tdShow(tab) {
  document.querySelectorAll('.td-tab').forEach(t => { const on = t.dataset.tab === tab; t.classList.toggle('active', on); t.setAttribute('aria-selected', on); });
  document.getElementById('tdDups').hidden = tab !== 'dups';
  document.getElementById('tdBin').hidden = tab !== 'bin';
  document.getElementById('tdHistory').hidden = tab !== 'history';
  if (!_tdLoaded[tab]) { _tdLoaded[tab] = true; ({ dups: tdLoadDups, bin: tdLoadBin, history: tdLoadHistory })[tab](); }
}
function loadTidy(memberId) {
  document.querySelectorAll('.td-tab').forEach(t => t.onclick = () => tdShow(t.dataset.tab));
  if (memberId) { _tdFocusMember = memberId; tdShow('history'); }
  else { tdShow('dups'); tdLoadBin(); }
}
