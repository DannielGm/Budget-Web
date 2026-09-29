import { useEffect, useRef } from 'react';
import useDismissOnBackButton from './useDismissOnBackButton';

/**
 * Dismissal for the header's overflow popover.
 *
 * Three things have to close it and they used to be written out at every call
 * site: tapping away, Escape, and the Android back gesture. A phone has no
 * Escape key, and the back gesture is a history navigation the popover never
 * sees, so without the third path a tap-away-only popover navigates the app out
 * from under itself.
 *
 * `onDismiss(restoreFocus)` is called with true when the user dismissed the layer
 * by keyboard or back -- a pointer tap away is a decision to move on, so focus is
 * left where the tap landed rather than yanked back to the trigger.
 *
 * The callback is held in a ref for the same reason useDismissOnBackButton holds
 * its own: callers pass inline arrows, and depending on them would re-arm the
 * history guard on every render.
 */
export default function useMenuDismiss(open, onDismiss) {
    const containerRef = useRef(null);
    const dismiss = useRef(onDismiss);

    useEffect(() => {
        dismiss.current = onDismiss;
    }, [onDismiss]);

    useDismissOnBackButton(open, () => dismiss.current?.(true));

    useEffect(() => {
        if (!open) return undefined;
        const onPointerDown = (event) => {
            if (!containerRef.current?.contains(event.target)) dismiss.current?.(false);
        };
        const onKeyDown = (event) => {
            if (event.key !== 'Escape') return;
            event.stopPropagation();
            dismiss.current?.(true);
        };
        document.addEventListener('mousedown', onPointerDown);
        document.addEventListener('touchstart', onPointerDown, { passive: true });
        document.addEventListener('keydown', onKeyDown);
        return () => {
            document.removeEventListener('mousedown', onPointerDown);
            document.removeEventListener('touchstart', onPointerDown);
            document.removeEventListener('keydown', onKeyDown);
        };
    }, [open]);

    return containerRef;
}