import React from "react";
import { CesiumViewer } from "./components/CesiumViewer";
import { RouteList } from "./components/RouteList";
import { RouteEditor } from "./components/RouteEditor";
import { MarkerList } from "./components/MarkerList";
import { useRouteState } from "./hooks/useRouteState";

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          width: "100%", height: "100%", background: "#1a1a1a", color: "#ccc", fontFamily: "system-ui, sans-serif",
          gap: 12,
        }}>
          <span style={{ fontSize: 48 }}>🌐</span>
          <h2 style={{ color: "#eee", margin: 0 }}>Map failed to load</h2>
          <p style={{ color: "#888", margin: 0 }}>{this.state.error.message}</p>
          <button
            onClick={() => window.location.reload()}
            style={{ marginTop: 8, padding: "8px 20px", borderRadius: 6, border: "none",
              background: "#2a5a8a", color: "#fff", cursor: "pointer", fontSize: 14 }}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  const {
    routes,
    markers,
    selectedRouteId,
    setSelectedRouteId,
    drawingRouteId,
    startDrawing,
    finishDrawing,
    addRoute,
    deleteRoute,
    addWaypoint,
    removeWaypoint,
    updateLegSpeed,
    addMarker,
    removeMarker,
  } = useRouteState();

  const selectedRoute = routes.find((r) => r.id === selectedRouteId) ?? null;

  return (
    <div style={styles.app}>
      <aside style={styles.sidebar}>
        <RouteList
          routes={routes}
          selectedRouteId={selectedRouteId}
          drawingRouteId={drawingRouteId}
          onSelectRoute={setSelectedRouteId}
          onAddRoute={addRoute}
          onDeleteRoute={deleteRoute}
        />
        <RouteEditor
          route={selectedRoute}
          drawingRouteId={drawingRouteId}
          onUpdateLegSpeed={updateLegSpeed}
          onRemoveWaypoint={removeWaypoint}
          onAddWaypoint={addWaypoint}
          onStartDrawing={startDrawing}
          onFinishDrawing={finishDrawing}
        />
        <MarkerList markers={markers} onRemoveMarker={removeMarker} />
      </aside>
      <main style={styles.map}>
        <ErrorBoundary>
          <CesiumViewer
            routes={routes}
            markers={markers}
            drawingRouteId={drawingRouteId}
            onAddMarker={addMarker}
            onAddWaypoint={addWaypoint}
            onFinishDrawing={finishDrawing}
          />
        </ErrorBoundary>
      </main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  app: {
    display: "flex",
    width: "100%",
    height: "100%",
    backgroundColor: "#1a1a1a",
  },
  sidebar: {
    width: 280,
    minWidth: 280,
    backgroundColor: "#222",
    borderRight: "1px solid #333",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  map: {
    flex: 1,
    minWidth: 0,
  },
};

export default App;
