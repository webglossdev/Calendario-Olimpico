// ═══════════════════════════════════════════════════════════
// provas.js — Accordion directory page logic
// Fetch dados.json, render <details>/<summary> accordions,
// cross-filters (Série, Matéria, Mês, Modalidade),
// auto-open from URL ?id= param
// ═══════════════════════════════════════════════════════════

(function () {
    'use strict';

    // ─── State ───────────────────────────────────────────
    let olimpiadas = [];

    // ─── DOM ─────────────────────────────────────────────
    const listaEl = document.getElementById('lista-provas');
    const filtroSerie = document.getElementById('filtro-serie');
    const filtroMateria = document.getElementById('filtro-materia');
    const filtroMes = document.getElementById('filtro-mes');
    const filtroModalidade = document.getElementById('filtro-modalidade');
    const contagemEl = document.getElementById('contagem-provas');
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const mobileMenu = document.getElementById('mobile-menu');

    // ─── Month names ─────────────────────────────────────
    const MESES = [
        'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];

    // ─── Init ────────────────────────────────────────────
    async function init() {
        initMobileMenu();
        initLicenseModal();
        injectStyles();

        try {
            const res = await fetch('./dados.json');
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            olimpiadas = await res.json();

            populateFilters();
            renderAccordions();

            // Listeners
            filtroSerie.addEventListener('change', renderAccordions);
            filtroMateria.addEventListener('change', renderAccordions);
            filtroMes.addEventListener('change', renderAccordions);
            filtroModalidade.addEventListener('change', renderAccordions);

            // Auto-open from URL params
            handleDeepLink();

        } catch (err) {
            listaEl.innerHTML = `
                <div class="text-center py-16">
                    <p class="text-slate-500 font-medium">Não foi possível carregar os dados.</p>
                    <p class="text-slate-600 text-sm mt-1">${err.message}</p>
                </div>`;
            console.error(err);
        }
    }

    // ─── Populate filters dynamically ────────────────────
    function populateFilters() {
        // Matérias
        const materias = new Set();
        olimpiadas.forEach(o => o.materias.forEach(m => materias.add(m)));
        [...materias].sort().forEach(m => {
            const opt = document.createElement('option');
            opt.value = m;
            opt.textContent = m;
            filtroMateria.appendChild(opt);
        });

        // Meses (extract from events)
        const meses = new Set();
        olimpiadas.forEach(o => {
            o.eventos.forEach(ev => {
                const dataRef = ev.data || ev['data-f'] || ev['data-i'];
                if (dataRef) {
                    const month = parseInt(dataRef.split('-')[1], 10);
                    meses.add(month);
                }
            });
        });
        [...meses].sort((a, b) => a - b).forEach(m => {
            const opt = document.createElement('option');
            opt.value = m;
            opt.textContent = MESES[m - 1];
            filtroMes.appendChild(opt);
        });
    }

    // ─── Filter logic ────────────────────────────────────
    function getFiltered() {
        const serie = filtroSerie.value;
        const materia = filtroMateria.value;
        const mes = filtroMes.value;
        const modalidade = filtroModalidade.value;

        return olimpiadas.filter(o => {
            if (serie !== 'Todas' && !o.nivel_escolar.includes(serie)) return false;
            if (materia !== 'Todas' && !o.materias.includes(materia)) return false;
            if (modalidade !== 'Todas' && o.modalidade !== modalidade) return false;
            if (mes !== 'Todos') {
                const mesNum = parseInt(mes, 10);
                const hasMonth = o.eventos.some(ev => {
                    const d = ev.data || ev['data-f'] || ev['data-i'];
                    return d && parseInt(d.split('-')[1], 10) === mesNum;
                });
                if (!hasMonth) return false;
            }
            return true;
        });
    }

    // ─── Render accordions ───────────────────────────────
    function renderAccordions() {
        const filtered = getFiltered();

        contagemEl.textContent = `${filtered.length} olimpíada${filtered.length !== 1 ? 's' : ''}`;

        if (filtered.length === 0) {
            listaEl.innerHTML = `
                <div class="text-center py-16">
                    <p class="text-slate-500 font-medium">Nenhuma olimpíada encontrada para os filtros selecionados.</p>
                </div>`;
            return;
        }

        // Sort by earliest event date
        filtered.sort((a, b) => {
            const getMin = evs => evs.reduce((min, ev) => {
                const d = ev.data || ev['data-f'] || ev['data-i'] || 'z';
                return d < min ? d : min;
            }, 'z');
            return getMin(a.eventos).localeCompare(getMin(b.eventos));
        });

        listaEl.innerHTML = filtered.map((o, i) => criarAccordion(o, i)).join('');
    }

    function criarAccordion(o, index) {
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);

        // Find earliest inscription deadline
        const inscricaoEv = o.eventos.find(ev => ev.tipo === 'Inscrição');
        let statusBadge = '';
        if (inscricaoEv) {
            const d = inscricaoEv.data || inscricaoEv['data-f'] || inscricaoEv['data-i'];
            const inscDate = new Date(d + 'T00:00:00');
            const diff = Math.ceil((inscDate - hoje) / (1000 * 60 * 60 * 24));
            if (diff < 0) {
                statusBadge = '<span class="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-700 text-slate-500">Inscrições encerradas</span>';
            } else if (diff <= 14) {
                statusBadge = `<span class="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-500/20 text-red-400">${diff === 0 ? 'Último dia!' : diff + ' dias restantes'}</span>`;
            } else {
                statusBadge = `<span class="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400">${diff} dias restantes</span>`;
            }
        }

        // Modalidade badge
        const modBadge = o.modalidade === 'Online'
            ? 'bg-violet-500/20 text-violet-400 border-violet-500/30'
            : 'bg-teal-500/20 text-teal-400 border-teal-500/30';

        // Nivel badges
        const nivelHtml = o.nivel_escolar.map(n => {
            const cores = {
                'Ensino Fundamental I': 'bg-purple-500/20 text-purple-400',
                'Ensino Fundamental II': 'bg-amber-500/20 text-amber-400',
                'Ensino Médio': 'bg-cyan-500/20 text-cyan-400',
            };
            return `<span class="text-xs font-medium px-2 py-0.5 rounded-full ${cores[n] || 'bg-slate-700 text-slate-400'}">${n}</span>`;
        }).join('');

        // Events HTML
        const eventosHtml = o.eventos.map(ev => {
            const refDate = ev.data || ev['data-f'] || ev['data-i'];
            const evDate = new Date(refDate + 'T00:00:00');
            const passado = evDate < hoje;
            
            let dateStr = '';
            if (ev['data-i'] && ev['data-f']) {
                const di = new Date(ev['data-i'] + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
                const df = new Date(ev['data-f'] + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
                dateStr = `${di} a ${df}`;
            } else {
                dateStr = evDate.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
            }
            
            const tipoCor = ev.tipo === 'Inscrição' ? 'text-blue-400' : 'text-amber-400';
            return `
                <div class="flex items-center gap-3 py-2 ${passado ? 'opacity-40' : ''}">
                    <div class="w-2 h-2 rounded-full ${ev.tipo === 'Inscrição' ? 'bg-blue-500' : 'bg-amber-500'} flex-shrink-0"></div>
                    <div class="flex-1 min-w-0">
                        <span class="text-sm ${tipoCor} font-semibold">${ev.tipo}</span>
                        <span class="text-sm text-slate-400 ml-1">— ${ev.descricao}</span>
                    </div>
                    <span class="text-xs text-slate-500 font-medium whitespace-nowrap ${passado ? 'line-through' : ''}">${dateStr}</span>
                </div>`;
        }).join('');

        // Matérias pills
        const materiasHtml = o.materias.map(m =>
            `<span class="text-xs font-medium px-2.5 py-1 rounded-full bg-slate-700 text-slate-300 border border-slate-600">${m}</span>`
        ).join('');

        // Study materials
        const materiaisHtml = o.materiais_estudo && o.materiais_estudo.length > 0
            ? o.materiais_estudo.map(mat => `
                <a href="${mat.url}" target="_blank" rel="noopener noreferrer"
                   class="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900/50 border border-slate-700 hover:border-blue-500/50 hover:bg-slate-900 transition-all duration-200 group">
                    <svg class="w-4 h-4 text-blue-400 flex-shrink-0 group-hover:text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
                    </svg>
                    <span class="text-sm text-slate-300 group-hover:text-blue-300 transition-colors">${mat.titulo}</span>
                    <svg class="w-3.5 h-3.5 text-slate-600 ml-auto group-hover:text-blue-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
                    </svg>
                </a>`).join('')
            : '<p class="text-sm text-slate-600">Nenhum material disponível.</p>';

        const animDelay = `animation-delay: ${index * 60}ms`;

        return `
        <details id="prova-${o.id}" class="group bg-slate-800 rounded-2xl border border-slate-700 shadow-lg shadow-slate-900/50
                        hover:border-slate-600 transition-all duration-200
                        opacity-0 animate-[fadeInUp_0.4s_ease_forwards] overflow-hidden"
                 style="${animDelay}">
            <summary class="flex flex-wrap items-center gap-3 p-5 cursor-pointer select-none list-none
                           [&::-webkit-details-marker]:hidden">
                <!-- Arrow -->
                <svg class="w-5 h-5 text-slate-500 transition-transform duration-200 group-open:rotate-90 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/>
                </svg>

                <!-- Title area -->
                <div class="flex-1 min-w-0">
                    <div class="flex flex-wrap items-center gap-2 mb-1">
                        <h3 class="text-lg font-bold text-slate-100">${o.sigla}</h3>
                        <span class="text-sm text-slate-400">— ${o.nome}</span>
                    </div>
                    <div class="flex flex-wrap items-center gap-2">
                        <span class="text-xs font-bold px-2 py-0.5 rounded-full border ${modBadge}">${o.modalidade}</span>
                        ${statusBadge}
                    </div>
                </div>
            </summary>

            <!-- Expanded content -->
            <div class="border-t border-slate-700 p-5 space-y-5">
                <!-- Níveis -->
                <div>
                    <h4 class="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Níveis Escolares</h4>
                    <div class="flex flex-wrap gap-2">${nivelHtml}</div>
                </div>

                <!-- Matérias -->
                <div>
                    <h4 class="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Matérias</h4>
                    <div class="flex flex-wrap gap-2">${materiasHtml}</div>
                </div>

                <!-- Eventos / Datas -->
                <div>
                    <h4 class="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Datas Importantes</h4>
                    <div class="divide-y divide-slate-700/50">${eventosHtml}</div>
                </div>

                <!-- Materiais de Estudo -->
                <div>
                    <h4 class="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Materiais de Estudo</h4>
                    <div class="space-y-2">${materiaisHtml}</div>
                </div>

                <!-- Link to calendar -->
                <div class="pt-2">
                    <a href="calendario.html" class="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-400 hover:text-blue-300 transition-colors">
                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                        </svg>
                        Ver no Calendário
                    </a>
                </div>
            </div>
        </details>`;
    }

    // ─── Deep link: ?id= param ───────────────────────────
    function handleDeepLink() {
        const params = new URLSearchParams(window.location.search);
        const targetId = params.get('id');
        if (!targetId) return;

        const el = document.getElementById('prova-' + targetId);
        if (!el) return;

        // Open the accordion
        el.setAttribute('open', '');

        // Scroll into view after a short delay for render
        setTimeout(() => {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            // Flash highlight
            el.classList.add('ring-2', 'ring-blue-500/50');
            setTimeout(() => el.classList.remove('ring-2', 'ring-blue-500/50'), 2000);
        }, 300);
    }

    // ─── Mobile menu ─────────────────────────────────────
    function initMobileMenu() {
        if (!mobileMenuBtn || !mobileMenu) return;
        mobileMenuBtn.addEventListener('click', () => mobileMenu.classList.toggle('hidden'));
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

    // ─── Inject styles ───────────────────────────────────
    function injectStyles() {
        const style = document.createElement('style');
        style.textContent = `
            @keyframes fadeInUp {
                from { opacity: 0; transform: translateY(12px); }
                to   { opacity: 1; transform: translateY(0); }
            }
            details summary::-webkit-details-marker { display: none; }
            details summary::marker { display: none; }
        `;
        document.head.appendChild(style);
    }

    // ─── Boot ────────────────────────────────────────────
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
