import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Every component a page renders has to actually be in scope.
 *
 * A page that renders a component it never imported is not a build error and not
 * a test error: the bundler does not resolve JSX identifiers, and no test imported
 * the page. It threw at runtime instead, the whole React tree unmounted, and with
 * no error boundary anywhere the app became a blank rectangle. That is exactly
 * what happened to Settings in 0.5.1 -- `AppHeader is not defined`, and the
 * `color-scheme` meta turned the blank canvas black, so it read as a device fault.
 *
 * So this is the smallest test that would have failed: read the page, collect the
 * capitalised tags it uses, and require each to be imported or declared locally.
 */
const pagesDir = join(process.cwd(), 'resources/js/Pages');

const pageFiles = () => readdirSync(pagesDir, { recursive: true })
    .filter((name) => name.endsWith('.jsx'))
    .map((name) => join(pagesDir, name));

/** Names the file itself brings into scope. */
const declaredIn = (source) => {
    const names = new Set();

    // Every import statement, including the `import React, { lazy } from` shape,
    // which a `^import\s*\{` pattern would miss and then report as undefined.
    for (const match of source.matchAll(/^import\s+([\s\S]*?)\s+from\s+['"][^'"]+['"]/gm)) {
        const clause = match[1];
        const named = clause.match(/\{([\s\S]*?)\}/);
        if (named) {
            for (const part of named[1].split(',')) {
                const local = part.trim().split(/\s+as\s+/).pop();
                if (local) names.add(local.trim());
            }
        }
        const defaultName = clause.split(',')[0].trim();
        if (/^[A-Z][\w$]*$/.test(defaultName)) names.add(defaultName);
    }

    // Indented too: a component is often declared at the top level of a module
    // but written with leading whitespace.
    for (const match of source.matchAll(/^[ \t]*(?:export\s+)?(?:default\s+)?(?:function|class|const|let)\s+([A-Z][\w$]*)/gm)) {
        names.add(match[1]);
    }

    // Destructured bindings, which is how a component takes an icon: `function
    // Row({ icon: Icon })` then `<Icon />`. Brace groups holding JSX are skipped so
    // this does not start absorbing names out of expressions.
    for (const match of source.matchAll(/\{([^{}]*)\}/g)) {
        if (match[1].includes('<')) continue;
        for (const name of match[1].matchAll(/[:,\s]\s*([A-Z][\w$]*)/g)) {
            names.add(name[1]);
        }
    }
    return names;
};

/** Capitalised JSX tags, e.g. `<AppHeader` and `<Modal ...>`. */
const usedIn = (source) => {
    const names = new Set();
    for (const match of source.matchAll(/<([A-Z][\w$]*)[\s/>]/g)) {
        names.add(match[1]);
    }
    return names;
};

describe('every page renders components it has in scope', () => {
    const files = pageFiles();

    it('finds the pages to check', () => {
        // A broken glob would make this suite vacuously green.
        expect(files.length).toBeGreaterThan(3);
    });

    for (const file of files) {
        it(`${file.split(/[\\/]/).pop()} has no undefined component`, () => {
            const source = readFileSync(file, 'utf8');
            const declared = declaredIn(source);
            const missing = [...usedIn(source)].filter((name) => !declared.has(name));

            expect(missing, `not imported or declared in ${file}`).toEqual([]);
        });
    }
});