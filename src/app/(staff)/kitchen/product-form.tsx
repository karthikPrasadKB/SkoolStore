"use client";

import { useActionState, useState } from "react";
import Image from "next/image";
import { ImagePlus, Package, Plus, Trash2, X } from "lucide-react";
import { FoodTypeMark } from "@/components/food-type-mark";
import { Alert, Button, Card, Field } from "@/components/ui";
import {
  DAYS,
  FOOD_TYPE_LABELS,
  imageUrl,
  schoolHoursText,
  STOCK_MODE_LABELS,
  type Category,
  type FoodType,
  type OptionGroupInput,
  type Product,
  type SchoolHours,
  type StockMode,
} from "@/lib/menu";
import { saveProduct, type ActionState } from "./actions";

const selectClass =
  "w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-slate-900 outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15";

// Shrinks a photo to at most 1200px wide/tall so uploads are small and fast.
async function shrinkPhoto(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext("2d")!;
  context.fillStyle = "#ffffff"; // JPEG has no transparency; use a white background
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject()), "image/jpeg", 0.85),
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <Card>
      <h2 className="font-semibold text-slate-900">{title}</h2>
      {hint && <p className="mt-0.5 text-sm text-slate-500">{hint}</p>}
      <div className="mt-5">{children}</div>
    </Card>
  );
}

export function ProductForm({
  product,
  groups: initialGroups,
  categories,
  defaultGstRate,
  schoolHours,
}: {
  product?: Product;
  groups: OptionGroupInput[];
  categories: Category[];
  defaultGstRate: number;
  schoolHours: SchoolHours;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(saveProduct, {});
  const [stockMode, setStockMode] = useState<StockMode>(product?.stock_mode ?? "unlimited");
  const [categoryChoice, setCategoryChoice] = useState(product?.category_id ?? "");
  // The days the school is open: Mon–Fri, plus Saturday unless it's closed.
  const schoolDays = schoolHours.saturday_open ? [1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5];
  // Days the school is closed can't be chosen (and are dropped from items saved earlier).
  const [days, setDays] = useState<number[]>(
    product?.available_days.length ? product.available_days.filter((d) => schoolDays.includes(d)) : schoolDays,
  );
  const [timeMode, setTimeMode] = useState<"school" | "custom">(
    product?.available_from || product?.available_until ? "custom" : "school",
  );
  const [groups, setGroups] = useState<OptionGroupInput[]>(initialGroups);
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(imageUrl(product?.image_path ?? null));
  const [removeImage, setRemoveImage] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  async function choosePhoto(file: File | undefined) {
    if (!file) return;
    setPhotoError(null);
    try {
      const shrunk = await shrinkPhoto(file);
      setPhoto(shrunk);
      setPreview(URL.createObjectURL(shrunk));
      setRemoveImage(false);
    } catch {
      setPhotoError("That photo couldn't be read. Please use a JPG or PNG.");
    }
  }

  function clearPhoto() {
    setPhoto(null);
    setPreview(null);
    setRemoveImage(true);
  }

  function updateGroup(index: number, changes: Partial<OptionGroupInput>) {
    setGroups((current) => current.map((g, i) => (i === index ? { ...g, ...changes } : g)));
  }

  function submit(formData: FormData) {
    if (photo) formData.set("image", photo, "photo.jpg");
    formAction(formData);
  }

  return (
    <form action={submit} className="space-y-6">
      <input type="hidden" name="id" value={product?.id ?? ""} />
      <input type="hidden" name="current_image_path" value={product?.image_path ?? ""} />
      <input type="hidden" name="remove_image" value={removeImage ? "1" : "0"} />
      <input type="hidden" name="options_json" value={JSON.stringify(groups)} />

      {state.error && <Alert kind="error">{state.error}</Alert>}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Section title="Item details">
            <div className="space-y-4">
              <Field
                label="Name"
                name="name"
                defaultValue={product?.name}
                required
                maxLength={100}
                placeholder="e.g. Veg sandwich"
              />
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-slate-700">Description (optional)</span>
                <textarea
                  name="description"
                  defaultValue={product?.description}
                  maxLength={500}
                  rows={3}
                  placeholder="e.g. Grilled sandwich with cucumber, tomato and mint chutney"
                  className={selectClass}
                />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Price (₹)"
                  name="price"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.5"
                  defaultValue={product?.price}
                  required
                  placeholder="40"
                />
                <div className="space-y-2">
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-semibold text-slate-700">Category</span>
                    <select
                      name="category_id"
                      value={categoryChoice}
                      onChange={(e) => setCategoryChoice(e.target.value)}
                      className={selectClass}
                    >
                      <option value="">No category</option>
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                      <option value="__new__">+ New category…</option>
                    </select>
                  </label>
                  {categoryChoice === "__new__" && (
                    <input
                      name="new_category"
                      required
                      maxLength={60}
                      autoFocus
                      placeholder="New category name, e.g. Stationery"
                      className={selectClass}
                    />
                  )}
                </div>
              </div>
              <div className="sm:w-1/2">
                <Field
                  label="GST rate (%)"
                  name="gst_rate"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  defaultValue={product?.gst_rate ?? ""}
                  placeholder={`School default (${defaultGstRate}%)`}
                  hint="Leave empty to use the school's rate. The price above includes GST."
                />
              </div>
              <div>
                <span className="mb-1.5 block text-sm font-semibold text-slate-700">Type</span>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(FOOD_TYPE_LABELS) as FoodType[]).map((type) => (
                    <label key={type} className="cursor-pointer">
                      <input
                        type="radio"
                        name="food_type"
                        value={type}
                        defaultChecked={(product?.food_type ?? "veg") === type}
                        className="peer sr-only"
                      />
                      <span className="flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition peer-checked:border-brand-500 peer-checked:bg-brand-50 peer-checked:text-brand-700">
                        {type === "none" ? (
                          <Package className="h-4 w-4 text-slate-500" />
                        ) : (
                          <FoodTypeMark type={type} />
                        )}
                        {FOOD_TYPE_LABELS[type]}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </Section>

          <Section
            title="Customisations"
            hint="Sizes, add-ons or choices, e.g. Size: Small / Large (+₹20), or Add-ons: Extra cheese (+₹10)."
          >
            <div className="space-y-4">
              {groups.map((group, groupIndex) => (
                <div key={groupIndex} className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                  <div className="flex flex-wrap items-end gap-3">
                    <div className="min-w-48 flex-1">
                      <Field
                        label="Group name"
                        value={group.name}
                        onChange={(e) => updateGroup(groupIndex, { name: e.target.value })}
                        placeholder="e.g. Size"
                      />
                    </div>
                    <label className="block">
                      <span className="mb-1.5 block text-sm font-semibold text-slate-700">Customer picks</span>
                      <select
                        value={group.max_select === 1 ? "one" : "many"}
                        onChange={(e) =>
                          updateGroup(groupIndex, {
                            max_select: e.target.value === "one" ? 1 : 99,
                          })
                        }
                        className={selectClass}
                      >
                        <option value="one">Only one</option>
                        <option value="many">Any number</option>
                      </select>
                    </label>
                    <label className="flex items-center gap-2 pb-3 text-sm font-medium text-slate-700">
                      <input
                        type="checkbox"
                        checked={group.is_required}
                        onChange={(e) => updateGroup(groupIndex, { is_required: e.target.checked })}
                        className="h-4 w-4 accent-brand-600"
                      />
                      Must choose
                    </label>
                    <button
                      type="button"
                      onClick={() => setGroups((current) => current.filter((_, i) => i !== groupIndex))}
                      className="mb-1.5 rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
                      title="Remove group"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="mt-4 space-y-2">
                    {group.options.map((option, optionIndex) => (
                      <div key={optionIndex} className="flex items-center gap-2">
                        <input
                          value={option.name}
                          onChange={(e) =>
                            updateGroup(groupIndex, {
                              options: group.options.map((o, i) =>
                                i === optionIndex ? { ...o, name: e.target.value } : o,
                              ),
                            })
                          }
                          placeholder="Choice, e.g. Large"
                          className={`${selectClass} flex-1`}
                        />
                        <div className="relative w-32">
                          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                            +₹
                          </span>
                          <input
                            type="number"
                            min="0"
                            step="0.5"
                            value={option.price_delta === 0 ? "" : option.price_delta}
                            placeholder="0"
                            onChange={(e) =>
                              updateGroup(groupIndex, {
                                options: group.options.map((o, i) =>
                                  i === optionIndex ? { ...o, price_delta: e.target.value } : o,
                                ),
                              })
                            }
                            className={`${selectClass} pl-9`}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            updateGroup(groupIndex, { options: group.options.filter((_, i) => i !== optionIndex) })
                          }
                          className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                          title="Remove choice"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() =>
                        updateGroup(groupIndex, { options: [...group.options, { name: "", price_delta: "" }] })
                      }
                      className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-semibold text-brand-600 hover:bg-brand-50"
                    >
                      <Plus className="h-4 w-4" /> Add choice
                    </button>
                  </div>
                </div>
              ))}

              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  setGroups((current) => [
                    ...current,
                    { name: "", is_required: false, max_select: 1, options: [{ name: "", price_delta: "" }] },
                  ])
                }
              >
                <Plus className="h-4 w-4" /> Add customisation group
              </Button>
            </div>
          </Section>

          <Section title="When is it sold?">
            <span className="mb-2 block text-sm font-semibold text-slate-700">Days</span>
            <div className="flex flex-wrap gap-2">
              {DAYS.map((day, index) => {
                const closed = !schoolDays.includes(index);
                return (
                  <label
                    key={day}
                    className={closed ? "cursor-not-allowed" : "cursor-pointer"}
                    title={closed ? `The school is closed on ${day === "Sat" ? "Saturdays" : "Sundays"}` : undefined}
                  >
                    <input
                      type="checkbox"
                      name="days"
                      value={index}
                      disabled={closed}
                      checked={!closed && days.includes(index)}
                      onChange={(e) =>
                        setDays((current) =>
                          e.target.checked ? [...current, index] : current.filter((d) => d !== index),
                        )
                      }
                      className="peer sr-only"
                    />
                    <span className="block w-14 rounded-xl border border-slate-300 py-2 text-center text-sm font-semibold text-slate-500 transition peer-checked:border-brand-500 peer-checked:bg-brand-600 peer-checked:text-white peer-disabled:border-dashed peer-disabled:bg-slate-50 peer-disabled:text-slate-300 peer-disabled:line-through">
                      {day}
                    </span>
                  </label>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-slate-500">
              {schoolHours.saturday_open ? "Sunday is" : "Saturday and Sunday are"} greyed out because the school is
              closed {schoolHours.saturday_open ? "that day" : "on those days"}. Change it in Settings → School hours.
            </p>
            <span className="mb-2 mt-6 block text-sm font-semibold text-slate-700">Time</span>
            <input type="hidden" name="time_mode" value={timeMode} />
            <div className="grid gap-2 sm:grid-cols-2">
              {(
                [
                  { value: "school", title: "All day", hint: `During school hours: ${schoolHoursText(schoolHours)}` },
                  { value: "custom", title: "Specific time", hint: "e.g. breakfast only from 8:00 to 10:00 AM" },
                ] as const
              ).map((option) => (
                <label
                  key={option.value}
                  className={`flex cursor-pointer gap-3 rounded-xl border p-3 transition ${
                    timeMode === option.value ? "border-brand-500 bg-brand-50" : "border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <input
                    type="radio"
                    checked={timeMode === option.value}
                    onChange={() => setTimeMode(option.value)}
                    // "All day" means whenever the school is open, so tick the school days
                    // (also when clicked again after changing the days).
                    onClick={() => option.value === "school" && setDays(schoolDays)}
                    className="mt-1 accent-brand-600"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-slate-900">{option.title}</span>
                    <span className="block text-xs text-slate-500">{option.hint}</span>
                  </span>
                </label>
              ))}
            </div>
            {timeMode === "custom" && (
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Field
                  label="From"
                  name="available_from"
                  type="time"
                  defaultValue={product?.available_from?.slice(0, 5)}
                  required
                />
                <Field
                  label="Until"
                  name="available_until"
                  type="time"
                  defaultValue={product?.available_until?.slice(0, 5)}
                  required
                />
              </div>
            )}
          </Section>
        </div>

        <div className="space-y-6">
          <Section title="Photo">
            {preview ? (
              <div className="relative aspect-square overflow-hidden rounded-xl bg-slate-100">
                <Image src={preview} alt="Item photo" fill unoptimized className="object-cover" />
                <button
                  type="button"
                  onClick={clearPhoto}
                  className="absolute right-2 top-2 rounded-full bg-white/90 p-1.5 text-slate-700 shadow hover:bg-white"
                  title="Remove photo"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <label className="flex aspect-square cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 text-slate-500 transition hover:border-brand-400 hover:bg-brand-50/40 hover:text-brand-600">
                <ImagePlus className="h-8 w-8" />
                <span className="mt-2 text-sm font-semibold">Add a photo</span>
                <span className="text-xs">JPG or PNG</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  onChange={(e) => choosePhoto(e.target.files?.[0])}
                />
              </label>
            )}
            {photoError && <p className="mt-2 text-sm text-red-600">{photoError}</p>}
          </Section>

          <Section title="Stock">
            <div className="space-y-2">
              {(Object.keys(STOCK_MODE_LABELS) as StockMode[]).map((mode) => (
                <label
                  key={mode}
                  className={`flex cursor-pointer gap-3 rounded-xl border p-3 transition ${
                    stockMode === mode ? "border-brand-500 bg-brand-50" : "border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <input
                    type="radio"
                    name="stock_mode"
                    value={mode}
                    checked={stockMode === mode}
                    onChange={() => setStockMode(mode)}
                    className="mt-1 accent-brand-600"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-slate-900">{STOCK_MODE_LABELS[mode].title}</span>
                    <span className="block text-xs text-slate-500">{STOCK_MODE_LABELS[mode].hint}</span>
                  </span>
                </label>
              ))}
            </div>
            <div className="mt-4 space-y-4">
              <div className={stockMode === "count" ? "space-y-4" : "hidden"}>
                <Field
                  label="Quantity in stock"
                  name="stock_qty"
                  type="number"
                  min="0"
                  step="1"
                  defaultValue={product?.stock_qty ?? 0}
                />
                <Field
                  label="Warn me when stock falls to"
                  name="low_stock_threshold"
                  type="number"
                  min="0"
                  step="1"
                  defaultValue={product?.low_stock_threshold ?? 5}
                />
              </div>
              <div className={stockMode === "daily_limit" ? "" : "hidden"}>
                <Field
                  label="Number per day"
                  name="daily_limit"
                  type="number"
                  min="0"
                  step="1"
                  defaultValue={product?.daily_limit ?? 0}
                />
              </div>
            </div>
          </Section>

          <Card>
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                name="is_active"
                defaultChecked={product?.is_active ?? true}
                className="mt-1 h-4 w-4 accent-brand-600"
              />
              <span>
                <span className="block font-semibold text-slate-900">Show on menu</span>
                <span className="block text-sm text-slate-500">
                  Untick to hide this item from parents and the counter.
                </span>
              </span>
            </label>
            <label className="mt-4 flex cursor-pointer items-start gap-3 border-t border-slate-100 pt-4">
              <input
                type="checkbox"
                name="preorder_only"
                defaultChecked={product?.preorder_only ?? false}
                className="mt-1 h-4 w-4 accent-brand-600"
              />
              <span>
                <span className="block font-semibold text-slate-900">Pre-order only</span>
                <span className="block text-sm text-slate-500">
                  Only parents can order it in advance. It won&apos;t appear at the counter.
                </span>
              </span>
            </label>
          </Card>

          <Button type="submit" disabled={pending} className="w-full py-3">
            {pending ? "Saving…" : product ? "Save changes" : "Add item"}
          </Button>
        </div>
      </div>
    </form>
  );
}
