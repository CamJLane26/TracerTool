import type { Route } from "../types/route";

interface RouteListProps {
  routes: Route[];
  selectedRouteId: string | null;
  drawingRouteId: string | null;
  onSelectRoute: (id: string | null) => void;
  onAddRoute: (type: "ground" | "air") => void;
  onDeleteRoute: (id: string) => void;
}

export function RouteList({
  routes,
  selectedRouteId,
  drawingRouteId,
  onSelectRoute,
  onAddRoute,
  onDeleteRoute,
}: RouteListProps) {
  return (
    <div className="route-list" style={styles.container}>
      <h3 style={styles.title}>Routes</h3>
      <div style={styles.actions}>
        <button
          type="button"
          onClick={() => onAddRoute("ground")}
          style={styles.btn}
        >
          + Ground
        </button>
        <button type="button" onClick={() => onAddRoute("air")} style={styles.btn}>
          + Air
        </button>
      </div>
      <ul style={styles.list}>
        {routes.map((route) => (
          <li
            key={route.id}
            style={{
              ...styles.item,
              ...(selectedRouteId === route.id ? styles.itemSelected : {}),
              ...(drawingRouteId === route.id ? styles.itemDrawing : {}),
            }}
          >
            <button
              type="button"
              onClick={() => onSelectRoute(route.id)}
              style={styles.itemBtn}
            >
              <span style={styles.itemName}>{route.name}</span>
              <span style={styles.itemMeta}>
                {route.type} · {route.waypoints.length} pts
              </span>
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteRoute(route.id);
              }}
              style={styles.deleteBtn}
              title="Delete route"
            >
              ×
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: 12,
    borderBottom: "1px solid #333",
  },
  title: {
    fontSize: 14,
    fontWeight: 600,
    marginBottom: 8,
    color: "#eee",
  },
  actions: {
    display: "flex",
    gap: 8,
    marginBottom: 12,
  },
  btn: {
    padding: "6px 12px",
    fontSize: 12,
    cursor: "pointer",
    backgroundColor: "#444",
    color: "#fff",
    border: "1px solid #555",
    borderRadius: 4,
  },
  list: {
    listStyle: "none",
  },
  item: {
    display: "flex",
    alignItems: "center",
    marginBottom: 4,
    borderRadius: 4,
    overflow: "hidden",
  },
  itemSelected: {
    backgroundColor: "#2a4a6a",
  },
  itemDrawing: {
    boxShadow: "inset 0 0 0 2px #8a5a2a",
  },
  itemBtn: {
    flex: 1,
    padding: "8px 10px",
    textAlign: "left",
    background: "none",
    border: "none",
    color: "#eee",
    cursor: "pointer",
    fontSize: 13,
  },
  itemMeta: {
    fontSize: 11,
    color: "#999",
    marginLeft: 8,
  },
  itemName: {
    fontWeight: 500,
  },
  deleteBtn: {
    padding: "4px 10px",
    fontSize: 18,
    lineHeight: 1,
    cursor: "pointer",
    background: "none",
    border: "none",
    color: "#999",
  },
};
