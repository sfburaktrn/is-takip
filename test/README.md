# Test paketi (`test/`)

Bu klasör, **imalat takip** monoreposunun otomatik testlerini içerir. Amaç: iş kuralları ve HTTP API sözleşmesinin regresyona uğramaması.

## Nasıl çalıştırılır?

```bash
cd test
npm install
npm run test
```

Repo kökünden:

```bash
npm test
```

İzleme modu:

```bash
cd test
npm run test:watch
```

## Sonuç beklentisi

Başarılı çalıştırmada Vitest özetinde **tüm dosyalar yeşil**, örnek çıktı:

- `Test Files  N passed`
- `Tests  M passed`

Sayılar test eklendikçe artar; güncel değerleri yerelde `npm run test` çıktısından kontrol edin.

---

## Klasör yapısı ve dosyalar

| Yol | Tür | Amaç |
|-----|-----|------|
| `vitest.config.ts` | Yapılandırma | Vitest kökü, `@frontend` alias, test glob desenleri. |
| `tsconfig.json` | Yapılandırma | TypeScript / Vitest tipleri. |
| `package.json` | Yapılandırma | `vitest`, `supertest`, scriptler. |

### Birim testleri (`unit/`)

| Dosya | Ne doğrular? | Bağlantılı üretim kodu |
|--------|----------------|-------------------------|
| `capacity-schedule.test.ts` | Haftalık Pazartesi hesabı, aralık–hafta kesişimi, kapasite/hedef toplamlarının orantılı birleşimi (Prisma **mock** ile). | `backend/src/capacitySchedule.js` |
| `step-completion-sync.test.ts` | Damper/dorse/şasi için izlenen ana adımların tutarlılığı; `syncStepCompletionEvents` içinde create/delete davranışı (Prisma **mock**). | `backend/src/stepCompletionSync.js` |
| `tr-search.test.ts` | Türkçe arama yardımcıları (`trNorm`, `trIncludes`, `trStartsWithStok`). | `frontend/src/lib/trSearch.ts` |
| `frontend-date-helpers.test.ts` | Kapasite/verimlilik sayfalarındaki tarih normalizasyonu ile aynı mantığın tutarlılığı (yerel saat dilimine duyarlı assert). | `frontend` ilgili sayfalar |

**Sonuç:** Bu testler **veritabanı veya çalışan sunucu istemez**; saf mantık ve modül davranışı.

### Entegrasyon testleri (`integration/`)

| Dosya | Ne doğrular? | Ortam |
|--------|----------------|--------|
| `api.test.ts` | Express uygulaması üzerinden gerçek route zinciri: `health`, `health/db`, `dropdowns`, oturum (login/logout/me), `dampers`, kapasite uçları, admin/normal `/api/users` yetkisi. | `MOCK_PRISMA=1` → **gerçek PostgreSQL yok**; `backend/test-support/prismaMock.js` kullanılır. |

**Sonuç:** API’nin **JSON cevapları ve HTTP kodları** doğrulanır; veri katmanı mock’tur.

---

## Senaryo özeti (readme akışı)

1. **Fabrika takvimi / verimlilik haftası** → `capacity-schedule` testleri.  
2. **Bölüm tamamlanma olayları** → `step-completion-sync` testleri.  
3. **Türkçe müşteri araması** → `tr-search` testleri.  
4. **Tarih seçicileri** → `frontend-date-helpers` testleri.  
5. **REST API + oturum + yetki** → `api.test.ts`.

Gerçek PostgreSQL + `prisma migrate deploy` bu pakette **bilinçli olarak yoktur** (hız, izolasyon, CI kolaylığı). İleride `docker-compose` ile ayrı bir `integration/db` katmanı eklenebilir.

---

## Mock test kullanıcıları (yalnızca `api.test.ts`)

| Kullanıcı adı | Rol | Şifre (sadece test) |
|---------------|-----|----------------------|
| `testuser` | Normal | `password` |
| `adminuser` | Admin | `password` |

Bu hesaplar **yalnızca** `MOCK_PRISMA=1` iken geçerlidir; canlı veritabanında otomatik oluşturulmaz.

---

## Sorun giderme

- **`Cannot find module '../../backend/src/index.js'`**: Komutu `test/` içinden veya kökten `npm test` ile çalıştırın; klasör yapısı bozulmamış olmalı.  
- **Prisma bağlantı hatası**: Birim/entegrasyon testleri mock kullanır; hata alıyorsanız `MOCK_PRISMA` ortam değişkeninin test dosyasında set edildiğinden emin olun (mevcut `api.test.ts` bunu `beforeAll` içinde yapar).  
- **Port çakışması**: Testler sunucu **dinlemez**; port gerekmez.
