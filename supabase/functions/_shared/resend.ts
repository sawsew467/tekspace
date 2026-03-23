// Resend email helper stub
// TODO: Implement khi cần gửi email thực sự

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''

interface SendEmailParams {
  to: string | string[]
  subject: string
  html: string
  from?: string
}

export async function sendEmail({ to, subject, html, from }: SendEmailParams) {
  if (!RESEND_API_KEY) {
    console.warn('[resend] RESEND_API_KEY not set — email not sent')
    return { id: 'stub', from, to, subject }
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: from ?? 'TekSpace <noreply@tekspace.io>',
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
    }),
  })

  if (!res.ok) {
    throw new Error(`Resend API error: ${res.status} ${await res.text()}`)
  }

  return res.json()
}
