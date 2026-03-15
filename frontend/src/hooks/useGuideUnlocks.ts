import { useState, useEffect } from "react";
import api from "../services/api";
import { useAuth } from "../contexts/AuthContext";

export interface UnlockCondition {
  label: string;
  met: boolean;
  current: number;
  required: number;
}

export interface GuideUnlock {
  unlocked: boolean;
  conditions: UnlockCondition[];
}

export type UnlockMap = Record<string, GuideUnlock>;

export function useGuideUnlocks() {
  const { user } = useAuth();
  const [unlocks, setUnlocks] = useState<UnlockMap>({ hitch: { unlocked: true, conditions: [] } });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    api.get("/guide-unlocks")
      .then(r => setUnlocks(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  const isUnlocked = (guideId: string) => {
    if (guideId === "hitch") return true;
    return unlocks[guideId]?.unlocked ?? false;
  };

  const getProgress = (guideId: string): UnlockCondition[] => {
    return unlocks[guideId]?.conditions ?? [];
  };

  return { unlocks, loading, isUnlocked, getProgress };
}
