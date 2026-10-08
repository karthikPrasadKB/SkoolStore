import "server-only";
import type { Role } from "@/lib/roles";
import { staffEmail, USERNAME_PATTERN } from "@/lib/staff-login";
import { createAdminClient } from "@/lib/supabase/admin";

export const STAFF_ROLES = ["canteen_staff", "counter_staff", "admin"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export type NewStaff = {
  fullName: string;
  username: string;
  phone: string;
  contactEmail: string;
  password: string;
  role: StaffRole;
};

// Reads and checks the "new staff member" fields from a form.
export function readNewStaff(formData: FormData, role?: StaffRole): NewStaff | { error: string } {
  const field = (key: string) => String(formData.get(key) ?? "").trim();
  const staff: NewStaff = {
    fullName: field("full_name"),
    username: field("username").toLowerCase(),
    phone: field("phone"),
    contactEmail: field("email").toLowerCase(),
    password: String(formData.get("password") ?? ""),
    role: role ?? (field("role") as StaffRole),
  };

  if (!staff.fullName) return { error: "Please enter their name." };
  if (!USERNAME_PATTERN.test(staff.username)) {
    return { error: "Username: 3–30 lowercase letters, numbers, dots or underscores (e.g. ramesh.k)." };
  }
  if (staff.phone.replace(/\D/g, "").length < 10) return { error: "Please enter a valid phone number." };
  // Admins must give an email (it's how they're contacted, and for password resets); other staff may skip it.
  if (staff.role === "admin" && !staff.contactEmail) return { error: "Please enter the admin's email." };
  if (staff.contactEmail && !/^\S+@\S+\.\S+$/.test(staff.contactEmail)) {
    return { error: "That email doesn't look right." };
  }
  if (!STAFF_ROLES.includes(staff.role)) return { error: "Please choose a role." };
  if (staff.password.length < 8) return { error: "The temporary password must be at least 8 characters." };
  return staff;
}

// Creates a ready-to-use username login for a staff member at a school.
// Only call this after checking the caller is allowed (a school admin or a superadmin).
export async function createStaffAccount(
  staff: NewStaff,
  school: { id: string; join_code: string },
): Promise<{ error: string } | { ok: true }> {
  const admin = createAdminClient();
  if (!admin) return { error: "Adding staff isn't set up yet: the SUPABASE_SECRET_KEY is missing from .env.local." };

  // The sign-up trigger creates their profile at this school (as a parent); then we make them staff.
  const { data, error } = await admin.auth.admin.createUser({
    email: staffEmail(staff.username),
    password: staff.password,
    email_confirm: true,
    // The password was chosen by someone else, so they must set their own at first login.
    user_metadata: {
      full_name: staff.fullName,
      phone: staff.phone.slice(0, 20),
      school_code: school.join_code,
      must_change_password: true,
    },
  });
  if (error) {
    return {
      error: /already|registered|exists/i.test(error.message)
        ? `The username "${staff.username}" is already taken. Please choose another.`
        : error.message,
    };
  }

  const { error: profileError } = await admin
    .from("profiles")
    .update({ role: staff.role as Role, username: staff.username, contact_email: staff.contactEmail || null })
    .eq("id", data.user.id);
  if (profileError) return { error: `Account created, but saving their details failed: ${profileError.message}` };

  const { error: memberError } = await admin
    .from("school_memberships")
    .insert({ profile_id: data.user.id, school_id: school.id, role: staff.role });
  if (memberError) return { error: `Account created, but adding them to the school failed: ${memberError.message}` };

  return { ok: true };
}

// Creates a client's admin before they have any school. On first login they create their first school.
// Only call this after checking the caller is a superadmin.
export async function createPendingClientAdmin(
  staff: NewStaff,
  clientId: string,
): Promise<{ error: string } | { ok: true }> {
  const admin = createAdminClient();
  if (!admin) return { error: "The SUPABASE_SECRET_KEY is missing from .env.local." };

  const { data, error } = await admin.auth.admin.createUser({
    email: staffEmail(staff.username),
    password: staff.password,
    email_confirm: true,
    // No school yet, so the database skips the school profile for now (see migration 027).
    user_metadata: {
      full_name: staff.fullName,
      phone: staff.phone.slice(0, 20),
      account_type: "client_admin",
      must_change_password: true,
    },
  });
  if (error) {
    return {
      error: /already|registered|exists/i.test(error.message)
        ? `The username "${staff.username}" is already taken. Please choose another.`
        : error.message,
    };
  }

  const { error: linkError } = await admin.from("client_admins").insert({
    user_id: data.user.id,
    client_id: clientId,
    full_name: staff.fullName.slice(0, 100),
    username: staff.username,
    phone: staff.phone.slice(0, 20),
    contact_email: staff.contactEmail || null,
  });
  if (linkError) {
    await admin.auth.admin.deleteUser(data.user.id);
    return { error: `Couldn't link the admin to the client: ${linkError.message}` };
  }
  return { ok: true };
}
