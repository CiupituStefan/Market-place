import type { Locale } from '@market/types';

/** Number and currency formatting per language. */
export const INTL: Record<Locale, string> = { en: 'en-IE', ro: 'ro-RO' };

/** The emails' words in English; Romanian below has the same shape (TypeScript checks it). */
const en = {
  greeting: (firstName: string | null | undefined) =>
    firstName ? `Hi ${firstName},` : 'Hi there,',
  viewOrder: 'View your order',
  verification: {
    subject: 'Confirm your email address',
    preheader: 'One click and your account is ready.',
    heading: 'Confirm your email',
    body: 'Thanks for creating a CSE Keyboards account. Confirm your email address so you can write reviews and recover your account if you ever need to.',
    button: 'Confirm email',
    note: (expires: string) =>
      `This link works once and expires on ${expires}. If you did not create an account, you can ignore this email.`,
  },
  reset: {
    subject: 'Reset your password',
    preheader: 'Use this link to choose a new password.',
    heading: 'Reset your password',
    body: 'Someone (hopefully you) asked to reset the password of your CSE Keyboards account.',
    button: 'Choose a new password',
    note: (expires: string) =>
      `This link works once and expires on ${expires}. If you did not ask for it, ignore this email: your password stays the same. Resetting signs you out everywhere.`,
  },
  confirmation: {
    subject: (number: string) => `Order ${number} confirmed`,
    preheader: (total: string) => `We received your payment of ${total}.`,
    heading: 'Thanks for your order!',
    body: (paidAt: string, number: string) =>
      `Payment received on ${paidAt}. We are getting order ${number} ready and will email you the tracking number as soon as it ships.`,
  },
  totals: {
    subtotal: 'Subtotal',
    discount: (code: string | null) => (code ? `Discount (${code})` : 'Discount'),
    shipping: 'Shipping',
    free: 'Free',
    vat: 'VAT included',
    paid: 'Total paid',
  },
  shipped: {
    subject: (number: string) => `Order ${number} is on its way`,
    preheader: (carrier: string, tracking: string) => `${carrier} tracking number ${tracking}.`,
    heading: 'Your keyboard is on its way',
    body: (number: string, carrier: string, tracking: string) =>
      `Order ${number} left our workshop with ${carrier}. Tracking number: ${tracking}.`,
    track: 'Track your parcel',
  },
  delivered: {
    subject: (number: string) => `Order ${number} was delivered`,
    preheader: 'Enjoy the new board. Tell other typists what you think.',
    heading: 'Delivered!',
    body: (number: string) =>
      `Order ${number} has been delivered. Once you have typed on it for a while, a review helps other enthusiasts choose.`,
  },
  cancelled: {
    subject: (number: string) => `Order ${number} was cancelled`,
    refundPreheader: 'Your payment will be refunded.',
    noChargePreheader: 'No payment was taken for it.',
    heading: 'Order cancelled',
    why: {
      CUSTOMER_REQUEST: 'as you requested',
      ADMIN: 'by our team',
      OUT_OF_STOCK: 'because an item is no longer in stock',
    },
    body: (number: string, why: string) => `Order ${number} was cancelled ${why}.`,
    refund:
      'We are refunding your payment in full; you will get another email when the refund is issued.',
    noCharge: 'You have not been charged.',
  },
  paymentFailed: {
    subject: (number: string) => `Payment for order ${number} did not go through`,
    preheader: 'Your items are still held for a short while.',
    heading: 'Your payment did not go through',
    body: (number: string, reason: string | null) =>
      `We could not take the payment for order ${number}${reason ? `: ${reason}` : '.'}`,
    retry:
      'Your items stay reserved until the payment window closes. You can try again with the same or another payment method.',
    button: 'Try again',
  },
  refund: {
    subject: (amount: string, number: string) => `Refund of ${amount} for order ${number}`,
    preheader: 'Refunds usually appear on your statement within 5–10 business days.',
    heading: 'Refund issued',
    full: (number: string, total: string) =>
      `Order ${number} has been refunded in full (${total}).`,
    partial: (number: string, amount: string, total: string) =>
      `We refunded ${amount} for order ${number} (${total} refunded so far).`,
    note: 'The money goes back to the payment method you used. Depending on your bank this takes 5–10 business days.',
  },
  newsletterConfirm: {
    subject: 'Confirm your CSE Keyboards newsletter subscription',
    preheader: 'One click to start getting group buys, restocks and build guides.',
    heading: 'Confirm your subscription',
    body: 'Someone asked to subscribe this address to the CSE Keyboards newsletter: one email a month with restocks, new boards and build guides.',
    button: 'Yes, subscribe me',
    note: 'If it was not you, ignore this email and you will not hear from us again.',
  },
  welcome: {
    subject: 'Welcome to the CSE Keyboards newsletter',
    preheader: 'You are on the list.',
    heading: 'You are on the list',
    body: 'Thanks for subscribing. Expect one email a month: restocks, new boards, switch reviews and build guides. No spam.',
    button: 'Browse keyboards',
  },
  footer: {
    security: 'You received this email because of a request made with this address.',
    transactional: 'You received this email because you placed an order at CSE Keyboards.',
    orderUpdates: 'Shipping updates for your order. You can turn them off in your account.',
    orderUpdatesGuest: 'Shipping updates for the order you placed at CSE Keyboards.',
    newsletter: 'You subscribed to the CSE Keyboards newsletter.',
    unsubscribe: 'Unsubscribe',
  },
};

export type EmailCopy = typeof en;

const ro: EmailCopy = {
  greeting: (firstName) => (firstName ? `Bună, ${firstName},` : 'Bună,'),
  viewOrder: 'Vezi comanda',
  verification: {
    subject: 'Confirmă-ți adresa de email',
    preheader: 'Un clic și contul tău este gata.',
    heading: 'Confirmă-ți adresa de email',
    body: 'Îți mulțumim că ți-ai creat un cont CSE Keyboards. Confirmă-ți adresa de email ca să poți scrie recenzii și să-ți poți recupera contul dacă va fi nevoie.',
    button: 'Confirmă adresa',
    note: (expires) =>
      `Linkul funcționează o singură dată și expiră pe ${expires}. Dacă nu tu ți-ai creat contul, poți ignora acest email.`,
  },
  reset: {
    subject: 'Resetează-ți parola',
    preheader: 'Folosește acest link ca să alegi o parolă nouă.',
    heading: 'Resetează-ți parola',
    body: 'Cineva (sperăm că tu) a cerut resetarea parolei contului tău CSE Keyboards.',
    button: 'Alege o parolă nouă',
    note: (expires) =>
      `Linkul funcționează o singură dată și expiră pe ${expires}. Dacă nu tu ai cerut resetarea, ignoră acest email: parola rămâne aceeași. După resetare vei fi deconectat de pe toate dispozitivele.`,
  },
  confirmation: {
    subject: (number) => `Comanda ${number} a fost confirmată`,
    preheader: (total) => `Am primit plata de ${total}.`,
    heading: 'Îți mulțumim pentru comandă!',
    body: (paidAt, number) =>
      `Plata a fost primită pe ${paidAt}. Pregătim comanda ${number} și îți trimitem numărul de urmărire pe email imediat ce pleacă spre tine.`,
  },
  totals: {
    subtotal: 'Subtotal',
    discount: (code) => (code ? `Reducere (${code})` : 'Reducere'),
    shipping: 'Livrare',
    free: 'Gratuită',
    vat: 'TVA inclus',
    paid: 'Total plătit',
  },
  shipped: {
    subject: (number) => `Comanda ${number} este pe drum`,
    preheader: (carrier, tracking) => `Număr de urmărire ${carrier}: ${tracking}.`,
    heading: 'Tastatura ta este pe drum',
    body: (number, carrier, tracking) =>
      `Comanda ${number} a plecat din atelierul nostru prin ${carrier}. Număr de urmărire: ${tracking}.`,
    track: 'Urmărește coletul',
  },
  delivered: {
    subject: (number) => `Comanda ${number} a fost livrată`,
    preheader: 'Bucură-te de noua tastatură și spune-le și altora ce părere ai.',
    heading: 'Livrată!',
    body: (number) =>
      `Comanda ${number} a fost livrată. După ce tastezi o vreme pe ea, o recenzie îi ajută pe alți pasionați să aleagă.`,
  },
  cancelled: {
    subject: (number) => `Comanda ${number} a fost anulată`,
    refundPreheader: 'Îți returnăm banii.',
    noChargePreheader: 'Nu ți-a fost retrasă nicio sumă.',
    heading: 'Comandă anulată',
    why: {
      CUSTOMER_REQUEST: 'la cererea ta',
      ADMIN: 'de echipa noastră',
      OUT_OF_STOCK: 'pentru că un produs nu mai este în stoc',
    },
    body: (number, why) => `Comanda ${number} a fost anulată ${why}.`,
    refund: 'Îți returnăm integral plata; vei primi un alt email când rambursarea este efectuată.',
    noCharge: 'Nu ți-a fost retrasă nicio sumă.',
  },
  paymentFailed: {
    subject: (number) => `Plata pentru comanda ${number} nu a reușit`,
    preheader: 'Produsele îți rămân rezervate încă puțin timp.',
    heading: 'Plata nu a reușit',
    body: (number, reason) =>
      `Nu am putut încasa plata pentru comanda ${number}${reason ? `: ${reason}` : '.'}`,
    retry:
      'Produsele rămân rezervate până la expirarea timpului de plată. Poți încerca din nou cu aceeași metodă de plată sau cu alta.',
    button: 'Încearcă din nou',
  },
  refund: {
    subject: (amount, number) => `Rambursare de ${amount} pentru comanda ${number}`,
    preheader: 'Rambursările apar de obicei în extras în 5–10 zile lucrătoare.',
    heading: 'Rambursare efectuată',
    full: (number, total) => `Comanda ${number} a fost rambursată integral (${total}).`,
    partial: (number, amount, total) =>
      `Am rambursat ${amount} pentru comanda ${number} (${total} rambursat până acum).`,
    note: 'Banii se întorc pe metoda de plată folosită. În funcție de bancă, durează 5–10 zile lucrătoare.',
  },
  newsletterConfirm: {
    subject: 'Confirmă abonarea la newsletterul CSE Keyboards',
    preheader: 'Un clic și primești noutăți, reveniri în stoc și ghiduri de asamblare.',
    heading: 'Confirmă abonarea',
    body: 'Cineva a cerut abonarea acestei adrese la newsletterul CSE Keyboards: un email pe lună cu reveniri în stoc, tastaturi noi și ghiduri de asamblare.',
    button: 'Da, abonează-mă',
    note: 'Dacă nu ai fost tu, ignoră acest email și nu vei mai auzi de noi.',
  },
  welcome: {
    subject: 'Bine ai venit în newsletterul CSE Keyboards',
    preheader: 'Ești pe listă.',
    heading: 'Ești pe listă',
    body: 'Îți mulțumim pentru abonare. Vei primi un email pe lună: reveniri în stoc, tastaturi noi, recenzii de switch-uri și ghiduri de asamblare. Fără spam.',
    button: 'Vezi tastaturile',
  },
  footer: {
    security: 'Ai primit acest email în urma unei cereri făcute cu această adresă.',
    transactional: 'Ai primit acest email pentru că ai plasat o comandă la CSE Keyboards.',
    orderUpdates: 'Noutăți despre livrarea comenzii tale. Le poți dezactiva din contul tău.',
    orderUpdatesGuest: 'Noutăți despre livrarea comenzii plasate la CSE Keyboards.',
    newsletter: 'Te-ai abonat la newsletterul CSE Keyboards.',
    unsubscribe: 'Dezabonare',
  },
};

export const COPY: Record<Locale, EmailCopy> = { en, ro };
