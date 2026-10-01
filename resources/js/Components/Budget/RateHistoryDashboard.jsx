import React, { useMemo, useState } from 'react';
import { RefreshCw, TrendingDown, TrendingUp } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { fmtPct, fmtRate } from '@/lib/money';
import { useRateLabel } from '@/hooks/useFigure';
import { isoOfDay } from '@/lib/localDate';

function cn(...inputs) {
    return twMerge(clsx(inputs));
}

const RANGES = [
    { key: '30', label: '1M' },
    { key: '90', label: '3M' },
    { key: '180', label: '6M' },
    { key: '365', label: '1A' },
    { key: 'all', label: 'Todo' },
];

const MONTH_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
// Today's date, as the LOCAL day key from localDate.js. Compared against the
// server's calendar dates to decide which points are still in the future, so a
// UTC date would mark today's own reading as future in the evening and draw it
// dashed with an approximation sign. See localDate.js for the rule.
const TODAY = isoOfDay(new Date());

const shortDate = (iso) => {
    const d = new Date(`${iso}T12:00:00`);
    const base = `${String(d.getDate()).padStart(2, '0')} ${MONTH_SHORT[d.getMonth()]}`;
    // Only pay for the year when it is not the current one, so rows stay
    // compact while a year boundary remains unambiguous.
    return d.getFullYear() === new Date().getFullYear() ? base : `${base} ${d.getFullYear()}`;
};
const longDate = (iso) => {
    const d = new Date(`${iso}T12:00:00`);
    return `${String(d.getDate()).padStart(2, '0')} ${MONTH_SHORT[d.getMonth()]} ${d.getFullYear()}`;
};

/**
 *
 * The series on screen follows the display currency, and `comparison` carries
 * the other one alongside it. Both are bolivares per one unit of their own
 * currency, so they are the same unit and share one axis honestly -- a euro
 * rate is not rescaled onto dollars to sit next to them.
 */
export default function RateHistoryDashboard({
    rate, points, comparison = null, currency, comparisonCurrency = null,
    loading, error, refreshing, range, onRangeChange, onRefresh, onRetry,
}) {
    const data = points || [];
    const rateLabel = useRateLabel(currency);
    const comparisonLabel = useRateLabel(comparisonCurrency);
    const last = data.length > 0 ? data[data.length - 1] : null;
    const lastComparison = comparison && comparison.length > 0 ? comparison[comparison.length - 1] : null;

    // 1D / 7D / 30D movement against the last point (points are consecutive
    // days). 30D is the headline figure the hero must always carry, so it
    // falls back to the oldest available point when the selected range is
    // shorter than a month (the default 1M view), and is simply omitted only
    // when there is too little history to compare at all.
    const deltas = useMemo(() => {
        if (!last || data.length < 2) return [];
        const cur = parseFloat(last.rate);
        const mk = (days, label) => {
            const idx = data.length - 1 - days;
            const point = idx >= 0 ? data[idx] : data[0];
            if (!point) return null;
            const prev = parseFloat(point.rate);
            if (!prev) return null;
            return { label, pct: ((cur - prev) / prev) * 100, partial: idx < 0 };
        };
        const out = [];
        if (data.length >= 2) out.push(mk(1, '1D'));
        if (data.length >= 8) out.push(mk(7, '7D'));
        const m = mk(30, '30D');
        if (m) out.push(m);
        return out;
    }, [points]);

    const stats = useMemo(() => {
        if (data.length === 0) return null;
        const vals = data.map((p) => parseFloat(p.rate));
        const min = Math.min(...vals);
        const max = Math.max(...vals);
        const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
        const first = vals[0];
        const pct = first > 0 ? ((vals[vals.length - 1] - first) / first) * 100 : 0;
        return { min, max, avg, pct };
    }, [points]);

    const [visibleRows, setVisibleRows] = useState(30);
    const reversed = useMemo(() => [...data].reverse(), [points]);

    const changeRange = (key) => {
        setVisibleRows(30);
        onRangeChange(key);
    };

    const handleRefresh = () => {
        setVisibleRows(30);
        onRefresh();
    };

    // A range can only show what this device holds. The archive that fills the
    // long windows is a bulk download that fails on a bad connection, and the
    // euro series in particular can hold only a few months: "1A" and "Todo" then
    // return the same truncated window and look broken. Saying where the data
    // actually starts is the honest answer, and it tells the user why.
    const coverage = useMemo(() => {
        if (data.length === 0) return null;
        const first = data[0].date;
        const expected = range === 'all' ? null : Number(range);
        // A day of slack absorbs weekends and holidays, which legitimately have
        // no point of their own.
        const complete = expected === null || data.length >= expected * 0.9;
        return complete ? null : { from: first };
    }, [data, range]);

    return (
        <div className="space-y-6">
            {/* Hero ticker */}
            <div className="bg-gradient-to-br from-[#1A1A2E] to-[#16213E] rounded-2xl p-5 text-white shadow-xl relative overflow-hidden">
                <div className="absolute -right-8 -top-10 w-36 h-36 rounded-full bg-white/5" />
                <div className="absolute -right-2 top-16 w-20 h-20 rounded-full bg-white/5" />

                <div className="flex justify-between items-center mb-1.5 relative z-10">
                    <div className="flex items-center gap-2">
                        <span className="text-white/70 text-[10px] font-black uppercase tracking-[0.2em]">BCV Oficial</span>
                        {(rate?.stale || rate?.error) && (
                            <span
                                className="w-2.5 h-2.5 rounded-full bg-amber-300"
                                title={rate?.error ? `Error BCV: ${rate.error}` : 'Tasa posiblemente desactualizada'}
                            />
                        )}
                    </div>
                    <button
                        onClick={handleRefresh}
                        disabled={refreshing}
                        title="Actualizar tasa"
                        className="bg-white/10 hover:bg-white/20 p-2 rounded-xl backdrop-blur-md transition-colors disabled:opacity-50"
                    >
                        <RefreshCw size={16} className={cn(refreshing && 'animate-spin')} />
                    </button>
                </div>

                <div className="relative z-10">
                    <p className="text-4xl font-black font-serif tracking-tight tabular">
                        {last ? `${rateLabel} ${fmtRate(last.rate)}` : '≈'}</p>
                    <p className="text-[10px] text-white/50 font-bold uppercase tracking-widest mt-1">
                        {last ? `Ultimo dato • ${longDate(last.date)}` : (rate?.date_iso ? longDate(rate.date_iso) : '')}
                    </p>

                    {/* The other series, only when it was actually fetched. A
                        euro history that has never backfilled shows nothing here
                        rather than a flat line implying a rate nobody published. */}
                    {lastComparison && (
                        <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-white/45 tabular">
                            {comparisonLabel} {fmtRate(lastComparison.rate)}
                        </p>
                    )}
                </div>

                {deltas.length > 0 && (
                    <div className="mt-4">
                        <div className="flex gap-2 relative z-10">
                            {deltas.map(({ label, pct, partial }) => {
                                const up = pct >= 0;
                                return (
                                    <span
                                        key={label}
                                        className={cn(
                                            'flex items-center gap-1 bg-white/10 rounded-lg px-2 py-1 text-[10px] font-black uppercase tracking-wider tabular',
                                            up ? 'text-green-400' : 'text-red-400',
                                        )}
                                    >
                                        {up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                                        {label} {up ? '+' : ''}{fmtPct(pct)}%{partial ? '*' : ''}
                                    </span>
                                );
                            })}
                        </div>
                        {deltas.some((d) => d.partial) && (
                            <p className="mt-1.5 text-[9px] text-white/40 relative z-10">
                                * 30D calculado con el historial disponible
                            </p>
                        )}
                    </div>
                )}
            </div>

            {/* Range selector */}
            <div className="flex items-center justify-between px-1">
                <h3 className="font-bold text-lg dark:text-white">Tasa BCV</h3>
                <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1 gap-1">
                    {RANGES.map(({ key, label }) => (
                        <button
                            key={key}
                            onClick={() => changeRange(key)}
                            className={cn(
                                'px-3 py-1 text-xs font-bold rounded-md transition-colors',
                                range === key
                                    ? 'bg-white dark:bg-gray-700 text-[#FF8A3D] dark:text-[#9B7BFF] shadow-sm'
                                    : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300',
                            )}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            {coverage && (
                <p className="px-1 text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                    Datos disponibles desde {longDate(coverage.from)}
                </p>
            )}
            {/* Chart + stats */}
            {loading ? (
                <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-4 space-y-3">
                    <div className="h-4 w-32 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
                    <div className="h-40 bg-gray-50 dark:bg-gray-800/50 rounded-xl animate-pulse" />
                    <div className="grid grid-cols-4 gap-2">
                        {[0, 1, 2, 3].map((i) => (
                            <div key={i} className="h-8 bg-gray-50 dark:bg-gray-800/50 rounded animate-pulse" />
                        ))}
                    </div>
                </div>
            ) : error ? (
                <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-6 text-center space-y-3">
                    <p className="text-sm font-bold text-gray-400">No se pudo cargar la serie de tasas</p>
                    <p className="text-[10px] text-gray-300 dark:text-gray-600 font-medium">{error}</p>
                    <button
                        onClick={onRetry}
                        className="text-xs font-black uppercase tracking-widest text-[#FF8A3D] dark:text-[#9B7BFF]"
                    >
                        Reintentar
                    </button>
                </div>
            ) : data.length === 0 ? (
                <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-6 text-center space-y-3">
                    <p className="text-sm font-bold text-gray-400">Sin tasas registradas todavia</p>
                    <button
                        onClick={handleRefresh}
                        disabled={refreshing}
                        className="text-xs font-black uppercase tracking-widest text-[#FF8A3D] dark:text-[#9B7BFF] disabled:opacity-50"
                    >
                        {refreshing ? 'Actualizando窶ｦ' : 'Actualizar desde BCV'}
                    </button>
                </div>
            ) : (
                <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-4">
                    <RateChart points={data} comparison={comparison} />

                    {stats && (
                        <div className="grid grid-cols-4 gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                            {[
                                ['Min', fmtRate(stats.min)],
                                ['Max', fmtRate(stats.max)],
                                ['Prom', fmtRate(stats.avg)],
                                ['Δ', `${stats.pct >= 0 ? '+' : ''}${fmtPct(stats.pct)}%`],
                            ].map(([label, value]) => (
                                <div key={label} className="text-center">
                                    <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">{label}</p>
                                    <p className="text-xs font-black dark:text-white tabular">{value}</p>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="flex gap-4 mt-2 text-[9px] font-bold text-gray-400 uppercase tracking-wider">
                        <span className="flex items-center gap-1">
                            <span className="w-4 h-[2px] bg-[#FF8A3D] dark:bg-[#9B7BFF] rounded" /> BCV publicado
                        </span>
                        <span className="flex items-center gap-1">
                            <span className="w-4 border-t-2 border-dashed border-gray-300 dark:border-gray-600" /> Arrastrado
                        </span>
                    </div>
                </div>
            )}
            {/* Daily history */}
            {!loading && !error && data.length > 0 && (
                <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-4">
                    <h4 className="font-bold text-sm uppercase tracking-widest text-gray-400 mb-3">Historial</h4>
                    <div>
                        {reversed.slice(0, visibleRows).map((p, idx) => {
                            const chronoIdx = data.length - 1 - idx;
                            const prev = chronoIdx > 0 ? parseFloat(data[chronoIdx - 1].rate) : null;
                            const cur = parseFloat(p.rate);
                            const diff = prev !== null ? cur - prev : 0;
                            const isFuture = p.date > TODAY;
                            return (
                                <div
                                    key={p.date}
                                    className={cn(
                                        'flex justify-between items-center py-1.5 border-b last:border-0',
                                        isFuture
                                            ? 'border-blue-100 dark:border-blue-900/40 bg-blue-50/50 dark:bg-blue-950/20'
                                            : 'border-gray-50 dark:border-gray-800',
                                    )}
                                >
                                    <span
                                        className={cn(
                                            'text-xs font-medium tabular',
                                            isFuture
                                                ? 'text-blue-600 dark:text-blue-300'
                                                : p.exact
                                                    ? 'text-gray-500 dark:text-gray-400'
                                                    : 'text-gray-400 dark:text-gray-600',
                                        )}
                                    >
                                        {p.exact ? '' : '≈ '}{shortDate(p.date)}
                                        {isFuture && <span className="ml-1 text-[9px] font-black uppercase">fut</span>}
                                    </span>
                                    <div className="flex items-center gap-3">
                                        <span
                                            className={cn(
                                                'text-xs font-black tabular',
                                                p.exact ? 'text-gray-700 dark:text-gray-200' : 'text-gray-400 dark:text-gray-600',
                                            )}
                                        >
                                            {fmtRate(p.rate)}
                                        </span>
                                        <span
                                            className={cn(
                                                'text-[10px] font-bold tabular w-16 text-right',
                                                diff > 0 ? 'text-green-500'
                                                    : diff < 0 ? 'text-red-500'
                                                        : 'text-gray-300 dark:text-gray-600',
                                            )}
                                        >
                                            {diff === 0 || prev === null ? '≈' : `${diff > 0 ? '+' : ''}${fmtRate(diff)}`}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    {reversed.length > visibleRows && (
                        <button
                            onClick={() => setVisibleRows(visibleRows + 60)}
                            className="w-full mt-3 py-2 text-xs font-black uppercase tracking-widest text-gray-400 hover:text-[#FF8A3D] dark:hover:text-[#9B7BFF] transition-colors"
                        >
                            Ver mas ({reversed.length - visibleRows})
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
/**
 * Hand-rolled SVG area chart 窶・no recharts so the initial bundle stays lean.
 * Carried-forward (non-exact) segments are drawn dashed: the visual honesty
 * of the backward-carry rule.
 *
 * The comparison series is drawn over the same axis, thinner and dimmer. It is
 * the same unit -- bolivares per unit of its own currency -- so sharing the
 * axis is honest rather than a rescale: the vertical distance between the two
 * lines is the real gap between a euro and a dollar at that date. The scale
 * therefore has to span both, and each series keeps its own carry-dashing,
 * because a day BCV published one and not the other is a fact about the data
 * and not a rendering choice.
 */
function RateChart({ points, comparison = null }) {
    const W = 600;
    const H = 190;
    const PAD = { t: 18, r: 74, b: 30, l: 6 };
    const [hover, setHover] = useState(null);
    const rateLabel = useRateLabel();

    // The comparison is indexed by date rather than position: the two series
    // are carried independently, so day 5 of one has no guaranteed day 5 of
    // the other when one of them starts later.
    const comparisonByDate = useMemo(
        () => new Map((comparison || []).map((p) => [p.date, p])),
        [comparison],
    );

    const geom = useMemo(() => {
        if (points.length < 2) return null;
        const vals = points.map((p) => parseFloat(p.rate));

        // The span covers both series, or the comparison would be drawn off the
        // top or bottom of the plot whenever it sits above or below.
        const all = [...vals, ...(comparison || []).map((p) => parseFloat(p.rate))].filter(Number.isFinite);
        let min = Math.min(...all);
        let max = Math.max(...all);
        if (max - min < 1e-9) {
            max += 1;
            min -= 1;
        }
        const span = max - min;
        const x = (i) => PAD.l + (i / (points.length - 1)) * (W - PAD.l - PAD.r);
        const y = (v) => PAD.t + (1 - (v - min) / span) * (H - PAD.t - PAD.b);

        let solid = '';
        let dashed = '';
        let area = `M ${x(0)} ${y(vals[0])}`;
        for (let i = 1; i < points.length; i++) {
            const seg = `M ${x(i - 1)} ${y(vals[i - 1])} L ${x(i)} ${y(vals[i])}`;
            if (points[i].exact) solid += seg;
            else dashed += seg;
            area += ` L ${x(i)} ${y(vals[i])}`;
        }
        area += ` L ${x(points.length - 1)} ${H - PAD.b} L ${x(0)} ${H - PAD.b} Z`;

        // The comparison is drawn only across the days it actually covers, so a
        // series that has not been backfilled far enough shows a short line
        // rather than a long one carried forward from nothing.
        let compSolid = '';
        let compDashed = '';
        let compStart = null;
        for (let i = 0; i < points.length; i++) {
            const match = comparisonByDate.get(points[i].date);
            if (!match) continue;
            const v = parseFloat(match.rate);
            if (!Number.isFinite(v)) continue;
            if (compStart === null) {
                compStart = i;
                compSolid += `M ${x(i)} ${y(v)}`;
                continue;
            }
            const seg = `M ${x(i - 1)} ${y(parseFloat(comparisonByDate.get(points[i - 1].date).rate))} L ${x(i)} ${y(v)}`;
            if (match.exact) compSolid += seg;
            else compDashed += seg;
        }

        const gridVals = [min + span * 0.06, min + span * 0.5, max - span * 0.06];
        const last = points.length - 1;
        const tickIdx = [...new Set([0, Math.floor(last / 3), Math.floor((last * 2) / 3), last])];

        return { x, y, solid, dashed, area, compSolid, compDashed, gridVals, tickIdx, hasComparison: compStart !== null };
    }, [points, comparisonByDate]);

    if (!geom) {
        return <p className="text-center text-xs font-bold text-gray-400 py-8">Datos insuficientes para la gráfica</p>;
    }

    const nearestIndex = (clientX, rect) => {
        const px = ((clientX - rect.left) / rect.width) * W;
        const t = (px - PAD.l) / (W - PAD.l - PAD.r);
        return Math.round(Math.min(1, Math.max(0, t)) * (points.length - 1));
    };

    const hp = hover !== null ? points[hover] : null;

    return (
        <div className="relative select-none">
            <svg
                viewBox={`0 0 ${W} ${H}`}
                className="w-full h-auto"
                onPointerMove={(e) => setHover(nearestIndex(e.clientX, e.currentTarget.getBoundingClientRect()))}
                onPointerDown={(e) => setHover(nearestIndex(e.clientX, e.currentTarget.getBoundingClientRect()))}
                onPointerLeave={() => setHover(null)}
            >
                <defs>
                    <linearGradient id="rateAreaFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.28" />
                        <stop offset="100%" stopColor="var(--brand)" stopOpacity="0" />
                    </linearGradient>
                </defs>

                {geom.gridVals.map((v, i) => (
                    <g key={i}>
                        <line
                            x1={PAD.l} x2={W - PAD.r} y1={geom.y(v)} y2={geom.y(v)}
                            stroke="var(--hairline)" strokeWidth="1" strokeDasharray="2 4"
                        />
                        <text
                            x={W - PAD.r + 6} y={geom.y(v) + 4.5} fontSize="14" fontWeight="700"
                            fill="var(--ink-3)" className="tabular"
                        >
                            {fmtRate(v)}
                        </text>
                    </g>
                ))}

                <path d={geom.area} fill="url(#rateAreaFill)" />
                {/* The comparison sits under the primary line so the primary
                    stays the figure the page is about. */}
                {geom.hasComparison && (
                    <>
                        <path
                            d={geom.compDashed} fill="none" stroke="var(--ink-3)" strokeWidth="1.5"
                            strokeDasharray="3 4" strokeLinecap="round" opacity="0.5"
                        />
                        <path
                            d={geom.compSolid} fill="none" stroke="var(--ink-3)" strokeWidth="1.75"
                            strokeLinejoin="round" strokeLinecap="round" opacity="0.8"
                        />
                    </>
                )}
                <path
                    d={geom.solid} fill="none" stroke="var(--brand)" strokeWidth="2.5"
                    strokeLinejoin="round" strokeLinecap="round"
                />
                <path
                    d={geom.dashed} fill="none" stroke="var(--brand)" strokeWidth="2"
                    strokeDasharray="3 4" strokeLinecap="round" opacity="0.55"
                />

                {geom.tickIdx.map((i) => (
                    <text
                        key={i} x={geom.x(i)} y={H - 6} fontSize="14" fontWeight="700"
                        fill="var(--ink-3)"
                        textAnchor={i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'}
                    >
                        {shortDate(points[i].date)}
                    </text>
                ))}

                {hp && hover !== null && (
                    <g>
                        <line
                            x1={geom.x(hover)} x2={geom.x(hover)} y1={PAD.t} y2={H - PAD.b}
                            stroke="var(--ink-3)" strokeWidth="1" strokeDasharray="2 3"
                        />
                        <circle
                            cx={geom.x(hover)} cy={geom.y(parseFloat(hp.rate))} r="4"
                            fill="var(--brand)" stroke="white" strokeWidth="1.5"
                        />
                    </g>
                )}
            </svg>

            {hp && hover !== null && (
                <div
                    className="absolute top-0 bg-gray-900 text-white text-[10px] font-bold px-2 py-1 rounded-lg shadow-lg pointer-events-none tabular whitespace-nowrap"
                    style={{ left: `${Math.min(72, Math.max(0, (geom.x(hover) / W) * 100 - 14))}%` }}
                >
                    {shortDate(hp.date)} · {rateLabel} {fmtRate(hp.rate)}{hp.exact ? '' : ' ≈'}
                </div>
            )}
        </div>
    );
}


