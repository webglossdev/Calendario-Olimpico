// ═══════════════════════════════════════════════════════════
// Calendário Olímpico — app.js (Landing Page)
// Fetch dados.json (new contract), render overview cards,
// filter by nível escolar, curiosity engine
// ═══════════════════════════════════════════════════════════

(function () {
    'use strict';

    // ─── State ───────────────────────────────────────────
    let olimpiadas = [];
    let filtroAtual = 'Todas';

    // ─── DOM References ──────────────────────────────────
    const listaEl = document.getElementById('lista-olimpiadas');
    const filtrosContainer = document.getElementById('filtros');
    const curiosidadeEl = document.getElementById('texto-curiosidade');
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const mobileMenu = document.getElementById('mobile-menu');

    // ─── Curiosidades (8 fatos reais) ────────────────────
    const CURIOSIDADES = [
        'A OBMEP é a maior olimpíada científica do mundo em número de participantes, com mais de 18 milhões de alunos inscritos anualmente.',
        'O Brasil já conquistou mais de 300 medalhas em olimpíadas internacionais de ciências, incluindo ouro em Matemática, Física e Informática.',
        'A Olimpíada Internacional de Matemática (IMO) existe desde 1959 e é a mais antiga olimpíada científica para estudantes do ensino médio.',
        'Artur Avila, medalhista de ouro da IMO pelo Brasil em 1995, se tornou o primeiro latino-americano a ganhar a Medalha Fields em 2014.',
        'A Olimpíada Brasileira de Astronomia (OBA) distribui foguetes de garrafa PET como atividade prática, incentivando a astronáutica desde cedo.',
        'O Canguru de Matemática é aplicado em mais de 90 países simultaneamente, sendo a maior competição de matemática do planeta.',
        'A Olimpíada Brasileira de Informática (OBI) aceita soluções em C, C++, Python e Java, preparando alunos para competições como a IOI.',
        'Participar de olimpíadas científicas pode garantir vagas em universidades de ponta no Brasil e no exterior através de programas de seleção especiais.',
        "Muitas universidades, como USP, Unicamp e Unesp, oferecem vagas dedicadas a medalhistas olímpicos, dispensando o vestibular tradicional.",
        "O Brasil oficializou julho como o Mês Nacional das Olimpíadas Científicas para intensificar a divulgação científica.",
        "Algumas olimpíadas exigem construção de materiais (foguetes na OBA, robôs na OBR) ou simulam debates acadêmicos (IYPT).",
        "Diferente de provas focadas em apenas uma matéria, a Olimpíada Nacional de Ciências (ONC) integra Astronomia, Biologia, Física, Química e História em um único exame.",
        "Medalhistas da OBMEP podem receber bolsas mensais de incentivo do CNPq.",
        "A Olimpíada de Linguística te desafia a decifrar idiomas desconhecidos usando apenas a lógica.",
        "A OBSAT permite que estudantes lancem pequenos satélites (picosatélites) ao espaço.",
        "Na Olimpíada de **Informática (OBI)**, você resolve enigmas complexos criando seus próprios algoritmos.",
        "Existe uma olimpiada focada em Inteligência Artificial e ela se chama ONIA.",
        "A **OAgro** mostra como drones e sensores de ponta estão revolucionando a produção de alimentos.",
        "Na **OBE**, você aprende a investir e entender como o dinheiro move o mundo digital.",
        "Na **MOBFOG**, você projeta, constrói e lança seu próprio foguete usando materiais reciclados.",
        "Olimpíadas de inovação premiam estudantes que desenvolvem aplicativos para ajudar suas comunidades.",
        "Competir em olimpíadas de tecnologia abre portas para estágios em gigantes do Vale do Silício (Estados Unidos).",
        "Na **Olimpíada de Design**, você projeta produtos que não agridem o meio ambiente.",
        "Algumas olimpíadas de História te levam para explorar museus e casarões históricos reais."
    ];

    // ═══════════════════════════════════════════════════════
    // Curiosity Engine — localStorage queue, no repeats
    // ═══════════════════════════════════════════════════════
    function exibirCuriosidade() {
        const STORAGE_KEY = 'calolimpico_curiosidade_fila';

        let fila = [];
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) fila = JSON.parse(saved);
        } catch (_) {
            fila = [];
        }

        if (!Array.isArray(fila) || fila.length === 0) {
            fila = shuffleArray([...Array(CURIOSIDADES.length).keys()]);
        }

        const idx = fila.pop();
        localStorage.setItem(STORAGE_KEY, JSON.stringify(fila));

        curiosidadeEl.textContent = CURIOSIDADES[idx];

        curiosidadeEl.style.opacity = '0';
        curiosidadeEl.style.transform = 'translateY(8px)';
        curiosidadeEl.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
        requestAnimationFrame(() => {
            curiosidadeEl.style.opacity = '1';
            curiosidadeEl.style.transform = 'translateY(0)';
        });
    }

    function shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    // ═══════════════════════════════════════════════════════
    // Fetch & Render Olympiad Cards
    // ═══════════════════════════════════════════════════════
    async function fetchOlimpiadas() {
        try {
            const response = await fetch('./dados.json');
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            olimpiadas = await response.json();

            // Sort by earliest inscription deadline
            olimpiadas.sort((a, b) => {
                const aInsc = getInscricaoDate(a);
                const bInsc = getInscricaoDate(b);
                return aInsc.localeCompare(bInsc);
            });

            renderCards();
        } catch (error) {
            listaEl.innerHTML = `
                <div class="col-span-full text-center py-16">
                    <svg class="w-12 h-12 mx-auto text-slate-600 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"/>
                    </svg>
                    <p class="text-slate-500 font-medium">Não foi possível carregar as olimpíadas.</p>
                    <p class="text-slate-600 text-sm mt-1">Verifique se o arquivo dados.json está acessível.</p>
                </div>
            `;
            console.error('Erro ao carregar dados:', error);
        }
    }

    function getInscricaoDate(o) {
        const inscEv = o.eventos.find(ev => ev.tipo === 'Inscrição');
        return inscEv ? inscEv.data : 'z';
    }

    function renderCards() {
        const filtradas = filtroAtual === 'Todas'
            ? olimpiadas
            : olimpiadas.filter(o => o.nivel_escolar.includes(filtroAtual));

        if (filtradas.length === 0) {
            listaEl.innerHTML = `
                <div class="col-span-full text-center py-16">
                    <p class="text-slate-500 font-medium">Nenhuma olimpíada encontrada para este filtro.</p>
                </div>
            `;
            return;
        }

        listaEl.innerHTML = filtradas.map((o, i) => criarCard(o, i)).join('');
    }

    function criarCard(o, index) {
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);

        // Find inscription event deadline
        const inscDate = getInscricaoDate(o);
        const inscricaoFim = new Date(inscDate + 'T00:00:00');
        const diffDias = Math.ceil((inscricaoFim - hoje) / (1000 * 60 * 60 * 24));

        const expirado = diffDias < 0;
        const urgente = diffDias >= 0 && diffDias <= 14;

        // Date badge styling
        let dateBadgeClass, dateText;
        if (expirado) {
            dateBadgeClass = 'bg-slate-700 text-slate-500';
            dateText = 'Inscrições encerradas';
        } else if (urgente) {
            dateBadgeClass = 'bg-red-500/20 text-red-400 animate-pulse';
            dateText = diffDias === 0 ? 'Último dia!' : `${diffDias} dia${diffDias > 1 ? 's' : ''} restante${diffDias > 1 ? 's' : ''}`;
        } else {
            dateBadgeClass = 'bg-emerald-500/15 text-emerald-400';
            dateText = `${diffDias} dias restantes`;
        }

        // Modalidade badge
        const modBadge = o.modalidade === 'Online'
            ? 'bg-violet-500/20 text-violet-400 border-violet-500/30'
            : 'bg-teal-500/20 text-teal-400 border-teal-500/30';

        // Level badges
        const nivelHtml = o.nivel_escolar.map(n => {
            const cores = {
                'Ensino Fundamental I': 'bg-purple-500/20 text-purple-400',
                'Ensino Fundamental II': 'bg-amber-500/20 text-amber-400',
                'Ensino Médio': 'bg-cyan-500/20 text-cyan-400',
            };
            return `<span class="text-[10px] font-medium px-1.5 py-0.5 rounded-full ${cores[n] || 'bg-slate-700 text-slate-400'}">${n}</span>`;
        }).join('');

        const formatDate = (dateStr) => new Date(dateStr + 'T00:00:00').toLocaleDateString('pt-BR', {
            day: '2-digit', month: 'short', year: 'numeric'
        });

        // Matérias as pills
        const materiasHtml = o.materias.map(m =>
            `<span class="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-slate-700 text-slate-300">${m}</span>`
        ).join('');

        // Next event
        const nextEvent = o.eventos.find(ev => new Date(ev.data + 'T00:00:00') >= hoje);
        const nextEventHtml = nextEvent
            ? `<div class="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
                    <svg class="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                    Próximo: <span class="text-slate-300 font-medium">${nextEvent.descricao}</span> — ${formatDate(nextEvent.data)}
               </div>`
            : '';

        const animDelay = `animation-delay: ${index * 60}ms`;

        return `
        <article class="group bg-slate-800 rounded-2xl border border-slate-700 shadow-lg shadow-slate-900/50
                        hover:border-slate-600 hover:shadow-xl hover:shadow-blue-900/10 hover:-translate-y-1
                        transition-all duration-300 flex flex-col overflow-hidden
                        opacity-0 animate-[fadeInUp_0.4s_ease_forwards]"
                 style="${animDelay}" role="region" aria-label="${o.nome}">

            <!-- Card Header -->
            <div class="p-5 pb-3 flex-1">
                <!-- Badges Row -->
                <div class="flex items-center gap-2 mb-3 flex-wrap">
                    <span class="text-xs font-bold px-2 py-0.5 rounded-full border ${modBadge}">${o.modalidade}</span>
                    <span class="text-xs font-semibold px-2.5 py-1 rounded-full ${dateBadgeClass}">
                        ${dateText}
                    </span>
                </div>

                <!-- Title -->
                <h3 class="text-lg font-bold text-slate-100 leading-snug group-hover:text-blue-400 transition-colors duration-200">
                    ${o.sigla} <span class="text-slate-400 font-normal text-sm">— ${o.nome}</span>
                </h3>

                <!-- Levels & Matérias -->
                <div class="mt-2 flex flex-wrap gap-1">
                    ${nivelHtml}
                    ${materiasHtml}
                </div>

                <!-- Next event -->
                ${nextEventHtml}

                <!-- Inscription deadline -->
                <div class="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
                    <svg class="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                    </svg>
                    Inscrições até <span class="font-semibold text-slate-300">${formatDate(inscDate)}</span>
                </div>
            </div>

            <!-- Card Footer -->
            <div class="px-5 pb-5 pt-2 flex gap-2">
                <a href="provas.html?id=${o.id}"
                   class="flex-1 block text-center px-4 py-2.5 rounded-xl text-sm font-semibold
                          bg-blue-600 text-white hover:bg-blue-500 hover:-translate-y-0.5 transition-all duration-200 shadow-md shadow-blue-600/20">
                    Ver Detalhes
                </a>
                ${!expirado ? `
                <a href="calendario.html"
                   class="flex items-center justify-center px-3 py-2.5 rounded-xl text-sm font-semibold
                          bg-slate-700 text-slate-300 border border-slate-600 hover:bg-slate-600 hover:text-white transition-all duration-200"
                   title="Ver no Calendário">
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                    </svg>
                </a>` : ''}
            </div>
        </article>
        `;
    }

    // ═══════════════════════════════════════════════════════
    // Filter System
    // ═══════════════════════════════════════════════════════
    function initFiltros() {
        const buttons = filtrosContainer.querySelectorAll('.filtro-btn');

        function updateActiveStyles() {
            buttons.forEach(btn => {
                const isActive = btn.dataset.filtro === filtroAtual;
                btn.setAttribute('aria-selected', isActive);

                if (isActive) {
                    btn.classList.add('bg-blue-600', 'text-white', 'shadow-md', 'shadow-blue-600/25');
                    btn.classList.remove('bg-slate-800', 'text-slate-400', 'hover:text-white', 'hover:bg-slate-700', 'border', 'border-slate-700');
                } else {
                    btn.classList.remove('bg-blue-600', 'text-white', 'shadow-md', 'shadow-blue-600/25');
                    btn.classList.add('bg-slate-800', 'text-slate-400', 'hover:text-white', 'hover:bg-slate-700', 'border', 'border-slate-700');
                }
            });
        }

        buttons.forEach(btn => {
            btn.addEventListener('click', () => {
                filtroAtual = btn.dataset.filtro;
                updateActiveStyles();
                renderCards();
            });
        });

        updateActiveStyles();
    }

    // ═══════════════════════════════════════════════════════
    // Mobile Menu Toggle
    // ═══════════════════════════════════════════════════════
    function initMobileMenu() {
        if (!mobileMenuBtn || !mobileMenu) return;

        mobileMenuBtn.addEventListener('click', () => {
            const isOpen = !mobileMenu.classList.contains('hidden');
            mobileMenu.classList.toggle('hidden');
            mobileMenuBtn.setAttribute('aria-expanded', !isOpen);
        });

        mobileMenu.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                mobileMenu.classList.add('hidden');
                mobileMenuBtn.setAttribute('aria-expanded', 'false');
            });
        });
    }

    // ═══════════════════════════════════════════════════════
    // Inject keyframes for card animation
    // ═══════════════════════════════════════════════════════
    function injectAnimations() {
        const style = document.createElement('style');
        style.textContent = `
            @keyframes fadeInUp {
                from {
                    opacity: 0;
                    transform: translateY(16px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }
        `;
        document.head.appendChild(style);
    }

    // ═══════════════════════════════════════════════════════
    // Init
    // ═══════════════════════════════════════════════════════
    function init() {
        injectAnimations();
        initMobileMenu();
        initFiltros();
        exibirCuriosidade();
        fetchOlimpiadas();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
