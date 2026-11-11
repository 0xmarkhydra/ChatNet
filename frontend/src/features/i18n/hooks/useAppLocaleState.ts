import { useState } from "react";
import { loadAppLocalePreference, type UIBundle, defaultBundle } from "../lib/i18n";

export type UseAppLocaleStateDeps = {

};

export function useAppLocaleState({

}: UseAppLocaleStateDeps) {  const [languageSearch, setLanguageSearch] = useState("");
  const [appLocale, setAppLocale] = useState(loadAppLocalePreference);
  const [uiBundle, setUiBundle] = useState<UIBundle>(defaultBundle);
  const [uiLocaleLoading, setUiLocaleLoading] = useState(false);
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
    setUiBundle,
    setUiLocaleLoading,
    translationPickerOpen,
    uiBundle,
    uiLocaleLoading,
  };
}
