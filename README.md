<div align="center">

<img src="ui/icons/icon-512.png" width="110" alt="Isloh">

# Isloh

**Maqsad sari ongli hayot.**
Namoz vaqtlari va hisobi, soatma-soat kun rejasi, har kungi tahlil va ilm.
Shu kompyuterdagi desktop dastur. Ro'yxatdan o'tish va barcha xabarlar Telegram bot orqali.

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
│ Isloh — desktop dastur                        │         │ @islohuzbot                 │
│  oyna: Bosh sahifa · Bugun · Eslatmalar ·     │         │  • ro'yxatdan o'tish + kod  │
│        Ilm · Profil                           │         │  • barcha eslatmalar        │
│  ichida: bot · eslatmalar jadvali · tahlil ·  ├────────►│  • Boshlash/Tugatish/Baho   │
│          PDF · SQLite baza                    │         │  • O'qidim/Turdim/Uxladim   │
│  oyna yopilsa trayda ishlashda davom etadi    │         │  • har kecha PDF hisobot    │
└──────────────────────────────────────────────┘         └────────────────────────────┘
```

- **Faqat desktop dastur** (Electron): veb-sayt, server yoki port yo'q. Oyna dastur yadrosi bilan to'g'ridan-to'g'ri gaplashadi.
- Ro'yxatdan o'tish va xabarlar **faqat Telegram bot** orqali.
- Oyna yopilganda dastur trayda qoladi, kompyuter yonganda o'zi ishga tushadi — eslatmalar to'xtamaydi. To'liq chiqish: tray → «Chiqish».

### Ro'yxatdan o'tish
1. Dastur ochilganda tanishtiruv sahifalari, keyin «Kirish» sahifasi chiqadi.
2. Telegram'da **@islohuzbot** → **Start** → «Kontaktni yuborish» (ro'yxatdan o'tgan bo'lsangiz — **/kod**).
3. Bot **6 xonali kod** beradi (3 daqiqa amal qiladi). Kodni dasturga kiritasiz.
4. Ism, tug'ilgan sana, turish va uxlash vaqti, shahar so'raladi va dastur ochiladi.

### Bo'limlar
| Bo'lim | Nima bor |
|---|---|
| **Bosh sahifa** | Katta soat (soat, daqiqa, soniya va undan kichik raqamlar), sana, hijriy sana. Chapda bugungi namozlar: hozirgisi katta va yorqin, qolganlari xira. Hozirgi ish va «O'qidim» tugmasi. |
| **Bugun** | Istalgan kun rejasi (bugun, ertaga, indinga — kalendardan tanlanadi). Besh vaqt namoz ro'yxati: hozirgisi «HOZIR» bilan belgilanadi, o'qilganda doirachani bosasiz. Har namoz ostida «+ … dan keyin qo'shish». Tezkor qo'shish (**Ctrl K**): «Ingliz tili 19:00 45daq #ilm» kabi yozsangiz vaqt, davomiylik va yo'nalish o'zi ajratiladi; «Batafsil» — to'liq shakl. O'ngda namoz halqasi (keyingi namozgacha qolgan vaqt) va oy kalendari. Ish vaqti kelganda bot xabar beradi. |
| **Eslatmalar** | Nimani eslatishni yozasiz, kun (Bugun/Ertaga yoki sana) va vaqtni tanlaysiz — aynan o'sha vaqtda bot «🔔 Eslatma» yuboradi (uyqu paytida ham). Matnga «18:30» yozsangiz vaqt o'zi qo'yiladi; tezkor tugmalar: 15 daqiqadan keyin, 1 soatdan keyin, Bugun 21:00, Ertaga 08:00. Yuborilganlarni qayta eslatish yoki o'chirish mumkin. |
| **Ilm** | YouTube podkastlari (kanallardan avtomatik yig'iladi, kanal qo'shish mumkin) va kitoblar. |
| **Profil** | Telegram ma'lumotlari (ism, @username, telefon), yosh. Faollik jadvali (GitHub uslubida) va namozlar jadvali. Sozlamalar: eslatma vaqti, turish va uxlash vaqti, reja eslatmasi, shahar, qorong'i yoki yorug' mavzu. |

### Bir kun (bot xabarlari)
| Vaqt | Xabar |
|---|---|
| Turish vaqti | «Xayrli tong» + **[Turdim]** (kechikish hisoblanadi) |
| Namozdan oldin / vaqti kirganda | eslatma + **[O'qidim]**; belgilanmasa — qazo |
| Ishdan oldin | **[Boshlash]** → **[Tugatish]** → 1–5 ⭐ baho |
| 21:30 | «Ertangi kun rejasini tuzing» (ertaga uchun hali ish qo'shilmagan bo'lsa) |
| Uxlashdan 5 daqiqa oldin | bugungi kun **PDF hisoboti** |
| Uxlash vaqti | **[Uxladim]** — uyg'onguncha bezovta qilinmaydi (o'zingiz qo'ygan eslatmalardan tashqari) |
| Siz qo'ygan vaqt | **🔔 Eslatma** — matningiz bilan |

### Tahlil algoritmi
- **Ish balli** = 0,3·P + 0,4·C + 0,3·Q:
  - **P** — o'z vaqtida boshlash: `1 − kechikish / davomiylik`;
  - **C** — bajarilish: `haqiqiy / rejadagi davomiylik`;
  - **Q** — baho: `/5`.
- **Kun balli** = 0,60 · ishlar + 0,25 · namozlar + 0,15 · uyqu intizomi.
- **Rang:** 🟩 80% va undan yuqori, 🟨 50–79%, 🟥 50% dan past yoki reja tuzilmagan.

## O'rnatish (Linux)

Talab: **Node.js 22.13+** va npm (faqat yig'ish uchun).

```bash
./scripts/install.sh                # yig'ish va o'rnatish: ilovalar menyusida "Isloh"
~/.local/share/isloh/set-token.sh   # @BotFather bergan bot tokeni (ekranda ko'rinmaydi)
sudo ./scripts/apparmor.sh          # ixtiyoriy, bir marta: Ubuntu'da to'liq Chromium sandbox
```

- **Dastur:** ilovalar menyusidan **Isloh**; kompyuter yonganda trayda o'zi ishga tushadi.
- **Sozlamalar:** `~/.config/isloh/.env`
- **Ma'lumotlar:** `~/.local/share/isloh/data/isloh.db`
- **Jurnal:** `~/.local/share/isloh/isloh.log`
- **Sinov:** `npm test` — butun bir kun simulyatsiyasi. GitHub Actions har push'da ham tekshiradi va dasturni yig'adi.
- **Ishlab chiqish:** `npm start` — dasturni manba kodidan ochadi.

## Tuzilishi

```
desktop/   Electron: oyna, tray, avtomatik ishga tushish, IPC ko'prik
core/      Dastur yadrosi: Telegram bot, eslatmalar jadvali, tahlil, PDF, podkastlar, SQLite
ui/        Oyna interfeysi (HTML, CSS, JS)
scripts/   o'rnatish va bot tokenini qo'yish
```

Muallif: Muslimbek Olimov — [@olimovswe](https://github.com/olimovswe)
