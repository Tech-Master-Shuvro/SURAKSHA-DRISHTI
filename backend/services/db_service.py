import sqlite3
from datetime import datetime, timezone
from pathlib import Path

DB_PATH = Path(__file__).resolve().parents[1] / "suraksha.db"


def _get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with _get_conn() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS saved_predictions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                location_id TEXT,
                location_name TEXT,
                latitude REAL NOT NULL,
                longitude REAL NOT NULL,
                anomaly_risk_score REAL NOT NULL,
                risk_level TEXT NOT NULL,
                zone_color TEXT NOT NULL,
                rainfall_3d_mm REAL DEFAULT 0,
                rainfall_7d_mm REAL DEFAULT 0,
                rainfall_14d_mm REAL DEFAULT 0,
                mean_temp_c REAL DEFAULT 0,
                elevation_m REAL DEFAULT 0,
                river_distance_km REAL DEFAULT 0,
                population_density REAL DEFAULT 0,
                created_at TEXT NOT NULL
            )
            """
        )
        conn.commit()


def save_prediction(data: dict) -> dict:
    init_db()
    created_at = datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")
    features = data.get("features") or {}
    with _get_conn() as conn:
        cur = conn.execute(
            """
            INSERT INTO saved_predictions (
                location_id, location_name, latitude, longitude,
                anomaly_risk_score, risk_level, zone_color,
                rainfall_3d_mm, rainfall_7d_mm, rainfall_14d_mm,
                mean_temp_c, elevation_m, river_distance_km,
                population_density, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                data.get("location_id"),
                data.get("location_name") or data.get("location_id") or "Custom Coordinates",
                float(data["latitude"]),
                float(data["longitude"]),
                float(data["anomaly_risk_score"]),
                str(data["risk_level"]),
                str(data["zone_color"]),
                float(features.get("rainfall_3d_mm", 0.0)),
                float(features.get("rainfall_7d_mm", 0.0)),
                float(features.get("rainfall_14d_mm", 0.0)),
                float(features.get("mean_temp_c", 0.0)),
                float(features.get("elevation_m", 0.0)),
                float(features.get("river_distance_km", 0.0)),
                float(features.get("population_density", 0.0)),
                created_at,
            ),
        )
        conn.commit()
        row = conn.execute(
            "SELECT * FROM saved_predictions WHERE id = ?", (cur.lastrowid,)
        ).fetchone()
    return dict(row)


def get_saved_predictions(location_id: str | None = None, limit: int = 50) -> list[dict]:
    init_db()
    with _get_conn() as conn:
        if location_id:
            if str(location_id).startswith("SAVED-"):
                try:
                    rec_id = int(str(location_id).split("-", 1)[1])
                    rows = conn.execute(
                        "SELECT * FROM saved_predictions WHERE id = ? ORDER BY id DESC LIMIT ?",
                        (rec_id, limit),
                    ).fetchall()
                    return [dict(r) for r in rows]
                except ValueError:
                    pass
            rows = conn.execute(
                "SELECT * FROM saved_predictions WHERE location_id = ? ORDER BY id DESC LIMIT ?",
                (str(location_id), limit),
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM saved_predictions ORDER BY id DESC LIMIT ?",
                (limit,),
            ).fetchall()
    return [dict(r) for r in rows]


def delete_saved_prediction(record_id: int) -> bool:
    init_db()
    with _get_conn() as conn:
        cur = conn.execute("DELETE FROM saved_predictions WHERE id = ?", (record_id,))
        conn.commit()
        return cur.rowcount > 0
