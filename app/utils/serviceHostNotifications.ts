type ServiceHostNotificationsClient = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string | boolean) => PromiseLike<{
        data: Array<Record<string, unknown>> | null;
        error?: { message?: string } | null;
      }>;
      ilike: (column: string, pattern: string) => {
        eq: (column: string, value: string | boolean) => PromiseLike<{
          data: Array<Record<string, unknown>> | null;
          error?: { message?: string } | null;
        }>;
      };
    };
  };
};

export async function getEligibleServiceHostIds(
  supabaseAdmin: unknown,
  {
    requestCity,
    customerId,
  }: {
    requestCity?: string | null;
    customerId?: string | null;
  }
) {
  const client = supabaseAdmin as ServiceHostNotificationsClient;

  const { data: hosts, error: hostsError } = await client
    .from('host_applications')
    .select('user_id')
    .eq('status', 'approved');

  if (hostsError) {
    throw new Error(`Failed to load approved hosts: ${hostsError.message || 'unknown error'}`);
  }

  if (!hosts || hosts.length === 0) {
    return [];
  }

  let eligibleHostIds: Set<string> | null = null;
  if ((requestCity || '').trim()) {
    const { data: cityHosts, error: cityHostsError } = await client
      .from('experiences')
      .select('host_id')
      .ilike('city', `%${String(requestCity).trim()}%`)
      .eq('is_active', true);

    if (cityHostsError) {
      throw new Error(`Failed to load city-matched hosts: ${cityHostsError.message || 'unknown error'}`);
    }

    eligibleHostIds = new Set(
      (cityHosts ?? [])
        .map((experience) => {
          const hostId = experience.host_id;
          return typeof hostId === 'string' ? hostId : '';
        })
        .filter(Boolean)
    );
  }

  return hosts
    .map((host) => {
      const userId = host.user_id;
      return typeof userId === 'string' ? userId : '';
    })
    .filter(
      (hostId) =>
        !!hostId &&
        hostId !== (customerId || '') &&
        (eligibleHostIds === null || eligibleHostIds.has(hostId))
    );
}
