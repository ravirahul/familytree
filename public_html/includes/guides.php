<?php
/**
 * includes/guides.php - the help pages at /guide. One entry per page: section, title, summary, body (HTML).
 * Bodies use three helpers: $fig(file, alt, caption) for a screenshot, $clip(name, caption) for a short
 * looping video, $note(html) for a callout. Media lives in /assets/guide/.
 */
if (!defined('FT_APP')) exit;

function ft_guides(): array {
    $fig = fn(string $f, string $alt, string $cap = '') =>
        '<figure class="g-fig"><img src="/assets/guide/' . $f . '.webp" alt="' . htmlspecialchars($alt, ENT_QUOTES) . '" loading="lazy" decoding="async">'
        . ($cap ? '<figcaption>' . $cap . '</figcaption>' : '') . '</figure>';
    $clip = fn(string $n, string $cap) =>
        '<figure class="g-fig g-clip"><video src="/assets/guide/' . $n . '.mp4" poster="/assets/guide/' . $n . '-poster.webp" muted loop playsinline preload="none" aria-label="' . htmlspecialchars(strip_tags($cap), ENT_QUOTES) . '"></video>'
        . '<button type="button" class="g-play" aria-label="Play or pause the clip"></button><figcaption>' . $cap . '</figcaption></figure>';
    $note = fn(string $h, string $kind = 'tip') => '<aside class="g-note g-' . $kind . '">' . $h . '</aside>';

    return [

    /* ── Start ─────────────────────────────────────────────────────────── */
    'getting-started' => ['section' => 'Start here', 'title' => 'Make your family tree', 'mins' => 3,
        'summary' => 'Install it, name your tree, add the first few people and share the link.',
        'body' => <<<HTML
<p>FamilyTree is free and open source. Your family's tree gets its own link, like <code>your-site.com/tree/sharma</code>, that opens on any phone. You can build it in the browser, or bring an existing tree from another site.</p>
<h2 id="sign-up">Set it up</h2>
<ol class="g-steps">
  <li>Put FamilyTree on your server or computer (see <a href="/guide/self-hosting">Run FamilyTree on your own server</a>) and open <code>/install/</code>.</li>
  <li>Choose a database: a SQLite file needs nothing set up; MySQL or Postgres works too.</li>
  <li>Enter your name, email and a password of at least 8 characters, and give the tree a name, for example <em>Sharma family</em>. The link is made from it.</li>
  <li>Sign in at <code>/admin/</code>. You are the tree's owner; add relatives as editors or viewers from <b>Users</b>.</li>
</ol>
<h2 id="first-people">Add the first people</h2>
<p>You land on the <b>Dashboard</b>. The quickest way to start is on the tree itself: open <b>View Family Tree</b>, turn on <b>Build Mode</b> and add yourself, then your parents, partner and children. <a href="/guide/adding-people">Adding people</a> shows each step.</p>
<p>Already have a tree on Ancestry, MyHeritage or another site? <a href="/guide/importing">Import it</a> instead and skip the typing.</p>
{$fig('dashboard', 'The admin dashboard with counts of members, users, photos and upcoming events')}
<h2 id="share">Share it</h2>
<p>New trees are private. When you are ready, choose who can see it in <a href="/guide/privacy">Tree Settings</a>, then press <b>Share</b> on the tree to send the link on WhatsApp or copy it.</p>
{$note('<b>Living people stay protected.</b> Even on a public tree, the birth dates, birthplaces, current homes and social links of living people are hidden from visitors unless you choose otherwise.')}
HTML],

    'adding-people' => ['section' => 'Start here', 'title' => 'Add people and relationships', 'mins' => 4,
        'summary' => 'Build Mode puts add buttons around every person: parents, children, siblings and partners.',
        'body' => <<<HTML
<p>There are two ways to add people. On the tree, Build Mode is the quickest. In the admin, the Members page gives you every field at once.</p>
<h2 id="build-mode">On the tree, with Build Mode</h2>
<ol class="g-steps">
  <li>Open your tree and press <b>Build Mode</b> at the top. It turns gold and reads <em>Build Mode: ON</em>.</li>
  <li>Small round buttons appear around each person: above for a <b>parent</b>, below for a <b>child</b>, at the side for a <b>sibling</b> and the heart for a <b>partner</b>.</li>
  <li>Press one, type the name, pick male or female, untick <b>Living</b> if they have died, and press <b>Add</b>.</li>
  <li>The new person appears linked in place, with their details open on the right so you can add more.</li>
</ol>
{$clip('add-person', 'Adding a child in Build Mode: press the button under a person, type a name, add.')}
{$fig('build-mode', 'A tree in Build Mode with add buttons around each card')}
<h2 id="members-page">In the admin, on the Members page</h2>
<p>Open <b>Admin &gt; Members</b> and press <b>Add Member</b>, or click anyone in the list to edit them. The form has every field: name and nickname, gender, birth and death dates and places, current location, father, mother, partners and wedding anniversary, a photo, and social links.</p>
{$fig('member-form', 'The member form with basic information, birth details and family relations', 'Choose the father and mother from the list; partners can be several.')}
<h2 id="tips">Good to know</h2>
<ul>
  <li><b>Dates you are unsure of</b>: leave the date empty and write "about 1890" in the biography. A wrong exact date is worse than none.</li>
  <li><b>Both families of a couple</b>: when both partners have parents in the tree, a small <b>+</b> on a card switches which side's family is shown above them.</li>
  <li><b>Big families</b>: use <b>Collapse all</b> and the <b>−</b> under a couple to fold branches away, and the search box to jump to anyone.</li>
</ul>
HTML],

    'details-photos' => ['section' => 'Start here', 'title' => 'Photos, videos and stories', 'mins' => 3,
        'summary' => 'Give each person a portrait, then fill the memory book with photos, videos and voice notes.',
        'body' => <<<HTML
<h2 id="portrait">A portrait for each person</h2>
<p>In a person's form, use <b>Upload Image</b> or paste an image link. Square photos with the face in the middle look best in the round frame. On the tree, people without a photo show their initial instead.</p>
<h2 id="memory-book">The memory book</h2>
<ol class="g-steps">
  <li>Open <b>Admin &gt; Photos</b> and press <b>Upload photo</b>. Photos, videos (MP4, WebM, MOV) and audio such as voice notes all work.</li>
  <li>Give it a title and a few words about it: who, where, when.</li>
  <li>Tag the people in it. Each tagged person shows the memory on their page.</li>
</ol>
{$fig('photos', 'The Photos page with uploaded photos and the details of one photo', 'Click a photo to edit its title, description and tags.')}
<p>Everyone who can see the tree finds these under <b>Memories</b>, arranged by year, with filters for photos, videos and voice notes, and a filter by person.</p>
{$fig('memories', 'The Memories view of a tree, grouped by year, with photo cards', 'The memory book of the Windsor demo tree.')}
<h2 id="stories">Stories</h2>
<p>The biography field takes as much as you want to write: how a grandparent met their partner, the village they came from, what they did for a living. It shows on the person's page and on their exported card.</p>
HTML],

    'more-details' => ['section' => 'Start here', 'title' => 'Uncertain dates, sources, adoption and divorce', 'mins' => 3,
        'summary' => 'Record what you know as you know it: "about 1890", where a fact comes from, step and adoptive parents, a divorce.',
        'body' => <<<HTML
<p>Open a person on the tree and press <b>Edit</b>. Below the usual fields are a few that make a tree trustworthy.</p>
<h2 id="roots">Name in Hindi, native village, gotra</h2>
<p>Under <b>Name &amp; roots</b>, write the name in Devanagari (or any script), the family's native village and the gotra. The Hindi name shows under the English one on the person's card.</p>
{$fig('card-roots', 'A member card showing the Hindi name, the birth tithi, native place and gotra')}
<h2 id="approx">When you don't know the exact date</h2>
<p>Under the birth or death date, choose <b>About</b>, <b>Before</b>, <b>After</b>, <b>Between</b> or <b>Only the year</b>, and type the year. The card says "about 1890", and the timeline places the person with a dashed ring. Files from other sites keep their approximate dates the same way when you import them.</p>
<h2 id="sources">Sources</h2>
<p>Under <b>Sources</b>, note where each fact comes from: a certificate, a family register, a gravestone, a website, or Grandma's memory. Add a link if there is one. Sources show at the bottom of the card, and travel with GEDCOM imports and exports.</p>
{$fig('edit-sources', 'The Sources section of the edit window with one source filled in')}
<h2 id="families">Adoptive and step parents, marriages and divorce</h2>
<ul>
  <li>Under <b>Parents</b>, say whether the father or mother is the birth parent, or adoptive, step or foster.</li>
  <li>Under <b>Spouses &amp; Partners</b>, each partner has their own wedding date, and whether the marriage ended (divorced, separated, widowed) and when. Both partners' cards show it, and anniversaries stop after a divorce.</li>
</ul>
HTML],

    /* ── Explore ───────────────────────────────────────────────────────── */
    'exploring' => ['section' => 'Explore', 'title' => 'Find your way around a tree', 'mins' => 4,
        'summary' => 'The tree, the timeline, the map, the memory book, and how to find how two people are related.',
        'body' => <<<HTML
<p>Every tree has four views along the top: <b>Tree</b>, <b>Events</b>, <b>Map</b> and <b>Memories</b>. They work the same on a phone: pinch to zoom, drag to move, tap a person.</p>
<h2 id="person">A person's page</h2>
<p>Tap anyone to open their page on the right: photo, dates, places, age, partners, children, and their story. <b>Export</b> saves a card of the person as an image or PDF, with the family emblem on it.</p>
{$fig('member-panel', 'A tree with one person open in the side panel showing dates, places, spouse and children')}
<h2 id="events">Events: timeline, list and calendar</h2>
<p>Births, marriages and deaths on one timeline, with the decades along the bottom. Switch to <b>List</b> or <b>Calendar</b> to see the birthdays and anniversaries coming up.</p>
{$fig('events', 'The timeline view of the Kennedy family with births, marriages and deaths placed by year')}
<h3 id="family-events">Family events</h3>
<p>Add the days that matter to your family: a puja every Diwali, a reunion, a wedding, the barsi of someone not in the tree. Press <b>Add event</b> on the Events page, give it a name, a kind and a date, and pick the people it is about.</p>
<p>Tick <b>Repeats every year</b> for festivals and anniversaries; leave it off for a one-time day. If you don't know the year, tick <b>Year not known</b>. Family events show in the timeline, the list, the calendar and the weekly email. Use the <b>Family events</b> chip to hide or show them, and the search box to find any event by name, person or place.</p>
<h2 id="map">Map</h2>
<p>Where everyone was born, lived and died. <b>Living now</b> shows where the family is today; <b>Birthplaces</b> and <b>Everything</b> show the history.</p>
{$fig('map', 'A world map with clusters of family places across Europe and beyond', 'The Romanovs, from Moscow to the rest of the world.')}
<h2 id="relation">How are we related?</h2>
<p>Press <b>Find relation</b>, pick two people, and FamilyTree names the relationship (second cousin once removed, sister-in-law, great-grandson) and shows the path between them, person by person.</p>
{$clip('find-relation', 'Finding how Pierre Curie and Hélène Langevin-Joliot are related.')}
HTML],

    'indian-family' => ['section' => 'Explore', 'title' => 'Hindu dates, shraddh and Mama, Bua, Tau', 'mins' => 3,
        'summary' => 'Tithis worked out for every date, shraddh reminders by tithi, and the Hindi word for every relationship.',
        'body' => <<<HTML
<h2 id="words">Mama, Bua, Tau, Bhabhi</h2>
<p>Press <b>Find relation</b> and pick two people. Under the English answer, FamilyTree gives the word your family actually uses, in Roman and Devanagari: Dada, Nani, Chacha or Tau (it checks who is older), Bua, Mama, Mausi, Bhabhi, Jija, Devar, Nanad, Saala, Samdhi and many more.</p>
{$fig('rel-indian', 'The relationship finder showing Grandfather, and below it Dada in Roman and Devanagari')}
<h2 id="tithi">Tithis</h2>
<p>For every birth and death date, the card shows the Hindu date: the month, the paksha and the tithi, for example <em>Kartik Krishna Ashtami</em>. Months are named the North Indian way (purnimanta).</p>
<p>If an elder only knows their tithi, not the English date, open their edit window and fill in <b>Hindu date of birth (tithi)</b> or <b>Shraddh / barsi tithi</b>, with the Samvat year if you know it.</p>
<h2 id="shraddh">Shraddh by tithi, every year</h2>
<p>The tithi falls on a different English date each year. FamilyTree works it out and puts it in <b>Events</b>: the list of what's coming up, and the calendar, where tithi days have a dashed border. The weekly email includes them too.</p>
{$fig('calendar-tithi', 'The calendar view with tithi days shown with dashed borders')}
{$note('Prefer a tree without Hindu dates? Turn them off in <b>Tree Settings &gt; Tree look</b>. Tithis you typed in by hand always show.', 'info')}
HTML],

    /* ── Share and show ────────────────────────────────────────────────── */
    'privacy' => ['section' => 'Share and show', 'title' => 'Who can see your tree', 'mins' => 3,
        'summary' => 'Public, unlisted or private, what visitors see of each field, and how living people are protected.',
        'body' => <<<HTML
<h2 id="visibility">Public, unlisted or private</h2>
<p>In <b>Admin &gt; Tree Settings</b>, at the top:</p>
<ul>
  <li><b>Public</b>: anyone with the link can view it, and search engines can find it.</li>
  <li><b>Unlisted</b>: anyone with the link can view it, but it is not listed or indexed. Good for sharing in a family group.</li>
  <li><b>Private</b>: only people with a login to this tree can see it.</li>
</ul>
{$fig('privacy-visibility', 'The three visibility choices: public, unlisted and private')}
<h2 id="fields">Field by field</h2>
<p>Below that, choose for each kind of detail who sees it: everyone, signed-in family only, or just you. Phone numbers might be family only; a biography might be public.</p>
{$fig('privacy-fields', 'The per-field privacy table with public, members only and private columns')}
{$note('<b>Living people are always protected.</b> Date of birth, birthplace, current location and social media of living people are hidden from visitors whatever the table says, unless that person has opted in.', 'info')}
HTML],

    'family-logins' => ['section' => 'Share and show', 'title' => 'Let your family help', 'mins' => 2,
        'summary' => 'Give relatives their own login as a viewer, an editor or a second owner.',
        'body' => <<<HTML
<p>Building a tree goes faster when an aunt can add her side of the family herself. Give each relative their own login.</p>
<ol class="g-steps">
  <li>Open <b>Admin &gt; Users</b>.</li>
  <li>Under <b>Add User</b>, enter their name, email and a first password, and send them those details yourself.</li>
  <li>Choose a role:
    <ul>
      <li><b>Viewer</b> can see the whole tree, including what you marked members-only.</li>
      <li><b>Editor</b> can add and change people and photos.</li>
      <li><b>Owner</b> can do everything, including settings, imports and other users.</li>
    </ul></li>
  <li>Optionally, under <b>Linked member</b>, pick their own person in the tree.</li>
</ol>
{$fig('users', 'The Users page with the list of logins and the Add User form')}
<p>Every change is recorded in <b>Activity Log</b>, so you can see who added or changed what.</p>
HTML],

    'embedding' => ['section' => 'Share and show', 'title' => 'Share the link or put the tree on a website', 'mins' => 2,
        'summary' => 'Send the link on WhatsApp, or paste one line of code to show the tree on a blog, Notion or WordPress.',
        'body' => <<<HTML
<h2 id="share">Share the link</h2>
<p>Press <b>Share</b> at the top of the tree. Copy the link, send it on WhatsApp, or use your phone's share sheet. The link shows a preview card with the family's name and emblem.</p>
{$fig('share', 'The share dialog with the link, a WhatsApp button and the embed options')}
<h2 id="embed">Embed it on a website</h2>
<ol class="g-steps">
  <li>In the same dialog, under <b>Embed on your website</b>, choose the view (tree, timeline, map or memories), light or dark, the <a href="/guide/tree-looks">look</a>, and the height.</li>
  <li>Press <b>Copy code</b> and paste it into your page. It works anywhere that accepts HTML or an embed block: WordPress, Notion, Google Sites, Blogger, Squarespace, Wix.</li>
</ol>
<pre><code>&lt;iframe src="https://your-site.com/embed/sharma" title="Sharma family tree"
  width="100%" height="600" style="border:0;border-radius:12px" loading="lazy"&gt;&lt;/iframe&gt;</code></pre>
<p>The embedded tree is fully interactive and links back to the full tree. Only public and unlisted trees can be embedded, and the same privacy rules apply.</p>
{$note('You can add <code>?theme=dark</code>, <code>?look=royal</code> or <code>?accent=0f766e</code> to the embed link by hand as well.')}
HTML],

    'emblem' => ['section' => 'Share and show', 'title' => 'Give your family an emblem', 'mins' => 2,
        'summary' => 'Pick one of 18 marks and a colour, or upload your own crest.',
        'body' => <<<HTML
<p>An emblem is your family's mark. It shows at the top of the tree, on every exported card, on the preview when you share the link, and as the browser tab icon.</p>
<ol class="g-steps">
  <li>Open <b>Admin &gt; Tree Settings &gt; Family emblem</b>.</li>
  <li>Pick a mark (banyan, lotus, peacock, lion, oak and more) and a colour, or press <b>Upload your own</b> for a crest: a square PNG or SVG under 400 KB works best.</li>
  <li>Press <b>Save emblem</b>.</li>
</ol>
{$fig('emblem', 'The family emblem card with a preview, colour picker and a grid of built-in marks')}
<h2 id="cover">Add a cover picture</h2>
<p>Every member card has a wide band across the top with the emblem in its corner. Under <b>Tree Settings &gt; Cover picture</b>, press <b>Upload a picture</b> to put the family home, a village or an old group photo there. Wide pictures work best. Without one, cards use a soft tint of your tree's look.</p>
HTML],

    'tree-looks' => ['section' => 'Share and show', 'title' => 'Choose a look for your tree', 'mins' => 1,
        'summary' => 'Six looks for colours, card shape and lettering, each in light and dark.',
        'body' => <<<HTML
<p>The look sets the colours, the shape of the cards and the lettering of names across the tree, timeline, map and memory book. Every look has a light and a dark version; visitors still switch between light and dark themselves.</p>
{$clip('tree-looks', 'The Romanov tree in Heritage, Banyan, Royal, Minimal, Parchment and Marigold.')}
<ol class="g-steps">
  <li>Open <b>Admin &gt; Tree Settings &gt; Tree look</b>.</li>
  <li>Pick one. Each tile shows it in light and dark.</li>
  <li>Press <b>Save look</b> and open your tree.</li>
</ol>
{$fig('looks', 'The Tree look card with six tiles: Heritage, Banyan, Royal, Minimal, Parchment and Marigold')}
<ul>
  <li><b>Heritage</b>: warm parchment and candlelight, the default.</li>
  <li><b>Banyan</b>: leaf greens.</li>
  <li><b>Royal</b>: midnight blue with gold, square cards and capital lettering.</li>
  <li><b>Minimal</b>: plain greys, modern lettering.</li>
  <li><b>Parchment</b>: sepia ink, like an old register.</li>
  <li><b>Marigold</b>: saffron and maroon, for weddings and festivals.</li>
</ul>
HTML],

    'print' => ['section' => 'Share and show', 'title' => 'Print a poster or a family book', 'mins' => 2,
        'summary' => 'A wall chart of the whole family, sized for A3 to A0, and a printed book with a page for every person.',
        'body' => <<<HTML
<h2 id="poster">A poster</h2>
<ol class="g-steps">
  <li>Open your tree and press <b>Print</b> at the top.</li>
  <li>Choose who to start from (or leave it on automatic), descendants or ancestors, how many generations, the paper size and the look.</li>
  <li>Press <b>Download PDF</b>. It's a sharp, vector file that any print shop can print at full size.</li>
</ol>
{$fig('poster', 'The poster page with options on the left and a preview of the Curie family chart')}
<p>For a very large family, pick <b>Long banner</b>: a strip as long as the tree needs, for print-shop roll paper. Under the button, the page tells you how big names will print.</p>
<h2 id="book">A family book</h2>
<p>Switch to <b>Family book</b>: a cover with your emblem, a list of everyone by generation, then a page for each person with their photo, dates, places, family and story, plus a few photos from the memory book. Press <b>Print / Save as PDF</b> and choose Save as PDF.</p>
{$fig('book', 'The family book page for the Curie family')}
{$note('The poster and the book show exactly what visitors to your tree can see, so private details stay private when printed.', 'info')}
HTML],

    'weekly-email' => ['section' => 'Share and show', 'title' => 'The weekly family email', 'mins' => 1,
        'summary' => 'Every Monday: the week\'s birthdays, anniversaries, remembrance days and tithis.',
        'body' => <<<HTML
<p>Everyone with an account on a tree gets a short email on Monday mornings when something is coming up that week: birthdays (with the age), wedding anniversaries, the years since someone passed, and shraddh tithis. Nothing is sent in a quiet week.</p>
<p>Turn it off or on in <b>Admin &gt; Profile &gt; Weekly email</b>, or with the link at the bottom of any of these emails.</p>
<p>Running your own copy? See <a href="/guide/self-hosting#weekly">the weekly job</a>.</p>
HTML],

    /* ── Your data ─────────────────────────────────────────────────────── */
    'data-homes' => ['section' => 'Your data', 'title' => 'Choose where your family\'s data lives', 'mins' => 3,
        'summary' => 'Keep it here, or in your own Google Sheet, Airtable base or database. Switch any time.',
        'body' => <<<HTML
<p>By default your tree is stored in FamilyTree's database, and there is nothing to set up. If you would rather hold the data yourself, each tree can keep its people, photos and tags somewhere you own. Your login and the tree's link stay here either way.</p>
<table class="g-table">
  <thead><tr><th>Home</th><th>Cost</th><th>Good for</th></tr></thead>
  <tbody>
    <tr><td>FamilyTree's database</td><td>Free</td><td>Most families. Nothing to set up.</td></tr>
    <tr><td><a href="/guide/google-sheets">A Google Sheet</a></td><td>Free</td><td>Seeing and editing the data as a spreadsheet.</td></tr>
    <tr><td><a href="/guide/airtable">An Airtable base</a></td><td>Free to 1,000 records</td><td>People who already use Airtable.</td></tr>
    <tr><td><a href="/guide/own-database">Your own MySQL or Postgres</a></td><td>Free tiers exist</td><td>Technical families and big trees.</td></tr>
    <tr><td>A SQLite or JSON file</td><td>Free</td><td>Self-hosted installs and the desktop app.</td></tr>
  </tbody>
</table>
{$fig('datahome-sheets', 'The data home card listing the choices, with Google Sheet selected and its form shown')}
<h2 id="switch">Switching</h2>
<ol class="g-steps">
  <li>Open <b>Admin &gt; Tree Settings &gt; Where your family's data lives</b> and pick a home.</li>
  <li>Fill in its details, then press <b>Test</b>. If it is empty, press <b>Set up</b> to create the tables or tabs.</li>
  <li>Keep <b>Copy the current data into the new home</b> ticked and press <b>Switch to this</b>.</li>
</ol>
<p>Everything is copied with the same ids, so links between people never break. The old copy is left where it was. You can move back at any time the same way.</p>
{$note('Passwords, tokens and keys you enter are encrypted before they are saved, and never shown again.', 'info')}
HTML],

    'google-sheets' => ['section' => 'Your data', 'title' => 'Keep your tree in a Google Sheet', 'mins' => 6,
        'summary' => 'Free. The family data lives in two tabs you can open and edit by hand.',
        'body' => <<<HTML
<p>Your tree's people go in a <b>Members</b> tab and photos in a <b>Media</b> tab of a Google Sheet that you own. FamilyTree reads and writes it through a Google service account, a robot account that you share the sheet with. Setting it up takes about ten minutes, once.</p>
<h2 id="sheet">1. Make a blank sheet</h2>
<ol class="g-steps">
  <li>Go to <a href="https://sheets.new" rel="noopener">sheets.new</a> and name it, for example <em>Sharma family tree</em>.</li>
  <li>Copy its link from the address bar.</li>
</ol>
<h2 id="service-account">2. Make a service account (Google Cloud, free)</h2>
<ol class="g-steps">
  <li>Open <a href="https://console.cloud.google.com/projectcreate" rel="noopener">Google Cloud Console</a> and create a project, for example <em>familytree</em>. No billing is needed.</li>
  <li>In the search bar, find <b>Google Sheets API</b> and press <b>Enable</b>.</li>
  <li>Go to <b>IAM &amp; Admin &gt; Service Accounts</b> and press <b>Create service account</b>. Any name will do; skip the optional steps.</li>
  <li>Open the new account, go to <b>Keys &gt; Add key &gt; Create new key</b>, choose <b>JSON</b>. A small file downloads.</li>
  <li>Open that file in a text editor and find <code>client_email</code>. It looks like <code>familytree@your-project.iam.gserviceaccount.com</code>.</li>
</ol>
<h2 id="share">3. Share the sheet with it</h2>
<p>In your sheet, press <b>Share</b>, paste the <code>client_email</code>, choose <b>Editor</b>, untick <em>Notify people</em> and press <b>Share</b>.</p>
<h2 id="connect">4. Connect it</h2>
<ol class="g-steps">
  <li>In <b>Admin &gt; Tree Settings &gt; Where your family's data lives</b>, choose <b>A Google Sheet</b>.</li>
  <li>Paste the sheet's link, and paste the whole contents of the JSON key file into <b>Service account key</b>.</li>
  <li>Press <b>Test</b>, then <b>Set up</b>. The Members and Media tabs appear in your sheet.</li>
  <li>Press <b>Switch to this</b>. Your tree is copied into the sheet.</li>
</ol>
{$fig('datahome-sheets', 'The Google Sheet form with the sheet link and service account key fields')}
{$note('<b>Editing by hand:</b> you can change names, dates and places in the sheet and the tree shows them. Keep the header row and the <code>id</code> column as they are, and do not reuse an id. Keep the key file somewhere safe: anyone with it can edit the sheet.', 'warn')}
HTML],

    'airtable' => ['section' => 'Your data', 'title' => 'Keep your tree in Airtable', 'mins' => 4,
        'summary' => 'Free up to 1,000 records per base. A personal access token is all it needs.',
        'body' => <<<HTML
<ol class="g-steps">
  <li>In Airtable, create an empty base, for example <em>Family tree</em>. Copy its id from the address bar: the part that starts with <code>app</code>.</li>
  <li>Open <a href="https://airtable.com/create/tokens" rel="noopener">airtable.com/create/tokens</a> and press <b>Create token</b>.</li>
  <li>Add these scopes: <code>data.records:read</code>, <code>data.records:write</code>, <code>schema.bases:read</code>, <code>schema.bases:write</code>.</li>
  <li>Under <b>Access</b>, add only your family tree base. Create the token and copy it; Airtable shows it once.</li>
  <li>In <b>Admin &gt; Tree Settings &gt; Where your family's data lives</b>, choose <b>An Airtable base</b>, paste the base id and the token.</li>
  <li>Press <b>Test</b>, then <b>Set up</b> (it creates the Members and Media tables), then <b>Switch to this</b>.</li>
</ol>
{$fig('datahome-airtable', 'The Airtable form with base id and personal access token fields')}
{$note('The free Airtable plan allows 1,000 records per base. People and photos both count, so a tree with 600 people and 300 photos fits; a larger one needs a paid Airtable plan or another home.', 'info')}
HTML],

    'own-database' => ['section' => 'Your data', 'title' => 'Use your own MySQL or Postgres', 'mins' => 3,
        'summary' => 'Point a tree at a database you control: your hosting plan, Neon, Supabase, Aiven.',
        'body' => <<<HTML
<p>Any MySQL, MariaDB or Postgres database that can be reached from the internet will do. Free tiers from Neon, Supabase and Aiven are enough for even very large trees, and most web hosting plans include MySQL.</p>
<ol class="g-steps">
  <li>Create an empty database and a user for it. Note the host, port, database name, user and password.</li>
  <li>Allow outside connections if your host asks (often called <em>remote MySQL</em> or an IP allow list).</li>
  <li>In <b>Admin &gt; Tree Settings &gt; Where your family's data lives</b>, choose <b>My own MySQL / MariaDB</b> or <b>My own Postgres</b> and fill in the details. Tick <b>Connect over TLS</b> for managed hosts.</li>
  <li>Press <b>Test</b>, then <b>Set up</b> to create the tables, then <b>Switch to this</b>.</li>
</ol>
{$fig('datahome-mysql', 'The database form with host, port, database name, user, password and a TLS option')}
<p>The user needs permission to create tables once, for <b>Set up</b>; after that it only reads and writes rows.</p>
HTML],

    'backups' => ['section' => 'Your data', 'title' => 'Back up and take your tree with you', 'mins' => 2,
        'summary' => 'A full backup in one file, GEDCOM for other family tree sites, and CSV for spreadsheets.',
        'body' => <<<HTML
<p>Your tree is yours. On <b>Admin &gt; Members</b>, the <b>Export</b> menu has:</p>
<ul>
  <li><b>Full backup (JSON)</b>: everything, people, partners, photos and tags, in one file. Import it into any FamilyTree, including your own install or the desktop app, and get the same tree back.</li>
  <li><b>Export GEDCOM</b>: the standard format every family tree program reads: Ancestry, MyHeritage, Gramps, RootsMagic and the rest.</li>
  <li><b>Export CSV</b> and <b>Export JSON</b>: the people as a plain list, for spreadsheets.</li>
</ul>
{$fig('members', 'The Members page with the Export and Import buttons above the list of people')}
{$note('Make a full backup now and then, and keep it with your other important files. Photos are linked in the backup; download any you care about too.')}
HTML],

    'tidy-up' => ['section' => 'Your data', 'title' => 'Undo, the bin and duplicates', 'mins' => 3,
        'summary' => 'Every change can be undone, deleted people can be brought back, and people entered twice can be merged.',
        'body' => <<<HTML
<p>When more relatives edit a tree, mistakes happen. <b>Admin &gt; Tidy up</b> fixes them.</p>
<h2 id="history">History and Undo</h2>
<p>Every change is recorded: who made it, when, and what changed, field by field. Press <b>Undo</b> next to any change to put things back as they were. A delete that also unlinked someone's children and partner is undone in one go. The <b>History</b> button on a person's card shows only their changes.</p>
{$fig('tidy-history', 'The History tab listing recent changes, each with an Undo button')}
<h2 id="bin">The bin</h2>
<p>Anyone deleted from the tree waits in the <b>Bin</b>. Press <b>Restore</b> and they come back with the same id, their parents, partners and children reconnected.</p>
<h2 id="duplicates">Merging duplicates</h2>
<p>Two relatives adding the same uncle, or an import added on top of an existing tree, leaves people entered twice. <b>Possible duplicates</b> finds them by name (ignoring titles like Late, Shri or Smt), birth year, birthplace and parents' names, and shows how alike each pair is.</p>
<ol class="g-steps">
  <li>Press <b>Compare and merge</b> to see both entries side by side.</li>
  <li>Choose which entry to keep, and for each detail that differs, which value is right.</li>
  <li>Press <b>Merge into one person</b>. Children, partners, photo tags and accounts all move to the person you keep, and sources are combined.</li>
</ol>
{$fig('tidy-merge', 'Two entries of Sita Devi compared side by side with a choice for each differing detail')}
<p>Not the same person after all? Press <b>Not the same person</b> and the pair won't be suggested again.</p>
HTML],

    /* ── Bring and connect ─────────────────────────────────────────────── */
    'importing' => ['section' => 'Bring and connect', 'title' => 'Move your tree here from another site', 'mins' => 6,
        'summary' => 'Export a GEDCOM file from Ancestry, MyHeritage, FamilySearch, Geni or any program, then import it here.',
        'body' => <<<HTML
<p>Almost every family tree site and program can save your tree as a <b>GEDCOM</b> file (<code>.ged</code>). FamilyTree reads it: people, dates, places, partners, children, notes, occupations and photo links. Some sites give you a <code>.zip</code>; you can import that as it is.</p>
<h2 id="import">Import the file</h2>
<ol class="g-steps">
  <li>Open <b>Admin &gt; Members</b> and press <b>Import</b>.</li>
  <li>Choose your <code>.ged</code>, <code>.zip</code> or FamilyTree backup <code>.json</code>. You see how many people, dates and places it holds, before anything changes.</li>
  <li>Choose <b>Add alongside</b> to merge it into the people you already have, or <b>Replace</b> to start the tree over from the file.</li>
</ol>
{$fig('import', 'The import dialog showing a preview: 5 people, 2 exact births, 1 place, and the names found')}
{$note('Dates like "about 1890" or "before 1902" are kept in the person\'s biography rather than turned into a wrong exact date.', 'info')}
<h2 id="export-elsewhere">Getting the file out of other sites</h2>
<p>Menu names change from time to time; if a step does not match, look for <em>Export</em> or <em>Download GEDCOM</em> in the tree's settings.</p>
<h3 id="ancestry">Ancestry</h3>
<ol class="g-steps">
  <li>On the website (not the app), open <b>Trees</b> and pick your tree.</li>
  <li>From the tree name's menu, choose <b>Tree Settings</b>.</li>
  <li>Under <em>Manage your tree</em>, press <b>Export tree</b>, then <b>Download your GEDCOM file</b> when it is ready.</li>
</ol>
<p>Free, no subscription needed; only the tree's owner can export. Photos are not included, so save the ones you want from the Media Gallery.</p>
<h3 id="myheritage">MyHeritage</h3>
<ol class="g-steps">
  <li>Go to <b>Family tree &gt; Manage trees</b>.</li>
  <li>Press <b>Export to GEDCOM</b> next to your tree, then <b>Begin the export</b>.</li>
  <li>MyHeritage emails you a download link when the file is ready.</li>
</ol>
<p>In the Family Tree Builder desktop program: <b>File &gt; Export GEDCOM</b>.</p>
<h3 id="familysearch">FamilySearch</h3>
<p>FamilySearch does not export its shared Family Tree as GEDCOM. Use a free program that can download from it:</p>
<ol class="g-steps">
  <li>Install <a href="https://www.rootsmagic.com/" rel="noopener">RootsMagic Essentials</a> (free, Windows and Mac).</li>
  <li>Choose <b>Create a New RootsMagic file &gt; Download from an Online Tree &gt; FamilySearch</b>, sign in, pick the starting person and how many generations, and import.</li>
  <li>Then <b>File &gt; Export Data &gt; GEDCOM File</b>.</li>
</ol>
<h3 id="geni">Geni</h3>
<p><b>Family &gt; Share your tree &gt; GEDCOM Export</b>. Choose blood relatives, ancestors or descendants, set the type to <b>GEDCOM 5.5</b>, and export. Free accounts can export a limited number of profiles.</p>
<h3 id="findmypast">Findmypast</h3>
<p><b>Family tree &gt; View all trees</b>, press the <b>Export</b> icon next to the tree, then <b>Download tree</b>.</p>
<h3 id="geneanet">Geneanet</h3>
<p>In your tree's <b>Operations &gt; Export</b>, choose <b>GEDCOM</b> and submit. You get a <code>.zip</code>; import it here as it is.</p>
<h3 id="familyecho">Family Echo</h3>
<p>Click anyone, then <b>Download / export this family</b> in the side panel, choose <b>GEDCOM</b>, and download.</p>
<h3 id="wikitree">WikiTree</h3>
<p>From <em>Help: GEDCOM</em>, use the GEDCOM download page: choose ancestors or descendants and enter the WikiTree id of the starting person.</p>
<h3 id="desktop">Gramps, RootsMagic, Legacy, Family Tree Maker</h3>
<ul>
  <li><b>Gramps</b>: <b>Family Trees &gt; Export</b>, choose GEDCOM. Check the privacy and living-people filters, which are remembered from last time.</li>
  <li><b>RootsMagic</b>: <b>File &gt; Export Data &gt; GEDCOM File</b>.</li>
  <li><b>Legacy</b>: <b>File &gt; Export to &gt; GEDCOM File</b>, and choose <em>GEDCOM 5.5 (Standard)</em>.</li>
  <li><b>Family Tree Maker</b>: <b>File &gt; Export</b>, choose GEDCOM. Do not password-protect the zip.</li>
</ul>
{$note('<b>Two things to check.</b> No site puts photos inside a GEDCOM file, so download the photos you want separately and add them on the Photos page. And many sites offer to hide or blank out living people when exporting; turn that off if you want your whole family to come across.', 'warn')}
HTML],

    'claude' => ['section' => 'Bring and connect', 'title' => 'Connect Claude to your tree', 'mins' => 3,
        'summary' => 'Ask Claude how two people are related, add relatives by describing them, or import a file by pasting it.',
        'body' => <<<HTML
<p>FamilyTree has a connector for Claude, the AI assistant. Once connected, you can talk to your tree:</p>
<ul>
  <li>"How is Ravi related to Kamla?"</li>
  <li>"Whose birthdays are coming up this month?"</li>
  <li>"Add my cousin Neha, born 3 May 1994 in Patna, daughter of Arun and Meena."</li>
  <li>"Mohan moved to Bengaluru last year, update him."</li>
  <li>"Here is a GEDCOM file from my uncle, add it to the tree."</li>
</ul>
<h2 id="key">1. Make a connector link</h2>
<ol class="g-steps">
  <li>Open <b>Admin &gt; Profile</b> and find <b>Connect Claude</b>.</li>
  <li>Name the key, for example <em>Claude Desktop</em>, and press <b>Make a connector link</b>.</li>
  <li>Copy the link. It is shown only once; if you lose it, make a new one.</li>
</ol>
{$fig('claude-card', 'The Connect Claude card with a new connector link and the list of keys')}
<h2 id="add">2. Add it to Claude</h2>
<ul>
  <li><b>claude.ai or Claude Desktop</b>: <b>Settings &gt; Connectors &gt; Add custom connector</b>. Give it a name, paste the link, and add.</li>
  <li><b>Claude Code</b>: <code>claude mcp add --transport http familytree "&lt;your link&gt;"</code></li>
</ul>
<p>Then ask Claude about your family in any chat.</p>
<h2 id="safety">What Claude can do</h2>
<p>Claude acts as you, with your role in each tree: a viewer can only ask questions, an editor can also add and change people, an owner can import and remove people. Claude asks before it changes anything when a name matches more than one person. Every change shows in the Activity Log.</p>
{$note('The link works like a password. Do not share it. Press <b>Revoke</b> next to a key to cut it off at once.', 'warn')}
HTML],

    /* ── Run it yourself ───────────────────────────────────────────────── */
    'self-hosting' => ['section' => 'Run it yourself', 'title' => 'Run FamilyTree on your own server', 'mins' => 4,
        'summary' => 'Free and open source. Shared hosting, a VPS or Docker, in about five minutes.',
        'body' => <<<HTML
<p>FamilyTree is open source under the AGPL-3.0 licence. The code is on <a href="https://github.com/ravirahul/familytree" rel="noopener">GitHub</a>, and this site runs the same code.</p>
<h2 id="needs">What you need</h2>
<ul>
  <li>PHP 8.1 or newer with PDO, mbstring and OpenSSL. cURL for maps, Google Sheets and Airtable; GD for share cards and thumbnails.</li>
  <li>MySQL or MariaDB, or nothing at all: SQLite works out of the box.</li>
  <li>Apache with <code>.htaccess</code> (most shared hosting), or Nginx with the rules from the README.</li>
</ul>
<h2 id="install">Install</h2>
<ol class="g-steps">
  <li>Download the code from GitHub and upload the <code>public_html</code> folder to your web space.</li>
  <li>Open <code>https://your-site/install/</code>. It checks the server, connects to MySQL or makes a SQLite file, creates the tables, and makes your account and first tree.</li>
  <li>That's it. The installer locks itself afterwards.</li>
</ol>
<h2 id="docker">With Docker</h2>
<pre><code>git clone https://github.com/ravirahul/familytree
cd familytree
docker compose up -d
# then open http://localhost:8080/install/</code></pre>
<h2 id="upgrade">Upgrading</h2>
<h2 id="weekly">The weekly job</h2>
<p>Once a week, <code>cron.php</code> sends the family email, makes a backup of every tree (the last 8 are kept) and clears out old data. Add a cron job in your hosting panel, Monday morning:</p>
<pre><code>php /home/you/public_html/cron.php weekly</code></pre>
<p>Or set <code>CRON_KEY</code> in <code>.env</code> and call <code>https://your-site/cron.php?key=…</code> from any web cron service.</p>
<h2 id="upgrade-files">Upgrading the files</h2>
<p>Upload the new files over the old ones, keeping your <code>.env</code>, <code>storage/</code> and <code>admin/uploads/</code>. On MySQL, run any new files in <code>install/upgrades/</code> once. On SQLite, the app brings the tables up to date itself.</p>
HTML],

    'desktop-app' => ['section' => 'Run it yourself', 'title' => 'FamilyTree on your own computer', 'mins' => 2,
        'summary' => 'The same app in a window, no server and no account. Keep the folder in Drive for sync.',
        'body' => <<<HTML
<p>The desktop app runs FamilyTree on your computer with everything bundled. Your tree is one folder: a SQLite file, your photos and a settings file. Put that folder inside Google Drive, Dropbox or OneDrive and you get backup and sync between computers for free.</p>
<h2 id="build">Getting it</h2>
<p>Ready-made installers are not published yet. If you are comfortable with a terminal, build it from the code:</p>
<pre><code>git clone https://github.com/ravirahul/familytree
cd familytree/desktop
npm install
npm run fetch-php   # downloads PHP for your computer
npm start           # or: npm run dist, for an installer</code></pre>
<p>On first start it asks where to keep your tree, then opens the installer in the window. Everything else works as on the website, including <a href="/guide/importing">import</a>, <a href="/guide/backups">backups</a> and the <a href="/guide/data-homes">JSON file home</a>.</p>
HTML],
    ];
}

/** The page order in the guide's sections, used for the index and for previous / next links. */
function ft_guide_sections(): array {
    $out = [];
    foreach (ft_guides() as $slug => $g) $out[$g['section']][$slug] = $g;
    return $out;
}
