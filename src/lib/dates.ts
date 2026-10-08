// Dates and times in India time (Asia/Kolkata), as plain strings like "2026-10-08" and "2026-10-08T21:00".

export const MAX_DAYS_AHEAD = 7;

// Today's date in India, e.g. "2026-10-08".
export function todayInIndia() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
}

// The current date and time in India, e.g. "2026-10-08T14:05".
export function nowInIndia() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

export function addDays(date: string, days: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// 0 = Sunday ... 6 = Saturday.
export function dayOfWeek(date: string) {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

// e.g. "Thu, 9 Oct"
export function formatDay(date: string) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-IN", {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export type CutoffRules = {
  preorder_cutoff_time: string;
  preorder_cutoff_same_day: boolean;
  saturday_open: string | null;
};

// When orders for a pickup day close, e.g. "2026-10-08T21:00" for a 9 PM day-before cutoff.
export function orderDeadline(school: CutoffRules, pickupDate: string) {
  const day = school.preorder_cutoff_same_day ? pickupDate : addDays(pickupDate, -1);
  return `${day}T${school.preorder_cutoff_time.slice(0, 5)}`;
}

export type OrderDay = { date: string; label: string; open: boolean; reason?: string; deadline: string };

// The next school days a parent can order for, marking those whose ordering has closed.
export function orderDays(school: CutoffRules): OrderDay[] {
  const today = todayInIndia();
  const now = nowInIndia();
  const days: OrderDay[] = [];
  for (let i = 0; i <= MAX_DAYS_AHEAD; i++) {
    const date = addDays(today, i);
    const dow = dayOfWeek(date);
    if (dow === 0 || (dow === 6 && !school.saturday_open)) continue;
    const deadline = orderDeadline(school, date);
    const label = i === 0 ? "Today" : i === 1 ? "Tomorrow" : formatDay(date);
    days.push(
      now >= deadline ? { date, label, open: false, reason: "Orders closed", deadline } : { date, label, open: true, deadline },
    );
  }
  return days;
}

// e.g. "9:00 PM today" or "9:00 PM Thu, 9 Oct": when ordering for a day closes.
export function deadlineText(deadline: string) {
  const [date, time] = deadline.split("T");
  const [h, m] = time.split(":").map(Number);
  const clock = `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
  const today = todayInIndia();
  const when = date === today ? "today" : date === addDays(today, 1) ? "tomorrow" : formatDay(date);
  return `${clock} ${when}`;
}
