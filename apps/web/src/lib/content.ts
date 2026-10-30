import type { Locale } from '@/lib/i18n/config';

/**
 * Static informational and legal pages, in English and Romanian.
 *
 * The legal texts describe what this code actually does (data, cookies, retention), but they are
 * DRAFTS: the business is not registered yet, so every company detail is a [placeholder], and a
 * lawyer must review them before the shop takes orders. `draft: true` shows that on the page.
 * Do not replace a placeholder with anything that is not true.
 */
export interface ContentPage {
  title: string;
  description: string;
  /** Shown with a "draft, under legal review" notice until reviewed. */
  draft?: boolean;
  sections: { heading: string; body: string }[];
}

/** Every company detail the legal pages need; to be filled in once the business exists. */
const COMPANY_EN = {
  name: '[legal business name, to be completed]',
  address: '[registered office address, to be completed]',
  registration: '[trade register number and tax ID (CUI), to be completed]',
  email: '[contact email, to be completed]',
};
const COMPANY_RO = {
  name: '[denumirea legală a firmei, de completat]',
  address: '[adresa sediului social, de completat]',
  registration: '[nr. de înregistrare la Registrul Comerțului și CUI, de completat]',
  email: '[adresa de email de contact, de completat]',
};

export const contentPages: Record<string, ContentPage> = {
  shipping: {
    title: 'Shipping',
    description: 'Delivery costs and tracking for CSE Keyboards orders.',
    draft: true,
    sections: [
      {
        heading: 'Before launch',
        body: 'The shop is not taking orders yet. Dispatch times and carriers will be published here before it opens.',
      },
      {
        heading: 'Costs',
        body: 'Shipping is free within the EU on orders over €99. Below that, the exact cost is shown at checkout before you pay; there are no other fees.',
      },
      {
        heading: 'Tracking',
        body: 'When an order ships you get the carrier and tracking number by email, and you can follow it from your order page.',
      },
    ],
  },
  returns: {
    title: 'Returns & warranty',
    description: 'Your right of withdrawal and the legal guarantee on what you buy.',
    draft: true,
    sections: [
      {
        heading: 'Right of withdrawal (14 days)',
        body: 'As a consumer in the EU you can withdraw from an online purchase within 14 days of receiving the goods, without giving a reason. Tell us by email at [contact email, to be completed] with your order number. We refund the price, including the standard delivery cost, within 14 days of being informed, to the original payment method; we may wait until we receive the goods back. Return shipping costs and any longer period we decide to offer will be stated here before launch.',
      },
      {
        heading: 'Legal guarantee of conformity',
        body: 'Products must match their description and work as expected. If a product is faulty, you have the legal guarantee of conformity provided by consumer law (at least 2 years in the EU): repair or replacement, or a price reduction or refund.',
      },
      {
        heading: 'Cancelling an order',
        body: 'An order that has not been paid can be cancelled from its order page at any time. A paid order that has not shipped can be cancelled by email.',
      },
    ],
  },
  about: {
    title: 'About CSE Keyboards',
    description: 'Mechanical keyboards, switches, keycaps and accessories.',
    draft: true,
    sections: [
      {
        heading: 'What we are building',
        body: 'CSE Keyboards is a mechanical keyboard shop in preparation: assembled keyboards, a configurator to build your own, and switches, keycaps and accessories. The shop opens once the business is registered.',
      },
      {
        heading: 'Contact',
        body: `${COMPANY_EN.name}, ${COMPANY_EN.address}. Email: ${COMPANY_EN.email}.`,
      },
    ],
  },
  privacy: {
    title: 'Privacy policy',
    description: 'What personal data CSE Keyboards processes, why, for how long, and your rights.',
    draft: true,
    sections: [
      {
        heading: 'Who is responsible',
        body: `The controller of your personal data is ${COMPANY_EN.name}, ${COMPANY_EN.address}, ${COMPANY_EN.registration}. Contact for anything about your data: ${COMPANY_EN.email}.`,
      },
      {
        heading: 'Account',
        body: 'Email address, first and last name, and your password, stored only as an Argon2id hash (never readable, not even by us). For every signed-in session we keep the browser (user agent) and IP address to detect misuse. Why: to provide the account you asked for (contract) and to keep it secure (legitimate interest).',
      },
      {
        heading: 'Orders (once the shop opens)',
        body: 'Email address, shipping and billing address, optional phone number and notes, the products and amounts. Why: to deliver the order (contract) and to keep the accounting records the law requires (legal obligation). Card details are entered into the payment provider’s form and never reach our servers.',
      },
      {
        heading: 'Newsletter',
        body: 'Email address, the language you signed up in, and when you subscribed and confirmed. You are only added after clicking the link in the confirmation email (double opt-in). Why: your consent, which you can withdraw at any time with the unsubscribe link in every email or from your account.',
      },
      {
        heading: 'Reviews',
        body: 'The rating, title, text and the name you choose to show. They are published only if you write them, and you can edit or delete them from the product page.',
      },
      {
        heading: 'Emails we send',
        body: 'For each email we record the recipient, type and delivery status. The content data (for example a one-time link) is deleted as soon as the email is sent, or after 7 days if delivery fails.',
      },
      {
        heading: 'Security',
        body: 'IP addresses are used for short-lived request counters (rate limiting) and in server logs, to protect the shop against abuse. Passwords, tokens and cookies are not written to logs.',
      },
      {
        heading: 'Who processes data for us',
        body: 'Vercel Inc. hosts the website (it may process connection data outside the EU, under the EU Standard Contractual Clauses). Google Cloud hosts our servers and databases in Frankfurt, Germany. An email delivery provider and a payment provider will be listed here before launch. [Data processing agreements to be confirmed.]',
      },
      {
        heading: 'How long we keep it',
        body: 'Sessions: 30 days after the last use. Guest carts: 30 days. Accounts: until you ask us to delete them (see Your rights). Order records: as long as accounting law requires [period to be confirmed]. Newsletter: until you unsubscribe.',
      },
      {
        heading: 'Your rights',
        body: `You can ask to access, correct, export or delete your data, to restrict or object to its use, and withdraw consent at any time. Write to ${COMPANY_EN.email} from the address on your account; we answer within one month. You can also complain to the Romanian data protection authority (ANSPDCP, dataprotection.ro).`,
      },
      {
        heading: 'Children',
        body: 'The shop is not intended for children under 16, and we do not knowingly collect their data.',
      },
      {
        heading: 'No tracking',
        body: 'We use no advertising or analytics trackers and do not profile you. See the cookie policy for the few cookies the shop needs.',
      },
    ],
  },
  cookies: {
    title: 'Cookie policy',
    description: 'The cookies and browser storage CSE Keyboards uses, and why.',
    draft: true,
    sections: [
      {
        heading: 'In short',
        body: 'We use only what the shop needs to work, plus your own language and theme choice. No advertising, analytics or third-party tracking cookies, so there is nothing to consent to. If that ever changes, we will ask first, and refusing will be as easy as accepting.',
      },
      {
        heading: 'Necessary cookies',
        body: 'cse_at (15 minutes) and cse_rt (30 days): keep you signed in, set only when you sign in. cse_cart (30 days): remembers a guest’s cart, set only when you add something to it. All three are HttpOnly and Secure, so scripts cannot read them.',
      },
      {
        heading: 'Your choices',
        body: 'cse_locale (1 year): the language you picked with the RO/EN switch. In your browser’s local storage, “theme” remembers light or dark mode, and session storage keeps access to an order you placed as a guest, for that tab only.',
      },
      {
        heading: 'Removing them',
        body: 'You can delete cookies and site data in your browser settings at any time. Without the necessary cookies you will be signed out and a guest cart will be emptied.',
      },
    ],
  },
  terms: {
    title: 'Terms of sale',
    description: 'The terms that will apply to purchases from CSE Keyboards.',
    draft: true,
    sections: [
      {
        heading: 'Seller',
        body: `${COMPANY_EN.name}, ${COMPANY_EN.address}, ${COMPANY_EN.registration}. Email: ${COMPANY_EN.email}.`,
      },
      {
        heading: 'Status',
        body: 'The shop is in preview and does not accept orders yet. These terms will be completed and reviewed before it opens.',
      },
      {
        heading: 'Prices',
        body: 'Prices are in euro and include VAT. Shipping, when not free, is shown before you pay; there are no hidden fees. The amount you pay is calculated by our server from current prices, never by your browser.',
      },
      {
        heading: 'Orders and payment',
        body: 'An order is confirmed once the payment provider confirms the payment. Stock is held for 30 minutes while you pay; if the payment is not completed in time, the order is cancelled and nothing is charged.',
      },
      {
        heading: 'Withdrawal, guarantee and complaints',
        body: 'See Returns & warranty for your 14-day right of withdrawal and the legal guarantee. Complaints: write to the contact email above. You can also contact the Romanian consumer protection authority (ANPC, anpc.ro) and use its alternative dispute resolution service (SAL).',
      },
    ],
  },
  legal: {
    title: 'Legal notice',
    description: 'Who runs CSE Keyboards and how to reach us.',
    draft: true,
    sections: [
      {
        heading: 'Business details',
        body: `${COMPANY_EN.name}. Registered office: ${COMPANY_EN.address}. ${COMPANY_EN.registration}.`,
      },
      {
        heading: 'Contact',
        body: `Email: ${COMPANY_EN.email}.`,
      },
      {
        heading: 'Consumer protection',
        body: 'Romanian consumer protection authority: ANPC, anpc.ro, including alternative dispute resolution (SAL).',
      },
    ],
  },
};

const contentPagesRo: Record<string, ContentPage> = {
  shipping: {
    title: 'Livrare',
    description: 'Costuri de livrare și urmărirea coletelor pentru comenzile CSE Keyboards.',
    draft: true,
    sections: [
      {
        heading: 'Înainte de lansare',
        body: 'Magazinul nu preia încă comenzi. Termenele de expediere și curierii vor fi publicați aici înainte de deschidere.',
      },
      {
        heading: 'Costuri',
        body: 'Livrarea este gratuită în UE pentru comenzile de peste 99 €. Sub această sumă, costul exact apare la finalizarea comenzii, înainte de plată; nu există alte taxe.',
      },
      {
        heading: 'Urmărire',
        body: 'Când comanda pleacă, primești pe email curierul și numărul de urmărire și o poți urmări din pagina comenzii.',
      },
    ],
  },
  returns: {
    title: 'Retur și garanție',
    description: 'Dreptul tău de retragere și garanția legală pentru produsele cumpărate.',
    draft: true,
    sections: [
      {
        heading: 'Dreptul de retragere (14 zile)',
        body: 'Ca și consumator în UE, te poți retrage dintr-o cumpărare online în 14 zile de la primirea produselor, fără să motivezi decizia. Anunță-ne pe email la [adresa de email de contact, de completat], cu numărul comenzii. Returnăm prețul, inclusiv costul livrării standard, în 14 zile de la notificare, pe metoda de plată folosită; putem aștepta până primim produsele înapoi. Costul transportului la retur și orice termen mai lung pe care îl vom oferi vor fi precizate aici înainte de lansare.',
      },
      {
        heading: 'Garanția legală de conformitate',
        body: 'Produsele trebuie să corespundă descrierii și să funcționeze cum este de așteptat. Dacă un produs are un defect, beneficiezi de garanția legală de conformitate prevăzută de legislația privind protecția consumatorilor (cel puțin 2 ani în UE): reparare sau înlocuire, ori reducerea prețului sau rambursare.',
      },
      {
        heading: 'Anularea unei comenzi',
        body: 'O comandă neplătită poate fi anulată oricând din pagina ei. O comandă plătită care nu a fost expediată poate fi anulată pe email.',
      },
    ],
  },
  about: {
    title: 'Despre CSE Keyboards',
    description: 'Tastaturi mecanice, switch-uri, keycaps și accesorii.',
    draft: true,
    sections: [
      {
        heading: 'Ce construim',
        body: 'CSE Keyboards este un magazin de tastaturi mecanice în pregătire: tastaturi asamblate, un configurator pentru a-ți construi propria tastatură, plus switch-uri, keycaps și accesorii. Magazinul se deschide după înregistrarea firmei.',
      },
      {
        heading: 'Contact',
        body: `${COMPANY_RO.name}, ${COMPANY_RO.address}. Email: ${COMPANY_RO.email}.`,
      },
    ],
  },
  privacy: {
    title: 'Politica de confidențialitate',
    description:
      'Ce date personale prelucrează CSE Keyboards, de ce, cât timp le păstrăm și drepturile tale.',
    draft: true,
    sections: [
      {
        heading: 'Cine răspunde',
        body: `Operatorul datelor tale personale este ${COMPANY_RO.name}, ${COMPANY_RO.address}, ${COMPANY_RO.registration}. Pentru orice întrebare despre datele tale: ${COMPANY_RO.email}.`,
      },
      {
        heading: 'Contul',
        body: 'Adresa de email, prenumele și numele, iar parola doar sub formă de hash Argon2id (nu poate fi citită, nici de noi). Pentru fiecare sesiune autentificată păstrăm browserul (user agent) și adresa IP, ca să depistăm abuzurile. De ce: ca să-ți oferim contul cerut (contract) și să-l protejăm (interes legitim).',
      },
      {
        heading: 'Comenzi (după deschiderea magazinului)',
        body: 'Adresa de email, adresa de livrare și de facturare, telefonul și observațiile (opționale), produsele și sumele. De ce: pentru livrarea comenzii (contract) și pentru evidențele contabile cerute de lege (obligație legală). Datele cardului se introduc în formularul procesatorului de plăți și nu ajung niciodată pe serverele noastre.',
      },
      {
        heading: 'Newsletter',
        body: 'Adresa de email, limba în care te-ai abonat și momentul abonării și al confirmării. Ești adăugat doar după ce apeși linkul din emailul de confirmare (dublă confirmare). De ce: consimțământul tău, pe care îl poți retrage oricând prin linkul de dezabonare din fiecare email sau din contul tău.',
      },
      {
        heading: 'Recenzii',
        body: 'Nota, titlul, textul și numele pe care alegi să-l afișezi. Se publică doar dacă le scrii tu și le poți modifica sau șterge din pagina produsului.',
      },
      {
        heading: 'Emailurile trimise',
        body: 'Pentru fiecare email păstrăm destinatarul, tipul și starea livrării. Datele din conținut (de exemplu un link de unică folosință) se șterg imediat după trimitere, sau după 7 zile dacă livrarea eșuează.',
      },
      {
        heading: 'Securitate',
        body: 'Adresele IP sunt folosite pentru contoare de scurtă durată (limitarea numărului de cereri) și în jurnalele serverului, pentru protecția împotriva abuzurilor. Parolele, tokenurile și cookie-urile nu se scriu în jurnale.',
      },
      {
        heading: 'Cine prelucrează date pentru noi',
        body: 'Vercel Inc. găzduiește site-ul (poate prelucra date de conexiune în afara UE, în baza Clauzelor Contractuale Standard ale UE). Google Cloud găzduiește serverele și bazele de date la Frankfurt, Germania. Furnizorul de email și procesatorul de plăți vor fi trecuți aici înainte de lansare. [Acordurile de prelucrare a datelor sunt de confirmat.]',
      },
      {
        heading: 'Cât timp le păstrăm',
        body: 'Sesiunile: 30 de zile de la ultima folosire. Coșurile vizitatorilor: 30 de zile. Conturile: până ne ceri ștergerea lor (vezi Drepturile tale). Evidențele comenzilor: cât cere legislația contabilă [perioadă de confirmat]. Newsletterul: până te dezabonezi.',
      },
      {
        heading: 'Drepturile tale',
        body: `Poți cere accesul la date, rectificarea, exportul sau ștergerea lor, restricționarea sau opoziția la prelucrare și îți poți retrage oricând consimțământul. Scrie-ne la ${COMPANY_RO.email} de pe adresa contului; răspundem în cel mult o lună. Poți depune și o plângere la Autoritatea Națională de Supraveghere a Prelucrării Datelor cu Caracter Personal (ANSPDCP, dataprotection.ro).`,
      },
      {
        heading: 'Copii',
        body: 'Magazinul nu se adresează copiilor sub 16 ani și nu colectăm cu bună știință datele lor.',
      },
      {
        heading: 'Fără urmărire',
        body: 'Nu folosim instrumente de reclamă sau de analiză și nu îți creăm profiluri. Vezi politica de cookie-uri pentru puținele cookie-uri de care are nevoie magazinul.',
      },
    ],
  },
  cookies: {
    title: 'Politica de cookie-uri',
    description:
      'Cookie-urile și spațiul de stocare din browser folosite de CSE Keyboards și de ce.',
    draft: true,
    sections: [
      {
        heading: 'Pe scurt',
        body: 'Folosim doar ce e necesar pentru funcționarea magazinului, plus alegerea ta de limbă și temă. Fără cookie-uri de reclamă, analiză sau urmărire de la terți, deci nu ai ce accepta. Dacă asta se schimbă, îți vom cere întâi acordul, iar refuzul va fi la fel de simplu ca acceptarea.',
      },
      {
        heading: 'Cookie-uri necesare',
        body: 'cse_at (15 minute) și cse_rt (30 de zile): te țin autentificat, se setează doar când te autentifici. cse_cart (30 de zile): ține minte coșul unui vizitator, se setează doar când adaugi ceva în coș. Toate trei sunt HttpOnly și Secure, deci nu pot fi citite de scripturi.',
      },
      {
        heading: 'Alegerile tale',
        body: 'cse_locale (1 an): limba aleasă cu butonul RO/EN. În spațiul local al browserului, „theme” ține minte modul luminos sau întunecat, iar spațiul de sesiune păstrează accesul la o comandă plasată fără cont, doar în acel tab.',
      },
      {
        heading: 'Ștergerea lor',
        body: 'Poți șterge oricând cookie-urile și datele site-ului din setările browserului. Fără cookie-urile necesare vei fi deconectat, iar coșul de vizitator se golește.',
      },
    ],
  },
  terms: {
    title: 'Termeni și condiții de vânzare',
    description: 'Condițiile care se vor aplica achizițiilor de la CSE Keyboards.',
    draft: true,
    sections: [
      {
        heading: 'Vânzătorul',
        body: `${COMPANY_RO.name}, ${COMPANY_RO.address}, ${COMPANY_RO.registration}. Email: ${COMPANY_RO.email}.`,
      },
      {
        heading: 'Stadiu',
        body: 'Magazinul este în pregătire și nu preia încă comenzi. Acești termeni vor fi completați și verificați înainte de deschidere.',
      },
      {
        heading: 'Prețuri',
        body: 'Prețurile sunt în euro și includ TVA. Livrarea, când nu e gratuită, apare înainte de plată; nu există taxe ascunse. Suma de plată este calculată de serverul nostru din prețurile curente, niciodată de browserul tău.',
      },
      {
        heading: 'Comenzi și plată',
        body: 'O comandă este confirmată după ce procesatorul de plăți confirmă plata. Stocul se rezervă 30 de minute cât timp plătești; dacă plata nu se finalizează la timp, comanda se anulează și nu se încasează nimic.',
      },
      {
        heading: 'Retragere, garanție și reclamații',
        body: 'Vezi Retur și garanție pentru dreptul de retragere în 14 zile și garanția legală. Reclamații: scrie-ne la adresa de email de mai sus. Te poți adresa și Autorității Naționale pentru Protecția Consumatorilor (ANPC, anpc.ro) și serviciului de soluționare alternativă a litigiilor (SAL).',
      },
    ],
  },
  legal: {
    title: 'Informații legale',
    description: 'Cine administrează CSE Keyboards și cum ne contactezi.',
    draft: true,
    sections: [
      {
        heading: 'Datele firmei',
        body: `${COMPANY_RO.name}. Sediul social: ${COMPANY_RO.address}. ${COMPANY_RO.registration}.`,
      },
      {
        heading: 'Contact',
        body: `Email: ${COMPANY_RO.email}.`,
      },
      {
        heading: 'Protecția consumatorilor',
        body: 'Autoritatea Națională pentru Protecția Consumatorilor: ANPC, anpc.ro, inclusiv soluționarea alternativă a litigiilor (SAL).',
      },
    ],
  },
};

/** Informational pages per language; the URL slug is the same in every language. */
export const contentPagesByLocale: Record<Locale, Record<string, ContentPage>> = {
  en: contentPages,
  ro: contentPagesRo,
};
