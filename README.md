# Portföy Radar

Portföy Radar, sahibinden satılık veya kiralık ilanları fırsata dönüştürmek için
tasarlanan mobil öncelikli bir takip uygulamasıdır.

Bu ilk dilim yalnızca temel proje altyapısını içerir:

- Next.js App Router ve strict TypeScript
- Tailwind CSS ile mobil öncelikli başlangıç ekranı
- Türkçe, `Europe/Istanbul` ve `TRY` çalışma varsayımları
- Güvenli ve önbelleğe alınmayan sistem durumu uç noktası
- Türkçe hata, bulunamadı ve yüklenme durumları
- ESLint, TypeScript, Vitest ve üretim derlemesi kalite kapıları

Kimlik doğrulama, Supabase bağlantısı ve iş alanı tabloları sonraki görevlerin
kapsamındadır.

## Gereksinimler

- Node.js 20.9 veya daha yeni
- pnpm 11

## Yerel geliştirme

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

Uygulama varsayılan olarak `http://localhost:3000` adresinde çalışır.

## Kontroller

```bash
pnpm check
```

Komut sırasıyla kod kalitesi, tip kontrolü, otomatik testler ve üretim
derlemesini çalıştırır.

## Güvenlik

- `.env` dosyaları Git tarafından izlenmez; `.env.example` gizli değer içermez.
- Sistem durumu uç noktası yalnızca açık ve doğrulanmış çalışma ayarlarını döndürür.
- Hata yanıtları ortam değişkenlerinin açık değerlerini içermez.
- Bu dilimde kişisel veri veya kalıcı veri deposu bulunmaz.
