// Creates (or upgrades) a superadmin login: an organisation head who manages all schools from /hq.
// There is no sign-up for superadmins; only someone with access to this project's secret key can run this.
//
// Usage (in the project folder):
//   node scripts/create-superadmin.mjs head@yourorg.com 'A-strong-password'
//
// To remove someone's superadmin access, run in the Supabase SQL Editor:
//   delete from public.platform_admins where user_id = (select id from auth.users where email = 'head@yourorg.com');

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

// Read the keys from .env.local.
const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((line) => /^\s*[A-Z_]+=/.test(line))
    .map((line) => {
      const i = line.indexOf("=");
      return [line.slice(0, i).trim(), line.slice(i + 1).trim()];
    }),
);

const [email, password] = process.argv.slice(2);
if (!email || !password) {
  console.error("Usage: node scripts/create-superadmin.mjs <email> <password>");
  process.exit(1);
}
if (password.length < 10) {
  console.error("Please use a password of at least 10 characters for a superadmin.");
  process.exit(1);
}
if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SECRET_KEY) {
  console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY must be set in .env.local.");
  process.exit(1);
}

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let userId;
const { data, error } = await admin.auth.admin.createUser({
  email: email.toLowerCase(),
  password,
  email_confirm: true,
  // Tells the database not to expect a school for this account (see migration 023).
  user_metadata: { account_type: "superadmin" },
  app_metadata: { platform_admin: true },
});

if (data?.user) {
  userId = data.user.id;
  console.log(`Created login for ${email}.`);
} else if (error && /already|registered|exists/i.test(error.message)) {
  // An account with this email exists: make it a superadmin too.
  for (let page = 1; !userId; page++) {
    const { data: list, error: listError } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (listError) throw listError;
    userId = list.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())?.id;
    if (list.users.length < 200) break;
  }
  if (!userId) {
    console.error(`An account with ${email} exists but couldn't be found.`);
    process.exit(1);
  }
  console.log(`${email} already has an account (its password is unchanged).`);
} else {
  console.error(`Couldn't create the login: ${error?.message}`);
  process.exit(1);
}

const { error: enrolError } = await admin.from("platform_admins").upsert({ user_id: userId });
if (enrolError) {
  console.error(`Couldn't add them as a superadmin: ${enrolError.message}`);
  process.exit(1);
}
console.log(`✅ ${email} is now a superadmin. Log in, and you'll be taken to the HQ portal (/hq).`);
