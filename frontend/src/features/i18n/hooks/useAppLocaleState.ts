import { useMemo, useState } from "react";
import { loadAppLocalePreference, loadCachedBundle } from "../lib/i18n";

export type UseAppLocaleStateDeps = {

};

export function useAppLocaleState({

}: UseAppLocaleStateDeps) {
  const [languageSearch, setLanguageSearch] = useState("");
  const [appLocale, setAppLocale] = useState<string>(loadAppLocalePreference);
  const uiBundle = useMemo(() => loadCachedBundle(appLocale), [appLocale]);
  const [localePickerOpen, setLocalePickerOpen] = useState(false);
  const [localeSearch, setLocaleSearch] = useState("");
  const [translationPickerOpen, setTranslationPickerOpen] = useState(false);

  return {
    appLocale,
    languageSearch,
    localePickerOpen,
    localeSearch,
    setAppLocale,
    setLanguageSearch,
    setLocalePickerOpen,
    setLocaleSearch,
    setTranslationPickerOpen,
    translationPickerOpen,
    uiBundle,
    uiLocaleLoading: false,
  };
}