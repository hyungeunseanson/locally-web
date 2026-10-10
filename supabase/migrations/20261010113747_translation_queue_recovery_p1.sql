-- DRAFT: requires explicit Production SQL approval; installs no historical repair.
-- Legacy Workers lack a lease token in PATCH requests. Reclaim therefore rotates
-- BOTH task identity and experience translation_version, which legacy PATCH filters.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
-- A pre-existing legacy request has no ownership token. Abort installation
-- instead of trying to reinterpret an in-flight lease from the old contract.
LOCK TABLE public.experiences, public.experience_translation_tasks,
 public.experience_translation_jobs, public.translation_provider_state IN SHARE ROW EXCLUSIVE MODE;
DO $$ BEGIN
 IF (SELECT md5(prosrc) FROM pg_proc WHERE oid='public.lease_experience_translation_task(text,timestamptz,integer,integer)'::regprocedure) IS DISTINCT FROM '8491408b09c04b64981f8db80d9a7a60'
  OR (SELECT md5(prosrc) FROM pg_proc WHERE oid='public.lease_experience_translation_task(text,timestamptz,integer)'::regprocedure) IS DISTINCT FROM '20fc4614bc1d1fca566106c378a68d04' THEN
  RAISE EXCEPTION 'translation_lease_catalog_drift';
 END IF;
 IF EXISTS(SELECT 1 FROM public.experience_translation_tasks WHERE status IN ('leased','processing')) THEN
  RAISE EXCEPTION 'translation_migration_requires_no_inflight_leases';
 END IF;
END $$;
CREATE SCHEMA IF NOT EXISTS private;
CREATE TABLE private.translation_completion_receipts (
 task_id uuid PRIMARY KEY, experience_id bigint NOT NULL, translation_version integer NOT NULL,
 target_locale text NOT NULL, payload jsonb NOT NULL, completed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE private.translation_completion_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.translation_completion_receipts FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.translation_locale_payload(p_row jsonb,p_locale text) RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $$
 SELECT jsonb_build_object('title',p_row->('title_'||p_locale),'description',p_row->('description_'||p_locale)) ||
 (SELECT jsonb_object_agg(k,p_row->k->p_locale) FROM unnest(ARRAY['meeting_point_i18n','supplies_i18n','inclusions_i18n','exclusions_i18n','itinerary_i18n','rules_i18n']) k)
$$;

CREATE FUNCTION private.translation_sync_job(p_job uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE s text;
BEGIN
 SELECT CASE WHEN bool_or(status IN ('queued','leased','processing','retryable')) THEN 'processing'
 WHEN bool_or(status='failed') THEN 'failed' WHEN bool_or(status='completed') THEN 'completed' ELSE 'cancelled' END
 INTO s FROM public.experience_translation_tasks WHERE job_id=p_job;
 UPDATE public.experience_translation_jobs SET status=coalesce(s,'cancelled'),
 completed_at=CASE WHEN s='processing' THEN NULL ELSE coalesce(completed_at,now()) END WHERE id=p_job;
END $$;

CREATE FUNCTION private.translation_terminal_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
 IF OLD.status IN ('completed','cancelled') THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER translation_task_terminal_p1 BEFORE UPDATE ON public.experience_translation_tasks
 FOR EACH ROW EXECUTE FUNCTION private.translation_terminal_guard();
CREATE TRIGGER translation_job_terminal_p1 BEFORE UPDATE ON public.experience_translation_jobs
 FOR EACH ROW EXECUTE FUNCTION private.translation_terminal_guard();

CREATE FUNCTION private.translation_legacy_finalize() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE t public.experience_translation_tasks%ROWTYPE; j jsonb; k text; locale text; source_value jsonb; target_value jsonb; changed boolean:=false; body_changed boolean:=false; failure_only boolean:=true;
BEGIN
 -- Source edits advance version and retain their existing authorization path.
 IF NEW.translation_version<>OLD.translation_version THEN RETURN NEW; END IF;
 FOR locale IN SELECT unnest(ARRAY['ko','en','ja','zh']) LOOP
  IF private.translation_locale_payload(to_jsonb(NEW),locale) IS DISTINCT FROM private.translation_locale_payload(to_jsonb(OLD),locale)
    OR NEW.translation_meta->locale IS DISTINCT FROM OLD.translation_meta->locale THEN changed:=true; END IF;
  IF private.translation_locale_payload(to_jsonb(NEW),locale) IS DISTINCT FROM private.translation_locale_payload(to_jsonb(OLD),locale) THEN body_changed:=true; END IF;
  IF NEW.translation_meta->locale IS DISTINCT FROM OLD.translation_meta->locale AND
   (NEW.translation_meta->locale->>'status' IS DISTINCT FROM 'failed' OR
    (NEW.translation_meta->locale->>'version')::integer IS DISTINCT FROM OLD.translation_version OR
    EXISTS(SELECT 1 FROM public.experience_translation_tasks q WHERE q.experience_id=OLD.id AND q.translation_version=OLD.translation_version AND q.target_locale=locale AND q.status='completed')) THEN failure_only:=false; END IF;
 END LOOP;

 -- Host-authenticated editing remains governed by existing RLS; service translation writes are fenced.
 IF current_setting('role',true) NOT IN ('service_role','postgres','none') THEN RETURN NEW; END IF;
 -- Preserve the existing error-reporting path, but never downgrade completion.
 IF changed AND NOT body_changed AND failure_only THEN RETURN NEW; END IF;
 SELECT * INTO t FROM public.experience_translation_tasks WHERE experience_id=OLD.id
  AND translation_version=OLD.translation_version AND status IN ('leased','processing')
  AND lease_expires_at>clock_timestamp()
  AND NEW.translation_meta->target_locale->>'status'='ready'
  AND (NEW.translation_meta->target_locale->>'version')::integer=translation_version
  ORDER BY id LIMIT 1 FOR UPDATE;
 IF NOT FOUND THEN
  IF NOT changed THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'translation_active_lease_required' USING ERRCODE='40001';
 END IF;
 locale:=t.target_locale;
 IF NEW.translation_meta->locale->>'status' IS DISTINCT FROM 'ready'
   OR (NEW.translation_meta->locale->>'version')::integer IS DISTINCT FROM t.translation_version THEN
  RAISE EXCEPTION 'translation_ready_payload_required' USING ERRCODE='23514';
 END IF;
 -- Preserve values assigned by earlier triggers (notably media_revision).
 -- Restore only translation fields before applying the owned locale.
 j:=to_jsonb(NEW)||(SELECT jsonb_object_agg(key,value) FROM jsonb_each(to_jsonb(OLD))
  WHERE key=ANY(ARRAY['title_ko','description_ko','title_en','description_en','title_ja','description_ja','title_zh','description_zh','meeting_point_i18n','supplies_i18n','inclusions_i18n','exclusions_i18n','itinerary_i18n','rules_i18n','translation_meta']));
 -- Only the leased locale may change. Full JSON snapshots from legacy Workers
 -- cannot overwrite other locales. All manual locale fields remain untouched.
 IF NOT(locale=ANY(OLD.manual_locales)) THEN
  IF btrim(coalesce(to_jsonb(NEW)->>('title_'||locale),''))='' OR btrim(coalesce(to_jsonb(NEW)->>('description_'||locale),''))='' THEN
   RAISE EXCEPTION 'translation_complete_text_required' USING ERRCODE='23514';
  END IF;
  j:=j||jsonb_build_object('title_'||locale,to_jsonb(NEW)->('title_'||locale),'description_'||locale,to_jsonb(NEW)->('description_'||locale));
  FOREACH k IN ARRAY ARRAY['meeting_point_i18n','supplies_i18n','inclusions_i18n','exclusions_i18n','itinerary_i18n','rules_i18n'] LOOP
   source_value:=coalesce(nullif(to_jsonb(OLD)->k->t.source_locale,'null'::jsonb),to_jsonb(OLD)->replace(k,'_i18n',''));
   target_value:=to_jsonb(NEW)->k->locale;
   IF source_value IS NOT NULL AND source_value NOT IN ('null'::jsonb,'""'::jsonb,'[]'::jsonb,'{}'::jsonb)
     AND (target_value IS NULL OR target_value IN ('null'::jsonb,'""'::jsonb,'[]'::jsonb,'{}'::jsonb)) THEN
    RAISE EXCEPTION 'translation_complete_fields_required' USING ERRCODE='23514';
   END IF;
   j:=jsonb_set(j,ARRAY[k],(coalesce(nullif(j->k,'null'::jsonb),'{}'::jsonb)-locale)||CASE WHEN target_value IS NULL THEN '{}'::jsonb ELSE jsonb_build_object(locale,target_value) END);
  END LOOP;
 END IF;
 IF locale=ANY(OLD.manual_locales) THEN
  IF btrim(coalesce(to_jsonb(OLD)->>('title_'||locale),''))='' OR btrim(coalesce(to_jsonb(OLD)->>('description_'||locale),''))='' THEN
   RAISE EXCEPTION 'translation_manual_text_incomplete' USING ERRCODE='23514';
  END IF;
 END IF;
 j:=jsonb_set(j,ARRAY['translation_meta'],coalesce(j->'translation_meta','{}')||jsonb_build_object(locale,jsonb_build_object('mode',CASE WHEN locale=ANY(OLD.manual_locales) THEN 'manual' ELSE 'ai' END,'status','ready','version',t.translation_version)));
 NEW:=jsonb_populate_record(NEW,j);
 INSERT INTO private.translation_completion_receipts(task_id,experience_id,translation_version,target_locale,payload)
 VALUES(t.id,t.experience_id,t.translation_version,locale,private.translation_locale_payload(to_jsonb(NEW),locale));
 UPDATE public.experience_translation_tasks SET status='completed',completed_at=now(),lease_expires_at=NULL,last_error=NULL WHERE id=t.id;
 PERFORM private.translation_sync_job(t.job_id);
 RETURN NEW;
END $$;
CREATE TRIGGER translation_legacy_finalize_p1 BEFORE UPDATE OF title_ko,description_ko,title_en,description_en,title_ja,description_ja,title_zh,description_zh,meeting_point_i18n,supplies_i18n,inclusions_i18n,exclusions_i18n,itinerary_i18n,rules_i18n,translation_meta ON public.experiences
 FOR EACH ROW EXECUTE FUNCTION private.translation_legacy_finalize();

CREATE FUNCTION private.translation_recover_expired() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE e public.experiences%ROWTYPE; next_version integer; new_job uuid; old_job uuid; n integer:=0;
BEGIN
 -- Bound each wake; lock experiences before tasks, same order as finalization.
 FOR e IN SELECT x.* FROM public.experiences x WHERE EXISTS(
  SELECT 1 FROM public.experience_translation_tasks t WHERE t.experience_id=x.id
   AND ((t.translation_version<x.translation_version AND t.status IN ('queued','leased','processing','retryable'))
    OR (t.translation_version=x.translation_version AND ((t.status IN ('leased','processing') AND t.lease_expires_at<=clock_timestamp()) OR t.status='retryable'))))
 ORDER BY x.id LIMIT 16 FOR UPDATE OF x SKIP LOCKED LOOP
  -- A source edit supersedes old work; do not leave a stale first row blocking
  -- current dispatch, or rotate the newer source merely to cancel an old task.
  FOR old_job IN SELECT DISTINCT job_id FROM public.experience_translation_tasks
   WHERE experience_id=e.id AND translation_version<e.translation_version
    AND status IN ('queued','leased','processing','retryable') ORDER BY job_id LOOP
   UPDATE public.experience_translation_tasks SET status='cancelled',completed_at=now(),lease_expires_at=NULL,last_error='superseded_by_source_version'
    WHERE job_id=old_job AND translation_version<e.translation_version AND status IN ('queued','leased','processing','retryable');
   PERFORM private.translation_sync_job(old_job);
  END LOOP;
  IF NOT EXISTS(SELECT 1 FROM public.experience_translation_tasks t WHERE t.experience_id=e.id AND t.translation_version=e.translation_version
   AND ((t.status IN ('leased','processing') AND t.lease_expires_at<=clock_timestamp()) OR t.status='retryable')) THEN CONTINUE; END IF;
  next_version:=greatest(e.translation_version,coalesce((SELECT max(translation_version) FROM public.experience_translation_jobs WHERE experience_id=e.id),0))+1;
  -- New version fences a late legacy experience PATCH; fresh task IDs fence its
  -- unqualified task PATCH. Preserve terminal tasks as historical evidence.
  UPDATE public.experiences SET translation_version=next_version WHERE id=e.id AND translation_version=e.translation_version;
  INSERT INTO public.experience_translation_jobs(experience_id,translation_version,source_locale,status)
   VALUES(e.id,next_version,e.source_locale,'queued') RETURNING id INTO new_job;
  INSERT INTO public.experience_translation_tasks(job_id,experience_id,translation_version,source_locale,target_locale,provider,status,attempt_count,priority,not_before)
   SELECT new_job,t.experience_id,next_version,t.source_locale,t.target_locale,t.provider,'queued',t.attempt_count,t.priority,t.not_before
   FROM public.experience_translation_tasks t WHERE t.experience_id=e.id AND t.translation_version=e.translation_version
   AND t.status IN ('queued','leased','processing','retryable');
  FOR old_job IN SELECT DISTINCT job_id FROM public.experience_translation_tasks WHERE experience_id=e.id AND translation_version=e.translation_version LOOP
   UPDATE public.experience_translation_tasks SET status='cancelled',completed_at=now(),lease_expires_at=NULL,last_error='superseded_by_recovery_generation'
    WHERE job_id=old_job AND status IN ('queued','leased','processing','retryable');
   PERFORM private.translation_sync_job(old_job);
  END LOOP;
  n:=n+1;
 END LOOP;
 RETURN n;
END $$;

CREATE FUNCTION public.finalize_experience_translation_task(p_task_id uuid,p_translation_version integer,p_lease_expires_at timestamptz,p_payload jsonb) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE t public.experience_translation_tasks%ROWTYPE; e public.experiences%ROWTYPE; j jsonb; k text;
BEGIN
 SELECT * INTO t FROM public.experience_translation_tasks WHERE id=p_task_id;
 IF NOT FOUND THEN RETURN false; END IF;
 SELECT * INTO e FROM public.experiences WHERE id=t.experience_id FOR UPDATE;
 SELECT * INTO t FROM public.experience_translation_tasks WHERE id=p_task_id FOR UPDATE;
 IF t.status='completed' THEN
  RETURN EXISTS(SELECT 1 FROM private.translation_completion_receipts r WHERE r.task_id=t.id
   AND e.translation_version=p_translation_version AND r.translation_version=p_translation_version AND r.payload=private.translation_locale_payload(to_jsonb(e),t.target_locale));
 END IF;
 IF t.status NOT IN ('leased','processing') OR t.translation_version<>p_translation_version OR e.translation_version<>p_translation_version
  OR t.lease_expires_at IS DISTINCT FROM p_lease_expires_at THEN RETURN false; END IF;
 IF t.lease_expires_at IS NULL OR t.lease_expires_at<=clock_timestamp() THEN
  RAISE EXCEPTION 'translation_lease_expired_retry' USING ERRCODE='40001';
 END IF;
 IF jsonb_typeof(p_payload) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'translation_payload_object_required' USING ERRCODE='23514'; END IF;
 FOR k IN SELECT jsonb_object_keys(p_payload) LOOP
  IF k<>ALL(ARRAY['title_'||t.target_locale,'description_'||t.target_locale,'meeting_point_i18n','supplies_i18n','inclusions_i18n','exclusions_i18n','itinerary_i18n','rules_i18n','translation_meta']) THEN
   RAISE EXCEPTION 'translation_payload_field_forbidden' USING ERRCODE='23514';
  END IF;
 END LOOP;
 j:=to_jsonb(e)||p_payload;
 j:=jsonb_set(j,ARRAY['translation_meta'],coalesce(e.translation_meta,'{}')||jsonb_build_object(t.target_locale,jsonb_build_object('mode','ai','status','ready','version',t.translation_version)));
 -- The same guarded trigger provides the legacy bridge and the atomic task/job commit.
 UPDATE public.experiences SET
  title_ko=j->>'title_ko',description_ko=j->>'description_ko',title_en=j->>'title_en',description_en=j->>'description_en',
  title_ja=j->>'title_ja',description_ja=j->>'description_ja',title_zh=j->>'title_zh',description_zh=j->>'description_zh',
  meeting_point_i18n=j->'meeting_point_i18n',supplies_i18n=j->'supplies_i18n',inclusions_i18n=j->'inclusions_i18n',exclusions_i18n=j->'exclusions_i18n',
  itinerary_i18n=j->'itinerary_i18n',rules_i18n=j->'rules_i18n',translation_meta=j->'translation_meta'
 WHERE id=e.id AND translation_version=p_translation_version;
 IF NOT EXISTS(SELECT 1 FROM private.translation_completion_receipts WHERE task_id=t.id) THEN
  RAISE EXCEPTION 'translation_atomic_receipt_missing' USING ERRCODE='40001';
 END IF;
 RETURN true;
END $$;

-- Keep public OIDs, dependencies and overload contracts. Clone the checked
-- provider-limit implementations privately, then replace the public bodies.
-- Add per-experience serialization to both captured existing implementations.
DO $$ DECLARE p record; d text;
BEGIN
 FOR p IN SELECT oid,oidvectortypes(proargtypes) AS args FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname='lease_experience_translation_task' LOOP
  d:=pg_get_functiondef(p.oid);
  d:=replace(d,'AND experience_translation_tasks.not_before <= p_now',
   'AND experience_translation_tasks.not_before <= p_now AND EXISTS (SELECT 1 FROM public.experiences current_source WHERE current_source.id=experience_translation_tasks.experience_id AND current_source.translation_version=experience_translation_tasks.translation_version) AND NOT EXISTS (SELECT 1 FROM public.experience_translation_tasks active WHERE active.experience_id=experience_translation_tasks.experience_id AND active.status IN (''leased'',''processing'') AND active.lease_expires_at>clock_timestamp())');
  IF d=pg_get_functiondef(p.oid) THEN RAISE EXCEPTION 'translation_lease_source_contract_changed'; END IF;
  d:=replace(d,'FUNCTION public.lease_experience_translation_task(', 'FUNCTION private.lease_experience_translation_task(');
  IF to_regprocedure('private.lease_experience_translation_task('||p.args||')') IS NOT NULL THEN
   RAISE EXCEPTION 'translation_private_lease_already_exists';
  END IF;
  EXECUTE d;
 END LOOP;
END $$;
CREATE OR REPLACE FUNCTION public.lease_experience_translation_task(p_provider text,p_now timestamptz DEFAULT timezone('utc',now()),p_lease_seconds integer DEFAULT 180,p_reserved_tokens integer DEFAULT 0)
RETURNS TABLE(id uuid,job_id uuid,experience_id bigint,translation_version integer,source_locale text,target_locale text,provider text,attempt_count integer,priority integer,lease_expires_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE leased record; current_version integer;
BEGIN
 PERFORM private.translation_recover_expired();
 BEGIN
  SELECT * INTO leased FROM private.lease_experience_translation_task(p_provider,p_now,p_lease_seconds,p_reserved_tokens);
  IF NOT FOUND THEN RETURN; END IF;
  SELECT x.translation_version INTO current_version FROM public.experiences x WHERE x.id=leased.experience_id FOR UPDATE NOWAIT;
  IF current_version<>leased.translation_version OR EXISTS(SELECT 1 FROM public.experience_translation_tasks t WHERE t.experience_id=leased.experience_id AND t.id<>leased.id AND t.status IN ('leased','processing') AND t.lease_expires_at>clock_timestamp()) THEN
   RAISE lock_not_available;
  END IF;
  RETURN QUERY SELECT leased.id,leased.job_id,leased.experience_id,leased.translation_version,leased.source_locale,leased.target_locale,leased.provider,leased.attempt_count,leased.priority,leased.lease_expires_at;
 EXCEPTION WHEN lock_not_available THEN RETURN;
 END;
END $$;
CREATE OR REPLACE FUNCTION public.lease_experience_translation_task(p_provider text,p_now timestamptz DEFAULT timezone('utc',now()),p_lease_seconds integer DEFAULT 180)
RETURNS TABLE(id uuid,job_id uuid,experience_id bigint,translation_version integer,source_locale text,target_locale text,provider text,attempt_count integer,priority integer,lease_expires_at timestamptz)
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT * FROM public.lease_experience_translation_task(p_provider,p_now,p_lease_seconds,0)
$$;
REVOKE ALL ON FUNCTION private.lease_experience_translation_task(text,timestamptz,integer,integer),private.lease_experience_translation_task(text,timestamptz,integer) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION private.translation_locale_payload(jsonb,text),private.translation_sync_job(uuid),private.translation_terminal_guard(),private.translation_legacy_finalize(),private.translation_recover_expired() FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.finalize_experience_translation_task(uuid,integer,timestamptz,jsonb),public.lease_experience_translation_task(text,timestamptz,integer,integer),public.lease_experience_translation_task(text,timestamptz,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_experience_translation_task(uuid,integer,timestamptz,jsonb),public.lease_experience_translation_task(text,timestamptz,integer,integer),public.lease_experience_translation_task(text,timestamptz,integer) TO service_role;
-- Pin ownership rather than inheriting an operator-specific migration owner.
ALTER TABLE private.translation_completion_receipts OWNER TO postgres;
ALTER FUNCTION private.lease_experience_translation_task(text,timestamptz,integer,integer) OWNER TO postgres;
ALTER FUNCTION private.lease_experience_translation_task(text,timestamptz,integer) OWNER TO postgres;
ALTER FUNCTION private.translation_locale_payload(jsonb,text) OWNER TO postgres;
ALTER FUNCTION private.translation_sync_job(uuid) OWNER TO postgres;
ALTER FUNCTION private.translation_terminal_guard() OWNER TO postgres;
ALTER FUNCTION private.translation_legacy_finalize() OWNER TO postgres;
ALTER FUNCTION private.translation_recover_expired() OWNER TO postgres;
ALTER FUNCTION public.finalize_experience_translation_task(uuid,integer,timestamptz,jsonb) OWNER TO postgres;
ALTER FUNCTION public.lease_experience_translation_task(text,timestamptz,integer,integer) OWNER TO postgres;
ALTER FUNCTION public.lease_experience_translation_task(text,timestamptz,integer) OWNER TO postgres;
NOTIFY pgrst, 'reload schema';
COMMIT;
