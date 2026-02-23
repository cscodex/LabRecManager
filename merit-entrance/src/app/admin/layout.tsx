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
    ChevronRight,
    ChevronLeft,
    Tag,
    BookOpen,
    Layers
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
    const [isCollapsed, setIsCollapsed] = useState(false);

    const isPublicRoute = pathname.includes('/forgot-password') || pathname.includes('/reset-password');

    // Redirect if not admin (and not on a public route)
    useEffect(() => {
        if (!isPublicRoute && _hasHydrated && (!isAuthenticated || !['admin', 'superadmin'].includes(user?.role || ''))) {
            router.push('/');
        }
    }, [_hasHydrated, isAuthenticated, user, router, isPublicRoute]);

    if (!isPublicRoute && !_hasHydrated) return null;

    if (isPublicRoute) {
        return <>{children}</>;
    }

    const navItems = [
        { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { href: '/admin/exams', label: 'Exams', icon: FileText },
        { href: '/admin/blueprints', label: 'Blueprints', icon: Layers },
        { href: '/admin/students', label: 'Students', icon: Users },
        { href: '/admin/tags', label: 'Tags', icon: Tag },
        { href: '/admin/questions', label: 'Question Bank', icon: BookOpen },
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
                title={isCollapsed ? item.label : ''}
                onClick={() => isMobile && setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm font-medium ${isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    } ${isCollapsed && !isMobile ? 'justify-center' : ''}`}
            >
                <item.icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-blue-600' : 'text-gray-400'}`} />
                {(!isCollapsed || isMobile) && <span className="truncate">{item.label}</span>}
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
            <aside className={`fixed lg:sticky top-0 left-0 z-50 h-screen bg-white border-r transform transition-all duration-300 ease-in-out lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} ${isCollapsed ? 'lg:w-20' : 'lg:w-64'}`}>
                <div className="flex flex-col h-full">
                    {/* Brand */}
                    <div className={`h-16 flex items-center px-4 border-b ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
                        <Link href="/admin/dashboard" className="flex items-center gap-2 text-blue-600 overflow-hidden">
                            <Shield className="w-8 h-8 flex-shrink-0" />
                            {!isCollapsed && <span className="font-bold text-gray-900 text-lg truncate">Admin Panel</span>}
                        </Link>
                        {/* Mobile Close Button */}
                        <button
                            onClick={() => setSidebarOpen(false)}
                            className="lg:hidden text-gray-500"
                        >
                            <X className="w-6 h-6" />
                        </button>
                        {/* Desktop Collapse Button */}
                        <button
                            onClick={() => setIsCollapsed(!isCollapsed)}
                            className="hidden lg:flex items-center justify-center text-gray-400 hover:text-gray-600 ml-auto"
                        >
                            {isCollapsed ? null : <ChevronLeft className="w-5 h-5" />}
                        </button>
                    </div>

                    {/* Navigation */}
                    <nav className="flex-1 overflow-y-auto overflow-x-hidden p-2 space-y-6">
                        <div className="space-y-1">
                            {navItems.map((item) => (
                                <NavLink key={item.href} item={item} />
                            ))}
                        </div>

                        {/* System Section */}
                        <div className="pt-4 border-t">
                            {!isCollapsed ? (
                                <button
                                    onClick={() => setSystemMenuOpen(!isSystemMenuOpen)}
                                    className="flex items-center justify-between w-full px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider hover:text-gray-700"
                                >
                                    System Management
                                    {isSystemMenuOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                </button>
                            ) : (
                                <div className="px-3 py-2 text-center">
                                    <Settings className="w-4 h-4 mx-auto text-gray-400" />
                                </div>
                            )}

                            {(isSystemMenuOpen || isCollapsed) && (
                                <div className="mt-2 space-y-1">
                                    {systemItems.map((item) => (
                                        <NavLink key={item.href} item={item} />
                                    ))}
                                </div>
                            )}
                        </div>
                    </nav>

                    {/* User Profile */}
                    <div className="p-4 border-t bg-gray-50">
                        <div className={`flex items-center gap-3 mb-3 ${isCollapsed ? 'justify-center' : 'px-2'}`}>
                            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold flex-shrink-0">
                                {user?.name?.charAt(0)}
                            </div>
                            {!isCollapsed && (
                                <div className="flex-1 overflow-hidden">
                                    <p className="text-sm font-medium text-gray-900 truncate">{user?.name}</p>
                                    <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                                </div>
                            )}
                        </div>
                        <button
                            onClick={handleLogout}
                            title={isCollapsed ? "Log Out" : ""}
                            className={`w-full flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 bg-white border border-red-100 rounded-lg hover:bg-red-50 hover:border-red-200 transition-colors ${isCollapsed ? 'justify-center' : 'justify-center'}`}
                        >
                            <LogOut className="w-4 h-4 flex-shrink-0" />
                            {!isCollapsed && "Log Out"}
                        </button>
                        {!isCollapsed && (
                            <>
                                <div className="mt-4 px-2">
                                    <Clock />
                                </div>
                                <div className="mt-4 text-center">
                                    <p className="text-xs text-gray-400 font-mono">
                                        v{process.env.NEXT_PUBLIC_COMMIT_HASH || 'dev'}
                                    </p>
                                </div>
                            </>
                        )}
                        {/* Toggle Button for Collapsed Mode (Centered) */}
                        {isCollapsed && (
                            <button
                                onClick={() => setIsCollapsed(false)}
                                className="mt-2 w-full flex justify-center text-gray-400 hover:text-gray-600 pb-2"
                            >
                                <ChevronRight className="w-5 h-5" />
                            </button>
                        )}
                    </div>
                </div>
            </aside>

            {/* Main Content Wrapper */}
            <div className="flex-1 flex flex-col min-w-0 transition-all duration-300">
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
