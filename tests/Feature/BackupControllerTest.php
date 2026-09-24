<?php

namespace Tests\Feature;

use App\Listeners\RestorePickedBackup;
use App\Models\Budget;
use App\Models\SavingTransaction;
use App\Services\BackupService;
use App\Support\NativeCapabilities;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Smronju\NativephpDocumentPicker\Events\DocumentPicked;
use Tests\TestCase;

class BackupControllerTest extends TestCase
{
    use RefreshDatabase;

    public function test_the_export_route_returns_a_downloadable_backup_file(): void
    {
        $this->seedMonth();

        $response = $this->get(route('export'));

        $response->assertOk();
        $response->assertDownload();

        // What the browser would save is exactly the envelope a restore reads.
        $payload = json_decode(
            file_get_contents($response->baseResponse->getFile()->getPathname()),
            true
        );

        $this->assertSame(BackupService::FORMAT, $payload['format']);
        $this->assertSame(BackupService::FORMAT_VERSION, $payload['format_version']);
        $this->assertSame('2026-09', $payload['data']['budgets'][0]['month_id']);
        $this->assertSame('sav-1', $payload['data']['savings_transactions'][0]['id']);
    }

    public function test_it_restores_from_an_uploaded_file(): void
    {
        $this->seedMonth();

        $payload = app(BackupService::class)->exportPayload();
        $this->wipe();

        $file = UploadedFile::fake()->createWithContent('respaldo.json', json_encode($payload));

        $response = $this->post(route('import'), ['file' => $file]);

        $response->assertRedirect(route('settings'));
        $response->assertSessionHasNoErrors();
        $this->assertDatabaseHas('budgets', ['month_id' => '2026-09']);
        $this->assertDatabaseHas('savings_transactions', ['id' => 'sav-1']);
    }

    public function test_it_restores_from_pasted_json(): void
    {
        $this->seedMonth();

        $payload = app(BackupService::class)->exportPayload();
        $this->wipe();

        $response = $this->post(route('import'), ['json' => json_encode($payload)]);

        $response->assertRedirect(route('settings'));
        $this->assertDatabaseHas('budgets', ['month_id' => '2026-09']);
    }

    public function test_it_refuses_a_file_that_is_not_a_backup(): void
    {
        $this->seedMonth();

        $file = UploadedFile::fake()->createWithContent('notas.json', 'esto no es json');

        $response = $this->post(route('import'), ['file' => $file]);

        $response->assertSessionHasErrors('file');
        $this->assertDatabaseHas('budgets', ['month_id' => '2026-09']);
        $this->assertDatabaseHas('savings_transactions', ['id' => 'sav-1']);
    }

    public function test_it_asks_for_a_file_or_pasted_text(): void
    {
        $response = $this->post(route('import'));

        $response->assertSessionHasErrors('file');
    }

    public function test_the_picker_route_explains_itself_when_the_build_has_no_picker(): void
    {
        // Off-device there is no bridge at all, which is the same situation the
        // page faces in a build compiled without the plugin: it has to be told,
        // not left waiting for a dialog that will never open.
        $response = $this->post(route('backup.import.pick'));

        $response->assertSessionHasErrors('file');
        $this->assertFalse(NativeCapabilities::detect()['canPick']);
    }

    public function test_the_status_route_reports_the_last_import(): void
    {
        $this->get(route('backup.status'))
            ->assertOk()
            ->assertJsonPath('result', null)
            ->assertJsonPath('capabilities.canPick', false);

        Cache::put(RestorePickedBackup::STATUS_KEY, [
            'status' => 'ok',
            'message' => 'Respaldo restaurado: 1 mes y 12 registros.',
            'at' => now()->toIso8601String(),
        ], now()->addMinutes(5));

        $this->get(route('backup.status'))
            ->assertOk()
            ->assertJsonPath('result.status', 'ok');
    }

    public function test_the_registered_listener_restores_the_picked_file(): void
    {
        $this->seedMonth();

        $payload = app(BackupService::class)->exportPayload();
        $this->wipe();

        $path = tempnam(sys_get_temp_dir(), 'bkeeper');
        file_put_contents($path, json_encode($payload));

        try {
            // The event is what the native side fires; the listener bound in
            // AppServiceProvider is what turns it into a restore.
            event(new DocumentPicked($path, 'respaldo.json'));

            $this->assertDatabaseHas('budgets', ['month_id' => '2026-09']);

            $result = Cache::get(RestorePickedBackup::STATUS_KEY);
            $this->assertSame('ok', $result['status']);
            $this->assertSame('respaldo.json', $result['file']);
        } finally {
            @unlink($path);
        }
    }

    public function test_a_cancelled_pick_is_recorded_rather_than_awaited(): void
    {
        // The picker reports a cancel by omitting every key, and the page polls
        // for an outcome — so a cancel has to produce one.
        event(new DocumentPicked());

        $result = Cache::get(RestorePickedBackup::STATUS_KEY);

        $this->assertSame('cancelled', $result['status']);
        $this->assertSame('No se seleccionó ningún archivo.', $result['message']);
    }

    public function test_a_file_that_is_not_a_backup_leaves_the_data_alone(): void
    {
        $this->seedMonth();

        $path = tempnam(sys_get_temp_dir(), 'bkeeper');
        file_put_contents($path, json_encode(['format' => 'otra-app', 'data' => ['budgets' => []]]));

        try {
            event(new DocumentPicked($path, 'ajeno.json'));

            $this->assertSame('error', Cache::get(RestorePickedBackup::STATUS_KEY)['status']);
            $this->assertDatabaseHas('budgets', ['month_id' => '2026-09']);
            $this->assertDatabaseHas('savings_transactions', ['id' => 'sav-1']);
        } finally {
            @unlink($path);
        }
    }

    private function seedMonth(): void
    {
        Budget::create([
            'month_id' => '2026-09',
            'month_label' => 'Septiembre 2026',
            'income_bs' => '1000',
            'income_rate' => '40',
            'opening_balance_bs' => '100',
        ]);

        SavingTransaction::create([
            'id' => 'sav-1',
            'month_id' => '2026-09',
            'type' => 'deposit',
            'category' => 'Digital',
            'amount_usd' => '10',
            'exchange_rate' => '40',
            'amount_bs' => '400',
            'timestamp' => 1758000000,
        ]);
    }

    private function wipe(): void
    {
        foreach (array_reverse(BackupService::TABLES) as $table) {
            DB::table($table)->delete();
        }
    }
}
