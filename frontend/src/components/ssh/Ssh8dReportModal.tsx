'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { SshModernSelect } from '@/components/ssh/SshChoiceField';
import type { Ssh8dEkipDirectory, Ssh8dEkipUyesi, Ssh8dReportInput, SshLookups } from '@/lib/api';
import { fetchSsh8dEkipDirectory, saveSsh8dEkipDirectory } from '@/lib/api';
import { ChevronDown, Download, Loader2, Plus, Trash2, X } from 'lucide-react';
import './Ssh8dReportModal.css';

const MAX_UYE = 4;
const EMPTY_MEMBER = (): { name: string; dept: string } => ({ name: '', dept: '' });

function todayInput() {
    return new Date().toISOString().slice(0, 10);
}

function mergePeople(base: Ssh8dEkipUyesi[], extra: Ssh8dEkipUyesi[]) {
    const map = new Map<string, Ssh8dEkipUyesi>();
    for (const p of [...base, ...extra]) {
        const name = p.name.trim();
        if (!name) continue;
        const key = name.toLocaleLowerCase('tr');
        map.set(key, { name, dept: (p.dept || '').trim() });
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'tr'));
}

export function Ssh8dReportModal({
    open,
    talepNo,
    sshLookups,
    onClose,
    onGenerate,
}: {
    open: boolean;
    talepNo: string;
    sshLookups: SshLookups | null;
    onClose: () => void;
    onGenerate: (input: Ssh8dReportInput) => Promise<void>;
}) {
    const [dokumanNo, setDokumanNo] = useState('');
    const [revizyonNo, setRevizyonNo] = useState('1');
    const [revizyonTarihi, setRevizyonTarihi] = useState(todayInput);
    const [liderName, setLiderName] = useState('');
    const [liderDept, setLiderDept] = useState('');
    const [uyeler, setUyeler] = useState([EMPTY_MEMBER()]);
    const [generating, setGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [directoryOpen, setDirectoryOpen] = useState(false);
    const [directory, setDirectory] = useState<Ssh8dEkipDirectory>({ people: [], departmanlar: [] });
    const [directoryLoading, setDirectoryLoading] = useState(false);
    const [directorySaving, setDirectorySaving] = useState(false);
    const [directoryMsg, setDirectoryMsg] = useState<string | null>(null);
    const [newDirName, setNewDirName] = useState('');
    const [newDirDept, setNewDirDept] = useState('');

    const baseEkip = sshLookups?.['8dEkipUyeleri'] ?? [];
    const baseDepts = sshLookups?.['8dDepartmanlar'] ?? [];

    const allPeople = useMemo(
        () => mergePeople(baseEkip, directory.people),
        [baseEkip, directory.people]
    );

    const deptOptions = useMemo(() => {
        const fromPeople = allPeople.map(p => p.dept).filter(Boolean);
        const extra = [...baseDepts, ...directory.departmanlar];
        return [...new Set([...fromPeople, ...extra])].sort((a, b) => a.localeCompare(b, 'tr'));
    }, [allPeople, baseDepts, directory.departmanlar]);

    const nameOptions = useMemo(() => {
        const names = allPeople.map(p => p.name);
        return [...new Set([...names, liderName, ...uyeler.map(u => u.name)].filter(Boolean))].sort((a, b) =>
            a.localeCompare(b, 'tr')
        );
    }, [allPeople, liderName, uyeler]);

    const loadDirectory = useCallback(async () => {
        setDirectoryLoading(true);
        try {
            const data = await fetchSsh8dEkipDirectory();
            setDirectory(data);
        } catch {
            setDirectory({ people: [], departmanlar: [] });
        } finally {
            setDirectoryLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!open) return;
        setDokumanNo('');
        setRevizyonNo('1');
        setRevizyonTarihi(todayInput());
        setLiderName('');
        setLiderDept('');
        setUyeler([EMPTY_MEMBER()]);
        setError(null);
        setDirectoryOpen(false);
        setDirectoryMsg(null);
        setNewDirName('');
        setNewDirDept('');
        void loadDirectory();
    }, [open, talepNo, loadDirectory]);

    const findPerson = (name: string) =>
        allPeople.find(p => p.name.localeCompare(name, 'tr', { sensitivity: 'base' }) === 0);

    const pickPerson = (name: string, onName: (n: string) => void, onDept: (d: string) => void) => {
        onName(name);
        const found = findPerson(name);
        if (found?.dept) onDept(found.dept);
    };

    const addDirectoryPerson = () => {
        const name = newDirName.trim();
        if (!name) return;
        const dept = newDirDept.trim();
        setDirectory(prev => ({
            people: mergePeople(prev.people, [{ name, dept }]),
            departmanlar: dept
                ? [...new Set([...prev.departmanlar, dept])]
                : prev.departmanlar,
        }));
        setNewDirName('');
        setNewDirDept('');
        setDirectoryMsg(null);
    };

    const removeDirectoryPerson = (name: string) => {
        setDirectory(prev => ({
            ...prev,
            people: prev.people.filter(p => p.name !== name),
        }));
    };

    const persistDirectory = async () => {
        setDirectorySaving(true);
        setDirectoryMsg(null);
        try {
            const saved = await saveSsh8dEkipDirectory(directory);
            setDirectory(saved);
            setDirectoryMsg('Liste kaydedildi.');
        } catch (e) {
            setDirectoryMsg(e instanceof Error ? e.message : 'Kayıt başarısız');
        } finally {
            setDirectorySaving(false);
        }
    };

    const handleGenerate = async () => {
        setError(null);
        if (!dokumanNo.trim()) {
            setError('Doküman no zorunludur');
            return;
        }
        if (!revizyonNo.trim()) {
            setError('Revizyon no zorunludur');
            return;
        }
        const input: Ssh8dReportInput = {
            dokumanNo: dokumanNo.trim(),
            revizyonNo: revizyonNo.trim(),
            revizyonTarihi,
            ekipLider: liderName.trim() ? { name: liderName.trim(), dept: liderDept.trim() } : null,
            ekipUyeleri: uyeler.filter(u => u.name.trim()).map(u => ({ name: u.name.trim(), dept: u.dept.trim() })),
        };
        try {
            setGenerating(true);
            await onGenerate(input);
            onClose();
        } catch (e) {
            setError(e instanceof Error ? e.message : '8D raporu oluşturulamadı');
        } finally {
            setGenerating(false);
        }
    };

    if (!open) return null;

    return (
        <div className="ssh-8d-modal-backdrop" role="presentation" onClick={onClose}>
            <div
                className="ssh-8d-modal"
                role="dialog"
                aria-labelledby="ssh-8d-modal-title"
                onClick={e => e.stopPropagation()}
            >
                <header className="ssh-8d-modal__head">
                    <div>
                        <h2 id="ssh-8d-modal-title">8D rapor — {talepNo}</h2>
                        <p className="ssh-8d-modal__sub">Doküman bilgileri ve ekip seçimini girin; alanlar şablona aktarılır.</p>
                    </div>
                    <button type="button" className="ssh-8d-modal__close" onClick={onClose} aria-label="Kapat">
                        <X size={20} />
                    </button>
                </header>

                {error ? <div className="ssh-8d-modal__error">{error}</div> : null}

                <div className="ssh-8d-modal__body">
                    <section className="ssh-8d-modal__section">
                        <h3>Doküman bilgileri</h3>
                        <div className="ssh-8d-modal__grid">
                            <label className="ssh-field">
                                <span className="ssh-field__label">Doküman no</span>
                                <input
                                    className="ssh-field__input"
                                    value={dokumanNo}
                                    onChange={e => setDokumanNo(e.target.value)}
                                    placeholder="Örn. F 02 0020"
                                />
                            </label>
                            <label className="ssh-field">
                                <span className="ssh-field__label">Revizyon no</span>
                                <input
                                    className="ssh-field__input"
                                    value={revizyonNo}
                                    onChange={e => setRevizyonNo(e.target.value)}
                                    placeholder="1"
                                />
                            </label>
                            <label className="ssh-field">
                                <span className="ssh-field__label">Revizyon tarihi</span>
                                <input
                                    className="ssh-field__input"
                                    type="date"
                                    value={revizyonTarihi}
                                    onChange={e => setRevizyonTarihi(e.target.value)}
                                />
                            </label>
                        </div>
                    </section>

                    <section className="ssh-8d-modal__section ssh-8d-modal__section--directory">
                        <button
                            type="button"
                            className="ssh-8d-modal__directory-toggle"
                            aria-expanded={directoryOpen}
                            onClick={() => setDirectoryOpen(o => !o)}
                        >
                            <span>Hazır isimler ve ünvanlar</span>
                            <ChevronDown size={18} className={directoryOpen ? 'is-open' : ''} aria-hidden />
                        </button>
                        {directoryOpen ? (
                            <div className="ssh-8d-modal__directory">
                                <p className="ssh-8d-modal__hint">
                                    Buraya eklediğiniz kişiler listede görünür; kaydettikten sonra tüm kullanıcılar
                                    kullanabilir. Listeden seçebilir veya alanlarda &quot;Kendin yaz…&quot; ile elle
                                    girebilirsiniz.
                                </p>
                                {directoryLoading ? (
                                    <p className="ssh-8d-modal__hint">Liste yükleniyor…</p>
                                ) : (
                                    <>
                                        {directory.people.length > 0 ? (
                                            <ul className="ssh-8d-modal__directory-list">
                                                {directory.people.map(p => (
                                                    <li key={p.name}>
                                                        <span>
                                                            <strong>{p.name}</strong>
                                                            {p.dept ? (
                                                                <span className="ssh-8d-modal__directory-dept">
                                                                    {p.dept}
                                                                </span>
                                                            ) : null}
                                                        </span>
                                                        <button
                                                            type="button"
                                                            className="ssh-8d-modal__icon-btn"
                                                            aria-label={`${p.name} sil`}
                                                            onClick={() => removeDirectoryPerson(p.name)}
                                                        >
                                                            <Trash2 size={15} />
                                                        </button>
                                                    </li>
                                                ))}
                                            </ul>
                                        ) : (
                                            <p className="ssh-8d-modal__hint">Henüz özel kişi eklenmedi.</p>
                                        )}
                                        <div className="ssh-8d-modal__directory-add">
                                            <input
                                                className="ssh-field__input"
                                                placeholder="İsim"
                                                value={newDirName}
                                                onChange={e => setNewDirName(e.target.value)}
                                            />
                                            <input
                                                className="ssh-field__input"
                                                placeholder="Ünvan / bölüm"
                                                value={newDirDept}
                                                onChange={e => setNewDirDept(e.target.value)}
                                            />
                                            <button
                                                type="button"
                                                className="ssh-btn ssh-btn--secondary ssh-8d-modal__add-dir"
                                                onClick={addDirectoryPerson}
                                                disabled={!newDirName.trim()}
                                            >
                                                <Plus size={15} />
                                                Ekle
                                            </button>
                                        </div>
                                        <div className="ssh-8d-modal__directory-actions">
                                            <button
                                                type="button"
                                                className="ssh-btn ssh-btn--secondary"
                                                disabled={directorySaving}
                                                onClick={() => void persistDirectory()}
                                            >
                                                {directorySaving ? (
                                                    <Loader2 size={15} className="spin" />
                                                ) : null}
                                                Listeyi kaydet
                                            </button>
                                            {directoryMsg ? (
                                                <span className="ssh-8d-modal__directory-msg">{directoryMsg}</span>
                                            ) : null}
                                        </div>
                                    </>
                                )}
                            </div>
                        ) : null}
                    </section>

                    <section className="ssh-8d-modal__section">
                        <div className="ssh-8d-modal__section-head">
                            <h3>D1 — Ekip</h3>
                            <button
                                type="button"
                                className="ssh-btn ssh-btn--secondary ssh-8d-modal__add-member"
                                disabled={uyeler.length >= MAX_UYE}
                                onClick={() => setUyeler(prev => [...prev, EMPTY_MEMBER()])}
                            >
                                <Plus size={15} />
                                Üye ekle
                            </button>
                        </div>
                        <p className="ssh-8d-modal__hint">
                            Listeden seçin veya &quot;Kendin yaz…&quot; ile isim ve ünvan girin (en fazla {MAX_UYE}{' '}
                            üye, şablonda C/D sütunları).
                        </p>
                        <div className="ssh-8d-modal__team-block">
                            <span className="ssh-8d-modal__team-role">Ekip lideri</span>
                            <div className="ssh-8d-modal__team-row">
                                <SshModernSelect
                                    label="İsim"
                                    value={liderName}
                                    options={nameOptions}
                                    allowEmpty
                                    allowCustom
                                    placeholder="Seçin"
                                    onChange={v => pickPerson(v, setLiderName, setLiderDept)}
                                />
                                <SshModernSelect
                                    label="Ünvan / bölüm"
                                    value={liderDept}
                                    options={deptOptions}
                                    allowEmpty
                                    allowCustom
                                    placeholder="Seçin"
                                    onChange={setLiderDept}
                                />
                            </div>
                        </div>
                        {uyeler.map((u, idx) => (
                            <div key={idx} className="ssh-8d-modal__team-block">
                                <div className="ssh-8d-modal__team-block-head">
                                    <span className="ssh-8d-modal__team-role">Ekip üyesi {idx + 1}</span>
                                    {uyeler.length > 1 ? (
                                        <button
                                            type="button"
                                            className="ssh-8d-modal__remove-member"
                                            onClick={() => setUyeler(prev => prev.filter((_, i) => i !== idx))}
                                        >
                                            Kaldır
                                        </button>
                                    ) : null}
                                </div>
                                <div className="ssh-8d-modal__team-row">
                                    <SshModernSelect
                                        label="İsim"
                                        value={u.name}
                                        options={nameOptions}
                                        allowEmpty
                                        allowCustom
                                        placeholder="Seçin"
                                        onChange={v => {
                                            const found = findPerson(v);
                                            setUyeler(prev => {
                                                const next = [...prev];
                                                next[idx] = {
                                                    name: v,
                                                    dept: found?.dept ?? next[idx].dept,
                                                };
                                                return next;
                                            });
                                        }}
                                    />
                                    <SshModernSelect
                                        label="Ünvan / bölüm"
                                        value={u.dept}
                                        options={deptOptions}
                                        allowEmpty
                                        allowCustom
                                        placeholder="Seçin"
                                        onChange={v => {
                                            setUyeler(prev => {
                                                const next = [...prev];
                                                next[idx] = { ...next[idx], dept: v };
                                                return next;
                                            });
                                        }}
                                    />
                                </div>
                            </div>
                        ))}
                    </section>

                    <p className="ssh-8d-modal__note">
                        Konu: arıza açıklaması · Parça: bölge 3/2 parantez içi · Acil aksiyon ve D6 aynı metin · Etki %
                        boş.
                    </p>
                </div>

                <footer className="ssh-8d-modal__foot">
                    <button type="button" className="ssh-btn ssh-btn--secondary" onClick={onClose} disabled={generating}>
                        İptal
                    </button>
                    <button
                        type="button"
                        className="ssh-btn ssh-btn--primary"
                        disabled={generating}
                        onClick={() => void handleGenerate()}
                    >
                        {generating ? <Loader2 size={16} className="spin" /> : <Download size={16} />}
                        Excel indir
                    </button>
                </footer>
            </div>
        </div>
    );
}
