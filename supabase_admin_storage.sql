-- Create the admin_files bucket
insert into storage.buckets (id, name, public)
values ('admin_files', 'admin_files', true)
on conflict (id) do nothing;

-- Ensure RLS is enabled on storage.objects
alter table storage.objects enable row level security;

-- Drop existing policies if they exist (to allow re-running the script)
drop policy if exists "Admin files are publicly accessible" on storage.objects;
drop policy if exists "Only admins can upload files" on storage.objects;
drop policy if exists "Only admins can update files" on storage.objects;
drop policy if exists "Only admins can delete files" on storage.objects;

-- Policy Statement: Anyone can view the files (since it's a public bucket, needed for rendering images)
-- But we could potentially restrict this if we only want authenticated users to see it.
-- For now, to ensure easy embedding in Markdown without complex signed URLs, we allow public read.
create policy "Admin files are publicly accessible"
on storage.objects for select
to public
using ( bucket_id = 'admin_files' );

-- Policy Statement: Only authenticated users with admin role can insert
create policy "Only admins can upload files"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'admin_files' and
  (
    exists (
      select 1 from public.users
      where id = auth.uid() and role = 'admin'
    )
    or
    exists (
      select 1 from public.admin_whitelist
      where email = (select email from auth.users where id = auth.uid())
    )
  )
);

-- Policy Statement: Only admins can update
create policy "Only admins can update files"
on storage.objects for update
to authenticated
using (
  bucket_id = 'admin_files' and
  (
    exists (
      select 1 from public.users
      where id = auth.uid() and role = 'admin'
    )
    or
    exists (
      select 1 from public.admin_whitelist
      where email = (select email from auth.users where id = auth.uid())
    )
  )
);

-- Policy Statement: Only admins can delete
create policy "Only admins can delete files"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'admin_files' and
  (
    exists (
      select 1 from public.users
      where id = auth.uid() and role = 'admin'
    )
    or
    exists (
      select 1 from public.admin_whitelist
      where email = (select email from auth.users where id = auth.uid())
    )
  )
);
