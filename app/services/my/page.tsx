import { redirect } from 'next/navigation';

export default function LegacyMyServicesPage() {
  redirect('/guest/trips#custom-services');
}
