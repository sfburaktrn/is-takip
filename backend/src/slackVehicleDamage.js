'use strict';

/** Node 18+ yerel FormData + fetch; npm `form-data` ile native fetch çoğu zaman `invalid_form_data` üretir. */
const SLACK_API = 'https://slack.com/api';

function isSlackHasarConfigured() {
    if (process.env.SLACK_HASAR_ENABLED === 'false' || process.env.SLACK_HASAR_ENABLED === '0') return false;
    const ch = process.env.SLACK_HASAR_CHANNEL_ID;
    return Boolean(process.env.SLACK_BOT_TOKEN && ch && String(ch).trim());
}

function fmtTr(dt) {
    if (!dt) return '—';
    try {
        return new Date(dt).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' });
    } catch {
        return '—';
    }
}

function moneyTr(n) {
    if (n == null || n === '') return '—';
    const x = Number(n);
    if (!Number.isFinite(x)) return '—';
    return `${x.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL`;
}

function totalFromRow(row) {
    const t = row.cost != null ? Number(row.cost) : NaN;
    if (Number.isFinite(t) && t > 0) return t;
    const p = row.partCost != null ? Number(row.partCost) : 0;
    const l = row.laborCost != null ? Number(row.laborCost) : 0;
    const s = p + l;
    return Number.isFinite(s) && s > 0 ? s : null;
}

function costDetailMrkdwn(row) {
    const requiresPart = Boolean(row.requiresPart);
    const partLine = requiresPart ? `• *Parça maliyeti:* ${moneyTr(row.partCost)}` : '• *Parça maliyeti:* — *(parça gerekmiyor)*';
    const laborLine = `• *İşçilik maliyeti:* ${moneyTr(row.laborCost)}`;
    const tot = totalFromRow(row);
    const totalLine = tot != null ? `• *Toplam maliyet:* *${moneyTr(tot)}*` : '• *Toplam maliyet:* —';
    return [partLine, laborLine, totalLine].join('\n');
}

function statusTr(status) {
    if (status === 'KAYDI_GIRILDI') return 'Kayıt girildi';
    if (status === 'SURECTE') return 'Süreçte';
    if (status === 'TAMAMLANDI') return 'Tamamlandı';
    return String(status || '—');
}

function responsiblesList(row) {
    const j = row.responsiblesJson;
    return Array.isArray(j) && j.length ? j.join(', ') : '—';
}

function clip(s, max) {
    const t = String(s || '');
    if (t.length <= max) return t;
    return `${t.slice(0, max - 1)}…`;
}

function repairLabel(v) {
    if (!v) return '—';
    if (v === 'SERVIS') return 'Serviste yapılacak';
    if (v === 'IC_BUENYE') return 'Kendi iç bünyemizde';
    return String(v);
}

function serviceLabel(v) {
    if (!v) return '—';
    if (v === 'ARAC_SERVISE_GIDECEK') return 'Araç servise gidecek';
    if (v === 'SERVIS_FABRIKAYA_GELECEK') return 'Servis fabrikaya gelecek';
    return String(v);
}

function calendarDaysBetween(a, b) {
    const s = new Date(a);
    const e = new Date(b);
    const s0 = Date.UTC(s.getFullYear(), s.getMonth(), s.getDate());
    const e0 = Date.UTC(e.getFullYear(), e.getMonth(), e.getDate());
    return Math.round((e0 - s0) / 86400000);
}

function resolutionPhrase(createdAt, completedAt) {
    const d = calendarDaysBetween(createdAt, completedAt);
    if (d <= 0) return 'Aynı gün içinde hasar giderildi.';
    if (d === 1) return '1 günde hasar giderildi.';
    return `${d} günde hasar giderildi.`;
}

/** Kısa bildirim metni (mobil / bildirim önizlemesi). */
function buildFallbackText(event, row) {
    if (event === 'CREATED') return `Hasar kaydı: ${row.sasiNo} · ${statusTr(row.status)}`;
    if (event === 'PROCESS_STARTED') return `Süreçte: ${row.sasiNo}`;
    if (event === 'COMPLETED') return `Hasar giderildi: ${row.sasiNo}`;
    return 'Araç hasar kaydı';
}

function buildBlocks(event, row) {
    const blocks = [];

    if (event === 'CREATED') {
        blocks.push({
            type: 'header',
            text: { type: 'plain_text', text: '🚗 Yeni Hasar Bildirimi', emoji: true },
        });
        blocks.push({
            type: 'section',
            fields: [
                { type: 'mrkdwn', text: `*Şasi no*\n\`${row.sasiNo}\`` },
                { type: 'mrkdwn', text: `*Durum*\n${statusTr(row.status)}` },
                { type: 'mrkdwn', text: `*Sorumlular*\n${clip(responsiblesList(row), 800)}` },
                {
                    type: 'mrkdwn',
                    text: `*Onarım yeri*\n${repairLabel(row.repairLocation)}`,
                },
            ],
        });
        if (row.processOwner) {
            blocks.push({
                type: 'section',
                text: { type: 'mrkdwn', text: `*Süreç ile ilgilenen:* ${row.processOwner}` },
            });
        }
        if (row.repairLocation === 'SERVIS' && row.serviceDirection) {
            blocks.push({
                type: 'section',
                text: { type: 'mrkdwn', text: `*Servis akışı:* ${serviceLabel(row.serviceDirection)}` },
            });
        }
        blocks.push({ type: 'divider' });
        blocks.push({
            type: 'section',
            text: { type: 'mrkdwn', text: `*💰 Maliyet detayı*\n${costDetailMrkdwn(row)}` },
        });
        if (row.notes) {
            blocks.push({
                type: 'section',
                text: { type: 'mrkdwn', text: `*Not*\n${clip(row.notes, 2800)}` },
            });
        }
        blocks.push({
            type: 'context',
            elements: [
                {
                    type: 'mrkdwn',
                    text: `Oluşturan: *${row.createdByUsername || '—'}* · ${fmtTr(row.createdAt)}`,
                },
            ],
        });
    } else if (event === 'PROCESS_STARTED') {
        blocks.push({
            type: 'header',
            text: { type: 'plain_text', text: '⚙️ Hasar kaydı sürece alındı', emoji: true },
        });
        blocks.push({
            type: 'section',
            fields: [
                { type: 'mrkdwn', text: `*Şasi no*\n\`${row.sasiNo}\`` },
                { type: 'mrkdwn', text: `*Onarım yeri*\n${repairLabel(row.repairLocation)}` },
            ],
        });
        if (row.repairLocation === 'SERVIS' && row.serviceDirection) {
            blocks.push({
                type: 'section',
                text: { type: 'mrkdwn', text: `*Servis akışı:* ${serviceLabel(row.serviceDirection)}` },
            });
        }
        blocks.push({ type: 'divider' });
        blocks.push({
            type: 'section',
            text: { type: 'mrkdwn', text: `*💰 Maliyet detayı*\n${costDetailMrkdwn(row)}` },
        });
        blocks.push({
            type: 'context',
            elements: [
                {
                    type: 'mrkdwn',
                    text: `İşlem: *${row.processStartedByUsername || '—'}* · ${fmtTr(row.processStartedAt)}`,
                },
            ],
        });
    } else if (event === 'COMPLETED') {
        const end = row.completedAt || row.updatedAt;
        blocks.push({
            type: 'header',
            text: { type: 'plain_text', text: '✅ Hasar giderildi / süreç tamamlandı', emoji: true },
        });
        blocks.push({
            type: 'section',
            fields: [
                { type: 'mrkdwn', text: `*Şasi no*\n\`${row.sasiNo}\`` },
                { type: 'mrkdwn', text: `*Süre*\n${row.createdAt && end ? resolutionPhrase(row.createdAt, end) : '—'}` },
            ],
        });
        blocks.push({ type: 'divider' });
        blocks.push({
            type: 'section',
            text: { type: 'mrkdwn', text: `*💰 Maliyet detayı*\n${costDetailMrkdwn(row)}` },
        });
        blocks.push({
            type: 'context',
            elements: [
                {
                    type: 'mrkdwn',
                    text: `Kapatan: *${row.completedByUsername || '—'}* · ${fmtTr(end)}`,
                },
            ],
        });
    }

    return blocks;
}

async function slackPostJson(method, body) {
    const token = process.env.SLACK_BOT_TOKEN;
    const res = await fetch(`${SLACK_API}/${method}`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || res.statusText || 'slack_error');
    return data;
}

/**
 * Klasik multipart. Sınırı fetch’in yerel FormData’sı üretir (Slack `invalid_form_data` önlenir).
 */
async function slackUploadViaFilesUpload({ channel, thread_ts, buffer, filename, contentType, initial_comment }) {
    const token = process.env.SLACK_BOT_TOKEN;
    const ct = contentType || 'application/octet-stream';
    const blob = new Blob([buffer], { type: ct });
    const form = new FormData();
    form.append('channels', channel);
    form.append('filename', filename);
    form.append('title', filename.replace(/\.[^.]+$/, '') || 'Hasar görseli');
    if (thread_ts) form.append('thread_ts', thread_ts);
    if (initial_comment) form.append('initial_comment', initial_comment);
    form.append('file', blob, filename);

    const res = await fetch(`${SLACK_API}/files.upload`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
        },
        body: form,
    });
    const raw = await res.text();
    let data;
    try {
        data = JSON.parse(raw);
    } catch {
        throw new Error(`slack_upload_parse: ${raw.slice(0, 200)}`);
    }
    if (!data.ok) {
        console.error('[slack hasar] files.upload response:', JSON.stringify(data));
        throw new Error(data.error || res.statusText || 'slack_upload_error');
    }
    return data;
}

/**
 * Yeni Slack dosya yükleme akışı (files.upload kapalı / hatalı olduğunda).
 * @see https://api.slack.com/methods/files.getUploadURLExternal
 */
async function slackUploadViaExternal({ channel, thread_ts, buffer, filename, contentType, initial_comment }) {
    const token = process.env.SLACK_BOT_TOKEN;
    const length = buffer.length;
    const r1 = await fetch(`${SLACK_API}/files.getUploadURLExternal`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify({
            filename,
            length,
            alt_txt: clip(filename, 1000),
        }),
    });
    const j1 = await r1.json();
    if (!j1.ok) {
        console.error('[slack hasar] getUploadURLExternal:', JSON.stringify(j1));
        if (j1.error === 'missing_scope') {
            console.error(
                '[slack hasar] Bot için OAuth Scopes: files:write (ve gerekirse yeniden "Install to Workspace").'
            );
        }
        throw new Error(j1.error || 'getUploadURLExternal');
    }

    const uploadUrl = j1.upload_url;
    const fileId = j1.file_id;
    if (!uploadUrl || !fileId) throw new Error('getUploadURLExternal_missing_url');

    const ct = contentType || 'application/octet-stream';
    const blob = new Blob([buffer], { type: ct });
    const formUp = new FormData();
    formUp.append('file', blob, filename);
    let r2 = await fetch(uploadUrl, {
        method: 'POST',
        body: formUp,
    });
    if (!r2.ok) {
        r2 = await fetch(uploadUrl, {
            method: 'POST',
            headers: { 'Content-Type': ct },
            body: buffer,
        });
    }
    if (!r2.ok) {
        const errTxt = await r2.text().catch(() => '');
        throw new Error(`upload_url_http_${r2.status}: ${errTxt.slice(0, 120)}`);
    }

    const completeBody = {
        files: [{ id: fileId, title: filename.replace(/\.[^.]+$/, '') || 'Hasar görseli' }],
        channel_id: channel,
    };
    if (thread_ts) completeBody.thread_ts = thread_ts;
    if (initial_comment) completeBody.initial_comment = initial_comment;

    const r3 = await fetch(`${SLACK_API}/files.completeUploadExternal`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify(completeBody),
    });
    const j3 = await r3.json();
    if (!j3.ok) {
        console.error('[slack hasar] completeUploadExternal:', JSON.stringify(j3));
        if (j3.error === 'missing_scope') {
            console.error(
                '[slack hasar] completeUploadExternal missing_scope → token’da files:write yok veya kurulum eski; https://api.slack.com/apps'
            );
        }
        throw new Error(j3.error || 'completeUploadExternal');
    }
    return j3;
}

async function slackUploadImageFile({ channel, thread_ts, buffer, filename, contentType, initial_comment }) {
    async function uploadWithThreadTs(ts) {
        try {
            return await slackUploadViaFilesUpload({
                channel,
                thread_ts: ts,
                buffer,
                filename,
                contentType,
                initial_comment,
            });
        } catch (e) {
            console.warn('[slack hasar] files.upload:', e.message, '→ external upload deneniyor');
            return await slackUploadViaExternal({
                channel,
                thread_ts: ts,
                buffer,
                filename,
                contentType,
                initial_comment,
            });
        }
    }
    try {
        return await uploadWithThreadTs(thread_ts);
    } catch (e) {
        if (thread_ts) {
            console.warn('[slack hasar] thread ile dosya paylaşılamadı, kanalda kök mesaj olarak deneniyor:', e.message);
            return await uploadWithThreadTs(undefined);
        }
        throw e;
    }
}

function safeFilename(name, fallback) {
    const n = String(name || '').trim();
    if (n && /\.[a-z0-9]{2,4}$/i.test(n)) return n.replace(/[^\w.\-]+/g, '_').slice(0, 120);
    return fallback;
}

function mimeToContentType(mime) {
    const m = String(mime || '').toLowerCase();
    if (m.includes('png')) return 'image/png';
    if (m.includes('jpeg') || m.includes('jpg')) return 'image/jpeg';
    if (m.includes('webp')) return 'image/webp';
    if (m.includes('gif')) return 'image/gif';
    return 'application/octet-stream';
}

/**
 * @param {'CREATED'|'PROCESS_STARTED'|'COMPLETED'} event
 * @param {object} row Prisma VehicleDamageRecord + photos (photo.data Buffer)
 * @returns {{ photosExpected: number, photosUploaded: number, errors: string[] }}
 */
async function notifyVehicleDamageSlack(event, row) {
    const summary = { photosExpected: 0, photosUploaded: 0, errors: [] };
    if (!isSlackHasarConfigured()) return summary;

    const channel = String(process.env.SLACK_HASAR_CHANNEL_ID).trim();
    const text = buildFallbackText(event, row);
    const blocks = buildBlocks(event, row);

    const post = await slackPostJson('chat.postMessage', {
        channel,
        text,
        blocks,
    });
    const threadTs = post.ts;

    const uploadPhotos = event === 'CREATED';
    if (!uploadPhotos) return summary;

    const photos = row.photos || [];
    const toUpload = photos.filter(p => {
        if (!p || p.data == null) return false;
        const buf = Buffer.isBuffer(p.data) ? p.data : Buffer.from(p.data);
        return buf.length > 0;
    });
    summary.photosExpected = toUpload.length;

    if (!toUpload.length) {
        console.warn('[slack hasar] CREATED: yüklenecek foto yok (row.photos boş veya veri yok)');
        return summary;
    }

    const intro = `📷 *Hasar fotoğrafları* (${toUpload.length} adet) — aşağıdaki dosyalar önizlenebilir.`;

    for (let i = 0; i < toUpload.length; i += 1) {
        const p = toUpload[i];
        const buf = Buffer.isBuffer(p.data) ? p.data : Buffer.from(p.data);
        const mime = String(p.mimeType || 'image/webp').toLowerCase();
        const ext = mime.includes('png') ? 'png' : mime.includes('jpeg') || mime.includes('jpg') ? 'jpg' : 'webp';
        const fallback = `hasar-${row.id}-${i + 1}.${ext}`;
        const filename = safeFilename(p.originalFileName, fallback);
        const contentType = mimeToContentType(mime);
        try {
            await slackUploadImageFile({
                channel,
                thread_ts: threadTs,
                buffer: buf,
                filename,
                contentType,
                initial_comment: i === 0 ? intro : undefined,
            });
            summary.photosUploaded += 1;
        } catch (e) {
            const msg = e.message || String(e);
            summary.errors.push(`#${i + 1} ${filename}: ${msg}`);
            console.error(`[slack hasar] foto ${i + 1} yüklenemedi:`, msg);
        }
    }

    return summary;
}

module.exports = { isSlackHasarConfigured, notifyVehicleDamageSlack };
