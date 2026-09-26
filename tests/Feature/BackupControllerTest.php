<?php

namespace Tests\Feature;

use App\Models\Budget;
use App\Models\SavingTransaction;
use App\Services\BackupImportResult;
use App\Services\BackupService;
use App\Services\BackupTransports;
use App\Support\NativeBridge;
use App\Support\NativeCapabilities;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Native\Mobile\Platform;
use Native\Mobile\Testing\FakeBridge;
use Smronju\NativephpDocumentPicker\Events\DocumentPicked;
use Tests\TestCase;

class BackupControllerTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Ziggy caches "have I already emitted the routes script?" in a static, and
     * clears it from Laravel Octane's RequestReceived event.
     *
     * Octane is not installed here, but the compiled app has the same problem for
     * a different reason: NativePHP boots the interpreter once and keeps it warm,
     * so that static survives every request for the life of the process. From the
     * second response onward Ziggy emits its merge script instead
     * (`Object.assign(Ziggy.routes, ...)`) — which references a `Ziggy` global that
     * response never defined — so the page dies with "Ziggy is not defined" and,
     * because the route helper went with it, every `route()` call after it.
     *
     * A normal test cannot see this, because each request in a test gets a fresh
     * application. Two renders in one test method share the process, which is the
     * condition the device actually runs in.
     */
    public function test_the_routes_script_is_emitted_again_on_a_later_request(): void
    {
        $first = $this->get('/settings')->assertOk()->getContent();
        $second = $this->get('/settings')->assertOk()->getContent();

        $this->assertStringContainsString('const Ziggy=', $first);

        // The regression: the second response used to carry only the merge script.
        $this->assertStringContainsString(
            'const Ziggy=',
            $second,
            'Ziggy was not re-declared on the second request, so the page has no Ziggy config.'
        );
        $this->assertStringNotContainsString(
            'Object.assign(Ziggy.routes',
            $second,
            'Ziggy fell back to its merge script, which needs a global this response never defined.'
        );
    }

    /**
     * The backup file input is a native form post, so it has to carry its own
     * CSRF token. The page reads that token out of a meta tag, so if the tag is
     * missing the component renders an empty token and every restore fails with
     * a 419 — which is exactly what happened when the page called a
     * `csrf_token()` helper that this app never defined.
     *
     * The tag is a server-rendered value, so this is the one place the wiring
     * can be checked without a browser.
     */
    public function test_the_layout_serves_the_csrf_token_the_file_form_reads(): void
    {
        $html = $this->get('/settings')->assertOk()->getContent();

        $this->assertMatchesRegularExpression(
            '/<meta\s+name="csrf-token"\s+content="[^"]+"/i',
            $html,
            'the layout served no csrf-token meta tag for the native backup form to read'
        );

        // And the tag must not be the empty string, or it is no better than
        // the missing helper it replaced.
        preg_match('/<meta\s+name="csrf-token"\s+content="([^"]*)"/i', $html, $matches);
        $this->assertNotSame('', trim($matches[1] ?? ''));
    }

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

        app(BackupImportResult::class)->record(
            'ok',
            'Respaldo restaurado: 1 mes y 12 registros.',
        );

        $this->get(route('backup.status'))
            ->assertOk()
            ->assertJsonPath('result.status', 'ok');
    }

    /**
     * The pick result is session-scoped, so the next person on a shared device
     * cannot read the last person's import outcome. The budget screens are
     * public, which is what made a single global cache key a real leak.
     */
    public function test_the_pick_result_is_not_readable_from_another_session(): void
    {
        $results = app(BackupImportResult::class);
        $results->record('ok', 'Respaldo restaurado: 3 meses y 40 registros.');

        $this->assertSame('ok', $results->read()['status']);

        // A second session is a different id, so it must see nothing at all.
        $this->flushSession();
        session()->flush();

        $this->assertNull(
            app(BackupImportResult::class)->read(),
            'one session could read another session\'s import result'
        );
    }

    /**
     * A slow pick — the user leaving to email themselves a backup — must still be
     * reported. The old implementation gave up after 20 seconds and told the
     * user nothing had come back, right before the restore succeeded.
     */
    public function test_a_pick_that_arrives_after_a_long_wait_is_still_reported(): void
    {
        $this->seedMonth();

        $payload = app(BackupService::class)->exportPayload();
        $this->wipe();

        // Well past the 20 polls at 1s the page used to give up after.
        $this->travel(15)->minutes();

        $path = tempnam(sys_get_temp_dir(), 'bkeeper');
        file_put_contents($path, json_encode($payload));

        try {
            event(new DocumentPicked($path, 'respaldo.json'));
        } finally {
            @unlink($path);
        }

        $this->assertDatabaseHas('budgets', ['month_id' => '2026-09']);
        $this->assertSame('ok', app(BackupImportResult::class)->read()['status']);
    }

    /**
     * The outcome is shown once, not on every visit for the next half hour.
     */
    public function test_the_pick_result_is_delivered_exactly_once(): void
    {
        app(BackupImportResult::class)->record('ok', 'Respaldo restaurado: 1 mes.');

        $this->get('/settings')->assertOk()->assertInertia(
            fn ($page) => $page->where('pickedImport.status', 'ok')
        );

        $this->get('/settings')->assertOk()->assertInertia(
            fn ($page) => $page->where('pickedImport', null)
        );
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

            $result = app(BackupImportResult::class)->read();
            $this->assertSame('ok', $result['status']);
            $this->assertSame('respaldo.json', $result['file']);
        } finally {
            @unlink($path);
        }
    }

    public function test_a_cancelled_pick_is_recorded_rather_than_awaited(): void
    {
        // The picker reports a cancel by omitting every key, and the page waits
        // for an outcome — so a cancel has to produce one.
        event(new DocumentPicked());

        $result = app(BackupImportResult::class)->read();

        $this->assertSame('cancelled', $result['status']);
        $this->assertSame('No se seleccionó ningún archivo.', $result['message']);
    }

    public function test_a_bridge_function_that_never_answers_is_reported_as_a_failure(): void
    {
        // NativePHPCall returns null for a function the build never registered,
        // and the Jump fallback returns null when muted. The vendor facades
        // guard only function_exists(), so without this the page would poll for
        // 20s waiting for a dialog that was never shown.
        FakeBridge::enable()->respondTo('DocumentPicker.Pick', null);

        $bridge = $this->bridge();
        $response = $bridge->call('DocumentPicker.Pick', ['mime_types' => ['application/json']]);

        $this->assertTrue($bridge->failed($response));
        $this->assertSame('error', $response['status']);
        $this->assertStringContainsString('DocumentPicker.Pick', $response['message']);
    }

    public function test_a_share_failure_is_surfaced(): void
    {
        // Share.File answers {} on success and {"error": ...} on failure — a
        // shape that a `success`/`status` check alone reads as success.
        FakeBridge::enable()->respondTo('Share.File', [
            'error' => 'No hay ninguna app que pueda compartir.',
        ]);

        $bridge = $this->bridge();
        $response = $bridge->call('Share.File', ['filePath' => '/tmp/backup.json']);

        $this->assertTrue($bridge->failed($response));
        $this->assertSame(
            'No hay ninguna app que pueda compartir.',
            $bridge->errorMessage($response, 'fallback')
        );
    }

    public function test_a_successful_picker_answer_is_not_a_failure(): void
    {
        // The picker returns {"success": true} the moment the dialog launches.
        FakeBridge::enable()->respondTo('DocumentPicker.Pick', ['success' => true]);

        $bridge = $this->bridge();
        $response = $bridge->call('DocumentPicker.Pick', ['mime_types' => ['application/json']]);

        $this->assertFalse($bridge->failed($response));
        $this->assertNull($bridge->errorMessage($response, 'fallback'));
    }

    public function test_a_save_that_cannot_find_the_file_is_a_failure(): void
    {
        FakeBridge::enable()->respondTo('DocumentPicker.Save', ['success' => false]);

        $bridge = $this->bridge();

        $this->assertTrue($bridge->failed($bridge->call('DocumentPicker.Save', [])));
    }

    public function test_an_empty_share_answer_is_treated_as_success(): void
    {
        // Share.File returns emptyMap() when the sheet opened. That is a real
        // success and must not be turned into an error.
        FakeBridge::enable()->respondTo('Share.File', []);

        $bridge = $this->bridge();

        $this->assertFalse($bridge->failed($bridge->call('Share.File', ['filePath' => '/tmp/b.json'])));
    }

    public function test_an_unreadable_bridge_answer_is_reported(): void
    {
        FakeBridge::enable()->respondTo('Share.File', 'not json at all');

        $bridge = $this->bridge();

        $this->assertTrue($bridge->failed($bridge->call('Share.File', [])));
    }

    public function test_a_bridge_error_response_is_reported_with_its_message(): void
    {
        // The shape BridgeResponse.error() and RemoteDesktop.Start both use.
        FakeBridge::enable()->respondTo('Share.File', [
            'status' => 'error',
            'code' => 'UNKNOWN_ERROR',
            'message' => 'Unexpected error: boom',
        ]);

        $bridge = $this->bridge();

        $this->assertSame('Unexpected error: boom', $bridge->errorMessage($bridge->call('Share.File', []), 'fallback'));
    }

    public function test_a_file_that_is_not_a_backup_leaves_the_data_alone(): void
    {
        $this->seedMonth();

        $path = tempnam(sys_get_temp_dir(), 'bkeeper');
        file_put_contents($path, json_encode(['format' => 'otra-app', 'data' => ['budgets' => []]]));

        try {
            event(new DocumentPicked($path, 'ajeno.json'));

            $this->assertSame('error', app(BackupImportResult::class)->read()['status']);
            $this->assertDatabaseHas('budgets', ['month_id' => '2026-09']);
            $this->assertDatabaseHas('savings_transactions', ['id' => 'sav-1']);
        } finally {
            @unlink($path);
        }
    }

    public function test_the_picker_route_reports_a_bridge_that_never_answers(): void
    {
        FakeBridge::enable()->respondTo('DocumentPicker.Pick', null);
        $this->pretendCapabilities(canPick: true);

        $this->post(route('backup.import.pick'))->assertSessionHasErrors('file');
    }

    public function test_the_export_route_reports_a_share_that_failed(): void
    {
        $this->seedMonth();
        FakeBridge::enable()->respondTo('Share.File', ['error' => 'No hay ninguna app que pueda compartir.']);
        $this->pretendCapabilities(canShare: true);

        $this->post(route('backup.export'), ['mode' => 'share'])
            ->assertSessionHasErrors('backup')
            // The false "listo" notice is exactly what the bug looked like.
            ->assertSessionMissing('backup_export');
    }

    public function test_the_export_route_reports_a_save_that_could_not_run(): void
    {
        $this->seedMonth();
        FakeBridge::enable()->respondTo('DocumentPicker.Save', null);
        $this->pretendCapabilities(canSave: true);

        $this->post(route('backup.export'), ['mode' => 'save'])
            ->assertSessionHasErrors('backup')
            ->assertSessionMissing('backup_export');
    }

    public function test_a_working_export_still_reports_success(): void
    {
        // The guard must not be so eager that it rejects a real handoff.
        $this->seedMonth();
        FakeBridge::enable()->respondTo('DocumentPicker.Save', ['success' => true]);
        $this->pretendCapabilities(canSave: true);

        $this->post(route('backup.export'), ['mode' => 'save'])
            ->assertSessionHasNoErrors()
            ->assertSessionHas('backup_export');
    }

    public function test_the_picker_route_still_succeeds_when_the_bridge_answers(): void
    {
        FakeBridge::enable()->respondTo('DocumentPicker.Pick', ['success' => true]);
        $this->pretendCapabilities(canPick: true);

        $this->post(route('backup.import.pick'))->assertSessionHasNoErrors();
    }

    /**
     * Every combination of bridge capability has to produce a coherent list, and
     * the two halves of the decision have to agree.
     *
     * Before the transport list existed the page asked `canSave || canShare` to
     * decide whether to fall back to a download while the export route
     * independently checked the same capabilities, so the page could offer a
     * button the route would then refuse. Both now read one table; this walks
     * the whole matrix to keep it that way.
     */
    public function test_the_offered_transports_match_what_the_routes_will_accept(): void
    {
        foreach ($this->capabilityCombinations() as $label => $capabilities) {
            $transports = new BackupTransports($capabilities);

            $offered = collect($transports->exportActions())
                ->filter(fn (array $action): bool => $action['enabled'])
                ->pluck('id')
                ->all();

            $imports = collect($transports->importActions())
                ->filter(fn (array $action): bool => $action['enabled'])
                ->pluck('id')
                ->all();

            // A browser always has the download. A compiled build always has at
            // least one native transport too — NativePHP compiles the save
            // picker in by default, and a build with neither save nor share is
            // a misconfigured one that must be called out rather than quietly
            // left with no way to take a backup out.
            if ($capabilities['canSave'] || $capabilities['canShare']) {
                $this->assertNotEmpty($offered, "no export transport offered for: {$label}");
            }

            $this->assertContains('paste', $imports, "paste should always be offered: {$label}");

            // A disabled transport has to say why, and an enabled one must not
            // claim a reason it does not have.
            foreach (array_merge($transports->exportActions(), $transports->importActions()) as $action) {
                if ($action['enabled']) {
                    $this->assertNull($action['reason'], "enabled transport carried a reason: {$label}/{$action['id']}");
                } else {
                    $this->assertNotNull($action['reason'], "disabled transport had no reason: {$label}/{$action['id']}");
                }
            }
        }
    }

    /**
     * A browser gets the download and the file input; the compiled app gets the
     * native pickers, and the browser-only ones are reported as unavailable
     * rather than offered.
     */
    public function test_a_browser_is_offered_the_download_and_the_file_input(): void
    {
        $transports = new BackupTransports($this->capabilities(isNative: false));

        $this->assertTrue($transports->supports($transports->exportActions(), 'download'));
        $this->assertTrue($transports->supports($transports->importActions(), 'file'));

        $this->assertFalse($transports->supports($transports->exportActions(), 'save'));
        $this->assertFalse($transports->supports($transports->importActions(), 'pick'));
    }

    /**
     * The phone inverts both: the WebView can neither save a downloaded
     * response nor open a file input, so those are the ones that must be
     * refused with a reason.
     */
    public function test_the_compiled_app_is_offered_the_native_pickers_instead(): void
    {
        $transports = new BackupTransports($this->capabilities(
            isNative: true,
            canSave: true,
            canPick: true,
        ));

        $this->assertTrue($transports->supports($transports->exportActions(), 'save'));
        $this->assertTrue($transports->supports($transports->importActions(), 'pick'));

        $this->assertFalse($transports->supports($transports->exportActions(), 'download'));
        $this->assertFalse($transports->supports($transports->importActions(), 'file'));
    }

    /**
     * A build compiled without the share plugin still has to explain the gap,
     * rather than silently omitting the button.
     */
    public function test_a_build_without_sharing_says_why_instead_of_hiding_it(): void
    {
        $transports = new BackupTransports($this->capabilities(isNative: true, canSave: true));

        $this->assertFalse($transports->supports($transports->exportActions(), 'share'));
        $this->assertStringContainsString(
            'compartir',
            mb_strtolower((string) $transports->reasonFor($transports->exportActions(), 'share'))
        );
    }

    /**
     * A transport nobody recognises is refused rather than defaulted to working.
     */
    public function test_an_unknown_transport_id_is_not_treated_as_available(): void
    {
        $transports = new BackupTransports($this->capabilities(isNative: true, canSave: true));

        $this->assertFalse($transports->supports($transports->exportActions(), 'telepathy'));
        $this->assertNotNull($transports->reasonFor($transports->exportActions(), 'telepathy'));
    }



    /**
     * Make the app look like a device whose bridge really has these capabilities.
     *
     * Two vendor seams rather than a hand-rolled stub, so the real detection
     * path runs: Platform::current() is what `isNative` keys off, and
     * FakeBridge implements GatedBridge, which is what `nativephp_can()` consults.
     */
    private function pretendCapabilities(
        bool $canSave = false,
        bool $canPick = false,
        bool $canShare = false,
        bool $isNative = true,
    ): void {
        Platform::set($isNative ? 'android' : null);

        $bridge = FakeBridge::enable();

        foreach (['DocumentPicker.Save' => $canSave, 'DocumentPicker.Pick' => $canPick, 'Share.File' => $canShare] as $method => $supported) {
            if (! $supported) {
                $bridge->withoutCapability($method);
            }
        }
    }

    /**
     * Every combination of the four capabilities that decide the transports.
     *
     * @return array<string, array{isNative: bool, canSave: bool, canPick: bool, canShare: bool}>
     */
    private function capabilityCombinations(): array
    {
        $combinations = [];

        foreach ([false, true] as $isNative) {
            foreach ([false, true] as $canSave) {
                foreach ([false, true] as $canPick) {
                    foreach ([false, true] as $canShare) {
                        $label = implode('/', array_map(
                            fn (bool $flag): string => $flag ? '1' : '0',
                            [$isNative, $canSave, $canPick, $canShare]
                        ));

                        $combinations[$label] = [
                            'isNative' => $isNative,
                            'canSave' => $canSave,
                            'canPick' => $canPick,
                            'canShare' => $canShare,
                        ];
                    }
                }
            }
        }

        return $combinations;
    }

    /**
     * @return array<string, mixed>
     */
    private function capabilities(
        bool $isNative = false,
        bool $canSave = false,
        bool $canPick = false,
        bool $canShare = false,
    ): array {
        return [
            'isNative' => $isNative,
            'platform' => $isNative ? 'android' : null,
            'canSave' => $canSave,
            'canPick' => $canPick,
            'canShare' => $canShare,
            'canRemoteDesktop' => false,
        ];
    }

    private function bridge(): NativeBridge
    {
        return $this->app->make(NativeBridge::class);
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
