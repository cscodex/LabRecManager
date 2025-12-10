'use client';

import { useEffect, useState } from 'react';
import { Database, Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { dashboardAPI } from '@/lib/api';

export default function DatabaseStatus({ className = '' }) {
    const [status, setStatus] = useState({ server: 'checking', database: 'checking' });
    const [isChecking, setIsChecking] = useState(true);
    const [lastCheck, setLastCheck] = useState(null);

    const checkHealth = async () => {
        setIsChecking(true);
        try {
            const res = await dashboardAPI.getHealth();
            setStatus(res.data.data);
            setLastCheck(new Date());
        } catch (error) {
            setStatus({
                server: error.response ? 'online' : 'offline',
                database: 'offline',
                error: error.message
            });
            setLastCheck(new Date());
        } finally {
            setIsChecking(false);
        }
    };

    useEffect(() => {
        checkHealth();
        // Check health every 30 seconds
        const interval = setInterval(checkHealth, 30000);
        return () => clearInterval(interval);
    }, []);

    const isOnline = status.server === 'online' && status.database === 'online';
    const isPartial = status.server === 'online' && status.database === 'offline';

    return (
        <div className={`flex items-center gap-2 ${className}`}>
            <button
                onClick={checkHealth}
                disabled={isChecking}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition hover:bg-slate-100 dark:hover:bg-slate-800"
                title={`Last checked: ${lastCheck?.toLocaleTimeString() || 'Never'}`}
            >
                {isChecking ? (
                    <RefreshCw className="w-4 h-4 animate-spin text-blue-500" />
                ) : isOnline ? (
                    <Wifi className="w-4 h-4 text-emerald-500" />
                ) : isPartial ? (
                    <Database className="w-4 h-4 text-amber-500" />
                ) : (
                    <WifiOff className="w-4 h-4 text-red-500" />
                )}

                <span className={`font-medium ${isOnline ? 'text-emerald-600' :
                        isPartial ? 'text-amber-600' :
                            'text-red-600'
                    }`}>
                    {isChecking ? 'Checking...' :
                        isOnline ? 'Online' :
                            isPartial ? 'DB Offline' :
                                'Offline'}
                </span>

                {status.responseTime && !isChecking && (
                    <span className="text-xs text-slate-400">
                        {status.responseTime}ms
                    </span>
                )}
            </button>
        </div>
    );
}

// Compact version for headers
export function DatabaseStatusBadge() {
    const [status, setStatus] = useState({ server: 'checking', database: 'checking' });
    const [isChecking, setIsChecking] = useState(true);

    const checkHealth = async () => {
        setIsChecking(true);
        try {
            const res = await dashboardAPI.getHealth();
            setStatus(res.data.data);
        } catch (error) {
            setStatus({
                server: error.response ? 'online' : 'offline',
                database: 'offline'
            });
        } finally {
            setIsChecking(false);
        }
    };

    useEffect(() => {
        checkHealth();
        const interval = setInterval(checkHealth, 30000);
        return () => clearInterval(interval);
    }, []);

    const isOnline = status.server === 'online' && status.database === 'online';
    const isPartial = status.server === 'online' && status.database === 'offline';

    return (
        <div
            className={`w-2.5 h-2.5 rounded-full ${isChecking ? 'bg-blue-400 animate-pulse' :
                    isOnline ? 'bg-emerald-500' :
                        isPartial ? 'bg-amber-500 animate-pulse' :
                            'bg-red-500 animate-pulse'
                }`}
            title={`Server: ${status.server}, Database: ${status.database}`}
        />
    );
}
