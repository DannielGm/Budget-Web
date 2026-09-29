// The dashboard's swipe views must not be `absolute w-full` inside a padded
// relative container.
//
// An absolutely positioned box's containing block is the ancestor's PADDING box,
// so `w-full` is the full width INCLUDING the container's padding, while the box
// itself sits at the CONTENT edge. With `px-4` on the container that pushed every
// view 16px past the right edge, where `overflow-x-hidden` silently clipped the
// right-hand 16px of every card. An old `pr-8` on each view cancelled the
// overshoot by exactly the same amount, which is why it survived so long -- and
// why removing that padding, correct on its own, exposed it.
//
// Layout geometry cannot be measured in this node-environment suite, so this
// reads the source instead: a fixed-size mistake like this is precisely what
// survives a render test, because a server render never overflows anything.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const SOURCE = readFileSync(
    path.resolve(process.cwd(), 'resources/js/Pages/Dashboard.jsx'),
    'utf8',
);

/** Tailwind's horizontal padding utilities, which is what such a box drifts on. */
const HORIZONTAL_PADDING = /\b(p[lr]|px)-(\d+|px)\b/;

const viewsIn = (source) => [...source.matchAll(/className="(absolute [^"]*)"/g)].map((m) => m[1]);
const containerIn = (source) => source.match(/className="([^"]*min-h-\[85vh\][^"]*)"/)?.[1] ?? '';

const isAnchored = (className) => className.includes('left-0 right-0') && !/\bw-full\b/.test(className);
const carriesGutter = (className) => HORIZONTAL_PADDING.test(className);
const containerIsBare = (className) => !HORIZONTAL_PADDING.test(className);

const views = viewsIn(SOURCE);

describe('the dashboard swipe views line up with the dashboard column', () => {
    it('finds all three views', () => {
        // If the pattern stops matching, every check below passes vacuously --
        // the failure mode a source check is most prone to.
        expect(views).toHaveLength(3);
    });

    it.each(views)('anchors a view to both edges instead of sizing it', (className) => {
        expect(isAnchored(className)).toBe(true);
    });

    it.each(views)('has a view carry the horizontal gutter itself', (className) => {
        expect(carriesGutter(className)).toBe(true);
    });

    it('keeps the padding off the box the views are positioned against', () => {
        expect(containerIsBare(containerIn(SOURCE))).toBe(true);
    });
});

describe('this check can tell the old layout from the current one', () => {
    // A check that cannot fail proves nothing. These are the shapes it has to
    // separate, and the first is the bug itself, verbatim.

    const OLD_CONTAINER = 'className="py-6 max-w-lg mx-auto px-4 relative min-h-[85vh] overflow-x-hidden"';
    const CURRENT_CONTAINER = 'className="py-6 max-w-lg mx-auto relative min-h-[85vh] overflow-x-hidden"';
    const OLD_VIEW = 'className="absolute w-full pr-8 space-y-6 pb-24"';
    const CURRENT_VIEW = 'className="absolute left-0 right-0 space-y-6 px-4 pb-24"';

    it('rejects the padded container, with or without the cancelling pr-8', () => {
        // The pr-8 view was the whole reason this survived: the two errors
        // cancelled, so the box looked balanced while still sitting 16px over.
        expect(containerIsBare(OLD_CONTAINER)).toBe(false);
        expect(isAnchored(OLD_VIEW)).toBe(false);
    });

    it('rejects a bare w-full with no gutter to hide the drift', () => {
        expect(isAnchored('className="absolute w-full space-y-6 pb-24"')).toBe(false);
        expect(carriesGutter('className="absolute w-full space-y-6 pb-24"')).toBe(false);
    });

    it('accepts what the file does now', () => {
        expect(containerIsBare(CURRENT_CONTAINER)).toBe(true);
        expect(isAnchored(CURRENT_VIEW)).toBe(true);
        expect(carriesGutter(CURRENT_VIEW)).toBe(true);
    });

    it('still catches a padding that comes back one side at a time', () => {
        expect(containerIsBare('className="py-6 pr-4 relative min-h-[85vh]"')).toBe(false);
        expect(containerIsBare('className="py-6 pl-4 relative min-h-[85vh]"')).toBe(false);
    });
});