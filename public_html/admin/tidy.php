<?php
/**
 * admin/tidy.php - "Tidy up": possible duplicates, the bin, and the history of changes with Undo.
 * Included by admin/index.php; data from tidy-api.php via js/tidy.js.
 */
?>
<div class="page-title-bar" style="margin-bottom:16px;">
    <h2>Tidy up</h2>
</div>
<p class="td-lede">Fix the tree as more relatives edit it: merge people entered twice, bring back someone deleted by mistake, and undo any change.</p>

<div class="td-tabs" role="tablist" aria-label="Tidy up">
    <button type="button" class="td-tab active" role="tab" aria-selected="true" data-tab="dups">Possible duplicates <span class="td-count" id="tdDupCount"></span></button>
    <button type="button" class="td-tab" role="tab" aria-selected="false" data-tab="bin">Bin <span class="td-count" id="tdBinCount"></span></button>
    <button type="button" class="td-tab" role="tab" aria-selected="false" data-tab="history">History</button>
</div>

<section class="td-panel" id="tdDups" role="tabpanel" data-sk="cards" data-n="3"></section>
<section class="td-panel" id="tdBin" role="tabpanel" hidden data-sk="rows" data-n="4"></section>
<section class="td-panel" id="tdHistory" role="tabpanel" hidden data-sk="rows" data-n="5"></section>

<style>
.td-lede{color:var(--text-secondary);font-size:14px;margin:0 0 16px;max-width:70ch}
.td-tabs{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:16px}
.td-tab{min-height:40px;padding:0 14px;border-radius:999px;border:1px solid var(--border);background:var(--bg-card);color:var(--text-secondary);font:inherit;font-size:13px;font-weight:600;cursor:pointer}
.td-tab.active{border-color:var(--border-focus);color:var(--text-primary);box-shadow:0 0 0 1px var(--border-focus) inset}
.td-count{display:inline-block;min-width:18px;padding:0 6px;border-radius:999px;background:var(--border);font-size:11px;margin-left:4px}
.td-count:empty{display:none}
.td-panel[hidden]{display:none}
.td-empty{color:var(--text-muted);padding:28px 4px;font-size:14px}
.td-pair{border:1px solid var(--border);border-radius:14px;background:var(--bg-card);padding:14px;margin-bottom:12px}
.td-pair-top{display:grid;grid-template-columns:1fr auto 1fr;gap:12px;align-items:center}
.td-person{display:flex;gap:10px;align-items:center;min-width:0}
.td-av{width:44px;height:44px;border-radius:50%;flex:0 0 auto;background:var(--border) center/cover;display:flex;align-items:center;justify-content:center;font:600 16px var(--serif);color:var(--text-primary)}
.td-person b{display:block;font-size:14px;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.td-person small{display:block;color:var(--text-muted);font-size:12px;line-height:1.4}
.td-vs{text-align:center;font-size:12px;color:var(--text-muted)}
.td-vs b{display:block;font-size:18px;color:var(--text-primary)}
.td-why{display:flex;flex-wrap:wrap;gap:6px;margin:10px 0 0}
.td-why span{font-size:11.5px;padding:2px 9px;border-radius:999px;background:var(--border);color:var(--text-secondary)}
.td-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
.td-compare{margin-top:12px;border-top:1px solid var(--border);padding-top:12px;overflow-x:auto}
.td-compare table{width:100%;border-collapse:collapse;font-size:13px;min-width:460px}
.td-compare th,.td-compare td{padding:7px 8px;border-bottom:1px solid var(--border);text-align:left;vertical-align:top;color:var(--text-primary)}
.td-compare th{color:var(--text-muted);font-weight:600;width:130px}
.td-compare label{display:flex;gap:6px;align-items:flex-start;cursor:pointer}
.td-compare input{accent-color:var(--border-focus);margin-top:3px}
.td-keep{display:flex;gap:14px;flex-wrap:wrap;margin:0 0 10px;font-size:13px;color:var(--text-primary)}
.td-note{font-size:12px;color:var(--text-muted);margin:8px 0 0}
.td-row{display:flex;gap:12px;align-items:center;padding:10px 4px;border-bottom:1px solid var(--border)}
.td-row-main{flex:1;min-width:0}
.td-row-main b{color:var(--text-primary);font-size:14px}
.td-row-main small{display:block;color:var(--text-muted);font-size:12px;line-height:1.5}
.td-row.is-undone{opacity:.55}
.td-changes{margin:4px 0 0;padding:0;list-style:none;font-size:12.5px;color:var(--text-secondary)}
.td-changes li{line-height:1.5}
.td-changes s{color:var(--text-muted)}
@media (max-width:640px){.td-pair-top{grid-template-columns:1fr}.td-vs{text-align:left}}
</style>
