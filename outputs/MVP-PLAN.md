# Node.js File Server — MVP konumlandırma ve teknik plan

## 1. Ürün konumu

Proje üç ayrı tüketim seviyesinde yayınlanır:

1. **Core** — dosya yükleme, indirme, metadata ve storage sözleşmeleri. Framework veya deployment kararı dayatmaz.
2. **Template** — Core üzerine kurulmuş, kendi uygulamasına gömmeye uygun Fastify + TypeScript başlangıcı.
3. **Production starter kit** — auth, gözlemlenebilirlik, Docker, örnek reverse proxy, env şablonları, testler ve deployment dokümantasyonu eklenmiş çalışır servis.

Bu katmanlar aynı domain sözleşmelerini kullanır; starter kit Core’un davranışını fork ederek değiştirmez.

## 2. MVP kapsamı

### Dahil

- `multipart/form-data` ile tekli dosya yükleme
- Dosyayı stream ederek indirme ve HTTP range desteği
- Dosya listesi ve metadata sorgusu
- Dosya silme
- Dosya kimliği, orijinal ad, MIME türü, boyut, checksum ve oluşturulma zamanı
- Local filesystem storage adapter
- `Storage` ve `FileRepository` interface’leri; ileride S3-compatible adapter eklenebilir
- API key tabanlı servis auth; anahtarlar loglanmaz ve response içinde tekrar gösterilmez
- Maksimum dosya boyutu, izin verilen MIME türleri ve dosya adı/path traversal kontrolleri
- JSON hata sözleşmesi ve request ID
- `/health/live`, `/health/ready` ve temel OpenAPI dokümantasyonu
- Unit, integration ve container smoke testleri
- Docker image, `.env.example`, güvenli varsayılanlar ve README quick start

### MVP dışında

- Kullanıcı hesabı, ekip/tenant yönetimi ve web admin paneli
- Tus/resumable upload ve multipart S3 upload
- Virüs tarama, OCR, thumbnail/image processing
- CDN, signed URL, paylaşım linki ve quota/billing
- Tam arama motoru, event bus ve dağıtık job worker
- Cloud provider’a özel deployment otomasyonu

Bu maddeler Core API’sini bozmayacak extension noktaları olarak belgelenir; ilk sürümde zorunlu bağımlılık yapılmaz.

## 3. Önerilen teknoloji seçimleri

| Alan | Seçim | Gerekçe |
|---|---|---|
| Runtime | Node.js 20+ | LTS tabanı ve geniş hosting uyumluluğu |
| Dil | TypeScript, strict | Core sözleşmelerinde type safety |
| HTTP | Fastify | Düşük overhead, streaming ve plugin ekosistemi |
| Validation | Zod | Runtime input validation ve TypeScript türetimi |
| API docs | `@fastify/swagger` + OpenAPI 3 | Template/starter için otomatik dokümantasyon |
| Package manager | pnpm workspaces | Üç katmanı tek repo içinde net ayırma |
| Build | tsup | Core ve adapter paketleri için sade ESM/CJS çıktısı |
| Test | Vitest + Fastify inject | Hızlı unit/integration testleri, gerçek port gerektirmez |
| Metadata | SQLite + Drizzle (starter) | Local starter’da kurulumsuz kalıcılık; adapter ile değiştirilebilir |
| Storage | Local filesystem (MVP) | Harici servis olmadan çalışır; stream tabanlı |
| Formatting/lint | ESLint + Prettier | Katkı akışını standartlaştırır |
| Release | Changesets + GitHub Actions | Paket sürümleme ve CI yayın kapısı |

Not: Core paketi SQLite, Fastify ve Drizzle import etmez. Metadata persistence starter/template seviyesinde adapter olarak bağlanır.

## 4. Klasör yapısı

```text
.
├── apps/
│   └── server/                         # Production starter çalıştırılabilir servisi
│       ├── src/
│       │   ├── app.ts                  # Fastify composition root
│       │   ├── config.ts               # Env parsing ve güvenli varsayılanlar
│       │   ├── routes/                 # HTTP route/controller katmanı
│       │   ├── plugins/                # auth, swagger, request-id, error handler
│       │   └── server.ts               # process bootstrap
│       └── test/
├── packages/
│   ├── core/                           # Framework-agnostic domain + port’lar
│   │   └── src/
│   │       ├── domain/file.ts
│   │       ├── ports/storage.ts
│   │       ├── ports/file-repository.ts
│   │       ├── errors.ts
│   │       └── index.ts
│   ├── http-fastify/                   # Core use-case’lerini Fastify’a bağlar
│   │   └── src/
│   ├── storage-local/                  # Local filesystem adapter
│   │   └── src/
│   ├── repository-drizzle/             # SQLite/Postgres metadata adapter
│   │   └── src/
│   └── config/                         # Paylaşılan env ve public config şemaları
├── templates/
│   └── minimal-fastify/                # Core’u gömen sade başlangıç şablonu
├── docs/
│   ├── architecture.md
│   ├── configuration.md
│   ├── storage-adapters.md
│   └── deployment.md
├── examples/
│   └── curl/
├── docker/
├── .github/workflows/ci.yml
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── README.md
```

## 5. MVP API sözleşmesi

```text
POST   /v1/files                 multipart upload
GET    /v1/files                 paginated metadata list
GET    /v1/files/:id             metadata
GET    /v1/files/:id/content     streamed content + range
DELETE /v1/files/:id             delete metadata and content
GET    /health/live              process liveness
GET    /health/ready             storage/repository readiness
```

Upload response örneği:

```json
{
  "id": "01J...",
  "name": "report.pdf",
  "mimeType": "application/pdf",
  "size": 184320,
  "checksum": "sha256:...",
  "createdAt": "2026-09-22T12:00:00.000Z"
}
```

İlk sürümde dosya path’i kullanıcı girdisinden türetilmez. Storage key, server-side üretilen opaque ID üzerinden oluşturulur; orijinal dosya adı yalnızca metadata’dır.

## 6. Paket sınırları ve kalite kapıları

- `core`: domain testleri; Node/Fastify/DB bağımlılığı yok.
- `storage-local`: path traversal, atomik yazma, eksik dosya ve checksum testleri.
- `http-fastify`: auth, validation, range, hata response ve upload limit testleri.
- `apps/server`: gerçek SQLite + filesystem ile integration ve Docker smoke test.
- Her public package için README, exports map, changelog ve semantic versioning.
- CI sırası: install → typecheck → lint → unit/integration test → build → Docker smoke.
- Secret, absolute local path veya gerçek API key repoya alınmaz.

## 7. Uygulama sırası

1. Workspace, TypeScript config, lint/test/build komutları ve package exports.
2. Core domain modelleri, typed errors ve storage/repository port’ları.
3. Local filesystem adapter ve checksum/atomic-write davranışı.
4. Fastify HTTP adapter, auth, validation ve OpenAPI.
5. SQLite/Drizzle metadata adapter ve starter server.
6. Test matrix, Docker image, env şablonu ve deployment dokümanı.
7. Template ve starter ayrıştırması, Changesets, CI ve ilk release candidate.

## 8. MVP başarı ölçütü

Temiz bir makinede tek bir `pnpm install` ve `.env` kurulumu sonrasında servis ayağa kalkmalı; curl ile upload/list/download/delete akışı çalışmalı; servis yeniden başlatıldığında metadata ve dosya korunmalı; `pnpm check` typecheck, lint, test ve build adımlarını geçmelidir. Core paketi ise Fastify veya SQLite olmadan ayrı test edilebilir ve başka bir HTTP framework’e bağlanabilir durumda olmalıdır.

## 9. İlk karar özeti

İlk implementation slice için önerilen kapsam: `packages/core`, `packages/storage-local`, `packages/http-fastify` ve bunları kullanan minimal `apps/server`. Drizzle/SQLite, Docker ve CI bu slice’ın hemen ardından eklenir; böylece önce API ve storage davranışı doğrulanır, sonra production starter operasyonel katmanlarla tamamlanır.
