"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import type { Role } from "@/lib/roles";
import { getSchool } from "@/lib/school";
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

const STAFF_ROLES = ["canteen_staff", "counter_staff", "admin"] as const;

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
  const field = (key: string) => String(formData.get(key) ?? "").trim();
  const fullName = field("full_name");
  const username = field("username").toLowerCase();
  const phone = field("phone");
  const contactEmail = field("email").toLowerCase();
  const role = field("role") as (typeof STAFF_ROLES)[number];
  const password = String(formData.get("password") ?? "");

  if (!fullName) return { error: "Please enter their name." };
  if (!USERNAME_PATTERN.test(username)) {
    return { error: "Username: 3–30 lowercase letters, numbers, dots or underscores (e.g. ramesh.k)." };
  }
  if (phone.replace(/\D/g, "").length < 10) return { error: "Please enter a valid phone number." };
  if (contactEmail && !/^\S+@\S+\.\S+$/.test(contactEmail)) return { error: "That email doesn't look right." };
  if (!STAFF_ROLES.includes(role)) return { error: "Please choose a role." };
  if (password.length < 8) return { error: "The temporary password must be at least 8 characters." };

  const admin = createAdminClient();
  if (!admin) return { error: "Adding staff isn't set up yet: the SUPABASE_SECRET_KEY is missing from .env.local." };

  const school = await getSchool();
  // The sign-up trigger creates their profile at this school (as a parent); then we make them staff.
  const { data, error } = await admin.auth.admin.createUser({
    email: staffEmail(username),
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, phone: phone.slice(0, 20), school_code: school.join_code },
  });

  if (error) {
    return {
      error: /already|registered|exists/i.test(error.message)
        ? `The username "${username}" is already taken. Please choose another.`
        : error.message,
    };
  }

  const { error: profileError } = await admin
    .from("profiles")
    .update({ role, username, contact_email: contactEmail || null })
    .eq("id", data.user.id);
  if (profileError) return { error: `Account created, but saving their details failed: ${profileError.message}` };

  const { error: memberError } = await admin
    .from("school_memberships")
    .insert({ profile_id: data.user.id, school_id: school.id, role });
  if (memberError) return { error: `Account created, but adding them to the school failed: ${memberError.message}` };

  revalidatePath("/admin");
  return { added: `${fullName} can now log in with username "${username}" and the temporary password.` };
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
  const { error } = await admin.auth.admin.updateUserById(memberId, { password });
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
