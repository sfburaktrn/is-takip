'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAuth } from '@/lib/AuthContext';

const COLORS = {
    primary: '#022347',
    secondary: '#F8FAFC',
    text: '#1E293B',
    muted: '#64748B',
    border: '#E2E8F0',
    inputBg: '#FFFFFF',
    focusRing: 'rgba(2, 35, 71, 0.2)',
    errorBg: '#FEF2F2',
    errorText: '#DC2626',
    errorBorder: '#FEE2E2',
};

export default function LoginPage() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { login, user } = useAuth();
    const router = useRouter();

    // Redirect if already logged in
    useEffect(() => {
        if (user) {
            router.push('/');
        }
    }, [user, router]);

    if (user) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsSubmitting(true);

        // Simulate a small delay for better UX (optional, but feels more premium)
        // await new Promise(resolve => setTimeout(resolve, 500));

        const result = await login(username, password);

        if (result.success) {
            router.push('/');
        } else {
            setError(result.error || 'Giriş başarısız. Lütfen bilgilerinizi kontrol edin.');
        }

        setIsSubmitting(false);
    };

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#F1F5F9', // Light gray background
            backgroundImage: 'radial-gradient(circle at top right, #E2E8F0 0%, #F1F5F9 100%)',
            padding: '20px',
            fontFamily: 'var(--font-inter, sans-serif)'
        }}>
            <div style={{
                width: '100%',
                maxWidth: '420px',
                background: 'white',
                borderRadius: '24px',
                padding: '48px 40px',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.5)'
            }}>
                {/* Logo/Title */}
                <div style={{ textAlign: 'center', marginBottom: '40px' }}>
                    <div style={{
                        width: '180px',
                        height: 'auto',
                        margin: '0 auto 24px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}>
                        <Image
                            src="/logo.png"
                            alt="ÖZÜNLÜ Logo"
                            width={180}
                            height={72}
                            style={{
                                width: '100%',
                                height: 'auto',
                                objectFit: 'contain'
                            }}
                            priority
                        />
                    </div>
                    <h1 style={{
                        fontSize: '24px',
                        fontWeight: 700,
                        color: COLORS.primary,
                        margin: '0 0 8px 0',
                        letterSpacing: '-0.025em'
                    }}>
                        Hoş Geldiniz
                    </h1>
                    <p style={{
                        color: COLORS.muted,
                        fontSize: '14px',
                        fontWeight: 400,
                        margin: 0
                    }}>
                        İmalat Takip Sistemi'ne giriş yapın
                    </p>
                </div>

                {/* Error Message */}
                {error && (
                    <div style={{
                        background: COLORS.errorBg,
                        border: `1px solid ${COLORS.errorBorder}`,
                        borderRadius: '12px',
                        padding: '14px',
                        marginBottom: '24px',
                        color: COLORS.errorText,
                        fontSize: '14px',
                        textAlign: 'center',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px'
                    }}>
                        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {error}
                    </div>
                )}

                {/* Login Form */}
                <form onSubmit={handleSubmit}>
                    <div style={{ marginBottom: '20px' }}>
                        <label style={{
                            display: 'block',
                            color: COLORS.text,
                            fontSize: '14px',
                            marginBottom: '8px',
                            fontWeight: 600
                        }}>
                            Kullanıcı Adı
                        </label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="Kullanıcı adınızı girin"
                            required
                            style={{
                                width: '100%',
                                padding: '14px 16px',
                                background: COLORS.inputBg,
                                border: `1px solid ${COLORS.border}`,
                                borderRadius: '12px',
                                color: COLORS.text,
                                fontSize: '15px',
                                outline: 'none',
                                transition: 'all 0.2s ease',
                                boxSizing: 'border-box'
                            }}
                            onFocus={(e) => {
                                e.target.style.borderColor = COLORS.primary;
                                e.target.style.boxShadow = `0 0 0 4px ${COLORS.focusRing}`;
                            }}
                            onBlur={(e) => {
                                e.target.style.borderColor = COLORS.border;
                                e.target.style.boxShadow = 'none';
                            }}
                        />
                    </div>

                    <div style={{ marginBottom: '32px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <label style={{
                                display: 'block',
                                color: COLORS.text,
                                fontSize: '14px',
                                fontWeight: 600
                            }}>
                                Şifre
                            </label>
                        </div>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            required
                            style={{
                                width: '100%',
                                padding: '14px 16px',
                                background: COLORS.inputBg,
                                border: `1px solid ${COLORS.border}`,
                                borderRadius: '12px',
                                color: COLORS.text,
                                fontSize: '15px',
                                outline: 'none',
                                transition: 'all 0.2s ease',
                                boxSizing: 'border-box'
                            }}
                            onFocus={(e) => {
                                e.target.style.borderColor = COLORS.primary;
                                e.target.style.boxShadow = `0 0 0 4px ${COLORS.focusRing}`;
                            }}
                            onBlur={(e) => {
                                e.target.style.borderColor = COLORS.border;
                                e.target.style.boxShadow = 'none';
                            }}
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={isSubmitting}
                        style={{
                            width: '100%',
                            padding: '16px',
                            background: COLORS.primary,
                            border: 'none',
                            borderRadius: '12px',
                            color: 'white',
                            fontSize: '16px',
                            fontWeight: 600,
                            cursor: isSubmitting ? 'not-allowed' : 'pointer',
                            transition: 'all 0.2s',
                            opacity: isSubmitting ? 0.8 : 1,
                            boxShadow: isSubmitting ? 'none' : '0 4px 6px -1px rgba(2, 35, 71, 0.2), 0 2px 4px -1px rgba(2, 35, 71, 0.1)'
                        }}
                        onMouseEnter={(e) => {
                            if (!isSubmitting) {
                                e.currentTarget.style.transform = 'translateY(-1px)';
                                e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(2, 35, 71, 0.2), 0 4px 6px -2px rgba(2, 35, 71, 0.1)';
                            }
                        }}
                        onMouseLeave={(e) => {
                            if (!isSubmitting) {
                                e.currentTarget.style.transform = 'none';
                                e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(2, 35, 71, 0.2), 0 2px 4px -1px rgba(2, 35, 71, 0.1)';
                            }
                        }}
                    >
                        {isSubmitting ? (
                            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                <svg className="animate-spin" style={{ width: '20px', height: '20px', animation: 'spin 1s linear infinite' }} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Giriş Yapılıyor...
                            </span>
                        ) : 'Giriş Yap'}
                    </button>

                    {/* Add keyframes for spinner */}
                    <style jsx>{`
                        @keyframes spin {
                            from { transform: rotate(0deg); }
                            to { transform: rotate(360deg); }
                        }
                    `}</style>
                </form>
            </div>

            {/* Footer Copyright */}
            <div style={{
                position: 'absolute',
                bottom: '24px',
                color: COLORS.muted,
                fontSize: '12px',
                textAlign: 'center'
            }}>
                &copy; {new Date().getFullYear()} Özünlü Damper. Tüm hakları saklıdır.
            </div>
        </div>
    );
}
