import { createUiTranslator, type UiCopyKey } from '../../shared/i18n/locale'
import type { Tab } from "../../shared/types/navigation";

export type DesktopSection = "groups" | "calls" | null;

export function searchLabels(tab: Tab, t: (key: UiCopyKey) => string = createUiTranslator('vi')) {
  switch (tab) {
    case "notifications":
      return { placeholder: t('common.ui.searchNotifications'), ariaLabel: t('common.ui.findNotifications') };
    case "contacts":
      return { placeholder: t('contacts.nameEmail'), ariaLabel: t('contacts.findName') };
    case "discover":
      return { placeholder: t('common.ui.findConnect'), ariaLabel: t('common.ui.findDiscover') };
    case "market":
      return { placeholder: t('common.ui.searchProducts'), ariaLabel: t('common.ui.findMarketplace') };
    case "profile":
      return { placeholder: t('common.ui.searchSocco'), ariaLabel: t('common.ui.searchSoccoPosts') };
    case "feed":
      return { placeholder: t('common.ui.searchPostAuthor'), ariaLabel: t('common.ui.findPosts') };
    default:
      return { placeholder: t('common.ui.searchContactsMessages'), ariaLabel: t('common.ui.findConversation') };
  }
}