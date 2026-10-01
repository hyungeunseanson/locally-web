import PasswordResetForm from '../PasswordResetForm';

export default async function ForgotPasswordPage({ searchParams }: {
  searchParams: Promise<{ invalid?: string }>;
}) {
  const { invalid } = await searchParams;
  return <PasswordResetForm mode={invalid === '1' ? 'invalid' : 'request'} />;
}
