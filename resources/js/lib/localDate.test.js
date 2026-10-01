import { describe, expect, it } from 'vitest';
import { isoOfDay, isoOfTimestamp, monthIdOfDate, dayKeyToDate } from './localDate.js';

/**
 * The bug these rules out, stated as the test.
 *
 * A day key was built with `toISOString()`, which converts to UTC before
 * formatting. West of Greenwich that hands back TOMORROW's date for the last few
 * hours of the day. Venezuela is UTC-4, so from 20:00 local the calendar put the
 * "today" ring on tomorrow's cell, and the rate history classified today's own
 * reading as a future point and drew it dashed.
 *
 * Both were invisible to a suite that only ran in UTC, because in UTC the two
 * implementations agree exactly. So the case that matters is stated as the
 * DIFFERENCE between the two, asserted directly rather than implied: if they ever
 * agree again, the test fails, which is the point.
 *
 * Run under TZ=America/Caracas. A local-date test that only ever runs in UTC
 * cannot fail, and a test that cannot fail is worse than no test, because it
 * looks like coverage.
 */

/** The wall clock in a zone `offsetHours` from UTC, as an instant. */
const at = (isoUtc, offsetHours) => new Date(new Date(isoUtc).getTime() + offsetHours * 3600_000);

describe('a day key is the local day, never the UTC one', () => {
    it('reads the 29th at 22:00 in UTC-4, where toISOString reports the 30th', () => {
        // 02:00 UTC on the 30th is 22:00 on the 29th in Caracas. This is the
        // exact case that put the today ring on the wrong cell, so the instant is
        // used as-is: the two implementations only disagree when the local clock
        // and UTC are on different days, which is the whole situation.
        const instant = new Date('2026-09-30T02:00:00Z');

        // The rule: what the clock on the wall says.
        expect(isoOfDay(instant)).toBe('2026-09-29');
        // The behaviour being ruled out, asserted as the contrast it is.
        expect(instant.toISOString().slice(0, 10)).toBe('2026-09-30');
    });

    it('agrees with toISOString whenever local and UTC are on the same day', () => {
        // The other half of the rule, and the reason the first test is not the
        // whole story: for most of the day the two agree, and a helper that
        // drifted from UTC everywhere would fail this.
        //
        // Stated as agreement rather than a hardcoded date, so it holds in any
        // zone -- including a developer's machine, which is the point of testing
        // the rule rather than a fixture. An instant in the middle of the UTC day
        // is mid-morning in Caracas and mid-evening in Tokyo, so local and UTC
        // share a date either way.
        const instant = new Date('2026-09-30T12:00:00Z');
        expect(isoOfDay(instant)).toBe(instant.toISOString().slice(0, 10));
    });

    it('pads single-digit months and days', () => {
        expect(isoOfDay(new Date(2026, 0, 5, 12))).toBe('2026-01-05');
        expect(isoOfDay(new Date(2026, 8, 9, 12))).toBe('2026-09-09');
    });

    it('puts midnight on the day it starts and 23:59:59 on the day it ends', () => {
        // An off-by-one here is what "my expense vanished" looks like: a
        // timestamped expense landing on the day before or after it happened.
        expect(isoOfDay(new Date(2026, 8, 30, 0, 0, 0, 0))).toBe('2026-09-30');
        expect(isoOfDay(new Date(2026, 8, 30, 23, 59, 59, 999))).toBe('2026-09-30');
    });

    it('rolls the month and the year over correctly', () => {
        expect(isoOfDay(new Date(2026, 11, 31, 23, 59))).toBe('2026-12-31');
        expect(isoOfDay(new Date(2027, 0, 1, 0, 0))).toBe('2027-01-01');
    });
});

describe('a timestamp resolves to the day it fell on', () => {
    it('uses the local day, which is what the old toISOString call got wrong', () => {
        const ms = new Date('2026-09-29T21:00:00Z').getTime();
        expect(isoOfTimestamp(ms)).toBe(isoOfDay(new Date(ms)));
    });

    it('gives a real key for a missing or unparseable timestamp, never NaN-NaN-NaN', () => {
        // The old shape produced a string no comparison could match, which reads
        // as "no expenses that day" rather than as an error.
        expect(isoOfTimestamp(null)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(isoOfTimestamp(undefined)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(isoOfTimestamp('nonsense')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
});

describe('the month id is the local month', () => {
    it('reads the month the local date falls in', () => {
        expect(monthIdOfDate(new Date(2026, 8, 30, 12))).toBe('2026-09');
        expect(monthIdOfDate(new Date(2026, 0, 1, 12))).toBe('2026-01');
    });

    it('does not roll into the next month at 23:59 on the last day', () => {
        expect(monthIdOfDate(new Date(2026, 8, 30, 23, 59))).toBe('2026-09');
    });
});

describe('a day key reads back as the day it names', () => {
    it('round-trips through noon for every awkward date', () => {
        for (const key of ['2026-09-01', '2026-09-30', '2026-02-28', '2026-12-31']) {
            expect(isoOfDay(dayKeyToDate(key))).toBe(key);
        }
    });

    it('is anchored to noon, so a UTC parse cannot drag it to the day before', () => {
        // The reason for the anchor. Under TZ=-4, parsing the key as UTC midnight
        // is the previous day; anchoring at noon is not. Which of the two is
        // correct depends on the zone, so this asserts the safe one unconditionally.
        const key = '2026-09-01';
        expect(isoOfDay(dayKeyToDate(key))).toBe(key);
    });
});




