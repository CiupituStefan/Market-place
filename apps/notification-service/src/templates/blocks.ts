/**
 * A tiny email layout language: templates return blocks, and the same blocks are
 * rendered to HTML (escaped in one place) and to the plain-text alternative.
 */
export type Block =
  | { type: 'heading'; text: string }
  | { type: 'text'; text: string }
  | { type: 'button'; label: string; href: string }
  | { type: 'rows'; rows: { label: string; value: string; strong?: boolean }[] }
  | { type: 'note'; text: string };

export interface EmailContent {
  subject: string;
  /** Inbox preview line. */
  preheader: string;
  blocks: Block[];
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export interface Footer {
  /** Why the recipient gets this email. */
  reason: string;
  unsubscribeUrl: string | null;
}

const BRAND = 'CSE Keyboards';

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/** Only http(s) links are ever rendered: data from events cannot inject `javascript:`. */
function safeHref(href: string): string {
  const url = new URL(href);
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error(`Refusing to render a ${url.protocol} link`);
  }
  return url.toString();
}

const S = {
  body: 'margin:0;padding:0;background:#f4f4f2;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:#18181b;',
  card: 'max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px;',
  brand:
    'font-size:14px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#18181b;margin:0 0 24px;',
  h1: 'font-size:22px;line-height:1.3;margin:0 0 16px;',
  p: 'font-size:15px;line-height:1.6;margin:0 0 16px;',
  button:
    'display:inline-block;background:#18181b;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 22px;border-radius:10px;',
  table: 'width:100%;border-collapse:collapse;margin:0 0 16px;font-size:14px;',
  td: 'padding:6px 0;border-bottom:1px solid #ececea;',
  note: 'font-size:13px;line-height:1.5;color:#71717a;margin:0 0 16px;',
  footer:
    'max-width:560px;margin:0 auto;padding:16px 32px 32px;font-size:12px;line-height:1.5;color:#71717a;',
};

function blockHtml(block: Block): string {
  switch (block.type) {
    case 'heading':
      return `<h1 style="${S.h1}">${escapeHtml(block.text)}</h1>`;
    case 'text':
      return `<p style="${S.p}">${escapeHtml(block.text)}</p>`;
    case 'note':
      return `<p style="${S.note}">${escapeHtml(block.text)}</p>`;
    case 'button':
      return `<p style="${S.p}"><a href="${escapeHtml(safeHref(block.href))}" style="${S.button}">${escapeHtml(block.label)}</a></p>`;
    case 'rows':
      return `<table role="presentation" style="${S.table}">${block.rows
        .map((row) => {
          const weight = row.strong ? 'font-weight:700;' : '';
          return `<tr><td style="${S.td}${weight}">${escapeHtml(row.label)}</td><td style="${S.td}${weight}text-align:right;white-space:nowrap;">${escapeHtml(row.value)}</td></tr>`;
        })
        .join('')}</table>`;
  }
}

function blockText(block: Block): string {
  switch (block.type) {
    case 'heading':
      return block.text.toUpperCase();
    case 'text':
    case 'note':
      return block.text;
    case 'button':
      return `${block.label}: ${safeHref(block.href)}`;
    case 'rows':
      return block.rows.map((row) => `${row.label}  ${row.value}`).join('\n');
  }
}

export function renderEmail(content: EmailContent, footer: Footer): RenderedEmail {
  const footerHtml = [
    escapeHtml(footer.reason),
    footer.unsubscribeUrl
      ? `<a href="${escapeHtml(safeHref(footer.unsubscribeUrl))}" style="color:#71717a;">Unsubscribe</a>`
      : null,
    `${BRAND} · Bucharest, Romania`,
  ]
    .filter(Boolean)
    .join('<br>');

  const html = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(content.subject)}</title></head>
<body style="${S.body}">
<div style="display:none;max-height:0;overflow:hidden;">${escapeHtml(content.preheader)}</div>
<div style="padding:24px 16px;">
<div style="${S.card}">
<p style="${S.brand}">${BRAND}</p>
${content.blocks.map(blockHtml).join('\n')}
</div>
<div style="${S.footer}">${footerHtml}</div>
</div>
</body>
</html>`;

  const text = [
    BRAND,
    '',
    ...content.blocks.flatMap((block) => [blockText(block), '']),
    '--',
    footer.reason,
    footer.unsubscribeUrl ? `Unsubscribe: ${safeHref(footer.unsubscribeUrl)}` : null,
  ]
    .filter((line) => line !== null)
    .join('\n');

  return { subject: content.subject, html, text };
}
