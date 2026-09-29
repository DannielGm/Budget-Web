import { describe, expect, it } from 'vitest';
import { createClickSwallower, shouldCommit, viewIndexOf, viewNameOf } from './useSwipeViews.js';

describe('shouldCommit', () => {
    it('rejects a small fast twitch the old rule accepted', () => {
        // The old rule was `Math.abs(offset.x) * velocity.x > 10000`, so a
        // 20px twitch at 500px/s scored exactly 10000 and committed.
        expect(shouldCommit({ distance: 20, velocity: 500 })).toBe(false);
    });

    it('accepts a slow deliberate long drag the old rule rejected', () => {
        // The same rule was inverted for intent: 200px at 100px/s scored
        // 20000 over 1000 and was... committed by luck, but 80px at 100px/s
        // scored 8000 and was thrown away despite being a clear intent.
        expect(shouldCommit({ distance: 200, velocity: 100 })).toBe(true);
        expect(shouldCommit({ distance: 80, velocity: 350 })).toBe(true);
    });

    it('accepts a short decisive flick', () => {
        expect(shouldCommit({ distance: 40, velocity: 1200 })).toBe(true);
    });

    it('rejects a short slow drag', () => {
        expect(shouldCommit({ distance: 40, velocity: 100 })).toBe(false);
    });

    it.each([
        ['no movement', 0, 5000],
        ['barely any movement', 10, 50],
        ['a short drag with NaN velocity', 20, NaN],
        ['a short drag with undefined velocity', 20, undefined],
    ])('rejects %s', (_label, distance, velocity) => {
        expect(shouldCommit({ distance, velocity })).toBe(false);
    });

    it('is direction agnostic; the caller decides which way is next', () => {
        expect(shouldCommit({ distance: -90, velocity: -500 })).toBe(true);
        expect(shouldCommit({ distance: 90, velocity: 500 })).toBe(true);
        expect(shouldCommit({ distance: -90, velocity: 500 })).toBe(true);
    });

    it('commits a far drag on distance alone, whatever the speed', () => {
        // Someone dragging a quarter of the screen sideways over two seconds
        // means it; refusing that for being slow is the original mistake
        // pointing the other way.
        expect(shouldCommit({ distance: 200, velocity: undefined })).toBe(true);
        expect(shouldCommit({ distance: 200, velocity: NaN })).toBe(true);
    });
});

describe('the click a swipe produces', () => {
    // The strip is one big link, and a committed drag ends with the browser
    // firing a click on whatever was under the finger. Without swallowing it the
    // user sets out for "Tasas BCV" and lands in the savings summary instead.
    // A plain EventTarget stands in for the window: this suite runs in node.
    const click = (target) => new Event('click', { cancelable: true, bubbles: true });

    it('swallows the click a swipe causes', () => {
        const target = new EventTarget();
        const swallower = createClickSwallower(target);
        swallower.arm();

        const event = click(target);
        target.dispatchEvent(event);

        expect(event.defaultPrevented).toBe(true);
    });

    it('leaves an ordinary tap alone', () => {
        const target = new EventTarget();
        const swallower = createClickSwallower(target);
        swallower.arm();
        swallower.disarm();

        const event = click(target);
        target.dispatchEvent(event);

        expect(event.defaultPrevented).toBe(false);
    });

    it('eats only one click, so the next tap still works', () => {
        // Left armed, this would read as a dead screen: every later tap gone.
        const target = new EventTarget();
        createClickSwallower(target).arm();

        target.dispatchEvent(click(target));
        const second = click(target);
        target.dispatchEvent(second);

        expect(second.defaultPrevented).toBe(false);
    });

    it('stops the swallowed click before it reaches the link', () => {
        // preventDefault alone leaves every handler running, and the strip is a
        // link whose own onClick would still call router.visit.
        //
        // The listener is registered AFTER arming, which is the ordering the
        // browser gives us for free: the swallower sits on window in the capture
        // phase, so it always runs before a handler on the link itself. A plain
        // EventTarget has no such phase, so the order is expressed by
        // registration instead.
        const target = new EventTarget();
        createClickSwallower(target).arm();
        const seen = [];
        target.addEventListener('click', () => seen.push('link handler'));

        target.dispatchEvent(click(target));

        expect(seen).toEqual([]);
    });

    it('disarming twice is harmless', () => {
        // The timer and the unmount cleanup can both fire.
        const target = new EventTarget();
        const swallower = createClickSwallower(target);
        swallower.arm();
        swallower.disarm();
        expect(() => swallower.disarm()).not.toThrow();
    });

    it('survives having no window at all', () => {
        // A server render constructs the hook before any window exists.
        const swallower = createClickSwallower(null);
        expect(() => swallower.arm()).not.toThrow();
        expect(() => swallower.disarm()).not.toThrow();
    });
});

describe('viewIndexOf', () => {
    it('maps each view name to its swipe index', () => {
        expect(viewIndexOf('main')).toBe(0);
        expect(viewIndexOf('rates')).toBe(1);
        expect(viewIndexOf('savings')).toBe(2);
    });

    it('is case insensitive', () => {
        expect(viewIndexOf('Savings')).toBe(2);
    });

    it('falls back rather than opening a view that does not exist', () => {
        // A hand-typed query must not be able to put the dashboard in a state it
        // has no view for, which is the whole reason this is a function.
        expect(viewIndexOf('nope')).toBe(0);
        expect(viewIndexOf(null)).toBe(0);
        expect(viewIndexOf(undefined)).toBe(0);
        expect(viewIndexOf('1')).toBe(0);
    });

    it('names a view back, for the URL that brings the user here', () => {
        expect(viewNameOf(2)).toBe('savings');
        expect(viewNameOf(1)).toBe('rates');
        expect(viewNameOf(0)).toBe('main');
        expect(viewNameOf(99)).toBe('main');
    });
});
