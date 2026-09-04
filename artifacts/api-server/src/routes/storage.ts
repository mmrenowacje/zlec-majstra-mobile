import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import { Storage } from "@google-cloud/storage";
import { getAuth } from "@clerk/express";
import { RequestUploadUrlBody, RequestUploadUrlResponse } from "@workspace/api-zod";
import { Router, type IRouter } from "express";

const sidecar = "http://127.0.0.1:1106";
const storage = new Storage({
  credentials: {
    audience: "replit",
    subject_token_type: "access_token",
    token_url: `${sidecar}/token`,
    type: "external_account",
    credential_source: {
      url: `${sidecar}/credential`,
      format: { type: "json", subject_token_field_name: "access_token" },
    },
    universe_domain: "googleapis.com",
  },
  projectId: "",
});

function privateLocation() {
  const value = process.env.PRIVATE_OBJECT_DIR;
  if (!value) throw new Error("PRIVATE_OBJECT_DIR is required");
  const parts = value.replace(/^\/+/, "").split("/");
  return { bucket: parts[0], prefix: parts.slice(1).join("/") };
}

function fileFor(objectPath: string) {
  if (!/^\/objects\/uploads\/[a-f0-9-]+$/.test(objectPath)) {
    throw new Error("Invalid object path");
  }
  const { bucket, prefix } = privateLocation();
  return storage.bucket(bucket).file(`${prefix}/uploads/${objectPath.split("/").at(-1)}`);
}

export async function projectPhotoExists(objectPath: string) {
  try {
    const [exists] = await fileFor(objectPath).exists();
    return exists;
  } catch {
    return false;
  }
}

const router: IRouter = Router();

router.post("/storage/uploads/request-url", async (req, res): Promise<void> => {
  if (!getAuth(req).userId) {
    res.status(401).json({ error: "Uwierzytelnienie jest wymagane" });
    return;
  }
  const body = RequestUploadUrlBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Dozwolone są obrazy JPG, PNG i WebP do 50 MB" });
    return;
  }
  const objectPath = `/objects/uploads/${randomUUID()}`;
  const file = fileFor(objectPath);
  const { bucket, prefix } = privateLocation();
  const response = await fetch(`${sidecar}/object-storage/signed-object-url`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      bucket_name: bucket,
      object_name: `${prefix}/uploads/${objectPath.split("/").at(-1)}`,
      method: "PUT",
      expires_at: new Date(Date.now() + 15 * 60_000).toISOString(),
    }),
  });
  if (!response.ok) {
    res.status(500).json({ error: "Nie udało się przygotować wysyłania pliku" });
    return;
  }
  const { signed_url: uploadURL } = await response.json() as { signed_url: string };
  void file;
  res.json(RequestUploadUrlResponse.parse({ uploadURL, objectPath }));
});

router.get("/storage/objects/*path", async (req, res): Promise<void> => {
  try {
    const raw = req.params.path;
    const path = Array.isArray(raw) ? raw.join("/") : raw;
    const file = fileFor(`/objects/${path}`);
    const [metadata] = await file.getMetadata();
    res.setHeader("Content-Type", metadata.contentType || "image/jpeg");
    res.setHeader("Cache-Control", "public, max-age=86400");
    Readable.from(file.createReadStream()).pipe(res);
  } catch {
    res.status(404).json({ error: "Nie znaleziono zdjęcia" });
  }
});

export default router;