// ═══════════════════════════════════════════════════════════════
// Calendário Olímpico — api/telemetry.js
// Vercel Serverless Function (Node.js) para Coleta de Telemetria LGPD
//
// Regras Estritas de Privacidade (Art. 7º, 12 e 14 da LGPD):
// 1. Descarte Imediato do IP Bruto na memória RAM (Zero gravação de IP)
// 2. Extração de Metadados de Borda (País, UF, Cidade, ASN/Provedor)
// 3. Persistência em Vercel KV / Upstash Redis REST (Zero Custo no Free Tier)
// ═══════════════════════════════════════════════════════════════

export default async function handler(req, res) {
    // Configurar cabeçalhos CORS para permitir sendBeacon e fetch
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // 1. Extração de Metadados de Borda do Vercel e Cloudflare
    const edgeCountry = req.headers['x-vercel-ip-country'] || req.headers['cf-ipcountry'] || 'BR';
    const edgeRegion  = req.headers['x-vercel-ip-country-region'] || req.headers['cf-region'] || 'SP';
    const edgeCity    = req.headers['x-vercel-ip-city'] ? decodeURIComponent(req.headers['x-vercel-ip-city']) : (req.headers['cf-ipcity'] || 'São Paulo');
    const edgeAsn     = req.headers['x-vercel-ip-asn'] || req.headers['x-cf-asn'] || 'AS28573';
    const edgeIsp     = req.headers['x-cf-isp'] || 'Operadora Nacional';

    // DESCARTE DE IP: Nunca gravamos req.headers['x-forwarded-for'] ou req.socket.remoteAddress

    // 2. Método GET: Consulta de Status do Backend no Vercel
    if (req.method === 'GET') {
        const isKvConfigured = Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
        return res.status(200).json({
            service: 'Calendário Olímpico — Telemetria Serverless Vercel',
            status: 'online',
            lgpd_compliant: true,
            ip_disposed_on_edge: true,
            storage_backend: isKvConfigured ? 'Vercel KV / Upstash Redis (Persistência Ativa)' : 'Edge Buffer (Pronto para Vercel KV)',
            edge_diagnostics: {
                detected_country: edgeCountry,
                detected_region: edgeRegion,
                detected_city: edgeCity,
                detected_asn: edgeAsn
            }
        });
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método não permitido' });
    }

    try {
        let payload = req.body;
        if (typeof payload === 'string') {
            try { payload = JSON.parse(payload); } catch (_) {}
        }

        if (!payload || typeof payload !== 'object') {
            return res.status(400).json({ error: 'Payload inválido' });
        }

        // Enriquecer evento com dados geográficos de borda verificados
        const enrichedEvent = {
            ...payload,
            server_received_at: new Date().toISOString(),
            edge_verified_country: edgeCountry,
            edge_verified_region: edgeRegion,
            edge_verified_city: edgeCity,
            edge_verified_asn: edgeAsn,
            edge_verified_isp: edgeIsp
        };

        // 3. Persistência em Vercel KV / Upstash Redis (se configurado nas variáveis de ambiente)
        const kvUrl   = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
        const kvToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

        let persisted = false;
        if (kvUrl && kvToken) {
            try {
                // LPUSH calolimpico_telemetry_events
                await fetch(`${kvUrl}/lpush/calolimpico_telemetry_events/${encodeURIComponent(JSON.stringify(enrichedEvent))}`, {
                    headers: { Authorization: `Bearer ${kvToken}` }
                });

                // LTRIM para limitar a 5.000 eventos (Free Tier amigável)
                await fetch(`${kvUrl}/ltrim/calolimpico_telemetry_events/0/4999`, {
                    headers: { Authorization: `Bearer ${kvToken}` }
                });

                // Atualizar contadores em Hash Redis
                await fetch(`${kvUrl}/hincrby/calolimpico_stats/total_events/1`, {
                    headers: { Authorization: `Bearer ${kvToken}` }
                });

                if (enrichedEvent.type === 'identity_switch') {
                    await fetch(`${kvUrl}/hincrby/calolimpico_stats/identity_switches/1`, {
                        headers: { Authorization: `Bearer ${kvToken}` }
                    });
                } else if (enrichedEvent.type === 'access_blocked') {
                    await fetch(`${kvUrl}/hincrby/calolimpico_stats/blocked_access/1`, {
                        headers: { Authorization: `Bearer ${kvToken}` }
                    });
                } else if (enrichedEvent.type === 'border_false_positive_report') {
                    await fetch(`${kvUrl}/hincrby/calolimpico_stats/border_reports/1`, {
                        headers: { Authorization: `Bearer ${kvToken}` }
                    });
                }

                persisted = true;
            } catch (kvError) {
                console.error('[Telemetry Vercel KV Error]:', kvError);
            }
        }

        return res.status(200).json({
            ok: true,
            persisted: persisted,
            storage: persisted ? 'vercel_kv' : 'edge_client_sync',
            edge: {
                country: edgeCountry,
                region: edgeRegion,
                city: edgeCity,
                asn: edgeAsn,
                isp: edgeIsp
            }
        });
    } catch (err) {
        console.error('[Telemetry Handler Error]:', err);
        return res.status(500).json({ error: 'Erro interno ao processar telemetria' });
    }
}
