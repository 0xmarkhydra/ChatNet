// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { useMessageSoundPreference } from "./useMessageSoundPreference";

const sound = vi.hoisted(() => ({ enabled: true, unlock: vi.fn() }));
vi.mock("../../features/notifications/lib/incomingSound", () => ({
  MESSAGE_SOUND_SETTING_KEY: "chatnet-message-sound-enabled-v1",
  readMessageSoundEnabled: () => sound.enabled,
  IncomingMessageSound: class {
    unlock() { sound.unlock(); }
  },
}));
vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);

const cleanups: Array<() => void> = [];
afterEach(() => {
  while (cleanups.length) cleanups.pop()!();
  sound.enabled = true;
  sound.unlock.mockClear();
});

function SoundFixture() {
  const { messageSoundEnabled } = useMessageSoundPreference();
  return <output>{String(messageSoundEnabled)}</output>;
}

function renderSound() {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  act(() => root.render(<SoundFixture />));
  cleanups.push(() => {
    act(() => root.unmount());
    container.remove();
  });
  return container;
}

it("unlocks on a real pointer/key gesture while enabled", () => {
  renderSound();
  act(() => window.dispatchEvent(new Event("pointerdown")));
  act(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" })));
  expect(sound.unlock).toHaveBeenCalledTimes(2);
});

it("syncs matching storage preferences and disables unlock", () => {
  const container = renderSound();
  sound.enabled = false;
  act(() => window.dispatchEvent(new StorageEvent("storage", { key: "chatnet-message-sound-enabled-v1" })));
  expect(container.querySelector("output")?.textContent).toBe("false");
  act(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" })));
  expect(sound.unlock).not.toHaveBeenCalled();
});

it("ignores unrelated storage updates but listens to clear events", () => {
  const container = renderSound();
  sound.enabled = false;
  act(() => window.dispatchEvent(new StorageEvent("storage", { key: "other-setting" })));
  expect(container.querySelector("output")?.textContent).toBe("true");
  act(() => window.dispatchEvent(new StorageEvent("storage", { key: null })));
  expect(container.querySelector("output")?.textContent).toBe("false");
});

it("removes all event listeners on unmount", () => {
  renderSound();
  cleanups.pop()!();
  act(() => window.dispatchEvent(new Event("pointerdown")));
  expect(sound.unlock).not.toHaveBeenCalled();
});
