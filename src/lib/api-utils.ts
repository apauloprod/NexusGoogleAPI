export function getApiUrl() {
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl) {
    // Remove trailing slash if present
    return envUrl.endsWith('/') ? envUrl.slice(0, -1) : envUrl;
  }
  return window.location.origin;
}
