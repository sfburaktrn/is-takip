/** Araç hasar + SSH — seçilen görseli WebP base64'e çevirir */

export function isImageFile(file: File): boolean {
    if (file.type.startsWith('image/')) return true;
    return /\.(jpe?g|png|gif|webp|bmp|heic|heif)$/i.test(file.name);
}

function toBase64(buf: ArrayBuffer): string {
    const bytes = new Uint8Array(buf);
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    return btoa(binary);
}

export type WebpPhotoPayload = {
    localId: string;
    fileName: string;
    mimeType: 'image/webp';
    dataBase64: string;
    previewUrl: string;
};

/** Hasar kaydı ile aynı mantık: createImageBitmap → canvas → WebP */
export async function fileToWebp(file: File): Promise<WebpPhotoPayload> {
    if (!isImageFile(file)) {
        throw new Error('Lütfen geçerli bir görsel seçin (JPG, PNG, WebP…)');
    }

    const imageBitmap = await createImageBitmap(file);
    const canvas = document.createElement('canvas');
    canvas.width = imageBitmap.width;
    canvas.height = imageBitmap.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas başlatılamadı');
    ctx.drawImage(imageBitmap, 0, 0);
    imageBitmap.close?.();

    const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
            v => (v ? resolve(v) : reject(new Error('WebP dönüşümü başarısız'))),
            'image/webp',
            0.86
        );
    });

    const dataBase64 = toBase64(await blob.arrayBuffer());
    const previewUrl = URL.createObjectURL(blob);
    return {
        localId: `p-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        fileName: file.name.replace(/\.[^/.]+$/, '') + '.webp',
        mimeType: 'image/webp',
        dataBase64,
        previewUrl,
    };
}
