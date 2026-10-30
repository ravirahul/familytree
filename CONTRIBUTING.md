# Contributing to FamilyTree

Thanks for helping. FamilyTree is plain PHP, vanilla JavaScript and D3, with no
build step, so you can start in a minute.

## Run it locally

```bash
php -S 127.0.0.1:8080 -t public_html tools/router.php
# open http://127.0.0.1:8080/install/ and choose SQLite
```

Your PHP needs `pdo_sqlite`, `mbstring` and `openssl`; `curl` and `gd` for maps,
Sheets, Airtable and share cards.

## Ground rules

- Family data goes through `includes/store.php` (`FamilyStore`). Never query the
  `family_*` tables directly, or trees that live in a Google Sheet or someone's own
  database will break.
- `public_html/install/schema.sql` is the schema of record. After changing it, run
  `python tools/make-sqlite-schema.py` and add an upgrade file under
  `public_html/install/upgrades/` for existing installs.
- Privacy is a feature: anything shown to the public must pass through
  `applyPublicPrivacy()`.
- Keep pull requests small and say how you tested them.

## Good first contributions

- A new data home (for example Notion, Baserow, NocoDB, Supabase REST).
- GEDCOM import.
- Translations: Hindi, Maithili, Nepali, Bengali.
- Trying the Google Sheets and Airtable homes with real accounts and reporting what breaks.

## Reporting a security issue

Please do not open a public issue. Email the maintainer listed on the GitHub
profile of this repository instead.
