"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
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
  if (gstin && !GSTIN_PATTERN.test(gstin))
    return { error: "That GSTIN doesn't look right. It should be 15 characters." };
  if (!Number.isFinite(gstRate) || gstRate < 0 || gstRate > 100)
    return { error: "GST rate must be between 0 and 100." };
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
      refund_uncollected: formData.get("refund_uncollected") === "on",
    })
    .eq("id", profile.school_id);

  if (error?.code === "23505") {
    return {
      error:
        'Another school already has this name. Add the area to make it unique, e.g. "William Richards School - KGF".',
    };
  }
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { saved: true };
}

export type SlotState = { error?: string; saved?: boolean };

function readSlot(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const startsAt = String(formData.get("starts_at") ?? "").trim();
  const capacity = Number(formData.get("capacity"));
  if (!name) return { error: "Please name the break, e.g. After 1st period." };
  if (!/^\d{2}:\d{2}/.test(startsAt)) return { error: "Please choose the time." };
  if (!Number.isInteger(capacity) || capacity < 1) return { error: "Capacity must be 1 or more students." };
  return { slot: { name: name.slice(0, 60), starts_at: startsAt, capacity: Math.min(capacity, 5000) } };
}

// Break slots: when pre-ordered food is collected, and how many students each can serve.
export async function saveSlot(_prev: SlotState, formData: FormData): Promise<SlotState> {
  const profile = await requireRole(["admin"]);
  const parsed = readSlot(formData);
  if ("error" in parsed) return { error: parsed.error };

  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  const { error } = id
    ? await supabase.from("break_slots").update(parsed.slot).eq("id", id)
    : await supabase.from("break_slots").insert({ ...parsed.slot, school_id: profile.school_id });

  if (error) return { error: error.message };
  revalidatePath("/admin/settings");
  return { saved: true };
}

// Removing a slot hides it from parents; orders already placed for it keep their pickup time.
export async function removeSlot(formData: FormData) {
  await requireRole(["admin"]);
  const supabase = await createClient();
  await supabase
    .from("break_slots")
    .update({ is_active: false })
    .eq("id", String(formData.get("id")));
  revalidatePath("/admin/settings");
}

// Turns the school the admin is working in off (hidden from parents, staff can't use it) or back on.
export async function setSchoolDisabled(disabled: boolean): Promise<{ error?: string }> {
  const profile = await requireRole(["admin"]);
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_school_disabled", { p_school_id: profile.school_id, p_disabled: disabled });
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return {};
}

export type SchoolDeletionPreview = {
  students: number;
  orders: number;
  wallet_balance: number;
  staff: number;
  removes_you: boolean;
  last_school: boolean;
};

export async function previewSchoolDeletion(): Promise<SchoolDeletionPreview | { error: string }> {
  const profile = await requireRole(["admin"]);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("school_deletion_preview", { p_school_id: profile.school_id });
  if (error) return { error: error.message };
  return data as SchoolDeletionPreview;
}

export type DeleteSchoolState = { error?: string };

// Permanently deletes the school the admin is working in. They must type "Delete <school name>".
export async function deleteSchool(_prev: DeleteSchoolState, formData: FormData): Promise<DeleteSchoolState> {
  const profile = await requireRole(["admin"]);
  const phrase = `Delete ${profile.school.name.trim()}`;
  if (String(formData.get("confirm_phrase") ?? "").trim() !== phrase) {
    return { error: `Type ${phrase} exactly to confirm.` };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_school", { p_school_id: profile.school_id });
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  // Home sends them to their next school, the Welcome page (to create a new one), or the login page.
  redirect("/");
}
