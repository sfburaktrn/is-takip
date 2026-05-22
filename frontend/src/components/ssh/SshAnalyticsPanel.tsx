'use client';

import type { SshStats } from '@/lib/api';
import { SshKpiCard } from '@/components/ssh/SshKpiCard';
import {
    AlertCircle,
    BarChart3,
    Calendar,
    CheckCircle2,
    ClipboardList,
    Factory,
    Inbox,
    Shield,
    TrendingUp,
    Truck,
    Wallet,
    Wrench,
} from 'lucide-react';
import './SshAnalyticsPanel.css';

function fmtCurrency(v: number | null | undefined) {
    if (v == null || !Number.isFinite(v)) return '—';
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(v);
}

function fmtPct(rate: number) {
    return `${Math.round(rate * 100)}%`;
}

function fmtNum(v: number | null | undefined, digits = 1) {
    if (v == null || !Number.isFinite(v)) return '—';
    return v.toLocaleString('tr-TR', { maximumFractionDigits: digits });
}

function fmtMonthLabel(month: string) {
    const [y, m] = month.split('-');
    const names = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
    const mi = parseInt(m, 10);
    if (!y || !Number.isFinite(mi) || mi < 1 || mi > 12) return month;
    return `${names[mi - 1]} ${y}`;
}

function DistBlock({
    title,
    desc,
    rows,
    icon,
}: {
    title: string;
    desc: string;
    rows: { name: string; count: number; rate: number }[];
    icon: React.ReactNode;
}) {
    const max = Math.max(...rows.map(r => r.count), 1);
    return (
        <div className="ssh-glass-card ssh-dist-card">
            <div className="ssh-card-head">
                <div className="ssh-card-head-icon">{icon}</div>
                <div>
                    <h3 className="ssh-card-title">{title}</h3>
                    <p className="ssh-card-desc">{desc}</p>
                </div>
            </div>
            {rows.length === 0 ? (
                <div className="ssh-mini-empty">
                    <Inbox size={28} strokeWidth={1.5} />
                    <span>Henüz veri yok</span>
                </div>
            ) : (
                <ul className="ssh-dist-list">
                    {rows.map(row => (
                        <li key={row.name}>
                            <div className="ssh-dist-row-top">
                                <span className="ssh-dist-name" title={row.name}>
                                    {row.name}
                                </span>
                                <span className="ssh-dist-meta">
                                    {row.count} · {fmtPct(row.rate)}
                                </span>
                            </div>
                            <div className="ssh-dist-bar" aria-hidden>
                                <span className="ssh-dist-bar-fill" style={{ width: `${(row.count / max) * 100}%` }} />
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

function TrendBlock({ rows }: { rows: { month: string; count: number }[] }) {
    const max = Math.max(...rows.map(r => r.count), 1);
    return (
        <div className="ssh-glass-card ssh-analytics-trend">
            <div className="ssh-card-head">
                <div className="ssh-card-head-icon">
                    <Calendar size={18} strokeWidth={2} />
                </div>
                <div>
                    <h3 className="ssh-card-title">Aylık şikayet trendi</h3>
                    <p className="ssh-card-desc">Şikayet bildirim tarihine göre son 6 ay</p>
                </div>
            </div>
            {rows.length === 0 ? (
                <div className="ssh-mini-empty">
                    <Inbox size={28} strokeWidth={1.5} />
                    <span>Henüz veri yok</span>
                </div>
            ) : (
                <ul className="ssh-trend-list">
                    {rows.map(row => (
                        <li key={row.month} className="ssh-trend-row">
                            <span className="ssh-trend-label">{fmtMonthLabel(row.month)}</span>
                            <div className="ssh-trend-bar-wrap" aria-hidden>
                                <span className="ssh-trend-bar" style={{ width: `${(row.count / max) * 100}%` }} />
                            </div>
                            <span className="ssh-trend-count">{row.count}</span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

export function SshAnalyticsPanel({ stats }: { stats: SshStats | null }) {
    if (!stats) return null;

    return (
        <section className="ssh-panel ssh-analytics-panel" aria-label="SSH analizleri">
            <div className="ssh-analytics-panel__intro">
                <BarChart3 size={20} strokeWidth={2} />
                <div>
                    <h2 className="ssh-analytics-panel__title">SSH analizleri</h2>
                    <p className="ssh-analytics-panel__sub">Tüm kayıtlar üzerinden özet metrikler ve dağılımlar</p>
                </div>
            </div>

            <div className="ssh-kpi-tiles ssh-kpi-tiles--5">
                <SshKpiCard
                    tone="primary"
                    icon={<ClipboardList size={22} strokeWidth={2} />}
                    value={stats.total}
                    label="Toplam şikayet"
                />
                <SshKpiCard
                    tone="warning"
                    icon={<AlertCircle size={22} strokeWidth={2} />}
                    value={stats.acik}
                    label="Açık"
                />
                <SshKpiCard
                    tone="success"
                    icon={<CheckCircle2 size={22} strokeWidth={2} />}
                    value={stats.kapali}
                    label="Kapalı"
                />
                <SshKpiCard
                    tone="info"
                    icon={<TrendingUp size={22} strokeWidth={2} />}
                    value={fmtPct(stats.kapamaOrani)}
                    label="Kapama oranı"
                />
                <SshKpiCard
                    tone="money"
                    icon={<Wallet size={22} strokeWidth={2} />}
                    value={fmtCurrency(stats.aracBasiMaliyet)}
                    label="Araç başı maliyet"
                />
            </div>

            <div className="ssh-analytics-metrics">
                <div className="ssh-analytics-metric">
                    <span className="ssh-analytics-metric__label">Ortalama kritik puan</span>
                    <strong>{fmtNum(stats.ortalamaKritikPuan, 0)}</strong>
                </div>
                <div className="ssh-analytics-metric">
                    <span className="ssh-analytics-metric__label">Toplam maliyet</span>
                    <strong>{fmtCurrency(stats.toplamMaliyet)}</strong>
                </div>
                <div className="ssh-analytics-metric">
                    <span className="ssh-analytics-metric__label">Ort. çıkış süresi</span>
                    <strong>{stats.ortalamaCikisSuresiGun != null ? `${fmtNum(stats.ortalamaCikisSuresiGun, 0)} gün` : '—'}</strong>
                </div>
                <div className="ssh-analytics-metric">
                    <span className="ssh-analytics-metric__label">Ort. tekrar eden hata</span>
                    <strong>{fmtNum(stats.ortalamaTekrarHata, 1)}</strong>
                </div>
            </div>

            <TrendBlock rows={stats.aylikTrend} />

            <div className="ssh-panel-row">
                <DistBlock
                    title="Arıza tipi"
                    desc="En sık 6 arıza tipi"
                    rows={stats.arizaTipiDagilimi}
                    icon={<Wrench size={18} strokeWidth={2} />}
                />
                <DistBlock
                    title="Hata kaynağı"
                    desc="Kaynak bazlı dağılım"
                    rows={stats.hataKaynagiDagilimi}
                    icon={<TrendingUp size={18} strokeWidth={2} />}
                />
            </div>

            <div className="ssh-panel-row">
                <DistBlock
                    title="Garanti tipi"
                    desc="Garanti sınıflandırması"
                    rows={stats.garantiTipiDagilimi}
                    icon={<Shield size={18} strokeWidth={2} />}
                />
                <DistBlock
                    title="Üst yapı tipi"
                    desc="Damper / dorse dağılımı"
                    rows={stats.ustYapiTipiDagilimi}
                    icon={<Truck size={18} strokeWidth={2} />}
                />
            </div>

            <div className="ssh-panel-row">
                <DistBlock
                    title="Öncelik"
                    desc="Öncelik sınıfı dağılımı"
                    rows={stats.oncelikPrioDagilimi}
                    icon={<BarChart3 size={18} strokeWidth={2} />}
                />
                <DistBlock
                    title="Tedarikçi"
                    desc="Tedarikçi kaynaklı şikayetlerde firma dağılımı"
                    rows={stats.tedarikciDagilimi}
                    icon={<Factory size={18} strokeWidth={2} />}
                />
            </div>

        </section>
    );
}
