'use client';

import { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import AuthGuard from '@/components/AuthGuard';
import { API_URL } from '@/lib/api';

interface LoginLog {
    id: number;
    loginAt: string;
    ipAddress: string | null;
    user: {
        username: string;
        fullName: string;
    };
}

export default function GirisLoglariPage() {
    const [logs, setLogs] = useState<LoginLog[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchLogs();
    }, []);

    const fetchLogs = async () => {
        try {
            const res = await fetch(`${API_URL}/login-logs?limit=200`, { credentials: 'include' });
            if (res.ok) {
                const data = await res.json();
                setLogs(data);
            }
        } catch (err) {
            console.error('Failed to fetch logs:', err);
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('tr-TR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    };

    const formatTime = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleTimeString('tr-TR', {
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    // Group logs by date
    const groupedLogs = logs.reduce((acc, log) => {
        const date = formatDate(log.loginAt);
        if (!acc[date]) acc[date] = [];
        acc[date].push(log);
        return acc;
    }, {} as Record<string, LoginLog[]>);

    return (
        <AuthGuard requireAdmin>
            <div className="app-container">
                <Sidebar />
                <main className="main-content">
                    <div className="page-header">
                        <h1 className="page-title">📝 Giriş Logları</h1>
                        <p style={{ color: 'var(--muted)' }}>Kullanıcı giriş kayıtları</p>
                    </div>

                    <div className="card" style={{ padding: '24px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <h2 style={{ margin: 0, fontSize: '18px' }}>📋 Son Girişler</h2>
                            <span style={{ color: 'var(--muted)', fontSize: '14px' }}>
                                Toplam: {logs.length} kayıt
                            </span>
                        </div>

                        {loading ? (
                            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--muted)' }}>
                                ⏳ Yükleniyor...
                            </div>
                        ) : logs.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--muted)' }}>
                                Henüz giriş kaydı yok
                            </div>
                        ) : (
                            <div>
                                {Object.entries(groupedLogs).map(([date, dateLogs]) => (
                                    <div key={date} style={{ marginBottom: '24px' }}>
                                        <div style={{
                                            padding: '8px 16px',
                                            background: 'rgba(59, 130, 246, 0.1)',
                                            borderRadius: '8px',
                                            marginBottom: '12px',
                                            fontSize: '14px',
                                            fontWeight: 600,
                                            color: '#60a5fa'
                                        }}>
                                            📅 {date}
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            {dateLogs.map(log => (
                                                <div
                                                    key={log.id}
                                                    style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '16px',
                                                        padding: '12px 16px',
                                                        background: 'var(--bg-secondary)',
                                                        borderRadius: '10px',
                                                        border: '1px solid var(--border)'
                                                    }}
                                                >
                                                    <div style={{
                                                        width: '40px',
                                                        height: '40px',
                                                        borderRadius: '10px',
                                                        background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        fontSize: '18px',
                                                        flexShrink: 0
                                                    }}>
                                                        👤
                                                    </div>
                                                    <div style={{ flex: 1 }}>
                                                        <div style={{ fontWeight: 600, fontSize: '14px' }}>
                                                            {log.user.fullName}
                                                        </div>
                                                        <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
                                                            @{log.user.username}
                                                        </div>
                                                    </div>
                                                    <div style={{ textAlign: 'right' }}>
                                                        <div style={{ fontWeight: 600, fontSize: '14px', color: '#86efac' }}>
                                                            🕐 {formatTime(log.loginAt)}
                                                        </div>
                                                        {log.ipAddress && (
                                                            <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
                                                                IP: {log.ipAddress}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </main>
            </div>
        </AuthGuard>
    );
}
