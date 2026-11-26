import os
import httpx

OPEN_ELEVATION_URL = os.getenv(
    "OPEN_ELEVATION_URL", "https://api.open-elevation.com/api/v1/lookup"
)
WORLDPOP_100M_URL = os.getenv(
    "WORLDPOP_100M_URL",
    "https://worldpop.arcgis.com/arcgis/rest/services/WorldPop_Population_Density_100m/ImageServer/identify",
)
WORLDPOP_1KM_URL = os.getenv(
    "WORLDPOP_1KM_URL",
    "https://worldpop.arcgis.com/arcgis/rest/services/WorldPop_Population_Density_1km/ImageServer/identify",
)


async def get_elevation(lat: float, lon: float) -> float:
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.get(OPEN_ELEVATION_URL, params={"locations": f"{lat},{lon}"})
            res.raise_for_status()
            results = res.json().get("results", [])
            if results:
                return float(results[0].get("elevation", 10.0))
    except Exception:
        pass
    return 10.0  # Safe fallback if Open-Elevation is temporarily busy


async def get_population_density(lat: float, lon: float) -> float:
    """Query WorldPop 100m (and 1km fallback) gridded population density raster (people/km^2)."""
    params = {
        "geometry": f"{lon},{lat}",
        "geometryType": "esriGeometryPoint",
        "sr": 4326,
        "returnGeometry": "false",
        "returnCatalogItems": "false",
        "f": "json",
    }
    async with httpx.AsyncClient(timeout=12.0) as client:
        for url in (WORLDPOP_100M_URL, WORLDPOP_1KM_URL):
            try:
                res = await client.get(url, params=params)
                res.raise_for_status()
                val = res.json().get("value")
                if val is not None and str(val).strip().lower() != "nodata":
                    return round(max(0.0, float(val)), 2)
            except Exception:
                continue
    return 0.0