import os
import time
import httpx
from fastapi import HTTPException

OPEN_METEO_URL = os.getenv("OPEN_METEO_URL", "https://api.open-meteo.com/v1/forecast")
OPEN_METEO_FLOOD_URL = os.getenv(
    "OPEN_METEO_FLOOD_URL", "https://flood-api.open-meteo.com/v1/flood"
)
_WEATHER_CACHE: dict[tuple[float, float], tuple[float, dict]] = {}
_BATCH_FLOOD_CACHE: tuple[float, list[dict]] | None = None
_CACHE_TTL_SEC = 300.0


async def get_weather_data(lat: float, lon: float) -> dict:
    key = (round(lat, 3), round(lon, 3))
    cached = _WEATHER_CACHE.get(key)
    if cached and (time.monotonic() - cached[0]) < _CACHE_TTL_SEC:
        return cached[1]

    params = {
        "latitude": lat,
        "longitude": lon,
        "current": "temperature_2m,precipitation",
        "daily": "precipitation_sum,temperature_2m_mean",
        "past_days": 14,
        "forecast_days": 1,
        "timezone": "auto",
    }
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            res = await client.get(OPEN_METEO_URL, params=params)
            res.raise_for_status()
            data = res.json()
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"Open-Meteo API failed: {e}")

    current = data.get("current", {})
    daily = data.get("daily", {})

    rain_list = [x if x is not None else 0.0 for x in daily.get("precipitation_sum", [])]
    temp_list = [x for x in daily.get("temperature_2m_mean", []) if x is not None]

    result = {
        "latitude": lat,
        "longitude": lon,
        "current_temp_c": float(current.get("temperature_2m", 0.0)),
        "current_rain_mm": float(current.get("precipitation", 0.0)),
        "rainfall_3d_mm": round(sum(rain_list[-3:]), 2),
        "rainfall_7d_mm": round(sum(rain_list[-7:]), 2),
        "rainfall_14d_mm": round(sum(rain_list[-14:]), 2),
        "mean_temp_c": round(sum(temp_list) / len(temp_list), 2) if temp_list else 0.0,
    }
    _WEATHER_CACHE[key] = (time.monotonic(), result)
    return result


async def get_batch_flood_and_weather(cities: list[dict]) -> list[dict]:
    """Fetch Open-Meteo flood discharge and rainfall in batch using comma-separated coordinates."""
    global _BATCH_FLOOD_CACHE
    if _BATCH_FLOOD_CACHE and (time.monotonic() - _BATCH_FLOOD_CACHE[0]) < _CACHE_TTL_SEC:
        return _BATCH_FLOOD_CACHE[1]

    lats = ",".join(str(c["latitude"]) for c in cities)
    lons = ",".join(str(c["longitude"]) for c in cities)

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            flood_req = client.get(
                OPEN_METEO_FLOOD_URL,
                params={
                    "latitude": lats,
                    "longitude": lons,
                    "daily": "river_discharge,river_discharge_mean,river_discharge_max",
                    "past_days": 2,
                    "forecast_days": 1,
                },
            )
            weather_req = client.get(
                OPEN_METEO_URL,
                params={
                    "latitude": lats,
                    "longitude": lons,
                    "daily": "precipitation_sum,temperature_2m_mean",
                    "past_days": 14,
                    "forecast_days": 1,
                    "timezone": "auto",
                },
            )
            flood_res, weather_res = await __import__("asyncio").gather(flood_req, weather_req)
            flood_res.raise_for_status()
            weather_res.raise_for_status()
            flood_json = flood_res.json()
            weather_json = weather_res.json()
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"Open-Meteo Flood/Weather batch API failed: {e}")

    flood_list = flood_json if isinstance(flood_json, list) else [flood_json]
    weather_list = weather_json if isinstance(weather_json, list) else [weather_json]

    combined = []
    for city, f_item, w_item in zip(cities, flood_list, weather_list):
        f_daily = f_item.get("daily", {})
        w_daily = w_item.get("daily", {})

        def _latest(arr):
            vals = [x for x in (arr or []) if x is not None]
            return float(vals[-1]) if vals else 0.0

        rain_list = [x if x is not None else 0.0 for x in w_daily.get("precipitation_sum", [])]
        temp_list = [x for x in w_daily.get("temperature_2m_mean", []) if x is not None]

        combined.append({
            **city,
            "river_discharge": round(_latest(f_daily.get("river_discharge")), 2),
            "river_discharge_mean": round(_latest(f_daily.get("river_discharge_mean")), 2),
            "river_discharge_max": round(_latest(f_daily.get("river_discharge_max")), 2),
            "rainfall_3d_mm": round(sum(rain_list[-3:]), 2),
            "rainfall_7d_mm": round(sum(rain_list[-7:]), 2),
            "rainfall_14d_mm": round(sum(rain_list[-14:]), 2),
            "mean_temp_c": round(sum(temp_list) / len(temp_list), 2) if temp_list else 25.0,
        })

    _BATCH_FLOOD_CACHE = (time.monotonic(), combined)
    return combined