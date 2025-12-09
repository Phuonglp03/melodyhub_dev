import { useEffect } from "react";
import { collabChannel } from "../utils/collabChannel";

export const useCollabSubscription = (event, handler) => {
  useEffect(() => {
    if (!event || typeof handler !== "function") return;
    const unsubscribe = collabChannel.on(event, handler);
    return () => {
      unsubscribe?.();
    };
  }, [event, handler]);
};






