import { Cartesian3, Ray } from "cesium";
import type { Route } from "../types/route";
import { tessellateRoute, offsetTimeAtSegment } from "./routeMath";

export interface RouteHit {
  point: Cartesian3;
  offsetTimeMs: number;
  route: Route;
  legIndex: number;
  segmentT: number;
  distanceToRay: number;
}

/**
 * Find the closest point on a line segment to a ray.
 * Returns { point, t, distance } where t is fraction along segment [0,1].
 */
export function closestPointOnSegmentToRay(
  segmentA: Cartesian3,
  segmentB: Cartesian3,
  ray: Ray
): { point: Cartesian3; t: number; distance: number } {
  const segDir = Cartesian3.subtract(segmentB, segmentA, new Cartesian3());
  const segLen = Cartesian3.magnitude(segDir);
  if (segLen < 1e-10) {
    return {
      point: Cartesian3.clone(segmentA),
      t: 0,
      distance: Cartesian3.distance(segmentA, ray.origin),
    };
  }

  Cartesian3.normalize(segDir, segDir);
  const toA = Cartesian3.subtract(segmentA, ray.origin, new Cartesian3());
  const toB = Cartesian3.subtract(segmentB, ray.origin, new Cartesian3());

  // Project ray origin onto segment line: t_param = dot(toA, segDir) / |segDir|^2
  // Since segDir is unit, t_param is distance along segment from A
  const tParam = Cartesian3.dot(toA, segDir);
  const t = Math.max(0, Math.min(1, tParam / segLen));

  const point = Cartesian3.lerp(segmentA, segmentB, t, new Cartesian3());

  // Distance from point to ray: we need closest point on ray to `point`
  // Ray: R(s) = origin + s * direction
  // Closest s: s = dot(point - origin, direction)
  const toPoint = Cartesian3.subtract(point, ray.origin, new Cartesian3());
  const s = Math.max(0, Cartesian3.dot(toPoint, ray.direction));
  const closestOnRay = Cartesian3.add(
    ray.origin,
    Cartesian3.multiplyByScalar(ray.direction, s, new Cartesian3()),
    new Cartesian3()
  );
  const distance = Cartesian3.distance(point, closestOnRay);

  return { point, t, distance };
}

/**
 * Find the closest point on any route to the given pick ray.
 * Returns the best hit if within threshold, else null.
 */
export function findClosestPointOnRoutes(
  routes: Route[],
  ray: Ray,
  thresholdMeters = 50000
): RouteHit | null {
  let best: RouteHit | null = null;

  for (const route of routes) {
    const segments = tessellateRoute(route);
    for (const seg of segments) {
      const { positions } = seg;
      for (let i = 0; i < positions.length - 1; i++) {
        const a = positions[i];
        const b = positions[i + 1];
        const { point, t, distance } = closestPointOnSegmentToRay(a, b, ray);

        if (distance > thresholdMeters) continue;

        // Compute segmentT: fraction along the full leg from waypoint A to B
        let distFromStart = 0;
        for (let j = 0; j < i; j++) {
          distFromStart += Cartesian3.distance(positions[j], positions[j + 1]);
        }
        distFromStart += t * Cartesian3.distance(a, b);
        const totalLegLen = positions.reduce((sum, _, j) => {
          if (j === 0) return 0;
          return sum + Cartesian3.distance(positions[j - 1], positions[j]);
        }, 0);
        const fracAlongLeg =
          totalLegLen > 1e-10 ? distFromStart / totalLegLen : 0;

        const offsetTimeMs = offsetTimeAtSegment(
          route,
          seg.legIndex,
          fracAlongLeg
        );

        if (!best || distance < best.distanceToRay) {
          best = {
            point,
            offsetTimeMs,
            route,
            legIndex: seg.legIndex,
            segmentT: fracAlongLeg,
            distanceToRay: distance,
          };
        }
      }
    }
  }

  return best;
}
