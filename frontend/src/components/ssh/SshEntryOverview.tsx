'use client';

import type { SshStats } from '@/lib/api';
import { AlertCircle, CheckCircle2, ClipboardList } from 'lucide-react';
import { SshKpiCard } from '@/components/ssh/SshKpiCard';
import { SshTop5KritikTable } from '@/components/ssh/SshTop5KritikTable';
import './SshEntryOverview.css';

export function SshEntryOverview({ stats }: { stats: SshStats | null }) {
    if (!stats) return null;

    return (
        <section className="ssh-entry-overview" aria-label="SSH özet">
            <div className="ssh-kpi-tiles ssh-kpi-tiles--3">
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
            </div>

            <SshTop5KritikTable rows={stats.son5} />
        </section>
    );
}
