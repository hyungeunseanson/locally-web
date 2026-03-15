const DEFAULT_BANK_ACCOUNT = '3333-14-0254739';
const DEFAULT_BANK_NAME = '카카오뱅크';
const DEFAULT_BANK_ACCOUNT_HOLDER = '로컬리';

export function getPublicBankInfo() {
  const account = process.env.NEXT_PUBLIC_BANK_ACCOUNT || DEFAULT_BANK_ACCOUNT;
  const bankName = process.env.NEXT_PUBLIC_BANK_NAME || DEFAULT_BANK_NAME;
  const accountHolder =
    process.env.NEXT_PUBLIC_BANK_ACCOUNT_HOLDER ||
    process.env.NEXT_PUBLIC_BANK_OWNER ||
    DEFAULT_BANK_ACCOUNT_HOLDER;

  return {
    account,
    bankName,
    accountHolder,
    accountDigits: account.replace(/\D/g, ''),
  };
}
