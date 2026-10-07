import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type SchoolSettings = {
  id: string;
  name: string;
  join_code: string;
  address: string;
  phone: string;
  gstin: string;
  gst_rate: number;
  preorder_cutoff_time: string;
  preorder_cutoff_same_day: boolean;
  counter_discount_allowed: boolean;
  counter_max_discount_percent: number;
  weekday_open: string;
  weekday_close: string;
  saturday_open: string | null;
  saturday_close: string | null;
};

// The logged-in user's school with all its settings. Cached for one request.
export const getSchool = cache(async (): Promise<SchoolSettings> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("schools")
    .select(
      "id, name, join_code, address, phone, gstin, gst_rate, preorder_cutoff_time, preorder_cutoff_same_day, counter_discount_allowed, counter_max_discount_percent, weekday_open, weekday_close, saturday_open, saturday_close",
    )
    .single();
  if (error) throw error;
  return {
    ...data,
    gst_rate: Number(data.gst_rate),
    counter_max_discount_percent: Number(data.counter_max_discount_percent),
  } as SchoolSettings;
});
