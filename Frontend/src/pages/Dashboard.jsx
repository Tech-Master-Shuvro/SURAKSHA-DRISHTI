import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import {
  AlertTriangle,
  CloudRain,
  Droplets,
  MapPinned,
  RefreshCw,
  Thermometer,
  Trash2,
} from "lucide-react";
import {
  deleteSavedPrediction,
  getLocations,
  getRiskZones,
  getWeather,
  getFloodHistory,
} from "../api/client";

function MapViewportSync({ zones, selectedLoc }) {
  const map = useMap();

  useEffect(() => {
    map.invalidateSize();
  }, [map]);

  useEffect(() => {
    if (selectedLoc) {
      map.setView([selectedLoc.latitude, selectedLoc.longitude], 12, {
        animate: true,
      });
      return;
    }
    if (zones.length > 0) {
      const bounds = zones.map((z) => [z.latitude, z.longitude]);
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 });
    }
  }, [map, zones, selectedLoc]);

  return null;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [locations, setLocations] = useState([]);
  const [zones, setZones] = useState([]);
  const [selectedLoc, setSelectedLoc] = useState(null);
  const [weather, setWeather] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState("");

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const [locs, riskZones] = await Promise.all([
        getLocations(),
        getRiskZones(),
      ]);
      setLocations(locs);
      setZones(riskZones);
      if (locs.length > 0 && !selectedLoc) {
        inspectLocation(locs[0]);
      }
    } catch (err) {
      setError(
        err?.response?.data?.detail ||
          err?.message ||
          "Failed to load data from backend API."
      );
    } finally {
      setLoading(false);
    }
  };

  const inspectLocation = async (loc) => {
    setSelectedLoc(loc);
    setDetailLoading(true);
    try {
      const [w, h] = await Promise.all([
        getWeather(loc.latitude, loc.longitude),
        getFloodHistory(loc.location_id),
      ]);
      setWeather(w);
      setHistory(h);
    } catch {
      setWeather(null);
      setHistory([]);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleDeleteSavedLocation = async (e, loc) => {
    e.stopPropagation();
    const recId = loc.saved_id;
    if (!recId) return;
    try {
      await deleteSavedPrediction(recId);
      if (selectedLoc?.location_id === loc.location_id) {
        setSelectedLoc(null);
      }
      await loadData();
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const highRiskCount = zones.filter(
    (z) => z.risk_level === "Critical" || z.risk_level === "High"
  ).length;
  const avgScore =
    zones.length > 0
      ? (
          zones.reduce((sum, z) => sum + z.anomaly_risk_score, 0) / zones.length
        ).toFixed(1)
      : "0.0";

  const center =
    zones.length > 0
      ? [zones[0].latitude, zones[0].longitude]
      : [22.5958, 88.2636];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">
            Regional Flood Risk Overview
          </h2>
          <p className="text-sm text-slate-400">
            Live weather-driven risk assessment across monitored locations
          </p>
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-sm font-medium text-white transition-colors cursor-pointer"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          <span>Refresh Live Data</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 text-sm">
            <span>Monitored Locations</span>
            <MapPinned className="w-4 h-4 text-sky-400" />
          </div>
          <p className="mt-2 text-3xl font-bold text-white">
            {locations.length}
          </p>
        </div>

        <div
          onClick={() => navigate("/alerts")}
          className="p-5 rounded-xl bg-slate-900 border border-slate-800 hover:border-rose-500/50 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-slate-400 text-sm">
            <span>High / Critical Zones</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <p className="mt-2 text-3xl font-bold text-white">{highRiskCount}</p>
        </div>

        <div className="p-5 rounded-xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 text-sm">
            <span>Average Risk Score</span>
            <Droplets className="w-4 h-4 text-cyan-400" />
          </div>
          <p className="mt-2 text-3xl font-bold text-white">{avgScore}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col">
          <h3 className="text-sm font-semibold text-slate-200 mb-3">
            Live Risk Zone Map
          </h3>
          <div className="h-80 w-full rounded-xl overflow-hidden bg-slate-950">
            <MapContainer center={center} zoom={10} scrollWheelZoom={true}>
              <MapViewportSync zones={zones} selectedLoc={selectedLoc} />
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {zones.map((zone) => {
                const isSelected =
                  selectedLoc?.location_id === zone.location_id;
                return (
                  <CircleMarker
                    key={zone.location_id}
                    center={[zone.latitude, zone.longitude]}
                    radius={isSelected ? 15 : 11}
                    pathOptions={{
                      color: isSelected ? "#ffffff" : zone.zone_color,
                      weight: isSelected ? 3 : 2,
                      fillColor: zone.zone_color,
                      fillOpacity: 0.8,
                    }}
                  >
                    <Popup>
                      <div className="text-slate-900 text-xs space-y-1">
                        <p className="font-bold">{zone.name}</p>
                        <p>Risk Level: {zone.risk_level}</p>
                        <p>Score: {zone.anomaly_risk_score}</p>
                      </div>
                    </Popup>
                  </CircleMarker>
                );
              })}
            </MapContainer>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col">
          <h3 className="text-sm font-semibold text-slate-200 mb-3">
            Risk Score by Location
          </h3>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={zones}
                margin={{ top: 10, right: 10, left: -15, bottom: 20 }}
              >
                <XAxis
                  dataKey="location_id"
                  stroke="#94a3b8"
                  fontSize={12}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, 100]}
                  stroke="#94a3b8"
                  fontSize={12}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0f172a",
                    borderColor: "#334155",
                    borderRadius: "8px",
                    color: "#f8fafc",
                  }}
                />
                <Bar dataKey="anomaly_risk_score" radius={[6, 6, 0, 0]}>
                  {zones.map((z) => (
                    <Cell key={z.location_id} fill={z.zone_color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 p-4 rounded-xl bg-slate-900 border border-slate-800">
          <h3 className="text-sm font-semibold text-slate-200 mb-3">
            Monitored Locations (click a row for live weather &amp; history)
          </h3>
          <div className="max-h-72 overflow-y-auto overflow-x-auto pr-1">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-slate-900 z-10">
                <tr className="border-b border-slate-800 text-slate-400 text-xs uppercase">
                  <th className="py-2 pr-3">ID</th>
                  <th className="py-2 pr-3">Name</th>
                  <th className="py-2 pr-3">District / Region</th>
                  <th className="py-2 pr-3">Elev (m)</th>
                  <th className="py-2 pr-3">River (km)</th>
                  <th className="py-2 pr-3">Risk</th>
                </tr>
              </thead>
            <tbody className="divide-y divide-slate-800/70">
              {locations.map((loc) => {
                const z = zones.find(
                  (item) => item.location_id === loc.location_id
                );
                const isSelected =
                  selectedLoc?.location_id === loc.location_id;
                return (
                  <tr
                    key={loc.location_id}
                    onClick={() => inspectLocation(loc)}
                    className={`cursor-pointer transition-colors ${
                      isSelected ? "bg-sky-500/10" : "hover:bg-slate-800/50"
                    }`}
                  >
                    <td className="py-2.5 pr-3 font-mono text-xs text-sky-400">
                      {loc.location_id}
                    </td>
                    <td className="py-2.5 pr-3 font-medium text-white">
                      {loc.name}
                    </td>
                    <td className="py-2.5 pr-3 text-slate-300">
                      {loc.district}
                    </td>
                    <td className="py-2.5 pr-3 text-slate-300">
                      {Number(loc.elevation_m).toFixed(1).replace(/\.0$/, "")}
                    </td>
                    <td className="py-2.5 pr-3 text-slate-300">
                      {Number(loc.river_distance_km).toFixed(1).replace(/\.0$/, "")}
                    </td>
                    <td className="py-2.5 pr-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {z ? (
                          <span
                            className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap"
                            style={{
                              backgroundColor: `${z.zone_color}22`,
                              color: z.zone_color,
                            }}
                          >
                            {z.risk_level} ({z.anomaly_risk_score})
                          </span>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                        {loc.saved_id && (
                          <button
                            type="button"
                            onClick={(e) => handleDeleteSavedLocation(e, loc)}
                            title="Remove saved location"
                            className="text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            </table>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
          <h3 className="text-sm font-semibold text-slate-200">
            {selectedLoc
              ? `Live Telemetry: ${selectedLoc.name}`
              : "Select a location"}
          </h3>

          {detailLoading ? (
            <p className="text-sm text-slate-400">Fetching weather...</p>
          ) : weather ? (
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                <div className="flex items-center gap-1.5 text-slate-400 text-xs">
                  <Thermometer className="w-3.5 h-3.5 text-amber-400" />
                  <span>Current Temp</span>
                </div>
                <p className="mt-1 font-semibold text-white">
                  {weather.current_temp_c} °C
                </p>
              </div>
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                <div className="flex items-center gap-1.5 text-slate-400 text-xs">
                  <CloudRain className="w-3.5 h-3.5 text-sky-400" />
                  <span>3-Day Rain</span>
                </div>
                <p className="mt-1 font-semibold text-white">
                  {weather.rainfall_3d_mm} mm
                </p>
              </div>
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-slate-400 text-xs">7-Day Rain</span>
                <p className="mt-1 font-semibold text-white">
                  {weather.rainfall_7d_mm} mm
                </p>
              </div>
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-slate-400 text-xs">14-Day Rain</span>
                <p className="mt-1 font-semibold text-white">
                  {weather.rainfall_14d_mm} mm
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500">
              No live weather data available.
            </p>
          )}

          <div className="pt-2 border-t border-slate-800">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Flood History
            </h4>
            {history.length > 0 ? (
              <ul className="space-y-1.5 text-xs text-slate-300 max-h-36 overflow-y-auto">
                {history.map((item, idx) => (
                  <li
                    key={item.id || idx}
                    className="p-2 rounded bg-slate-950 border border-slate-800 flex items-center justify-between gap-2"
                  >
                    <div>
                      <span
                        className="font-semibold"
                        style={{ color: item.zone_color || "#38bdf8" }}
                      >
                        {item.risk_level || "Recorded"}
                      </span>{" "}
                      {item.anomaly_risk_score !== undefined
                        ? `(${item.anomaly_risk_score}/100)`
                        : ""}
                    </div>
                    <span className="text-[11px] text-slate-500">
                      {item.created_at
                        ? new Date(item.created_at).toLocaleDateString()
                        : ""}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-slate-500">
                No historical flood registry entries for this location.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
