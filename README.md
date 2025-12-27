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

## 📝 Lisans

MIT License

---

**Özünlü Damper** 🚛