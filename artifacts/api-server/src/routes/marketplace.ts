import { clerkClient, getAuth } from "@clerk/express";
import { randomUUID } from "node:crypto";
import {
  type NextFunction,
  Router,
  type IRouter,
  type Request,
  type Response,
} from "express";
import { and, desc, eq, gte, inArray, isNull, ne, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import {
  CreateRequestBody,
  CreateRequestResponse,
  CreateRequestReviewBody,
  CreateRequestReviewParams,
  CreateRequestReviewResponse,
  CreateReviewReplyBody,
  CreateReviewReplyParams,
  CreateReviewReplyResponse,
  AddProjectPhotoBody,
  AddProjectPhotoParams,
  AddProjectPhotoResponse,
  GetRequestConversationParams,
  GetRequestConversationResponse,
  GetNotificationsResponse,
  GetRequestConversationByIdParams,
  GetRequestConversationByIdResponse,
  ListRequestConversationsParams,
  ListRequestConversationsResponse,
  SendConversationMessageBody,
  SendConversationMessageParams,
  SendConversationMessageResponse,
  SendConversationMessageByIdBody,
  SendConversationMessageByIdParams,
  SendConversationMessageByIdResponse,
  SendChatbotMessageBody,
  SendChatbotMessageResponse,
  ShareRequestContactParams,
  ShareRequestContactResponse,
  ShareRequestContactByIdParams,
  ShareRequestContactByIdResponse,
  StartRequestConversationParams,
  StartRequestConversationResponse,
  DeleteAdminRequestParams,
  DeleteAdminUserParams,
  GetAdminOverviewResponse,
  GetAdminSettingsResponse,
  GetDashboardSummaryResponse,
  GetContractorProfileParams,
  GetContractorProfileResponse,
  GetMyProfileResponse,
  GetRequestParams,
  GetRequestResponse,
  GetSiteSettingsResponse,
  GetPaymentStatusParams,
  GetPaymentStatusResponse,
  GetSubscriptionResponse,
  ListAdminSubscriptionHistoryParams,
  ListAdminSubscriptionHistoryResponse,
  ListAdminSubscriptionsQueryParams,
  ListAdminSubscriptionsResponse,
  ListAdminRequestsResponse,
  ListAdminUsersQueryParams,
  ListAdminUsersResponse,
  ListRequestReviewsParams,
  ListRequestReviewsResponse,
  ListReviewCandidatesParams,
  ListReviewCandidatesResponse,
  UpdateAdminSubscriptionBody,
  UpdateAdminSubscriptionParams,
  UpdateAdminSubscriptionResponse,
  UpdateAdminRequestBody,
  UpdateAdminRequestParams,
  UpdateAdminRequestResponse,
  UpdateAdminSettingsBody,
  UpdateAdminSettingsResponse,
  UpdateAdminUserBody,
  UpdateAdminUserParams,
  UpdateAdminUserResponse,
  ListRequestsQueryParams,
  ListRequestsResponse,
  StartSubscriptionBody,
  StartSubscriptionResponse,
  ReceivePayuNotificationBody,
  UnlockRequestContactParams,
  UnlockRequestContactResponse,
  UpdateMyProfileBody,
  UpdateRequestBody,
  UpdateRequestParams,
  UpdateRequestResponse,
} from "@workspace/api-zod";
import {
  db,
  conversationMessagesTable,
  conversationsTable,
  jobRequestsTable,
  paymentsTable,
  platformSettingsTable,
  profilesTable,
  projectPhotosTable,
  reviewRepliesTable,
  reviewsTable,
  subscriptionsTable,
  subscriptionRemindersTable,
  subscriptionStatusHistoryTable,
  unlockedContactsTable,
} from "@workspace/db";
import {
  createPayuOrder,
  payuContinueUrl,
  verifyPayuNotification,
} from "../lib/payu";
import { projectPhotoExists } from "./storage";
import { isWithinContractorServiceArea } from "../lib/service-area";
const PROFESSIONAL_PLAN = {
  name: "Profesjonalista",
  monthlyPrice: "99 zł / mies.",
  amount: 9900,
  currency: "PLN",
} as const;
const PAYMENT_INSTRUCTIONS =
  "Płatność jest obsługiwana online przez PayU. Dostęp zostanie aktywowany po potwierdzeniu płatności przez PayU.";
const PAYMENT_ACCESS_DAYS = 30;
const PAYMENT_CONSENT_VERSION = "2026-08-31";
const SUBSCRIPTION_REMINDER_DAYS = 3;
const DAY_IN_MS = 24 * 60 * 60 * 1000;
const configuredAdminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase() ?? "";

const router: IRouter = Router();
const subscriptionHistoryAdminProfiles = alias(
  profilesTable,
  "subscription_history_admin_profiles",
);

type Viewer = {
  id: string | null;
  role: "customer" | "contractor" | "admin" | null;
  hasActiveSubscription: boolean;
};

function profileId(req: Request): string | null {
  return getAuth(req).userId;
}

function authenticatedProfileId(req: Request, res: Response): string | null {
  const userId = profileId(req);
  if (!userId) {
    res.status(401).json({ error: "Uwierzytelnienie jest wymagane" });
    return null;
  }
  return userId;
}

async function clerkIdentity(userId: string) {
  const user = await clerkClient.users.getUser(userId);
  const primaryEmail = user.primaryEmailAddress?.emailAddress;
  const verified = user.emailAddresses.some(
    (email) =>
      email.id === user.primaryEmailAddressId &&
      email.verification?.status === "verified",
  );
  return { email: primaryEmail, verified, imageUrl: user.imageUrl ?? null };
}

router.use(
  async (req, res, next: NextFunction): Promise<void> => {
    const id = profileId(req);
    if (!id) {
      next();
      return;
    }
    const [profile] = await db
      .select({
        isBlocked: profilesTable.isBlocked,
        blockedReason: profilesTable.blockedReason,
      })
      .from(profilesTable)
      .where(eq(profilesTable.id, id));
    if (profile?.isBlocked) {
      res.status(403).json({
        error: "Konto zostało zablokowane",
        reason: profile.blockedReason,
      });
      return;
    }
    next();
  },
);

function normalizeStoredRequestPhotos(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((photo): photo is string => typeof photo === "string");
  }
  if (typeof value !== "string") return [];

  const trimmed = value.trim();
  if (!trimmed) return [];
  try {
    return normalizeStoredRequestPhotos(JSON.parse(trimmed));
  } catch {
    return [trimmed];
  }
}

function toPublicRequest(
  row: typeof jobRequestsTable.$inferSelect,
  revealContact = false,
) {
  const photos = normalizeStoredRequestPhotos(row.photos).flatMap((photo) => {
    const objectPath = photo.startsWith("/api/storage/objects/uploads/")
      ? photo.slice("/api/storage".length)
      : photo;
    return /^\/objects\/uploads\/[a-f0-9-]+$/.test(objectPath)
      ? [`/api/storage${objectPath}`]
      : [];
  });
  return {
    id: row.id,
    customerName: row.customerName,
    title: row.title,
    description: row.description,
    category: row.category,
    location: row.location,
    address: revealContact ? row.address : null,
    budget: row.budget,
    status: row.status,
    createdAt: row.createdAt,
    photos,
    contactAvailable: revealContact,
    customerEmail: revealContact ? row.customerEmail : null,
    customerPhone: revealContact ? row.customerPhone : null,
  };
}

function toAdminRequest(row: typeof jobRequestsTable.$inferSelect) {
  return {
    id: row.id,
    customerId: row.customerId,
    customerName: row.customerName,
    customerEmail: row.customerEmail,
    customerPhone: row.customerPhone,
    title: row.title,
    description: row.description,
    category: row.category,
    location: row.location,
    address: row.address,
    budget: row.budget,
    status: row.status,
    isBlocked: row.isBlocked,
    blockedAt: row.blockedAt,
    blockedReason: row.blockedReason,
    photos: row.photos,
    createdAt: row.createdAt,
  };
}

async function getPlatformSettings() {
  const [existing] = await db
    .select()
    .from(platformSettingsTable)
    .where(eq(platformSettingsTable.id, 1));
  if (existing) return existing;

  await db
    .insert(platformSettingsTable)
    .values({ id: 1 })
    .onConflictDoNothing({ target: platformSettingsTable.id });
  const [created] = await db
    .select()
    .from(platformSettingsTable)
    .where(eq(platformSettingsTable.id, 1));
  if (!created) throw new Error("Nie udało się utworzyć ustawień platformy");
  return created;
}

function createChatbotReply(
  message: string,
  settings: Awaited<ReturnType<typeof getPlatformSettings>>,
) {
  const normalized = message.toLocaleLowerCase("pl-PL");
  let best: { score: number; reply: string } | null = null;

  for (const line of settings.chatbotKnowledgeBase.split("\n")) {
    const [rawKeywords, ...answerParts] = line.split("=>");
    const reply = answerParts.join("=>").trim();
    if (!rawKeywords || !reply) continue;
    const score = rawKeywords
      .split(",")
      .map((keyword) => keyword.trim().toLocaleLowerCase("pl-PL"))
      .filter(Boolean)
      .reduce(
        (total, keyword) => total + (normalized.includes(keyword) ? 1 : 0),
        0,
      );
    if (score > 0 && (!best || score > best.score)) best = { score, reply };
  }

  return best?.reply ?? settings.chatbotFallbackMessage;
}

async function contractorServiceLocation(
  contractorId: string,
): Promise<string | null> {
  const [profile] = await db
    .select({ serviceLocation: profilesTable.serviceLocation })
    .from(profilesTable)
    .where(eq(profilesTable.id, contractorId));
  return profile?.serviceLocation?.trim() || null;
}

async function contractorCanAccessRequest(
  contractorId: string,
  requestLocation: string,
): Promise<boolean> {
  const serviceLocation = await contractorServiceLocation(contractorId);
  return Boolean(
    serviceLocation &&
      isWithinContractorServiceArea(requestLocation, serviceLocation),
  );
}

router.get("/me", async (req, res): Promise<void> => {
  const id = authenticatedProfileId(req, res);
  if (!id) return;
  const identity = await clerkIdentity(id);
  let [profile] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.id, id));

  if (!profile) {
    res.status(404).json({ error: "Profil wymaga uzupełnienia" });
    return;
  }
  if (
    identity.email &&
    (profile.email !== identity.email || profile.verified !== identity.verified)
  ) {
    [profile] = await db
      .update(profilesTable)
      .set({ email: identity.email, verified: identity.verified })
      .where(eq(profilesTable.id, id))
      .returning();
  }

  res.json(
    GetMyProfileResponse.parse({
      ...profile,
      profileImageUrl: identity.imageUrl,
    }),
  );
});

router.patch("/me", async (req, res): Promise<void> => {
  const parsed = UpdateMyProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const id = authenticatedProfileId(req, res);
  if (!id) return;
  const identity = await clerkIdentity(id);
  if (!identity.email || !identity.verified) {
    res.status(422).json({ error: "Zweryfikowany email jest wymagany" });
    return;
  }

  const isConfiguredAdmin =
    configuredAdminEmail.length > 0 &&
    identity.email.toLowerCase() === configuredAdminEmail;
  const [existingProfile] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.id, id));
  const effectiveRole = isConfiguredAdmin
    ? ("admin" as const)
    : existingProfile?.role === "admin" && configuredAdminEmail
      ? parsed.data.role
      : existingProfile?.role ?? parsed.data.role;
  const companyName = parsed.data.companyName?.trim() || null;
  const companyAddress = parsed.data.companyAddress?.trim() || null;
  const serviceLocation = parsed.data.serviceLocation?.trim() || null;
  const submittedNip = parsed.data.nip?.trim() || null;
  const nip = existingProfile?.nip ?? submittedNip;

  if (
    existingProfile?.nip &&
    submittedNip &&
    submittedNip !== existingProfile.nip
  ) {
    res.status(409).json({ error: "Numer NIP nie może zostać zmieniony" });
    return;
  }
  if (
    effectiveRole === "contractor" &&
    (!companyName || !companyAddress || !serviceLocation || !nip)
  ) {
    res.status(400).json({
      error: "Nazwa firmy, adres firmy, miejscowość obsługi i 10-cyfrowy NIP są wymagane",
    });
    return;
  }

  const profileValues = {
    id,
    role: effectiveRole,
    firstName: parsed.data.firstName,
    lastName: parsed.data.lastName,
    phone: parsed.data.phone,
    companyName: effectiveRole === "contractor" ? companyName : null,
    companyAddress: effectiveRole === "contractor" ? companyAddress : null,
    serviceLocation: effectiveRole === "contractor" ? serviceLocation : null,
    nip: effectiveRole === "contractor" ? nip : null,
    email: identity.email,
    verified: identity.verified,
  };
  const profileUpdateValues = {
    firstName: parsed.data.firstName,
    lastName: parsed.data.lastName,
    phone: parsed.data.phone,
    ...(effectiveRole === "contractor"
      ? { companyName, companyAddress, serviceLocation, nip }
      : {}),
    email: identity.email,
    verified: identity.verified,
    ...(isConfiguredAdmin ? { role: "admin" as const } : {}),
  };

  const [profile] = await db
    .insert(profilesTable)
    .values(profileValues)
    .onConflictDoUpdate({
      target: profilesTable.id,
      set: profileUpdateValues,
    })
    .returning();

  res.json(
    GetMyProfileResponse.parse({
      ...profile,
      profileImageUrl: identity.imageUrl,
    }),
  );
});

router.get("/contractors/:contractorId/profile", async (req, res): Promise<void> => {
  const params = GetContractorProfileParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Nieprawidłowy identyfikator fachowca" });
    return;
  }
  const id = authenticatedProfileId(req, res);
  if (!id) return;
  const [profile] = await db
    .select()
    .from(profilesTable)
    .where(and(eq(profilesTable.id, params.data.contractorId), eq(profilesTable.role, "contractor")));
  if (!profile || profile.isBlocked) {
    res.status(404).json({ error: "Nie znaleziono fachowca" });
    return;
  }
  const contractorReviews = await db
    .select()
    .from(reviewsTable)
    .where(eq(reviewsTable.contractorId, profile.id));
  const completedProjects = await db
    .select()
    .from(projectPhotosTable)
    .where(eq(projectPhotosTable.contractorId, profile.id))
    .orderBy(desc(projectPhotosTable.createdAt));
  let profileImageUrl: string | null = null;
  try {
    profileImageUrl = (await clerkIdentity(profile.id)).imageUrl;
  } catch {
    profileImageUrl = null;
  }
  const averageRating = contractorReviews.length
    ? contractorReviews.reduce((sum, review) => sum + review.rating, 0) / contractorReviews.length
    : 0;
  res.json(GetContractorProfileResponse.parse({
    id: profile.id,
    firstName: profile.firstName,
    lastName: profile.lastName,
    companyName: profile.companyName,
    companyAddress: profile.companyAddress,
    serviceLocation: profile.serviceLocation,
    nip: profile.nip,
    profileImageUrl,
    verified: profile.verified,
    averageRating,
    reviewCount: contractorReviews.length,
    completedProjects: completedProjects.map(photo => ({
      ...photo,
      imageUrl: `/api/storage${photo.objectPath}`,
    })),
  }));
});

router.get("/site/settings", async (_req, res): Promise<void> => {
  const settings = await getPlatformSettings();
  res.json(
    GetSiteSettingsResponse.parse({
      announcement: settings.announcement,
      supportEmail: settings.supportEmail,
      chatbotEnabled: settings.chatbotEnabled,
      chatbotName: settings.chatbotName,
      chatbotWelcomeMessage: settings.chatbotWelcomeMessage,
    }),
  );
});

router.post("/chatbot/messages", async (req, res): Promise<void> => {
  const body = SendChatbotMessageBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Wpisz wiadomość do czatbota" });
    return;
  }
  const settings = await getPlatformSettings();
  if (!settings.chatbotEnabled) {
    res.status(404).json({ error: "Czatbot jest obecnie wyłączony" });
    return;
  }
  res.json(
    SendChatbotMessageResponse.parse({
      reply: createChatbotReply(body.data.message, settings),
    }),
  );
});

router.get("/requests", async (req, res): Promise<void> => {
  const parsed = ListRequestsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const viewer = await getViewer(req);
  const filters = [eq(jobRequestsTable.isBlocked, false)];
  if (parsed.data.category) {
    filters.push(
      eq(
        jobRequestsTable.category,
        parsed.data.category as typeof jobRequestsTable.category.enumValues[number],
      ),
    );
  }
  if (parsed.data.status) {
    filters.push(
      eq(
        jobRequestsTable.status,
        parsed.data.status as typeof jobRequestsTable.status.enumValues[number],
      ),
    );
  }
  if (parsed.data.mine) {
    if (!viewer.id) {
      res.status(401).json({ error: "Uwierzytelnienie jest wymagane" });
      return;
    }
    if (viewer.role === "contractor") {
      const relatedRequests = await db
        .select({ requestId: unlockedContactsTable.requestId })
        .from(unlockedContactsTable)
        .where(eq(unlockedContactsTable.profileId, viewer.id));
      const relatedRequestIds = relatedRequests.map((item) => item.requestId);
      filters.push(
        relatedRequestIds.length > 0
          ? inArray(jobRequestsTable.id, relatedRequestIds)
          : sql`false`,
      );
    } else {
      filters.push(eq(jobRequestsTable.customerId, viewer.id));
    }
  }

  const rows = await db
    .select()
    .from(jobRequestsTable)
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(jobRequestsTable.createdAt));
  let visibleRows = rows;
  if (viewer.id && viewer.role === "contractor") {
    const serviceLocation = await contractorServiceLocation(viewer.id);
    visibleRows = serviceLocation
      ? rows.filter((row) =>
          isWithinContractorServiceArea(row.location, serviceLocation),
        )
      : [];
  }

  const consentedConversations = viewer.id && viewer.role === "contractor"
    ? await db
        .select({ requestId: conversationsTable.requestId })
        .from(conversationsTable)
        .where(
          and(
            eq(conversationsTable.contractorId, viewer.id),
            eq(conversationsTable.customerContactShared, true),
          ),
        )
    : [];
  const consentedRequestIds = new Set(
    consentedConversations.map((item) => item.requestId),
  );

  res.json(
    ListRequestsResponse.parse(
      visibleRows.map((row) =>
        toPublicRequest(
          row,
          row.customerId === viewer.id ||
            (viewer.role === "contractor" &&
              viewer.hasActiveSubscription &&
              consentedRequestIds.has(row.id)),
        ),
      ),
    ),
  );
});

router.post("/requests", async (req, res): Promise<void> => {
  const parsed = CreateRequestBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if (
    parsed.data.photos?.length &&
    !(await Promise.all(parsed.data.photos.map(projectPhotoExists))).every(Boolean)
  ) {
    res.status(400).json({ error: "Co najmniej jedno zdjęcie nie zostało przesłane" });
    return;
  }

  const id = authenticatedProfileId(req, res);
  if (!id) return;
  const [profile] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.id, id));
  const [created] = await db
    .insert(jobRequestsTable)
    .values({
      customerId: id,
      customerName: profile
        ? `${profile.firstName} ${profile.lastName[0]}.`
        : "Klient",
      customerEmail: profile?.email ?? "kontakt@klient.pl",
      customerPhone: profile?.phone ?? "+48 000 000 000",
      ...parsed.data,
      photos: parsed.data.photos ?? [],
    })
    .returning();

  res.status(201).json(CreateRequestResponse.parse(toPublicRequest(created, true)));
});

router.use("/requests/:id", async (req, res, next): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = Number(rawId);
  if (!Number.isInteger(id)) {
    next();
    return;
  }
  const [request] = await db
    .select({ isBlocked: jobRequestsTable.isBlocked })
    .from(jobRequestsTable)
    .where(eq(jobRequestsTable.id, id));
  if (request?.isBlocked) {
    res.status(404).json({ error: "Zlecenie jest niedostępne" });
    return;
  }
  next();
});

router.get("/requests/:id", async (req, res): Promise<void> => {
  const params = GetRequestParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db
    .select()
    .from(jobRequestsTable)
    .where(eq(jobRequestsTable.id, params.data.id));
  if (!row) {
    res.status(404).json({ error: "Nie znaleziono zlecenia" });
    return;
  }

  const viewer = await getViewer(req);
  if (
    viewer.id &&
    viewer.role === "contractor" &&
    !(await contractorCanAccessRequest(viewer.id, row.location))
  ) {
    res.status(404).json({ error: "Zlecenie jest poza Twoim obszarem działania" });
    return;
  }
  const [consentedConversation] =
    viewer.id && viewer.role === "contractor"
      ? await db
        .select({ id: conversationsTable.id })
        .from(conversationsTable)
        .where(
          and(
            eq(conversationsTable.contractorId, viewer.id),
            eq(conversationsTable.requestId, row.id),
            eq(conversationsTable.customerContactShared, true),
          ),
        )
      : [];
  const revealContact =
    row.customerId === viewer.id ||
    (viewer.role === "contractor" &&
      viewer.hasActiveSubscription &&
      Boolean(consentedConversation));

  res.json(GetRequestResponse.parse(toPublicRequest(row, revealContact)));
});

router.patch("/requests/:id", async (req, res): Promise<void> => {
  const params = UpdateRequestParams.safeParse(req.params);
  const body = UpdateRequestBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Nieprawidłowe dane zlecenia" });
    return;
  }
  if (
    body.data.photos?.length &&
    !(await Promise.all(body.data.photos.map(projectPhotoExists))).every(Boolean)
  ) {
    res.status(400).json({ error: "Co najmniej jedno zdjęcie nie zostało przesłane" });
    return;
  }

  const id = authenticatedProfileId(req, res);
  if (!id) return;
  const contentFields = ["title", "description", "category", "location", "address", "budget", "photos"] as const;
  const changesContent = contentFields.some(field => body.data[field] !== undefined);
  if (changesContent) {
    const [sharedConversation] = await db
      .select({ id: conversationsTable.id })
      .from(conversationsTable)
      .where(and(
        eq(conversationsTable.requestId, params.data.id),
        eq(conversationsTable.customerId, id),
        eq(conversationsTable.customerContactShared, true),
      ));
    if (sharedConversation) {
      res.status(409).json({ error: "Zlecenia nie można edytować po udostępnieniu danych fachowcowi" });
      return;
    }
  }
  const [updated] = await db
    .update(jobRequestsTable)
    .set(body.data)
    .where(
      and(
        eq(jobRequestsTable.id, params.data.id),
        eq(jobRequestsTable.customerId, id),
      ),
    )
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Nie znaleziono zlecenia" });
    return;
  }
  res.json(UpdateRequestResponse.parse(toPublicRequest(updated, true)));
});

router.post("/requests/:id/unlock", async (req, res): Promise<void> => {
  const id = authenticatedProfileId(req, res);
  if (!id) return;

  const params = UnlockRequestContactParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [request] = await db
    .select()
    .from(jobRequestsTable)
    .where(eq(jobRequestsTable.id, params.data.id));
  if (!request) {
    res.status(404).json({ error: "Nie znaleziono zlecenia" });
    return;
  }
  if (request.customerId !== id) {
    res.status(403).json({ error: "Tylko właściciel zlecenia może udostępnić kontakt" });
    return;
  }
  const conversation = await singleCustomerConversation(request.id, id);
  if (!conversation) {
    res.status(409).json({ error: "Wybierz konkretną rozmowę w komunikatorze" });
    return;
  }
  await db.transaction(async (tx) => {
    await tx.update(conversationsTable).set({
      customerContactShared: true,
      customerContactSharedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(conversationsTable.id, conversation.id));
    await tx.insert(unlockedContactsTable)
      .values({ profileId: conversation.contractorId, requestId: request.id })
      .onConflictDoNothing();
  });
  res.json(
    UnlockRequestContactResponse.parse({
      requestId: request.id,
      unlocked: true,
      message: "Dane kontaktowe zostały udostępnione fachowcowi",
      customerEmail: null,
      customerPhone: null,
    }),
  );
});

async function conversationPayload(
  requestId: number,
  viewerId: string,
  canRevealContact = false,
  markAsRead = false,
) {
  const [conversation] = await db.select().from(conversationsTable)
    .where(
      and(
        eq(conversationsTable.requestId, requestId),
        eq(conversationsTable.contractorId, viewerId),
      ),
    )
    .limit(1);
  if (!conversation) return null;
  return conversationPayloadById(
    conversation.id,
    requestId,
    viewerId,
    canRevealContact,
    markAsRead,
  );
}

async function conversationPayloadById(
  conversationId: number,
  requestId: number,
  viewerId: string,
  canRevealContact = false,
  markAsRead = false,
) {
  const [request] = await db
    .select()
    .from(jobRequestsTable)
    .where(eq(jobRequestsTable.id, requestId));
  if (!request) return null;

  const [conversation] = await db.select().from(conversationsTable)
    .where(
      and(
        eq(conversationsTable.id, conversationId),
        eq(conversationsTable.requestId, requestId),
        or(
          eq(conversationsTable.contractorId, viewerId),
          eq(conversationsTable.customerId, viewerId),
        ),
      ),
    );
  if (!conversation) return null;
  if (markAsRead) {
    await db.update(conversationMessagesTable)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(conversationMessagesTable.conversationId, conversation.id),
          isNull(conversationMessagesTable.readAt),
          ne(conversationMessagesTable.senderId, viewerId),
        ),
      );
  }
  const messages = await db.select().from(conversationMessagesTable)
    .where(eq(conversationMessagesTable.conversationId, conversation.id))
    .orderBy(conversationMessagesTable.createdAt);
  const [contractor] = await db
    .select({
      firstName: profilesTable.firstName,
      lastName: profilesTable.lastName,
      companyName: profilesTable.companyName,
    })
    .from(profilesTable)
    .where(eq(profilesTable.id, conversation.contractorId));
  const contractorReviews =
    viewerId === conversation.customerId
      ? await reviewResponsesForContractor(conversation.contractorId)
      : [];
  const contractorAverageRating = contractorReviews.length
    ? Math.round(
        (contractorReviews.reduce((sum, review) => sum + review.rating, 0) /
          contractorReviews.length) *
          10,
      ) / 10
    : 0;
  return {
    ...conversation,
    contractorName: contractor
      ? contractorDisplayName(contractor)
      : contractorReviews[0]?.contractorName ?? "Fachowiec",
    contractorAverageRating,
    contractorReviewCount: contractorReviews.length,
    contractorReviews,
    customerEmail: conversation.customerContactShared && viewerId === conversation.contractorId && canRevealContact ? request?.customerEmail ?? null : null,
    customerPhone: conversation.customerContactShared && viewerId === conversation.contractorId && canRevealContact ? request?.customerPhone ?? null : null,
    messages,
  };
}

async function singleCustomerConversation(requestId: number, customerId: string) {
  const conversations = await db.select().from(conversationsTable)
    .where(
      and(
        eq(conversationsTable.requestId, requestId),
        eq(conversationsTable.customerId, customerId),
      ),
    )
    .orderBy(desc(conversationsTable.updatedAt), desc(conversationsTable.id))
    .limit(2);
  return conversations.length === 1 ? conversations[0] : null;
}

router.get("/requests/:id/conversation", async (req, res): Promise<void> => {
  const id = authenticatedProfileId(req, res); if (!id) return;
  const params = GetRequestConversationParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Nieprawidłowe zlecenie" }); return; }
  const viewer = await getViewer(req);
  if (viewer.role === "contractor" && !viewer.hasActiveSubscription) { res.status(402).json({ error: "Aktywny, opłacony abonament jest wymagany" }); return; }
  const payload = await conversationPayload(params.data.id, id, viewer.hasActiveSubscription, true);
  if (!payload) { res.status(404).json({ error: "Rozmowa jeszcze nie istnieje" }); return; }
  res.json(GetRequestConversationResponse.parse(payload));
});

router.post("/requests/:id/conversation", async (req, res): Promise<void> => {
  const id = authenticatedProfileId(req, res); if (!id) return;
  const params = StartRequestConversationParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Nieprawidłowe zlecenie" }); return; }
  const viewer = await getViewer(req);
  if (viewer.role !== "contractor") { res.status(403).json({ error: "Tylko fachowiec może rozpocząć rozmowę" }); return; }
  if (!viewer.hasActiveSubscription) { res.status(402).json({ error: "Aktywny, opłacony abonament jest wymagany" }); return; }
  const [request] = await db.select().from(jobRequestsTable).where(eq(jobRequestsTable.id, params.data.id));
  if (!request) { res.status(404).json({ error: "Nie znaleziono zlecenia" }); return; }
  if (!(await contractorCanAccessRequest(id, request.location))) {
    res.status(403).json({ error: "Zlecenie jest poza Twoim obszarem działania" });
    return;
  }
  await db.insert(conversationsTable).values({ requestId: request.id, customerId: request.customerId, contractorId: id }).onConflictDoNothing();
  const payload = await conversationPayload(request.id, id, true);
  res.status(201).json(StartRequestConversationResponse.parse(payload));
});

router.post("/requests/:id/conversation/messages", async (req, res): Promise<void> => {
  const id = authenticatedProfileId(req, res); if (!id) return;
  const params = SendConversationMessageParams.safeParse(req.params);
  const body = SendConversationMessageBody.safeParse(req.body);
  if (!params.success || !body.success) { res.status(400).json({ error: "Nieprawidłowa wiadomość" }); return; }
  const viewer = await getViewer(req);
  if (viewer.role === "contractor" && !viewer.hasActiveSubscription) { res.status(402).json({ error: "Aktywny, opłacony abonament jest wymagany" }); return; }
  let payload = await conversationPayload(params.data.id, id, viewer.hasActiveSubscription);
  if (!payload) {
    if (viewer.role !== "contractor" || !viewer.hasActiveSubscription) { res.status(403).json({ error: "Brak dostępu do rozmowy" }); return; }
    const [request] = await db.select().from(jobRequestsTable).where(eq(jobRequestsTable.id, params.data.id));
    if (!request) { res.status(404).json({ error: "Nie znaleziono zlecenia" }); return; }
    if (!(await contractorCanAccessRequest(id, request.location))) {
      res.status(403).json({ error: "Zlecenie jest poza Twoim obszarem działania" });
      return;
    }
    await db.insert(conversationsTable).values({ requestId: request.id, customerId: request.customerId, contractorId: id }).onConflictDoNothing();
    payload = await conversationPayload(request.id, id, true);
  }
  if (!payload) { res.status(403).json({ error: "Brak dostępu do rozmowy" }); return; }
  const [message] = await db.insert(conversationMessagesTable).values({
    conversationId: payload.id, senderId: id, body: body.data.body.trim(),
  }).returning();
  await db.update(conversationsTable).set({ updatedAt: new Date() }).where(eq(conversationsTable.id, payload.id));
  res.status(201).json(SendConversationMessageResponse.parse(message));
});

router.post("/requests/:id/conversation/share-contact", async (req, res): Promise<void> => {
  const id = authenticatedProfileId(req, res); if (!id) return;
  const params = ShareRequestContactParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Nieprawidłowe zlecenie" }); return; }
  const [request] = await db.select().from(jobRequestsTable).where(eq(jobRequestsTable.id, params.data.id));
  if (!request || request.customerId !== id) { res.status(403).json({ error: "Tylko właściciel zlecenia może udostępnić kontakt" }); return; }
  const conversation = await singleCustomerConversation(request.id, id);
  if (!conversation) {
    res.status(409).json({ error: "Wybierz konkretną rozmowę przed udostępnieniem kontaktu" });
    return;
  }
  const payload = await conversationPayloadById(conversation.id, request.id, id);
  if (!payload) { res.status(404).json({ error: "Rozmowa jeszcze nie istnieje" }); return; }
  await db.transaction(async (tx) => {
    await tx.update(conversationsTable).set({ customerContactShared: true, customerContactSharedAt: new Date(), updatedAt: new Date() }).where(eq(conversationsTable.id, payload.id));
    await tx.insert(unlockedContactsTable).values({ profileId: payload.contractorId, requestId: request.id }).onConflictDoNothing();
  });
  res.json(ShareRequestContactResponse.parse(await conversationPayloadById(payload.id, request.id, id)));
});

router.get("/requests/:id/conversations", async (req, res): Promise<void> => {
  const id = authenticatedProfileId(req, res); if (!id) return;
  const params = ListRequestConversationsParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Nieprawidłowe zlecenie" }); return; }
  const [request] = await db.select().from(jobRequestsTable).where(eq(jobRequestsTable.id, params.data.id));
  if (!request || request.customerId !== id) {
    res.status(403).json({ error: "Tylko właściciel zlecenia może przeglądać rozmowy" });
    return;
  }
  const conversations = await db.select({ id: conversationsTable.id })
    .from(conversationsTable)
    .where(
      and(
        eq(conversationsTable.requestId, request.id),
        eq(conversationsTable.customerId, id),
      ),
    )
    .orderBy(desc(conversationsTable.updatedAt), desc(conversationsTable.id));
  const payloads = await Promise.all(
    conversations.map(({ id: conversationId }) =>
      conversationPayloadById(conversationId, request.id, id),
    ),
  );
  res.json(ListRequestConversationsResponse.parse(payloads.filter(Boolean)));
});

router.get("/requests/:id/conversations/:conversationId", async (req, res): Promise<void> => {
  const id = authenticatedProfileId(req, res); if (!id) return;
  const params = GetRequestConversationByIdParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Nieprawidłowa rozmowa" }); return; }
  const viewer = await getViewer(req);
  if (viewer.role === "contractor" && !viewer.hasActiveSubscription) {
    res.status(402).json({ error: "Aktywny, opłacony abonament jest wymagany" });
    return;
  }
  const payload = await conversationPayloadById(
    params.data.conversationId,
    params.data.id,
    id,
    viewer.hasActiveSubscription,
    true,
  );
  if (!payload) { res.status(403).json({ error: "Brak dostępu do rozmowy" }); return; }
  res.json(GetRequestConversationByIdResponse.parse(payload));
});

router.post("/requests/:id/conversations/:conversationId/messages", async (req, res): Promise<void> => {
  const id = authenticatedProfileId(req, res); if (!id) return;
  const params = SendConversationMessageByIdParams.safeParse(req.params);
  const body = SendConversationMessageByIdBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Nieprawidłowa wiadomość" });
    return;
  }
  const viewer = await getViewer(req);
  if (viewer.role === "contractor" && !viewer.hasActiveSubscription) {
    res.status(402).json({ error: "Aktywny, opłacony abonament jest wymagany" });
    return;
  }
  const payload = await conversationPayloadById(
    params.data.conversationId,
    params.data.id,
    id,
  );
  if (!payload) { res.status(403).json({ error: "Brak dostępu do rozmowy" }); return; }
  const [message] = await db.insert(conversationMessagesTable).values({
    conversationId: payload.id,
    senderId: id,
    body: body.data.body.trim(),
  }).returning();
  await db.update(conversationsTable)
    .set({ updatedAt: new Date() })
    .where(eq(conversationsTable.id, payload.id));
  res.status(201).json(SendConversationMessageByIdResponse.parse(message));
});

router.post("/requests/:id/conversations/:conversationId/share-contact", async (req, res): Promise<void> => {
  const id = authenticatedProfileId(req, res); if (!id) return;
  const params = ShareRequestContactByIdParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Nieprawidłowa rozmowa" }); return; }
  const [request] = await db.select().from(jobRequestsTable).where(eq(jobRequestsTable.id, params.data.id));
  if (!request || request.customerId !== id) {
    res.status(403).json({ error: "Tylko właściciel zlecenia może udostępnić kontakt" });
    return;
  }
  const payload = await conversationPayloadById(
    params.data.conversationId,
    request.id,
    id,
  );
  if (!payload) { res.status(403).json({ error: "Brak dostępu do rozmowy" }); return; }
  await db.transaction(async (tx) => {
    await tx.update(conversationsTable)
      .set({
        customerContactShared: true,
        customerContactSharedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(conversationsTable.id, payload.id));
    await tx.insert(unlockedContactsTable)
      .values({ profileId: payload.contractorId, requestId: request.id })
      .onConflictDoNothing();
  });
  res.json(
    ShareRequestContactByIdResponse.parse(
      await conversationPayloadById(payload.id, request.id, id),
    ),
  );
});

router.get("/notifications", async (req, res): Promise<void> => {
  const id = authenticatedProfileId(req, res);
  if (!id) return;

  const unreadRows = await db
    .select({
      conversationId: conversationsTable.id,
      requestId: conversationsTable.requestId,
      createdAt: conversationMessagesTable.createdAt,
    })
    .from(conversationMessagesTable)
    .innerJoin(
      conversationsTable,
      eq(conversationMessagesTable.conversationId, conversationsTable.id),
    )
    .where(and(
      isNull(conversationMessagesTable.readAt),
      or(
        and(
          eq(conversationsTable.customerId, id),
          eq(conversationMessagesTable.senderId, conversationsTable.contractorId),
        ),
        and(
          eq(conversationsTable.contractorId, id),
          eq(conversationMessagesTable.senderId, conversationsTable.customerId),
        ),
      ),
    ))
    .orderBy(desc(conversationMessagesTable.createdAt));

  const seenConversations = new Set<number>();
  const notifications = unreadRows
    .filter((row) => {
      if (seenConversations.has(row.conversationId)) return false;
      seenConversations.add(row.conversationId);
      return true;
    })
    .map((row) => ({
      conversationId: row.conversationId,
      requestId: row.requestId,
      title: "Nowa wiadomość w rozmowie",
      body: "Masz nową wiadomość. Otwórz rozmowę, aby ją przeczytać.",
      createdAt: row.createdAt,
    }));

  res.json(GetNotificationsResponse.parse({
    unreadConversations: notifications.length,
    notifications,
  }));
});

router.get(
  "/requests/:id/review-candidates",
  async (req, res): Promise<void> => {
    const params = ListReviewCandidatesParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const id = authenticatedProfileId(req, res);
    if (!id) return;
    const viewer = await getViewer(req);
    if (viewer.role !== "customer") {
      res.status(403).json({ error: "Tylko zleceniodawca może wystawić opinię" });
      return;
    }

    const [request] = await db
      .select({
        id: jobRequestsTable.id,
        customerId: jobRequestsTable.customerId,
        status: jobRequestsTable.status,
      })
      .from(jobRequestsTable)
      .where(eq(jobRequestsTable.id, params.data.id));
    if (!request) {
      res.status(404).json({ error: "Nie znaleziono zlecenia" });
      return;
    }
    if (request.customerId !== id) {
      res.status(403).json({ error: "Możesz oceniać tylko fachowców ze swoich zleceń" });
      return;
    }
    if (request.status !== "completed") {
      res.status(403).json({ error: "Opinię można dodać po zakończeniu zlecenia" });
      return;
    }

    const candidates = await db
      .selectDistinct({
        id: profilesTable.id,
        firstName: profilesTable.firstName,
        lastName: profilesTable.lastName,
        companyName: profilesTable.companyName,
      })
      .from(unlockedContactsTable)
      .innerJoin(
        profilesTable,
        eq(profilesTable.id, unlockedContactsTable.profileId),
      )
      .where(
        and(
          eq(unlockedContactsTable.requestId, request.id),
          eq(profilesTable.role, "contractor"),
        ),
      );
    const existingReviews = await db
      .select({ contractorId: reviewsTable.contractorId })
      .from(reviewsTable)
      .where(eq(reviewsTable.requestId, request.id));
    const reviewedIds = new Set(existingReviews.map((review) => review.contractorId));

    res.json(
      ListReviewCandidatesResponse.parse(
        candidates.map((candidate) => ({
          id: candidate.id,
          displayName: contractorDisplayName(candidate),
          reviewed: reviewedIds.has(candidate.id),
        })),
      ),
    );
  },
);

router.get("/requests/:id/reviews", async (req, res): Promise<void> => {
  const params = ListRequestReviewsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const id = authenticatedProfileId(req, res);
  if (!id) return;
  const viewer = await getViewer(req);
  const [request] = await db
    .select({
      id: jobRequestsTable.id,
      customerId: jobRequestsTable.customerId,
    })
    .from(jobRequestsTable)
    .where(eq(jobRequestsTable.id, params.data.id));
  if (!request) {
    res.status(404).json({ error: "Nie znaleziono zlecenia" });
    return;
  }

  let contractorId: string | undefined;
  if (request.customerId !== id) {
    if (viewer.role !== "contractor") {
      res.status(403).json({ error: "Nie masz dostępu do opinii tego zlecenia" });
      return;
    }
    const [contact] = await db
      .select({ id: unlockedContactsTable.id })
      .from(unlockedContactsTable)
      .where(
        and(
          eq(unlockedContactsTable.requestId, request.id),
          eq(unlockedContactsTable.profileId, id),
        ),
      );
    if (!contact) {
      res.status(403).json({ error: "Nie masz dostępu do opinii tego zlecenia" });
      return;
    }
    contractorId = id;
  }

  res.json(
    ListRequestReviewsResponse.parse(
      await reviewResponsesForRequest(request.id, contractorId),
    ),
  );
});

router.post("/requests/:id/reviews", async (req, res): Promise<void> => {
  const params = CreateRequestReviewParams.safeParse(req.params);
  const body = CreateRequestReviewBody.safeParse({
    ...req.body,
    body: typeof req.body?.body === "string" ? req.body.body.trim() : req.body?.body,
  });
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Ocena i krótka opinia są wymagane" });
    return;
  }

  const id = authenticatedProfileId(req, res);
  if (!id) return;
  const viewer = await getViewer(req);
  if (viewer.role !== "customer") {
    res.status(403).json({ error: "Tylko zleceniodawca może wystawić opinię" });
    return;
  }

  const [request] = await db
    .select({
      id: jobRequestsTable.id,
      customerId: jobRequestsTable.customerId,
      status: jobRequestsTable.status,
    })
    .from(jobRequestsTable)
    .where(eq(jobRequestsTable.id, params.data.id));
  if (!request) {
    res.status(404).json({ error: "Nie znaleziono zlecenia" });
    return;
  }
  if (request.customerId !== id) {
    res.status(403).json({ error: "Możesz oceniać tylko fachowców ze swoich zleceń" });
    return;
  }
  if (request.status !== "completed") {
    res.status(403).json({ error: "Opinię można dodać po zakończeniu zlecenia" });
    return;
  }

  const [candidate] = await db
    .select({ id: profilesTable.id })
    .from(unlockedContactsTable)
    .innerJoin(
      profilesTable,
      eq(profilesTable.id, unlockedContactsTable.profileId),
    )
    .where(
      and(
        eq(unlockedContactsTable.requestId, request.id),
        eq(unlockedContactsTable.profileId, body.data.contractorId),
        eq(profilesTable.role, "contractor"),
      ),
    );
  if (!candidate) {
    res.status(403).json({ error: "Ten fachowiec nie jest powiązany ze zleceniem" });
    return;
  }

  const [created] = await db
    .insert(reviewsTable)
    .values({
      requestId: request.id,
      customerId: id,
      contractorId: candidate.id,
      rating: body.data.rating,
      body: body.data.body,
    })
    .onConflictDoNothing({
      target: [reviewsTable.requestId, reviewsTable.contractorId],
    })
    .returning({ id: reviewsTable.id });
  if (!created) {
    res.status(409).json({ error: "Opinia dla tego fachowca już istnieje" });
    return;
  }

  const [review] = await reviewResponsesForRequest(request.id, candidate.id);
  res.status(201).json(CreateRequestReviewResponse.parse(review));
});

router.post(
  "/requests/:id/reviews/:reviewId/reply",
  async (req, res): Promise<void> => {
    const params = CreateReviewReplyParams.safeParse(req.params);
    const body = CreateReviewReplyBody.safeParse({
      ...req.body,
      body:
        typeof req.body?.body === "string"
          ? req.body.body.trim()
          : req.body?.body,
    });
    if (!params.success || !body.success) {
      res.status(400).json({ error: "Krótka odpowiedź jest wymagana" });
      return;
    }

    const id = authenticatedProfileId(req, res);
    if (!id) return;
    const viewer = await getViewer(req);
    if (viewer.role !== "contractor") {
      res.status(403).json({ error: "Tylko oceniony fachowiec może odpowiedzieć" });
      return;
    }

    const [review] = await db
      .select({
        id: reviewsTable.id,
        contractorId: reviewsTable.contractorId,
      })
      .from(reviewsTable)
      .where(
        and(
          eq(reviewsTable.id, params.data.reviewId),
          eq(reviewsTable.requestId, params.data.id),
        ),
      );
    if (!review) {
      res.status(404).json({ error: "Nie znaleziono opinii" });
      return;
    }
    if (review.contractorId !== id) {
      res.status(403).json({ error: "Możesz odpowiedzieć tylko na swoją opinię" });
      return;
    }

    const [created] = await db
      .insert(reviewRepliesTable)
      .values({
        reviewId: review.id,
        contractorId: id,
        body: body.data.body,
      })
      .onConflictDoNothing({ target: reviewRepliesTable.reviewId })
      .returning({ id: reviewRepliesTable.id });
    if (!created) {
      res.status(409).json({ error: "Odpowiedź na tę opinię już istnieje" });
      return;
    }

    const [response] = await reviewResponsesForRequest(params.data.id, id);
    res.status(201).json(CreateReviewReplyResponse.parse(response));
  },
);

router.post(
  "/requests/:id/reviews/:reviewId/photos",
  async (req, res): Promise<void> => {
    const id = authenticatedProfileId(req, res);
    if (!id) return;
    const params = AddProjectPhotoParams.safeParse(req.params);
    const body = AddProjectPhotoBody.safeParse(req.body);
    if (!params.success || !body.success) {
      res.status(400).json({ error: "Nieprawidłowe zdjęcie realizacji" });
      return;
    }
    const [review] = await db
      .select({ id: reviewsTable.id, requestId: reviewsTable.requestId, contractorId: reviewsTable.contractorId })
      .from(reviewsTable)
      .innerJoin(jobRequestsTable, eq(jobRequestsTable.id, reviewsTable.requestId))
      .where(and(
        eq(reviewsTable.id, params.data.reviewId),
        eq(reviewsTable.requestId, params.data.id),
        eq(reviewsTable.contractorId, id),
        eq(jobRequestsTable.status, "completed"),
      ));
    if (!review) {
      res.status(403).json({ error: "Zdjęcia może dodać oceniony fachowiec po zakończeniu zlecenia" });
      return;
    }
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(projectPhotosTable)
      .where(eq(projectPhotosTable.reviewId, review.id));
    if (count >= 8) {
      res.status(409).json({ error: "Do jednej realizacji można dodać maksymalnie 8 zdjęć" });
      return;
    }
    if (!(await projectPhotoExists(body.data.objectPath))) {
      res.status(400).json({ error: "Plik nie został przesłany" });
      return;
    }
    const [photo] = await db.insert(projectPhotosTable).values({
      reviewId: review.id,
      requestId: review.requestId,
      contractorId: id,
      objectPath: body.data.objectPath,
    }).returning();
    res.status(201).json(AddProjectPhotoResponse.parse({
      ...photo,
      imageUrl: `/api/storage${photo.objectPath}`,
    }));
  },
);

router.get("/dashboard/summary", async (req, res): Promise<void> => {
  const viewer = await getViewer(req);
  const [open] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(jobRequestsTable)
    .where(eq(jobRequestsTable.status, "open"));
  const [mine] = viewer.id
    ? await db
        .select({ count: sql<number>`count(*)::int` })
        .from(jobRequestsTable)
        .where(eq(jobRequestsTable.customerId, viewer.id))
    : [{ count: 0 }];
  const [unlocked] = viewer.id
    ? await db
        .select({ count: sql<number>`count(*)::int` })
        .from(unlockedContactsTable)
        .where(eq(unlockedContactsTable.profileId, viewer.id))
    : [{ count: 0 }];
  const categories = await db
    .select({
      category: jobRequestsTable.category,
      count: sql<number>`count(*)::int`,
    })
    .from(jobRequestsTable)
    .groupBy(jobRequestsTable.category);
  res.json(
    GetDashboardSummaryResponse.parse({
      openRequests: open?.count ?? 0,
      myRequests: mine?.count ?? 0,
      newThisWeek: open?.count ?? 0,
      unlockedContacts: unlocked?.count ?? 0,
      topCategories: categories,
    }),
  );
});

router.get("/billing/subscription", async (req, res): Promise<void> => {
  const id = authenticatedProfileId(req, res);
  if (!id) return;
  const viewer = await getViewer(req);
  const [subscription] = await db
    .select()
    .from(subscriptionsTable)
    .where(eq(subscriptionsTable.profileId, id));
  const [latestPayment] = subscription
    ? await db
        .select({ status: paymentsTable.status })
        .from(paymentsTable)
        .where(eq(paymentsTable.subscriptionId, subscription.id))
        .orderBy(desc(paymentsTable.createdAt))
        .limit(1)
    : [];
  const status = effectiveSubscriptionStatus(subscription);
  res.json(
    GetSubscriptionResponse.parse({
      status,
      planName: subscription?.planName ?? PROFESSIONAL_PLAN.name,
      monthlyPrice: PROFESSIONAL_PLAN.monthlyPrice,
      canUnlockContacts:
        viewer.role === "contractor" && status === "active",
      activationRequested: subscription?.activationRequested ?? false,
      paymentInstructions: PAYMENT_INSTRUCTIONS,
      paymentProvider: subscription?.paymentProvider ?? null,
      paymentStatus: latestPayment?.status ?? null,
      accessExpiresAt: subscription?.accessExpiresAt ?? null,
      renewalReminder:
        status === "active"
          ? getRenewalReminder(subscription?.accessExpiresAt)
          : null,
    }),
  );
});

router.post("/billing/subscription", async (req, res): Promise<void> => {
  const id = authenticatedProfileId(req, res);
  if (!id) return;
  const viewer = await getViewer(req);
  if (viewer.role !== "contractor") {
    res.status(403).json({ error: "Tylko fachowiec może kupić abonament" });
    return;
  }

  const body = StartSubscriptionBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({
      error:
        "Przed przejściem do PayU zaakceptuj regulamin, rozpoczęcie usługi i płatności cykliczne.",
    });
    return;
  }

  const [profile] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.id, id));
  if (!profile) {
    res.status(404).json({ error: "Uzupełnij profil przed rozpoczęciem płatności" });
    return;
  }

  const [subscription] = await db
    .insert(subscriptionsTable)
    .values({
      profileId: id,
      status: "inactive",
      planName: PROFESSIONAL_PLAN.name,
      monthlyPrice: PROFESSIONAL_PLAN.monthlyPrice,
      activationRequested: false,
      paymentProvider: "payu",
    })
    .onConflictDoUpdate({
      target: subscriptionsTable.profileId,
      set: {
        activationRequested: false,
        planName: PROFESSIONAL_PLAN.name,
        monthlyPrice: PROFESSIONAL_PLAN.monthlyPrice,
        paymentProvider: "payu",
        updatedAt: new Date(),
      },
    })
    .returning();
  if (!subscription) {
    res.status(500).json({ error: "Nie udało się przygotować abonamentu" });
    return;
  }

  const extOrderId = randomUUID();
  const consentAcceptedAt = new Date();
  const [payment] = await db
    .insert(paymentsTable)
    .values({
      profileId: id,
      subscriptionId: subscription.id,
      extOrderId,
      status: "created",
      amount: PROFESSIONAL_PLAN.amount,
      currency: PROFESSIONAL_PLAN.currency,
      description: `Pakiet Premium ${PROFESSIONAL_PLAN.name} — opłata miesięczna`,
      consentVersion: PAYMENT_CONSENT_VERSION,
      termsAcceptedAt: consentAcceptedAt,
      digitalServiceAcceptedAt: consentAcceptedAt,
      recurringPaymentsAcceptedAt: consentAcceptedAt,
    })
    .returning();
  if (!payment) {
    res.status(500).json({ error: "Nie udało się przygotować płatności" });
    return;
  }

  const publicUrl = (process.env.PUBLIC_APP_URL ?? "https://zlecmajstra.pl").replace(
    /\/$/,
    "",
  );
  const continueUrl = payuContinueUrl(
    body.data.platform ?? "web",
    extOrderId,
    publicUrl,
  );
  const customerIp =
    req.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.ip ??
    "127.0.0.1";

  try {
    const order = await createPayuOrder({
      extOrderId,
      customerIp,
      email: profile.email,
      phone: profile.phone,
      firstName: profile.firstName,
      lastName: profile.lastName,
      continueUrl,
      notifyUrl: `${publicUrl}/api/billing/payu/notifications`,
      totalAmount: PROFESSIONAL_PLAN.amount,
      description: payment.description,
    });
    await db.transaction(async (tx) => {
      await tx
        .update(paymentsTable)
        .set({
          providerOrderId: order.orderId,
          status: "pending",
          updatedAt: new Date(),
        })
        .where(eq(paymentsTable.id, payment.id));
      await tx
        .update(subscriptionsTable)
        .set({
          providerSubscriptionId: order.orderId,
          paymentProvider: "payu",
          updatedAt: new Date(),
        })
        .where(eq(subscriptionsTable.id, subscription.id));
    });
    res.status(201).json(
      StartSubscriptionResponse.parse({
        extOrderId,
        status: "pending",
        redirectUri: order.redirectUri,
      }),
    );
  } catch (error) {
    await db
      .update(paymentsTable)
      .set({ status: "failed", updatedAt: new Date() })
      .where(eq(paymentsTable.id, payment.id));
    req.log.error(
      { err: error instanceof Error ? error.message : "unknown" },
      "PayU order creation failed",
    );
    res.status(502).json({ error: "Nie udało się rozpocząć płatności PayU" });
  }
});

router.get(
  "/billing/payments/:extOrderId",
  async (req, res): Promise<void> => {
    const id = authenticatedProfileId(req, res);
    if (!id) return;
    const params = GetPaymentStatusParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: "Nieprawidłowy identyfikator płatności" });
      return;
    }
    const [row] = await db
      .select({ payment: paymentsTable, subscription: subscriptionsTable })
      .from(paymentsTable)
      .innerJoin(
        subscriptionsTable,
        eq(subscriptionsTable.id, paymentsTable.subscriptionId),
      )
      .where(
        and(
          eq(paymentsTable.extOrderId, params.data.extOrderId),
          eq(paymentsTable.profileId, id),
        ),
      );
    if (!row) {
      res.status(404).json({ error: "Nie znaleziono płatności" });
      return;
    }
    const subscriptionStatus = effectiveSubscriptionStatus(row.subscription);
    res.json(
      GetPaymentStatusResponse.parse({
        extOrderId: row.payment.extOrderId,
        status: row.payment.status,
        subscriptionStatus,
        canUnlockContacts: subscriptionStatus === "active",
        accessExpiresAt: row.subscription.accessExpiresAt,
      }),
    );
  },
);

router.post(
  "/billing/payu/notifications",
  async (req, res): Promise<void> => {
    const rawBody = (req as typeof req & { rawBody?: Buffer }).rawBody;
    if (
      !rawBody ||
      !verifyPayuNotification(rawBody, req.get("openpayu-signature"))
    ) {
      req.log.warn("Rejected PayU notification with invalid signature");
      res.status(401).json({ error: "Nieprawidłowy podpis PayU" });
      return;
    }
    const body = ReceivePayuNotificationBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Nieprawidłowe powiadomienie PayU" });
      return;
    }

    const order = body.data.order;
    const amount = Number(order.totalAmount);
    const result = await db.transaction(async (tx) => {
      const [payment] = await tx
        .select()
        .from(paymentsTable)
        .where(eq(paymentsTable.extOrderId, order.extOrderId))
        .for("update");
      if (!payment) return { outcome: "missing" as const };
      if (
        payment.amount !== amount ||
        payment.currency !== order.currencyCode ||
        (payment.providerOrderId && payment.providerOrderId !== order.orderId)
      ) {
        return { outcome: "mismatch" as const };
      }
      if (payment.status === "completed") {
        return { outcome: "duplicate" as const };
      }

      const nextPaymentStatus =
        order.status === "COMPLETED"
          ? "completed"
          : order.status === "CANCELED"
            ? "canceled"
            : "pending";
      await tx
        .update(paymentsTable)
        .set({
          providerOrderId: order.orderId,
          status: nextPaymentStatus,
          updatedAt: new Date(),
          completedAt: nextPaymentStatus === "completed" ? new Date() : null,
        })
        .where(eq(paymentsTable.id, payment.id));

      if (nextPaymentStatus === "completed") {
        const [current] = await tx
          .select()
          .from(subscriptionsTable)
          .where(eq(subscriptionsTable.id, payment.subscriptionId))
          .for("update");
        if (!current) return { outcome: "missing" as const };
        const now = new Date();
        const base =
          current.accessExpiresAt && current.accessExpiresAt > now
            ? current.accessExpiresAt
            : now;
        const accessExpiresAt = new Date(
          base.getTime() + PAYMENT_ACCESS_DAYS * 24 * 60 * 60 * 1000,
        );
        const [updated] = await tx
          .update(subscriptionsTable)
          .set({
            status: "active",
            activationRequested: false,
            paymentProvider: "payu",
            providerSubscriptionId: order.orderId,
            accessExpiresAt,
            updatedAt: now,
          })
          .where(eq(subscriptionsTable.id, current.id))
          .returning();
        if (updated && current.status !== "active") {
          await tx.insert(subscriptionStatusHistoryTable).values({
            subscriptionId: updated.id,
            profileId: updated.profileId,
            previousStatus: current.status,
            newStatus: "active",
            changedByAdminId: "payu",
          });
        }
      }
      return { outcome: "accepted" as const };
    });

    if (result.outcome === "missing") {
      res.status(404).json({ error: "Nie znaleziono zamówienia" });
      return;
    }
    if (result.outcome === "mismatch") {
      req.log.warn(
        { extOrderId: order.extOrderId },
        "Rejected mismatched PayU notification",
      );
      res.status(400).json({ error: "Dane zamówienia nie są zgodne" });
      return;
    }
    res.sendStatus(204);
  },
);

router.get("/admin/overview", async (req, res): Promise<void> => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;

  const weekAgo = new Date(Date.now() - 7 * DAY_IN_MS);
  const [
    totalUsers,
    customers,
    contractors,
    blockedUsers,
    totalRequests,
    openRequests,
    blockedRequests,
    newUsersThisWeek,
    newRequestsThisWeek,
    activeSubscriptions,
    completedPayments,
  ] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(profilesTable).where(ne(profilesTable.role, "admin")),
    db.select({ count: sql<number>`count(*)::int` }).from(profilesTable).where(eq(profilesTable.role, "customer")),
    db.select({ count: sql<number>`count(*)::int` }).from(profilesTable).where(eq(profilesTable.role, "contractor")),
    db.select({ count: sql<number>`count(*)::int` }).from(profilesTable).where(eq(profilesTable.isBlocked, true)),
    db.select({ count: sql<number>`count(*)::int` }).from(jobRequestsTable),
    db.select({ count: sql<number>`count(*)::int` }).from(jobRequestsTable).where(and(eq(jobRequestsTable.status, "open"), eq(jobRequestsTable.isBlocked, false))),
    db.select({ count: sql<number>`count(*)::int` }).from(jobRequestsTable).where(eq(jobRequestsTable.isBlocked, true)),
    db.select({ count: sql<number>`count(*)::int` }).from(profilesTable).where(and(ne(profilesTable.role, "admin"), gte(profilesTable.createdAt, weekAgo))),
    db.select({ count: sql<number>`count(*)::int` }).from(jobRequestsTable).where(gte(jobRequestsTable.createdAt, weekAgo)),
    db.select({ count: sql<number>`count(*)::int` }).from(subscriptionsTable).where(eq(subscriptionsTable.status, "active")),
    db
      .select({
        count: sql<number>`count(*)::int`,
        amount: sql<number>`coalesce(sum(${paymentsTable.amount}), 0)::int`,
      })
      .from(paymentsTable)
      .where(eq(paymentsTable.status, "completed")),
  ]);

  res.json(
    GetAdminOverviewResponse.parse({
      totalUsers: totalUsers[0]?.count ?? 0,
      customers: customers[0]?.count ?? 0,
      contractors: contractors[0]?.count ?? 0,
      blockedUsers: blockedUsers[0]?.count ?? 0,
      totalRequests: totalRequests[0]?.count ?? 0,
      openRequests: openRequests[0]?.count ?? 0,
      blockedRequests: blockedRequests[0]?.count ?? 0,
      newUsersThisWeek: newUsersThisWeek[0]?.count ?? 0,
      newRequestsThisWeek: newRequestsThisWeek[0]?.count ?? 0,
      activeSubscriptions: activeSubscriptions[0]?.count ?? 0,
      completedPayments: completedPayments[0]?.count ?? 0,
      completedRevenueGrosz: completedPayments[0]?.amount ?? 0,
    }),
  );
});

router.get("/admin/settings", async (req, res): Promise<void> => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;
  res.json(GetAdminSettingsResponse.parse(await getPlatformSettings()));
});

router.patch("/admin/settings", async (req, res): Promise<void> => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;
  const body = UpdateAdminSettingsBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  await getPlatformSettings();
  const [updated] = await db
    .update(platformSettingsTable)
    .set({
      ...body.data,
      announcement: body.data.announcement.trim(),
      supportEmail: body.data.supportEmail.trim().toLowerCase(),
      chatbotName: body.data.chatbotName.trim(),
      chatbotWelcomeMessage: body.data.chatbotWelcomeMessage.trim(),
      chatbotFallbackMessage: body.data.chatbotFallbackMessage.trim(),
      chatbotKnowledgeBase: body.data.chatbotKnowledgeBase.trim(),
      updatedAt: new Date(),
    })
    .where(eq(platformSettingsTable.id, 1))
    .returning();
  req.log.info({ administratorId: adminId }, "Administrator updated platform settings");
  res.json(UpdateAdminSettingsResponse.parse(updated));
});

router.get("/admin/subscriptions", async (req, res): Promise<void> => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;

  const parsed = ListAdminSubscriptionsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const status = parsed.data.status;
  const filters = [eq(profilesTable.role, "contractor")];
  if (status === "pending") {
    filters.push(eq(subscriptionsTable.activationRequested, true));
  } else if (status && status !== "all") {
    filters.push(eq(subscriptionsTable.status, status));
  }

  const rows = await db
    .select({
      subscription: subscriptionsTable,
      profile: profilesTable,
    })
    .from(subscriptionsTable)
    .innerJoin(
      profilesTable,
      eq(profilesTable.id, subscriptionsTable.profileId),
    )
    .where(and(...filters))
    .orderBy(desc(subscriptionsTable.updatedAt));

  const responseRows = await Promise.all(
    rows.map(async ({ subscription, profile }) => {
      const [payment] = await db
        .select({ status: paymentsTable.status })
        .from(paymentsTable)
        .where(eq(paymentsTable.subscriptionId, subscription.id))
        .orderBy(desc(paymentsTable.createdAt))
        .limit(1);
      return toAdminSubscription(subscription, profile, payment?.status ?? null);
    }),
  );
  res.json(
    ListAdminSubscriptionsResponse.parse(responseRows),
  );
});

router.get("/admin/users", async (req, res): Promise<void> => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;

  const parsed = ListAdminUsersQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const role = parsed.data.role;
  const rows = await db
    .select()
    .from(profilesTable)
    .where(
      role && role !== "all"
        ? eq(profilesTable.role, role)
        : or(
            eq(profilesTable.role, "customer"),
            eq(profilesTable.role, "contractor"),
          ),
    )
    .orderBy(desc(profilesTable.createdAt));

  res.json(ListAdminUsersResponse.parse(rows.map(toAdminUser)));
});

router.patch(
  "/admin/users/:profileId",
  async (req, res): Promise<void> => {
    const adminId = await requireAdmin(req, res);
    if (!adminId) return;

    const params = UpdateAdminUserParams.safeParse(req.params);
    const body = UpdateAdminUserBody.safeParse(req.body);
    if (!params.success || !body.success) {
      res.status(400).json({ error: "Nieprawidłowe dane blokady konta" });
      return;
    }

    const [target] = await db
      .select()
      .from(profilesTable)
      .where(eq(profilesTable.id, params.data.profileId));
    if (!target) {
      res.status(404).json({ error: "Nie znaleziono użytkownika" });
      return;
    }
    if (target.role === "admin") {
      res.status(400).json({ error: "Konta administratora są chronione" });
      return;
    }

    const reason = body.data.reason?.trim() || null;
    if (body.data.action === "block" && !reason) {
      res.status(400).json({ error: "Podaj powód blokady konta" });
      return;
    }

    const [updated] = await db
      .update(profilesTable)
      .set(
        body.data.action === "block"
          ? {
              isBlocked: true,
              blockedAt: new Date(),
              blockedReason: reason,
            }
          : {
              isBlocked: false,
              blockedAt: null,
              blockedReason: null,
            },
      )
      .where(eq(profilesTable.id, target.id))
      .returning();

    req.log.info(
      {
        administratorId: adminId,
        targetProfileId: target.id,
        action: body.data.action,
      },
      "Administrator changed user account access",
    );
    res.json(UpdateAdminUserResponse.parse(toAdminUser(updated)));
  },
);

router.delete(
  "/admin/users/:profileId",
  async (req, res): Promise<void> => {
    const adminId = await requireAdmin(req, res);
    if (!adminId) return;

    const params = DeleteAdminUserParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: "Nieprawidłowy identyfikator użytkownika" });
      return;
    }

    const [target] = await db
      .select()
      .from(profilesTable)
      .where(eq(profilesTable.id, params.data.profileId));
    if (!target) {
      res.status(404).json({ error: "Nie znaleziono użytkownika" });
      return;
    }
    if (target.role === "admin") {
      res.status(400).json({ error: "Konta administratora są chronione" });
      return;
    }

    await db
      .update(profilesTable)
      .set({
        isBlocked: true,
        blockedAt: new Date(),
        blockedReason: "Konto przeznaczone do usunięcia przez administratora",
      })
      .where(eq(profilesTable.id, target.id));

    try {
      await clerkClient.users.deleteUser(target.id);
    } catch (error) {
      if ((error as { status?: number }).status !== 404) {
        req.log.error(
          { err: error, targetProfileId: target.id },
          "Failed to delete Clerk user",
        );
        res.status(502).json({
          error:
            "Konto zostało zablokowane, ale nie udało się usunąć danych logowania",
        });
        return;
      }
    }

    await db.transaction(async (tx) => {
      const ownedRequests = await tx
        .select({ id: jobRequestsTable.id })
        .from(jobRequestsTable)
        .where(eq(jobRequestsTable.customerId, target.id));
      const ownedRequestIds = ownedRequests.map(({ id }) => id);
      const conversationFilters = [
        eq(conversationsTable.customerId, target.id),
        eq(conversationsTable.contractorId, target.id),
        ...(ownedRequestIds.length
          ? [inArray(conversationsTable.requestId, ownedRequestIds)]
          : []),
      ];
      const affectedConversations = await tx
        .select({ id: conversationsTable.id })
        .from(conversationsTable)
        .where(or(...conversationFilters));
      const conversationIds = affectedConversations.map(({ id }) => id);

      if (conversationIds.length) {
        await tx
          .delete(conversationMessagesTable)
          .where(inArray(conversationMessagesTable.conversationId, conversationIds));
        await tx
          .delete(conversationsTable)
          .where(inArray(conversationsTable.id, conversationIds));
      }

      const reviewFilters = [
        eq(reviewsTable.customerId, target.id),
        eq(reviewsTable.contractorId, target.id),
        ...(ownedRequestIds.length
          ? [inArray(reviewsTable.requestId, ownedRequestIds)]
          : []),
      ];
      const affectedReviews = await tx
        .select({ id: reviewsTable.id })
        .from(reviewsTable)
        .where(or(...reviewFilters));
      const reviewIds = affectedReviews.map(({ id }) => id);

      if (reviewIds.length) {
        await tx
          .delete(reviewRepliesTable)
          .where(inArray(reviewRepliesTable.reviewId, reviewIds));
        await tx.delete(reviewsTable).where(inArray(reviewsTable.id, reviewIds));
      }
      await tx
        .delete(reviewRepliesTable)
        .where(eq(reviewRepliesTable.contractorId, target.id));

      const contactFilters = [
        eq(unlockedContactsTable.profileId, target.id),
        ...(ownedRequestIds.length
          ? [inArray(unlockedContactsTable.requestId, ownedRequestIds)]
          : []),
      ];
      await tx
        .delete(unlockedContactsTable)
        .where(or(...contactFilters));
      await tx
        .delete(subscriptionRemindersTable)
        .where(eq(subscriptionRemindersTable.profileId, target.id));
      await tx
        .delete(subscriptionStatusHistoryTable)
        .where(eq(subscriptionStatusHistoryTable.profileId, target.id));
      await tx
        .delete(paymentsTable)
        .where(eq(paymentsTable.profileId, target.id));
      await tx
        .delete(subscriptionsTable)
        .where(eq(subscriptionsTable.profileId, target.id));
      await tx
        .delete(jobRequestsTable)
        .where(eq(jobRequestsTable.customerId, target.id));
      await tx.delete(profilesTable).where(eq(profilesTable.id, target.id));
    });

    req.log.info(
      { administratorId: adminId, targetProfileId: target.id },
      "Administrator deleted user account",
    );
    res.sendStatus(204);
  },
);

router.get("/admin/requests", async (req, res): Promise<void> => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;

  const rows = await db
    .select()
    .from(jobRequestsTable)
    .orderBy(desc(jobRequestsTable.createdAt));
  res.json(
    ListAdminRequestsResponse.parse(
      rows.map(toAdminRequest),
    ),
  );
});

router.patch(
  "/admin/requests/:id",
  async (req, res): Promise<void> => {
    const adminId = await requireAdmin(req, res);
    if (!adminId) return;

    const params = UpdateAdminRequestParams.safeParse(req.params);
    const body = UpdateAdminRequestBody.safeParse(req.body);
    if (!params.success || !body.success) {
      res.status(400).json({ error: "Nieprawidłowe dane blokady zlecenia" });
      return;
    }
    const reason = body.data.reason?.trim() || null;
    if (body.data.action === "block" && !reason) {
      res.status(400).json({ error: "Podaj powód blokady zlecenia" });
      return;
    }

    const [updated] = await db
      .update(jobRequestsTable)
      .set(
        body.data.action === "block"
          ? { isBlocked: true, blockedAt: new Date(), blockedReason: reason }
          : { isBlocked: false, blockedAt: null, blockedReason: null },
      )
      .where(eq(jobRequestsTable.id, params.data.id))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "Nie znaleziono zlecenia" });
      return;
    }

    req.log.info(
      { administratorId: adminId, requestId: updated.id, action: body.data.action },
      "Administrator changed job request access",
    );
    res.json(UpdateAdminRequestResponse.parse(toAdminRequest(updated)));
  },
);

router.delete(
  "/admin/requests/:id",
  async (req, res): Promise<void> => {
    const adminId = await requireAdmin(req, res);
    if (!adminId) return;

    const params = DeleteAdminRequestParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: "Nieprawidłowy identyfikator zlecenia" });
      return;
    }

    const [target] = await db
      .select({ id: jobRequestsTable.id })
      .from(jobRequestsTable)
      .where(eq(jobRequestsTable.id, params.data.id));
    if (!target) {
      res.status(404).json({ error: "Nie znaleziono zlecenia" });
      return;
    }

    await db.transaction(async (tx) => {
      const requestConversations = await tx
        .select({ id: conversationsTable.id })
        .from(conversationsTable)
        .where(eq(conversationsTable.requestId, target.id));
      const conversationIds = requestConversations.map(({ id }) => id);
      if (conversationIds.length) {
        await tx
          .delete(conversationMessagesTable)
          .where(inArray(conversationMessagesTable.conversationId, conversationIds));
        await tx
          .delete(conversationsTable)
          .where(inArray(conversationsTable.id, conversationIds));
      }

      const requestReviews = await tx
        .select({ id: reviewsTable.id })
        .from(reviewsTable)
        .where(eq(reviewsTable.requestId, target.id));
      const reviewIds = requestReviews.map(({ id }) => id);
      if (reviewIds.length) {
        await tx
          .delete(reviewRepliesTable)
          .where(inArray(reviewRepliesTable.reviewId, reviewIds));
        await tx
          .delete(reviewsTable)
          .where(inArray(reviewsTable.id, reviewIds));
      }
      await tx
        .delete(unlockedContactsTable)
        .where(eq(unlockedContactsTable.requestId, target.id));
      await tx
        .delete(jobRequestsTable)
        .where(eq(jobRequestsTable.id, target.id));
    });

    req.log.info(
      { administratorId: adminId, requestId: target.id },
      "Administrator deleted job request",
    );
    res.sendStatus(204);
  },
);

router.get(
  "/admin/subscriptions/:profileId",
  async (req, res): Promise<void> => {
    const adminId = await requireAdmin(req, res);
    if (!adminId) return;

    const params = ListAdminSubscriptionHistoryParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const [subscription] = await db
      .select({
        id: subscriptionsTable.id,
        profileId: subscriptionsTable.profileId,
      })
      .from(subscriptionsTable)
      .where(eq(subscriptionsTable.profileId, params.data.profileId));
    if (!subscription) {
      res.status(404).json({ error: "Nie znaleziono abonamentu fachowca" });
      return;
    }

    const rows = await db
      .select({
        history: subscriptionStatusHistoryTable,
        administrator: {
          id: subscriptionHistoryAdminProfiles.id,
          firstName: subscriptionHistoryAdminProfiles.firstName,
          lastName: subscriptionHistoryAdminProfiles.lastName,
        },
      })
      .from(subscriptionStatusHistoryTable)
      .leftJoin(
        subscriptionHistoryAdminProfiles,
        eq(
          subscriptionHistoryAdminProfiles.id,
          subscriptionStatusHistoryTable.changedByAdminId,
        ),
      )
      .where(
        eq(subscriptionStatusHistoryTable.subscriptionId, subscription.id),
      )
      .orderBy(
        desc(subscriptionStatusHistoryTable.createdAt),
        desc(subscriptionStatusHistoryTable.id),
      );

    res.json(
      ListAdminSubscriptionHistoryResponse.parse(
        rows.map(({ history, administrator }) => ({
          id: history.id,
          subscriptionId: history.subscriptionId,
          profileId: history.profileId,
          previousStatus: history.previousStatus,
          newStatus: history.newStatus,
          changedByAdminId: history.changedByAdminId,
          changedByAdminName:
            history.changedByAdminId === "payu"
              ? "PayU"
              : administrator
                ? `${administrator.firstName} ${administrator.lastName}`.trim()
                : "System",
          createdAt: history.createdAt,
        })),
      ),
    );
  },
);

router.patch(
  "/admin/subscriptions/:profileId",
  async (req, res): Promise<void> => {
    const adminId = await requireAdmin(req, res);
    if (!adminId) return;

    const params = UpdateAdminSubscriptionParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const body = UpdateAdminSubscriptionBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: body.error.message });
      return;
    }

    const [targetProfile] = await db
      .select()
      .from(profilesTable)
      .where(eq(profilesTable.id, params.data.profileId));
    if (!targetProfile || targetProfile.role !== "contractor") {
      res.status(404).json({ error: "Nie znaleziono fachowca" });
      return;
    }

    const nextStatus = body.data.status;
    const result = await db.transaction(async (tx) => {
      const [current] = await tx
        .select()
        .from(subscriptionsTable)
        .where(eq(subscriptionsTable.profileId, params.data.profileId))
        .for("update");
      if (!current) return null;

      const shouldLog =
        current.status !== nextStatus || current.activationRequested;
      const [subscription] = await tx
        .update(subscriptionsTable)
        .set({
          status: nextStatus,
          activationRequested: false,
          paymentProvider: "manual",
          accessExpiresAt:
            nextStatus === "active"
              ? new Date(
                  Date.now() + PAYMENT_ACCESS_DAYS * 24 * 60 * 60 * 1000,
                )
              : null,
          updatedAt: new Date(),
        })
        .where(eq(subscriptionsTable.profileId, params.data.profileId))
        .returning();

      if (shouldLog && subscription) {
        await tx.insert(subscriptionStatusHistoryTable).values({
          subscriptionId: subscription.id,
          profileId: subscription.profileId,
          previousStatus: current.status,
          newStatus: subscription.status,
          changedByAdminId: adminId,
        });
      }
      return { current, subscription };
    });

    if (!result?.subscription) {
      res.status(404).json({ error: "Nie znaleziono abonamentu fachowca" });
      return;
    }

    res.json(
      UpdateAdminSubscriptionResponse.parse(
        toAdminSubscription(result.subscription, targetProfile, null),
      ),
    );
  },
);

export default router;

function toAdminSubscription(
  subscription: typeof subscriptionsTable.$inferSelect,
  profile: typeof profilesTable.$inferSelect,
  paymentStatus: typeof paymentsTable.$inferSelect.status | null,
) {
  return {
    id: subscription.id,
    profileId: profile.id,
    contractorName: `${profile.firstName} ${profile.lastName}`,
    email: profile.email,
    phone: profile.phone,
    companyName: profile.companyName,
    status: effectiveSubscriptionStatus(subscription),
    planName: subscription.planName,
    monthlyPrice: PROFESSIONAL_PLAN.monthlyPrice,
    activationRequested: subscription.activationRequested,
    paymentProvider: subscription.paymentProvider,
    paymentStatus,
    accessExpiresAt: subscription.accessExpiresAt,
    updatedAt: subscription.updatedAt,
  };
}

function toAdminUser(profile: typeof profilesTable.$inferSelect) {
  return {
    id: profile.id,
    role: profile.role,
    firstName: profile.firstName,
    lastName: profile.lastName,
    email: profile.email,
    phone: profile.phone,
    companyName: profile.companyName,
    verified: profile.verified,
    isBlocked: profile.isBlocked,
    blockedAt: profile.blockedAt,
    blockedReason: profile.blockedReason,
    createdAt: profile.createdAt,
  };
}

function contractorDisplayName(profile: {
  companyName: string | null;
  firstName: string;
  lastName: string;
}) {
  return profile.companyName?.trim() || `${profile.firstName} ${profile.lastName}`;
}

async function reviewResponsesForRequest(
  requestId: number,
  contractorId?: string,
) {
  const filters = [eq(reviewsTable.requestId, requestId)];
  if (contractorId) {
    filters.push(eq(reviewsTable.contractorId, contractorId));
  }
  const rows = await db
    .select({
      id: reviewsTable.id,
      requestId: reviewsTable.requestId,
      contractorId: reviewsTable.contractorId,
      contractorFirstName: profilesTable.firstName,
      contractorLastName: profilesTable.lastName,
      contractorCompanyName: profilesTable.companyName,
      rating: reviewsTable.rating,
      body: reviewsTable.body,
      createdAt: reviewsTable.createdAt,
      updatedAt: reviewsTable.updatedAt,
      replyId: reviewRepliesTable.id,
      replyContractorId: reviewRepliesTable.contractorId,
      replyBody: reviewRepliesTable.body,
      replyCreatedAt: reviewRepliesTable.createdAt,
      replyUpdatedAt: reviewRepliesTable.updatedAt,
    })
    .from(reviewsTable)
    .innerJoin(profilesTable, eq(profilesTable.id, reviewsTable.contractorId))
    .leftJoin(reviewRepliesTable, eq(reviewRepliesTable.reviewId, reviewsTable.id))
    .where(and(...filters))
    .orderBy(desc(reviewsTable.createdAt));

  const photos = rows.length ? await db.select().from(projectPhotosTable).where(
    inArray(projectPhotosTable.reviewId, rows.map((row) => row.id)),
  ).orderBy(projectPhotosTable.createdAt) : [];
  return rows.map((row) => ({
    id: row.id,
    requestId: row.requestId,
    contractorId: row.contractorId,
    contractorName: contractorDisplayName({
      companyName: row.contractorCompanyName,
      firstName: row.contractorFirstName,
      lastName: row.contractorLastName,
    }),
    rating: row.rating,
    body: row.body,
    photos: photos.filter((photo) => photo.reviewId === row.id).map((photo) => ({
      ...photo,
      imageUrl: `/api/storage${photo.objectPath}`,
    })),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    reply:
      row.replyId &&
      row.replyContractorId &&
      row.replyBody &&
      row.replyCreatedAt &&
      row.replyUpdatedAt
        ? {
            id: row.replyId,
            contractorId: row.replyContractorId,
            body: row.replyBody,
            createdAt: row.replyCreatedAt,
            updatedAt: row.replyUpdatedAt,
          }
        : null,
  }));
}

async function reviewResponsesForContractor(contractorId: string) {
  const rows = await db
    .select({
      id: reviewsTable.id,
      requestId: reviewsTable.requestId,
      contractorId: reviewsTable.contractorId,
      contractorFirstName: profilesTable.firstName,
      contractorLastName: profilesTable.lastName,
      contractorCompanyName: profilesTable.companyName,
      rating: reviewsTable.rating,
      body: reviewsTable.body,
      createdAt: reviewsTable.createdAt,
      updatedAt: reviewsTable.updatedAt,
      replyId: reviewRepliesTable.id,
      replyContractorId: reviewRepliesTable.contractorId,
      replyBody: reviewRepliesTable.body,
      replyCreatedAt: reviewRepliesTable.createdAt,
      replyUpdatedAt: reviewRepliesTable.updatedAt,
    })
    .from(reviewsTable)
    .innerJoin(profilesTable, eq(profilesTable.id, reviewsTable.contractorId))
    .leftJoin(reviewRepliesTable, eq(reviewRepliesTable.reviewId, reviewsTable.id))
    .where(eq(reviewsTable.contractorId, contractorId))
    .orderBy(desc(reviewsTable.createdAt));

  const photos = rows.length ? await db.select().from(projectPhotosTable).where(
    inArray(projectPhotosTable.reviewId, rows.map((row) => row.id)),
  ).orderBy(projectPhotosTable.createdAt) : [];
  return rows.map((row) => ({
    id: row.id,
    requestId: row.requestId,
    contractorId: row.contractorId,
    contractorName: contractorDisplayName({
      companyName: row.contractorCompanyName,
      firstName: row.contractorFirstName,
      lastName: row.contractorLastName,
    }),
    rating: row.rating,
    body: row.body,
    photos: photos.filter((photo) => photo.reviewId === row.id).map((photo) => ({
      ...photo,
      imageUrl: `/api/storage${photo.objectPath}`,
    })),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    reply:
      row.replyId &&
      row.replyContractorId &&
      row.replyBody &&
      row.replyCreatedAt &&
      row.replyUpdatedAt
        ? {
            id: row.replyId,
            contractorId: row.replyContractorId,
            body: row.replyBody,
            createdAt: row.replyCreatedAt,
            updatedAt: row.replyUpdatedAt,
          }
        : null,
  }));
}

async function requireAdmin(
  req: Request,
  res: Response,
): Promise<string | null> {
  const id = authenticatedProfileId(req, res);
  if (!id) return null;

  const [profile] = await db
    .select({
      role: profilesTable.role,
      email: profilesTable.email,
      verified: profilesTable.verified,
    })
    .from(profilesTable)
    .where(eq(profilesTable.id, id));
  const matchesConfiguredAdministrator =
    !configuredAdminEmail ||
    (profile?.email.trim().toLowerCase() === configuredAdminEmail &&
      profile.verified);
  if (profile?.role !== "admin" || !matchesConfiguredAdministrator) {
    res.status(403).json({ error: "Dostęp tylko dla administratora" });
    return null;
  }
  return id;
}

async function getViewer(req: Request): Promise<Viewer> {
  const id = profileId(req);
  if (!id) {
    return { id: null, role: null, hasActiveSubscription: false };
  }

  const [profile] = await db
    .select({ role: profilesTable.role })
    .from(profilesTable)
    .where(eq(profilesTable.id, id));
  if (!profile) {
    return { id, role: null, hasActiveSubscription: false };
  }
  if (profile.role !== "contractor") {
    return { id, role: profile.role, hasActiveSubscription: false };
  }

  const [subscription] = await db
    .select({
      status: subscriptionsTable.status,
      accessExpiresAt: subscriptionsTable.accessExpiresAt,
    })
    .from(subscriptionsTable)
    .where(eq(subscriptionsTable.profileId, id));
  return {
    id,
    role: profile.role,
    hasActiveSubscription:
      effectiveSubscriptionStatus(subscription) === "active",
  };
}

function effectiveSubscriptionStatus(
  subscription:
    | Pick<
        typeof subscriptionsTable.$inferSelect,
        "status" | "accessExpiresAt"
      >
    | undefined,
): typeof subscriptionsTable.$inferSelect.status {
  if (!subscription) return "inactive";
  if (
    subscription.status === "active" &&
    subscription.accessExpiresAt &&
    subscription.accessExpiresAt <= new Date()
  ) {
    return "past_due";
  }
  return subscription.status;
}

function getRenewalReminder(accessExpiresAt: Date | null | undefined) {
  if (!accessExpiresAt) return null;

  const millisecondsRemaining = accessExpiresAt.getTime() - Date.now();
  if (millisecondsRemaining <= 0) return null;

  const daysRemaining = Math.ceil(millisecondsRemaining / DAY_IN_MS);
  if (daysRemaining > SUBSCRIPTION_REMINDER_DAYS) return null;

  return {
    daysRemaining,
    accessExpiresAt,
    message:
      daysRemaining === 1
        ? "Twój dostęp wygaśnie jutro. Odnów abonament, aby zachować dostęp do kontaktów."
        : `Twój dostęp wygaśnie za ${daysRemaining} dni. Odnów abonament, aby zachować dostęp do kontaktów.`,
  };
}
