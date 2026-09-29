import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

function walk(dir, out = []) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) walk(full, out);
        else if (/\.(jsx|js)$/.test(entry.name) && !/\.test\./.test(entry.name)) out.push(full);
    }
    return out;
}

const files = walk('resources/js');

/**
 * The file with its comments removed, so the checks below read code and not
 * prose. Several of these files explain in a comment exactly which hook they
 * stopped calling -- "the rate arrives as a prop rather than from usePage()"
 * is the very note that records the change -- and a scan of the raw text sees
 * a usePage() call that is not there. A check that fails on its own
 * documentation teaches everyone to ignore it.
 *
 * Block comments and line comments are dropped; string contents are kept,
 * because a hook name inside a string is a real reference (a dynamic call)
 * while one inside a comment is a sentence about one.
 */
function codeOnly(source) {
    return source
        .replace(/\/\*[\s\S]*?\*\//g, ' ')
        .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

/**
 * Every identifier a file binds through an import. Parsed by hand rather than
 * with a single regex, so a malformed or unusual import cannot throw and take
 * the whole check with it.
 */
function collectImports(source) {
    const names = new Set();

    for (const match of source.matchAll(/import\s+[\s\S]*?\s+from\s+['"][^'"]+['"];?/g)) {
        const statement = match[0];

        const braces = statement.match(/\{([\s\S]*?)\}/);
        if (braces) {
            for (const part of braces[1].split(',')) {
                const name = part.split(/\s+as\s+/).pop().trim();
                if (name) names.add(name);
            }
        }

        const bare = statement.match(/^import\s+([A-Za-z_$][\w$]*)/);
        if (bare) names.add(bare[1]);

        const star = statement.match(/\*\s+as\s+([A-Za-z_$][\w$]*)/);
        if (star) names.add(star[1]);
    }

    return names;
}



describe('no component hard-codes a dollar figure', () => {
    it.each(files)('%s renders the display currency', (file) => {
        // Comments go with it, for the reason codeOnly() exists: these
        // components explain in a comment which series they convert at, and a
        // check that fires on its own documentation is a check people learn to
        // ignore. Strings are kept, because a symbol written into one really is
        // a hard-coded figure.
        const source = codeOnly(readFileSync(file, 'utf-8'));
        // Paths are normalised to forward slashes: walk() builds them with the
        // platform separator, so on Windows the "lib/currency" exemption below
        // never matched and the module that DEFINES the currency was checked
        // against its own rules. Normalising once here keeps the exemptions
        // working on every platform.
        const path = file.split(/[\\/]/).join('/');
        if (path.includes('lib/currency') || path.endsWith('app.jsx') || path.includes('useFigure')) return;

        // A rendered dollar sign is a "$" followed by a figure, spelled one of
        // two ways: "$ {amount}" with a space, or "$${amount}" inside a template
        // literal. Both are the symbol being written out by hand.
        //
        // The plain "${" is NOT the signal. Every template in the codebase
        // writes "${name}", where the "$" is the template sigil and the brace
        // follows immediately, so a pattern that treats "$" next to "{" as a
        // figure flags the entire app. The doubling is what distinguishes a
        // hard-coded symbol from ordinary interpolation, and the space
        // distinguishes the JSX-text form from a template.
        //
        // `$${fmtUsd(value)}` was the form this check used to miss. The graph
        // printed exactly that in euro mode and the guard passed, because the
        // pattern then only accepted the spaced spelling.
        const hardCodedSymbol = /\$\s+\{/.test(source) || /\$\$\{/.test(source) || /Bs\/\$/.test(source);

        expect(hardCodedSymbol, `${file} still renders a literal dollar`).toBe(false);
    });
});

/**
 * A hook that is called but never imported is a ReferenceError at render, which
 * unmounts the React tree and shows a white screen. The bundler does not catch
 * it, and a scope check does not either: the call site looks perfectly valid.
 *
 * This exists because a de-duplication pass once dropped named bindings from
 * three import lines, leaving components calling a hook they no longer
 * imported. The build passed and every unit test passed.
 */
describe('every hook a file calls is imported', () => {
    it.each(files)('%s imports what it calls', (file) => {
        const source = codeOnly(readFileSync(file, 'utf-8'));
        const imported = collectImports(source);

        const missing = [];
        for (const match of source.matchAll(/\b(use[A-Z]\w*)\s*\(/g)) {
            const name = match[1];
            if (imported.has(name)) continue;
            if (new RegExp('(?:function|const)\\s+' + name + '\\b').test(source)) continue;
            missing.push(name + '() at line ' + source.slice(0, match.index).split('\n').length);
        }

        expect([...new Set(missing)], file + ' calls a hook it does not import').toEqual([]);
    });
});

