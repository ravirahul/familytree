<?php
/**
 * admin/settings.php
 * Phase 3: Privacy & Visibility Settings Tab
 * Included by admin/index.php inside the logged-in section.
 */
?>
<div id="settingsTab" class="tab-content">
<div class="page-title-bar" style="margin-bottom:20px;">
    <h2>Tree Settings</h2>
</div>

  <div class="settings-wrap">

    <!-- ── Tree Visibility ──────────────────────────────────────── -->
    <section class="settings-card" id="visibilitySection">
      <h2 class="settings-heading">
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" style="margin-right:8px;vertical-align:-3px;"><path fill="currentColor" d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zm0 12.5c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>
        Tree Visibility
      </h2>
      <p class="settings-desc">Controls who can access your family tree at its public URL.</p>

      <div class="vis-options">
        <label class="vis-option" id="vis-public">
          <input type="radio" name="visibility" value="public">
          <span class="vis-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
            </svg>
          </span>
          <span class="vis-body">
            <strong>Public</strong>
            <small>Anyone with the link can view. Search engines may list it.</small>
          </span>
        </label>
        <label class="vis-option" id="vis-unlisted">
          <input type="radio" name="visibility" value="unlisted">
          <span class="vis-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
            </svg>
          </span>
          <span class="vis-body">
            <strong>Unlisted</strong>
            <small>Anyone with the link can view. Kept out of search engines.</small>
          </span>
        </label>
        <label class="vis-option" id="vis-private">
          <input type="radio" name="visibility" value="private">
          <span class="vis-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </span>
          <span class="vis-body">
            <strong>Private</strong>
            <small>Members only. Public visitors see an access-denied page.</small>
          </span>
        </label>
      </div>
    </section>

    <!-- ── Per-Field Privacy ────────────────────────────────────── -->
    <section class="settings-card" id="fieldPrivacySection">
      <h2 class="settings-heading">
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" style="margin-right:8px;vertical-align:-3px;"><path fill="currentColor" d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg>
        Per-Field Privacy
      </h2>
      <p class="settings-desc">
        Choose what information is visible to the public. <strong>Members</strong> = logged-in
        admins only. <strong>Private</strong> = owner only (hidden from everyone else).
      </p>
      <p class="settings-note">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:4px;"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        <strong>Living-person protection is always enforced</strong> regardless of these
        settings: Date of Birth, Birth Location, Current Location, and Social Media are
        automatically hidden for living members unless they have individually opted in.
      </p>

      <div class="privacy-table-wrap">
        <table class="privacy-table" id="fieldPrivacyTable">
          <thead>
            <tr>
              <th>Field</th>
              <th>Public</th>
              <th>Members only</th>
              <th>Private</th>
            </tr>
          </thead>
          <tbody id="fieldPrivacyBody" data-sk="table" data-n="6">
            <!-- Populated by JS -->
          </tbody>
        </table>
      </div>
    </section>

    <!-- ── Living Person Protection Info ───────────────────────── -->
    <section class="settings-card settings-card-info">
      <h2 class="settings-heading">
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" style="margin-right:8px;vertical-align:-3px;"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>
        Living Person Protection (P3.3)
      </h2>
      <p class="settings-desc" style="margin-bottom:0;">
        For members marked as <strong>alive</strong>, sensitive fields (Date of Birth, Birth Location,
        Current Location, Social Media) are automatically hidden from the public tree — even
        if your per-field settings above say "Public". This follows GDPR and privacy best
        practices. You can override this per-member in the <strong>Members</strong> tab by
        enabling "Privacy Override (Consented)" on their record.
      </p>
    </section>

    <!-- ── Save button ──────────────────────────────────────────── -->
    <div class="settings-actions">
      <button type="button" class="btn btn-primary" id="saveSettingsBtn" onclick="savePrivacySettings()">
        Save Settings
      </button>
      <span id="settingsSaveMsg" style="margin-left:14px;font-size:13px;color:var(--green);display:none;">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:4px;"><polyline points="20 6 9 17 4 12"/></svg>Saved
      </span>
    </div>


    <!-- ── Family emblem ───────────────────────────────────────── -->
    <section class="settings-card" id="emblemSection">
      <h2 class="settings-heading">
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" style="margin-right:8px;vertical-align:-3px;" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l8 3v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6z"/><path d="M12 3v19M4 12h16"/></svg>
        Family emblem
      </h2>
      <p class="settings-desc">A mark for your family. It shows at the top of the tree, on every member card and export, on the share preview and as the tab icon. Pick one of ours and a colour, or upload your own crest.</p>
      <div class="em-top">
        <div class="em-preview" id="emPreview"></div>
        <div class="em-controls">
          <label class="dh-field"><span>Colour</span><span class="em-color-row"><input type="color" id="emColor" value="#D4A643" oninput="emColorChange(this.value)"><input type="text" id="emColorHex" value="#D4A643" maxlength="7" oninput="emColorChange(this.value)" style="width:96px"></span></label>
          <div class="em-upload" id="emUploadWrap">
            <label class="btn btn-soft" style="cursor:pointer">Upload your own<input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden onchange="emUpload(this)"></label>
            <small>Square PNG or SVG, under 400 KB</small>
          </div>
          <button type="button" class="btn btn-soft" id="emRemove" onclick="emRemove()">No emblem</button>
        </div>
      </div>
      <div class="em-grid" id="emGrid" data-sk="grid" data-n="8"></div>
      <div class="dh-actions">
        <button type="button" class="btn btn-primary" onclick="emSave()">Save emblem</button>
        <span class="dh-msg" id="emMsg"></span>
      </div>
    </section>

    <!-- ── Cover picture on member cards ─────────────────────── -->
    <section class="settings-card" id="coverSection">
      <h2 class="settings-heading">
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" style="margin-right:8px;vertical-align:-3px;" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-8 8"/></svg>
        Cover picture
      </h2>
      <p class="settings-desc">A wide picture across the top of every member card, with your emblem in the corner: the family home, a village, an old group photo. Without one, cards use a soft tint of your tree look.</p>
      <div class="cv-preview" id="cvPreview">
        <div class="cv-img" id="cvImg"></div>
        <div class="cv-emblem" id="cvEmblem" aria-hidden="true"></div>
        <div class="cv-avatar" aria-hidden="true">A</div>
      </div>
      <div class="dh-actions">
        <label class="btn btn-primary" style="cursor:pointer">Upload a picture<input type="file" accept="image/jpeg,image/png,image/webp" hidden onchange="cvUpload(this)"></label>
        <button type="button" class="btn btn-soft" id="cvRemove" onclick="cvRemove()">Remove</button>
        <span class="dh-msg" id="cvMsg"></span>
      </div>
      <p class="dh-hint" style="margin:8px 0 0">Wide pictures work best, at least 1200 pixels across. The middle stays visible; the top and bottom may be trimmed.</p>
    </section>

    <!-- ── Tree look ───────────────────────────────────────────── -->
    <section class="settings-card" id="lookSection">
      <h2 class="settings-heading">
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" style="margin-right:8px;vertical-align:-3px;" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="13.5" cy="6.5" r="1.5"/><circle cx="17.5" cy="10.5" r="1.5"/><circle cx="8.5" cy="7.5" r="1.5"/><circle cx="6.5" cy="12.5" r="1.5"/><path d="M12 2a10 10 0 0 0 0 20c1.1 0 2-.9 2-2 0-.5-.2-1-.5-1.3-.3-.4-.5-.8-.5-1.3 0-1.1.9-2 2-2h2.4A5.6 5.6 0 0 0 22 9.8C22 5.5 17.5 2 12 2z"/></svg>
        Tree look
      </h2>
      <p class="settings-desc">Colours, card shape and lettering for your tree, its timeline, map and memories. Each look has a light and a dark version; visitors still choose light or dark.</p>
      <div class="lk-grid" id="lkGrid" role="radiogroup" aria-label="Tree look" data-sk="grid" data-n="4"></div>
      <label class="dh-check" style="margin:0 0 14px"><input type="checkbox" id="lkHindu"> Show Hindu dates (tithi) worked out from birth and death dates, and remind about shraddh by tithi</label>
      <div class="dh-actions">
        <button type="button" class="btn btn-primary" onclick="lkSave()">Save look</button>
        <span class="dh-msg" id="lkMsg"></span>
      </div>
    </section>

    <!-- ── Weekly backups (made by cron.php) ──────────────────── -->
    <section class="settings-card" id="backupSection">
      <h2 class="settings-heading">Backups</h2>
      <p class="settings-desc">A copy of the whole tree is made every week and the last 8 are kept. Each one can be imported back with Members, Import. <a href="backup-export.php">Download a backup right now</a>.</p>
      <div id="bkList" class="dh-hint" data-sk="lines" data-n="1"></div>
    </section>

    <!-- ── Data home: where this tree's family data lives ───────── -->
    <section class="settings-card" id="dataHomeSection">
      <h2 class="settings-heading">
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" style="margin-right:8px;vertical-align:-3px;" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5"/><path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3"/></svg>
        Where your family's data lives
      </h2>
      <p class="settings-desc">
        Your members, photos and tags can live in FamilyTree's database or in a place you own.
        Accounts and this tree's link stay here either way. Switch any time; moving copies the data across and keeps every id.
      </p>
      <p class="dh-status" id="dhStatus" aria-busy="true"><span class="sk sk-line w60" aria-hidden="true"></span></p>
      <div class="dh-kinds" id="dhKinds"></div>
      <div class="dh-form" id="dhForm"></div>
      <div class="dh-actions" id="dhActions">
        <label class="dh-check" id="dhCopyWrap"><input type="checkbox" id="dhCopy" checked> Copy the current data into the new home</label>
        <div class="dh-btns">
          <button type="button" class="btn btn-soft" id="dhTestBtn" onclick="dhTest()">Test</button>
          <button type="button" class="btn btn-soft" id="dhSetupBtn" onclick="dhSetup()">Set up</button>
          <button type="button" class="btn btn-primary" id="dhSaveBtn" onclick="dhSave()">Switch to this</button>
        </div>
        <span class="dh-msg" id="dhMsg"></span>
      </div>
    </section>

  </div><!-- /.settings-wrap -->
</div><!-- /#settingsTab -->

<style>
/* Settings tab styles */

.cv-preview{position:relative;max-width:420px;margin:0 0 14px;padding-bottom:40px}
.cv-img{height:132px;border-radius:12px;background:var(--accent) center/cover no-repeat;position:relative;overflow:hidden}
.cv-img:not(.has-img)::before{content:"";position:absolute;inset:0;background:linear-gradient(135deg,rgba(255,255,255,.55),rgba(255,255,255,.82))}
.cv-emblem{position:absolute;top:10px;right:10px;width:44px;height:44px;border-radius:50%;background:rgba(255,255,255,.92);display:flex;align-items:center;justify-content:center;box-shadow:0 2px 10px rgba(0,0,0,.18)}
.cv-emblem:empty{display:none}.cv-emblem svg,.cv-emblem img{width:32px;height:32px;border-radius:50%;object-fit:cover}
.cv-avatar{position:absolute;left:16px;top:92px;width:76px;height:76px;border-radius:50%;border:4px solid var(--bg-card);background:var(--bg-stripe);display:flex;align-items:center;justify-content:center;font:600 26px var(--serif);color:var(--text-muted)}
/* emblem */
.em-top{display:flex;gap:18px;align-items:flex-start;margin-bottom:14px;flex-wrap:wrap}
.em-preview{width:120px;height:120px;border-radius:50%;border:1px solid var(--border);display:flex;align-items:center;justify-content:center;background:var(--bg-card);flex:0 0 auto}
.em-preview img{width:96px;height:96px;object-fit:contain;border-radius:50%}.em-none{font-size:12px;color:var(--text-muted)}
.em-controls{display:flex;flex-direction:column;gap:10px;min-width:220px}.em-color-row{display:flex;gap:8px;align-items:center}.em-color-row input[type=color]{width:40px;height:34px;padding:0;border:1px solid var(--border);border-radius:8px;background:none}
.em-upload small{display:block;color:var(--text-muted);font-size:12px;margin-top:4px}
.em-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(88px,1fr));gap:8px;margin-bottom:14px}
.em-tile{background:var(--bg-card);border:1px solid var(--border);border-radius:12px;padding:10px 6px 8px;color:var(--text-secondary);cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:6px;font-size:11px}
.em-tile:hover{border-color:var(--border-focus);color:var(--text-primary)}.em-tile.on{border-color:var(--border-focus);box-shadow:0 0 0 1px var(--border-focus) inset;color:var(--text-primary)}
/* tree look */
.lk-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px;margin-bottom:14px}
.lk-tile{background:var(--bg-card);border:1px solid var(--border);border-radius:12px;padding:8px;cursor:pointer;text-align:left;color:var(--text-primary);font:inherit;display:flex;flex-direction:column;gap:8px}
.lk-tile:hover{border-color:var(--border-focus)}.lk-tile.on{border-color:var(--border-focus);box-shadow:0 0 0 1px var(--border-focus) inset}
.lk-tile:focus-visible{outline:2px solid var(--border-focus);outline-offset:2px}
.lk-tile svg{width:100%;height:auto;border-radius:8px;display:block}.lk-tile b{font-size:13px;font-weight:600}.lk-tile small{display:block;color:var(--text-secondary);font-size:12px;line-height:1.35}
/* data home */
.dh-status{font-size:13px;color:var(--text-secondary);margin:0 0 12px}.dh-status .bad,.dh-msg.bad{color:var(--red)}.dh-msg.ok{color:var(--green)}
.dh-kinds{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px;margin-bottom:14px}
.dh-kind{position:relative;display:block;border:1px solid var(--border);border-radius:12px;padding:12px 12px 10px 36px;cursor:pointer;font-size:13px;color:var(--text-primary);background:var(--bg-card)}
.dh-kind:has(input:checked){border-color:var(--border-focus);box-shadow:0 0 0 1px var(--border-focus) inset}.dh-kind.current{background:var(--green-bg)}
.dh-kind input{position:absolute;left:12px;top:14px;accent-color:var(--border-focus)}.dh-kind b{display:block;font-weight:600;margin-bottom:2px;color:var(--text-primary)}.dh-kind small{display:block;color:var(--text-secondary);line-height:1.4}
.dh-kind em{position:absolute;right:10px;top:10px;font-style:normal;font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--green)}
.dh-form{display:flex;flex-direction:column;gap:10px;margin-bottom:12px}.dh-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.dh-field{display:flex;flex-direction:column;gap:4px;font-size:13px;color:var(--text-primary)}.dh-field span{color:var(--text-secondary)}.dh-field small{color:var(--text-muted);font-size:12px}
.dh-field input,.dh-field textarea{background:var(--bg-card);border:1px solid var(--border);border-radius:8px;color:var(--text-primary);padding:8px 10px;font:inherit;font-size:13px}
.dh-check{display:flex;align-items:center;gap:8px;font-size:13px;color:var(--text-primary)}.dh-check input{accent-color:var(--border-focus)}.dh-hint{font-size:12px;color:var(--text-muted);margin:0}
.dh-actions{display:flex;flex-wrap:wrap;align-items:center;gap:12px}.dh-btns{display:flex;gap:8px}.dh-msg{font-size:13px;color:var(--text-secondary)}

.settings-wrap{max-width:760px;margin:0 auto;padding:4px 0 40px;}
.settings-card{
  background:var(--bg-card);
  border:1px solid var(--border);
  border-radius:10px;padding:22px 24px;margin-bottom:16px;
}
.settings-card-info{
  border-color:color-mix(in srgb,var(--blue) 22%,transparent);
  background:var(--blue-bg);
}
.settings-heading{
  font-size:15px;font-weight:600;color:var(--text-primary);
  margin:0 0 6px;display:flex;align-items:center;
}
.settings-desc{font-size:13px;color:var(--text-muted);margin:0 0 16px;line-height:1.6;}
.settings-note{
  font-size:12.5px;color:var(--brass-ink);
  background:var(--brass-soft);border:1px solid color-mix(in srgb,var(--brass) 28%,transparent);
  border-radius:6px;padding:9px 12px;margin-bottom:16px;line-height:1.5;
}

/* Visibility options */
.vis-options{display:flex;flex-direction:column;gap:8px;}
.vis-option{
  display:flex;align-items:flex-start;gap:12px;
  border:1px solid var(--border);border-radius:8px;
  padding:12px 14px;cursor:pointer;transition:border-color .2s,background .2s;
}
.vis-option:has(input:checked){
  border-color:var(--accent);
  background:var(--accent-light);
}
.vis-option input[type=radio]{margin-top:3px;accent-color:var(--accent);flex-shrink:0;}
.vis-icon{font-size:20px;flex-shrink:0;line-height:1.3;}
.vis-body{flex:1;}
.vis-body strong{display:block;font-size:14px;color:var(--text-primary);margin-bottom:2px;}
.vis-body small{font-size:12.5px;color:var(--text-muted);line-height:1.4;}

/* Per-field privacy table */
.privacy-table-wrap{overflow-x:auto;}
.privacy-table{
  width:100%;border-collapse:collapse;font-size:13.5px;
}
.privacy-table th{
  text-align:left;padding:9px 14px;
  color:var(--text-muted);font-size:12px;text-transform:uppercase;letter-spacing:.5px;
  border-bottom:1px solid var(--border);
}
.privacy-table th:not(:first-child){text-align:center;}
.privacy-table td{
  padding:10px 14px;
  border-bottom:1px solid var(--border);
  color:var(--text-primary);
}
.privacy-table td:not(:first-child){text-align:center;}
.privacy-table tr:last-child td{border-bottom:none;}
.privacy-table tr:hover td{background:var(--bg-stripe);}
.privacy-table input[type=radio]{accent-color:var(--accent);}

/* Save area */
.settings-actions{display:flex;align-items:center;margin-top:4px;}
</style>
