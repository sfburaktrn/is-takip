# Stok Excel içe aktarma

Bu script **yalnızca** `StockGroup` ve `StockItem` tablolarına yazar. Damper / Dorse / Şasi / bildirim vb. tablolara **dokunmaz**.

## Önkoşul

Canlı veya yerel veritabanında stok migration’ı uygulanmış olmalı:

```bash
cd backend
npx prisma migrate deploy
npx prisma generate
```

## Çalıştırma

```bash
cd backend
node scripts/import-stock-from-xlsx.js "C:\Users\90542\Downloads\GÜNCEL STOK1.xlsx"
```

Windows’ta yol tırnak içinde verin. Alternatif:

```bash
set STOCK_XLSX_PATH=C:\tam\yol\dosya.xlsx
node scripts/import-stock-from-xlsx.js
```

## Beklenen sütunlar

- **GRUP** → stok grubu (yoksa tümü `Genel`)
- **SATINALMA KODU** → benzersiz anahtar (grup + kod); boşsa eşleştirme malzeme tanımı + grup ile yapılır
- **MALZEME TANIMI** → zorunlu
- **BİRİM** → boşsa `null`
- **STOK** → boş veya sayı değilse `null`

Excel’de tedarikçi / birim fiyat yoksa bu alanlar boş kalır; uygulama üzerinden sonradan girilebilir.

## Tekrar çalıştırma

Aynı satınalma kodu + grup için kayıt **güncellenir** (tanım, birim, stok). Kodu olmayan satırlarda aynı grup + aynı tanım bulunursa güncellenir; aksi halde yeni satır oluşur.

## npm script

```bash
npm run stock:import -- "C:\path\dosya.xlsx"
```
