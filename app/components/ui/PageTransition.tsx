'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { usePathname } from 'next/navigation';
import { ReactNode } from 'react';

export default function PageTransition({ children }: { children: ReactNode }) {
    const pathname = usePathname();
    const shouldAnimate =
        pathname === '/' ||
        pathname?.startsWith('/about') ||
        pathname?.startsWith('/become-a-host') ||
        pathname?.startsWith('/company') ||
        pathname?.startsWith('/site-map');

    if (!shouldAnimate) {
        return <>{children}</>;
    }

    return (
        <AnimatePresence mode="wait">
            <motion.div
                key={pathname}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
                className="flex-1 flex flex-col w-full h-full"
            >
                {children}
            </motion.div>
        </AnimatePresence>
    );
}
