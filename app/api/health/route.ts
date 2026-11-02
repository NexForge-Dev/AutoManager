import { NextResponse } from "next/server";
import { verificarSaude } from "@/lib/health";

// GET /api/health -> { ok, database } (503 se o banco não responder).
export const dynamic = "force-dynamic";

export async function GET() {
  const saude = await verificarSaude();
  return NextResponse.json(saude, {
    status: saude.ok ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
