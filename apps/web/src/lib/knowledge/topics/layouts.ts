import type { Topic } from '../types';

export const layoutsTopic: Topic = {
  slug: 'layouts',
  name: { ro: 'Tipuri și layout-uri', en: 'Types and layouts' },
  title: { ro: 'Tipuri de tastaturi și layout-uri', en: 'Keyboard types and layouts' },
  summary: {
    ro: 'Cum funcționează o tastatură cu membrană față de una mecanică, ce înseamnă QWERTY, Dvorak sau Colemak și ce câștigi sau pierzi la fiecare format, de la 100% la 60%.',
    en: 'How a membrane keyboard works compared with a mechanical one, what QWERTY, Dvorak and Colemak mean, and what you gain or give up with each size, from 100% down to 60%.',
  },
  emblem: 'layout-sizes',
  chapters: [
    {
      id: 'membrane-vs-mechanical',
      title: { ro: 'Membrană sau mecanic', en: 'Membrane or mechanical' },
      blocks: [
        {
          kind: 'prose',
          section: '2.1',
          paragraphs: [
            {
              ro: 'Cât de eficientă este o tastatură depinde de două lucruri: tehnologia care detectează apăsările și felul în care sunt aranjate tastele (layout-ul). Împreună, ele influențează direct viteza de scriere, măsurată în cuvinte pe minut (WPM).',
              en: 'How efficient a keyboard is depends on two things: the technology that detects key presses and the way the keys are arranged (the layout). Together they directly affect typing speed, measured in words per minute (WPM).',
            },
          ],
        },
        {
          kind: 'options',
          section: '2.1',
          title: { ro: 'Cele două tehnologii', en: 'The two technologies' },
          items: [
            {
              name: { ro: 'Tastatură cu membrană', en: 'Membrane keyboard' },
              summary: {
                ro: 'Trei straturi flexibile: cel de sus și cel de jos au trasee conductoare care formează o matrice, iar cel din mijloc este un separator cu găuri sub fiecare tastă. La apăsare, o cupolă de cauciuc (rubber dome) împinge stratul de sus prin gaură până atinge stratul de jos, iar controlerul citește contactul ca pe o apăsare. Tasta trebuie apăsată complet („bottom out”) ca să fie înregistrată.',
                en: 'Three flexible layers: the top and bottom ones carry conductive traces that form a matrix, and the middle one is a spacer with a hole under each key. When you press, a rubber dome pushes the top layer through the hole onto the bottom layer, and the controller reads that contact as a key press. The key has to be pressed all the way down (“bottoming out”) to register.',
              },
              pros: [
                { ro: 'Cost de producție foarte redus', en: 'Very low production cost' },
                { ro: 'Funcționare silențioasă', en: 'Quiet operation' },
                {
                  ro: 'Rezistență mai bună la lichide, datorită construcției sigilate',
                  en: 'Better resistance to liquids, thanks to the sealed construction',
                },
              ],
              cons: [
                {
                  ro: 'Senzație „buretoasă” (mushy), fără feedback tactil clar',
                  en: 'A “mushy” feel with no clear tactile feedback',
                },
                {
                  ro: 'Durabilitate redusă: cupolele de cauciuc își pierd elasticitatea și cer tot mai multă forță',
                  en: 'Lower durability: the rubber domes lose elasticity and need more and more force',
                },
                {
                  ro: 'Apăsarea completă poate obosi mâna și reduce viteza de scriere',
                  en: 'Pressing all the way down can tire the hand and slow typing',
                },
                {
                  ro: 'Predispoziție la ghosting la modelele ieftine',
                  en: 'Prone to ghosting on cheap models',
                },
              ],
            },
            {
              name: { ro: 'Tastatură mecanică', en: 'Mechanical keyboard' },
              summary: {
                ro: 'Fiecare tastă are propriul comutator (switch), cu carcasă, arc, ax (stem) și contacte metalice. Tasta se înregistrează la punctul de actuare, înainte de capătul cursei, ceea ce face scrisul mai rapid, mai precis și mai puțin obositor.',
                en: 'Every key has its own switch, with a housing, a spring, a stem and metal contacts. The key registers at the actuation point, before the end of its travel, which makes typing faster, more accurate and less tiring.',
              },
              pros: [
                {
                  ro: 'Durabilitate de zeci de milioane de apăsări per switch',
                  en: 'Durability of tens of millions of presses per switch',
                },
                {
                  ro: 'Poți alege switch-uri după preferințele tale',
                  en: 'You can choose switches to suit your preferences',
                },
                {
                  ro: 'Mai eficientă pentru utilizare intensivă: programare, scris, gaming',
                  en: 'More efficient for heavy use: programming, writing, gaming',
                },
              ],
              cons: [
                {
                  ro: 'Contactul metalic „sare” la apăsare (contact bounce), așa că firmware-ul trebuie să aplice debounce',
                  en: 'The metal contact “bounces” when pressed (contact bounce), so the firmware has to apply debounce',
                },
              ],
            },
          ],
        },
        {
          kind: 'terms',
          section: '2.1',
          items: [
            {
              term: { ro: 'Ghosting', en: 'Ghosting' },
              body: {
                ro: 'Apăsări „fantomă” când sunt ținute apăsate trei sau mai multe taste deodată. Apare la tastaturile ieftine care nu au diode de izolare în matrice, așa că logica de control nu poate deosebi corect anumite combinații.',
                en: '“Phantom” key presses when three or more keys are held at once. It happens on cheap keyboards that have no isolation diodes in the matrix, so the controller cannot tell certain combinations apart.',
              },
            },
            {
              term: { ro: 'Debounce', en: 'Debounce' },
              body: {
                ro: 'La scară microscopică, contactul metalic nu se închide curat, ci generează o serie de impulsuri foarte rapide. Algoritmul de debounce din firmware (o mică întârziere sau o filtrare a semnalului) le transformă într-o singură apăsare validă.',
                en: 'At a microscopic scale, the metal contact does not close cleanly but produces a burst of very fast pulses. The firmware’s debounce algorithm (a short delay or a signal filter) turns them into a single valid key press.',
              },
            },
          ],
        },
      ],
    },
    {
      id: 'logical-layouts',
      title: { ro: 'Layout logic: QWERTY și alternative', en: 'Logical layout: QWERTY and others' },
      blocks: [
        {
          kind: 'prose',
          section: '2.1',
          paragraphs: [
            {
              ro: 'Layout-ul logic înseamnă ce caracter corespunde fiecărei taste fizice. Este altceva decât forma sau mărimea tastaturii.',
              en: 'The logical layout is which character each physical key produces. It is separate from the shape or size of the keyboard.',
            },
          ],
        },
        {
          kind: 'options',
          section: '2.1',
          items: [
            {
              name: { ro: 'QWERTY', en: 'QWERTY' },
              summary: {
                ro: 'Cel mai răspândit layout. Designul său istoric a fost gândit să prevină blocarea brațelor la mașinile de scris mecanice, nu să optimizeze viteza de tastare de azi.',
                en: 'The most widespread layout. Its historical design was meant to stop the arms of mechanical typewriters from jamming, not to optimise typing speed today.',
              },
              cons: [
                {
                  ro: 'Degetele parcurg distanțe mari',
                  en: 'Fingers travel long distances',
                },
                {
                  ro: 'Litere folosite des stau în poziții mai greu accesibile',
                  en: 'Frequently used letters sit in harder-to-reach positions',
                },
              ],
            },
            {
              name: { ro: 'Dvorak și Colemak', en: 'Dvorak and Colemak' },
              summary: {
                ro: 'Layout-uri alternative, proiectate ergonomic: vocalele și consoanele cele mai frecvente stau pe rândul de bază (home row).',
                en: 'Alternative layouts designed for ergonomics: the most frequent vowels and consonants sit on the home row.',
              },
              pros: [
                { ro: 'Mai puțină mișcare a degetelor', en: 'Less finger movement' },
                { ro: 'Viteză de tastare mai mare', en: 'Higher typing speed' },
                {
                  ro: 'Risc mai mic de afecțiuni de efort repetitiv (RSI)',
                  en: 'Lower risk of repetitive strain injury (RSI)',
                },
              ],
            },
          ],
        },
        {
          kind: 'callout',
          section: '2.1',
          title: {
            ro: 'Layout-ul se poate seta în tastatură',
            en: 'The layout can live in the keyboard',
          },
          body: {
            ro: 'Tastatura nu trimite litere precum „A” sau „B”, ci coduri de scanare HID standardizate (HID scancodes). Un firmware personalizat precum ZMK poate asocia orice tastă fizică oricărui cod, așa că poți folosi QWERTY, Dvorak sau Colemak direct din tastatură, indiferent de setările sistemului de operare.',
            en: 'A keyboard does not send letters like “A” or “B”; it sends standardised HID scan codes. Custom firmware such as ZMK can map any physical key to any code, so you can run QWERTY, Dvorak or Colemak from the keyboard itself, whatever the operating system is set to.',
          },
        },
      ],
    },
    {
      id: 'physical-layouts',
      title: { ro: 'Layout fizic: de la 100% la 60%', en: 'Physical layout: 100% to 60%' },
      blocks: [
        {
          kind: 'prose',
          section: '2.1',
          paragraphs: [
            {
              ro: 'Layout-ul fizic înseamnă câte taste are tastatura, cum sunt aranjate și cât de mari sunt. Alegerea lui este un compromis între a avea toate tastele la îndemână și a câștiga spațiu pe birou pentru o postură mai bună.',
              en: 'The physical layout is how many keys the keyboard has, how they are arranged and how big they are. Choosing one is a trade-off between having every key at hand and freeing desk space for a better posture.',
            },
            {
              ro: 'Pe partea electronică, un layout mai mare înseamnă o matrice de scanare mai complexă pe PCB, cu mai multe rânduri și coloane, deci mai mulți pini GPIO ceruți microcontrolerului.',
              en: 'On the electronics side, a bigger layout means a more complex scanning matrix on the PCB, with more rows and columns, and therefore more GPIO pins from the microcontroller.',
            },
          ],
        },
        {
          kind: 'diagram',
          section: '2.1',
          diagram: 'layout-sizes',
          caption: {
            ro: 'Formatele uzuale, de la full-size (100%) la 60%: fiecare pas elimină un bloc de taste.',
            en: 'The common sizes, from full-size (100%) to 60%: each step removes a block of keys.',
          },
        },
        {
          kind: 'options',
          section: '2.1',
          title: { ro: 'Formatele și compromisurile lor', en: 'The sizes and their trade-offs' },
          items: [
            {
              name: { ro: '100% (full-size)', en: '100% (full-size)' },
              summary: {
                ro: 'Toate blocurile de taste, inclusiv tastatura numerică (Numpad).',
                en: 'Every block of keys, including the number pad (numpad).',
              },
              pros: [
                {
                  ro: 'Ideal pentru introducerea frecventă de cifre: contabilitate, inginerie, data entry',
                  en: 'Best for entering numbers often: accounting, engineering, data entry',
                },
                {
                  ro: 'Toate funcțiile sunt directe, fără combinații de taste',
                  en: 'Every function is direct, with no key combinations',
                },
              ],
              cons: [
                {
                  ro: 'Lățimea mare împinge mouse-ul departe și crește tensiunea în umăr',
                  en: 'The width pushes the mouse far out and adds strain to the shoulder',
                },
              ],
            },
            {
              name: { ro: 'TKL (tenkeyless, 80%)', en: 'TKL (tenkeyless, 80%)' },
              summary: {
                ro: 'Un 100% fără Numpad. Mulți îl consideră punctul de echilibru optim.',
                en: 'A 100% without the numpad. Many consider it the best balance.',
              },
              pros: [
                {
                  ro: 'Mouse-ul stă mai aproape de centrul corpului, deci mâna parcurge mult mai puțin',
                  en: 'The mouse sits closer to the centre of the body, so the hand travels much less',
                },
                {
                  ro: 'Păstrează tastele de navigație și rândul de funcții, potrivit pentru programatori',
                  en: 'Keeps the navigation keys and the function row, which suits programmers',
                },
              ],
            },
            {
              name: { ro: '75%', en: '75%' },
              summary: {
                ro: 'Un TKL mai compact, cu tastele de navigație așezate vertical pentru a economisi spațiu pe orizontală.',
                en: 'A more compact TKL, with the navigation keys stacked vertically to save horizontal space.',
              },
              pros: [
                {
                  ro: 'Păstrează aproape toate tastele unui TKL într-o amprentă mică',
                  en: 'Keeps almost every key of a TKL in a small footprint',
                },
                {
                  ro: 'Bun pentru birouri aglomerate și pentru transport',
                  en: 'Good for crowded desks and for carrying around',
                },
              ],
              cons: [
                {
                  ro: 'Folosește adesea taste de mărimi nestandard (de ex. un Shift dreapta mai scurt), ceea ce complică PCB-ul și compatibilitatea cu seturile de keycaps',
                  en: 'Often uses non-standard key sizes (e.g. a shorter right Shift), which complicates the PCB and compatibility with keycap sets',
                },
              ],
            },
            {
              name: { ro: '65% și 60%', en: '65% and 60%' },
              summary: {
                ro: 'Formate minimaliste fără rândul de funcții (F1–F12); 60% renunță și la săgețile dedicate.',
                en: 'Minimal sizes without the function row (F1–F12); 60% also drops the dedicated arrow keys.',
              },
              pros: [
                {
                  ro: 'Spațiu maxim pe birou și o estetică minimalistă',
                  en: 'Maximum desk space and a minimal look',
                },
                {
                  ro: 'Mâinile nu părăsesc zona centrală a tastaturii',
                  en: 'Your hands never leave the centre of the keyboard',
                },
              ],
              cons: [
                {
                  ro: 'Tastele lipsă se accesează prin straturi (layers), așa că eficiența vine cu experiența',
                  en: 'The missing keys are reached through layers, so the efficiency comes with experience',
                },
              ],
            },
          ],
        },
      ],
    },
    {
      id: 'layers',
      title: { ro: 'Straturi: tasta Fn', en: 'Layers: the Fn key' },
      blocks: [
        {
          kind: 'prose',
          section: '2.1',
          paragraphs: [
            {
              ro: 'Formatele compacte funcționează datorită straturilor (layers), o funcție a firmware-ului. Tasta Fn schimbă starea tastaturii: cât timp e apăsată, firmware-ul trece de la tabela de bază (Layer 0) la una secundară (Layer 1).',
              en: 'Compact sizes work thanks to layers, a firmware feature. The Fn key changes the keyboard’s state: while it is held, the firmware switches from the base key map (Layer 0) to a secondary one (Layer 1).',
            },
            {
              ro: 'Astfel, aceeași tastă fizică poate trimite alt cod: „1” devine „F1”, „I” devine săgeata în sus și așa mai departe. Un utilizator cu experiență devine foarte rapid, pentru că mâinile rămân mereu pe zona centrală.',
              en: 'The same physical key can then send a different code: “1” becomes “F1”, “I” becomes the up arrow, and so on. An experienced user becomes very fast, because their hands always stay on the centre of the board.',
            },
          ],
        },
        {
          kind: 'callout',
          section: '2.1',
          title: { ro: 'Pe scurt', en: 'In short' },
          body: {
            ro: 'Eficiența reală a unei tastaturi vine din combinația dintre tehnologia switch-urilor, layout-ul logic și fizic ales ca să reducă mișcările inutile, și experiența tactilă și acustică dată de felul în care e montată placa.',
            en: 'A keyboard’s real efficiency comes from the combination of switch technology, a logical and physical layout chosen to cut needless movement, and the feel and sound that come from how the plate is mounted.',
          },
        },
      ],
    },
  ],
  related: [{ href: '/shop/keyboards', label: { ro: 'Vezi tastaturile', en: 'Browse keyboards' } }],
};
