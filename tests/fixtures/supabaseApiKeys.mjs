// Deliberately unsigned fixtures. Never use a project credential in these tests.
export function jwtFixture(role) {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return [
    encode({ alg: 'HS256', typ: 'JWT' }),
    encode({ role, sub: 'fixture-user', exp: 4102444800 }),
    Buffer.from('fixture-not-a-valid-signature').toString('base64url'),
  ].join('.');
}

export const LEGACY_SERVICE_KEY = jwtFixture('service_role');
export const LEGACY_ANON_KEY = jwtFixture('anon');
export const USER_ACCESS_TOKEN = jwtFixture('authenticated');
export const MODERN_SECRET_KEY = 'sb_secret_phase1_fixture_not_a_production_key';
export const MODERN_PUBLISHABLE_KEY = 'sb_publishable_phase1_fixture_not_a_production_key';
