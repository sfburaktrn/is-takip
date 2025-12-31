'use client';

import { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import AuthGuard from '@/components/AuthGuard';
import { API_URL } from '@/lib/api';

interface User {
    id: number;
    username: string;
    fullName: string;
    isAdmin: boolean;
    createdAt: string;
}

export default function AyarlarPage() {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [formData, setFormData] = useState({ username: '', password: '', fullName: '', isAdmin: false });
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            const res = await fetch(`${API_URL}/users`, { credentials: 'include' });
            if (res.ok) {
                const data = await res.json();
                setUsers(data);
            }
        } catch (err) {
            console.error('Failed to fetch users:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleAddUser = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        try {
            const res = await fetch(`${API_URL}/users`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(formData)
            });
            const data = await res.json();
            if (res.ok) {
                setUsers([data, ...users]);
                setShowAddModal(false);
                setFormData({ username: '', password: '', fullName: '', isAdmin: false });
                setSuccess('Kullanıcı başarıyla eklendi');
                setTimeout(() => setSuccess(''), 3000);
            } else {
                setError(data.error || 'Hata oluştu');
            }
        } catch (err) {
            setError('Bağlantı hatası');
        }
    };

    const handleUpdateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedUser) return;
        setError('');
        try {
            const updateData: Record<string, unknown> = {};
            if (formData.fullName) updateData.fullName = formData.fullName;
            if (formData.password) updateData.password = formData.password;
            updateData.isAdmin = formData.isAdmin;

            const res = await fetch(`${API_URL}/users/${selectedUser.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(updateData)
            });
            const data = await res.json();
            if (res.ok) {
                setUsers(users.map(u => u.id === selectedUser.id ? data : u));
                setShowEditModal(false);
                setSelectedUser(null);
                setFormData({ username: '', password: '', fullName: '', isAdmin: false });
                setSuccess('Kullanıcı güncellendi');
                setTimeout(() => setSuccess(''), 3000);
            } else {
                setError(data.error || 'Hata oluştu');
            }
        } catch (err) {
            setError('Bağlantı hatası');
        }
    };

    const handleDeleteUser = async (userId: number) => {
        if (!confirm('Bu kullanıcıyı silmek istediğinize emin misiniz?')) return;
        try {
            const res = await fetch(`${API_URL}/users/${userId}`, {
                method: 'DELETE',
                credentials: 'include'
            });
            if (res.ok) {
                setUsers(users.filter(u => u.id !== userId));
                setSuccess('Kullanıcı silindi');
                setTimeout(() => setSuccess(''), 3000);
            } else {
                const data = await res.json();
                setError(data.error || 'Silme işlemi başarısız');
            }
        } catch (err) {
            setError('Bağlantı hatası');
        }
    };

    const openEditModal = (user: User) => {
        setSelectedUser(user);
        setFormData({ username: user.username, password: '', fullName: user.fullName, isAdmin: user.isAdmin });
        setShowEditModal(true);
    };

    return (
        <AuthGuard requireAdmin>
            <div className="app-container">
                <Sidebar />
                <main className="main-content">
                    <div className="page-header">
                        <h1 className="page-title">⚙️ Ayarlar</h1>
                        <p style={{ color: 'var(--muted)' }}>Kullanıcı yönetimi ve sistem ayarları</p>
                    </div>

                    {success && (
                        <div style={{ background: 'rgba(34, 197, 94, 0.2)', border: '1px solid rgba(34, 197, 94, 0.3)', borderRadius: '12px', padding: '12px 16px', marginBottom: '24px', color: '#86efac' }}>
                            ✅ {success}
                        </div>
                    )}
                    {error && (
                        <div style={{ background: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '12px', padding: '12px 16px', marginBottom: '24px', color: '#fca5a5' }}>
                            ⚠️ {error}
                        </div>
                    )}

                    {/* Users Section */}
                    <div className="card" style={{ padding: '24px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <h2 style={{ margin: 0, fontSize: '18px' }}>👥 Kullanıcılar</h2>
                            <button
                                onClick={() => { setShowAddModal(true); setFormData({ username: '', password: '', fullName: '', isAdmin: false }); setError(''); }}
                                style={{ padding: '10px 20px', background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)', border: 'none', borderRadius: '10px', color: '#fff', fontWeight: 600, cursor: 'pointer' }}
                            >
                                ➕ Yeni Kullanıcı
                            </button>
                        </div>

                        {loading ? (
                            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--muted)' }}>Yükleniyor...</div>
                        ) : (
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                            <th style={{ padding: '12px', textAlign: 'left', color: 'var(--muted)', fontWeight: 500 }}>Kullanıcı Adı</th>
                                            <th style={{ padding: '12px', textAlign: 'left', color: 'var(--muted)', fontWeight: 500 }}>İsim</th>
                                            <th style={{ padding: '12px', textAlign: 'center', color: 'var(--muted)', fontWeight: 500 }}>Rol</th>
                                            <th style={{ padding: '12px', textAlign: 'right', color: 'var(--muted)', fontWeight: 500 }}>İşlemler</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {users.map(user => (
                                            <tr key={user.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                                <td style={{ padding: '16px 12px', fontWeight: 500 }}>{user.username}</td>
                                                <td style={{ padding: '16px 12px' }}>{user.fullName}</td>
                                                <td style={{ padding: '16px 12px', textAlign: 'center' }}>
                                                    <span style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 600, background: user.isAdmin ? 'rgba(245, 158, 11, 0.2)' : 'rgba(59, 130, 246, 0.2)', color: user.isAdmin ? '#fbbf24' : '#60a5fa' }}>
                                                        {user.isAdmin ? '👑 Admin' : '👤 Kullanıcı'}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '16px 12px', textAlign: 'right' }}>
                                                    <button onClick={() => openEditModal(user)} style={{ padding: '8px 12px', background: 'rgba(59, 130, 246, 0.2)', border: 'none', borderRadius: '8px', color: '#60a5fa', cursor: 'pointer', marginRight: '8px' }}>✏️</button>
                                                    <button onClick={() => handleDeleteUser(user.id)} style={{ padding: '8px 12px', background: 'rgba(239, 68, 68, 0.2)', border: 'none', borderRadius: '8px', color: '#fca5a5', cursor: 'pointer' }}>🗑️</button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* Add User Modal */}
                    {showAddModal && (
                        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                            <div style={{ background: 'var(--card-bg)', borderRadius: '20px', padding: '32px', width: '100%', maxWidth: '400px', border: '1px solid var(--border)' }}>
                                <h3 style={{ margin: '0 0 24px', fontSize: '20px' }}>➕ Yeni Kullanıcı Ekle</h3>
                                <form onSubmit={handleAddUser}>
                                    <div style={{ marginBottom: '16px' }}>
                                        <label style={{ display: 'block', marginBottom: '8px', color: 'var(--muted)', fontSize: '14px' }}>Kullanıcı Adı</label>
                                        <input type="text" value={formData.username} onChange={e => setFormData({ ...formData, username: e.target.value })} required style={{ width: '100%', padding: '12px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '10px', color: '#fff', fontSize: '14px', boxSizing: 'border-box' }} />
                                    </div>
                                    <div style={{ marginBottom: '16px' }}>
                                        <label style={{ display: 'block', marginBottom: '8px', color: 'var(--muted)', fontSize: '14px' }}>İsim Soyisim</label>
                                        <input type="text" value={formData.fullName} onChange={e => setFormData({ ...formData, fullName: e.target.value })} required style={{ width: '100%', padding: '12px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '10px', color: '#fff', fontSize: '14px', boxSizing: 'border-box' }} />
                                    </div>
                                    <div style={{ marginBottom: '16px' }}>
                                        <label style={{ display: 'block', marginBottom: '8px', color: 'var(--muted)', fontSize: '14px' }}>Şifre</label>
                                        <input type="password" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} required style={{ width: '100%', padding: '12px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '10px', color: '#fff', fontSize: '14px', boxSizing: 'border-box' }} />
                                    </div>
                                    <div style={{ marginBottom: '24px' }}>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                            <input type="checkbox" checked={formData.isAdmin} onChange={e => setFormData({ ...formData, isAdmin: e.target.checked })} />
                                            <span>Admin yetkisi ver</span>
                                        </label>
                                    </div>
                                    {error && <div style={{ color: '#fca5a5', marginBottom: '16px', fontSize: '14px' }}>⚠️ {error}</div>}
                                    <div style={{ display: 'flex', gap: '12px' }}>
                                        <button type="button" onClick={() => setShowAddModal(false)} style={{ flex: 1, padding: '12px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '10px', color: '#fff', cursor: 'pointer' }}>İptal</button>
                                        <button type="submit" style={{ flex: 1, padding: '12px', background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)', border: 'none', borderRadius: '10px', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>Ekle</button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )}

                    {/* Edit User Modal */}
                    {showEditModal && selectedUser && (
                        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                            <div style={{ background: 'var(--card-bg)', borderRadius: '20px', padding: '32px', width: '100%', maxWidth: '400px', border: '1px solid var(--border)' }}>
                                <h3 style={{ margin: '0 0 24px', fontSize: '20px' }}>✏️ Kullanıcı Düzenle</h3>
                                <form onSubmit={handleUpdateUser}>
                                    <div style={{ marginBottom: '16px' }}>
                                        <label style={{ display: 'block', marginBottom: '8px', color: 'var(--muted)', fontSize: '14px' }}>Kullanıcı Adı</label>
                                        <input type="text" value={formData.username} disabled style={{ width: '100%', padding: '12px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '10px', color: 'var(--muted)', fontSize: '14px', boxSizing: 'border-box' }} />
                                    </div>
                                    <div style={{ marginBottom: '16px' }}>
                                        <label style={{ display: 'block', marginBottom: '8px', color: 'var(--muted)', fontSize: '14px' }}>İsim Soyisim</label>
                                        <input type="text" value={formData.fullName} onChange={e => setFormData({ ...formData, fullName: e.target.value })} style={{ width: '100%', padding: '12px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '10px', color: '#fff', fontSize: '14px', boxSizing: 'border-box' }} />
                                    </div>
                                    <div style={{ marginBottom: '16px' }}>
                                        <label style={{ display: 'block', marginBottom: '8px', color: 'var(--muted)', fontSize: '14px' }}>Yeni Şifre (boş bırakılırsa değişmez)</label>
                                        <input type="password" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} placeholder="Yeni şifre" style={{ width: '100%', padding: '12px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '10px', color: '#fff', fontSize: '14px', boxSizing: 'border-box' }} />
                                    </div>
                                    <div style={{ marginBottom: '24px' }}>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                            <input type="checkbox" checked={formData.isAdmin} onChange={e => setFormData({ ...formData, isAdmin: e.target.checked })} />
                                            <span>Admin yetkisi</span>
                                        </label>
                                    </div>
                                    {error && <div style={{ color: '#fca5a5', marginBottom: '16px', fontSize: '14px' }}>⚠️ {error}</div>}
                                    <div style={{ display: 'flex', gap: '12px' }}>
                                        <button type="button" onClick={() => { setShowEditModal(false); setSelectedUser(null); }} style={{ flex: 1, padding: '12px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '10px', color: '#fff', cursor: 'pointer' }}>İptal</button>
                                        <button type="submit" style={{ flex: 1, padding: '12px', background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)', border: 'none', borderRadius: '10px', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>Kaydet</button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )}
                </main>
            </div>
        </AuthGuard>
    );
}
