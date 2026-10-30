<?php
/**
 * Panchang: Hindu lunar date (tithi) for a Gregorian date, and back.
 * Same API as assets/panchang.js. Pure PHP, no dependencies, PHP 8.1+.
 *
 * Conventions (read these before changing anything):
 * - Sunrise is taken as 06:00 IST (00:30 UTC) for every date and place.
 *   Real Delhi sunrise is 05:20 to 07:15, so on a day where a tithi ends
 *   between 06:00 and the real sunrise this can differ by one day from a
 *   printed panchang.
 * - A lunar month runs new moon to new moon (AMANTA). It is named by the
 *   sidereal (Lahiri) sign the Sun is in at the new moon that starts it:
 *   Sun in Meena -> Chaitra, Mesha -> Vaishakh, ... Kumbha -> Phalgun.
 *   That is the same as "the month in which the Sun enters Mesha is
 *   Chaitra", the rule used by Maharashtra, Gujarat and South Indian
 *   calendars. Diwali falls on Ashwin Amavasya in this system.
 * - A month with no solar sign change is ADHIK (leap); it carries the name
 *   of the month after it, which is the nija (regular) month.
 * - PURNIMANTA (North India, the default here): the Krishna paksha takes
 *   the name of the NEXT amanta month, so Diwali is Kartik Amavasya. The
 *   adhik flag stays with the amanta month (adhik masa is amavasya to
 *   amavasya in both systems, as Drik Panchang shows it).
 * - Vikram Samvat changes at Chaitra Shukla Pratipada (amanta Chaitra).
 *
 * Astronomy: Sun from Meeus ch. 25, Moon from Meeus ch. 47 (full longitude
 * table), good to about 0.01 deg, i.e. tithi end times within ~2 minutes.
 */
final class Panchang
{
    public const MASA_NAMES = ['Chaitra', 'Vaishakh', 'Jyeshtha', 'Ashadh', 'Shravan', 'Bhadrapad',
        'Ashwin', 'Kartik', 'Margashirsha', 'Paush', 'Magh', 'Phalgun'];
    // Index 0..14 = tithi 1..15. Tithi 15 is Purnima in Shukla, Amavasya in Krishna.
    public const TITHI_NAMES = ['Pratipada', 'Dwitiya', 'Tritiya', 'Chaturthi', 'Panchami', 'Shashthi',
        'Saptami', 'Ashtami', 'Navami', 'Dashami', 'Ekadashi', 'Dwadashi', 'Trayodashi', 'Chaturdashi', 'Purnima'];
    public const AMAVASYA = 'Amavasya';

    private const SYN = 29.530588853;   // mean synodic month, days
    private const REL = 12.190749;      // mean Moon-minus-Sun motion, deg/day

    // Meeus table 47.A, longitude terms: D, M, M', F, coefficient (1e-6 deg)
    private const MOON = [
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
        [2,-1,2,0,327],[0,2,1,0,-323],[1,1,-1,0,299],[2,0,3,0,294],
    ];

    // ---------- public API ----------

    /** Tithi prevailing at sunrise (06:00 IST) on a Gregorian date. opts: ['system' => 'purnimanta'|'amanta'] */
    public static function tithiOf(string $dateISO, array $opts = []): array
    {
        $jd = self::sunriseJd(self::days($dateISO));
        return self::describe($jd, self::tithiAt($jd), $opts['system'] ?? 'purnimanta');
    }

    /** Vikram Samvat year of a Gregorian date. */
    public static function vsYear(string $dateISO): int
    {
        return self::tithiOf($dateISO)['vs'];
    }

    /**
     * Next date >= fromISO whose sunrise tithi is masa/paksha/tithi (in opts['system']).
     * Adhik months are skipped unless opts['adhik'] is true.
     * Kshaya tithi (no sunrise falls in it): returns the day it occurs on,
     * i.e. the day whose sunrise tithi is the one after it.
     * Vriddhi tithi (two sunrises): returns the first of the two days.
     * Returns null if nothing within ~420 days.
     */
    public static function nextTithiDate(int $masa, string $paksha, int $tithi, string $fromISO, array $opts = []): ?string
    {
        $system = $opts['system'] ?? 'purnimanta';
        $wantAdhik = !empty($opts['adhik']);
        $target = ($paksha === 'K' ? 15 : 0) + $tithi;
        $d0 = self::days($fromISO);
        $prev = self::tithiAt(self::sunriseJd($d0 - 1));
        for ($i = 0; $i <= 420; $i++) {
            $jd = self::sunriseJd($d0 + $i);
            $cur = self::tithiAt($jd);
            $span = ($cur - $prev + 30) % 30;
            $off = ($target - $prev + 30) % 30;
            if ($off >= 1 && $off <= $span) {
                // Month of the target tithi: today's if no new moon between it and sunrise, else yesterday's.
                $info = self::describe($cur >= $target ? $jd : $jd - 1, $target, $system);
                if ($info['masa'] === $masa && (!$info['adhik'] || $wantAdhik)) {
                    return self::iso($d0 + $i);
                }
            }
            $prev = $cur;
        }
        return null;
    }

    /** Gregorian date of a tithi in a Vikram Samvat year, e.g. (1990, 6, 'S', 5) = Bhadrapad Shukla 5, VS 1990. */
    public static function dateFromTithi(int $vsYear, int $masa, string $paksha, int $tithi, array $opts = []): ?string
    {
        $from = sprintf('%04d-01-01', $vsYear - 57);
        for ($n = 0; $n < 3; $n++) {
            $d = self::nextTithiDate($masa, $paksha, $tithi, $from, $opts);
            if ($d === null) return null;
            $v = self::vsYear($d);
            if ($v === $vsYear) return $d;
            if ($v > $vsYear) return null;
            $from = self::iso(self::days($d) + 1);
        }
        return null;
    }

    /** Moon-minus-Sun elongation in degrees at a Julian Day (UT). Exposed for tests. */
    public static function elongation(float $jd): float
    {
        $t = ($jd + 69 / 86400 - 2451545.0) / 36525;  // TT, with a fixed delta-T of 69 s
        return self::norm(self::moonLong($t) - self::sunLong($t));
    }

    // ---------- lunar month ----------

    private static function describe(float $jd, int $t30, string $system): array
    {
        $paksha = $t30 <= 15 ? 'S' : 'K';
        $tithi = $t30 <= 15 ? $t30 : $t30 - 15;
        $start = self::newMoonNear($jd - self::elongation($jd) / self::REL);
        $end = self::newMoonNear($start + self::SYN);
        $signS = self::sign($start);
        $signE = self::sign($end);
        $adhik = $signS === $signE;
        $masa = ($signS + 1) % 12 + 1;
        // Vikram Samvat: Margashirsha..Phalgun (amanta) early in the year still belong to the old year.
        // ponytail: an adhik Chaitra counts as the new year; adjust if a family's panchang differs.
        $date = self::iso((int)floor($jd + 0.5 + 5.5 / 24 - 2440588));  // IST calendar date of $jd
        $vs = (int)substr($date, 0, 4) + (($masa >= 8 && (int)substr($date, 5, 2) <= 6) ? 56 : 57);
        if ($system === 'purnimanta' && $paksha === 'K') $masa = ($signE + 1) % 12 + 1;
        $tName = ($paksha === 'K' && $tithi === 15) ? self::AMAVASYA : self::TITHI_NAMES[$tithi - 1];
        $pName = $paksha === 'S' ? 'Shukla' : 'Krishna';
        $mName = self::MASA_NAMES[$masa - 1];
        return [
            'masa' => $masa, 'masaName' => $mName, 'adhik' => $adhik,
            'paksha' => $paksha, 'pakshaName' => $pName,
            'tithi' => $tithi, 'tithiName' => $tName,
            'vs' => $vs,
            'label' => ($adhik ? 'Adhik ' : '') . "$mName $pName $tName",
        ];
    }

    private static function newMoonNear(float $jd): float
    {
        for ($i = 0; $i < 6; $i++) {
            $e = self::elongation($jd);
            if ($e > 180) $e -= 360;
            $jd -= $e / self::REL;
        }
        return $jd;
    }

    private static function sign(float $jd): int
    {
        $t = ($jd + 69 / 86400 - 2451545.0) / 36525;
        $ayanamsa = 23.853 + ($jd - 2451545.0) / 365.25 * 50.29 / 3600;  // Lahiri
        return (int)floor(self::norm(self::sunLong($t) - $ayanamsa) / 30);
    }

    private static function tithiAt(float $jd): int
    {
        return min(30, (int)floor(self::elongation($jd) / 12) + 1);
    }

    // ---------- astronomy ----------

    private static function sunLong(float $t): float
    {
        $l0 = 280.46646 + 36000.76983 * $t + 0.0003032 * $t * $t;
        $m = deg2rad(357.52911 + 35999.05029 * $t - 0.0001537 * $t * $t);
        $c = (1.914602 - 0.004817 * $t - 0.000014 * $t * $t) * sin($m)
            + (0.019993 - 0.000101 * $t) * sin(2 * $m) + 0.000289 * sin(3 * $m);
        $om = deg2rad(125.04 - 1934.136 * $t);
        return $l0 + $c - 0.00569 - 0.00478 * sin($om);  // apparent
    }

    private static function moonLong(float $t): float
    {
        $t2 = $t * $t; $t3 = $t2 * $t; $t4 = $t3 * $t;
        $lp = 218.3164477 + 481267.88123421 * $t - 0.0015786 * $t2 + $t3 / 538841 - $t4 / 65194000;
        $d = deg2rad(297.8501921 + 445267.1114034 * $t - 0.0018819 * $t2 + $t3 / 545868 - $t4 / 113065000);
        $m = deg2rad(357.5291092 + 35999.0502909 * $t - 0.0001536 * $t2 + $t3 / 24490000);
        $mp = deg2rad(134.9633964 + 477198.8675055 * $t + 0.0087414 * $t2 + $t3 / 69699 - $t4 / 14712000);
        $f = deg2rad(93.2720950 + 483202.0175233 * $t - 0.0036539 * $t2 - $t3 / 3526000 + $t4 / 863310000);
        $e = 1 - 0.002516 * $t - 0.0000074 * $t2;
        $sum = 0.0;
        foreach (self::MOON as [$cd, $cm, $cmp, $cf, $k]) {
            $am = abs($cm);
            $sum += $k * ($am === 1 ? $e : ($am === 2 ? $e * $e : 1)) * sin($cd * $d + $cm * $m + $cmp * $mp + $cf * $f);
        }
        $a1 = deg2rad(119.75 + 131.849 * $t);
        $a2 = deg2rad(53.09 + 479264.290 * $t);
        $sum += 3958 * sin($a1) + 1962 * sin(deg2rad($lp) - $f) + 318 * sin($a2);
        $om = deg2rad(125.04 - 1934.136 * $t);
        return $lp + $sum / 1e6 - 0.00478 * sin($om);  // apparent (same nutation term as the Sun)
    }

    // ---------- dates ----------

    private static function norm(float $x): float
    {
        return $x - 360 * floor($x / 360);
    }

    private static function sunriseJd(int $days): float
    {
        return $days + 2440587.5 + 0.5 / 24;  // 00:30 UTC = 06:00 IST
    }

    /** 'YYYY-MM-DD' -> days since 1970-01-01 (proleptic Gregorian; H. Hinnant's algorithm). */
    private static function days(string $iso): int
    {
        if (!preg_match('/^(-?\d{1,4})-(\d{2})-(\d{2})$/', $iso, $p)) {
            throw new InvalidArgumentException("Bad date: $iso");
        }
        [$y, $m, $d] = [(int)$p[1], (int)$p[2], (int)$p[3]];
        $y -= $m <= 2 ? 1 : 0;
        $era = intdiv($y >= 0 ? $y : $y - 399, 400);
        $yoe = $y - $era * 400;
        $doy = intdiv(153 * ($m + ($m > 2 ? -3 : 9)) + 2, 5) + $d - 1;
        $doe = $yoe * 365 + intdiv($yoe, 4) - intdiv($yoe, 100) + $doy;
        return $era * 146097 + $doe - 719468;
    }

    private static function iso(int $z): string
    {
        $z += 719468;
        $era = intdiv($z >= 0 ? $z : $z - 146096, 146097);
        $doe = $z - $era * 146097;
        $yoe = intdiv($doe - intdiv($doe, 1460) + intdiv($doe, 36524) - intdiv($doe, 146096), 365);
        $doy = $doe - (365 * $yoe + intdiv($yoe, 4) - intdiv($yoe, 100));
        $mp = intdiv(5 * $doy + 2, 153);
        $d = $doy - intdiv(153 * $mp + 2, 5) + 1;
        $m = $mp + ($mp < 10 ? 3 : -9);
        $y = $yoe + $era * 400 + ($m <= 2 ? 1 : 0);
        return sprintf('%04d-%02d-%02d', $y, $m, $d);
    }
}
