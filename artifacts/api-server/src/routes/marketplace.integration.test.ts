import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import { after, before, describe, it, mock } from "node:test";
import express, { type Request } from "express";
import { and, asc, eq, inArray } from "drizzle-orm";
import { chromium, type Page } from "playwright";
import {
  conversationMessagesTable,
  conversationsTable,
  db,
  jobRequestsTable,
  paymentsTable,
  pool,
  profilesTable,
  reviewRepliesTable,
  reviewsTable,
  subscriptionsTable,
  subscriptionStatusHistoryTable,
  unlockedContactsTable,
} from "@workspace/db";
import marketplaceRouter, { marketplaceDependencies } from "./marketplace";

const testRunId = `${process.pid}-${Date.now()}`;
const ownerId = `contact-test-owner-${testRunId}`;
const otherCustomerId = `contact-test-customer-${testRunId}`;
const activeContractorId = `contact-test-active-${testRunId}`;
const secondActiveContractorId = `contact-test-active-second-${testRunId}`;
const inactiveContractorId = `contact-test-inactive-${testRunId}`;
const adminId = `contact-test-admin-${testRunId}`;
const profileIds = [
  ownerId,
  otherCustomerId,
  activeContractorId,
  secondActiveContractorId,
  inactiveContractorId,
  adminId,
];

const customerEmail = `contact-${testRunId}@example.com`;
const customerPhone = `+48 555 ${String(process.pid).padStart(6, "0")}`;
const requestAddress = "ul. Testowa 10, 00-001 Warszawa";

let baseUrl = "";
let serverOrigin = "";
let requestId = 0;
let reviewRequestId = 0;
let firstConversationId = 0;
let server: ReturnType<express.Application["listen"]>;

const evidenceRunId =
  process.env.PAYU_EVIDENCE_RUN_ID ?? `local-${testRunId}`;
const evidenceDir =
  process.env.PAYU_EVIDENCE_DIR ?? `/tmp/payu-sandbox-evidence/${evidenceRunId}`;
const payuSandboxE2eEnabled = process.env.PAYU_SANDBOX_E2E === "true";
const payuSandboxDescribe = payuSandboxE2eEnabled ? describe : describe.skip;
const capturedPayuNotifications: Array<{
  rawBody: Buffer;
  signature: string;
}> = [];
const capturedWebReturns: Array<{
  order: string;
  payment: string;
}> = [];

async function writeEvidence(fileName: string, content: string): Promise<void> {
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(`${evidenceDir}/${fileName}`, content, "utf8");
}

function authFor(userId: string | null) {
  return {
    actor: null,
    factorVerificationAge: null,
    getToken: async () => null,
    has: () => false,
    orgId: null,
    orgPermissions: [],
    orgRole: null,
    orgSlug: null,
    sessionClaims: {},
    sessionId: userId ? `session-${userId}` : null,
    sessionStatus: userId ? "active" : null,
    tokenType: "session_token",
    userId,
  };
}

function responseObject(
  body: Record<string, unknown> | Record<string, unknown>[],
): Record<string, unknown> {
  assert.equal(Array.isArray(body), false);
  return body as Record<string, unknown>;
}

async function api(
  userId: string | null,
  path: string,
  init?: RequestInit,
): Promise<{ status: number; body: Record<string, unknown> | Record<string, unknown>[] }> {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(userId ? { "x-test-user-id": userId } : {}),
      ...init?.headers,
    },
  });

  return {
    status: response.status,
    body:
      response.status === 204
        ? {}
        : ((await response.json()) as
            | Record<string, unknown>
            | Record<string, unknown>[]),
  };
}

function assertContactHidden(body: Record<string, unknown>) {
  assert.equal(body.contactAvailable, false);
  assert.equal(body.customerEmail, null);
  assert.equal(body.customerPhone, null);
  assert.equal(body.address, null);
  assert.equal(JSON.stringify(body).includes(customerEmail), false);
  assert.equal(JSON.stringify(body).includes(customerPhone), false);
}

function findRequest(body: Record<string, unknown>[]) {
  const request = body.find((item) => item.id === requestId);
  assert.ok(request, "Test request should be present in the list response");
  return request;
}

before(async () => {
  const projectPhotosMigration = await readFile(
    new URL("../../../../lib/db/migrations/0006_project_photos.sql", import.meta.url),
    "utf8",
  );
  await pool.query(projectPhotosMigration);
  const paymentConsentsMigration = await readFile(
    new URL("../../../../lib/db/migrations/0009_payment_consents.sql", import.meta.url),
    "utf8",
  );
  await pool.query(paymentConsentsMigration);
  await db.insert(profilesTable).values([
    {
      id: ownerId,
      role: "customer",
      firstName: "Właściciel",
      lastName: "Zlecenia",
      email: customerEmail,
      phone: customerPhone,
      verified: true,
    },
    {
      id: otherCustomerId,
      role: "customer",
      firstName: "Inny",
      lastName: "Klient",
      email: `other-${customerEmail}`,
      phone: "+48 555 000 001",
      verified: true,
    },
    {
      id: activeContractorId,
      role: "contractor",
      firstName: "Aktywny",
      lastName: "Fachowiec",
      email: `active-${customerEmail}`,
      phone: "+48 555 000 002",
      serviceLocation: "Warszawa",
      verified: true,
    },
    {
      id: inactiveContractorId,
      role: "contractor",
      firstName: "Nieaktywny",
      lastName: "Fachowiec",
      email: `inactive-${customerEmail}`,
      phone: "+48 555 000 003",
      serviceLocation: "Warszawa",
      verified: true,
    },
    {
      id: secondActiveContractorId,
      role: "contractor",
      firstName: "Drugi",
      lastName: "Fachowiec",
      email: `second-active-${customerEmail}`,
      phone: "+48 555 000 005",
      serviceLocation: "Warszawa",
      verified: true,
    },
    {
      id: adminId,
      role: "admin",
      firstName: "Alicja",
      lastName: "Administrator",
      email: `admin-${customerEmail}`,
      phone: "+48 555 000 004",
      verified: true,
    },
  ]);

  await db.insert(subscriptionsTable).values([
    { profileId: otherCustomerId, status: "active" },
    { profileId: activeContractorId, status: "active" },
    { profileId: secondActiveContractorId, status: "active" },
    {
      profileId: inactiveContractorId,
      status: "inactive",
      activationRequested: true,
    },
  ]);

  const [request] = await db
    .insert(jobRequestsTable)
    .values({
      customerId: ownerId,
      customerName: "Właściciel Z.",
      customerEmail,
      customerPhone,
      title: `Poufne zlecenie ${testRunId}`,
      description: "Integracyjny test ochrony płatnych danych kontaktowych.",
      category: "remont",
      location: "Warszawa",
      address: requestAddress,
      budget: "10 000 zł",
      status: "open",
      photos: [],
    })
    .returning({ id: jobRequestsTable.id });

  assert.ok(request);
  requestId = request.id;

  const [reviewRequest] = await db
    .insert(jobRequestsTable)
    .values({
      customerId: ownerId,
      customerName: "Właściciel Z.",
      customerEmail,
      customerPhone,
      title: `Zakończone zlecenie ${testRunId}`,
      description: "Integracyjny test opinii po zakończeniu zlecenia.",
      category: "remont",
      location: "Poznań",
      budget: "2 500 zł",
      status: "completed",
      photos: [],
    })
    .returning({ id: jobRequestsTable.id });
  assert.ok(reviewRequest);
  reviewRequestId = reviewRequest.id;

  await db.insert(unlockedContactsTable).values({
    profileId: inactiveContractorId,
    requestId,
  });
  await db.insert(unlockedContactsTable).values({
    profileId: activeContractorId,
    requestId,
  });
  await db.insert(unlockedContactsTable).values({
    profileId: activeContractorId,
    requestId: reviewRequestId,
  });

  const app = express();
  app.use(
    express.json({
      verify(req, _res, buffer) {
        (req as typeof req & { rawBody?: Buffer }).rawBody =
          Buffer.from(buffer);
      },
    }),
  );
  app.use((req, _res, next) => {
    const userId = req.header("x-test-user-id") ?? null;
    const auth = Object.assign(() => authFor(userId), {
      [Symbol.for("@clerk/express.auth")]: true,
    });
    (req as Request & { auth: typeof auth }).auth = auth;
    (req as unknown as { log: { info: () => void; warn: () => void; error: () => void } }).log = {
      info: () => undefined,
      warn: () => undefined,
      error: () => undefined,
    };
    next();
  });
  app.use((req, _res, next) => {
    if (
      req.path.endsWith("/billing/payu/notifications") &&
      (req as typeof req & { rawBody?: Buffer }).rawBody
    ) {
      capturedPayuNotifications.push({
        rawBody: Buffer.from(
          (req as typeof req & { rawBody: Buffer }).rawBody,
        ),
        signature: req.get("openpayu-signature") ?? "",
      });
    }
    next();
  });
  app.get("/billing", (req, res) => {
    capturedWebReturns.push({
      order: typeof req.query.order === "string" ? req.query.order : "",
      payment: typeof req.query.payment === "string" ? req.query.payment : "",
    });
    res
      .status(200)
      .type("html")
      .send("<!doctype html><title>PayU return</title><main>Payment return received</main>");
  });
  app.use("/api", marketplaceRouter);
  app.use(marketplaceRouter);

  server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  const address = server.address() as AddressInfo;
  serverOrigin = `http://127.0.0.1:${address.port}`;
  baseUrl = serverOrigin;
});


after(async () => {
  if (server) {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }

  if (requestId || reviewRequestId) {
    await db
      .delete(conversationMessagesTable)
      .where(
        inArray(
          conversationMessagesTable.conversationId,
          db
            .select({ id: conversationsTable.id })
            .from(conversationsTable)
            .where(inArray(conversationsTable.requestId, [requestId, reviewRequestId])),
        ),
      );
    await db
      .delete(conversationsTable)
      .where(inArray(conversationsTable.requestId, [requestId, reviewRequestId]));
    await db
      .delete(reviewRepliesTable)
      .where(
        inArray(
          reviewRepliesTable.reviewId,
          db
            .select({ id: reviewsTable.id })
            .from(reviewsTable)
            .where(inArray(reviewsTable.requestId, [requestId, reviewRequestId])),
        ),
      );
    await db
      .delete(reviewsTable)
      .where(inArray(reviewsTable.requestId, [requestId, reviewRequestId]));
    await db
      .delete(unlockedContactsTable)
      .where(
        inArray(unlockedContactsTable.requestId, [requestId, reviewRequestId]),
      );
    await db
      .delete(jobRequestsTable)
      .where(inArray(jobRequestsTable.id, [requestId, reviewRequestId]));
  }
  await db
    .delete(subscriptionStatusHistoryTable)
    .where(inArray(subscriptionStatusHistoryTable.profileId, profileIds));
  await db
    .delete(paymentsTable)
    .where(inArray(paymentsTable.profileId, profileIds));
  await db
    .delete(subscriptionsTable)
    .where(inArray(subscriptionsTable.profileId, profileIds));
  await db.delete(profilesTable).where(inArray(profilesTable.id, profileIds));
  await pool.end();
});

describe("marketplace contact authorization", () => {
  it("omits unavailable legacy photo filenames from request responses", async () => {
    await db
      .update(jobRequestsTable)
      .set({ photos: ["legacy-missing.jpg"] })
      .where(eq(jobRequestsTable.id, requestId));

    try {
      const response = await api(ownerId, `/requests/${requestId}`);
      assert.equal(response.status, 200);
      assert.deepEqual(responseObject(response.body).photos, []);
    } finally {
      await db
        .update(jobRequestsTable)
        .set({ photos: [] })
        .where(eq(jobRequestsTable.id, requestId));
    }
  });

  it("creates conversation tables from the startup migration on a clean schema", async () => {
    const schema = `conversation_migration_${process.pid}`;
    const migration = await readFile(
      new URL("../../../../lib/db/migrations/0003_conversations.sql", import.meta.url),
      "utf8",
    );
    const readStateMigration = await readFile(
      new URL(
        "../../../../lib/db/migrations/0004_conversation_message_read_states.sql",
        import.meta.url,
      ),
      "utf8",
    );
    const client = await pool.connect();
    try {
      await client.query(`CREATE SCHEMA "${schema}"`);
      await client.query(`SET search_path TO "${schema}"`);
      await client.query(migration);
      await client.query(readStateMigration);
      const result = await client.query<{
        conversations: string | null;
        messages: string | null;
        readAt: string | null;
      }>(
        `SELECT
          to_regclass('conversations')::text AS conversations,
          to_regclass('conversation_messages')::text AS messages,
          (
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = current_schema()
              AND table_name = 'conversation_messages'
              AND column_name = 'read_at'
          ) AS "readAt"`,
      );
      assert.equal(result.rows[0]?.conversations, "conversations");
      assert.equal(result.rows[0]?.messages, "conversation_messages");
      assert.equal(result.rows[0]?.readAt, "read_at");
    } finally {
      await client.query("SET search_path TO public");
      await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      client.release();
    }
  });

  it("never exposes contact details to an anonymous caller", async () => {
    const detailResponse = await api(
      null,
      `/requests/${requestId}`,
    );
    assert.equal(detailResponse.status, 200);
    assertContactHidden(detailResponse.body as Record<string, unknown>);

    const listResponse = await api(null, "/requests");
    assert.equal(listResponse.status, 200);
    assert.ok(Array.isArray(listResponse.body));
    assertContactHidden(findRequest(listResponse.body));

    const unlockResponse = await api(
      null,
      `/requests/${requestId}/unlock`,
      { method: "POST" },
    );
    assert.equal(unlockResponse.status, 401);
    assert.equal("customerEmail" in unlockResponse.body, false);
    assert.equal("customerPhone" in unlockResponse.body, false);

    const updateResponse = await api(null, `/requests/${requestId}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "in_progress" }),
    });
    assert.equal(updateResponse.status, 401);
    assert.equal("customerEmail" in updateResponse.body, false);
    assert.equal("customerPhone" in updateResponse.body, false);
  });

  it("lets a customer see only contact details from their own request", async () => {
    const ownerResponse = await api(ownerId, `/requests/${requestId}`);
    assert.equal(ownerResponse.status, 200);
    const ownerBody = responseObject(ownerResponse.body);
    assert.equal(ownerBody.contactAvailable, true);
    assert.equal(ownerBody.customerEmail, customerEmail);
    assert.equal(ownerBody.customerPhone, customerPhone);

    const otherCustomerResponse = await api(
      otherCustomerId,
      `/requests/${requestId}`,
    );
    assert.equal(otherCustomerResponse.status, 200);
    assertContactHidden(otherCustomerResponse.body as Record<string, unknown>);

    const listResponse = await api(otherCustomerId, "/requests");
    assert.equal(listResponse.status, 200);
    assert.ok(Array.isArray(listResponse.body));
    assertContactHidden(findRequest(listResponse.body));
  });

  it("does not let a customer unlock a contact even with an active subscription row", async () => {
    const subscriptionResponse = await api(
      otherCustomerId,
      "/billing/subscription",
    );
    assert.equal(subscriptionResponse.status, 200);
    assert.equal(
      responseObject(subscriptionResponse.body).canUnlockContacts,
      false,
    );

    const unlockResponse = await api(
      otherCustomerId,
      `/requests/${requestId}/unlock`,
      { method: "POST" },
    );
    assert.equal(unlockResponse.status, 403);
    assert.equal("customerEmail" in unlockResponse.body, false);
    assert.equal("customerPhone" in unlockResponse.body, false);
  });

  it("requires an active subscription to start a conversation", async () => {
    const response = await api(inactiveContractorId, `/requests/${requestId}/conversation`, { method: "POST" });
    assert.equal(response.status, 402);
    assert.equal("customerEmail" in response.body, false);
    assert.equal("customerPhone" in response.body, false);
  });

  it("keeps legacy unlocked contacts masked without conversation consent", async () => {
    const detailResponse = await api(activeContractorId, `/requests/${requestId}`);
    assert.equal(detailResponse.status, 200);
    assertContactHidden(responseObject(detailResponse.body));

    const listResponse = await api(activeContractorId, "/requests");
    assert.equal(listResponse.status, 200);
    assert.ok(Array.isArray(listResponse.body));
    assertContactHidden(findRequest(listResponse.body));
  });

  it("reveals contact only after a conversation and customer approval", async () => {
    const started = await api(activeContractorId, `/requests/${requestId}/conversation`, { method: "POST" });
    assert.equal(started.status, 201);
    const startedBody = responseObject(started.body);
    firstConversationId = startedBody.id as number;
    assert.equal(startedBody.customerContactShared, false);
    assert.equal(startedBody.customerEmail, null);
    assert.equal(startedBody.customerPhone, null);
    assert.equal(startedBody.contractorReviewCount, 0);
    assert.deepEqual(startedBody.contractorReviews, []);

    const message = await api(activeContractorId, `/requests/${requestId}/conversation/messages`, {
      method: "POST",
      body: JSON.stringify({ body: "Dzień dobry, chętnie omówię zakres prac." }),
    });
    assert.equal(message.status, 201);

    const customerConversation = await api(
      ownerId,
      `/requests/${requestId}/conversations/${firstConversationId}`,
    );
    assert.equal(customerConversation.status, 200);
    const customerBody = responseObject(customerConversation.body);
    assert.equal((customerBody.messages as unknown[]).length, 1);
    assert.equal(customerBody.customerContactShared, false);
    assert.equal(typeof customerBody.contractorName, "string");
    assert.equal(typeof customerBody.contractorAverageRating, "number");
    assert.equal(typeof customerBody.contractorReviewCount, "number");
    assert.ok(Array.isArray(customerBody.contractorReviews));
    assert.equal(customerBody.customerEmail, null);
    assert.equal(customerBody.customerPhone, null);

    const shared = await api(
      ownerId,
      `/requests/${requestId}/conversations/${firstConversationId}/share-contact`,
      { method: "POST" },
    );
    assert.equal(shared.status, 200);

    const contractorConversation = await api(activeContractorId, `/requests/${requestId}/conversation`);
    const contractorBody = responseObject(contractorConversation.body);
    assert.equal(contractorBody.customerContactShared, true);
    assert.equal(contractorBody.customerEmail, customerEmail);
    assert.equal(contractorBody.customerPhone, customerPhone);

    const detail = await api(activeContractorId, `/requests/${requestId}`);
    const detailBody = responseObject(detail.body);
    assert.equal(detailBody.contactAvailable, true);
    assert.equal(detailBody.customerEmail, customerEmail);
    assert.equal(detailBody.customerPhone, customerPhone);
    assert.equal(detailBody.address, requestAddress);
  });

  it("keeps customer replies and consent bound to the selected contractor", async () => {
    const started = await api(
      secondActiveContractorId,
      `/requests/${requestId}/conversation`,
      { method: "POST" },
    );
    assert.equal(started.status, 201);
    const secondConversation = responseObject(started.body);

    const contractorMessage = await api(
      secondActiveContractorId,
      `/requests/${requestId}/conversation/messages`,
      {
        method: "POST",
        body: JSON.stringify({ body: "Wiadomość drugiego fachowca" }),
      },
    );
    assert.equal(contractorMessage.status, 201);

    const customerList = await api(ownerId, `/requests/${requestId}/conversations`);
    assert.equal(customerList.status, 200);
    assert.equal((customerList.body as unknown[]).length, 2);

    const selectedCustomerView = await api(
      ownerId,
      `/requests/${requestId}/conversations/${secondConversation.id}`,
    );
    assert.equal(selectedCustomerView.status, 200);
    const selectedMessages = responseObject(selectedCustomerView.body)
      .messages as Array<Record<string, unknown>>;
    assert.ok(selectedMessages.at(-1)?.readAt);

    const customerReply = await api(
      ownerId,
      `/requests/${requestId}/conversations/${secondConversation.id}/messages`,
      {
        method: "POST",
        body: JSON.stringify({ body: "Odpowiedź tylko w drugim wątku" }),
      },
    );
    assert.equal(customerReply.status, 201);

    const firstView = responseObject(
      (await api(activeContractorId, `/requests/${requestId}/conversation`)).body,
    );
    assert.deepEqual(
      (firstView.messages as Array<Record<string, unknown>>).map((message) => message.body),
      ["Dzień dobry, chętnie omówię zakres prac."],
    );

    const secondView = responseObject(
      (await api(secondActiveContractorId, `/requests/${requestId}/conversation`)).body,
    );
    assert.deepEqual(
      (secondView.messages as Array<Record<string, unknown>>).map((message) => message.body),
      ["Wiadomość drugiego fachowca", "Odpowiedź tylko w drugim wątku"],
    );
    assert.equal(secondView.customerContactShared, false);

    const ambiguousLegacyShare = await api(
      ownerId,
      `/requests/${requestId}/conversation/share-contact`,
      { method: "POST" },
    );
    assert.equal(ambiguousLegacyShare.status, 409);

    const selectedShare = await api(
      ownerId,
      `/requests/${requestId}/conversations/${secondConversation.id}/share-contact`,
      { method: "POST" },
    );
    assert.equal(selectedShare.status, 200);
    const selectedShareBody = responseObject(selectedShare.body);
    assert.equal(selectedShareBody.contractorId, secondActiveContractorId);
    assert.equal(selectedShareBody.customerContactShared, true);
  });

  it("notifies only the recipient and marks messages as read when the conversation opens", async () => {
    const sensitiveMessage = `Proszę odpisać: ${customerEmail}, ${customerPhone}`;
    const sentToCustomer = await api(
      activeContractorId,
      `/requests/${requestId}/conversation/messages`,
      {
        method: "POST",
        body: JSON.stringify({ body: sensitiveMessage }),
      },
    );
    assert.equal(sentToCustomer.status, 201);
    assert.equal(responseObject(sentToCustomer.body).readAt, null);

    const customerNotifications = await api(ownerId, "/notifications");
    assert.equal(customerNotifications.status, 200);
    const customerNotificationBody = responseObject(customerNotifications.body);
    assert.equal(customerNotificationBody.unreadConversations, 1);
    assert.equal(
      (customerNotificationBody.notifications as unknown[]).length,
      1,
    );
    const serializedCustomerNotifications = JSON.stringify(
      customerNotificationBody,
    );
    assert.equal(serializedCustomerNotifications.includes(sensitiveMessage), false);
    assert.equal(serializedCustomerNotifications.includes(customerEmail), false);
    assert.equal(serializedCustomerNotifications.includes(customerPhone), false);

    const openedByCustomer = await api(
      ownerId,
      `/requests/${requestId}/conversations/${firstConversationId}`,
    );
    assert.equal(openedByCustomer.status, 200);
    const customerMessages = responseObject(openedByCustomer.body).messages as Array<
      Record<string, unknown>
    >;
    assert.ok(customerMessages.at(-1)?.readAt);

    const customerAfterOpen = await api(ownerId, "/notifications");
    assert.equal(responseObject(customerAfterOpen.body).unreadConversations, 0);

    const sentToContractor = await api(
      ownerId,
      `/requests/${requestId}/conversations/${firstConversationId}/messages`,
      {
        method: "POST",
        body: JSON.stringify({ body: "Dziękuję, wrócę z odpowiedzią." }),
      },
    );
    assert.equal(sentToContractor.status, 201);

    const contractorNotifications = await api(activeContractorId, "/notifications");
    assert.equal(contractorNotifications.status, 200);
    assert.equal(
      responseObject(contractorNotifications.body).unreadConversations,
      1,
    );

    const openedByContractor = await api(
      activeContractorId,
      `/requests/${requestId}/conversation`,
    );
    assert.equal(openedByContractor.status, 200);
    const contractorMessages = responseObject(openedByContractor.body).messages as Array<
      Record<string, unknown>
    >;
    assert.ok(contractorMessages.at(-1)?.readAt);

    const contractorAfterOpen = await api(activeContractorId, "/notifications");
    assert.equal(responseObject(contractorAfterOpen.body).unreadConversations, 0);
  });

  it("reminds an active contractor three days before expiry without exposing customer data", async () => {
    await db
      .update(subscriptionsTable)
      .set({
        status: "active",
        accessExpiresAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      })
      .where(eq(subscriptionsTable.profileId, activeContractorId));

    const response = await api(
      activeContractorId,
      "/billing/subscription",
    );
    assert.equal(response.status, 200);
    const body = responseObject(response.body);
    const reminder = responseObject(
      body.renewalReminder as Record<string, unknown>,
    );

    assert.equal(reminder.daysRemaining, 2);
    assert.match(String(reminder.message), /Odnów abonament/);
    assert.equal("customerEmail" in body, false);
    assert.equal("customerPhone" in body, false);
    assert.equal(JSON.stringify(body).includes(customerEmail), false);
    assert.equal(JSON.stringify(body).includes(customerPhone), false);
  });

  it("masks an unlocked contact as soon as the contractor subscription becomes inactive", async () => {
    await db
      .update(subscriptionsTable)
      .set({ status: "canceled" })
      .where(eq(subscriptionsTable.profileId, activeContractorId));

    const detailResponse = await api(
      activeContractorId,
      `/requests/${requestId}`,
    );
    assert.equal(detailResponse.status, 200);
    assertContactHidden(detailResponse.body as Record<string, unknown>);

    const listResponse = await api(activeContractorId, "/requests");
    assert.equal(listResponse.status, 200);
    assert.ok(Array.isArray(listResponse.body));
    assertContactHidden(findRequest(listResponse.body));

    const selectedConversation = await api(
      activeContractorId,
      `/requests/${requestId}/conversations/${firstConversationId}`,
    );
    assert.equal(selectedConversation.status, 402);
    const selectedMessage = await api(
      activeContractorId,
      `/requests/${requestId}/conversations/${firstConversationId}/messages`,
      {
        method: "POST",
        body: JSON.stringify({ body: "Nie powinno się zapisać" }),
      },
    );
    assert.equal(selectedMessage.status, 402);
  });

  it("does not leak contact details through an unauthorized update response", async () => {
    const response = await api(
      inactiveContractorId,
      `/requests/${requestId}`,
      {
        method: "PATCH",
        body: JSON.stringify({ status: "in_progress" }),
      },
    );

    assert.equal(response.status, 404);
    assert.equal("customerEmail" in response.body, false);
    assert.equal("customerPhone" in response.body, false);

    const [request] = await db
      .select({ status: jobRequestsTable.status })
      .from(jobRequestsTable)
      .where(
        and(
          eq(jobRequestsTable.id, requestId),
          eq(jobRequestsTable.customerId, ownerId),
        ),
      );
    assert.equal(request?.status, "open");
  });

  it("allows only an administrator to list pending subscription requests", async () => {
    const forbidden = await api(
      activeContractorId,
      "/admin/subscriptions",
    );
    assert.equal(forbidden.status, 403);

    const response = await api(adminId, "/admin/subscriptions");
    assert.equal(response.status, 200);
    assert.ok(Array.isArray(response.body));
    const pending = response.body.find(
      (item) => item.profileId === inactiveContractorId,
    );
    assert.ok(pending);
    assert.equal(pending.activationRequested, true);
    assert.equal(pending.status, "inactive");
  });

  it("allows only an administrator to read subscription status history", async () => {
    const anonymous = await api(
      null,
      `/admin/subscriptions/${inactiveContractorId}`,
    );
    assert.equal(anonymous.status, 401);

    const forbidden = await api(
      inactiveContractorId,
      `/admin/subscriptions/${inactiveContractorId}`,
    );
    assert.equal(forbidden.status, 403);

    const response = await api(
      adminId,
      `/admin/subscriptions/${inactiveContractorId}`,
    );
    assert.equal(response.status, 200);
    assert.ok(Array.isArray(response.body));
    assert.equal(response.body.length, 0);
  });

  it("rejects manual subscription requests from customers", async () => {
    const response = await api(
      ownerId,
      "/billing/subscription",
      {
        method: "POST",
        body: JSON.stringify({ plan: "professional" }),
      },
    );
    assert.equal(response.status, 403);
  });

  it("does not create a PayU checkout without all required consents", async () => {
    const missingConsents = await api(
      inactiveContractorId,
      "/billing/subscription",
      {
        method: "POST",
        body: JSON.stringify({ plan: "professional", platform: "web" }),
      },
    );
    assert.equal(missingConsents.status, 400);

    const rejectedRecurringConsent = await api(
      inactiveContractorId,
      "/billing/subscription",
      {
        method: "POST",
        body: JSON.stringify({
          plan: "professional",
          platform: "web",
          acceptTerms: true,
          acceptDigitalService: true,
          acceptRecurringPayments: false,
        }),
      },
    );
    assert.equal(rejectedRecurringConsent.status, 400);
  });

  it("lets an administrator activate and cancel access with an audit trail", async () => {
    const activated = await api(
      adminId,
      `/admin/subscriptions/${inactiveContractorId}`,
      {
        method: "PATCH",
        body: JSON.stringify({ status: "active" }),
      },
    );
    assert.equal(activated.status, 200);
    const activatedBody = responseObject(activated.body);
    assert.equal(activatedBody.status, "active");
    assert.equal(activatedBody.activationRequested, false);

    const contractorView = await api(
      inactiveContractorId,
      "/billing/subscription",
    );
    assert.equal(contractorView.status, 200);
    assert.equal(responseObject(contractorView.body).canUnlockContacts, true);

    const canceled = await api(
      adminId,
      `/admin/subscriptions/${inactiveContractorId}`,
      {
        method: "PATCH",
        body: JSON.stringify({ status: "canceled" }),
      },
    );
    assert.equal(canceled.status, 200);
    assert.equal(responseObject(canceled.body).status, "canceled");

    const history = await db
      .select()
      .from(subscriptionStatusHistoryTable)
      .where(
        eq(
          subscriptionStatusHistoryTable.profileId,
          inactiveContractorId,
        ),
      )
      .orderBy(asc(subscriptionStatusHistoryTable.id));
    assert.equal(history.length, 2);
    assert.deepEqual(
      history.map((entry) => entry.newStatus),
      ["active", "canceled"],
    );
    assert.ok(history.every((entry) => entry.changedByAdminId === adminId));
    assert.ok(history.every((entry) => entry.createdAt instanceof Date));

    const historyResponse = await api(
      adminId,
      `/admin/subscriptions/${inactiveContractorId}`,
    );
    assert.equal(historyResponse.status, 200);
    assert.ok(Array.isArray(historyResponse.body));
    assert.equal(historyResponse.body.length, 2);
    assert.deepEqual(
      historyResponse.body.map((entry) => ({
        previousStatus: entry.previousStatus,
        newStatus: entry.newStatus,
        changedByAdminId: entry.changedByAdminId,
        changedByAdminName: entry.changedByAdminName,
      })),
      [
        {
          previousStatus: "active",
          newStatus: "canceled",
          changedByAdminId: adminId,
          changedByAdminName: "Alicja Administrator",
        },
        {
          previousStatus: "inactive",
          newStatus: "active",
          changedByAdminId: adminId,
          changedByAdminName: "Alicja Administrator",
        },
      ],
    );
    assert.ok(
      historyResponse.body.every(
        (entry) =>
          typeof entry.createdAt === "string" &&
          typeof entry.id === "number",
      ),
    );
  });

  it("serializes concurrent administrator changes in the audit trail", async () => {
    await db
      .delete(subscriptionStatusHistoryTable)
      .where(
        eq(
          subscriptionStatusHistoryTable.profileId,
          inactiveContractorId,
        ),
      );
    await db
      .update(subscriptionsTable)
      .set({ status: "canceled", activationRequested: false })
      .where(eq(subscriptionsTable.profileId, inactiveContractorId));

    await Promise.all([
      api(adminId, `/admin/subscriptions/${inactiveContractorId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "active" }),
      }),
      api(adminId, `/admin/subscriptions/${inactiveContractorId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "inactive" }),
      }),
    ]);

    const history = await db
      .select()
      .from(subscriptionStatusHistoryTable)
      .where(
        eq(
          subscriptionStatusHistoryTable.profileId,
          inactiveContractorId,
        ),
      )
      .orderBy(asc(subscriptionStatusHistoryTable.id));
    const [subscription] = await db
      .select()
      .from(subscriptionsTable)
      .where(eq(subscriptionsTable.profileId, inactiveContractorId));

    assert.equal(history.length, 2);
    assert.equal(history[0]?.previousStatus, "canceled");
    assert.equal(history[1]?.previousStatus, history[0]?.newStatus);
    assert.equal(history[1]?.newStatus, subscription?.status);
  });

  it("removes messages and conversation access when an administrator deletes a request", async () => {
    const [request] = await db
      .insert(jobRequestsTable)
      .values({
        customerId: ownerId,
        customerName: "Właściciel Z.",
        customerEmail,
        customerPhone,
        title: `Usuwane zlecenie ${testRunId}`,
        description: "Rozmowa musi zniknąć razem z usuwanym zleceniem.",
        category: "remont",
        location: "Gdańsk",
        budget: "3 000 zł",
        status: "open",
        photos: [],
      })
      .returning({ id: jobRequestsTable.id });
    const [conversation] = await db
      .insert(conversationsTable)
      .values({
        requestId: request.id,
        customerId: ownerId,
        contractorId: activeContractorId,
      })
      .returning({ id: conversationsTable.id });
    await db.insert(conversationMessagesTable).values({
      conversationId: conversation.id,
      senderId: activeContractorId,
      body: "Wiadomość do usunięcia ze zleceniem",
    });

    const deleted = await api(adminId, `/admin/requests/${request.id}`, {
      method: "DELETE",
    });
    assert.equal(deleted.status, 204);
    const inaccessible = await api(
      ownerId,
      `/requests/${request.id}/conversations/${conversation.id}`,
    );
    assert.equal(inaccessible.status, 403);
    const remainingMessages = await db
      .select({ id: conversationMessagesTable.id })
      .from(conversationMessagesTable)
      .where(eq(conversationMessagesTable.conversationId, conversation.id));
    const remainingConversations = await db
      .select({ id: conversationsTable.id })
      .from(conversationsTable)
      .where(eq(conversationsTable.id, conversation.id));
    assert.equal(remainingMessages.length, 0);
    assert.equal(remainingConversations.length, 0);
  });

  it("removes messages and customer access when an administrator deletes a contractor", async () => {
    const contractorId = `deleted-contractor-${testRunId}`;
    await db.insert(profilesTable).values({
      id: contractorId,
      role: "contractor",
      firstName: "Usuwany",
      lastName: "Fachowiec",
      email: `deleted-${customerEmail}`,
      phone: "+48 555 000 099",
      verified: true,
    });
    const [conversation] = await db
      .insert(conversationsTable)
      .values({
        requestId,
        customerId: ownerId,
        contractorId,
      })
      .returning({ id: conversationsTable.id });
    await db.insert(conversationMessagesTable).values({
      conversationId: conversation.id,
      senderId: contractorId,
      body: "Wiadomość do usunięcia z kontem",
    });

    const deleteIdentity = mock.method(
      marketplaceDependencies,
      "deleteClerkUser",
      async () => ({ id: contractorId }) as never,
    );
    const deleted = await api(adminId, `/admin/users/${contractorId}`, {
      method: "DELETE",
    });
    deleteIdentity.mock.restore();
    assert.equal(deleted.status, 204);
    const inaccessible = await api(
      ownerId,
      `/requests/${requestId}/conversations/${conversation.id}`,
    );
    assert.equal(inaccessible.status, 403);
    const remainingMessages = await db
      .select({ id: conversationMessagesTable.id })
      .from(conversationMessagesTable)
      .where(eq(conversationMessagesTable.conversationId, conversation.id));
    const remainingConversations = await db
      .select({ id: conversationsTable.id })
      .from(conversationsTable)
      .where(eq(conversationsTable.id, conversation.id));
    assert.equal(remainingMessages.length, 0);
    assert.equal(remainingConversations.length, 0);
  });
});

describe("marketplace reviews", () => {
  it("creates one review only after completion for an eligible contractor", async () => {
    const candidates = await api(
      ownerId,
      `/requests/${reviewRequestId}/review-candidates`,
    );
    assert.equal(candidates.status, 200);
    assert.deepEqual(candidates.body, [
      {
        id: activeContractorId,
        displayName: "Aktywny Fachowiec",
        reviewed: false,
      },
    ]);

    const beforeCompletion = await api(ownerId, `/requests/${requestId}/reviews`, {
      method: "POST",
      body: JSON.stringify({
        contractorId: inactiveContractorId,
        rating: 5,
        body: "Dobra realizacja.",
      }),
    });
    assert.equal(beforeCompletion.status, 403);

    const unrelated = await api(ownerId, `/requests/${reviewRequestId}/reviews`, {
      method: "POST",
      body: JSON.stringify({
        contractorId: inactiveContractorId,
        rating: 4,
        body: "Brak powiązania.",
      }),
    });
    assert.equal(unrelated.status, 403);

    const created = await api(ownerId, `/requests/${reviewRequestId}/reviews`, {
      method: "POST",
      body: JSON.stringify({
        contractorId: activeContractorId,
        rating: 5,
        body: "  Terminowo i solidnie.  ",
      }),
    });
    assert.equal(created.status, 201);
    const createdBody = responseObject(created.body);
    assert.equal(createdBody.rating, 5);
    assert.equal(createdBody.body, "Terminowo i solidnie.");
    assert.equal(createdBody.reply, null);
    assert.equal("customerId" in createdBody, false);
    assert.equal("email" in createdBody, false);
    assert.equal("phone" in createdBody, false);

    const duplicate = await api(ownerId, `/requests/${reviewRequestId}/reviews`, {
      method: "POST",
      body: JSON.stringify({
        contractorId: activeContractorId,
        rating: 4,
        body: "Druga opinia.",
      }),
    });
    assert.equal(duplicate.status, 409);
  });

  it("limits reading and replying to related users", async () => {
    const ownerReviews = await api(
      ownerId,
      `/requests/${reviewRequestId}/reviews`,
    );
    assert.equal(ownerReviews.status, 200);
    assert.ok(Array.isArray(ownerReviews.body));
    const review = ownerReviews.body[0];
    assert.ok(review);

    const unrelated = await api(
      inactiveContractorId,
      `/requests/${reviewRequestId}/reviews`,
    );
    assert.equal(unrelated.status, 403);

    const wrongReply = await api(
      inactiveContractorId,
      `/requests/${reviewRequestId}/reviews/${review.id}/reply`,
      {
        method: "POST",
        body: JSON.stringify({ body: "Nie moja opinia." }),
      },
    );
    assert.equal(wrongReply.status, 403);

    const reply = await api(
      activeContractorId,
      `/requests/${reviewRequestId}/reviews/${review.id}/reply`,
      {
        method: "POST",
        body: JSON.stringify({ body: "  Dziękuję za opinię!  " }),
      },
    );
    assert.equal(reply.status, 201);
    const replyBody = responseObject(reply.body);
    assert.deepEqual(
      (replyBody.reply as Record<string, unknown>).body,
      "Dziękuję za opinię!",
    );

    const duplicate = await api(
      activeContractorId,
      `/requests/${reviewRequestId}/reviews/${review.id}/reply`,
      {
        method: "POST",
        body: JSON.stringify({ body: "Druga odpowiedź." }),
      },
    );
    assert.equal(duplicate.status, 409);
  });
});

describe("PayU payment authorization", () => {
  const extOrderId = `payu-${testRunId}`;
  const providerOrderId = `provider-${testRunId}`;

  async function sendNotification(
    totalAmount: string,
    signatureKey: string,
    identifiers: { extOrderId?: string; providerOrderId?: string } = {},
  ): Promise<Response> {
    const notificationExtOrderId = identifiers.extOrderId ?? extOrderId;
    const notificationProviderOrderId =
      identifiers.providerOrderId ?? providerOrderId;
    const payload = JSON.stringify({
      order: {
        orderId: notificationProviderOrderId,
        extOrderId: notificationExtOrderId,
        status: "COMPLETED",
        totalAmount,
        currencyCode: "PLN",
      },
    });
    const signature = createHash("md5")
      .update(payload)
      .update(signatureKey)
      .digest("hex");
    return fetch(`${baseUrl}/billing/payu/notifications`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "openpayu-signature": `sender=checkout;signature=${signature};algorithm=MD5;content=DOCUMENT`,
      },
      body: payload,
    });
  }

  it("does not activate access from a browser return or forged webhook", async () => {
    process.env.PAYU_MD5_KEY = `test-key-${testRunId}`;
    await db
      .update(subscriptionsTable)
      .set({ status: "inactive", activationRequested: true })
      .where(eq(subscriptionsTable.profileId, inactiveContractorId));
    const [subscription] = await db
      .select()
      .from(subscriptionsTable)
      .where(eq(subscriptionsTable.profileId, inactiveContractorId));
    assert.ok(subscription);
    await db.insert(paymentsTable).values({
      profileId: inactiveContractorId,
      subscriptionId: subscription.id,
      extOrderId,
      providerOrderId,
      status: "pending",
      amount: 9900,
      currency: "PLN",
      description: "Test PayU",
    });

    const returnResponse = await api(
      inactiveContractorId,
      `/billing/payments/${extOrderId}?payment=return`,
    );
    assert.equal(returnResponse.status, 200);
    assert.equal(responseObject(returnResponse.body).status, "pending");
    assert.equal(
      responseObject(returnResponse.body).canUnlockContacts,
      false,
    );

    const forged = await sendNotification("9900", "wrong-key");
    assert.equal(forged.status, 401);
    const [stillInactive] = await db
      .select()
      .from(subscriptionsTable)
      .where(eq(subscriptionsTable.id, subscription.id));
    assert.notEqual(stillInactive?.status, "active");
  });

  it("rejects a signed notification with a mismatched amount", async () => {
    const response = await sendNotification("1", process.env.PAYU_MD5_KEY!);
    assert.equal(response.status, 400);
    const [payment] = await db
      .select()
      .from(paymentsTable)
      .where(eq(paymentsTable.extOrderId, extOrderId));
    assert.equal(payment?.status, "pending");
  });

  it("activates once after a valid notification and is idempotent", async () => {
    const first = await sendNotification("9900", process.env.PAYU_MD5_KEY!);
    assert.equal(first.status, 204);
    const [afterFirst] = await db
      .select()
      .from(subscriptionsTable)
      .where(eq(subscriptionsTable.profileId, inactiveContractorId));
    assert.equal(afterFirst?.status, "active");
    assert.ok(afterFirst?.accessExpiresAt);

    const second = await sendNotification("9900", process.env.PAYU_MD5_KEY!);
    assert.equal(second.status, 204);
    const [afterSecond] = await db
      .select()
      .from(subscriptionsTable)
      .where(eq(subscriptionsTable.profileId, inactiveContractorId));
    assert.equal(
      afterSecond?.accessExpiresAt?.getTime(),
      afterFirst?.accessExpiresAt?.getTime(),
    );
  });
});

async function startCloudflareTunnel(origin: string): Promise<{
  publicUrl: string;
  stop: () => Promise<void>;
}> {
  const child = spawn(
    "cloudflared",
    ["tunnel", "--no-autoupdate", "--url", origin],
    { stdio: ["ignore", "pipe", "pipe"] as const },
  );
  const publicUrl = await new Promise<string>((resolve, reject) => {
    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error("Cloudflare tunnel did not become ready within 30 seconds"));
    }, 30_000);
    const inspect = (chunk: Buffer) => {
      const match = chunk
        .toString()
        .match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);
      if (!match) return;
      clearTimeout(timeout);
      resolve(match[0]);
    };
    child.stdout.on("data", inspect);
    child.stderr.on("data", inspect);
    child.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once("exit", (code) => {
      clearTimeout(timeout);
      reject(new Error(`Cloudflare tunnel exited early with code ${code}`));
    });
  });

  return {
    publicUrl,
    stop: async () => {
      if (child.exitCode !== null) return;
      child.kill("SIGTERM");
      await new Promise<void>((resolve) => {
        child.once("exit", () => resolve());
        setTimeout(() => {
          child.kill("SIGKILL");
          resolve();
        }, 5_000).unref();
      });
    },
  };
}

async function completeBlikCheckout(
  page: Page,
  redirectUri: string,
  expectedReturnPrefix: string,
  screenshotPath?: string,
): Promise<string> {
  let observedReturn = "";
  const inspectUrl = (url: string) => {
    if (url.startsWith(expectedReturnPrefix)) observedReturn = url;
  };
  page.on("request", (request) => inspectUrl(request.url()));
  page.on("requestfailed", (request) => inspectUrl(request.url()));
  page.on("framenavigated", (frame) => inspectUrl(frame.url()));

  await page.goto(redirectUri, {
    waitUntil: "domcontentloaded",
    timeout: 30_000,
  });
  const inputs = page.locator('input:not([type="hidden"]):visible');
  await inputs.first().waitFor({ state: "visible", timeout: 20_000 });
  let blikInput = inputs.first();
  for (let index = 0; index < (await inputs.count()); index += 1) {
    const input = inputs.nth(index);
    const attributes = [
      await input.getAttribute("name"),
      await input.getAttribute("id"),
      await input.getAttribute("placeholder"),
      await input.getAttribute("autocomplete"),
    ]
      .filter(Boolean)
      .join(" ");
    if (
      /blik|code|kod|one-time/i.test(attributes) ||
      (await input.getAttribute("maxlength")) === "6"
    ) {
      blikInput = input;
      break;
    }
  }
  await blikInput.fill("777123");

  const submit = page.locator('button[type="submit"]:visible');
  if ((await submit.count()) > 0) {
    await submit.last().click();
  } else {
    await blikInput.press("Enter");
  }

  const deadline = Date.now() + 30_000;
  while (!observedReturn && Date.now() < deadline) {
    inspectUrl(page.url());
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  assert.ok(
    observedReturn,
    `PayU did not return to ${expectedReturnPrefix}`,
  );
  if (screenshotPath) {
    await page.screenshot({ path: screenshotPath, fullPage: true });
  }
  return observedReturn;
}

async function waitForPaymentStatus(
  extOrderId: string,
  expectedStatus: "completed",
): Promise<void> {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const [payment] = await db
      .select({ status: paymentsTable.status })
      .from(paymentsTable)
      .where(eq(paymentsTable.extOrderId, extOrderId));
    if (payment?.status === expectedStatus) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  assert.fail(`PayU notification did not set ${extOrderId} to ${expectedStatus}`);
}

payuSandboxDescribe("PayU sandbox checkout", () => {
  it("creates a real sandbox checkout and records release evidence", async () => {
    const requiredSandboxEnv = [
      "PAYU_SANDBOX_CLIENT_ID",
      "PAYU_SANDBOX_CLIENT_SECRET",
      "PAYU_SANDBOX_POS_ID",
      "PAYU_SANDBOX_MD5_KEY",
    ];
    assert.deepEqual(
      requiredSandboxEnv.filter((name) => !process.env[name]),
      [],
      "PayU sandbox credentials are required for the release gate",
    );

    await mkdir(evidenceDir, { recursive: true });
    await writeEvidence(
      "run.json",
      `${JSON.stringify(
        {
          runId: evidenceRunId,
          checkout: "payu-sandbox",
          evidenceVersion: 1,
        },
        null,
        2,
      )}\n`,
    );

    const previousPublicUrl = process.env.PUBLIC_APP_URL;
    const tunnel = await startCloudflareTunnel(serverOrigin);
    process.env.PUBLIC_APP_URL = tunnel.publicUrl;
    const webCheckoutResponse = await api(
      inactiveContractorId,
      "/billing/subscription",
      {
        method: "POST",
        body: JSON.stringify({
          plan: "professional",
          platform: "web",
          acceptTerms: true,
          acceptDigitalService: true,
          acceptRecurringPayments: true,
        }),
      },
    );
    assert.equal(webCheckoutResponse.status, 201);
    const webCheckout = responseObject(webCheckoutResponse.body);
    const webExtOrderId = String(webCheckout.extOrderId);
    const webRedirectUri = String(webCheckout.redirectUri);

    const mobileCheckoutResponse = await api(
      inactiveContractorId,
      "/billing/subscription",
      {
        method: "POST",
        body: JSON.stringify({
          plan: "professional",
          platform: "mobile",
          acceptTerms: true,
          acceptDigitalService: true,
          acceptRecurringPayments: true,
        }),
      },
    );
    assert.equal(mobileCheckoutResponse.status, 201);
    const mobileCheckout = responseObject(mobileCheckoutResponse.body);
    const mobileExtOrderId = String(mobileCheckout.extOrderId);

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    await context.tracing.start({
      screenshots: true,
      snapshots: true,
      sources: true,
    });

    try {
      const webReturn = await completeBlikCheckout(
        await context.newPage(),
        webRedirectUri,
        `${tunnel.publicUrl}/billing`,
        `${evidenceDir}/payu-web-return.png`,
      );
      const returnedWebUrl = new URL(webReturn);
      assert.equal(returnedWebUrl.pathname, "/billing");
      assert.equal(returnedWebUrl.searchParams.get("payment"), "return");
      assert.equal(returnedWebUrl.searchParams.get("order"), webExtOrderId);
      assert.deepEqual(capturedWebReturns.at(-1), {
        order: webExtOrderId,
        payment: "return",
      });

      const mobileReturn = await completeBlikCheckout(
        await context.newPage(),
        String(mobileCheckout.redirectUri),
        "zlemajstra://billing",
      );
      const returnedMobileUrl = new URL(mobileReturn);
      assert.equal(returnedMobileUrl.protocol, "zlemajstra:");
      assert.equal(returnedMobileUrl.pathname, "/billing");
      assert.equal(returnedMobileUrl.searchParams.get("payment"), "return");
      assert.equal(
        returnedMobileUrl.searchParams.get("order"),
        mobileExtOrderId,
      );
      const mobileCapturePath = process.env.PAYU_MOBILE_RETURN_CAPTURE_PATH;
      if (mobileCapturePath) {
        await writeFile(mobileCapturePath, mobileReturn, "utf8");
      }
      await writeEvidence(
        "browser-native-return.log",
        [
          `run_id=${evidenceRunId}`,
          "event=native_deep_link_observed",
          "scheme=zlemajstra",
          "path=/billing",
          "payment=return",
          "order_present=true",
          "",
        ].join("\n"),
      );

      await waitForPaymentStatus(webExtOrderId, "completed");
      await waitForPaymentStatus(mobileExtOrderId, "completed");
      const authenticNotification = capturedPayuNotifications.find(
        ({ rawBody }) => {
          try {
            const body = JSON.parse(rawBody.toString()) as {
              order?: {
                extOrderId?: string;
                status?: string;
                currencyCode?: string;
              };
            };
            return (
              body.order?.extOrderId === webExtOrderId &&
              body.order.status === "COMPLETED"
            );
          } catch {
            return false;
          }
        },
      );
      assert.ok(
        authenticNotification,
        "PayU must deliver a signed callback for the web checkout",
      );
      const callbackBody = JSON.parse(
        authenticNotification.rawBody.toString(),
      ) as {
        order?: { status?: string; currencyCode?: string };
      };
      await writeEvidence(
        "payu-callback.jsonl",
        `${JSON.stringify({
          runId: evidenceRunId,
          event: "payu_callback_received",
          status: callbackBody.order?.status ?? "unknown",
          currency: callbackBody.order?.currencyCode ?? "unknown",
          signaturePresent: Boolean(authenticNotification.signature),
          bodySha256: createHash("sha256")
            .update(authenticNotification.rawBody)
            .digest("hex"),
        })}\n`,
      );

      const finalStatus = await api(
        inactiveContractorId,
        `/billing/payments/${webExtOrderId}`,
      );
      const finalBody = responseObject(finalStatus.body);
      assert.equal(finalBody.status, "completed");
      assert.equal(finalBody.canUnlockContacts, true);

      await writeEvidence(
        "result.json",
        `${JSON.stringify(
          {
            runId: evidenceRunId,
            webReturnObserved: true,
            callbackObserved: true,
            mobileDeepLinkObserved: true,
            webPaymentStatus: finalBody.status,
            mobilePaymentStatus: "completed",
          },
          null,
          2,
        )}\n`,
      );
    } finally {
      await context.tracing.stop({
        path: `${evidenceDir}/payu-checkout.trace.zip`,
      });
      await browser.close();
      await tunnel.stop();
      if (previousPublicUrl === undefined) {
        delete process.env.PUBLIC_APP_URL;
      } else {
        process.env.PUBLIC_APP_URL = previousPublicUrl;
      }
    }
  });
});
