import { useState, useEffect } from "react";
import { AlertTriangle, Fuel, Cloud, ChevronDown, ChevronUp, Loader } from "lucide-react";
import api from "../services/api";

interface CopilotWarning {
  type: "rig" | "fuel" | "weather" | "tip";
  severity: "info" | "warning" | "danger";
  title: string;
  detail: string;
}

interface TripCopilotProps {
  tripId: string;
  origin: string;
  destination: string;
  campgroundId?: string;
}

const SEVERITY_CONFIG = {
  info:    { bg: "bg-blue-50",   border: "border-blue-200",   icon: "ℹ️",  text: "text-blue-800"   },
  warning: { bg: "bg-amber-50",  border: "border-amber-200",  icon: "⚠️",  text: "text-amber-800"  },
  danger:  { bg: "bg-red-50",    border: "border-red-200",    icon: "🚨",  text: "text-red-800"    },
};

export default function TripCopilot({ tripId, origin, destination, campgroundId }: TripCopilotProps) {
  const [warnings, setWarnings] = useState<CopilotWarning[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    if (!origin || !destination) { setLoading(false); return; }
    api.post("/hitch/trip-copilot", { tripId, origin, destination, campgroundId })
      .then(r => setWarnings(r.data.warnings || []))
      .catch(() => setWarnings([]))
      .finally(() => setLoading(false));
  }, [tripId, origin, destination]);

  if (loading) return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-2 text-sm text-gray-500">
      <Loader className="w-4 h-4 animate-spin text-primary-500" />
      Hitch is analyzing your trip...
    </div>
  );

  if (warnings.length === 0) return null;

  const dangerCount = warnings.filter(w => w.severity === "danger").length;
  const warnCount = warnings.filter(w => w.severity === "warning").length;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <button onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition">
        <div className="flex items-center gap-2">
          <span className="text-xl">🦄</span>
          <div className="text-left">
            <p className="font-bold text-gray-900 text-sm">Hitch Co-Pilot</p>
            <p className="text-xs text-gray-500">
              {dangerCount > 0 ? `${dangerCount} issue${dangerCount > 1 ? "s" : ""} found` :
               warnCount > 0 ? `${warnCount} thing${warnCount > 1 ? "s" : ""} to know` :
               `${warnings.length} tip${warnings.length > 1 ? "s" : ""} for your trip`}
            </p>
          </div>
          {dangerCount > 0 && <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded-full">{dangerCount} alert</span>}
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-2 border-t border-gray-100 pt-3">
          {warnings.map((w, i) => {
            const cfg = SEVERITY_CONFIG[w.severity];
            return (
              <div key={i} className={`rounded-xl border p-3 ${cfg.bg} ${cfg.border}`}>
                <div className="flex items-start gap-2">
                  <span className="text-base shrink-0 mt-0.5">{cfg.icon}</span>
                  <div>
                    <p className={`text-sm font-bold ${cfg.text}`}>{w.title}</p>
                    <p className={`text-xs mt-0.5 leading-relaxed ${cfg.text} opacity-80`}>{w.detail}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
