import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import { AlertTriangle, Compass, RefreshCw, Waves } from "lucide-react";
import { getLiveAlerts } from "../api/client";

function AlertsMapSync({ alerts, selectedAlert }) {
  const map = useMap();

  useEffect(() => {
    map.invalidateSize();
  }, [map]);

  useEffect(() => {
    if (selectedAlert) {
      map.setView([selectedAlert.latitude, selectedAlert.longitude], 11, {
        animate: true,
      });
      return;
    }
    if (alerts.length > 0) {
      const bounds = alerts.map((a) => [a.latitude, a.longitude]);
      map.fitBounds(bounds, { padding: [45, 45], maxZoom: 10 });
    } else {
      map.setView([23.5, 86.5], 5);
    }
  }, [map, alerts, selectedAlert]);

  return null;
}

export default function LiveAlerts() {
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState([]);
  const [totalMonitored, setTotalMonitored] = useState(0);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadAlerts = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getLiveAlerts();
      setAlerts(data.alerts || []);
      setTotalMonitored(data.total_monitored || 0);
    } catch (err) {
      setError(
        err?.response?.data?.detail ||
          err?.message ||
          "Failed to fetch live flood alerts."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAlerts();
  }, []);

  const handleFindRelocation = (e, alert) => {
    e.stopPropagation();
    navigate("/relocation", {
      state: {
        latitude: alert.latitude,
        longitude: alert.longitude,
        name: alert.name,
      },
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <span>Live Red Alerts</span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/20 text-rose-400 border border-rose-500/40">
              {alerts.length} Active
            </span>
          </h2>
          <p className="text-sm text-slate-400">
            Active or imminent Red Alert river basins across {totalMonitored} monitored Indian cities
          </p>
        </div>

        <button
          onClick={loadAlerts}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-sm font-medium text-white transition-colors cursor-pointer"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          <span>Refresh Alerts</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col">
          <h3 className="text-sm font-semibold text-slate-200 mb-3">
            Red Alert Zones
          </h3>

          <div className="max-h-[34rem] overflow-y-auto space-y-3 pr-1">
            {loading ? (
              <p className="text-sm text-slate-400 py-8 text-center">
                Scanning river basins...
              </p>
            ) : alerts.length === 0 ? (
              <div className="p-5 rounded-xl bg-slate-950 border border-slate-800 text-center space-y-2">
                <AlertTriangle className="w-6 h-6 text-emerald-400 mx-auto" />
                <p className="text-sm font-medium text-white">
                  No Active Red Alerts
                </p>
                <p className="text-xs text-slate-400">
                  All monitored Indian river basins are currently below Red Alert discharge and risk thresholds.
                </p>
              </div>
            ) : (
              alerts.map((alert) => {
                const isSelected = selectedAlert?.id === alert.id;
                return (
                  <div
                    key={alert.id}
                    onClick={() => setSelectedAlert(alert)}
                    className={`p-4 rounded-xl bg-slate-950 border transition-colors cursor-pointer space-y-3 ${
                      isSelected
                        ? "border-rose-500 bg-rose-500/10"
                        : "border-rose-500/30 hover:border-rose-500/70"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-sm font-bold text-white">
                        {alert.name}
                      </h4>
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/20 text-rose-400 shrink-0">
                        RED ALERT
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                        <div className="flex items-center gap-1 text-slate-400">
                          <Waves className="w-3.5 h-3.5 text-sky-400" />
                          <span>River Discharge</span>
                        </div>
                        <p className="mt-1 font-semibold text-white">
                          {alert.river_discharge} m³/s
                        </p>
                      </div>

                      <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                        <span className="text-slate-400">Risk Score</span>
                        <p className="mt-1 font-semibold text-rose-400">
                          {alert.risk_score} / 100
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => handleFindRelocation(e, alert)}
                      className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white transition-colors cursor-pointer"
                    >
                      <Compass className="w-3.5 h-3.5" />
                      <span>Find Safe Relocation</span>
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="lg:col-span-2 p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col">
          <h3 className="text-sm font-semibold text-slate-200 mb-3">
            Active Red Alert Basin Map
          </h3>
          <div className="h-[34rem] w-full rounded-xl overflow-hidden bg-slate-950">
            <MapContainer center={[23.5, 86.5]} zoom={5} scrollWheelZoom={true}>
              <AlertsMapSync alerts={alerts} selectedAlert={selectedAlert} />
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {alerts.map((alert) => (
                <CircleMarker
                  key={`pulse-${alert.id}`}
                  center={[alert.latitude, alert.longitude]}
                  radius={20}
                  className="pulse-red-marker"
                  pathOptions={{
                    color: "#ef4444",
                    weight: 2,
                    fillColor: "#ef4444",
                    fillOpacity: 0.3,
                  }}
                />
              ))}
              {alerts.map((alert) => (
                <CircleMarker
                  key={alert.id}
                  center={[alert.latitude, alert.longitude]}
                  radius={9}
                  pathOptions={{
                    color: "#ffffff",
                    weight: 2,
                    fillColor: "#dc2626",
                    fillOpacity: 0.95,
                  }}
                >
                  <Popup>
                    <div className="text-slate-900 text-xs space-y-1">
                      <p className="font-bold">{alert.name}</p>
                      <p>Discharge: {alert.river_discharge} m³/s</p>
                      <p>Risk Score: {alert.risk_score} / 100</p>
                      <p className="text-rose-700 font-medium">
                        {alert.trigger_reason}
                      </p>
                    </div>
                  </Popup>
                </CircleMarker>
              ))}
            </MapContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
