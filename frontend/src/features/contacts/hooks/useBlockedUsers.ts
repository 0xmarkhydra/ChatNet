import { useState } from "react";

export type UseBlockedUsersDeps = {

};

export function useBlockedUsers({

}: UseBlockedUsersDeps) {  const [blockedUsers, setBlockedUsers] = useState<
    Array<{ id: number; username: string; displayName: string }>
  >([]);
  const [blockedOpen, setBlockedOpen] = useState(false);
  const [blockedBusy, setBlockedBusy] = useState(false);
  const [blockedError, setBlockedError] = useState("");

  return {
    blockedBusy,
    blockedError,
    blockedOpen,
    blockedUsers,
    setBlockedBusy,
    setBlockedError,
    setBlockedOpen,
    setBlockedUsers,
  };
}
