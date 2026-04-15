"use client";
import { useState, useEffect, useCallback } from 'react';
import frTranslations from '../locales/fr.json';
import enTranslations from '../locales/en.json';

const LOCALE_STORAGE_KEY = "support_locale";
const DEFAULT_LOCALE = "fr";
const translations = {
  fr: frTranslations,
  en: enTranslations
};
function getNestedValue(obj, path) {
  const keys = path.split(".");
  let current = obj;
  for (const key of keys) {
    if (current == null || typeof current !== "object") {
      return path;
    }
    current = current[key];
  }
  if (typeof current === "string") {
    return current;
  }
  return path;
}
function interpolate(template, vars) {
  if (!vars) return template;
  return template.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (_, key) => {
    return String(vars[key] ?? `{{${key}}}`);
  });
}
function useTranslation() {
  const [locale, setLocaleState] = useState(() => {
    if (typeof window === "undefined") return DEFAULT_LOCALE;
    try {
      const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
      if (stored === "fr" || stored === "en") return stored;
    } catch {
    }
    return DEFAULT_LOCALE;
  });
  useEffect(() => {
    fetch("/api/support/user-prefs", { credentials: "include" }).then((r) => r.ok ? r.json() : null).then((data) => {
      if (data?.locale && (data.locale === "fr" || data.locale === "en")) {
        setLocaleState(data.locale);
      }
    }).catch(() => {
    });
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    } catch {
    }
  }, [locale]);
  const setLocale = useCallback((newLocale) => {
    setLocaleState(newLocale);
  }, []);
  const t = useCallback(
    (key, vars) => {
      const dict = translations[locale] || translations[DEFAULT_LOCALE];
      const value = getNestedValue(dict, key);
      return interpolate(value, vars);
    },
    [locale]
  );
  return { t, locale, setLocale };
}

export { DEFAULT_LOCALE, LOCALE_STORAGE_KEY, useTranslation };
