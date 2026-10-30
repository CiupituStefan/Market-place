import type { Locale } from '@/lib/i18n/config';

/**
 * The technical guide ("Ghid tehnic"): what mechanical keyboards are made of and how they work,
 * written from Ștefan-Emanuel Ciupitu's bachelor thesis "Tastatură multifuncțională fără fir
 * folosind modulul nRF52840" (Suceava, 2025). Every statement must be supported by the thesis;
 * `section` on a block names the thesis chapter it comes from, so a reviewer can check it.
 */

/** Text in both languages of the site. */
export type Text = Record<Locale, string>;

/** Diagrams drawn in code (components/knowledge/diagrams). */
export type DiagramId =
  | 'exploded-stack'
  | 'switch-travel'
  | 'mount-integrated'
  | 'mount-tray'
  | 'mount-top'
  | 'mount-bottom'
  | 'mount-sandwich'
  | 'mount-gasket'
  | 'keycap-profiles'
  | 'legend-methods'
  | 'layout-sizes'
  | 'matrix-scan'
  | 'hid-report'
  | 'data-pipeline'
  | 'charge-cycle';

/** Photographs and drawings from the thesis (the author's own prototype and design files). */
export type PhotoId =
  | 'prototype'
  | 'pcb'
  | 'case-top'
  | 'chip-recovered'
  | 'schematic'
  | 'pcb-layout-top'
  | 'pcb-layout-bottom'
  | 'drawing-plate'
  | 'drawing-case'
  | 'drawing-frame';

export type Block =
  /** One or more paragraphs. */
  | { kind: 'prose'; section: string; paragraphs: Text[] }
  /** A short statement set apart (a definition, a design rule, a measured result). */
  | { kind: 'callout'; section: string; title: Text; body: Text }
  /** Terms and their explanation (e.g. actuation point, total travel). */
  | { kind: 'terms'; section: string; title?: Text; items: { term: Text; body: Text }[] }
  /** Things side by side with pros and cons (e.g. ABS vs PBT vs POM). */
  | {
      kind: 'options';
      section: string;
      title?: Text;
      items: { name: Text; summary: Text; pros?: Text[]; cons?: Text[]; diagram?: DiagramId }[];
    }
  /** A table, exactly as the thesis gives it (columns × rows). */
  | {
      kind: 'table';
      section: string;
      title: Text;
      columns: Text[];
      rows: Text[][];
      /** Index of the column that names the row (rendered as a row header). */
      rowHeader?: number;
    }
  /** An ordered process (e.g. the six stages from key press to character on screen). */
  | { kind: 'steps'; section: string; title?: Text; items: { title: Text; body: Text }[] }
  /** Numbers with units, as stated in the thesis (e.g. 64 MHz, 1 MB Flash). */
  | {
      kind: 'specs';
      section: string;
      title?: Text;
      items: { label: Text; value: string; note?: Text }[];
    }
  | { kind: 'diagram'; section: string; diagram: DiagramId; caption: Text }
  | { kind: 'photo'; section: string; photo: PhotoId; caption: Text };

export type TopicSlug = 'layouts' | 'switches' | 'keycaps' | 'mounting' | 'wireless' | 'prototype';

export interface TopicChapter {
  /** URL fragment, e.g. "gasket-mount". */
  id: string;
  title: Text;
  blocks: Block[];
}

export interface Topic {
  slug: TopicSlug;
  /** Short name for navigation, 1-3 words. */
  name: Text;
  /** Page title, at most ~40 characters. */
  title: Text;
  /** One or two sentences: what the reader learns here. */
  summary: Text;
  /** The one diagram that represents the topic on the index page. */
  emblem: DiagramId;
  chapters: TopicChapter[];
  /** Store pages where the topic meets products (e.g. /shop/switches). */
  related: { href: string; label: Text }[];
}
