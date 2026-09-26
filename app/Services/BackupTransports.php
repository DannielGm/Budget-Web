<?php

namespace App\Services;

use App\Support\NativeCapabilities;

/**
 * Decides how a backup can be moved on and off this build, in one place.
 *
 * The transports are genuinely different — a browser download, an OS Save-As
 * dialog, a share sheet, an `<input type=file>`, a document picker — but the
 * backup they carry is identical, and both halves of the decision used to be
 * made twice: once here on the server and again in the page, which is how they
 * came to disagree. The page asked `native.canSave || native.canShare` to decide
 * whether to fall back to a download, while the export route independently
 * checked the same capability and could refuse what the page had already
 * offered. This class is the single answer both sides read.
 *
 * Every transport is reported, including the unavailable ones, each carrying
 * why it is unavailable. The page previously hid a button it had no capability
 * for, so a user on a build without sharing had no way to learn the feature
 * existed — a disabled button with a reason is more honest than a missing one.
 *
 * Capability detection is not performed here. It costs a bridge round-trip on a
 * device and the caller already has the answer (see BudgetController::settings),
 * so it is passed in rather than probed twice.
 */
class BackupTransports
{
    /**
     * @param  array<string, mixed>  $capabilities  a NativeCapabilities::detect() result
     */
    public function __construct(private array $capabilities = [])
    {
        if ($this->capabilities === []) {
            $this->capabilities = NativeCapabilities::detect();
        }
    }

    /**
     * How this build can get a backup out of the app.
     *
     * The download is listed on every platform, including the phone: the
     * compiled WebView has no download listener and drops a
     * `Content-Disposition` response, so there it is offered but disabled with
     * the reason attached, and the native transports carry the card instead.
     *
     * @return list<array{id: string, label: string, enabled: bool, reason: ?string}>
     */
    public function exportActions(): array
    {
        $isNative = (bool) ($this->capabilities['isNative'] ?? false);

        return [
            $this->action(
                'download',
                'Descargar archivo',
                ! $isNative,
                'La descarga no funciona dentro de la app; usa "Guardar en el dispositivo" o "Compartir".'
            ),
            $this->action(
                'save',
                'Guardar en el dispositivo',
                (bool) ($this->capabilities['canSave'] ?? false),
                'Esta compilación no incluye el selector de archivos del sistema.'
            ),
            $this->action(
                'share',
                'Compartir',
                (bool) ($this->capabilities['canShare'] ?? false),
                'Esta compilación no incluye la hoja de compartir del sistema.'
            ),
        ];
    }

    /**
     * How this build can take a backup in.
     *
     * Pasting is always available and always last: it is the only transport that
     * depends on nothing at all — no bridge, no file chooser, no network — so
     * it is the one that still works when a build is missing a plugin.
     *
     * @return list<array{id: string, label: string, enabled: bool, reason: ?string}>
     */
    public function importActions(): array
    {
        $isNative = (bool) ($this->capabilities['isNative'] ?? false);

        return [
            $this->action(
                'file',
                'Subir archivo',
                ! $isNative,
                'La app no puede abrir un selector de archivos; usa "Elegir en el dispositivo" o pega el contenido.'
            ),
            $this->action(
                'pick',
                'Elegir en el dispositivo',
                (bool) ($this->capabilities['canPick'] ?? false),
                'Esta compilación no incluye el explorador de archivos del sistema; pega el contenido del respaldo.'
            ),
            $this->action(
                'paste',
                'Pegar contenido',
                true,
                null
            ),
        ];
    }

    /**
     * Whether the export id can be carried out by this build.
     *
     * The route still re-checks this itself — a client is not a trust boundary,
     * and the request can arrive without the page that produced it — but the two
     * now read the same table instead of each re-deriving the rule.
     *
     * @param  list<array{id: string, label: string, enabled: bool, reason: ?string}>  $actions
     */
    public function supports(array $actions, string $id): bool
    {
        foreach ($actions as $action) {
            if ($action['id'] === $id) {
                return $action['enabled'];
            }
        }

        return false;
    }

    /**
     * The reason a transport is unavailable, for the error a refused request
     * gets. Null when it is available.
     *
     * @param  list<array{id: string, label: string, enabled: bool, reason: ?string}>  $actions
     */
    public function reasonFor(array $actions, string $id): ?string
    {
        foreach ($actions as $action) {
            if ($action['id'] === $id) {
                return $action['enabled'] ? null : $action['reason'];
            }
        }

        return 'Este método de respaldo no está disponible.';
    }

    /**
     * @return array{id: string, label: string, enabled: bool, reason: ?string}
     */
    private function action(string $id, string $label, bool $enabled, ?string $reason): array
    {
        return [
            'id' => $id,
            'label' => $label,
            'enabled' => $enabled,
            // A reason on a working transport would be a lie, so it only rides
            // along with the disabled ones.
            'reason' => $enabled ? null : $reason,
        ];
    }
}
