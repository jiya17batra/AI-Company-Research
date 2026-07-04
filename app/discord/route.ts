import { NextRequest, NextResponse } from 'next/server';
import { generatePdfReport } from '@/lib/pdf';
import { ResearchResult } from '@/lib/types';

/**
 * Sends the generated report to a Discord channel via the Discord Bot API.
 * Requires a bot token with permission to post + attach files in the target channel.
 * Docs: https://discord.com/developers/docs/resources/message#create-message
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      botToken,
      channelId,
      applicantName,
      applicantEmail,
      result
    }: {
      botToken: string;
      channelId: string;
      applicantName: string;
      applicantEmail: string;
      result: ResearchResult;
    } = body;

    if (!botToken || !channelId) {
      return NextResponse.json(
        { error: 'Discord Bot Token and Channel ID are required.' },
        { status: 400 }
      );
    }
    if (!result) {
      return NextResponse.json({ error: 'No research result to send.' }, { status: 400 });
    }

    const pdfBytes = await generatePdfReport(result);
    const fileName = `${result.companyInfo.companyName.replace(/[^a-z0-9]/gi, '_')}_Research_Report.pdf`;

    const content = [
      '**New Company Research Report Generated**',
      `**Applicant:** ${applicantName || 'N/A'} (${applicantEmail || 'N/A'})`,
      `**Company:** ${result.companyInfo.companyName}`,
      `**Website:** ${result.companyInfo.website}`
    ].join('\n');

    const form = new FormData();
    form.append('payload_json', JSON.stringify({ content }));
    form.append('files[0]', new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' }), fileName);

    const discordRes = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bot ${botToken}`
      },
      body: form
    });

    if (!discordRes.ok) {
      const errText = await discordRes.text().catch(() => '');
      return NextResponse.json(
        { error: `Discord API error (${discordRes.status}): ${errText}` },
        { status: 502 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Discord integration error:', err);
    return NextResponse.json({ error: err?.message || 'Failed to send to Discord.' }, { status: 500 });
  }
}
