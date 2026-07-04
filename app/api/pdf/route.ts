import { NextRequest, NextResponse } from 'next/server';
import { generatePdfReport } from '@/lib/pdf';
import { ResearchResult } from '@/lib/types';

export async function POST(req: NextRequest) {
  try {
    const result: ResearchResult = await req.json();
    const pdfBytes = await generatePdfReport(result);
    const fileName = `${result.companyInfo.companyName.replace(/[^a-z0-9]/gi, '_')}_Research_Report.pdf`;

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`
      }
    });
  } catch (err: any) {
    console.error('PDF generation error:', err);
    return NextResponse.json({ error: err?.message || 'Failed to generate PDF.' }, { status: 500 });
  }
}
