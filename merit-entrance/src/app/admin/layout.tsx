'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import {
    LayoutDashboard,
    FileText,
    Users,
    BarChart3,
    Settings,
    HardDrive,
    Database,
    LogOut,
    Menu,
    X,
    Shield,
    ChevronDown,
    ChevronRight
} from 'lucide-react';
import Clock from '@/components/Clock';

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const router = useRouter();
    const { user, logout, isAuthenticated, _hasHydrated } = useAuthStore();
    const [isSidebarOpen, setSidebarOpen] = useState(false);
    const [isSystemMenuOpen, setSystemMenuOpen] = useState(true);

    // Redirect if not admin
    useEffect(() => {
        if (_hasHydrated && (!isAuthenticated || !['admin', 'superadmin'].includes(user?.role || ''))) {
            router.push('/');
        }
    }, [_hasHydrated, isAuthenticated, user, router]);

    if (!_hasHydrated) return null;

    const navItems = [
        { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { href: '/admin/exams', label: 'Exams', icon: FileText },
        { href: '/admin/students', label: 'Students', icon: Users },
        { href: '/admin/results', label: 'Results', icon: BarChart3 },
        { href: '/admin/reports', label: 'Reports', icon: BarChart3 },
    ];

    const systemItems = [
        { href: '/admin/backup', label: 'Backups', icon: HardDrive },
        { href: '/admin/query-logs', label: 'Activity Logs', icon: Database },
        { href: '/admin/settings', label: 'Settings', icon: Settings },
    ];

    const handleLogout = async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        logout();
        router.push('/');
    };

    const NavLink = ({ item, isMobile = false }: { item: any, isMobile?: boolean }) => {
        const isActive = pathname.startsWith(item.href);
        return (
            <Link
                href={item.href}
                onClick={() => isMobile && setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm font-medium ${isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    }`}
            >
                <item.icon className={`w-5 h-5 ${isActive ? 'text-blue-600' : 'text-gray-400'}`} />
                {item.label}
            </Link>
        );
    };

    return (
        <div className="min-h-screen bg-gray-50 flex">
            {/* Mobile Sidebar Overlay */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Sidebar Navigation */}
            <aside className={`fixed lg:sticky top-0 left-0 z-50 h-screen w-64 bg-white border-r transform transition-transform duration-200 ease-in-out lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                <div className="flex flex-col h-full">
                    {/* Brand */}
                    <div className="h-16 flex items-center px-6 border-b">
                        <Link href="/admin/dashboard" className="flex items-center gap-2 text-blue-600">
                            <Shield className="w-8 h-8" />
                            <span className="font-bold text-gray-900 text-lg">Admin Panel</span>
                        </Link>
                        <button
                            onClick={() => setSidebarOpen(false)}
                            className="ml-auto lg:hidden text-gray-500"
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    {/* Navigation */}
                    <nav className="flex-1 overflow-y-auto p-4 space-y-6">
                        <div className="space-y-1">
                            {navItems.map((item) => (
                                <NavLink key={item.href} item={item} isMobile={true} />
                            ))}
                        </div>

                        {/* System Section */}
                        <div className="pt-4 border-t">
                            <button
                                onClick={() => setSystemMenuOpen(!isSystemMenuOpen)}
                                className="flex items-center justify-between w-full px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider hover:text-gray-700"
                            >
                                System Management
                                {isSystemMenuOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                            </button>
                            {isSystemMenuOpen && (
                                <div className="mt-2 space-y-1">
                                    {systemItems.map((item) => (
                                        <NavLink key={item.href} item={item} isMobile={true} />
                                    ))}
                                </div>
                            )}
                        </div>
                    </nav>

                    {/* User Profile */}
                    <div className="p-4 border-t bg-gray-50">
                        <div className="flex items-center gap-3 mb-3 px-2">
                            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
                                {user?.name?.charAt(0)}
                            </div>
                            <div className="flex-1 overflow-hidden">
                                <p className="text-sm font-medium text-gray-900 truncate">{user?.name}</p>
                                <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                            </div>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-red-600 bg-white border border-red-100 rounded-lg hover:bg-red-50 hover:border-red-200 transition-colors"
                        >
                            <LogOut className="w-4 h-4" />
                            Log Out
                        </button>
                        <div className="mt-4 px-2">
                            <Clock />
                        </div>
                        <div className="mt-4 text-center">
                            <p className="text-xs text-gray-400 font-mono">
                                v{process.env.NEXT_PUBLIC_COMMIT_HASH || 'dev'}
                            </p>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Main Content Wrapper */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Mobile Header */}
                <header className="lg:hidden bg-white border-b h-16 flex items-center px-4 sticky top-0 z-30">
                    <button
                        onClick={() => setSidebarOpen(true)}
                        className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                    >
                        <Menu className="w-6 h-6" />
                    </button>
                    <span className="ml-4 font-bold text-gray-900">Merit Entrance</span>
                </header>

                <main className="flex-1 p-4 lg:p-8 overflow-x-hidden">
                    {children}
                </main>
            </div>
        </div>
    );
}
