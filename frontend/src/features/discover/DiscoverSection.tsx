import { lazy } from "react";
import { Suspense, type SetStateAction } from "react";
import type { NearbyUser } from "./NearbyExplorer";
import type { FriendSearchResult, FriendConnection } from "../contacts/types";
import type { Dispatch } from "react";

const NearbyExplorer = lazy(
  () => import("./NearbyExplorer"),
);

export type DiscoverSectionProps = {
  actOnFriend: (friend: FriendSearchResult | FriendConnection, decline?: boolean) => Promise<void>;
  findNearby: () => Promise<void>;
  friendActionBusy: number | null;
  friendRelationship: (userId: number) => "accepted" | "incoming" | "outgoing" | "none";
  globalSearch: string;
  nearbyBusy: boolean;
  nearbyRadiusKm: number;
  nearbyResultRadiusKm: number;
  nearbyScanning: boolean;
  nearbyUntil: number;
  nearbyUsers: FriendSearchResult[];
  setGlobalSearch: Dispatch<SetStateAction<string>>;
  setNearbyRadiusKm: Dispatch<SetStateAction<number>>;
  stopNearby: () => Promise<void>;
};

export default function DiscoverSection({
  actOnFriend,
  findNearby,
  friendActionBusy,
  friendRelationship,
  globalSearch,
  nearbyBusy,
  nearbyRadiusKm,
  nearbyResultRadiusKm,
  nearbyScanning,
  nearbyUntil,
  nearbyUsers,
  setGlobalSearch,
  setNearbyRadiusKm,
  stopNearby,
}: DiscoverSectionProps) {
  return (
      <Suspense fallback={null}>
            <NearbyExplorer
              query={globalSearch}
              onQueryChange={setGlobalSearch}
              users={nearbyUsers as NearbyUser[]}
              peopleBusy={nearbyBusy}
              peopleScanning={nearbyScanning}
              peopleActive={nearbyUntil > 0}
              peopleRadiusKm={nearbyRadiusKm}
              resultRadiusKm={nearbyResultRadiusKm}
              onPeopleRadiusChange={setNearbyRadiusKm}
              onScanPeople={findNearby}
              onStopPeople={stopNearby}
              friendActionBusy={friendActionBusy}
              onFriendAction={actOnFriend}
              getFriendActionLabel={(friend) => {
                const relationship = friendRelationship(friend.id);
                return relationship === "accepted"
                  ? "Nhắn tin"
                  : relationship === "incoming"
                    ? "Chấp nhận"
                    : relationship === "outgoing"
                      ? "Hủy lời mời"
                      : "Kết bạn";
              }}
            />
          </Suspense>
  );
}
