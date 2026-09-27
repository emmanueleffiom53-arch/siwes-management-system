# SIWES Management System

A React + Vite MVP for recording SIWES training activities and reviewing them as a supervisor.

## Run locally

```bash
npm install
npm run dev
```

## Live Supabase setup

1. Create a Supabase project.
2. Copy `.env.example` to `.env.local`.
3. Add your project URL and anon key:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

4. For a new database, run `supabase/schema.sql` in the Supabase SQL editor. If the tables already exist, skip this step.
5. Run `supabase/live_auth_migration.sql` in the SQL editor. If you ran an earlier version, run this updated file again; it safely adds image storage, organization-based student assignment, scoped supervisor access, and live roster updates.
6. Register through the app. If email confirmation is enabled, confirm the link before signing in.
7. Promote a trusted account to supervisor from the SQL editor, replacing the email below:

```sql
update public.profiles
set role = 'admin'
where email = 'supervisor@example.edu';
```

Profile photos and student activity images support JPG, PNG, WebP, and GIF files up to 5 MB. The bucket is private; students can upload/read files in their own folder and supervisors can read student attachments. The Supabase URL and publishable key are read from `.env.local`; `.env.local` is ignored by Git. Never put a Supabase service-role key in the browser app. Authentication, profiles, activity records, and supervisor reviews use the live Supabase project.

Students appear automatically in a supervisor's roster when both profiles use the same organization. Supervisors set their organization in their profile; students set their placement organization. Matching is case-insensitive, and supervisor roster/count updates are sent live while the review centre is open. Supervisors can only see students and activities assigned to their organization.

## Layout roles

- Student: Overview, My activities, My profile, and Progress report.
- Supervisor: Review centre with pending activity approval and rejection actions.

Supervisor access is granted only by setting the account's profile role in Supabase. There is no demo role switch.
