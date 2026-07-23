'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAuth } from '@/lib/AuthContext';

export default function LoginPage() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { login, user, isWarehouse } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (user) {
            router.push(isWarehouse ? '/stok-takip' : '/urun-listesi');
        }
    }, [user, isWarehouse, router]);

    if (user) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsSubmitting(true);

        const result = await login(username, password);

        if (result.success) {
            // yönlendirme user state / isWarehouse ile useEffect'te yapılır
        } else {
            setError(result.error || 'Giriş başarısız. Lütfen bilgilerinizi kontrol edin.');
        }

        setIsSubmitting(false);
    };

    return (
        <div className="apple-login-page">
            <div className="apple-login-card">
                <div className="apple-login-brand">
                    <div className="apple-login-logo-wrap">
                        <Image
                            src="/logo.png"
                            alt="ÖZÜNLÜ Logo"
                            width={180}
                            height={72}
                            className="apple-login-logo-img"
                            priority
                        />
                    </div>
                    <h1 className="apple-login-title">Hoş Geldiniz</h1>
                    <p className="apple-login-subtitle">İmalat Takip Sistemi&apos;ne giriş yapın</p>
                </div>

                {error && (
                    <div className="apple-login-alert">
                        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                        </svg>
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div className="apple-login-field">
                        <label className="apple-login-label" htmlFor="login-username">
                            Kullanıcı Adı
                        </label>
                        <input
                            id="login-username"
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="Kullanıcı adınızı girin"
                            required
                            className="input input--login"
                        />
                    </div>

                    <div className="apple-login-field apple-login-field--password">
                        <div className="apple-login-label-row">
                            <label className="apple-login-label apple-login-label--inline" htmlFor="login-password">
                                Şifre
                            </label>
                        </div>
                        <input
                            id="login-password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            required
                            className="input input--login"
                        />
                    </div>

                    <button type="submit" disabled={isSubmitting} className="apple-login-submit">
                        {isSubmitting ? (
                            <span className="apple-login-submit-inner">
                                <svg
                                    className="animate-spin apple-login-spinner"
                                    xmlns="http://www.w3.org/2000/svg"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                >
                                    <circle
                                        className="opacity-25"
                                        cx="12"
                                        cy="12"
                                        r="10"
                                        stroke="currentColor"
                                        strokeWidth="4"
                                    />
                                    <path
                                        className="opacity-75"
                                        fill="currentColor"
                                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                    />
                                </svg>
                                Giriş Yapılıyor...
                            </span>
                        ) : (
                            'Giriş Yap'
                        )}
                    </button>
                </form>
            </div>

            <div className="apple-login-footer">
                &copy; {new Date().getFullYear()} Özünlü Damper. Tüm hakları saklıdır.
            </div>
        </div>
    );
}
