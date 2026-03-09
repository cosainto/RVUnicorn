import React, { useState, useEffect } from "react";
import api from "../services/api";

interface Recommendation {
  id: string;
  serviceType: string;
  urgency: "low" | "normal" | "high" | "critical";
  recommendedDate: string | null;
  recommendedMileage: number | null;
  aiReason: string;
  status: string;
}

interface Props {
  userId: string;
  rvName: string;
  aiMaintenanceEnabled: boolean;
  currentOdometer?: number;
  onToggle?: (enabled: boolean) => void;
}

const URGENCY: Record<string, { dot: string; label: string; icon: string }> = {
  critical: { dot: "bg-red-500",    label: "Critical",  icon: "🚨" },
  high:     { dot: "bg-orange-400", label: "Due Soon",  icon: "🔧" },
  normal:   { dot: "bg-yellow-400", label: "Upcoming",  icon: "📅" },
  low:      { dot: "bg-blue-400",   label: "Info",      icon: "ℹ️" },
};

export default function MaintenanceAI({ userId, rvName, aiMaintenanceEnabled, currentOdometer, onToggle }: Props) {
  const [enabled, setEnabled]                 = useState(aiMaintenanceEnabled);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [odometer, setOdometer]               = useState(currentOdometer || 0);
  const [editingOdo, setEditingOdo]           = useState(false);
  const [odometerInput, setOdometerInput]     = useState(String(currentOdometer || 0));
  const [loading, setLoading]                 = useState(false);
  const [analyzing, setAnalyzing]             = useState(false);
  const [expanded, setExpanded]               = useState(false);
  const [scheduleId, setScheduleId]           = useState<string | null>(null);
  const [scheduleDate, setScheduleDate]       = useState("");

  useEffect(() => { if (enabled) fetchRecommendations(); }, [enabled]);
  useEffect(() => {
    if (currentOdometer) { setOdometer(currentOdometer); setOdometerInput(String(currentOdometer)); }
  }, [currentOdometer]);
  useEffect(() => { setEnabled(aiMaintenanceEnabled); }, [aiMaintenanceEnabled]);

  const fetchRecommendations = async () => {
    try {
      const { data } = await api.get(`/ai-maintenance/recommendations/${userId}`);
      setRecommendations(data);
    } catch (e) { console.error(e); }
  };

  const handleToggle = async () => {
    const newVal = !enabled;
    setLoading(true);
    try {
      await api.post("/ai-maintenance/toggle", { userId, enabled: newVal });
      setEnabled(newVal);
      onToggle?.(newVal);
      if (newVal) {
        setAnalyzing(true);
        await api.post(`/ai-maintenance/analyze/${userId}`);
        await fetchRecommendations();
        setAnalyzing(false);
        setExpanded(true);
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const handleOdometerSave = async () => {
    const miles = parseInt(odometerInput);
    if (isNaN(miles) || miles < 0) return;
    try {
      await api.post("/ai-maintenance/odometer", { userId, mileage: miles });
      setOdometer(miles);
      setEditingOdo(false);
      await fetchRecommendations();
    } catch (e) { console.error(e); }
  };

  const handleDismiss = async (id: string) => {
    try {
      await api.post(`/ai-maintenance/recommendations/${id}/dismiss`);
      setRecommendations(prev => prev.filter(r => r.id !== id));
    } catch (e) { console.error(e); }
  };

  const handleSchedule = async (id: string) => {
    try {
      await api.post(`/ai-maintenance/recommendations/${id}/schedule`, {
        scheduledDate: scheduleDate || new Date().toISOString(),
      });
      setRecommendations(prev => prev.filter(r => r.id !== id));
      setScheduleId(null);
    } catch (e) { console.error(e); }
  };

  const urgent = recommendations.filter(r => r.urgency === "critical" || r.urgency === "high");

  return (
    <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl overflow-hidden">
      {/* Compact top bar */}
      <div className="flex items-center justify-between px-4 py-2.5 gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-lg">🤖</span>
          <span className="font-semibold text-gray-800 text-sm whitespace-nowrap">Hitch AI</span>
          {enabled && !analyzing && recommendations.length > 0 && (
            <span className="flex items-center gap-1 text-xs bg-white border border-emerald-200 text-emerald-700 px-2 py-0.5 rounded-full font-medium">
              {urgent.length > 0 && <span className="w-1.5 h-1.5 rounded-full bg-orange-400 inline-block"/>}
              {recommendations.length} reminder{recommendations.length !== 1 ? "s" : ""}
            </span>
          )}
          {enabled && analyzing && <span className="text-xs text-teal-600 animate-pulse">Analyzing…</span>}
        </div>

        <div className="flex items-center gap-3">
          {enabled && (
            editingOdo ? (
              <div className="flex items-center gap-1">
                <input type="number" value={odometerInput} onChange={e => setOdometerInput(e.target.value)}
                  className="w-24 border border-gray-300 rounded px-2 py-0.5 text-xs" autoFocus />
                <button onClick={handleOdometerSave} className="text-xs text-emerald-600 font-medium hover:text-emerald-700">✓</button>
                <button onClick={() => setEditingOdo(false)} className="text-xs text-gray-400 hover:text-gray-600">✕</button>
              </div>
            ) : (
              <button onClick={() => setEditingOdo(true)} className="text-xs text-gray-500 hover:text-emerald-600 whitespace-nowrap">
                {odometer.toLocaleString()} mi
              </button>
            )
          )}

          {enabled && recommendations.length > 0 && (
            <button onClick={() => setExpanded(x => !x)} className="text-xs text-teal-600 hover:text-teal-800 font-medium">
              {expanded ? "Hide ▲" : "View ▼"}
            </button>
          )}

          <button onClick={handleToggle} disabled={loading}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none flex-shrink-0 ${enabled ? "bg-emerald-500" : "bg-gray-300"}`}>
            <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${enabled ? "translate-x-5" : "translate-x-0.5"}`}/>
          </button>
        </div>
      </div>

      {/* Expanded recommendations */}
      {enabled && expanded && recommendations.length > 0 && (
        <div className="border-t border-emerald-100 px-4 py-3 space-y-2 bg-white bg-opacity-60">
          {recommendations.map(rec => {
            const u = URGENCY[rec.urgency] || URGENCY.normal;
            const dueDate = rec.recommendedDate ? new Date(rec.recommendedDate).toLocaleDateString() : null;
            const dueMiles = rec.recommendedMileage ? rec.recommendedMileage.toLocaleString() + " mi" : null;
            return (
              <div key={rec.id} className="flex items-start justify-between gap-3 bg-white rounded-lg border border-gray-100 px-3 py-2.5">
                <div className="flex items-start gap-2 flex-1 min-w-0">
                  <span className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${u.dot}`}/>
                  <div className="min-w-0">
                    <p className="font-medium text-gray-800 text-xs">{u.icon} {rec.serviceType}
                      <span className="ml-1.5 text-gray-400 font-normal">{u.label}</span>
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">{rec.aiReason}</p>
                    {(dueDate || dueMiles) && (
                      <p className="text-xs text-gray-400 mt-0.5">Due: {[dueDate, dueMiles].filter(Boolean).join(" or ")}</p>
                    )}
                    {scheduleId === rec.id && (
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <input type="date" value={scheduleDate} onChange={e => setScheduleDate(e.target.value)}
                          className="border border-gray-300 rounded px-1.5 py-0.5 text-xs" />
                        <button onClick={() => handleSchedule(rec.id)} className="text-xs bg-emerald-500 text-white px-2 py-0.5 rounded hover:bg-emerald-600">OK</button>
                        <button onClick={() => setScheduleId(null)} className="text-xs text-gray-400">Cancel</button>
                      </div>
                    )}
                  </div>
                </div>
                {scheduleId !== rec.id && (
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => setScheduleId(rec.id)} className="text-xs text-teal-600 hover:text-teal-800 font-medium">Schedule</button>
                    <button onClick={() => handleDismiss(rec.id)} className="text-xs text-gray-300 hover:text-gray-500">✕</button>
                  </div>
                )}
              </div>
            );
          })}
          <div className="flex justify-end">
            <button onClick={async () => { setAnalyzing(true); await api.post(`/ai-maintenance/analyze/${userId}`); await fetchRecommendations(); setAnalyzing(false); }}
              disabled={analyzing} className="text-xs text-teal-600 hover:text-teal-800 font-medium">
              {analyzing ? "Analyzing…" : "↻ Refresh analysis"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
