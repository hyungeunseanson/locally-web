import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import { createClient } from '@supabase/supabase-js';

import { assertStagingTarget } from './staging-target.mjs';

const ONE_PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64'
);
const DEFAULT_STATE_DIRECTORY = '.tmp/supabase-staging';

function requireValue(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function safeRunId(value) {
  if (!/^[a-z0-9][a-z0-9-]{5,63}$/.test(value)) {
    throw new Error('Fixture run id must be 6-64 lowercase letters, digits, or hyphens.');
  }
  return value;
}

function defaultRunId() {
  return safeRunId(`cfcanary-${new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14)}`);
}

function createState(projectRef, runId) {
  return {
    version: 1,
    projectRef,
    runId,
    createdAt: new Date().toISOString(),
    users: {},
    rows: {},
    storage: [],
  };
}

async function saveState(path, state) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
}

async function createSyntheticUser(client, role, runId, password, state, statePath) {
  const email = `locally.staging.${role}.${runId}@example.com`;
  const fullName = `Locally Staging ${role}`;
  const phone = role === 'guest' ? '01090000001' : '01090000002';
  const { data, error } = await client.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      phone,
      birth_date: '19900101',
      gender: 'Other',
      nationality: '대한민국',
      preferred_locale: 'ko',
      locally_fixture_run_id: runId,
    },
  });
  if (error || !data.user?.id) throw error || new Error(`Failed to create ${role} user.`);

  state.users[role] = { id: data.user.id, email, fullName, phone };
  await saveState(statePath, state);

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const { data: profile, error: profileError } = await client
      .from('profiles')
      .select('id')
      .eq('id', data.user.id)
      .maybeSingle();
    if (profileError) throw profileError;
    if (profile?.id) return state.users[role];
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
  }
  throw new Error(`handle_new_user did not create the ${role} profile.`);
}

async function insertOne(client, table, payload, select = 'id') {
  const { data, error } = await client.from(table).insert(payload).select(select).single();
  if (error) throw error;
  return data;
}

async function requireSuccess(label, operation) {
  const { error } = await operation;
  if (error) throw new Error(`${label}: ${error.message || error}`);
}

async function seed(target) {
  const password = requireValue('LOCALLY_STAGING_FIXTURE_PASSWORD');
  const runId = safeRunId(process.env.LOCALLY_STAGING_FIXTURE_RUN_ID?.trim() || defaultRunId());
  const statePath = resolve(
    process.env.LOCALLY_STAGING_FIXTURE_STATE?.trim() ||
      `${DEFAULT_STATE_DIRECTORY}/${runId}.json`
  );
  const state = createState(target.projectRef, runId);
  await saveState(statePath, state);

  const client = createClient(target.url, target.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const guest = await createSyntheticUser(client, 'guest', runId, password, state, statePath);
    const host = await createSyntheticUser(client, 'host', runId, password, state, statePath);

    const hostApplication = await insertOne(client, 'host_applications', {
      user_id: host.id,
      host_nationality: '대한민국',
      languages: ['한국어'],
      language_levels: [{ language: '한국어', level: 5 }],
      name: host.fullName,
      phone: host.phone,
      dob: '1992-04-12',
      email: host.email,
      instagram: '@locally_staging',
      source: 'playwright',
      language_cert: '',
      profile_photo: '/images/logo.png',
      self_intro: `Synthetic host fixture ${runId}`,
      id_card_file: '',
      bank_name: 'STAGING ONLY',
      account_number: '00000000000000',
      account_holder: host.fullName,
      motivation: `Synthetic canary fixture ${runId}`,
      status: 'approved',
    });
    state.rows.hostApplicationId = String(hostApplication.id);
    await saveState(statePath, state);

    const imagePath = `staging-canary/${runId}/experience.png`;
    const { error: imageError } = await client.storage
      .from('experiences')
      .upload(imagePath, ONE_PIXEL_PNG, { contentType: 'image/png', upsert: false });
    if (imageError) throw imageError;
    state.storage.push({ bucket: 'experiences', path: imagePath });
    await saveState(statePath, state);
    const imageUrl = client.storage.from('experiences').getPublicUrl(imagePath).data.publicUrl;

    const experience = await insertOne(client, 'experiences', {
      host_id: host.id,
      country: '대한민국',
      city: '서울',
      title: `[STAGING ${runId}] Cloudflare functional canary`,
      category: '맛집 탐방',
      languages: ['한국어'],
      language_levels: [{ language: '한국어', level: 5 }],
      duration: 2,
      max_guests: 4,
      description: `Synthetic staging experience ${runId}`,
      itinerary: [{ title: '서울역', description: 'Synthetic canary route' }],
      spots: '서울역',
      meeting_point: '서울역 1번 출구',
      location: '서울특별시',
      photos: [imageUrl],
      price: 30000,
      inclusions: ['Synthetic guide'],
      exclusions: ['Production data'],
      supplies: 'None',
      rules: { age_limit: '만 19세 이상', activity_level: '보통' },
      status: 'active',
      is_active: true,
      is_private_enabled: false,
      private_price: 0,
      source_locale: 'ko',
      manual_locales: ['ko'],
      translation_version: 1,
      translation_meta: { fixture_run_id: runId },
    });
    state.rows.experienceId = Number(experience.id);
    state.outputs = { stagingSupabaseImageUrl: imageUrl };
    await saveState(statePath, state);

    const date = new Date();
    date.setUTCDate(date.getUTCDate() + 60);
    const bookingDate = date.toISOString().slice(0, 10);
    await insertOne(client, 'experience_availability', {
      experience_id: state.rows.experienceId,
      date: bookingDate,
      start_time: '10:00',
      is_booked: false,
    }, 'experience_id');
    state.rows.availability = {
      experienceId: state.rows.experienceId,
      date: bookingDate,
      startTime: '10:00',
    };
    await saveState(statePath, state);

    const inquiry = await insertOne(client, 'inquiries', {
      user_id: guest.id,
      host_id: host.id,
      experience_id: String(state.rows.experienceId),
      type: 'general',
      content: `Synthetic inquiry ${runId}`,
      updated_at: new Date().toISOString(),
    });
    state.rows.inquiryId = Number(inquiry.id);
    await saveState(statePath, state);

    const message = await insertOne(client, 'inquiry_messages', {
      inquiry_id: state.rows.inquiryId,
      sender_id: guest.id,
      content: `Synthetic message ${runId}`,
      type: 'text',
      is_read: false,
    });
    state.rows.inquiryMessageId = Number(message.id);
    await saveState(statePath, state);

    const notification = await insertOne(client, 'notifications', {
      user_id: guest.id,
      type: 'new_message',
      title: 'Cloudflare functional canary',
      message: `Synthetic notification ${runId}`,
      link: `/guest/inbox?inquiryId=${state.rows.inquiryId}`,
      is_read: false,
    });
    state.rows.notificationId = Number(notification.id);
    await saveState(statePath, state);

    const bookingId = `STAGING-${runId}`.toUpperCase();
    await insertOne(client, 'bookings', {
      id: bookingId,
      order_id: bookingId,
      user_id: guest.id,
      experience_id: state.rows.experienceId,
      amount: 30000,
      total_price: 30000,
      status: 'PENDING',
      guests: 1,
      date: bookingDate,
      time: '10:00',
      type: 'group',
      contact_name: guest.fullName,
      contact_phone: guest.phone,
      message: `Synthetic sandbox fixture ${runId}`,
      payment_method: 'card',
      is_solo_guarantee: false,
      solo_guarantee_price: 0,
      created_at: new Date().toISOString(),
    });
    state.rows.bookingId = bookingId;
    state.outputs = {
      ...state.outputs,
      guestEmail: guest.email,
      guestUserId: guest.id,
      hostEmail: host.email,
      hostUserId: host.id,
      inquiryId: String(state.rows.inquiryId),
      experienceId: String(state.rows.experienceId),
      bookingId,
    };
    await saveState(statePath, state);

    console.log(JSON.stringify({ statePath, ...state.outputs }, null, 2));
  } catch (error) {
    throw new Error(`Seed failed; run cleanup with state ${statePath}: ${error.message || error}`);
  }
}

async function cleanup(target, statePathArgument) {
  const configuredStatePath = statePathArgument || process.env.LOCALLY_STAGING_FIXTURE_STATE?.trim();
  if (!configuredStatePath) {
    throw new Error('cleanup requires a state-file argument or LOCALLY_STAGING_FIXTURE_STATE.');
  }
  const statePath = resolve(configuredStatePath);
  const state = JSON.parse(await readFile(statePath, 'utf8'));
  if (state.projectRef !== target.projectRef || !state.runId) {
    throw new Error('Fixture state does not belong to the verified staging project.');
  }

  const client = createClient(target.url, target.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const rows = state.rows || {};
  const users = state.users || {};

  if (rows.bookingId) {
    await requireSuccess('delete booking', client.from('bookings').delete().eq('id', rows.bookingId));
  }
  if (rows.notificationId) {
    await requireSuccess(
      'delete notification',
      client.from('notifications').delete().eq('id', rows.notificationId)
    );
  }
  if (rows.inquiryMessageId) {
    await requireSuccess(
      'delete inquiry message',
      client.from('inquiry_messages').delete().eq('id', rows.inquiryMessageId)
    );
  }
  if (rows.inquiryId) {
    await requireSuccess('delete inquiry', client.from('inquiries').delete().eq('id', rows.inquiryId));
  }
  if (rows.availability) {
    await requireSuccess(
      'delete availability',
      client
        .from('experience_availability')
        .delete()
        .eq('experience_id', rows.availability.experienceId)
        .eq('date', rows.availability.date)
        .eq('start_time', rows.availability.startTime)
    );
  }
  if (rows.experienceId) {
    await requireSuccess(
      'delete experience',
      client.from('experiences').delete().eq('id', rows.experienceId)
    );
  }
  if (rows.hostApplicationId) {
    await requireSuccess(
      'delete host application',
      client.from('host_applications').delete().eq('id', rows.hostApplicationId)
    );
  }
  for (const object of [...(state.storage || [])].reverse()) {
    await requireSuccess(
      `delete storage object ${object.bucket}/${object.path}`,
      client.storage.from(object.bucket).remove([object.path])
    );
  }
  for (const user of Object.values(users).reverse()) {
    await requireSuccess(
      'delete private demographics',
      client.from('profile_private_demographics').delete().eq('user_id', user.id)
    );
    await requireSuccess('delete profile', client.from('profiles').delete().eq('id', user.id));
    await requireSuccess('delete user projection row', client.from('users').delete().eq('id', user.id));
    const { error } = await client.auth.admin.deleteUser(user.id);
    if (error) throw error;
  }
  console.log(JSON.stringify({ cleaned: true, projectRef: target.projectRef, runId: state.runId }, null, 2));
}

const [command, statePath] = process.argv.slice(2);
const target = assertStagingTarget();

if (command === 'seed') {
  await seed(target);
} else if (command === 'cleanup') {
  await cleanup(target, statePath);
} else {
  throw new Error('Usage: staging-fixtures.mjs <seed|cleanup> [state-file]');
}
