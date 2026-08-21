import { NextRequest, NextResponse } from 'next/server';

const STATIC_ALLOWED_SUFFIXES = [
  '.lifonk.social',
  '.up.railway.app',
  '.r2.dev',
  '.cloudflarestorage.com',
];

function isAllowedHost(hostname: string) {
  const host = hostname.toLowerCase();
  if (host === 'api.lifonk.social') return true;
  if (STATIC_ALLOWED_SUFFIXES.some((suffix) => host.endsWith(suffix))) return true;

  const configuredApi = process.env.NEXT_PUBLIC_API_URL;
  if (configuredApi) {
    try {
      return host === new URL(configuredApi).hostname.toLowerCase();
    } catch {
      return false;
    }
  }
  return false;
}

function safeFilename(value: string | null, contentType: string | null) {
  const fallbackExt = contentType?.includes('png') ? '.png'
    : contentType?.includes('webp') ? '.webp'
      : contentType?.includes('gif') ? '.gif'
        : '.jpg';
  const raw = (value || `imagen-lifonk${fallbackExt}`).trim();
  const cleaned = raw.replace(/[\\/:*?"<>|\r\n]+/g, '-').slice(0, 120);
  return cleaned || `imagen-lifonk${fallbackExt}`;
}

export async function GET(request: NextRequest) {
  const sourceParam = request.nextUrl.searchParams.get('url');
  if (!sourceParam) return NextResponse.json({ message: 'Falta la URL de la imagen.' }, { status: 400 });

  let sourceUrl: URL;
  try {
    sourceUrl = new URL(sourceParam);
  } catch {
    return NextResponse.json({ message: 'URL inválida.' }, { status: 400 });
  }

  if (sourceUrl.protocol !== 'https:' || !isAllowedHost(sourceUrl.hostname)) {
    return NextResponse.json({ message: 'Origen de imagen no permitido.' }, { status: 403 });
  }

  try {
    const upstream = await fetch(sourceUrl, {
      redirect: 'follow',
      headers: { Accept: 'image/*' },
      cache: 'no-store',
    });

    if (!upstream.ok) {
      return NextResponse.json({ message: 'No se pudo descargar la imagen.' }, { status: upstream.status });
    }

    const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
    if (!contentType.startsWith('image/')) {
      return NextResponse.json({ message: 'El archivo solicitado no es una imagen.' }, { status: 415 });
    }

    const filename = safeFilename(request.nextUrl.searchParams.get('filename'), contentType);
    const body = await upstream.arrayBuffer();

    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        'Cache-Control': 'private, no-store, max-age=0',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return NextResponse.json({ message: 'No se pudo descargar la imagen.' }, { status: 502 });
  }
}
