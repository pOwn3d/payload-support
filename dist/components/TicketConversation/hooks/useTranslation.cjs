'use strict';

var react = require('react');
var frTranslations = require('../locales/fr.json');
var enTranslations = require('../locales/en.json');

function _interopDefault (e) { return e && e.__esModule ? e : { default: e }; }

var frTranslations__default = /*#__PURE__*/_interopDefault(frTranslations);
var enTranslations__default = /*#__PURE__*/_interopDefault(enTranslations);

const LOCALE_STORAGE_KEY = "support_locale";
const DEFAULT_LOCALE = "fr";
const translations = {
  fr: frTranslations__default.default,
  en: enTranslations__default.default
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
  const [locale, setLocaleState] = react.useState(() => {
    if (typeof window === "undefined") return DEFAULT_LOCALE;
    try {
      const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
      if (stored === "fr" || stored === "en") return stored;
    } catch {
    }
    return DEFAULT_LOCALE;
  });
  react.useEffect(() => {
    fetch("/api/support/user-prefs", { credentials: "include" }).then((r) => r.ok ? r.json() : null).then((data) => {
      if (data?.locale && (data.locale === "fr" || data.locale === "en")) {
        setLocaleState(data.locale);
      }
    }).catch(() => {
    });
  }, []);
  react.useEffect(() => {
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    } catch {
    }
  }, [locale]);
  const setLocale = react.useCallback((newLocale) => {
    setLocaleState(newLocale);
  }, []);
  const t = react.useCallback(
    (key, vars) => {
      const dict = translations[locale] || translations[DEFAULT_LOCALE];
      const value = getNestedValue(dict, key);
      return interpolate(value, vars);
    },
    [locale]
  );
  return { t, locale, setLocale };
}

exports.DEFAULT_LOCALE = DEFAULT_LOCALE;
exports.LOCALE_STORAGE_KEY = LOCALE_STORAGE_KEY;
exports.useTranslation = useTranslation;
