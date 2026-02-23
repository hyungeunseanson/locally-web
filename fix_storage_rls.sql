-- Drop faulty policies
drop policy if exists "Only admins can upload files" on storage.objects;
drop policy if exists "Only admins can update files" on storage.objects;
drop policy if exists "Only admins can delete files" on storage.objects;

-- Create valid policies using auth.jwt() ->> 'email' instead of querying auth.users which causes permission denied
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
      where email = auth.jwt() ->> 'email'
    )
  )
);

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
      where email = auth.jwt() ->> 'email'
    )
  )
);

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
      where email = auth.jwt() ->> 'email'
    )
  )
);
