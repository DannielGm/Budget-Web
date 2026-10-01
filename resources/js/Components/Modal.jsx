import {
    Dialog,
    DialogPanel,
    DialogBackdrop,
    DialogTitle,
    Transition,
    TransitionChild,
} from '@headlessui/react';
import { motion } from 'framer-motion';
import useDismissOnBackButton, { useUnsavedChanges } from '@/hooks/useDismissOnBackButton';

/**
 * One spring for the whole app, so a form growing out of a button speaks the
 * same language as the insights panel growing out of the summary strip.
 */
export const MODAL_SPRING = { type: 'spring', stiffness: 320, damping: 32 };

/**
 * Optional shared-layout id. When a button that opens this modal carries the
 * same `layoutId`, the panel morphs out of that button instead of merely
 * fading in, so the form appears to come from where it was tapped.
 *
 * The motion wrapper lives inside the Headless UI panel rather than replacing
 * it: `TransitionChild` drives its own enter/leave and is not a motion
 * component, so sharing a layout with it is not possible.
 */
/**
 * The "discard your changes?" question, shown on top of an open form.
 *
 * Its own component, and exported, for one reason: `open` is not optional on a
 * Headless UI Dialog, and this one is not wrapped in a <Transition> the way the
 * main dialog is -- so nothing supplies it through context and the Dialog throws
 * "you provided an onClose prop but forgot an open prop" the moment this
 * renders. Passing `open` here is what keeps that from coming back, and being a
 * named component is what lets a test mount it and prove it.
 *
 * Exported for the test, not used elsewhere.
 */
export function DiscardPrompt({ onDismiss, onDiscard }) {
    return (
        <Dialog
            as="div"
            // Required, and the reason this is a separate component. The Dialog
            // below is not a child of the outer <Transition show={show}>, so it
            // gets no open state from context and must be told.
            open
            onClose={() => onDismiss()}
            className="fixed inset-0 z-[60] flex items-center justify-center p-4"
        >
            <DialogBackdrop
                className="fixed inset-0 bg-gray-500/75 dark:bg-black/75 transition-opacity duration-150"
            />
            <DialogPanel
                transition
                className="relative w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl transition duration-150 data-[closed]:scale-95 data-[closed]:opacity-0 dark:bg-gray-900"
            >
                <DialogTitle
                    id="discard-title"
                    className="text-base font-black uppercase tracking-tight text-gray-900 dark:text-white"
                >
                    ¿Descartar los cambios?
                </DialogTitle>
                <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-300">
                    Lo que escribiste en este formulario se perderá.
                </p>
                {/* flex-col-reverse on a phone puts "Seguir editando" above
                    "Descartar", so the safe answer is the one under the thumb and
                    the destructive one is not the nearest thing to it. */}
                <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <button
                        type="button"
                        onClick={() => onDismiss()}
                        className="touch-feedback min-h-11 rounded-xl border border-gray-300 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
                    >
                        Seguir editando
                    </button>
                    <button
                        type="button"
                        onClick={() => { onDismiss(); onDiscard(); }}
                        className="touch-feedback min-h-11 rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-white hover:bg-red-700"
                    >
                        Descartar
                    </button>
                </div>
            </DialogPanel>
        </Dialog>
    );
}

export default function Modal({
    children,
    show = false,
    maxWidth = '2xl',
    closeable = true,
    onClose = () => {},
    layoutId = null,
    // The id of the element naming this dialog. Every caller already renders a
    // title, so this is a pass-through rather than a new string to keep in sync
    // -- a dialog with no accessible name is announced as bare "dialog", which
    // is no use when the app has nine of them.
    labelledBy = null,
    role = 'dialog',
    // Has the user changed something they would not want to lose? The only
    // thing Modal cannot know, and the one thing only the form knows. When it
    // is true, the three ways out -- backdrop, Escape, back gesture -- stop
    // closing the dialog and ask first. Before this, a half-typed expense
    // vanished on a stray tap.
    dirty = false,
}) {
    const { requestClose, asking, dismissQuestion } = useUnsavedChanges({ show, dirty });

    // The real close, for the two paths that have already been consented to:
    // the discard prompt's own answer, and the form's Cancelar button.
    const commitClose = closeable ? onClose : () => {};
    // requestClose already answers back correctly while the question is up --
    // see nextDismissal -- so every dismissal path is this one function and the
    // Android back gesture cannot end up somewhere the other paths do not.
    const guardedClose = () => { requestClose(commitClose); };

    // On a phone the only way out of a dialog is its own button, and the system
    // back gesture is a history navigation that used to walk the app away from
    // underneath an open form. Wired here rather than in each form because every
    // dialog in the app -- expenses, budget, debts, savings, transfers, settings,
    // the calendar and the confirmations -- is this one component.
    useDismissOnBackButton(show, guardedClose);

    const maxWidthClass = {
        sm: 'max-w-sm',
        md: 'max-w-md',
        lg: 'max-w-lg',
        xl: 'max-w-xl',
        '2xl': 'max-w-2xl',
    }[maxWidth];

    const panel = (
        <DialogPanel
            className={`my-auto mx-auto transform overflow-hidden rounded-2xl bg-white dark:bg-gray-900 shadow-2xl transition-opacity w-full ${maxWidthClass}`}
        >
            {layoutId ? (
                <motion.div layoutId={layoutId} transition={MODAL_SPRING}>
                    {children}
                </motion.div>
            ) : (
                children
            )}
        </DialogPanel>
    );

    return (
        <Transition show={show} leave="duration-200">
            <Dialog
                as="div"
                id="modal"
                role={role}
                aria-labelledby={labelledBy ?? undefined}
                className="fixed inset-0 z-50 flex transform items-center justify-center overflow-y-auto overscroll-contain p-4 transition-opacity"
                onClose={guardedClose}
            >
                <DialogBackdrop
                    className="fixed inset-0 bg-gray-500/75 dark:bg-black/75 backdrop-blur-xs transition-opacity duration-300"
                />

                <TransitionChild
                    enter="ease-out duration-300"
                    enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                    enterTo="opacity-100 translate-y-0 sm:scale-100"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-100 translate-y-0 sm:scale-100"
                    leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                >
                    {panel}
                </TransitionChild>

                {/* The discard question.
                 *
                 * A real nested Dialog, not a div painted over this one. It was
                 * a div, and that was wrong on a phone in three ways: the parent
                 * Dialog's focus trap still held focus in the form underneath, so
                 * nothing was ever read out and the safe button was never
                 * reachable by keyboard; `aria-modal="true"` inside a parent
                 * dialog is contradictory; and it had no `my-auto`, so it rendered
                 * at the top of the screen, away from the form it was asking
                 * about. A nested Dialog gets its own trap, its own scroll lock
                 * and its own z-order.
                 *
                 * Back here means "keep editing". Left unmapped, a second back
                 * press re-ran the parent guard, found the question already open
                 * and swallowed the gesture -- so someone backing out of a form
                 * twice got stuck behind the prompt instead of out of it. */}
                {asking && (
                    <DiscardPrompt onDismiss={dismissQuestion} onDiscard={commitClose} />
                )}
            </Dialog>
        </Transition>
    );
}
