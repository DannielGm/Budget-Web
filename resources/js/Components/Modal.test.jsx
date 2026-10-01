import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { DiscardPrompt } from '@/Components/Modal';

/**
 * The discard question has to render.
 *
 * It was a plain div with `role="alertdialog"` painted over the open form, which
 * was wrong three ways on a phone: the parent Dialog's focus trap still held
 * focus in the form, so the safe button was not reachable and the question was
 * never announced; `aria-modal` inside an already-modal parent is
 * contradictory; and with no `my-auto` it sat at the top of the screen rather
 * than beside the form it was asking about. It is a real nested Dialog now.
 *
 * That rewrite arrived with a crash: `open` is not optional on a Headless UI
 * Dialog, and unlike the main dialog this one is not wrapped in a <Transition>,
 * so nothing supplies it through context. It threw "you provided an onClose prop
 * to the Dialog, but forgot an open prop" on first render. A green build and a
 * green suite both passed with that in place, because nothing rendered it.
 *
 * These render it directly so the prop contract is checked by the thing that
 * enforces it. Headless UI dialogs emit no markup under renderToStaticMarkup --
 * they are client-only -- so the assertion is that rendering does not throw, not
 * what comes out. That is precisely the failure that was missed, so it is
 * precisely what needs pinning.
 */
describe('the discard question', () => {
    it('renders without throwing', () => {
        expect(() => renderToStaticMarkup(
            <DiscardPrompt onDismiss={() => {}} onDiscard={() => {}} />,
        )).not.toThrow();
    });

    it('renders with a no-op dismiss, the shape the form passes', () => {
        // onDismiss is called with no argument by both the Cancelar button and
        // the dialog's own onClose, so a handler that ignores its argument has
        // to be safe to supply.
        let called = 0;
        expect(() => renderToStaticMarkup(
            <DiscardPrompt onDismiss={() => { called += 1; }} onDiscard={() => {}} />,
        )).not.toThrow();
        expect(called).toBe(0);
    });
});