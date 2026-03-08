import { Cartesian3, Cartographic } from "cesium";
import type { Marker } from "../types/route";

interface MarkerListProps {
  markers: Marker[];
  onRemoveMarker: (id: string) => void;
}

function cartesianToLatLon(c: Cartesian3): { lat: number; lon: number } {
  const carto = Cartographic.fromCartesian(c);
  return {
    lat: (carto.latitude * 180) / Math.PI,
    lon: (carto.longitude * 180) / Math.PI,
  };
}

function formatOffsetTime(ms: number): string {
  const sec = Math.floor(ms / 1000);
  const mins = Math.floor(sec / 60);
  const secs = sec % 60;
  if (mins > 0) {
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }
  return `${secs}s`;
}

export function MarkerList({ markers, onRemoveMarker }: MarkerListProps) {
  return (
    <div style={styles.container}>
      <h3 style={styles.title}>Markers</h3>
      <p style={styles.hint}>Click on a route to add a marker.</p>
      <ul style={styles.list}>
        {markers.map((marker) => {
          const { lat, lon } = cartesianToLatLon(marker.position);
          return (
            <li key={marker.id} style={styles.item}>
              <div style={styles.itemContent}>
                <span style={styles.time}>{formatOffsetTime(marker.offsetTimeMs)}</span>
                <span style={styles.coords}>
                  {lat.toFixed(4)}°, {lon.toFixed(4)}°
                </span>
              </div>
              <button
                type="button"
                onClick={() => onRemoveMarker(marker.id)}
                style={styles.deleteBtn}
                title="Remove marker"
              >
                ×
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: 12,
    borderTop: "1px solid #333",
  },
  title: {
    fontSize: 14,
    fontWeight: 600,
    marginBottom: 4,
    color: "#eee",
  },
  hint: {
    fontSize: 11,
    color: "#888",
    marginBottom: 12,
  },
  list: {
    listStyle: "none",
  },
  item: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "6px 8px",
    marginBottom: 4,
    backgroundColor: "#2a2a2a",
    borderRadius: 4,
    fontSize: 12,
  },
  itemContent: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
  },
  time: {
    fontWeight: 600,
    color: "#fa8",
  },
  coords: {
    color: "#999",
    fontFamily: "monospace",
    fontSize: 11,
  },
  deleteBtn: {
    padding: "2px 8px",
    fontSize: 16,
    lineHeight: 1,
    cursor: "pointer",
    background: "none",
    border: "none",
    color: "#a66",
  },
};
