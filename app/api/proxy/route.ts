import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const targetUrl = searchParams.get('url');

  if (!targetUrl) {
    return NextResponse.json({ error: 'URL parameter required' }, { status: 400 });
  }

  try {
    // Fetch the target webpage
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; CommentBot/1.0)',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.statusText}`);
    }

    let html = await response.text();

    // Rewrite URLs to be absolute so assets load correctly
    const baseUrl = new URL(targetUrl);
    const origin = `${baseUrl.protocol}//${baseUrl.host}`;

    // Fix relative URLs for assets
    html = html.replace(/src="\/([^"]*)"/g, `src="${origin}/$1"`);
    html = html.replace(/href="\/([^"]*)"/g, `href="${origin}/$1"`);
    html = html.replace(/src='\/([^']*)'/g, `src='${origin}/$1'`);
    html = html.replace(/href='\/([^']*)'/g, `href='${origin}/$1'`);

    // Add base tag to handle relative URLs
    html = html.replace(/<head>/i, `<head><base href="${targetUrl}">`);

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('Proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch webpage' },
      { status: 500 }
    );
  }
}
