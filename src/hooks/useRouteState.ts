import { useState, useCallback } from "react";
import { Cartesian3 } from "cesium";
import type { Route, Marker } from "../types/route";
import { computeOffsetTimes, positionAtOffsetTime } from "../utils/routeMath";

function generateId(): string {
  return Math.random().toString(36).slice(2, 11);
}

export function useRouteState() {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [markers, setMarkers] = useState<Marker[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [drawingRouteId, setDrawingRouteId] = useState<string | null>(null);

  const addRoute = useCallback((type: "ground" | "air") => {
    const route: Route = {
      id: generateId(),
      type,
      name: `${type === "ground" ? "Ground" : "Air"} Route ${Date.now().toString(36).slice(-4)}`,
      waypoints: [],
      legs: [],
    };
    setRoutes((prev) => [...prev, route]);
    setSelectedRouteId(route.id);
  }, []);

  const updateRoute = useCallback((id: string, updater: (r: Route) => Route) => {
    setRoutes((prev) =>
      prev.map((r) => (r.id === id ? updater(r) : r))
    );
  }, []);

  const deleteRoute = useCallback((id: string) => {
    setRoutes((prev) => prev.filter((r) => r.id !== id));
    setMarkers((prev) => prev.filter((m) => m.routeId !== id));
    if (selectedRouteId === id) setSelectedRouteId(null);
    if (drawingRouteId === id) setDrawingRouteId(null);
  }, [selectedRouteId, drawingRouteId]);

  const startDrawing = useCallback((routeId: string, altitude?: number) => {
    setDrawingRouteId(routeId);
    if (altitude !== undefined) {
      setRoutes((prev) =>
        prev.map((r) => (r.id === routeId ? { ...r, altitude } : r))
      );
    }
  }, []);

  const finishDrawing = useCallback(() => {
    setDrawingRouteId(null);
  }, []);

  const addWaypoint = useCallback(
    (routeId: string, position: Cartesian3) => {
      updateRoute(routeId, (route) => {
        const newWp = {
          position: Cartesian3.clone(position),
          offsetTimeMs: 0,
          index: route.waypoints.length,
        };
        const newWaypoints = [...route.waypoints, newWp];
        let newLegs = route.legs;
        if (route.waypoints.length > 0) {
          newLegs = [
            ...route.legs,
            {
              speed: 10,
              fromWaypointIndex: route.waypoints.length - 1,
              toWaypointIndex: route.waypoints.length,
            },
          ];
        }
        const updated: Route = {
          ...route,
          waypoints: newWaypoints,
          legs: newLegs,
        };
        updated.waypoints = computeOffsetTimes(updated);
        return updated;
      });
    },
    [updateRoute]
  );

  const removeWaypoint = useCallback(
    (routeId: string, index: number) => {
      updateRoute(routeId, (route) => {
        const newWaypoints = route.waypoints.filter((_, i) => i !== index);
        const newLegs = route.legs
          .filter((l) => l.fromWaypointIndex !== index && l.toWaypointIndex !== index)
          .map((l) => ({
            ...l,
            fromWaypointIndex:
              l.fromWaypointIndex > index ? l.fromWaypointIndex - 1 : l.fromWaypointIndex,
            toWaypointIndex:
              l.toWaypointIndex > index ? l.toWaypointIndex - 1 : l.toWaypointIndex,
          }));
        const updated: Route = { ...route, waypoints: newWaypoints, legs: newLegs };
        updated.waypoints = computeOffsetTimes(updated);
        return updated;
      });
    },
    [updateRoute]
  );

  const moveWaypoint = useCallback(
    (routeId: string, waypointIndex: number, newPosition: Cartesian3) => {
      let updatedRoute: Route | null = null;

      updateRoute(routeId, (route) => {
        const newWaypoints = route.waypoints.map((wp, i) =>
          i === waypointIndex
            ? { ...wp, position: Cartesian3.clone(newPosition) }
            : wp
        );
        const updated: Route = { ...route, waypoints: newWaypoints };
        updated.waypoints = computeOffsetTimes(updated);
        updatedRoute = updated;
        return updated;
      });

      // Relocate markers on this route to wherever their offsetTimeMs now falls
      setMarkers((prevMarkers) =>
        prevMarkers.map((marker) => {
          if (marker.routeId !== routeId || !updatedRoute) return marker;
          const result = positionAtOffsetTime(updatedRoute, marker.offsetTimeMs);
          if (!result) return marker;
          return {
            ...marker,
            position: Cartesian3.clone(result.position),
            offsetTimeMs: result.offsetTimeMs,
          };
        })
      );
    },
    [updateRoute]
  );

  const updateLegSpeed = useCallback(
    (routeId: string, legIndex: number, speed: number) => {
      // We need the updated route to relocate markers, so capture it here before
      // dispatching via updateRoute (which only sees the updater fn result).
      let updatedRoute: Route | null = null;

      updateRoute(routeId, (route) => {
        const newLegs = [...route.legs];
        newLegs[legIndex] = { ...newLegs[legIndex], speed };
        const updated: Route = { ...route, legs: newLegs };
        updated.waypoints = computeOffsetTimes(updated);
        updatedRoute = updated;
        return updated;
      });

      // Relocate any markers associated with this route. We cannot use setRoutes
      // state from above because it is stale here; instead we use a functional
      // setMarkers update which receives the current markers snapshot.
      setMarkers((prevMarkers) =>
        prevMarkers.map((marker) => {
          if (marker.routeId !== routeId || !updatedRoute) return marker;

          const result = positionAtOffsetTime(updatedRoute, marker.offsetTimeMs);
          if (!result) return marker;

          return {
            ...marker,
            position: Cartesian3.clone(result.position),
            offsetTimeMs: result.offsetTimeMs,
          };
        })
      );
    },
    [updateRoute]
  );

  const addMarker = useCallback(
    (position: Cartesian3, offsetTimeMs: number, routeId?: string) => {
      const marker: Marker = {
        id: generateId(),
        position: Cartesian3.clone(position),
        offsetTimeMs,
        routeId,
      };
      setMarkers((prev) => [...prev, marker]);
    },
    []
  );

  const removeMarker = useCallback((id: string) => {
    setMarkers((prev) => prev.filter((m) => m.id !== id));
  }, []);

  return {
    routes,
    markers,
    selectedRouteId,
    setSelectedRouteId,
    drawingRouteId,
    startDrawing,
    finishDrawing,
    addRoute,
    updateRoute,
    deleteRoute,
    addWaypoint,
    removeWaypoint,
    moveWaypoint,
    updateLegSpeed,
    addMarker,
    removeMarker,
  };
}
