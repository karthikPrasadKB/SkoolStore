// Staff log in with a username. Supabase needs an email, so each username maps to a hidden
// address on a reserved domain (".invalid" can never receive mail).
export const STAFF_EMAIL_DOMAIN = "staff.skoolstore.invalid";

export const USERNAME_PATTERN = /^[a-z0-9._]{3,30}$/;

export function staffEmail(username: string) {
  return `${username.trim().toLowerCase()}@${STAFF_EMAIL_DOMAIN}`;
}

// What someone typed in the login box: an email, or a staff username.
export function loginEmail(emailOrUsername: string) {
  const value = emailOrUsername.trim();
  return value.includes("@") ? value : staffEmail(value);
}
