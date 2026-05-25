'use client';

import type { SshComplaint } from '@/lib/api';
import { AlertCircle, Inbox } from 'lucide-react';

export function SshTop5KritikTable({ rows }: { rows: SshComplaint[] }) {
    return (
        <div className="ssh-glass-card ssh-last5-card">
            <div className="ssh-card-head">
                <div className="ssh-card-head-icon">
                    <AlertCircle size={18} strokeWidth={2} />
                </div>
                <div>
                    <h3 className="ssh-card-title">En kritik 5 şikayet</h3>
                    <p className="ssh-card-desc">Kritik puana göre sıralı (yüksekten düşüğe)</p>
                </div>
            </div>
            {rows.length === 0 ? (
                <div className="ssh-mini-empty">
                    <Inbox size={28} strokeWidth={1.5} />
                    <span>Kayıt yok</span>
                </div>
            ) : (
                <div className="ssh-table-wrap">
                    <table className="ssh-table ssh-table--cards-mobile">
                        <thead>
                            <tr>
                                <th>Talep No</th>
                                <th>Müşteri</th>
                                <th>Plaka</th>
                                <th>Arıza tipi</th>
                                <th>Kaynak</th>
                                <th>Tedarikçi</th>
                                <th>Kritik</th>
                                <th>Garanti</th>
                                <th>Statü</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map(row => (
                                <tr key={row.id}>
                                    <td className="ssh-td-mono" data-label="Talep no">{row.talepNo}</td>
                                    <td data-label="Müşteri">{row.musteriAdi}</td>
                                    <td data-label="Plaka">{row.aracPlakasi || '—'}</td>
                                    <td className="ssh-td-wrap" data-label="Arıza tipi">{row.arizaTipi || '—'}</td>
                                    <td data-label="Kaynak">{row.hataKaynagi || '—'}</td>
                                    <td data-label="Tedarikçi">{row.tedarikciAdi || '—'}</td>
                                    <td data-label="Kritik">
                                        <span className="ssh-kritik-badge">{row.kritikPuan ?? '—'}</span>
                                    </td>
                                    <td data-label="Garanti">{row.garantiTipi || '—'}</td>
                                    <td data-label="Statü">
                                        <span
                                            className={`ssh-status-pill ssh-status-${row.status === 'KAPALI' ? 'closed' : 'open'}`}
                                        >
                                            {row.status}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
