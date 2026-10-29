import type { Product } from '@market/types';
import type {
  CategoryTranslation,
  ConfiguratorTranslation,
  ProductTranslation,
} from '../catalog/translations.js';

/**
 * Romanian copy for the demo catalog (catalog-data.ts). Product-specific texts are written
 * per product; specs, contents, compatibility and options share one glossary, so the
 * templated keyboard specs are translated once.
 */

/** Romanian adds "de" from 20 up ("35 de taste"), except numbers ending in 01–19. */
function counted(count: number, word: string): string {
  const rest = count % 100;
  return rest >= 20 || (rest === 0 && count !== 0)
    ? `${String(count)} de ${word}`
    : `${String(count)} ${word}`;
}

const GLOSSARY: Record<string, string> = {
  // Spec groups and labels
  Build: 'Construcție',
  Connectivity: 'Conectivitate',
  Typing: 'Tastare',
  Physical: 'Dimensiuni și greutate',
  Stabilizers: 'Stabilizatoare',
  Cable: 'Cablu',
  'Wrist rest': 'Suport pentru încheieturi',
  Layout: 'Format',
  'Mounting style': 'Tip de montaj',
  Case: 'Carcasă',
  Plate: 'Placă',
  Wired: 'Cu fir',
  Battery: 'Baterie',
  'Keycap compatibility': 'Compatibilitate keycaps',
  'Switch compatibility': 'Compatibilitate switch-uri',
  Weight: 'Greutate',
  Dimensions: 'Dimensiuni',
  Type: 'Tip',
  'Actuation force': 'Forță de acționare',
  'Total travel': 'Cursă totală',
  Pins: 'Pini',
  Housing: 'Carcasă',
  Legends: 'Inscripții',
  Profile: 'Profil',
  Mount: 'Montaj',
  Length: 'Lungime',
  Connector: 'Conector',
  Thickness: 'Grosime',
  Height: 'Înălțime',
  // Spec values
  Aluminium: 'Aluminiu',
  Polycarbonate: 'Policarbonat',
  Steel: 'Oțel',
  Walnut: 'Nuc',
  Linear: 'Liniar',
  Tactile: 'Tactil',
  '5-pin': '5 pini',
  'Hot-swappable, 3/5-pin, south-facing RGB': 'Hot-swap, 3/5 pini, RGB orientat spre sud',
  'PCB screw-in, factory lubed': 'Prinse cu șurub în PCB, lubrifiate din fabrică',
  'PCB screw-in': 'Prinse cu șurub în PCB',
  'QMK with VIA support': 'QMK cu suport VIA',
  'USB-C (detachable)': 'USB-C (detașabil)',
  'Bluetooth 5.1, 3 devices': 'Bluetooth 5.1, 3 dispozitive',
  '1000 Hz receiver included': 'Receptor de 1000 Hz inclus',
  'Double-shot PBT, Cherry profile': 'PBT double-shot, profil Cherry',
  'MX-style stems, standard bottom row': 'Tije tip MX, rând de jos standard',
  'MX-style 3-pin and 5-pin': 'Tip MX, 3 și 5 pini',
  'Per-key, south-facing': 'Pe fiecare tastă, orientat spre sud',
  'PC top, nylon bottom': 'Partea de sus din PC, partea de jos din nailon',
  'PBT, 1.5 mm walls': 'PBT, pereți de 1,5 mm',
  // In the box
  'Braided USB-C to USB-A cable': 'Cablu împletit USB-C la USB-A',
  '2.4GHz receiver + extension adapter': 'Receptor 2.4GHz + adaptor prelungitor',
  'Switch and keycap puller': 'Extractor pentru switch-uri și keycaps',
  'Mac & Windows replacement keycaps': 'Keycaps de schimb pentru Mac și Windows',
  'Quick-start card': 'Ghid de pornire rapidă',
  'Switches in a resealable tray': 'Switch-uri într-o tăviță resigilabilă',
  'Keycap puller': 'Extractor pentru keycaps',
  'Screws and washers': 'Șuruburi și șaibe',
  'USB-C adapter': 'Adaptor USB-C',
  // Compatibility
  'All MX-style switches (3-pin and 5-pin)': 'Toate switch-urile tip MX (3 și 5 pini)',
  'Cherry and OEM profile keycap sets with a standard bottom row':
    'Seturi de keycaps cu profil Cherry sau OEM și rând de jos standard',
  'Any hot-swap PCB with MX-style sockets (3- or 5-pin)':
    'Orice PCB hot-swap cu socluri tip MX (3 sau 5 pini)',
  'MX-style switches': 'Switch-uri tip MX',
  'Standard and most 75%/65% layouts': 'Formatele standard și majoritatea celor 75%/65%',
  'PCBs with screw-in stabilizer holes': 'PCB-uri cu găuri pentru stabilizatoare cu șurub',
  'Any USB-C keyboard': 'Orice tastatură cu USB-C',
  'Any desk setup': 'Orice birou',
  'Matched to CSE board sizes': 'Potrivit dimensiunilor tastaturilor CSE',
  // Options
  Color: 'Culoare',
  'Pack size': 'Pachet',
  Kit: 'Set',
  Size: 'Mărime',
  Chalk: 'Cretă',
  'Anodised Silver': 'Argintiu anodizat',
  Sage: 'Salvie',
  'Deep Navy': 'Bleumarin',
  'Smooth, 45 gf': 'Lin, 45 gf',
  'Rounded bump, 55 gf': 'Feedback tactil rotunjit, 55 gf',
  'Base kit': 'Set de bază',
  'Base + numpad + novelties': 'Bază + numpad + taste decorative',
  '60%–TKL set': 'Set 60%–TKL',
  'Full-size set': 'Set full-size',
  'Full size': 'Full-size',
};

/** One English catalog string in Romanian; unknown strings (model names, units) stay as they are. */
export function romanianTerm(text: string): string {
  const known = GLOSSARY[text];
  if (known) return known;
  const keyboard = /^(.+) keyboard$/.exec(text);
  if (keyboard) return `Tastatura ${keyboard[1] ?? ''}`;
  const keys = /^(\d+) (keys|switches)$/.exec(text);
  if (keys) return counted(Number(keys[1]), keys[2] === 'keys' ? 'taste' : 'switch-uri');
  // Decimal comma: "1.9 kg" → "1,9 kg".
  if (/^\d+\.\d+ (kg|mm|m)$/.test(text)) return text.replace('.', ',');
  return text;
}

const KEYBOARD_FAQ: Record<string, { question: string; answer: string }> = {
  'Can I change the switches later?': {
    question: 'Pot schimba switch-urile mai târziu?',
    answer:
      'Da. Toate tastaturile CSE au socluri hot-swap care acceptă switch-uri tip MX cu 3 și 5 pini, așa că le poți schimba fără lipire. În cutie găsești și un extractor pentru switch-uri.',
  },
  'Does it work with macOS, Windows and Linux?': {
    question: 'Funcționează cu macOS, Windows și Linux?',
    answer:
      'Da. Tastatura vine cu keycaps dedicate pentru Mac și Windows și un comutator hardware. Pe Linux funcționează imediat, ca orice tastatură HID standard.',
  },
  'How do I remap keys?': {
    question: 'Cum îmi reprogramez tastele?',
    answer:
      'Firmware-ul este bazat pe QMK, cu suport VIA: reprogramezi taste, straturi și macro-uri direct din browser, fără drivere și fără cont.',
  },
};

type Copy = Required<Pick<ProductTranslation, 'tagline' | 'description' | 'highlights'>> &
  Pick<ProductTranslation, 'name'>;

const COPY: Record<string, Copy> = {
  'cse-forge-75': {
    tagline: 'Tastatură mecanică 75% cu montaj gasket, din aluminiu CNC',
    description: [
      'Forge 75 este tastatura pe care am construi-o pentru noi: format 75%, frezată dintr-un singur bloc de aluminiu 6063 și suspendată pe garnituri din silicon, pentru o apăsare moale și uniformă pe toată suprafața.',
      'Cinci straturi de spumă acustică și o placă FR4 reglată elimină sunetul gol și ecoul metalic, așa că fiecare apăsare sună profund și rotund. Treci pe Bluetooth sau 2.4GHz într-o secundă și tastezi săptămâni întregi cu o singură încărcare.',
    ],
    highlights: [
      'Montaj gasket cu placă FR4 flexibilă',
      'Tri-mode: USB-C, Bluetooth 5.1, 2.4GHz',
      'PCB hot-swap, orientat spre sud',
      'Amortizare acustică în cinci straturi',
    ],
  },
  'cse-atlas-tkl': {
    tagline: 'Tastatură mecanică TKL cu montaj top-mount și greutate din alamă',
    description: [
      'Atlas este o tastatură tenkeyless cu fir, cu placă de aluminiu montată top-mount pentru o senzație fermă și precisă și o greutate din alamă lustruită care o ține fix pe birou.',
      'Rata de interogare de 8000 Hz și rândul dedicat de taste funcționale o fac la fel de potrivită în editorul de cod și în jocurile competitive.',
    ],
    highlights: [
      'Placă de aluminiu top-mount',
      'Greutate din alamă lustruită',
      'Rată de interogare 8000 Hz',
      'PCB hot-swap',
    ],
  },
  'cse-nimbus-65': {
    tagline: 'Tastatură mecanică 65% din policarbonat translucid, cu montaj gasket moale',
    description: [
      'Nimbus combină o carcasă din policarbonat mat cu o placă din PC pentru cea mai moale și mai iertătoare senzație de tastare din gama noastră — ideală pentru sesiuni lungi de scris.',
      'Iluminarea RGB pe fiecare tastă se vede prin toată carcasa, iar conexiunea wireless tri-mode îți eliberează biroul de cabluri.',
    ],
    highlights: [
      'Carcasă din policarbonat mat',
      'Placă flexibilă din PC',
      'Wireless tri-mode',
      'Săgeți incluse într-un format compact 65%',
    ],
  },
  'cse-pulse-60': {
    tagline: 'Tastatură mecanică compactă 60%, perfectă ca prima tastatură',
    description: [
      'Pulse 60 este cea mai accesibilă cale către ecosistemul CSE: același PCB hot-swap, aceleași stabilizatoare reglate și keycaps PBT ca tastaturile noastre de top, într-o carcasă 60% ușoară și portabilă.',
    ],
    highlights: [
      'Format portabil 60%',
      'PCB hot-swap',
      'Stabilizatoare lubrifiate din fabrică',
      'Keycaps PBT double-shot',
    ],
  },
  'cse-orbit-96': {
    tagline: 'Tastatură mecanică 96% cu numpad complet, într-un format compact',
    description: [
      'Orbit 96 păstrează tastatura numerică de care ai nevoie pentru foi de calcul și economisește o palmă întreagă de spațiu pe birou față de o tastatură full-size.',
    ],
    highlights: [
      'Format 96% cu numpad',
      'Montaj gasket',
      'Wireless tri-mode',
      'Baterie de 5000 mAh',
    ],
  },
  'cse-summit-100': {
    tagline: 'Tastatură mecanică full-size, completă, cu latență mică',
    description: [
      'O tastatură full-size pentru cei care folosesc fiecare tastă. Summit adaugă un buton rotativ programabil pentru volum și un mod 2.4GHz cu latență mică, reglat pentru gaming.',
    ],
    highlights: [
      'Format full-size',
      'Buton rotativ programabil',
      '2.4GHz cu latență mică',
      'Serie de producție limitată',
    ],
  },
  'cse-silk-linear': {
    name: 'Switch-uri Silk Linear',
    tagline: 'Switch-uri liniare de 45 gf, lubrifiate din fabrică',
    description: [
      'Silk este un switch liniar fluid, cu tijă long-pole, carcasă din POM și o lubrifiere ușoară din fabrică, care păstrează cursa mătăsoasă fără să înăbușe sunetul.',
    ],
    highlights: [
      'Acționare la 45 gf, 55 gf la capăt de cursă',
      'Tijă long-pole din POM',
      'Lubrifiate din fabrică',
      '5 pini',
    ],
  },
  'cse-ember-tactile': {
    name: 'Switch-uri Ember Tactile',
    tagline: 'Feedback tactil rotunjit, 55 gf',
    description: [
      'Ember oferă un feedback tactil rotunjit și pronunțat chiar la începutul cursei, fără cursă liberă înainte.',
    ],
    highlights: [
      'Feedback tactil de 55 gf',
      'Fără cursă liberă',
      'Arc lubrifiat din fabrică',
      '5 pini',
    ],
  },
  'cse-crisp-clicky': {
    name: 'Switch-uri Crisp Clicky',
    tagline: 'Click bar pentru un clic clar și constant',
    description: [
      'Mecanismul cu click bar dă un clic clar și înalt la apăsare și o revenire curată.',
    ],
    highlights: ['Mecanism click bar', '60 gf', '5 pini'],
  },
  'paper-and-ink-pbt-keycaps': {
    name: 'Keycaps PBT Paper & Ink',
    tagline: 'PBT double-shot, profil Cherry',
    description: [
      'Taste alfanumerice alb-cald cu inscripții grafit închis: un set calm și atemporal, care se potrivește oricărei tastaturi.',
    ],
    highlights: [
      'PBT double-shot de 1,5 mm',
      'Profil Cherry',
      'Acoperă formatele de la 60% la 100%',
    ],
  },
  'copper-dusk-keycaps': {
    name: 'Keycaps Copper Dusk',
    tagline: 'Grafit și cupru, PBT dye-sub',
    description: [
      'Taste alfanumerice grafit cu accente de cupru și inscripții prin sublimare care nu se șterg niciodată.',
    ],
    highlights: ['PBT dye-sub', 'Profil Cherry', 'Taste de accent din cupru'],
  },
  'midnight-mono-abs-keycaps': {
    name: 'Keycaps ABS Midnight Mono',
    tagline: 'ABS double-shot lucios, profil OEM',
    description: ['ABS double-shot cu inscripții foarte clare și un sunet profund, „poppy”.'],
    highlights: ['ABS double-shot', 'Profil OEM'],
  },
  'cse-screw-in-stabilizers': {
    name: 'Stabilizatoare cu șurub',
    tagline: 'Stabilizatoare de PCB lubrifiate, fără zornăit',
    description: [
      'Sârme placate cu aur, carcase cu toleranțe strânse și lubrifiere din fabrică pentru o bară de spațiu silențioasă și uniformă.',
    ],
    highlights: ['Sârme placate cu aur', 'Lubrifiate din fabrică', 'Prindere cu șurub'],
  },
  'coiled-aviator-cable': {
    name: 'Cablu spiralat Aviator',
    tagline: 'Cablu USB-C spiralat cu conector aviator',
    description: ['Cablu spiralat cu înveliș dublu și conector aviator detașabil cu 5 pini.'],
    highlights: ['USB-C la USB-A', 'Lungime totală 1,8 m', 'Conector aviator'],
  },
  'contour-desk-mat': {
    name: 'Desk mat Contour',
    tagline: 'Margini cusute, imprimeu topografic',
    description: [
      'Suprafață textilă fină pe cauciuc natural, cu un imprimeu topografic discret și margini cusute.',
    ],
    highlights: ['Bază din cauciuc natural de 4 mm', 'Margini cusute', 'Strat rezistent la apă'],
  },
  'walnut-wrist-rest': {
    name: 'Suport pentru încheieturi din nuc',
    tagline: 'Lemn masiv de nuc american, finisaj cu ulei',
    description: ['Prelucrat din lemn masiv de nuc, cu o pantă lină și picioare antiderapante.'],
    highlights: ['Nuc american masiv', 'Finisaj natural cu ulei', 'Picioare antiderapante'],
  },
};

/** The Romanian overlay of one demo product, or undefined when it has no Romanian copy. */
export function romanianProduct(product: Product): ProductTranslation | undefined {
  const copy = COPY[product.slug];
  if (!copy) return undefined;
  return {
    ...copy,
    specs: product.specs.map((group) => ({
      group: romanianTerm(group.group),
      items: group.items.map((item) => ({
        label: romanianTerm(item.label),
        value: romanianTerm(item.value),
      })),
    })),
    included: product.included.map(romanianTerm),
    compatibility: product.compatibility.map(romanianTerm),
    faq: product.faq.map((entry) => KEYBOARD_FAQ[entry.question] ?? entry),
    options: Object.fromEntries(
      product.options.map((option) => [
        option.key,
        {
          name: romanianTerm(option.name),
          values: Object.fromEntries(
            option.values.map((value) => [
              value.value,
              {
                label: romanianTerm(value.label),
                ...(value.hint ? { hint: romanianTerm(value.hint) } : {}),
              },
            ]),
          ),
        },
      ]),
    ),
  };
}

export const romanianCategories: Record<string, CategoryTranslation> = {
  keyboards: {
    name: 'Tastaturi mecanice',
    description:
      'Asamblate, reglate și gata de tastat. Tastaturi cu montaj gasket și top-mount, de la 60% la full-size.',
  },
  switches: {
    name: 'Switch-uri',
    description:
      'Switch-uri liniare, tactile și clicky, lubrifiate din fabrică și testate în atelierul nostru.',
  },
  keycaps: {
    name: 'Keycaps',
    description: 'Seturi din PBT și ABS double-shot, cu profil Cherry și OEM.',
  },
  accessories: {
    name: 'Accesorii',
    description:
      'Tot ce e în jurul tastaturii: stabilizatoare, cabluri, desk mat-uri și suporturi pentru încheieturi.',
  },
  stabilizers: {
    name: 'Stabilizatoare',
    description: 'Stabilizatoare cu șurub pentru o bară de spațiu fără zornăit.',
  },
  cables: {
    name: 'Cabluri',
    description: 'Cabluri USB-C spiralate și drepte, cu conector aviator.',
  },
  'desk-mats': {
    name: 'Desk mat-uri',
    description: 'Desk mat-uri cu margini cusute, pentru orice format de tastatură.',
  },
  'wrist-rests': {
    name: 'Suporturi pentru încheieturi',
    description: 'Suporturi din lemn masiv și rășină, potrivite fiecărei dimensiuni de tastatură.',
  },
};

export const romanianConfigurator: ConfiguratorTranslation = {
  name: 'CSE Custom',
  description:
    'Alegi fiecare componentă a tastaturii. Noi o asamblăm, o lubrifiem și o testăm acustic înainte de expediere.',
  options: {
    'case:black': { label: 'Negru' },
    'case:white': { label: 'Alb' },
    'case:silver': { label: 'Argintiu', description: 'Sablat, anodizat' },
    'switch:linear': { label: 'Liniar' },
    'switch:tactile': { label: 'Tactil' },
    'plate:aluminum': { label: 'Aluminiu', description: 'Fermă, precisă' },
    'plate:fr4': { description: 'Flexibilitate echilibrată' },
    'plate:polycarbonate': { label: 'Policarbonat', description: 'Sunet moale, profund' },
    'keycaps:abs': { description: 'Double-shot, lucioase' },
    'keycaps:pbt': { description: 'Double-shot, texturate' },
    'connection:wired': { label: 'Cu fir' },
    'connection:2-4ghz': { description: 'Tri-mode cu receptor' },
  },
  reasons: {
    'layout:100+connection:2-4ghz':
      'Carcasa 100% nu are loc pentru bateria și receptorul modului tri-mode',
    'plate:polycarbonate+switch:clicky':
      'Plăcile din policarbonat se flexează prea mult pentru switch-urile cu click bar',
  },
};
