import { useEffect, useRef, useState } from "react";
import { Wifi, WifiOff } from "lucide-react";
import toast from "react-hot-toast";

export default function NetworkStatus() {
  const hasMountedRef = useRef(false);
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );

  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);

    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);

    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }

    if (isOnline) {
      toast.success("Internet connected", { id: "network-status" });
      return;
    }

    toast.error("Internet disconnected", { id: "network-status" });
  }, [isOnline]);

  return (
    <div
      className={`glass flex h-9 w-9 items-center justify-center rounded-full border transition ${
        isOnline
          ? "border-emerald-400/30 text-emerald-300"
          : "border-red-400/40 text-red-300"
      }`}
      aria-live="polite"
      role="status"
      title={isOnline ? "Internet connected" : "Internet disconnected"}
    >
      {isOnline ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
    </div>
  );
}
