import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
// Already present as a Vite dependency. Using it here costs no new package, and
// a real parse is the only thing that can tell a binding from a call in JSX.
import { parse } from '@babel/parser';

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

/**
 * The names that exist without being declared in the file: the JS globals, and
 * the handful of things React and the test/tooling code reach for. Anything
 * outside this list has to be imported or declared locally, or it is a
 * ReferenceError waiting for the branch nobody rendered.
 */
const AMBIENT = new Set([
    'require', 'console', 'JSON', 'Math', 'Date', 'Number', 'String', 'Boolean',
    'Array', 'Object', 'Set', 'Map', 'WeakMap', 'Promise', 'Symbol', 'Error',
    'TypeError', 'RangeError', 'RegExp', 'Infinity', 'NaN', 'undefined',
    'parseInt', 'parseFloat', 'isNaN', 'isFinite', 'encodeURIComponent',
    'decodeURIComponent', 'structuredClone', 'queueMicrotask', 'setTimeout',
    'clearTimeout', 'setInterval', 'clearInterval', 'fetch', 'globalThis',
    'describe', 'it', 'expect', 'beforeEach', 'afterEach', 'vi', 'test',
    'window', 'document', 'navigator', 'location', 'history', 'localStorage',
    'sessionStorage', 'alert', 'confirm', 'prompt', 'IntersectionObserver',
    'ResizeObserver', 'MutationObserver', 'AbortController', 'URL', 'Headers',
    'FormData', 'Blob', 'File', 'FileReader', 'Image', 'requestAnimationFrame',
    'cancelAnimationFrame', 'getComputedStyle', 'matchMedia', 'Intl',
    'process', 'Buffer', '__dirname', '__filename',
    // Provided globally by Laravel's Ziggy at runtime, and used in nearly every
    // form here. It is not an import, and it is not declared locally.
    'route', 'csrfToken',
]);

const TAILWIND_ARBITRARY = new Set(['calc', 'min', 'max', 'clamp', 'env', 'var']);

/**
 * Every binding the file creates and every call it makes, read from a real parse
 * rather than from patterns over the text.
 *
 * This started as regexes and should not have. Regex cannot tell a
 * destructured parameter from the JSX that follows one, a JSX ternary from an
 * object pattern, or a keyword from a call -- so each guess added a new
 * exemption list, and the check spent more effort on its own false positives
 * than on the bug. @babel/parser is already here as a Vite dependency and
 * answers all three exactly, so the exemptions are gone rather than growing.
 */
function analyze(source) {
    const ast = parse(source, {
        sourceType: 'module',
        plugins: ['jsx'],
        errorRecovery: true,
    });

    const bound = new Set();
    const called = new Map(); // name -> first line

    /** Record the names a binding pattern introduces, following renames. */
    const bindPattern = (node) => {
        if (!node) return;
        if (node.type === 'Identifier') { bound.add(node.name); return; }
        if (node.type === 'AssignmentPattern') { bindPattern(node.left); return; }
        if (node.type === 'RestElement') { bindPattern(node.argument); return; }
        if (node.type === 'ObjectPattern') {
            for (const prop of node.properties) {
                bindPattern(prop.type === 'RestElement' ? prop : prop.value);
            }
            return;
        }
        if (node.type === 'ArrayPattern') {
            for (const element of node.elements) bindPattern(element);
        }
    };

    const walk = (node) => {
        if (!node || typeof node !== 'object') return;
        if (Array.isArray(node)) { for (const child of node) walk(child); return; }
        if (typeof node.type !== 'string') return;

        switch (node.type) {
            case 'ImportDeclaration':
                for (const spec of node.specifiers) bound.add(spec.local.name);
                break;
            case 'FunctionDeclaration':
            case 'FunctionExpression':
            case 'ArrowFunctionExpression':
            case 'ClassDeclaration':
            case 'ClassExpression':
                if (node.id) bound.add(node.id.name);
                for (const param of node.params || []) bindPattern(param);
                break;
            case 'VariableDeclarator':
                bindPattern(node.id);
                break;
            // An object property that is a shorthand method, `setup() {}`.
            case 'ObjectMethod':
                if (!node.computed) bound.add(node.key.name ?? node.key.value);
                break;
            case 'ClassMethod':
            case 'ClassPrivateMethod':
                break;
            case 'CallExpression':
            case 'OptionalCallExpression':
                if (node.callee?.type === 'Identifier' && !called.has(node.callee.name)) {
                    called.set(node.callee.name, node.loc?.start?.line);
                }
                break;
        }

        for (const key of Object.keys(node)) {
            if (key === 'loc' || key === 'leadingComments' || key === 'trailingComments') continue;
            walk(node[key]);
        }
    };

    walk(ast.program);
    return { bound, called };
}

/**
 * A plain function called but never imported and never declared is a
 * ReferenceError at render, which unmounts the tree and shows a white screen.
 *
 * Three of these got through a green build and a green suite in one session --
 * `pad` in the debt form after its date formatter moved to Intl, `fmtRate` in
 * the transfer modal, and an `axios` import deleted while editing the line above
 * it. The bundler cannot catch a free variable, and a test only catches it if it
 * renders the branch that contains it. None of the three were covered, so this
 * reads every file instead of executing them.
 *
 * The AMBIENT list is the only allowance left, and it is small: the language
 * globals, the browser and Node APIs, and `route`/`csrfToken` from Ziggy.
 */
describe('every function a file calls is either imported or declared', () => {
    it.each(files)('%s has no undefined helper', (file) => {
        let analysed;
        try {
            analysed = analyze(readFileSync(file, 'utf-8'));
        } catch (error) {
            // A parse failure is a different bug and belongs to the build, not
            // to a check about missing names. Failing here would report it as
            // something it is not.
            throw new Error(`${file} did not parse: ${error.message}`);
        }

        const missing = [];
        for (const [name, line] of analysed.called) {
            if (analysed.bound.has(name) || AMBIENT.has(name) || TAILWIND_ARBITRARY.has(name)) continue;
            missing.push(name + '() at line ' + line);
        }

        expect(missing, file + ' calls a function it does not import').toEqual([]);
    });
});

