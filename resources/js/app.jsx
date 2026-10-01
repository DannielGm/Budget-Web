import '../css/app.css';
import './bootstrap';

import { createInertiaApp } from '@inertiajs/react';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import { createRoot } from 'react-dom/client';
import { MotionConfig } from 'framer-motion';
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
                {/* reducedMotion="user" is what actually honours the OS setting for
                    JS-driven motion. The prefers-reduced-motion block in app.css
                    neutralises CSS transitions only -- it does not touch the
                    framer-motion springs behind the modals, the shared-layout
                    morphs between the summary strip and Análisis, or the swipe
                    between the three dashboards. One wrapper covers all of them. */}
                <MotionConfig reducedMotion="user">
                    <CurrencyProvider currency={window.displayCurrency}>
                        <ConfirmationProvider>
                            <App {...props} />
                        </ConfirmationProvider>
                    </CurrencyProvider>
                </MotionConfig>
            </AppErrorBoundary>,
        );
    },
    progress: {
        color: '#4B5563',
    },
});
