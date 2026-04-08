// ═══════════════════════════════════════════════════════════
// calendario.js — Timeline page logic
// Fetch dados.json, flatten events, sort chronologically,
// render vertical timeline, filters by Série and Matéria
// ═══════════════════════════════════════════════════════════

(function () {
    'use strict';

    // ─── State ───────────────────────────────────────────
    let allEventos = [];
    let olimpiadas = [];

    // ─── DOM ─────────────────────────────────────────────
    const timelineEl = document.getElementById('timeline-container');
    const filtroSerie = document.getElementById('filtro-serie');
    const filtroMateria = document.getElementById('filtro-materia');
    const contagemEl = document.getElementById('contagem-eventos');
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const mobileMenu = document.getElementById('mobile-menu');

    // ─── Fetch & Init ────────────────────────────────────
    async function init() {
        initMobileMenu();
        initLicenseModal();

        try {
            const res = await fetch('./dados.json');
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            olimpiadas = await res.json();

            // Flatten all events
            allEventos = flattenEventos(olimpiadas);

            // Populate matéria filter dynamically
            populateMateriaFilter();

            // Render
            renderTimeline();

            // Listen to filters
            filtroSerie.addEventListener('change', renderTimeline);
            filtroMateria.addEventListener('change', renderTimeline);

        } catch (err) {
            timelineEl.innerHTML = `
                <div class="text-center py-16">
                    <p class="text-slate-500 font-medium">Não foi possível carregar os dados.</p>
                    <p class="text-slate-600 text-sm mt-1">${err.message}</p>
                </div>`;
            console.error(err);
        }
    }

    // ─── Flatten events ──────────────────────────────────
    function flattenEventos(data) {
        const flat = [];
        data.forEach(o => {
            o.eventos.forEach(ev => {
                const mainDate = ev.data || ev['data-f'] || ev['data-i'] || '';
                flat.push({
                    data: mainDate,
                    data_i: ev['data-i'],
                    data_f: ev['data-f'],
                    descricao: ev.descricao,
                    tipo: ev.tipo,
                    sigla: o.sigla,
                    nome: o.nome,
                    id: o.id,
                    nivel_escolar: o.nivel_escolar,
                    materias: o.materias,
                    modalidade: o.modalidade,
                });
            });
        });
        // Sort chronologically
        flat.sort((a, b) => a.data.localeCompare(b.data));
        return flat;
    }

    // ─── Populate matéria filter ─────────────────────────
    function populateMateriaFilter() {
        const materias = new Set();
        olimpiadas.forEach(o => o.materias.forEach(m => materias.add(m)));
        const sorted = [...materias].sort();
        sorted.forEach(m => {
            const opt = document.createElement('option');
            opt.value = m;
            opt.textContent = m;
            filtroMateria.appendChild(opt);
        });
    }

    // ─── Filter logic ────────────────────────────────────
    function getFilteredEvents() {
        const serie = filtroSerie.value;
        const materia = filtroMateria.value;

        return allEventos.filter(ev => {
            if (serie !== 'Todas' && !ev.nivel_escolar.includes(serie)) return false;
            if (materia !== 'Todas' && !ev.materias.includes(materia)) return false;
            return true;
        });
    }

    // ─── Render ──────────────────────────────────────────
    function renderTimeline() {
        const eventos = getFilteredEvents();

        contagemEl.textContent = `${eventos.length} evento${eventos.length !== 1 ? 's' : ''}`;

        if (eventos.length === 0) {
            timelineEl.innerHTML = `
                <div class="text-center py-16">
                    <p class="text-slate-500 font-medium">Nenhum evento encontrado para os filtros selecionados.</p>
                </div>`;
            return;
        }

        // Group by month
        const grouped = groupByMonth(eventos);

        let html = '';

        Object.entries(grouped).forEach(([monthKey, monthEvents]) => {
            const monthLabel = formatMonthLabel(monthKey);

            html += `
            <div class="mb-10">
                <!-- Month header -->
                <div class="flex items-center gap-3 mb-6">
                    <div class="h-px flex-1 bg-slate-700"></div>
                    <h2 class="text-sm font-bold uppercase tracking-widest text-blue-400 whitespace-nowrap">${monthLabel}</h2>
                    <div class="h-px flex-1 bg-slate-700"></div>
                </div>

                <!-- Timeline items -->
                <div class="relative pl-8 sm:pl-10 border-l-2 border-slate-700 space-y-6">
                    ${monthEvents.map((ev, i) => renderTimelineItem(ev, i)).join('')}
                </div>
            </div>`;
        });

        timelineEl.innerHTML = html;
    }

    function renderTimelineItem(ev, index) {
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        const evDate = new Date(ev.data + 'T00:00:00');
        const diffDias = Math.ceil((evDate - hoje) / (1000 * 60 * 60 * 24));

        const passado = diffDias < 0;
        const urgente = diffDias >= 0 && diffDias <= 7;
        const isProva = ev.tipo === 'Prova';

        // Dot color
        let dotColor = 'bg-blue-500 shadow-blue-500/40';
        if (passado) dotColor = 'bg-slate-600';
        else if (urgente) dotColor = 'bg-red-500 shadow-red-500/40 animate-pulse';
        else if (isProva) dotColor = 'bg-amber-500 shadow-amber-500/40';

        // Type badge
        const tipoBadge = ev.tipo === 'Inscrição'
            ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
            : 'bg-amber-500/20 text-amber-400 border-amber-500/30';

        // Date formatting
        let dateFormatted = '';
        if (ev.data_i && ev.data_f) {
            const di = new Date(ev.data_i + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
            const df = new Date(ev.data_f + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
            dateFormatted = `${di} a ${df}`;
        } else if (ev.data_i || ev.data_f) {
            const d = ev.data_i || ev.data_f;
            dateFormatted = new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' });
        } else {
            dateFormatted = new Date(ev.data + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' });
        }

        // Urgency text
        let urgencyHtml = '';
        if (passado) {
            urgencyHtml = '<span class="text-xs text-slate-600 font-medium">Já passou</span>';
        } else if (diffDias === 0) {
            urgencyHtml = '<span class="text-xs text-red-400 font-bold animate-pulse">HOJE!</span>';
        } else if (urgente) {
            urgencyHtml = `<span class="text-xs text-red-400 font-semibold">${diffDias} dia${diffDias > 1 ? 's' : ''}</span>`;
        }

        const animDelay = `animation-delay: ${index * 40}ms`;

        return `
        <div class="relative opacity-0 animate-[fadeInUp_0.3s_ease_forwards]" style="${animDelay}">
            <!-- Dot -->
            <div class="absolute -left-[25px] sm:-left-[29px] top-1.5 w-4 h-4 rounded-full ${dotColor} shadow-lg border-2 border-slate-900"></div>

            <!-- Card -->
            <div class="bg-slate-800 rounded-xl border border-slate-700 p-4 hover:border-slate-600 transition-all duration-200 ${passado ? 'opacity-50' : ''}">
                <div class="flex flex-wrap items-start justify-between gap-2 mb-2">
                    <div class="flex items-center gap-2 flex-wrap">
                        <span class="text-xs font-bold px-2 py-0.5 rounded-full border ${tipoBadge}">${ev.tipo}</span>
                        <span class="text-sm font-bold text-slate-100">${ev.sigla}</span>
                        <span class="text-xs text-slate-500 hidden sm:inline">— ${ev.nome}</span>
                    </div>
                    ${urgencyHtml}
                </div>

                <p class="text-sm text-slate-300 mb-2">${ev.descricao}</p>

                <div class="flex flex-wrap items-center justify-between gap-2">
                    <div class="flex items-center gap-1.5 text-xs text-slate-500">
                        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                        </svg>
                        <span class="capitalize">${dateFormatted}</span>
                    </div>
                    ${!passado ? `
                    <a href="provas.html?id=${ev.id}"
                       class="inline-flex items-center gap-1 text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors">
                        Ver Detalhes
                        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/>
                        </svg>
                    </a>` : ''}
                </div>
            </div>
        </div>`;
    }

    // ─── Helpers ──────────────────────────────────────────
    function groupByMonth(eventos) {
        const grouped = {};
        eventos.forEach(ev => {
            const key = ev.data.substring(0, 7); // "YYYY-MM"
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push(ev);
        });
        return grouped;
    }

    function formatMonthLabel(monthKey) {
        const [year, month] = monthKey.split('-');
        const date = new Date(parseInt(year), parseInt(month) - 1, 1);
        return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).replace(/^\w/, c => c.toUpperCase());
    }

    // ─── Mobile menu ─────────────────────────────────────
    function initMobileMenu() {
        if (!mobileMenuBtn || !mobileMenu) return;
        mobileMenuBtn.addEventListener('click', () => {
            mobileMenu.classList.toggle('hidden');
        });
        mobileMenu.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => mobileMenu.classList.add('hidden'));
        });
    }

    // ─── License Modal ───────────────────────────────────
    function initLicenseModal() {
        const modal = document.getElementById('license-modal');
        const openBtn = document.getElementById('license-btn');
        const closeBtn = document.getElementById('license-close-btn');
        const content = document.getElementById('license-content');

        if (!modal || !openBtn || !closeBtn || !content) return;

        const openModal = () => {
            modal.classList.remove('hidden');
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    modal.classList.remove('opacity-0');
                    modal.classList.add('opacity-100');
                    content.classList.remove('scale-95');
                    content.classList.add('scale-100');
                });
            });
            document.body.style.overflow = 'hidden';
        };

        const closeModal = () => {
            modal.classList.remove('opacity-100');
            modal.classList.add('opacity-0');
            content.classList.remove('scale-100');
            content.classList.add('scale-95');
            setTimeout(() => {
                modal.classList.add('hidden');
                document.body.style.overflow = '';
            }, 300);
        };

        openBtn.addEventListener('click', openModal);
        closeBtn.addEventListener('click', closeModal);

        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });

        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !modal.classList.contains('hidden')) closeModal();
        });
    }

    // ─── Inject animations ───────────────────────────────
    (function injectAnimations() {
        const style = document.createElement('style');
        style.textContent = `
            @keyframes fadeInUp {
                from { opacity: 0; transform: translateY(12px); }
                to   { opacity: 1; transform: translateY(0); }
            }
        `;
        document.head.appendChild(style);
    })();

    // ─── Boot ────────────────────────────────────────────
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
