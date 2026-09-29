# Herbatium — versiune SaaS (cont, parolă, abonament lunar)

Aceasta e versiunea cu backend propriu a aplicației: utilizatorii își fac cont cu
email/parolă și plătesc un abonament lunar prin transfer bancar (clientul
declară durata aleasă și primește un cod unic de plată; tu confirmi plata în
extrasul de cont și activezi manual accesul din panoul de admin). Plata cu
cardul (Netopia) e pregătită ca opțiune viitoare, dar nu e încă activată în
UI ("disponibil în curând").

**Important, citește înainte de orice:** ca să poți încasa bani legal în
România, ai nevoie de obicei de o firmă înregistrată (PFA/SRL) + facturare.
Fără IBAN-ul configurat (secțiunea de mai jos), aplicația pornește dar
secțiunea de transfer bancar nu apare pe pagina de abonament. Baza de date
nu mai trebuie configurată separat — pornește automat, împreună cu
aplicația (vezi mai jos).

## Pornire rapidă (Docker — recomandat, „doar o rulez”)

Ai nevoie doar de [Docker Desktop](https://www.docker.com/products/docker-desktop/)
instalat (Mac, Windows sau Linux) — nu de Node.js, nu de PostgreSQL separat.
Aplicația ȘI baza ei de date pornesc împreună, într-un singur pas, iar
tabelele bazei de date se creează automat la prima pornire.

```bash
cd formulator-saas
cp .env.example .env
# deschide .env și completează cel puțin JWT_SECRET (orice șir lung, aleator)
# și ADMIN_PASSWORD (parola contului tău de administrator — vezi secțiunea
# "Contul tău de administrator" mai jos). Pentru plăți reale prin transfer
# bancar, completează și secțiunea BANK_TRANSFER_* — fără ea, aplicația
# pornește normal, doar secțiunea de transfer bancar nu apare încă.

./start.sh
```

Sau, dacă preferi comanda direct (`start.sh` face exact asta, plus câteva
verificări):
```bash
docker compose up -d --build
```

Aplicația va fi disponibilă la **http://localhost:3000**. Ca s-o oprești:
`docker compose down` (datele rămân — le regăsești la următoarea pornire).
Ca să vezi ce se întâmplă pe server: `docker compose logs -f app`.

Dacă schimbi mai târziu `prisma/schema.prisma` și rulezi `npx prisma migrate
dev --name ceva` **pe calculatorul tău** (nu în container) ca să generezi
fișierul de migrare, la următorul `docker compose up --build` migrarea nouă
se aplică automat — nu trebuie să faci nimic manual în container.

### Varianta fără Docker (Node + o bază de date externă)

Dacă preferi să rulezi direct cu Node.js și o bază de date PostgreSQL
separată (de exemplu un serviciu cloud), pașii sunt mai jos, în secțiunea 2.

### Windows, fără terminal — `start-herbatium.bat`

Pentru un coleg/colaborator care nu vrea să deschidă deloc un terminal:
copiază folderul aplicației oriunde pe calculator, apoi dublu-click pe
**`start-herbatium.bat`** (din rădăcina proiectului). Verifică automat dacă
Docker Desktop rulează, creează `.env` din exemplu la prima pornire (te
oprește să-l completezi), pornește aplicația și deschide automat browserul pe
`http://localhost:3000`. Pentru oprire: `stop-herbatium.bat`.

Singura cerință: [Docker Desktop](https://www.docker.com/products/docker-desktop/)
instalat pe acel calculator.

**Dacă Windows blochează fișierul** („Windows protected your PC" sau
„Deschidere fișier — Avertisment de securitate"): e normal pentru orice
fișier descărcat de pe internet de la un „editor necunoscut" — nu ține de
conținutul lui. Cel mai sigur mod de a scăpa de blocaj, care funcționează
mereu (spre deosebire de bifa „Unblock" din Properties, care uneori nu
apare deloc): deschide **PowerShell** în folderul aplicației și rulează:
```powershell
Get-ChildItem -Recurse | Unblock-File
```
Asta elimină marcajul „descărcat de pe internet" de pe toate fișierele din
folder dintr-o singură comandă, indiferent ce spune Properties. După asta,
dublu-click pe `start-herbatium.bat` ar trebui să meargă direct, fără niciun
avertisment.

### Instalator Windows (.exe) — opțional

Am inclus și un instalator compilat, `dist/Herbatium-Setup.exe`
(`installer/Herbatium.nsi` + NSIS), cu comenzi rapide pe Desktop/Meniul
Start. **Recomand totuși varianta `.bat` de mai sus** — un `.exe` nou,
nesemnat digital, de la un „editor necunoscut", e exact genul de fișier pe
care SmartScreen îl poate bloca dur, uneori fără să ofere deloc opțiunea
„Run anyway" (reputația fișierului se acumulează în timp la Microsoft, nu e
ceva controlabil din partea noastră fără un certificat de semnare cod —
vezi mai jos). Dacă vrei totuși `.exe`-ul, aceeași comandă PowerShell de mai
sus (`Unblock-File`) rezolvă blocajul cel mai sigur.

Dacă mai târziu cumperi un certificat de semnare cod (code signing, ~100-400$/an,
de la DigiCert/Sectigo etc., necesită o firmă înregistrată pe numele căreia
se emite), `.exe`-ul semnat nu mai declanșează niciun avertisment — dar e un
pas separat, nu ceva ce pot face eu.

Instalatorul e generat din codul din acest folder — dacă modifici aplicația,
regenerează-l cu:
```bash
cd installer
./build.sh
```
(are nevoie de NSIS: `apt-get install nsis` pe Linux, sau instalează NSIS pe
Windows de pe [nsis.sourceforge.io](https://nsis.sourceforge.io/)). Rezultatul
apare în `dist/Herbatium-Setup.exe`.

## 1. Ce e inclus

- `src/` — server Express (autentificare, date utilizator, poze, plăți prin transfer bancar)
- `prisma/` — structura bazei de date (PostgreSQL) + migrările deja generate
  (`prisma/migrations/`) — se aplică automat la pornire, nu trebuie rulate manual
- `public/` — front-end-ul: `login.html`, `register.html`, `abonament.html`
  (paywall), `app.html` (aplicația propriu-zisă, accesibilă doar cu cont
  activ), `data.js` (baza de 72 de ingrediente + restricții UE)
- `docs/` — registrul GDPR și procedurile aferente (document intern, nu se publică)
- `Dockerfile`, `docker-compose.yml`, `docker-entrypoint.sh` — pornirea
  aplicației cu o singură comandă (vezi secțiunea următoare)
- `start.sh` (Mac/Linux) și `start-herbatium.bat`/`stop-herbatium.bat`
  (Windows, dublu-click, fără terminal) — comenzi rapide de pornire/oprire
- `installer/` — sursa instalatorului Windows opțional (`Herbatium.nsi` +
  `build.sh`); rulează `installer/build.sh` ca să generezi `dist/Herbatium-Setup.exe`

## 2. Pași de configurare — varianta fără Docker (o singură dată)

Sari peste secțiunea asta dacă folosești `./start.sh` / Docker de mai sus —
acolo baza de date pornește automat și nu ai nevoie de Node.js instalat local.

### a) Node.js
Instalează Node.js 18+ dacă nu-l ai deja: https://nodejs.org

### b) Bază de date PostgreSQL
Cel mai simplu: un serviciu gratuit/ieftin de PostgreSQL — de exemplu
[Neon](https://neon.tech), [Supabase](https://supabase.com) sau
[Railway](https://railway.app). Creează o bază de date și copiază
connection string-ul (arată cam așa:
`postgresql://user:parola@host:5432/nume_db`).

### c) Cont bancar pentru încasare (transfer bancar)
Metoda de plată activă acum e transferul bancar manual: clientul vede
IBAN-ul tău pe pagina de abonament, alege pentru câte luni plătește, face
transferul, iar tu confirmi plata în extrasul de cont și activezi accesul
din panoul de admin (`/admin.html`). Nu ai nevoie de niciun cont la un
procesator extern pentru asta — doar de datele contului bancar în care vrei
să încasezi (secțiunea `BANK_TRANSFER_*` din `.env`, mai jos).

### d) Firmă / facturare (pentru bani reali)
Ca să încasezi bani legal de la clienți în UE, ai nevoie de obicei de o
firmă înregistrată (PFA sau SRL) și, la un moment dat, de emitere de facturi
(un soft românesc de facturare, sau facturare manuală — verifică cu un
contabil ce ești obligat să emiți în România). Acesta e un pas legal, nu
tehnic — nu-l pot face eu în locul tău.

### e) Configurare locală
```bash
cd formulator-saas
cp .env.example .env
# deschide .env și completează DATABASE_URL, JWT_SECRET, BANK_TRANSFER_IBAN,
# BANK_TRANSFER_HOLDER, APP_URL

npm install
npx prisma migrate dev --name init   # creează tabelele în baza de date
npm run dev                           # pornește serverul local, pe http://localhost:3000
```

## 3. Fluxul aplicației

1. `/register.html` — utilizatorul își face cont (email + parolă, stocată
   hash-uită cu bcrypt, niciodată în clar).
2. E redirecționat la `/abonament.html` — vede prețul lunar, alege pentru
   câte luni plătește și primește IBAN-ul tău plus un cod unic de plată.
3. Face transferul bancar, apasă „Am făcut transferul — anunță" (primești un
   email cu detaliile) și, după ce confirmi plata în extrasul de cont, îi
   activezi manual accesul din `/admin.html` — contul e marcat
   `subscriptionStatus: "active"`, iar utilizatorul ajunge pe `/app.html`.
4. Reînnoirea lunară e tot manuală, în același flux — nu există retragere
   automată din cont. Plata cu cardul (Netopia) e pregătită ca opțiune
   viitoare, dar încă marcată „disponibil în curând" în UI.
5. Din `/app.html`, butonul „Abonamentul meu" explică faptul că, pentru
   plata prin transfer bancar, gestionarea abonamentului (activare,
   reînnoire) se face direct de tine, nu printr-un portal de auto-servire.

## 3bis. Pagina publică de catalog (opțională)

Fiecare utilizator abonat poate activa, din tab-ul „Pagina publică", o pagină
simplă și publică (fără cont necesar să o vadă) la adresa
`/catalog/<slug-ales-automat>`, cu produsele bifate „vizibil public" din
tab-ul „Produse" — poze, nume, preț — plus linkuri către canalul lui real de
vânzare (Instagram, magazinul de pe Breslo/Etsy, site propriu). Nu procesează
comenzi sau plăți — e doar o pagină de prezentare/trimitere mai departe.
Există și un director public la `/catalog`, cu toți utilizatorii care au
activat pagina. Nu necesită niciun serviciu extern suplimentar — rulează pe
același server Express, cu datele deja din baza ta Postgres (câmpuri noi pe
tabela `User`: `publicPageEnabled`, `slug`, `businessName`, `bio`,
`catalogTemplate` și linkurile sociale — incluse deja în
`prisma/schema.prisma`).

**Modele vizuale.** Fiecare utilizator alege, tot din tab-ul „Pagina publică",
unul din 4 modele pentru pagina lui publică — se aplică instant la selectare:
„Cald Natural" (crem + teracotă), „Minimalist Alb-Negru" (elegant, chenare
fine), „Botanic Verde Închis" (fundal verde-închis, accent auriu) și „Pastel
Modern" (roz pudră, rotunjit). Modelele sunt definite în
`src/routes/catalog.js` (constanta `TEMPLATES`) — culorile, fonturile Google
și stilul de titluri pentru fiecare; lista din selector (`app.html`,
constanta `CATALOG_TEMPLATES`) trebuie ținută sincronizată cu id-urile de
acolo dacă adaugi sau redenumești un model.

## 3ter. Notificări email — digest zilnic (opțional)

Dacă completezi `RESEND_API_KEY` în `.env` (cont gratuit pe
[resend.com](https://resend.com), fără card la început), serverul trimite o
dată pe zi, la ora 8:00 (ora serverului), un email fiecărui utilizator cu
abonament activ care are ceva de raportat: loturi care expiră în
următoarele 30 de zile și/sau materii prime sub pragul minim de stoc setat
în tab-ul „Stoc". Dacă un utilizator n-are nimic de raportat în ziua
respectivă, nu primește niciun email. Fără `RESEND_API_KEY` setat, funcția e
complet inactivă (doar loghează un mesaj în consolă) — nu e nevoie de ea
pentru ca restul aplicației să funcționeze. Logica e în `src/notify.js`, un
singur fișier, fără dependențe noi (folosește `fetch`, disponibil nativ din
Node 18).

## 3quater. Instalabilă pe telefon (PWA)

Aplicația se poate instala ca o aplicație obișnuită, pe telefon (Android/iOS)
sau desktop — util mai ales pentru tab-urile de Stoc/Vânzări, completate des
direct din atelier. E nevoie de HTTPS (odată găzduită pe un domeniu real —
majoritatea platformelor din secțiunea 4 îl dau automat), nu funcționează cu
`http://localhost` decât în Chrome, ca excepție pentru testare locală.

- **Android (Chrome)**: la vizitarea `/app.html`, apare automat un banner
  „Adaugă pe ecranul principal", sau din meniul ⋮ → „Instalează aplicația”.
- **iPhone (Safari)**: Distribuie (pătratul cu săgeată) → „Adaugă pe ecranul
  principal” (Safari nu arată bannerul automat, dar funcționează la fel).
- **Desktop (Chrome/Edge)**: iconița de instalare din bara de adrese.

Tehnic: `public/manifest.json` + `public/service-worker.js` (cache simplu
pentru fișierele aplicației, ca să se deschidă rapid — nu interceptează
niciodată `/api/`, `/uploads/` sau `/catalog`, mereu cerute proaspăt de pe
server) + `public/icon.svg`. Iconița e una simplă, generică ("FN") — înainte
de lansare publică, înlocuiește-o cu o iconiță proprie (păstrează numele de
fișier `icon.svg`, sau actualizează calea din `manifest.json`).

## 3quinquies. Contul tău de administrator

Aplicația creează automat, la fiecare pornire, un cont de administrator —
separat de conturile clienților — cu care doar tu poți intra. Contul de
administrator:

- **are acces total, mereu**, indiferent de abonament (nu i se cere
  niciodată să plătească);
- vede un buton **„Administrare”** lângă emailul tău, sus în aplicație, care
  duce la `/admin.html` — un panou simplu cu numărul de conturi înregistrate,
  câte au abonament activ și lista lor;
- se conectează exact ca orice cont, din `/login.html`, cu emailul și parola
  din `.env`.

**Configurare** — în `.env`:

```
ADMIN_EMAIL="herbatium@gmail.com"
ADMIN_PASSWORD="parola-ta-lunga-si-sigura"
```

- `ADMIN_EMAIL` e deja completat cu adresa ta; schimb-o dacă vrei alta.
- `ADMIN_PASSWORD` trebuie schimbată din valoarea implicită înainte de a urca
  aplicația live — pune o parolă lungă și unică, nefolosită în altă parte.
- Dacă schimbi `ADMIN_PASSWORD` și repornești aplicația (`./start.sh` sau
  `docker compose up -d`), parola contului de administrator se actualizează
  automat — nu trebuie să ștergi sau să recreezi nimic manual.
- Dacă lași `ADMIN_EMAIL`/`ADMIN_PASSWORD` goale, aplicația pornește normal,
  dar fără cont de administrator.

**Atenție:** nu folosi la `ADMIN_EMAIL` adresa unui client existent — orice
cont cu acel email devine automat administrator (și primește parola din
`.env`) la următoarea pornire.

## 4. Găzduire (deploy) — cum o urci live pe internet

Aplicația e împachetată ca imagine Docker (`Dockerfile` + `docker-compose.yml`),
deci merge pe orice platformă care rulează containere Docker. Migrarea bazei
de date se aplică automat la fiecare pornire (`docker-entrypoint.sh`) —
nu trebuie s-o rulezi manual nici în producție.

### Varianta simplă — platforme cu Docker gata pregătit
[Railway](https://railway.app), [Render](https://render.com) sau
[Fly.io](https://fly.io) detectează automat `Dockerfile`-ul și au și bază de
date PostgreSQL inclusă, de adăugat separat ca serviciu (nu mai ai nevoie de
`docker-compose.yml` acolo — fiecare platformă își gestionează singură baza
de date, tu doar îi dai `DATABASE_URL`-ul generat de ea în variabilele de
mediu ale aplicației).

Pași generali:
1. Urcă codul pe GitHub (fără `.env` — e deja în `.gitignore`) și conectează
   repository-ul la platforma aleasă.
2. Adaugă un serviciu PostgreSQL din platformă și copiază `DATABASE_URL`-ul
   generat de acolo în variabilele de mediu ale aplicației (nu cele din
   `docker-compose.yml`, care sunt doar pentru rulare locală).
3. Completează restul variabilelor din `.env.example` direct în panoul
   platformei (`JWT_SECRET`, `BANK_TRANSFER_*`, `COMPANY_*`, `LEGAL_VERSION`).
4. Setează `APP_URL` la domeniul public real (ex. `https://herbatium.ro`) și
   `NODE_ENV=production`.

### Varianta cu control total — VPS propriu (Hetzner, DigitalOcean etc.)
Pe un VPS cu Docker instalat, `docker-compose.yml` funcționează neschimbat —
e exact același flux ca local:
```bash
git clone <repo-ul-tau> && cd formulator-saas
cp .env.example .env   # completează valorile reale de producție
docker compose up -d --build
```
Mai ai nevoie doar de:
- Un domeniu care să indice spre IP-ul VPS-ului.
- Un reverse proxy cu HTTPS automat în fața aplicației — cel mai simplu e
  [Caddy](https://caddyserver.com) (2 linii de config: domeniul tău →
  `localhost:3000`, certificatul SSL se reînnoiește singur) sau Nginx +
  Certbot, dacă preferi.
- Setează `APP_URL` în `.env` la adresa publică finală.

### Poze de produs — o notă pentru orice variantă de găzduire
Acest starter salvează pozele pe discul serverului (`uploads/` —
în Docker, e un volum separat, `herbatium_uploads`, care supraviețuiește
restart-urilor și rebuild-urilor). Dacă platforma de găzduire aleasă NU
păstrează discul între restart-uri (multe platforme „fără server" nu
păstrează, spre deosebire de un VPS sau de Railway/Render cu volum montat),
mută stocarea pe un serviciu dedicat (S3, Cloudflare R2, Cloudinary) — e o
schimbare izolată, doar în `src/routes/photos.js`.

## 5. Ce NU face acest starter (limitări asumate)

- Nu emite facturi fiscale automat — verifică obligațiile legale din
  România cu un contabil.
- Nu are resetare de parolă prin email (poate fi adăugată — are nevoie de
  un serviciu de trimis emailuri, ex. Resend/SendGrid).
- Nu are un flux de „trial gratuit" — abonamentul se cere din prima.
- Pozele sunt limitate la 8MB fiecare și stocate pe disc local (vezi mai
  sus pentru varianta de producție).
