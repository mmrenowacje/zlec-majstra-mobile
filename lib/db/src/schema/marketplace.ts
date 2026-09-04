import {
  boolean,
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// The API uses this table to apply idempotent SQL migrations at startup.
// Keeping it in the Drizzle schema prevents schema pushes from treating it as
// an unmanaged table and proposing its deletion.
export const appMigrationsTable = pgTable("app_migrations", {
  name: text("name").primaryKey(),
  appliedAt: timestamp("applied_at", { withTimezone: true }).notNull().defaultNow(),
});

export const accountRoleEnum = pgEnum("account_role", [
  "customer",
  "contractor",
  "admin",
]);
export const requestCategoryEnum = pgEnum("request_category", [
  "remont",
  "budowa",
  "hydraulika",
  "elektryka",
  "hydraulik",
  "elektryk",
  "malarz",
  "stolarz",
  "plytkarz",
  "brukarz",
  "dekarz",
  "wykonczenia",
  "zlota-raczka",
  "inne",
]);
export const requestStatusEnum = pgEnum("request_status", [
  "open",
  "in_progress",
  "completed",
]);
export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "inactive",
  "active",
  "past_due",
  "canceled",
]);
export const paymentStatusEnum = pgEnum("payment_status", [
  "created",
  "pending",
  "completed",
  "canceled",
  "failed",
]);
export const subscriptionReminderTypeEnum = pgEnum("subscription_reminder_type", [
  "three_day",
  "one_day",
]);
export const subscriptionReminderStatusEnum = pgEnum("subscription_reminder_status", [
  "pending",
  "sending",
  "sent",
  "failed",
]);

export const profilesTable = pgTable("profiles", {
  id: text("id").primaryKey(),
  role: accountRoleEnum("role").notNull().default("customer"),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  companyName: text("company_name"),
  companyAddress: text("company_address"),
  serviceLocation: text("service_location"),
  nip: text("nip"),
  verified: boolean("verified").notNull().default(false),
  isBlocked: boolean("is_blocked").notNull().default(false),
  blockedAt: timestamp("blocked_at", { withTimezone: true }),
  blockedReason: text("blocked_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const jobRequestsTable = pgTable("job_requests", {
  id: serial("id").primaryKey(),
  customerId: text("customer_id").notNull(),
  customerName: text("customer_name").notNull(),
  customerEmail: text("customer_email").notNull(),
  customerPhone: text("customer_phone").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  category: requestCategoryEnum("category").notNull(),
  location: text("location").notNull(),
  address: text("address"),
  budget: text("budget").notNull(),
  status: requestStatusEnum("status").notNull().default("open"),
  isBlocked: boolean("is_blocked").notNull().default(false),
  blockedAt: timestamp("blocked_at", { withTimezone: true }),
  blockedReason: text("blocked_reason"),
  photos: text("photos").array().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const platformSettingsTable = pgTable("platform_settings", {
  id: integer("id").primaryKey().default(1),
  announcement: text("announcement").notNull().default(""),
  supportEmail: text("support_email").notNull().default("aplikacjegniezno@gmail.com"),
  chatbotEnabled: boolean("chatbot_enabled").notNull().default(false),
  chatbotName: text("chatbot_name").notNull().default("Asystent Zleć Majstra"),
  chatbotWelcomeMessage: text("chatbot_welcome_message")
    .notNull()
    .default("Dzień dobry! Jak mogę pomóc w korzystaniu z platformy?"),
  chatbotFallbackMessage: text("chatbot_fallback_message")
    .notNull()
    .default("Nie znam jeszcze odpowiedzi na to pytanie. Skontaktuj się z administratorem."),
  chatbotKnowledgeBase: text("chatbot_knowledge_base")
    .notNull()
    .default(
      "zlecenie, dodać zlecenie => Po zalogowaniu wybierz „Dodaj zlecenie” i uzupełnij formularz.\nfachowiec, kontakt => Fachowiec może rozpocząć rozmowę po aktywacji abonamentu. Dane kontaktowe udostępnia zleceniodawca świadomie w konkretnej rozmowie.\nabonament, płatność, payu => Abonament Profesjonalista jest obsługiwany online przez PayU.",
    ),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const subscriptionsTable = pgTable("subscriptions", {
  id: serial("id").primaryKey(),
  profileId: text("profile_id").notNull().unique(),
  status: subscriptionStatusEnum("status").notNull().default("inactive"),
  planName: text("plan_name").notNull().default("Profesjonalny"),
  monthlyPrice: text("monthly_price").notNull().default("99 zł"),
  activationRequested: boolean("activation_requested").notNull().default(false),
  providerCustomerId: text("provider_customer_id"),
  providerSubscriptionId: text("provider_subscription_id"),
  paymentProvider: text("payment_provider"),
  accessExpiresAt: timestamp("access_expires_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const paymentsTable = pgTable(
  "payments",
  {
    id: serial("id").primaryKey(),
    profileId: text("profile_id").notNull(),
    subscriptionId: integer("subscription_id").notNull(),
    extOrderId: text("ext_order_id").notNull(),
    providerOrderId: text("provider_order_id"),
    status: paymentStatusEnum("status").notNull().default("created"),
    amount: integer("amount").notNull(),
    currency: text("currency").notNull().default("PLN"),
    description: text("description").notNull(),
    consentVersion: text("consent_version"),
    termsAcceptedAt: timestamp("terms_accepted_at", { withTimezone: true }),
    digitalServiceAcceptedAt: timestamp("digital_service_accepted_at", { withTimezone: true }),
    recurringPaymentsAcceptedAt: timestamp("recurring_payments_accepted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("payments_ext_order_id_unique").on(table.extOrderId),
    uniqueIndex("payments_provider_order_id_unique").on(table.providerOrderId),
  ],
);

export const subscriptionStatusHistoryTable = pgTable(
  "subscription_status_history",
  {
    id: serial("id").primaryKey(),
    subscriptionId: integer("subscription_id").notNull(),
    profileId: text("profile_id").notNull(),
    previousStatus: subscriptionStatusEnum("previous_status"),
    newStatus: subscriptionStatusEnum("new_status").notNull(),
    changedByAdminId: text("changed_by_admin_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
);

export const subscriptionRemindersTable = pgTable(
  "subscription_reminders",
  {
    id: serial("id").primaryKey(),
    subscriptionId: integer("subscription_id").notNull(),
    profileId: text("profile_id").notNull(),
    type: subscriptionReminderTypeEnum("type").notNull(),
    accessExpiresAt: timestamp("access_expires_at", { withTimezone: true }).notNull(),
    status: subscriptionReminderStatusEnum("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }),
    leaseUntil: timestamp("lease_until", { withTimezone: true }),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("subscription_reminders_identity_unique").on(
      table.subscriptionId,
      table.type,
      table.accessExpiresAt,
    ),
  ],
);

export const unlockedContactsTable = pgTable("unlocked_contacts", {
  id: serial("id").primaryKey(),
  profileId: text("profile_id").notNull(),
  requestId: integer("request_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const conversationsTable = pgTable(
  "conversations",
  {
    id: serial("id").primaryKey(),
    requestId: integer("request_id").notNull(),
    customerId: text("customer_id").notNull(),
    contractorId: text("contractor_id").notNull(),
    customerContactShared: boolean("customer_contact_shared").notNull().default(false),
    customerContactSharedAt: timestamp("customer_contact_shared_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("conversations_request_contractor_unique").on(
      table.requestId,
      table.contractorId,
    ),
    index("conversations_customer_request_idx").on(
      table.customerId,
      table.requestId,
    ),
  ],
);

export const conversationMessagesTable = pgTable(
  "conversation_messages",
  {
    id: serial("id").primaryKey(),
    conversationId: integer("conversation_id").notNull(),
    senderId: text("sender_id").notNull(),
    body: text("body").notNull(),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("conversation_messages_conversation_created_idx").on(
      table.conversationId,
      table.createdAt,
    ),
  ],
);

export const reviewsTable = pgTable(
  "reviews",
  {
    id: serial("id").primaryKey(),
    requestId: integer("request_id").notNull(),
    customerId: text("customer_id").notNull(),
    contractorId: text("contractor_id").notNull(),
    rating: integer("rating").notNull(),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("reviews_request_contractor_unique").on(
      table.requestId,
      table.contractorId,
    ),
    check("reviews_rating_range", sql`${table.rating} between 1 and 5`),
    check(
      "reviews_body_length",
      sql`char_length(btrim(${table.body})) between 1 and 500`,
    ),
  ],
);

export const reviewRepliesTable = pgTable(
  "review_replies",
  {
    id: serial("id").primaryKey(),
    reviewId: integer("review_id").notNull(),
    contractorId: text("contractor_id").notNull(),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("review_replies_review_unique").on(table.reviewId),
    check(
      "review_replies_body_length",
      sql`char_length(btrim(${table.body})) between 1 and 500`,
    ),
  ],
);

export const projectPhotosTable = pgTable(
  "project_photos",
  {
    id: serial("id").primaryKey(),
    reviewId: integer("review_id").notNull(),
    requestId: integer("request_id").notNull(),
    contractorId: text("contractor_id").notNull(),
    objectPath: text("object_path").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("project_photos_object_path_unique").on(table.objectPath),
    index("project_photos_contractor_created_idx").on(table.contractorId, table.createdAt),
  ],
);
