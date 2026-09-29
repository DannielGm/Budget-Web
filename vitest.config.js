import { defineConfig } from 'vitest/config';
import path from 'node:path';

/**
 * Vitest runs against a config of its own rather than vite.config.js.
 *
 * The Laravel/NativePHP plugins there are build-time concerns — they resolve
 * the app entry and the hot-file shim — and importing them into a test run only
 * adds ways for the suite to fail for reasons that have nothing to do with the
 * code under test. The `@` alias is repeated here from jsconfig.json, which is
 * where the application already declares it, so both read from one definition.
 */
export default defineConfig({
    resolve: {
        alias: {
            '@': path.resolve(process.cwd(), 'resources/js'),
        },
    },
    test: {
        environment: 'node',
        // .jsx is included so a component can be rendered rather than read. A
        // component has to be executed to prove it does not throw at render, and
        // no amount of source inspection stands in for that: the graph shipped a
        // ReferenceError with a green build and green tests. renderToStaticMarkup
        // comes from the react-dom already installed, so this costs no new
        // dependency.
        include: ['resources/js/**/*.test.{js,jsx}'],
    },
});
