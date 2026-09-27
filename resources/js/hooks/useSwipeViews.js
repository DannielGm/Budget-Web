import { useCallback, useRef } from 'react';

/**
 * Horizontal swipe between the dashboard views.
 *
 * Two decisions this makes deliberately, both learned from the drag behaviour it
 * replaces:
 *
 *  - The view does not move while the finger is down. The old framer `drag`
 *    tracked the pointer 1:1 (dragElastic 1), so the whole dashboard slid
 *    sideways under the thumb and anything with its own touch handler — the
 *    balance graph above all — could never get a clean gesture. Here the
 *    gesture is measured, not animated, and the view only changes on release.
 *
 *  - The threshold is distance-dominant. The old test was
 *    `offset.x * velocity.x > 10000`, which read a 20px twitch at 500px/s as a
 *    committed swipe while rejecting a slow, deliberate 200px drag. Distance
 *    decides, and velocity only lets a short sharp flick through.
 */

/** A drag must travel this far to count on its own. */
/**
 * Velocities are px per second throughout, so the numbers read like speeds.
 */
const DISTANCE_COMMIT = 60;
const VELOCITY_COMMIT = 800;
const VELOCITY_SUPPORT = 300;
const FLICK_DISTANCE = 30;
/**
 * A travel this far is unambiguous on its own, whatever the speed. Someone
 * dragging a quarter of the screen sideways over two seconds means it; refusing
 * that because it was slow is the same mistake as the original threshold, just
 * pointing the other way.
 */
const DISTANCE_ALONE = 140;
const AXIS_LOCK = 8;
const INTERACTIVE = 'input, textarea, select, [role="slider"], [data-no-swipe]';

/** Speed in px/second, guarding the divide so a zero-length gesture is 0. */
const velocityOf = (distance, elapsedMs) => {
    if (!elapsedMs || elapsedMs < 0) return 0;
    return (distance / elapsedMs) * 1000;
};

export function shouldCommit({ distance, velocity }) {
    const absDistance = Math.abs(distance);
    const speed = Math.abs(velocity);

    if (absDistance >= DISTANCE_ALONE) return true;
    if (absDistance >= DISTANCE_COMMIT && speed >= VELOCITY_SUPPORT) return true;
    if (absDistance >= FLICK_DISTANCE && speed >= VELOCITY_COMMIT) return true;
    return false;
}

export function useSwipeViews({ onNext, onPrevious, disabled = false }) {
    const start = useRef(null);

    const onPointerDown = useCallback((event) => {
        if (disabled) return;
        // Primary button / single touch only, so a right-click never starts one.
        if (event.button !== 0 && event.pointerType === 'mouse') return;
        if (event.pointerType === 'touch' && event.isPrimary === false) return;
        if (event.target.closest?.(INTERACTIVE)) return;

        start.current = {
            x: event.clientX,
            y: event.clientY,
            at: event.timeStamp,
            axis: null,
        };
    }, [disabled]);

    const onPointerMove = useCallback((event) => {
        const origin = start.current;
        if (!origin || origin.axis) return;

        const dx = event.clientX - origin.x;
        const dy = event.clientY - origin.y;

        // Claim the gesture only once it is clearly horizontal, which leaves
        // native vertical scrolling untouched.
        if (Math.abs(dx) < AXIS_LOCK && Math.abs(dy) < AXIS_LOCK) return;
        origin.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
    }, []);

    const onPointerUp = useCallback((event) => {
        const origin = start.current;
        start.current = null;
        if (!origin || origin.axis !== 'x') return;

        const distance = event.clientX - origin.x;
        const velocity = velocityOf(distance, event.timeStamp - origin.at);

        if (!shouldCommit({ distance, velocity })) return;
        if (distance < 0) onNext?.();
        else onPrevious?.();
    }, [onNext, onPrevious]);

    return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: () => { start.current = null; } };
}
