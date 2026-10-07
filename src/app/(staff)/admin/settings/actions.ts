"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type SettingsState = { error?: string; saved?: boolean };

const GSTIN_PATTERN = /^[0-9]{2}[A-Z0-9]{13}$/;

export async function saveSettings(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const profile = await requireRole(["admin"]);
  const text = (key: string) => String(formData.get(key) ?? "").trim();

  const name = text("name");
  const gstin = text("gstin").toUpperCase();
  const gstRate = Number(text("gst_rate"));
  const maxDiscount = Number(text("counter_max_discount_percent"));
  const cutoff = text("preorder_cutoff_time");

  if (!name) return { error: "Please enter the school name." };
  if (gstin && !GSTIN_PATTERN.test(gstin)) return { error: "That GSTIN doesn't look right. It should be 15 characters." };
  if (!Number.isFinite(gstRate) || gstRate < 0 || gstRate > 100) return { error: "GST rate must be between 0 and 100." };
  if (!Number.isFinite(maxDiscount) || maxDiscount < 0 || maxDiscount > 100) {
    return { error: "Maximum discount must be between 0 and 100." };
  }
  if (!/^\d{2}:\d{2}/.test(cutoff)) return { error: "Please choose a pre-order cutoff time." };

  const weekdayOpen = text("weekday_open");
  const weekdayClose = text("weekday_close");
  const saturday = text("saturday_mode");
  const saturdayOpen = saturday === "closed" ? null : saturday === "full" ? weekdayOpen : text("saturday_open");
  const saturdayClose = saturday === "closed" ? null : saturday === "full" ? weekdayClose : text("saturday_close");
  if (!weekdayOpen || !weekdayClose || weekdayOpen >= weekdayClose) {
    return { error: "School closing time must be after opening time." };
  }
  if (saturday === "half" && (!saturdayOpen || !saturdayClose || saturdayOpen >= saturdayClose)) {
    return { error: "Saturday closing time must be after opening time." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("schools")
    .update({
      name: name.slice(0, 200),
      address: text("address").slice(0, 300),
      phone: text("phone").slice(0, 20),
      gstin,
      gst_rate: gstRate,
      preorder_cutoff_time: cutoff,
      preorder_cutoff_same_day: text("preorder_cutoff_day") === "same",
      counter_discount_allowed: formData.get("counter_discount_allowed") === "on",
      counter_max_discount_percent: maxDiscount,
      weekday_open: weekdayOpen,
      weekday_close: weekdayClose,
      saturday_open: saturdayOpen,
      saturday_close: saturdayClose,
      use_canteen_codes: formData.get("use_canteen_codes") === "on",
    })
    .eq("id", profile.school_id);

  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { saved: true };
}
