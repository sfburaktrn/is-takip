'use client';

import { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import AuthGuard from '@/components/AuthGuard';
import { API_URL } from '@/lib/api';
import {
    Settings,
    CheckCircle,
    AlertTriangle,
    Users,
    Plus,
    Crown,
    User as UserIcon,
    Edit2,
    Trash2
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
                        <h1 className="page-title"><Settings size={32} style={{ display: 'inline', marginRight: '12px' }} /> Ayarlar</h1>
                        <p style={{ color: 'var(--muted)' }}>Kullanıcı yönetimi ve sistem ayarları</p>
                    </div>

                    {success && (
                        <div style={{ background: 'rgba(34, 197, 94, 0.2)', border: '1px solid rgba(34, 197, 94, 0.3)', borderRadius: '12px', padding: '12px 16px', marginBottom: '24px', color: '#86efac', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <CheckCircle size={20} /> {success}
                        </div>
                    )}
                    {error && (
                        <div style={{ background: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '12px', padding: '12px 16px', marginBottom: '24px', color: '#fca5a5', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <AlertTriangle size={20} /> {error}
                        </div>
                    )}

                    {/* Users Section */}
                    <div className="card" style={{ padding: '24px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <h2 style={{ margin: 0, fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
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
                                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 600, background: user.isAdmin ? 'rgba(245, 158, 11, 0.2)' : 'rgba(59, 130, 246, 0.2)', color: user.isAdmin ? '#fbbf24' : '#60a5fa' }}>
                                                        {user.isAdmin ? <Crown size={14} /> : <UserIcon size={14} />} {user.isAdmin ? 'Admin' : 'Kullanıcı'}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '16px 12px', textAlign: 'right' }}>
                                                    <button onClick={() => openEditModal(user)} style={{ padding: '8px 12px', background: 'rgba(59, 130, 246, 0.2)', border: 'none', borderRadius: '8px', color: '#60a5fa', cursor: 'pointer', marginRight: '8px' }}><Edit2 size={16} /></button>
                                                    <button onClick={() => handleDeleteUser(user.id)} style={{ padding: '8px 12px', background: 'rgba(239, 68, 68, 0.2)', border: 'none', borderRadius: '8px', color: '#fca5a5', cursor: 'pointer' }}><Trash2 size={16} /></button>
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
                        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
                            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity" onClick={() => setShowAddModal(false)} />
                            <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 transform transition-all overflow-hidden flex flex-col max-h-[90vh]">
                                {/* Header */}
                                <div className="px-8 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                                    <h3 className="text-xl font-extrabold text-slate-800 flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-200">
                                            <Plus size={22} />
                                        </div>
                                        <span className="bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">Yeni Kullanıcı Ekle</span>
                                    </h3>
                                    <button
                                        onClick={() => setShowAddModal(false)}
                                        className="text-slate-400 hover:text-red-500 hover:bg-red-50 p-2.5 rounded-xl transition-all hover:rotate-90"
                                    >
                                        <span className="sr-only">Kapat</span>
                                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                    </button>
                                </div>

                                {/* Body */}
                                <div className="p-6 overflow-y-auto">
                                    <form id="addUserForm" onSubmit={handleAddUser} className="flex flex-col gap-6">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            {/* Username */}
                                            <div className="space-y-2">
                                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Kullanıcı Adı</label>
                                                <div className="relative group">
                                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors pointer-events-none">
                                                        <UserIcon size={20} />
                                                    </div>
                                                    <input
                                                        type="text"
                                                        value={formData.username}
                                                        onChange={e => setFormData({ ...formData, username: e.target.value })}
                                                        required
                                                        style={{ paddingLeft: '48px' }}
                                                        className="w-full pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-slate-700 font-semibold placeholder:text-slate-400"
                                                        placeholder="örn: ahmet.yilmaz"
                                                    />
                                                </div>
                                            </div>

                                            {/* Full Name */}
                                            <div className="space-y-2">
                                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">İsim Soyisim</label>
                                                <div className="relative group">
                                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors pointer-events-none">
                                                        <Users size={20} />
                                                    </div>
                                                    <input
                                                        type="text"
                                                        value={formData.fullName}
                                                        onChange={e => setFormData({ ...formData, fullName: e.target.value })}
                                                        required
                                                        style={{ paddingLeft: '48px' }}
                                                        className="w-full pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-slate-700 font-semibold placeholder:text-slate-400"
                                                        placeholder="örn: Ahmet Yılmaz"
                                                    />
                                                </div>
                                            </div>

                                            {/* Password */}
                                            <div className="space-y-2">
                                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Şifre</label>
                                                <div className="relative group">
                                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors pointer-events-none">
                                                        <div className="flex items-center justify-center">
                                                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                                                        </div>
                                                    </div>
                                                    <input
                                                        type="password"
                                                        value={formData.password}
                                                        onChange={e => setFormData({ ...formData, password: e.target.value })}
                                                        required
                                                        style={{ paddingLeft: '48px' }}
                                                        className="w-full pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-slate-700 font-semibold placeholder:text-slate-400"
                                                        placeholder="••••••••"
                                                    />
                                                </div>
                                            </div>

                                            {/* Admin Toggle */}
                                            <div className="pt-0">
                                                <label className="h-full flex items-center gap-3 p-3.5 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50 hover:border-blue-200 transition-all group bg-white shadow-sm relative overflow-hidden">
                                                    <div className={`absolute inset-0 bg-blue-50/50 transition-transform ${formData.isAdmin ? 'translate-x-0' : '-translate-x-full'}`} />
                                                    <div className="relative flex items-center shrink-0">
                                                        <input
                                                            type="checkbox"
                                                            checked={formData.isAdmin}
                                                            onChange={e => setFormData({ ...formData, isAdmin: e.target.checked })}
                                                            className="peer h-6 w-6 cursor-pointer appearance-none rounded-lg border-2 border-slate-300 transition-all checked:border-blue-600 checked:bg-blue-600 hover:border-blue-400"
                                                        />
                                                        <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white opacity-0 transition-opacity peer-checked:opacity-100">
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-col relative z-9">
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-bold text-slate-700 text-sm group-hover:text-blue-700 transition-colors">Yönetici Yetkisi</span>
                                                            {formData.isAdmin && <Crown size={14} className="text-amber-500 animate-in zoom-in" />}
                                                        </div>
                                                        <span className="text-[11px] text-slate-500 leading-tight">Tam yetki erişimi</span>
                                                    </div>
                                                </label>
                                            </div>
                                        </div>

                                        {error && (
                                            <div className="flex items-center gap-3 p-4 rounded-xl bg-red-50 text-red-600 text-sm font-medium border border-red-100 animate-in fade-in slide-in-from-top-2">
                                                <div className="p-1.5 bg-red-100 rounded-lg">
                                                    <AlertTriangle size={18} className="shrink-0" />
                                                </div>
                                                {error}
                                            </div>
                                        )}
                                    </form>
                                </div>

                                {/* Footer */}
                                <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setShowAddModal(false)}
                                        className="flex-1 px-4 py-2.5 bg-white border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50 hover:border-slate-300 hover:text-slate-800 transition-all shadow-sm"
                                    >
                                        İptal
                                    </button>
                                    <button
                                        type="submit"
                                        form="addUserForm"
                                        className="flex-1 btn btn-premium justify-center !py-2.5 !m-0 w-full"
                                    >
                                        Kullanıcı Ekle
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Edit User Modal */}
                    {showEditModal && selectedUser && (
                        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
                            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity" onClick={() => { setShowEditModal(false); setSelectedUser(null); }} />
                            <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 transform transition-all overflow-hidden flex flex-col max-h-[90vh]">
                                {/* Header */}
                                <div className="px-8 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                                    <h3 className="text-xl font-extrabold text-slate-800 flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-orange-500 flex items-center justify-center text-white shadow-lg shadow-orange-200">
                                            <Edit2 size={22} />
                                        </div>
                                        <span className="bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">Kullanıcı Düzenle</span>
                                    </h3>
                                    <button
                                        onClick={() => { setShowEditModal(false); setSelectedUser(null); }}
                                        className="text-slate-400 hover:text-red-500 hover:bg-red-50 p-2.5 rounded-xl transition-all hover:rotate-90"
                                    >
                                        <span className="sr-only">Kapat</span>
                                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                    </button>
                                </div>

                                {/* Body */}
                                <div className="p-6 overflow-y-auto">
                                    <form id="editUserForm" onSubmit={handleUpdateUser} className="flex flex-col gap-6">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            {/* Username */}
                                            <div className="space-y-2">
                                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Kullanıcı Adı</label>
                                                <div className="relative">
                                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                                                        <UserIcon size={20} />
                                                    </div>
                                                    <input
                                                        type="text"
                                                        value={formData.username}
                                                        disabled
                                                        style={{ paddingLeft: '48px' }}
                                                        className="w-full pr-4 py-3.5 bg-slate-100 border border-slate-200 rounded-xl text-slate-500 font-bold tracking-tight cursor-not-allowed select-none"
                                                    />
                                                </div>
                                            </div>

                                            {/* Full Name */}
                                            <div className="space-y-2">
                                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">İsim Soyisim</label>
                                                <div className="relative group">
                                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors pointer-events-none">
                                                        <Users size={20} />
                                                    </div>
                                                    <input
                                                        type="text"
                                                        value={formData.fullName}
                                                        onChange={e => setFormData({ ...formData, fullName: e.target.value })}
                                                        style={{ paddingLeft: '48px' }}
                                                        className="w-full pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-slate-700 font-semibold placeholder:text-slate-400"
                                                    />
                                                </div>
                                            </div>

                                            {/* Password */}
                                            <div className="space-y-2">
                                                <label className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">
                                                    Yeni Şifre
                                                    <span className="text-[10px] font-bold text-blue-600 lowercase tracking-normal">isteğe bağlı</span>
                                                </label>
                                                <div className="relative group">
                                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors pointer-events-none">
                                                        <div className="flex items-center justify-center">
                                                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                                                        </div>
                                                    </div>
                                                    <input
                                                        type="password"
                                                        value={formData.password}
                                                        onChange={e => setFormData({ ...formData, password: e.target.value })}
                                                        placeholder="Değiştirmek için yazın"
                                                        style={{ paddingLeft: '48px' }}
                                                        className="w-full pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-slate-700 font-semibold placeholder:text-slate-400"
                                                    />
                                                </div>
                                            </div>

                                            {/* Admin Toggle */}
                                            <div className="pt-0">
                                                <label className="h-full flex items-center gap-3 p-3.5 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50 hover:border-blue-200 transition-all group bg-white shadow-sm relative overflow-hidden">
                                                    <div className={`absolute inset-0 bg-blue-50/50 transition-transform ${formData.isAdmin ? 'translate-x-0' : '-translate-x-full'}`} />
                                                    <div className="relative flex items-center shrink-0">
                                                        <input
                                                            type="checkbox"
                                                            checked={formData.isAdmin}
                                                            onChange={e => setFormData({ ...formData, isAdmin: e.target.checked })}
                                                            className="peer h-6 w-6 cursor-pointer appearance-none rounded-lg border-2 border-slate-300 transition-all checked:border-blue-600 checked:bg-blue-600 hover:border-blue-400"
                                                        />
                                                        <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white opacity-0 transition-opacity peer-checked:opacity-100">
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-col relative z-9">
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-bold text-slate-700 text-sm group-hover:text-blue-700 transition-colors">Yönetici Yetkisi</span>
                                                            {formData.isAdmin && <Crown size={14} className="text-amber-500 animate-in zoom-in" />}
                                                        </div>
                                                        <span className="text-[11px] text-slate-500 leading-tight">Tam yetki erişimi</span>
                                                    </div>
                                                </label>
                                            </div>
                                        </div>

                                        {error && (
                                            <div className="flex items-center gap-3 p-4 rounded-xl bg-red-50 text-red-600 text-sm font-medium border border-red-100 animate-in fade-in slide-in-from-top-2">
                                                <div className="p-1.5 bg-red-100 rounded-lg">
                                                    <AlertTriangle size={18} className="shrink-0" />
                                                </div>
                                                {error}
                                            </div>
                                        )}
                                    </form>
                                </div>

                                {/* Footer */}
                                <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => { setShowEditModal(false); setSelectedUser(null); }}
                                        className="flex-1 px-4 py-2.5 bg-white border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50 hover:border-slate-300 hover:text-slate-800 transition-all shadow-sm"
                                    >
                                        İptal
                                    </button>
                                    <button
                                        type="submit"
                                        form="editUserForm"
                                        className="flex-1 btn btn-premium justify-center !py-2.5 !m-0 w-full"
                                    >
                                        Değişiklikleri Kaydet
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </main>
            </div>
        </AuthGuard>
    );
}
