import React, { useMemo } from 'react';
import {
    Flame, PiggyBank, Wallet, CreditCard,
    TrendingUp, TrendingDown, Receipt, Target,
} from 'lucide-react';
import { fmtBs, fmtUsd, fmtPct } from '@/lib/money';
import { buildInsights } from '@/lib/insights';
import useFitText from '@/hooks/useFitText';
import { useCurrency } from '@/lib/currency';
import { useCurrencySymbol, useBolivarFigure } from '@/hooks/useFigure';

/**
 * "Análisis" — the precision instrument of the app.
 *
 * Every figure is derived from props the dashboard already has, so there is no
 * backend work and no second source of truth. Bars are pure CSS: no chart
 * library, no extra bundle, instant paint.
 */

const usd = (bs, rate) => (Number(rate) > 0 ? Number(bs || 0) / Number(rate) : 0);

/** One staged reveal for the whole screen; cards carry a 50ms step each. */
const REVEAL = 'insights-reveal';

function Section({ title, icon: Icon, meta, children, index = 0 }) {
    return (
        <section
            className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900"
            style={{ animationDelay: `${index * 50}ms` }}
            data-reveal={REVEAL}
        >
            <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="flex min-w-0 items-center gap-2 text-xs font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">
                    {Icon ? <Icon size={15} className="shrink-0" aria-hidden="true" /> : null}
                    <span className="truncate">{title}</span>
                </h2>
                {meta ? (
                    <span className="shrink-0 whitespace-nowrap text-[10px] font-bold uppercase tracking-wider tabular text-gray-400 dark:text-gray-500">
                        {meta}
                    </span>
                ) : null}
            </div>
            {children}
        </section>
    );
}

/** A labelled horizontal measure — the workhorse of the whole screen. */
function Bar({ valuePct, tone = 'accent', label }) {
    const width = Math.max(0, Math.min(100, valuePct || 0));
    const fill = tone === 'good' ? 'bg-emerald-500'
        : tone === 'warn' ? 'bg-amber-400'
            : tone === 'bad' ? 'bg-red-500'
                : 'bg-[#FF8A3D] dark:bg-[#9B7BFF]';

    return (
        <div
            className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800"
            role="progressbar"
            aria-label={label}
            aria-valuemin="0"
            aria-valuemax="100"
            aria-valuenow={Math.round(width)}
        >
            <div className={`h-full rounded-full transition-[width] duration-500 ease-out ${fill}`} style={{ width: `${width}%` }} />
        </div>
    );
}

function EmptyNote({ children }) {
    return (
        <p className="py-4 text-center text-xs font-bold text-gray-400 dark:text-gray-500">
            {children}
        </p>
    );
}

function Hero({ d, rate, netRef, netSize }) {
    const symbol = useCurrencySymbol();
    const foreign = useBolivarFigure();
    const stats = [
        { label: 'Ingresos', value: d.incomeBs, icon: TrendingUp },
        { label: 'Gastos', value: d.cashBs, icon: TrendingDown },
        { label: 'Pagado', value: d.debtPaymentsBs, icon: CreditCard },
    ];

    return (
        <section
            className="overflow-hidden rounded-2xl bg-[#1A1A1A] p-5 text-white shadow-lg"
            style={{ animationDelay: '50ms' }}
            data-reveal={REVEAL}
            aria-labelledby="insights-hero"
        >
            <h2 id="insights-hero" className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                Neto del mes
            </h2>
            <p
                ref={netRef}
                style={{ fontSize: `${netSize}px` }}
                className={`mt-1 whitespace-nowrap text-5xl font-black font-serif tracking-tight tabular ${d.netBs >= 0 ? 'text-white' : 'text-red-400'}`}
            >
                Bs {fmtBs(d.netBs)}
            </p>
            <p className="mt-1 whitespace-nowrap text-[11px] font-medium tabular text-gray-400">
                &asymp; {fmtUsd(foreign(d.netBs, rate))} {symbol} · ingresos &minus; efectivo &minus; cr&eacute;dito &minus; pagos
            </p>

            <div className="mt-4 grid grid-cols-3 gap-2 border-t border-white/10 pt-4">
                {stats.map(({ label, value, icon: Icon }) => (
                    <div key={label} className="min-w-0">
                        <p className="flex items-center gap-1 truncate text-[10px] font-bold uppercase tracking-wider text-gray-400">
                            <Icon size={12} className="shrink-0" aria-hidden="true" />
                            {label}
                        </p>
                        <p className="mt-1 truncate whitespace-nowrap text-sm font-bold tabular text-white">
                            Bs {fmtBs(value, 0)}
                        </p>
                    </div>
                ))}
            </div>
        </section>
    );
}

function PlanSection({ d }) {
    // The meaningful comparison is the plan against the available balance, the
    // same rule the dashboard's isBudgetOk uses. A share-of-plan-total figure
    // is 100% by construction whenever there is a single plan category, so it
    // carries no information about whether the month is affordable.
    const verdictClass = d.planFitsBalance
        ? 'text-emerald-600 dark:text-emerald-400'
        : 'text-red-500 dark:text-red-400';
    const verdictBar = d.planFitsBalance ? 'good' : 'bad';

    return (
        <Section title="Gasto de presupuesto" icon={Target} index={1}>
            {d.planRows.length === 0
                ? <EmptyNote>Sin categorías de presupuesto este mes</EmptyNote>
                : (
                    <React.Fragment>
                        <div className="rounded-xl bg-gray-50 p-3 dark:bg-gray-800/50">
                            <div className="flex items-baseline justify-between gap-3">
                                <p className="min-w-0 truncate text-sm font-bold tabular text-gray-800 dark:text-gray-100">
                                    Bs {fmtBs(d.planTotalBs, 0)}
                                    <span className="font-medium text-gray-400 dark:text-gray-500">
                                        {' '}de Bs {fmtBs(d.availableBalanceBs, 0)} disponibles
                                    </span>
                                </p>
                                {d.planAgainstAvailablePct === null ? null : (
                                    <p className={`shrink-0 whitespace-nowrap text-base font-black tabular ${verdictClass}`}>
                                        {fmtPct(d.planAgainstAvailablePct, 0)}%
                                    </p>
                                )}
                            </div>
                            {d.planAgainstAvailablePct === null ? null : (
                                <div className="mt-2">
                                    <Bar
                                        valuePct={d.planAgainstAvailablePct}
                                        tone={verdictBar}
                                        label="Presupuesto del mes respecto al saldo disponible"
                                    />
                                </div>
                            )}
                        </div>

                        <ul className="mt-2 divide-y divide-gray-100 dark:divide-gray-800">
                            {d.planRows.map((row) => (
                                <li key={row.name} className="flex items-baseline justify-between gap-3 py-2 first:pt-0">
                                    <span className="min-w-0 truncate text-xs font-semibold text-gray-700 dark:text-gray-200">
                                        {row.name}
                                    </span>
                                    <span className="shrink-0 whitespace-nowrap text-xs font-bold tabular text-gray-800 dark:text-gray-100">
                                        Bs {fmtBs(row.amountBs, 0)}
                                        <span className="ml-1.5 text-[10px] font-medium text-gray-400 dark:text-gray-500">
                                            {fmtPct(row.sharePct, 0)}%
                                        </span>
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </React.Fragment>
                )}
        </Section>
    );
}

function BurnSection({ d }) {
    const base = Math.max(1, d.openingBs + d.incomeBs);
    const closingPct = d.projectedClosingBs < 0 ? 100 : (d.projectedClosingBs / base) * 100;

    return (
        <Section title="Ritmo de gasto" icon={Flame} meta={`día ${d.elapsed} de ${d.total}`} index={2}>
            <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-gray-50 p-3 dark:bg-gray-800/50">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                        Ritmo diario
                    </p>
                    <p className="mt-1 whitespace-nowrap text-base font-black tabular text-gray-800 dark:text-gray-100">
                        Bs {fmtBs(d.burnBs)}
                    </p>
                </div>
                <div className="rounded-xl bg-gray-50 p-3 dark:bg-gray-800/50">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                        Proyección
                    </p>
                    <p className="mt-1 whitespace-nowrap text-base font-black tabular text-gray-800 dark:text-gray-100">
                        Bs {fmtBs(d.projectedCashBs, 0)}
                    </p>
                </div>
            </div>

            <div className="mt-3">
                <div className="mb-1.5 flex items-baseline justify-between gap-3 text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                    <span className="truncate">Apertura Bs {fmtBs(d.openingBs, 0)}</span>
                    <span className="shrink-0 tabular">Cierre Bs {fmtBs(d.projectedClosingBs, 0)}</span>
                </div>
                <Bar
                    valuePct={closingPct}
                    tone={d.projectedClosingBs < 0 ? 'bad' : 'good'}
                    label="Cierre proyectado respecto a la apertura más ingresos"
                />
                <p className="mt-1.5 text-[10px] font-semibold text-gray-400 dark:text-gray-500">
                    Si mantienes este ritmo
                </p>
            </div>
        </Section>
    );
}

function CompositionSection({ d }) {
    return (
        <Section title="Composición de gastos" icon={Wallet} meta={`Bs ${fmtBs(d.cashBs, 0)}`} index={3}>
            {d.composition.length === 0
                ? <EmptyNote>Sin gastos de efectivo registrados</EmptyNote>
                : (
                    <ul className="space-y-2.5">
                        {d.composition.map((row) => (
                            <li key={row.name}>
                                <div className="mb-1 flex items-baseline justify-between gap-3">
                                    <span className="min-w-0 truncate text-xs font-semibold text-gray-700 dark:text-gray-200">
                                        {row.name}
                                    </span>
                                    <span className="shrink-0 whitespace-nowrap text-[10px] font-bold tabular text-gray-400 dark:text-gray-500">
                                        Bs {fmtBs(row.amountBs, 0)} · {fmtPct(row.sharePct, 0)}%
                                    </span>
                                </div>
                                <Bar valuePct={row.sharePct} label={`${row.name} — ${fmtPct(row.sharePct, 0)}% de los gastos`} />
                            </li>
                        ))}
                    </ul>
                )}
        </Section>
    );
}

function DebtSection({ d, rate }) {
    const symbol = useCurrencySymbol();
    const foreign = useBolivarFigure();
    return (
        <Section
            title="Deudas"
            icon={CreditCard}
            meta={d.debtBaseBs > 0 ? `${fmtPct(d.debtPaidPct, 0)}% pagado` : null}
            index={4}
        >
            <div className="mb-3 flex items-end justify-between gap-3">
                <p className="whitespace-nowrap font-serif text-2xl font-black tracking-tight tabular text-gray-800 dark:text-gray-100">
                    Bs {fmtBs(d.remainingBs)}
                </p>
                <p className="whitespace-nowrap text-[11px] font-bold tabular text-gray-400 dark:text-gray-500">
                    &asymp; {fmtUsd(foreign(d.remainingBs, rate))} {symbol}
                </p>
            </div>

            {d.debtBaseBs > 0 ? (
                <div className="mb-3">
                    <Bar
                        valuePct={d.debtPaidPct}
                        tone={d.debtPaidPct >= 100 ? 'good' : 'accent'}
                        label="Progreso pagado de deudas"
                    />
                    <p className="mt-1.5 text-[10px] font-semibold tabular text-gray-400 dark:text-gray-500">
                        Bs {fmtBs(d.paidBs, 0)} pagados sobre Bs {fmtBs(d.debtBaseBs, 0)}
                    </p>
                </div>
            ) : null}

            {d.debts.length === 0
                ? <EmptyNote>Sin deudas registradas</EmptyNote>
                : (
                    <ul className="flex flex-wrap gap-1.5">
                        {d.debts.map(({ debt, remainingBs, paidPercentage }) => (
                            <li
                                key={debt.id}
                                className="rounded-full bg-gray-100 px-2.5 py-1 text-[10px] font-bold tabular text-gray-600 dark:bg-gray-800 dark:text-gray-300"
                                title={`${debt.label} — Bs ${fmtBs(remainingBs)}`}
                            >
                                <span className="max-w-[9rem] truncate align-middle">{debt.label}</span>
                                <span className="ml-1.5 text-gray-400 dark:text-gray-500">
                                    {fmtPct(paidPercentage, 0)}%
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
        </Section>
    );
}

function SavingsSection({ d }) {
    const symbol = useCurrencySymbol();

    return (
        <Section
            title="Tasa de ahorro"
            icon={PiggyBank}
            meta={`${symbol} ${fmtUsd(d.savingsTotal, 0)} acumulados`}
            index={5}
        >
            <div className="flex items-end justify-between gap-3">
                <p
                    className={`whitespace-nowrap font-serif text-2xl font-black tracking-tight tabular ${
                        d.savingsRatePct >= 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-red-500 dark:text-red-400'
                    }`}
                >
                    {fmtPct(d.savingsRatePct, 1)}%
                </p>
                <p className="shrink-0 whitespace-nowrap text-right text-[10px] font-semibold leading-tight tabular text-gray-400 dark:text-gray-500">
                    {symbol} {fmtUsd(d.deposits)} depósitos
                    <br />
                    {symbol} {fmtUsd(d.withdrawals)} retiros
                </p>
            </div>
            <p className="mt-1 text-[10px] font-semibold text-gray-400 dark:text-gray-500">
                (Depósitos &minus; retiros) / ingreso del mes
            </p>
        </Section>
    );
}

const ACTIVITY_TONES = {
    expense: { cls: 'bg-slate-100 text-slate-600 dark:bg-gray-800 dark:text-gray-300', label: 'Gasto' },
    // Indigo matches the "Presupuesto" badge the expense card already uses, so
    // tracked spending never reads as cash leaving the balance.
    presupuesto: { cls: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300', label: 'Presupuesto' },
    deposit: { cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', label: 'Depósito' },
    withdrawal: { cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', label: 'Retiro' },
    transfer: { cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', label: 'Transferencia' },
};

function ActivitySection({ d }) {
    return (
        <Section title="Actividad reciente" icon={Receipt} index={6}>
            {d.activity.length === 0
                ? <EmptyNote>Sin movimientos este mes</EmptyNote>
                : (
                    <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                        {d.activity.map((item) => {
                            const tone = ACTIVITY_TONES[item.type] || ACTIVITY_TONES.expense;
                            const when = new Date(item.timestamp);
                            return (
                                <li key={item.id} className="flex items-center gap-2 py-2 first:pt-0 last:pb-0 sm:gap-3">
                                    <div className="min-w-0 flex-1 overflow-hidden">
                                        <p className="truncate text-xs font-semibold text-gray-700 dark:text-gray-200">
                                            {item.label}
                                        </p>
                                        <p className="block w-full truncate text-[10px] tabular text-gray-400 dark:text-gray-500">
                                            {when.toLocaleDateString('es-ES')} {when.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                    </div>
                                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${tone.cls}`}>
                                        {tone.label}
                                    </span>
                                    <span className="w-16 shrink-0 truncate text-right text-xs font-bold tabular text-gray-800 dark:text-gray-100 sm:w-24">
                                        Bs {fmtBs(item.amountBs, 0)}
                                    </span>
                                </li>
                            );
                        })}
                    </ul>
                )}
        </Section>
    );
}

export default function InsightsDashboard({ budget = {}, savingsLedger = [], rate = 0, todayIso = '' }) {
    // The savings figures count one pot, the one this currency is saved in.
    const currency = useCurrency();
    const d = useMemo(
        () => buildInsights(budget, { savingsLedger, rate, todayIso, currency }),
        [budget, savingsLedger, rate, todayIso, currency],
    );
    const [netRef, netSize] = useFitText({ min: 30, max: 48, emergencyMin: 22 });
    const symbol = useCurrencySymbol();
    const foreign = useBolivarFigure();

    return (
        <div className="space-y-4 pb-10">
            {/* No title or back control here any more: the page header owns both
                now, so this panel used to render a second <h1> and a second way
                out. The month it was opened for rides along as the subtitle. */}

            <Hero d={d} rate={rate} netRef={netRef} netSize={netSize} />
            <PlanSection d={d} />
            <BurnSection d={d} />
            <CompositionSection d={d} />
            <DebtSection d={d} rate={rate} />
            <SavingsSection d={d} />
            <ActivitySection d={d} />
        </div>
    );
}
