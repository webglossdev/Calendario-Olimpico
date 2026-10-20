// ═══════════════════════════════════════════════════════════════
// Calendário Olímpico — app.js (Apple HIG Redesign)
// Dynamic data loading, multi-criteria filtering, search,
// favorites engine, live countdowns, Apple Sheet modal, and curiosity engine.
// ═══════════════════════════════════════════════════════════════

(function () {
    'use strict';

    // ─── State ───────────────────────────────────────────
    let olimpiadas = [];
    let favoritos = [];
    let currentSheetOlimpiadaId = null;
    
    const filters = {
        nivel: 'Todas',
        materia: 'Todas',
        modalidade: 'Todas',
        status: 'Todos',
        ordem: 'prazo',
        searchQuery: ''
    };

    // ─── Storage Keys ────────────────────────────────────
    const STORAGE_FAVORITES = 'calolimpico_favoritos_v1';
    const STORAGE_CURIOSITY = 'calolimpico_curiosidade_fila_v1';
    const STORAGE_PAGE_LOADS = 'calolimpico_page_loads_v1';

    // ─── DOM References ──────────────────────────────────
    const listaEl = document.getElementById('lista-olimpiadas');
    const searchBar = document.getElementById('search-bar');
    const nivelPillsContainer = document.getElementById('filtros-nivel');
    const selectMateria = document.getElementById('select-materia');
    const selectModalidade = document.getElementById('select-modalidade');
    const selectStatus = document.getElementById('select-status');
    const selectOrdem = document.getElementById('select-ordem');
    const contagemEl = document.getElementById('contagem-resultados');
    const btnQuickReset = document.getElementById('btn-quick-reset');
    const curiosidadeEl = document.getElementById('texto-curiosidade');
    const btnNextCuriosity = document.getElementById('btn-next-curiosity');
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const mobileMenu = document.getElementById('mobile-menu');
    const savedCountBadge = document.getElementById('saved-count-badge');
    const pillSavedCounter = document.getElementById('pill-saved-counter');
    const btnShowSaved = document.getElementById('btn-show-saved');
    const toastContainer = document.getElementById('toast-container');
    const heroSpotlightText = document.getElementById('hero-spotlight-text');

    // Sheet Modal References
    const sheetModal = document.getElementById('olympic-sheet-modal');
    const sheetCloseBtn = document.getElementById('sheet-close-btn');
    const sheetTitle = document.getElementById('sheet-modal-title');
    const sheetBody = document.getElementById('sheet-modal-body');
    const sheetFavBtn = document.getElementById('sheet-fav-btn');
    const sheetCatalogBtn = document.getElementById('sheet-catalog-btn');

    // ─── Curated Curiosities Database ────────────────────
    const CURIOSIDADES = [
        'A OBMEP é a maior olimpíada científica do planeta em número de estudantes, reunindo mais de 18 milhões de participantes anualmente no Brasil.',
        'O Brasil já conquistou centenas de medalhas em olimpíadas internacionais de ciências, incluindo ouros históricos na IMO (Matemática), IPhO (Física) e IOI (Informática).',
        'Universidades públicas de ponta como USP, Unicamp e Unesp reservam centenas de vagas anuais de graduação exclusivas para medalhistas olímpicos sem precisar fazer o vestibular tradicional.',
        'Artur Avila, que conquistou a medalha de ouro na IMO pelo Brasil em 1995, recebeu a Medalha Fields (o Nobel da Matemática) em 2014.',
        'A Olimpíada Brasileira de Astronomia (OBA) e a MOBFOG ensinam estudantes a construírem foguetes com garrafas PET e propelentes de vinagre com bicarbonato que superam 200 metros de altitude.',
        'O Concurso Canguru de Matemática é aplicado simultaneamente em mais de 90 países para mais de 6 milhões de alunos ao redor do mundo.',
        'A Olimpíada Brasileira de Informática (OBI) qualifica os melhores programadores do país para a International Olympiad in Informatics (IOI), abrindo portas para grandes empresas de tecnologia.',
        'Medalhistas de ouro, prata e bronze da OBMEP no Ensino Fundamental e Médio têm direito a bolsas mensais de incentivo à iniciação científica do CNPq através do Programa OBMEP na Escola (PIC).',
        'A Olimpíada Brasileira de Linguística (OBL) desafia você a decifrar hieróglifos, línguas indígenas e sistemas de escrita ancestrais usando apenas dedução e lógica formal.',
        'Diferente de exames tradicionais, a Olimpíada Nacional de Ciências (ONC) testa o raciocínio interdisciplinar integrando Astronomia, Biologia, Física, Química e História em um único exame.',
        'No IYPT (International Young Physicists\' Tournament), a competição simula debates científicos internacionais com "Lutas Físicas" (Physics Fights) em inglês.',
        'A Olimpíada Brasileira de Robótica (OBR) conta com desafios práticos de resgate autônomo com sensores e programação em arena e desafios teóricos de ponta.',
        'A Olimpíada Nacional de Inteligência Artificial (ONIA) ensina modelos de aprendizado de máquina, redes neurais e processamento de linguagem natural desde a educação básica.'
    ];

    // ═══════════════════════════════════════════════════════
    // Helpers & Date Formatting
    // ═══════════════════════════════════════════════════════
    function getEventReferenceDate(ev) {
        return ev?.data || ev?.['data-f'] || ev?.['data-i'] || '';
    }

    function getInscricaoEvent(o) {
        return (o.eventos || []).find(ev => ev.tipo === 'Inscrição');
    }

    function getInscricaoDate(o) {
        const insc = getInscricaoEvent(o);
        return getEventReferenceDate(insc);
    }

    function getEarliestEventDate(o) {
        return (o.eventos || []).reduce((min, ev) => {
            const d = getEventReferenceDate(ev);
            if (!d) return min;
            return !min || d < min ? d : min;
        }, '');
    }

    function formatDate(dateStr) {
        if (!dateStr) return '';
        try {
            const [y, m, d] = dateStr.split('-');
            const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
            return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
        } catch (_) {
            return dateStr;
        }
    }

    function formatShortDate(dateStr) {
        if (!dateStr) return '';
        try {
            const [y, m, d] = dateStr.split('-');
            const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
            return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
        } catch (_) {
            return dateStr;
        }
    }

    function showToast(message, type = 'info') {
        if (!toastContainer) return;
        const toast = document.createElement('div');
        toast.className = `toast-message toast-${type}`;
        const icon = type === 'success' ? 'i-star-fill' : 'i-star';
        toast.innerHTML = `<svg class="icon" aria-hidden="true"><use href="#${icon}"/></svg><span>${message}</span>`;
        toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.remove();
        }, 2700);
    }

    // ─── Spectrum helpers ────────────────────────────────
    // The year is read as a visible spectrum: Jan = violet … Dez = red.
    // Hue only ever encodes position in the year (always redundant with x).
    const SPECTRUM_STOPS = [
        [0.00, [138, 92, 255]],  // violet
        [0.16, [74, 108, 255]],  // blue
        [0.32, [34, 184, 232]],  // cyan
        [0.48, [52, 211, 120]],  // green
        [0.62, [214, 222, 64]],  // yellow
        [0.76, [255, 168, 46]],  // orange
        [0.88, [255, 98, 61]],   // red-orange
        [1.00, [230, 40, 72]]    // deep red
    ];

    function parseDate(str) {
        if (!str) return null;
        const [y, m, d] = str.split('-').map(n => parseInt(n, 10));
        if (!y || !m || !d) return null;
        return new Date(y, m - 1, d);
    }

    function getToday() {
        const t = new Date();
        t.setHours(0, 0, 0, 0);
        return t;
    }

    function daysBetween(from, to) {
        return Math.round((to - from) / 86400000);
    }

    function yearFraction(date) {
        const start = new Date(2026, 0, 1);
        const end = new Date(2027, 0, 1);
        return Math.min(1, Math.max(0, (date - start) / (end - start)));
    }

    function spectrumColor(t) {
        for (let i = 1; i < SPECTRUM_STOPS.length; i++) {
            const [p1, c1] = SPECTRUM_STOPS[i];
            const [p0, c0] = SPECTRUM_STOPS[i - 1];
            if (t <= p1) {
                const k = (t - p0) / (p1 - p0);
                const c = c0.map((v, j) => Math.round(v + (c1[j] - v) * k));
                return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
            }
        }
        return 'rgb(230, 40, 72)';
    }

    function getSortedEvents(o) {
        return (o.eventos || [])
            .map(ev => ({ ev, date: parseDate(getEventReferenceDate(ev)) }))
            .filter(x => x.date)
            .sort((a, b) => a.date - b.date);
    }

    function eventLabel(ev) {
        return ev.tipo === 'Inscrição' ? 'Fim das inscrições' : (ev.descricao || ev.tipo || 'Evento');
    }

    function stripHtml(o, extraClass = '') {
        const hoje = getToday();
        const ticks = getSortedEvents(o).map(({ ev, date }) => {
            const t = yearFraction(date);
            const cls = [ev.tipo === 'Inscrição' ? 'is-short' : '', date < hoje ? 'is-past' : ''].join(' ').trim();
            return `<i class="${cls}" style="left:${(t * 100).toFixed(2)}%;--c:${spectrumColor(t)}"></i>`;
        }).join('');
        const todayLeft = (yearFraction(hoje) * 100).toFixed(2);
        return `<div class="card__strip ${extraClass}" aria-hidden="true">${ticks}<span class="card__today" style="left:${todayLeft}%"></span></div>`;
    }

    // ═══════════════════════════════════════════════════════
    // Favorites Management
    // ═══════════════════════════════════════════════════════
    function loadFavorites() {
        try {
            const raw = localStorage.getItem(STORAGE_FAVORITES);
            favoritos = raw ? JSON.parse(raw) : [];
            if (!Array.isArray(favoritos)) favoritos = [];
        } catch (_) {
            favoritos = [];
        }
        updateFavoritesBadges();
    }

    function toggleFavorite(id, sigla) {
        const idx = favoritos.indexOf(id);
        const willBeFav = idx === -1;
        if (idx > -1) {
            favoritos.splice(idx, 1);
            showToast(`${sigla} removida das salvas`, 'info');
        } else {
            favoritos.push(id);
            showToast(`${sigla} salva`, 'success');
        }
        try {
            localStorage.setItem(STORAGE_FAVORITES, JSON.stringify(favoritos));
        } catch (_) {}
        
        updateFavoritesBadges();
        renderCards();

        // Update modal button if currently open for this id
        if (currentSheetOlimpiadaId === id) {
            setSheetFavLabel(willBeFav);
        }
    }

    function updateFavoritesBadges() {
        const count = favoritos.length;
        if (savedCountBadge) savedCountBadge.textContent = count;
        if (pillSavedCounter) pillSavedCounter.textContent = count;
    }

    // ═══════════════════════════════════════════════════════
    // Curiosity Engine
    // ═══════════════════════════════════════════════════════
    function getNextCuriosity() {
        let fila = [];
        try {
            const saved = localStorage.getItem(STORAGE_CURIOSITY);
            if (saved) fila = JSON.parse(saved);
        } catch (_) {
            fila = [];
        }

        if (!Array.isArray(fila) || fila.length === 0) {
            fila = shuffleArray([...Array(CURIOSIDADES.length).keys()]);
        }

        const idx = fila.pop();
        try {
            localStorage.setItem(STORAGE_CURIOSITY, JSON.stringify(fila));
        } catch (_) {}

        if (curiosidadeEl) {
            curiosidadeEl.classList.add('updating');
            setTimeout(() => {
                curiosidadeEl.textContent = CURIOSIDADES[idx];
                curiosidadeEl.classList.remove('updating');
            }, 140);
        }
    }

    function shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    // ═══════════════════════════════════════════════════════
    // Data Loading & Spotlight Metric Update
    // ═══════════════════════════════════════════════════════
    async function fetchOlimpiadas() {
        try {
            if (window.OLIMPIADAS_DATA && Array.isArray(window.OLIMPIADAS_DATA) && window.OLIMPIADAS_DATA.length > 0) {
                olimpiadas = JSON.parse(JSON.stringify(window.OLIMPIADAS_DATA));
            } else {
                const res = await fetch('./dados.json');
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                olimpiadas = await res.json();
            }

            populateSubjectSelect();
            updateHeroStats();
            renderSpectrum();
            renderCards();
        } catch (err) {
            listaEl.innerHTML = `
                <div class="empty">
                    <h3>Não foi possível carregar as competições</h3>
                    <p>Verifique se o arquivo dados.js ou dados.json está na mesma pasta e recarregue a página.</p>
                    <button type="button" class="btn btn--prominent" onclick="window.location.reload()">Recarregar</button>
                </div>
            `;
            console.error('Erro ao carregar dados:', err);
        }
    }

    function updateHeroStats() {
        const statComp = document.getElementById('stat-competicoes');
        const statAreas = document.getElementById('stat-areas');
        const statInsc = document.getElementById('stat-inscricoes-abertas');
        const statMat = document.getElementById('stat-materiais');

        if (!statComp) return;

        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);

        const areas = new Set();
        let abertasCount = 0;
        let totalMateriais = 0;
        let closestUpcoming = null;

        olimpiadas.forEach(o => {
            (o.materias || []).forEach(m => areas.add(m));
            totalMateriais += (o.materiais_estudo || []).length;
            
            const inscDate = getInscricaoDate(o);
            if (inscDate) {
                const [y, m, d] = inscDate.split('-');
                const deadLine = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
                const diffDias = Math.ceil((deadLine - hoje) / (1000 * 60 * 60 * 24));
                
                if (diffDias >= 0) {
                    abertasCount++;
                    if (!closestUpcoming || diffDias < closestUpcoming.days) {
                        closestUpcoming = {
                            sigla: o.sigla,
                            nome: o.nome,
                            date: inscDate,
                            days: diffDias,
                            desc: 'Prazo final de inscrições'
                        };
                    }
                }
            }
        });

        statComp.textContent = olimpiadas.length;
        if (statAreas) statAreas.textContent = areas.size;
        if (statInsc) statInsc.textContent = abertasCount;
        if (statMat) statMat.textContent = totalMateriais;

        if (heroSpotlightText && closestUpcoming) {
            const when = closestUpcoming.days === 0
                ? '<strong>encerram hoje</strong>'
                : `encerram em <strong>${closestUpcoming.days} dia${closestUpcoming.days !== 1 ? 's' : ''}</strong>`;
            heroSpotlightText.innerHTML = `
                <strong>Prazo em destaque:</strong>
                as inscrições da ${closestUpcoming.sigla} ${when} (${formatDate(closestUpcoming.date)}).
            `;
        }
    }

    // ═══════════════════════════════════════════════════════
    // Season Spectrum (signature element)
    // ═══════════════════════════════════════════════════════
    function renderSpectrum() {
        const linesEl = document.getElementById('spectrum-lines');
        const todayEl = document.getElementById('spectrum-today');
        const tipEl = document.getElementById('spectrum-tip');
        const bandEl = document.getElementById('spectrum-band');
        const upcomingEl = document.getElementById('upcoming-list');
        if (!linesEl) return;

        const hoje = getToday();
        const all = [];
        olimpiadas.forEach(o => {
            getSortedEvents(o).forEach(({ ev, date }) => {
                if (date.getFullYear() !== 2026) return;
                all.push({ o, ev, date, t: yearFraction(date) });
            });
        });
        all.sort((a, b) => a.date - b.date);

        linesEl.innerHTML = all.map((x, i) => {
            const isDeadline = x.ev.tipo === 'Inscrição';
            const h = isDeadline ? 52 : 100;
            return `<button type="button" tabindex="-1" class="spectrum__line${x.date < hoje ? ' is-past' : ''}"
                data-idx="${i}" data-id="${x.o.id}"
                style="left:${(x.t * 100).toFixed(3)}%;--h:${h}%;--c:${spectrumColor(x.t)};--i:${i}"
                aria-label="${x.o.sigla}: ${eventLabel(x.ev)}, ${formatDate(getEventReferenceDate(x.ev))}"></button>`;
        }).join('');

        if (bandEl) {
            const upcomingCount = all.filter(x => x.date >= hoje).length;
            bandEl.setAttribute('aria-label', `Espectro de 2026: ${all.length} datas oficiais ao longo do ano, ${upcomingCount} ainda por acontecer.`);
        }

        if (todayEl && hoje.getFullYear() === 2026) {
            todayEl.style.left = `${(yearFraction(hoje) * 100).toFixed(2)}%`;
            todayEl.hidden = false;
        }

        // Tooltip + open sheet
        const showTip = (btn) => {
            const x = all[parseInt(btn.dataset.idx, 10)];
            if (!x || !tipEl) return;
            linesEl.querySelectorAll('.is-active').forEach(el => el.classList.remove('is-active'));
            btn.classList.add('is-active');
            tipEl.innerHTML = `<b>${x.o.sigla}</b>${eventLabel(x.ev)}<br><time>${formatDate(getEventReferenceDate(x.ev))}</time>`;
            const pct = Math.min(88, Math.max(12, x.t * 100));
            tipEl.style.left = `${pct}%`;
            tipEl.hidden = false;
        };
        const hideTip = () => {
            if (tipEl) tipEl.hidden = true;
            linesEl.querySelectorAll('.is-active').forEach(el => el.classList.remove('is-active'));
        };
        linesEl.querySelectorAll('.spectrum__line').forEach(btn => {
            btn.addEventListener('pointerenter', () => showTip(btn));
            btn.addEventListener('click', () => openOlympicSheet(btn.dataset.id, btn));
        });
        linesEl.addEventListener('pointerleave', hideTip);

        // "A seguir" — the keyboard/screen-reader equivalent of the band
        if (upcomingEl) {
            const next = all.filter(x => x.date >= hoje).slice(0, 6);
            if (next.length === 0) {
                upcomingEl.innerHTML = '<li class="upcoming__placeholder">Todas as datas de 2026 já passaram. Novos cronogramas aparecem aqui quando forem publicados.</li>';
            } else {
                upcomingEl.innerHTML = next.map(x => {
                    const d = daysBetween(hoje, x.date);
                    const rel = d === 0 ? 'hoje' : d === 1 ? 'amanhã' : `em ${d} dias`;
                    return `<li><button type="button" class="upcoming__item" data-id="${x.o.id}" style="--c:${spectrumColor(x.t)}">
                        <span class="upcoming__swatch" aria-hidden="true"></span>
                        <span class="upcoming__date">${formatShortDate(getEventReferenceDate(x.ev))}</span>
                        <span class="upcoming__what"><b>${x.o.sigla}</b><span>${eventLabel(x.ev)} · ${rel}</span></span>
                    </button></li>`;
                }).join('');
                upcomingEl.querySelectorAll('.upcoming__item').forEach(btn => {
                    btn.addEventListener('click', () => openOlympicSheet(btn.dataset.id, btn));
                });
            }
        }

        const section = linesEl.closest('.spectrum');
        if (section) requestAnimationFrame(() => section.classList.add('is-ready'));
    }

    function populateSubjectSelect() {
        if (!selectMateria) return;
        const areas = new Set();
        olimpiadas.forEach(o => (o.materias || []).forEach(m => areas.add(m)));
        const sorted = [...areas].sort();

        sorted.forEach(m => {
            const opt = document.createElement('option');
            opt.value = m;
            opt.textContent = m;
            selectMateria.appendChild(opt);
        });
    }

    // ═══════════════════════════════════════════════════════
    // Filtering & Sorting Core
    // ═══════════════════════════════════════════════════════
    function getFilteredOlimpiadas() {
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);

        return olimpiadas.filter(o => {
            // Nível / Favoritas
            if (filters.nivel === 'Favoritas') {
                if (!favoritos.includes(o.id)) return false;
            } else if (filters.nivel !== 'Todas') {
                if (!(o.nivel_escolar || []).includes(filters.nivel)) return false;
            }

            // Matéria
            if (filters.materia !== 'Todas') {
                const target = filters.materia.toLowerCase();
                const hasMatch = (o.materias || []).some(m => {
                    const mLower = m.toLowerCase();
                    if (mLower === target) return true;
                    if (target === 'informática' && (mLower.includes('informática') || mLower.includes('computação') || mLower.includes('programação') || mLower.includes('robótica') || mLower.includes('inteligência artificial'))) return true;
                    if (target === 'astronomia' && (mLower.includes('astronomia') || mLower.includes('astronáutica') || mLower.includes('aeroespacial'))) return true;
                    if (target === 'física' && mLower.includes('física')) return true;
                    if (target === 'matemática' && mLower.includes('matemática')) return true;
                    if (target === 'química' && mLower.includes('química')) return true;
                    if (target === 'biologia' && mLower.includes('biologia')) return true;
                    if (target === 'linguística' && (mLower.includes('linguística') || mLower.includes('língua') || mLower.includes('letras'))) return true;
                    return mLower.includes(target);
                });
                if (!hasMatch) return false;
            }

            // Modalidade
            if (filters.modalidade !== 'Todas') {
                if (o.modalidade !== filters.modalidade) return false;
            }

            // Status
            if (filters.status !== 'Todos') {
                const inscDate = getInscricaoDate(o);
                if (!inscDate) {
                    if (filters.status !== 'Pendente') return false;
                } else {
                    const [y, m, d] = inscDate.split('-');
                    const deadLine = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
                    const diffDias = Math.ceil((deadLine - hoje) / (1000 * 60 * 60 * 24));

                    if (filters.status === 'Abertas' && diffDias < 0) return false;
                    if (filters.status === 'Urgentes' && (diffDias < 0 || diffDias > 14)) return false;
                    if (filters.status === 'Encerradas' && diffDias >= 0) return false;
                }
            }

            // Search query
            if (filters.searchQuery) {
                const q = filters.searchQuery.toLowerCase();
                const matchSigla = (o.sigla || '').toLowerCase().includes(q);
                const matchNome = (o.nome || '').toLowerCase().includes(q);
                const matchMaterias = (o.materias || []).some(m => m.toLowerCase().includes(q));
                const matchNiveis = (o.nivel_escolar || []).some(n => n.toLowerCase().includes(q));
                const matchModalidade = (o.modalidade || '').toLowerCase().includes(q);

                if (!matchSigla && !matchNome && !matchMaterias && !matchNiveis && !matchModalidade) {
                    return false;
                }
            }

            return true;
        }).sort((a, b) => {
            if (filters.ordem === 'nome') {
                return (a.sigla || '').localeCompare(b.sigla || '');
            }
            if (filters.ordem === 'materiais') {
                return (b.materiais_estudo || []).length - (a.materiais_estudo || []).length;
            }
            // Default: Prazo mais próximo
            const aDate = getInscricaoDate(a) || getEarliestEventDate(a) || '9999-99-99';
            const bDate = getInscricaoDate(b) || getEarliestEventDate(b) || '9999-99-99';
            return aDate.localeCompare(bDate);
        });
    }

    // ═══════════════════════════════════════════════════════
    // Discipline Themes & Olympic Prestige Helpers
    // ═══════════════════════════════════════════════════════
    const VAGAS_USP_SIGLAS = ['OBMEP', 'OBF', 'OBI', 'OBQ', 'OBB', 'OBA', 'OBM', 'ONC', 'OBR', 'IYPT', 'OBSP'];
    const CNPQ_BOLSA_SIGLAS = ['OBMEP', 'OBM', 'OBF', 'OBI', 'OBQ', 'OBB'];

    const isMobileViewport = () => window.matchMedia('(max-width: 768px)').matches;

    function getInitialViewMode() {
        const isMobile = isMobileViewport();
        const storageKey = isMobile ? 'calolimpico_view_mode_mobile' : 'calolimpico_view_mode_desktop';
        try {
            const saved = localStorage.getItem(storageKey);
            if (saved === 'cards' || saved === 'list') return saved;
            if (!isMobile) {
                const legacy = localStorage.getItem('calolimpico_view_mode');
                if (legacy === 'cards' || legacy === 'list') return legacy;
            }
        } catch (_) {}
        // Padrão: 'list' (compacto) para mobile; 'cards' (fichas) para desktop
        return isMobile ? 'list' : 'cards';
    }

    let viewMode = getInitialViewMode();

    function getDisciplineTheme(o) {
        const mats = (o.materias || []).map(m => m.toLowerCase());
        if (mats.some(m => m.includes('matemática'))) return { key: 'matematica', label: 'Matemática', icon: 'i-sub-math' };
        if (mats.some(m => m.includes('física'))) return { key: 'fisica', label: 'Física', icon: 'i-sub-physics' };
        if (mats.some(m => m.includes('astronomia') || m.includes('aeroespacial') || m.includes('astronáutica'))) return { key: 'astronomia', label: 'Astronomia', icon: 'i-sub-astronomy' };
        if (mats.some(m => m.includes('informática') || m.includes('robótica') || m.includes('inteligência artificial'))) return { key: 'informatica', label: 'Informática & IA', icon: 'i-sub-code' };
        if (mats.some(m => m.includes('química'))) return { key: 'quimica', label: 'Química', icon: 'i-sub-chem' };
        if (mats.some(m => m.includes('biologia') || m.includes('neurociência'))) return { key: 'biologia', label: 'Biologia', icon: 'i-sub-bio' };
        if (mats.some(m => m.includes('linguística') || m.includes('história'))) return { key: 'linguistica', label: 'Linguística', icon: 'i-sub-ling' };
        return { key: 'multi', label: 'Multidisciplinar', icon: 'i-sub-multi' };
    }

    // ═══════════════════════════════════════════════════════
    // Render Cards & Rows
    // ═══════════════════════════════════════════════════════
    function renderCards() {
        const filtered = getFilteredOlimpiadas();

        const hasActiveFilters = (
            filters.nivel !== 'Todas' ||
            filters.materia !== 'Todas' ||
            filters.modalidade !== 'Todas' ||
            filters.status !== 'Todos' ||
            Boolean(filters.searchQuery)
        );

        if (btnQuickReset) {
            btnQuickReset.hidden = !hasActiveFilters;
        }

        if (contagemEl) {
            const count = filtered.length;
            const plural = count !== 1;
            contagemEl.textContent = `${count} olimpíada${plural ? 's' : ''} ${filters.nivel === 'Favoritas' ? 'salva' + (plural ? 's' : '') : 'encontrada' + (plural ? 's' : '')}`;
        }

        if (filtered.length === 0) {
            const isSaved = filters.nivel === 'Favoritas' && favoritos.length === 0;
            listaEl.classList.remove('is-list-view');
            listaEl.innerHTML = isSaved ? `
                <div class="empty">
                    <h3>Nenhuma olimpíada salva ainda</h3>
                    <p>Toque na estrela de uma competição para guardá-la aqui e acompanhar os prazos dela.</p>
                    <button type="button" id="btn-reset-filters" class="btn btn--tinted">Ver todas as olimpíadas</button>
                </div>
            ` : `
                <div class="empty">
                    <h3>Nenhuma olimpíada encontrada</h3>
                    <p>Nenhuma competição corresponde a esses filtros. Tente outra busca ou limpe os filtros.</p>
                    <button type="button" id="btn-reset-filters" class="btn btn--tinted">Limpar filtros</button>
                </div>
            `;
            const resetBtn = document.getElementById('btn-reset-filters');
            if (resetBtn) resetBtn.addEventListener('click', resetAllFilters);
            return;
        }

        listaEl.classList.toggle('is-list-view', viewMode === 'list');
        listaEl.innerHTML = filtered.map((o, idx) => {
            return viewMode === 'list' ? createRowHtml(o, idx) : createCardHtml(o, idx);
        }).join('');

        // Favorite Toggle Buttons
        listaEl.querySelectorAll('.btn-fav-toggle').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const id = btn.dataset.id;
                const sigla = btn.dataset.sigla;
                toggleFavorite(id, sigla);
            });
        });

        // Quick View Sheet Triggers
        listaEl.querySelectorAll('.btn-quick-sheet').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const id = btn.dataset.id;
                openOlympicSheet(id, btn);
            });
        });

        // Clique em qualquer área da linha compacta (estilo iOS TableView)
        listaEl.querySelectorAll('.olympic-row').forEach(row => {
            row.addEventListener('click', (e) => {
                if (e.target.closest('.btn-fav-toggle') || e.target.closest('a') || e.target.closest('.btn-quick-sheet')) return;
                const id = row.dataset.id;
                if (id) openOlympicSheet(id, row);
            });
        });
    }

    function getStatusBadge(o) {
        const hoje = getToday();
        const inscDate = getInscricaoDate(o);
        if (!inscDate) {
            return `<span class="badge-tag badge-pending">Cronograma a publicar</span>`;
        }
        const diffDias = daysBetween(hoje, parseDate(inscDate));
        if (diffDias < 0) {
            return `<span class="badge-tag badge-expired">Inscrições encerradas</span>`;
        } else if (diffDias === 0) {
            return `<span class="badge-tag badge-urgent">Inscrições encerram hoje</span>`;
        } else if (diffDias <= 14) {
            return `<span class="badge-tag badge-urgent">Inscrições encerram em ${diffDias} dia${diffDias > 1 ? 's' : ''}</span>`;
        }
        return `<span class="badge-tag badge-active">Inscrições abertas até ${formatShortDate(inscDate)}</span>`;
    }

    function levelShort(n) {
        return ({
            'Ensino Fundamental I': 'EF I',
            'Ensino Fundamental II': 'EF II',
            'Ensino Médio': 'EM',
            'Livre': 'Livre'
        })[n] || n;
    }

    function createCardHtml(o, index) {
        const hoje = getToday();
        const isFav = favoritos.includes(o.id);
        const statusBadgeHtml = getStatusBadge(o);
        const theme = getDisciplineTheme(o);
        const isUsp = VAGAS_USP_SIGLAS.includes(o.sigla);
        const isCnpq = CNPQ_BOLSA_SIGLAS.includes(o.sigla);

        const upcoming = getSortedEvents(o).find(x => x.date >= hoje);
        let chipCountdownHtml = '';
        let nextHtml;
        if (upcoming) {
            const d = daysBetween(hoje, upcoming.date);
            const countText = d === 0 ? 'Hoje' : `${d}d`;
            chipCountdownHtml = `<div class="card__countdown-chip" title="${eventLabel(upcoming.ev)}">⏳ <b>${countText}</b></div>`;
            nextHtml = `<p class="card__next"><time datetime="${getEventReferenceDate(upcoming.ev)}">${formatShortDate(getEventReferenceDate(upcoming.ev))}</time>${eventLabel(upcoming.ev)}</p>`;
        } else {
            const hasEvents = getSortedEvents(o).length > 0;
            chipCountdownHtml = `<div class="card__countdown-chip">🏁 <b>Fim</b></div>`;
            nextHtml = `<p class="card__next">${hasEvents ? 'Temporada 2026 concluída.' : 'Aguardando cronograma oficial.'}</p>`;
        }

        const levels = (o.nivel_escolar || []).map(levelShort).join(' · ');
        const matCount = (o.materiais_estudo || []).length;

        return `
            <article class="olympic-card theme-${theme.key}${upcoming ? '' : ' is-past'}" data-id="${o.id}" style="--i:${Math.min(index, 16)}">
                <div class="card__top">
                    <div class="card__discipline-badge">
                        <svg class="icon icon--sm" aria-hidden="true"><use href="#${theme.icon}"/></svg>
                        <span>${theme.label}</span>
                    </div>
                    <div class="card__top-actions">
                        ${isUsp ? `<span class="badge-perk badge-perk--usp" title="Vagas Olímpicas sem vestibular na USP, Unicamp e Unesp"><svg class="icon icon--sm" aria-hidden="true"><use href="#i-trophy"/></svg> Vaga USP</span>` : ''}
                        ${isCnpq ? `<span class="badge-perk badge-perk--cnpq" title="Bolsa de Iniciação Científica Júnior CNPq"><svg class="icon icon--sm" aria-hidden="true"><use href="#i-microscope"/></svg> CNPq</span>` : ''}
                        <button type="button" class="btn-fav-toggle ${isFav ? 'favorited' : ''}" data-id="${o.id}" data-sigla="${o.sigla}"
                            aria-pressed="${isFav}" aria-label="${isFav ? 'Remover dos favoritos' : 'Salvar'} ${o.sigla}">
                            <svg class="icon" aria-hidden="true"><use href="#${isFav ? 'i-star-fill' : 'i-star'}"/></svg>
                        </button>
                    </div>
                </div>
                <div class="card__header">
                    <h3 class="card__symbol">
                        <button type="button" class="card__open btn-quick-sheet" data-id="${o.id}" aria-label="${o.sigla} — ${o.nome}. Ver detalhes">${o.sigla}</button>
                    </h3>
                    ${chipCountdownHtml}
                </div>
                <p class="card__name">${o.nome}</p>
                ${stripHtml(o)}
                ${nextHtml}
                <div class="card__meta">
                    ${levels ? `<span class="tag">${levels}</span>` : ''}
                    <span class="tag tag--mode">${o.modalidade || 'Nacional'}</span>
                    ${matCount > 0 ? `<a href="provas.html?q=${encodeURIComponent(o.sigla)}" class="tag tag--action" title="Ver ${matCount} materiais de estudo e provas">📚 ${matCount} materiais</a>` : ''}
                </div>
                <div class="card__status">
                    ${statusBadgeHtml}
                    <button type="button" class="btn-card-more btn-quick-sheet" data-id="${o.id}" aria-label="Ver ficha completa de ${o.sigla}">Ficha Completa →</button>
                </div>
            </article>
        `;
    }

    function createRowHtml(o, index) {
        const hoje = getToday();
        const isFav = favoritos.includes(o.id);
        const theme = getDisciplineTheme(o);
        const isUsp = VAGAS_USP_SIGLAS.includes(o.sigla);
        const statusBadgeHtml = getStatusBadge(o);

        const upcoming = getSortedEvents(o).find(x => x.date >= hoje);
        const nextDateShort = upcoming ? formatShortDate(getEventReferenceDate(upcoming.ev)) : '—';
        const nextDesc = upcoming ? eventLabel(upcoming.ev) : 'Concluída';

        return `
            <article class="olympic-row theme-${theme.key}${upcoming ? '' : ' is-past'}" data-id="${o.id}" style="--i:${Math.min(index, 20)}">
                <div class="row__left">
                    <div class="row__icon" aria-hidden="true">
                        <svg class="icon" aria-hidden="true"><use href="#${theme.icon}"/></svg>
                    </div>
                    <div class="row__info">
                        <div class="row__sigla-line">
                            <button type="button" class="row__sigla btn-quick-sheet" data-id="${o.id}">${o.sigla}</button>
                            <span class="row__discipline">${theme.label}</span>
                            ${isUsp ? `<span class="badge-perk badge-perk--usp badge-perk--mini" title="Vaga Olímpica sem vestibular">🏆 Vaga</span>` : ''}
                        </div>
                        <p class="row__name">${o.nome}</p>
                    </div>
                </div>

                <div class="row__center">
                    <div class="row__next-date">
                        <span class="row__date-val">${nextDateShort}</span>
                        <span class="row__date-desc">${nextDesc}</span>
                    </div>
                    <div class="row__status-badge">
                        ${statusBadgeHtml}
                    </div>
                </div>

                <div class="row__right">
                    <button type="button" class="btn-fav-toggle ${isFav ? 'favorited' : ''}" data-id="${o.id}" data-sigla="${o.sigla}"
                        aria-pressed="${isFav}" aria-label="${isFav ? 'Remover' : 'Salvar'} ${o.sigla}">
                        <svg class="icon" aria-hidden="true"><use href="#${isFav ? 'i-star-fill' : 'i-star'}"/></svg>
                    </button>
                    <button type="button" class="row__open-btn btn-quick-sheet" data-id="${o.id}" aria-label="Abrir detalhes de ${o.sigla}">
                        <svg class="icon icon--sm" aria-hidden="true"><use href="#i-chevron"/></svg>
                    </button>
                </div>
            </article>
        `;
    }

    // ═══════════════════════════════════════════════════════
    // Apple Quick View Sheet Modal Logic
    // ═══════════════════════════════════════════════════════
    let sheetReturnFocus = null;

    function setSheetFavLabel(isFav) {
        if (!sheetFavBtn) return;
        sheetFavBtn.innerHTML = `<svg class="icon" aria-hidden="true"><use href="#${isFav ? 'i-star-fill' : 'i-star'}"/></svg>${isFav ? 'Salva' : 'Salvar'}`;
        sheetFavBtn.setAttribute('aria-pressed', String(isFav));
    }

    function openOlympicSheet(id, trigger) {
        const o = olimpiadas.find(item => item.id === id);
        if (!o || !sheetModal || !sheetBody) return;

        currentSheetOlimpiadaId = id;
        sheetReturnFocus = trigger || document.activeElement;
        const isFav = favoritos.includes(o.id);
        const hoje = getToday();

        if (sheetTitle) {
            sheetTitle.textContent = `Edição 2026`;
        }

        const levels = (o.nivel_escolar || []).join(', ') || 'Não especificado';
        const subjects = (o.materias || []).join(', ') || 'Geral';

        // Timeline
        const events = getSortedEvents(o);
        const nextIdx = events.findIndex(x => x.date >= hoje);
        let eventsHtml = '<p class="detail__desc">Nenhum cronograma oficial publicado até o momento.</p>';
        if (events.length > 0) {
            eventsHtml = '<ol class="group timeline">' + events.map(({ ev, date }, i) => {
                const t = yearFraction(date);
                const past = date < hoje;
                const range = ev['data-i'] && ev['data-f']
                    ? `<small>${formatShortDate(ev['data-i'])} – ${formatShortDate(ev['data-f'])}</small>` : '';
                return `<li class="${past ? 'is-past' : ''}" style="--c:${spectrumColor(t)}">
                    <span class="timeline__dot" aria-hidden="true"></span>
                    <span class="timeline__text">
                        <span>${ev.tipo === 'Inscrição' ? (ev.descricao || 'Inscrições') : (ev.descricao || ev.tipo)}</span>
                        ${range}
                        ${i === nextIdx ? '<span class="timeline__next">Próxima data</span>' : ''}
                    </span>
                    <time datetime="${getEventReferenceDate(ev)}">${formatShortDate(getEventReferenceDate(ev))}</time>
                </li>`;
            }).join('') + '</ol>';
        }

        // Study materials
        let materialsHtml = '<p class="detail__desc">Nenhum material listado diretamente.</p>';
        if (Array.isArray(o.materiais_estudo) && o.materiais_estudo.length > 0) {
            materialsHtml = '<ul class="group links">' + o.materiais_estudo.map(mat => `
                <li><a href="${mat.url}" target="_blank" rel="noopener noreferrer"><span>${mat.titulo}</span><svg class="icon icon--sm" aria-hidden="true"><use href="#i-arrow-up-right"/></svg></a></li>
            `).join('') + '</ul>';
        }

        sheetBody.innerHTML = `
            <div class="detail__hero">
                <p class="detail__symbol">${o.sigla}</p>
                <p class="detail__name">${o.nome}</p>
                ${o.descricao ? `<p class="detail__desc">${o.descricao}</p>` : ''}
            </div>
            ${stripHtml(o, 'detail__strip')}
            <div>${getStatusBadge(o)}</div>

            <h3 class="group-title">Informações</h3>
            <ul class="group">
                <li><strong>Modalidade</strong><span>${o.modalidade || 'Nacional'}</span></li>
                <li><strong>Etapas</strong><span>${levels}</span></li>
                <li><strong>Áreas</strong><span>${subjects}</span></li>
            </ul>

            <h3 class="group-title">Cronograma oficial</h3>
            ${eventsHtml}

            <h3 class="group-title">Provas e materiais de estudo</h3>
            ${materialsHtml}

            ${o.site_oficial ? `
                <p style="margin-top:1rem"><a href="${o.site_oficial}" target="_blank" rel="noopener noreferrer">Site oficial da ${o.sigla}</a></p>
            ` : ''}
        `;

        setSheetFavLabel(isFav);
        if (sheetFavBtn) {
            sheetFavBtn.onclick = () => {
                toggleFavorite(o.id, o.sigla);
            };
        }

        if (sheetCatalogBtn) {
            sheetCatalogBtn.href = `provas.html?id=${o.id}`;
        }

        sheetModal.hidden = false;
        document.body.style.overflow = 'hidden';
        sheetBody.scrollTop = 0;
        if (sheetCloseBtn) sheetCloseBtn.focus({ preventScroll: true });
    }

    function closeOlympicSheet() {
        if (sheetModal) sheetModal.hidden = true;
        document.body.style.overflow = '';
        currentSheetOlimpiadaId = null;
        if (sheetReturnFocus && document.contains(sheetReturnFocus)) {
            sheetReturnFocus.focus({ preventScroll: true });
        } else {
            const card = listaEl.querySelector('.card__open');
            if (card) card.focus({ preventScroll: true });
        }
        sheetReturnFocus = null;
    }

    function resetAllFilters() {
        filters.nivel = 'Todas';
        filters.materia = 'Todas';
        filters.modalidade = 'Todas';
        filters.status = 'Todos';
        filters.ordem = 'prazo';
        filters.searchQuery = '';

        if (searchBar) searchBar.value = '';
        if (selectMateria) selectMateria.value = 'Todas';
        if (selectModalidade) selectModalidade.value = 'Todas';
        if (selectStatus) selectStatus.value = 'Todos';
        if (selectOrdem) selectOrdem.value = 'prazo';

        if (nivelPillsContainer) {
            nivelPillsContainer.querySelectorAll('.filter-pill-btn').forEach(btn => {
                const isActive = btn.dataset.filtro === 'Todas';
                btn.classList.toggle('active', isActive);
                btn.setAttribute('aria-pressed', String(isActive));
            });
        }

        const subjectBar = document.querySelector('.subject-bar');
        if (subjectBar) {
            subjectBar.querySelectorAll('.subject-chip').forEach(c => {
                const isActive = c.dataset.materia === 'Todas';
                c.classList.toggle('active', isActive);
            });
        }

        renderCards();
    }

    // ═══════════════════════════════════════════════════════
    // Event Listeners Setup
    // ═══════════════════════════════════════════════════════
    function setupFilterListeners() {
        // View Mode Switcher (Cards vs Compact List)
        const btnViewCards = document.getElementById('btn-view-cards');
        const btnViewList = document.getElementById('btn-view-list');

        function updateViewSwitcherUI(mode) {
            if (btnViewCards) {
                const isActive = mode === 'cards';
                btnViewCards.classList.toggle('active', isActive);
                btnViewCards.setAttribute('aria-pressed', String(isActive));
            }
            if (btnViewList) {
                const isActive = mode === 'list';
                btnViewList.classList.toggle('active', isActive);
                btnViewList.setAttribute('aria-pressed', String(isActive));
            }
        }

        function setViewMode(mode, savePreference = true) {
            viewMode = mode;
            if (savePreference) {
                const isMobile = isMobileViewport();
                const storageKey = isMobile ? 'calolimpico_view_mode_mobile' : 'calolimpico_view_mode_desktop';
                try {
                    localStorage.setItem(storageKey, mode);
                    if (!isMobile) {
                        localStorage.setItem('calolimpico_view_mode', mode);
                    }
                } catch (_) {}
            }
            updateViewSwitcherUI(mode);
            renderCards();
        }

        updateViewSwitcherUI(viewMode);

        if (btnViewCards) btnViewCards.addEventListener('click', () => setViewMode('cards'));
        if (btnViewList) btnViewList.addEventListener('click', () => setViewMode('list'));

        // Transição suave ao alternar viewport (redimensionamento ou rotação da tela)
        const mobileMediaQuery = window.matchMedia('(max-width: 768px)');
        if (mobileMediaQuery.addEventListener) {
            mobileMediaQuery.addEventListener('change', () => {
                const newMode = getInitialViewMode();
                if (newMode !== viewMode) {
                    setViewMode(newMode, false);
                }
            });
        }

        // Subject Chips Quick Filter
        const subjectBar = document.querySelector('.subject-bar');
        if (subjectBar) {
            subjectBar.addEventListener('click', (e) => {
                const chip = e.target.closest('.subject-chip');
                if (!chip) return;
                const mat = chip.dataset.materia;
                filters.materia = mat;

                if (selectMateria) {
                    let matched = false;
                    for (let i = 0; i < selectMateria.options.length; i++) {
                        if (mat === 'Todas' && selectMateria.options[i].value === 'Todas') {
                            selectMateria.selectedIndex = i;
                            matched = true;
                            break;
                        } else if (mat !== 'Todas' && selectMateria.options[i].value.toLowerCase().includes(mat.toLowerCase())) {
                            selectMateria.selectedIndex = i;
                            matched = true;
                            break;
                        }
                    }
                    if (!matched) selectMateria.value = 'Todas';
                }

                subjectBar.querySelectorAll('.subject-chip').forEach(c => {
                    c.classList.toggle('active', c === chip);
                });

                renderCards();
            });
        }

        let searchTimeout = null;
        if (searchBar) {
            searchBar.addEventListener('input', (e) => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    filters.searchQuery = e.target.value.trim();
                    renderCards();
                }, 150);
            });
        }

        if (nivelPillsContainer) {
            nivelPillsContainer.addEventListener('click', (e) => {
                const btn = e.target.closest('.filter-pill-btn');
                if (!btn) return;
                filters.nivel = btn.dataset.filtro;

                nivelPillsContainer.querySelectorAll('.filter-pill-btn').forEach(b => {
                    const isActive = b === btn;
                    b.classList.toggle('active', isActive);
                    b.setAttribute('aria-pressed', String(isActive));
                });

                renderCards();
            });
        }

        if (selectMateria) {
            selectMateria.addEventListener('change', (e) => {
                filters.materia = e.target.value;
                if (subjectBar) {
                    subjectBar.querySelectorAll('.subject-chip').forEach(c => {
                        const cMat = c.dataset.materia;
                        const isMatch = (cMat === 'Todas' && filters.materia === 'Todas') ||
                            (filters.materia !== 'Todas' && cMat !== 'Todas' && filters.materia.toLowerCase().includes(cMat.toLowerCase()));
                        c.classList.toggle('active', isMatch);
                    });
                }
                renderCards();
            });
        }

        if (selectModalidade) {
            selectModalidade.addEventListener('change', (e) => {
                filters.modalidade = e.target.value;
                renderCards();
            });
        }

        if (selectStatus) {
            selectStatus.addEventListener('change', (e) => {
                filters.status = e.target.value;
                renderCards();
            });
        }

        if (selectOrdem) {
            selectOrdem.addEventListener('change', (e) => {
                filters.ordem = e.target.value;
                renderCards();
            });
        }

        if (btnQuickReset) {
            btnQuickReset.addEventListener('click', resetAllFilters);
        }

        if (btnShowSaved) {
            btnShowSaved.addEventListener('click', () => {
                const favPill = document.getElementById('filter-saved-pill');
                if (favPill) {
                    favPill.click();
                    const section = document.getElementById('provas-section');
                    if (section) section.scrollIntoView({ behavior: 'smooth' });
                }
            });
        }

        if (btnNextCuriosity) {
            btnNextCuriosity.addEventListener('click', getNextCuriosity);
        }

        // Sheet close listeners
        if (sheetCloseBtn) {
            sheetCloseBtn.addEventListener('click', closeOlympicSheet);
        }
        if (sheetModal) {
            sheetModal.addEventListener('click', (e) => {
                if (e.target === sheetModal) closeOlympicSheet();
            });
        }

        // Keyboard Shortcut: / to focus search, Escape to close sheet or clear search
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (sheetModal && !sheetModal.hidden) {
                    closeOlympicSheet();
                    return;
                }
                if (searchBar && searchBar === document.activeElement) {
                    searchBar.value = '';
                    filters.searchQuery = '';
                    searchBar.blur();
                    renderCards();
                }
            } else if (e.key === '/' && document.activeElement !== searchBar && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
                e.preventDefault();
                if (searchBar) {
                    searchBar.focus();
                    searchBar.select();
                }
            }
        });
    }

    // ═══════════════════════════════════════════════════════
    // Mobile Navigation Drawer
    // ═══════════════════════════════════════════════════════
    function setupMobileMenu() {
        if (!mobileMenuBtn || !mobileMenu) return;

        mobileMenuBtn.addEventListener('click', () => {
            const isHidden = mobileMenu.hidden;
            mobileMenu.hidden = !isHidden;
            mobileMenuBtn.setAttribute('aria-expanded', String(isHidden));
        });

        mobileMenu.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                mobileMenu.hidden = true;
                mobileMenuBtn.setAttribute('aria-expanded', 'false');
            });
        });
    }

    // ═══════════════════════════════════════════════════════
    // Modals (Dev Warning & GPL License)
    // ═══════════════════════════════════════════════════════
    function setupModals() {
        // Dev Warning Modal
        const devModal = document.getElementById('dev-warning-modal');
        const devCloseBtn = document.getElementById('dev-warning-close-btn');
        const devConfirmBtn = document.getElementById('dev-warning-confirm-btn');

        if (devModal && devCloseBtn) {
            let loads = parseInt(localStorage.getItem(STORAGE_PAGE_LOADS) || '0', 10);
            loads++;
            try { localStorage.setItem(STORAGE_PAGE_LOADS, loads.toString()); } catch (_) {}

            if (loads === 1 || (loads - 1) % 5 === 0) {
                devModal.hidden = false;
            }

            const closeDevModal = () => { devModal.hidden = true; };
            devCloseBtn.addEventListener('click', closeDevModal);
            if (devConfirmBtn) devConfirmBtn.addEventListener('click', closeDevModal);

            devModal.addEventListener('click', (e) => {
                if (e.target === devModal) closeDevModal();
            });
        }

        // License Modal
        const licModal = document.getElementById('license-modal');
        const licBtn = document.getElementById('license-btn');
        const licCloseBtn = document.getElementById('license-close-btn');
        const licOkBtn = document.getElementById('license-ok-btn');

        if (licModal && licBtn) {
            const openLic = () => { licModal.hidden = false; };
            const closeLic = () => { licModal.hidden = true; };

            licBtn.addEventListener('click', openLic);
            if (licCloseBtn) licCloseBtn.addEventListener('click', closeLic);
            if (licOkBtn) licOkBtn.addEventListener('click', closeLic);

            licModal.addEventListener('click', (e) => {
                if (e.target === licModal) closeLic();
            });
        }

        // ESC Key handler for modals
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (devModal && !devModal.hidden) devModal.hidden = true;
                if (licModal && !licModal.hidden) licModal.hidden = true;
            }
        });
    }

    // ═══════════════════════════════════════════════════════
    // Navbar Scroll Transition
    // ═══════════════════════════════════════════════════════
    function setupNavbarScroll() {
        const navbar = document.getElementById('navbar');
        if (!navbar) return;
        window.addEventListener('scroll', () => {
            if (window.scrollY > 20) {
                navbar.classList.add('scrolled');
            } else {
                navbar.classList.remove('scrolled');
            }
        }, { passive: true });
    }

    // ═══════════════════════════════════════════════════════
    // Boot
    // ═══════════════════════════════════════════════════════
    function setupRefinePanel() {
        const details = document.getElementById('more-filters');
        if (!details) return;
        const mq = window.matchMedia('(min-width: 1024px)');
        details.open = mq.matches;
        mq.addEventListener('change', (e) => { details.open = e.matches; });
    }

    function init() {
        setupRefinePanel();
        setupNavbarScroll();
        setupMobileMenu();
        loadFavorites();
        setupFilterListeners();
        setupModals();
        getNextCuriosity();
        fetchOlimpiadas();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
