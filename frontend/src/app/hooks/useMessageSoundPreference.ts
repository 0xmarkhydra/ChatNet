import { useEffect, useState } from "react";
import { useLatest } from "../../shared/hooks/useLatest";
import {
  IncomingMessageSound,
  MESSAGE_SOUND_SETTING_KEY,
  readMessageSoundEnabled,
} from "../../features/notifications/lib/incomingSound";

/** Owns the notification sound instance and the browser gesture/preference lifecycle. */
export function useMessageSoundPreference() {
  const [messageSoundEnabled, setMessageSoundEnabled] = useState(readMessageSoundEnabled);
  const messageSoundEnabledRef = useLatest(messageSoundEnabled);
  const [messageSound] = useState(() => ({ current: new IncomingMessageSound() }));

  useEffect(() => {
    const unlockAudio = () => {
      if (messageSoundEnabledRef.current) messageSound.current?.unlock();
    };
    const syncPreference = (event: StorageEvent) => {
      if (event.key !== MESSAGE_SOUND_SETTING_KEY && event.key !== null) return;
      const enabled = readMessageSoundEnabled();
      messageSoundEnabledRef.current = enabled;
      setMessageSoundEnabled(enabled);
    };
    window.addEventListener("pointerdown", unlockAudio, { passive: true });
    window.addEventListener("keydown", unlockAudio);
    window.addEventListener("storage", syncPreference);
    return () => {
      window.removeEventListener("pointerdown", unlockAudio);
      window.removeEventListener("keydown", unlockAudio);
      window.removeEventListener("storage", syncPreference);
    };
  }, [messageSoundEnabledRef, messageSound]);

  return {
    messageSoundEnabled,
    setMessageSoundEnabled,
    messageSoundEnabledRef,
    messageSound,
  };
}
