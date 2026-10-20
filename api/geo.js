// ═══════════════════════════════════════════════════════════════
// Calendário Olímpico — api/geo.js (Vercel Edge Route)
// Retorna a localização de rede e ASN calculados na borda do Vercel/Cloudflare.
// ═══════════════════════════════════════════════════════════════

export const config = {
    runtime: 'edge',
};

export default function handler(request) {
    const country = request.geo?.country ||
                    request.headers.get('cf-ipcountry') ||
                    request.headers.get('x-vercel-ip-country') ||
                    'BR';

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
                'AS28573';

    const isp = request.headers.get('x-cf-isp') || 'Operadora Nacional';

    return new Response(JSON.stringify({
        country,
        region,
        city: decodeURIComponent(city),
        asn,
        isp,
        timestamp: Date.now()
    }), {
        status: 200,
        headers: {
            'content-type': 'application/json',
            'cache-control': 'no-store, max-age=0',
            'Access-Control-Allow-Origin': '*'
        }
    });
}
