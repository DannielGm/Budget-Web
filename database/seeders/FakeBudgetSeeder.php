<?php

namespace Database\Seeders;

use App\Models\Budget;
use App\Models\Category;
use App\Models\Debt;
use App\Models\Expense;
use App\Services\BudgetService;
use Carbon\CarbonImmutable;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;
use RuntimeException;

/**
 * Demo dataset for the mobile builds: four fake months showing an upward
 * balance trend in three months plus a single declining month.
 *
 * Months run backwards from September 2026 (2026-09 to 2026-06). Each month
 * opens with the previous month closing balance - exactly what the
 * carry-forward engine computes - and declares the closing balance it must
 * produce, so a broken rule fails loudly instead of drifting silently.
 */
class FakeBudgetSeeder extends Seeder
{
    /**
     * Month plan: income, BCV rate and target closing balance, plus the
     * expense rows (label|amount|day) and debts (label|opening|payment).
     * Categories listed under credit do not reduce the cash balance.
     */
    private const PLAN = [
        '2026-06' => [
            'income' => '180000',
            'rate' => '780',
            'opening' => '45000',
            'closing' => '11500',
            'rows' => [
                'HOGAR' => 'Alquiler|120000|1;Servicio de Internet|6500|3;Servicio de Luz|4200|5;Agua|3800|7',
                'ALIMENTACIÓN' => 'Mercado semanal|32000|2;Supermercado|18000|9;Panadería|4000|14',
                'ENTRETENIMIENTO' => 'Cine|3500|12;Streaming|6500|15;Salida|15000|22',
            ],
            'debts' => ['Tarjeta Visa|20000|5000'],
        ],
        '2026-07' => [
            'income' => '190000',
            'rate' => '790',
            'opening' => null,
            'closing' => '26500',
            'rows' => [
                'HOGAR' => 'Alquiler|120000|1;Servicio de Internet|6500|3;Servicio de Luz|5100|5;Agua|4000|7',
                'ALIMENTACIÓN' => 'Mercado semanal|22000|2;Supermercado|12400|9',
                'ENTRETENIMIENTO' => 'Cine|5000|12',
            ],
            'debts' => ['Tarjeta Visa|15000|5000'],
        ],
        '2026-08' => [
            'income' => '200000',
            'rate' => '795',
            'opening' => null,
            'closing' => '44500',
            'rows' => [
                'HOGAR' => 'Alquiler|120000|1;Servicio de Internet|6600|3;Servicio de Luz|5400|5;Agua|4000|7',
                'ALIMENTACIÓN' => 'Mercado semanal|26000|2;Supermercado|15000|9',
                'ENTRETENIMIENTO' => 'Streaming|5000|15',
            ],
            'credit' => [
                'ELECTRÓNICA' => 'Audífonos|6500|10;Teclado|5500|18',
            ],
            'debts' => ['Tarjeta Visa|10000|4000'],
        ],
        '2026-09' => [
            'income' => '220000',
            'rate' => '800',
            'opening' => null,
            'closing' => '66500',
            'rows' => [
                'HOGAR' => 'Alquiler|130000|1;Servicio de Internet|6900|3;Servicio de Luz|6100|5;Agua|4300|7',
                'ALIMENTACIÓN' => 'Mercado semanal|30000|2;Supermercado|15700|9',
                'ENTRETENIMIENTO' => 'Cine|5000|20',
            ],
            'credit' => [
                'ELECTRÓNICA' => 'Funda de teléfono|4500|8',
            ],
            'debts' => ['Tarjeta Visa|6000|6000', 'Compras a crédito Agosto|12000|0'],
        ],
    ];

    private const MONTH_NAMES = [
        1 => 'Enero', 2 => 'Febrero', 3 => 'Marzo', 4 => 'Abril',
        5 => 'Mayo', 6 => 'Junio', 7 => 'Julio', 8 => 'Agosto',
        9 => 'Septiembre', 10 => 'Octubre', 11 => 'Noviembre', 12 => 'Diciembre',
    ];

    public function run(): void
    {
        // Idempotent: wipe only the demo months, keep anything else untouched.
        Budget::whereIn('month_id', array_keys(self::PLAN))
            ->each(fn (Budget $budget) => $budget->delete());

        // Insert oldest first so each month sees its predecessor while the
        // closing balance is being asserted.
        $monthIds = array_keys(self::PLAN);
        sort($monthIds);

        foreach ($monthIds as $index => $monthId) {
            $plan = self::PLAN[$monthId];
            $opening = $plan['opening'] ?? $this->previousClosing($monthIds[$index - 1]);
            $this->seedMonth($monthId, $plan, $opening);
        }
    }

    private function previousClosing(string $previousMonthId): string
    {
        $budget = Budget::find($previousMonthId);

        if (! $budget) {
            throw new RuntimeException("Previous demo month [{$previousMonthId}] was not seeded.");
        }

        return app(BudgetService::class)->calculateBalance($budget->fresh(['expenses', 'categories']));
    }

    private function seedMonth(string $monthId, array $plan, string $opening): void
    {
        [$year, $month] = explode('-', $monthId);
        $label = self::MONTH_NAMES[(int) $month].' '.$year;

        $budget = Budget::create([
            'month_id' => $monthId,
            'month_label' => $label,
            'income_bs' => $plan['income'],
            'income_rate' => $plan['rate'],
            'opening_balance_bs' => $opening,
        ]);

        $position = 0;
        foreach ($plan['rows'] ?? [] as $name => $rows) {
            $this->seedCategory($monthId, $name, true, $position++, $rows);
        }

        foreach ($plan['credit'] ?? [] as $name => $rows) {
            $this->seedCategory($monthId, $name, false, $position++, $rows);
        }

        foreach ($plan['debts'] as $debtIndex => $debtRow) {
            [$label, $openingBs, $paymentBs] = explode('|', $debtRow);
            Debt::create([
                'month_id' => $monthId,
                'label' => $label,
                'opening_bs' => $openingBs,
                'payment_bs' => $paymentBs,
                'position' => $debtIndex,
            ]);
        }

        $calculated = app(BudgetService::class)->calculateBalance($budget->fresh(['expenses', 'categories']));
        if (bccomp($calculated, $plan['closing'], 2) !== 0) {
            throw new RuntimeException(sprintf(
                'Demo month %s closes at %s but the plan declares %s.',
                $monthId,
                $calculated,
                $plan['closing']
            ));
        }
    }

    private function seedCategory(string $monthId, string $name, bool $cash, int $position, string $rows): void
    {
        // For the demo, "planned" is set to roughly 1.2x the actual total,
        // or a fixed high value for empty/future months.
        $actualTotal = 0;
        foreach (explode(';', $rows) as $row) {
            $actualTotal += (float) explode('|', $row)[1];
        }

        Category::create([
            'month_id' => $monthId,
            'name' => $name,
            'cash_expense' => $cash,
            'planned_bs' => $actualTotal > 0 ? (string) ($actualTotal * 1.1) : '50000',
            'position' => $position,
        ]);

        foreach (explode(';', $rows) as $rowIndex => $row) {
            [$label, $amount, $day] = explode('|', $row);

            Expense::create([
                'id' => (string) Str::uuid(),
                'month_id' => $monthId,
                'category_name' => $name,
                'label' => $label,
                'amount_bs' => $amount,
                'rate' => self::PLAN[$monthId]['rate'],
                'timestamp' => $this->timestampFor($monthId, (int) $day),
                'position' => $rowIndex,
            ]);
        }
    }

    private function timestampFor(string $monthId, int $day): int
    {
        // Local noon on the given day, in epoch milliseconds: enough spread
        // for the graph's intra-month curve.
        $date = CarbonImmutable::create(
            (int) substr($monthId, 0, 4),
            (int) substr($monthId, 5, 2),
            $day,
            12,
            0,
            0,
            config('app.timezone'),
        );

        return $date->getTimestamp() * 1000;
    }
}
