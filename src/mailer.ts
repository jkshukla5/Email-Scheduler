import nodemailer, { Transporter } from "nodemailer";
import { EmailJobData } from "./queue";

let transporter: Transporter | null = null;

// Creates a free Ethereal (fake SMTP) account on first use.
async function getTransporter(): Promise<Transporter> {
  if (!transporter) {
    const account = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: account.smtp.host,
      port: account.smtp.port,
      secure: account.smtp.secure,
      auth: { user: account.user, pass: account.pass },
    });
    console.log(`[mailer] Ethereal account ready: ${account.user}`);
  }
  return transporter;
}

export async function sendMail(data: EmailJobData) {
  const t = await getTransporter();
  const info = await t.sendMail({
    from: data.sender,
    to: data.to,
    subject: data.subject,
    text: data.body,
  });
  const previewUrl = nodemailer.getTestMessageUrl(info) || null;
  console.log(`[mailer] Sent to ${data.to} -> ${previewUrl}`);
  return { messageId: info.messageId, previewUrl };
}
