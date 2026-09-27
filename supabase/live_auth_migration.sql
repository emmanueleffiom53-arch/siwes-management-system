create or replace function public.create_profile_for_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(coalesce(new.email, ''), '@', 1)),
    new.email,
    'student'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

alter table public.profiles add column if not exists profile_image_path text;
alter table public.activities add column if not exists image_path text;
alter table public.profiles add column if not exists organization_id bigint references public.organizations(id) on delete set null;

delete from public.organizations duplicate
using public.organizations canonical
where lower(duplicate.name) = lower(canonical.name)
  and duplicate.id > canonical.id;

create unique index if not exists organizations_name_lower_uidx
  on public.organizations (lower(name));

insert into public.organizations (name)
select distinct trim(organization)
from public.profiles
where nullif(trim(organization), '') is not null
on conflict ((lower(name))) do nothing;

create or replace function public.sync_profile_organization()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if nullif(trim(new.organization), '') is null then
    new.organization_id := null;
    return new;
  end if;

  insert into public.organizations (name)
  values (trim(new.organization))
  on conflict ((lower(name))) do update set name = organizations.name
  returning id into new.organization_id;

  return new;
end;
$$;

drop trigger if exists sync_profile_organization on public.profiles;
create trigger sync_profile_organization
  before insert or update of organization on public.profiles
  for each row execute function public.sync_profile_organization();

update public.profiles
set organization = trim(organization)
where nullif(trim(organization), '') is not null;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'profiles'
  ) then
    alter publication supabase_realtime add table public.profiles;
  end if;
end;
$$;

create or replace function public.current_admin_organization_id()
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select organization_id from public.profiles
  where id = auth.uid() and role = 'admin';
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.create_profile_for_auth_user();

insert into public.profiles (id, full_name, email, role)
select
  users.id,
  coalesce(nullif(trim(users.raw_user_meta_data ->> 'full_name'), ''), split_part(coalesce(users.email, ''), '@', 1)),
  users.email,
  'student'
from auth.users as users
on conflict (id) do nothing;

create or replace function public.prevent_profile_role_escalation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.role is distinct from old.role
    and current_user not in ('postgres', 'service_role')
    and coalesce(auth.role(), '') <> 'service_role'
    and not public.is_admin() then
    raise exception 'Only a supervisor can change account roles';
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_profile_role_escalation on public.profiles;
create trigger prevent_profile_role_escalation
  before update on public.profiles
  for each row execute function public.prevent_profile_role_escalation();

create or replace function public.prevent_student_activity_status_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status is distinct from old.status
    and current_user not in ('postgres', 'service_role')
    and coalesce(auth.role(), '') <> 'service_role'
    and not public.is_admin() then
    raise exception 'Only a supervisor can change activity status';
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_student_activity_status_change on public.activities;
create trigger prevent_student_activity_status_change
  before update on public.activities
  for each row execute function public.prevent_student_activity_status_change();

drop policy if exists "Admins can view all profiles" on public.profiles;
create policy "Supervisors can view students in their organization"
  on public.profiles for select
  using (
    auth.uid() = id
    or (
      role = 'student'
      and public.is_admin()
      and organization_id = public.current_admin_organization_id()
    )
  );

drop policy if exists "Admins can view all activities" on public.activities;
create policy "Supervisors can view activities in their organization"
  on public.activities for select
  using (
    auth.uid() = user_id
    or (
      public.is_admin()
      and exists (
        select 1 from public.profiles student
        where student.id = activities.user_id
          and student.role = 'student'
          and student.organization_id = public.current_admin_organization_id()
      )
    )
  );

drop policy if exists "Admins can update activity status" on public.activities;
create policy "Supervisors can review activities in their organization"
  on public.activities for update
  using (
    auth.uid() = user_id
    or (
      public.is_admin()
      and exists (
        select 1 from public.profiles student
        where student.id = activities.user_id
          and student.role = 'student'
          and student.organization_id = public.current_admin_organization_id()
      )
    )
  )
  with check (
    auth.uid() = user_id
    or (
      public.is_admin()
      and exists (
        select 1 from public.profiles student
        where student.id = activities.user_id
          and student.role = 'student'
          and student.organization_id = public.current_admin_organization_id()
      )
    )
  );

drop policy if exists "Admins can view all reviews" on public.activity_reviews;
create policy "Supervisors can view reviews in their organization"
  on public.activity_reviews for select
  using (
    exists (
      select 1 from public.activities activity
      join public.profiles student on student.id = activity.user_id
      where activity.id = activity_reviews.activity_id
        and student.organization_id = public.current_admin_organization_id()
        and public.is_admin()
    )
    or exists (
      select 1 from public.activities activity
      where activity.id = activity_reviews.activity_id
        and activity.user_id = auth.uid()
    )
  );

drop policy if exists "Admins can create reviews" on public.activity_reviews;
create policy "Supervisors can create reviews in their organization"
  on public.activity_reviews for insert
  with check (
    public.is_admin()
    and auth.uid() = reviewer_id
    and exists (
      select 1 from public.activities activity
      join public.profiles student on student.id = activity.user_id
      where activity.id = activity_reviews.activity_id
        and student.organization_id = public.current_admin_organization_id()
    )
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('siwes-uploads', 'siwes-uploads', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users can read permitted SIWES images" on storage.objects;
create policy "Users can read permitted SIWES images"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'siwes-uploads'
    and (
      split_part(name, '/', 1) = auth.uid()::text
      or (
        public.is_admin()
        and exists (
          select 1 from public.profiles student
          where student.id::text = split_part(storage.objects.name, '/', 1)
            and student.role = 'student'
            and student.organization_id = public.current_admin_organization_id()
        )
      )
    )
  );

drop policy if exists "Users can upload images to own folder" on storage.objects;
create policy "Users can upload images to own folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'siwes-uploads'
    and split_part(name, '/', 1) = auth.uid()::text
  );

drop policy if exists "Users can update images in own folder" on storage.objects;
create policy "Users can update images in own folder"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'siwes-uploads'
    and split_part(name, '/', 1) = auth.uid()::text
  )
  with check (
    bucket_id = 'siwes-uploads'
    and split_part(name, '/', 1) = auth.uid()::text
  );

drop policy if exists "Users can delete images in own folder" on storage.objects;
create policy "Users can delete images in own folder"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'siwes-uploads'
    and split_part(name, '/', 1) = auth.uid()::text
  );