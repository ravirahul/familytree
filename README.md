# FamilyTree

A free, open source family tree for one family. Phone-first, shareable by link, and
your data lives wherever you want it to: the app's own database, your own MySQL or
Postgres, a Google Sheet, an Airtable base, a SQLite file, or a JSON file in your Drive.

Install it on your own server in five minutes, or run it on your computer as a
desktop app. One install holds one family's tree: you are its owner, and you add
relatives as editors or viewers.

## What it does

- A family tree viewer that works on a phone: zoom, pan, tap a person, see photos, dates, places and stories.
- Events (birthdays, anniversaries, remembrance days and your own family events), a world map of where everyone was born and lives, a memory book of photos, videos and voice notes.
- Relationship finder ("how is X related to Y"), member cards you can export as PNG or PDF, GEDCOM export.
- A family emblem: pick one of 18 built-in marks and a colour, or upload your own crest. It shows on the tree, on every card, on the share preview and as the tab icon.
- Six tree looks (Heritage, Banyan, Royal, Minimal, Parchment, Marigold), each in light and dark.
- Import from Ancestry, MyHeritage, FamilySearch, Geni, Gramps and others through GEDCOM (a `.zip` works too), or from a FamilyTree backup. Export GEDCOM, CSV or a full JSON backup.
- Logins for the family: the owner adds relatives as editors (can change the tree) or viewers (can see a private tree).
- Embed any tree, timeline, map or memory book on another website with one line of HTML (`/embed/{slug}`).
- A Claude connector (MCP) at `/mcp`: ask how two people are related, add relatives by describing them, import a GEDCOM by pasting it. Keys are made per user on the Profile page.
- Indian families first: relationship words (Mama, Bua, Tau, Bhabhi...) in Roman and Devanagari, tithis for every date, shraddh reminders by tithi, names in Hindi, native village and gotra.
- History of every change with Undo, a bin for deleted people, and duplicate finding with a side-by-side merge.
- Sources, approximate dates ("about 1890"), adoptive and step parents, marriages and divorces.
- A printable poster (A3 to A0, vector PDF), a family book, a timeline or a map, with whole branches left out if you like; a weekly email of the family's coming week.
- Privacy that defaults to safe: living people's dates and places are hidden from the public unless you say otherwise, per tree and per field.

## Where the data lives ("data home")

Logins and settings always stay in the app's own database. The family data
(members, photos, tags) goes wherever the owner chooses, from Tree Settings:

| Home | Cost | Notes |
| --- | --- | --- |
| The app's own database | free | the default, nothing to set up |
| Your own MySQL / MariaDB / Postgres | free tiers exist (Aiven, Neon, Supabase, your host) | connection test, one-click table setup |
| Google Sheet | free | two tabs, Members and Media, that the family can also edit by hand |
| Airtable base | free to 1,000 records | personal access token |
| SQLite file | free | one file inside `storage/` |
| JSON file | free | one readable file; on the desktop app it can sit in a Drive, Dropbox or OneDrive folder |

Moving between homes copies everything and keeps every id, so links between
people never break. Passwords and keys you enter are encrypted at rest (`APP_KEY`).

## Self-host

Requirements: PHP 8.1+ with PDO, mbstring, OpenSSL; `pdo_mysql` or `pdo_sqlite`;
cURL for Sheets, Airtable and the map; GD for share cards and thumbnails.

1. Put `public_html/` on your web server (Apache with `.htaccess`, or see the Nginx notes below).
2. Open `/install/` in a browser. It checks the server, connects to MySQL or creates a SQLite file, creates the tables, and makes your owner account and the family tree.
3. Done. `install/` locks itself once `.env` exists.

With Docker:

```bash
docker compose up -d
# then open http://localhost:8080/install/
```

Upgrading: upload the new files over the old ones, keeping `.env`, `storage/` and
`admin/uploads/`. On SQLite the app re-runs its schema once per version by itself.
On MySQL, release notes list any table changes to run.

Nginx: route `/tree/{slug}` and `/tree/{slug}/{events|map|memories}` to
`tree.php?slug=...&view=...`, deny `/storage` and `/tools`, and serve `/sitemap.xml`
from `sitemap.php`. The rules in `public_html/.htaccess` are the reference.

## Desktop app

`desktop/` wraps the same PHP app with a bundled PHP runtime and SQLite in an
Electron window. Your tree lives in a folder you pick, so a Google Drive, Dropbox
or OneDrive folder gives you sync and backup for nothing. See `desktop/README.md`.

## Development

```bash
# any PHP 8.1+ will do; this serves public_html with the pretty URLs
php -S 127.0.0.1:8080 -t public_html tools/router.php
```

- `public_html/install/schema.sql` is the schema of record (MySQL). `python tools/make-sqlite-schema.py` derives the SQLite one.
- `node tools/render-emblems.mjs` rasterises `assets/emblems.js` to PNG for the share card and favicon (needs Playwright).
- Family data access goes through `includes/store.php`; new storage backends implement `FamilyStore` (see `includes/stores/`).
- No build step, no framework: PHP, vanilla JS, D3 for the tree.

## Running the tests

Needs PHP 8.1+ with pdo_sqlite and mbstring (Node 20+ for the JS checks). From the repo root:

    for t in tools/test-*.php; do php -d zend.assertions=1 -d assert.exception=1 "$t"; done
    for t in tools/test-*.mjs; do node "$t"; done
    php tools/smoke.php      # installs with SQLite in a temp dir, serves it with php -S, checks the main pages

GitHub Actions runs the same on every push and pull request (.github/workflows/ci.yml), on PHP 8.1 and 8.3.

## The weekly job

`public_html/cron.php` sends the weekly family email, backs up the tree into `storage/backups/` (8 kept) and
clears out old data. Run it once a week: `php public_html/cron.php weekly`, or set `CRON_KEY` in `.env` and call
`/cron.php?key=...` from a web cron.

## Contributing

Issues and pull requests are welcome. Good first contributions: a new data home
backend, translations (Hindi, Maithili, Nepali, Bengali are on the wish list),
GEDCOM import, and a Postgres test run.

## Licence

AGPL-3.0. You may run, change and share it, as long as your changes stay open
under the same licence.
