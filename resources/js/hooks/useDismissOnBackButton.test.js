// The Android back gesture must close a floating layer, not navigate past it.
//
// This suite runs in node with no DOM, so the rule is driven through the
// exported factory against a fake window: the guard only ever touches
// `history.pushState` and one `popstate` listener, so that is the whole surface.
import { describe, expect, it, vi } from 'vitest';
import { createBackGuard } from './useDismissOnBackButton.js';

/** A window with just the three things the guard uses. */
function fakeWindow() {
    const listeners = new Set();
    return {
        pushed: [],
        addEventListener: (type, fn) => { if (type === 'popstate') listeners.add(fn); },
        removeEventListener: (type, fn) => { if (type === 'popstate') listeners.delete(fn); },
        history: {
            pushState(state) { this.owner.pushed.push(state); },
            owner: null,
        },
        // What the browser does on a back gesture: pop an entry and fire.
        back(state = { dismissLayer: true }) {
            listeners.forEach((fn) => fn({ state }));
        },
        get listening() { return listeners.size > 0; },
    };
}

function armed(onDismiss) {
    const target = fakeWindow();
    target.history.owner = target;
    const guard = createBackGuard(target);
    guard.arm(onDismiss);
    return { target, guard };
}

describe('back closes the layer that is open', () => {
    it('stands a sentinel on the history stack while open', () => {
        const { target } = armed(() => {});
        expect(target.pushed).toHaveLength(1);
        expect(target.pushed[0]).toEqual({ dismissLayer: true });
        expect(target.listening).toBe(true);
    });

    it('closes the layer when back pops the sentinel', () => {
        const onDismiss = vi.fn();
        const { target } = armed(onDismiss);

        target.back();

        expect(onDismiss).toHaveBeenCalledTimes(1);
    });

    it('re-arms the sentinel, so back keeps closing instead of leaving the page', () => {
        const onDismiss = vi.fn();
        const { target } = armed(onDismiss);

        target.back();
        target.back();

        // Without the re-arm the second back would leave the app, which is the
        // behaviour this exists to stop.
        expect(onDismiss).toHaveBeenCalledTimes(2);
        expect(target.pushed).toHaveLength(3);
    });

    it('ignores a back that is really a navigation', () => {
        const onDismiss = vi.fn();
        const { target } = armed(onDismiss);

        target.back({ someOtherPage: true });

        expect(onDismiss).not.toHaveBeenCalled();
    });

    it('stops listening once the layer closes', () => {
        const onDismiss = vi.fn();
        const { target, guard } = armed(onDismiss);

        guard.disarm();
        target.back();

        expect(onDismiss).not.toHaveBeenCalled();
        expect(target.listening).toBe(false);
    });

    it('leaves the history stack alone when there is no history API', () => {
        const guard = createBackGuard({ addEventListener() {}, removeEventListener() {} });

        // A view this old cannot do it, and the layer must still open.
        expect(guard.arm(() => {})).toBe(false);
    });

    it('does not throw when there is no window at all', () => {
        // A server render builds the hook before any window exists.
        const guard = createBackGuard(null);
        expect(() => guard.arm(() => {})).not.toThrow();
        expect(() => guard.disarm()).not.toThrow();
    });
});