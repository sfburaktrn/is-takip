'use client';

import { FileSpreadsheet } from 'lucide-react';
import './Ssh8dReportButton.css';

export function Ssh8dReportButton({
    onClick,
    className = '',
}: {
    onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
    className?: string;
}) {
    return (
        <button
            type="button"
            className={`ssh-8d-btn ${className}`.trim()}
            onClick={onClick}
            aria-label="8D raporu indir"
        >
            <span className="ssh-8d-btn__shine" aria-hidden />
            <span className="ssh-8d-btn__badge" aria-hidden>
                8D
            </span>
            <span className="ssh-8d-btn__label">
                <FileSpreadsheet size={15} strokeWidth={2.25} className="ssh-8d-btn__icon" aria-hidden />
                Rapor
            </span>
        </button>
    );
}
