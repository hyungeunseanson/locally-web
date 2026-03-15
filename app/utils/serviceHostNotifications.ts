import { createAdminClient } from '@/app/utils/supabase/admin';
import { getServiceLocationKey } from '@/app/utils/serviceRequestLocation';

type ServiceHostNotificationsClient = ReturnType<typeof createAdminClient>;

export async function getApprovedHostServiceLocationKeys(
  supabaseAdmin: ServiceHostNotificationsClient,
  hostId: string
) {
  const { data: hostApplication, error: hostApplicationError } = await supabaseAdmin
    .from('host_applications')
    .select('status')
    .eq('user_id', hostId)
    .maybeSingle();

  if (hostApplicationError) {
    throw new Error(`Failed to load host application: ${hostApplicationError.message || 'unknown error'}`);
  }

  if (!hostApplication || hostApplication.status !== 'approved') {
    return {
      isApproved: false,
      locationKeys: new Set<string>(),
    };
  }

  const { data: experiences, error: experiencesError } = await supabaseAdmin
    .from('experiences')
    .select('city, country')
    .eq('host_id', hostId)
    .eq('is_active', true);

  if (experiencesError) {
    throw new Error(`Failed to load host experiences: ${experiencesError.message || 'unknown error'}`);
  }

  const locationKeys = new Set(
    (experiences ?? [])
      .map((experience) => getServiceLocationKey({ city: experience.city, country: experience.country }))
      .filter((key): key is string => Boolean(key))
  );

  return {
    isApproved: true,
    locationKeys,
  };
}

export async function isApprovedHostEligibleForServiceRequest(
  supabaseAdmin: ServiceHostNotificationsClient,
  {
    hostId,
    requestCity,
    requestCountry,
  }: {
    hostId: string;
    requestCity?: string | null;
    requestCountry?: string | null;
  }
) {
  const requestLocationKey = getServiceLocationKey({ city: requestCity, country: requestCountry });
  if (!requestLocationKey) {
    return false;
  }

  const { isApproved, locationKeys } = await getApprovedHostServiceLocationKeys(supabaseAdmin, hostId);
  return isApproved && locationKeys.has(requestLocationKey);
}

export async function getEligibleServiceHostIds(
  supabaseAdmin: ServiceHostNotificationsClient,
  {
    requestCity,
    requestCountry,
    customerId,
  }: {
    requestCity?: string | null;
    requestCountry?: string | null;
    customerId?: string | null;
  }
) {
  const requestLocationKey = getServiceLocationKey({ city: requestCity, country: requestCountry });
  if (!requestLocationKey) {
    return [];
  }

  const { data: hosts, error: hostsError } = await supabaseAdmin
    .from('host_applications')
    .select('user_id')
    .eq('status', 'approved');

  if (hostsError) {
    throw new Error(`Failed to load approved hosts: ${hostsError.message || 'unknown error'}`);
  }

  if (!hosts || hosts.length === 0) {
    return [];
  }

  const { data: experiences, error: experiencesError } = await supabaseAdmin
    .from('experiences')
    .select('host_id, city, country')
    .eq('is_active', true);

  if (experiencesError) {
    throw new Error(`Failed to load active experiences: ${experiencesError.message || 'unknown error'}`);
  }

  const eligibleHostIds = new Set(
    (experiences ?? [])
      .filter((experience) => {
        return (
          getServiceLocationKey({ city: experience.city, country: experience.country }) === requestLocationKey
        );
      })
      .map((experience) => {
        const hostId = experience.host_id;
        return typeof hostId === 'string' ? hostId : '';
      })
      .filter(Boolean)
  );

  return hosts
    .map((host) => {
      const userId = host.user_id;
      return typeof userId === 'string' ? userId : '';
    })
    .filter(
      (hostId) =>
        !!hostId &&
        hostId !== (customerId || '') &&
        eligibleHostIds.has(hostId)
    );
}
