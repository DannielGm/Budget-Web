import { Link, usePage } from '@inertiajs/react';
import { useState } from 'react';

export default function AuthenticatedLayout({ header, children }) {
    // Signing in is optional, so this layout must render for guests too.
    const user = usePage().props.auth?.user ?? null;

    return (
        <div className="min-h-screen bg-[#FFFFFF] dark:bg-[#0D0D12] transition-colors pb-20 overflow-x-hidden">
            {header && (
                <header className="sticky top-0 z-20 border-b border-white/10 bg-gradient-to-r from-[#FF8A3D] to-[#F9732F] pt-[env(safe-area-inset-top)] shadow-[0_6px_20px_rgba(15,23,42,0.10)] transition-colors dark:from-[#7C5CE5] dark:to-[#9B7BFF] dark:shadow-[0_6px_20px_rgba(0,0,0,0.24)]">
                    <div className="mx-auto flex min-h-16 max-w-lg items-center px-3 sm:px-0">
                        {header}
                    </div>
                </header>
            )}

            <main className="max-w-lg mx-auto">{children}</main>
        </div>
    );
}
