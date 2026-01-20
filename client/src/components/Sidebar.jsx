'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import {
    Home, BookOpen, FileText, Award, Users, GraduationCap,
    Video, BarChart3, Settings, LogOut, Menu, X, ChevronLeft,
    Beaker, ClipboardList, Activity, ClipboardCheck, Send, ListChecks, UserPlus, Monitor, FolderOpen, Pencil, Ticket, Building, Film, HardDrive
} from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import LanguageSelector from './LanguageSelector';

const navItems = {
    admin: [
        { href: '/dashboard', labelKey: 'nav.dashboard', icon: Home },
        { href: '/classes', labelKey: 'nav.classes', icon: Users },
        { href: '/users', labelKey: 'nav.manageUsers', icon: UserPlus },
        { href: '/admin/labs', labelKey: 'nav.labsPCs', icon: Monitor },
        { href: '/assignments', labelKey: 'nav.assignments', icon: BookOpen },
        { href: '/assigned-work', labelKey: 'nav.assignedWork', icon: ListChecks },
        { href: '/submissions', labelKey: 'nav.reviewSubmissions', icon: ClipboardList },
        { href: '/admin/documents', labelKey: 'nav.documents', icon: FolderOpen },
        { href: '/admin/storage', labelKey: 'nav.storage', icon: HardDrive },
        { href: '/grades', labelKey: 'nav.grades', icon: Award },
        { href: '/viva', labelKey: 'nav.viva', icon: Video },
        { href: '/whiteboard', labelKey: 'nav.whiteboard', icon: Pencil },
        { href: '/recordings', labelKey: 'nav.recordings', icon: Film },
        { href: '/admin/whiteboards', labelKey: 'nav.liveSessions', icon: Video },
        { href: '/activity-logs', labelKey: 'nav.activityLogs', icon: Activity },
        { href: '/tickets', labelKey: 'nav.tickets', icon: Ticket },
        { href: '/admin/school-profile', labelKey: 'nav.schoolProfile', icon: Building },
        { href: '/reports', labelKey: 'nav.reports', icon: BarChart3 },
        { href: '/settings', labelKey: 'nav.settings', icon: Settings },
    ],
    principal: [
        { href: '/dashboard', labelKey: 'nav.dashboard', icon: Home },
        { href: '/classes', labelKey: 'nav.classes', icon: Users },
        { href: '/users', labelKey: 'nav.manageUsers', icon: UserPlus },
        { href: '/admin/documents', labelKey: 'nav.documents', icon: FolderOpen },
        { href: '/admin/storage', labelKey: 'nav.storage', icon: HardDrive },
        { href: '/grades', labelKey: 'nav.grades', icon: Award },
        { href: '/activity-logs', labelKey: 'nav.activityLogs', icon: Activity },
        { href: '/tickets', labelKey: 'nav.tickets', icon: Ticket },
        { href: '/admin/school-profile', labelKey: 'nav.schoolProfile', icon: Building },
        { href: '/reports', labelKey: 'nav.reports', icon: BarChart3 },
        { href: '/settings', labelKey: 'nav.settings', icon: Settings },
    ],
    instructor: [
        { href: '/dashboard', labelKey: 'nav.dashboard', icon: Home },
        { href: '/classes', labelKey: 'nav.myClasses', icon: Users },
        { href: '/assignments', labelKey: 'nav.assignments', icon: BookOpen },
        { href: '/assigned-work', labelKey: 'nav.assignedWork', icon: ListChecks },
        { href: '/submissions', labelKey: 'nav.review', icon: ClipboardList },
        { href: '/documents', labelKey: 'nav.sharedDocs', icon: FolderOpen },
        { href: '/grades', labelKey: 'nav.grades', icon: Award },
        { href: '/viva', labelKey: 'nav.viva', icon: Video },
        { href: '/whiteboard', labelKey: 'nav.whiteboard', icon: Pencil },
        { href: '/recordings', labelKey: 'nav.recordings', icon: Film },
        { href: '/activity-logs', labelKey: 'nav.activityLogs', icon: Activity },
        { href: '/tickets', labelKey: 'nav.tickets', icon: Ticket },
        { href: '/reports', labelKey: 'nav.reports', icon: BarChart3 },
        { href: '/settings', labelKey: 'nav.settings', icon: Settings },
    ],
    lab_assistant: [
        { href: '/dashboard', labelKey: 'nav.dashboard', icon: Home },
        { href: '/classes', labelKey: 'nav.classes', icon: Users },
        { href: '/admin/labs', labelKey: 'nav.labsPCs', icon: Monitor },
        { href: '/assignments', labelKey: 'nav.assignments', icon: BookOpen },
        { href: '/assigned-work', labelKey: 'nav.assignedWork', icon: ListChecks },
        { href: '/submissions', labelKey: 'nav.reviewSubmissions', icon: FileText },
        { href: '/documents', labelKey: 'nav.sharedDocs', icon: FolderOpen },
        { href: '/tickets', labelKey: 'nav.tickets', icon: Ticket },
        { href: '/settings', labelKey: 'nav.settings', icon: Settings },
    ],
    student: [
        { href: '/dashboard', labelKey: 'nav.dashboard', icon: Home },
        { href: '/my-work', labelKey: 'nav.myWork', icon: ClipboardCheck },
        { href: '/submissions', labelKey: 'nav.mySubmissions', icon: FileText },
        { href: '/documents', labelKey: 'nav.sharedDocs', icon: FolderOpen },
        { href: '/grades', labelKey: 'nav.myGrades', icon: Award },
        { href: '/viva', labelKey: 'nav.viva', icon: Video },
        { href: '/live-board', labelKey: 'nav.liveBoard', icon: Pencil },
        { href: '/tickets', labelKey: 'nav.reportIssue', icon: Ticket },
        { href: '/settings', labelKey: 'nav.settings', icon: Settings },
    ],
};


export default function Sidebar({ isOpen, onClose, isCollapsed, onToggleCollapse }) {
    const pathname = usePathname();
    const { t } = useTranslation('common');
    const { user, logout } = useAuthStore();
    const [isMobile, setIsMobile] = useState(false);
    const [schoolInfo, setSchoolInfo] = useState({ name: 'ULRMS', logoUrl: '' });

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 1024);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // Fetch school info if user is logged in
    useEffect(() => {
        if (user?.schoolId) {
            console.log('[Sidebar] Fetching school info for schoolId:', user.schoolId);
            import('@/lib/api').then(module => {
                const api = module.default;
                api.get(`/schools/${user.schoolId}`)
                    .then(res => {
                        console.log('[Sidebar] School API response:', res.data);
                        if (res.data.success && res.data.data.school) {
                            console.log('[Sidebar] School logoUrl:', res.data.data.school.logoUrl);
                            setSchoolInfo({
                                name: res.data.data.school.name,
                                logoUrl: res.data.data.school.logoUrl
                            });
                        }
                    })
                    .catch(err => console.error('[Sidebar] Failed to load school info', err));
            });
        }
    }, [user?.schoolId]);

    const handleLogout = () => {
        logout();
        window.location.href = '/login';
    };

    const items = navItems[user?.role] || navItems.student;

    // Don't render on login page
    if (pathname === '/login' || pathname === '/register') {
        return null;
    }

    const sidebarContent = (
        <>
            {/* Logo */}
            <div className={`p-4 border-b border-slate-200 dark:border-slate-700 flex items-center ${isCollapsed && !isMobile ? 'justify-center' : 'justify-between'}`}>
                {(!isCollapsed || isMobile) && (
                    <Link href="/dashboard" className="flex items-center gap-2">
                        <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center text-white font-bold overflow-hidden">
                            {schoolInfo.logoUrl && schoolInfo.logoUrl.length > 0 ? (
                                <img
                                    src={schoolInfo.logoUrl}
                                    alt="School Logo"
                                    className="w-full h-full object-contain p-1 bg-white"
                                    onError={(e) => {
                                        console.error('[Sidebar] Logo failed to load:', schoolInfo.logoUrl);
                                        e.target.style.display = 'none';
                                        e.target.nextSibling?.removeAttribute('style');
                                    }}
                                />
                            ) : null}
                            <Beaker className={`w-6 h-6 ${schoolInfo.logoUrl && schoolInfo.logoUrl.length > 0 ? 'hidden' : ''}`} />
                        </div>
                        <div>
                            <h1 className="font-bold text-slate-900 dark:text-slate-100 text-lg leading-none truncate max-w-[150px]" title={schoolInfo.name}>{schoolInfo.name}</h1>
                            <p className="text-xs text-slate-500 dark:text-slate-400">{t('sidebar.unifiedLabRecords')}</p>
                        </div>
                    </Link>
                )}
                {isMobile && (
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">
                        <X className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                    </button>
                )}
                {!isMobile && (
                    <button
                        onClick={onToggleCollapse}
                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition"
                    >
                        <ChevronLeft className={`w-5 h-5 text-slate-600 dark:text-slate-400 transition-transform ${isCollapsed ? 'rotate-180' : ''}`} />
                    </button>
                )}
            </div>

            {/* Navigation */}
            <nav className="flex-1 p-3 overflow-y-auto">
                <ul className="space-y-1">
                    {items.map((item) => {
                        // Special handling for /assignments to prevent highlighting on /assignments/assign
                        const isActive = item.href === '/assignments'
                            ? pathname === '/assignments' || (pathname.startsWith('/assignments/') && !pathname.startsWith('/assignments/assign'))
                            : pathname === item.href || pathname.startsWith(item.href + '/');
                        const Icon = item.icon;
                        const label = t(item.labelKey);
                        return (
                            <li key={item.href}>
                                <Link
                                    href={item.href}
                                    onClick={() => isMobile && onClose()}
                                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${isActive
                                        ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/30'
                                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                                        }`}
                                    title={isCollapsed && !isMobile ? label : undefined}
                                >
                                    <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-white' : 'text-slate-500 dark:text-slate-400'}`} />
                                    {(!isCollapsed || isMobile) && (
                                        <span className="font-medium">{label}</span>
                                    )}
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            </nav>

            {/* User Info & Logout */}
            <div className="p-3 border-t border-slate-200 dark:border-slate-700">
                {/* Language Selector */}
                <div className="mb-2">
                    <LanguageSelector isCollapsed={isCollapsed && !isMobile} />
                </div>

                {(!isCollapsed || isMobile) && user && (
                    <Link href="/settings" className="flex items-center gap-3 px-3 py-2 mb-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white font-medium text-sm">
                            {user.firstName?.[0]}{user.lastName?.[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                                {user.firstName} {user.lastName}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">{user.role?.replace('_', ' ')}</p>
                            {(user.studentId || user.admissionNumber || user.employeeId) && (
                                <p className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                                    ID: {user.studentId || user.admissionNumber || user.employeeId}
                                </p>
                            )}
                        </div>
                    </Link>
                )}
                <button
                    onClick={handleLogout}
                    className={`flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition ${isCollapsed && !isMobile ? 'justify-center' : ''
                        }`}
                    title={isCollapsed && !isMobile ? t('auth.logout') : undefined}
                >
                    <LogOut className="w-5 h-5" />
                    {(!isCollapsed || isMobile) && <span className="font-medium">{t('auth.logout')}</span>}
                </button>
            </div>
        </>
    );

    return (
        <>
            {/* Mobile Overlay */}
            {isMobile && isOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 lg:hidden"
                    onClick={onClose}
                />
            )}

            {/* Sidebar */}
            <aside
                className={`fixed top-0 left-0 h-full bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700 z-50 flex flex-col transition-all duration-300 ${isMobile
                    ? `w-72 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`
                    : isCollapsed ? 'w-20' : 'w-64'
                    }`}
            >
                {sidebarContent}
            </aside>
        </>
    );
}
