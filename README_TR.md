<p align="center"><img src="src/assets/brand/kagetarget-mark.svg" width="96" alt="KageTarget logosu"></p>

# KageTarget

Chrome için hızlı, tarayıcı-native web keşif eklentisi. KageTarget aktif sayfayı veya açıkça girilen HTTP(S) hedefini Action Popup üzerinden kullanıcı isteğiyle inceler; isteğe bağlı Yan Panel çalışma alanı sunar.

## Özellikler

- Hızlı Özet; HTTP, güvenlik ve CSP başlık incelemesi
- robots.txt, security.txt ve sitemap.xml kontrolleri
- Bağlantılar, kaynaklar, formlar ve kanıta dayalı teknoloji ipuçları
- URL İnceleyici ve test edilmiş IPv4 Alt Ağ Hesaplayıcı
- Sınırlandırılmış statik HTML incelemesine sahip Manuel Hedef
- İngilizce/Türkçe arayüz ve KageTarget oturum/veri temizleme seçenekleri

## Kullanım

1. Normal bir HTTP(S) sitesi açın.
2. KageTarget toolbar ikonuna tıklayın.
3. Aktif sekme algılandığında **Analiz Et** düğmesine basın.
4. Özet, Web, Sayfa veya Araçlar kategorisini seçin.

**Manuel Hedef**, açık sekmeyi değiştirmeden başka bir HTTP(S) hedefini incelemeyi sağlar. Canlı mod render edilmiş sayfanın sınırlı metadata'sını okur. Uzak mod credential göndermeden istek yapar ve en fazla 512 KB HTML'i çalıştırılmayan statik document olarak ayrıştırır.

## Gizlilik

Hesap, analytics, telemetry, reklam, KageTarget backend'i veya kalıcı tarama geçmişi yoktur. Kullanıcının başlattığı ağ kontrolleri doğrudan seçilen hedefle iletişim kurar ve credential göndermez.

## Kaynaktan kurulum

```bash
npm install
npm run build
```

`chrome://extensions` sayfasında Developer Mode'u açın, **Load unpacked** seçeneğine basın ve `dist/` dizinini seçin.

## Sınırlamalar ve etik kullanım

Tarayıcının kısıtlı sayfaları incelenemez; browser politikaları bazı yanıtları sınırlayabilir; teknoloji tespiti sezgiseldir. KageTarget'ı yalnızca sahibi olduğunuz veya test etme yetkinizin bulunduğu sistemlerde kullanın.
