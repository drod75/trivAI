'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

export function Navigation() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [hideNav, setHideNav] = useState(false);
  
  useEffect(() => {
    // Only hide navigation during ACTIVE gameplay (in_progress status)
    // Keep it visible on all other pages including lobby/waiting screens
    // Check if we're in an active game by looking for full-screen game overlay
    const checkGameState = () => {
      // Check if there's a full-screen game view active
      const gameInProgress = document.querySelector('.fixed.inset-0.z-\\[9999\\]');
      // Only hide if game is actively in progress (not just on multiplayer page)
      setHideNav(!!gameInProgress);
    };
    
    checkGameState();
    // Check periodically
    const interval = setInterval(checkGameState, 500);
    return () => clearInterval(interval);
  }, [pathname, searchParams]);
  
  const isActive = (path: string) => {
    if (path === '/') {
      return pathname === '/';
    }
    return pathname.startsWith(path);
  };

  // Hide navigation during active gameplay
  if (hideNav) {
    return null;
  }

  return (
    <nav className="sticky top-0 z-50 w-full border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60 dark:bg-slate-950/95 dark:supports-[backdrop-filter]:bg-slate-950/60">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              trivAI
            </span>
          </Link>
          
          <div className="flex items-center gap-1">
            <Link
              href="/"
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive('/') && pathname !== '/multiplayer'
                  ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              Solo Play
            </Link>
            <Link
              href="/multiplayer"
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive('/multiplayer')
                  ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              Multiplayer
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}

