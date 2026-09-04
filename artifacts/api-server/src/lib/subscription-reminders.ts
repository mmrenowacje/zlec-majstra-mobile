import nodemailer from "nodemailer";
import { and, eq, gt, lt, lte, sql } from "drizzle-orm";
import {
  db,
  profilesTable,
  subscriptionRemindersTable,
  subscriptionsTable,
} from "@workspace/db";
import { logger } from "./logger";

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const REMINDER_WINDOW_DAYS = 3;
const REMINDER_INTERVAL_MS = 15 * 60 * 1000;

type RenewalEmail = {
  to: string;
  messageId: string;
  subject: string;
  text: string;
  html: string;
};

type RenewalEmailSender = (message: RenewalEmail) => Promise<void>;

let missingConfigurationLogged = false;

function publicAppUrl() {
  return (process.env.PUBLIC_APP_URL ?? "https://zlecmajstra.pl").replace(/\/$/, "");
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function smtpConfiguration() {
  const missing = ["SMTP_HOST", "SMTP_FROM"].filter(
    (name) => !process.env[name],
  );
  if (missing.length > 0) return { missing } as const;

  const port = Number(process.env.SMTP_PORT ?? 587);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    return { missing: ["SMTP_PORT"] } as const;
  }

  return {
    host: process.env.SMTP_HOST as string,
    port,
    secure: process.env.SMTP_SECURE === "true" || port === 465,
    from: process.env.SMTP_FROM as string,
    auth:
      process.env.SMTP_USER && process.env.SMTP_PASSWORD
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
        : undefined,
  } as const;
}

async function sendRenewalEmail(message: RenewalEmail) {
  const config = smtpConfiguration();
  if ("missing" in config && config.missing) {
    throw new Error(`SMTP is not configured: ${config.missing.join(", ")}`);
  }

  const transport = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    ...(config.auth ? { auth: config.auth } : {}),
  });
  await transport.sendMail({
    from: config.from,
    to: message.to,
    messageId: message.messageId,
    subject: message.subject,
    text: message.text,
    html: message.html,
  });
}

function reminderType(daysRemaining: number) {
  return daysRemaining === 1 ? ("one_day" as const) : ("three_day" as const);
}

function reminderMessage(accessExpiresAt: Date, daysRemaining: number) {
  const expiryDate = accessExpiresAt.toLocaleDateString("pl-PL");
  const daysLabel = daysRemaining === 1 ? "jutro" : `za ${daysRemaining} dni`;
  const renewalUrl = `${publicAppUrl()}/billing`;
  const subject = `Dostęp do Zleć Majstra wygasa ${daysLabel}`;
  const text = [
    "Dzień dobry,",
    "",
    `Twój dostęp do Zleć Majstra wygaśnie ${daysLabel} (${expiryDate}).`,
    "Aby zachować możliwość korzystania z płatnych funkcji, odnowisz go po zalogowaniu:",
    renewalUrl,
    "",
    "To automatyczne przypomnienie — nie odpowiadaj na tę wiadomość.",
  ].join("\n");
  const safeExpiryDate = escapeHtml(expiryDate);
  const safeRenewalUrl = escapeHtml(renewalUrl);
  const html = [
    "<p>Dzień dobry,</p>",
    `<p>Twój dostęp do Zleć Majstra wygaśnie <strong>${escapeHtml(daysLabel)}</strong> (${safeExpiryDate}).</p>`,
    `<p>Aby zachować możliwość korzystania z płatnych funkcji, <a href="${safeRenewalUrl}">zaloguj się i odnów dostęp przez PayU</a>.</p>`,
    "<p>To automatyczne przypomnienie — nie odpowiadaj na tę wiadomość.</p>",
  ].join("");

  return { subject, text, html };
}

export async function dispatchDueSubscriptionReminders(
  sendEmail: RenewalEmailSender = sendRenewalEmail,
  now = new Date(),
) {
  if (sendEmail === sendRenewalEmail) {
    const config = smtpConfiguration();
    if ("missing" in config && config.missing) {
      if (!missingConfigurationLogged) {
        logger.warn(
          { missing: config.missing },
          "Subscription reminders are disabled until SMTP is configured",
        );
        missingConfigurationLogged = true;
      }
      return { considered: 0, enqueued: 0, sent: 0, failed: 0 };
    }
    missingConfigurationLogged = false;
  }

  const windowEnd = new Date(
    now.getTime() + REMINDER_WINDOW_DAYS * DAY_IN_MS,
  );
  const candidates = await db
    .select({
      subscriptionId: subscriptionsTable.id,
      profileId: subscriptionsTable.profileId,
      accessExpiresAt: subscriptionsTable.accessExpiresAt,
      email: profilesTable.email,
    })
    .from(subscriptionsTable)
    .innerJoin(profilesTable, eq(profilesTable.id, subscriptionsTable.profileId))
    .where(
      and(
        eq(profilesTable.role, "contractor"),
        eq(profilesTable.verified, true),
        eq(subscriptionsTable.status, "active"),
        gt(subscriptionsTable.accessExpiresAt, now),
        lte(subscriptionsTable.accessExpiresAt, windowEnd),
      ),
    );

  let enqueued = 0;
  for (const candidate of candidates) {
    if (!candidate.accessExpiresAt || !candidate.email) continue;

    const daysRemaining = Math.ceil(
      (candidate.accessExpiresAt.getTime() - now.getTime()) / DAY_IN_MS,
    );
    if (daysRemaining < 1 || daysRemaining > REMINDER_WINDOW_DAYS) continue;

    const type = reminderType(daysRemaining);
    const [reminder] = await db
      .insert(subscriptionRemindersTable)
      .values({
        subscriptionId: candidate.subscriptionId,
        profileId: candidate.profileId,
        type,
        accessExpiresAt: candidate.accessExpiresAt,
      })
      .onConflictDoNothing({
        target: [
          subscriptionRemindersTable.subscriptionId,
          subscriptionRemindersTable.type,
          subscriptionRemindersTable.accessExpiresAt,
        ],
      })
      .returning({ id: subscriptionRemindersTable.id });

    if (reminder) enqueued += 1;
  }

  const retryable = await db
    .select({
      id: subscriptionRemindersTable.id,
      accessExpiresAt: subscriptionRemindersTable.accessExpiresAt,
      email: profilesTable.email,
    })
    .from(subscriptionRemindersTable)
    .innerJoin(
      subscriptionsTable,
      eq(subscriptionsTable.id, subscriptionRemindersTable.subscriptionId),
    )
    .innerJoin(
      profilesTable,
      eq(profilesTable.id, subscriptionRemindersTable.profileId),
    )
    .where(
      and(
        eq(profilesTable.role, "contractor"),
        eq(profilesTable.verified, true),
        eq(subscriptionsTable.status, "active"),
        eq(
          subscriptionsTable.accessExpiresAt,
          subscriptionRemindersTable.accessExpiresAt,
        ),
        gt(subscriptionRemindersTable.accessExpiresAt, now),
        eq(subscriptionRemindersTable.status, "pending"),
      ),
    );

  let sent = 0;
  let failed = 0;
  for (const reminder of retryable) {
    const [claimed] = await db
      .update(subscriptionRemindersTable)
      .set({
        status: "sending",
        attempts: sql`${subscriptionRemindersTable.attempts} + 1`,
        lastAttemptAt: now,
      })
      .where(
        and(
          eq(subscriptionRemindersTable.id, reminder.id),
          eq(subscriptionRemindersTable.status, "pending"),
        ),
      )
      .returning({
        id: subscriptionRemindersTable.id,
        attempts: subscriptionRemindersTable.attempts,
      });
    if (!claimed) continue;

    const daysRemaining = Math.max(
      1,
      Math.ceil(
        (reminder.accessExpiresAt.getTime() - now.getTime()) / DAY_IN_MS,
      ),
    );
    const content = reminderMessage(reminder.accessExpiresAt, daysRemaining);
    try {
      await sendEmail({
        to: reminder.email,
        messageId: `<subscription-reminder-${reminder.id}@zlecmajstra.pl>`,
        ...content,
      });
      await db
        .update(subscriptionRemindersTable)
        .set({
          status: "sent",
          sentAt: now,
        })
        .where(eq(subscriptionRemindersTable.id, reminder.id));
      sent += 1;
    } catch (error) {
      failed += 1;
      await db
        .update(subscriptionRemindersTable)
        .set({ status: "failed" })
        .where(eq(subscriptionRemindersTable.id, reminder.id));
      logger.error(
        {
          err: error instanceof Error ? error.message : "unknown",
          reminderId: reminder.id,
        },
        "Subscription renewal reminder email failed",
      );
    }
  }

  return { considered: candidates.length, enqueued, sent, failed };
}

export function startSubscriptionReminderWorker() {
  const run = () => {
    void dispatchDueSubscriptionReminders().catch((error) => {
      logger.error(
        { err: error instanceof Error ? error.message : "unknown" },
        "Subscription reminder worker failed",
      );
    });
  };

  run();
  const interval = setInterval(run, REMINDER_INTERVAL_MS);
  interval.unref();
  return () => clearInterval(interval);
}

export type { RenewalEmail };