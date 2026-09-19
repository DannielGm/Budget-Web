import { Link, usePage } from '@inertiajs/react';
import { useState } from 'react';

export default function AuthenticatedLayout({ header, children }) {
    const user = usePage().props.auth.user;

    return (
        <div className="min-h-screen bg-[#FFFFFF] dark:bg-[#0D0D12] transition-colors pb-20">
            {header && (
                <header className="bg-[#FF8A3D] dark:bg-[#9B7BFF] shadow-lg sticky top-0 z-10 transition-colors">
                    <div className="mx-auto max-w-lg h-16 flex items-center">
                        {header}
                    </div>
                </header>
            )}

            <main className="max-w-lg mx-auto">{children}</main>
        </div>
    );
}
