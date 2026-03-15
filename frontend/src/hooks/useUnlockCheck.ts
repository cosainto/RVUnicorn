import { useCallback } from "react";
import api from "../services/api";
import { useAuth } from "../contexts/AuthContext";

// Call this after submitting a review, checkin, wishlist, follow, or updating RV profile
// It will fire a notification if a new guide was just unlocked
export function useUnlockCheck() {
  const { user } = useAuth();

  const checkUnlocks = useCallback(async () => {
    if (!user) return [];
    try {
      const { data } = await api.post("/guide-unlocks/check-and-notify");
      if (data.unlocked?.length > 0) {
        // Small delay then show a toast-style celebration
        setTimeout(() => {
          const guideNames: Record<string, string> = {
            diesel: "Diesel Dave 🚛", walter: "Walter 🎭", luna: "Luna 🌙",
            scout: "Scout 🏔️", rose: "Rose Merlot 🍷", holden_hannah: "Holden & Hannah 🏕️",
          };
          data.unlocked.forEach((id: string) => {
            if (guideNames[id]) {
              // Dispatch a custom event that the notification system can listen to
              window.dispatchEvent(new CustomEvent("guide-unlocked", {
                detail: { guideId: id, name: guideNames[id] }
              }));
            }
          });
        }, 500);
      }
      return data.unlocked || [];
    } catch {
      return [];
    }
  }, [user]);

  return { checkUnlocks };
}
