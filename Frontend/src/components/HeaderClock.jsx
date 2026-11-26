import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Clock, Search } from "lucide-react";

const TIMEZONE_ALIASES = {
  "Asia/Kolkata": "India IST GMT+5:30 Delhi Mumbai",
  "Asia/Calcutta": "India IST GMT+5:30",
  "UTC": "UTC GMT+0 Universal",
  "Europe/London": "UK Britain GMT BST",
  "America/New_York": "USA US Eastern EST EDT",
  "America/Chicago": "USA US Central CST CDT",
  "America/Denver": "USA US Mountain MST MDT",
  "America/Los_Angeles": "USA US Pacific PST PDT",
  "Asia/Dubai": "UAE GST GMT+4",
  "Asia/Dhaka": "Bangladesh BST GMT+6",
  "Asia/Kathmandu": "Nepal NPT GMT+5:45",
  "Asia/Tokyo": "Japan JST GMT+9",
  "Asia/Singapore": "Singapore SGT GMT+8",
  "Australia/Sydney": "Australia AEST AEDT",
  "Europe/Paris": "France CET CEST",
  "Europe/Berlin": "Germany CET CEST",
};

const FALLBACK_TIMEZONES = Object.keys(TIMEZONE_ALIASES);

function getZoneMeta(tz, refDate) {
  let offset = "";
  let abbr = "";
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      timeZoneName: "shortOffset",
    }).formatToParts(refDate);
    offset = parts.find((p) => p.type === "timeZoneName")?.value || "";
  } catch {
    offset = "";
  }
  try {
    const parts = new Intl.DateTimeFormat("en-IN", {
      timeZone: tz,
      timeZoneName: "short",
    }).formatToParts(refDate);
    abbr = parts.find((p) => p.type === "timeZoneName")?.value || "";
  } catch {
    abbr = "";
  }
  if (tz === "Asia/Kolkata" && (!abbr || abbr.startsWith("GMT"))) {
    abbr = "IST";
  }
  const alias = TIMEZONE_ALIASES[tz] || "";
  const label = tz.replace(/_/g, " ");
  const tag = abbr && abbr !== offset ? `${abbr} · ${offset}` : offset || abbr;
  return {
    tz,
    label,
    abbr: abbr || offset,
    tag,
    searchText: `${tz} ${label} ${abbr} ${offset} ${alias}`.toLowerCase(),
  };
}

function buildTimezoneCatalog() {
  let list = FALLBACK_TIMEZONES;
  try {
    if (typeof Intl.supportedValuesOf === "function") {
      const supported = Intl.supportedValuesOf("timeZone");
      list = supported.includes("UTC") ? supported : ["UTC", ...supported];
    }
  } catch {
    // fallback
  }
  const refDate = new Date();
  return list.map((tz) => getZoneMeta(tz, refDate));
}

export default function HeaderClock() {
  const [now, setNow] = useState(() => new Date());
  const [timeZone, setTimeZone] = useState(
    () => localStorage.getItem("suraksha_tz") || "Asia/Kolkata"
  );
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef(null);

  const catalog = useMemo(() => buildTimezoneCatalog(), []);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return catalog;
    return catalog.filter((item) => item.searchText.includes(q));
  }, [catalog, search]);

  const currentMeta = useMemo(
    () =>
      catalog.find((item) => item.tz === timeZone) ||
      getZoneMeta(timeZone, now),
    [catalog, timeZone, now]
  );

  const formattedDate = useMemo(() => {
    try {
      return new Intl.DateTimeFormat("en-GB", {
        timeZone,
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(now);
    } catch {
      return now.toLocaleDateString();
    }
  }, [now, timeZone]);

  const formattedTime = useMemo(() => {
    try {
      return new Intl.DateTimeFormat("en-GB", {
        timeZone,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      }).format(now);
    } catch {
      return now.toLocaleTimeString();
    }
  }, [now, timeZone]);

  const handleSelect = (tz) => {
    setTimeZone(tz);
    localStorage.setItem("suraksha_tz", tz);
    setOpen(false);
    setSearch("");
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        title={`Current Time (${timeZone}) — click to change timezone`}
        className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full bg-slate-800 hover:bg-slate-700/80 border border-slate-700 text-slate-200 transition-colors cursor-pointer"
      >
        <Clock className="w-3.5 h-3.5 text-sky-400 shrink-0" />
        <span className="hidden lg:inline text-slate-300 font-medium">
          {formattedDate}
        </span>
        <span className="hidden lg:inline text-slate-500">·</span>
        <span className="font-mono font-semibold tabular-nums">
          {formattedTime}
        </span>
        <span className="hidden md:inline text-slate-400 font-medium">
          {currentMeta.abbr}
        </span>
        <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-72 rounded-xl bg-slate-900 border border-slate-700 shadow-2xl p-2 z-50 space-y-2">
          <div className="relative flex items-center">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search India, IST, GMT+5:30, UTC..."
              autoFocus
              className="w-full pl-8 pr-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
            />
          </div>

          <ul className="max-h-56 overflow-y-auto divide-y divide-slate-800/70">
            {filtered.length === 0 ? (
              <li className="px-2.5 py-2 text-xs text-slate-500">
                No matching timezone
              </li>
            ) : (
              filtered.map((item) => (
                <li key={item.tz}>
                  <button
                    type="button"
                    onClick={() => handleSelect(item.tz)}
                    className={`w-full text-left px-2.5 py-1.5 text-xs rounded transition-colors cursor-pointer flex items-center justify-between gap-2 ${
                      item.tz === timeZone
                        ? "bg-sky-500/20 text-sky-300 font-semibold"
                        : "text-slate-300 hover:bg-slate-800"
                    }`}
                  >
                    <span className="truncate">{item.label}</span>
                    <span className="text-[10px] text-slate-400 shrink-0 font-mono">
                      {item.tag}
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
