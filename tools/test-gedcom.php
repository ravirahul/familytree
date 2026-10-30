<?php
/**
 * tools/test-gedcom.php - the GEDCOM reader's one check.
 *
 *   php -d zend.assertions=1 -d assert.exception=1 tools/test-gedcom.php
 */
$pub = dirname(__DIR__) . '/public_html';
require $pub . '/includes/store.php';
require $pub . '/includes/gedcom.php';

$ged = "\xEF\xBB\xBF" . implode("\r\n", [
    '0 HEAD', '1 SOUR Ancestry.com', '1 GEDC', '2 VERS 5.5.1', '1 CHAR UTF-8',
    '0 @I1@ INDI', '1 NAME Ram Prasad /Sharma/', '2 NICK Ramji', '1 SEX M',
    '1 BIRT', '2 DATE 12 JAN 1920', '2 PLAC Darbhanga, Bihar, India', '2 SOUR @S1@', '3 PAGE p. 12',
    '1 DEAT', '2 DATE ABT 1990', '1 OCCU Teacher', '1 NOTE Taught at the village school', '2 CONT for forty years.',
    '1 FAMS @F1@', '1 FAMS @F2@',
    '0 @I2@ INDI', '1 NAME Sita /Devi/', '1 SEX F', '1 BIRT', '2 DATE BET 1922 AND 1925', '1 DEAT Y', '1 FAMS @F1@',
    '1 OBJE', '2 FILE https://example.org/sita.jpg', '3 FORM jpg', '2 TITL Sita at her wedding',
    '0 @I3@ INDI', '1 NAME Mohan /Sharma/', '1 SEX M', '1 BIRT', '2 DATE 3 MAR 1945', '1 FAMC @F1@', '1 NOTE @N1@',
    '0 @I4@ INDI', '1 NAME Kamla /Jha/', '1 SEX F', '1 FAMS @F2@',
    '0 @I5@ INDI', '1 NAME Anjali /Sharma/', '1 SEX F', '1 BIRT', '2 DATE 1999', '1 FAMC @F2@', '2 PEDI adopted',
    '0 @F1@ FAM', '1 HUSB @I1@', '1 WIFE @I2@', '1 CHIL @I3@', '1 MARR', '2 DATE 5 MAY 1943',
    '0 @F2@ FAM', '1 HUSB @I1@', '1 WIFE @I4@', '1 CHIL @I5@', '1 MARR', '2 DATE 1 JUN 1960', '1 DIV', '2 DATE 4 APR 1975',
    '0 @S1@ SOUR', '1 TITL Village school register', '1 AUTH Darbhanga school',
    '0 @N1@ NOTE Moved to Delhi in 1970.',
    '0 TRLR',
]);

$r = ft_gedcom_read($ged);
$by = []; foreach ($r['members'] as $m) $by[$m['name']] = $m;

assert(count($r['members']) === 5 && $r['stats']['families'] === 2, 'five people, two families');
$ram = $by['Ram Prasad Sharma'];
assert($ram['nickname'] === 'Ramji' && $ram['gender'] === 'male', 'name, nickname, sex');
assert($ram['birth_date'] === '1920-01-12' && $ram['birth_location'] === 'Darbhanga, Bihar, India', 'exact birth and place');
assert($ram['death_date'] === null && $ram['is_alive'] === 0, 'an approximate death is not a date, but he is dead');
assert($ram['extra']['death_approx'] === ['q' => 'abt', 'y' => 1990] && !str_contains($ram['wiki'], 'about 1990'), 'an approximate date is kept as one, not as text');
assert(str_contains($ram['wiki'], 'Teacher') && str_contains($ram['wiki'], "school\nfor forty years"), 'occupation and a continued note go to the biography');
assert($ram['extra']['sources'][0] === ['fact' => 'birth', 'title' => 'Village school register', 'page' => 'p. 12', 'note' => 'Darbhanga school'], 'a cited source record');
assert(count($ram['pids']) === 2, 'two marriages');
assert($ram['anniversary_date'] === '1943-05-05', 'marriage date');
$sita = $by['Sita Devi'];
assert($sita['is_alive'] === 0 && $sita['birth_date'] === null && $sita['extra']['birth_approx'] === ['q' => 'bet', 'y' => 1922, 'y2' => 1925], 'DEAT Y means dead; a range is kept as a range');
assert($sita['img'] === 'https://example.org/sita.jpg' && count($r['media']) === 1 && $r['media'][0]['member_ids'] === [$sita['id']], 'online photo kept and tagged');
$mohan = $by['Mohan Sharma'];
assert($mohan['fid'] === $ram['id'] && $mohan['mid'] === $sita['id'], 'parents from the first family');
assert(str_contains($mohan['wiki'], 'Moved to Delhi'), 'a note stored as its own record');
$anjali = $by['Anjali Sharma'];
assert($anjali['fid'] === $ram['id'] && $anjali['mid'] === $by['Kamla Jha']['id'], 'a child of the second marriage');
assert($anjali['birth_date'] === null && $anjali['is_alive'] === 1 && $anjali['extra']['birth_approx'] === ['q' => 'year', 'y' => 1999], 'a year alone is kept as a year');
assert($anjali['extra']['father_kind'] === 'adoptive' && $anjali['extra']['mother_kind'] === 'adoptive', 'PEDI adopted');
$kamla = $by['Kamla Jha'];
assert($kamla['extra']['partners'][(string)$ram['id']] === ['married' => '1960-06-01', 'end' => 'divorce', 'ended' => '1975-04-04'], 'marriage and divorce dates on the partnership');
assert($ram['extra']['partners'][(string)$sita['id']] === ['married' => '1943-05-05'], 'first marriage, still together');

$utf16 = "\xFF\xFE" . mb_convert_encoding("0 HEAD\r\n0 @I1@ INDI\r\n1 NAME Zoë /Müller/\r\n0 TRLR", 'UTF-16LE', 'UTF-8');
assert(ft_gedcom_read($utf16)['members'][0]['name'] === 'Zoë Müller', 'UTF-16 files');

$threw = false; try { ft_gedcom_read('hello'); } catch (RuntimeException $e) { $threw = true; }
assert($threw, 'not a GEDCOM file is refused');
echo "gedcom: ok\n";
