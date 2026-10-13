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

export async function sendMail(opts: { to: string; subject: string; text: string; html?: string }): Promise<{ sent: boolean; error?: string }> {
  const t = getTransporter();
  if (!t) {
    console.log(`\n[email not configured] To: ${opts.to}\nSubject: ${opts.subject}\n\n${opts.text}\n`);
    return { sent: false, error: "SMTP is not configured" };
  }
  try {
    await t.sendMail({ from: process.env.EMAIL_FROM || "Data Room <noreply@example.com>", ...opts });
    return { sent: true };
  } catch (err) {
    // Never let a mail failure break the action that triggered it.
    const message = err instanceof Error ? err.message : String(err);
    console.error(`email to ${opts.to} failed: ${message}`);
    return { sent: false, error: message };
  }
}

/** Verifies the SMTP connection and credentials without sending anything. */
export async function verifySmtp(): Promise<{ ok: boolean; error?: string }> {
  const t = getTransporter();
  if (!t) return { ok: false, error: "SMTP is not configured" };
  try {
    await t.verify();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
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
