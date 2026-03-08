import type { Cartesian3 } from "cesium";

export type RouteType = "ground" | "air";

export interface Waypoint {
  position: Cartesian3;
  offsetTimeMs: number;
  index: number;
}

export interface Leg {
  speed: number; // meters per second
  fromWaypointIndex: number;
  toWaypointIndex: number;
}

export interface Route {
  id: string;
  type: RouteType;
  name: string;
  waypoints: Waypoint[];
  legs: Leg[];
  /** Altitude in meters for air routes (used when drawing) */
  altitude?: number;
}

export interface Marker {
  id: string;
  position: Cartesian3;
  offsetTimeMs: number;
  routeId?: string; // optional association to route
}
