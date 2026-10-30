/*
 * FTPanchang: Hindu lunar date (tithi) for a Gregorian date, and back.
 * Line-for-line port of includes/panchang.php; same API, same results.
 * See the PHP file for the conventions: 06:00 IST sunrise, amanta months
 * named by the Sun's Lahiri sign at the starting new moon, purnimanta
 * naming by default (Krishna paksha takes the next month's name).
 */
(function (root) {
  'use strict';

  var MASA_NAMES = ['Chaitra', 'Vaishakh', 'Jyeshtha', 'Ashadh', 'Shravan', 'Bhadrapad',
    'Ashwin', 'Kartik', 'Margashirsha', 'Paush', 'Magh', 'Phalgun'];
  // Index 0..14 = tithi 1..15. Tithi 15 is Purnima in Shukla, Amavasya in Krishna.
  var TITHI_NAMES = ['Pratipada', 'Dwitiya', 'Tritiya', 'Chaturthi', 'Panchami', 'Shashthi',
    'Saptami', 'Ashtami', 'Navami', 'Dashami', 'Ekadashi', 'Dwadashi', 'Trayodashi', 'Chaturdashi', 'Purnima'];
  var AMAVASYA = 'Amavasya';
  var SYN = 29.530588853, REL = 12.190749;
  var RAD = Math.PI / 180;

  // Meeus table 47.A, longitude terms: D, M, M', F, coefficient (1e-6 deg)
  var MOON = [
    [0,0,1,0,6288774],[2,0,-1,0,1274027],[2,0,0,0,658314],[0,0,2,0,213618],[0,1,0,0,-185116],
    [0,0,0,2,-114332],[2,0,-2,0,58793],[2,-1,-1,0,57066],[2,0,1,0,53322],[2,-1,0,0,45758],
    [0,1,-1,0,-40923],[1,0,0,0,-34720],[0,1,1,0,-30383],[2,0,0,-2,15327],[0,0,1,2,-12528],
    [0,0,1,-2,10980],[4,0,-1,0,10675],[0,0,3,0,10034],[4,0,-2,0,8548],[2,1,-1,0,-7888],
    [2,1,0,0,-6766],[1,0,-1,0,-5163],[1,1,0,0,4987],[2,-1,1,0,4036],[2,0,2,0,3994],
    [4,0,0,0,3861],[2,0,-3,0,3665],[0,1,-2,0,-2689],[2,0,-1,2,-2602],[2,-1,-2,0,2390],
    [1,0,1,0,-2348],[2,-2,0,0,2236],[0,1,2,0,-2120],[0,2,0,0,-2069],[2,-2,-1,0,2048],
    [2,0,1,-2,-1773],[2,0,0,2,-1595],[4,-1,-1,0,1215],[0,0,2,2,-1110],[3,0,-1,0,-892],
    [2,1,1,0,-810],[4,-1,-2,0,759],[0,2,-1,0,-713],[2,2,-1,0,-700],[2,1,-2,0,691],
    [2,-1,0,-2,596],[4,0,1,0,549],[0,0,4,0,537],[4,-1,0,0,520],[1,0,-2,0,-487],
    [2,1,0,-2,-399],[0,0,2,-2,-381],[1,1,1,0,351],[3,0,-2,0,-340],[4,0,-3,0,330],
    [2,-1,2,0,327],[0,2,1,0,-323],[1,1,-1,0,299],[2,0,3,0,294]
  ];

  // ---------- public API ----------

  /** Tithi prevailing at sunrise (06:00 IST). opts: { system: 'purnimanta' | 'amanta' } */
  function tithiOf(dateISO, opts) {
    var jd = sunriseJd(days(dateISO));
    return describe(jd, tithiAt(jd), (opts && opts.system) || 'purnimanta');
  }

  function vsYear(dateISO) {
    return tithiOf(dateISO).vs;
  }

  /**
   * Next date >= fromISO whose sunrise tithi matches (in opts.system).
   * Adhik months skipped unless opts.adhik. Kshaya tithi: the day it occurs on
   * (whose sunrise tithi is the next one). Vriddhi: first of the two days.
   */
  function nextTithiDate(masa, paksha, tithi, fromISO, opts) {
    opts = opts || {};
    var system = opts.system || 'purnimanta';
    var target = (paksha === 'K' ? 15 : 0) + tithi;
    var d0 = days(fromISO);
    var prev = tithiAt(sunriseJd(d0 - 1));
    for (var i = 0; i <= 420; i++) {
      var jd = sunriseJd(d0 + i);
      var cur = tithiAt(jd);
      var span = (cur - prev + 30) % 30;
      var off = (target - prev + 30) % 30;
      if (off >= 1 && off <= span) {
        var info = describe(cur >= target ? jd : jd - 1, target, system);
        if (info.masa === masa && (!info.adhik || opts.adhik)) return iso(d0 + i);
      }
      prev = cur;
    }
    return null;
  }

  /** Gregorian date of a tithi in a Vikram Samvat year. */
  function dateFromTithi(vs, masa, paksha, tithi, opts) {
    var from = pad(vs - 57, 4) + '-01-01';
    for (var n = 0; n < 3; n++) {
      var d = nextTithiDate(masa, paksha, tithi, from, opts);
      if (d === null) return null;
      var v = vsYear(d);
      if (v === vs) return d;
      if (v > vs) return null;
      from = iso(days(d) + 1);
    }
    return null;
  }

  /** Moon-minus-Sun elongation (deg) at a Julian Day (UT). Exposed for tests. */
  function elongation(jd) {
    var t = (jd + 69 / 86400 - 2451545.0) / 36525;
    return norm(moonLong(t) - sunLong(t));
  }

  // ---------- lunar month ----------

  function describe(jd, t30, system) {
    var paksha = t30 <= 15 ? 'S' : 'K';
    var tithi = t30 <= 15 ? t30 : t30 - 15;
    var start = newMoonNear(jd - elongation(jd) / REL);
    var end = newMoonNear(start + SYN);
    var signS = sign(start), signE = sign(end);
    var adhik = signS === signE;
    var masa = (signS + 1) % 12 + 1;
    var date = iso(Math.floor(jd + 0.5 + 5.5 / 24 - 2440588));
    var vs = +date.slice(0, 4) + ((masa >= 8 && +date.slice(5, 7) <= 6) ? 56 : 57);
    if (system === 'purnimanta' && paksha === 'K') masa = (signE + 1) % 12 + 1;
    var tName = (paksha === 'K' && tithi === 15) ? AMAVASYA : TITHI_NAMES[tithi - 1];
    var pName = paksha === 'S' ? 'Shukla' : 'Krishna';
    var mName = MASA_NAMES[masa - 1];
    return {
      masa: masa, masaName: mName, adhik: adhik,
      paksha: paksha, pakshaName: pName,
      tithi: tithi, tithiName: tName,
      vs: vs,
      label: (adhik ? 'Adhik ' : '') + mName + ' ' + pName + ' ' + tName
    };
  }

  function newMoonNear(jd) {
    for (var i = 0; i < 6; i++) {
      var e = elongation(jd);
      if (e > 180) e -= 360;
      jd -= e / REL;
    }
    return jd;
  }

  function sign(jd) {
    var t = (jd + 69 / 86400 - 2451545.0) / 36525;
    var ayanamsa = 23.853 + (jd - 2451545.0) / 365.25 * 50.29 / 3600;
    return Math.floor(norm(sunLong(t) - ayanamsa) / 30);
  }

  function tithiAt(jd) {
    return Math.min(30, Math.floor(elongation(jd) / 12) + 1);
  }

  // ---------- astronomy ----------

  function sunLong(t) {
    var l0 = 280.46646 + 36000.76983 * t + 0.0003032 * t * t;
    var m = (357.52911 + 35999.05029 * t - 0.0001537 * t * t) * RAD;
    var c = (1.914602 - 0.004817 * t - 0.000014 * t * t) * Math.sin(m)
      + (0.019993 - 0.000101 * t) * Math.sin(2 * m) + 0.000289 * Math.sin(3 * m);
    var om = (125.04 - 1934.136 * t) * RAD;
    return l0 + c - 0.00569 - 0.00478 * Math.sin(om);
  }

  function moonLong(t) {
    var t2 = t * t, t3 = t2 * t, t4 = t3 * t;
    var lp = 218.3164477 + 481267.88123421 * t - 0.0015786 * t2 + t3 / 538841 - t4 / 65194000;
    var d = (297.8501921 + 445267.1114034 * t - 0.0018819 * t2 + t3 / 545868 - t4 / 113065000) * RAD;
    var m = (357.5291092 + 35999.0502909 * t - 0.0001536 * t2 + t3 / 24490000) * RAD;
    var mp = (134.9633964 + 477198.8675055 * t + 0.0087414 * t2 + t3 / 69699 - t4 / 14712000) * RAD;
    var f = (93.2720950 + 483202.0175233 * t - 0.0036539 * t2 - t3 / 3526000 + t4 / 863310000) * RAD;
    var e = 1 - 0.002516 * t - 0.0000074 * t2;
    var sum = 0;
    for (var i = 0; i < MOON.length; i++) {
      var r = MOON[i], am = Math.abs(r[1]);
      sum += r[4] * (am === 1 ? e : (am === 2 ? e * e : 1)) * Math.sin(r[0] * d + r[1] * m + r[2] * mp + r[3] * f);
    }
    var a1 = (119.75 + 131.849 * t) * RAD;
    var a2 = (53.09 + 479264.290 * t) * RAD;
    sum += 3958 * Math.sin(a1) + 1962 * Math.sin(lp * RAD - f) + 318 * Math.sin(a2);
    var om = (125.04 - 1934.136 * t) * RAD;
    return lp + sum / 1e6 - 0.00478 * Math.sin(om);
  }

  // ---------- dates ----------

  function norm(x) { return x - 360 * Math.floor(x / 360); }
  function sunriseJd(n) { return n + 2440587.5 + 0.5 / 24; }  // 00:30 UTC = 06:00 IST
  function pad(n, w) { var s = String(Math.abs(n)); while (s.length < w) s = '0' + s; return (n < 0 ? '-' : '') + s; }
  function idiv(a, b) { return Math.trunc(a / b); }

  function days(s) {
    var p = /^(-?\d{1,4})-(\d{2})-(\d{2})$/.exec(String(s));
    if (!p) throw new Error('Bad date: ' + s);
    var y = +p[1], m = +p[2], d = +p[3];
    y -= m <= 2 ? 1 : 0;
    var era = idiv(y >= 0 ? y : y - 399, 400);
    var yoe = y - era * 400;
    var doy = idiv(153 * (m + (m > 2 ? -3 : 9)) + 2, 5) + d - 1;
    var doe = yoe * 365 + idiv(yoe, 4) - idiv(yoe, 100) + doy;
    return era * 146097 + doe - 719468;
  }

  function iso(z) {
    z += 719468;
    var era = idiv(z >= 0 ? z : z - 146096, 146097);
    var doe = z - era * 146097;
    var yoe = idiv(doe - idiv(doe, 1460) + idiv(doe, 36524) - idiv(doe, 146096), 365);
    var doy = doe - (365 * yoe + idiv(yoe, 4) - idiv(yoe, 100));
    var mp = idiv(5 * doy + 2, 153);
    var d = doy - idiv(153 * mp + 2, 5) + 1;
    var m = mp + (mp < 10 ? 3 : -9);
    var y = yoe + era * 400 + (m <= 2 ? 1 : 0);
    return pad(y, 4) + '-' + pad(m, 2) + '-' + pad(d, 2);
  }

  var api = {
    MASA_NAMES: MASA_NAMES, TITHI_NAMES: TITHI_NAMES, AMAVASYA: AMAVASYA,
    tithiOf: tithiOf, vsYear: vsYear, nextTithiDate: nextTithiDate,
    dateFromTithi: dateFromTithi, elongation: elongation
  };
  root.FTPanchang = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
