"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import type { Role } from "@/lib/roles";
import { getSchool } from "@/lib/school";
import { contactTaken, createStaffAccount, readNewStaff } from "@/lib/staff-accounts";
import { staffEmail, USERNAME_PATTERN } from "@/lib/staff-login";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type RoleState = { error?: string; saved?: boolean };

export async function changeRole(_prev: RoleState, formData: FormData): Promise<RoleState> {
  await requireRole(["admin"]);

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_member_role", {
    member_id: String(formData.get("member_id")),
    new_role: String(formData.get("role")) as Role,
  });

  if (error) return { error: error.message };
  revalidatePath("/admin");
  return { saved: true };
}


// Returns the staff member if they work at this admin's school, otherwise null.
async function findOwnStaff(memberId: string, schoolId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("school_memberships")
    .select("role, profile:profiles(id, username, full_name)")
    .eq("profile_id", memberId)
    .eq("school_id", schoolId)
    .maybeSingle();
  const member = data as unknown as { role: Role; profile: { id: string; username: string | null; full_name: string } } | null;
  return member?.profile ? { ...member.profile, role: member.role } : null;
}

export type StaffState = { error?: string; added?: string };

// Creates a ready-to-use staff account at the admin's school. Staff log in with a username.
export async function addStaff(_prev: StaffState, formData: FormData): Promise<StaffState> {
  await requireRole(["admin"]);
  const staff = readNewStaff(formData);
  if ("error" in staff) return staff;

  const result = await createStaffAccount(staff, await getSchool());
  if ("error" in result) return result;

  revalidatePath("/admin");
  return { added: `${staff.fullName} can now log in with username "${staff.username}" and the temporary password.` };
}

export type PasswordState = { error?: string; done?: boolean };

// Staff may have no email, so the admin sets a new password for them.
export async function resetStaffPassword(_prev: PasswordState, formData: FormData): Promise<PasswordState> {
  const profile = await requireRole(["admin"]);
  const memberId = String(formData.get("member_id"));
  const password = String(formData.get("password") ?? "");
  if (password.length < 8) return { error: "At least 8 characters." };

  if (!(await findOwnStaff(memberId, profile.school_id))) return { error: "Staff member not found." };

  const admin = createAdminClient();
  if (!admin) return { error: "The SUPABASE_SECRET_KEY is missing from .env.local." };
  // A password set by the admin is temporary: they choose their own at next login.
  const { error } = await admin.auth.admin.updateUserById(memberId, {
    password,
    user_metadata: { must_change_password: true },
  });
  if (error) return { error: error.message };
  return { done: true };
}

export type EditStaffState = { error?: string; saved?: boolean };

// Updates a staff member's name, username, phone and contact email.
export async function updateStaff(_prev: EditStaffState, formData: FormData): Promise<EditStaffState> {
  const profile = await requireRole(["admin"]);
  const field = (key: string) => String(formData.get(key) ?? "").trim();
  const memberId = field("member_id");
  const fullName = field("full_name");
  const phone = field("phone");
  const contactEmail = field("email").toLowerCase();
  const newUsername = field("username").toLowerCase();

  const member = await findOwnStaff(memberId, profile.school_id);
  if (!member) return { error: "Staff member not found." };
  if (!fullName) return { error: "Name can't be empty." };
  if (phone.replace(/\D/g, "").length < 10) return { error: "Please enter a valid phone number." };
  if (contactEmail && !/^\S+@\S+\.\S+$/.test(contactEmail)) return { error: "That email doesn't look right." };

  const admin = createAdminClient();
  if (!admin) return { error: "The SUPABASE_SECRET_KEY is missing from .env.local." };
  const taken = await contactTaken(contactEmail, phone, memberId);
  if (taken) return { error: taken };

  // A new username also changes their hidden login email.
  const usernameChanged = Boolean(member.username) && newUsername !== member.username;
  if (usernameChanged) {
    if (!USERNAME_PATTERN.test(newUsername)) {
      return { error: "Username: 3–30 lowercase letters, numbers, dots or underscores." };
    }
    const { error } = await admin.auth.admin.updateUserById(memberId, {
      email: staffEmail(newUsername),
      email_confirm: true,
    });
    if (error) {
      return {
        error: /already|registered|exists/i.test(error.message)
          ? `The username "${newUsername}" is already taken.`
          : error.message,
      };
    }
  }

  const { error } = await admin
    .from("profiles")
    .update({
      full_name: fullName.slice(0, 100),
      phone: phone.slice(0, 20),
      contact_email: contactEmail || null,
      ...(usernameChanged ? { username: newUsername } : {}),
    })
    .eq("id", memberId);

  if (error) return { error: error.message };
  revalidatePath("/admin");
  return { saved: true };
}

// Username staff accounts are deleted completely. Email accounts (which may also be a parent's account)
// only lose staff access, so the family's children and wallet are kept.
export async function deleteStaff(formData: FormData) {
  const profile = await requireRole(["admin"]);
  const memberId = String(formData.get("member_id"));
  if (memberId === profile.id) return;

  const member = await findOwnStaff(memberId, profile.school_id);
  if (!member) return;

  const admin = createAdminClient();
  const { count } = admin
    ? await admin.from("school_memberships").select("school_id", { count: "exact", head: true }).eq("profile_id", memberId)
    : { count: null };

  // Delete the whole account only if it's a username account that works at no other school.
  if (member.username && admin && count === 1) {
    await admin.auth.admin.deleteUser(memberId);
  } else {
    const supabase = await createClient();
    await supabase.rpc("set_member_role", { member_id: memberId, new_role: "parent" });
  }
  revalidatePath("/admin");
}

export type PartnerState = { error?: string; done?: string };

// A client admin adds a partner as admin of some of their schools: a new account or an existing username.
// They can only give access to schools they are an admin of themselves.
export async function addPartner(_prev: PartnerState, formData: FormData): Promise<PartnerState> {
  const profile = await requireRole(["admin"]);
  const schoolIds = formData.getAll("school_ids").map(String);
  if (schoolIds.length === 0) return { error: "Tick at least one school." };

  const supabase = await createClient();
  const { data: mine } = await supabase
    .from("school_memberships")
    .select("school:schools(id, name, join_code)")
    .eq("profile_id", profile.id)
    .eq("role", "admin");
  const allowed = ((mine ?? []) as unknown as { school: { id: string; name: string; join_code: string } | null }[])
    .map((m) => m.school)
    .filter((s): s is { id: string; name: string; join_code: string } => Boolean(s));
  const chosen = allowed.filter((s) => schoolIds.includes(s.id));
  if (chosen.length !== schoolIds.length) return { error: "You can only add partners to schools you manage." };

  const admin = createAdminClient();
  if (!admin) return { error: "The SUPABASE_SECRET_KEY is missing from .env.local." };

  let partnerId: string;
  let label: string;
  const existing = String(formData.get("existing_username") ?? "").trim().toLowerCase();
  if (existing) {
    const { data: person } = await admin.from("profiles").select("id, full_name").eq("username", existing).maybeSingle();
    if (!person) return { error: `No staff account with username "${existing}".` };
    if (person.id === profile.id) return { error: "That's you." };
    [partnerId, label] = [person.id, person.full_name];
  } else {
    const staff = readNewStaff(formData, "admin");
    if ("error" in staff) return staff;
    const result = await createStaffAccount(staff, chosen[0]);
    if ("error" in result) return result;
    const { data: person } = await admin.from("profiles").select("id").eq("username", staff.username).single();
    if (!person) return { error: "Account created, but couldn't find it to add the schools." };
    [partnerId, label] = [person.id, `${staff.fullName} (username "${staff.username}")`];
  }

  const { error } = await admin
    .from("school_memberships")
    .upsert(chosen.map((s) => ({ profile_id: partnerId, school_id: s.id, role: "admin" })));
  if (error) return { error: error.message };

  revalidatePath("/admin");
  return { done: `${label} is now an admin of ${chosen.map((s) => s.name).join(", ")}.` };
}
