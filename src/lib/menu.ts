// Shared menu types and helpers. Safe to use in browser components.

// "none" is for non-food items like stationery: no veg / non-veg mark.
export type FoodType = "veg" | "non_veg" | "egg" | "none";
export type StockMode = "count" | "daily_limit" | "unlimited";

export type Category = { id: string; name: string; sort_order: number };

export type OptionInput = { name: string; price_delta: number };
export type OptionGroupInput = {
  name: string;
  is_required: boolean;
  max_select: number;
  options: OptionInput[];
};

export type Product = {
  id: string;
  category_id: string | null;
  name: string;
  description: string;
  price: number;
  gst_rate: number | null;
  food_type: FoodType;
  image_path: string | null;
  is_active: boolean;
  // Only sold through parent pre-orders, never at the counter.
  preorder_only: boolean;
  stock_mode: StockMode;
  stock_qty: number;
  daily_limit: number;
  low_stock_threshold: number;
  available_days: number[];
  available_from: string | null;
  available_until: string | null;
};

export const FOOD_TYPE_LABELS: Record<FoodType, string> = {
  veg: "Veg",
  non_veg: "Non-veg",
  egg: "Egg",
  none: "Not food",
};

export const STOCK_MODE_LABELS: Record<StockMode, { title: string; hint: string }> = {
  count: { title: "Count stock", hint: "A fixed number in stock, e.g. 25 juice boxes" },
  daily_limit: { title: "Daily limit", hint: "How many can be sold each day, e.g. 50 lunches" },
  unlimited: { title: "Unlimited", hint: "Never runs out" },
};

export const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const rupees = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
});

export function formatINR(amount: number) {
  return rupees.format(amount);
}

export function imageUrl(path: string | null) {
  if (!path) return null;
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/product-images/${path}`;
}

export type SchoolHours = {
  weekday_open: string;
  weekday_close: string;
  saturday_open: string | null;
  saturday_close: string | null;
};

// e.g. "Mon–Fri 8:00 AM – 3:30 PM · Sat 8:00 AM – 12:30 PM"
export function schoolHoursText(hours: SchoolHours) {
  const weekdays = `Mon–Fri ${formatTime(hours.weekday_open)} – ${formatTime(hours.weekday_close)}`;
  const saturday =
    hours.saturday_open && hours.saturday_close
      ? `Sat ${formatTime(hours.saturday_open)} – ${formatTime(hours.saturday_close)}`
      : "Sat closed";
  return `${weekdays} · ${saturday}`;
}

export function formatTime(time: string) {
  const [h, m] = time.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${suffix}`;
}

// e.g. "Mon–Fri · 8:00 AM – 11:00 AM" or "Every day · School hours"
export function availabilityText(product: Pick<Product, "available_days" | "available_from" | "available_until">) {
  const days = [...product.available_days].sort();
  let dayText = "Every day";
  if (days.length > 0 && days.length < 7) {
    const consecutive = days.every((day, i) => i === 0 || day === days[i - 1] + 1);
    dayText =
      consecutive && days.length > 2
        ? `${DAYS[days[0]]}–${DAYS[days[days.length - 1]]}`
        : days.map((day) => DAYS[day]).join(", ");
  }

  const { available_from: from, available_until: until } = product;
  if (!from && !until) return `${dayText} · School hours`;
  const timeText = from && until
    ? `${formatTime(from)} – ${formatTime(until)}`
    : from
      ? `from ${formatTime(from)}`
      : `until ${formatTime(until!)}`;
  return `${dayText} · ${timeText}`;
}

export type StockStatus = { label: string; tone: "green" | "amber" | "red" | "slate" };

export function stockStatus(product: Pick<Product, "stock_mode" | "stock_qty" | "daily_limit" | "low_stock_threshold">): StockStatus {
  if (product.stock_mode === "unlimited") return { label: "Unlimited", tone: "slate" };
  if (product.stock_mode === "daily_limit") {
    return product.daily_limit === 0
      ? { label: "Daily limit 0", tone: "red" }
      : { label: `${product.daily_limit} per day`, tone: "green" };
  }
  if (product.stock_qty === 0) return { label: "Out of stock", tone: "red" };
  if (product.stock_qty <= product.low_stock_threshold) return { label: `Low · ${product.stock_qty} left`, tone: "amber" };
  return { label: `${product.stock_qty} in stock`, tone: "green" };
}
