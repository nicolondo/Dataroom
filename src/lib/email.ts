import "server-only";
import nodemailer, { type Transporter } from "nodemailer";

function appUrl(): string {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

export function inviteUrl(token: string): string {
  return `${appUrl()}/invite/${token}`;
}

let transporter: Transporter | null | undefined;

function getTransporter(): Transporter | null {
  if (transporter !== undefined) return transporter;
  const url = process.env.SMTP_URL;
  transporter = url ? nodemailer.createTransport(url) : null;
  return transporter;
}

export function emailConfigured(): boolean {
  return Boolean(process.env.SMTP_URL);
}

export async function sendMail(opts: { to: string; subject: string; text: string; html?: string }): Promise<{ sent: boolean }> {
  const t = getTransporter();
  if (!t) {
    console.log(`\n[email not configured] To: ${opts.to}\nSubject: ${opts.subject}\n\n${opts.text}\n`);
    return { sent: false };
  }
  await t.sendMail({ from: process.env.EMAIL_FROM || "Data Room <noreply@example.com>", ...opts });
  return { sent: true };
}

export async function sendInviteEmail(args: {
  to: string;
  roomName: string;
  inviterName: string;
  token: string;
  message?: string;
  ndaRequired: boolean;
  expiresAt?: Date | null;
}) {
  const link = inviteUrl(args.token);
  const lines = [
    `${args.inviterName} has invited you to the data room "${args.roomName}".`,
    "",
    args.message ? `Message from ${args.inviterName}:\n${args.message}\n` : "",
    `Open the data room: ${link}`,
    "",
    args.ndaRequired ? "You will be asked to sign a non-disclosure agreement before any documents are shown." : "",
    args.expiresAt ? `This invitation expires on ${args.expiresAt.toUTCString()}.` : "",
  ].filter((l) => l !== undefined);
  return sendMail({
    to: args.to,
    subject: `You're invited to the data room "${args.roomName}"`,
    text: lines.join("\n"),
    html: `<p>${escapeHtml(args.inviterName)} has invited you to the data room <strong>${escapeHtml(args.roomName)}</strong>.</p>
${args.message ? `<blockquote>${escapeHtml(args.message)}</blockquote>` : ""}
<p><a href="${link}" style="display:inline-block;padding:10px 18px;background:#1d4ed8;color:#fff;border-radius:6px;text-decoration:none">Open the data room</a></p>
${args.ndaRequired ? "<p>You will be asked to sign a non-disclosure agreement before any documents are shown.</p>" : ""}
${args.expiresAt ? `<p>This invitation expires on ${args.expiresAt.toUTCString()}.</p>` : ""}
<p style="color:#666;font-size:12px">If the button does not work, paste this link in your browser: ${link}</p>`,
  });
}

export async function notifyOwner(args: { to: string; subject: string; text: string }) {
  return sendMail({ to: args.to, subject: args.subject, text: args.text });
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
