// ═══════════════════════════════════════════════════════════════
// Calendário Olímpico — middleware.js (Vercel Edge Middleware)
// Executado na Borda (Edge) do Vercel antes de qualquer página carregar.
// Custo Zero: Inspeção em milissegundos de Cabeçalhos e Geolocalização.
// ═══════════════════════════════════════════════════════════════

export const config = {
    // Intercepta todas as rotas de páginas exceto arquivos estáticos (.css, .js, .png, etc.) e APIs
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|css|js|ico|woff|woff2)).*)',
    ],
};

// Lista de ASNs conhecidos de VPN, Datacenters e Proxies
const KNOWN_VPN_DATACENTER_ASNS = new Set([
    'AS9009',   // M247 Ltd (ProtonVPN, HideMyAss)
    'AS60068',  // Datacamp Limited / CDN77
    'AS202425', // IP Volume inc / PrivateVPN
    'AS13335',  // Cloudflare Warp / Gateway
    'AS20473',  // Choopa / Constant Company / Vultr
    'AS16509',  // Amazon AWS Datacenter
    'AS15169',  // Google Cloud Datacenter
    'AS14061',  // DigitalOcean Datacenter
    'AS16276',  // OVH SAS
    'AS209',    // Lumen / CenturyLink Datacenter
    'AS62240',  // Clouvider
    'AS39351',  // 31173 Services AB (Mullvad)
    'AS51852',  // Private Internet Access
    'AS40029',  // Novogara
    'AS212238', // Datacamp Limited
    'AS208312', // Surfshark Ltd
    'AS210644'  // Nord Security / NordVPN
]);

export default function middleware(request) {
    const url = new URL(request.url);

    // Permitir sempre página de administração, privacidade e APIs
    if (url.pathname.startsWith('/admin') ||
        url.pathname.startsWith('/privacidade') ||
        url.pathname.startsWith('/api') ||
        url.pathname.startsWith('/bloqueio')) {
        return;
    }

    // Checar se existe cookie de passe temporário de fronteira válido
    const cookies = request.headers.get('cookie') || '';
    if (cookies.includes('calolimpico_border_pass=true')) {
        // Aluno de fronteira liberado via passe de 7 dias
        return;
    }

    // 1. Extração de Geolocalização na Borda (Vercel Edge + Cloudflare Headers)
    const country = request.geo?.country ||
                    request.headers.get('cf-ipcountry') ||
                    request.headers.get('x-vercel-ip-country') ||
                    'BR'; // Fallback para desenvolvimento local

    const region = request.geo?.region ||
                   request.headers.get('cf-region') ||
                   request.headers.get('x-vercel-ip-country-region') ||
                   'SP';

    const city = request.geo?.city ||
                 request.headers.get('cf-ipcity') ||
                 request.headers.get('x-vercel-ip-city') ||
                 'São Paulo';

    const asn = request.headers.get('x-cf-asn') ||
                request.headers.get('x-vercel-ip-asn') ||
                '';

    const isp = request.headers.get('x-cf-isp') || '';

    // 2. Filtro Duplo na Borda:
    // Regra 1: Fora do Brasil
    let blockReason = null;
    if (country !== 'BR') {
        blockReason = 'FOREIGN_COUNTRY';
    } else if (asn && KNOWN_VPN_DATACENTER_ASNS.has(asn.toUpperCase())) {
        // Regra 2: IP do Brasil mas originado de Datacenter ou VPN
        blockReason = 'VPN_DATACENTER_ASN';
    }

    // Se bloqueado na borda, podemos injetar os cabeçalhos de diagnóstico para o cliente
    const responseHeaders = new Headers(request.headers);
    responseHeaders.set('x-edge-country', country);
    responseHeaders.set('x-edge-region', region);
    responseHeaders.set('x-edge-city', city);
    responseHeaders.set('x-edge-asn', asn);
    responseHeaders.set('x-edge-isp', isp);

    if (blockReason) {
        responseHeaders.set('x-edge-blocked', 'true');
        responseHeaders.set('x-edge-block-reason', blockReason);
    }

    return new Response(null, {
        headers: responseHeaders
    });
}
