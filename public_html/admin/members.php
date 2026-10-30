<?php // admin/members.php ?>
<div class="page-title-bar">
    <h2>Members</h2>
    <button class="btn btn-primary" type="button" id="newMemberBtn" onclick="startNew()">+ Add Member</button>
</div>
<div id="tabMembersContent" class="grid">
    <!-- TABLE SECTION -->
    <section class="table-wrap">
        <div class="table-toolbar">
            <div class="table-toolbar-left">
                <div>
                    <strong>Members</strong>
                    <span id="countBadge" class="badge">0</span>
                </div>
                <span>Quick search &amp; sort</span>
            </div>
            <div class="table-toolbar-right">
                <input id="tableSearch" type="text" class="input-chip" placeholder="Search name, ID, parents">
                <div class="dropdown" style="position:relative;">
                    <button class="btn btn-ghost" type="button" onclick="toggleExportMenu()">Export ▾</button>
                    <div id="exportMenu"
                         style="position:absolute;right:0;top:110%;background:var(--bg-card);border:1px solid var(--border);border-radius:8px;min-width:160px;box-shadow:var(--shadow-md);padding:4px 0;display:none;z-index:50;">
                        <button type="button"
                                style="width:100%;text-align:left;padding:8px 12px;background:none;border:none;color:var(--text-primary);font-size:12.5px;cursor:pointer;"
                                onclick="exportJSON()">Export JSON</button>
                        <button type="button"
                                style="width:100%;text-align:left;padding:8px 12px;background:none;border:none;color:var(--text-primary);font-size:12.5px;cursor:pointer;"
                                onclick="exportCSV()">Export CSV</button>
                        <button type="button"
                                style="width:100%;text-align:left;padding:8px 12px;background:none;border:none;color:var(--text-primary);font-size:12.5px;cursor:pointer;"
                                onclick="window.location.href='gedcom-export.php'">Export GEDCOM</button>
                        <button type="button"
                                style="width:100%;text-align:left;padding:8px 12px;background:none;border:none;color:var(--text-primary);font-size:12.5px;cursor:pointer;"
                                onclick="window.location.href='backup-export.php'">Full backup (JSON)</button>
                    </div>
                </div>
                <button class="btn btn-ghost" type="button" onclick="openImport()">Import</button>
                <button class="btn btn-primary" type="button" onclick="startNew()">New</button>
            </div>
        </div>
        <div class="table-scroll">
            <table id="membersTable">
                <thead>
                    <tr>
                        <th data-col="id">ID</th>
                        <th data-col="photo">Photo</th>
                        <th data-col="name">Name</th>
                        <th data-col="nickname">Nick</th>
                        <th data-col="gender">Gender</th>
                        <th data-col="status">Status</th>
                        <th data-col="father">Father</th>
                        <th data-col="mother">Mother</th>
                        <th data-col="partner">Partner</th>
                        <th data-col="wiki">Wiki</th>
                    </tr>
                </thead>
                <tbody data-sk="table" data-n="8"></tbody>
            </table>
        </div>
    </section>

    <!-- FORM SECTION -->
    <section class="form-wrap">
        <div class="form-header">
            <img id="memberAvatar" src="" alt="" style="display:none;">
            <div class="form-header-text">
                <h3 id="formTitle">Add <span style="font-weight:600;">Member</span></h3>
                <small id="formSubtitle"></small>
            </div>
        </div>
        <div id="quickAddBar" style="display:none;align-items:center;gap:8px;flex-wrap:wrap;margin:8px 0 4px;padding:8px 10px;background:var(--accent-light);border:1px solid var(--border);border-radius:8px;font-size:12px;">
            <span>Quick add relative of <b id="quickAddName"></b>:</span>
            <button type="button" class="btn btn-ghost" style="font-size:12px;" onclick="startNewRelated('spouse')">+ Spouse</button>
            <button type="button" class="btn btn-ghost" style="font-size:12px;" onclick="startNewRelated('child')">+ Child</button>
        </div>
        <p class="form-note">Click table row to edit. Wiki field supports up to 750 characters.</p>

        <form id="memberForm" onsubmit="saveMember(event)">
            <input type="hidden" id="memberId">

            <!-- BASIC INFO -->
            <div class="form-section">
                <div class="section-title">Basic Information</div>
                <div class="form-row">
                    <div class="form-group">
                        <label for="name">Name</label>
                        <input id="name" required>
                    </div>
                    <div class="form-group">
                        <label for="nickname">Nickname</label>
                        <input id="nickname">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label for="gender">Gender</label>
                        <select id="gender">
                            <option value="">Select</option>
                            <option value="male">Male</option>
                            <option value="female">Female</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="COL10">Current Location</label>
                        <input id="COL10">
                    </div>
                </div>
            </div>

            <!-- BIRTH -->
            <div class="form-section">
                <div class="section-title">Birth Details</div>
                <div class="form-row">
                    <div class="form-group">
                        <label for="birthdate">Birth Date</label>
                        <input id="birthdate" type="date">
                    </div>
                    <div class="form-group">
                        <label for="birthlocation">Birth Location</label>
                        <input id="birthlocation">
                    </div>
                </div>
            </div>

            <!-- RELATIONS -->
            <div class="form-section">
                <div class="section-title">Family Relations</div>

                <div class="form-row">
                    <div class="form-group">
                        <label for="fid">Father</label>
                        <select id="fid">
                            <option value="">None</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="mid">Mother</label>
                        <select id="mid">
                            <option value="">None</option>
                        </select>
                    </div>
                </div>

                <div class="form-row">
                    <div class="form-group">
                        <label>Marital Status</label>
                        <div class="checkbox-group">
                            <input type="checkbox" id="ismarried">
                            <label for="ismarried" style="margin:0;font-weight:500;">Married</label>
                        </div>
                    </div>
                </div>

                <div class="form-row" id="marriageRow">
                    <div class="form-group" style="flex:1;">
                        <label>Spouse(s) / Partner(s)</label>
                        <div id="spousesContainer" style="display:flex;flex-direction:column;gap:6px;margin-bottom:6px;">
                            <!-- Dynamic spouse selects rendered here -->
                        </div>
                        <button type="button" class="btn btn-ghost" id="btnAddSpouse" style="font-size:11px;padding:4px 8px;" onclick="addSpouseSelect()">+ Add Another Spouse</button>
                    </div>
                    <div class="form-group" style="max-width:180px;">
                        <label for="COL13">Anniversary</label>
                        <input id="COL13" type="date">
                    </div>
                </div>
            </div>

            <!-- STATUS -->
            <div class="form-section">
                <div class="section-title">Status</div>
                <div class="form-group">
                    <label>Life Status</label>
                    <div class="checkbox-group">
                        <input type="checkbox" id="isalive" checked>
                        <label for="isalive" style="margin:0;font-weight:500;">Alive</label>
                    </div>
                </div>
                <div class="form-row" id="deathfields" style="display:none;">
                    <div class="form-group">
                        <label for="COL14">Death Date</label>
                        <input id="COL14" type="date">
                    </div>
                    <div class="form-group">
                        <label for="COL15">Death Location</label>
                        <input id="COL15">
                    </div>
                </div>
            </div>

            <!-- MEDIA -->
            <div class="form-section">
                <div class="section-title">Media</div>
                <div class="form-row">
                    <div class="form-group">
                        <label for="imgFile">Upload Image</label>
                        <input id="imgFile" type="file" accept="image/*">
                        <button type="button"
                                class="btn btn-ghost"
                                style="margin-top:4px;padding-inline:10px;font-size:11px;"
                                onclick="clearImageField()">
                            Remove image
                        </button>
                    </div>
                    <div class="form-group">
                        <label for="img">Image URL</label>
                        <input id="img">
                    </div>
                </div>
            </div>

            <!-- CONTACTS -->
            <div class="form-section">
                <div class="section-title">Social Links</div>
                <div class="form-row">
                    <div class="form-group">
                        <label for="COL11">Instagram</label>
                        <input id="COL11">
                    </div>
                    <div class="form-group">
                        <label for="COL12">Facebook</label>
                        <input id="COL12">
                    </div>
                </div>
            </div>

            <!-- WIKI -->
            <div class="form-section">
                <div class="section-title">
                    Wiki Biography
                    <span style="color:var(--text-muted);font-size:11px;font-weight:500;"> 750 chars max</span>
                </div>
                <div class="form-group full">
                    <label for="wiki">Personal story, achievements, memories</label>
                    <textarea id="wiki" placeholder="Write a biography or notable information about this person..."></textarea>
                    <div class="wiki-char-count" id="wikiCharCount">0/750</div>
                </div>
            </div>

            <div style="display:flex;gap:8px;margin-top:16px;">
                <button class="btn btn-primary" type="submit">Save</button>
                <button class="btn btn-ghost" type="button" onclick="startNew()">Clear</button>
                <button class="btn btn-danger" type="button" onclick="deleteMember()" id="deleteBtn" style="margin-left:auto;display:none;">Delete</button>
            </div>
        </form>
    </section>
</div>

<!-- Import from another builder: GEDCOM or a FamilyTree JSON backup -->
<dialog id="importDialog" class="imp-dialog" aria-labelledby="impTitle">
  <form method="dialog" class="imp-head">
    <h3 id="impTitle">Import a family tree</h3>
    <button class="imp-x" value="close" aria-label="Close">&times;</button>
  </form>
  <div class="imp-body">
    <p class="imp-lede">Bring your tree from Ancestry, MyHeritage, FamilySearch, Geni, Gramps, webtrees, Family Echo or any builder that exports <b>GEDCOM</b> (.ged, or the .zip some sites give you), or a FamilyTree backup (.json). <a href="/guide/importing" target="_blank" rel="noopener">How to export from each site</a></p>
    <label class="imp-drop" id="impDrop">
      <input type="file" id="impFile" accept=".ged,.gedcom,.json,.zip,text/plain,application/json,application/zip" onchange="importPreview()">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
      <span id="impDropText">Choose a .ged or .json file (up to 20 MB)</span>
    </label>
    <div id="impPreview" class="imp-preview" hidden></div>
    <fieldset id="impModes" class="imp-modes" hidden>
      <legend>How should it join this tree?</legend>
      <label><input type="radio" name="impMode" value="add" checked> <span><b>Add alongside</b> the people already here</span></label>
      <label><input type="radio" name="impMode" value="replace"> <span><b>Replace</b> everyone in this tree with the file (photos in the tree are removed too)</span></label>
    </fieldset>
    <p class="imp-msg" id="impMsg" role="status" aria-live="polite"></p>
  </div>
  <div class="imp-foot">
    <button type="button" class="btn btn-ghost" onclick="document.getElementById('importDialog').close()">Cancel</button>
    <button type="button" class="btn btn-primary" id="impGo" onclick="importRun()" disabled>Import</button>
  </div>
</dialog>
<style>
.imp-dialog{margin:auto;border:1px solid var(--border);border-radius:14px;background:var(--bg-card);color:var(--text-primary);padding:0;width:min(560px,calc(100vw - 32px));box-shadow:0 30px 80px rgba(0,0,0,.35)}
.imp-dialog::backdrop{background:rgba(14,36,27,.55)}
.imp-head{display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid var(--border)}
.imp-head h3{margin:0;font-size:16px}.imp-x{background:none;border:0;font-size:24px;line-height:1;color:var(--text-secondary);cursor:pointer;width:40px;height:40px;border-radius:8px}
.imp-body{padding:16px 20px;display:flex;flex-direction:column;gap:14px}.imp-lede{margin:0;font-size:13px;color:var(--text-secondary);line-height:1.6}
.imp-drop{display:flex;flex-direction:column;align-items:center;gap:8px;padding:22px;border:1.5px dashed var(--border-focus);border-radius:12px;cursor:pointer;text-align:center;font-size:13px;color:var(--text-secondary)}
.imp-drop:hover,.imp-drop:focus-within{background:var(--accent-light)}.imp-drop input{position:absolute;opacity:0;width:1px;height:1px}
.imp-preview{border:1px solid var(--border);border-radius:10px;padding:12px 14px;font-size:13px;line-height:1.6}
.imp-preview dl{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:0 0 8px}.imp-preview dt{font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em}.imp-preview dd{margin:0;font-size:18px;font-weight:700;font-variant-numeric:tabular-nums}
.imp-preview ul{margin:6px 0 0;padding-left:18px;color:var(--text-secondary)}
.imp-modes{border:0;padding:0;margin:0;display:flex;flex-direction:column;gap:8px}.imp-modes legend{font-size:13px;font-weight:600;margin-bottom:6px}
.imp-modes label{display:flex;gap:10px;align-items:flex-start;font-size:13px;padding:10px 12px;border:1px solid var(--border);border-radius:10px;cursor:pointer}
.imp-modes label:has(input:checked){border-color:var(--border-focus)}.imp-modes input{margin-top:3px;accent-color:var(--border-focus)}
.imp-msg{margin:0;font-size:13px;min-height:1.2em}.imp-msg.bad{color:var(--red)}.imp-msg.ok{color:var(--green)}
.imp-foot{display:flex;justify-content:flex-end;gap:8px;padding:14px 20px;border-top:1px solid var(--border)}
</style>
