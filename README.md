# SkoolStore

School canteen ordering and stock management. Built with Next.js, Tailwind CSS and Supabase.

## Who uses it

| Role | Can open |
|---|---|
| School admin | Admin, Menu & stock, Counter |
| Canteen staff | Menu & stock, Counter |
| Counter staff | Counter, Menu & stock (update stock and show/hide items only) |
| Parent | My orders |

Parents sign up themselves and pick their school. Staff accounts are created by the school admin on the Dashboard (**Add staff**).

## First-time setup

### 1. Connect to Supabase
1. In Supabase, open your project → **Project Settings** → **API Keys**.
2. Open `.env.local` in this folder and fill in:
   - `NEXT_PUBLIC_SUPABASE_URL`: your project URL (Project Settings → Data API)
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: the **publishable** key (starts with `sb_publishable_`)
   - `SUPABASE_SECRET_KEY`: a **secret** key (Project Settings → API Keys → Secret keys, starts with `sb_secret_`).
     Needed for admins to create staff accounts. Keep it private: never share it or put it in a `NEXT_PUBLIC_` variable.

### 2. Create the database tables
1. In Supabase, open **SQL Editor** → **New query**.
2. Paste in everything from `supabase/migrations/001_schools_and_profiles.sql` and click **Run**.
3. Do the same for each other file in `supabase/migrations/`, in number order (`002_contact_messages.sql`, …).

### 3. Turn off email confirmation (while testing)
Supabase → **Authentication** → **Sign In / Providers** → section **User Signups** → turn off **Confirm email** → Save.
This lets you sign up test accounts without real email addresses. Turn it back on before going live.

### 4. Create your superadmin login
Superadmins (organisation heads) manage every school from the hidden **HQ** page. There is no sign-up for them;
create the login from the VS Code terminal:

```bash
node scripts/create-superadmin.mjs you@example.com 'A-strong-password'
```

### 5. Run the app
```bash
npm run dev
```

Open http://localhost:3000, log in with the superadmin email and password, and you'll be taken to **HQ**.
From there, **Add a school** together with its first admin. School admins then add their own staff, menu and settings,
and parents sign up and pick their school.

To remove someone's superadmin access, run in the SQL Editor:

```sql
delete from public.platform_admins
where user_id = (select id from auth.users where email = 'you@example.com');
```

## Emails: password reset and sign-up confirmation
1. Supabase → **Authentication** → **URL Configuration** → **Site URL**: `http://localhost:3000` while testing
   (your real web address once live).
2. Supabase → **Authentication** → **Emails** → **Reset Password** template. Replace the link in the message with:

   ```html
   <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery">Reset your password</a>
   ```

   This makes the link work even when the email is opened on a different phone or computer.
   Do the same for the **Confirm signup** template, using `type=email`:

   ```html
   <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email">Confirm your email</a>
   ```

   Then, at go-live, turn **Confirm email** back on (Authentication → Sign In / Providers → User Signups):
   new parents must click that link before they can log in.
3. Supabase's built-in email sender is only for testing (a few emails per hour, and on newer projects only to your
   own team's addresses). Before going live, connect an email service such as Resend under
   **Authentication** → **Emails** → **SMTP Settings**.

Staff who log in with a username can't receive reset emails: their school admin resets their password (🔑 on the
Dashboard).

## Your company details
The email, phone and address on the landing page come from `src/lib/site.ts`. Edit that file to change them.
Messages sent through the landing page's contact form appear in Supabase → **Table Editor** → `contact_messages`.

## Database changes
Every database change lives in `supabase/migrations/`, numbered in order. Run each new file once in the SQL Editor.
