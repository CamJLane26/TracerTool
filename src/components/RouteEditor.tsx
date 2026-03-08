import { useState } from "react";
import { Cartesian3, Cartographic } from "cesium";
import type { Route } from "../types/route";

interface RouteEditorProps {
  route: Route | null;
  drawingRouteId: string | null;
  onUpdateLegSpeed: (routeId: string, legIndex: number, speed: number) => void;
  onRemoveWaypoint: (routeId: string, index: number) => void;
  onAddWaypoint: (routeId: string, position: Cartesian3) => void;
  onStartDrawing: (routeId: string, altitude?: number) => void;
  onFinishDrawing: () => void;
}

function cartesianToLatLonAlt(c: Cartesian3): { lat: number; lon: number; alt: number } {
  const carto = Cartographic.fromCartesian(c);
  return {
    lat: (carto.latitude * 180) / Math.PI,
    lon: (carto.longitude * 180) / Math.PI,
    alt: carto.height,
  };
}

export function RouteEditor({
  route,
  drawingRouteId,
  onUpdateLegSpeed,
  onRemoveWaypoint,
  onAddWaypoint,
  onStartDrawing,
  onFinishDrawing,
}: RouteEditorProps) {
  const [altitudeInput, setAltitudeInput] = useState<string>("10000");

  if (!route) {
    return (
      <div style={styles.empty}>
        Select a route to edit, or create one.
      </div>
    );
  }

  const isDrawing = drawingRouteId === route.id;
  const hasWaypoints = route.waypoints.length > 0;

  return (
    <div style={styles.container}>
      <h3 style={styles.title}>{route.name}</h3>

      {!isDrawing && (
        <div style={styles.drawSection}>
          {route.type === "air" && (
            <div style={styles.altitudeRow}>
              <label style={styles.label}>Altitude (m)</label>
              <input
                type="number"
                value={altitudeInput}
                onChange={(e) => setAltitudeInput(e.target.value)}
                min={0}
                step={100}
                style={styles.altitudeInput}
              />
            </div>
          )}
          <button
            type="button"
            onClick={() => {
              const alt =
                route.type === "air"
                  ? parseFloat(altitudeInput) || 10000
                  : undefined;
              onStartDrawing(route.id, alt);
            }}
            style={styles.drawBtn}
          >
            {hasWaypoints ? "Continue drawing" : "Draw route on map"}
          </button>
          <p style={styles.drawHint}>
            Left click: add waypoint · Right click: finish
          </p>
        </div>
      )}

      {isDrawing && (
        <div style={styles.drawActive}>
          <span style={styles.drawActiveText}>Drawing...</span>
          <button
            type="button"
            onClick={onFinishDrawing}
            style={styles.cancelBtn}
          >
            Cancel
          </button>
        </div>
      )}

      <h4 style={styles.section}>Waypoints</h4>
      <div style={styles.waypointList}>
        {route.waypoints.map((wp, i) => {
          const { lat, lon, alt } = cartesianToLatLonAlt(wp.position);
          return (
            <div key={i} style={styles.waypointItem}>
              <div style={styles.waypointInfo}>
                <span style={styles.waypointIndex}>{i}</span>
                <span style={styles.waypointCoords}>
                  {lat.toFixed(4)}°, {lon.toFixed(4)}° @ {alt.toFixed(0)}m
                </span>
                <span style={styles.waypointTime}>
                  {(wp.offsetTimeMs / 1000).toFixed(1)}s
                </span>
              </div>
              <button
                type="button"
                onClick={() => onRemoveWaypoint(route.id, i)}
                style={styles.removeBtn}
                title="Remove waypoint"
              >
                ×
              </button>
            </div>
          );
        })}
      </div>
      <button
        type="button"
        onClick={() => {
          let defaultPos: Cartesian3;
          if (route.waypoints.length > 0) {
            const last = route.waypoints[route.waypoints.length - 1];
            const { lat, lon, alt } = cartesianToLatLonAlt(last.position);
            defaultPos = Cartesian3.fromDegrees(lon + 0.5, lat + 0.5, alt);
          } else {
            defaultPos = Cartesian3.fromDegrees(0, 0, 0);
          }
          onAddWaypoint(route.id, defaultPos);
        }}
        style={styles.addBtn}
      >
        + Add waypoint
      </button>

      <h4 style={styles.section}>Legs</h4>
      <div style={styles.legList}>
        {route.legs.map((leg, i) => (
          <div key={i} style={styles.legItem}>
            <span style={styles.legLabel}>
              Leg {i}: WP{leg.fromWaypointIndex} → WP{leg.toWaypointIndex}
            </span>
            <input
              type="number"
              value={leg.speed}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                if (!Number.isNaN(v) && v >= 0) {
                  onUpdateLegSpeed(route.id, i, v);
                }
              }}
              min={0.1}
              step={1}
              style={styles.speedInput}
            />
            <span style={styles.unit}>m/s</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: 12,
    overflowY: "auto",
  },
  empty: {
    padding: 24,
    color: "#888",
    fontSize: 13,
    textAlign: "center",
  },
  title: {
    fontSize: 14,
    fontWeight: 600,
    marginBottom: 12,
    color: "#eee",
  },
  section: {
    fontSize: 12,
    fontWeight: 600,
    color: "#aaa",
    marginTop: 16,
    marginBottom: 8,
  },
  waypointList: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  waypointItem: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "6px 8px",
    backgroundColor: "#2a2a2a",
    borderRadius: 4,
    fontSize: 12,
  },
  waypointInfo: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
  },
  waypointIndex: {
    fontWeight: 600,
    color: "#7dd",
  },
  waypointCoords: {
    color: "#bbb",
    fontFamily: "monospace",
  },
  waypointTime: {
    color: "#9af",
    fontSize: 11,
  },
  removeBtn: {
    padding: "2px 8px",
    fontSize: 16,
    lineHeight: 1,
    cursor: "pointer",
    background: "none",
    border: "none",
    color: "#a66",
  },
  addBtn: {
    marginTop: 8,
    padding: "6px 12px",
    fontSize: 12,
    cursor: "pointer",
    backgroundColor: "#333",
    color: "#7dd",
    border: "1px solid #444",
    borderRadius: 4,
  },
  drawSection: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: "#1e3a5f",
    borderRadius: 6,
    border: "1px solid #2a5a8a",
  },
  altitudeRow: {
    marginBottom: 8,
  },
  label: {
    display: "block",
    fontSize: 11,
    color: "#9cf",
    marginBottom: 4,
  },
  altitudeInput: {
    width: "100%",
    padding: "6px 8px",
    fontSize: 13,
    backgroundColor: "#2a2a2a",
    border: "1px solid #444",
    borderRadius: 4,
    color: "#eee",
  },
  drawBtn: {
    width: "100%",
    padding: "8px 12px",
    fontSize: 13,
    cursor: "pointer",
    backgroundColor: "#2a5a8a",
    color: "#fff",
    border: "1px solid #3a6a9a",
    borderRadius: 4,
    fontWeight: 600,
  },
  drawHint: {
    fontSize: 11,
    color: "#9cf",
    marginTop: 8,
    marginBottom: 0,
  },
  drawActive: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
    padding: "8px 12px",
    backgroundColor: "#3d2a1e",
    borderRadius: 6,
    border: "1px solid #8a5a2a",
  },
  drawActiveText: {
    color: "#fc8",
    fontWeight: 600,
    fontSize: 13,
  },
  cancelBtn: {
    padding: "4px 10px",
    fontSize: 12,
    cursor: "pointer",
    backgroundColor: "#5a3a2a",
    color: "#fc8",
    border: "1px solid #8a5a2a",
    borderRadius: 4,
  },
  legList: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  legItem: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 12,
  },
  legLabel: {
    flex: 1,
    color: "#bbb",
  },
  speedInput: {
    width: 60,
    padding: "4px 6px",
    fontSize: 12,
    backgroundColor: "#2a2a2a",
    border: "1px solid #444",
    borderRadius: 4,
    color: "#eee",
  },
  unit: {
    color: "#888",
    fontSize: 11,
  },
};
