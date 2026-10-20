// ═══════════════════════════════════════════════════════════════
// Calendário Olímpico — api/olimpiadas.js (Public REST API)
// Licença: GNU Affero General Public License v3.0 (GNU AGPLv3)
//
// Permite que qualquer serviço, aplicativo ou escola consulte a base
// de dados consolidada de olimpíadas científicas brasileiras.
//
// Cláusula de Rede (Seção 13 da AGPLv3):
// Qualquer serviço de rede que utilizar ou estender esta API deve
// obrigatoriamente disponibilizar seu código-fonte correspondente.
// ═══════════════════════════════════════════════════════════════

import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
    // Cabeçalhos CORS Públicos para permitir consumo por qualquer site ou app
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
    res.setHeader('X-License', 'GNU AGPLv3 - Section 13 Network Copyleft');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({
            error: 'Método não permitido',
            allowed: ['GET']
        });
    }

    try {
        let items = [];
        const filePath = path.join(process.cwd(), 'dados.json');

        if (fs.existsSync(filePath)) {
            const raw = fs.readFileSync(filePath, 'utf8');
            items = JSON.parse(raw);
        }

        // Filtros via Query Parameters:
        // ?sigla=OBMEP
        // ?materia=Matemática
        // ?nivel=Ensino Médio
        // ?modalidade=Presencial
        // ?search=termo
        const { sigla, materia, nivel, modalidade, search } = req.query;

        let filtered = items;

        if (sigla) {
            filtered = filtered.filter(item =>
                (item.sigla || '').toLowerCase() === sigla.toLowerCase()
            );
        }

        if (materia) {
            filtered = filtered.filter(item =>
                Array.isArray(item.materias) &&
                item.materias.some(m => m.toLowerCase().includes(materia.toLowerCase()))
            );
        }

        if (nivel) {
            filtered = filtered.filter(item =>
                Array.isArray(item.nivel_escolar) &&
                item.nivel_escolar.some(n => n.toLowerCase().includes(nivel.toLowerCase()))
            );
        }

        if (modalidade) {
            filtered = filtered.filter(item =>
                (item.modalidade || '').toLowerCase() === modalidade.toLowerCase()
            );
        }

        if (search) {
            const q = search.toLowerCase();
            filtered = filtered.filter(item =>
                (item.sigla || '').toLowerCase().includes(q) ||
                (item.nome || '').toLowerCase().includes(q) ||
                (item.descricao || '').toLowerCase().includes(q)
            );
        }

        return res.status(200).json({
            api: 'Calendário Olímpico REST API',
            version: '1.0.0',
            license: 'GNU Affero General Public License v3.0 (GNU AGPLv3)',
            terms_and_notice: 'O uso desta API em serviços de rede exige que o serviço derivado mantenha seu código aberto sob a GNU AGPLv3 (Seção 13).',
            total_items: filtered.length,
            results: filtered
        });
    } catch (err) {
        console.error('[API Olimpíadas Error]:', err);
        return res.status(500).json({ error: 'Erro interno ao consultar olimpíadas' });
    }
}
