/**
 * assets/kinship-hi.js - Indian (Hindi) relationship words: Mama, Bua, Tau, Bhabhi, Saala, Samdhi...
 *
 * ftIndianTerm(aId, bId, members) walks the shortest path from A to B through parents (F/M),
 * children (S/D), partners (H/W) and siblings (B/Z), then names it from A's side:
 *   "MB" = mother's brother = Mama. Where Hindi cares who is older (Tau or Chacha, Didi, Jeth or Devar)
 *   it compares birth years; without them it gives both words.
 * Returns { roman, hindi, english, path } or null when there's no common word for the path.
 * The same table lives in includes/kinship.php (ft_indian_term) for the Claude connector.
 */
(function () {
  // [roman, devanagari] pairs; a function picks by age ('older' | 'younger' | null)
  const T = {
    F: ['Pitaji', 'पिताजी'], M: ['Maa', 'माँ'], S: ['Beta', 'बेटा'], D: ['Beti', 'बेटी'], H: ['Pati', 'पति'], W: ['Patni', 'पत्नी'],
    B: a => a === 'older' ? ['Bhaiya', 'भैया'] : a === 'younger' ? ['Chhota bhai', 'छोटा भाई'] : ['Bhai', 'भाई'],
    Z: a => a === 'older' ? ['Didi', 'दीदी'] : a === 'younger' ? ['Chhoti behen', 'छोटी बहन'] : ['Behen', 'बहन'],
    FF: ['Dada', 'दादा'], FM: ['Dadi', 'दादी'], MF: ['Nana', 'नाना'], MM: ['Nani', 'नानी'],
    FB: a => a === 'older' ? ['Tau', 'ताऊ'] : a === 'younger' ? ['Chacha', 'चाचा'] : ['Chacha / Tau', 'चाचा / ताऊ'],
    FBW: a => a === 'older' ? ['Tai', 'ताई'] : a === 'younger' ? ['Chachi', 'चाची'] : ['Chachi / Tai', 'चाची / ताई'],
    FZ: ['Bua', 'बुआ'], FZH: ['Fufa', 'फूफा'], MB: ['Mama', 'मामा'], MBW: ['Mami', 'मामी'], MZ: ['Mausi', 'मौसी'], MZH: ['Mausa', 'मौसा'],
    FBS: ['Chachera bhai', 'चचेरा भाई'], FBD: ['Chacheri behen', 'चचेरी बहन'], FZS: ['Phuphera bhai', 'फुफेरा भाई'], FZD: ['Phupheri behen', 'फुफेरी बहन'],
    MBS: ['Mamera bhai', 'ममेरा भाई'], MBD: ['Mameri behen', 'ममेरी बहन'], MZS: ['Mausera bhai', 'मौसेरा भाई'], MZD: ['Mauseri behen', 'मौसेरी बहन'],
    BS: ['Bhatija', 'भतीजा'], BD: ['Bhatiji', 'भतीजी'], ZS: ['Bhanja', 'भांजा'], ZD: ['Bhanji', 'भांजी'],
    BW: ['Bhabhi', 'भाभी'], ZH: a => a === 'younger' ? ['Behnoi', 'बहनोई'] : ['Jija', 'जीजा'],
    SS: ['Pota', 'पोता'], SD: ['Poti', 'पोती'], DS: ['Nati', 'नाती'], DD: ['Natin', 'नातिन'],
    SW: ['Bahu', 'बहू'], DH: ['Damad', 'दामाद'],
    HF: ['Sasur', 'ससुर'], HM: ['Saas', 'सास'], WF: ['Sasur', 'ससुर'], WM: ['Saas', 'सास'],
    HB: a => a === 'older' ? ['Jeth', 'जेठ'] : a === 'younger' ? ['Devar', 'देवर'] : ['Devar / Jeth', 'देवर / जेठ'],
    HBW: a => a === 'older' ? ['Jethani', 'जेठानी'] : a === 'younger' ? ['Devrani', 'देवरानी'] : ['Devrani / Jethani', 'देवरानी / जेठानी'],
    HZ: ['Nanad', 'ननद'], HZH: ['Nandoi', 'ननदोई'], WB: ['Saala', 'साला'], WBW: ['Salhaj', 'सलहज'], WZ: ['Saali', 'साली'], WZH: ['Saadhu', 'साढ़ू'],
    SWF: ['Samdhi', 'समधी'], SWM: ['Samdhan', 'समधन'], DHF: ['Samdhi', 'समधी'], DHM: ['Samdhan', 'समधन'],
    FW: ['Sauteli maa', 'सौतेली माँ'], MH: ['Sautele pita', 'सौतेले पिता'],
    BSW: ['Bahu (bhatije ki patni)', 'बहू'], FFB: ['Dada (dada ke bhai)', 'दादा'], FFZ: ['Dadi (dada ki behen)', 'दादी'],
    MMB: ['Nana (nani ke bhai)', 'नाना'], MFB: ['Nana (nana ke bhai)', 'नाना'],
  };
  const EN = { F: "father", M: "mother", S: "son", D: "daughter", H: "husband", W: "wife", B: "brother", Z: "sister" };
  // the person whose age decides the word: for B/Z compare with A; for FB with F; for HB with H...
  const AGE_REF = { B: 0, Z: 0, FB: 1, FBW: 1, ZH: 0, HB: 1, HBW: 1 };

  const year = m => { const y = parseInt(String((m && m.birth_date) || '').slice(0, 4), 10); return y > 0 ? y : null; };

  function neighbours(m, byId, kids, siblingsOf) {
    const out = [];
    const g = p => (p && p.gender) === 'female' ? 'f' : 'm';
    if (m.fid && byId.get(m.fid)) out.push(['F', m.fid]);
    if (m.mid && byId.get(m.mid)) out.push(['M', m.mid]);
    for (const s of siblingsOf(m)) out.push([g(s) === 'f' ? 'Z' : 'B', s.id]);
    for (const c of kids.get(m.id) || []) out.push([g(c) === 'f' ? 'D' : 'S', c.id]);
    for (const p of m.pids || []) { const s = byId.get(p); if (s) out.push([g(s) === 'f' ? 'W' : 'H', s.id]); }
    return out;
  }

  window.ftIndianTerm = function (aId, bId, members) {
    if (!members || aId === bId) return null;
    const byId = new Map(members.map(m => [m.id, m]));
    const kids = new Map();
    members.forEach(m => [m.fid, m.mid].forEach(p => { if (p) { if (!kids.has(p)) kids.set(p, []); kids.get(p).push(m); } }));
    const siblingsOf = m => {
      const set = new Map();
      [m.fid, m.mid].forEach(p => (p ? kids.get(p) || [] : []).forEach(c => { if (c.id !== m.id) set.set(c.id, c); }));
      return [...set.values()];
    };
    // breadth-first, at most 4 steps (no common word lies further out)
    const prev = new Map([[aId, null]]);
    let frontier = [aId];
    for (let depth = 0; depth < 4 && frontier.length && !prev.has(bId); depth++) {
      const next = [];
      for (const id of frontier) {
        const m = byId.get(id); if (!m) continue;
        for (const [step, to] of neighbours(m, byId, kids, siblingsOf)) {
          if (prev.has(to)) continue;
          prev.set(to, [id, step]); next.push(to);
        }
      }
      frontier = next;
    }
    if (!prev.has(bId)) return null;
    const steps = [], ids = [bId];
    for (let cur = bId; prev.get(cur); cur = prev.get(cur)[0]) { steps.unshift(prev.get(cur)[1]); ids.unshift(prev.get(cur)[0]); }
    const key = steps.join('');
    // a father's wife who is your mother is just Maa: the path finder already prefers M
    let entry = T[key];
    // three generations up or down: par-dada / par-nana, par-pota
    if (!entry && /^[FM][FM][FM]$/.test(key)) entry = key[0] === 'F' ? (key[2] === 'F' ? ['Pardada', 'परदादा'] : ['Pardadi', 'परदादी']) : (key[2] === 'F' ? ['Parnana', 'परनाना'] : ['Parnani', 'परनानी']);
    if (!entry && /^[SD][SD][SD]$/.test(key)) entry = key[0] === 'S' ? (key[2] === 'S' ? ['Parpota', 'परपोता'] : ['Parpoti', 'परपोती']) : (key[2] === 'S' ? ['Parnati', 'परनाती'] : ['Parnatin', 'परनातिन']);
    if (!entry) return null;
    if (typeof entry === 'function') {
      // age: compare B (the person named) with the reference person on the path
      const refIdx = AGE_REF[key];
      const ref = byId.get(ids[refIdx]), target = byId.get(ids[refIdx + 1]);
      const yr = year(ref), yt = year(target);
      entry = entry(yr && yt && yr !== yt ? (yt < yr ? 'older' : 'younger') : null);
    }
    const english = steps.map(s => EN[s]).join("'s ").replace(/^/, '');
    return { roman: entry[0], hindi: entry[1], english, path: key };
  };
})();
