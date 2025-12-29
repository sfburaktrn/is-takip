'use client';

import { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import { getStats, getDampers, getDropdowns, createDamper, updateDamper, deleteDamper, type Stats, type Damper, type Dropdowns, STEP_GROUPS } from '@/lib/api';
import Link from 'next/link';

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [dampers, setDampers] = useState<Damper[]>([]);
  const [dropdowns, setDropdowns] = useState<Dropdowns | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    imalatNo: '',
    musteri: '',
    aracGeldiMi: false,
    aracMarka: '',
    model: '',
    tip: '',
    malzemeCinsi: '',
    m3: '',
    adet: '1',
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [statsData, dampersData, dropdownsData] = await Promise.all([
        getStats(),
        getDampers(),
        getDropdowns()
      ]);
      setStats(statsData);
      setDampers(dampersData);
      setDropdowns(dropdownsData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }

  const getStatusBadge = (status: string | undefined) => {
    if (!status) return <span className="badge badge-muted">-</span>;

    switch (status) {
      case 'TAMAMLANDI':
      case 'YAPILDI':
        return <span className="badge badge-success">{status}</span>;
      case 'DEVAM EDİYOR':
        return <span className="badge badge-warning">{status}</span>;
      case 'BAŞLAMADI':
        return <span className="badge badge-danger">{status}</span>;
      default:
        return <span className="badge badge-muted">{status}</span>;
    }
  };

  const calculateProgress = (damper: Damper): number => {
    const steps = [
      damper.plazmaProgrami, damper.sacMalzemeKontrolu, damper.plazmaKesim,
      damper.damperSasiPlazmaKesim, damper.presBukum, damper.aracBraket,
      damper.damperSasi, damper.sasiYukleme, damper.milAltKutuk, damper.taban,
      damper.yan, damper.onGogus, damper.arkaKapak, damper.yuklemeMalzemesi,
      damper.damperKurulmasi, damper.damperKaynak, damper.sasiKapakSiperlik,
      damper.yukleme, damper.hidrolik, damper.boyaHazirlik, damper.boya,
      damper.elektrik, damper.hava, damper.tamamlama, damper.sonKontrol, damper.teslimat
    ];
    const completed = steps.filter(Boolean).length;
    return Math.round((completed / steps.length) * 100);
  };

  const getDamperStatus = (damper: Damper): string => {
    // All step fields to check
    const allSteps = [
      damper.plazmaProgrami, damper.sacMalzemeKontrolu, damper.plazmaKesim,
      damper.damperSasiPlazmaKesim, damper.presBukum, damper.aracBraket,
      damper.damperSasi, damper.sasiYukleme, damper.milAltKutuk, damper.taban,
      damper.yan, damper.onGogus, damper.arkaKapak, damper.yuklemeMalzemesi,
      damper.damperKurulmasi, damper.damperKaynak, damper.sasiKapakSiperlik,
      damper.yukleme, damper.hidrolik, damper.boyaHazirlik, damper.boya,
      damper.elektrik, damper.hava, damper.tamamlama, damper.sonKontrol, damper.teslimat
    ];

    const completedSteps = allSteps.filter(Boolean).length;
    const totalSteps = allSteps.length;

    if (completedSteps === totalSteps) {
      return 'tamamlanan';
    } else if (completedSteps === 0) {
      return 'baslamayan';
    } else {
      return 'devamEden';
    }
  };

  const handleStepToggle = async (damperId: number, stepKey: string, currentValue: boolean) => {
    try {
      const updated = await updateDamper(damperId, { [stepKey]: !currentValue });
      setDampers(prev => prev.map(d => d.id === damperId ? updated : d));
    } catch (error) {
      console.error('Error updating step:', error);
    }
  };

  const handleAddDamper = async (e: React.FormEvent) => {
    e.preventDefault();
    const quantity = parseInt(formData.adet) || 1;
    try {
      await createDamper({
        imalatNo: formData.imalatNo ? parseInt(formData.imalatNo) : 0,
        musteri: formData.musteri,
        aracGeldiMi: formData.aracGeldiMi,
        aracMarka: formData.aracMarka || null,
        model: formData.model || null,
        tip: formData.tip,
        malzemeCinsi: formData.malzemeCinsi,
        m3: formData.m3 ? parseFloat(formData.m3) : null,
        adet: quantity,
      });
      setShowAddModal(false);
      setFormData({
        imalatNo: '',
        musteri: '',
        aracGeldiMi: false,
        aracMarka: '',
        model: '',
        tip: '',
        malzemeCinsi: '',
        m3: '',
        adet: '1',
      });
      loadData();
      // Show success message for multiple dampers
      if (quantity > 1) {
        alert(`${quantity} adet damper başarıyla oluşturuldu!\n(${formData.musteri} 1 - ${formData.musteri} ${quantity})`);
      }
    } catch (error) {
      console.error('Error creating damper:', error);
      alert('Damper oluşturulurken hata oluştu');
    }
  };

  // Filter dampers based on status
  const filteredDampers = statusFilter
    ? dampers.filter(d => getDamperStatus(d) === statusFilter)
    : dampers.slice(0, 5);

  if (loading) {
    return (
      <>
        <Sidebar />
        <main className="main-content">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>⏳</div>
              <div style={{ color: 'var(--muted)' }}>Yükleniyor...</div>
            </div>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Sidebar />
      <main className="main-content">
        <header className="header">
          <div>
            <h1 className="header-title">Dashboard</h1>
            <p className="header-subtitle">Damper imalat süreçlerine genel bakış</p>
          </div>
          <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
            ➕ Yeni Damper Ekle
          </button>
        </header>

        {/* Stats Grid */}
        <div className="stats-grid">
          <div
            className="stat-card"
            style={{ cursor: 'pointer', border: statusFilter === null ? '2px solid var(--primary)' : undefined }}
            onClick={() => setStatusFilter(null)}
          >
            <div className="stat-icon blue">📦</div>
            <div>
              <div className="stat-value">{stats?.total || 0}</div>
              <div className="stat-label">Toplam Damper</div>
            </div>
          </div>
          <div
            className="stat-card"
            style={{ cursor: 'pointer', border: statusFilter === 'tamamlanan' ? '2px solid var(--success)' : undefined }}
            onClick={() => setStatusFilter(statusFilter === 'tamamlanan' ? null : 'tamamlanan')}
          >
            <div className="stat-icon green">✅</div>
            <div>
              <div className="stat-value">{stats?.tamamlanan || 0}</div>
              <div className="stat-label">Tamamlanan</div>
            </div>
          </div>
          <div
            className="stat-card"
            style={{ cursor: 'pointer', border: statusFilter === 'devamEden' ? '2px solid var(--warning)' : undefined }}
            onClick={() => setStatusFilter(statusFilter === 'devamEden' ? null : 'devamEden')}
          >
            <div className="stat-icon yellow">🔄</div>
            <div>
              <div className="stat-value">{stats?.devamEden || 0}</div>
              <div className="stat-label">Devam Eden</div>
            </div>
          </div>
          <div
            className="stat-card"
            style={{ cursor: 'pointer', border: statusFilter === 'baslamayan' ? '2px solid var(--danger)' : undefined }}
            onClick={() => setStatusFilter(statusFilter === 'baslamayan' ? null : 'baslamayan')}
          >
            <div className="stat-icon red">⏸️</div>
            <div>
              <div className="stat-value">{stats?.baslamayan || 0}</div>
              <div className="stat-label">Başlamayan</div>
            </div>
          </div>
        </div>

        {/* Dampers List */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600 }}>
              {statusFilter === 'tamamlanan' && '✅ Tamamlanan Damperler'}
              {statusFilter === 'devamEden' && '🔄 Devam Eden Damperler'}
              {statusFilter === 'baslamayan' && '⏸️ Başlamayan Damperler'}
              {!statusFilter && 'Son Eklenen Damperler'}
            </h2>
            {statusFilter && (
              <button className="btn btn-secondary" onClick={() => setStatusFilter(null)}>
                ✕ Filtreyi Kaldır
              </button>
            )}
            {!statusFilter && (
              <Link href="/damper-listesi" className="btn btn-secondary">
                Tümünü Gör →
              </Link>
            )}
          </div>

          {filteredDampers.length === 0 ? (
            <div className="card" style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)' }}>
              Bu kategoride damper bulunamadı
            </div>
          ) : (
            filteredDampers.map((damper) => {
              const progress = calculateProgress(damper);
              const overallStatus = progress === 100 ? 'TAMAMLANDI' : progress === 0 ? 'BAŞLAMADI' : 'DEVAM EDİYOR';
              const isExpanded = expandedId === damper.id;

              return (
                <div key={damper.id} className="damper-card">
                  <div
                    className="damper-card-header"
                    onClick={() => setExpandedId(isExpanded ? null : damper.id)}
                  >
                    <div style={{ fontWeight: 700, color: 'var(--primary)' }}>#{damper.imalatNo}</div>
                    <div style={{ fontWeight: 500 }}>{damper.musteri}</div>
                    <div>
                      <span style={{
                        background: 'rgba(99, 102, 241, 0.1)',
                        color: 'var(--primary)',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '12px'
                      }}>
                        {damper.tip}
                      </span>
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--muted)' }}>
                      {damper.malzemeCinsi} | {damper.m3} M³
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div className="progress-bar" style={{ width: '100%', maxWidth: '80px' }}>
                        <div className="progress-bar-fill" style={{ width: `${progress}%` }}></div>
                      </div>
                      <span style={{ fontSize: '12px', color: 'var(--muted)', minWidth: '35px' }}>{progress}%</span>
                    </div>
                    <div>{getStatusBadge(overallStatus)}</div>
                    <div style={{
                      width: '10px',
                      height: '10px',
                      borderRadius: '50%',
                      background: damper.aracGeldiMi ? 'var(--success)' : 'var(--danger)'
                    }} title={damper.aracGeldiMi ? 'Araç Geldi' : 'Araç Gelmedi'}></div>
                    <div style={{ fontSize: '20px', transition: 'transform 0.3s', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0)' }}>▼</div>
                  </div>

                  {isExpanded && (
                    <div className="damper-card-body">
                      {/* Araç Geldi Mi */}
                      {/* Bilgi Kartları (İmalat No, Araç Durumu & Tarih) */}
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                        gap: '12px',
                        marginBottom: '20px',
                        paddingBottom: '20px',
                        borderBottom: '1px solid var(--border)'
                      }}>
                        {/* İmalat No - Düzenlenebilir */}
                        <div style={{
                          background: 'var(--card-bg-secondary)',
                          padding: '12px 16px',
                          borderRadius: '10px',
                          border: !damper.imalatNo ? '2px solid var(--warning)' : '1px solid var(--border)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '12px'
                        }}>
                          <div>
                            <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600, marginBottom: '4px' }}>İMALAT NO</div>
                            <div style={{ fontSize: '14px', fontWeight: 500, color: !damper.imalatNo ? 'var(--warning)' : 'var(--foreground)' }}>
                              {damper.imalatNo ?? 'Girilmedi'}
                            </div>
                          </div>
                          <input
                            type="number"
                            className="input"
                            style={{
                              width: '100px',
                              padding: '6px 10px',
                              fontSize: '13px',
                              textAlign: 'center',
                              height: '34px'
                            }}
                            placeholder="İmalat No"
                            value={damper.imalatNo ?? ''}
                            onClick={(e) => e.stopPropagation()}
                            onChange={async (e) => {
                              const newImalatNo = e.target.value ? parseInt(e.target.value) : null;
                              const updated = await updateDamper(damper.id, { imalatNo: newImalatNo });
                              setDampers(prev => prev.map(d => d.id === damper.id ? updated : d));
                            }}
                          />
                        </div>

                        {/* Şasi No - Düzenlenebilir */}
                        <div style={{
                          background: 'var(--card-bg-secondary)',
                          padding: '12px 16px',
                          borderRadius: '10px',
                          border: '1px solid var(--border)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '12px'
                        }}>
                          <div>
                            <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600, marginBottom: '4px' }}>ŞASİ NO</div>
                            <div style={{ fontSize: '14px', fontWeight: 500, color: damper.sasiNo ? 'var(--foreground)' : 'var(--muted)' }}>
                              {damper.sasiNo || 'Girilmedi'}
                            </div>
                          </div>
                          <input
                            type="text"
                            className="input"
                            style={{
                              width: '120px',
                              padding: '6px 10px',
                              fontSize: '13px',
                              height: '34px'
                            }}
                            placeholder="Şasi No"
                            value={damper.sasiNo || ''}
                            onClick={(e) => e.stopPropagation()}
                            onChange={async (e) => {
                              const newSasiNo = e.target.value;
                              const updated = await updateDamper(damper.id, { sasiNo: newSasiNo });
                              setDampers(prev => prev.map(d => d.id === damper.id ? updated : d));
                            }}
                          />
                        </div>

                        {/* Araç Durumu */}
                        <div style={{
                          background: 'var(--card-bg-secondary)',
                          padding: '12px 16px',
                          borderRadius: '10px',
                          border: '1px solid var(--border)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between'
                        }}>
                          <div>
                            <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600, marginBottom: '4px' }}>ARAÇ DURUMU</div>
                            <div style={{ fontSize: '14px', fontWeight: 500 }}>
                              {damper.aracGeldiMi ? 'Araç Fabrikada' : 'Araç Gelmedi'}
                            </div>
                          </div>
                          <div
                            className={`step-toggle ${damper.aracGeldiMi ? 'active' : ''}`}
                            onClick={async (e) => {
                              e.stopPropagation();
                              const updated = await updateDamper(damper.id, { aracGeldiMi: !damper.aracGeldiMi });
                              setDampers(prev => prev.map(d => d.id === damper.id ? updated : d));
                            }}
                            style={{ transform: 'scale(1.1)' }}
                            title="Değiştirmek için tıklayın"
                          ></div>
                        </div>

                        {/* Adet (Quantity) */}
                        <div style={{
                          background: 'var(--card-bg-secondary)',
                          padding: '12px 16px',
                          borderRadius: '10px',
                          border: '1px solid var(--border)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '12px'
                        }}>
                          <div>
                            <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600, marginBottom: '4px' }}>ADET</div>
                            <div style={{ fontSize: '14px', fontWeight: 500 }}>
                              {damper.adet || 1}
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <input
                              type="number"
                              className="input"
                              min="1"
                              style={{
                                width: '60px',
                                padding: '4px 8px',
                                fontSize: '13px',
                                textAlign: 'center',
                                height: '32px'
                              }}
                              value={damper.adet || 1}
                              onChange={async (e) => {
                                const newAdet = parseInt(e.target.value);
                                if (newAdet > 0) {
                                  const updated = await updateDamper(damper.id, { adet: newAdet });
                                  setDampers(prev => prev.map(d => d.id === damper.id ? updated : d));
                                }
                              }}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                        </div>

                        {/* Tarih/Saat */}
                        <div style={{
                          background: 'var(--card-bg-secondary)',
                          padding: '12px 16px',
                          borderRadius: '10px',
                          border: '1px solid var(--border)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '12px',
                          position: 'relative' // İkon konumlandırma için
                        }}>
                          <div>
                            <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600, marginBottom: '4px' }}>OLUŞTURULMA TARİHİ</div>
                            <div style={{ fontSize: '13px', color: 'var(--foreground)' }}>
                              {damper.createdAt ? new Date(damper.createdAt).toLocaleString('tr-TR', {
                                year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
                              }) : '-'}
                            </div>
                          </div>
                          <input
                            type="datetime-local"
                            className="input"
                            style={{
                              padding: '4px 8px',
                              fontSize: '12px',
                              width: '40px', // Sadece ikon için
                              height: '30px',
                              border: '1px solid var(--border)',
                              background: 'var(--bg)',
                              color: 'transparent',
                              cursor: 'pointer',
                              opacity: 0, // Tamamen görünmez yap, ama tıklanabilir olsun (custom icon altında)
                              position: 'absolute',
                              right: '16px',
                              zIndex: 10
                            }}
                            title="Tarihi Düzenle"
                            onChange={async (e) => {
                              if (e.target.value) {
                                const updated = await updateDamper(damper.id, {
                                  createdAt: new Date(e.target.value).toISOString()
                                });
                                setDampers(prev => prev.map(d => d.id === damper.id ? updated : d));
                              }
                            }}
                          />
                          <div style={{ fontSize: '20px', cursor: 'pointer' }}>📅</div>
                        </div>
                      </div>

                      {STEP_GROUPS.map((group) => {
                        const status = damper[group.statusKey as keyof Damper] as string;
                        return (
                          <div key={group.key} className="step-group">
                            <div className="step-group-title">
                              {group.name}
                              {getStatusBadge(status)}
                            </div>
                            <div className="step-items">
                              {group.subSteps.map((step) => {
                                const isCompleted = damper[step.key as keyof Damper] as boolean;
                                return (
                                  <div key={step.key} className="step-item">
                                    <span className="step-item-label">{step.label}</span>
                                    <div
                                      className={`step-toggle ${isCompleted ? 'active' : ''}`}
                                      onClick={() => handleStepToggle(damper.id, step.key, isCompleted)}
                                    ></div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}

                      {/* Muayene ve Teslimat */}
                      <div className="step-group">
                        <div className="step-group-title">MUAYENE & TESLİMAT</div>
                        <div className="step-items">
                          <div className="step-item">
                            <span className="step-item-label">Kurum Muayenesi</span>
                            <select
                              className="select"
                              style={{ width: '120px', padding: '6px 10px', fontSize: '12px' }}
                              value={damper.kurumMuayenesi}
                              onChange={async (e) => {
                                const updated = await updateDamper(damper.id, { kurumMuayenesi: e.target.value });
                                setDampers(prev => prev.map(d => d.id === damper.id ? updated : d));
                              }}
                            >
                              {dropdowns?.kurumMuayenesi.map(v => (
                                <option key={v} value={v}>{v}</option>
                              ))}
                            </select>
                          </div>
                          <div className="step-item">
                            <span className="step-item-label">DMO Muayenesi</span>
                            <select
                              className="select"
                              style={{ width: '140px', padding: '6px 10px', fontSize: '12px' }}
                              value={damper.dmoMuayenesi}
                              onChange={async (e) => {
                                const updated = await updateDamper(damper.id, { dmoMuayenesi: e.target.value });
                                setDampers(prev => prev.map(d => d.id === damper.id ? updated : d));
                              }}
                            >
                              {dropdowns?.dmoMuayenesi.map(v => (
                                <option key={v} value={v}>{v}</option>
                              ))}
                            </select>
                          </div>
                          <div className="step-item">
                            <span className="step-item-label">Teslimat</span>
                            <div
                              className={`step-toggle ${damper.teslimat ? 'active' : ''}`}
                              onClick={() => handleStepToggle(damper.id, 'teslimat', damper.teslimat)}
                            ></div>
                          </div>
                        </div>
                      </div>

                      {/* Delete Button */}
                      <div style={{
                        marginTop: '20px',
                        paddingTop: '16px',
                        borderTop: '1px solid var(--border)',
                        display: 'flex',
                        justifyContent: 'flex-end'
                      }}>
                        <button
                          className="btn"
                          style={{
                            background: 'rgba(239, 68, 68, 0.1)',
                            color: 'var(--danger)',
                            border: '1px solid var(--danger)'
                          }}
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (window.confirm(`"${damper.musteri}" - İmalat No: ${damper.imalatNo}\n\nBu damperi silmek istediğinize emin misiniz?\n\nBu işlem geri alınamaz!`)) {
                              try {
                                await deleteDamper(damper.id);
                                setDampers(prev => prev.filter(d => d.id !== damper.id));
                                setExpandedId(null);
                                loadData(); // Refresh stats
                              } catch (error) {
                                console.error('Error deleting damper:', error);
                                alert('Damper silinirken hata oluştu');
                              }
                            }
                          }}
                        >
                          🗑️ Damperi Sil
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Add Modal */}
        {showAddModal && (
          <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2 className="modal-title">Yeni Damper Ekle</h2>
                <button className="modal-close" onClick={() => setShowAddModal(false)}>✕</button>
              </div>
              <form onSubmit={handleAddDamper}>
                <div className="modal-body">
                  <div className="form-grid">
                    <div className="form-group">
                      <label className="form-label">İmalat No <span style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 400 }}>(sonra doldurulabilir)</span></label>
                      <input
                        type="number"
                        className="input"
                        placeholder="Sonra doldurulacak..."
                        value={formData.imalatNo}
                        onChange={(e) => setFormData(prev => ({ ...prev, imalatNo: e.target.value }))}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Müşteri *</label>
                      <input
                        type="text"
                        className="input"
                        required
                        value={formData.musteri}
                        onChange={(e) => setFormData(prev => ({ ...prev, musteri: e.target.value }))}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Araç Geldi Mi *</label>
                      <select
                        className="select"
                        value={formData.aracGeldiMi ? 'EVET' : 'HAYIR'}
                        onChange={(e) => setFormData(prev => ({ ...prev, aracGeldiMi: e.target.value === 'EVET' }))}
                      >
                        <option value="HAYIR">HAYIR</option>
                        <option value="EVET">EVET</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Araç Marka</label>
                      <input
                        type="text"
                        className="input"
                        placeholder="Örn: FORD, MERCEDES..."
                        value={formData.aracMarka}
                        onChange={(e) => setFormData(prev => ({ ...prev, aracMarka: e.target.value }))}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Model</label>
                      <input
                        type="text"
                        className="input"
                        placeholder="Örn: 3545 D, 3345 K..."
                        value={formData.model}
                        onChange={(e) => setFormData(prev => ({ ...prev, model: e.target.value }))}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Tip *</label>
                      <select
                        className="select"
                        required
                        value={formData.tip}
                        onChange={(e) => setFormData(prev => ({ ...prev, tip: e.target.value }))}
                      >
                        <option value="">Seçiniz</option>
                        {dropdowns?.tip.map(t => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Malzeme Cinsi *</label>
                      <select
                        className="select"
                        required
                        value={formData.malzemeCinsi}
                        onChange={(e) => setFormData(prev => ({ ...prev, malzemeCinsi: e.target.value }))}
                      >
                        <option value="">Seçiniz</option>
                        {dropdowns?.malzemeCinsi.map(m => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">M³</label>
                      <input
                        type="number"
                        className="input"
                        step="0.1"
                        value={formData.m3}
                        onChange={(e) => setFormData(prev => ({ ...prev, m3: e.target.value }))}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Adet *</label>
                      <input
                        type="number"
                        className="input"
                        required
                        min="1"
                        value={formData.adet}
                        onChange={(e) => setFormData(prev => ({ ...prev, adet: e.target.value }))}
                      />
                      {parseInt(formData.adet) > 1 && (
                        <div style={{ fontSize: '11px', color: 'var(--primary)', marginTop: '4px' }}>
                          💡 {formData.adet} ayrı damper oluşturulacak: {formData.musteri || 'Firma'} 1, {formData.musteri || 'Firma'} 2, ... {formData.musteri || 'Firma'} {formData.adet}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>
                    İptal
                  </button>
                  <button type="submit" className="btn btn-primary">
                    Damper Ekle
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
