# Muhammad Ali — shaxsiy sayt

Asl **Hacker-Themed Creative Portfolio (Community)** React/Vite dizayni asosida. Frontend GitHub Pages’da, Telegram API esa alohida Cloudflare Worker’da ishlaydi.

## Ishga tushirish va tahrirlash

Node.js 22.18+ (yoki 24 LTS) o‘rnating. Ushbu README joylashgan loyiha papkasida:

```sh
npm ci
cp .env.example .env.local
npm run dev
```

`src/config/siteContent.ts` orqali ism, navigatsiya, Home matnlari, About, Skills, kontakt havolalari va forma xabarlarini tahrirlang. About/Skills matnlari va kontakt ma’lumotlari placeholder: ularni o‘zingiz to‘ldiring. Home’dagi boshqa asl matnlar saqlangan. CSS, ikonlar va animatsiyalar asl loyihadan olingan. About/Skills mavjud galereya kartalari va tafsilot modalidan foydalanadi; rasmlar asl loyihadan qolgan dekorativ placeholderlar.

`.env.local` ichida `VITE_CONTACT_API_URL` ni Worker’ning to‘liq `https://…workers.dev/contact` manziliga tenglang. O‘zgarishdan so‘ng Vite’ni qayta ishga tushiring. Bu qiymat ochiq; Telegram tokeni yoki chat ID sini hech qachon `VITE_` o‘zgaruvchilariga yozmang.

## Telegram va Cloudflare Worker

1. Telegram’dagi **@BotFather** orqali bot yarating va token oling. Shaxsiy chatda botga `/start` yuboring yoki uni kerakli guruhga qo‘shing. Telegram Bot API `getUpdates` javobidan kerakli `message.chat.id` ni oling. Tokenni skrinshot, git yoki loglarda ulashmang.
2. Backend dependencylarini o‘rnating va Cloudflare hisobiga kiring:

```sh
cd worker
npm ci
npx wrangler login
```

3. `wrangler.toml` dagi `ALLOWED_ORIGINS` ni saytning aniq originiga o‘zgartiring: `https://…github.io` yoki o‘z domeningiz. Repository yo‘lini va oxirgi `/` ni qo‘shmang. Bir nechta originni vergul bilan ajrating; production’da localhost’ni olib tashlang. `namespace_id` qiymatlari hisobingizdagi boshqa rate limiterlar bilan takrorlanmasin. Worker nomini xohlasangiz shu faylda o‘zgartiring.
4. Secretlarni terminal so‘roviga kiriting va backendni mustaqil deploy qiling:

```sh
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put TELEGRAM_CHAT_ID
npm run check
npm run build
npm run deploy
```

Worker Workers Free rejasiga mos, tashqi baza talab qilmaydi. Frontend endpointi deploy natijasidagi Worker URL + `/contact` bo‘ladi. Secretlar faqat Worker’da qoladi.

Lokal backend uchun `worker/.dev.vars.example` dan `.dev.vars` nusxa yarating, secretlarni kiriting va `npm run dev` bajaring. Frontend endpointini `http://localhost:8787/contact` qiling; origin `http://localhost:5173` bo‘lsin. `.dev.vars` va `.env.local` git’dan chiqarilgan.

Himoya: JSON va maydon validatsiyasi, 16 KiB body limiti, yashirin spam maydoni, forma ochilgandan kamida 3 soniya kutish, IP uchun 3/min va umumiy 30/min limit. Cloudflare hisoblagichlari har bir edge joylashuvida taxminiy ishlaydi; ular qat’iy global kvota emas. CORS ochiq endpoint uchun autentifikatsiya vazifasini bajarmaydi. Telegram matni `parse_mode` ishlatmaydi, link preview o‘chirilgan. Muvaffaqiyat faqat Telegram `ok: true` va `message_id` qaytarganda ko‘rsatiladi. Timeoutda yetkazish tasdiqlanmagan bo‘ladi; qayta yuborish dublikatga olib kelishi mumkin.

## GitHub Pages

1. Repository: `kmuhammadali/kmuhammadali.github.io`. React/Vite loyiha repository ildizida, `.github/workflows/deploy.yml` ham ildizda. Oldingi sayt fayllari `legacy/` ichida saqlangan; ular yangi build’ga kirmaydi.
2. **Settings → Pages → Source → GitHub Actions** ni tanlang.
3. **Settings → Secrets and variables → Actions → Variables** ichida `VITE_CONTACT_API_URL` ni Worker’ning to‘liq `/contact` endpointiga tenglang.
4. Default branch’ga push qiling yoki Actions’dan workflow’ni ishga tushiring. Workflow papkani aniqlaydi, `npm ci`, typecheck, test va build bajarib Pages’ga chiqaradi. Worker alohida deploy qilinadi.

Vite `base: './'` orqali assetlar domen ildizida ham, repository ostida ham ochiladi. Navigatsiya mavjud React holati bilan ishlaydi, server router yoki SPA rewrite talab qilmaydi. Credentiallar kodga kiritilmagan. API sozlanmasa frontend ochiladi, forma esa sozlama xatosini ko‘rsatadi.

## Tekshirish

```sh
npm run typecheck
npm test
npm run build
npm run preview
cd worker
npm run check
npm run build
```

Testlar validatsiya, CORS, spam, rate limit, Telegram xatolari/tasdig‘i, frontend javoblari va asl CSS, Home, Contact, Header va galereya klasslarini tekshiradi. Telegram chaqiruvlari testlarda mock qilinadi; haqiqiy delivery uchun deploy va secretlar zarur. Deploydan keyin desktop/mobil navigatsiya, uch karta va forma orqali haqiqiy test xabarini tekshiring.

Rasmiy qo‘llanmalar: [Vite Pages deploy](https://vite.dev/guide/static-deploy.html#github-pages), [Cloudflare rate limiting](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/), [Telegram sendMessage](https://core.telegram.org/bots/api#sendmessage).

## Amaldagi deploy sozlamalari

- Sayt: https://kmuhammadali.github.io
- Repository: https://github.com/kmuhammadali/kmuhammadali.github.io
- Worker: https://portfolio-contact.kmuhammadali.workers.dev
- Frontend endpointi: https://portfolio-contact.kmuhammadali.workers.dev/contact
- `ALLOWED_ORIGINS`: `https://kmuhammadali.github.io`
- `VITE_CONTACT_API_URL`: repository Actions variable sifatida sozlangan.
- Telegram tokeni va chat ID faqat Worker secretlari sifatida saqlanadi.

GitHub Pages Actions deploy usuliga o‘tkazildi; avvalgi `muhammad-ali.uz` redirecti olib tashlandi. Oldingi `CNAME` fayli `legacy/CNAME` ichida tarixiy nusxa sifatida qolgan. Mahalliy frontend/Worker typecheck, build, test va Worker dry-run bajarildi. Jonli forma orqali bitta `Portfolio deployment test` xabari yuborildi: Telegram tasdig‘i olindi, success statusi ko‘rsatildi va maydonlar tozalandi. Status logi eng yangi natijani avtomatik ko‘rsatadi.

Jonli saytda 1280×900 desktop va 390×844 mobil ko‘rinish, uch karta, mobil menyu, kontakt forma, assetlar, responsive Matrix kataklari, cursor/bounce animatsiyalari va 0.3s o‘tishlar tekshirildi. CORS ruxsat etilgan origin uchun 204, begona origin uchun 403 qaytardi. Terminal navigatsiya (`./home.exe`, `./about.sys`, `./skills.mov`, `./contact.sh`) asl tugma klasslari bilan tiklandi. Header haqiqiy balandligi o‘lchanadi: mobil ekran va ochiq menyuda terminal uning ostida 1rem masofa bilan to‘liq ko‘rinadi; keng ekranlarda asl markazlash saqlanadi. Matrix asl shrift, katak o‘lchami, 5% opacity va taymerlari bilan Home o‘lchamiga mos to‘ldiriladi.

## Admin CMS (feature branch)

CMS kodi `feature/admin-cms` branch’ida. Dashboard: `/admin/`. API shartnomasi, lokal tekshiruv va tasdiqdan keyingi Cloudflare/D1 deploy qadamlari: [CMS qo‘llanmasi](cms/README.md). Ushbu branch `main`’ga qo‘shilmaydi va production deploy bajarmaydi.

## Blog

CMS’dagi **Posts** bo‘limida maqola yarating va `published` holatini tanlang. Bosh sahifa eng yangi maqolalarni ikkitadan, raqamli sahifalash bilan ko‘rsatadi. To‘liq matn `/blog/:slug` manzilida ochiladi. TipTap muharririda sarlavha, qalin/kursiv/tagi chizilgan matn, ro‘yxat, iqtibos, havola va HTTPS rasmlar qo‘shish, undo/redo mavjud. Eski Markdown maqolalar formatlangan holda ochiladi va faqat matn tahrirlanganda yangi formatga o‘tadi. Yangi matnlar mavjud `content` maydonida versiyalangan, xavfsiz HTML sifatida saqlanadi; ko‘rsatishda ham ruxsat etilmagan teglar, atributlar va xavfli URL’lar tozalanadi. Migratsiya talab qilinmaydi. Rasm ixtiyoriy, sana va havolani nusxalash mavjud. Ko‘rishlar hisoblagichi qo‘shilmagan.

GitHub Pages uchun `public/404.html` to‘g‘ridan-to‘g‘ri maqola manzilini ildiz sahifaga xavfsiz yo‘naltiradi; ilova yuklangach maqola URL’ini tiklaydi. Shuning uchun yangi e’lon qilingan maqolalar uchun alohida build talab qilinmaydi. `/admin/` yo‘li bu fallback’dan foydalanmaydi.
