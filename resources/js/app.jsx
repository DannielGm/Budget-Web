import '../css/app.css';
import './bootstrap';

import { createInertiaApp } from '@inertiajs/react';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import { createRoot } from 'react-dom/client';
import { ConfirmationProvider } from '@/Components/ConfirmationProvider';
import { CurrencyProvider } from '@/lib/currency';
import AppErrorBoundary from '@/Components/AppErrorBoundary';

const appName = import.meta.env.VITE_APP_NAME || 'Laravel';

createInertiaApp({
    title: (title) => `${title} - ${appName}`,
    resolve: (name) =>
        resolvePageComponent(
            `./Pages/${name}.jsx`,
            import.meta.glob('./Pages/**/*.jsx'),
        ),
    setup({ el, App, props }) {
        const root = createRoot(el);

        root.render(
            <AppErrorBoundary>
                <CurrencyProvider currency={window.displayCurrency}>
                    <ConfirmationProvider>
                        <App {...props} />
                    </ConfirmationProvider>
                </CurrencyProvider>
            </AppErrorBoundary>,
        );
    },
    progress: {
        color: '#4B5563',
    },
});
