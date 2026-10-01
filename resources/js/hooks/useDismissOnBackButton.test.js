// The Android back gesture must close a floating layer, not navigate past it.
//
// This suite runs in node with no DOM, so the rule is driven through the
// exported factory against a fake window: the guard only ever touches
// `history.pushState` and one `popstate` listener, so that is the whole surface.
// The Android back gesture must close a floating layer, not navigate past it.
//
// This suite runs in node with no DOM, so the rule is driven through the
// exported factory against a fake window: the guard only ever touches
// `history.pushState` and one `popstate` listener, so that is the whole surface.
import { describe, expect, it, vi } from 'vitest';
import { createBackGuard, isDifferentFromSnapshot, nextDismissal } from './useDismissOnBackButton.js';

// ── What the back gesture means, state by state ──────────────────────────
//
// The Android back gesture is the only way out of a dialog on a phone, and it
// arrives as a plain "close" with no way to ask anything. Each of these outcomes
// is a place a user can get stuck, so each is pinned down.
describe('the back gesture, one state at a time', () => {
    it('closes a form with nothing in it', () => {
        expect(nextDismissal({ dirty: false, asking: false })).toBe('close');
    });

    it('asks before discarding real edits', () => {
        expect(nextDismissal({ dirty: true, asking: false })).toBe('ask');
    });

    it('takes the question back rather than asking again', () => {
        // The bug this exists for. With only 'close' and 'ask', a second back
        // press on an open question hit 'ask' again, did nothing visible, and
        // swallowed the gesture -- so someone backing out of a form twice ended
        // up stuck behind the prompt instead of out of it. A question is
        // dismissed by dismissing it.
        expect(nextDismissal({ dirty: true, asking: true })).toBe('withdraw');
    });

    it('withdraws even when the form is clean, because a question was asked', () => {
        // Defensive: if the form was reset to pristine while the question was up,
        // back must still take the question down. Answering 'close' here would
        // shut the form with the question still painted over it.
        expect(nextDismissal({ dirty: false, asking: true })).toBe('withdraw');
    });

    it('never closes straight out of an open question', () => {
        // Backing out of a form is two presses: the first asks, the second
        // takes the question back. There is no single press that both asks and
        // discards, which is the whole point of asking.
        for (const dirty of [true, false]) {
            expect(nextDismissal({ dirty, asking: true })).not.toBe('close');
        }
    });
});

// ── The unsaved-changes guard ────────────────────────────────────────────
//
// It asks exactly one question: is what is in the form now different from what
// was in it when the dialog opened. Worth proving because a false positive asks
// the user to discard nothing on every backdrop tap, and a false negative
// silently loses what they typed.
//
// The comparison is exported and pure because this suite runs in node with no
// DOM, where a hook cannot be driven.
//
// Note on snapshots: they must be taken AFTER a form's own seeding effect runs.
// Several of these forms call setData() on open, so a snapshot taken at first
// render would already differ from the settled state and every freshly-opened
// dialog would claim to be dirty before the user touched anything.
const snap = (data) => JSON.stringify(data);

describe('a form is dirty only once it differs from how it opened', () => {
    it('is clean on the opening render, before anything is typed', () => {
        const opened = { label: '', amount_bs: '', rate: 36.5 };
        expect(isDifferentFromSnapshot(snap(opened), opened)).toBe(false);
    });

    it('is dirty once a field the user typed into changes', () => {
        const opened = { label: '', amount_bs: '' };
        expect(isDifferentFromSnapshot(snap(opened), { label: 'Supermercado', amount_bs: '' })).toBe(true);
    });

    it('is clean when a typed edit is undone back to the opening value', () => {
        // The case that matters: type something, delete it, and the form is
        // worth exactly what it was when it opened, so nothing should be lost
        // and nothing should be asked. The snapshot is the OPENING value, and
        // the current value is that same value again.
        const opened = { label: 'Café', amount_bs: '20' };
        const typed = { label: 'Cafetería', amount_bs: '20' };
        const undone = { label: 'Café', amount_bs: '20' };

        expect(isDifferentFromSnapshot(snap(opened), typed)).toBe(true);
        expect(isDifferentFromSnapshot(snap(opened), undone)).toBe(false);
    });

    it('sees a change in any field, not just the first', () => {
        // The rate is the field a form's own effect rewrites on open, so it is
        // the one most able to produce a false positive.
        const opened = { label: 'A', amount_bs: '1', rate: '36.50' };
        expect(isDifferentFromSnapshot(snap(opened), { ...opened, rate: '38.00' })).toBe(true);
    });

    it('is clean before a snapshot exists, so a form is never born dirty', () => {
        expect(isDifferentFromSnapshot(null, { label: 'anything' })).toBe(false);
    });

    it('treats a cleared field as a change, not as absence', () => {
        // Deleting what was there is an edit worth protecting too.
        const opened = { label: 'Café', amount_bs: '20' };
        expect(isDifferentFromSnapshot(snap(opened), { label: '', amount_bs: '20' })).toBe(true);
    });
});

// ── The back-button guard ────────────────────────────────────────────────

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