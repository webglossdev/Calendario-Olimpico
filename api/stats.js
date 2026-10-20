// ═══════════════════════════════════════════════════════════════
// Calendário Olímpico — api/stats.js
// Vercel Serverless Function para Consulta de Telemetria e Observatório
// Retorna estatísticas agregadas e eventos armazenados no Vercel KV.
// ═══════════════════════════════════════════════════════════════

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Método não permitido' });
    }

    const kvUrl   = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
    const kvToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!kvUrl || !kvToken) {
        return res.status(200).json({
            status: 'local_mode',
            message: 'Vercel KV não configurado. O painel está utilizando o cache enriquecido de borda do navegador.',
            events: []
        });
    }

    try {
        // Buscar os últimos 200 eventos do Vercel KV
        const response = await fetch(`${kvUrl}/lrange/calolimpico_telemetry_events/0/199`, {
            headers: { Authorization: `Bearer ${kvToken}` }
        });
        const data = await response.json();
        const rawList = Array.isArray(data.result) ? data.result : [];

        const parsedEvents = rawList.map(item => {
            try { return typeof item === 'string' ? JSON.parse(item) : item; } catch (_) { return null; }
        }).filter(Boolean);

        return res.status(200).json({
            status: 'connected',
            storage: 'vercel_kv',
            total_retrieved: parsedEvents.length,
            events: parsedEvents
        });
    } catch (err) {
        console.error('[Stats API Error]:', err);
        return res.status(500).json({ error: 'Erro ao consultar estatísticas do Vercel KV' });
    }
}
