import axios from "axios";

const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

export const api = axios.create({
  baseURL: API_BASE,
  timeout: 60000,
});

export const getHealth = async () => {
  const { data } = await api.get("/");
  return data;
};

export const getLocations = async () => {
  const { data } = await api.get("/api/locations");
  return data;
};

export const getLocationDetail = async (locationId) => {
  const { data } = await api.get(`/api/locations/${locationId}`);
  return data;
};

export const getFloodHistory = async (locationId) => {
  const params = locationId ? { location_id: locationId } : {};
  const { data } = await api.get("/api/history", { params });
  return data;
};

export const getWeather = async (lat, lon) => {
  const { data } = await api.get("/api/weather", { params: { lat, lon } });
  return data;
};

export const getRiskZones = async () => {
  const { data } = await api.get("/api/risk-zones");
  return data;
};

export const predictFlood = async (payload) => {
  const { data } = await api.post("/api/predict", payload);
  return data;
};

export const recommendRelocation = async (payload) => {
  const { data } = await api.post("/api/relocation", payload);
  return data;
};

export const savePrediction = async (payload) => {
  const { data } = await api.post("/api/saved-predictions", payload);
  return data;
};

export const getSavedPredictions = async (locationId) => {
  const params = locationId ? { location_id: locationId } : {};
  const { data } = await api.get("/api/saved-predictions", { params });
  return data;
};

export const deleteSavedPrediction = async (recordId) => {
  const { data } = await api.delete(`/api/saved-predictions/${recordId}`);
  return data;
};

export const getLiveAlerts = async () => {
  const { data } = await api.get("/api/live-alerts");
  return data;
};
