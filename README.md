# 🏭 Damper İmalat Takip Sistemi

Modern ERP tarzı damper imalat takip uygulaması. Next.js frontend, Node.js backend ve PostgreSQL (Supabase) veritabanı kullanılarak geliştirilmiştir.

## 📸 Özellikler

- ✅ **Dashboard** - İstatistikler ve son eklenen damperler
- 🚛 **Damper Listesi** - Tüm damperler, adım takibi, durum güncellemeleri
- 📋 **Özet Görünüm** - Sadece ana adımları gösteren özet tablo
- ➕ **Yeni Damper Ekleme** - Modal form ile hızlı ekleme
- 🔄 **Gerçek Zamanlı Güncelleme** - Adım toggle'ları ile anında güncelleme
- 🎨 **Modern Tasarım** - Dark theme, glassmorphism efektleri

## 🛠️ Teknolojiler

- **Frontend**: Next.js 16, TypeScript, Tailwind CSS
- **Backend**: Node.js, Express.js
- **ORM**: Prisma
- **Veritabanı**: PostgreSQL (Supabase)

## 🚀 Hızlı Başlangıç (Tek Seferlik Komutlar)

Projeyi klonladıktan sonra aşağıdaki komutları sırasıyla iki ayrı terminalde çalıştırarak projeyi hemen ayağa kaldırabilirsiniz.

### Terminal 1: Backend (Port 3001)
```bash
cd backend && npm install && npx prisma generate && npm run dev
```

### Terminal 2: Frontend (Port 3000)
```bash
cd frontend && npm install && npm run dev
```

## 📦 Detaylı Kurulum

### 1. Projeyi klonlayın

```bash
git clone https://github.com/KULLANICI_ADI/is-takip-2.git
cd is-takip-2
```

### 2. Backend kurulumu

```bash
cd backend
npm install
```

### 3. Backend `.env` dosyasını oluşturun

`.env.example` dosyasını `.env` olarak kopyalayın ve Supabase bilgilerinizi girin:

```bash
cp .env.example .env
```

`.env` dosyasını düzenleyin:
```env
DATABASE_URL="postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres"
PORT=3001
```

### 4. Veritabanını hazırlayın

```bash
npx prisma generate
npx prisma db push
```

### 5. (Opsiyonel) Örnek verileri yükleyin

```bash
node prisma/seed.js
```

### 6. Frontend kurulumu

Yeni bir terminal açın:

```bash
cd frontend
npm install
```

## 🚀 Çalıştırma

### Backend'i başlatın (Terminal 1)

```bash
cd backend
npm run dev
```

Backend `http://localhost:3001` adresinde çalışacak.

### Frontend'i başlatın (Terminal 2)

```bash
cd frontend
npm run dev
```

Frontend `http://localhost:3000` adresinde çalışacak.

## 📁 Proje Yapısı

```
is-takip-2/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma    # Veritabanı şeması
│   │   └── seed.js          # Örnek veri
│   ├── src/
│   │   └── index.js         # Express API
│   ├── .env.example         # Örnek çevre değişkenleri
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx              # Dashboard
│   │   │   ├── damper-listesi/       # Damper listesi sayfası
│   │   │   └── ozet/                 # Özet görünüm sayfası
│   │   ├── components/
│   │   │   └── Sidebar.tsx           # Sol menü
│   │   └── lib/
│   │       └── api.ts                # API servisi
│   └── package.json
└── README.md
```

## 📊 API Endpoints

| Endpoint | Method | Açıklama |
|----------|--------|----------|
| `/api/dampers` | GET | Tüm damperları getir |
| `/api/dampers/:id` | GET | Tek damper getir |
| `/api/dampers` | POST | Yeni damper ekle |
| `/api/dampers/:id` | PUT | Damper güncelle |
| `/api/dampers/:id` | DELETE | Damper sil |
| `/api/dampers-summary` | GET | Özet görünüm verisi |
| `/api/stats` | GET | İstatistikler |
| `/api/dropdowns` | GET | Dropdown seçenekleri |

## 🔧 Geliştirici Notları

- Backend nodemon ile çalışır, değişiklikler otomatik yansır
- Frontend Next.js Turbopack ile çalışır, değişiklikler otomatik yansır
- Prisma şemasında değişiklik yaparsanız `npx prisma db push` komutunu çalıştırın

## 🐳 Docker ile Çalıştırma

### Gereksinimler
- Docker Desktop kurulu olmalı

### 1. Backend `.env` dosyası oluşturun

```bash
cd backend
cp .env.example .env
```

`.env` dosyasını Supabase bilgilerinizle doldurun.

### 2. Docker Compose ile başlatın

```bash
# Geliştirme ortamı (hot-reload destekli)
docker-compose up --build

# Arka planda çalıştırma
docker-compose up -d

# Durdurma
docker-compose down
```

Frontend: http://localhost:3000
Backend: http://localhost:3001

Teklif Takip uygulamasından **araç giriş** ve **teslim** olaylarını bu API ile İmalat Takip veritabanına gönderebilirsiniz. Frontend’de **`/arac-bilgileri`** sayfası bu kayıtları ~10 sn aralıkla canlı listeler (oturum gerekir).

### Endpoint

| | |
|---|---|
| URL | `POST /api/integrations/vehicle-delivery-ingest` |
| Auth | `Authorization: Bearer <IMALAT_VEHICLE_INGEST_SECRET>` |
| Gövde | `Content-Type: application/json` |

Sunucuda `.env` içinde `IMALAT_VEHICLE_INGEST_SECRET` tanımlı olmalıdır.

### Payload örnekleri

**Giriş (`VEHICLE_INBOUND`):**

```json
{
  "eventType": "VEHICLE_INBOUND",
  "sourceDeliveryId": "550e8400-e29b-41d4-a716-446655440000",
  "companyName": "Örnek A.Ş.",
  "vehicleBrand": "Mercedes",
  "vehicleModel": "Axor",
  "chassisNo": "WDB123456789",
  "fuelLevel": "1/2",
  "mileageKm": 120000,
  "arrivedAt": "2026-05-08T07:30:00.000Z"
}
```

**Teslim (`VEHICLE_DELIVERED`):**

```json
{
  "eventType": "VEHICLE_DELIVERED",
  "sourceDeliveryId": "550e8400-e29b-41d4-a716-446655440000",
  "companyName": "Örnek A.Ş.",
  "deliveredAt": "2026-05-10T16:45:00.000Z"
}
```

İsteğe bağlı teslim anı okumaları (UI’da “Teslim” bölümünde gösterilir): `vehicleBrand`, `vehicleModel`, `chassisNo`, `fuelLevel`, `mileageKm` — tam JSON gövde `delivered_payload_json` sütununda saklanır; giriş detayları `payload_json` içinde kalır.

**Tek kart kuralı:** Veritabanında `sourceDeliveryId` benzersizdir; giriş ve teslim aynı satırda güncellenir (`arrived_at`, `delivered_at`). UI’da tek kart görünür.

İdempotent: aynı `VEHICLE_INBOUND` için (aynı `sourceDeliveryId`, `companyName`, `arrivedAt`) veya aynı `VEHICLE_DELIVERED` için (`sourceDeliveryId` ve `deliveredAt`) tekrar gönderiminde yeni satır oluşmaz; `already_processed: true`. Farklı alan gelirse kayıt güncellenir (ör. yanlışlıkla farklı saat ile inbound tekrarı).

### cURL örnekleri

```bash
curl -sS -X POST "http://localhost:3001/api/integrations/vehicle-delivery-ingest" \
  -H "Authorization: Bearer YOUR_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"eventType":"VEHICLE_INBOUND","sourceDeliveryId":"id-1","companyName":"Firma","arrivedAt":"2026-05-08T08:00:00.000Z"}'
```

```bash
curl -sS -X POST "http://localhost:3001/api/integrations/vehicle-delivery-ingest" \
  -H "Authorization: Bearer YOUR_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"eventType":"VEHICLE_DELIVERED","sourceDeliveryId":"id-1","companyName":"Firma","deliveredAt":"2026-05-09T17:00:00.000Z"}'
```

### Başarı / hata yanıt şekilleri

- Yeni kayıt: `{ "ok": true, "processed": true, "already_processed": false }` (HTTP 201)
- Yinelenen istek: `{ "ok": true, "processed": true, "already_processed": true }` (HTTP 200)
- Hata: `{ "ok": false, "error": "açıklama" }` (4xx / 5xx)

### Veritabanı

Şema güncellemesi için backend dizininde: `npx prisma migrate deploy` (veya geliştirme için `npx prisma db push`). Sunucu açılışında `ensureSchema` eksik tabloyu oluşturabilir.

## 📝 Lisans

MIT License

---

**Özünlü Damper** 🚛