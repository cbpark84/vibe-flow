import { createContext, useContext } from 'react';
import en from './en';
import ko from './ko';
import type { I18nMessages } from './en';

export type Locale = 'en' | 'ko';

const messages: Record<Locale, I18nMessages> = { en, ko };

export function getMessages(locale: Locale): I18nMessages {
  return messages[locale] ?? messages.en;
}

export const I18nContext = createContext<I18nMessages>(en);

export function useI18n(): I18nMessages {
  return useContext(I18nContext);
}

export { en, ko };
export type { I18nMessages };
