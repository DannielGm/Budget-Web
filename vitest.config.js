import { defineConfig } from 'vitest/config';
import path from 'node:path';

/**
 * Vitest runs against a config of its own rather than vite.config.js.
 *
 * The Laravel/NativePHP plugins there are build-time concerns 窶・they resolve
 * the app entry and the hot-file shim 窶・and importing them into a test run only
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

        // The suite runs in Venezuela's timezone, deliberately.
        //
        // Two real bugs shipped because a day key was built with toISOString(),
        // which converts to UTC: in UTC-4 that reports tomorrow''s date for the
        // last four hours of the day. Every test that ran on a UTC machine agreed
        // with the bug, because in UTC the two implementations are identical -- so
        // the suite could not have caught it and did not.
        //
        // Pinning the zone makes local-date behaviour testable at all, and pins
        // it to the zone the app is actually used in rather than to whatever the
        // CI machine happens to be set to. A developer in another zone gets the
        // same answers, which is the point: the expectations are about the RULE,
        // not about the machine.
        env: { TZ: process.env.TZ || 'America/Caracas' },
    },
});

