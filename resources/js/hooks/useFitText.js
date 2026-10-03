import { useCallback, useLayoutEffect, useRef, useState } from 'react';

/**
 * The signal that says "measure again, the width you chose for is stale".
 *
 * A fit-text figure is sized once and then only re-sized when it or its parent
 * actually resizes. A floating menu opening and closing can change what a figure
 * should be sized for without either element resizing, and nothing about it is a
 * resize event -- so the figure keeps a size picked for a layout that has moved
 * on. One window event covers that for every fitted figure on screen, rather than
 * each caller growing its own listener.
 */
export const REMEASURE_EVENT = 'budget:remeasure';

/** Ask every fitted figure to measure itself again. */
export function remeasureFitText() {
    if (typeof window === 'undefined') return;
    // On the next frame, not this one: the close is a state change, and measuring
    // before React has committed it would measure the layout being left behind.
    window.requestAnimationFrame(() => window.dispatchEvent(new Event(REMEASURE_EVENT)));
}

/**
 * Shrink-to-fit text sizing.
 *
 * Finds the largest font size in [min, max] at which the element still fits
 * its container on a single line, so long amounts stay fully legible instead
 * of being clipped. Re-measures on element resize, container resize, and text
 * change (month switch, day filter, orientation change).
 *
 * Returns [ref, fontSize, clipped]. `clipped` is true only when the text
 * still does not fit at the resolved size, so callers that can accept a
 * slightly smaller floor (see the emergency step-down) can react instead of
 * silently cutting off digits.
 *
 * The preferred size is `max`: it is used whenever the value fits, and the
 * search only runs when it would otherwise overflow. Re-measures once web
 * fonts finish loading, since a first measurement taken against fallback
 * glyphs is wider/narrower than the real thing and would settle on a size
 * that is too small.
 */
export default function useFitText({ min = 11, max = 32, step = 0.5, emergencyMin = null } = {}) {
    const ref = useRef(null);
    const [fontSize, setFontSize] = useState(max);
    const [clipped, setClipped] = useState(false);

    const measure = useCallback(() => {
        const el = ref.current;
        if (!el) return;

        // Reset first, otherwise a stale inline size from the previous
        // measurement can make the search terminate early.
        el.style.fontSize = '';

        const available = el.clientWidth;
        if (!available) return;

        // scrollWidth is the width a nowrap element actually needs; clientWidth
        // is the space allowed. Comparing them is stable under sub-pixel
        // rounding, unlike getBoundingClientRect().width.
        const fits = () => el.scrollWidth <= available;

        const search = (floor) => {
            let lo = floor;
            let hi = max;
            for (let i = 0; i < 24 && hi - lo > step; i += 1) {
                const mid = (lo + hi) / 2;
                el.style.fontSize = mid + 'px';
                if (fits()) lo = mid;
                else hi = mid;
            }
            el.style.fontSize = lo + 'px';
            return lo;
        };

        if (fits()) {
            setFontSize(max);
            setClipped(false);
            return;
        }

        let size = search(min);
        let stillClipped = !fits();

        // The normal floor could not show every digit. Drop a little further
        // rather than clip, since a truncated amount is worse than a slightly
        // smaller one.
        if (stillClipped && emergencyMin !== null && emergencyMin < min) {
            size = search(emergencyMin);
            stillClipped = !fits();
        }

        el.style.fontSize = size + 'px';
        setFontSize(size);
        setClipped(stillClipped);
    }, [max, min, step, emergencyMin]);

    useLayoutEffect(() => {
        measure();

        const el = ref.current;
        if (!el || typeof ResizeObserver === 'undefined') return undefined;

        const observer = new ResizeObserver(measure);
        observer.observe(el);
        if (el.parentElement) observer.observe(el.parentElement);

        // The app asks for a re-measure directly when a layout moved without
        // resizing anything this observer watches. Placed inside the same effect
        // so there is one place that answers "re-size me" for a fitted figure,
        // and one cleanup that takes it all down again.
        window.addEventListener(REMEASURE_EVENT, measure);

        // A webfont swapping in changes the glyph widths, so the size chosen
        // against the fallback face is no longer the best fit. Re-measure
        // once the real font is ready.
        let cancelled = false;
        if (typeof document !== 'undefined' && document.fonts?.ready) {
            document.fonts.ready.then(() => {
                if (!cancelled) measure();
            }).catch(() => {});
        }

        return () => {
            cancelled = true;
            observer.disconnect();
            window.removeEventListener(REMEASURE_EVENT, measure);
        };
    }, [measure]);

    return [ref, fontSize, clipped];
}
