export function shouldHideMobileBottomTab(pathname: string | null | undefined, isHostView = false) {
  if (!pathname) return false;

  const isServicePaymentFlow =
    pathname.startsWith('/services/intro') ||
    pathname.startsWith('/services/request') ||
    pathname.includes('/payment');

  const isHostEditingFlow =
    isHostView &&
    (pathname.startsWith('/host/create') ||
      pathname.startsWith('/host/register') ||
      pathname.startsWith('/host/experiences/'));

  return (
    pathname.startsWith('/admin') ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/signup') ||
    pathname.startsWith('/open-browser') ||
    isServicePaymentFlow ||
    isHostEditingFlow
  );
}
