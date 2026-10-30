import type { Topic } from '../types';

export const mountingTopic: Topic = {
  slug: 'mounting',
  name: { ro: 'Montare și materiale', en: 'Mounting & materials' },
  title: { ro: 'Cum se montează placa', en: 'How the plate is mounted' },
  summary: {
    ro: 'Din ce straturi e făcută o tastatură mecanică și cum felul în care placa și PCB-ul sunt prinse în carcasă (de la integrated plate la gasket mount) schimbă senzația și sunetul.',
    en: 'The layers a mechanical keyboard is built from, and how the way the plate and PCB are held in the case (from integrated plate to gasket mount) changes the feel and the sound.',
  },
  emblem: 'exploded-stack',
  chapters: [
    {
      id: 'the-stack',
      title: { ro: 'Straturile unei tastaturi', en: 'The layers of a keyboard' },
      blocks: [
        {
          kind: 'diagram',
          section: '1.1',
          diagram: 'exploded-stack',
          caption: {
            ro: 'De sus în jos: keycaps, switch-uri, placa de montare (plate), PCB-ul și carcasa.',
            en: 'From top to bottom: keycaps, switches, the mounting plate, the PCB and the case.',
          },
        },
        {
          kind: 'terms',
          section: '1.1',
          items: [
            {
              term: { ro: 'Keycaps', en: 'Keycaps' },
              body: {
                ro: 'Capacele tastelor, partea pe care o atingi.',
                en: 'The key caps, the part you touch.',
              },
            },
            {
              term: { ro: 'Switch-uri', en: 'Switches' },
              body: {
                ro: 'Câte un comutator mecanic pentru fiecare tastă.',
                en: 'One mechanical switch per key.',
              },
            },
            {
              term: { ro: 'Placa de montare (plate)', en: 'Mounting plate' },
              body: {
                ro: 'Fixează mecanic switch-urile, dictează rigiditatea ansamblului și definește în mare parte senzația și sunetul la tastare.',
                en: 'Holds the switches in place, sets how stiff the assembly is, and largely defines how typing feels and sounds.',
              },
            },
            {
              term: { ro: 'PCB', en: 'PCB' },
              body: {
                ro: 'Placa de circuit imprimat, care definește funcționalitatea tastaturii.',
                en: 'The printed circuit board, which defines what the keyboard does.',
              },
            },
            {
              term: { ro: 'Carcasa', en: 'Case' },
              body: {
                ro: 'Structura exterioară, de exemplu din aluminiu frezat CNC sau din policarbonat injectat.',
                en: 'The outer shell, for example CNC-milled aluminium or injection-moulded polycarbonate.',
              },
            },
          ],
        },
        {
          kind: 'prose',
          section: '2.1',
          paragraphs: [
            {
              ro: 'Felul în care ansamblul placă–PCB este prins în carcasă influențează profund senzația la tastare și sunetul produs. Deși sunt aspecte subiective, ele contează pentru confortul pe termen lung.',
              en: 'The way the plate–PCB assembly is held in the case deeply affects how typing feels and the sound it makes. Although these are subjective, they matter for long-term comfort.',
            },
          ],
        },
      ],
    },
    {
      id: 'rigid-mounts',
      title: { ro: 'Integrated plate și tray mount', en: 'Integrated plate and tray mount' },
      blocks: [
        {
          kind: 'prose',
          section: '2.1',
          paragraphs: [
            {
              ro: 'Cele mai simple construcții sunt și cele mai rigide. Sunt ieftine și solide, dar plătești în senzația la tastare.',
              en: 'The simplest constructions are also the stiffest. They are cheap and solid, but you pay for it in how typing feels.',
            },
          ],
        },
        {
          kind: 'options',
          section: '2.1',
          items: [
            {
              name: { ro: 'Integrated plate (placă integrată)', en: 'Integrated plate' },
              summary: {
                ro: 'Placa nu e o piesă separată, ci face parte din jumătatea de sus a carcasei. Switch-urile se montează direct în ea.',
                en: 'The plate is not a separate part but belongs to the top half of the case. The switches go straight into it.',
              },
              pros: [
                {
                  ro: 'Cea mai simplă și mai rigidă construcție',
                  en: 'The simplest and stiffest construction',
                },
                { ro: 'Tastatură extrem de solidă', en: 'An extremely solid keyboard' },
              ],
              cons: [
                {
                  ro: 'Senzație foarte rigidă și adesea aspră: vibrațiile fiecărei apăsări trec direct în toată carcasa',
                  en: 'A very stiff, often harsh feel: the vibration of every press goes straight into the whole case',
                },
              ],
              diagram: 'mount-integrated',
            },
            {
              name: { ro: 'Tray mount', en: 'Tray mount' },
              summary: {
                ro: 'Ansamblul placă–PCB este înșurubat direct în puncte de prindere din partea de jos a carcasei.',
                en: 'The plate–PCB assembly is screwed straight into mounting points in the bottom of the case.',
              },
              pros: [{ ro: 'Simplu, rigid și ieftin', en: 'Simple, stiff and cheap' }],
              cons: [
                {
                  ro: 'Senzație inconsistentă: tastele de lângă șuruburi sunt mai rigide, cele din centru mai flexibile',
                  en: 'An inconsistent feel: keys near the screws are stiffer, those in the middle more flexible',
                },
              ],
              diagram: 'mount-tray',
            },
          ],
        },
      ],
    },
    {
      id: 'top-bottom-sandwich',
      title: { ro: 'Top, bottom și sandwich', en: 'Top, bottom and sandwich' },
      blocks: [
        {
          kind: 'prose',
          section: '2.1',
          paragraphs: [
            {
              ro: 'Aceste metode sunt mai bune decât tray mount la capitolul consistență: ansamblul este susținut de jur împrejur, nu în câteva puncte izolate, așa că senzația e mult mai uniformă pe toată suprafața.',
              en: 'These methods beat tray mount on consistency: the assembly is supported all the way around rather than at a few separate points, so the feel is much more even across the whole board.',
            },
          ],
        },
        {
          kind: 'options',
          section: '2.1',
          items: [
            {
              name: { ro: 'Top mount', en: 'Top mount' },
              summary: {
                ro: 'Placa are extensii care se înșurubează în jumătatea de sus a carcasei.',
                en: 'The plate has tabs that screw into the top half of the case.',
              },
              diagram: 'mount-top',
            },
            {
              name: { ro: 'Bottom mount', en: 'Bottom mount' },
              summary: {
                ro: 'Invers: placa se prinde de jumătatea de jos a carcasei.',
                en: 'The reverse: the plate is fixed to the bottom half of the case.',
              },
              diagram: 'mount-bottom',
            },
            {
              name: { ro: 'Sandwich mount', en: 'Sandwich mount' },
              summary: {
                ro: 'Marginile plăcii sunt prinse „ca într-un sandviș” între jumătatea de sus și cea de jos, și ținute fix când carcasa e asamblată.',
                en: 'The edges of the plate are clamped “like a sandwich” between the top and bottom halves and held firmly once the case is assembled.',
              },
              pros: [
                {
                  ro: 'Construcție foarte solidă, senzație fermă și consistentă',
                  en: 'A very solid build with a firm, consistent feel',
                },
              ],
              cons: [
                {
                  ro: 'Ca la integrated plate, poate fi destul de rigid și poate transmite multe vibrații, în funcție de materiale',
                  en: 'Like an integrated plate, it can be quite stiff and pass on a lot of vibration, depending on the materials',
                },
              ],
              diagram: 'mount-sandwich',
            },
          ],
        },
      ],
    },
    {
      id: 'gasket-mount',
      title: { ro: 'Gasket mount', en: 'Gasket mount' },
      blocks: [
        {
          kind: 'diagram',
          section: '2.1',
          diagram: 'mount-gasket',
          caption: {
            ro: 'La gasket mount, ansamblul placă–PCB stă suspendat între cele două jumătăți ale carcasei, pe garnituri flexibile.',
            en: 'In a gasket mount, the plate–PCB assembly is suspended between the two halves of the case on flexible gaskets.',
          },
        },
        {
          kind: 'prose',
          section: '2.1',
          paragraphs: [
            {
              ro: 'Gasket mount (montare pe garnituri) este considerată azi metoda premium. Ansamblul placă–PCB nu e prins rigid cu șuruburi, ci e „suspendat” între cele două jumătăți ale carcasei prin garnituri (gaskets) din materiale flexibile.',
              en: 'Gasket mount is considered the premium method today. The plate–PCB assembly is not screwed down rigidly; it is “suspended” between the two halves of the case on gaskets made of flexible materials.',
            },
            {
              ro: 'Garniturile izolează vibrațiile, așa că tastarea devine mai plăcută, mai silențioasă și ușor elastică. Șocul transmis degetelor scade, ceea ce poate crește confortul în sesiunile lungi.',
              en: 'The gaskets isolate vibration, so typing becomes more pleasant, quieter and slightly springy. Less shock reaches your fingers, which can make long sessions more comfortable.',
            },
          ],
        },
      ],
    },
    {
      id: 'comparison',
      title: { ro: 'Comparația metodelor', en: 'The methods compared' },
      blocks: [
        {
          kind: 'table',
          section: '2.1',
          title: { ro: 'Tipuri de montare', en: 'Mounting types' },
          columns: [
            { ro: 'Tip montare', en: 'Mount type' },
            { ro: 'Rigiditate', en: 'Stiffness' },
            { ro: 'Consistență tactilă', en: 'Tactile consistency' },
            { ro: 'Complexitate/Cost', en: 'Complexity/Cost' },
            { ro: 'Profil acustic tipic', en: 'Typical sound profile' },
          ],
          rows: [
            [
              { ro: 'Integrated Plate', en: 'Integrated Plate' },
              { ro: 'Foarte ridicată', en: 'Very high' },
              { ro: 'Consistentă', en: 'Consistent' },
              { ro: 'Scăzută', en: 'Low' },
              { ro: 'Ascuțit, aspru', en: 'Sharp, harsh' },
            ],
            [
              { ro: 'Tray Mount', en: 'Tray Mount' },
              { ro: 'Inconsistentă', en: 'Inconsistent' },
              { ro: 'Scăzută', en: 'Low' },
              { ro: 'Foarte scăzută', en: 'Very low' },
              { ro: 'Inconsistent, adesea gol', en: 'Inconsistent, often hollow' },
            ],
            [
              { ro: 'Top/Bottom Mount', en: 'Top/Bottom Mount' },
              { ro: 'Ridicată', en: 'High' },
              { ro: 'Ridicată', en: 'High' },
              { ro: 'Medie', en: 'Medium' },
              { ro: 'Plin, consistent', en: 'Full, consistent' },
            ],
            [
              { ro: 'Sandwich Mount', en: 'Sandwich Mount' },
              { ro: 'Ridicată', en: 'High' },
              { ro: 'Ridicată', en: 'High' },
              { ro: 'Medie', en: 'Medium' },
              { ro: 'Ferm, solid', en: 'Firm, solid' },
            ],
            [
              { ro: 'Gasket Mount', en: 'Gasket Mount' },
              { ro: 'Flexibilă', en: 'Flexible' },
              { ro: 'Ridicată', en: 'High' },
              { ro: 'Ridicată', en: 'High' },
              { ro: 'Amortizat, grav („thocky”)', en: 'Damped, deep (“thocky”)' },
            ],
          ],
          rowHeader: 0,
        },
        {
          kind: 'callout',
          section: '2.1',
          title: { ro: 'Pe scurt', en: 'In short' },
          body: {
            ro: 'Senzația și sunetul unei tastaturi nu vin doar din switch-uri și layout, ci și din felul în care e montată placa. Metodele rigide sunt simple și ieftine; gasket mount este mai complex, dar amortizează vibrațiile.',
            en: 'How a keyboard feels and sounds comes not only from its switches and layout but also from how the plate is mounted. Rigid methods are simple and cheap; gasket mount is more complex but damps vibration.',
          },
        },
      ],
    },
    {
      id: 'materials-and-acoustics',
      title: { ro: 'Materiale și acustică', en: 'Materials and acoustics' },
      blocks: [
        {
          kind: 'options',
          section: '1.2',
          title: { ro: 'Materialul plăcii', en: 'Plate material' },
          items: [
            {
              name: { ro: 'Aluminiu', en: 'Aluminium' },
              summary: {
                ro: 'Pentru un feedback ferm.',
                en: 'For firm feedback.',
              },
            },
            {
              name: { ro: 'Policarbonat', en: 'Polycarbonate' },
              summary: {
                ro: 'Pentru flexibilitate și un sunet mai grav.',
                en: 'For flexibility and a deeper sound.',
              },
            },
          ],
        },
        {
          kind: 'options',
          section: '1.1',
          title: { ro: 'Materialul carcasei', en: 'Case material' },
          items: [
            {
              name: { ro: 'Aluminiu frezat CNC', en: 'CNC-milled aluminium' },
              summary: {
                ro: 'Carcasă prelucrată din aluminiu prin frezare CNC. Lucrarea o propune și pentru o versiune premium a prototipului.',
                en: 'A case machined from aluminium by CNC milling. The thesis also proposes it for a premium version of the prototype.',
              },
            },
            {
              name: { ro: 'Policarbonat injectat', en: 'Injection-moulded polycarbonate' },
              summary: {
                ro: 'Carcasă din plastic policarbonat, turnată prin injecție.',
                en: 'A polycarbonate plastic case made by injection moulding.',
              },
            },
            {
              name: { ro: 'Printare 3D FDM', en: 'FDM 3D printing' },
              summary: {
                ro: 'Folosită pentru carcasa prototipului din lucrare. Piesele au fost orientate pentru rezistență mecanică maximă și cu cât mai puține structuri de suport.',
                en: 'Used for the case of the thesis prototype. The parts were oriented for maximum mechanical strength and as few support structures as possible.',
              },
            },
          ],
        },
        {
          kind: 'callout',
          section: '1.1',
          title: { ro: 'Straturi acustice', en: 'Acoustic layers' },
          body: {
            ro: 'La proiectarea carcasei contează și managementul acustic: straturi de spumă sau silicon adăugate în interior modulează sunetul tastelor și elimină vibrațiile nedorite.',
            en: 'Acoustic management also matters when designing a case: layers of foam or silicone added inside shape the sound of the keys and remove unwanted vibration.',
          },
        },
      ],
    },
  ],
  related: [
    { href: '/shop/keyboards', label: { ro: 'Vezi tastaturile', en: 'Browse keyboards' } },
    {
      href: '/configurator',
      label: { ro: 'Construiește-ți tastatura', en: 'Build your keyboard' },
    },
  ],
};
