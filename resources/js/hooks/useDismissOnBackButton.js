import { useEffect, useRef } from 'react';

/** The history entry that stands in for "a layer is open". */
const SENTINEL = { dismissLayer: true };

/**
 * Make the Android back gesture close a floating layer instead of leaving it.
 *
 * A hardware/gesture back in a WebView is a history navigation, not a key
 * event, so a dropdown, popover or dialog that is not wired to the history stack
 * never sees it: the layer stays open and the app navigates away underneath it.
 * The usual desktop dismissal (Escape) does not exist on a phone.
 *
 * While a layer is open a sentinel entry is pushed onto the history stack. The
 * back gesture pops it, which fires `popstate` without leaving the page, and the
 * layer closes. The sentinel is pushed again, so back keeps closing layers rather
 * than escaping to the previous page -- and once nothing is open the sentinel is
 * gone and back navigates normally again.
 *
 * It is a factory rather than inline code because this suite runs in node with no
 * DOM: the whole rule is `pushState` plus one `popstate` listener, so a fake
 * window is enough to prove it.
 */
export function createBackGuard(target) {
    let onDismiss = null;

    const onPopState = (event) => {
        // Only our own sentinel should be swallowed. A back that lands on a real
        // history entry means the sentinel was already consumed, and the layer
        // must not close on top of a page change.
        if (!event.state?.dismissLayer) return;
        onDismiss?.();
        target.history.pushState(SENTINEL, '');
    };

    return {
        arm(dismiss) {
            // No history API at all (an old embedded view): leave the layer to its
            // tap-outside and Escape handlers rather than throwing on open.
            if (!target?.history?.pushState) return false;
            onDismiss = dismiss;
            target.history.pushState(SENTINEL, '');
            target.addEventListener('popstate', onPopState);
            return true;
        },
        disarm() {
            onDismiss = null;
            target?.removeEventListener?.('popstate', onPopState);
        },
    };
}

/**
 * Wire a layer's open state to the back gesture.
 *
 * `onDismiss` is held in a ref rather than listed as a dependency. Callers pass
 * an inline arrow, so depending on it would tear down and re-run this effect on
 * every render of the layer -- pushing a fresh history entry each time and
 * filling the back stack with sentinels the user would have to press through.
 */
export default function useDismissOnBackButton(open, onDismiss) {
    const dismiss = useRef(onDismiss);
    const guard = useRef(null);

    // Keep the latest callback without re-arming the guard.
    useEffect(() => {
        dismiss.current = onDismiss;
    }, [onDismiss]);

    if (guard.current === null) {
        guard.current = createBackGuard(typeof window === 'undefined' ? null : window);
    }

    useEffect(() => {
        if (!open) return undefined;
        guard.current.arm(() => dismiss.current?.());
        return () => guard.current.disarm();
    }, [open]);
}