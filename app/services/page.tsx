import { redirect } from 'next/navigation';
import { createClient } from '@/app/utils/supabase/server';
import { PRIVATE_NOINDEX_METADATA } from '@/app/utils/seo';
import { getHostServiceJobsHref } from '@/app/host/dashboard/navigation';

export const metadata = PRIVATE_NOINDEX_METADATA;

export default async function ServicesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  redirect(getHostServiceJobsHref('open'));
}
