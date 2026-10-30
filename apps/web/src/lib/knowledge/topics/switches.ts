import type { Topic } from '../types';

export const switchesTopic: Topic = {
  slug: 'switches',
  name: { ro: 'Switch-uri', en: 'Switches' },
  title: { ro: 'Cum funcționează un switch', en: 'How a switch works' },
  summary: {
    ro: 'Din ce e făcut un switch mecanic, ce înseamnă punctul de actuare și cursa totală, de ce e nevoie de debounce și cum alegi între liniar, tactil și clicky.',
    en: 'What a mechanical switch is made of, what actuation point and total travel mean, why debounce is needed, and how to choose between linear, tactile and clicky.',
  },
  emblem: 'switch-travel',
  chapters: [
    {
      id: 'anatomy',
      title: { ro: 'Anatomia unui switch', en: 'Anatomy of a switch' },
      blocks: [
        {
          kind: 'prose',
          section: '2.1',
          paragraphs: [
            {
              ro: 'Într-o tastatură mecanică, fiecare tastă are propriul comutator (switch). Este o soluție superioară tehnic față de membrană, unde toate tastele împart aceleași straturi flexibile.',
              en: 'In a mechanical keyboard, every key has its own switch. Technically it is a better solution than a membrane, where all keys share the same flexible layers.',
            },
            {
              ro: 'La apăsare, arcul se comprimă, iar axul permite contactul fizic dintre cele două piese metalice, iar tasta este înregistrată.',
              en: 'When you press, the spring compresses and the stem lets the two metal parts touch, and the key is registered.',
            },
          ],
        },
        {
          kind: 'terms',
          section: '2.1',
          title: { ro: 'Piesele unui switch', en: 'The parts of a switch' },
          items: [
            {
              term: { ro: 'Carcasa', en: 'Housing' },
              body: {
                ro: 'Corpul switch-ului, în care se află celelalte piese.',
                en: 'The body of the switch, which contains the other parts.',
              },
            },
            {
              term: { ro: 'Arcul', en: 'Spring' },
              body: {
                ro: 'Determină forța de apăsare.',
                en: 'Sets the force needed to press the key.',
              },
            },
            {
              term: { ro: 'Axul (stem)', en: 'Stem' },
              body: {
                ro: 'Forma lui definește feedback-ul tactil.',
                en: 'Its shape defines the tactile feedback.',
              },
            },
            {
              term: { ro: 'Contactele metalice', en: 'Metal contacts' },
              body: {
                ro: 'Două piese de înaltă precizie care se ating și închid circuitul.',
                en: 'Two high-precision parts that touch and close the circuit.',
              },
            },
          ],
        },
        {
          kind: 'callout',
          section: '2.1',
          title: { ro: 'Durabilitate', en: 'Durability' },
          body: {
            ro: 'Un switch mecanic rezistă zeci de milioane de apăsări. Împreună cu posibilitatea de a alege switch-ul potrivit, asta face tastaturile mecanice mai eficiente pentru utilizare intensivă: programare, scris, gaming.',
            en: 'A mechanical switch lasts tens of millions of presses. Together with being able to pick the right switch, this makes mechanical keyboards more efficient for heavy use: programming, writing, gaming.',
          },
        },
      ],
    },
    {
      id: 'actuation-and-travel',
      title: { ro: 'Actuare și cursă totală', en: 'Actuation and total travel' },
      blocks: [
        {
          kind: 'diagram',
          section: '2.1',
          diagram: 'switch-travel',
          caption: {
            ro: 'Tasta se înregistrează la punctul de actuare (de exemplu 2 mm), înainte de capătul cursei totale (de exemplu 4 mm).',
            en: 'The key registers at the actuation point (for example 2 mm), before the end of its total travel (for example 4 mm).',
          },
        },
        {
          kind: 'terms',
          section: '2.1',
          items: [
            {
              term: { ro: 'Punctul de actuare', en: 'Actuation point' },
              body: {
                ro: 'Poziția din cursă la care se face contactul electric și tasta este înregistrată, de exemplu la 2 mm.',
                en: 'The point in the travel where the electrical contact is made and the key registers, for example at 2 mm.',
              },
            },
            {
              term: { ro: 'Cursa totală', en: 'Total travel' },
              body: {
                ro: 'Distanța maximă pe care o poate parcurge tasta, de exemplu 4 mm.',
                en: 'The furthest the key can move, for example 4 mm.',
              },
            },
          ],
        },
        {
          kind: 'prose',
          section: '2.1',
          paragraphs: [
            {
              ro: 'Pentru că actuarea are loc înainte de capătul cursei, nu trebuie să apeși tasta până jos. Scrisul devine mai rapid, mai precis și mai puțin obositor.',
              en: 'Because actuation happens before the end of the travel, you do not have to press the key all the way down. Typing becomes faster, more accurate and less tiring.',
            },
          ],
        },
      ],
    },
    {
      id: 'debounce',
      title: { ro: 'Contact bounce și debounce', en: 'Contact bounce and debounce' },
      blocks: [
        {
          kind: 'prose',
          section: '2.1',
          paragraphs: [
            {
              ro: 'La scară microscopică, primul contact metalic nu e perfect. În loc de o singură închidere curată, switch-ul generează o serie de impulsuri electrice foarte rapide, numite contact bounce.',
              en: 'At a microscopic scale, the first metal contact is not perfect. Instead of one clean closure, the switch produces a series of very fast electrical pulses, called contact bounce.',
            },
          ],
        },
        {
          kind: 'callout',
          section: '4.3',
          title: { ro: 'Ce face debounce-ul', en: 'What debounce does' },
          body: {
            ro: 'Fără filtrare, o singură apăsare ar putea fi înregistrată de mai multe ori. Algoritmul de debounce din firmware folosește un timer: apăsarea este validată doar după ce starea contactului rămâne stabilă câteva milisecunde.',
            en: 'Without filtering, a single press could be registered several times. The firmware’s debounce algorithm uses a timer: the press is accepted only once the contact has stayed stable for a few milliseconds.',
          },
        },
      ],
    },
    {
      id: 'switch-types',
      title: { ro: 'Liniar, tactil sau clicky', en: 'Linear, tactile or clicky' },
      blocks: [
        {
          kind: 'options',
          section: '3.3',
          items: [
            {
              name: { ro: 'Liniar (de ex. Red)', en: 'Linear (e.g. Red)' },
              summary: {
                ro: 'Cursă lină, fără feedback tactil sau sonor la punctul de actuare. Forța necesară rămâne constantă pe toată cursa.',
                en: 'A smooth travel with no tactile or audible feedback at the actuation point. The force needed stays constant over the whole travel.',
              },
              pros: [
                {
                  ro: 'Bun pentru gaming, la apăsări rapide și repetate',
                  en: 'Good for gaming, with fast repeated presses',
                },
                {
                  ro: 'Potrivit pentru birouri unde se dorește zgomot redus',
                  en: 'Suits offices where low noise matters',
                },
              ],
            },
            {
              name: { ro: 'Tactil (de ex. Brown)', en: 'Tactile (e.g. Brown)' },
              summary: {
                ro: 'Un hibrid: la punctul de actuare simți un „bump” (o denivelare), perceptibil dar silențios, care confirmă că tasta a fost înregistrată, fără click audibil.',
                en: 'A hybrid: at the actuation point you feel a “bump”, noticeable but quiet, which confirms the key registered, with no audible click.',
              },
              pros: [
                {
                  ro: 'Soluție excelentă pentru uz general, atât pentru scris, cât și pentru gaming',
                  en: 'An excellent all-round choice, for both writing and gaming',
                },
              ],
            },
            {
              name: { ro: 'Clicky (de ex. Blue)', en: 'Clicky (e.g. Blue)' },
              summary: {
                ro: 'Ca un switch tactil, dar bump-ul vine împreună cu un „click” audibil la punctul de actuare.',
                en: 'Like a tactile switch, but the bump comes with an audible “click” at the actuation point.',
              },
              pros: [
                {
                  ro: 'Preferat de mulți programatori și scriitori pentru feedback-ul tactil și sonor',
                  en: 'Preferred by many programmers and writers for the tactile and audible feedback',
                },
              ],
            },
          ],
        },
        {
          kind: 'table',
          section: '3.3',
          title: { ro: 'Comparația tipurilor de switch', en: 'Switch types compared' },
          columns: [
            { ro: 'Tip switch', en: 'Switch type' },
            { ro: 'Scenariu de utilizare', en: 'Use case' },
            { ro: 'Forță de acționare', en: 'Actuation force' },
            { ro: 'Nivel de zgomot', en: 'Noise level' },
            { ro: 'Aplicații tipice', en: 'Typical applications' },
            { ro: 'Avantaje', en: 'Advantages' },
            { ro: 'Dezavantaje', en: 'Disadvantages' },
          ],
          rows: [
            [
              { ro: 'Liniar', en: 'Linear' },
              { ro: 'Gaming', en: 'Gaming' },
              { ro: '45g', en: '45g' },
              { ro: 'Scăzut', en: 'Low' },
              { ro: 'Jocuri FPS', en: 'FPS games' },
              { ro: 'Cursă lină', en: 'Smooth travel' },
              { ro: 'Lipsește feedback-ul tactil', en: 'No tactile feedback' },
            ],
            [
              { ro: 'Tactil', en: 'Tactile' },
              { ro: 'Scris', en: 'Writing' },
              { ro: '50g', en: '50g' },
              { ro: 'Moderat', en: 'Moderate' },
              { ro: 'Muncă de birou', en: 'Office work' },
              { ro: '„Prag” tactil perceptibil', en: 'Noticeable tactile “bump”' },
              { ro: 'Poate fi mai zgomotos', en: 'Can be noisier' },
            ],
            [
              { ro: 'Clicky', en: 'Clicky' },
              { ro: 'Pentru feedback maxim', en: 'For maximum feedback' },
              { ro: '55g', en: '55g' },
              { ro: 'Ridicat', en: 'High' },
              { ro: 'Sesiuni de scris', en: 'Writing sessions' },
              { ro: 'Feedback tactil și auditiv', en: 'Tactile and audible feedback' },
              {
                ro: 'Neadecvat pentru spații silențioase',
                en: 'Unsuitable for quiet spaces',
              },
            ],
          ],
          rowHeader: 0,
        },
        {
          kind: 'callout',
          section: '3.3',
          title: { ro: 'În prototipul din lucrare', en: 'In the thesis prototype' },
          body: {
            ro: 'Prototipul folosește switch-uri liniare, dar placa este compatibilă cu majoritatea switch-urilor de tip MX.',
            en: 'The prototype uses linear switches, but the board is compatible with most MX-style switches.',
          },
        },
      ],
    },
  ],
  related: [{ href: '/shop/switches', label: { ro: 'Vezi switch-urile', en: 'Browse switches' } }],
};
