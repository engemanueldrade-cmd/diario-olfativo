import { NextResponse } from "next/server";
import { getSearchUsage } from "@/lib/db";

const MONTHLY_LIMIT = parseInt(process.env.FRAGELLA_MONTHLY_LIMIT, 10) || 20;

export async function GET() {
  const usage = await getSearchUsage();
  return NextResponse.json({ usage: usage ? { ...usage, limit: MONTHLY_LIMIT } : null });
}
