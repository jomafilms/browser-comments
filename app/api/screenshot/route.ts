import { NextRequest, NextResponse } from 'next/server';
import chromium from '@sparticuz/chromium';

export async function POST(request: NextRequest) {
  try {
    const { url, width, height } = await request.json();

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    // Determine if we're in production (Vercel) or local development
    const isProduction = process.env.VERCEL === '1';

    let browser;

    if (isProduction) {
      // Use puppeteer-core with chromium for Vercel
      const puppeteer = await import('puppeteer-core');
      browser = await puppeteer.default.launch({
        args: [...chromium.args, '--hide-scrollbars', '--disable-web-security'],
        executablePath: await chromium.executablePath(),
        headless: true,
      });
    } else {
      // Use regular puppeteer for local development
      const puppeteer = await import('puppeteer');
      browser = await puppeteer.default.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
    }

    const page = await browser.newPage();

    // Set viewport to match the canvas size
    await page.setViewport({
      width: width || 1920,
      height: height || 1080,
    });

    // Navigate to the URL
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });

    // Take screenshot as base64
    const screenshot = await page.screenshot({
      encoding: 'base64',
      fullPage: false,
    });

    await browser.close();

    return NextResponse.json({
      image: `data:image/png;base64,${screenshot}`,
    });
  } catch (error) {
    console.error('Screenshot error:', error);
    return NextResponse.json(
      { error: 'Failed to capture screenshot', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
