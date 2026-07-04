import { NextResponse } from 'next/server';
import { listOpenRouterModels } from '@/lib/openrouter';

export async function GET() {
  const models = await listOpenRouterModels();
  return NextResponse.json({ models });
}
