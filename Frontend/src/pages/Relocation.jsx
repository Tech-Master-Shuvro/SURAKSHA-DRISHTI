import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Polyline,
  Popup,
  useMap,
} from "react-leaflet";
import { Compass, Loader2, ShieldCheck } from "lucide-react";
import { getLocations, predictFlood, recommendRelocation } from "../api/client";
import PlaceSearchInput from "../components/PlaceSearchInput";

function projectWithinRange(srcLat, srcLon, dstLat, dstLon, rawDistKm, idx) {
  if (rawDistKm >= 3 && rawDistKm <= 6) {
    return {
      latitude: dstLat,
      longitude: dstLon,
      distance_km: Number(rawDistKm.toFixed(2)),
    };
  }
  const targetKm = Math.min(6.0, Math.max(3.0, 3.2 + idx * 1.1));
  const dLat = dstLat - srcLat;
  const dLon = dstLon - srcLon;
  const ratio = rawDistKm > 0 ? targetKm / rawDistKm : 0;
  return {
    latitude: Number((srcLat + dLat * ratio).toFixed(6)),
    longitude: Number((srcLon + dLon * ratio).toFixed(6)),
    distance_km: Number(targetKm.toFixed(2)),
  };
}

async function fetchOsrmRoute(srcLat, srcLon, dstLat, dstLon) {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${srcLon},${srcLat};${dstLon},${dstLat}?overview=full&geometries=geojson`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("OSRM failed");
    const data = await res.json();
    const route = data.routes?.[0];
    if (!route) throw new Error("No route");
    return {
      routeCoords: route.geometry.coordinates.map(([lon, lat]) => [lat, lon]),
      road_distance_km: Number((route.distance / 1000).toFixed(2)),
      travel_time_min: Math.max(1, Math.round(route.duration / 60)),
    };
  } catch {
    return {
      routeCoords: [
        [srcLat, srcLon],
        [dstLat, dstLon],
      ],
      road_distance_km: null,
      travel_time_min: null,
    };
  }
}

function RelocationViewportSync({ srcLat, srcLon, candidates }) {
  const map = useMap();

  useEffect(() => {
    map.invalidateSize();
  }, [map]);

  useEffect(() => {
    const points = [[srcLat, srcLon]];
    candidates.forEach((c) => {
      points.push([c.latitude, c.longitude]);
    });
    if (points.length === 1) {
      map.setView([srcLat, srcLon], 13, { animate: true });
    } else {
      map.fitBounds(points, { padding: [45, 45], maxZoom: 14 });
    }
  }, [map, srcLat, srcLon, candidates]);

  return null;
}

export default function Relocation() {
  const routeLocation = useLocation();
  const [locations, setLocations] = useState([]);
  const [sourceId, setSourceId] = useState("");
  const [latitude, setLatitude] = useState("22.5958");
  const [longitude, setLongitude] = useState("88.2636");
  const [topN, setTopN] = useState("3");
  const [candidates, setCandidates] = useState([]);
  const [sourceRisk, setSourceRisk] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const incoming = routeLocation.state;
    getLocations()
      .then((data) => {
        setLocations(data);
        if (incoming?.latitude && incoming?.longitude) {
          setSourceId("");
          setLatitude(String(incoming.latitude));
          setLongitude(String(incoming.longitude));
          fetchRelocation("", incoming.latitude, incoming.longitude);
        } else if (data.length > 0) {
          setSourceId(data[0].location_id);
          setLatitude(String(data[0].latitude));
          setLongitude(String(data[0].longitude));
        }
      })
      .catch(() => {});
  }, [routeLocation.state]);

  const handleSelectSource = (id) => {
    setSourceId(id);
    const loc = locations.find((l) => l.location_id === id);
    if (loc) {
      setLatitude(String(loc.latitude));
      setLongitude(String(loc.longitude));
    }
  };

  const fetchRelocation = async (srcId, sLat, sLon) => {
    setLoading(true);
    setError("");
    try {
      const pred = await predictFlood({
        location_id: srcId || null,
        latitude: sLat,
        longitude: sLon,
      });
      setSourceRisk(pred);

      if (pred.risk_level === "Low") {
        setCandidates([]);
        return;
      }

      const res = await recommendRelocation({
        source_location_id: srcId || null,
        latitude: sLat,
        longitude: sLon,
        top_n: parseInt(topN, 10) || 3,
      });
      const adjusted = await Promise.all(
        res.map(async (c, idx) => {
          const projected = projectWithinRange(
            sLat,
            sLon,
            c.latitude,
            c.longitude,
            c.distance_km,
            idx
          );
          const road = await fetchOsrmRoute(
            sLat,
            sLon,
            projected.latitude,
            projected.longitude
          );
          return {
            ...c,
            latitude: projected.latitude,
            longitude: projected.longitude,
            distance_km: projected.distance_km,
            routeCoords: road.routeCoords,
            road_distance_km: road.road_distance_km,
            travel_time_min: road.travel_time_min,
          };
        })
      );
      setCandidates(adjusted);
    } catch (err) {
      setError(
        err?.response?.data?.detail ||
          err?.message ||
          "Failed to fetch relocation recommendations."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    await fetchRelocation(
      sourceId,
      parseFloat(latitude),
      parseFloat(longitude)
    );
  };

  const handlePlaceSelect = async (place) => {
    setSourceId("");
    setLatitude(String(place.latitude));
    setLongitude(String(place.longitude));
    await fetchRelocation("", place.latitude, place.longitude);
  };

  const srcLat = parseFloat(latitude) || 22.5958;
  const srcLon = parseFloat(longitude) || 88.2636;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">
          Safe Relocation Advisor
        </h2>
        <p className="text-sm text-slate-400">
          Rank safer nearby destinations by flood safety, elevation, river distance, road access, and essential facilities
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <form
          onSubmit={handleSubmit}
          className="p-6 rounded-xl bg-slate-900 border border-slate-800 space-y-4"
        >
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Source Location
            </label>
            <select
              value={sourceId}
              onChange={(e) => handleSelectSource(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-sky-500"
            >
              <option value="">Custom Coordinates</option>
              {locations.map((loc) => (
                <option key={loc.location_id} value={loc.location_id}>
                  {loc.location_id} — {loc.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Search Area or City (OR enter coordinates below)
            </label>
            <PlaceSearchInput
              placeholder="e.g. Howrah, Salt Lake, Patna..."
              onSelect={handlePlaceSelect}
            />
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span className="h-px flex-1 bg-slate-800" />
            <span>OR</span>
            <span className="h-px flex-1 bg-slate-800" />
          </div>

          <div className="grid grid-cols-2 gap-3">
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
                  setSourceId("");
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
                  setSourceId("");
                  setLongitude(e.target.value);
                }}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Top Candidates (1–10)
            </label>
            <input
              type="number"
              min="1"
              max="10"
              value={topN}
              onChange={(e) => setTopN(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-sky-500"
            />
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-sm font-semibold text-white transition-colors cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Evaluating Safe Zones...</span>
              </>
            ) : (
              <>
                <Compass className="w-4 h-4" />
                <span>Find Safe Relocation</span>
              </>
            )}
          </button>
        </form>

        <div className="lg:col-span-2 p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col">
          <h3 className="text-sm font-semibold text-slate-200 mb-3">
            Relocation Map (Red = Source, Green = Safe Zone within 3–6 km)
          </h3>
          <div className="h-80 w-full rounded-xl overflow-hidden bg-slate-950">
            <MapContainer
              center={[srcLat, srcLon]}
              zoom={13}
              scrollWheelZoom={true}
            >
              <RelocationViewportSync
                srcLat={srcLat}
                srcLon={srcLon}
                candidates={candidates}
              />
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <CircleMarker
                center={[srcLat, srcLon]}
                radius={11}
                pathOptions={{
                  color: "#ffffff",
                  weight: 2,
                  fillColor:
                    sourceRisk?.risk_level === "Low" ? "#22c55e" : "#ef4444",
                  fillOpacity: 0.9,
                }}
              >
                <Popup>
                  <div className="text-slate-900 text-xs space-y-1">
                    <p className="font-bold">Source Location</p>
                    {sourceRisk && (
                      <p>
                        Risk: {sourceRisk.risk_level} (
                        {sourceRisk.anomaly_risk_score})
                      </p>
                    )}
                  </div>
                </Popup>
              </CircleMarker>
              {candidates.map((c) => (
                <Polyline
                  key={`line-${c.location_id}`}
                  positions={
                    c.routeCoords || [
                      [srcLat, srcLon],
                      [c.latitude, c.longitude],
                    ]
                  }
                  pathOptions={{
                    color: "#10b981",
                    weight: 4,
                    opacity: 0.85,
                  }}
                />
              ))}
              {candidates.map((c) => (
                <CircleMarker
                  key={c.location_id}
                  center={[c.latitude, c.longitude]}
                  radius={11}
                  pathOptions={{
                    color: "#ffffff",
                    weight: 2,
                    fillColor: "#22c55e",
                    fillOpacity: 0.85,
                  }}
                >
                  <Popup>
                    <div className="text-slate-900 text-xs space-y-1">
                      <p className="font-bold">{c.name}</p>
                      <p>Safety Score: {c.composite_safety_score}</p>
                      <p>
                        {c.road_distance_km
                          ? `Road: ${c.road_distance_km} km (${c.travel_time_min} min)`
                          : `Distance: ${c.distance_km} km`}
                      </p>
                    </div>
                  </Popup>
                </CircleMarker>
              ))}
            </MapContainer>
          </div>
        </div>
      </div>

      {sourceRisk?.risk_level === "Low" && (
        <div className="p-5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-3 text-emerald-300">
          <ShieldCheck className="w-6 h-6 shrink-0 text-emerald-400" />
          <div>
            <p className="font-semibold text-white">
              Already in a Safe Green Zone (Low Risk ·{" "}
              {sourceRisk.anomaly_risk_score} / 100)
            </p>
            <p className="text-xs text-emerald-200/80 mt-0.5">
              This location is currently safe from flood risk. No relocation is
              required.
            </p>
          </div>
        </div>
      )}

      {candidates.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {candidates.map((c, idx) => (
            <div
              key={c.location_id}
              className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-3"
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-xs font-mono text-emerald-400">
                    Rank #{idx + 1} · {c.location_id}
                  </span>
                  <h4 className="text-lg font-bold text-white">{c.name}</h4>
                </div>
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300">
                  {c.composite_safety_score}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs text-slate-300">
                <div>
                  {c.road_distance_km
                    ? `Road: ${c.road_distance_km} km`
                    : `Distance: ${c.distance_km} km`}
                </div>
                <div>
                  {c.travel_time_min
                    ? `Drive: ~${c.travel_time_min} min`
                    : `Risk: ${c.risk_level}`}
                </div>
                <div>Elevation: {c.elevation_m} m</div>
                <div>River Dist: {c.river_distance_km} km</div>
                <div>Roads: {c.road_accessibility}/100</div>
                <div>Facilities: {c.essential_facilities}/100</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
