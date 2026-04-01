const rateBuckets = new Map();

function getRedisConfig() {
  const url = String(
    process.env.UPSTASH_REDIS_REST_URL ||
    process.env.UPSTASH_KV_REST_API_URL ||
    ""
  ).trim().replace(/\/$/, "");
  const token = String(
    process.env.UPSTASH_REDIS_REST_TOKEN ||
    process.env.UPSTASH_KV_REST_API_TOKEN ||
    ""
  ).trim();
  if (!url || !token) return null;
  return { url, token };
}

async function upstashCommand(args) {
  const cfg = getRedisConfig();
  if (!cfg) return null;

  const path = args.map((part) => encodeURIComponent(String(part))).join("/");
  const response = await fetch(`${cfg.url}/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.token}`
    }
  });

  if (!response.ok) {
    throw new Error(`Upstash command failed (${response.status})`);
  }

  const payload = await response.json().catch(() => ({}));
  return payload?.result;
}

function getClientIp(req) {
  const forwarded = String(req?.headers?.["x-forwarded-for"] || "");
  if (forwarded) return forwarded.split(",")[0].trim();
  return String(req?.socket?.remoteAddress || "unknown");
}

function isRateLimited(bucketKey, limit, windowMs) {
  const now = Date.now();
  const entry = rateBuckets.get(bucketKey);

  if (!entry || now >= entry.resetAt) {
    rateBuckets.set(bucketKey, { count: 1, resetAt: now + windowMs });
    return { limited: false, remaining: limit - 1, resetAt: now + windowMs };
  }

  entry.count += 1;
  const limited = entry.count > limit;
  const remaining = Math.max(0, limit - entry.count);
  return { limited, remaining, resetAt: entry.resetAt };
}

async function isRateLimitedDistributed(bucketKey, limit, windowMs) {
  const now = Date.now();
  const countRaw = await upstashCommand(["INCR", bucketKey]);
  const count = Number(countRaw || 0);

  if (count <= 0) {
    throw new Error("Invalid INCR response");
  }

  if (count === 1) {
    await upstashCommand(["PEXPIRE", bucketKey, windowMs]);
  }

  let ttlMs = Number(await upstashCommand(["PTTL", bucketKey]));
  if (!Number.isFinite(ttlMs) || ttlMs < 0) {
    await upstashCommand(["PEXPIRE", bucketKey, windowMs]);
    ttlMs = windowMs;
  }

  const limited = count > limit;
  const remaining = Math.max(0, limit - count);
  const resetAt = now + ttlMs;
  return { limited, remaining, resetAt };
}

async function enforceRateLimit(req, res, options) {
  const cfg = options || {};
  const limit = Number(cfg.limit || 60);
  const windowMs = Number(cfg.windowMs || 60_000);
  const name = String(cfg.name || "global");
  const ip = getClientIp(req);
  const bucketKey = `${name}:${ip}`;
  let result;

  try {
    if (getRedisConfig()) {
      result = await isRateLimitedDistributed(bucketKey, limit, windowMs);
    } else {
      result = isRateLimited(bucketKey, limit, windowMs);
    }
  } catch (error) {
    // Fallback to in-memory limiter if distributed backend is unavailable.
    result = isRateLimited(bucketKey, limit, windowMs);
  }

  res.setHeader("X-RateLimit-Limit", String(limit));
  res.setHeader("X-RateLimit-Remaining", String(result.remaining));
  res.setHeader("X-RateLimit-Reset", String(Math.floor(result.resetAt / 1000)));

  if (!result.limited) return false;

  res.status(429).json({ ok: false, error: "Too many requests" });
  return true;
}

function bodyByteSize(body) {
  try {
    return Buffer.byteLength(JSON.stringify(body || {}), "utf8");
  } catch (_) {
    return Number.MAX_SAFE_INTEGER;
  }
}

function enforcePayloadLimit(req, res, maxBytes) {
  const max = Number(maxBytes || 256 * 1024);
  const size = bodyByteSize(req.body);
  if (size <= max) return false;

  res.status(413).json({ ok: false, error: "Payload too large" });
  return true;
}

module.exports = {
  enforceRateLimit,
  enforcePayloadLimit,
  getClientIp
};
