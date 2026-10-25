<div align="center">

<img src="web/icons/icon-192.png" width="110" alt="Isloh">

# Isloh

**Maqsad sari ongli hayot.**
Namoz vaqtlari va hisobi, soatma-soat kun rejasi, har kungi tahlil hamda ilm — bir joyda.

</div>

---

## Loyiha maqsadi

Isloh uch narsaga xizmat qiladi:

1. **Namoz.** Besh vaqt namoz kunning markazida turadi. Dastur namoz vaqtlarini ko'rsatadi, kirishidan 4–20 daqiqa oldin xabar beradi va o'qilgan namozlarni hisoblab boradi. Vaqti o'tib ketgunicha belgilanmagan namoz avtomatik qazo deb yoziladi.
2. **Ongli kun.** Kechqurun ertangi kunni soatma-soat rejalaysiz. Ertasi kuni har bir ish vaqtida Telegram'dan xabar keladi:
   - **«Boshlash»** tugmasini bosgan vaqtingiz yoziladi. Masalan, 05:00 dagi ishni 05:20 da boshlasangiz, 20 daqiqa kechikish hisoblanadi.
   - **«Tugatish»** tugmasidan keyin ish qancha davom etgani hisoblanadi va dastur «qanchalik yaxshi o'tdi?» deb so'raydi.
   - Kun shu ma'lumotlar asosida baholanadi.
3. **Dunyoqarash.** Yaxshi o'zbek podkastlari YouTube kanallaridan avtomatik yig'iladi va ilovada ko'rsatiladi. Kitob o'qish ham shu yerda kuzatiladi.

Qisqasi: inson maqsad qo'yadi, uni kunlarga bo'lib rejalaydi va har kuni shu maqsad sari amal qiladi. Bu yo'lda dinidan ham, ilmdan ham qolmaydi.

## Ishlash mexanizmi

```
                 ┌──────────────────────── Isloh serveri (Node.js) ────────────────────────┐
 Telegram bot ◄──┤  bot.js        ro'yxatdan o'tish, kirish kodi, tugmalar                    │
 @islohuzbot     │  scheduler.js  har 20 soniyada: eslatmalar, avtomatik qazo, PDF, uyqu     │
                 │  core.js       reja, ishlar, namozlar, uyg'onish/uxlash                   │
 Ilova (PWA) ◄───┤  analysis.js   kun balli, tarix, qidiruv, profil jadvallari               │
 kompyuter va    │  pdf.js        kunlik hisobot PDF (kutubxonasiz, ~10 KB)                  │
 telefon         │  feeds.js      YouTube podkastlarini yig'ish (RSS, kalitsiz)              │
                 │  prayer.js     namoz vaqtlari (namozvaqti.uz bilan kalibrlangan)          │
                 └──────────────────────────── SQLite (node:sqlite) ────────────────────────┘
```

- **Tashqi kutubxona yo'q.** Server faqat Node.js'ning o'zi bilan ishlaydi: `http`, `node:sqlite`, `fetch`, `zlib`.
- **Ilova yengil.** Butun veb-ilova taxminan 300 KB. Kompyuterda ham, telefonda ham «O'rnatish» (PWA) orqali alohida ilova sifatida ochiladi.
- **Xabarlar ikki joyga keladi.** Asosiysi Telegram bot. Ilova ochiq bo'lsa, xabar unda ham chiqadi (jonli oqim, SSE).

### 1. Ro'yxatdan o'tish

1. Ilova ochilganda 5 ta tanishtiruv sahifasi chiqadi: Isloh, Namoz, Ongli kun, Dunyoqarash, Tahlil.
2. So'ng **Kirish** sahifasi ochiladi. Telegram'da `@islohuzbot` → **Start**. Bot o'zbek va ingliz tillarida salomlashadi va «Kontaktni yuborish» tugmasini chiqaradi.
3. Kontakt yuborilgach, telefon raqamingizga hisob ochiladi va bot **6 xonali kod** beradi (3 daqiqa amal qiladi).
4. Kodni ilovaga kiritasiz va o'sha telefon raqamga tegishli hisobga kirasiz. Yangi kod kerak bo'lsa, botda `/kod` yoki «Yangi kod» tugmasi bor.
5. Keyin ism, tug'ilgan sana (kun, oy, yil), turish va uxlash vaqti hamda shahar so'raladi va ilova ochiladi.

### 2. Bosh sahifa

- **Katta soat:** soat, daqiqa, soniya, millisekund va undan kichik raqamlar. Ostida sana va hijriy sana.
- **Chapda bugungi namoz vaqtlari.** Hozirgi namoz katta va yorqin ko'rinadi. O'tganlari tepada kichik va xira, keyingilari pastda.
- **Navbatdagi namoz.** Vaqti yaqinlashgan sari keyingi namoz kattalashib, hozirgisi kichrayadi. Vaqt kirganda u fokusga chiqadi.
- **Fokusdagi namoz** yonida vaqt tugashiga yoki kirishiga qolgan vaqt va **«O'qidim»** tugmasi turadi.
- **Hozirgi ish** «Boshlash» yoki «Tugatish» tugmasi bilan ko'rinadi.
- Ertalab **«Turdim»**, kechqurun **«Uxladim»** tugmalari chiqadi.

### 3. Reja

- Kun **uyg'onishdan uxlashgacha** bo'lgan vaqt chizig'ida ko'rsatiladi.
- **Namoz vaqtlari qulflangan.** Namoz paytiga boshqa ish qo'yib bo'lmaydi (har namozga 15–30 daqiqa ajratiladi).
- **Nonushta va kechki ovqat** standart holatda qo'shilgan. Ularning vaqtiga ham boshqa ish qo'yilmaydi. Ovqat vaqti namozga to'g'ri kelsa, namozdan keyinga suriladi.
- **Ish qo'shish:** nomi, boshlanish va tugash vaqti, yo'nalishi (Ilm, Din, Ish, Sog'liq, Oila…). Bo'sh vaqt qatorini bossangiz, vaqt o'zi to'ldiriladi.
- **Takrorlash.** Bir marta yozib, «Har kuni», «Ish kunlari» yoki tanlangan kunlarni belgilaysiz. Ish har kungi rejaga o'zi chiqadi. Kerak bo'lmasa, o'chirib qo'yasiz.
- **Ogohlantirish.** Ustma-ust tushgan ish yoki namoz vaqtiga qo'yilgan ish nima bilan to'qnashgani aytilgan holda rad etiladi.
- **«Rejani tasdiqlash».** Tasdiqlangandan keyin 21:30 dagi eslatma kelmaydi.

### 4. Bir kunning yo'li (Telegram orqali)

| Vaqt | Nima bo'ladi |
|---|---|
| Turish vaqti (04:00) | «Xayrli tong! Turish vaqti» + **[Turdim]**. Bosilgan vaqt yoziladi. 10 daqiqadan keyin yana eslatadi. |
| Namozdan 4/10/15/20 daqiqa oldin | «Peshin namoziga 10 daqiqa qoldi». |
| Namoz kirganda | «Peshin vaqti kirdi» + **[O'qidim]**. Vaqt tugashidan 15 daqiqa oldin yana eslatadi. Belgilanmasa — qazo. |
| Ishdan 5 daqiqa oldin | «⏰ Ingliz tili (05:00–06:00)» + **[Boshlash]**. Bosilgan vaqtdan hisoblanadi. |
| Rejadagi tugash vaqti | **[Tugatish]**. Davomiylik hisoblanadi va 1–5 ⭐ baho so'raladi. |
| Ish 30 daqiqadan keyin ham boshlanmasa | «O'tkazib yuborilgan» deb belgilanadi. |
| 21:30 | «Ertangi kun rejasini tuzing» + ilovani ochish tugmasi. |
| Uxlashdan 5 daqiqa oldin | **Bugungi kun tahlili PDF** (bugungi kun va ertangi reja). |
| Uxlash vaqti | «Uxlash vaqti» + **[Uxladim]**. Shundan keyin uyg'onguncha bezovta qilinmaydi (faqat Bomdod vaqti kirishi xabar qilinadi). |

### 5. Tahlil algoritmi

Har bir ish uchun uchta ko'rsatkich hisoblanadi:

- **P — o'z vaqtida boshlash:** `1 − kechikish / rejadagi davomiylik`
- **C — bajarilish:** `haqiqiy davomiylik / rejadagi davomiylik` (1 dan oshmaydi)
- **Q — sifat:** `o'z bahongiz / 5` (baho berilmasa 0,6)

**Ish balli** = 0,3·P + 0,4·C + 0,3·Q. Boshlanmagan ish = 0.

**Kun balli** = 0,60 · ishlar + 0,25 · namozlar + 0,15 · uyqu intizomi.
- **Ishlar:** ish ballari, har biri davomiyligiga qarab hisobga olinadi.
- **Namozlar:** vaqtida o'qilganlar ulushi.
- **Uyqu intizomi:** turish va uxlash kechikishi. 60 daqiqa kechikishda bu ko'rsatkich 0 ga tushadi.

**Rang:**
- 🟩 80% va undan yuqori
- 🟨 50–79%
- 🟥 50% dan past yoki reja tuzilmagan

Misol: 05:00–06:00 dagi ish 05:20 da boshlandi va 06:05 da tugadi, baho 4. Bunda P = 0,67, C = 0,75, Q = 0,8, ish balli **74%**.

### 6. Tarix

- **Umumiy ko'rsatkichlar (30 kun):** o'rtacha ball, bajarilgan ishlar, namozlar va uyqu, hamda kunlik ballar grafigi.
- **Qidiruv:** sana (`26.10`, `2026-10-26`), oy (`oktabr`) yoki ish nomi (`kitob`) bo'yicha.
- **Kun sahifasi:**
  - ball va 6 ta ko'rsatkich;
  - reja va haqiqat chizmasi;
  - ishlar jadvali: kechikish, davomiylik, baho va ball;
  - namozlar, uyqu va xulosalar;
  - **PDF yuklab olish**.

### 7. Ilm

- **Podkastlar.** Kanallardan yangi videolar har 30 daqiqada avtomatik yig'iladi (YouTube RSS, kalit kerak emas). Videoni ilova ichida ko'rasiz. «Kanal qo'shish» maydoniga YouTube havolasi yoki `@nomi` yoziladi.
- **Kitoblar.** Ro'yxat, betlar bo'yicha progress va «+10 bet» tugmasi.

### 8. Profil

- **Telegram'dan olingan ma'lumotlar:** ism, @username, telefon. Bundan tashqari yosh va tug'ilgan sana.
- **Faollik jadvali** (GitHub uslubida): yashil — bajarildi, sariq — kam, qizil — bajarilmadi. Katakni bossangiz, o'sha kun ochiladi.
- **Namozlar jadvali.**
- **Sozlamalar:**
  - ism, tug'ilgan sana, shahar;
  - turish va uxlash vaqti, reja eslatmasi vaqti;
  - namozdan va ishdan qancha oldin eslatish;
  - namozga ajratiladigan vaqt;
  - **qorong'i yoki yorug' mavzu**;
  - ilova bildirishnomalari va chiqish.

## Ishga tushirish

Talab: **Node.js 22.13+** (boshqa kutubxona kerak emas). Linux'da doimiy xizmat sifatida o'rnatish:

```bash
./scripts/install-local.sh          # server + kompyuter yonganda avtomatik ishga tushish + ilovalar menyusida ikonka
~/.local/share/isloh/set-token.sh   # @BotFather bergan tokenni kiritish (ekranda ko'rinmaydi, Telegram orqali tekshiriladi)
```

- **Sozlamalar:** `~/.config/isloh/.env`
- **Ma'lumotlar:** `~/.local/share/isloh/data/isloh.db`
- **Holat va jurnal:** `systemctl --user status isloh` va `journalctl --user -u isloh -f`

### Telefonda ishlatish

O'rnatish skripti kompyuterda `cloudflared` bor-yo'qligini tekshiradi. Bor bo'lsa, **Cloudflare tunnel** xizmatini ham yoqadi. Tunnel serverga internetdan https manzil beradi (`https://....trycloudflare.com`), shundan keyin:

- Telegram'da **@islohuzbot** chatining chap pastidagi **«Isloh»** tugmasi ilovani Telegram ichida ochadi. Kirish **kodsiz va avtomatik** (Telegram imzosi tekshiriladi).
- Bot xabarlaridagi «Ilovani ochish» tugmalari kerakli bo'limni ochadi: reja, tarix va boshqalar.
- Manzilni telefon brauzerida ochib, **«Bosh ekranga qo'shish»** orqali ilova sifatida o'rnatish mumkin.

Bepul tunnel manzili kompyuter qayta yonganda o'zgaradi. Server buni o'zi sezadi: bot menyusini yangilaydi va sizga yangi havolani yuboradi. Doimiy manzil uchun o'z domeningizni ulang va `.env` dagi `PUBLIC_URL` ni to'ldiring.

### Ishlab chiqish

```bash
cp .env.example .env && npm run dev     # DEV_LOGIN=1: «Sinov rejimi: botsiz kirish»
npm test                                # butun bir kun simulyatsiyasi — 35 ta tekshiruv
```

Har bir push'da GitHub Actions (`.github/workflows/ci.yml`) Node 22 va 24 da quyidagilarni tekshiradi: sintaksis, kun simulyatsiyasi, server, API va PDF.

## Keyingi bosqichlar

- [x] Telegram ichida ochiladigan ilova (Mini App) va kodsiz kirish.
- [ ] Doimiy server va domen (hozir — kompyuterdagi xizmat va bepul tunnel).
- [ ] Play Market uchun Android ilova (`android/` — Capacitor qobig'i tayyor).
- [ ] AI yordamchi: kun tahlili bo'yicha maslahat, podkastlarni tavsiya qilish.
- [ ] Maqsadlar bo'limi: katta maqsadni kunlik ishlarga avtomatik bo'lish.

## Loyiha tuzilishi

```
server/        Node.js server (API, bot, jadval, tahlil, PDF, podkastlar)
scripts/       o'rnatish, bot tokeni va tunnel skriptlari
web/           Veb-ilova (PWA): index.html, app.js, style.css, sw.js
android/       Android qobig'i (keyingi bosqich uchun)
.env.example   Sozlamalar namunasi
```

Muallif: Muslimbek Olimov — [@olimovswe](https://github.com/olimovswe)
