'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { User, Settings, LogOut, Shield, ChevronDown, Mail, Phone, Building } from 'lucide-react';
import { useAuthStore } from '@/lib/store';

export default function ProfileDropdown() {
    const { user, logout, isAuthenticated } = useAuthStore();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleLogout = () => {
        logout();
        window.location.href = '/login';
    };

    if (!isAuthenticated || !user) return null;

    const getRoleBadgeColor = (role) => {
        switch (role) {
            case 'admin': return 'bg-red-100 text-red-700';
            case 'principal': return 'bg-purple-100 text-purple-700';
            case 'instructor': return 'bg-blue-100 text-blue-700';
            case 'lab_assistant': return 'bg-emerald-100 text-emerald-700';
            case 'student': return 'bg-amber-100 text-amber-700';
            default: return 'bg-slate-100 text-slate-700';
        }
    };

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Profile Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 p-1.5 pr-3 rounded-full hover:bg-slate-100 transition border border-slate-200"
            >
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white font-medium text-sm">
                    {user.firstName?.[0]}{user.lastName?.[0]}
                </div>
                <span className="text-sm font-medium text-slate-700 hidden md:block">
                    {user.firstName}
                </span>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown */}
            {isOpen && (
                <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden">
                    {/* Profile Header */}
                    <div className="p-4 bg-gradient-to-br from-primary-500 to-primary-600 text-white">
                        <div className="flex items-center gap-3">
                            <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-xl border-2 border-white/50">
                                {user.firstName?.[0]}{user.lastName?.[0]}
                            </div>
                            <div>
                                <h3 className="font-semibold text-lg">
                                    {user.firstName} {user.lastName}
                                </h3>
                                {user.firstNameHindi && (
                                    <p className="text-sm text-white/80">
                                        {user.firstNameHindi} {user.lastNameHindi}
                                    </p>
                                )}
                                <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeColor(user.role)}`}>
                                    {user.role?.replace('_', ' ').toUpperCase()}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Profile Details */}
                    <div className="p-4 space-y-3 border-b border-slate-100">
                        <div className="flex items-center gap-3 text-sm">
                            <Mail className="w-4 h-4 text-slate-400" />
                            <span className="text-slate-600">{user.email}</span>
                        </div>
                        {user.phone && (
                            <div className="flex items-center gap-3 text-sm">
                                <Phone className="w-4 h-4 text-slate-400" />
                                <span className="text-slate-600">{user.phone}</span>
                            </div>
                        )}
                        {user.admissionNumber && (
                            <div className="flex items-center gap-3 text-sm">
                                <Shield className="w-4 h-4 text-slate-400" />
                                <span className="text-slate-600">ID: {user.admissionNumber}</span>
                            </div>
                        )}
                        {user.employeeId && (
                            <div className="flex items-center gap-3 text-sm">
                                <Building className="w-4 h-4 text-slate-400" />
                                <span className="text-slate-600">Emp ID: {user.employeeId}</span>
                            </div>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="p-2">
                        <Link
                            href="/settings"
                            onClick={() => setIsOpen(false)}
                            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-700 hover:bg-slate-100 transition"
                        >
                            <User className="w-4 h-4" />
                            <span className="font-medium">View Profile</span>
                        </Link>
                        <Link
                            href="/settings?tab=security"
                            onClick={() => setIsOpen(false)}
                            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-700 hover:bg-slate-100 transition"
                        >
                            <Settings className="w-4 h-4" />
                            <span className="font-medium">Settings</span>
                        </Link>
                        <button
                            onClick={handleLogout}
                            className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-red-600 hover:bg-red-50 transition"
                        >
                            <LogOut className="w-4 h-4" />
                            <span className="font-medium">Logout</span>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
