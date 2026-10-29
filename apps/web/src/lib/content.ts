import type { Locale } from '@/lib/i18n/config';

/**
 * Static informational pages. Legal texts are placeholders that must be reviewed
 * by counsel before launch; they will move to a CMS later.
 */
export interface ContentPage {
  title: string;
  description: string;
  sections: { heading: string; body: string }[];
}

export const contentPages: Record<string, ContentPage> = {
  shipping: {
    title: 'Shipping',
    description: 'Delivery times, costs and tracking for CSE Keyboards orders.',
    sections: [
      {
        heading: 'Dispatch',
        body: 'Orders placed before 14:00 CET on business days ship the same day. Pre-orders ship when stock arrives; the expected date is shown on the product page.',
      },
      {
        heading: 'Costs',
        body: 'Tracked shipping is free within the EU on orders over €99. Below that, and for express delivery, the exact cost is calculated at checkout before you pay.',
      },
      {
        heading: 'Tracking',
        body: 'You receive a tracking link by email as soon as your parcel leaves our warehouse. You can also follow it from your account under Orders.',
      },
    ],
  },
  returns: {
    title: 'Returns & warranty',
    description: '30-day returns and a 2-year warranty on every keyboard.',
    sections: [
      {
        heading: '30-day returns',
        body: 'Unused items in their original packaging can be returned within 30 days of delivery. Start a return from your order page and we will email a prepaid label.',
      },
      {
        heading: 'Refunds',
        body: 'Refunds go back to the original payment method within 5 business days of the return being inspected.',
      },
      {
        heading: 'Warranty',
        body: 'Keyboards are covered for 2 years against manufacturing defects. Contact support with your order number and a short description or video of the issue.',
      },
    ],
  },
  about: {
    title: 'About CSE Keyboards',
    description: 'Who we are and how we build our keyboards.',
    sections: [
      {
        heading: 'Built by typists',
        body: 'CSE Keyboards started at a workbench with a soldering iron and too many switches. Today we design, tune and test every board in-house before it ships.',
      },
      {
        heading: 'How we build',
        body: 'Every keyboard is lubed, dampened and sound-tested. We use hot-swap PCBs and open firmware so your board can evolve with you.',
      },
    ],
  },
  privacy: {
    title: 'Privacy policy',
    description: 'How CSE Keyboards handles your personal data.',
    sections: [
      {
        heading: 'What we collect',
        body: 'We collect the information needed to process your orders and run your account: name, email, shipping address and order history. Card details are entered directly into Stripe and never stored on our servers.',
      },
      {
        heading: 'Your rights',
        body: 'Under the GDPR you can access, correct, export or delete your data at any time. Contact support to exercise these rights.',
      },
    ],
  },
  terms: {
    title: 'Terms of sale',
    description: 'The terms that apply to purchases from CSE Keyboards.',
    sections: [
      {
        heading: 'Orders',
        body: 'An order is confirmed once payment has been successfully processed. Prices include VAT where applicable; the final amount is shown at checkout.',
      },
      {
        heading: 'Availability',
        body: 'Stock is reserved when you start payment. If a reservation expires before payment completes, the items return to stock.',
      },
    ],
  },
};

const contentPagesRo: Record<string, ContentPage> = {
  shipping: {
    title: 'Livrare',
    description: 'Termene, costuri și urmărirea coletelor pentru comenzile CSE Keyboards.',
    sections: [
      {
        heading: 'Expediere',
        body: 'Comenzile plasate până la ora 15:00 (ora României) în zilele lucrătoare pleacă în aceeași zi. Precomenzile se expediază când sosește stocul; data estimată apare pe pagina produsului.',
      },
      {
        heading: 'Costuri',
        body: 'Livrarea cu urmărire este gratuită în UE pentru comenzile de peste 99 €. Sub această sumă, și pentru livrarea express, costul exact se calculează la finalizarea comenzii, înainte de plată.',
      },
      {
        heading: 'Urmărire',
        body: 'Primești pe email un link de urmărire imediat ce coletul pleacă din depozit. Îl poți urmări și din contul tău, la Comenzi.',
      },
    ],
  },
  returns: {
    title: 'Retur și garanție',
    description: 'Retur în 30 de zile și garanție 2 ani pentru fiecare tastatură.',
    sections: [
      {
        heading: 'Retur în 30 de zile',
        body: 'Produsele nefolosite, în ambalajul original, pot fi returnate în 30 de zile de la livrare. Începe returul din pagina comenzii și îți trimitem pe email o etichetă de transport plătită.',
      },
      {
        heading: 'Rambursări',
        body: 'Banii revin pe metoda de plată inițială în 5 zile lucrătoare de la verificarea produsului returnat.',
      },
      {
        heading: 'Garanție',
        body: 'Tastaturile au garanție 2 ani pentru defecte de fabricație. Scrie-ne cu numărul comenzii și o scurtă descriere sau un video al problemei.',
      },
    ],
  },
  about: {
    title: 'Despre CSE Keyboards',
    description: 'Cine suntem și cum ne construim tastaturile.',
    sections: [
      {
        heading: 'Făcute de oameni care tastează',
        body: 'CSE Keyboards a pornit pe un banc de lucru, cu un ciocan de lipit și prea multe switch-uri. Astăzi proiectăm, reglăm și testăm fiecare tastatură în atelierul nostru înainte de livrare.',
      },
      {
        heading: 'Cum lucrăm',
        body: 'Fiecare tastatură este lubrifiată, amortizată și testată acustic. Folosim PCB-uri hot-swap și firmware deschis, ca tastatura ta să poată evolua odată cu tine.',
      },
    ],
  },
  privacy: {
    title: 'Politica de confidențialitate',
    description: 'Cum prelucrează CSE Keyboards datele tale personale.',
    sections: [
      {
        heading: 'Ce date colectăm',
        body: 'Colectăm informațiile necesare pentru a-ți procesa comenzile și a-ți administra contul: nume, email, adresă de livrare și istoricul comenzilor. Datele cardului se introduc direct la Stripe și nu sunt stocate niciodată pe serverele noastre.',
      },
      {
        heading: 'Drepturile tale',
        body: 'Conform GDPR, poți oricând să accesezi, să corectezi, să exporți sau să ștergi datele tale. Scrie-ne ca să îți exerciți aceste drepturi.',
      },
    ],
  },
  terms: {
    title: 'Termeni și condiții de vânzare',
    description: 'Condițiile care se aplică achizițiilor de la CSE Keyboards.',
    sections: [
      {
        heading: 'Comenzi',
        body: 'O comandă este confirmată după ce plata a fost procesată cu succes. Prețurile includ TVA acolo unde se aplică; suma finală apare la finalizarea comenzii.',
      },
      {
        heading: 'Disponibilitate',
        body: 'Stocul se rezervă când începi plata. Dacă rezervarea expiră înainte de finalizarea plății, produsele revin în stoc.',
      },
    ],
  },
};

/** Informational pages per language; the URL slug is the same in every language. */
export const contentPagesByLocale: Record<Locale, Record<string, ContentPage>> = {
  en: contentPages,
  ro: contentPagesRo,
};
