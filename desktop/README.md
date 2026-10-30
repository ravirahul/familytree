# FamilyTree Desktop

The same FamilyTree, on your own computer, no server and no account. It bundles a
PHP runtime and uses SQLite, so a tree is one folder: `familytree.sqlite`, your
photos and a `.env`. Put that folder inside Google Drive, Dropbox or OneDrive and
you have sync and backup for free. Export to GEDCOM or JSON any time.

## Build

```bash
cd desktop
npm install
npm run fetch-php      # downloads PHP 8.3 for your platform into desktop/php/
npm start              # run it
npm run dist           # installers in desktop/dist/
```

While developing you can skip `fetch-php` if a `php` is on your PATH with
`pdo_sqlite`, `curl`, `gd`, `mbstring` and `openssl` enabled.

## How it works

`main.js` asks for a data folder on first run, writes the `.env` there
(`DB_DRIVER=sqlite`), starts `php -S` on a free port with
`tools/router.php` (the Apache rewrites), and opens the installer in a window.
Later runs open the admin straight away. The app reads its `.env` from
`FT_ENV_FILE`, and its `storage/` from `FT_STORAGE_DIR`, so the program folder
is never written to.

Signing and auto-update are not set up. Releases are built by hand for now.
