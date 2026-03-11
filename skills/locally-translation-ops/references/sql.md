# Safe SQL Snippets

## Remaining active tasks

```sql
select count(*) as remaining_tasks
from public.experience_translation_tasks
where status in ('queued','retryable','leased','processing');
```

## Recent failed tasks

```sql
select
  experience_id,
  translation_version,
  target_locale,
  provider,
  status,
  attempt_count,
  last_error,
  completed_at
from public.experience_translation_tasks
where status = 'failed'
order by completed_at desc nulls last
limit 20;
```

## Rule of thumb

- `queued` / `retryable`: do not manually requeue
- `failed`: inspect `last_error` first, then provide targeted requeue SQL
