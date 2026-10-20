// ═══════════════════════════════════════════════════════════════
// Calendário Olímpico — calendario.js (Timeline Page)
// Flatten events, chronological sorting, month grouping,
// cross-filters, countdowns, and .ics calendar generation.
// ═══════════════════════════════════════════════════════════════

(function () {
    'use strict';

    // ─── State ───────────────────────────────────────────
    let allEventos = [];
    let olimpiadas = [];

    // ─── DOM References ──────────────────────────────────
    const timelineEl = document.getElementById('timeline-container');
    const filtroSerie = document.getElementById('filtro-serie');
    const filtroMateria = document.getElementById('filtro-materia');
    const filtroTipo = document.getElementById('filtro-tipo');
    const filtroTempo = document.getElementById('filtro-tempo');
    const timelineSearch = document.getElementById('timeline-search');
    const contagemEl = document.getElementById('contagem-eventos');
    const btnResetFilters = document.getElementById('btn-reset-filters');
    const btnExportAllIcs = document.getElementById('btn-export-all-ics');
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const mobileMenu = document.getElementById('mobile-menu');
    const toastContainer = document.getElementById('toast-container');

    // ═══════════════════════════════════════════════════════
    // Helpers
    // ═══════════════════════════════════════════════════════
    function getEventReferenceDate(ev) {
        return ev?.data || ev?.['data-f'] || ev?.['data-i'] || '';
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

    function flattenEventos(data) {
        const flat = [];
        data.forEach(o => {
            (o.eventos || []).forEach(ev => {
                const mainDate = getEventReferenceDate(ev);
                if (!mainDate) return;
                flat.push({
                    data: mainDate,
                    data_i: ev['data-i'],
                    data_f: ev['data-f'],
                    descricao: ev.descricao,
                    tipo: ev.tipo || 'Evento',
                    sigla: o.sigla,
                    nome: o.nome,
                    id: o.id,
                    nivel_escolar: o.nivel_escolar || [],
                    materias: o.materias || [],
                    modalidade: o.modalidade,
                    site_oficial: o.site_oficial
                });
            });
        });

        // Sort chronologically
        flat.sort((a, b) => a.data.localeCompare(b.data));
        return flat;
    }

    function populateMateriaFilter() {
        const materias = new Set();
        olimpiadas.forEach(o => (o.materias || []).forEach(m => materias.add(m)));
        const sorted = [...materias].sort();

        sorted.forEach(m => {
            const opt = document.createElement('option');
            opt.value = m;
            opt.textContent = m;
            filtroMateria.appendChild(opt);
        });
    }

    // ═══════════════════════════════════════════════════════
    // Filter Core
    // ═══════════════════════════════════════════════════════
    function getFilteredEvents() {
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);

        const serie = filtroSerie ? filtroSerie.value : 'Todas';
        const materia = filtroMateria ? filtroMateria.value : 'Todas';
        const tipo = filtroTipo ? filtroTipo.value : 'Todos';
        const tempo = filtroTempo ? filtroTempo.value : 'futuros';
        const query = timelineSearch ? timelineSearch.value.trim().toLowerCase() : '';

        return allEventos.filter(ev => {
            // Série
            if (serie !== 'Todas' && !ev.nivel_escolar.includes(serie)) return false;

            // Matéria
            if (materia !== 'Todas' && !ev.materias.includes(materia)) return false;

            // Tipo
            if (tipo !== 'Todos' && ev.tipo !== tipo) return false;

            // Período
            const [y, m, d] = ev.data.split('-');
            const evDate = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
            const diffDias = Math.ceil((evDate - hoje) / (1000 * 60 * 60 * 24));

            if (tempo === 'futuros' && diffDias < 0) return false;
            if (tempo === 'passados' && diffDias >= 0) return false;

            // Text search
            if (query) {
                const matchSigla = (ev.sigla || '').toLowerCase().includes(query);
                const matchNome = (ev.nome || '').toLowerCase().includes(query);
                const matchDesc = (ev.descricao || '').toLowerCase().includes(query);
                const matchMateria = (ev.materias || []).some(mat => mat.toLowerCase().includes(query));
                if (!matchSigla && !matchNome && !matchDesc && !matchMateria) {
                    return false;
                }
            }

            return true;
        });
    }

    // ═══════════════════════════════════════════════════════
    // Render Timeline
    // ═══════════════════════════════════════════════════════
    function renderTimeline() {
        const eventos = getFilteredEvents();

        const isFiltered = (filtroSerie && filtroSerie.value !== 'Todas') ||
                           (filtroMateria && filtroMateria.value !== 'Todas') ||
                           (filtroTipo && filtroTipo.value !== 'Todos') ||
                           (filtroTempo && filtroTempo.value !== 'futuros') ||
                           (timelineSearch && timelineSearch.value.trim() !== '');

        if (btnResetFilters) {
            btnResetFilters.hidden = !isFiltered;
        }

        if (contagemEl) {
            const count = eventos.length;
            contagemEl.textContent = `Exibindo ${count} evento${count !== 1 ? 's' : ''} cronológico${count !== 1 ? 's' : ''}`;
        }

        if (eventos.length === 0) {
            timelineEl.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state__icon">
                        <svg class="icon icon--lg" aria-hidden="true"><use href="#i-calendar"/></svg>
                    </div>
                    <h3>Nenhum evento encontrado</h3>
                    <p>Nenhum marco cronológico coincide com os filtros selecionados. Tente ajustar os filtros ou redefinir a busca.</p>
                    <button type="button" id="btn-empty-reset" class="btn btn--tinted" style="margin-top: 1rem;">Limpar Filtros</button>
                </div>
            `;

            const emptyResetBtn = document.getElementById('btn-empty-reset');
            if (emptyResetBtn) {
                emptyResetBtn.addEventListener('click', resetAllFilters);
            }
            return;
        }

        // Group by Month (YYYY-MM)
        const grouped = {};
        eventos.forEach(ev => {
            const key = ev.data.substring(0, 7);
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push(ev);
        });

        let html = '';

        Object.entries(grouped).forEach(([monthKey, monthEvents]) => {
            const [year, month] = monthKey.split('-');
            const dateObj = new Date(parseInt(year), parseInt(month) - 1, 1);
            const monthName = dateObj.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
            const capitalizedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);

            html += `
                <section>
                    <div class="timeline-month-header">
                        <h3 class="timeline-month-title">${capitalizedMonth}</h3>
                        <span class="timeline-month-badge">${monthEvents.length} evento${monthEvents.length !== 1 ? 's' : ''}</span>
                    </div>
                    <div>
                        ${monthEvents.map((ev, i) => createTimelineItemHtml(ev, i)).join('')}
                    </div>
                </section>
            `;
        });

        timelineEl.innerHTML = html;

        // Listeners for ICS download buttons
        timelineEl.querySelectorAll('.btn-download-single-ics').forEach(btn => {
            btn.addEventListener('click', () => {
                const evData = JSON.parse(btn.dataset.event);
                generateSingleIcsFile(evData);
            });
        });
    }

    function resetAllFilters() {
        if (filtroSerie) filtroSerie.value = 'Todas';
        if (filtroMateria) filtroMateria.value = 'Todas';
        if (filtroTipo) filtroTipo.value = 'Todos';
        if (filtroTempo) filtroTempo.value = 'futuros';
        if (timelineSearch) timelineSearch.value = '';
        if (btnResetFilters) btnResetFilters.hidden = true;
        renderTimeline();
    }

    function createTimelineItemHtml(ev, index) {
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);

        const [y, m, d] = ev.data.split('-');
        const evDate = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
        const diffDias = Math.ceil((evDate - hoje) / (1000 * 60 * 60 * 24));

        const passado = diffDias < 0;
        const urgente = diffDias >= 0 && diffDias <= 7;

        // Date text
        let dateFormatted = '';
        let dateDetail = '';
        if (ev.data_i && ev.data_f) {
            const [y1, m1, d1] = ev.data_i.split('-');
            const [y2, m2, d2] = ev.data_f.split('-');
            const di = new Date(parseInt(y1), parseInt(m1) - 1, parseInt(d1)).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
            const df = new Date(parseInt(y2), parseInt(m2) - 1, parseInt(d2)).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
            dateFormatted = `${di} a ${df}`;
            dateDetail = 'Período oficial';
        } else {
            dateFormatted = evDate.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' });
        }

        // Urgency text chip
        let urgencyBadge = '';
        let statusClass = '';
        if (passado) {
            urgencyBadge = 'Encerrado';
            statusClass = 'badge-status--closed';
        } else if (diffDias === 0) {
            urgencyBadge = 'HOJE!';
            statusClass = 'badge-status--urgent';
        } else if (urgente) {
            urgencyBadge = `Restam ${diffDias} dia${diffDias > 1 ? 's' : ''}`;
            statusClass = 'badge-status--urgent';
        } else {
            urgencyBadge = `Em ${diffDias} dias`;
            statusClass = 'badge-status--open';
        }

        // Tipo class
        let tipoClass = 'evento';
        const tipoLow = (ev.tipo || '').toLowerCase();
        if (tipoLow.includes('inscri')) tipoClass = 'inscricao';
        else if (tipoLow.includes('prova') || tipoLow.includes('fase') || tipoLow.includes('exame')) tipoClass = 'prova';
        else if (tipoLow.includes('result') || tipoLow.includes('premi')) tipoClass = 'resultado';

        const evPayload = JSON.stringify({
            sigla: ev.sigla,
            nome: ev.nome,
            descricao: ev.descricao,
            tipo: ev.tipo,
            data: ev.data,
            data_i: ev.data_i,
            data_f: ev.data_f
        }).replace(/"/g, '&quot;');

        return `
            <article class="timeline-card">
                <div class="timeline-card__top">
                    <div class="timeline-card__badges">
                        <span class="pill-sigla">${ev.sigla}</span>
                        <span class="pill-tipo pill-tipo--${tipoClass}">${ev.tipo}</span>
                        ${ev.modalidade ? `<span class="badge-tag">${ev.modalidade}</span>` : ''}
                    </div>
                    <span class="badge-status ${statusClass}">${urgencyBadge}</span>
                </div>

                <h4 class="timeline-card__title">${ev.nome}</h4>
                <p class="timeline-card__desc">${ev.descricao}</p>

                <div class="timeline-card__date-row">
                    <svg class="icon icon--sm" aria-hidden="true"><use href="#i-calendar"/></svg>
                    <strong>${dateFormatted}</strong>
                    ${dateDetail ? `<span>• ${dateDetail}</span>` : ''}
                </div>

                ${(ev.materias && ev.materias.length > 0) ? `
                <div class="timeline-card__tags">
                    ${ev.materias.map(m => `<span class="badge-tag">${m}</span>`).join('')}
                    ${(ev.nivel_escolar && ev.nivel_escolar.length > 0) ? ev.nivel_escolar.slice(0, 2).map(n => `<span class="badge-tag">${n}</span>`).join('') : ''}
                </div>` : ''}

                <div class="timeline-card__actions">
                    <button type="button" class="btn-download-single-ics" data-event="${evPayload}">
                        <svg class="icon icon--sm" aria-hidden="true"><use href="#i-download"/></svg>
                        Agenda (.ics)
                    </button>
                    <a class="timeline-card__link" href="provas.html?id=${ev.id}">
                        Ficha Completa
                        <svg class="icon icon--sm" aria-hidden="true"><use href="#i-arrow-up-right"/></svg>
                    </a>
                </div>
            </article>
        `;
    }

    // ═══════════════════════════════════════════════════════
    // iCal (.ics) Calendar Exporter
    // ═══════════════════════════════════════════════════════
    function formatIcsDate(dateStr) {
        if (!dateStr) return '';
        return dateStr.replace(/-/g, '');
    }

    function generateSingleIcsFile(ev) {
        const start = formatIcsDate(ev.data_i || ev.data);
        const end = formatIcsDate(ev.data_f || ev.data);

        const icsContent = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//Calendario Olimpico Brasil//PT',
            'CALSCALE:GREGORIAN',
            'BEGIN:VEVENT',
            `SUMMARY:${ev.sigla} - ${ev.tipo}: ${ev.descricao}`,
            `DESCRIPTION:${ev.nome} - ${ev.descricao}`,
            `DTSTART;VALUE=DATE:${start}`,
            `DTEND;VALUE=DATE:${end || start}`,
            'STATUS:CONFIRMED',
            'END:VEVENT',
            'END:VCALENDAR'
        ].join('\r\n');

        downloadIcsBlob(icsContent, `${ev.sigla}_${ev.tipo}_2026.ics`);
        showToast(`📅 Evento da ${ev.sigla} exportado para iCal!`, 'success');
    }

    function generateBulkIcsFile() {
        const eventos = getFilteredEvents();
        if (eventos.length === 0) {
            showToast('Nenhum evento para exportar nos filtros atuais.', 'error');
            return;
        }

        const lines = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//Calendario Olimpico Brasil//PT',
            'CALSCALE:GREGORIAN',
            'X-WR-CALNAME:Calendário Olímpico 2026'
        ];

        eventos.forEach(ev => {
            const start = formatIcsDate(ev.data_i || ev.data);
            const end = formatIcsDate(ev.data_f || ev.data);
            lines.push(
                'BEGIN:VEVENT',
                `SUMMARY:${ev.sigla} - ${ev.tipo}: ${ev.descricao}`,
                `DESCRIPTION:${ev.nome} - ${ev.descricao}`,
                `DTSTART;VALUE=DATE:${start}`,
                `DTEND;VALUE=DATE:${end || start}`,
                'STATUS:CONFIRMED',
                'END:VEVENT'
            );
        });

        lines.push('END:VCALENDAR');

        downloadIcsBlob(lines.join('\r\n'), 'Calendario_Olimpico_2026.ics');
        showToast(`📅 ${eventos.length} eventos exportados para o seu calendário!`, 'success');
    }

    function downloadIcsBlob(content, filename) {
        const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    // ═══════════════════════════════════════════════════════
    // Mobile Navigation & Modals
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
    // Initialization
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

            allEventos = flattenEventos(olimpiadas);
            populateMateriaFilter();
            renderTimeline();

            // Filter listeners
            if (filtroSerie) filtroSerie.addEventListener('change', renderTimeline);
            if (filtroMateria) filtroMateria.addEventListener('change', renderTimeline);
            if (filtroTipo) filtroTipo.addEventListener('change', renderTimeline);
            if (filtroTempo) filtroTempo.addEventListener('change', renderTimeline);

            if (timelineSearch) {
                let timeout = null;
                timelineSearch.addEventListener('input', () => {
                    clearTimeout(timeout);
                    timeout = setTimeout(renderTimeline, 150);
                });
            }

            if (btnResetFilters) {
                btnResetFilters.addEventListener('click', resetAllFilters);
            }

            if (btnExportAllIcs) {
                btnExportAllIcs.addEventListener('click', generateBulkIcsFile);
            }

        } catch (err) {
            timelineEl.innerHTML = `
                <div>
                    <h3>Erro ao carregar dados</h3>
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
