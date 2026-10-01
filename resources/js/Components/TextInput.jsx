import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

export default forwardRef(function TextInput(
    { type = 'text', className = '', isFocused = false, ...props },
    ref,
) {
    const localRef = useRef(null);

    useImperativeHandle(ref, () => ({
        focus: () => localRef.current?.focus(),
    }));

    useEffect(() => {
        if (!isFocused) return;
        // Desktop only. The app ships as a NativePHP Android build, and focusing
        // an input on open raises the soft keyboard over the form -- on the
        // login screen, on the profile form, and on the delete-account
        // confirmation, every time it opened. A pointer:fine device is a mouse
        // or a keyboard, where a focused first field is what the user wants.
        if (typeof window === 'undefined' || !window.matchMedia?.('(pointer: fine)').matches) return;
        localRef.current?.focus();
    }, [isFocused]);
    return (
        <input
            {...props}
            type={type}
            className={
                'rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 ' +
                className
            }
            ref={localRef}
        />
    );
});
