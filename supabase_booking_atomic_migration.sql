-- Booking atomic insert guard for experience slot concurrency
-- Apply in Supabase SQL Editor (or your DB migration pipeline)

-- 1) 동일 슬롯 활성 프라이빗 예약 중복 방지
create unique index if not exists idx_bookings_private_active_slot_unique
on public.bookings (experience_id, date, time)
where type = 'private'
  and lower(status::text) in ('pending', 'paid', 'confirmed');

-- 2) 원자적 예약 생성 함수
create or replace function public.create_booking_atomic(
  p_user_id uuid,
  p_experience_id text,
  p_date text,
  p_time text,
  p_guests integer,
  p_is_private boolean,
  p_customer_name text,
  p_customer_phone text
)
returns table (
  new_order_id text,
  final_amount numeric,
  host_id text,
  experience_title text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_experience_id public.experiences.id%type;
  v_host_id text;
  v_title text;
  v_price numeric;
  v_private_price numeric;
  v_max_guests integer;
  v_guest_count integer;
  v_host_price numeric;
  v_fee numeric;
  v_final_amount numeric;
  v_current_booked integer;
  v_has_private_booking boolean;
  v_slot_key text;
  v_new_order_id text;
  v_booking_date date;
  v_booking_time_text text;
begin
  if p_user_id is null
     or coalesce(trim(p_experience_id), '') = ''
     or coalesce(trim(p_date), '') = ''
     or coalesce(trim(p_time), '') = ''
     or coalesce(trim(p_customer_name), '') = ''
     or coalesce(trim(p_customer_phone), '') = '' then
    raise exception 'BOOKING_BAD_REQUEST:Missing required fields' using errcode = 'P0001';
  end if;

  begin
    v_booking_date := p_date::date;
    v_booking_time_text := to_char(p_time::time, 'HH24:MI');
  exception when others then
    raise exception 'BOOKING_BAD_REQUEST:Invalid date/time format' using errcode = 'P0001';
  end;

  select
    e.id,
    e.host_id::text,
    e.title,
    coalesce(e.price, 0),
    coalesce(e.private_price, 0),
    coalesce(e.max_guests, 10)
  into
    v_experience_id,
    v_host_id,
    v_title,
    v_price,
    v_private_price,
    v_max_guests
  from public.experiences e
  where e.id::text = p_experience_id
  limit 1;

  if v_experience_id is null then
    raise exception 'BOOKING_NOT_FOUND:Experience not found' using errcode = 'P0001';
  end if;

  v_guest_count := greatest(coalesce(p_guests, 0), 1);
  v_slot_key := format('%s|%s|%s', v_experience_id::text, v_booking_date::text, v_booking_time_text);

  -- 슬롯 잠금 (같은 체험/날짜/시간 동시 요청 직렬화)
  perform pg_advisory_xact_lock(hashtext(v_slot_key)::bigint);

  select
    coalesce(sum(b.guests), 0)::int,
    coalesce(bool_or(b.type = 'private'), false)
  into
    v_current_booked,
    v_has_private_booking
  from public.bookings b
  where b.experience_id = v_experience_id
    and b.date = v_booking_date
    and b.time = v_booking_time_text
    and lower(b.status::text) in ('pending', 'paid', 'confirmed');

  if v_has_private_booking
     or (p_is_private and v_current_booked > 0)
     or ((not p_is_private) and (v_current_booked + v_guest_count > v_max_guests)) then
    raise exception 'BOOKING_CONFLICT:해당 시간대에 남은 좌석이 부족합니다.' using errcode = 'P0001';
  end if;

  v_host_price := case when p_is_private then v_private_price else v_price * v_guest_count end;
  v_fee := floor(v_host_price * 0.1);
  v_final_amount := v_host_price + v_fee;

  loop
    v_new_order_id := format(
      'ORD-%s-%s',
      to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS'),
      lpad((floor(random() * 1000))::int::text, 3, '0')
    );

    exit when not exists (
      select 1
      from public.bookings b
      where b.order_id = v_new_order_id
         or b.id::text = v_new_order_id
    );
  end loop;

  insert into public.bookings (
    id,
    order_id,
    user_id,
    experience_id,
    amount,
    total_price,
    status,
    guests,
    date,
    time,
    type,
    contact_name,
    contact_phone,
    message,
    created_at
  ) values (
    v_new_order_id,
    v_new_order_id,
    p_user_id,
    v_experience_id,
    v_final_amount,
    v_host_price,
    'PENDING',
    v_guest_count,
    v_booking_date,
    v_booking_time_text,
    case when p_is_private then 'private' else 'group' end,
    p_customer_name,
    p_customer_phone,
    '',
    now()
  );

  return query
  select
    v_new_order_id,
    v_final_amount,
    v_host_id,
    coalesce(v_title, 'Locally 체험');
end;
$$;

grant execute on function public.create_booking_atomic(
  uuid, text, text, text, integer, boolean, text, text
) to anon, authenticated, service_role;
