/**
 * Local calendar days, as the one `YYYY-MM-DD` key the whole app compares against.
 *
 * Everything here is about LOCAL time, and that is the whole point of the file.
 *
 * `toISOString()` looks like it does the same job and does not: it converts to
 * UTC first. West of Greenwich it therefore returns TOMORROW''s date for the last
 * few hours of the day, and east of it, yesterday''s. Venezuela is UTC-4, so for
 * four hours every evening a `toISOString()` day key was a day ahead -- which
 * put the "today" ring on the wrong cell in the calendar, and made the rate
 * history treat today''s own reading as a future point and draw it dashed with a
 * approximation sign beside it. Two real bugs, one cause.
 *
 * These use the local getters (`getFullYear`, `getMonth`, `getDate`) so the key
 * is the day the user is living in, which is the only day that means anything
 * for a ledger of expenses.
 *
 * This existed as eight near-identical copies across the codebase, each correct
 * but each free to drift, and two of them briefly were not. One definition, one
 * import: a ninth copy is no longer something a developer can get subtly wrong
 * without it showing up in the tests beside this file.
 */

/** The local calendar day of a Date, as `YYYY-MM-DD`. */
export function isoOfDay(date) {
    const d = date instanceof Date ? date : new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * The local calendar day of a millisecond timestamp.
 *
 * Kept separate from `isoOfDay` because a timestamp is not a date: it carries a
 * time of day, and every caller passing one means "the day that moment fell on",
 * which is only true if the timezone is resolved here rather than upstream.
 *
 * A caller that hands this a bare `YYYY-MM-DD` gets the string parsed as UTC
 * midnight and shifted a day west of Greenwich, which is why the calendar and the
 * ledger pass Date objects or real timestamps and never day keys.
 */
export function isoOfTimestamp(ms) {
    return isoOfDay(new Date(Number(ms) || 0));
}

/** The month a Date falls in, as the app''s `YYYY-MM` month id. */
export function monthIdOfDate(date) {
    const d = date instanceof Date ? date : new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * A day key back as a Date, anchored to noon.
 *
 * The key carries no time and no zone, so it is anchored to noon: read as UTC
 * midnight it lands on the previous day for every user west of Greenwich, and
 * reformatting it with the local getters alone does not repair that, because the
 * damage already happened when the Date was constructed.
 */
export function dayKeyToDate(iso) {
    return new Date(`${iso}T12:00:00`);
}
