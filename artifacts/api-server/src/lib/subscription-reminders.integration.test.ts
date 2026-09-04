import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { eq } from "drizzle-orm";
import {
  db,
  pool,
  profilesTable,
  subscriptionRemindersTable,
  subscriptionsTable,
} from "@workspace/db";
import {
  dispatchDueSubscriptionReminders,
  type RenewalEmail,
} from "./subscription-reminders";

const testRunId = `${process.pid}-${Date.now()}`;
const profileId = `reminder-test-contractor-${testRunId}`;

before(async () => {
  await db.insert(profilesTable).values({
    id: profileId,
    role: "contractor",
    firstName: "Testowy",
    lastName: "Fachowiec",
    email: `reminder-${testRunId}@example.com`,
    phone: "+48 555 000 099",
    verified: true,
  });
  await db.insert(subscriptionsTable).values({
    profileId,
    status: "active",
    accessExpiresAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
  });
});

after(async () => {
  await db
    .delete(subscriptionRemindersTable)
    .where(eq(subscriptionRemindersTable.profileId, profileId));
  await db
    .delete(subscriptionsTable)
    .where(eq(subscriptionsTable.profileId, profileId));
  await db.delete(profilesTable).where(eq(profilesTable.id, profileId));
  await pool.end();
});

describe("subscription renewal email reminders", () => {
  it("sends one safe reminder for the same expiry window", async () => {
    const messages: RenewalEmail[] = [];
    const sendEmail = async (message: RenewalEmail) => {
      messages.push(message);
    };

    const first = await dispatchDueSubscriptionReminders(sendEmail);
    const second = await dispatchDueSubscriptionReminders(sendEmail);

    assert.equal(first.sent, 1);
    assert.equal(second.sent, 0);
    assert.equal(messages.length, 1);
    assert.match(messages[0]?.text ?? "", /\/billing/);
    assert.match(messages[0]?.text ?? "", /PayU|płatnych funkcji/);
    assert.equal(messages[0]?.text.includes("customerEmail"), false);
    assert.equal(messages[0]?.text.includes("customerPhone"), false);

    const rows = await db
      .select()
      .from(subscriptionRemindersTable)
      .where(eq(subscriptionRemindersTable.profileId, profileId));
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.status, "sent");
    assert.equal(rows[0]?.attempts, 1);
  });

  it("claims a reminder once when workers run concurrently", async () => {
    await db
      .delete(subscriptionRemindersTable)
      .where(eq(subscriptionRemindersTable.profileId, profileId));
    const messages: RenewalEmail[] = [];
    const sendEmail = async (message: RenewalEmail) => {
      messages.push(message);
      await new Promise((resolve) => setTimeout(resolve, 25));
    };

    await Promise.all([
      dispatchDueSubscriptionReminders(sendEmail),
      dispatchDueSubscriptionReminders(sendEmail),
    ]);

    assert.equal(messages.length, 1);
  });

  it("does not retry an ambiguous SMTP failure", async () => {
    await db
      .delete(subscriptionRemindersTable)
      .where(eq(subscriptionRemindersTable.profileId, profileId));
    const firstAttemptAt = new Date();
    const messageIds: string[] = [];
    let attempts = 0;
    const sendEmail = async (message: RenewalEmail) => {
      attempts += 1;
      messageIds.push(message.messageId);
      if (attempts === 1) throw new Error("temporary SMTP failure");
    };

    const first = await dispatchDueSubscriptionReminders(
      sendEmail,
      firstAttemptAt,
    );
    const secondRun = await dispatchDueSubscriptionReminders(
      sendEmail,
      new Date(firstAttemptAt.getTime() + 16 * 60 * 1000),
    );

    assert.equal(first.failed, 1);
    assert.equal(secondRun.sent, 0);
    assert.equal(attempts, 1);
    assert.equal(messageIds.length, 1);

    const [row] = await db
      .select()
      .from(subscriptionRemindersTable)
      .where(eq(subscriptionRemindersTable.profileId, profileId));
    assert.equal(row?.status, "failed");
    assert.equal(row?.attempts, 1);
  });
});