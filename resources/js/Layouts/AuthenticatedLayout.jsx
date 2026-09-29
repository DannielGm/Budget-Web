import { usePage } from '@inertiajs/react';

export default function AuthenticatedLayout({ header, children }) {
    // Signing in is optional, so this layout must render for guests too.
    const user = usePage().props.auth?.user ?? null;

    return (
        <div className="min-h-screen bg-[#FFFFFF] pb-20 pb-[calc(env(safe-area-inset-bottom)+5rem)] overflow-x-hidden transition-colors dark:bg-[#0D0D12]">
            {/* The gutter belongs here, once. It used to be px-3 while the pages
                used px-4, so the header never lined up with the content under it,
                and two pages added their own px-4 on top of this. */}
            <a
                href="#main"
                className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-xl focus:bg-white focus:px-4 focus:py-2 focus:font-black focus:text-[#FF8A3D]"
            >
                Saltar al contenido
            </a>

            {header && (
                <header className="sticky top-0 z-20 border-b border-white/10 bg-gradient-to-r from-[#FF9A52] via-[#FF8A3D] to-[#F9732F] pt-[env(safe-area-inset-top)] shadow-[0_6px_20px_rgba(15,23,42,0.10)] transition-colors dark:from-[#7C5CE5] dark:via-[#8B6BEE] dark:to-[#9B7BFF] dark:shadow-[0_6px_20px_rgba(0,0,0,0.24)]">
                    <div className="mx-auto flex max-w-lg flex-col justify-center px-4 py-2.5">
                        {header}
                    </div>
                </header>
            )}

            <main id="main" className="mx-auto max-w-lg">{children}</main>
        </div>
    );
}
