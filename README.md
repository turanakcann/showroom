# Dümenden Mühendis • Showroom ve atölye yönetimi

## Windows veya Ubuntu'da ilk çalıştırma

Node.js 24 LTS ile proje klasöründe çalıştır. Harici npm paketi kurulumu gerekmez.

```bash
npm run admin:reset
npm run dev
```

İlk komut admin kullanıcısına rastgele bir parola üretir. Terminalde bir kez gösterilen parolayı kaydet. İkinci komut vitrini başlatır. **http://localhost:3000/admin/** üzerinden giriş yap. Vitrin http://localhost:3000 adresindedir. Sunucunun terminaline erişebilen kişi aynı komutla parolayı yenileyebilir. Yenileme açık oturumları geçersiz kılar. İlk parola oluşturulana kadar vitrin ziyaret edilebilir.

## Paneli kullanma

- **Ürünler → Ürün ekle** formunda başlık, açıklama, kategori, ürün kodu, fiyat, etiketler, boyutlar ve baskı durumunu gir. Ürün adresini boş bırakırsan başlıktan türetilir. Fiyatı boş bırakınca ziyaretçi “Fiyat sor” görür.
- **Görseller** bölümünde JPG, PNG veya WebP dosyaları yükle. Her görsele açıklama ve tür ekleyebilir, sırayı değiştirebilir ve görseli galeriden kaldırabilirsin. İlk görsel kapaktır. Görseller dosya başına en çok 5 MB olabilir.
- **Filamentler** bölümünde renk adını, malzemeyi, renk kodunu ve stok durumunu yönet. Ürün düzenleme ekranındaki kutularla bir veya daha fazla filamenti bağla. Stokta olmayan filament ürün sayfasında seçilemez. Kullanımdaki bir filamenti silmek için önce bağlı ürünlerden kaldır.
- **Kaydet** ile değişiklik hemen vitrinde görünür. Bir ürünü açıp **Ürün sil** ile silebilirsin. Silinen ürün öne çıkarılmışsa listedeki ilk ürün onun yerini alır. Son ürün silinince vitrin boş katalogla çalışır.
- Ürünler listesindeki **örnek katalog** seçeneği tanıtım uyarısını yönetir. Gerçek fiyat ve stokları girdikten sonra kapat.
- Bir sekme kataloğu değiştirdiğinde diğer sekmedeki eski kayıt reddedilir. Sayfayı yenileyip düzenlemeyi güncel kayıt üzerinde tekrarla.

## Ubuntu • bağımsız Docker kurulumu

Docker Engine ve Compose eklentisini kur. Genel alan adını sunucuya yönlendir. Caddy'nin sertifika alabilmesi için alan adı ve sunucunun 80/443 portlarına dış erişim gerekir. Docker kurulum belgesi: https://docs.docker.com/engine/install/ubuntu/ • HTTPS: https://caddyserver.com/docs/automatic-https

```bash
cp .env.example .env
nano .env
docker compose up -d --build
docker compose exec showroom npm run admin:reset
```

.env dosyasında SHOWROOM_DOMAIN değerini kendi alan adınla değiştir. https://ALAN-ADIN/admin/ adresinde admin ve üretilen parolayı kullan. İlk girişte parolayı sohbette paylaşman gerekmez. Normal güncellemelerde parola sıfırlama komutunu tekrar çalıştırmana gerek yoktur.

Mevcut bir Caddy veya Nginx kullanıyorsan yalnızca Node hizmetini çalıştırabilir ve mevcut HTTPS sanal sunucunu ona yönlendirebilirsin. Docker dışı örnek:

```bash
SHOWROOM_DATA_DIR=/var/lib/showroom npm run admin:reset
HOST=127.0.0.1 PORT=3000 SHOWROOM_HTTPS=1 SHOWROOM_DATA_DIR=/var/lib/showroom npm start
```

Hizmet kullanıcısına veri dizininde yazma izni ver. Ters vekil gelen Host başlığını korumalıdır. Nginx için `proxy_set_header Host $http_host;` ve `proxy_pass http://127.0.0.1:3000;` kullan. HTTPS modunda oturum çerezi Secure olarak ayarlanır. Yerel testte HTTP için SHOWROOM_HTTPS değerini boş bırak.

## İlk sürümden geçiş ve yedekleme

1. Eski projedeki özelleştirilmiş `data/catalog.json` ve `public/assets/` dosyalarının yedeğini al. Yeni sürüme kendi kataloğunu ve kendi varlıklarını **ilk başlatmadan veya parola oluşturmadan önce** aktar. Mevcut özel görselleri koru.
2. Node servisi ilk çalıştırmada JSON kataloğunu SQLite'a alır. Sonraki ürün ve filament düzenlemelerini panelden yap. Uygulama açılışında veritabanının üzerine örnek veri yazılmaz.
3. Ürünler, stok, yeni yüklenen görseller ve yönetici parola özeti aynı veritabanında saklanır. Varsayılan dosya `var/showroom.sqlite`, Compose kalıcı birimi `showroom_data`. Görseli üründen kaldırma veya ürünü silme, paylaşılan yükleme verisini fiziksel olarak silmez.
4. Yedek için Node hizmetini kısa süre durdurup veri dizinini ve eski/özel `public/assets/` dosyalarını birlikte kopyala. Güncellerken aynı Compose proje adını ve veri birimini kullan. `docker compose down -v` kalıcı veriyi siler.
5. İlk sürümün statik yayını varsa yeni URL'leri Node uygulamasına yönlendir. `npm run build` yalnızca başlangıç JSON'undan statik kopya üretmek için korunur. Canlı yönetim paneli ve SQLite verileri için `npm start` veya Compose kullan.

Özel çevrimiçi önizlemenin kataloğu Ubuntu kataloğundan bağımsızdır. Önizlemede yetkilendirme site sahibinin ChatGPT hesabı üzerinden yapılır.
