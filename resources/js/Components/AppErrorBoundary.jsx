import { Component } from 'react';

/**
 * The last thing standing between a render error and a blank app.
 *
 * There was no boundary anywhere, so a single undefined identifier took the whole
 * tree down and left a featureless rectangle. That is not hypothetical: a page
 * rendering a component it had not imported did exactly this, and because the
 * `color-scheme` meta said "light dark" the blank canvas came out black, which
 * looks like a device fault rather than a JavaScript one.
 *
 * The message is shown on purpose. A crash nobody can read is a crash nobody can
 * fix, and on a phone the console is not where the user is looking.
 */
export default class AppErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { error: null };
    }

    static getDerivedStateFromError(error) {
        return { error };
    }

    componentDidCatch(error, info) {
        // Still logged, so the stack is not lost the way it was.
        console.error(this.state.error || error, info?.componentStack);
    }

    render() {
        const { error } = this.state;
        if (!error) return this.props.children;

        return (
            <div className="flex min-h-screen items-center justify-center bg-white p-6 text-gray-900 dark:bg-[#0D0D12] dark:text-white">
                <div className="w-full max-w-lg">
                    <h1 className="text-xl font-black uppercase tracking-tight">Algo falló</h1>
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                        La pantalla no se pudo dibujar. Recarga para continuar.
                    </p>
                    <pre className="mt-4 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-gray-100 p-3 text-xs text-gray-800 dark:bg-gray-800 dark:text-gray-200">
                        {String(error?.message || error)}
                    </pre>
                    <button
                        type="button"
                        onClick={() => window.location.reload()}
                        className="mt-4 rounded-xl bg-[#FF8A3D] px-4 py-2.5 text-sm font-bold text-white"
                    >
                        Recargar
                    </button>
                </div>
            </div>
        );
    }
}