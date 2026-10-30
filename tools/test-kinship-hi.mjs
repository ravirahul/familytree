// node tools/test-kinship-hi.mjs - Indian relationship words (assets/kinship-hi.js)
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
globalThis.window = globalThis;
eval(readFileSync(new URL('../public_html/assets/kinship-hi.js', import.meta.url), 'utf8'));

// Dadaji(1) + Dadi(2) -> Papa(3, 1960), Tauji(4, 1955), Chachaji(5, 1965), Bua(6)
// Nanaji(7) + Nani(8) -> Maa(9), Mama(10), Mausi(11)
// Papa + Maa -> Me(12, 1990, male), Didi(13, 1987), Chhota(14, 1995)
// Me + Wife(15) ; Wife's father(16) mother(17) brother(18) ; my son(19) + Bahu(20); my daughter(21) + Damad(22)
// Didi + Jija(23) ; Tauji + Tai(24) ; Tauji's son(25) ; Mama's son(26) ; Bahu's father(27)
const p = (id, name, gender, extra = {}) => ({ id, name, gender, pids: [], ...extra });
const M = [
  p(1, 'Dadaji', 'male', { pids: [2] }), p(2, 'Dadi', 'female', { pids: [1] }),
  p(3, 'Papa', 'male', { fid: 1, mid: 2, birth_date: '1960-01-01', pids: [9] }), p(4, 'Tauji', 'male', { fid: 1, mid: 2, birth_date: '1955-01-01', pids: [24] }),
  p(5, 'Chachaji', 'male', { fid: 1, mid: 2, birth_date: '1965-01-01' }), p(6, 'Bua', 'female', { fid: 1, mid: 2 }),
  p(7, 'Nanaji', 'male', { pids: [8] }), p(8, 'Nani', 'female', { pids: [7] }),
  p(9, 'Maa', 'female', { fid: 7, mid: 8, pids: [3] }), p(10, 'Mama', 'male', { fid: 7, mid: 8 }), p(11, 'Mausi', 'female', { fid: 7, mid: 8 }),
  p(12, 'Me', 'male', { fid: 3, mid: 9, birth_date: '1990-01-01', pids: [15] }), p(13, 'Didi', 'female', { fid: 3, mid: 9, birth_date: '1987-01-01', pids: [23] }),
  p(14, 'Chhota', 'male', { fid: 3, mid: 9, birth_date: '1995-01-01' }),
  p(15, 'Wife', 'female', { fid: 16, mid: 17, pids: [12] }), p(16, 'WifeFather', 'male', { pids: [17] }), p(17, 'WifeMother', 'female', { pids: [16] }), p(18, 'WifeBrother', 'male', { fid: 16, mid: 17 }),
  p(19, 'Son', 'male', { fid: 12, mid: 15, pids: [20] }), p(20, 'Bahu', 'female', { fid: 27, pids: [19] }), p(21, 'Daughter', 'female', { fid: 12, mid: 15, pids: [22] }), p(22, 'Damad', 'male', { pids: [21] }),
  p(23, 'Jija', 'male', { pids: [13] }), p(24, 'Tai', 'female', { pids: [4] }), p(25, 'TauSon', 'male', { fid: 4, mid: 24 }), p(26, 'MamaSon', 'male', { fid: 10 }),
  p(27, 'BahuFather', 'male'),
];
const t = (b, a = 12) => (ftIndianTerm(a, b, M) || {}).roman;
const cases = {
  1: 'Dada', 2: 'Dadi', 7: 'Nana', 8: 'Nani', 3: 'Pitaji', 9: 'Maa',
  4: 'Tau', 5: 'Chacha', 6: 'Bua', 10: 'Mama', 11: 'Mausi', 24: 'Tai',
  13: 'Didi', 14: 'Chhota bhai', 23: 'Jija', 25: 'Chachera bhai', 26: 'Mamera bhai',
  15: 'Patni', 16: 'Sasur', 17: 'Saas', 18: 'Saala', 19: 'Beta', 20: 'Bahu', 21: 'Beti', 22: 'Damad', 27: 'Samdhi',
};
for (const [b, want] of Object.entries(cases)) assert.equal(t(Number(b)), want, `Me -> ${M.find(m => m.id === Number(b)).name}`);
// from the wife's side: husband's elder sister is Nanad, his younger brother Devar
assert.equal(t(13, 15), 'Nanad'); assert.equal(t(14, 15), 'Devar');
// from the son: grandfather on the father's side is Dada; from Dadaji, Me is Pota
assert.equal(t(3, 19), 'Dada'); assert.equal(t(12, 1), 'Pota');
assert.equal(ftIndianTerm(12, 12, M), null);
console.log('kinship-hi: ok (' + (Object.keys(cases).length + 5) + ' cases)');
