import {
  Cartesian3,
  Cartographic,
  Ellipsoid,
  EllipsoidGeodesic,
} from "cesium";
import type { Route, Waypoint } from "../types/route";

const MIN_LEG_SPEED = 0.1; // avoid division by zero

/**
 * Compute offset times for all waypoints based on leg distances and speeds.
 * Waypoint 0 has offsetTimeMs = 0; later waypoints use cumulative leg duration.
 */
export function computeOffsetTimes(route: Route): Waypoint[] {
  const { waypoints, legs } = route;
  if (waypoints.length === 0) return [];

  const updated: Waypoint[] = waypoints.map((wp, i) => ({
    ...wp,
    offsetTimeMs: 0,
    index: i,
  }));

  for (let i = 0; i < legs.length && i + 1 < waypoints.length; i++) {
    const leg = legs[i];
    const from = waypoints[leg.fromWaypointIndex]?.position;
    const to = waypoints[leg.toWaypointIndex]?.position;
    if (!from || !to) continue;

    const distance = Cartesian3.distance(from, to);
    const speed = Math.max(leg.speed, MIN_LEG_SPEED);
    const durationMs = (distance / speed) * 1000;

    const prevOffset = updated[leg.fromWaypointIndex]?.offsetTimeMs ?? 0;
    updated[leg.toWaypointIndex] = {
      ...updated[leg.toWaypointIndex],
      offsetTimeMs: prevOffset + durationMs,
    };
  }

  return updated;
}

const defaultEllipsoid = Ellipsoid.WGS84;

/**
 * Tessellate a geodesic arc between two Cartesian3 points into an array of positions.
 * Uses Cesium's EllipsoidGeodesic for lat/lon; height is linearly interpolated to preserve altitude.
 */
export function tessellateGeodesic(
  from: Cartesian3,
  to: Cartesian3,
  granularity = 64
): Cartesian3[] {
  const start = Cartographic.fromCartesian(from);
  const end = Cartographic.fromCartesian(to);
  const geodesic = new EllipsoidGeodesic(
    Cartographic.fromRadians(start.longitude, start.latitude, 0),
    Cartographic.fromRadians(end.longitude, end.latitude, 0),
    defaultEllipsoid
  );

  const positions: Cartesian3[] = [];
  for (let i = 0; i <= granularity; i++) {
    const fraction = i / granularity;
    const carto = geodesic.interpolateUsingFraction(fraction);
    const height = (1 - fraction) * start.height + fraction * end.height;
    positions.push(
      Cartesian3.fromRadians(carto.longitude, carto.latitude, height)
    );
  }
  return positions;
}

/**
 * Tessellate an entire route into a flat array of Cartesian3 positions for each leg.
 * Returns array of { positions, legIndex, route } for rendering and hit-testing.
 */
export function tessellateRoute(route: Route): {
  positions: Cartesian3[];
  legIndex: number;
  route: Route;
  fromWaypointIndex: number;
  toWaypointIndex: number;
  legSpeed: number;
}[] {
  const segments: {
    positions: Cartesian3[];
    legIndex: number;
    route: Route;
    fromWaypointIndex: number;
    toWaypointIndex: number;
    legSpeed: number;
  }[] = [];

  const { waypoints, legs } = route;
  for (let i = 0; i < legs.length; i++) {
    const leg = legs[i];
    const from = waypoints[leg.fromWaypointIndex]?.position;
    const to = waypoints[leg.toWaypointIndex]?.position;
    if (!from || !to) continue;

    const positions = tessellateGeodesic(from, to);
    segments.push({
      positions,
      legIndex: i,
      route,
      fromWaypointIndex: leg.fromWaypointIndex,
      toWaypointIndex: leg.toWaypointIndex,
      legSpeed: Math.max(leg.speed, MIN_LEG_SPEED),
    });
  }

  return segments;
}

/**
 * Compute cumulative distance from route start to a point on a segment.
 * segmentT is fraction along the segment [0, 1].
 */
export function distanceAlongRoute(
  route: Route,
  legIndex: number,
  segmentT: number
): number {
  const { waypoints, legs } = route;
  let total = 0;

  for (let i = 0; i < legIndex; i++) {
    const leg = legs[i];
    const from = waypoints[leg.fromWaypointIndex]?.position;
    const to = waypoints[leg.toWaypointIndex]?.position;
    if (from && to) total += Cartesian3.distance(from, to);
  }

  const leg = legs[legIndex];
  const from = waypoints[leg.fromWaypointIndex]?.position;
  const to = waypoints[leg.toWaypointIndex]?.position;
  if (from && to) {
    const legDist = Cartesian3.distance(from, to);
    total += legDist * segmentT;
  }

  return total;
}

/**
 * Compute offset time in ms for a point on a route segment.
 */
export function offsetTimeAtSegment(
  route: Route,
  legIndex: number,
  segmentT: number
): number {
  const { legs } = route;
  let totalMs = 0;

  for (let i = 0; i < legIndex; i++) {
    const leg = legs[i];
    const from = route.waypoints[leg.fromWaypointIndex]?.position;
    const to = route.waypoints[leg.toWaypointIndex]?.position;
    if (from && to) {
      const dist = Cartesian3.distance(from, to);
      const speed = Math.max(leg.speed, MIN_LEG_SPEED);
      totalMs += (dist / speed) * 1000;
    }
  }

  const leg = legs[legIndex];
  const from = route.waypoints[leg.fromWaypointIndex]?.position;
  const to = route.waypoints[leg.toWaypointIndex]?.position;
  if (from && to) {
    const dist = Cartesian3.distance(from, to);
    const speed = Math.max(leg.speed, MIN_LEG_SPEED);
    totalMs += (dist * segmentT / speed) * 1000;
  }

  return totalMs;
}

/**
 * Given a route (with legs that already have correct speeds) and a desired
 * offsetTimeMs, return the Cartesian3 position that corresponds to that time
 * and the (possibly clamped) actual offsetTimeMs.
 *
 * - Walks leg by leg accumulating duration.
 * - Interpolates linearly (SLERP via tessellateGeodesic fraction) within the
 *   matching leg.
 * - If `desiredOffsetMs` exceeds the total route duration the last waypoints
 *   position and its offsetTimeMs are returned.
 */
export function positionAtOffsetTime(
  route: Route,
  desiredOffsetMs: number
): { position: Cartesian3; offsetTimeMs: number } | null {
  const { waypoints, legs } = route;
  if (waypoints.length === 0) return null;
  if (waypoints.length === 1) {
    return { position: waypoints[0].position, offsetTimeMs: 0 };
  }

  let elapsed = 0;

  for (let i = 0; i < legs.length && i + 1 < waypoints.length; i++) {
    const leg = legs[i];
    const from = waypoints[leg.fromWaypointIndex]?.position;
    const to = waypoints[leg.toWaypointIndex]?.position;
    if (!from || !to) continue;

    const dist = Cartesian3.distance(from, to);
    const speed = Math.max(leg.speed, MIN_LEG_SPEED);
    const legDurationMs = (dist / speed) * 1000;

    if (elapsed + legDurationMs >= desiredOffsetMs || i === legs.length - 1) {
      // The target time falls inside this leg (or we've reached the last leg)
      const remaining = Math.min(desiredOffsetMs - elapsed, legDurationMs);
      const fraction = legDurationMs > 0 ? remaining / legDurationMs : 0;

      // Interpolate along the geodesic for this leg
      const pts = tessellateGeodesic(from, to, 256);
      const ptIndex = Math.min(
        Math.floor(fraction * (pts.length - 1)),
        pts.length - 2
      );
      const localFrac = fraction * (pts.length - 1) - ptIndex;
      const position = Cartesian3.lerp(
        pts[ptIndex],
        pts[ptIndex + 1],
        localFrac,
        new Cartesian3()
      );

      return {
        position,
        offsetTimeMs: elapsed + remaining,
      };
    }

    elapsed += legDurationMs;
  }

  // Fallback: return last waypoint
  const last = waypoints[waypoints.length - 1];
  return { position: last.position, offsetTimeMs: last.offsetTimeMs };
}
