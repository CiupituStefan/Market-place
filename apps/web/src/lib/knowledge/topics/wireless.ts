import type { Topic } from '../types';

export const wirelessTopic: Topic = {
  slug: 'wireless',
  name: { ro: 'Wireless și firmware', en: 'Wireless and firmware' },
  title: { ro: 'Bluetooth, nRF52840 și ZMK', en: 'Bluetooth, nRF52840 and ZMK' },
  summary: {
    ro: 'Ce se întâmplă de la apăsarea unei taste până la caracterul de pe ecran într-o tastatură wireless: cipul nRF52840, protocolul Bluetooth Low Energy, firmware-ul ZMK și cum ține bateria luni de zile.',
    en: 'What happens between pressing a key and seeing the character on screen in a wireless keyboard: the nRF52840 chip, Bluetooth Low Energy, the ZMK firmware, and how the battery lasts for months.',
  },
  emblem: 'data-pipeline',
  chapters: [
    {
      id: 'nrf52840',
      title: { ro: 'Cipul nRF52840', en: 'The nRF52840 chip' },
      blocks: [
        {
          kind: 'prose',
          section: '2.3',
          paragraphs: [
            {
              ro: 'nRF52840, produs de Nordic Semiconductor, nu este doar un microcontroler, ci un System-on-Chip (SoC): procesorul, radioul de 2.4 GHz și perifericele (GPIO, USB) stau pe aceeași pastilă de siliciu.',
              en: 'The nRF52840, made by Nordic Semiconductor, is not just a microcontroller but a System-on-Chip (SoC): the processor, the 2.4 GHz radio and the peripherals (GPIO, USB) sit on the same piece of silicon.',
            },
            {
              ro: 'Această integrare reduce mult complexitatea PCB-ului, numărul de componente și sursele posibile de erori, față de varianta cu un microcontroler generic și un modul radio separat.',
              en: 'This integration greatly reduces PCB complexity, part count and possible sources of errors compared with a generic microcontroller plus a separate radio module.',
            },
          ],
        },
        {
          kind: 'specs',
          section: '2.3',
          title: { ro: 'Specificații', en: 'Specifications' },
          items: [
            {
              label: { ro: 'Procesor', en: 'Processor' },
              value: 'ARM Cortex-M4F, 32-bit',
              note: {
                ro: 'Litera „F” vine de la unitatea de calcul în virgulă mobilă (FPU)',
                en: 'The “F” stands for the floating-point unit (FPU)',
              },
            },
            { label: { ro: 'Frecvență', en: 'Clock speed' }, value: '64 MHz' },
            { label: { ro: 'Memorie Flash', en: 'Flash memory' }, value: '1 MB' },
            { label: { ro: 'Memorie RAM', en: 'RAM' }, value: '256 KB' },
            { label: { ro: 'Pini GPIO', en: 'GPIO pins' }, value: '48' },
            { label: { ro: 'USB', en: 'USB' }, value: 'USB 2.0' },
            {
              label: { ro: 'Radio', en: 'Radio' },
              value: '2.4 GHz, Bluetooth 5 / BLE',
              note: {
                ro: 'Rată de transfer de 2 Mbps și mod Long Range',
                en: '2 Mbps data rate and Long Range mode',
              },
            },
            {
              label: { ro: 'Alte protocoale', en: 'Other protocols' },
              value: 'Thread, Zigbee, ANT',
              note: {
                ro: 'Plus protocoale proprietare de 2.4 GHz',
                en: 'Plus proprietary 2.4 GHz protocols',
              },
            },
          ],
        },
        {
          kind: 'terms',
          section: '2.3',
          title: { ro: 'Ce înseamnă pentru o tastatură', en: 'What it means for a keyboard' },
          items: [
            {
              term: { ro: 'Procesorul', en: 'The processor' },
              body: {
                ro: 'Are putere mai mult decât suficientă pentru scanarea matricei, debounce, straturi, macro-uri și stiva BLE, cu o latență pe care utilizatorul o percepe ca zero.',
                en: 'Has more than enough power for matrix scanning, debounce, layers, macros and the BLE stack, with a latency the user perceives as zero.',
              },
            },
            {
              term: { ro: 'Radioul', en: 'The radio' },
              body: {
                ro: 'Bluetooth 5 aduce o latență mai mică și o conectare inițială mai rapidă, iar modul Long Range ține conexiunea stabilă și în birouri cu zeci de rețele Wi-Fi.',
                en: 'Bluetooth 5 brings lower latency and a faster first connection, and Long Range mode keeps the link stable even in offices with dozens of Wi-Fi networks.',
              },
            },
            {
              term: { ro: 'Memoria', en: 'The memory' },
              body: {
                ro: 'În 1 MB de Flash încap bootloader-ul, stiva BLE, sistemul Zephyr, aplicația ZMK și setările utilizatorului, plus actualizări de firmware prin Bluetooth (FOTA). 256 KB RAM țin buffere suficiente ca stiva BLE să nu piardă pachete.',
                en: '1 MB of Flash holds the bootloader, the BLE stack, the Zephyr system, the ZMK application and user settings, and allows firmware updates over Bluetooth (FOTA). 256 KB of RAM gives the BLE stack enough buffers not to drop packets.',
              },
            },
            {
              term: { ro: 'USB nativ', en: 'Native USB' },
              body: {
                ro: 'Nu e nevoie de un cip convertor USB-serial separat. Prin cablu, tastatura funcționează ca dispozitiv USB HID standard, iar portul servește și la încărcare și depanare.',
                en: 'No separate USB-to-serial converter chip is needed. Over a cable the keyboard works as a standard USB HID device, and the port is also used for charging and debugging.',
              },
            },
          ],
        },
      ],
    },
    {
      id: 'choosing-the-chip',
      title: { ro: 'De ce nRF52840, nu RP2040', en: 'Why nRF52840, not RP2040' },
      blocks: [
        {
          kind: 'options',
          section: '3.4',
          items: [
            {
              name: { ro: 'Raspberry Pi RP2040', en: 'Raspberry Pi RP2040' },
              summary: {
                ro: 'Prima opțiune luată în calcul: dual-core ARM Cortex-M0+, foarte apreciat în comunitate.',
                en: 'The first option considered: a dual-core ARM Cortex-M0+, well liked in the community.',
              },
              pros: [
                {
                  ro: 'Mulți pini GPIO, deci layout-uri mari (TKL sau full-size) fără componente suplimentare',
                  en: 'Plenty of GPIO pins, so large layouts (TKL or full-size) without extra components',
                },
              ],
              cons: [
                {
                  ro: 'Nu are radio integrat: depinde de un cip extern (ex. Infineon CYW43439) legat prin SPI',
                  en: 'No built-in radio: it relies on an external chip (e.g. Infineon CYW43439) over SPI',
                },
                {
                  ro: 'La momentul proiectului, suportul ZMK pentru această combinație era imatur: probleme de conectivitate, consum greu de optimizat și depanare complicată',
                  en: 'At the time of the project, ZMK support for this pairing was immature: connection problems, power use that was hard to optimise and complicated debugging',
                },
              ],
            },
            {
              name: { ro: 'Nordic nRF52840', en: 'Nordic nRF52840' },
              summary: {
                ro: 'Alegerea finală, considerată standardul de aur pentru ZMK.',
                en: 'The final choice, considered the gold standard for ZMK.',
              },
              pros: [
                {
                  ro: 'Procesor și radio pe același cip, fără interfață MCU–radio de gestionat',
                  en: 'Processor and radio on one chip, with no MCU–radio interface to manage',
                },
                {
                  ro: 'Zephyr și ZMK au fost dezvoltate cu suport prioritar pentru seria nRF; stiva BLE vine direct de la Nordic',
                  en: 'Zephyr and ZMK were built with first-class support for the nRF series; the BLE stack comes straight from Nordic',
                },
              ],
              cons: [
                {
                  ro: 'Mai puțini pini GPIO disponibili, deci formate compacte (60%, 65%, 75%)',
                  en: 'Fewer GPIO pins available, so compact sizes (60%, 65%, 75%)',
                },
              ],
            },
          ],
        },
        {
          kind: 'callout',
          section: '3.4',
          title: { ro: 'O decizie de management al riscului', en: 'A risk-management decision' },
          body: {
            ro: 'Pentru că Bluetooth era un obiectiv obligatoriu, s-a ales platforma cu software matur și radio integrat, acceptând un layout mai compact. Formatele compacte fiind populare, compromisul a fost considerat acceptabil.',
            en: 'Because Bluetooth was a must-have, the platform with mature software and a built-in radio was chosen, accepting a more compact layout. As compact sizes are popular, the trade-off was considered acceptable.',
          },
        },
      ],
    },
    {
      id: 'bluetooth-low-energy',
      title: { ro: 'Bluetooth Low Energy', en: 'Bluetooth Low Energy' },
      blocks: [
        {
          kind: 'prose',
          section: '2.4',
          paragraphs: [
            {
              ro: 'Bluetooth Low Energy (BLE) face parte din standardul Bluetooth începând cu versiunea 4.0 și a fost gândit pentru comunicații pe distanțe scurte cu un consum foarte mic. Spre deosebire de Bluetooth Clasic, optimizat pentru fluxuri continue (de ex. audio), BLE trimite cantități mici de date, iar radioul doarme în cea mai mare parte a timpului.',
              en: 'Bluetooth Low Energy (BLE) has been part of the Bluetooth standard since version 4.0 and was designed for short-range links with very low power use. Unlike Classic Bluetooth, which is optimised for continuous streams (e.g. audio), BLE sends small amounts of data and the radio sleeps most of the time.',
            },
            {
              ro: 'Asta se potrivește perfect unei tastaturi, care trebuie să transmită date doar când apeși o tastă.',
              en: 'That fits a keyboard perfectly, since it only needs to send data when a key is pressed.',
            },
          ],
        },
        {
          kind: 'terms',
          section: '2.4',
          title: { ro: 'Rolurile GATT', en: 'GATT roles' },
          items: [
            {
              term: { ro: 'Server GATT (Peripheral)', en: 'GATT server (peripheral)' },
              body: {
                ro: 'Dispozitivul care deține datele: tastatura. Își anunță prezența trimițând periodic pachete mici de advertising, prin care poate fi descoperită fără conexiune.',
                en: 'The device that holds the data: the keyboard. It announces itself by regularly sending small advertising packets, so it can be discovered without a connection.',
              },
            },
            {
              term: { ro: 'Client GATT (Central)', en: 'GATT client (central)' },
              body: {
                ro: 'Dispozitivul care folosește datele: calculatorul, tableta sau telefonul. Caută activ pachete de advertising și inițiază conexiunea.',
                en: 'The device that uses the data: the computer, tablet or phone. It actively scans for advertising packets and starts the connection.',
              },
            },
          ],
        },
        {
          kind: 'terms',
          section: '2.4',
          title: { ro: 'Servicii și caracteristici', en: 'Services and characteristics' },
          items: [
            {
              term: { ro: 'Serviciul HID (UUID 0x1812)', en: 'HID service (UUID 0x1812)' },
              body: {
                ro: 'Cel mai important: declară dispozitivul ca tastatură, mouse etc.',
                en: 'The most important one: it declares the device as a keyboard, mouse and so on.',
              },
            },
            {
              term: { ro: 'Battery Service (UUID 0x180F)', en: 'Battery Service (UUID 0x180F)' },
              body: {
                ro: 'Expune nivelul bateriei, ca sistemul de operare să îl poată afișa.',
                en: 'Exposes the battery level so the operating system can show it.',
              },
            },
            {
              term: {
                ro: 'Device Information Service (UUID 0x180A)',
                en: 'Device Information Service (UUID 0x180A)',
              },
              body: {
                ro: 'Detalii precum producătorul, modelul sau versiunea de firmware.',
                en: 'Details such as the manufacturer, the model or the firmware version.',
              },
            },
            {
              term: { ro: 'Report Map', en: 'Report Map' },
              body: {
                ro: 'O caracteristică doar pentru citire: o „hartă” care spune sistemului de operare cum să interpreteze datele (de ex. primul byte e pentru modificatori, următorii pentru tastele normale). ZMK o construiește automat, după configurație.',
                en: 'A read-only characteristic: a “map” that tells the operating system how to read the data (e.g. the first byte is for modifiers, the next ones for normal keys). ZMK builds it automatically from the configuration.',
              },
            },
            {
              term: { ro: 'Input Report', en: 'Input Report' },
              body: {
                ro: 'Caracteristica prin care pleacă tastele apăsate. Calculatorul se abonează la notificări, iar tastatura trimite singură un pachet la fiecare apăsare, fără să fie întrebată. Acest „push” este esențial pentru eficiența energetică.',
                en: 'The characteristic that carries the pressed keys. The computer subscribes to notifications, and the keyboard pushes a packet on every press without being asked. This “push” is key to BLE’s power efficiency.',
              },
            },
          ],
        },
        {
          kind: 'callout',
          section: '2.4',
          title: { ro: 'Securitate și compatibilitate', en: 'Security and compatibility' },
          body: {
            ro: 'Împerecherea (pairing) generează chei de criptare AES-CCM, iar bonding-ul le salvează, ca dispozitivele să se reconecteze securizat fără intervenția ta. ZMK folosește LE Secure Connections, deci apăsările de taste circulă criptat. Prin profilul standard HID over GATT, tastatura funcționează fără drivere pe Windows, macOS, Linux, Android și iOS.',
            en: 'Pairing generates AES-CCM encryption keys, and bonding saves them so the devices reconnect securely without you doing anything. ZMK uses LE Secure Connections, so keystrokes travel encrypted. Thanks to the standard HID over GATT profile, the keyboard works without drivers on Windows, macOS, Linux, Android and iOS.',
          },
        },
      ],
    },
    {
      id: 'key-to-screen',
      title: { ro: 'De la tastă la ecran', en: 'From key to screen' },
      blocks: [
        {
          kind: 'diagram',
          section: '2.5',
          diagram: 'data-pipeline',
          caption: {
            ro: 'Cele șase etape prin care trece o apăsare de tastă până devine caracter pe ecran.',
            en: 'The six stages a key press goes through before it becomes a character on screen.',
          },
        },
        {
          kind: 'steps',
          section: '2.5',
          items: [
            {
              title: { ro: 'Actuarea switch-ului', en: 'The switch actuates' },
              body: {
                ro: 'Degetul comprimă arcul. La punctul de actuare, contactele metalice se ating și închid circuitul: acțiunea mecanică devine semnal electric într-un punct al matricei.',
                en: 'Your finger compresses the spring. At the actuation point the metal contacts touch and close the circuit: the mechanical action becomes an electrical signal at one point of the matrix.',
              },
            },
            {
              title: { ro: 'Scanare și debounce', en: 'Scanning and debounce' },
              body: {
                ro: 'Firmware-ul activează pe rând fiecare coloană și citește toate rândurile, sute sau mii de ori pe secundă, și află coordonatele tastei (de ex. rândul 2, coloana 5). Debounce-ul filtrează zgomotul contactului.',
                en: 'The firmware activates each column in turn and reads every row, hundreds or thousands of times a second, and finds the key’s coordinates (e.g. row 2, column 5). Debounce filters out the contact noise.',
              },
            },
            {
              title: { ro: 'Interpretare și mapare', en: 'Interpretation and mapping' },
              body: {
                ro: 'Coordonata e căutată în keymap, ținând cont de modificatori și de stratul activ. Aceeași tastă G trimite „g” pe Layer 0 și F5 pe Layer 1 (cu Fn). Tot aici se decide dacă pornește un macro.',
                en: 'The coordinate is looked up in the keymap, taking modifiers and the active layer into account. The same G key sends “g” on Layer 0 and F5 on Layer 1 (with Fn). This is also where a macro may be triggered.',
              },
            },
            {
              title: { ro: 'Raportul HID', en: 'The HID report' },
              body: {
                ro: 'Codurile rezultate sunt împachetate într-un HID Input Report, de obicei de 8 bytes la o tastatură standard (6-Key Rollover).',
                en: 'The resulting codes are packed into an HID Input Report, usually 8 bytes on a standard (6-Key Rollover) keyboard.',
              },
            },
            {
              title: { ro: 'Transmisia BLE', en: 'BLE transmission' },
              body: {
                ro: 'Stiva BLE adaugă antetele, criptează pachetul cu cheile AES de la împerechere și îl pune la coadă. La următorul eveniment de conexiune, radioul pornește o fracțiune de secundă și trimite pachetul ca notificare pe Input Report.',
                en: 'The BLE stack adds headers, encrypts the packet with the AES keys from pairing and queues it. At the next connection event the radio wakes for a fraction of a second and sends it as a notification on the Input Report.',
              },
            },
            {
              title: { ro: 'Recepția pe calculator', en: 'Reception on the computer' },
              body: {
                ro: 'Calculatorul primește pachetul prin adaptorul Bluetooth, îl validează și îl decriptează, apoi driverul HID generic îl citește după Report Map și afișează caracterul sau execută comanda.',
                en: 'The computer receives the packet through its Bluetooth adapter, validates and decrypts it, then the generic HID driver reads it using the Report Map and shows the character or runs the command.',
              },
            },
          ],
        },
        {
          kind: 'diagram',
          section: '2.5',
          diagram: 'hid-report',
          caption: {
            ro: 'Raportul HID de 8 bytes: byte 0 pentru modificatori (bit 0 = Ctrl stânga, bit 1 = Shift stânga etc.), byte 1 rezervat, bytes 2–7 pentru până la 6 taste apăsate simultan.',
            en: 'The 8-byte HID report: byte 0 for modifiers (bit 0 = left Ctrl, bit 1 = left Shift, etc.), byte 1 reserved, bytes 2–7 for up to 6 keys held at once.',
          },
        },
        {
          kind: 'diagram',
          section: '4.3',
          diagram: 'matrix-scan',
          caption: {
            ro: 'Scanarea matricei: o coloană e pusă pe HIGH, iar un rând citit HIGH arată tasta apăsată de la intersecție. Dioda de lângă fiecare switch împiedică ghosting-ul.',
            en: 'Matrix scanning: one column is driven HIGH, and a row that reads HIGH reveals the pressed key at the crossing. The diode beside each switch prevents ghosting.',
          },
        },
        {
          kind: 'callout',
          section: '1.1',
          title: { ro: 'De ce o matrice cu diode', en: 'Why a matrix with diodes' },
          body: {
            ro: 'Ca să economisească pinii microcontrolerului, switch-urile sunt așezate într-o grilă de rânduri și coloane. Fiecare switch are în serie o diodă, ca apăsările multiple să fie înregistrate corect (N-Key Rollover) și să nu apară apăsări „fantomă” (ghosting).',
            en: 'To save microcontroller pins, the switches are laid out in a grid of rows and columns. Each switch has a diode in series, so several presses at once are read correctly (N-Key Rollover) and no “phantom” presses appear (ghosting).',
          },
        },
      ],
    },
    {
      id: 'zmk-firmware',
      title: { ro: 'Firmware-ul ZMK', en: 'The ZMK firmware' },
      blocks: [
        {
          kind: 'prose',
          section: '4.1',
          paragraphs: [
            {
              ro: 'ZMK este un firmware open-source pentru tastaturi wireless. Spre deosebire de QMK, firmware-ul tradițional, este construit pe Zephyr, un sistem de operare în timp real (RTOS) susținut de Linux Foundation. A fost gândit de la început pentru wireless, cu gestionare a energiei și comutare între mai multe conexiuni Bluetooth.',
              en: 'ZMK is an open-source firmware for wireless keyboards. Unlike QMK, the traditional firmware, it is built on Zephyr, a real-time operating system (RTOS) backed by the Linux Foundation. It was designed for wireless from the start, with power management and switching between several Bluetooth connections.',
            },
            {
              ro: 'Nu scrii cod C: comportamentul tastelor se descrie în fișiere de configurare (.keymap și .conf), cu sintaxa devicetree. Stiva BLE vine gata făcută și certificată din Zephyr.',
              en: 'You do not write C code: key behaviour is described in configuration files (.keymap and .conf) using devicetree syntax. The BLE stack comes ready-made and certified from Zephyr.',
            },
          ],
        },
        {
          kind: 'terms',
          section: '4.4, 2.5',
          title: { ro: 'Ce poate face', en: 'What it can do' },
          items: [
            {
              term: { ro: 'Straturi (layers)', en: 'Layers' },
              body: {
                ro: 'Mai multe tabele de taste. Pe un strat secundar, H, J, K și L pot deveni săgeți, iar rândul de cifre poate deveni F1–F12.',
                en: 'Several key maps. On a secondary layer, H, J, K and L can become arrows, and the number row can become F1–F12.',
              },
            },
            {
              term: { ro: 'Macro-uri', en: 'Macros' },
              body: {
                ro: 'Secvențe de taste declanșate cu o singură apăsare, de ex. o structură de cod precum un for loop.',
                en: 'Key sequences fired by a single press, e.g. a code structure such as a for loop.',
              },
            },
            {
              term: { ro: 'Combo-uri', en: 'Combos' },
              body: {
                ro: 'O acțiune la apăsarea simultană a două sau mai multe taste, de ex. J + K trimite Escape.',
                en: 'An action when two or more keys are pressed together, e.g. J + K sends Escape.',
              },
            },
            {
              term: { ro: 'Tap-dance', en: 'Tap-dance' },
              body: {
                ro: 'O tastă face lucruri diferite după cum o apeși: o dată „a”, de două ori „@”, de trei ori Caps Lock.',
                en: 'One key does different things depending on how you tap it: once for “a”, twice for “@”, three times for Caps Lock.',
              },
            },
            {
              term: { ro: 'Mouse keys', en: 'Mouse keys' },
              body: {
                ro: 'Pe un strat dedicat, I, J, K și L mișcă cursorul, iar U și O fac click stânga și dreapta.',
                en: 'On a dedicated layer, I, J, K and L move the cursor, and U and O give left and right clicks.',
              },
            },
            {
              term: { ro: 'Profile de conectare', en: 'Connection profiles' },
              body: {
                ro: 'Tastatura ține minte mai multe dispozitive împerecheate. O combinație (ex. Fn + 1/2/3) trece la alt dispozitiv, așa că poți controla un PC, un laptop și o tabletă cu aceeași tastatură.',
                en: 'The keyboard remembers several paired devices. A combination (e.g. Fn + 1/2/3) switches to another one, so you can control a PC, a laptop and a tablet from the same keyboard.',
              },
            },
          ],
        },
        {
          kind: 'terms',
          section: '4.4',
          title: { ro: 'Comportamente în keymap', en: 'Keymap behaviours' },
          items: [
            {
              term: { ro: '&kp', en: '&kp' },
              body: {
                ro: '„Key Press”: trimite un cod de tastă standard, de ex. &kp Q.',
                en: '“Key Press”: sends a standard key code, e.g. &kp Q.',
              },
            },
            {
              term: { ro: '&mo', en: '&mo' },
              body: {
                ro: '„Momentary Layer”: activează un strat doar cât timp ții tasta apăsată, ca tasta Fn (de ex. &mo 1).',
                en: '“Momentary Layer”: turns a layer on only while you hold the key, like the Fn key (e.g. &mo 1).',
              },
            },
            {
              term: { ro: '&bt', en: '&bt' },
              body: {
                ro: 'Gestionează profilele Bluetooth: &bt BT_SEL 0 alege primul dispozitiv împerecheat, &bt BT_CLR șterge profilurile salvate.',
                en: 'Manages Bluetooth profiles: &bt BT_SEL 0 picks the first paired device, &bt BT_CLR clears the saved profiles.',
              },
            },
            {
              term: { ro: '&macro', en: '&macro' },
              body: {
                ro: 'Definește și declanșează secvențe complexe de apăsări.',
                en: 'Defines and fires complex sequences of key presses.',
              },
            },
          ],
        },
      ],
    },
    {
      id: 'battery-and-power',
      title: { ro: 'Baterie și consum', en: 'Battery and power' },
      blocks: [
        {
          kind: 'terms',
          section: '4.5',
          title: { ro: 'Cum se economisește energia', en: 'How power is saved' },
          items: [
            {
              term: { ro: 'Deep sleep', en: 'Deep sleep' },
              body: {
                ro: 'După o perioadă de inactivitate configurabilă, procesorul și majoritatea perifericelor se opresc, iar consumul scade la câțiva microamperi. Prima apăsare de tastă trezește instantaneu sistemul.',
                en: 'After a configurable idle period, the processor and most peripherals shut down and consumption drops to a few microamps. The first key press wakes the system instantly.',
              },
            },
            {
              term: { ro: 'Design event-driven', en: 'Event-driven design' },
              body: {
                ro: 'Firmware-ul nu stă în bucle de așteptare; se trezește doar la o întrerupere hardware (o tastă apăsată) sau la un eveniment radio.',
                en: 'The firmware does not sit in busy-wait loops; it only wakes on a hardware interrupt (a key press) or a radio event.',
              },
            },
            {
              term: { ro: 'Interval de conexiune adaptiv', en: 'Adaptive connection interval' },
              body: {
                ro: 'Tastatura negociază cu calculatorul cât de des comunică. Când tastezi, intervalul e scurt, pentru latență mică; când stă, intervalul crește și radioul transmite mai rar.',
                en: 'The keyboard negotiates with the computer how often they talk. While you type the interval is short, for low latency; when idle, it grows and the radio transmits less often.',
              },
            },
            {
              term: { ro: 'Power gating', en: 'Power gating' },
              body: {
                ro: 'Perifericele interne (ADC, SPI, I2C) sunt pornite doar cât e nevoie. De exemplu, ADC-ul pentru baterie face o singură măsurătoare și se oprește, în câteva microsecunde.',
                en: 'Internal peripherals (ADC, SPI, I2C) are powered only when needed. The battery ADC, for instance, takes a single reading and switches off, within a few microseconds.',
              },
            },
          ],
        },
        {
          kind: 'specs',
          section: '4.5',
          title: { ro: 'Intervalul de conexiune BLE', en: 'BLE connection interval' },
          items: [
            {
              label: { ro: 'În timpul tastării', en: 'While typing' },
              value: '7.5–15 ms',
              note: { ro: 'Latență minimă', en: 'Minimum latency' },
            },
            {
              label: { ro: 'Inactivă, dar conectată', en: 'Idle but connected' },
              value: '100–200 ms',
              note: { ro: 'Pachete radio mai rare', en: 'Fewer radio packets' },
            },
            {
              label: { ro: 'Consum în deep sleep', en: 'Deep sleep consumption' },
              value: 'µA',
              note: { ro: 'Câțiva microamperi', en: 'A few microamps' },
            },
          ],
        },
        {
          kind: 'diagram',
          section: '3.5',
          diagram: 'charge-cycle',
          caption: {
            ro: 'Ciclul de încărcare CC/CV al cipului TP4054: pre-încărcare sub ~2.9 V, curent constant, tensiune constantă la 4.2 V, apoi oprire.',
            en: 'The TP4054’s CC/CV charge cycle: trickle charge below ~2.9 V, constant current, constant voltage at 4.2 V, then stop.',
          },
        },
        {
          kind: 'steps',
          section: '3.5',
          title: { ro: 'Încărcarea acumulatorului Li-Po', en: 'Charging the Li-Po battery' },
          items: [
            {
              title: { ro: 'Pre-încărcare (trickle)', en: 'Trickle charge' },
              body: {
                ro: 'Dacă bateria e foarte descărcată (sub ~2.9 V), cipul aplică un curent mic ca s-o aducă la o tensiune sigură.',
                en: 'If the battery is very low (below ~2.9 V), the chip applies a small current to bring it back to a safe voltage.',
              },
            },
            {
              title: { ro: 'Curent constant (CC)', en: 'Constant current (CC)' },
              body: {
                ro: 'Faza principală: cipul dă un curent maxim constant (stabilit cu un rezistor pe pinul PROG), iar tensiunea bateriei crește treptat.',
                en: 'The main phase: the chip supplies a constant maximum current (set by a resistor on the PROG pin) while the battery voltage rises.',
              },
            },
            {
              title: { ro: 'Tensiune constantă (CV)', en: 'Constant voltage (CV)' },
              body: {
                ro: 'La 4.2 V, tensiunea e ținută fixă, iar curentul absorbit de baterie scade natural.',
                en: 'At 4.2 V the voltage is held fixed and the current drawn by the battery falls naturally.',
              },
            },
            {
              title: { ro: 'Oprire', en: 'Termination' },
              body: {
                ro: 'Când curentul scade sub un prag (de obicei 10% din curentul maxim), încărcarea se oprește, ca bateria să nu fie supraîncărcată. Un LED arată starea încărcării.',
                en: 'When the current falls below a threshold (usually 10% of the maximum), charging stops so the battery is not overcharged. An LED shows the charging state.',
              },
            },
          ],
        },
        {
          kind: 'terms',
          section: '3.5',
          title: { ro: 'Alimentare și protecție', en: 'Power supply and protection' },
          items: [
            {
              term: { ro: 'Regulator LDO', en: 'LDO regulator' },
              body: {
                ro: 'Fie că vine de la USB-C (5 V), fie de la acumulator (3.7 V), tensiunea e stabilizată la 3.3 V, de care au nevoie nRF52840 și mai ales radioul său. La scoaterea cablului, alimentarea trece pe baterie fără întrerupere.',
                en: 'Whether it comes from USB-C (5 V) or the battery (3.7 V), the voltage is regulated to 3.3 V, which the nRF52840 and especially its radio need. When the cable is unplugged, power switches to the battery without interruption.',
              },
            },
            {
              term: { ro: 'Nivelul bateriei', en: 'Battery level' },
              body: {
                ro: 'Un divizor de tensiune cu rezistori mari aduce tensiunea bateriei (3.0–4.2 V) la intrarea ADC a cipului. Firmware-ul o transformă în procent după curba de descărcare Li-Po și o trimite prin Battery Service. E mai puțin precis decât un „fuel gauge” dedicat, dar un compromis bun.',
                en: 'A voltage divider with high-value resistors brings the battery voltage (3.0–4.2 V) down to the chip’s ADC input. The firmware turns it into a percentage using the Li-Po discharge curve and reports it via the Battery Service. It is less precise than a dedicated fuel gauge, but a good compromise.',
              },
            },
            {
              term: { ro: 'Protecție ESD', en: 'ESD protection' },
              body: {
                ro: 'Liniile de date și de alimentare ale portului USB-C sunt protejate de un circuit de supresie, de obicei o matrice de diode TVS, care deviază spre masă descărcările electrostatice de mii de volți.',
                en: 'The USB-C data and power lines are protected by a suppression circuit, usually a TVS diode array, which diverts electrostatic discharges of thousands of volts to ground.',
              },
            },
            {
              term: {
                ro: 'Comutator hardware (shipping mode)',
                en: 'Hardware switch (shipping mode)',
              },
              body: {
                ro: 'Un comutator fizic în serie cu bateria o deconectează complet pentru depozitare îndelungată, reducând autodescărcarea aproape la zero, ceea ce modurile de veghe software nu pot face.',
                en: 'A physical switch in series with the battery disconnects it completely for long storage, cutting self-discharge to almost zero, which software sleep modes cannot do.',
              },
            },
          ],
        },
      ],
    },
  ],
  related: [
    {
      href: '/configurator',
      label: { ro: 'Construiește-ți propria tastatură', en: 'Build your own keyboard' },
    },
    { href: '/shop/keyboards', label: { ro: 'Vezi tastaturile', en: 'Browse keyboards' } },
  ],
};
