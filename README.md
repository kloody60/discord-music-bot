# 🎵 Music Bot — بوت موسيقى ديسكورد مع لوحة تحكم

[العربية](#العربية) · [English](#english)

---

## العربية

برنامج مكتبي (ويندوز) يشغّل بوت موسيقى في ديسكورد، وتتحكم فيه من نافذة البرنامج بدون ما تكتب كود.

### المميزات
- 🎶 **تشغيل من أي رابط:** يوتيوب، تيك توك، انستغرام، ساوندكلاود، أو رابط صوت مباشر (كل اللي يدعمه yt-dlp). وتقدر تكتب اسم أغنية للبحث، وتضيف قوائم تشغيل كاملة.
- 📁 **مكتبتك الخاصة:** ارفع ملفات صوت أو فيديو من جهازك (سحب وإفلات)، أو أضف من رابط ويتحول mp3، وشغّلها بالبوت.
- 🔊 **سحب أصوات الديسكورد (Soundboard):** حمّل أصوات أي سيرفر فيه البوت، أو شغّلها بالبوت مباشرة.
- 🎛️ **لوحة تحكم:** اختر السيرفر والروم الصوتي، تحكم بالتخطي والإيقاف والتكرار والصوت والخلط والقائمة.
- 🔘 **أزرار داخل ديسكورد** تحت رسالة "يشتغل الآن" + أوامر سلاش (`/play` و`/skip` و`/queue`...).
- 🔄 **تحديث تلقائي:** البرنامج يشيّك على النسخ الجديدة من صفحة Releases وينزّلها لحاله، وتطلع لك رسالة تعيد التشغيل.

### التثبيت
1. حمّل `Music Bot Setup x.x.x.exe` من صفحة [Releases](../../releases).
2. شغّله واتبع الخطوات. المثبّت يدعم عدة لغات، ويظهر لك اختيار اللغة.
3. إذا ظهرت شاشة ويندوز الزرقاء "حماية جهازك"، اضغط **مزيد من المعلومات** ثم **تشغيل على أي حال**. (البرنامج غير موقّع رقميا، وهذا سبب التنبيه.)

### إنشاء البوت والحصول على التوكن (مهم)
كل شخص يحتاج بوت خاص فيه. التوكن هو **مفتاح البوت السري**، هو اللي يربط البرنامج ببوتك في ديسكورد.

1. ادخل https://discord.com/developers/applications وسجّل دخولك.
2. اضغط **New Application**، اكتب اسما، ووافق على الشروط.
3. من القائمة اليسار افتح **Bot**.
4. اضغط **Reset Token** وأكّد، ثم اضغط **Copy**. ⚠️ التوكن يظهر **مرة وحدة بس**. إذا ضاع ولّد غيره.
5. افتح البرنامج، والصق التوكن في خانة **توكن البوت**، واضغط **حفظ وتشغيل**. البرنامج يحفظه عندك على جهازك، وكل مرة تفتح البرنامج بعدها يشغّل البوت ويفتح اللوحة تلقائيا.
6. إذا قال لك "التوكن غير صحيح": تأكد إنك نسخت التوكن وليس رابطا، وإنه نص طويل فيه نقطتين، وبدون مسافات.

> 🔒 **لا تشارك التوكن مع أي أحد**، ولا تنشره في جيت هاب أو في ديسكورد. أي شخص عنده التوكن يتحكم ببوتك. إذا تسرّب، اضغط **Reset Token** فورا.

### إضافة البوت لسيرفرك
1. في صفحة تطبيقك افتح **General Information** وانسخ **Application ID**.
2. افتح هذا الرابط بعد ما تحط الرقم مكان `YOUR_APPLICATION_ID`:
```
https://discord.com/oauth2/authorize?client_id=YOUR_APPLICATION_ID&scope=bot%20applications.commands&permissions=3197952
```
3. اختر السيرفر واضغط **Authorize**. (لازم تكون أدمن، أو عندك صلاحية Manage Server.)

الصلاحيات اللي يطلبها: دخول القناة، الكلام، رؤية القنوات، إرسال الرسائل، تضمين الروابط، إرفاق الملفات. **ما تحتاج تفعّل أي Privileged Intent.**

### تنزيل yt-dlp
ما تحتاج تسوي شيء: البرنامج ينزّل yt-dlp **تلقائيا** أول ما تفتحه (من GitHub الرسمي)، ويحدّثه تلقائيا كل أسبوع. وإذا وقف يوتيوب قبلها، اضغط **تحديث الآن** في شاشة الإعدادات. أما **ffmpeg** (للتشغيل والتحويل) فهو مدمج داخل البرنامج، ما تحتاج تثبته (عبر حزمة `ffmpeg-static`، وهي تنزّل ملف ffmpeg منفصل تحت رخصته الخاصة).

### الاستخدام
- **من البرنامج:** اختر السيرفر والروم من فوق، واضغط **ادخل الروم**، والصق رابطا أو اكتب اسم أغنية واضغط **تشغيل**.
- **من ديسكورد:** ادخل قناة صوتية واكتب `/play` وبعدها الرابط أو الاسم.
- **أصوات السيرفر:** تبويب **أصوات ديسكورد** ← **أصوات هذا السيرفر** ← **▶ شغّل بالبوت**.

| الأمر | الوظيفة |
|---|---|
| `/play` | تشغيل من رابط أو بحث |
| `/playfile` | تشغيل ملف من مكتبتك |
| `/panel` | إرسال لوحة الأزرار |
| `/skip` `/pause` `/resume` `/stop` | تحكم |
| `/queue` `/shuffle` `/loop` `/volume` | القائمة والتكرار والصوت |
| `/sounds` | إرسال أصوات السيرفر كملفات |
| `/leave` | خروج البوت |

### مشاكل شائعة
- **البوت ما يظهر في الروم:** تأكد إن البرنامج مفتوح. البوت يشتغل بس وقت ما البرنامج مفتوح.
- **روابط انستغرام وتيك توك ما تشتغل:** بعضها يطلب تسجيل دخول. صدّر الكوكيز بصيغة Netscape وحط مسارها في متغير `COOKIES_FILE` (للتشغيل من الكود).
- **الأوامر ما تظهر:** تحتاج ثواني بعد أول تشغيل. أعد فتح ديسكورد.
- **أخطاء تظهر في شريط أحمر في البرنامج:** انسخ نصها وافتح Issue.

### التشغيل من الكود
```bash
git clone <repo-url>
cd <repo-folder>
npm install
npm start          # يفتح البرنامج
npm run dist       # يبني ملف التثبيت داخل dist/
```
البيانات (التوكن، المكتبة، yt-dlp) تُحفظ في مجلد بيانات التطبيق (`%APPDATA%\Music Bot`)، وليس داخل المشروع.

### تنبيه
البرنامج للاستخدام الشخصي. أنت المسؤول عن احترام حقوق النشر وشروط ديسكورد ويوتيوب وغيرها عند استخدام الروابط والملفات. لا تسحب محتوى سيرفرات ليس لك صلاحية عليها.

---

## English

A Windows desktop app that runs a Discord music bot, controlled from a built-in window. No coding needed.

### Features
- 🎶 **Play from any link:** YouTube, TikTok, Instagram, SoundCloud, direct audio links (anything yt-dlp supports), or search by name. Playlists supported.
- 📁 **Your own library:** upload audio/video files (drag & drop) or import from a link (converted to mp3), then play them through the bot.
- 🔊 **Discord soundboard:** download any server's soundboard sounds (where the bot is a member), or play them through the bot directly.
- 🎛️ **Control panel:** pick the server and voice channel; skip, pause, loop, volume, shuffle, queue.
- 🔘 **In-Discord buttons** under the "now playing" message, plus slash commands.
- 🔄 **Auto-update:** the app checks GitHub Releases for new versions, downloads them in the background and prompts you to restart.

### Install
1. Download `Music Bot Setup x.x.x.exe` from [Releases](../../releases).
2. Run it. The installer is multilingual and lets you pick a language.
3. If Windows SmartScreen warns you, click **More info → Run anyway**. (The app isn't code-signed.)

### Create your bot and get the token (important)
Everyone needs their own bot. The **token** is the bot's secret key; it's what connects this app to your bot.

1. Go to https://discord.com/developers/applications and sign in.
2. Click **New Application**, name it, accept the terms.
3. Open **Bot** in the left menu.
4. Click **Reset Token**, confirm, then **Copy**. ⚠️ The token is shown **only once**. If you lose it, reset again.
5. Open the app, paste the token into **Bot token**, click **Save & start**. It is stored locally on your PC, and from then on the app starts the bot and opens the panel automatically.
6. If it says the token is wrong: make sure you copied the token, not a link; it's one long string with two dots and no spaces.

> 🔒 **Never share your token**, and never commit it to GitHub or post it on Discord. Anyone with it controls your bot. If it leaks, click **Reset Token** immediately.

### Add the bot to your server
1. In your app page open **General Information** and copy the **Application ID**.
2. Open this link with your ID in place of `YOUR_APPLICATION_ID`:
```
https://discord.com/oauth2/authorize?client_id=YOUR_APPLICATION_ID&scope=bot%20applications.commands&permissions=3197952
```
3. Pick a server and click **Authorize** (you need Manage Server permission).

**No Privileged Gateway Intents are required.**

### Download yt-dlp
Nothing to do: the app downloads yt-dlp **automatically** on first launch (from the official GitHub releases) and refreshes it weekly. If YouTube breaks sooner, click **Update now** on the settings screen.

### Usage
- **In the app:** choose server + voice channel, click **Join**, paste a link or type a song name, click **Play**.
- **In Discord:** join a voice channel and type `/play` followed by a link or name.
- **Soundboard:** **Discord sounds** tab → **This server's sounds** → **▶ Play with bot**.

### Build from source
```bash
git clone <repo-url>
cd <repo-folder>
npm install
npm start          # run the app
npm run dist       # build the installer into dist/
```
User data (token, library, yt-dlp) lives in the app data folder (`%APPDATA%\Music Bot`), not in the project.

### Disclaimer
For personal use. You are responsible for respecting copyright and the terms of Discord, YouTube and other services. Don't scrape content from servers you don't have permission for.

### License
MIT
