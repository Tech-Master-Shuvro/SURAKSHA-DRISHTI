from pathlib import Path
import pandas as pd
from services.db_service import get_saved_predictions

DATA_DIR = Path(__file__).resolve().parents[2] / "data"
LOCATIONS_FILE = DATA_DIR / "locations" / "locations.csv"
FLOOD_REGISTRY_FILE = DATA_DIR / "flood_registry.csv"

# Temporary sample locations until Group 1 pushes data/locations/locations.csv
SAMPLE_LOCATIONS = [
    {
        "location_id": "LOC01",
        "name": "Howrah Riverside",
        "district": "Howrah",
        "state": "West Bengal",
        "latitude": 22.5958,
        "longitude": 88.2636,
        "elevation_m": 8.0,
        "river_distance_km": 0.8,
        "population_density": 14000,
        "road_accessibility": 80,
        "essential_facilities": 85,
    },
    {
        "location_id": "LOC02",
        "name": "Salt Lake Sector V",
        "district": "North 24 Parganas",
        "state": "West Bengal",
        "latitude": 22.5726,
        "longitude": 88.4339,
        "elevation_m": 12.0,
        "river_distance_km": 4.5,
        "population_density": 9500,
        "road_accessibility": 90,
        "essential_facilities": 92,
    },
    {
        "location_id": "LOC03",
        "name": "Newtown Action Area",
        "district": "North 24 Parganas",
        "state": "West Bengal",
        "latitude": 22.5867,
        "longitude": 88.4744,
        "elevation_m": 16.0,
        "river_distance_km": 7.2,
        "population_density": 6000,
        "road_accessibility": 94,
        "essential_facilities": 90,
    },
    {
        "location_id": "LOC04",
        "name": "Kalyani Highland",
        "district": "Nadia",
        "state": "West Bengal",
        "latitude": 22.9751,
        "longitude": 88.4345,
        "elevation_m": 22.0,
        "river_distance_km": 6.5,
        "population_density": 4200,
        "road_accessibility": 88,
        "essential_facilities": 86,
    },
]


def get_all_locations() -> list[dict]:
    if LOCATIONS_FILE.exists():
        df = pd.read_csv(LOCATIONS_FILE)
        base_locations = df.to_dict(orient="records")
    else:
        base_locations = list(SAMPLE_LOCATIONS)

    existing_ids = {str(loc["location_id"]) for loc in base_locations}
    seen_coords = {
        (round(float(loc["latitude"]), 3), round(float(loc["longitude"]), 3))
        for loc in base_locations
    }

    next_num = len(base_locations) + 1
    for saved in reversed(get_saved_predictions(limit=50)):
        sid = saved.get("location_id")
        coord = (
            round(float(saved["latitude"]), 3),
            round(float(saved["longitude"]), 3),
        )
        if (sid and str(sid) in existing_ids) or coord in seen_coords:
            continue
        loc_id = f"LOC{next_num:02d}"
        next_num += 1
        existing_ids.add(loc_id)
        seen_coords.add(coord)

        raw_name = str(saved.get("location_name") or loc_id).strip()
        parts = [p.strip() for p in raw_name.split(",") if p.strip()]
        short_name = parts[0] if parts else loc_id
        region = ", ".join(parts[1:]) if len(parts) > 1 else "India"

        base_locations.append({
            "location_id": loc_id,
            "saved_id": saved["id"],
            "name": short_name,
            "district": region,
            "state": parts[1] if len(parts) > 1 else "",
            "latitude": float(saved["latitude"]),
            "longitude": float(saved["longitude"]),
            "elevation_m": float(saved.get("elevation_m") or 10.0),
            "river_distance_km": float(saved.get("river_distance_km") or 5.0),
            "population_density": float(saved.get("population_density") or 0.0),
            "road_accessibility": 75,
            "essential_facilities": 75,
        })

    return base_locations


def get_location_by_id(location_id: str) -> dict | None:
    for loc in get_all_locations():
        if str(loc["location_id"]) == str(location_id):
            return loc
    return None


def get_flood_history(location_id: str | None = None) -> list[dict]:
    if FLOOD_REGISTRY_FILE.exists():
        df = pd.read_csv(FLOOD_REGISTRY_FILE).fillna("")
        if location_id:
            df = df[df["location_id"].astype(str) == str(location_id)]
        return df.to_dict(orient="records")
    return []