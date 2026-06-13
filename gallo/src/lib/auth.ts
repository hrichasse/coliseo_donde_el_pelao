import jwt, { type JwtPayload } from "jsonwebtoken";
import { NextResponse } from "next/server";

export type AuthUser = {
  id: number;
  email: string;
};

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("Falta variable JWT_SECRET");
  }

  return secret;
}

function parseCookieHeader(cookieHeader: string | null): Map<string, string> {
  const cookies = new Map<string, string>();

  if (!cookieHeader) {
    return cookies;
  }

  for (const item of cookieHeader.split(";")) {
    const [rawName, ...rawValue] = item.trim().split("=");
    if (!rawName || rawValue.length === 0) {
      continue;
    }

    cookies.set(rawName, rawValue.join("="));
  }

  return cookies;
}

export function signAuthToken(user: AuthUser): string {
  return jwt.sign(user, getJwtSecret(), { expiresIn: "24h" });
}

export function getAuthUser(request: Request): AuthUser | null {
  const token = parseCookieHeader(request.headers.get("cookie")).get("auth_token");

  if (!token) {
    return null;
  }

  try {
    const payload = jwt.verify(token, getJwtSecret());

    if (typeof payload === "string") {
      return null;
    }

    const jwtPayload = payload as JwtPayload;
    const id = Number(jwtPayload.id);
    const email = typeof jwtPayload.email === "string" ? jwtPayload.email : "";

    if (!id || !email) {
      return null;
    }

    return { id, email };
  } catch {
    return null;
  }
}

export function requireAuth(
  request: Request,
): { user: AuthUser; response: null } | { user: null; response: NextResponse } {
  const user = getAuthUser(request);

  if (!user) {
    return {
      user: null,
      response: NextResponse.json({ error: "No autorizado" }, { status: 401 }),
    };
  }

  return { user, response: null };
}
