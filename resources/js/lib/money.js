/**
 * Money/number formatting — one source of truth for es-ES output.
 * Every figure should go through these so decimals, separators and the
 * rate guard stay identical everywhere in the app.
 */

const nf = (digits) => new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
});

/** Bs amount, e.g. 1234.5 -> "1.234,50" */
export const fmtBs = (value, digits = 2) => nf(digits).format(Number(value) || 0);

/** USD amount, e.g. 12.3 -> "12,30" */
export const fmtUsd = (value, digits = 2) => nf(digits).format(Number(value) || 0);

/** Exchange rate, e.g. 849.564 -> "849,56" */
export const fmtRate = (value) => nf(2).format(Number(value) || 0);

/** Signed percentage input in 0..100 units, e.g. 3.14 -> "3,1" */
export const fmtPct = (value, digits = 1) => nf(digits).format(Number(value) || 0);

/** USD equivalent of a Bs amount at the given rate (guarded like the old ternaries). */
export const usdOf = (amountBs, rate) => {
    const r = Number(rate);
    if (!r || r <= 0) return '0.00';
    return fmtUsd(Number(amountBs) / r);
};