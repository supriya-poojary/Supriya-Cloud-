import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Activity, XCircle } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export default function HealthCheck() {
    const [status, setStatus] = useState('checking'); // checking, online, offline

    useEffect(() => {
        const checkHealth = async () => {
            try {
                await axios.get(`${API_URL}/health`, { timeout: 2000 });
                setStatus('online');
            } catch (error) {
                setStatus('offline');
            }
        };

        // Check initially
        checkHealth();

        // Poll every 10 seconds
        const interval = setInterval(checkHealth, 10000);
        return () => clearInterval(interval);
    }, []);

    if (status === 'checking') return null;

    return (
        <div className={`fixed bottom-4 left-4 z-50 flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium backdrop-blur-md border shadow-lg transition-colors ${status === 'online'
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                : 'bg-red-500/10 border-red-500/20 text-red-400'
            }`}>
            {status === 'online' ? (
                <Activity className="w-3 h-3 animate-pulse" />
            ) : (
                <XCircle className="w-3 h-3" />
            )}
            <span>Backend: {status === 'online' ? 'Online' : 'Offline'}</span>
        </div>
    );
}
