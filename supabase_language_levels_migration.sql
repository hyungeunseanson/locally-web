alter table public.host_applications
add column if not exists language_levels jsonb not null default '[]'::jsonb;

update public.host_applications
set language_levels = coalesce(
  (
    select jsonb_agg(
      jsonb_build_object(
        'language',
        lang,
        'level',
        greatest(1, least(5, coalesce(language_level, 3)))
      )
    )
    from unnest(coalesce(languages, '{}'::text[])) as lang
  ),
  '[]'::jsonb
)
where coalesce(jsonb_array_length(language_levels), 0) = 0
  and coalesce(array_length(languages, 1), 0) > 0;

alter table public.experiences
add column if not exists language_levels jsonb not null default '[]'::jsonb;

update public.experiences
set language_levels = coalesce(
  (
    select jsonb_agg(
      jsonb_build_object(
        'language',
        lang,
        'level',
        3
      )
    )
    from unnest(coalesce(languages, '{}'::text[])) as lang
  ),
  '[]'::jsonb
)
where coalesce(jsonb_array_length(language_levels), 0) = 0
  and coalesce(array_length(languages, 1), 0) > 0;
