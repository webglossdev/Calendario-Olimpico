// ═══════════════════════════════════════════════════════════════
// Calendário Olímpico — provas.js (Directory & Study Library)
// Cross-filtering, search, deep-linking, accordion expansion,
// and study materials catalogue with copy link support.
// ═══════════════════════════════════════════════════════════════

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
    const searchInput = document.getElementById('provas-search');
    const contagemEl = document.getElementById('contagem-provas');
    const btnResetProvas = document.getElementById('btn-reset-provas');
    const btnExpandAll = document.getElementById('btn-expand-all');
    const btnCollapseAll = document.getElementById('btn-collapse-all');
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const mobileMenu = document.getElementById('mobile-menu');
    const toastContainer = document.getElementById('toast-container');

    const MESES = [
        'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];

    // ═══════════════════════════════════════════════════════
    // Helpers
    // ═══════════════════════════════════════════════════════
    function getEventReferenceDate(ev) {
        return ev?.data || ev?.['data-f'] || ev?.['data-i'] || '';
    }

    function getInscricaoDate(o) {
        const insc = (o.eventos || []).find(ev => ev.tipo === 'Inscrição');
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
            return new Date(parseInt(y), parseInt(m) - 1, parseInt(d)).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
        } catch (_) {
            return dateStr;
        }
    }

    function showToast(message, type = 'info') {
        if (!toastContainer) return;
        const toast = document.createElement('div');
        toast.className = 'toast-message';
        toast.innerHTML = `<p>[${type.toUpperCase()}] ${message}</p>`;
        toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.remove();
        }, 3000);
    }

    // ═══════════════════════════════════════════════════════
    // Populate Dynamic Filters
    // ═══════════════════════════════════════════════════════
    function populateFilters() {
        // Matérias
        const materias = new Set();
        olimpiadas.forEach(o => (o.materias || []).forEach(m => materias.add(m)));
        [...materias].sort().forEach(m => {
            const opt = document.createElement('option');
            opt.value = m;
            opt.textContent = m;
            filtroMateria.appendChild(opt);
        });

        // Meses
        const meses = new Set();
        olimpiadas.forEach(o => {
            (o.eventos || []).forEach(ev => {
                const dataRef = getEventReferenceDate(ev);
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

    // ═══════════════════════════════════════════════════════
    // Filter Logic
    // ═══════════════════════════════════════════════════════
    function getFiltered() {
        const serie = filtroSerie ? filtroSerie.value : 'Todas';
        const materia = filtroMateria ? filtroMateria.value : 'Todas';
        const mes = filtroMes ? filtroMes.value : 'Todos';
        const modalidade = filtroModalidade ? filtroModalidade.value : 'Todas';
        const query = searchInput ? searchInput.value.trim().toLowerCase() : '';

        return olimpiadas.filter(o => {
            if (serie !== 'Todas' && !(o.nivel_escolar || []).includes(serie)) return false;
            if (materia !== 'Todas' && !(o.materias || []).includes(materia)) return false;
            if (modalidade !== 'Todas' && o.modalidade !== modalidade) return false;

            if (mes !== 'Todos') {
                const mesNum = parseInt(mes, 10);
                const hasMonth = (o.eventos || []).some(ev => {
                    const d = getEventReferenceDate(ev);
                    return d && parseInt(d.split('-')[1], 10) === mesNum;
                });
                if (!hasMonth) return false;
            }

            if (query) {
                const matchSigla = (o.sigla || '').toLowerCase().includes(query);
                const matchNome = (o.nome || '').toLowerCase().includes(query);
                const matchDesc = (o.descricao || '').toLowerCase().includes(query);
                const matchMat = (o.materias || []).some(m => m.toLowerCase().includes(query));
                const matchNiv = (o.nivel_escolar || []).some(n => n.toLowerCase().includes(query));
                if (!matchSigla && !matchNome && !matchDesc && !matchMat && !matchNiv) {
                    return false;
                }
            }

            return true;
        }).sort((a, b) => {
            const aDate = getInscricaoDate(a) || getEarliestEventDate(a) || '9999-99-99';
            const bDate = getInscricaoDate(b) || getEarliestEventDate(b) || '9999-99-99';
            return aDate.localeCompare(bDate);
        });
    }

    // ═══════════════════════════════════════════════════════
    // Render Accordions
    // ═══════════════════════════════════════════════════════
    function renderAccordions() {
        const filtered = getFiltered();

        const isFiltered = (filtroSerie && filtroSerie.value !== 'Todas') ||
                           (filtroMateria && filtroMateria.value !== 'Todas') ||
                           (filtroMes && filtroMes.value !== 'Todos') ||
                           (filtroModalidade && filtroModalidade.value !== 'Todas') ||
                           (searchInput && searchInput.value.trim() !== '');

        if (btnResetProvas) {
            btnResetProvas.hidden = !isFiltered;
        }

        if (contagemEl) {
            const count = filtered.length;
            contagemEl.textContent = `Exibindo ${count} olimpíada${count !== 1 ? 's' : ''} catalogada${count !== 1 ? 's' : ''}`;
        }

        if (filtered.length === 0) {
            listaEl.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state__icon">
                        <svg class="icon icon--lg" aria-hidden="true"><use href="#i-search"/></svg>
                    </div>
                    <h3>Nenhuma ficha encontrada</h3>
                    <p>Tente alterar ou limpar os filtros de série, matéria, mês ou termo de busca.</p>
                    <button type="button" id="btn-empty-reset-provas" class="btn btn--tinted" style="margin-top: 1rem;">Limpar Filtros</button>
                </div>
            `;

            const emptyResetBtn = document.getElementById('btn-empty-reset-provas');
            if (emptyResetBtn) {
                emptyResetBtn.addEventListener('click', resetAllProvasFilters);
            }
            return;
        }

        listaEl.innerHTML = filtered.map((o, i) => createAccordionHtml(o, i)).join('');

        // Attach copy link listeners
        listaEl.querySelectorAll('.btn-copy-link').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                const sigla = btn.dataset.sigla;
                const url = `${window.location.origin}${window.location.pathname}?id=${id}`;
                navigator.clipboard.writeText(url).then(() => {
                    showToast(`Link direto da ${sigla} copiado para a área de transferência!`, 'success');
                }).catch(() => {
                    showToast(`URL: ${url}`, 'info');
                });
            });
        });
    }

    function resetAllProvasFilters() {
        if (filtroSerie) filtroSerie.value = 'Todas';
        if (filtroMateria) filtroMateria.value = 'Todas';
        if (filtroMes) filtroMes.value = 'Todos';
        if (filtroModalidade) filtroModalidade.value = 'Todas';
        if (searchInput) searchInput.value = '';
        if (btnResetProvas) btnResetProvas.hidden = true;
        renderAccordions();
    }

    function createAccordionHtml(o, index) {
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);

        const inscDate = getInscricaoDate(o);
        let statusBadge = '';
        let statusClass = '';
        if (inscDate) {
            const [y, m, d] = inscDate.split('-');
            const deadLine = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
            const diff = Math.ceil((deadLine - hoje) / (1000 * 60 * 60 * 24));
            if (diff < 0) {
                statusBadge = 'Inscrições encerradas';
                statusClass = 'badge-status--closed';
            } else if (diff <= 14) {
                statusBadge = diff === 0 ? 'Último dia de inscrição!' : `${diff} dias restantes`;
                statusClass = 'badge-status--urgent';
            } else {
                statusBadge = `Inscrições abertas (${diff}d)`;
                statusClass = 'badge-status--open';
            }
        } else {
            statusBadge = 'Cronograma pendente';
            statusClass = 'badge-status--pending';
        }

        // Levels & Matérias badges
        const levelsBadges = (o.nivel_escolar || []).map(n => `<span class="badge-tag">${n}</span>`).join('');
        const materiasBadges = (o.materias || []).map(m => `<span class="badge-tag">${m}</span>`).join('');

        // Events list
        const eventosHtml = (o.eventos || []).length > 0
            ? `<ul class="provas-eventos-list">` + (o.eventos || []).map(ev => {
                const ref = getEventReferenceDate(ev);
                let dateStr = '';
                if (ev['data-i'] && ev['data-f']) {
                    dateStr = `${formatDate(ev['data-i'])} a ${formatDate(ev['data-f'])}`;
                } else if (ref) {
                    dateStr = formatDate(ref);
                } else {
                    dateStr = 'A definir';
                }

                return `
                    <li>
                        <div>
                            <strong>${ev.tipo}:</strong> <span>${ev.descricao}</span>
                        </div>
                        <time>${dateStr}</time>
                    </li>
                `;
            }).join('') + `</ul>`
            : '<p>Cronograma oficial detalhado a ser publicado pela comissão organizadora.</p>';

        // Study materials
        const materiais = o.materiais_estudo || [];
        const materiaisHtml = materiais.length > 0
            ? `<ul class="provas-materiais-list">` + materiais.map(mat => `
                <li>
                    <a href="${mat.url}" target="_blank" rel="noopener noreferrer">
                        <span>${mat.titulo}</span>
                        <svg class="icon icon--sm" aria-hidden="true"><use href="#i-arrow-up-right"/></svg>
                    </a>
                </li>
            `).join('') + `</ul>`
            : '<p>Consulte o portal oficial da competição para guias de provas e ementas.</p>';

        return `
            <details id="prova-${o.id}" class="provas-card">
                <summary>
                    <div class="provas-summary__header">
                        <span class="provas-summary__sigla">${o.sigla}</span>
                        <span class="badge-modality">${o.modalidade}</span>
                        <span class="badge-status ${statusClass}">${statusBadge}</span>
                    </div>
                    <p class="provas-summary__name">${o.nome}</p>
                    <div class="provas-summary__tags">
                        ${levelsBadges}
                        ${materiasBadges}
                    </div>
                </summary>

                <div class="provas-card__body">
                    ${o.descricao ? `<p>${o.descricao}</p>` : ''}

                    <div>
                        <h4 class="provas-section-title">
                            <svg class="icon icon--sm" aria-hidden="true"><use href="#i-calendar"/></svg>
                            Cronograma de Inscrições & Fases
                        </h4>
                        ${eventosHtml}
                    </div>

                    <div>
                        <h4 class="provas-section-title">
                            <svg class="icon icon--sm" aria-hidden="true"><use href="#i-star"/></svg>
                            Materiais de Estudo & Bancos de Provas
                        </h4>
                        ${materiaisHtml}
                    </div>

                    <div class="provas-card__actions">
                        ${o.site_oficial ? `
                        <a class="btn btn--tinted" href="${o.site_oficial}" target="_blank" rel="noopener noreferrer">
                            Portal Oficial
                            <svg class="icon icon--sm" aria-hidden="true"><use href="#i-arrow-up-right"/></svg>
                        </a>` : ''}
                        <a class="btn btn--tinted" href="calendario.html">
                            <svg class="icon icon--sm" aria-hidden="true"><use href="#i-calendar"/></svg>
                            Ver na Linha do Tempo
                        </a>
                        <button type="button" class="btn-copy-link" data-id="${o.id}" data-sigla="${o.sigla}">
                            <svg class="icon icon--sm" aria-hidden="true"><use href="#i-link"/></svg>
                            Copiar Link Direto
                        </button>
                    </div>
                </div>
            </details>
        `;
    }

    // ═══════════════════════════════════════════════════════
    // Deep Linking (?id=...)
    // ═══════════════════════════════════════════════════════
    function handleDeepLink() {
        const params = new URLSearchParams(window.location.search);
        const targetId = params.get('id');
        if (!targetId) return;

        const el = document.getElementById('prova-' + targetId);
        if (!el) return;

        el.setAttribute('open', '');
        setTimeout(() => {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 300);
    }

    // ═══════════════════════════════════════════════════════
    // Mobile Nav & Modals
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

    function setupLicenseModal() {
        const modal = document.getElementById('license-modal');
        const openBtn = document.getElementById('license-btn');
        const closeBtn = document.getElementById('license-close-btn');
        const okBtn = document.getElementById('license-ok-btn');

        if (!modal || !openBtn) return;

        const open = () => { modal.hidden = false; };
        const close = () => { modal.hidden = true; };

        openBtn.addEventListener('click', open);
        if (closeBtn) closeBtn.addEventListener('click', close);
        if (okBtn) okBtn.addEventListener('click', close);

        modal.addEventListener('click', (e) => {
            if (e.target === modal) close();
        });

        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !modal.hidden) close();
        });
    }

    // ═══════════════════════════════════════════════════════
    // Init
    // ═══════════════════════════════════════════════════════
    async function init() {
        setupMobileMenu();
        setupLicenseModal();

        try {
            if (window.OLIMPIADAS_DATA && Array.isArray(window.OLIMPIADAS_DATA) && window.OLIMPIADAS_DATA.length > 0) {
                olimpiadas = JSON.parse(JSON.stringify(window.OLIMPIADAS_DATA));
            } else {
                const res = await fetch('./dados.json');
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                olimpiadas = await res.json();
            }

            populateFilters();
            renderAccordions();

            // Filter listeners
            if (filtroSerie) filtroSerie.addEventListener('change', renderAccordions);
            if (filtroMateria) filtroMateria.addEventListener('change', renderAccordions);
            if (filtroMes) filtroMes.addEventListener('change', renderAccordions);
            if (filtroModalidade) filtroModalidade.addEventListener('change', renderAccordions);

            if (searchInput) {
                let timeout = null;
                searchInput.addEventListener('input', () => {
                    clearTimeout(timeout);
                    timeout = setTimeout(renderAccordions, 150);
                });
            }

            if (btnResetProvas) {
                btnResetProvas.addEventListener('click', resetAllProvasFilters);
            }

            if (btnExpandAll) {
                btnExpandAll.addEventListener('click', () => {
                    listaEl.querySelectorAll('details').forEach(d => d.setAttribute('open', ''));
                });
            }

            if (btnCollapseAll) {
                btnCollapseAll.addEventListener('click', () => {
                    listaEl.querySelectorAll('details').forEach(d => d.removeAttribute('open'));
                });
            }

            handleDeepLink();

        } catch (err) {
            listaEl.innerHTML = `
                <div>
                    <h3>Falha ao carregar catálogo</h3>
                    <p>${err.message}</p>
                </div>
            `;
            console.error(err);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
