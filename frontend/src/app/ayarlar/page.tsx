'use client';

import { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import AuthGuard from '@/components/AuthGuard';
import OzunluLoading from '@/components/OzunluLoading';
import { API_URL, apiFetch } from '@/lib/api';
import {
    Settings,
    CheckCircle,
    AlertTriangle,
    Users,
    Plus,
    Crown,
    User as UserIcon,
    Edit2,
    Trash2,
    X,
} from 'lucide-react';

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
            const res = await apiFetch(`${API_URL}/users`, { credentials: 'include' });
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
            const res = await apiFetch(`${API_URL}/users`, {
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
        } catch {
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

            const res = await apiFetch(`${API_URL}/users/${selectedUser.id}`, {
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
        } catch {
            setError('Bağlantı hatası');
        }
    };

    const handleDeleteUser = async (userId: number) => {
        if (!confirm('Bu kullanıcıyı silmek istediğinize emin misiniz?')) return;
        try {
            const res = await apiFetch(`${API_URL}/users/${userId}`, {
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
        } catch {
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
            <Sidebar />
            <main className="main-content apple-app-page">
                <div className="apple-canvas">
                    <header className="header header--stack apple-page-hero">
                        <h1 className="header-title">
                            <Settings size={28} className="page-title-leading-icon shrink-0" />
                            Ayarlar
                        </h1>
                        <p className="header-subtitle">Kullanıcı yönetimi ve sistem ayarları</p>
                    </header>

                    {success && (
                        <div className="apple-banner apple-banner--success">
                            <CheckCircle size={20} /> {success}
                        </div>
                    )}
                    {error && (
                        <div className="apple-banner apple-banner--danger">
                            <AlertTriangle size={20} /> {error}
                        </div>
                    )}

                    {/* Users Section */}
                    <div className="card card--p-lg">
                        <div className="apple-settings-toolbar">
                            <h2 className="apple-settings-section-title">
                                <Users size={20} /> Kullanıcılar
                            </h2>
                            <button
                                onClick={() => { setShowAddModal(true); setFormData({ username: '', password: '', fullName: '', isAdmin: false }); setError(''); }}
                                className="btn btn-premium"
                            >
                                <Plus size={18} /> Yeni Kullanıcı
                            </button>
                        </div>

                        {loading ? (
                            <OzunluLoading variant="compact" />
                        ) : (
                            <div className="apple-table-scroll">
                                <table className="apple-data-table">
                                    <thead>
                                        <tr className="apple-data-thead-row">
                                            <th className="apple-data-th">Kullanıcı Adı</th>
                                            <th className="apple-data-th">İsim</th>
                                            <th className="apple-data-th apple-data-th--center">Rol</th>
                                            <th className="apple-data-th apple-data-th--right">İşlemler</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {users.map(user => (
                                            <tr key={user.id} className="apple-data-tr">
                                                <td className="apple-data-td apple-data-td--strong">{user.username}</td>
                                                <td className="apple-data-td">{user.fullName}</td>
                                                <td className="apple-data-td apple-data-td--center">
                                                    <span className={`apple-role-pill ${user.isAdmin ? 'apple-role-pill--admin' : 'apple-role-pill--user'}`}>
                                                        {user.isAdmin ? <Crown size={14} /> : <UserIcon size={14} />} {user.isAdmin ? 'Admin' : 'Kullanıcı'}
                                                    </span>
                                                </td>
                                                <td className="apple-data-td apple-data-td--right">
                                                    <div className="apple-table-actions">
                                                        <button type="button" onClick={() => openEditModal(user)} className="apple-icon-btn apple-icon-btn--edit"><Edit2 size={16} /></button>
                                                        <button type="button" onClick={() => handleDeleteUser(user.id)} className="apple-icon-btn apple-icon-btn--danger"><Trash2 size={16} /></button>
                                                    </div>
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
                        <div className="modal-overlay apple-product-form-overlay" onClick={() => setShowAddModal(false)}>
                            <div
                                className="modal modal--premium apple-product-form-modal"
                                role="dialog"
                                aria-modal="true"
                                aria-labelledby="ayarlar-add-user-title"
                                onClick={e => e.stopPropagation()}
                            >
                                <div className="modal-header">
                                    <h2 className="modal-title" id="ayarlar-add-user-title">
                                        Yeni kullanıcı
                                    </h2>
                                    <button
                                        type="button"
                                        className="modal-close"
                                        onClick={() => setShowAddModal(false)}
                                        aria-label="Kapat"
                                    >
                                        <X size={18} strokeWidth={2.25} />
                                    </button>
                                </div>
                                <form id="addUserForm" onSubmit={handleAddUser}>
                                    <div className="modal-body">
                                        <div className="form-grid">
                                            <div className="form-group">
                                                <label className="form-label" htmlFor="add-username">
                                                    Kullanıcı adı *
                                                </label>
                                                <input
                                                    id="add-username"
                                                    type="text"
                                                    className="input"
                                                    value={formData.username}
                                                    onChange={e => setFormData({ ...formData, username: e.target.value })}
                                                    required
                                                    autoComplete="username"
                                                    placeholder="örn: ahmet.yilmaz"
                                                />
                                            </div>
                                            <div className="form-group">
                                                <label className="form-label" htmlFor="add-fullname">
                                                    İsim soyisim *
                                                </label>
                                                <input
                                                    id="add-fullname"
                                                    type="text"
                                                    className="input"
                                                    value={formData.fullName}
                                                    onChange={e => setFormData({ ...formData, fullName: e.target.value })}
                                                    required
                                                    autoComplete="name"
                                                    placeholder="örn: Ahmet Yılmaz"
                                                />
                                            </div>
                                            <div className="form-group">
                                                <label className="form-label" htmlFor="add-password">
                                                    Şifre *
                                                </label>
                                                <input
                                                    id="add-password"
                                                    type="password"
                                                    className="input"
                                                    value={formData.password}
                                                    onChange={e => setFormData({ ...formData, password: e.target.value })}
                                                    required
                                                    autoComplete="new-password"
                                                    placeholder="••••••••"
                                                />
                                            </div>
                                            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                                <span className="form-label">Yetki</span>
                                                <label className="apple-checkbox-field">
                                                    <input
                                                        type="checkbox"
                                                        checked={formData.isAdmin}
                                                        onChange={e => setFormData({ ...formData, isAdmin: e.target.checked })}
                                                    />
                                                    <span className="apple-checkbox-field__text">
                                                        <span className="apple-checkbox-field__label">
                                                            Yönetici
                                                            {formData.isAdmin ? <Crown size={14} className="inline ml-1 align-text-bottom text-amber-600" /> : null}
                                                        </span>
                                                        <span className="apple-checkbox-field__hint">
                                                            İşaretliyse tüm yönetim ekranlarına erişir.
                                                        </span>
                                                    </span>
                                                </label>
                                            </div>
                                        </div>
                                        {error ? (
                                            <div className="apple-banner apple-banner--danger" style={{ marginTop: 16, marginBottom: 0 }}>
                                                <AlertTriangle size={18} />
                                                {error}
                                            </div>
                                        ) : null}
                                    </div>
                                    <div className="modal-footer">
                                        <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>
                                            İptal
                                        </button>
                                        <button type="submit" className="btn btn-primary">
                                            Kullanıcı ekle
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )}

                    {/* Edit User Modal */}
                    {showEditModal && selectedUser && (
                        <div
                            className="modal-overlay apple-product-form-overlay"
                            onClick={() => {
                                setShowEditModal(false);
                                setSelectedUser(null);
                            }}
                        >
                            <div
                                className="modal modal--premium apple-product-form-modal"
                                role="dialog"
                                aria-modal="true"
                                aria-labelledby="ayarlar-edit-user-title"
                                onClick={e => e.stopPropagation()}
                            >
                                <div className="modal-header">
                                    <h2 className="modal-title" id="ayarlar-edit-user-title">
                                        Kullanıcıyı düzenle
                                    </h2>
                                    <button
                                        type="button"
                                        className="modal-close"
                                        onClick={() => {
                                            setShowEditModal(false);
                                            setSelectedUser(null);
                                        }}
                                        aria-label="Kapat"
                                    >
                                        <X size={18} strokeWidth={2.25} />
                                    </button>
                                </div>
                                <form id="editUserForm" onSubmit={handleUpdateUser}>
                                    <div className="modal-body">
                                        <div className="form-grid">
                                            <div className="form-group">
                                                <label className="form-label" htmlFor="edit-username">
                                                    Kullanıcı adı
                                                </label>
                                                <input
                                                    id="edit-username"
                                                    type="text"
                                                    className="input"
                                                    value={formData.username}
                                                    disabled
                                                    readOnly
                                                    autoComplete="username"
                                                />
                                            </div>
                                            <div className="form-group">
                                                <label className="form-label" htmlFor="edit-fullname">
                                                    İsim soyisim
                                                </label>
                                                <input
                                                    id="edit-fullname"
                                                    type="text"
                                                    className="input"
                                                    value={formData.fullName}
                                                    onChange={e => setFormData({ ...formData, fullName: e.target.value })}
                                                    autoComplete="name"
                                                />
                                            </div>
                                            <div className="form-group">
                                                <label className="form-label" htmlFor="edit-password">
                                                    Yeni şifre <span style={{ fontWeight: 500, color: 'var(--muted)' }}>(isteğe bağlı)</span>
                                                </label>
                                                <input
                                                    id="edit-password"
                                                    type="password"
                                                    className="input"
                                                    value={formData.password}
                                                    onChange={e => setFormData({ ...formData, password: e.target.value })}
                                                    autoComplete="new-password"
                                                    placeholder="Değiştirmek için yazın"
                                                />
                                            </div>
                                            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                                <span className="form-label">Yetki</span>
                                                <label className="apple-checkbox-field">
                                                    <input
                                                        type="checkbox"
                                                        checked={formData.isAdmin}
                                                        onChange={e => setFormData({ ...formData, isAdmin: e.target.checked })}
                                                    />
                                                    <span className="apple-checkbox-field__text">
                                                        <span className="apple-checkbox-field__label">
                                                            Yönetici
                                                            {formData.isAdmin ? <Crown size={14} className="inline ml-1 align-text-bottom text-amber-600" /> : null}
                                                        </span>
                                                        <span className="apple-checkbox-field__hint">
                                                            İşaretliyse tüm yönetim ekranlarına erişir.
                                                        </span>
                                                    </span>
                                                </label>
                                            </div>
                                        </div>
                                        {error ? (
                                            <div className="apple-banner apple-banner--danger" style={{ marginTop: 16, marginBottom: 0 }}>
                                                <AlertTriangle size={18} />
                                                {error}
                                            </div>
                                        ) : null}
                                    </div>
                                    <div className="modal-footer">
                                        <button
                                            type="button"
                                            className="btn btn-secondary"
                                            onClick={() => {
                                                setShowEditModal(false);
                                                setSelectedUser(null);
                                            }}
                                        >
                                            İptal
                                        </button>
                                        <button type="submit" className="btn btn-primary">
                                            Kaydet
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )}
                    </div>
                </main>
        </AuthGuard>
    );
}
