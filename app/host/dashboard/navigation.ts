export const HOST_DASHBOARD_TABS = [
  'reservations',
  'experiences',
  'inquiries',
  'service-jobs',
  'earnings',
  'reviews',
  'guidelines',
  'profile',
] as const;

export type HostDashboardTab = (typeof HOST_DASHBOARD_TABS)[number];

export const HOST_DASHBOARD_DEFAULT_TAB: HostDashboardTab = 'reservations';

export const HOST_SERVICE_JOBS_TABS = ['open', 'applications'] as const;

export type HostServiceJobsTab = (typeof HOST_SERVICE_JOBS_TABS)[number];

export const HOST_SERVICE_JOBS_DEFAULT_TAB: HostServiceJobsTab = 'applications';

const HOST_DASHBOARD_TAB_SET = new Set<string>(HOST_DASHBOARD_TABS);
const HOST_SERVICE_JOBS_TAB_SET = new Set<string>(HOST_SERVICE_JOBS_TABS);

export function normalizeHostDashboardTab(value: string | null | undefined): HostDashboardTab {
  if (value && HOST_DASHBOARD_TAB_SET.has(value)) {
    return value as HostDashboardTab;
  }

  return HOST_DASHBOARD_DEFAULT_TAB;
}

export function normalizeHostServiceJobsTab(value: string | null | undefined): HostServiceJobsTab {
  if (value && HOST_SERVICE_JOBS_TAB_SET.has(value)) {
    return value as HostServiceJobsTab;
  }

  return HOST_SERVICE_JOBS_DEFAULT_TAB;
}

type HostDashboardQueryValue = string | number | boolean | null | undefined;

type HostDashboardHrefOptions = {
  expId?: HostDashboardQueryValue;
  guestId?: HostDashboardQueryValue;
  inquiryId?: HostDashboardQueryValue;
  serviceTab?: HostServiceJobsTab;
};

function appendIfPresent(params: URLSearchParams, key: string, value: HostDashboardQueryValue) {
  if (value === null || value === undefined) {
    return;
  }

  const normalized = String(value).trim();
  if (!normalized) {
    return;
  }

  params.set(key, normalized);
}

export function getHostDashboardHref(
  tab: HostDashboardTab,
  options: HostDashboardHrefOptions = {}
) {
  const params = new URLSearchParams();
  params.set('tab', tab);

  if (tab === 'service-jobs' && options.serviceTab) {
    params.set('serviceTab', normalizeHostServiceJobsTab(options.serviceTab));
  }

  appendIfPresent(params, 'inquiryId', options.inquiryId);
  appendIfPresent(params, 'guestId', options.guestId);
  appendIfPresent(params, 'expId', options.expId);

  return `/host/dashboard?${params.toString()}`;
}

export function getHostServiceJobsHref(
  serviceTab: HostServiceJobsTab = HOST_SERVICE_JOBS_DEFAULT_TAB
) {
  return getHostDashboardHref('service-jobs', { serviceTab });
}
