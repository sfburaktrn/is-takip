'use client';

import { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import AuthGuard from '@/components/AuthGuard';
import OzunluLoading from '@/components/OzunluLoading';
import { API_URL, apiFetch } from '@/lib/api';
import { FileText, ClipboardList, Calendar, User, Clock } from 'lucide-react';

interface LoginLog {
    id: number;
    loginAt: string;
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
            const res = await apiFetch(`${API_URL}/login-logs?limit=200`, { credentials: 'include' });
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
            year: 'numeric',
        });
    };

    const formatTime = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleTimeString('tr-TR', {
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const groupedLogs = logs.reduce(
        (acc, log) => {
            const date = formatDate(log.loginAt);
            if (!acc[date]) acc[date] = [];
            acc[date].push(log);
            return acc;
        },
        {} as Record<string, LoginLog[]>,
    );

    return (
        <AuthGuard requireAdmin>
            <Sidebar />
            <main className="main-content apple-app-page analytics-page">
                <div className="apple-canvas">
                    <header className="header header--stack apple-page-hero">
                        <h1 className="header-title">
                            <FileText size={28} className="page-title-leading-icon shrink-0" />
                            Giriş logları
                        </h1>
                        <p className="header-subtitle">
                            Sisteme yapılan son girişler; güvenlik ve denetim için salt okunur kayıtlar.
                        </p>
                    </header>

                    <section className="apple-login-logs-panel">
                        <div className="apple-login-logs-toolbar">
                            <h2 className="apple-login-logs-title">
                                <ClipboardList size={20} aria-hidden />
                                Son girişler
                            </h2>
                            <span className="apple-login-logs-count">Toplam: {logs.length} kayıt</span>
                        </div>

                        {loading ? (
                            <OzunluLoading variant="compact" />
                        ) : logs.length === 0 ? (
                            <div className="apple-empty-state">Henüz giriş kaydı yok.</div>
                        ) : (
                            <div>
                                {Object.entries(groupedLogs).map(([date, dateLogs]) => (
                                    <div key={date} className="apple-login-log-date-group">
                                        <div className="apple-login-log-date-chip">
                                            <Calendar size={16} aria-hidden />
                                            {date}
                                        </div>
                                        <div className="apple-login-log-list">
                                            {dateLogs.map(log => (
                                                <div key={log.id} className="apple-login-log-row">
                                                    <div className="apple-login-log-avatar" aria-hidden>
                                                        <User size={20} />
                                                    </div>
                                                    <div className="apple-login-log-body">
                                                        <div className="apple-login-log-name">{log.user.fullName}</div>
                                                        <div className="apple-login-log-user">@{log.user.username}</div>
                                                    </div>
                                                    <div className="apple-login-log-time">
                                                        <Clock size={14} aria-hidden />
                                                        {formatTime(log.loginAt)}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>
                </div>
            </main>
        </AuthGuard>
    );
}
