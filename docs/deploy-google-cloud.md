# Backend-ul pe Google Cloud — tutorial pas cu pas

Rezultatul final:

- **https://csekeyboards.com**: magazinul (storefront-ul), pe Vercel. Este deja făcut.
- **https://api.csekeyboards.com**: tot backend-ul, pe o singură mașină virtuală Google Cloud
  (Compute Engine). Include cele 10 servicii, PostgreSQL, Redis, Kafka și Caddy, care se ocupă de HTTPS.

Este o instalare de **demo**, nu arhitectura de producție. Producția reală este Kubernetes pe
AWS ([infrastructure/terraform](../infrastructure/terraform/README.md)). Limitările sunt descrise la
[sfârșit](#limitări-de-știut).

**Timp:** aproximativ 1 oră, din care 30–45 de minute așteptare cât se construiesc imaginile.
**Cost:** aproximativ 50–60 $/lună pentru mașina virtuală (e2-standard-2, 8 GB RAM, disc de 50 GB) și
IP-ul static. Prețul exact îl vezi în [calculatorul Google Cloud](https://cloud.google.com/products/calculator).
Dacă ai credit gratuit pe cont, se consumă întâi din el.

Toate comenzile de mai jos se copiază și se lipesc. Cele de la pașii 1–8 se rulează în
**Cloud Shell**, un terminal din browser, deja conectat la contul tău. Cele de la pașii 9–10
se rulează **pe mașina virtuală**.

---

## Pasul 1 — Deschide Cloud Shell în proiectul potrivit

1. Intră pe https://console.cloud.google.com.
2. Sus, lângă logo, alege proiectul **cse-keyboard**. În el este domeniul.
3. Sus în dreapta apasă iconița **Activate Cloud Shell** (`>_`). Jos se deschide un terminal.
4. Rulează:

```bash
gcloud config set project cse-keyboard
```

## Pasul 2 — Verifică facturarea

```bash
gcloud billing projects describe cse-keyboard --format="value(billingEnabled)"
```

Trebuie să afișeze `True`. Dacă afișează `False`, mergi la **Billing** în consolă și leagă un
cont de facturare de proiect.

> **Recomandat:** setează o alertă de buget, ca să afli din timp dacă ceva costă mai mult decât
> te aștepți. În consolă: **Billing → Budgets & alerts → Create budget**, de exemplu 70 $/lună,
> cu email la 50%, 90% și 100%.

## Pasul 3 — Pornește serviciul Compute Engine

```bash
gcloud services enable compute.googleapis.com
```

Durează aproximativ un minut.

## Pasul 4 — Rezervă o adresă IP fixă

O adresă fixă nu se schimbă la repornirea mașinii, deci DNS-ul rămâne valabil.

```bash
gcloud compute addresses create cse-api-ip --region=europe-west3
gcloud compute addresses describe cse-api-ip --region=europe-west3 --format="value(address)"
```

A doua comandă afișează IP-ul, de exemplu `34.159.12.34`. Îl folosești la pasul 6.

`europe-west3` este Frankfurt, aproape de România.

## Pasul 5 — Deschide doar porturile web

```bash
gcloud compute firewall-rules create cse-allow-web \
  --network=default \
  --allow=tcp:80,tcp:443,udp:443 \
  --target-tags=cse-api \
  --source-ranges=0.0.0.0/0
```

Regula deschide doar HTTP și HTTPS. Bazele de date, Redis și Kafka **nu** se deschid: ele rămân
accesibile doar din interiorul mașinii. Conexiunea SSH (portul 22) este deja permisă de regula
implicită a rețelei și se face doar cu chei, fără parole.

## Pasul 6 — Creează mașina virtuală

```bash
gcloud compute instances create cse-api \
  --zone=europe-west3-a \
  --machine-type=e2-standard-2 \
  --image-family=ubuntu-2404-lts-amd64 \
  --image-project=ubuntu-os-cloud \
  --boot-disk-size=50GB \
  --boot-disk-type=pd-balanced \
  --address=cse-api-ip \
  --tags=cse-api \
  --shielded-secure-boot --shielded-vtpm --shielded-integrity-monitoring
```

Dacă primești o eroare de tipul _"zone does not have enough resources"_, înlocuiește
`europe-west3-a` cu `europe-west3-b` aici și în toate comenzile de mai jos.

## Pasul 7 — Leagă `api.csekeyboards.com` de mașină

```bash
IP=$(gcloud compute addresses describe cse-api-ip --region=europe-west3 --format="value(address)")
gcloud dns record-sets create api.csekeyboards.com. \
  --zone=csekeyboards-com --type=A --ttl=300 --rrdatas="$IP"
```

Verifică după un minut:

```bash
dig +short api.csekeyboards.com
```

Trebuie să afișeze același IP. Dacă nu afișează nimic, mai așteaptă 2–3 minute.
**Nu trece mai departe până nu vezi IP-ul:** fără DNS corect, certificatul HTTPS de la pasul 9
nu poate fi obținut.

## Pasul 8 — Conectează-te la mașină

```bash
gcloud compute ssh cse-api --zone=europe-west3-a
```

Prima dată ți se cere să creezi o cheie SSH. Apasă Enter la toate întrebările, sau pune o
parolă pe cheie dacă vrei. Promptul se schimbă în ceva de forma `tau_user@cse-api:~$`: acum
ești pe mașina virtuală.

## Pasul 9 — Instalează și pornește backend-ul (pe mașina virtuală)

Instalarea durează 30–45 de minute. Ca să nu se oprească dacă se închide fereastra, o rulezi
într-o sesiune `tmux`:

```bash
tmux new -s setup
```

Apoi:

```bash
git clone --depth 1 --branch claude/mechanical-keyboard-ecommerce-irdl65 \
  https://github.com/CiupituStefan/Market-place.git
cd Market-place
deploy/gcp-vm/setup-vm.sh csekeyboards.com adresa-ta@gmail.com
```

Al doilea argument este emailul tău. Let's Encrypt îl folosește doar pentru avertismente
despre certificat.

Scriptul face singur toate etapele, afișând `1/5` … `5/5`:

1. instalează Docker, din depozitul oficial Docker;
2. adaugă 4 GB de swap, ca build-ul să nu rămână fără memorie;
3. creează `deploy/gcp-vm/.env` cu setările pentru domeniul tău și **o parolă de admin generată
   aleator**. Fișierul nu ajunge în Git;
4. construiește imaginile, pe rând;
5. pornește serviciile, așteaptă ca fiecare să fie sănătos și rulează seed-urile: catalogul,
   stocul, codurile de reducere și contul de admin.

**Dacă ți se închide conexiunea:** reconectează-te (pasul 8), apoi rulează
`tmux attach -t setup`. Instalarea a continuat între timp.

La final scriptul afișează:

```
Backend started. Check:  curl https://api.csekeyboards.com/health/ready
Admin: admin@csekeyboards.com
       password in /home/.../Market-place/deploy/gcp-vm/.env (ADMIN_PASSWORD)
```

Afișează parola de admin și **salveaz-o** într-un manager de parole:

```bash
grep ADMIN_PASSWORD deploy/gcp-vm/.env
```

## Pasul 10 — Verifică backend-ul

```bash
curl https://api.csekeyboards.com/health/ready
curl "https://api.csekeyboards.com/api/v1/products?pageSize=1"
```

Prima comandă trebuie să răspundă cu starea serviciilor, a doua cu un produs, în format JSON.
Poți deschide aceleași adrese și în browser.

## Pasul 11 — Spune-i magazinului unde este API-ul (Vercel)

1. Intră pe https://vercel.com → echipa **Gogan** → proiectul **cse-keyboard**.
2. **Settings → Environment Variables** → adaugă:
   - Key: `NEXT_PUBLIC_API_URL`
   - Value: `https://api.csekeyboards.com`
   - Environments: **Production**, apoi **Save**.
3. **Deployments** → la ultimul deploy de producție apasă **⋯ → Redeploy**. Este obligatoriu:
   valoarea intră în site doar la build.

Poți să-mi ceri să fac eu acest pas, dacă CLI-ul Vercel este încă autentificat în sesiune.

## Pasul 12 — Testează magazinul

1. Deschide **https://csekeyboards.com**: trebuie să apară produsele.
2. Pune o tastatură în coș → **Checkout** → completează adresa → **Place order**.
3. Pe pagina comenzii apasă **Pay … (test)**. Plata este simulată: nu se ia niciun ban.
   Comanda trebuie să ajungă la **Paid** în câteva secunde.
4. Back-office: **https://csekeyboards.com/admin**. Te autentifici cu
   `admin@csekeyboards.com` și parola de la pasul 9.

---

## Utilizare zilnică (pe mașina virtuală, în `~/Market-place`)

| Ce vrei                        | Comanda                                                        |
| ------------------------------ | -------------------------------------------------------------- |
| Starea serviciilor             | `deploy/gcp-vm/dc ps`                                          |
| Log-urile unui serviciu        | `deploy/gcp-vm/dc logs -f --tail 100 order-service`            |
| Repornirea unui serviciu       | `deploy/gcp-vm/dc restart cart-service`                        |
| Actualizare după un commit nou | `git pull && deploy/gcp-vm/setup-vm.sh csekeyboards.com email` |
| Emailurile trimise de magazin  | vezi mai jos                                                   |

**Emailurile** (confirmări de comandă, verificarea contului) nu pleacă spre adrese reale. Ajung
în Mailpit, pe mașină. Ca să le vezi, rulează în **Cloud Shell**:

```bash
gcloud compute ssh cse-api --zone=europe-west3-a -- -N -L 8080:localhost:8025
```

Apoi apasă **Web Preview → Preview on port 8080** în bara Cloud Shell. Se deschide Mailpit cu
toate emailurile. Comanda rămâne pornită cât timp te uiți; o oprești cu Ctrl+C.

**Backup zilnic al discului (opțional, recomandat), din Cloud Shell:**

```bash
gcloud compute resource-policies create snapshot-schedule cse-daily \
  --region=europe-west3 --max-retention-days=7 --daily-schedule --start-time=03:00
gcloud compute disks add-resource-policies cse-api \
  --zone=europe-west3-a --resource-policies=cse-daily
```

## Oprire și ștergere (din Cloud Shell)

Ca să **oprești temporar** mașina, ca să nu plătești procesorul și memoria:

```bash
gcloud compute instances stop cse-api --zone=europe-west3-a
gcloud compute instances start cse-api --zone=europe-west3-a   # pornire din nou; serviciile pornesc singure
```

Cât timp mașina este oprită, plătești în continuare discul și IP-ul fix (câțiva dolari pe lună),
iar magazinul nu are backend.

Ca să **ștergi totul definitiv**, inclusiv baza de date:

```bash
gcloud compute instances delete cse-api --zone=europe-west3-a
gcloud compute addresses delete cse-api-ip --region=europe-west3
gcloud compute firewall-rules delete cse-allow-web
gcloud dns record-sets delete api.csekeyboards.com. --zone=csekeyboards-com --type=A
```

## Probleme frecvente

| Simptom                                                 | Cauză și soluție                                                                                                                                                                   |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `curl https://api…` dă eroare de certificat sau timeout | DNS-ul nu indica încă spre mașină când a pornit Caddy. Verifică `dig +short api.csekeyboards.com`, apoi rulează `deploy/gcp-vm/dc restart caddy` și `deploy/gcp-vm/dc logs caddy`. |
| Pagina dă 502                                           | Serviciile încă pornesc. Verifică `deploy/gcp-vm/dc ps`: toate trebuie să fie `healthy`.                                                                                           |
| Magazinul arată tot erori după pasul 11                 | Lipsește Redeploy-ul din Vercel, sau `NEXT_PUBLIC_API_URL` are o greșeală de scriere.                                                                                              |
| Eroare CORS în consola browserului                      | Site-ul este deschis pe altă adresă decât `csekeyboards.com` sau `www.csekeyboards.com`. Adresele permise sunt în `SITE_ORIGINS`, în `deploy/gcp-vm/.env`.                         |
| Login-ul nu „ține”                                      | `COOKIE_DOMAIN` din `.env` trebuie să fie `csekeyboards.com`. După modificare: `deploy/gcp-vm/dc up -d auth-service cart-service`.                                                 |
| Build-ul se oprește cu „Killed”                         | Memorie insuficientă. Verifică swap-ul (`swapon --show`) și rulează scriptul din nou: continuă de unde a rămas.                                                                    |

## Limitări de știut

- **Plățile sunt simulate** (furnizorul `mock`): oricine poate „plăti” o comandă fără card.
  Pentru plăți reale trebuie configurat Stripe ([payments](payments.md)).
- **Emailurile nu ajung la clienți**: rămân în Mailpit. Pentru trimitere reală e nevoie de un
  furnizor SMTP sau Amazon SES.
- **Încărcarea de poze din back-office nu funcționează public**: stocarea de imagini este
  accesibilă doar de pe mașină. Produsele din catalog folosesc ilustrații generate, deci
  magazinul arată complet.
- **O singură mașină**: dacă ea cade, cade tot backend-ul. Nu există replici.
- Parolele interne ale bazelor de date sunt cele de dezvoltare din `docker-compose.yml`. Sunt
  acceptabile aici doar pentru că PostgreSQL, Redis și Kafka nu pot fi accesate din internet:
  sunt legate de `127.0.0.1` și blocate de firewall. Doar Caddy, pe 80/443, este public. Parola
  de admin, singura care contează din exterior, este generată pentru fiecare instalare.
- Limitele de rată ale gateway-ului rămân active. Documentația API (`/docs`) este oprită.
