// Role names and which areas each role can open. Safe to use in browser components.

export type Role = "admin" | "canteen_staff" | "counter_staff" | "parent";

export const ROLE_LABELS: Record<Role, string> = {
  admin: "School admin",
  canteen_staff: "Canteen staff",
  counter_staff: "Counter staff",
  parent: "Parent",
};

// Each area of the app and which roles may open it.
export const AREAS = [
  { href: "/admin", label: "Admin", roles: ["admin"] },
  { href: "/kitchen", label: "Menu & stock", roles: ["admin", "canteen_staff"] },
  { href: "/counter", label: "Counter", roles: ["admin", "canteen_staff", "counter_staff"] },
  { href: "/parent", label: "My orders", roles: ["parent"] },
] as const satisfies { href: string; label: string; roles: Role[] }[];

export function areasFor(role: Role) {
  return AREAS.filter((area) => (area.roles as readonly Role[]).includes(role));
}

export function homeFor(role: Role) {
  return areasFor(role)[0].href;
}
