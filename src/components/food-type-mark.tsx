import { FOOD_TYPE_LABELS, type FoodType } from "@/lib/menu";

// The standard Indian food mark: green dot for veg, brown triangle for non-veg, yellow dot for egg.
// Non-food items (stationery etc.) show nothing.
export function FoodTypeMark({ type, className = "h-4 w-4" }: { type: FoodType; className?: string }) {
  if (type === "none") return null;
  const color = type === "veg" ? "#16a34a" : type === "non_veg" ? "#92400e" : "#ca8a04";
  return (
    <svg viewBox="0 0 16 16" className={`shrink-0 ${className}`} role="img" aria-label={FOOD_TYPE_LABELS[type]}>
      <title>{FOOD_TYPE_LABELS[type]}</title>
      <rect x="1" y="1" width="14" height="14" rx="2" fill="white" stroke={color} strokeWidth="1.6" />
      {type === "non_veg" ? (
        <path d="M8 4.2 L11.6 11 H4.4 Z" fill={color} />
      ) : (
        <circle cx="8" cy="8" r="3.4" fill={color} />
      )}
    </svg>
  );
}
