import { useCallback, useEffect, useRef, useState } from 'react';

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

/**
 * Swallow the next click, once.
 *
 * A committed drag ends with the browser firing a click on whatever was under
 * the finger. On a card that is entirely a link -- the savings pool strip is --
 * that turns a swipe into a navigation the user never asked for: they set out
 * for the rates view and land in the savings summary instead.
 *
 * One shot, and it disarms itself: a listener left armed would eat the user's
 * next deliberate tap and read as a dead screen. `disarm` is what the timer
 * calls when the click never came.
 *
 * It takes its target rather than reaching for `window`, so the rule can be
 * tested against a plain EventTarget -- this suite runs in a node environment
 * with no DOM.
 */
export function createClickSwallower(target) {
    let armed = false;
    const swallow = (event) => {
        // stopImmediatePropagation, not stopPropagation: preventDefault alone
        // leaves every handler running, and stopPropagation only stops the
        // event travelling further -- not other listeners on the same target.
        // The link's own onClick calls router.visit, so its handler must not run.
        event.stopImmediatePropagation();
        event.preventDefault();
    };
    return {
        arm() {
            if (armed || !target) return;
            armed = true;
            target.addEventListener('click', swallow, { capture: true, once: true });
        },
        disarm() {
            if (!armed) return;
            armed = false;
            target.removeEventListener('click', swallow, { capture: true });
        },
    };
}

export function useSwipeViews({ onNext, onPrevious, disabled = false }) {
    const start = useRef(null);
    const disarmTimer = useRef(null);
    const [swallower] = useState(() => createClickSwallower(
        typeof window === 'undefined' ? null : window,
    ));

    // Unmounting mid-gesture must not leave the listener behind.
    useEffect(() => () => {
        clearTimeout(disarmTimer.current);
        swallower.disarm();
    }, [swallower]);

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
        // Arm BEFORE changing the view: the gesture is over, and the click it
        // produces lands on whatever is under the finger now.
        swallower.arm();
        clearTimeout(disarmTimer.current);
        // The drag may have ended over no link at all, in which case no click
        // follows and the listener must not stay armed to eat the next tap.
        disarmTimer.current = setTimeout(() => swallower.disarm(), 350);
        if (distance < 0) onNext?.();
        else onPrevious?.();
    }, [onNext, onPrevious, swallower]);

    return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: () => { start.current = null; } };
}
/** The dashboard's swipe views, by name. The name is what the URL carries. */
export const VIEW_INDEX = { main: 0, rates: 1, savings: 2 };

/**
 * The view a URL asks for, or the fallback when it says nothing.
 *
 * The dashboard seeds its swipe index from this, so coming back from the savings
 * summary returns to the savings screen rather than to the balance card. A name
 * the app does not have falls back instead of putting the dashboard into a state
 * with nothing to show.
 */
export function viewIndexOf(name, fallback = 0) {
    const index = VIEW_INDEX[String(name ?? '').toLowerCase()];
    return index === undefined ? fallback : index;
}

/** The name to put in the URL for an index, so a visit returns here. */
export function viewNameOf(index) {
    return Object.keys(VIEW_INDEX).find((name) => VIEW_INDEX[name] === index) || 'main';
}
