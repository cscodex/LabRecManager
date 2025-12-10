'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
    Settings as SettingsIcon, User, Bell, Shield, Palette, Save,
    GraduationCap, Plus, Trash2, RotateCcw, Calendar, Filter, Clock,
    Video, Mic, MicOff, VideoOff, CheckCircle, XCircle, AlertTriangle,
    Volume2, Play, Square
} from 'lucide-react';
import { useAuthStore, useThemeStore, useLanguageStore } from '@/lib/store';
import { authAPI, gradeScalesAPI, devicesAPI } from '@/lib/api';
import toast from 'react-hot-toast';
import PageHeader from '@/components/PageHeader';
import ConfirmDialog from '@/components/ConfirmDialog';

export default function SettingsPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user, isAuthenticated, _hasHydrated } = useAuthStore();
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'profile');
    const [saving, setSaving] = useState(false);

    const [profile, setProfile] = useState({ firstName: '', lastName: '', email: '', phone: '' });
    const [notifications, setNotifications] = useState({ emailNotif: true, submissionAlerts: true, gradeAlerts: true, vivaReminders: true });
    const { theme, setTheme } = useThemeStore();
    const { language, setLanguage } = useLanguageStore();
    const [passwords, setPasswords] = useState({ current: '', newPass: '', confirm: '' });

    // Grade scales state
    const [gradeScales, setGradeScales] = useState([]);
    const [loadingGrades, setLoadingGrades] = useState(false);
    const [editingGrade, setEditingGrade] = useState(null);
    const [newGrade, setNewGrade] = useState({ gradeLetter: '', gradePoint: '', minPercentage: '', maxPercentage: '', description: '' });
    const [showResetConfirm, setShowResetConfirm] = useState(false);

    // Grade scale filters
    const [gradeFilter, setGradeFilter] = useState('all'); // all, active, inactive
    const [dateFilter, setDateFilter] = useState(''); // empty = all dates
    const [sortOrder, setSortOrder] = useState('newest'); // newest, oldest, grade

    // Device testing state
    const [cameraPermission, setCameraPermission] = useState('unknown'); // unknown, granted, denied, testing
    const [micPermission, setMicPermission] = useState('unknown');
    const [speakerPermission, setSpeakerPermission] = useState('unknown');
    const [testStream, setTestStream] = useState(null);
    const [availableCameras, setAvailableCameras] = useState([]);
    const [availableMics, setAvailableMics] = useState([]);
    const [availableSpeakers, setAvailableSpeakers] = useState([]);
    const [selectedCamera, setSelectedCamera] = useState('');
    const [selectedMic, setSelectedMic] = useState('');
    const [selectedSpeaker, setSelectedSpeaker] = useState('');
    const [micLevel, setMicLevel] = useState(0);
    const [speakerVolume, setSpeakerVolume] = useState(80);
    const [isPlayingTestSound, setIsPlayingTestSound] = useState(false);
    const [lastCameraCheck, setLastCameraCheck] = useState(null);
    const [lastMicCheck, setLastMicCheck] = useState(null);
    const [lastSpeakerCheck, setLastSpeakerCheck] = useState(null);
    const [audioContextRef, setAudioContextRef] = useState(null);
    const [analyserRef, setAnalyserRef] = useState(null);
    const [animationFrameRef, setAnimationFrameRef] = useState(null);

    // Video element ref to prevent flickering
    const videoRef = useRef(null);

    const isAdmin = user?.role === 'admin' || user?.role === 'principal';

    useEffect(() => {
        if (!_hasHydrated) return;
        if (!isAuthenticated) { router.push('/login'); return; }
        if (user) {
            setProfile({ firstName: user.firstName || '', lastName: user.lastName || '', email: user.email || '', phone: user.phone || '' });
        }
        setLoading(false);
    }, [isAuthenticated, user, _hasHydrated]);

    useEffect(() => {
        if (activeTab === 'grading' && isAdmin) {
            loadGradeScales();
        }
    }, [activeTab, isAdmin]);

    // Load device test status from database
    useEffect(() => {
        if (activeTab === 'devices' && isAuthenticated) {
            loadDeviceTestStatus();
        }
    }, [activeTab, isAuthenticated]);

    const loadDeviceTestStatus = async () => {
        try {
            const res = await devicesAPI.getTestStatus();
            const deviceTest = res.data.data.deviceTest;
            if (deviceTest) {
                if (deviceTest.cameraStatus) {
                    setCameraPermission(deviceTest.cameraStatus);
                    setLastCameraCheck(deviceTest.cameraTestedAt ? new Date(deviceTest.cameraTestedAt) : null);
                }
                if (deviceTest.micStatus) {
                    setMicPermission(deviceTest.micStatus);
                    setLastMicCheck(deviceTest.micTestedAt ? new Date(deviceTest.micTestedAt) : null);
                }
                if (deviceTest.speakerStatus) {
                    setSpeakerPermission(deviceTest.speakerStatus);
                    setLastSpeakerCheck(deviceTest.speakerTestedAt ? new Date(deviceTest.speakerTestedAt) : null);
                    if (deviceTest.speakerVolume) setSpeakerVolume(deviceTest.speakerVolume);
                }
            }
        } catch (error) {
            console.error('Failed to load device test status:', error);
        }
    };

    // Cleanup camera/mic stream when leaving devices tab or component
    useEffect(() => {
        return () => {
            if (testStream) {
                testStream.getTracks().forEach(track => track.stop());
            }
        };
    }, [testStream]);

    // Stop stream when switching away from devices tab
    useEffect(() => {
        if (activeTab !== 'devices' && testStream) {
            testStream.getTracks().forEach(track => track.stop());
            setTestStream(null);
            setCameraPermission('unknown');
            setMicPermission('unknown');
            setMicLevel(0);
        }
    }, [activeTab]);

    // Set video srcObject only when stream changes (prevents flickering)
    useEffect(() => {
        if (videoRef.current && testStream) {
            videoRef.current.srcObject = testStream;
            videoRef.current.play().catch(e => console.log('Video play error:', e));
        }
    }, [testStream]);

    const loadGradeScales = async () => {
        setLoadingGrades(true);
        try {
            const res = await gradeScalesAPI.getAllIncludingInactive();
            setGradeScales(res.data.data.gradeScales || []);
        } catch (error) {
            console.error('Error loading grade scales:', error);
        } finally {
            setLoadingGrades(false);
        }
    };

    // Get unique creation dates for filter dropdown
    const uniqueDates = useMemo(() => {
        const dates = [...new Set(gradeScales.map(g => new Date(g.createdAt).toLocaleDateString()))];
        return dates.sort((a, b) => new Date(b) - new Date(a));
    }, [gradeScales]);

    // Filter and sort grade scales
    const filteredGradeScales = useMemo(() => {
        let filtered = [...gradeScales];

        // Apply status filter
        if (gradeFilter === 'active') {
            filtered = filtered.filter(g => g.isActive);
        } else if (gradeFilter === 'inactive') {
            filtered = filtered.filter(g => !g.isActive);
        }

        // Apply date filter
        if (dateFilter) {
            filtered = filtered.filter(g => new Date(g.createdAt).toLocaleDateString() === dateFilter);
        }

        // Apply sorting
        if (sortOrder === 'newest') {
            filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        } else if (sortOrder === 'oldest') {
            filtered.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        } else if (sortOrder === 'grade') {
            filtered.sort((a, b) => parseFloat(b.gradePoint) - parseFloat(a.gradePoint));
        }

        return filtered;
    }, [gradeScales, gradeFilter, dateFilter, sortOrder]);

    const handleSaveProfile = async () => {
        setSaving(true);
        try {
            const res = await authAPI.updateProfile({
                firstName: profile.firstName,
                lastName: profile.lastName,
                phone: profile.phone
            });

            // Update local user state
            const updatedUser = res.data.data.user;
            useAuthStore.getState().setAuth(
                { ...user, ...updatedUser },
                useAuthStore.getState().accessToken,
                useAuthStore.getState().refreshToken
            );

            toast.success('Profile updated successfully!');
        } catch (e) {
            toast.error(e.response?.data?.message || 'Failed to update profile');
        }
        finally { setSaving(false); }
    };

    const handleChangePassword = async () => {
        if (passwords.newPass !== passwords.confirm) { toast.error('Passwords do not match'); return; }
        if (passwords.newPass.length < 6) { toast.error('Password must be at least 6 characters'); return; }
        setSaving(true);
        try {
            await authAPI.changePassword({ currentPassword: passwords.current, newPassword: passwords.newPass });
            toast.success('Password changed successfully!');
            setPasswords({ current: '', newPass: '', confirm: '' });
        } catch (e) { toast.error(e.response?.data?.message || 'Failed to change password'); }
        finally { setSaving(false); }
    };

    const handleSaveGradeScale = async () => {
        if (!newGrade.gradeLetter || !newGrade.gradePoint || !newGrade.minPercentage || !newGrade.maxPercentage) {
            toast.error('Please fill all required fields');
            return;
        }
        setSaving(true);
        try {
            await gradeScalesAPI.create({
                gradeLetter: newGrade.gradeLetter,
                gradePoint: parseFloat(newGrade.gradePoint),
                minPercentage: parseInt(newGrade.minPercentage),
                maxPercentage: parseInt(newGrade.maxPercentage),
                description: newGrade.description
            });
            toast.success('Grade scale saved');
            setNewGrade({ gradeLetter: '', gradePoint: '', minPercentage: '', maxPercentage: '', description: '' });
            loadGradeScales();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to save grade scale');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteGradeScale = async (id) => {
        try {
            await gradeScalesAPI.delete(id);
            toast.success('Grade scale removed');
            loadGradeScales();
        } catch (error) {
            toast.error('Failed to delete grade scale');
        }
    };

    const handleResetGradeScales = async () => {
        try {
            await gradeScalesAPI.reset();
            toast.success('Grade scales reset to default');
            loadGradeScales();
            setShowResetConfirm(false);
        } catch (error) {
            toast.error('Failed to reset grade scales');
        }
    };

    const tabs = [
        { id: 'profile', icon: User, label: 'Profile' },
        { id: 'devices', icon: Video, label: 'Devices' },
        { id: 'notifications', icon: Bell, label: 'Notifications' },
        { id: 'appearance', icon: Palette, label: 'Appearance' },
        { id: 'security', icon: Shield, label: 'Security' },
        ...(isAdmin ? [{ id: 'grading', icon: GraduationCap, label: 'Grading' }] : [])
    ];

    if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full"></div></div>;

    return (
        <div className="min-h-screen bg-slate-50">
            <PageHeader title="Settings" showNotifications={false} />
            <main className="max-w-5xl mx-auto px-4 py-6">
                <div className="grid md:grid-cols-4 gap-6">
                    {/* Sidebar */}
                    <div className="md:col-span-1">
                        <div className="card p-2 space-y-1">
                            {tabs.map((tab) => (
                                <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition ${activeTab === tab.id ? 'bg-primary-50 text-primary-700' : 'text-slate-600 hover:bg-slate-50'}`}>
                                    <tab.icon className="w-5 h-5" />{tab.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Content */}
                    <div className="md:col-span-3">
                        {activeTab === 'profile' && (
                            <div className="card p-6">
                                <h2 className="text-lg font-semibold text-slate-900 mb-4">Profile Information</h2>
                                <div className="grid md:grid-cols-2 gap-4">
                                    <div><label className="label">First Name</label><input type="text" className="input" value={profile.firstName} onChange={(e) => setProfile({ ...profile, firstName: e.target.value })} /></div>
                                    <div><label className="label">Last Name</label><input type="text" className="input" value={profile.lastName} onChange={(e) => setProfile({ ...profile, lastName: e.target.value })} /></div>
                                    <div><label className="label">Email</label><input type="email" className="input" value={profile.email} disabled /></div>
                                    <div><label className="label">Phone</label><input type="tel" className="input" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} /></div>
                                </div>
                                <div className="mt-4"><button onClick={handleSaveProfile} disabled={saving} className="btn btn-primary"><Save className="w-4 h-4" />{saving ? 'Saving...' : 'Save Changes'}</button></div>
                            </div>
                        )}

                        {activeTab === 'devices' && (
                            <div className="space-y-6">
                                {/* Instructions Banner */}
                                <div className="card p-4 bg-gradient-to-r from-blue-500 to-indigo-600 text-white">
                                    <div className="flex items-start gap-3">
                                        <Video className="w-6 h-6 mt-0.5" />
                                        <div>
                                            <h3 className="font-semibold">Camera, Microphone & Speaker Setup</h3>
                                            <p className="text-sm mt-1 text-white/80">
                                                Test your devices here before joining a viva session.
                                                This ensures everything is working properly.
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Permission Status Cards */}
                                <div className="card p-6">
                                    <h2 className="text-lg font-semibold text-slate-900 mb-4">Device Status</h2>
                                    <div className="grid md:grid-cols-3 gap-4">
                                        {/* Camera Status */}
                                        <div className={`p-4 rounded-xl border-2 ${cameraPermission === 'granted' ? 'border-emerald-500 bg-emerald-50' : cameraPermission === 'denied' ? 'border-red-500 bg-red-50' : 'border-slate-200'}`}>
                                            <div className="flex items-center gap-3">
                                                {cameraPermission === 'granted' ? <CheckCircle className="w-8 h-8 text-emerald-500" /> :
                                                    cameraPermission === 'denied' ? <XCircle className="w-8 h-8 text-red-500" /> :
                                                        <Video className="w-8 h-8 text-slate-400" />}
                                                <div className="flex-1">
                                                    <p className="font-medium">Camera</p>
                                                    <p className={`text-sm ${cameraPermission === 'granted' ? 'text-emerald-600' : cameraPermission === 'denied' ? 'text-red-600' : 'text-slate-500'}`}>
                                                        {cameraPermission === 'granted' ? '✓ Working' : cameraPermission === 'denied' ? '✗ Blocked' : 'Not tested'}
                                                    </p>
                                                    {lastCameraCheck && (
                                                        <p className="text-xs text-slate-400 mt-1">
                                                            Last: {lastCameraCheck.toLocaleTimeString()}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Mic Status */}
                                        <div className={`p-4 rounded-xl border-2 ${micPermission === 'granted' ? 'border-emerald-500 bg-emerald-50' : micPermission === 'denied' ? 'border-red-500 bg-red-50' : 'border-slate-200'}`}>
                                            <div className="flex items-center gap-3">
                                                {micPermission === 'granted' ? <CheckCircle className="w-8 h-8 text-emerald-500" /> :
                                                    micPermission === 'denied' ? <XCircle className="w-8 h-8 text-red-500" /> :
                                                        <Mic className="w-8 h-8 text-slate-400" />}
                                                <div className="flex-1">
                                                    <p className="font-medium">Microphone</p>
                                                    <p className={`text-sm ${micPermission === 'granted' ? 'text-emerald-600' : micPermission === 'denied' ? 'text-red-600' : 'text-slate-500'}`}>
                                                        {micPermission === 'granted' ? '✓ Working' : micPermission === 'denied' ? '✗ Blocked' : 'Not tested'}
                                                    </p>
                                                    {lastMicCheck && (
                                                        <p className="text-xs text-slate-400 mt-1">
                                                            Last: {lastMicCheck.toLocaleTimeString()}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Speaker Status */}
                                        <div className={`p-4 rounded-xl border-2 ${speakerPermission === 'granted' ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200'}`}>
                                            <div className="flex items-center gap-3">
                                                {speakerPermission === 'granted' ? <CheckCircle className="w-8 h-8 text-emerald-500" /> :
                                                    <Volume2 className="w-8 h-8 text-slate-400" />}
                                                <div className="flex-1">
                                                    <p className="font-medium">Speakers</p>
                                                    <p className={`text-sm ${speakerPermission === 'granted' ? 'text-emerald-600' : 'text-slate-500'}`}>
                                                        {speakerPermission === 'granted' ? '✓ Tested' : 'Not tested'}
                                                    </p>
                                                    {lastSpeakerCheck && (
                                                        <p className="text-xs text-slate-400 mt-1">
                                                            Last: {lastSpeakerCheck.toLocaleTimeString()}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-6 flex flex-wrap gap-3">
                                        <button
                                            onClick={async () => {
                                                try {
                                                    setCameraPermission('testing');
                                                    setMicPermission('testing');

                                                    // Stop existing stream
                                                    if (testStream) {
                                                        testStream.getTracks().forEach(t => t.stop());
                                                    }
                                                    if (animationFrameRef) {
                                                        cancelAnimationFrame(animationFrameRef);
                                                    }
                                                    if (audioContextRef) {
                                                        audioContextRef.close();
                                                    }

                                                    // Request permissions with specific constraints
                                                    const stream = await navigator.mediaDevices.getUserMedia({
                                                        video: { width: { ideal: 640 }, height: { ideal: 480 } },
                                                        audio: { echoCancellation: true, noiseSuppression: true }
                                                    });

                                                    // Get available devices
                                                    const devices = await navigator.mediaDevices.enumerateDevices();
                                                    setAvailableCameras(devices.filter(d => d.kind === 'videoinput'));
                                                    setAvailableMics(devices.filter(d => d.kind === 'audioinput'));
                                                    setAvailableSpeakers(devices.filter(d => d.kind === 'audiooutput'));

                                                    setTestStream(stream);
                                                    setCameraPermission('granted');
                                                    setMicPermission('granted');
                                                    setLastCameraCheck(new Date());
                                                    setLastMicCheck(new Date());
                                                    toast.success('Camera and microphone access granted!');

                                                    // Save test results to database
                                                    const selectedCam = devices.find(d => d.kind === 'videoinput');
                                                    const selectedMicDevice = devices.find(d => d.kind === 'audioinput');
                                                    try {
                                                        await devicesAPI.testAll({
                                                            cameraStatus: 'granted',
                                                            cameraDeviceId: selectedCam?.deviceId,
                                                            cameraDeviceName: selectedCam?.label,
                                                            micStatus: 'granted',
                                                            micDeviceId: selectedMicDevice?.deviceId,
                                                            micDeviceName: selectedMicDevice?.label
                                                        });
                                                    } catch (e) {
                                                        console.error('Failed to save device test:', e);
                                                    }

                                                    // Setup audio analysis for mic level
                                                    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                                                    const analyser = audioCtx.createAnalyser();
                                                    const source = audioCtx.createMediaStreamSource(stream);
                                                    source.connect(analyser);
                                                    analyser.fftSize = 512;
                                                    analyser.smoothingTimeConstant = 0.8;

                                                    setAudioContextRef(audioCtx);
                                                    setAnalyserRef(analyser);

                                                    const dataArray = new Uint8Array(analyser.frequencyBinCount);

                                                    const updateLevel = () => {
                                                        if (!stream.active) return;
                                                        analyser.getByteFrequencyData(dataArray);
                                                        // Get average of lower frequencies (voice range)
                                                        const voiceRange = dataArray.slice(0, 64);
                                                        const sum = voiceRange.reduce((a, b) => a + b, 0);
                                                        const avg = sum / voiceRange.length;
                                                        // Scale to 0-100
                                                        const level = Math.min(100, Math.round(avg * 0.8));
                                                        setMicLevel(level);
                                                        const frameId = requestAnimationFrame(updateLevel);
                                                        setAnimationFrameRef(frameId);
                                                    };
                                                    updateLevel();

                                                } catch (error) {
                                                    console.error('Permission error:', error);
                                                    setCameraPermission('denied');
                                                    setMicPermission('denied');
                                                    setLastCameraCheck(new Date());
                                                    setLastMicCheck(new Date());

                                                    // Check if the issue is due to insecure context (HTTP on mobile)
                                                    const isSecure = window.isSecureContext;
                                                    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

                                                    if (!isSecure && !isLocalhost) {
                                                        toast.error(
                                                            '🔒 HTTPS Required: Mobile browsers require a secure connection (HTTPS) to access camera/microphone. See troubleshooting below.',
                                                            { duration: 8000 }
                                                        );
                                                    } else if (error.name === 'NotAllowedError') {
                                                        toast.error('Permission denied. Please allow camera/mic in browser settings.');
                                                    } else if (error.name === 'NotFoundError') {
                                                        toast.error('No camera or microphone found.');
                                                    } else if (error.name === 'NotReadableError') {
                                                        toast.error('Camera/mic is in use by another app. Please close other apps and try again.');
                                                    } else {
                                                        toast.error('Failed to access devices: ' + error.message);
                                                    }
                                                }
                                            }}
                                            disabled={cameraPermission === 'testing'}
                                            className="btn btn-primary"
                                        >
                                            {cameraPermission === 'testing' ? (
                                                <>
                                                    <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                                                    Testing...
                                                </>
                                            ) : (
                                                <>
                                                    <Video className="w-4 h-4" />
                                                    Test Camera & Microphone
                                                </>
                                            )}
                                        </button>

                                        {testStream && (
                                            <button
                                                onClick={() => {
                                                    testStream.getTracks().forEach(track => track.stop());
                                                    setTestStream(null);
                                                    if (animationFrameRef) cancelAnimationFrame(animationFrameRef);
                                                    if (audioContextRef) audioContextRef.close();
                                                    setMicLevel(0);
                                                }}
                                                className="btn btn-secondary"
                                            >
                                                <Square className="w-4 h-4" />
                                                Stop Test
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Camera Preview */}
                                {testStream && (
                                    <div className="card p-6">
                                        <h2 className="text-lg font-semibold text-slate-900 mb-4">📹 Camera Preview</h2>
                                        <div className="relative bg-slate-900 rounded-xl overflow-hidden" style={{ maxWidth: '640px' }}>
                                            <video
                                                autoPlay
                                                muted
                                                playsInline
                                                ref={videoRef}
                                                className="w-full"
                                                style={{ transform: 'scaleX(-1)', minHeight: '300px' }}
                                            />
                                            <div className="absolute bottom-3 left-3 px-3 py-1 bg-black/50 rounded-full text-white text-sm flex items-center gap-2">
                                                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                                                Live Preview
                                            </div>
                                        </div>

                                        {availableCameras.length > 1 && (
                                            <div className="mt-4 max-w-md">
                                                <label className="label">Select Camera</label>
                                                <select className="input" value={selectedCamera} onChange={(e) => setSelectedCamera(e.target.value)}>
                                                    {availableCameras.map((cam, i) => (
                                                        <option key={cam.deviceId} value={cam.deviceId}>
                                                            {cam.label || `Camera ${i + 1}`}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Microphone Level */}
                                {testStream && (
                                    <div className="card p-6">
                                        <h2 className="text-lg font-semibold text-slate-900 mb-4">🎤 Microphone Level</h2>
                                        <div className="bg-slate-100 rounded-xl p-6">
                                            <div className="flex items-center gap-4 mb-4">
                                                <Mic className={`w-8 h-8 ${micLevel > 20 ? 'text-emerald-500' : 'text-slate-400'}`} />
                                                <div className="flex-1">
                                                    <div className="h-8 bg-slate-200 rounded-full overflow-hidden relative">
                                                        <div
                                                            className={`h-full transition-all duration-75 ${micLevel > 70 ? 'bg-gradient-to-r from-emerald-500 via-yellow-500 to-red-500' :
                                                                micLevel > 30 ? 'bg-gradient-to-r from-emerald-500 to-yellow-500' :
                                                                    'bg-emerald-500'
                                                                }`}
                                                            style={{ width: `${micLevel}%` }}
                                                        />
                                                        {/* Level markers */}
                                                        <div className="absolute inset-0 flex justify-between px-2 items-center pointer-events-none">
                                                            {[0, 25, 50, 75, 100].map(mark => (
                                                                <div key={mark} className="w-px h-4 bg-slate-400/50" />
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                                <span className="text-lg font-bold font-mono w-16 text-right">
                                                    {micLevel}%
                                                </span>
                                            </div>
                                            <p className={`text-center text-lg ${micLevel > 10 ? 'text-emerald-600' : 'text-slate-500'}`}>
                                                {micLevel > 50 ? '🎉 Great! Your microphone is working perfectly!' :
                                                    micLevel > 10 ? '✅ Microphone detected. Speak louder for better quality.' :
                                                        '🔇 Speak into your microphone to test...'}
                                            </p>
                                        </div>

                                        {availableMics.length > 1 && (
                                            <div className="mt-4 max-w-md">
                                                <label className="label">Select Microphone</label>
                                                <select className="input" value={selectedMic} onChange={(e) => setSelectedMic(e.target.value)}>
                                                    {availableMics.map((mic, i) => (
                                                        <option key={mic.deviceId} value={mic.deviceId}>
                                                            {mic.label || `Microphone ${i + 1}`}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Speaker Test */}
                                <div className="card p-6">
                                    <h2 className="text-lg font-semibold text-slate-900 mb-4">🔊 Speaker Test</h2>
                                    <div className="bg-slate-100 rounded-xl p-6">
                                        <div className="flex flex-col md:flex-row items-center gap-6">
                                            <div className="flex-1 w-full">
                                                <label className="label mb-2">Speaker Volume</label>
                                                <div className="flex items-center gap-4">
                                                    <Volume2 className="w-6 h-6 text-slate-500" />
                                                    <input
                                                        type="range"
                                                        min="0"
                                                        max="100"
                                                        value={speakerVolume}
                                                        onChange={(e) => setSpeakerVolume(parseInt(e.target.value))}
                                                        className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-primary-500"
                                                    />
                                                    <span className="text-sm font-mono w-12 text-right">{speakerVolume}%</span>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => {
                                                    setIsPlayingTestSound(true);
                                                    // Create audio context and play a test tone
                                                    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                                                    const gainNode = audioContext.createGain();
                                                    gainNode.gain.value = speakerVolume / 100;
                                                    gainNode.connect(audioContext.destination);

                                                    // Play a pleasant beep sequence
                                                    const frequencies = [440, 554, 659, 880]; // A4, C#5, E5, A5
                                                    frequencies.forEach((freq, i) => {
                                                        const oscillator = audioContext.createOscillator();
                                                        oscillator.type = 'sine';
                                                        oscillator.frequency.setValueAtTime(freq, audioContext.currentTime + i * 0.2);
                                                        oscillator.connect(gainNode);
                                                        oscillator.start(audioContext.currentTime + i * 0.2);
                                                        oscillator.stop(audioContext.currentTime + i * 0.2 + 0.15);
                                                    });

                                                    setTimeout(async () => {
                                                        setSpeakerPermission('granted');
                                                        setLastSpeakerCheck(new Date());
                                                        setIsPlayingTestSound(false);
                                                        toast.success('Speaker test complete! Did you hear the sound?');

                                                        // Save speaker test to database
                                                        try {
                                                            await devicesAPI.testSpeaker({
                                                                status: 'granted',
                                                                volume: speakerVolume
                                                            });
                                                        } catch (e) {
                                                            console.error('Failed to save speaker test:', e);
                                                        }
                                                    }, 1000);
                                                }}
                                                disabled={isPlayingTestSound}
                                                className="btn btn-primary whitespace-nowrap"
                                            >
                                                {isPlayingTestSound ? (
                                                    <>
                                                        <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                                                        Playing...
                                                    </>
                                                ) : (
                                                    <>
                                                        <Play className="w-4 h-4" />
                                                        Play Test Sound
                                                    </>
                                                )}
                                            </button>
                                        </div>

                                        {availableSpeakers.length > 1 && (
                                            <div className="mt-4 max-w-md">
                                                <label className="label">Select Speaker</label>
                                                <select className="input" value={selectedSpeaker} onChange={(e) => setSelectedSpeaker(e.target.value)}>
                                                    {availableSpeakers.map((spk, i) => (
                                                        <option key={spk.deviceId} value={spk.deviceId}>
                                                            {spk.label || `Speaker ${i + 1}`}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Troubleshooting Guide */}
                                <div className="card p-6">
                                    <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
                                        <AlertTriangle className="w-5 h-5 text-amber-500" />
                                        Troubleshooting
                                    </h2>
                                    <div className="space-y-4 text-sm text-slate-600 dark:text-slate-400">
                                        {/* HTTPS Warning - Show if not secure context */}
                                        {typeof window !== 'undefined' && !window.isSecureContext && (
                                            <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border-2 border-red-300 dark:border-red-800">
                                                <p className="font-bold text-red-800 dark:text-red-400 flex items-center gap-2">
                                                    🔒 HTTPS Required for Mobile
                                                </p>
                                                <p className="mt-2 text-red-700 dark:text-red-300">
                                                    Mobile browsers require a <strong>secure connection (HTTPS)</strong> to access camera and microphone.
                                                </p>
                                                <div className="mt-3 p-3 bg-white dark:bg-slate-800 rounded border text-slate-700 dark:text-slate-300">
                                                    <p className="font-medium">To fix this on Chrome Mobile:</p>
                                                    <ol className="mt-2 space-y-1 list-decimal list-inside text-xs">
                                                        <li>Open Chrome and go to <code className="bg-slate-100 dark:bg-slate-700 px-1 rounded">chrome://flags</code></li>
                                                        <li>Search for "<strong>Insecure origins treated as secure</strong>"</li>
                                                        <li>Add: <code className="bg-slate-100 dark:bg-slate-700 px-1 rounded">{typeof window !== 'undefined' ? window.location.origin : 'http://your-ip:3000'}</code></li>
                                                        <li>Enable the flag and <strong>Relaunch Chrome</strong></li>
                                                    </ol>
                                                </div>
                                            </div>
                                        )}

                                        <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                                            <p className="font-medium text-slate-800 dark:text-slate-200">Camera/Mic not working?</p>
                                            <ul className="mt-2 space-y-1 list-disc list-inside">
                                                <li>Make sure no other app is using your camera</li>
                                                <li>Check if browser has camera/mic permissions enabled</li>
                                                <li>On mobile: Go to browser settings → Site settings → Allow camera/mic</li>
                                                <li>Try refreshing the page after granting permissions</li>
                                            </ul>
                                        </div>
                                        <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                                            <p className="font-medium text-amber-800 dark:text-amber-400">📱 Mobile Users:</p>
                                            <p className="mt-1">
                                                On iOS Safari: Settings → Safari → Camera/Microphone → Allow<br />
                                                On Android Chrome: Tap the lock icon in address bar → Permissions
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'notifications' && (
                            <div className="card p-6">
                                <h2 className="text-lg font-semibold text-slate-900 mb-4">Notification Preferences</h2>
                                {Object.entries({ emailNotif: 'Email Notifications', submissionAlerts: 'Submission Alerts', gradeAlerts: 'Grade Updates', vivaReminders: 'Viva Reminders' }).map(([key, label]) => (
                                    <div key={key} className="flex items-center justify-between py-3 border-b last:border-0">
                                        <span>{label}</span>
                                        <label className="relative inline-flex cursor-pointer"><input type="checkbox" className="sr-only peer" checked={notifications[key]} onChange={(e) => setNotifications({ ...notifications, [key]: e.target.checked })} /><div className="w-11 h-6 bg-slate-200 peer-checked:bg-primary-500 rounded-full peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div></label>
                                    </div>
                                ))}
                            </div>
                        )}

                        {activeTab === 'appearance' && (
                            <div className="card p-6">
                                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Appearance</h2>
                                <div className="space-y-6">
                                    <div>
                                        <label className="label">Theme</label>
                                        <div className="grid grid-cols-3 gap-3">
                                            {[
                                                { value: 'light', label: '☀️ Light', desc: 'Light background' },
                                                { value: 'dark', label: '🌙 Dark', desc: 'Dark background' },
                                                { value: 'system', label: '💻 System', desc: 'Match device' }
                                            ].map(opt => (
                                                <button
                                                    key={opt.value}
                                                    type="button"
                                                    onClick={() => setTheme(opt.value)}
                                                    className={`p-4 rounded-xl border-2 text-center transition-all ${theme === opt.value
                                                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30'
                                                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                                                        }`}
                                                >
                                                    <span className="text-2xl block mb-1">{opt.label.split(' ')[0]}</span>
                                                    <span className="font-medium text-slate-900 dark:text-slate-100 block">{opt.label.split(' ')[1]}</span>
                                                    <span className="text-xs text-slate-500 dark:text-slate-400">{opt.desc}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="label">Language</label>
                                        <select
                                            className="input"
                                            value={language}
                                            onChange={(e) => setLanguage(e.target.value)}
                                        >
                                            <option value="en">English</option>
                                            <option value="hi">Hindi (हिंदी)</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'security' && (
                            <div className="card p-6">
                                <h2 className="text-lg font-semibold text-slate-900 mb-4">Change Password</h2>
                                <div className="space-y-4 max-w-md">
                                    <div><label className="label">Current Password</label><input type="password" className="input" value={passwords.current} onChange={(e) => setPasswords({ ...passwords, current: e.target.value })} /></div>
                                    <div><label className="label">New Password</label><input type="password" className="input" value={passwords.newPass} onChange={(e) => setPasswords({ ...passwords, newPass: e.target.value })} /></div>
                                    <div><label className="label">Confirm Password</label><input type="password" className="input" value={passwords.confirm} onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })} /></div>
                                    <button onClick={handleChangePassword} disabled={saving} className="btn btn-primary"><Shield className="w-4 h-4" />{saving ? 'Updating...' : 'Update Password'}</button>
                                </div>
                            </div>
                        )}

                        {activeTab === 'grading' && isAdmin && (
                            <div className="space-y-6">
                                <div className="card p-6">
                                    <div className="flex items-center justify-between mb-4">
                                        <h2 className="text-lg font-semibold text-slate-900">Grade Scale Configuration</h2>
                                        <button
                                            onClick={() => setShowResetConfirm(true)}
                                            className="btn btn-secondary text-sm"
                                        >
                                            <RotateCcw className="w-4 h-4" />
                                            Reset to Default
                                        </button>
                                    </div>
                                    <p className="text-sm text-slate-500 mb-4">
                                        Configure the grading scale used for evaluating student submissions.
                                    </p>

                                    {/* Filters Section */}
                                    <div className="bg-gradient-to-r from-primary-50 to-blue-50 rounded-xl p-4 mb-6 border border-primary-100">
                                        <div className="flex items-center gap-2 mb-3">
                                            <Filter className="w-5 h-5 text-primary-600" />
                                            <h3 className="font-medium text-slate-900">Filter Grade Schemes</h3>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                            <div>
                                                <label className="text-xs text-slate-500 block mb-1">Status</label>
                                                <select
                                                    className="input text-sm"
                                                    value={gradeFilter}
                                                    onChange={(e) => setGradeFilter(e.target.value)}
                                                >
                                                    <option value="all">All Grades</option>
                                                    <option value="active">Active Only</option>
                                                    <option value="inactive">Inactive/Previous</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="text-xs text-slate-500 block mb-1">Created Date</label>
                                                <select
                                                    className="input text-sm"
                                                    value={dateFilter}
                                                    onChange={(e) => setDateFilter(e.target.value)}
                                                >
                                                    <option value="">All Dates</option>
                                                    {uniqueDates.map(date => (
                                                        <option key={date} value={date}>{date}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="text-xs text-slate-500 block mb-1">Sort By</label>
                                                <select
                                                    className="input text-sm"
                                                    value={sortOrder}
                                                    onChange={(e) => setSortOrder(e.target.value)}
                                                >
                                                    <option value="newest">Newest First</option>
                                                    <option value="oldest">Oldest First</option>
                                                    <option value="grade">Grade Points (High to Low)</option>
                                                </select>
                                            </div>
                                        </div>
                                        <p className="text-xs text-slate-500 mt-2">
                                            Showing {filteredGradeScales.length} of {gradeScales.length} grade schemes
                                        </p>
                                    </div>

                                    {/* Add new grade */}
                                    <div className="bg-slate-50 rounded-xl p-4 mb-6">
                                        <h3 className="font-medium text-slate-900 mb-3">Add New Grade</h3>
                                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                                            <input
                                                type="text"
                                                placeholder="Grade (A1)"
                                                className="input text-sm"
                                                value={newGrade.gradeLetter}
                                                onChange={(e) => setNewGrade({ ...newGrade, gradeLetter: e.target.value })}
                                            />
                                            <input
                                                type="number"
                                                placeholder="Points (10)"
                                                className="input text-sm"
                                                step="0.1"
                                                min="0"
                                                max="10"
                                                value={newGrade.gradePoint}
                                                onChange={(e) => setNewGrade({ ...newGrade, gradePoint: e.target.value })}
                                            />
                                            <input
                                                type="number"
                                                placeholder="Min %"
                                                className="input text-sm"
                                                min="0"
                                                max="100"
                                                value={newGrade.minPercentage}
                                                onChange={(e) => setNewGrade({ ...newGrade, minPercentage: e.target.value })}
                                            />
                                            <input
                                                type="number"
                                                placeholder="Max %"
                                                className="input text-sm"
                                                min="0"
                                                max="100"
                                                value={newGrade.maxPercentage}
                                                onChange={(e) => setNewGrade({ ...newGrade, maxPercentage: e.target.value })}
                                            />
                                            <button onClick={handleSaveGradeScale} disabled={saving} className="btn btn-primary text-sm">
                                                <Plus className="w-4 h-4" />
                                                Add
                                            </button>
                                        </div>
                                        <input
                                            type="text"
                                            placeholder="Description (Optional)"
                                            className="input text-sm mt-2"
                                            value={newGrade.description}
                                            onChange={(e) => setNewGrade({ ...newGrade, description: e.target.value })}
                                        />
                                    </div>

                                    {/* Grade scales table */}
                                    {loadingGrades ? (
                                        <div className="flex items-center justify-center py-8">
                                            <div className="animate-spin w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full"></div>
                                        </div>
                                    ) : filteredGradeScales.length === 0 ? (
                                        <div className="text-center py-8 text-slate-500">
                                            <GraduationCap className="w-12 h-12 mx-auto mb-2 opacity-50" />
                                            <p>No grade scales found with current filters</p>
                                            <p className="text-sm">Try adjusting the filters or click "Reset to Default" to add CBSE grade scales</p>
                                        </div>
                                    ) : (
                                        <div className="overflow-x-auto">
                                            <table className="w-full">
                                                <thead>
                                                    <tr className="border-b border-slate-200 bg-slate-50">
                                                        <th className="text-left py-3 px-4 font-medium text-slate-600">Grade</th>
                                                        <th className="text-left py-3 px-4 font-medium text-slate-600">Points</th>
                                                        <th className="text-left py-3 px-4 font-medium text-slate-600">Range</th>
                                                        <th className="text-left py-3 px-4 font-medium text-slate-600">Description</th>
                                                        <th className="text-left py-3 px-4 font-medium text-slate-600">Status</th>
                                                        <th className="text-left py-3 px-4 font-medium text-slate-600">
                                                            <span className="flex items-center gap-1">
                                                                <Clock className="w-4 h-4" />
                                                                Created
                                                            </span>
                                                        </th>
                                                        <th className="text-right py-3 px-4 font-medium text-slate-600">Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {filteredGradeScales.map((scale) => (
                                                        <tr key={scale.id} className={`border-b border-slate-100 hover:bg-slate-50 transition ${!scale.isActive ? 'bg-slate-50/50' : ''}`}>
                                                            <td className="py-3 px-4">
                                                                <span className={`font-bold text-lg ${scale.isActive ? 'text-primary-600' : 'text-slate-400'}`}>
                                                                    {scale.gradeLetter}
                                                                </span>
                                                            </td>
                                                            <td className="py-3 px-4 text-slate-700">{scale.gradePoint}</td>
                                                            <td className="py-3 px-4 text-slate-700">{scale.minPercentage}% - {scale.maxPercentage}%</td>
                                                            <td className="py-3 px-4 text-slate-500">{scale.description || '-'}</td>
                                                            <td className="py-3 px-4">
                                                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${scale.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                                                                    {scale.isActive ? 'Active' : 'Inactive'}
                                                                </span>
                                                            </td>
                                                            <td className="py-3 px-4">
                                                                <div className="text-xs">
                                                                    <div className="text-slate-700 font-medium">
                                                                        {new Date(scale.createdAt).toLocaleDateString()}
                                                                    </div>
                                                                    <div className="text-slate-400">
                                                                        {new Date(scale.createdAt).toLocaleTimeString()}
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td className="py-3 px-4 text-right">
                                                                <button
                                                                    onClick={() => handleDeleteGradeScale(scale.id)}
                                                                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition"
                                                                    title="Delete/Deactivate"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </main>

            {/* Reset Confirm Dialog */}
            <ConfirmDialog
                isOpen={showResetConfirm}
                onClose={() => setShowResetConfirm(false)}
                onConfirm={handleResetGradeScales}
                title="Reset Grade Scales"
                message="This will reset all grade scales to the default CBSE pattern. Any custom grades will be deactivated. Continue?"
                type="warning"
                confirmText="Reset to Default"
            />
        </div>
    );
}
