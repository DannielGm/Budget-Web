import { useCallback, useLayoutEffect, useRef, useState } from 'react';

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
        };
    }, [measure]);

    return [ref, fontSize, clipped];
}
