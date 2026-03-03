# Running migrations on your hosted Supabase project

Your app needs the database tables and the **"create profile on signup"** trigger. Use one of the options below.

## Option A: Supabase CLI (recommended)

1. **Install Supabase CLI** (if needed):
   ```bash
   npm install -g supabase
   ```

2. **Log in** (one-time):
   ```bash
   supabase login
   ```

3. **Link your project** (use your project ref from the dashboard URL):
   ```bash
   cd /path/to/Hive
   supabase link --project-ref fhvwsmtivwtmbdscdoyz
   ```
   When prompted for the database password, use the one from **Supabase Dashboard → Project Settings → Database**.

4. **Push all migrations**:
   ```bash
   supabase db push
   ```

This applies every file in `supabase/migrations/` in order, including the new trigger that creates a profile when a user signs up with OTP.

---

## Option B: SQL Editor (manual)

If you prefer not to use the CLI:

1. Open **Supabase Dashboard** → your project → **SQL Editor**.
2. If your database is **empty** (no tables yet), run the full migration file:
   - Open `supabase/combined_migrations.sql` from this repo.
   - Copy its entire contents and paste into a new query in the SQL Editor.
   - Click **Run**.
3. If you **already ran** `combined_migrations.sql` before and only need the new trigger:
   - Open `supabase/migrations/00014_handle_new_user_trigger.sql`.
   - Copy its contents, paste in the SQL Editor, and run it.

---

## After migrations

- **New signups**: When a user verifies OTP, Supabase Auth inserts a row into `auth.users`. The trigger will insert a row into `public.profiles` with default role `parent`. The app can then fetch the profile and redirect to the home screen.
- **Existing users** (who signed up before the trigger): They still have no profile. You can either:
  - Manually insert profile rows for them in the Dashboard → Table Editor → `profiles`, or
  - Run a one-off SQL script that inserts into `profiles` for every `auth.users` id that doesn’t have a profile yet.
