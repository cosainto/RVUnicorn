import { h1, p, btn } from '../baseTemplate';

export function passwordReset(data: { email: string; resetUrl: string }) {
  return {
    subject: 'Reset your RVUnicorn password \u{1F510}',
    previewText: 'This link expires in 1 hour.',
    bodyHtml: [
      h1("Password reset requested"),
      p(`Someone (hopefully you) asked to reset the password for <strong style="color:#F5F0E8;">${data.email}</strong>.`),
      p('Click the button below to set a new password. This link expires in <strong style="color:#F5F0E8;">1 hour</strong>.'),
      btn(data.resetUrl, 'Reset My Password \u2192'),
      p('If you didn\'t request this, <a href="mailto:hello@rvunicorn.com" style="color:#E8A838;">let us know</a> and we\'ll lock things down. Your rig isn\'t the only thing that needs good security.'),
    ].join('\n'),
  };
}

export function emailChange(data: { firstName: string; newEmail: string; confirmUrl: string }) {
  return {
    subject: 'Confirm your new email address',
    previewText: 'Click to confirm your email change on RVUnicorn.',
    bodyHtml: [
      h1("Confirm your new email"),
      p(`Hey ${data.firstName}, you requested to change your email to <strong style="color:#F5F0E8;">${data.newEmail}</strong>.`),
      p('Click below to confirm this change:'),
      btn(data.confirmUrl, 'Confirm Email Change \u2192'),
      p("If you didn't request this change, you can safely ignore this email."),
    ].join('\n'),
  };
}

export function accountDeleted(data: { firstName: string }) {
  return {
    subject: 'Your RVUnicorn account has been deleted',
    previewText: "We're sorry to see you go.",
    bodyHtml: [
      h1(`Goodbye, ${data.firstName} \u{1F44B}`),
      p("Your RVUnicorn account has been deleted as requested. All your personal data will be removed within 30 days."),
      p("If this was a mistake or you change your mind, reach out to us within 30 days at <a href=\"mailto:hello@rvunicorn.com\" style=\"color:#E8A838;\">hello@rvunicorn.com</a> and we'll try to restore your account."),
      p("The roads will still be there if you come back. \u{1F690}"),
    ].join('\n'),
  };
}
