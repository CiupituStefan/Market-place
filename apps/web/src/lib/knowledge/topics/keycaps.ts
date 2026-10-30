import type { Topic } from '../types';

export const keycapsTopic: Topic = {
  slug: 'keycaps',
  name: { ro: 'Keycaps', en: 'Keycaps' },
  title: { ro: 'Keycaps: materiale și profiluri', en: 'Keycaps: materials and profiles' },
  summary: {
    ro: 'Ce diferență face materialul (ABS, PBT, POM, rășină, aluminiu), cum arată profilurile OEM, Cherry, SA, DSA și XDA și cât de mult rezistă legendele, în funcție de cum sunt aplicate.',
    en: 'What difference the material makes (ABS, PBT, POM, resin, aluminium), how the OEM, Cherry, SA, DSA and XDA profiles are shaped, and how long legends last depending on how they are applied.',
  },
  emblem: 'keycap-profiles',
  chapters: [
    {
      id: 'materials',
      title: { ro: 'Materiale', en: 'Materials' },
      blocks: [
        {
          kind: 'prose',
          section: '2.2',
          paragraphs: [
            {
              ro: 'Dacă switch-ul este „motorul” tastei, keycap-ul este „caroseria” și „volanul”: partea pe care o atingi. Este ultimul element din lanțul mecanic, așa că influențează mult senzația și sunetul final.',
              en: 'If the switch is the key’s “engine”, the keycap is its “bodywork” and “steering wheel”: the part you actually touch. It is the last link in the mechanical chain, so it strongly shapes the final feel and sound.',
            },
            {
              ro: 'Alegerea keycap-urilor contează la fel de mult ca a switch-urilor și afectează trei lucruri: senzația la atingere, sunetul și cât de bine își păstrează aspectul în timp.',
              en: 'Choosing keycaps matters as much as choosing switches, and it affects three things: how they feel, how they sound and how well they keep their looks over time.',
            },
          ],
        },
        {
          kind: 'prose',
          section: '2.2',
          paragraphs: [
            {
              ro: 'Materialul stabilește densitatea, textura, greutatea, sunetul și rezistența la uzură chimică și mecanică a tastei.',
              en: 'The material sets the keycap’s density, texture, weight, sound and resistance to chemical and mechanical wear.',
            },
          ],
        },
        {
          kind: 'options',
          section: '2.2',
          items: [
            {
              name: { ro: 'ABS', en: 'ABS' },
              summary: {
                ro: 'Acrilonitril-butadien-stiren, cel mai comun plastic pentru keycaps, mai ales la tastaturile de serie (pre-built).',
                en: 'Acrylonitrile butadiene styrene, the most common plastic for keycaps, especially on off-the-shelf (pre-built) keyboards.',
              },
              pros: [
                {
                  ro: 'Ușor de injectat datorită punctului de topire mai scăzut',
                  en: 'Easy to injection-mould thanks to its lower melting point',
                },
                {
                  ro: 'Culori vibrante și legende double-shot precise, cu margini clare',
                  en: 'Vivid colours and precise double-shot legends with crisp edges',
                },
              ],
              cons: [
                {
                  ro: 'Uleiurile naturale de pe degete îi degradează suprafața, care capătă în timp un luciu („shine”) inestetic',
                  en: 'The natural oils on your fingers degrade the surface, which over time develops an unsightly “shine”',
                },
                {
                  ro: 'Expunerea la soare (UV) îl poate îngălbeni',
                  en: 'Sunlight (UV) can turn it yellow',
                },
                {
                  ro: 'Fiind mai puțin dens decât PBT, are un sunet mai înalt și mai ascuțit',
                  en: 'Being less dense than PBT, it sounds higher-pitched and sharper',
                },
              ],
            },
            {
              name: { ro: 'PBT', en: 'PBT' },
              summary: {
                ro: 'Polibutilen-tereftalat, un plastic superior, preferat de pasionați. Este mai dens și mai rigid decât ABS.',
                en: 'Polybutylene terephthalate, a superior plastic preferred by enthusiasts. It is denser and stiffer than ABS.',
              },
              pros: [
                {
                  ro: 'Structura semi-cristalină îl face foarte rezistent la solvenți: uleiurile de pe piele nu îl afectează',
                  en: 'Its semi-crystalline structure makes it highly resistant to solvents: skin oils do not affect it',
                },
                {
                  ro: 'Își păstrează mult mai mult timp textura mată, ușor rugoasă',
                  en: 'Keeps its matte, slightly rough texture for much longer',
                },
                {
                  ro: 'Sunet mai plin și mai grav („thocky”), datorită densității și rigidității',
                  en: 'A fuller, deeper sound (“thocky”), thanks to its density and stiffness',
                },
              ],
              cons: [
                {
                  ro: 'Se contractă mai mult la răcire după injectare, așa că piesele lungi, ca spacebar-ul, sunt greu de făcut perfect drepte',
                  en: 'It shrinks more as it cools after moulding, so long pieces such as the spacebar are hard to make perfectly straight',
                },
                {
                  ro: 'Matrițele pentru double-shot sunt mai complexe',
                  en: 'Double-shot moulds are more complex',
                },
              ],
            },
            {
              name: { ro: 'POM', en: 'POM' },
              summary: {
                ro: 'Polioximetilen, cunoscut și ca Delrin. Material de nișă.',
                en: 'Polyoxymethylene, also known as Delrin. A niche material.',
              },
              pros: [
                {
                  ro: 'Foarte neted la atingere, datorită coeficientului de frecare foarte mic',
                  en: 'Very smooth to the touch, thanks to its very low friction',
                },
                { ro: 'Dens și durabil', en: 'Dense and durable' },
                {
                  ro: 'Sunet unic, mai înfundat',
                  en: 'A distinctive, more muffled sound',
                },
              ],
            },
            {
              name: { ro: 'Rășină epoxidică', en: 'Epoxy resin' },
              summary: {
                ro: 'Folosită pentru keycaps artizanale, unicat.',
                en: 'Used for one-of-a-kind artisan keycaps.',
              },
              pros: [
                {
                  ro: 'Libertate creativă practic nelimitată',
                  en: 'Practically unlimited creative freedom',
                },
              ],
            },
            {
              name: { ro: 'Aluminiu', en: 'Aluminium' },
              summary: {
                ro: 'Material premium, prelucrat prin frezare CNC.',
                en: 'A premium material, CNC-milled.',
              },
              pros: [{ ro: 'Senzație premium, rece', en: 'A premium, cool feel' }],
              cons: [{ ro: 'Sunet foarte înalt', en: 'A very high-pitched sound' }],
            },
          ],
        },
      ],
    },
    {
      id: 'profiles',
      title: { ro: 'Profiluri', en: 'Profiles' },
      blocks: [
        {
          kind: 'diagram',
          section: '2.2',
          diagram: 'keycap-profiles',
          caption: {
            ro: 'Profilurile sculptate (OEM, Cherry, SA) au înălțimi și unghiuri diferite pe fiecare rând; cele uniforme (DSA, XDA) au aceeași formă pe toate tastele.',
            en: 'Sculpted profiles (OEM, Cherry, SA) change height and angle from row to row; uniform ones (DSA, XDA) have the same shape on every key.',
          },
        },
        {
          kind: 'options',
          section: '2.2',
          title: { ro: 'Profiluri sculptate', en: 'Sculpted profiles' },
          items: [
            {
              name: { ro: 'OEM', en: 'OEM' },
              summary: {
                ro: 'Cel mai comun profil: înalt, cu suprafața concavă, cilindrică.',
                en: 'The most common profile: tall, with a concave, cylindrical top.',
              },
            },
            {
              name: { ro: 'Cherry', en: 'Cherry' },
              summary: {
                ro: 'Asemănător cu OEM, dar mai jos. Mulți îl consideră standardul de aur pentru confort pe termen lung, pentru că cere o mișcare mai mică a încheieturii.',
                en: 'Similar to OEM but lower. Many see it as the gold standard for long-term comfort, because it asks less movement of the wrist.',
              },
            },
            {
              name: { ro: 'SA (Spherical All-rows)', en: 'SA (Spherical All-rows)' },
              summary: {
                ro: 'Un profil înalt, „retro”, cu suprafață sferică adâncă. Sculptura agresivă dă o senzație distinctă, dar poate cere o perioadă de acomodare.',
                en: 'A tall, “retro” profile with a deep spherical top. Its aggressive sculpting feels distinctive but can take some getting used to.',
              },
            },
          ],
        },
        {
          kind: 'prose',
          section: '2.2',
          paragraphs: [
            {
              ro: 'La profilurile sculptate, fiecare rând are altă înălțime și alt unghi, ca să urmeze arcul natural de mișcare al degetelor și să reducă distanța și efortul. La profilurile uniforme, toate tastele au aceeași formă și înălțime.',
              en: 'In sculpted profiles each row has its own height and angle, following the natural arc of the fingers to cut distance and effort. In uniform profiles every key has the same shape and height.',
            },
          ],
        },
        {
          kind: 'options',
          section: '2.2',
          title: { ro: 'Profiluri uniforme', en: 'Uniform profiles' },
          items: [
            {
              name: { ro: 'DSA', en: 'DSA' },
              summary: {
                ro: 'Înălțime medie, suprafață sferică.',
                en: 'Medium height, spherical top.',
              },
              pros: [
                {
                  ro: 'Toate tastele sunt interschimbabile, esențial pentru layout-uri nestandard (de exemplu ortolineare)',
                  en: 'Every key is interchangeable, which is essential for non-standard layouts (ortholinear, for example)',
                },
              ],
            },
            {
              name: { ro: 'XDA', en: 'XDA' },
              summary: {
                ro: 'Ca DSA, dar puțin mai înalt și cu o suprafață de contact mai mare și mai plată.',
                en: 'Like DSA, but slightly taller and with a larger, flatter top.',
              },
              pros: [
                {
                  ro: 'Preferat de unii pentru senzația stabilă',
                  en: 'Preferred by some for its stable feel',
                },
              ],
            },
          ],
        },
      ],
    },
    {
      id: 'legends',
      title: { ro: 'Legende: cum sunt aplicate', en: 'Legends: how they are applied' },
      blocks: [
        {
          kind: 'prose',
          section: '2.2',
          paragraphs: [
            {
              ro: 'Metoda prin care literele și simbolurile (legendele) ajung pe taste stabilește direct cât rezistă ele la uzură.',
              en: 'The method used to put letters and symbols (legends) on the keys directly decides how well they stand up to wear.',
            },
          ],
        },
        {
          kind: 'diagram',
          section: '2.2',
          diagram: 'legend-methods',
          caption: {
            ro: 'Patru metode, de la cea mai superficială (pad printing) la cea mai durabilă (double-shot).',
            en: 'Four methods, from the most superficial (pad printing) to the most durable (double-shot).',
          },
        },
        {
          kind: 'options',
          section: '2.2',
          items: [
            {
              name: { ro: 'Pad printing', en: 'Pad printing' },
              summary: {
                ro: 'Legenda este transferată cu un tampon de silicon.',
                en: 'The legend is transferred with a silicone pad.',
              },
              pros: [{ ro: 'Cea mai ieftină metodă', en: 'The cheapest method' }],
              cons: [{ ro: 'Durabilitate foarte redusă', en: 'Very low durability' }],
            },
            {
              name: { ro: 'Gravare laser (ablation)', en: 'Laser etching (ablation)' },
              summary: {
                ro: 'Un laser îndepărtează stratul de sus (de ex. vopsea neagră) și expune plasticul de dedesubt, adesea translucid pentru iluminare RGB.',
                en: 'A laser removes the top layer (e.g. black paint) to expose the plastic underneath, often translucent for RGB lighting.',
              },
              cons: [
                {
                  ro: 'Metodă de suprafață, vulnerabilă la abraziune în timp',
                  en: 'A surface method, vulnerable to abrasion over time',
                },
              ],
            },
            {
              name: { ro: 'Dye-sublimation (dye-sub)', en: 'Dye-sublimation (dye-sub)' },
              summary: {
                ro: 'Căldura transformă cerneala solidă direct în gaz, care pătrunde în structura plasticului și devine parte din el. Funcționează cel mai bine pe PBT.',
                en: 'Heat turns solid ink straight into a gas, which diffuses into the plastic and becomes part of it. It works best on PBT.',
              },
              pros: [
                {
                  ro: 'Legenda nu se poate șterge niciodată, pentru că nu este un strat de suprafață',
                  en: 'The legend can never wear off, because it is not a surface layer',
                },
              ],
              cons: [
                {
                  ro: 'Poate doar să adauge culoare, deci merge doar pentru legende mai închise decât keycap-ul',
                  en: 'It can only add colour, so it only works for legends darker than the keycap',
                },
              ],
            },
            {
              name: { ro: 'Double-shot', en: 'Double-shot' },
              summary: {
                ro: 'Keycap-ul este format din două piese de plastic injectate succesiv în matrițe diferite: prima injecție formează legenda, a doua formează corpul tastei în jurul ei. Este considerată metoda de cea mai înaltă calitate.',
                en: 'The keycap is made of two plastic parts moulded one after the other in different moulds: the first shot forms the legend, the second forms the body of the key around it. It is considered the highest-quality method.',
              },
              pros: [
                {
                  ro: 'Legenda este o bucată de plastic, deci este imposibil să se șteargă',
                  en: 'The legend is a solid piece of plastic, so it cannot wear off',
                },
                {
                  ro: 'Contrast perfect și durabil, de ex. legende albe pe taste negre',
                  en: 'Perfect, lasting contrast, e.g. white legends on black keys',
                },
              ],
            },
          ],
        },
        {
          kind: 'callout',
          section: '2.2',
          title: { ro: 'PBT double-shot, profil Cherry', en: 'PBT double-shot, Cherry profile' },
          body: {
            ro: 'Analiza din lucrare ajunge la concluzia că tastele PBT double-shot cu profil Cherry sunt un standard de facto în industrie: rezistență chimică și mecanică, confort ergonomic dovedit și un sunet plăcut.',
            en: 'The thesis concludes that PBT double-shot keycaps in Cherry profile are a de facto industry standard: chemical and mechanical durability, proven ergonomic comfort and a pleasant sound.',
          },
        },
      ],
    },
  ],
  related: [{ href: '/shop/keycaps', label: { ro: 'Vezi keycap-urile', en: 'Browse keycaps' } }],
};
