insert into storage.buckets (id, name, public)
values ('journal-theme-assets', 'journal-theme-assets', true)
on conflict (id) do update set public = true;

drop policy if exists "public read journal theme assets" on storage.objects;
create policy "public read journal theme assets" on storage.objects
for select to anon, authenticated using (
  bucket_id = 'journal-theme-assets'
  and (storage.foldername(name))[1] = 'journal-themes'
);
