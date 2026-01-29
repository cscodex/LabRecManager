'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/lib/store';
import {
    ChevronLeft, Settings, Globe, Bell, Shield, Database,
    Save, Eye, EyeOff, RefreshCw, Trash2, AlertTriangle, Activity, Server
} from 'lucide-react';
import toast from 'react-hot-toast';
import ActivityLogViewer from './activity/ActivityLogViewer';
import BackupSettings from './backups/BackupSettings';

interface AppSettings {
    siteName: string;
    defaultLanguage: 'en' | 'pa';
    allowStudentRegistration: boolean;
    examWarningMinutes: number;
    autoSubmitOnTabSwitch: boolean;
    showResultsImmediately: boolean;
    requirePhotoForExam: boolean;
    maxLoginAttempts: number;
}

export default function AdminSettingsPage() {
    const router = useRouter();
    const { user, isAuthenticated, _hasHydrated } = useAuthStore();
    const [activeTab, setActiveTab] = useState<'general'>('general');

    const [settings, setSettings] = useState<AppSettings>({
        siteName: 'Merit Entrance',
        defaultLanguage: 'en',
        allowStudentRegistration: false,
        examWarningMinutes: 5,
        autoSubmitOnTabSwitch: true,
        showResultsImmediately: true,
        requirePhotoForExam: false,
        maxLoginAttempts: 5,
    });

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showDangerZone, setShowDangerZone] = useState(false);

    useEffect(() => {
        if (!_hasHydrated) return;
        if (!isAuthenticated || !['admin', 'superadmin'].includes(user?.role || '')) {
            router.push('/');
            return;
        }
        loadSettings();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [_hasHydrated, isAuthenticated, user, router]);

    const loadSettings = async () => {
        try {
            // In a real app, this would fetch from API
            // For now, using default values
            setLoading(false);
        } catch (error) {
            toast.error('Failed to load settings');
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            // In a real app, this would save to API
            await new Promise(resolve => setTimeout(resolve, 500));
            toast.success('Settings saved successfully!');
        } catch (error) {
            toast.error('Failed to save settings');
        } finally {
            setSaving(false);
        }
    };

    const handleClearCache = async () => {
        toast.success('Cache cleared successfully!');
    };

    if (!_hasHydrated || loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    const isSuperAdmin = user?.role === 'superadmin';

    const TabButton = ({ id, label, icon: Icon }: { id: typeof activeTab, label: string, icon: any }) => (
        <button
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
        >
            <Icon className="w-4 h-4" />
            {label}
        </button>
    );

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white shadow-sm sticky top-0 z-10">
                <div className="max-w-4xl mx-auto px-4 py-4">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-4">
                            <Link href="/admin/dashboard" className="text-gray-500 hover:text-gray-700">
                                <ChevronLeft className="w-5 h-5" />
                            </Link>
                            <div>
                                <h1 className="text-xl font-bold text-gray-900">Settings</h1>
                                <p className="text-sm text-gray-500">System configuration and monitoring</p>
                            </div>
                        </div>
                        {activeTab === 'general' && (
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                            >
                                <Save className="w-4 h-4" />
                                {saving ? 'Saving...' : 'Save Changes'}
                            </button>
                        )}
                    </div>

                    {/* Tabs */}
                    <div className="flex gap-2">
                        <TabButton id="general" label="General" icon={Settings} />
                    </div>
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-4 py-6">

                {/* GENERAL SETTINGS TAB */}
                {activeTab === 'general' && (
                    <div className="space-y-6">
                        {/* General Settings */}
                        <div className="bg-white rounded-xl shadow-sm">
                            <div className="p-4 border-b flex items-center gap-2">
                                <Globe className="w-5 h-5 text-gray-600" />
                                <h2 className="font-semibold text-gray-900">Global Configuration</h2>
                            </div>
                            <div className="p-4 space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Site Name
                                        </label>
                                        <input
                                            type="text"
                                            value={settings.siteName}
                                            onChange={(e) => setSettings({ ...settings, siteName: e.target.value })}
                                            className="w-full px-3 py-2 border rounded-lg"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Default Language
                                        </label>
                                        <select
                                            value={settings.defaultLanguage}
                                            onChange={(e) => setSettings({ ...settings, defaultLanguage: e.target.value as 'en' | 'pa' })}
                                            className="w-full px-3 py-2 border rounded-lg"
                                        >
                                            <option value="en">English</option>
                                            <option value="pa">ਪੰਜਾਬੀ (Punjabi)</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Exam Settings */}
                        <div className="bg-white rounded-xl shadow-sm">
                            <div className="p-4 border-b flex items-center gap-2">
                                <Bell className="w-5 h-5 text-gray-600" />
                                <h2 className="font-semibold text-gray-900">Exam Policies</h2>
                            </div>
                            <div className="p-4 space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Warning Before Time Expires (minutes)
                                    </label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="30"
                                        value={settings.examWarningMinutes}
                                        onChange={(e) => setSettings({ ...settings, examWarningMinutes: parseInt(e.target.value) || 5 })}
                                        className="w-full px-3 py-2 border rounded-lg w-full md:w-32"
                                    />
                                </div>

                                <div className="space-y-3 pt-2">
                                    <div className="flex items-center justify-between py-2 border-b border-dashed">
                                        <div>
                                            <p className="font-medium text-gray-900">Auto-submit on Tab Switch</p>
                                            <p className="text-sm text-gray-500">Automatically submit exam if student leaves the browser tab</p>
                                        </div>
                                        <button
                                            onClick={() => setSettings({ ...settings, autoSubmitOnTabSwitch: !settings.autoSubmitOnTabSwitch })}
                                            className={`relative w-12 h-6 rounded-full transition ${settings.autoSubmitOnTabSwitch ? 'bg-blue-600' : 'bg-gray-300'}`}
                                        >
                                            <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition ${settings.autoSubmitOnTabSwitch ? 'translate-x-6' : ''}`} />
                                        </button>
                                    </div>

                                    <div className="flex items-center justify-between py-2 border-b border-dashed">
                                        <div>
                                            <p className="font-medium text-gray-900">Show Results Immediately</p>
                                            <p className="text-sm text-gray-500">Show results/score to students right after submission</p>
                                        </div>
                                        <button
                                            onClick={() => setSettings({ ...settings, showResultsImmediately: !settings.showResultsImmediately })}
                                            className={`relative w-12 h-6 rounded-full transition ${settings.showResultsImmediately ? 'bg-blue-600' : 'bg-gray-300'}`}
                                        >
                                            <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition ${settings.showResultsImmediately ? 'translate-x-6' : ''}`} />
                                        </button>
                                    </div>

                                    <div className="flex items-center justify-between py-2">
                                        <div>
                                            <p className="font-medium text-gray-900">Require Photo for Exam</p>
                                            <p className="text-sm text-gray-500">Capture webcam photo before starting exam</p>
                                        </div>
                                        <button
                                            onClick={() => setSettings({ ...settings, requirePhotoForExam: !settings.requirePhotoForExam })}
                                            className={`relative w-12 h-6 rounded-full transition ${settings.requirePhotoForExam ? 'bg-blue-600' : 'bg-gray-300'}`}
                                        >
                                            <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition ${settings.requirePhotoForExam ? 'translate-x-6' : ''}`} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Security Settings */}
                        <div className="bg-white rounded-xl shadow-sm">
                            <div className="p-4 border-b flex items-center gap-2">
                                <Shield className="w-5 h-5 text-gray-600" />
                                <h2 className="font-semibold text-gray-900">Access & Security</h2>
                            </div>
                            <div className="p-4 space-y-4">
                                <div className="flex items-center justify-between py-2">
                                    <div>
                                        <p className="font-medium text-gray-900">Allow Student Self-Registration</p>
                                        <p className="text-sm text-gray-500">Public signup enabled</p>
                                    </div>
                                    <button
                                        onClick={() => setSettings({ ...settings, allowStudentRegistration: !settings.allowStudentRegistration })}
                                        className={`relative w-12 h-6 rounded-full transition ${settings.allowStudentRegistration ? 'bg-blue-600' : 'bg-gray-300'}`}
                                    >
                                        <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition ${settings.allowStudentRegistration ? 'translate-x-6' : ''}`} />
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* System Maintenance */}
                        <div className="bg-white rounded-xl shadow-sm">
                            <div className="p-4 border-b flex items-center gap-2">
                                <Database className="w-5 h-5 text-gray-600" />
                                <h2 className="font-semibold text-gray-900">Maintenance</h2>
                            </div>
                            <div className="p-4 space-y-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="font-medium text-gray-900">System Cache</p>
                                        <p className="text-sm text-gray-500">Clear ephemeral data and cached queries</p>
                                    </div>
                                    <button
                                        onClick={handleClearCache}
                                        className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium"
                                    >
                                        <RefreshCw className="w-4 h-4" />
                                        Clear Cache
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
