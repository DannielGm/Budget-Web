import {
    Dialog,
    DialogPanel,
    Transition,
    TransitionChild,
} from '@headlessui/react';
import { motion } from 'framer-motion';
import useDismissOnBackButton from '@/hooks/useDismissOnBackButton';

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
export default function Modal({
    children,
    show = false,
    maxWidth = '2xl',
    closeable = true,
    onClose = () => {},
    layoutId = null,
}) {
    const close = () => {
        if (closeable) {
            onClose();
        }
    };

    // On a phone the only way out of a dialog is its own button, and the system
    // back gesture is a history navigation that used to walk the app away from
    // underneath an open form. Wired here rather than in each form because every
    // dialog in the app -- expenses, budget, debts, savings, transfers, settings,
    // the calendar and the confirmations -- is this one component.
    useDismissOnBackButton(show, close);

    const maxWidthClass = {
        sm: 'max-w-sm',
        md: 'max-w-md',
        lg: 'max-w-lg',
        xl: 'max-w-xl',
        '2xl': 'max-w-2xl',
    }[maxWidth];

    const panel = (
        <DialogPanel
            className={`my-auto mx-auto transform overflow-hidden rounded-2xl bg-white dark:bg-gray-900 shadow-2xl transition-all w-full ${maxWidthClass}`}
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
                className="fixed inset-0 z-50 flex transform items-center justify-center overflow-y-auto p-4 transition-all"
                onClose={close}
            >
                <TransitionChild
                    enter="ease-out duration-300"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="absolute inset-0 bg-gray-500/75 dark:bg-black/75 backdrop-blur-xs" />
                </TransitionChild>

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
            </Dialog>
        </Transition>
    );
}
