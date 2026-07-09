import { useState } from 'react';
import en from '../locales/en.json';
import es from '../locales/es.json';

type Translations = {
  [lang: string]: {
    [key: string]: string;
  }
};

const dictionaries: Translations = { en, es };

export const useTranslation = () => {
  const getBrowserLang = () => {
    const browserLang = navigator.language.split('-')[0];
    return dictionaries[browserLang] ? browserLang : 'en';
  };

  const [lang, setLang] = useState(getBrowserLang);

  const t = (key: string) => {
    return dictionaries[lang]?.[key] || dictionaries['en'][key] || key;
  };

  return { t, lang, setLang };
};
