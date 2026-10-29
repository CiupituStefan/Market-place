import type { Locale } from '../config';
import { en, type Messages } from './en';
import { ro } from './ro';

export type { Messages } from './en';

export const MESSAGES: Record<Locale, Messages> = { en, ro };
