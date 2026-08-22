import { NextRequest, NextResponse } from 'next/server';

const TIKTOK_HOSTS = new Set([
  'tiktok.com',
  'www.tiktok.com',
  'm.tiktok.com',
  'vt.tiktok.com',
  'vm.tiktok.com',
]);

function isTikTokUrl(value: URL) {
  return value.protocol === 'https:' && TIKTOK_HOSTS.has(value.hostname.toLowerCase());
}

async function resolveTikTokUrl(input: URL) {
  let current = input;

  for (let index = 0; index < 4; index += 1) {
    const response = await fetch(current.toString(), {
      method: 'HEAD',
      redirect: 'manual',
      headers: {
        'user-agent': 'Mozilla/5.0 (compatible; LifonkLinkPreview/1.0)',
      },
    });

    if (![301, 302, 303, 307, 308].includes(response.status)) return current;
    const location = response.headers.get('location');
    if (!location) return current;

    const next = new URL(location, current);
    if (!isTikTokUrl(next)) throw new Error('Redirección de TikTok no permitida');
    current = next;
  }

  return current;
}

export async function GET(request: NextRequest) {
  const rawUrl = request.nextUrl.searchParams.get('url')?.trim();
  if (!rawUrl || rawUrl.length > 2048) {
    return NextResponse.json({ message: 'URL inválida' }, { status: 400 });
  }

  let sharedUrl: URL;
  try {
    sharedUrl = new URL(rawUrl);
  } catch {
    return NextResponse.json({ message: 'URL inválida' }, { status: 400 });
  }

  if (!isTikTokUrl(sharedUrl)) {
    return NextResponse.json({ message: 'Proveedor no compatible' }, { status: 400 });
  }

  try {
    let canonicalUrl = sharedUrl;
    if (sharedUrl.hostname === 'vt.tiktok.com' || sharedUrl.hostname === 'vm.tiktok.com') {
      try {
        canonicalUrl = await resolveTikTokUrl(sharedUrl);
      } catch {
        canonicalUrl = sharedUrl;
      }
    }

    const endpoint = new URL('https://www.tiktok.com/oembed');
    endpoint.searchParams.set('url', canonicalUrl.toString());

    const response = await fetch(endpoint.toString(), {
      headers: {
        accept: 'application/json',
        'user-agent': 'Mozilla/5.0 (compatible; LifonkLinkPreview/1.0)',
      },
    });

    if (!response.ok) {
      return NextResponse.json({ message: 'Vista previa no disponible' }, { status: 404 });
    }

    const data = await response.json() as {
      title?: string;
      author_name?: string;
      author_url?: string;
      thumbnail_url?: string;
      provider_name?: string;
    };

    if (!data.thumbnail_url && !data.title) {
      return NextResponse.json({ message: 'Vista previa no disponible' }, { status: 404 });
    }

    return NextResponse.json({
      url: canonicalUrl.toString(),
      providerName: data.provider_name || 'TikTok',
      title: data.title || 'Video de TikTok',
      authorName: data.author_name || '',
      authorUrl: data.author_url || '',
      thumbnailUrl: data.thumbnail_url || '',
    }, {
      headers: {
        'Cache-Control': 'public, max-age=900, stale-while-revalidate=86400',
      },
    });
  } catch (error) {
    console.error('TikTok link preview error', error);
    return NextResponse.json({ message: 'No se pudo cargar la vista previa' }, { status: 502 });
  }
}
