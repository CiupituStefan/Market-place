/**
 * Pictures of the world around the keyboards (found in open collections, not CSE products),
 * with what their licences ask for. Shown on the page where they are used and in the footer.
 */
export interface ImageCredit {
  src: string;
  width: number;
  height: number;
  title: string;
  creator: string;
  licence: string;
  source: string;
}

export const WORLD_IMAGES = {
  typewriter: {
    src: '/images/world/typewriter-keys-1921.webp',
    width: 1400,
    height: 2032,
    title: 'Typewriter keys, 1921',
    creator: 'Ralph Steiner',
    licence: 'public domain',
    source: 'https://commons.wikimedia.org/wiki/File:Typewriter_keys_LCCN2004666344.jpg',
  },
  linotype: {
    src: '/images/world/linotype-keyboard.webp',
    width: 1600,
    height: 1200,
    title: 'Clavier de Linotype',
    creator: 'Frédéric Bisson',
    licence: 'CC BY 2.0',
    source: 'https://commons.wikimedia.org/wiki/File:Clavier_de_Linotype.jpg',
  },
  machined: {
    src: '/images/world/cnc-machined-part.webp',
    width: 1400,
    height: 831,
    title: 'CNC machined part',
    creator: 'Mike1024',
    licence: 'public domain',
    source: 'https://commons.wikimedia.org/wiki/File:CAD_model_and_CNC_machined_part.PNG',
  },
  woods: {
    src: '/images/world/larousse-woods-1909.webp',
    width: 1300,
    height: 2007,
    title: 'Bois, Larousse pour tous, 1909',
    creator: 'H. Demoulin',
    licence: 'public domain',
    source:
      'https://commons.wikimedia.org/wiki/File:LAROUSSE_-_BOIS_H%C3%AAtre...Tilleul_Le_Larousse_pour_tous_Vol_01_Paris_1909_(French_encyclopedia_colour_plate_WOOD_grain_types_patterns_textures_fibres_lines_samples_timber_carpentry)_No_copyright.jpg',
  },
} satisfies Record<string, ImageCredit>;
