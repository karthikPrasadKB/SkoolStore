"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/platform";
import { contactTaken, createPendingClientAdmin, createStaffAccount, readNewStaff } from "@/lib/staff-accounts";
import { createAdminClient } from "@/lib/supabase/admin";

export type HqState = { error?: string; done?: string };

type AdminDb = NonNullable<ReturnType<typeof createAdminClient>>;

// Makes someone an admin of each of these schools.
async function grantAdmin(db: AdminDb, profileId: string, schoolIds: string[]) {
  const { error } = await db
    .from("school_memberships")
    .upsert(schoolIds.map((schoolId) => ({ profile_id: profileId, school_id: schoolId, role: "admin" })));
  if (error) throw new Error(error.message);
}

// Compare phone numbers by their last 10 digits ("+91 98765 43210" = "9876543210").
function phoneKey(phone: string | null | undefined) {
  return (phone ?? "").replace(/\D/g, "").slice(-10);
}

// Checks that a new client's email/phone aren't used by another client, and its admin's aren't used by anyone.
async function findContactClash(
  db: AdminDb,
  client: { email: string; phone: string },
  admin: { email: string; phone: string },
): Promise<string | null> {
  const { data: clients } = await db.from("clients").select("email, phone");
  const same = (a: string | null | undefined, b: string) => (a ?? "").trim().toLowerCase() === b;

  if (client.email && (clients ?? []).some((c) => same(c.email, client.email))) {
    return "Another client already uses this email.";
  }
  if (client.phone && (clients ?? []).some((c) => phoneKey(c.phone) === phoneKey(client.phone))) {
    return "Another client already uses this phone number.";
  }
  if (admin.email || admin.phone) {
    const taken = await contactTaken(admin.email, admin.phone);
    if (taken) return taken.replace("This", "The admin's");
  }
  return null;
}

// A new client (the business running the school stores) and its admin. The client's email and phone are optional;
// the admin creates the client's schools after their first login.
export async function createClientAccount(_prev: HqState, formData: FormData): Promise<HqState> {
  await requirePlatformAdmin();
  const field = (key: string) => String(formData.get(key) ?? "").trim();
  const name = field("client_name");
  const email = field("client_email").toLowerCase();
  const phone = field("client_phone");
  if (name.length < 2) return { error: "Please enter the client's name." };
  if (email && !/^\S+@\S+\.\S+$/.test(email)) return { error: "The client's email doesn't look right." };
  if (phone && phone.replace(/\D/g, "").length < 10) return { error: "The client's phone number doesn't look right." };

  const staff = readNewStaff(formData, "admin");
  if ("error" in staff) return staff;

  const db = createAdminClient();
  if (!db) return { error: "The SUPABASE_SECRET_KEY is missing from .env.local." };

  const clash = await findContactClash(db, { email, phone }, { email: staff.contactEmail, phone: staff.phone });
  if (clash) return { error: clash };

  const { data: client, error } = await db
    .from("clients")
    .insert({ name: name.slice(0, 200), email: email || null, phone: phone ? phone.slice(0, 20) : null })
    .select("id")
    .single();
  if (error?.code === "23505") {
    // Caught by the database's own rule (e.g. two people adding the same client at once).
    return { error: "Another client already uses this email or phone number." };
  }
  if (error || !client) return { error: error?.message ?? "Couldn't create the client." };

  const result = await createPendingClientAdmin(staff, client.id);
  if ("error" in result) {
    await db.from("clients").delete().eq("id", client.id);
    return result;
  }

  revalidatePath("/hq");
  return {
    done: `${name} is set up. ${staff.fullName} can log in with username "${staff.username}" and create their schools.`,
  };
}

// Adds an admin (e.g. a partner) to some of a client's schools: a new account, or an existing staff username.
export async function addClientAdmin(_prev: HqState, formData: FormData): Promise<HqState> {
  await requirePlatformAdmin();
  const clientId = String(formData.get("client_id") ?? "");
  const schoolIds = formData.getAll("school_ids").map(String);
  if (schoolIds.length === 0) return { error: "Tick at least one school." };

  const db = createAdminClient();
  if (!db) return { error: "The SUPABASE_SECRET_KEY is missing from .env.local." };

  const { data: schools } = await db
    .from("schools")
    .select("id, name, join_code")
    .eq("client_id", clientId)
    .in("id", schoolIds);
  if (!schools || schools.length !== schoolIds.length) return { error: "Those schools don't belong to this client." };

  try {
    const existing = String(formData.get("existing_username") ?? "")
      .trim()
      .toLowerCase();
    let profileId: string;
    let label: string;
    if (existing) {
      const { data: person } = await db.from("profiles").select("id, full_name").eq("username", existing).maybeSingle();
      if (!person) return { error: `No staff account with username "${existing}".` };
      [profileId, label] = [person.id, person.full_name];
    } else {
      const staff = readNewStaff(formData, "admin");
      if ("error" in staff) return staff;
      const result = await createStaffAccount(staff, schools[0]);
      if ("error" in result) return result;
      const { data: person } = await db.from("profiles").select("id").eq("username", staff.username).single();
      if (!person) return { error: "Account created, but couldn't find it to add the schools." };
      [profileId, label] = [person.id, `${staff.fullName} (username "${staff.username}")`];
    }

    await grantAdmin(
      db,
      profileId,
      schools.map((s) => s.id),
    );
    revalidatePath("/hq");
    return { done: `${label} is now an admin of ${schools.map((s) => s.name).join(", ")}.` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Something went wrong." };
  }
}

export type DeletionPreview = {
  schools: number;
  students: number;
  orders: number;
  wallet_balance: number;
  staff: number;
  accounts_deleted: number;
};

// What deleting a client would remove (shown before confirming).
export async function previewClientDeletion(clientId: string): Promise<DeletionPreview | { error: string }> {
  await requirePlatformAdmin();
  const db = createAdminClient();
  if (!db) return { error: "The SUPABASE_SECRET_KEY is missing from .env.local." };
  const { data, error } = await db.rpc("client_deletion_preview", { p_client_id: clientId });
  if (error) return { error: error.message };
  return data as DeletionPreview;
}

// Permanently deletes a client, its schools and everything in them.
// The person must type "Delete <client name>" exactly, as a second check.
export async function deleteClient(_prev: HqState, formData: FormData): Promise<HqState> {
  await requirePlatformAdmin();
  const clientId = String(formData.get("client_id") ?? "");
  const typed = String(formData.get("confirm_phrase") ?? "").trim();

  const db = createAdminClient();
  if (!db) return { error: "The SUPABASE_SECRET_KEY is missing from .env.local." };

  const { data: client } = await db.from("clients").select("name").eq("id", clientId).maybeSingle();
  if (!client) return { error: "Client not found." };
  const phrase = `Delete ${client.name.trim()}`;
  if (typed !== phrase) return { error: `Type ${phrase} exactly to confirm.` };

  const { data, error } = await db.rpc("delete_client", { p_client_id: clientId });
  if (error) return { error: error.message };

  revalidatePath("/hq");
  const result = data as { schools: number; accounts_deleted: number };
  return {
    done: `Deleted ${client.name}: ${result.schools} school${result.schools === 1 ? "" : "s"} and ${result.accounts_deleted} account${result.accounts_deleted === 1 ? "" : "s"}.`,
  };
}

// Pauses a client (its admins and staff can't log in; its schools disappear for parents) or turns it back on.
// All data is kept.
export async function setClientDisabled(formData: FormData) {
  await requirePlatformAdmin();
  const db = createAdminClient();
  if (!db) return;
  await db.rpc("set_client_disabled", {
    p_client_id: String(formData.get("client_id")),
    p_disabled: formData.get("disabled") === "1",
  });
  revalidatePath("/hq");
}

// Puts a school that has no client yet under a client: an existing one, or a new one made from the form.
export async function assignSchoolToClient(_prev: HqState, formData: FormData): Promise<HqState> {
  await requirePlatformAdmin();
  const field = (key: string) => String(formData.get(key) ?? "").trim();
  const schoolId = field("school_id");
  let clientId = field("client_id");

  const db = createAdminClient();
  if (!db) return { error: "The SUPABASE_SECRET_KEY is missing from .env.local." };

  const { data: school } = await db.from("schools").select("id, name, client_id").eq("id", schoolId).maybeSingle();
  if (!school) return { error: "School not found." };
  if (school.client_id) return { error: "This school already belongs to a client." };

  if (clientId === "__new__") {
    const name = field("client_name");
    const email = field("client_email").toLowerCase();
    const phone = field("client_phone");
    if (name.length < 2) return { error: "Please enter the client's name." };
    if (!/^\S+@\S+\.\S+$/.test(email)) return { error: "Please enter the client's email." };
    if (phone.replace(/\D/g, "").length < 10) return { error: "Please enter the client's phone number." };
    const clash = await findContactClash(db, { email, phone }, { email: "", phone: "" });
    if (clash) return { error: clash };
    const { data: client, error } = await db
      .from("clients")
      .insert({ name: name.slice(0, 200), email, phone: phone.slice(0, 20) })
      .select("id")
      .single();
    if (error || !client) return { error: error?.message ?? "Couldn't create the client." };
    clientId = client.id;
  }
  if (!clientId) return { error: "Choose a client." };

  const { error } = await db.from("schools").update({ client_id: clientId }).eq("id", schoolId);
  if (error) return { error: error.message };

  revalidatePath("/hq");
  return { done: `${school.name} now belongs to the client.` };
}
