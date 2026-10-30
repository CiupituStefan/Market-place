import type { Topic } from '../types';

export const prototypeTopic: Topic = {
  slug: 'prototype',
  name: { ro: 'Prototipul', en: 'The prototype' },
  title: { ro: 'Prototipul: o tastatură de la zero', en: 'The prototype: built from scratch' },
  summary: {
    ro: 'Tastatura wireless construită pentru lucrarea de licență: cum a fost proiectată, ce s-a măsurat, ce a mers prost la asamblare și cum s-a rezolvat.',
    en: 'The wireless keyboard built for the bachelor thesis: how it was designed, what was measured, what went wrong during the build and how it was fixed.',
  },
  emblem: 'matrix-scan',
  chapters: [
    {
      id: 'goals',
      title: { ro: 'Obiectivele proiectului', en: 'Project goals' },
      blocks: [
        {
          kind: 'photo',
          section: '6.1',
          photo: 'prototype',
          caption: { ro: 'Prototipul finalizat', en: 'The finished prototype' },
        },
        {
          kind: 'prose',
          section: '1.2, 1.3',
          paragraphs: [
            {
              ro: 'Scopul lucrării a fost proiectarea, construirea și validarea unui prototip funcțional de tastatură mecanică fără fir, cu consum redus de energie, bazată pe nRF52840 și Bluetooth Low Energy.',
              en: 'The aim of the thesis was to design, build and validate a working prototype of a wireless mechanical keyboard with low power use, based on the nRF52840 and Bluetooth Low Energy.',
            },
            {
              ro: 'Proiectul a fost condus în sprint-uri succesive (metodă Agile), fiecare cu un obiectiv clar, de exemplu validarea circuitului de alimentare sau scanarea matricei. Astfel, fiecare parte a fost testată și îmbunătățită pe rând.',
              en: 'The project ran in successive sprints (an Agile approach), each with a clear goal, such as validating the power circuit or the matrix scanning. That way each part was tested and improved in turn.',
            },
          ],
        },
        {
          kind: 'steps',
          section: '1.2',
          title: { ro: 'Cele cinci obiective', en: 'The five objectives' },
          items: [
            {
              title: { ro: 'PCB-ul, în Altium Designer', en: 'The PCB, in Altium Designer' },
              body: {
                ro: 'Schema electrică și layout-ul plăcii: matricea de taste cu diode, nRF52840, încărcarea acumulatorului, regulatorul de 3.3 V și conectorul USB-C. La final, fișierele de fabricație (Gerber și găurire).',
                en: 'The schematic and board layout: the key matrix with diodes, the nRF52840, battery charging, the 3.3 V regulator and the USB-C connector. Finally, the manufacturing files (Gerber and drill).',
              },
            },
            {
              title: { ro: 'Carcasa și placa, în Fusion 360', en: 'Case and plate, in Fusion 360' },
              body: {
                ro: 'O carcasă ergonomică, cu loc pentru PCB și acumulator și decupaj pentru USB-C, plus placa de montare care fixează switch-urile.',
                en: 'An ergonomic case with room for the PCB and battery and a cut-out for USB-C, plus the mounting plate that holds the switches.',
              },
            },
            {
              title: { ro: 'Conexiunea wireless', en: 'The wireless link' },
              body: {
                ro: 'Bluetooth Low Energy cu profilul HID over GATT, pairing și bonding, și parametri de conexiune reglați între latență și consum.',
                en: 'Bluetooth Low Energy with the HID over GATT profile, pairing and bonding, and connection settings tuned between latency and power use.',
              },
            },
            {
              title: { ro: 'Firmware-ul ZMK', en: 'The ZMK firmware' },
              body: {
                ro: 'Keymap cu mai multe straturi, macro-uri și combo-uri, deep sleep și raportarea nivelului bateriei.',
                en: 'A keymap with several layers, macros and combos, deep sleep and battery level reporting.',
              },
            },
            {
              title: { ro: 'Asamblare și testare', en: 'Assembly and testing' },
              body: {
                ro: 'Fabricarea pieselor, asamblarea și teste hardware și software complete.',
                en: 'Making the parts, assembling them, and full hardware and software testing.',
              },
            },
          ],
        },
      ],
    },
    {
      id: 'electronics',
      title: { ro: 'Electronica', en: 'The electronics' },
      blocks: [
        {
          kind: 'specs',
          section: '1.3, 3.1, 3.3',
          title: { ro: 'Pe scurt', en: 'At a glance' },
          items: [
            { label: { ro: 'Straturi PCB', en: 'PCB layers' }, value: '2' },
            {
              label: { ro: 'Matrice', en: 'Matrix' },
              value: '6 × 14',
              note: {
                ro: '6 rânduri și 14 coloane, doar 20 de pini GPIO',
                en: '6 rows and 14 columns, only 20 GPIO pins',
              },
            },
            {
              label: { ro: 'Diode', en: 'Diodes' },
              value: '1N4148WS',
              note: {
                ro: 'Câte una pe switch, direcție col2row (de la coloană la rând)',
                en: 'One per switch, col2row direction (column to row)',
              },
            },
            {
              label: { ro: 'Microcontroler', en: 'Microcontroller' },
              value: 'nRF52840',
              note: {
                ro: 'Într-un design compatibil nice!nano v2',
                en: 'In a nice!nano v2-compatible design',
              },
            },
            {
              label: { ro: 'Acumulator', en: 'Battery' },
              value: 'Li-Po 3.7 V, 2300 mAh',
            },
            {
              label: { ro: 'Conector', en: 'Connector' },
              value: 'USB Type-C',
              note: {
                ro: 'Încărcare și, opțional, comunicare serială sau flash-uire în mod DFU',
                en: 'Charging and, optionally, serial communication or flashing in DFU mode',
              },
            },
            {
              label: { ro: 'Switch-uri', en: 'Switches' },
              value: 'MX',
              note: {
                ro: 'Liniare în prototip; placa acceptă majoritatea switch-urilor de tip MX',
                en: 'Linear in the prototype; the board accepts most MX-style switches',
              },
            },
          ],
        },
        {
          kind: 'callout',
          section: '3.3',
          title: { ro: 'Autonomie: o estimare', en: 'Battery life: an estimate' },
          body: {
            ro: 'Capacitatea mare a acumulatorului a fost aleasă intenționat. Calculele făcute cu ZMK Power Profiler, care modelează consumul activ, idle și în sleep, au dat o autonomie teoretică de până la un an la utilizare medie. Este o estimare, nu o măsurătoare.',
            en: 'The large battery capacity was chosen on purpose. Calculations with the ZMK Power Profiler, which models active, idle and sleep consumption, gave a theoretical battery life of up to a year with average use. It is an estimate, not a measurement.',
          },
        },
        {
          kind: 'prose',
          section: '3.2, 4.1',
          paragraphs: [
            {
              ro: 'Tastatura poate trimite raportul HID pe două căi: prin USB, când e conectată prin cablu (latență minimă și alimentare), sau prin Bluetooth Low Energy, când e folosită wireless. În ambele cazuri, calculatorul o recunoaște fără drivere.',
              en: 'The keyboard can send its HID report two ways: over USB when plugged in (lowest latency, and power), or over Bluetooth Low Energy when used wirelessly. Either way, the computer recognises it without drivers.',
            },
            {
              ro: 'În firmware, pinii microcontrolerului au fost legați de rândurile și coloanele matricei printr-un „shield” ZMK descris în DeviceTree: coloanele ca ieșiri, rândurile ca intrări, cu direcția diodelor col2row.',
              en: 'In the firmware, the microcontroller pins were tied to the matrix rows and columns through a ZMK “shield” described in DeviceTree: columns as outputs, rows as inputs, with the col2row diode direction.',
            },
          ],
        },
        {
          kind: 'photo',
          section: '9.1',
          photo: 'schematic',
          caption: {
            ro: 'Schema electrică completă, în Altium Designer',
            en: 'Full schematic in Altium Designer',
          },
        },
        {
          kind: 'photo',
          section: '9.1',
          photo: 'pcb-layout-top',
          caption: {
            ro: 'Layout-ul PCB, stratul de cupru de sus',
            en: 'PCB layout, top copper',
          },
        },
        {
          kind: 'photo',
          section: '9.1',
          photo: 'pcb-layout-bottom',
          caption: {
            ro: 'Layout-ul PCB, stratul de cupru de jos',
            en: 'PCB layout, bottom copper',
          },
        },
      ],
    },
    {
      id: 'case',
      title: { ro: 'Carcasa printată 3D', en: 'The 3D-printed case' },
      blocks: [
        {
          kind: 'prose',
          section: '1.3',
          paragraphs: [
            {
              ro: 'Carcasa exterioară și placa de montare au fost desenate în Fusion 360. Modelul 3D al PCB-ului a fost importat direct în proiect, ca totul să se potrivească, ținând cont de toleranțe, de locul pentru acumulator și de decupajul pentru USB-C.',
              en: 'The outer case and the mounting plate were drawn in Fusion 360. The 3D model of the PCB was imported straight into the design so everything would fit, allowing for tolerances, room for the battery and the USB-C cut-out.',
            },
            {
              ro: 'Ansamblul a fost gândit pentru printare 3D FDM (Fused Deposition Modeling): piesele au fost orientate pentru rezistență mecanică maximă și cu cât mai puține suporturi.',
              en: 'The assembly was designed for FDM (Fused Deposition Modeling) 3D printing: the parts were oriented for maximum mechanical strength and as few supports as possible.',
            },
          ],
        },
        {
          kind: 'photo',
          section: '9.2',
          photo: 'drawing-plate',
          caption: {
            ro: 'Desenul Fusion 360 al plăcii de montare',
            en: 'Fusion 360 drawing of the plate',
          },
        },
        {
          kind: 'photo',
          section: '9.2',
          photo: 'drawing-case',
          caption: {
            ro: 'Desenul Fusion 360 al carcasei de jos',
            en: 'Fusion 360 drawing of the bottom case',
          },
        },
        {
          kind: 'photo',
          section: '9.2',
          photo: 'drawing-frame',
          caption: {
            ro: 'Desenul Fusion 360 al ramei de sus',
            en: 'Fusion 360 drawing of the top frame',
          },
        },
        {
          kind: 'photo',
          section: '6.2',
          photo: 'case-top',
          caption: {
            ro: 'Partea de sus a carcasei printate 3D',
            en: 'The top of the 3D-printed case',
          },
        },
      ],
    },
    {
      id: 'testing-and-results',
      title: { ro: 'Teste și rezultate', en: 'Tests and results' },
      blocks: [
        {
          kind: 'steps',
          section: '5.1',
          title: { ro: 'Teste hardware', en: 'Hardware tests' },
          items: [
            {
              title: { ro: 'Alimentarea', en: 'Power supply' },
              body: {
                ro: 'Cu multimetrul s-a verificat că la ieșirea regulatorului sunt 3.3 V stabili și că punctele de test de pe PCB primesc tensiunea corectă.',
                en: 'A multimeter confirmed a stable 3.3 V at the regulator output and the right voltage at the PCB test points.',
              },
            },
            {
              title: { ro: 'Microcontrolerul', en: 'The microcontroller' },
              body: {
                ro: 'Un firmware de test „Blink”, încărcat prin SWD, a arătat că procesorul rulează și pinii GPIO răspund. Cu osciloscopul s-a verificat oscilatorul extern de 32 MHz, vital pentru radio.',
                en: 'A “Blink” test firmware, loaded over SWD, showed the processor running and the GPIO pins responding. An oscilloscope checked the external 32 MHz oscillator, vital for the radio.',
              },
            },
            {
              title: { ro: 'Matricea de taste', en: 'The key matrix' },
              body: {
                ro: 'Un firmware de scanare a trimis pe interfața serială (UART) un cod unic pentru fiecare tastă apăsată, validând toate contactele și traseele.',
                en: 'A scanning firmware sent a unique code over the serial port (UART) for every key pressed, validating every contact and trace.',
              },
            },
            {
              title: { ro: 'Radioul', en: 'The radio' },
              body: {
                ro: 'Tastatura a emis pachete de advertising, iar aplicația nRF Connect for Mobile a detectat-o, confirmând antena și circuitul radio.',
                en: 'The keyboard sent advertising packets and the nRF Connect for Mobile app picked it up, confirming the antenna and radio circuit.',
              },
            },
          ],
        },
        {
          kind: 'steps',
          section: '5.1',
          title: { ro: 'Teste software', en: 'Software tests' },
          items: [
            {
              title: { ro: 'Keymap și straturi', en: 'Keymap and layers' },
              body: {
                ro: 'Un tester online a confirmat că fiecare tastă trimite codul corect, cu atenție la modificatori (Shift, Ctrl) și la comutarea straturilor.',
                en: 'An online tester confirmed that every key sends the right code, with attention to modifiers (Shift, Ctrl) and layer switching.',
              },
            },
            {
              title: { ro: 'Bluetooth', en: 'Bluetooth' },
              body: {
                ro: 'Împerechere reușită pe Windows și macOS, conexiune stabilă ore întregi, comutare rapidă între dispozitive și reconectare automată după o întrerupere sau după stand-by.',
                en: 'Successful pairing on Windows and macOS, a stable link for hours, quick switching between devices and automatic reconnection after a drop or after stand-by.',
              },
            },
            {
              title: { ro: 'Consumul', en: 'Power saving' },
              body: {
                ro: 'Lăsată nefolosită, tastatura intră în deep sleep și se trezește instantaneu la prima apăsare.',
                en: 'Left alone, the keyboard goes into deep sleep and wakes instantly on the first key press.',
              },
            },
          ],
        },
        {
          kind: 'specs',
          section: '5.2',
          title: { ro: 'Ce s-a măsurat', en: 'What was measured' },
          items: [
            {
              label: { ro: 'Latență USB', en: 'USB latency' },
              value: '4 ms',
              note: { ro: 'Rată de polling 250 Hz', en: '250 Hz polling rate' },
            },
            {
              label: { ro: 'Latență Bluetooth', en: 'Bluetooth latency' },
              value: '32 ms',
              note: { ro: 'Rată de polling 31.25 Hz', en: '31.25 Hz polling rate' },
            },
            {
              label: { ro: 'Rollover', en: 'Rollover' },
              value: '11KRO',
              note: {
                ro: 'Până la 11 taste apăsate simultan, fără ghosting',
                en: 'Up to 11 keys held at once, with no ghosting',
              },
            },
          ],
        },
        {
          kind: 'callout',
          section: '5.2',
          title: { ro: 'Ce înseamnă', en: 'What it means' },
          body: {
            ro: 'Prin cablu, 4 ms înseamnă practic nicio întârziere perceptibilă: conexiunea ideală pentru gaming competitiv. Prin Bluetooth, latența e de opt ori mai mare, pentru că tastatura trimite mai rar ca să economisească bateria; e potrivită pentru birou și navigare, dar nerecomandată pentru gaming serios. Cu 11 taste simultan, rollover-ul acoperă practic orice combinație, pentru că ai doar zece degete.',
            en: 'Over the cable, 4 ms means practically no noticeable delay: the ideal link for competitive gaming. Over Bluetooth, latency is eight times higher because the keyboard reports less often to save battery; it suits office work and browsing but is not recommended for serious gaming. With 11 keys at once, rollover covers practically any combination, since you only have ten fingers.',
          },
        },
      ],
    },
    {
      id: 'build-problems',
      title: { ro: 'Probleme și soluții', en: 'Problems and fixes' },
      blocks: [
        {
          kind: 'photo',
          section: '6.2',
          photo: 'chip-recovered',
          caption: {
            ro: 'nRF52840 recuperat de pe o altă placă, cu pinii rupți',
            en: 'The nRF52840 recovered from another board, pins broken off',
          },
        },
        {
          kind: 'options',
          section: '6.2',
          items: [
            {
              name: { ro: 'Recuperarea microcontrolerului', en: 'Recovering the microcontroller' },
              summary: {
                ro: 'nRF52840 a fost recuperat de pe o altă placă de dezvoltare. Contactele lui sunt ascunse sub capsulă, așa că a fost nevoie de o suflantă cu aer cald care să le topească pe toate deodată, altfel piesa s-ar fi distrus. Apoi, componentele minuscule au cerut pensete fine și multă răbdare.',
                en: 'The nRF52840 was recovered from another development board. Its pads are hidden under the package, so a hot-air station was needed to melt them all at once, or the part would have been destroyed. After that, the tiny components took fine tweezers and a lot of patience.',
              },
            },
            {
              name: { ro: 'Diode prea mari', en: 'Diodes too big' },
              summary: {
                ro: 'Diodele comandate erau fizic mai mari decât amprenta de pe PCB. Ca să nu se piardă munca și să nu se aștepte o nouă livrare, au fost montate vertical și legate cu un fir subțire. Nu e cea mai ordonată soluție, dar funcționează perfect.',
                en: 'The diodes ordered were physically larger than their footprint on the PCB. Rather than waste the work or wait for a new delivery, they were mounted upright and connected with thin wire. Not the tidiest fix, but it works perfectly.',
              },
            },
            {
              name: { ro: 'Colțuri ridicate la printare', en: 'Corners lifting while printing' },
              summary: {
                ro: 'Fiind o piesă mare și plată, carcasa se deforma: colțurile se ridicau de pe platou. Setările imprimantei au fost ajustate și s-a folosit o margine de sacrificiu (brim), ca piesa să rămână lipită și dreaptă.',
                en: 'Being a large, flat part, the case warped: its corners lifted off the bed. The printer settings were adjusted and a sacrificial brim was used, so the part stayed stuck down and came out flat.',
              },
            },
            {
              name: { ro: 'O lipitură rece ascunsă', en: 'A hidden cold solder joint' },
              summary: {
                ro: 'La asamblare, unele taste nu mergeau. Fiecare traseu a fost verificat cu aparatul de măsură până la găsirea unei lipituri reci, ascunse.',
                en: 'After assembly some keys did not work. Every trace was checked with a meter until a hidden cold solder joint turned up.',
              },
            },
            {
              name: { ro: 'Găuri care nu se aliniau', en: 'Screw holes that did not line up' },
              summary: {
                ro: 'Șuruburile M2 nu intrau, pentru că imperfecțiunile printării dezaliniaseră găurile. În loc să riște fisurarea plasticului, s-au montat magneți mici de neodim în punctele cheie: carcasa se închide perfect și se desface ușor pentru întreținere.',
                en: 'The M2 screws would not go in, because small print imperfections had misaligned the holes. Rather than risk cracking the plastic, small neodymium magnets were fitted at key points: the case closes perfectly and opens easily for maintenance.',
              },
            },
          ],
        },
        {
          kind: 'photo',
          section: '6.2',
          photo: 'pcb',
          caption: { ro: 'PCB-ul asamblat', en: 'The assembled PCB' },
        },
      ],
    },
    {
      id: 'improvements',
      title: { ro: 'Ce urmează', en: 'What comes next' },
      blocks: [
        {
          kind: 'prose',
          section: '6.3',
          paragraphs: [
            {
              ro: 'Prototipul a validat conceptul și poate deveni baza unei game întregi de produse. Lucrarea propune câteva direcții concrete.',
              en: 'The prototype proved the concept and could become the basis for a whole range of products. The thesis suggests a few concrete directions.',
            },
          ],
        },
        {
          kind: 'terms',
          section: '6.3, 7.2',
          items: [
            {
              term: { ro: 'Carcasă din aluminiu CNC', en: 'CNC aluminium case' },
              body: {
                ro: 'O variantă premium, cu o antenă internă optimizată prin simulări de radiofrecvență (de ex. în Ansys), ca legătura wireless să rămână impecabilă și într-o carcasă metalică.',
                en: 'A premium version, with an internal antenna optimised through radio-frequency simulation (e.g. in Ansys), so the wireless link stays flawless even in a metal case.',
              },
            },
            {
              term: { ro: 'Funcții hardware noi', en: 'New hardware features' },
              body: {
                ro: 'Iluminare RGB pentru fiecare tastă, un mic ecran OLED pentru status (Caps Lock, stratul activ, notificări) și un encoder rotativ pentru control media, de exemplu volumul.',
                en: 'Per-key RGB lighting, a small OLED screen for status (Caps Lock, active layer, notifications) and a rotary encoder for media control, such as volume.',
              },
            },
            {
              term: { ro: 'Alte formate', en: 'Other sizes' },
              body: {
                ro: 'Variante Tenkeyless (TKL) și full-size (100%), pentru cei care au nevoie de mai multe taste.',
                en: 'Tenkeyless (TKL) and full-size (100%) versions, for people who need more keys.',
              },
            },
          ],
        },
        {
          kind: 'callout',
          section: '7.2',
          title: { ro: 'Un configurator grafic', en: 'A graphical configurator' },
          body: {
            ro: 'ZMK e foarte puternic, dar schimbarea keymap-ului cere cunoștințe tehnice. Un configurator grafic, similar cu VIA sau VIAL, în care să remapezi taste și să creezi macro-uri intuitiv și în timp real, ar face tastatura mult mai accesibilă.',
            en: 'ZMK is very powerful, but changing the keymap takes technical knowledge. A graphical configurator, like VIA or VIAL, where you remap keys and build macros intuitively and in real time, would make the keyboard far more accessible.',
          },
        },
      ],
    },
  ],
  related: [
    {
      href: '/configurator',
      label: { ro: 'Construiește-ți propria tastatură', en: 'Build your own keyboard' },
    },
  ],
};
