import { useEffect, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Circle,
  CircleMarker,
  Popup,
  useMap,
} from "react-leaflet";
import { BookmarkCheck, Loader2, Save, ShieldCheck, Trash2 } from "lucide-react";
import {
  deleteSavedPrediction,
  getLocations,
  getSavedPredictions,
  predictFlood,
  savePrediction,
} from "../api/client";
import PlaceSearchInput from "../components/PlaceSearchInput";

const FEATURE_META = {
  rainfall_3d_mm: { label: "3-Day Cumulative Rainfall", unit: "mm" },
  rainfall_7d_mm: { label: "7-Day Cumulative Rainfall", unit: "mm" },
  rainfall_14d_mm: { label: "14-Day Cumulative Rainfall", unit: "mm" },
  mean_temp_c: { label: "Mean Temperature", unit: "°C" },
  elevation_m: { label: "Ground Elevation", unit: "m" },
  river_distance_km: { label: "Nearest River / Coast Distance", unit: "km" },
  population_density: { label: "Population Density", unit: "people/km²" },
};

function formatFeatureValue(key, val) {
  const num = Number(val);
  if (Number.isNaN(num)) return val;
  if (key === "population_density") return num.toLocaleString();
  if (Number.isInteger(num)) return num;
  return num.toFixed(2);
}

function getHeatColor(riskLevel, score) {
  if (riskLevel === "High" || riskLevel === "Critical" || score >= 50) {
    return { color: "#dc2626", label: "Alert (High / Critical)" };
  }
  if (riskLevel === "Moderate" || score >= 30) {
    return { color: "#eab308", label: "Moderate" };
  }
  return { color: "#22c55e", label: "Low" };
}

function PredictMapSync({ lat, lon }) {
  const map = useMap();

  useEffect(() => {
    map.invalidateSize();
  }, [map]);

  useEffect(() => {
    map.setView([lat, lon], 13, { animate: true });
  }, [map, lat, lon]);

  return null;
}

export default function Predict() {
  const [locations, setLocations] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [placeLabel, setPlaceLabel] = useState("");
  const [latitude, setLatitude] = useState("22.5958");
  const [longitude, setLongitude] = useState("88.2636");
  const [extraRainfall, setExtraRainfall] = useState(0);
  const [result, setResult] = useState(null);
  const [savedList, setSavedList] = useState([]);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getLocations()
      .then((data) => {
        setLocations(data);
        if (data.length > 0) {
          setSelectedId(data[0].location_id);
          setPlaceLabel(data[0].name);
          setLatitude(String(data[0].latitude));
          setLongitude(String(data[0].longitude));
        }
      })
      .catch(() => {});
    getSavedPredictions()
      .then((rows) => setSavedList(rows))
      .catch(() => {});
  }, []);

  const handleSelectLocation = (id) => {
    setSelectedId(id);
    const loc = locations.find((l) => l.location_id === id);
    if (loc) {
      setPlaceLabel(loc.name);
      setLatitude(String(loc.latitude));
      setLongitude(String(loc.longitude));
    } else {
      setPlaceLabel("");
    }
  };

  const runPredictionRequest = async (payload) => {
    setLoading(true);
    setError("");
    setJustSaved(false);
    try {
      const res = await predictFlood(payload);
      setResult({
        ...res,
        simulated_extra_mm: payload.extra_rainfall_mm || 0,
      });
    } catch (err) {
      setError(
        err?.response?.data?.detail || err?.message || "Prediction failed."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    await runPredictionRequest({
      location_id: selectedId || null,
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      extra_rainfall_mm: extraRainfall,
    });
  };

  const handlePlaceSelect = async (place) => {
    setSelectedId("");
    setPlaceLabel(place.label || place.name);
    setLatitude(String(place.latitude));
    setLongitude(String(place.longitude));
    await runPredictionRequest({
      location_id: null,
      latitude: place.latitude,
      longitude: place.longitude,
      extra_rainfall_mm: extraRainfall,
    });
  };

  const handleSimRainfallChange = async (val) => {
    const mm = Number(val);
    setExtraRainfall(mm);
    await runPredictionRequest({
      location_id: selectedId || null,
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      extra_rainfall_mm: mm,
    });
  };

  const handleSave = async () => {
    if (!result || saving || (result.simulated_extra_mm || 0) > 0) return;
    setSaving(true);
    try {
      const saved = await savePrediction({
        location_id: result.location_id || null,
        location_name:
          placeLabel ||
          result.location_id ||
          `${result.latitude.toFixed(4)}, ${result.longitude.toFixed(4)}`,
        latitude: result.latitude,
        longitude: result.longitude,
        anomaly_risk_score: result.anomaly_risk_score,
        risk_level: result.risk_level,
        zone_color: result.zone_color,
        features: result.features || {},
      });
      setSavedList((prev) => [saved, ...prev]);
      setJustSaved(true);
    } catch (err) {
      setError(
        err?.response?.data?.detail || err?.message || "Failed to save."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSaved = async (id) => {
    try {
      await deleteSavedPrediction(id);
      setSavedList((prev) => prev.filter((item) => item.id !== id));
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">
          Live Flood Risk Prediction
        </h2>
        <p className="text-sm text-slate-400">
          Run real-time flood risk scoring using Open-Meteo weather, Open-Elevation, and Overpass river proximity
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <form
          onSubmit={handleSubmit}
          className="p-6 rounded-xl bg-slate-900 border border-slate-800 space-y-4"
        >
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Preset Location (optional)
            </label>
            <select
              value={selectedId}
              onChange={(e) => handleSelectLocation(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-sky-500"
            >
              <option value="">Custom Coordinates</option>
              {locations.map((loc) => (
                <option key={loc.location_id} value={loc.location_id}>
                  {loc.location_id} — {loc.name} ({loc.district})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Search Area or City (OR enter coordinates below)
            </label>
            <PlaceSearchInput
              placeholder="e.g. Salt Lake, Mumbai, Guwahati..."
              onSelect={handlePlaceSelect}
            />
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span className="h-px flex-1 bg-slate-800" />
            <span>OR</span>
            <span className="h-px flex-1 bg-slate-800" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Latitude
              </label>
              <input
                type="number"
                step="any"
                required
                value={latitude}
                onChange={(e) => {
                  setSelectedId("");
                  setLatitude(e.target.value);
                }}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-sky-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Longitude
              </label>
              <input
                type="number"
                step="any"
                required
                value={longitude}
                onChange={(e) => {
                  setSelectedId("");
                  setLongitude(e.target.value);
                }}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>

          <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-slate-300">
                Cloudburst / Monsoon Stress Simulator
              </span>
              <span className="font-mono font-semibold text-sky-400">
                {extraRainfall === 0 ? "Live" : `+${extraRainfall} mm`}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="300"
              step="10"
              value={extraRainfall}
              onChange={(e) => setExtraRainfall(Number(e.target.value))}
              onMouseUp={(e) => handleSimRainfallChange(e.target.value)}
              onTouchEnd={(e) => handleSimRainfallChange(e.target.value)}
              className="w-full accent-sky-500 cursor-pointer"
            />
            <div className="flex items-center justify-between gap-2 text-[11px]">
              {[0, 100, 250].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => handleSimRainfallChange(preset)}
                  className={`flex-1 py-1 rounded border transition-colors cursor-pointer ${
                    extraRainfall === preset
                      ? "bg-sky-500/20 border-sky-500/50 text-sky-300"
                      : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white"
                  }`}
                >
                  {preset === 0
                    ? "Live"
                    : preset === 100
                    ? "Heavy (+100 mm)"
                    : "Cloudburst (+250 mm)"}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-sm font-semibold text-white transition-colors cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Analyzing Live Features...</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                <span>Predict Flood Risk</span>
              </>
            )}
          </button>
        </form>

        <div className="p-6 rounded-xl bg-slate-900 border border-slate-800">
          {result ? (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wider">
                    Risk Assessment
                  </p>
                  <h3 className="text-3xl font-bold text-white mt-1">
                    {result.anomaly_risk_score}{" "}
                    <span className="text-sm font-normal text-slate-400">
                      / 100
                    </span>
                  </h3>
                </div>
                <div className="flex items-center gap-2.5">
                  <span
                    className="px-3.5 py-1.5 rounded-full text-sm font-semibold"
                    style={{
                      backgroundColor: `${result.zone_color}22`,
                      color: result.zone_color,
                      border: `1px solid ${result.zone_color}55`,
                    }}
                  >
                    {result.risk_level}
                  </span>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={
                      saving || justSaved || (result.simulated_extra_mm || 0) > 0
                    }
                    title={
                      (result.simulated_extra_mm || 0) > 0
                        ? "Only live data can be saved (reset simulator to Live)"
                        : "Save live risk assessment"
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed border border-slate-700 text-xs font-medium text-white transition-colors cursor-pointer"
                  >
                    {justSaved ? (
                      <>
                        <BookmarkCheck className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-300">Saved</span>
                      </>
                    ) : (result.simulated_extra_mm || 0) > 0 ? (
                      <>
                        <Save className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-slate-400">Live Only</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-3.5 h-3.5 text-sky-400" />
                        <span>{saving ? "Saving..." : "Save"}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                {Object.entries(result.features || {}).map(([key, val]) => {
                  const meta = FEATURE_META[key] || {
                    label: key.replace(/_/g, " "),
                    unit: "",
                  };
                  return (
                    <div
                      key={key}
                      className="p-3 rounded-lg bg-slate-950 border border-slate-800"
                    >
                      <p className="text-xs text-slate-400">{meta.label}</p>
                      <p className="font-semibold text-white mt-0.5">
                        {formatFeatureValue(key, val)}
                        {meta.unit ? (
                          <span className="text-xs font-normal text-slate-400 ml-1">
                            {meta.unit}
                          </span>
                        ) : null}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-sm text-slate-500 py-12">
              Submit coordinates or select a location to run prediction.
            </div>
          )}
        </div>
      </div>

      {result && (() => {
        const heat = getHeatColor(
          result.risk_level,
          result.anomaly_risk_score
        );
        return (
          <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-200">
                  Flood-Affected Area Heatmap (2–3 km Radius)
                </h3>
                <p className="text-xs text-slate-400">
                  Centered at ({result.latitude}, {result.longitude}) · Status:{" "}
                  <span style={{ color: heat.color }} className="font-semibold">
                    {heat.label}
                  </span>
                </p>
              </div>
              <div className="flex items-center gap-4 text-xs text-slate-300">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#22c55e]" />
                  Low
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#eab308]" />
                  Moderate
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#dc2626]" />
                  Alert
                </span>
              </div>
            </div>

            <div className="h-80 w-full rounded-xl overflow-hidden bg-slate-950">
              <MapContainer
                center={[result.latitude, result.longitude]}
                zoom={13}
                scrollWheelZoom={true}
              >
                <PredictMapSync lat={result.latitude} lon={result.longitude} />
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <Circle
                  center={[result.latitude, result.longitude]}
                  radius={3000}
                  pathOptions={{
                    color: heat.color,
                    weight: 1.5,
                    dashArray: "5 5",
                    fillColor: heat.color,
                    fillOpacity: 0.14,
                  }}
                />
                <Circle
                  center={[result.latitude, result.longitude]}
                  radius={2000}
                  pathOptions={{
                    color: heat.color,
                    weight: 1.5,
                    fillColor: heat.color,
                    fillOpacity: 0.24,
                  }}
                />
                <Circle
                  center={[result.latitude, result.longitude]}
                  radius={1000}
                  pathOptions={{
                    color: heat.color,
                    weight: 1,
                    fillColor: heat.color,
                    fillOpacity: 0.36,
                  }}
                />
                <CircleMarker
                  center={[result.latitude, result.longitude]}
                  radius={8}
                  pathOptions={{
                    color: "#ffffff",
                    weight: 2,
                    fillColor: heat.color,
                    fillOpacity: 1,
                  }}
                >
                  <Popup>
                    <div className="text-slate-900 text-xs space-y-1">
                      <p className="font-bold">Predicted Impact Zone (2–3 km)</p>
                      <p>Risk Level: {result.risk_level}</p>
                      <p>Score: {result.anomaly_risk_score} / 100</p>
                    </div>
                  </Popup>
                </CircleMarker>
              </MapContainer>
            </div>
          </div>
        );
      })()}
      {savedList.length > 0 && (
        <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
          <h3 className="text-sm font-semibold text-slate-200">
            Saved Risk Assessments ({savedList.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {savedList.map((item) => (
              <div
                key={item.id}
                className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 flex items-start justify-between gap-3"
              >
                <div className="min-w-0 space-y-1">
                  <p className="text-sm font-medium text-white truncate">
                    {item.location_name}
                  </p>
                  <p className="text-xs text-slate-400">
                    ({item.latitude.toFixed(4)}, {item.longitude.toFixed(4)})
                  </p>
                  <div className="flex items-center gap-2 pt-0.5">
                    <span
                      className="px-2 py-0.5 rounded-full text-xs font-semibold"
                      style={{
                        backgroundColor: `${item.zone_color}22`,
                        color: item.zone_color,
                      }}
                    >
                      {item.risk_level} ({item.anomaly_risk_score})
                    </span>
                    <span className="text-[11px] text-slate-500">
                      {new Date(item.created_at).toLocaleString()}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteSaved(item.id)}
                  title="Delete saved assessment"
                  className="text-slate-500 hover:text-rose-400 transition-colors cursor-pointer shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
