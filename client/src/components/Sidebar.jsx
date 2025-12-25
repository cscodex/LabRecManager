'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    Home, BookOpen, FileText, Award, Users, GraduationCap,
    Video, BarChart3, Settings, LogOut, Menu, X, ChevronLeft,
    Beaker, ClipboardList, Activity, ClipboardCheck, Send, ListChecks, UserPlus, Monitor, FolderOpen, Pencil
} from 'lucide-react';
import { useAuthStore } from '@/lib/store';

const navItems = {
    admin: [
        { href: '/dashboard', label: 'Dashboard', labelHindi: 'डैशबोर्ड', icon: Home },
        { href: '/classes', label: 'Classes', labelHindi: 'कक्षाएं', icon: Users },
        { href: '/users', label: 'Manage Users', labelHindi: 'उपयोगकर्ता प्रबंधन', icon: UserPlus },
        { href: '/admin/labs', label: 'Labs & PCs', labelHindi: 'लैब और पीसी', icon: Monitor },
        { href: '/assignments', label: 'Assignments', labelHindi: 'असाइनमेंट', icon: BookOpen },
        { href: '/assigned-work', label: 'Assigned Work', labelHindi: 'सौंपा गया कार्य', icon: ListChecks },
        { href: '/submissions', label: 'Review Submissions', labelHindi: 'समीक्षा प्रस्तुतियाँ', icon: ClipboardList },
        { href: '/admin/documents', label: 'Documents', labelHindi: 'दस्तावेज़', icon: FolderOpen },
        { href: '/grades', label: 'Grades', labelHindi: 'ग्रेड', icon: Award },
        { href: '/viva', label: 'Viva', labelHindi: 'मौखिक', icon: Video },
        { href: '/whiteboard', label: 'Whiteboard', labelHindi: 'व्हाइटबोर्ड', icon: Pencil },
        { href: '/admin/whiteboards', label: 'Live Sessions', labelHindi: 'लाइव सत्र', icon: Video },
        { href: '/activity-logs', label: 'Activity Logs', labelHindi: 'गतिविधि लॉग', icon: Activity },
        { href: '/reports', label: 'Reports', labelHindi: 'रिपोर्ट', icon: BarChart3 },
        { href: '/settings', label: 'Settings', labelHindi: 'सेटिंग्स', icon: Settings },
    ],
    principal: [
        { href: '/dashboard', label: 'Dashboard', labelHindi: 'डैशबोर्ड', icon: Home },
        { href: '/classes', label: 'Classes', labelHindi: 'कक्षाएं', icon: Users },
        { href: '/users', label: 'Manage Users', labelHindi: 'उपयोगकर्ता प्रबंधन', icon: UserPlus },
        { href: '/admin/documents', label: 'Documents', labelHindi: 'दस्तावेज़', icon: FolderOpen },
        { href: '/grades', label: 'Grades', labelHindi: 'ग्रेड', icon: Award },
        { href: '/activity-logs', label: 'Activity Logs', labelHindi: 'गतिविधि लॉग', icon: Activity },
        { href: '/reports', label: 'Reports', labelHindi: 'रिपोर्ट', icon: BarChart3 },
        { href: '/settings', label: 'Settings', labelHindi: 'सेटिंग्स', icon: Settings },
    ],
    instructor: [
        { href: '/dashboard', label: 'Dashboard', labelHindi: 'डैशबोर्ड', icon: Home },
        { href: '/classes', label: 'My Classes', labelHindi: 'मेरी कक्षाएं', icon: Users },
        { href: '/assignments', label: 'Assignments', labelHindi: 'असाइनमेंट', icon: BookOpen },
        { href: '/assigned-work', label: 'Assigned Work', labelHindi: 'सौंपा गया कार्य', icon: ListChecks },
        { href: '/submissions', label: 'Review', labelHindi: 'समीक्षा', icon: ClipboardList },
        { href: '/documents', label: 'Shared Docs', labelHindi: 'साझा दस्तावेज़', icon: FolderOpen },
        { href: '/grades', label: 'Grades', labelHindi: 'ग्रेड', icon: Award },
        { href: '/viva', label: 'Viva', labelHindi: 'मौखिक', icon: Video },
        { href: '/whiteboard', label: 'Whiteboard', labelHindi: 'व्हाइटबोर्ड', icon: Pencil },
        { href: '/activity-logs', label: 'Activity Logs', labelHindi: 'गतिविधि लॉग', icon: Activity },
        { href: '/reports', label: 'Reports', labelHindi: 'रिपोर्ट', icon: BarChart3 },
        { href: '/settings', label: 'Settings', labelHindi: 'सेटिंग्स', icon: Settings },
    ],
    lab_assistant: [
        { href: '/dashboard', label: 'Dashboard', labelHindi: 'डैशबोर्ड', icon: Home },
        { href: '/classes', label: 'Classes', labelHindi: 'कक्षाएं', icon: Users },
        { href: '/admin/labs', label: 'Labs & PCs', labelHindi: 'लैब और पीसी', icon: Monitor },
        { href: '/assignments', label: 'Assignments', labelHindi: 'असाइनमेंट', icon: BookOpen },
        { href: '/assigned-work', label: 'Assigned Work', labelHindi: 'सौंपा गया कार्य', icon: ListChecks },
        { href: '/submissions', label: 'Review Submissions', labelHindi: 'समीक्षा प्रस्तुतियाँ', icon: FileText },
        { href: '/documents', label: 'Shared Docs', labelHindi: 'साझा दस्तावेज़', icon: FolderOpen },
        { href: '/settings', label: 'Settings', labelHindi: 'सेटिंग्स', icon: Settings },
    ],
    student: [
        { href: '/dashboard', label: 'Dashboard', labelHindi: 'डैशबोर्ड', icon: Home },
        { href: '/my-work', label: 'Assigned Work', labelHindi: 'सौंपा गया कार्य', icon: ClipboardCheck },
        { href: '/submissions', label: 'My Submissions', labelHindi: 'मेरी प्रस्तुतियाँ', icon: FileText },
        { href: '/documents', label: 'Shared Docs', labelHindi: 'साझा दस्तावेज़', icon: FolderOpen },
        { href: '/grades', label: 'My Grades', labelHindi: 'मेरे ग्रेड', icon: Award },
        { href: '/viva', label: 'Viva', labelHindi: 'मौखिक', icon: Video },
        { href: '/live-board', label: 'Live Board', labelHindi: 'लाइव बोर्ड', icon: Pencil },
        { href: '/settings', label: 'Settings', labelHindi: 'सेटिंग्स', icon: Settings },
    ],
};


export default function Sidebar({ isOpen, onClose, isCollapsed, onToggleCollapse }) {
    const pathname = usePathname();
    const { user, logout } = useAuthStore();
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 1024);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

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
                        <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center text-white font-bold">
                            <Beaker className="w-6 h-6" />
                        </div>
                        <div>
                            <h1 className="font-bold text-slate-900 dark:text-slate-100 text-lg leading-none">ULRMS</h1>
                            <p className="text-xs text-slate-500 dark:text-slate-400">Unified Lab Records</p>
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
                        return (
                            <li key={item.href}>
                                <Link
                                    href={item.href}
                                    onClick={() => isMobile && onClose()}
                                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${isActive
                                        ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/30'
                                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                                        }`}
                                    title={isCollapsed && !isMobile ? item.label : undefined}
                                >
                                    <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-white' : 'text-slate-500 dark:text-slate-400'}`} />
                                    {(!isCollapsed || isMobile) && (
                                        <span className="font-medium">{item.label}</span>
                                    )}
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            </nav>

            {/* User Info & Logout */}
            <div className="p-3 border-t border-slate-200 dark:border-slate-700">
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
                    title={isCollapsed && !isMobile ? 'Logout' : undefined}
                >
                    <LogOut className="w-5 h-5" />
                    {(!isCollapsed || isMobile) && <span className="font-medium">Logout</span>}
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
