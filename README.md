<div align="center">

<img src="web/icons/icon-512.png" width="110" alt="Isloh">

# Isloh

**Maqsad sari ongli hayot.**
Namoz vaqtlari va hisobi, soatma-soat kun rejasi, har kungi tahlil va ilm.
Shaxsiy kompyuterda ishlaydi, ro'yxatdan o'tish va barcha xabarlar Telegram bot orqali.

</div>

---

## Maqsad

1. **Namoz.** Besh vaqt namoz kunning markazida turadi. Kirishidan oldin xabar keladi, o'qilganlari hisoblanadi. Vaqti o'tib ketgunicha belgilanmagan namoz qazo bo'lib qoladi.
2. **Ongli kun.** Kechqurun ertangi kunni soatma-soat rejalaysiz. Ish vaqti kelganda bot xabar beradi:
   - **«Boshlash»** bosilgan paytdan kechikish hisoblanadi;
   - **«Tugatish»** bosilganda davomiylik hisoblanadi va baho so'raladi.
3. **Dunyoqarash.** Yaxshi podkastlar va kitoblar bir joyda yig'ilgan.

## Qanday ishlaydi

```
 Kompyuter (shu laptop)                                   Telegram
┌──────────────────────────────────────────────┐         ┌────────────────────────────┐
│ Isloh ilovasi (desktop oyna)                  │         │ @islohuzbot                 │
│  Bosh sahifa · Reja · Tarix · Ilm · Profil    │         │  • ro'yxatdan o'tish + kod  │
│               ▲                               │         │  • barcha eslatmalar        │
│ Isloh serveri (127.0.0.1, fon xizmati) ───────┼────────►│  • Boshlash/Tugatish/Baho   │
│  bot · eslatmalar jadvali · tahlil · PDF      │         │  • O'qidim/Turdim/Uxladim   │
│  SQLite baza                                  │         │  • har kecha PDF hisobot    │
└──────────────────────────────────────────────┘         └────────────────────────────┘
```

- Ilova **faqat shu kompyuterdan ochiladi**: server `127.0.0.1` da ishlaydi, tashqaridan kirib bo'lmaydi.
- Ro'yxatdan o'tish va xabarlar **faqat Telegram bot** orqali.
- Tashqi kutubxona yo'q: server Node.js'ning o'zida (`node:sqlite`, `fetch`), ilova oddiy HTML/CSS/JS.

### Ro'yxatdan o'tish
1. Ilova ochilganda tanishtiruv sahifalari, keyin «Kirish» sahifasi chiqadi.
2. Telegram'da **@islohuzbot** → **Start** → «Kontaktni yuborish».
3. Bot **6 xonali kod** beradi (3 daqiqa amal qiladi). Kodni ilovaga kiritasiz.
4. Ism, tug'ilgan sana, turish va uxlash vaqti, shahar so'raladi va ilova ochiladi.

### Bo'limlar
| Bo'lim | Nima bor |
|---|---|
| **Bosh sahifa** | Katta soat (soat, daqiqa, soniya va undan kichik raqamlar), sana, hijriy sana. Chapda bugungi namozlar: hozirgisi katta va yorqin, o'tganlari va keyingilari kichik va xira, vaqt yaqinlashgan sari keyingisi kattalashadi. Hozirgi ish va «O'qidim» tugmasi. |
| **Reja** | Uyg'onishdan uxlashgacha vaqt chizig'i. Namoz vaqtlari, nonushta va kechki ovqat qulflangan. Ish qo'shish: nomi, vaqti, yo'nalishi. Takrorlash: har kuni, ish kunlari yoki tanlangan kunlar. «Rejani tasdiqlash». |
| **Tarix** | 30 kunlik ko'rsatkichlar va grafik. Qidiruv: sana, oy yoki ish nomi. Har kun: ball, reja va haqiqat chizmasi, ishlar jadvali, namozlar, uyqu, xulosalar, PDF. |
| **Ilm** | YouTube podkastlari (kanallardan avtomatik yig'iladi, kanal qo'shish mumkin) va kitoblar. |
| **Profil** | Telegram ma'lumotlari (ism, @username, telefon), yosh. Faollik jadvali (GitHub uslubida) va namozlar jadvali. Sozlamalar: eslatma vaqti (4/10/15/20 daq), turish va uxlash vaqti, reja eslatmasi, qorong'i yoki yorug' mavzu. |

### Bir kun (bot xabarlari)
| Vaqt | Xabar |
|---|---|
| Turish vaqti | «Xayrli tong» + **[Turdim]** (kechikish hisoblanadi) |
| Namozdan oldin / vaqti kirganda | eslatma + **[O'qidim]**; belgilanmasa — qazo |
| Ishdan 5 daqiqa oldin | **[Boshlash]** → **[Tugatish]** → 1–5 ⭐ baho |
| 21:30 | «Ertangi kun rejasini tuzing» |
| Uxlashdan 5 daqiqa oldin | bugungi kun **PDF hisoboti** |
| Uxlash vaqti | **[Uxladim]** — uyg'onguncha bezovta qilinmaydi |

### Tahlil algoritmi
- **Ish balli** = 0,3·P + 0,4·C + 0,3·Q:
  - **P** — o'z vaqtida boshlash: `1 − kechikish / davomiylik`;
  - **C** — bajarilish: `haqiqiy / rejadagi davomiylik`;
  - **Q** — baho: `/5`.
- **Kun balli** = 0,60 · ishlar + 0,25 · namozlar + 0,15 · uyqu intizomi.
- **Rang:** 🟩 80% va undan yuqori, 🟨 50–79%, 🟥 50% dan past yoki reja tuzilmagan.

## O'rnatish (Linux)

Talab: **Node.js 22.13+**.

```bash
./scripts/install-local.sh          # o'rnatish: fon xizmati + ilovalar menyusida "Isloh"
~/.local/share/isloh/set-token.sh   # @BotFather bergan bot tokeni (ekranda ko'rinmaydi)
```

- **Ilova:** ilovalar menyusidan **Isloh**.
- **Sozlamalar:** `~/.config/isloh/.env`
- **Ma'lumotlar:** `~/.local/share/isloh/data/isloh.db`
- **Holat:** `systemctl --user status isloh` · **Jurnal:** `journalctl --user -u isloh -f`
- **Sinov:** `npm test` — butun bir kun simulyatsiyasi. GitHub Actions har push'da ham tekshiradi.

## Tuzilishi

```
server/    Node.js server: API, Telegram bot, eslatmalar jadvali, tahlil, PDF, podkastlar
web/       Ilova interfeysi (HTML, CSS, JS)
scripts/   o'rnatish va bot tokenini qo'yish
```

Muallif: Muslimbek Olimov — [@olimovswe](https://github.com/olimovswe)
