import { useEffect, useRef, useState } from "react";
import { Loader2, MapPin, Search, X } from "lucide-react";

const GEOCODE_API_URL =
  import.meta.env.VITE_GEOCODE_API_URL || "https://photon.komoot.io/api/";

export default function PlaceSearchInput({
  placeholder = "Search area, locality, or city...",
  onSelect,
}) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `${GEOCODE_API_URL}?q=${encodeURIComponent(trimmed)}&limit=5`,
          { signal: controller.signal }
        );
        if (!res.ok) throw new Error("Photon failed");
        const data = await res.json();
        const items = (data.features || []).map((f, idx) => {
          const [lon, lat] = f.geometry.coordinates;
          const p = f.properties || {};
          const parts = [p.name, p.city || p.county, p.state, p.country].filter(
            Boolean
          );
          const uniqueParts = [...new Set(parts)];
          return {
            id: `${p.osm_id || idx}-${lat}-${lon}`,
            name: p.name || uniqueParts[0] || trimmed,
            label: uniqueParts.join(", "),
            latitude: Number(lat.toFixed(6)),
            longitude: Number(lon.toFixed(6)),
          };
        });
        setSuggestions(items);
        setOpen(true);
      } catch (err) {
        if (err.name !== "AbortError") {
          setSuggestions([]);
        }
      } finally {
        setLoading(false);
      }
    }, 350);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const handlePick = (item) => {
    setQuery(item.label || item.name);
    setOpen(false);
    onSelect(item);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && suggestions.length > 0) {
      e.preventDefault();
      handlePick(suggestions[0]);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative flex items-center">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full pl-9 pr-9 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
        />
        {loading ? (
          <Loader2 className="w-4 h-4 text-sky-400 animate-spin absolute right-3" />
        ) : (
          query && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setSuggestions([]);
                setOpen(false);
              }}
              className="absolute right-3 text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )
        )}
      </div>

      {open && suggestions.length > 0 && (
        <ul className="absolute z-[1000] mt-1.5 w-full rounded-xl bg-slate-900 border border-slate-700 shadow-2xl overflow-hidden divide-y divide-slate-800">
          {suggestions.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => handlePick(item)}
                className="w-full text-left px-3.5 py-2.5 hover:bg-slate-800/80 transition-colors flex items-start gap-2.5 cursor-pointer"
              >
                <MapPin className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white truncate">
                    {item.name}
                  </p>
                  <p className="text-xs text-slate-400 truncate">
                    {item.label} ({item.latitude}, {item.longitude})
                  </p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
