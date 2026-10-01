import type { LoginModalLocale } from './loginModalLocalization';

type PasswordResetCopy = {
  forgotLink: string;
  title: string;
  description: string;
  send: string;
  sent: string;
  retryLater: string;
  invalid: string;
  requestAgain: string;
  updateTitle: string;
  newPassword: string;
  update: string;
  updateFailed: string;
  success: string;
  cleanupFailed: string;
  finish: string;
  guidance: string;
};

const COPY: Record<LoginModalLocale, PasswordResetCopy> = {
  ko: {
    forgotLink: '비밀번호를 잊으셨나요?',
    title: '비밀번호 재설정',
    description: '이메일로 가입한 계정의 비밀번호를 재설정할 수 있습니다. 메일 링크는 요청한 브라우저에서 열어주세요. 소셜 로그인은 기존 로그인 수단을 이용해주세요.',
    send: '재설정 이메일 요청',
    sent: '입력한 이메일로 가입된 계정이 있다면 비밀번호 재설정 안내 메일을 보내드렸습니다.',
    retryLater: '잠시 후 다시 시도해주세요.',
    invalid: '재설정 링크가 만료되었거나 유효하지 않습니다. 요청한 브라우저에서 열거나 새 이메일을 요청해주세요.',
    requestAgain: '재설정 이메일 다시 요청',
    updateTitle: '새 비밀번호 설정',
    newPassword: '새 비밀번호',
    update: '비밀번호 변경',
    updateFailed: '비밀번호를 변경하지 못했습니다. 입력 내용을 확인하고 다시 시도해주세요.',
    success: '비밀번호가 변경되었습니다. 새 비밀번호로 로그인해주세요.',
    cleanupFailed: '비밀번호가 변경되었습니다. 로그인으로 이동하기 전에 세션 정리를 다시 시도해주세요.',
    finish: '로그인으로 이동',
    guidance: '로그인 화면의 “비밀번호를 잊으셨나요?”에서 재설정 이메일을 요청하세요. 이메일 링크는 요청한 브라우저에서 열어주세요. 소셜 로그인 계정은 기존 로그인 수단을 이용해주세요.',
  },
  en: {
    forgotLink: 'Forgot your password?', title: 'Reset password',
    description: 'Reset the password for an email account. Open the email link in the browser where you requested it. For social accounts, use your original sign-in method.',
    send: 'Request reset email', sent: 'If an account exists for this email address, we have sent password reset instructions.',
    retryLater: 'Please try again in a little while.',
    invalid: 'This reset link is invalid or has expired. Open it in the browser where you requested it, or request a new email.',
    requestAgain: 'Request another reset email', updateTitle: 'Set a new password', newPassword: 'New password',
    update: 'Change password', updateFailed: 'Unable to change the password. Check your input and try again.',
    success: 'Your password has changed. Log in with your new password.',
    cleanupFailed: 'Your password has changed. Please retry session cleanup before continuing to login.',
    finish: 'Continue to login',
    guidance: 'Use “Forgot your password?” on the login screen to request a reset email. Open the link in the browser where you requested it. For social accounts, use your original sign-in method.',
  },
  ja: {
    forgotLink: 'パスワードをお忘れですか？', title: 'パスワード再設定',
    description: 'メールで登録したアカウントのパスワードを再設定できます。メールのリンクは申請したブラウザで開いてください。ソーシャルログインは元の方法をご利用ください。',
    send: '再設定メールを申請', sent: '入力したメールアドレスのアカウントがある場合、パスワード再設定の案内を送信しました。',
    retryLater: 'しばらくしてからもう一度お試しください。',
    invalid: 'リンクが無効か期限切れです。申請したブラウザで開くか、新しいメールを申請してください。',
    requestAgain: '再設定メールを再申請', updateTitle: '新しいパスワードを設定', newPassword: '新しいパスワード',
    update: 'パスワードを変更', updateFailed: 'パスワードを変更できませんでした。入力内容を確認して再度お試しください。',
    success: 'パスワードを変更しました。新しいパスワードでログインしてください。',
    cleanupFailed: 'パスワードを変更しました。ログインに進む前にセッションの終了を再度お試しください。',
    finish: 'ログインへ進む',
    guidance: 'ログイン画面の「パスワードをお忘れですか？」から再設定メールを申請してください。リンクは申請したブラウザで開いてください。ソーシャルログインは元の方法をご利用ください。',
  },
  zh: {
    forgotLink: '忘记密码了吗？', title: '重置密码',
    description: '可重置邮箱注册账号的密码。请在申请时使用的浏览器中打开邮件链接。社交账号请使用原登录方式。',
    send: '申请重置邮件', sent: '如果该邮箱已注册账号，我们已发送密码重置说明。',
    retryLater: '请稍后再试。', invalid: '重置链接无效或已过期。请在申请时使用的浏览器中打开，或重新申请邮件。',
    requestAgain: '重新申请重置邮件', updateTitle: '设置新密码', newPassword: '新密码', update: '修改密码',
    updateFailed: '无法修改密码。请检查输入后重试。', success: '密码已修改。请使用新密码登录。',
    cleanupFailed: '密码已修改。请重试结束当前会话后再前往登录。', finish: '前往登录',
    guidance: '在登录页面点击“忘记密码了吗？”申请重置邮件。请在申请时使用的浏览器中打开链接。社交账号请使用原登录方式。',
  },
};

export function getPasswordResetCopy(locale: string): PasswordResetCopy {
  return COPY[locale as LoginModalLocale] ?? COPY.ko;
}
