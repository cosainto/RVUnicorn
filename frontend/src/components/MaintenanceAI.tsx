import React, { useState, useEffect } from "react";
import axios from "axios";

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
  rvId: string;
  rvName: string;
  aiMaintenanceEnabled: boolean;
  currentOdometer?: number;
  onToggle?: (enabled: boolean) => void;
}

const URGENCY_STYLES: Record<string, { bg: string; text: string; label: string; icon: string }> = {
  critical: { bg: "bg-red-50 border-red-200",    text: "text-red-700",    label: "Critical",  icon: "🚨" },
  high:     { bg: "bg-orange-50 border-orange-200", text: "text-orange-700", label: "Due Soon",  icon: "🔧" },
  normal:   { bg: "bg-yellow-50 border-yellow-200", text: "text-yellow-700", label: "Upcoming",  icon: "📅" },
  low:      { bg: "bg-blue-50 border-blue-200",   text: "text-blue-700",   label: "Info",      icon: "ℹ️" },
};

export default function MaintenanceAI({ rvId, rvName, aiMaintenanceEnabled, currentOdometer, onToggle }: Props) {
  const [enabled, setEnabled]               = useState(aiMaintenanceEnabled);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [odometer, setOdometer]             = useState(currentOdometer || 0);
  const [editingOdo, setEditingOdo]         = useState(false);
  const [odometerInput, setOdometerInput]   = useState(String(currentOdometer || 0));
  const [loading, setLoading]               = useState(false);
  const [analyzing, setAnalyzing]           = useState(false);
  const [scheduleId, setScheduleId]         = useState<string | null>(null);
  const [scheduleDate, setScheduleDate]     = useState("");

  useEffect(() => {
    if (enabled) fetchRecommendations();
  }, [enabled]);

  const fetchRecommendations = async () => {
    try {
      const { data } = await axios.get(`/api/ai-maintenance/recommendations/${rvId}`);
      setRecommendations(data);
    } catch (e) {
      console.error("Failed to fetch recommendations:", e);
    }
  };

  const handleToggle = async () => {
    const newVal = !enabled;
    setLoading(true);
    try {
      await axios.post("/api/ai-maintenance/toggle", { rvId, enabled: newVal });
      setEnabled(newVal);
      onToggle?.(newVal);
      if (newVal) {
        setAnalyzing(true);
        await axios.post(`/api/ai-maintenance/analyze/${rvId}`);
        await fetchRecommendations();
        setAnalyzing(false);
      }
    } catch (e) {
      console.error("Toggle failed:", e);
    }
    setLoading(false);
  };

  const handleOdometerSave = async () => {
    const miles = parseInt(odometerInput);
    if (isNaN(miles) || miles < 0) return;
    try {
      await axios.post("/api/ai-maintenance/odometer", { rvId, mileage: miles });
      setOdometer(miles);
      setEditingOdo(false);
      await fetchRecommendations();
    } catch (e) {
      console.error("Odometer update failed:", e);
    }
  };

  const handleDismiss = async (id: string) => {
    try {
      await axios.post(`/api/ai-maintenance/recommendations/${id}/dismiss`);
      setRecommendations(prev => prev.filter(r => r.id !== id));
    } catch (e) {
      console.error("Dismiss failed:", e);
    }
  };

  const handleSchedule = async (id: string) => {
    try {
      await axios.post(`/api/ai-maintenance/recommendations/${id}/schedule`, {
        scheduledDate: scheduleDate || new Date().toISOString(),
      });
      setRecommendations(prev => prev.filter(r => r.id !== id));
      setScheduleId(null);
    } catch (e) {
      console.error("Schedule failed:", e);
    }
  };

  const handleRunAnalysis = async () => {
    setAnalyzing(true);
    try {
      await axios.post(`/api/ai-maintenance/analyze/${rvId}`);
      await fetchRecommendations();
    } catch (e) {
      console.error("Analysis failed:", e);
    }
    setAnalyzing(false);
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 bg-gradient-to-r from-emerald-50 to-teal-50 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🤖</span>
          <div>
            <h3 className="font-semibold text-gray-900">Hitch AI Maintenance</h3>
            <p className="text-xs text-gray-500">Smart service reminders for {rvName}</p>
          </div>
        </div>
        <button
          onClick={handleToggle}
          disabled={loading}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
            enabled ? "bg-emerald-500" : "bg-gray-300"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
              enabled ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>

      {!enabled ? (
        <div className="px-6 py-8 text-center text-gray-500">
          <p className="text-4xl mb-3">🔧</p>
          <p className="font-medium text-gray-700 mb-1">AI Maintenance Monitoring is off</p>
          <p className="text-sm">Toggle on to let Hitch track your service intervals and remind you when maintenance is due.</p>
        </div>
      ) : (
        <div className="px-6 py-4 space-y-4">
          {/* Odometer */}
          <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Current Odometer</p>
              {editingOdo ? (
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="number"
                    value={odometerInput}
                    onChange={e => setOdometerInput(e.target.value)}
                    className="w-32 border border-gray-300 rounded-lg px-2 py-1 text-sm"
                  />
                  <button onClick={handleOdometerSave} className="text-xs bg-emerald-500 text-white px-3 py-1 rounded-lg hover:bg-emerald-600">Save</button>
                  <button onClick={() => setEditingOdo(false)} className="text-xs text-gray-500 hover:text-gray-700">Cancel</button>
                </div>
              ) : (
                <p className="font-semibold text-gray-900 text-lg">{odometer.toLocaleString()} mi</p>
              )}
            </div>
            {!editingOdo && (
              <button onClick={() => setEditingOdo(true)} className="text-xs text-emerald-600 hover:text-emerald-700 font-medium">Update</button>
            )}
          </div>

          {/* Run Analysis Button */}
          <div className="flex justify-between items-center">
            <p className="text-sm font-medium text-gray-700">
              {recommendations.length > 0
                ? `${recommendations.length} recommendation${recommendations.length !== 1 ? "s" : ""}`
                : "No pending recommendations"}
            </p>
            <button
              onClick={handleRunAnalysis}
              disabled={analyzing}
              className="text-xs bg-teal-50 text-teal-700 border border-teal-200 px-3 py-1.5 rounded-lg hover:bg-teal-100 font-medium"
            >
              {analyzing ? "Analyzing..." : "Run Analysis Now"}
            </button>
          </div>

          {/* Recommendations */}
          {analyzing && (
            <div className="text-center py-6 text-gray-500">
              <p className="text-2xl mb-2">🔍</p>
              <p className="text-sm">Hitch is analyzing your service history...</p>
            </div>
          )}

          {!analyzing && recommendations.map(rec => {
            const style = URGENCY_STYLES[rec.urgency] || URGENCY_STYLES.normal;
            const dueDate = rec.recommendedDate ? new Date(rec.recommendedDate).toLocaleDateString() : null;
            const dueMiles = rec.recommendedMileage ? rec.recommendedMileage.toLocaleString() + " mi" : null;

            return (
              <div key={rec.id} className={`border rounded-xl p-4 ${style.bg}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span>{style.icon}</span>
                      <span className="font-semibold text-gray-900 text-sm">{rec.serviceType}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${style.text} bg-white bg-opacity-70`}>
                        {style.label}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 mb-2">{rec.aiReason}</p>
                    {(dueDate || dueMiles) && (
                      <p className="text-xs text-gray-500">
                        Due: {[dueDate, dueMiles].filter(Boolean).join(" or ")}
                      </p>
                    )}
                  </div>
                </div>

                {scheduleId === rec.id ? (
                  <div className="mt-3 flex items-center gap-2">
                    <input
                      type="date"
                      value={scheduleDate}
                      onChange={e => setScheduleDate(e.target.value)}
                      className="border border-gray-300 rounded-lg px-2 py-1 text-xs flex-1"
                    />
                    <button onClick={() => handleSchedule(rec.id)} className="text-xs bg-emerald-500 text-white px-3 py-1.5 rounded-lg hover:bg-emerald-600">Confirm</button>
                    <button onClick={() => setScheduleId(null)} className="text-xs text-gray-500">Cancel</button>
                  </div>
                ) : (
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => setScheduleId(rec.id)}
                      className="flex-1 text-xs bg-white border border-gray-200 text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-50 font-medium"
                    >
                      Schedule Service
                    </button>
                    <button
                      onClick={() => handleDismiss(rec.id)}
                      className="text-xs text-gray-400 hover:text-gray-600 px-2"
                    >
                      Dismiss
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
