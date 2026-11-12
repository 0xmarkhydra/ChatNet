import { useState, useEffect } from "react";
import { type NewChatMode } from "../types";
import type { GroupWorkspaceMode } from "../components/CommunityGroupsPage";

export type UseGroupWorkspaceStateDeps = {

};

export function useGroupWorkspaceState({

}: UseGroupWorkspaceStateDeps) {
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  useEffect(() => {
    if (!quickCreateOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setQuickCreateOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [quickCreateOpen]);
  const [newChatMode, setNewChatMode] = useState<NewChatMode>("none");
  const [directUsername, setDirectUsername] = useState("");
  const [groupWorkspaceMode, setGroupWorkspaceMode] = useState<GroupWorkspaceMode>("list");
  const [groupCreateStep, setGroupCreateStep] = useState<1 | 2 | 3>(1);
  const [chatCreateError, setChatCreateError] = useState("");

  return {
    chatCreateError,
    directUsername,
    groupCreateStep,
    groupWorkspaceMode,
    newChatMode,
    quickCreateOpen,
    setChatCreateError,
    setDirectUsername,
    setGroupCreateStep,
    setGroupWorkspaceMode,
    setNewChatMode,
    setQuickCreateOpen,
  };
}
