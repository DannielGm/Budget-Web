import { useCallback, useEffect, useRef, useState } from 'react';

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
 * Has the form been edited since it opened?
 *
 * The definition is "differs from what it was when the dialog opened", which
 * has to hold for a form that both creates a record and edits one, and for a
 * form whose own effects rewrite its state right after mount -- a snapshot
 * taken too early would report a freshly-opened form as dirty and immediately
 * ask about discarding nothing.
 *
 * So the snapshot is taken on the first render where `ready` is true, and then
 * never again until the form closes and `ready` goes back to false. Callers
 * pass `ready` as "the dialog is open and my seeding effect has run", which is
 * the one thing they know and this hook does not.
 *
 * Compared as a JSON string rather than field by field: these are small flat
 * objects, and a per-field comparison would be a second, diverging definition
 * of what the form contains.
 */
/**
 * The comparison behind useFormDirty, as a pure function so it can be proved
 * without a DOM. This suite runs in node, and a hook cannot be driven here.
 *
 * @param snapshot  JSON of the form as it was on open, or null if not captured
 * @param data      the form's current state
 * @returns         true when the form differs from what it was on open
 */
export function isDifferentFromSnapshot(snapshot, data) {
    if (snapshot === null) return false;
    return JSON.stringify(data ?? {}) !== snapshot;
}

export function useFormDirty(data, ready) {
    const snapshot = useRef(null);

    if (ready && snapshot.current === null) {
        snapshot.current = JSON.stringify(data ?? {});
    }
    if (!ready && snapshot.current !== null) {
        snapshot.current = null;
    }

    return ready && isDifferentFromSnapshot(snapshot.current, data);
}

/**
 * Warn before discarding edits a user has already made.
 *
 * The backdrop tap and the Android back gesture both reach a dialog as a plain
 * "close", with no chance to ask anything. In this app that meant a half-typed
 * expense, a budget change or a debt payment vanished on a stray tap, and the
 * back gesture -- the thing a user reaches for instinctively to close something
 * -- did it silently.
 *
 * It returns the interception point and the question's state together, so a
 * caller wiring three dismissal paths (backdrop, Escape, back gesture) has one
 * function to route through all three.
 *
 * `beforeunload` is wired here too, but only for the page leaving: it covers the
 * browser tab and the WebView being backgrounded and killed, which no in-app
 * prompt can intercept. The native dialog it raises is the platform's, and the
 * user can dismiss it -- that is a real ceiling, noted rather than hidden.
 *
 * Deliberately not built on the app's ConfirmationProvider: that provider
 * renders a Modal, so asking through it from inside a Modal is a cycle. The
 * prompt is therefore self-contained, and it is the only plain yes/no in the app
 * that does not go through the shared provider.
 */
/**
 * What a dismissal means right now.
 *
 * Three outcomes, because "dismiss" is not one thing:
 *   - 'close'   nothing to lose; shut it
 *   - 'ask'     real edits at stake; open the question
 *   - 'withdraw' a question is already up; take it back, do not ask again
 *
 * The third is the one that was missing. The Android back gesture is the thing
 * a user reaches for instinctively to abandon what they are in, and it is the
 * ONLY way out of a dialog on a phone. Left undefined, a second back press
 * re-ran the same guard, found the question already open, and did nothing at
 * all -- so pressing back twice to leave a form left you stuck behind the
 * prompt instead of out of it. The nested Dialog cannot catch this: it traps
 * focus, but a hardware back is a history navigation that never reaches its
 * onClose.
 *
 * Pure, so it can be proved without a DOM. This suite runs in node and the
 * dialogs render client-side only, so there is nothing to mount.
 */
export function nextDismissal({ dirty, asking }) {
    if (asking) return 'withdraw';
    return dirty ? 'ask' : 'close';
}
export function useUnsavedChanges({ show, dirty }) {
    const [asking, setAsking] = useState(false);
    // Mirrored into a ref so requestClose can read it inside a useCallback with
    // no dependency: that callback is handed to the back-button guard, which
    // keeps it in a ref precisely so a new closure each render cannot re-arm the
    // history guard. Depending on `asking` here would put it right back.
    const askingRef = useRef(false);

    // Refs, because these come from the form's own state and this hook must not
    // re-run -- or re-render the caller -- because the user typed a character.
    const dirtyRef = useRef(dirty);
    dirtyRef.current = dirty;

    const onBeforeUnload = useCallback((event) => {
        if (!dirtyRef.current) return undefined;
        event.preventDefault();
        // Chrome requires returnValue to be set for the prompt to appear.
        event.returnValue = '';
        return '';
    }, []);

    useEffect(() => {
        if (!show || typeof window === 'undefined') return undefined;
        window.addEventListener('beforeunload', onBeforeUnload);
        return () => window.removeEventListener('beforeunload', onBeforeUnload);
    }, [show, onBeforeUnload]);

    // A dialog that closes should not open the question next time it opens.
    useEffect(() => {
        if (!show) dismissQuestion();
    }, [show]);

    /** Set or clear the question, keeping the ref the guard reads in step.
     *
     *  Exposing the raw state setter would let the two drift: the ref is what
     *  `requestClose` reads, so a `setAsking(false)` that skipped it would leave
     *  the back gesture believing the question is still up and swallowing every
     *  press forever. One setter, two stores, no way to desynchronise them. */
    function dismissQuestion(next = false) {
        askingRef.current = next;
        setAsking(next);
    }

    return {
        // The dialog's dismissal entry point, for every path into closing:
        // backdrop, Escape, and the back gesture. Runs `onClose` immediately
        // when there is nothing to lose, otherwise opens the question and
        // reports that it did, so the caller can return early.
        //
        // `asking` short-circuits to 'withdraw' -- see nextDismissal for why a
        // second back has to take the question back rather than re-open it.
        //
        // @param onClose  what closing actually does
        // @returns       true when the close went through, false when it was held
        requestClose: useCallback((onClose) => {
            const outcome = nextDismissal({ dirty: dirtyRef.current, asking: askingRef.current });
            if (outcome === 'close') {
                onClose();
                return true;
            }
            dismissQuestion(outcome === 'ask');
            return false;
        }, []),
        /** True while the discard question is up. */
        asking,
        /** Take the question back down. Used by the prompt's own Cancelar. */
        dismissQuestion,
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