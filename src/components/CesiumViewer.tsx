import { useEffect, useRef } from "react";
import {
  Viewer,
  Cartesian3,
  Cartesian2,
  Color,
  ArcType,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  Cartographic,
  LabelStyle,
  VerticalOrigin,
} from "cesium";
import type { Entity } from "cesium";

import type { Route, Marker } from "../types/route";
import { tessellateRoute } from "../utils/routeMath";
import { findClosestPointOnRoutes } from "../utils/rayIntersection";

interface CesiumViewerProps {
  routes: Route[];
  markers: Marker[];
  drawingRouteId: string | null;
  onAddMarker: (position: Cartesian3, offsetTimeMs: number, routeId?: string) => void;
  onAddWaypoint: (routeId: string, position: Cartesian3) => void;
  onFinishDrawing: () => void;
}

const WAYPOINT_COLOR = Color.CYAN;
const GROUND_ROUTE_COLOR = Color.fromCssColorString("#22dd88");
const AIR_ROUTE_COLOR = Color.fromCssColorString("#5599ff");
const MARKER_COLOR = Color.fromCssColorString("#ff9933");
const GHOST_COLOR = Color.fromCssColorString("#ffffff").withAlpha(0.35);

function pickPosition(
  viewer: Viewer,
  windowPosition: Cartesian2
): Cartesian3 | undefined {
  // Try depth-picking first (gives accurate 3D scene position)
  if (viewer.scene.pickPositionSupported) {
    const pos = viewer.scene.pickPosition(windowPosition);
    if (pos && Cartesian3.magnitude(pos) > 1) return pos;
  }
  // Fall back to globe ray-cast
  const ray = viewer.camera.getPickRay(windowPosition);
  if (!ray) return undefined;
  const pos = viewer.scene.globe.pick(ray, viewer.scene);
  return pos ?? undefined;
}

export function CesiumViewer({
  routes,
  markers,
  drawingRouteId,
  onAddMarker,
  onAddWaypoint,
  onFinishDrawing,
}: CesiumViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Viewer | null>(null);
  // Keep mutable refs for the event-handler closure (avoid stale closures)
  const routesRef = useRef(routes);
  const drawingRouteIdRef = useRef(drawingRouteId);

  // Sync refs on every render
  routesRef.current = routes;
  drawingRouteIdRef.current = drawingRouteId;

  // ─── Initialize Cesium Viewer once ───────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;
    // Guard: don't create a second viewer if StrictMode already cleaned up
    if (viewerRef.current && !viewerRef.current.isDestroyed()) return;

    const viewer = new Viewer(containerRef.current, {
      useDefaultRenderLoop: true,
      fullscreenButton: true,
      vrButton: false,
      geocoder: true,
      homeButton: true,
      sceneModePicker: true,
      baseLayerPicker: true,
      navigationHelpButton: true,
      animation: false,
      timeline: false,
      infoBox: false,
      selectionIndicator: false,
    });

    // Cesium credit container: move it so it doesn't overlap the UI
    const creditContainer = viewer.cesiumWidget.creditContainer as HTMLElement;
    creditContainer.style.fontSize = "9px";

    viewerRef.current = viewer;

    return () => {
      if (!viewer.isDestroyed()) viewer.destroy();
      viewerRef.current = null;
    };
  }, []);

  // ─── Render routes & markers ──────────────────────────────────────────────
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    // Remove all non-ghost entities
    viewer.entities.removeAll();


    for (const route of routes) {
      const isAir = route.type === "air";
      const routeColor = isAir ? AIR_ROUTE_COLOR : GROUND_ROUTE_COLOR;

      // Draw waypoint dots + labels
      for (const wp of route.waypoints) {
        viewer.entities.add({
          position: wp.position,
          point: {
            pixelSize: 10,
            color: WAYPOINT_COLOR,
            outlineColor: Color.WHITE,
            outlineWidth: 2,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
          label: {
            text: `WP${wp.index} (${(wp.offsetTimeMs / 1000).toFixed(1)}s)`,
            font: "12px 'Segoe UI', system-ui, sans-serif",
            fillColor: Color.WHITE,
            outlineColor: Color.BLACK,
            outlineWidth: 2,
            style: LabelStyle.FILL_AND_OUTLINE,
            verticalOrigin: VerticalOrigin.BOTTOM,
            pixelOffset: new Cartesian2(0, -14),
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
            showBackground: true,
            backgroundColor: Color.BLACK.withAlpha(0.5),
            backgroundPadding: new Cartesian2(4, 2),
          },
        });
      }

      // Draw tessellated leg polylines
      const segments = tessellateRoute(route);
      for (const seg of segments) {
        viewer.entities.add({
          polyline: {
            positions: seg.positions,
            width: 3,
            material: routeColor,
            arcType: ArcType.NONE,
            clampToGround: !isAir,
          },
        });
      }
    }

    // Draw markers
    for (const marker of markers) {
      viewer.entities.add({
        position: marker.position,
        point: {
          pixelSize: 12,
          color: MARKER_COLOR,
          outlineColor: Color.WHITE,
          outlineWidth: 2,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        label: {
          text: `⏱ ${(marker.offsetTimeMs / 1000).toFixed(1)}s`,
          font: "11px 'Segoe UI', system-ui, sans-serif",
          fillColor: Color.WHITE,
          outlineColor: Color.BLACK,
          outlineWidth: 2,
          style: LabelStyle.FILL_AND_OUTLINE,
          verticalOrigin: VerticalOrigin.BOTTOM,
          pixelOffset: new Cartesian2(0, -16),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
          showBackground: true,
          backgroundColor: Color.BLACK.withAlpha(0.5),
          backgroundPadding: new Cartesian2(4, 2),
        },
      });
    }
  }, [routes, markers]);

  // ─── Input handlers (left click / right click / mouse move) ──────────────
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    const handler = new ScreenSpaceEventHandler(viewer.scene.canvas);

    // Ghost preview entities while drawing
    let ghostLine: Entity | null = null;
    let ghostDot: Entity | null = null;

    // v: a guaranteed-non-null alias used inside closures (safe: we returned early if null)
    const v = viewer as NonNullable<typeof viewer>;

    function clearGhost() {
      if (v.isDestroyed()) { ghostLine = null; ghostDot = null; return; }
      if (ghostLine) { v.entities.remove(ghostLine); ghostLine = null; }
      if (ghostDot) { v.entities.remove(ghostDot); ghostDot = null; }
    }

    function updateGhost(mouseWorldPos: Cartesian3) {
      const dRouteId = drawingRouteIdRef.current;
      const currentRoutes = routesRef.current;
      if (!dRouteId) { clearGhost(); return; }

      const route = currentRoutes.find((r) => r.id === dRouteId);
      if (!route || route.waypoints.length === 0) { clearGhost(); return; }

      const lastWp = route.waypoints[route.waypoints.length - 1].position;

      if (ghostLine) v.entities.remove(ghostLine);
      if (ghostDot) v.entities.remove(ghostDot);

      ghostLine = v.entities.add({
        polyline: {
          positions: [lastWp, mouseWorldPos],
          width: 2,
          material: GHOST_COLOR,
          arcType: ArcType.NONE,
        },
      });

      ghostDot = v.entities.add({
        position: mouseWorldPos,
        point: {
          pixelSize: 8,
          color: GHOST_COLOR,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      });
    }

    // Mouse move → update ghost line
    handler.setInputAction((event: { endPosition: Cartesian2 }) => {
      if (!drawingRouteIdRef.current) { clearGhost(); return; }
      const pos = pickPosition(v, event.endPosition);
      if (!pos) return;

      const dRouteId = drawingRouteIdRef.current;
      const route = routesRef.current.find((r) => r.id === dRouteId);
      if (route?.type === "air" && route.altitude !== undefined) {
        const carto = Cartographic.fromCartesian(pos);
        const airPos = Cartesian3.fromRadians(carto.longitude, carto.latitude, route.altitude);
        updateGhost(airPos);
      } else {
        updateGhost(pos);
      }
    }, ScreenSpaceEventType.MOUSE_MOVE);

    // Left click → add waypoint or place marker
    handler.setInputAction((event: { position: Cartesian2 }) => {
      const dRouteId = drawingRouteIdRef.current;

      if (dRouteId) {
        const route = routesRef.current.find((r) => r.id === dRouteId);
        if (!route) return;

        let position = pickPosition(v, event.position);
        if (!position) return;

        if (route.type === "air" && route.altitude !== undefined) {
          const carto = Cartographic.fromCartesian(position);
          position = Cartesian3.fromRadians(carto.longitude, carto.latitude, route.altitude);
        }

        onAddWaypoint(dRouteId, position);
      } else {
        // Marker placement: find nearest point on any route
        const ray = v.camera.getPickRay(event.position);
        if (!ray) return;
        const hit = findClosestPointOnRoutes(routesRef.current, ray, 50000);
        if (hit) {
          onAddMarker(hit.point, hit.offsetTimeMs, hit.route.id);
        }
      }
    }, ScreenSpaceEventType.LEFT_CLICK);

    // Prevent context menu during drawing
    const preventContextMenu = (e: MouseEvent) => {
      if (drawingRouteIdRef.current) e.preventDefault();
    };
    v.scene.canvas.addEventListener("contextmenu", preventContextMenu);

    // Right click → finish drawing (add final waypoint then stop)
    handler.setInputAction((event: { position: Cartesian2 }) => {
      const dRouteId = drawingRouteIdRef.current;
      if (!dRouteId) return;

      const route = routesRef.current.find((r) => r.id === dRouteId);
      if (!route) return;

      let position = pickPosition(v, event.position);
      if (!position) {
        onFinishDrawing();
        return;
      }

      if (route.type === "air" && route.altitude !== undefined) {
        const carto = Cartographic.fromCartesian(position);
        position = Cartesian3.fromRadians(carto.longitude, carto.latitude, route.altitude);
      }

      onAddWaypoint(dRouteId, position);
      onFinishDrawing();
      clearGhost();
    }, ScreenSpaceEventType.RIGHT_CLICK);

    return () => {
      clearGhost();
      if (!v.isDestroyed()) {
        v.scene.canvas.removeEventListener("contextmenu", preventContextMenu);
      }
      if (!handler.isDestroyed()) handler.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onAddMarker, onAddWaypoint, onFinishDrawing]);

  return (
    <div style={styles.wrapper}>
      <div
        ref={containerRef}
        className="cesium-container"
        style={{
          ...styles.container,
          ...(drawingRouteId ? styles.containerDrawing : {}),
        }}
      />
      {drawingRouteId && (
        <div style={styles.drawBanner}>
          <span style={styles.bannerIcon}>✏️</span>
          <span>Left click: add waypoint</span>
          <span style={styles.bannerSep}>·</span>
          <span>Right click: finish</span>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    position: "relative",
    width: "100%",
    height: "100%",
  },
  container: {
    width: "100%",
    height: "100%",
  },
  containerDrawing: {
    cursor: "crosshair",
  },
  drawBanner: {
    position: "absolute",
    bottom: 40,
    left: "50%",
    transform: "translateX(-50%)",
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 18px",
    backgroundColor: "rgba(0,0,0,0.8)",
    color: "#ffcc66",
    fontSize: 13,
    fontWeight: 500,
    borderRadius: 20,
    pointerEvents: "none",
    border: "1px solid rgba(255,200,80,0.3)",
    backdropFilter: "blur(4px)",
  },
  bannerIcon: {
    fontSize: 16,
  },
  bannerSep: {
    color: "rgba(255,200,80,0.4)",
  },
};
