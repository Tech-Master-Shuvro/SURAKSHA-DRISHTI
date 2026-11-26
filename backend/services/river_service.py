import asyncio
import math
import os
import httpx

OVERPASS_URL = os.getenv("OVERPASS_URL", "https://overpass-api.de/api/interpreter")
MARINE_URL = os.getenv("OPEN_METEO_MARINE_URL", "https://marine-api.open-meteo.com/v1/marine")


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371.0
    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)
    a = (
        math.sin(d_lat / 2) ** 2
        + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(d_lon / 2) ** 2
    )
    return round(2 * r * math.asin(math.sqrt(a)), 2)


async def _get_overpass_water_km(lat: float, lon: float) -> float | None:
    query = f"""
    [out:json][timeout:6];
    (
      way["waterway"="river"](around:10000,{lat},{lon});
      way["natural"="coastline"](around:10000,{lat},{lon});
    );
    out center 20;
    """
    try:
        async with httpx.AsyncClient(timeout=6.0) as client:
            res = await client.post(
                OVERPASS_URL,
                data={"data": query},
                headers={"User-Agent": "SURAKSHA-DRISHTI/1.0", "Accept": "application/json"},
            )
            res.raise_for_status()
            elements = res.json().get("elements", [])
            distances = []
            for el in elements:
                center = el.get("center")
                if center:
                    distances.append(haversine_km(lat, lon, center["lat"], center["lon"]))
            if distances:
                return min(distances)
    except Exception:
        pass
    return None


async def _get_seashore_distance_km(lat: float, lon: float) -> float | None:
    """Detect sea shore / coastal proximity via Open-Meteo Marine API (~0-5 km)."""
    offsets = [
        (lat, lon, 0.2),
        (lat + 0.022, lon, 2.4),
        (lat - 0.022, lon, 2.4),
        (lat, lon + 0.022, 2.4),
        (lat, lon - 0.022, 2.4),
        (lat + 0.045, lon, 4.8),
        (lat - 0.045, lon, 4.8),
        (lat, lon + 0.045, 4.8),
        (lat, lon - 0.045, 4.8),
    ]
    lats = ",".join(str(round(p[0], 5)) for p in offsets)
    lons = ",".join(str(round(p[1], 5)) for p in offsets)
    try:
        async with httpx.AsyncClient(timeout=6.0) as client:
            res = await client.get(
                MARINE_URL,
                params={"latitude": lats, "longitude": lons, "current": "wave_height"},
            )
            res.raise_for_status()
            data = res.json()
            items = data if isinstance(data, list) else [data]
            for (_, _, approx_km), item in zip(offsets, items):
                wave = (item.get("current") or {}).get("wave_height")
                if wave is not None:
                    sea_lat = item.get("latitude")
                    sea_lon = item.get("longitude")
                    if sea_lat is not None and sea_lon is not None:
                        return min(approx_km, max(0.2, haversine_km(lat, lon, float(sea_lat), float(sea_lon))))
                    return approx_km
    except Exception:
        pass
    return None


async def get_nearest_river_distance_km(lat: float, lon: float) -> float:
    overpass_dist, sea_dist = await asyncio.gather(
        _get_overpass_water_km(lat, lon),
        _get_seashore_distance_km(lat, lon),
    )
    candidates = [d for d in (overpass_dist, sea_dist) if d is not None]
    if candidates:
        return round(min(candidates), 2)
    return 5.0  # Fallback distance (km) if both Overpass and Marine APIs find no water within 5-10 km