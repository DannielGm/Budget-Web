import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import AppHeader from '@/Components/AppHeader';
import { CurrencyProvider, USD, EUR } from '@/lib/currency';
import { BarChart3, TrendingUp, Wallet } from 'lucide-react';

const VIEWS = [
    { icon: BarChart3, index: 0, title: 'Presupuesto' },
    { icon: TrendingUp, index: 1, title: 'Tasas BCV' },
    { icon: Wallet, index: 2, title: 'Ahorros' },
];

const render = (props = {}, currency = USD) => renderToStaticMarkup(
    <CurrencyProvider currency={currency}>
        <AppHeader
            title="Septiembre 2026"
            onTitleClick={() => {}}
            onGoToToday={() => {}}
            isNotToday
            views={VIEWS}
            currentViewIndex={2}
            onChangeView={() => {}}
            onOpenSettings={() => {}}
            {...props}
        />
    </CurrencyProvider>,
);

/**
 * The header, as every signed-in screen now renders it.
 *
 * Three rules are worth holding here. The view you are on has to be nameable on a
 * phone, because an icon alone cannot say which of the three dashboards you are in
 * and the `title` tooltip never appears on a touchscreen. The gutter has to be the
 * layout's alone. And the title has to be a real heading, so every screen answers
 * "what page is this" to a screen reader and to a document outline.
 */
describe('the view switcher', () => {
    it('names the current view, not just its icon', () => {
        expect(render()).toContain('Ahorros');
    });

    it('shows that name on a phone, not only from the sm breakpoint up', () => {
        // The old pill carried `hidden sm:inline` on the view name -- hidden on the
        // one device where the icon alone is not enough. renderToStaticMarkup
        // cannot see a breakpoint, so the class list is the assertion: the active
        // segment must carry no `hidden` token at all.
        const active = render().match(/<button[^>]*aria-current="page"[^>]*>/);
        expect(active).not.toBeNull();
        expect(active[0]).not.toMatch(/(^|[\s"])hidden([\s"]|$)/);
    });

    it('offers all three dashboards', () => {
        const html = render();
        expect(html).toContain('Presupuesto');
        expect(html).toContain('Tasas BCV');
        expect(html).toContain('Ahorros');
    });

    it('is left off the screens that do not swipe between dashboards', () => {
        expect(render({ views: undefined })).not.toContain('Dashboards');
    });
});

describe('the header currency switch', () => {
    it('offers the other currency, by name, in words', () => {
        expect(render()).toContain('Ver en euros');
        expect(render({}, EUR)).toContain('Ver en d\u00F3lares');
    });

    it('does not offer the currency already on screen', () => {
        // A dollar screen must not offer dollars.
        expect(render()).not.toContain('Ver en d\u00F3lares');
        expect(render({}, EUR)).not.toContain('Ver en euros');
    });
});

describe('the one header, on every screen', () => {
    it('gives every screen a real heading', () => {
        // Savings, Análisis and Configuración each used to render an <h2> of their
        // own, and Análisis rendered a second <h1> inside its panel besides.
        expect(render()).toContain('<h1');
        expect(render({ title: 'Ahorros', views: undefined })).toContain('<h1');
        expect(render({ title: 'Análisis', views: undefined, subtitle: 'Septiembre 2026' })).toContain('<h1');
    });

    it('renders no gutter of its own', () => {
        // The layout owns the padding. The header used px-3 against the pages'
        // px-4, and two pages then added a second px-4 on top of it. Only the
        // outermost element is checked: padding inside a control is its own
        // business and is not a gutter.
        const root = render().match(/^<div class="([^"]*)"/);
        expect(root).not.toBeNull();
        expect(root[1]).not.toMatch(/\bpx-\d/);
        expect(root[1]).toBe('w-full');
    });

    it('carries the subtitle under the title when a screen has one', () => {
        const html = render({ subtitle: 'Septiembre 2026' });
        expect(html).toContain('Septiembre 2026');
    });
});

describe('the way out of a screen', () => {
    it('is a real link, so modified clicks and open-in-new-tab still work', () => {
        const html = render({ back: { href: '/', label: 'Volver al dashboard' } });
        expect(html).toContain('href="/"');
        expect(html).toContain('Volver al dashboard');
    });

    it('keeps the today shortcut in place when there is nothing to go back to', () => {
        // It used to be mounted and unmounted with `isNotToday`, shoving the title
        // sideways whenever the month changed. It stays, dimmed and disabled.
        const idle = render({ isNotToday: false });
        const button = idle.match(/<button[^>]*aria-label="Ir a hoy"[^>]*>/);
        expect(button).not.toBeNull();
        expect(button[0]).toContain('disabled');

        // And it is live again once there is somewhere to go back to.
        expect(render({ isNotToday: true }).match(/<button[^>]*aria-label="Ir a hoy"[^>]*>/)[0])
            .not.toContain('disabled');
    });
});

describe('the overflow menu', () => {
    it('says it opens a menu, and that it is shut', () => {
        // Closed is the only state renderToStaticMarkup can show, so this is where
        // the trigger's wiring is pinned rather than its open panel.
        const html = render();
        expect(html).toContain('aria-haspopup="menu"');
        expect(html).toContain('aria-expanded="false"');
    });
});