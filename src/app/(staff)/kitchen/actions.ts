"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import type { FoodType, OptionGroupInput, StockMode } from "@/lib/menu";
import { createClient } from "@/lib/supabase/server";

export type ActionState = { error?: string; saved?: boolean };

const MENU_EDITORS = ["admin", "canteen_staff"] as const;
const STAFF = ["admin", "canteen_staff", "counter_staff"] as const;
const IMAGE_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function wholeNumber(formData: FormData, key: string) {
  const value = Number(text(formData, key) || 0);
  return Number.isInteger(value) && value >= 0 ? value : null;
}

function parseOptionGroups(json: string): OptionGroupInput[] | string {
  let raw: unknown;
  try {
    raw = JSON.parse(json || "[]");
  } catch {
    return "Customisations could not be read. Please try again.";
  }
  if (!Array.isArray(raw)) return "Customisations could not be read. Please try again.";

  const groups: OptionGroupInput[] = [];
  for (const group of raw) {
    const name = String(group?.name ?? "").trim();
    const options = (Array.isArray(group?.options) ? group.options : [])
      .map((option: { name?: unknown; price_delta?: unknown }) => ({
        name: String(option?.name ?? "").trim(),
        price_delta: Number(option?.price_delta ?? 0),
      }))
      .filter((option: { name: string }) => option.name);

    if (!name && options.length === 0) continue;
    if (!name) return "Every customisation group needs a name, e.g. \"Size\".";
    if (options.length === 0) return `Add at least one choice to "${name}".`;
    if (options.some((o: { price_delta: number }) => !Number.isFinite(o.price_delta) || o.price_delta < 0)) {
      return `Extra prices in "${name}" must be 0 or more.`;
    }

    const maxSelect = Number(group?.max_select ?? 1);
    groups.push({
      name: name.slice(0, 60),
      is_required: Boolean(group?.is_required),
      max_select: Math.min(Math.max(Number.isInteger(maxSelect) ? maxSelect : 1, 1), options.length),
      options: options.map((o: { name: string; price_delta: number }) => ({ ...o, name: o.name.slice(0, 60) })),
    });
  }
  return groups;
}

export async function saveProduct(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await requireRole(MENU_EDITORS);

  const id = text(formData, "id");
  const name = text(formData, "name");
  const price = Number(text(formData, "price"));
  const foodType = text(formData, "food_type") as FoodType;
  const stockMode = text(formData, "stock_mode") as StockMode;
  const stockQty = wholeNumber(formData, "stock_qty");
  const dailyLimit = wholeNumber(formData, "daily_limit");
  const lowStock = wholeNumber(formData, "low_stock_threshold");
  const days = formData.getAll("days").map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
  // "All day" = during school hours, stored as no time window.
  const customTime = text(formData, "time_mode") === "custom";
  const from = customTime ? text(formData, "available_from") || null : null;
  const until = customTime ? text(formData, "available_until") || null : null;

  if (!name) return { error: "Please enter the item name." };
  if (!Number.isFinite(price) || price < 0) return { error: "Please enter a valid price." };
  if (!["veg", "non_veg", "egg", "none"].includes(foodType)) {
    return { error: "Please choose veg, non-veg, egg or not food." };
  }
  if (!["count", "daily_limit", "unlimited"].includes(stockMode)) return { error: "Please choose a stock type." };
  if (stockQty === null || dailyLimit === null || lowStock === null) {
    return { error: "Stock numbers must be whole numbers, 0 or more." };
  }
  if (days.length === 0) return { error: "Pick at least one day the item is sold, or untick 'Show on menu' to hide it." };
  if (customTime && (!from || !until)) return { error: "Enter both times, or choose 'All day'." };
  if (from && until && from >= until) return { error: "The 'available until' time must be after the 'from' time." };

  const gstText = text(formData, "gst_rate");
  const gstRate = gstText === "" ? null : Number(gstText);
  if (gstRate !== null && (!Number.isFinite(gstRate) || gstRate < 0 || gstRate > 100)) {
    return { error: "GST rate must be between 0 and 100, or empty to use the school's rate." };
  }

  const groups = parseOptionGroups(text(formData, "options_json"));
  if (typeof groups === "string") return { error: groups };

  const supabase = await createClient();

  // "+ New category…" creates the category (or reuses one with the same name).
  let categoryId = text(formData, "category_id") || null;
  if (categoryId === "__new__") {
    const newName = text(formData, "new_category").slice(0, 60);
    if (!newName) return { error: "Please type a name for the new category." };

    const { data: existing } = await supabase.from("categories").select("id, name");
    const match = (existing ?? []).find((c) => c.name.toLowerCase() === newName.toLowerCase());
    if (match) {
      categoryId = match.id;
    } else {
      const { data: created, error } = await supabase
        .from("categories")
        .insert({ school_id: profile.school_id, name: newName, sort_order: existing?.length ?? 0 })
        .select("id")
        .single();
      if (error) return { error: `Couldn't create the category: ${error.message}` };
      categoryId = created.id;
    }
  }

  // Upload a new photo if one was chosen.
  const currentImage = text(formData, "current_image_path") || null;
  let imagePath = formData.get("remove_image") === "1" ? null : currentImage;
  const image = formData.get("image");
  if (image instanceof File && image.size > 0) {
    const ext = IMAGE_TYPES[image.type];
    if (!ext) return { error: "Photos must be JPG, PNG or WebP." };
    if (image.size > 5 * 1024 * 1024) return { error: "Photos must be smaller than 5 MB." };

    const path = `${profile.school_id}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage
      .from("product-images")
      .upload(path, image, { contentType: image.type });
    if (error) return { error: `Photo upload failed: ${error.message}` };
    imagePath = path;
  }

  const row = {
    school_id: profile.school_id,
    category_id: categoryId,
    name: name.slice(0, 100),
    description: text(formData, "description").slice(0, 500),
    price: Math.round(price * 100) / 100,
    gst_rate: gstRate,
    food_type: foodType,
    image_path: imagePath,
    is_active: formData.get("is_active") === "on",
    preorder_only: formData.get("preorder_only") === "on",
    stock_mode: stockMode,
    stock_qty: stockQty,
    daily_limit: dailyLimit,
    low_stock_threshold: lowStock,
    available_days: days.length === 7 ? [] : days,
    available_from: from,
    available_until: until,
  };

  let productId = id;
  if (id) {
    const { error } = await supabase.from("products").update(row).eq("id", id);
    if (error) return { error: error.message };
  } else {
    const { data, error } = await supabase.from("products").insert(row).select("id").single();
    if (error) return { error: error.message };
    productId = data.id;
  }

  const { error: optionsError } = await supabase.rpc("save_product_options", {
    p_product_id: productId,
    p_groups: groups,
  });
  if (optionsError) return { error: `Item saved, but customisations failed: ${optionsError.message}` };

  // Clean up the old photo once the new one is saved.
  if (currentImage && currentImage !== imagePath) {
    await supabase.storage.from("product-images").remove([currentImage]);
  }

  revalidatePath("/kitchen");
  redirect("/kitchen");
}

export async function deleteProduct(formData: FormData) {
  await requireRole(MENU_EDITORS);
  const supabase = await createClient();

  const { data } = await supabase
    .from("products")
    .delete()
    .eq("id", text(formData, "id"))
    .select("image_path")
    .single();

  if (data?.image_path) await supabase.storage.from("product-images").remove([data.image_path]);

  revalidatePath("/kitchen");
  redirect("/kitchen");
}

// Quick stock update from the menu list. Counter staff can use this too.
export async function updateStock(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole(STAFF);

  const stockQty = wholeNumber(formData, "stock_qty");
  const dailyLimit = wholeNumber(formData, "daily_limit");
  if (stockQty === null || dailyLimit === null) return { error: "Use whole numbers, 0 or more." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_product_stock", {
    p_product_id: text(formData, "id"),
    p_stock_qty: stockQty,
    p_daily_limit: dailyLimit,
    p_is_active: formData.get("is_active") === "on",
  });

  if (error) return { error: error.message };
  revalidatePath("/kitchen");
  return { saved: true };
}

export async function createCategory(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await requireRole(MENU_EDITORS);
  const name = text(formData, "name");
  if (!name) return { error: "Please enter a category name." };

  const supabase = await createClient();
  const { count } = await supabase.from("categories").select("id", { count: "exact", head: true });
  const { error } = await supabase
    .from("categories")
    .insert({ school_id: profile.school_id, name: name.slice(0, 60), sort_order: count ?? 0 });

  if (error) {
    return { error: error.code === "23505" ? "A category with that name already exists." : error.message };
  }
  revalidatePath("/kitchen", "layout");
  return { saved: true };
}

export async function renameCategory(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole(MENU_EDITORS);
  const name = text(formData, "name");
  if (!name) return { error: "Name can't be empty." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("categories")
    .update({ name: name.slice(0, 60) })
    .eq("id", text(formData, "id"));

  if (error) {
    return { error: error.code === "23505" ? "A category with that name already exists." : error.message };
  }
  revalidatePath("/kitchen", "layout");
  return { saved: true };
}

export async function deleteCategory(formData: FormData) {
  await requireRole(MENU_EDITORS);
  const supabase = await createClient();
  await supabase.from("categories").delete().eq("id", text(formData, "id"));
  revalidatePath("/kitchen", "layout");
}

// Swap a category with its neighbour to change the menu order.
export async function moveCategory(formData: FormData) {
  await requireRole(MENU_EDITORS);
  const supabase = await createClient();
  const id = text(formData, "id");
  const direction = text(formData, "direction") === "up" ? -1 : 1;

  const { data } = await supabase.from("categories").select("id").order("sort_order").order("name");
  const ids = (data ?? []).map((c) => c.id as string);
  const index = ids.indexOf(id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= ids.length) return;

  [ids[index], ids[target]] = [ids[target], ids[index]];
  await Promise.all(
    ids.map((categoryId, sortOrder) =>
      supabase.from("categories").update({ sort_order: sortOrder }).eq("id", categoryId),
    ),
  );
  revalidatePath("/kitchen", "layout");
}
