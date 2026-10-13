import type { Locale } from '../locales';
import { en, type MessageTree } from './en';
import { zhTW } from './zh-TW';

export type { MessageTree };

export const MESSAGES: Record<Locale, MessageTree> = {
  en,
  'zh-TW': zhTW,
};

export function getMessages(locale: Locale): MessageTree {
  return MESSAGES[locale] ?? en;
}
