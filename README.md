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

### 4. Add your first school
In the SQL Editor, run (change the name and code as you like):

```sql
insert into public.schools (name, join_code) values ('Demo Public School', 'DEMO01');
```

### 5. Run the app
In the VS Code terminal:

```bash
npm run dev
```

Open http://localhost:3000, click **Create an account**, and use school code `DEMO01`.

### 6. Make yourself the school admin
In the SQL Editor, run (with your email):

```sql
update public.profiles set role = 'admin'
where id = (select id from auth.users where email = 'fakeemail@gmail.com');
```

Refresh the app. You'll now see the Admin page.

## Your company details
The email, phone and address on the landing page come from `src/lib/site.ts`. Edit that file to change them.
Messages sent through the landing page's contact form appear in Supabase → **Table Editor** → `contact_messages`.

## Database changes
Every database change lives in `supabase/migrations/`, numbered in order. Run each new file once in the SQL Editor.
