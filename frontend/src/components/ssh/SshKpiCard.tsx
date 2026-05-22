'use client';

import './SshKpiCard.css';

export type SshKpiTone = 'primary' | 'warning' | 'success' | 'info' | 'money';

export function SshKpiCard({
    tone,
    icon,
    value,
    label,
}: {
    tone: SshKpiTone;
    icon: React.ReactNode;
    value: React.ReactNode;
    label: string;
}) {
    return (
        <article className={`ssh-kpi-tile ssh-kpi-tile--${tone}`}>
            <span className="ssh-kpi-tile__shine" aria-hidden />
            <div className="ssh-kpi-tile__icon">{icon}</div>
            <div className="ssh-kpi-tile__content">
                <div className="ssh-kpi-tile__value">{value}</div>
                <div className="ssh-kpi-tile__label">{label}</div>
            </div>
        </article>
    );
}
