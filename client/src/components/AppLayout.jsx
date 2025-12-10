'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Menu, Search } from 'lucide-react';
import Sidebar from './Sidebar';
import NotificationBell from './NotificationBell';
import ProfileDropdown from './ProfileDropdown';
import { DatabaseStatusBadge } from './DatabaseStatus';
import { useAuthStore } from '@/lib/store';

export default function AppLayout({ children }) {
    const pathname = usePathname();
    const router = useRouter();
    const { isAuthenticated, _hasHydrated } = useAuthStore();

    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // Don't show layout on login/register pages
    const isAuthPage = pathname === '/login' || pathname === '/register';

    // Load sidebar collapsed state from localStorage
    useEffect(() => {
        const saved = localStorage.getItem('sidebarCollapsed');
        if (saved) {
            setSidebarCollapsed(JSON.parse(saved));
        }
    }, []);

    // Save sidebar collapsed state
    const handleToggleCollapse = () => {
        const newState = !sidebarCollapsed;
        setSidebarCollapsed(newState);
        localStorage.setItem('sidebarCollapsed', JSON.stringify(newState));
    };

    // If on auth page, just render children without layout
    if (isAuthPage) {
        return <>{children}</>;
    }

    // Wait for hydration
    if (!_hasHydrated) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full"></div>
            </div>
        );
    }

    // If not authenticated and not on auth page, render children (they will handle redirect)
    if (!isAuthenticated) {
        return <>{children}</>;
    }

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Sidebar */}
            <Sidebar
                isOpen={sidebarOpen}
                onClose={() => setSidebarOpen(false)}
                isCollapsed={sidebarCollapsed}
                onToggleCollapse={handleToggleCollapse}
            />

            {/* Main Content */}
            <div className={`transition-all duration-300 ${sidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64'}`}>
                {/* Top Header */}
                <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200">
                    <div className="px-4 h-16 flex items-center justify-between gap-4">
                        {/* Left side - Mobile menu & Search */}
                        <div className="flex items-center gap-3 flex-1">
                            {/* Mobile menu button */}
                            <button
                                onClick={() => setSidebarOpen(true)}
                                className="lg:hidden p-2 rounded-lg hover:bg-slate-100 transition"
                            >
                                <Menu className="w-5 h-5 text-slate-600" />
                            </button>

                            {/* Search */}
                            <div className="hidden md:flex items-center gap-2 flex-1 max-w-md">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input
                                        type="text"
                                        placeholder="Search assignments, students..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full pl-9 pr-4 py-2 bg-slate-100 border-0 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:bg-white transition"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Right side - Status, Notifications, Profile */}
                        <div className="flex items-center gap-2">
                            <DatabaseStatusBadge />
                            <NotificationBell />
                            <ProfileDropdown />
                        </div>
                    </div>
                </header>

                {/* Page Content */}
                <main className="min-h-[calc(100vh-4rem)]">
                    {children}
                </main>
            </div>
        </div>
    );
}
