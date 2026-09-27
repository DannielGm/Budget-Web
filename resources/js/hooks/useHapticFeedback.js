import { useEffect } from 'react';

/**
 * A short press vibration on every control marked `.touch-feedback`.
 *
 * Delegated from the document rather than wired into each control: the class is
 * already the app-wide convention for "this responds to touch", so 26 call
 * sites stay untouched and any new control that follows the convention gets
 * feedback for free.
 *
 * It fires on press, not on a completed action, so a button that goes on to
 * fail validation still buzzes. That matches the visual `:active` response it
 * sits alongside, and avoids waiting on a network round trip for a click that
 * may never have been a click.
 */

/** Barely-there press. Long enough to feel, short enough not to nag. */
const PRESS_MS = 10;
const FEEDBACK_SELECTOR = '.touch-feedback';

const canVibrate = () => typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';

const prefersReducedMotion = () => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

export default function useHapticFeedback() {
    useEffect(() => {
        if (!canVibrate() || prefersReducedMotion()) return undefined;

        const onPointerDown = (event) => {
            const target = event.target;
            if (!target?.closest) return;
            if (!target.closest(FEEDBACK_SELECTOR)) return;
            // A disabled control should not answer the finger.
            if (target.closest('[disabled]')) return;

            try {
                navigator.vibrate(PRESS_MS);
            } catch {
                // Some browsers expose vibrate but throw when the page is not
                // user-activated yet. Feedback is a nicety; never break a press.
            }
        };

        document.addEventListener('pointerdown', onPointerDown, { passive: true });

        return () => document.removeEventListener('pointerdown', onPointerDown);
    }, []);
}
