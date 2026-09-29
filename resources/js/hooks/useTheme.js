import { useCallback, useState } from 'react';

/**
 * The light/dark toggle, in one place.
 *
 * It used to live in Dashboard.jsx, which meant the other three screens had no
 * way to reach it: their headers simply had no theme control, so the app's one
 * global display preference was only reachable from one screen. The theme is a
 * property of the app, not of the dashboard, so it belongs to whoever renders the
 * header -- which is every screen now.
 *
 * The pre-paint script in app.blade.php has already put the `dark` class on
 * <html> before React mounts, so the initial read is the DOM's, not localStorage
 * re-guessed here. That also keeps server rendering from guessing differently
 * than the client.
 */
export default function useTheme() {
    const [isDark, setIsDark] = useState(() =>
        typeof document !== 'undefined' && document.documentElement.classList.contains('dark'));

    const toggleTheme = useCallback(() => {
        const next = !isDark;
        setIsDark(next);
        document.documentElement.classList.toggle('dark', next);
        // Scrolling bars, form controls and the canvas behind a broken render all
        // take their cue from this, and they cannot read a Tailwind class.
        document.documentElement.style.colorScheme = next ? 'dark' : 'light';
        localStorage.theme = next ? 'dark' : 'light';
        // The Android status bar is drawn by the system, and it does not read our
        // stylesheet. Without this the status bar keeps whatever colour it had,
        // which on a gradient header is a band of the wrong colour above it.
        document.querySelector('meta[name="theme-color"]')
            ?.setAttribute('content', next ? '#7C5CE5' : '#FF8A3D');
    }, [isDark]);

    return [isDark, toggleTheme];
}