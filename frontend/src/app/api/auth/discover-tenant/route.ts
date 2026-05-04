import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const discoverSchema = z.object({
  email: z.string().email(),
});

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = discoverSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid email." }, { status: 400 });
  }

  const internalApiUrl = process.env.NEXT_INTERNAL_API_URL || "http://backend:8000";
  const host = request.headers.get("host");
  const protocol = request.headers.get("x-forwarded-proto") || "http";

  const response = await fetch(`${internalApiUrl}/api/v1/auth/discover-tenant/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(host
        ? {
            Host: host,
            "X-Forwarded-Host": host,
            "X-Forwarded-Proto": protocol,
          }
        : {}),
    },
    body: JSON.stringify(parsed.data),
  });

  const data = await response.json().catch(() => ({ message: "Tenant discovery failed." }));
  return NextResponse.json(data, { status: response.status });
}

