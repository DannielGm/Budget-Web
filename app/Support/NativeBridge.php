<?php

namespace App\Support;

/**
 * Calls a NativePHP bridge function and makes its answer legible.
 *
 * Every bridge function answers in a different shape, and none of those shapes
 * is "failed" in a way the caller can test with one comparison:
 *
 *   - `Share.File`          → `{}` on success, `{"error": "..."}` on failure
 *   - `DocumentPicker.Save` → `{"success": false}` when the file is missing
 *   - `DocumentPicker.Pick` → `{"success": true}` once the dialog is launched
 *   - `RemoteDesktop.Start` → `{"status": "error", "message": "..."}`
 *   - a function the build never registered → `null`, i.e. no answer at all
 *
 * The last one is the trap this class exists for. `nativephp_can()` is what
 * decides a function is available, and a build can pass that check and still
 * fail to dispatch: the capability probe and the call are separate round-trips,
 * and the vendor facades guard only `function_exists('nativephp_call')` before
 * returning void. Left as an empty array, that reads exactly like success — the
 * button appears to work and nothing happens. A null answer is therefore
 * reported as the failure it is.
 */
class NativeBridge
{
    /**
     * @param  (callable(string, array): ?string)|null  $invoker  Seam for tests;
     *                                                            null uses the real bridge.
     */
    public function __construct(private $invoker = null) {}

    /**
     * Dispatch a bridge function and decode its JSON answer.
     *
     * Never returns a shape that `errorMessage()` would read as success: a
     * missing function, a non-JSON answer and an un-dispatchable bridge all
     * come back as an explicit error the page can render.
     *
     * @param  array<string, mixed>  $parameters
     * @return array<string, mixed>
     */
    public function call(string $function, array $parameters = []): array
    {
        if (! function_exists('nativephp_call')) {
            return $this->unavailable($function);
        }

        $raw = $this->dispatch($function, $parameters);

        if ($raw === null || trim($raw) === '') {
            return $this->unavailable($function, 'El puente nativo no respondió.');
        }

        $decoded = json_decode($raw, true);

        if (! is_array($decoded)) {
            return $this->unavailable($function, 'El puente nativo devolvió una respuesta ilegible.');
        }

        return $decoded;
    }

    /**
     * Whether an answer from {@see self::call()} reports a failure.
     *
     * Deliberately checks all three failure shapes the bridge can produce
     * rather than the one the current plugin happens to use: `error` is what
     * `Share.File` sets, `success => false` is what the document picker sets,
     * and `status => "error"` is what the remote desktop (and every
     * `BridgeResponse.error()`) sets.
     *
     * @param  array<string, mixed>  $response
     */
    public function failed(array $response): bool
    {
        return ($response['status'] ?? null) === 'error'
            || ($response['success'] ?? true) === false
            || isset($response['error']);
    }

    /**
     * The message to show, or null when the call succeeded.
     *
     * @param  array<string, mixed>  $response
     */
    public function errorMessage(array $response, string $fallback): ?string
    {
        if (! $this->failed($response)) {
            return null;
        }

        foreach (['message', 'error'] as $key) {
            $value = $response[$key] ?? null;

            if (is_string($value) && trim($value) !== '') {
                return $value;
            }
        }

        return $fallback;
    }

    /**
     * @return array<string, mixed>
     */
    private function unavailable(string $function, string $detail = 'El puente nativo no está disponible en esta compilación.'): array
    {
        return [
            'status' => 'error',
            'message' => "{$detail} ({$function})",
        ];
    }

    /**
     * @param  array<string, mixed>  $parameters
     */
    private function dispatch(string $function, array $parameters): ?string
    {
        if ($this->invoker !== null) {
            return ($this->invoker)($function, $parameters);
        }

        return nativephp_call($function, json_encode($parameters));
    }
}