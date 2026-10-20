// ═══════════════════════════════════════════════════════════════
// Calendário Olímpico — admin.js (Management Panel)
// Secure session authentication, multi-password support,
// CRUD for Olympiads, multi-tab modal, dynamic event editors,
// and JSON export persistence.
// ═══════════════════════════════════════════════════════════════

(function () {
    'use strict';

    // ─── Auth Config ─────────────────────────────────────────────
    // Accepted SHA-256 password digests
    const VALID_HASHES = new Set([
        '315b0921c11ccc2c5066cb1459de9fe0b221ea29bf08682653a74a16e95c894a',
        '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918',
        '6a9c61abbaec567b607eb9ddb9940ca8eecff4f11178041ae844b79c1a90e18e',
        '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9'
    ]);

    const SESSION_KEY         = 'calolimpico_admin_auth';
    const ATTEMPTS_KEY        = 'calolimpico_admin_attempts';
    const LOCKOUT_KEY         = 'calolimpico_admin_lockout';
    const MAX_ATTEMPTS        = 5;
    const LOCKOUT_DURATION_MS = 60_000; // 60 seconds

    // ─── State ───────────────────────────────────────────────────
    let olimpiadas = [];
    let editingIndex = null;

    // ─── DOM References ──────────────────────────────────────────
    const loginScreen      = document.getElementById('login-screen');
    const adminScreen      = document.getElementById('admin-screen');
    const loginForm        = document.getElementById('login-form');
    const passwordInput    = document.getElementById('password-input');
    const togglePasswordBtn = document.getElementById('toggle-password-btn');
    const loginError       = document.getElementById('login-error');
    const loginErrorText   = document.getElementById('login-error-text');
    const loginLockout     = document.getElementById('login-lockout');
    const lockoutCountdown = document.getElementById('lockout-countdown');
    const loginBtn         = document.getElementById('login-btn');
    const loginBtnText     = document.getElementById('login-btn-text');
    const loginSpinner     = document.getElementById('login-spinner');
    const logoutBtn        = document.getElementById('logout-btn');
    const addBtn           = document.getElementById('add-btn');
    const exportBtn        = document.getElementById('export-btn');
    const searchInput      = document.getElementById('search-input');
    const olimpiadasList   = document.getElementById('olimpiadas-list');
    const emptyState       = document.getElementById('empty-state');
    const countLabel       = document.getElementById('count-label');

    const modal            = document.getElementById('modal');
    const modalCloseBtn    = document.getElementById('close-modal-btn');
    const modalCancelBtn   = document.getElementById('cancel-btn');
    const modalSaveBtn     = document.getElementById('save-btn');
    const modalForm        = document.getElementById('modal-form');
    const modalTitle       = document.getElementById('modal-title');
    const modalError       = document.getElementById('modal-error');
    const modalErrorText   = document.getElementById('modal-error-text');

    const confirmDialog    = document.getElementById('confirm-dialog');
    const confirmDeleteSigla = document.getElementById('confirm-delete-sigla');
    const cancelDeleteBtn  = document.getElementById('cancel-delete-btn');
    const confirmDeleteBtn = document.getElementById('confirm-delete-btn');

    // Modal Form Fields
    const fId             = document.getElementById('f-id');
    const fSigla          = document.getElementById('f-sigla');
    const fNome           = document.getElementById('f-nome');
    const fModalidade     = document.getElementById('f-modalidade');
    const fMaterias       = document.getElementById('f-materias');
    const fDescricao      = document.getElementById('f-descricao');
    const fSiteOficial    = document.getElementById('f-site-oficial');
    const eventosListEl   = document.getElementById('eventos-container');
    const eventosEmpty    = document.getElementById('eventos-empty');
    const materiaisListEl = document.getElementById('materiais-container');
    const materiaisEmpty  = document.getElementById('materiais-empty');
    const fontesListEl    = document.getElementById('fontes-container');
    const fontesEmpty     = document.getElementById('fontes-empty');
    const addEventoBtn    = document.getElementById('add-evento-btn');
    const addMaterialBtn  = document.getElementById('add-material-btn');
    const addFonteBtn     = document.getElementById('add-fonte-btn');
    const nivelCheckboxes = document.getElementById('nivel-checkboxes');
    const tabButtons      = document.querySelectorAll('.tab-btn');
    const tabPanels       = document.querySelectorAll('.tab-panel');

    // Stats DOM
    const statTotal       = document.getElementById('stat-total');
    const statInscricao   = document.getElementById('stat-inscricao');
    const statSemDesc     = document.getElementById('stat-sem-desc');
    const statSemEvento   = document.getElementById('stat-sem-evento');
    const toastContainer  = document.getElementById('toast-container');

    const NIVEIS = [
        'Ensino Fundamental I',
        'Ensino Fundamental II',
        'Ensino Médio',
        'Livre',
    ];

    const EVENTO_TIPOS = ['Inscrição', 'Prova', 'Resultado', 'Premiação', 'Outro'];

    // ═══════════════════════════════════════════════════════════
    // Crypto Helpers
    // ═══════════════════════════════════════════════════════════
    async function sha256(text) {
        const msgBuffer = new TextEncoder().encode(text);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    // ═══════════════════════════════════════════════════════════
    // Auth & Lockout Engine
    // ═══════════════════════════════════════════════════════════
    function isAuthenticated() {
        const token = sessionStorage.getItem(SESSION_KEY);
        return token && VALID_HASHES.has(token);
    }

    function setAuth(hashOrBool) {
        if (hashOrBool) {
            const token = typeof hashOrBool === 'string' ? hashOrBool : Array.from(VALID_HASHES)[0];
            sessionStorage.setItem(SESSION_KEY, token);
        } else {
            sessionStorage.removeItem(SESSION_KEY);
        }
    }

    function isLockedOut() {
        const until = parseInt(sessionStorage.getItem(LOCKOUT_KEY) || '0', 10);
        return Date.now() < until;
    }

    function lockoutRemainingSeconds() {
        const until = parseInt(sessionStorage.getItem(LOCKOUT_KEY) || '0', 10);
        return Math.max(0, Math.ceil((until - Date.now()) / 1000));
    }

    function recordFailedAttempt() {
        const attempts = parseInt(sessionStorage.getItem(ATTEMPTS_KEY) || '0', 10) + 1;
        if (attempts >= MAX_ATTEMPTS) {
            sessionStorage.setItem(LOCKOUT_KEY, String(Date.now() + LOCKOUT_DURATION_MS));
            sessionStorage.setItem(ATTEMPTS_KEY, '0');
            startLockoutCountdown();
        } else {
            sessionStorage.setItem(ATTEMPTS_KEY, String(attempts));
            const remaining = MAX_ATTEMPTS - attempts;
            const plural = remaining !== 1;
            showLoginError(`Senha incorreta. ${remaining} tentativa${plural ? 's' : ''} restante${plural ? 's' : ''}.`);
        }
    }

    function clearRateLimitState() {
        sessionStorage.removeItem(ATTEMPTS_KEY);
        sessionStorage.removeItem(LOCKOUT_KEY);
    }

    let lockoutTimer = null;

    function startLockoutCountdown() {
        if (loginError) loginError.hidden = true;
        if (loginLockout) loginLockout.hidden = false;
        if (passwordInput) passwordInput.disabled = true;
        if (loginBtn) loginBtn.disabled = true;

        function tick() {
            const secs = lockoutRemainingSeconds();
            if (lockoutCountdown) lockoutCountdown.textContent = secs;
            if (secs <= 0) {
                if (loginLockout) loginLockout.hidden = true;
                if (passwordInput) {
                    passwordInput.disabled = false;
                    passwordInput.focus();
                }
                if (loginBtn) loginBtn.disabled = false;
                lockoutTimer = null;
            } else {
                lockoutTimer = setTimeout(tick, 1000);
            }
        }
        tick();
    }

    function guardAdmin() {
        if (!isAuthenticated()) {
            handleLogout();
            return false;
        }
        return true;
    }

    function showLoginError(msg) {
        if (loginErrorText) loginErrorText.textContent = msg;
        if (loginError) loginError.hidden = false;
    }

    function showLoginScreen() {
        if (loginScreen) loginScreen.hidden = false;
        if (adminScreen) adminScreen.hidden = true;
        if (modal) modal.hidden = true;
        if (confirmDialog) confirmDialog.hidden = true;
        if (passwordInput) passwordInput.value = '';
        if (loginError) loginError.hidden = true;
        if (loginLockout) loginLockout.hidden = true;
        if (isLockedOut()) startLockoutCountdown();
    }

    function showAdminScreen() {
        if (loginScreen) loginScreen.hidden = true;
        if (adminScreen) adminScreen.hidden = false;
    }

    async function handleLogin(e) {
        if (e && e.preventDefault) e.preventDefault();
        if (isLockedOut()) return;

        const pwd = passwordInput ? passwordInput.value.trim() : '';
        if (!pwd) return;

        if (loginBtnText) loginBtnText.textContent = 'Verificando…';
        if (loginSpinner) loginSpinner.hidden = false;
        if (loginError) loginError.hidden = true;

        try {
            const hash = await sha256(pwd);
            if (VALID_HASHES.has(hash)) {
                clearRateLimitState();
                setAuth(hash);
                showAdminScreen();
                await loadData();
                showToast('Sessão administrativa autenticada com sucesso.', 'success');
            } else {
                if (passwordInput) {
                    passwordInput.value = '';
                    passwordInput.focus();
                }
                recordFailedAttempt();
            }
        } catch (err) {
            console.error('Auth error:', err);
            showLoginError('Erro ao verificar a senha.');
        } finally {
            if (loginBtnText) loginBtnText.textContent = 'Autenticar Sessão';
            if (loginSpinner) loginSpinner.hidden = true;
        }
    }

    function handleLogout() {
        setAuth(false);
        olimpiadas = [];
        if (lockoutTimer) {
            clearTimeout(lockoutTimer);
            lockoutTimer = null;
        }
        showLoginScreen();
        showToast('Sessão encerrada.', 'info');
    }

    // Toggle password visibility
    if (togglePasswordBtn && passwordInput) {
        togglePasswordBtn.addEventListener('click', () => {
            const isPassword = passwordInput.type === 'password';
            passwordInput.type = isPassword ? 'text' : 'password';
        });
    }

    // ═══════════════════════════════════════════════════════════
    // Data Loading & Stats
    // ═══════════════════════════════════════════════════════════
    async function loadData() {
        try {
            if (window.OLIMPIADAS_DATA && Array.isArray(window.OLIMPIADAS_DATA) && window.OLIMPIADAS_DATA.length > 0) {
                olimpiadas = JSON.parse(JSON.stringify(window.OLIMPIADAS_DATA));
            } else {
                const res = await fetch('dados.json?_=' + Date.now());
                if (!res.ok) throw new Error('HTTP ' + res.status);
                olimpiadas = await res.json();
            }
        } catch (err) {
            olimpiadas = [];
            showToast('Erro ao carregar dados: ' + err.message, 'error');
        }
        renderList();
    }

    function updateStats() {
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        const total = olimpiadas.length;
        let inscAberta = 0, semDesc = 0, semEvento = 0;

        olimpiadas.forEach(o => {
            if (!o.descricao) semDesc++;
            if (!o.eventos || o.eventos.length === 0) { semEvento++; return; }
            const inscEv = o.eventos.find(e => e.tipo === 'Inscrição');
            if (inscEv) {
                const fim = inscEv['data-f'] || inscEv.data || '';
                if (fim && new Date(fim + 'T23:59:59') >= hoje) inscAberta++;
            }
        });

        if (statTotal) statTotal.textContent = total;
        if (statInscricao) statInscricao.textContent = inscAberta;
        if (statSemDesc) statSemDesc.textContent = semDesc;
        if (statSemEvento) statSemEvento.textContent = semEvento;
    }

    // ═══════════════════════════════════════════════════════════
    // Render Admin Cards List
    // ═══════════════════════════════════════════════════════════
    function renderList(filter) {
        if (!olimpiadasList) return;
        const query = (filter ?? (searchInput ? searchInput.value : '')).toLowerCase().trim();
        const filtered = olimpiadas.filter(o => {
            if (!query) return true;
            return (
                (o.sigla || '').toLowerCase().includes(query) ||
                (o.nome || '').toLowerCase().includes(query) ||
                (o.materias || []).some(m => m.toLowerCase().includes(query)) ||
                (o.nivel_escolar || []).some(n => n.toLowerCase().includes(query)) ||
                (o.modalidade || '').toLowerCase().includes(query)
            );
        });

        if (countLabel) {
            countLabel.textContent = `${filtered.length} de ${olimpiadas.length} cadastrada${olimpiadas.length !== 1 ? 's' : ''}`;
        }

        if (filtered.length === 0) {
            olimpiadasList.innerHTML = '';
            if (emptyState) emptyState.hidden = false;
            return;
        }
        if (emptyState) emptyState.hidden = true;

        olimpiadasList.innerHTML = filtered.map((o) => {
            const realIdx = olimpiadas.indexOf(o);
            const eventCount = (o.eventos || []).length;
            const matCount   = (o.materiais_estudo || []).length;
            const hasDesc    = !!o.descricao;

            const nivelBadges = (o.nivel_escolar || [])
                .map(n => `<span class="tag">${escHtml(n)}</span>`)
                .join(' ');
            const materiaBadges = (o.materias || [])
                .map(m => `<span class="tag">${escHtml(m)}</span>`)
                .join(' ');

            return `
            <div class="admin-card" data-idx="${realIdx}">
                <div class="admin-card__head">
                    <div class="admin-card__title-group">
                        <span class="admin-card__sigla">${escHtml(o.sigla)}</span>
                        <span class="badge-modality">${escHtml(o.modalidade || 'Presencial')}</span>
                        <span class="tag">ID: ${escHtml(o.id)}</span>
                    </div>
                    <div class="admin-card__actions">
                        <button type="button" class="btn-secondary edit-btn" data-idx="${realIdx}">
                            <svg class="icon icon--sm"><use href="#i-pencil"/></svg>
                            Editar
                        </button>
                        <button type="button" class="btn-secondary delete-btn" data-idx="${realIdx}">
                            <svg class="icon icon--sm"><use href="#i-trash"/></svg>
                            Excluir
                        </button>
                    </div>
                </div>

                <div class="admin-card__name">${escHtml(o.nome)}</div>

                <div class="admin-card__meta-tags">
                    ${nivelBadges} ${materiaBadges}
                </div>

                <div class="admin-card__stats-chips">
                    <span>📅 <strong>${eventCount}</strong> evento${eventCount !== 1 ? 's' : ''}</span>
                    <span>📚 <strong>${matCount}</strong> material${matCount !== 1 ? 'is' : ''}</span>
                    <span>${hasDesc ? '✅ Com Descrição' : '⚠️ Sem Descrição'}</span>
                    ${o.site_oficial ? `<a href="${escAttr(o.site_oficial)}" target="_blank" rel="noopener noreferrer" class="link-more">Site Oficial &rarr;</a>` : ''}
                </div>
            </div>`;
        }).join('');

        olimpiadasList.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', () => openModal(parseInt(btn.dataset.idx, 10)));
        });
        olimpiadasList.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', () => openConfirmDelete(parseInt(btn.dataset.idx, 10)));
        });

        updateStats();
    }

    // ═══════════════════════════════════════════════════════════
    // Modal Tab Navigation
    // ═══════════════════════════════════════════════════════════
    function switchTab(targetTabId) {
        tabButtons.forEach(btn => {
            const isTarget = btn.dataset.tab === targetTabId;
            btn.classList.toggle('active', isTarget);
        });

        tabPanels.forEach(panel => {
            panel.hidden = panel.id !== targetTabId;
        });
    }

    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    // ═══════════════════════════════════════════════════════════
    // Modal Open & Populate
    // ═══════════════════════════════════════════════════════════
    function buildNivelCheckboxes(selected) {
        if (!nivelCheckboxes) return;
        nivelCheckboxes.innerHTML = NIVEIS.map(n => {
            const checked = (selected || []).includes(n);
            const id = 'nivel-' + n.replace(/\s+/g, '-');
            return `
            <label for="${id}">
                <input type="checkbox" id="${id}" class="nivel-checkbox" value="${escAttr(n)}" ${checked ? 'checked' : ''}>
                <span>${escHtml(n)}</span>
            </label> `;
        }).join('');
    }

    function getSelectedNiveis() {
        if (!nivelCheckboxes) return [];
        return Array.from(nivelCheckboxes.querySelectorAll('.nivel-checkbox:checked')).map(cb => cb.value);
    }

    function openModal(idx) {
        if (!guardAdmin()) return;
        editingIndex = (idx === undefined) ? null : idx;
        const o = (editingIndex !== null) ? olimpiadas[editingIndex] : null;

        if (modalTitle) modalTitle.textContent = o ? `Editar: ${o.sigla}` : 'Cadastrar Nova Olimpíada';
        hideModalError();
        switchTab('tab-geral');

        // Fields
        if (fSigla) fSigla.value       = o ? o.sigla : '';
        if (fId) fId.value             = o ? o.id : '';
        if (fNome) fNome.value         = o ? o.nome : '';
        if (fModalidade) fModalidade.value = o ? (o.modalidade || '') : '';
        if (fMaterias) fMaterias.value = o ? (o.materias || []).join(', ') : '';
        if (fDescricao) fDescricao.value = o ? (o.descricao || '') : '';
        if (fSiteOficial) fSiteOficial.value = o ? (o.site_oficial || '') : '';

        buildNivelCheckboxes(o ? o.nivel_escolar : []);
        renderEventos(o ? (o.eventos || []) : []);
        renderMateriais(o ? (o.materiais_estudo || []) : []);
        renderFontes(o ? (o.fontes_oficiais || []) : []);

        if (fSigla) {
            if (!o) {
                fSigla.addEventListener('input', autoGenerateId);
            } else {
                fSigla.removeEventListener('input', autoGenerateId);
            }
        }

        if (modal) modal.hidden = false;
        if (fSigla) fSigla.focus();
    }

    function autoGenerateId() {
        if (!fId || !fSigla) return;
        if (!fId.value || fId.dataset.manual !== '1') {
            const year = new Date().getFullYear();
            fId.value = fSigla.value.toLowerCase().replace(/[^a-z0-9]/g, '') + year;
        }
    }

    function closeModal() {
        if (modal) modal.hidden = true;
        if (fSigla) fSigla.removeEventListener('input', autoGenerateId);
        if (fId) fId.dataset.manual = '';
        editingIndex = null;
    }

    function showModalError(msg) {
        if (modalErrorText) modalErrorText.textContent = msg;
        if (modalError) modalError.hidden = false;
    }

    function hideModalError() {
        if (modalError) modalError.hidden = true;
    }

    // ═══════════════════════════════════════════════════════════
    // Eventos Editor
    // ═══════════════════════════════════════════════════════════
    let eventosBuffer = [];

    function renderEventos(eventos) {
        eventosBuffer = eventos.map(e => ({ ...e }));
        _redrawEventos();
    }

    function _redrawEventos() {
        if (!eventosListEl) return;
        if (eventosBuffer.length === 0) {
            eventosListEl.innerHTML = '';
            if (eventosEmpty) eventosEmpty.hidden = false;
            return;
        }
        if (eventosEmpty) eventosEmpty.hidden = true;

        eventosListEl.innerHTML = eventosBuffer.map((e, i) => {
            const isRange = ('data-i' in e) || ('data-f' in e);
            const tipoOptions = EVENTO_TIPOS.map(t =>
                `<option value="${escAttr(t)}" ${(e.tipo || '') === t ? 'selected' : ''}>${escHtml(t)}</option>`
            ).join('');

            return `
            <div class="dynamic-item-card evento-row" data-ei="${i}">
                <div class="dynamic-item-head">
                    <strong>Evento #${i + 1}</strong>
                    <button type="button" class="btn-secondary delete-btn evento-remove" title="Excluir Evento">Remover</button>
                </div>

                <div class="filters-grid">
                    <div class="field">
                        <label>Tipo de Evento:</label>
                        <select class="evento-tipo">
                            ${tipoOptions}
                        </select>
                    </div>

                    <div class="field">
                        <label>Formato da Data:</label>
                        <select class="evento-date-type">
                            <option value="single" ${!isRange ? 'selected' : ''}>Data Única</option>
                            <option value="range"  ${isRange  ? 'selected' : ''}>Período (Início / Fim)</option>
                        </select>
                    </div>
                </div>

                <div class="field">
                    <label>Data Oficial:</label>
                    ${isRange
                        ? `<div class="filters-grid">
                            <input type="date" class="evento-date-i" value="${escAttr(e['data-i'] || '')}" aria-label="Data de Início">
                            <input type="date" class="evento-date-f" value="${escAttr(e['data-f'] || '')}" aria-label="Data de Término">
                           </div>`
                        : `<input type="date" class="evento-date" value="${escAttr(e.data || '')}" aria-label="Data">`
                    }
                </div>

                <div class="field">
                    <label>Descrição do Evento:</label>
                    <input type="text" class="evento-desc" value="${escAttr(e.descricao || '')}" placeholder="Ex: 1ª Fase — Prova teórica nas escolas">
                </div>
            </div>`;
        }).join('');

        eventosListEl.querySelectorAll('.evento-remove').forEach((btn, i) => {
            btn.addEventListener('click', () => { collectEventosFromDOM(); eventosBuffer.splice(i, 1); _redrawEventos(); });
        });

        eventosListEl.querySelectorAll('.evento-date-type').forEach((sel, i) => {
            sel.addEventListener('change', () => {
                collectEventosFromDOM();
                const wasRange = ('data-i' in eventosBuffer[i]) || ('data-f' in eventosBuffer[i]);
                if (sel.value === 'range' && !wasRange) {
                    eventosBuffer[i] = { ...eventosBuffer[i], 'data-i': '', 'data-f': '' };
                    delete eventosBuffer[i].data;
                } else if (sel.value === 'single' && wasRange) {
                    eventosBuffer[i] = { ...eventosBuffer[i], data: '' };
                    delete eventosBuffer[i]['data-i'];
                    delete eventosBuffer[i]['data-f'];
                }
                _redrawEventos();
            });
        });
    }

    function collectEventosFromDOM() {
        if (!eventosListEl) return;
        eventosListEl.querySelectorAll('.evento-row').forEach((row, i) => {
            if (!eventosBuffer[i]) return;
            const tipo = row.querySelector('.evento-tipo').value.trim();
            const desc = row.querySelector('.evento-desc').value.trim();
            const dateType = row.querySelector('.evento-date-type').value;

            eventosBuffer[i].tipo = tipo;
            eventosBuffer[i].descricao = desc;

            if (dateType === 'range') {
                eventosBuffer[i]['data-i'] = row.querySelector('.evento-date-i')?.value || '';
                eventosBuffer[i]['data-f'] = row.querySelector('.evento-date-f')?.value || '';
                delete eventosBuffer[i].data;
                if (!eventosBuffer[i]['data-i']) delete eventosBuffer[i]['data-i'];
                if (!eventosBuffer[i]['data-f']) delete eventosBuffer[i]['data-f'];
            } else {
                eventosBuffer[i].data = row.querySelector('.evento-date')?.value || '';
                delete eventosBuffer[i]['data-i'];
                delete eventosBuffer[i]['data-f'];
                if (!eventosBuffer[i].data) delete eventosBuffer[i].data;
            }
        });
    }

    function addEvento() {
        collectEventosFromDOM();
        eventosBuffer.push({ tipo: 'Prova', data: '', descricao: '' });
        _redrawEventos();
    }

    // ═══════════════════════════════════════════════════════════
    // Materiais & Fontes Editors
    // ═══════════════════════════════════════════════════════════
    let materiaisBuffer = [];
    let fontesBuffer = [];

    function renderMateriais(materiais) {
        materiaisBuffer = materiais.map(m => ({ ...m }));
        _redrawMateriais();
    }

    function _redrawMateriais() {
        if (!materiaisListEl) return;
        if (materiaisBuffer.length === 0) {
            materiaisListEl.innerHTML = '';
            if (materiaisEmpty) materiaisEmpty.hidden = false;
            return;
        }
        if (materiaisEmpty) materiaisEmpty.hidden = true;

        materiaisListEl.innerHTML = materiaisBuffer.map((m, i) => `
            <div class="dynamic-item-card material-row" data-mi="${i}">
                <div class="dynamic-item-head">
                    <strong>Material #${i + 1}</strong>
                    <button type="button" class="btn-secondary delete-btn material-remove">Remover</button>
                </div>
                <div class="field">
                    <label>Título do Recurso:</label>
                    <input type="text" class="material-titulo" value="${escAttr(m.titulo || '')}" placeholder="Ex: Provas Anteriores com Gabarito">
                </div>
                <div class="field">
                    <label>Link / URL:</label>
                    <input type="url" class="material-url" value="${escAttr(m.url || '')}" placeholder="https://...">
                </div>
            </div>
        `).join('');

        materiaisListEl.querySelectorAll('.material-remove').forEach((btn, i) => {
            btn.addEventListener('click', () => { collectMateriaisFromDOM(); materiaisBuffer.splice(i, 1); _redrawMateriais(); });
        });
    }

    function collectMateriaisFromDOM() {
        if (!materiaisListEl) return;
        materiaisListEl.querySelectorAll('.material-row').forEach((row, i) => {
            if (!materiaisBuffer[i]) return;
            materiaisBuffer[i].titulo = row.querySelector('.material-titulo').value.trim();
            materiaisBuffer[i].url    = row.querySelector('.material-url').value.trim();
        });
    }

    function addMaterial() {
        collectMateriaisFromDOM();
        materiaisBuffer.push({ titulo: '', url: '' });
        _redrawMateriais();
    }

    function renderFontes(fontes) {
        fontesBuffer = (fontes || []).map(f => ({ ...f }));
        _redrawFontes();
    }

    function _redrawFontes() {
        if (!fontesListEl) return;
        if (fontesBuffer.length === 0) {
            fontesListEl.innerHTML = '';
            if (fontesEmpty) fontesEmpty.hidden = false;
            return;
        }
        if (fontesEmpty) fontesEmpty.hidden = true;

        fontesListEl.innerHTML = fontesBuffer.map((f, i) => `
            <div class="dynamic-item-card fonte-row" data-fi="${i}">
                <div class="dynamic-item-head">
                    <strong>Fonte #${i + 1}</strong>
                    <button type="button" class="btn-secondary delete-btn fonte-remove">Remover</button>
                </div>
                <div class="field">
                    <label>Título / Regulamento:</label>
                    <input type="text" class="fonte-titulo" value="${escAttr(f.titulo || '')}" placeholder="Ex: Edital Oficial 2026">
                </div>
                <div class="field">
                    <label>Link / URL:</label>
                    <input type="url" class="fonte-url" value="${escAttr(f.url || '')}" placeholder="https://...">
                </div>
            </div>
        `).join('');

        fontesListEl.querySelectorAll('.fonte-remove').forEach((btn, i) => {
            btn.addEventListener('click', () => { collectFontesFromDOM(); fontesBuffer.splice(i, 1); _redrawFontes(); });
        });
    }

    function collectFontesFromDOM() {
        if (!fontesListEl) return;
        fontesListEl.querySelectorAll('.fonte-row').forEach((row, i) => {
            if (!fontesBuffer[i]) return;
            fontesBuffer[i].titulo = row.querySelector('.fonte-titulo').value.trim();
            fontesBuffer[i].url    = row.querySelector('.fonte-url').value.trim();
        });
    }

    function addFonte() {
        collectFontesFromDOM();
        fontesBuffer.push({ titulo: '', url: '' });
        _redrawFontes();
    }

    // ═══════════════════════════════════════════════════════════
    // Save Modal Data
    // ═══════════════════════════════════════════════════════════
    function saveModal() {
        if (!guardAdmin()) return;
        hideModalError();

        collectEventosFromDOM();
        collectMateriaisFromDOM();
        collectFontesFromDOM();

        const sigla       = fSigla ? fSigla.value.trim() : '';
        const id          = fId ? fId.value.trim() : '';
        const nome        = fNome ? fNome.value.trim() : '';
        const modalidade  = fModalidade ? fModalidade.value : '';
        const descricao   = fDescricao ? fDescricao.value.trim() : '';
        const siteOficial = fSiteOficial ? fSiteOficial.value.trim() : '';

        if (!sigla) {
            switchTab('tab-geral');
            return showModalError('A sigla da olimpíada é obrigatória.');
        }
        if (!id) {
            switchTab('tab-geral');
            return showModalError('O identificador (ID) é obrigatório.');
        }
        if (!nome) {
            switchTab('tab-geral');
            return showModalError('O nome completo da competição é obrigatório.');
        }
        if (!modalidade) {
            switchTab('tab-geral');
            return showModalError('Selecione a modalidade da olimpíada.');
        }

        const existingIdx = olimpiadas.findIndex(o => o.id === id);
        if (existingIdx !== -1 && existingIdx !== editingIndex) {
            switchTab('tab-geral');
            return showModalError(`O ID "${id}" já está em uso pela competição "${olimpiadas[existingIdx].sigla}".`);
        }

        const materias = fMaterias ? fMaterias.value.split(',').map(s => s.trim()).filter(Boolean) : [];
        const niveis   = getSelectedNiveis();

        const knownKeys = new Set([
            'id', 'sigla', 'nome', 'nivel_escolar', 'materias', 'modalidade',
            'eventos', 'materiais_estudo', 'fontes_oficiais', 'descricao', 'site_oficial',
        ]);
        const existing = editingIndex !== null ? olimpiadas[editingIndex] : null;
        const preservedFields = existing
            ? Object.fromEntries(Object.entries(existing).filter(([key]) => !knownKeys.has(key)))
            : {};

        const finalEventos = eventosBuffer.filter(e => e.tipo || e.data || e['data-i'] || e['data-f'] || e.descricao);
        const finalMateriais = materiaisBuffer.filter(m => m.titulo || m.url);
        const finalFontes = fontesBuffer.filter(f => f.titulo || f.url);

        const obj = {
            ...preservedFields,
            id, sigla, nome,
            descricao: descricao || undefined,
            site_oficial: siteOficial || undefined,
            nivel_escolar: niveis,
            materias, modalidade,
            eventos: finalEventos,
            materiais_estudo: finalMateriais,
            fontes_oficiais: finalFontes.length > 0 ? finalFontes : undefined,
        };

        if (!obj.descricao) delete obj.descricao;
        if (!obj.site_oficial) delete obj.site_oficial;
        if (!obj.fontes_oficiais) delete obj.fontes_oficiais;

        if (editingIndex !== null) {
            olimpiadas[editingIndex] = obj;
            showToast(`"${sigla}" atualizada com sucesso.`, 'success');
        } else {
            olimpiadas.push(obj);
            showToast(`"${sigla}" cadastrada com sucesso.`, 'success');
        }

        closeModal();
        renderList();
    }

    // ═══════════════════════════════════════════════════════════
    // Delete Confirmation
    // ═══════════════════════════════════════════════════════════
    let deleteTargetIdx = null;

    function openConfirmDelete(idx) {
        if (!guardAdmin()) return;
        deleteTargetIdx = idx;
        const o = olimpiadas[idx];
        if (confirmDeleteSigla) confirmDeleteSigla.textContent = `"${o.nome}" (${o.sigla})`;
        if (confirmDialog) confirmDialog.hidden = false;
    }

    function closeConfirmDialog() {
        if (confirmDialog) confirmDialog.hidden = true;
        deleteTargetIdx = null;
    }

    function handleDelete() {
        if (deleteTargetIdx === null) return;
        if (!guardAdmin()) return;
        const removed = olimpiadas.splice(deleteTargetIdx, 1)[0];
        closeConfirmDialog();
        renderList();
        showToast(`"${removed.sigla}" foi excluída com sucesso.`, 'info');
    }

    // ═══════════════════════════════════════════════════════════
    // Export JSON
    // ═══════════════════════════════════════════════════════════
    function exportJSON() {
        if (!guardAdmin()) return;
        const json = JSON.stringify(olimpiadas, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = 'dados.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast('Arquivo dados.json exportado! Substitua no repositório.', 'success');
    }

    // ═══════════════════════════════════════════════════════════
    // Toast Messages
    // ═══════════════════════════════════════════════════════════
    function showToast(msg, type = 'info') {
        if (!toastContainer) return;
        const toastEl = document.createElement('div');
        toastEl.className = 'toast-message';
        toastEl.innerHTML = `<p>${msg}</p>`;
        toastContainer.appendChild(toastEl);

        setTimeout(() => {
            toastEl.remove();
        }, 3200);
    }

    // ═══════════════════════════════════════════════════════════
    // Utilities
    // ═══════════════════════════════════════════════════════════
    function escHtml(str) {
        return String(str || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function escAttr(str) {
        return String(str || '').replace(/"/g, '&quot;');
    }

    // ═══════════════════════════════════════════════════════════
    // Bindings
    // ═══════════════════════════════════════════════════════════
    if (loginForm) loginForm.addEventListener('submit', handleLogin);
    if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);

    if (addBtn) addBtn.addEventListener('click', () => openModal());
    if (exportBtn) exportBtn.addEventListener('click', exportJSON);
    if (searchInput) searchInput.addEventListener('input', () => renderList());

    if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeModal);
    if (modalCancelBtn) modalCancelBtn.addEventListener('click', closeModal);
    if (modalSaveBtn) modalSaveBtn.addEventListener('click', (e) => { e.preventDefault(); saveModal(); });
    if (modalForm) modalForm.addEventListener('submit', (e) => { e.preventDefault(); saveModal(); });

    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });
    }

    if (addEventoBtn) addEventoBtn.addEventListener('click', addEvento);
    if (addMaterialBtn) addMaterialBtn.addEventListener('click', addMaterial);
    if (addFonteBtn) addFonteBtn.addEventListener('click', addFonte);

    if (fId) fId.addEventListener('input', () => { fId.dataset.manual = '1'; });

    if (cancelDeleteBtn) cancelDeleteBtn.addEventListener('click', closeConfirmDialog);
    if (confirmDeleteBtn) confirmDeleteBtn.addEventListener('click', handleDelete);
    if (confirmDialog) {
        confirmDialog.addEventListener('click', (e) => {
            if (e.target === confirmDialog) closeConfirmDialog();
        });
    }

    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            if (confirmDialog && !confirmDialog.hidden) closeConfirmDialog();
            else if (modal && !modal.hidden) closeModal();
        }
    });

    // ═══════════════════════════════════════════════════════
    // Telemetry & Security Observatorio View
    // ═══════════════════════════════════════════════════════
    const tabNavOlimpiadas = document.getElementById('tab-nav-olimpiadas');
    const tabNavTelemetria = document.getElementById('tab-nav-telemetria');
    const viewOlimpiadas   = document.getElementById('view-olimpiadas');
    const viewTelemetria   = document.getElementById('view-telemetria');

    const statTelemStudents   = document.getElementById('stat-telem-students');
    const statTelemSwitches   = document.getElementById('stat-telem-switches');
    const statTelemSwitchRate = document.getElementById('stat-telem-switch-rate');
    const statTelemBlocked    = document.getElementById('stat-telem-blocked');
    const statTelemPasses     = document.getElementById('stat-telem-passes');

    const tbodyRankingOlimpiadas = document.getElementById('tbody-ranking-olimpiadas');
    const tbodyIdentitySwitches  = document.getElementById('tbody-identity-switches');
    const tbodyBlockedAccess     = document.getElementById('tbody-blocked-access');

    const listTopUfs       = document.getElementById('list-top-ufs');
    const listRealIsps     = document.getElementById('list-real-isps');
    const listVpnProviders = document.getElementById('list-vpn-providers');

    const statDeviceDist = document.getElementById('stat-device-dist');
    const statRamDist    = document.getElementById('stat-ram-dist');
    const statNetDist    = document.getElementById('stat-net-dist');

    const btnSeedTelemetry    = document.getElementById('btn-seed-telemetry');
    const btnRefreshTelemetry = document.getElementById('btn-refresh-telemetry');
    const btnExportTelemetry  = document.getElementById('btn-export-telemetry');
    const btnClearTelemetry   = document.getElementById('btn-clear-telemetry');

    const simBtnUs     = document.getElementById('sim-btn-us');
    const simBtnVpn    = document.getElementById('sim-btn-vpn');
    const simBtnBorder = document.getElementById('sim-btn-border');
    const simBtnReset  = document.getElementById('sim-btn-reset');

    function switchAdminView(viewName) {
        if (viewName === 'telemetria') {
            if (tabNavOlimpiadas) tabNavOlimpiadas.classList.remove('active');
            if (tabNavTelemetria) tabNavTelemetria.classList.add('active');
            if (viewOlimpiadas) viewOlimpiadas.hidden = true;
            if (viewTelemetria) viewTelemetria.hidden = false;
            renderTelemetryDashboard();
        } else {
            if (tabNavOlimpiadas) tabNavOlimpiadas.classList.add('active');
            if (tabNavTelemetria) tabNavTelemetria.classList.remove('active');
            if (viewOlimpiadas) viewOlimpiadas.hidden = false;
            if (viewTelemetria) viewTelemetria.hidden = true;
        }
    }

    function renderTelemetryDashboard() {
        if (!window.CalendarioTelemetry) return;
        const analytics = window.CalendarioTelemetry.getObservatoryAnalytics();
        const kpi = analytics.kpi;

        // 1. Executive KPIs
        if (statTelemStudents) {
            statTelemStudents.textContent = kpi.uniqueStudents >= 30 ? kpi.uniqueStudents : `${kpi.uniqueStudents} (Trava k ≥ 30)`;
        }
        if (statTelemSwitches) statTelemSwitches.textContent = kpi.identitySwitchesCount || 0;
        if (statTelemSwitchRate && kpi.blockedAccessCount > 0) {
            const rate = Math.min(100, Math.round((kpi.identitySwitchesCount / (kpi.blockedAccessCount || 1)) * 100));
            statTelemSwitchRate.textContent = `Taxa de conversão: ${rate}%`;
        }
        if (statTelemBlocked) statTelemBlocked.textContent = kpi.blockedAccessCount || 0;
        if (statTelemPasses) statTelemPasses.textContent = kpi.borderPassesCount || 0;

        // 2. Ranking ao Vivo de Conteúdos & Olimpíadas
        if (tbodyRankingOlimpiadas) {
            const ranking = analytics.rankingList;
            if (!ranking || ranking.length === 0) {
                tbodyRankingOlimpiadas.innerHTML = `
                    <tr>
                        <td colspan="8" style="text-align: center; color: var(--label-3); padding: 1.5rem;">
                            Nenhum registro de interação coletado ainda.
                        </td>
                    </tr>
                `;
            } else {
                tbodyRankingOlimpiadas.innerHTML = ranking.map(item => `
                    <tr>
                        <td>
                            <strong>${item.sigla}</strong>
                            <div style="font-size: var(--t-caption); color: var(--label-2);">${item.name}</div>
                        </td>
                        <td>
                            <span class="${item.demandBadge}">
                                ${item.demandLevel}
                            </span>
                        </td>
                        <td><strong>${item.views}</strong></td>
                        <td><span style="color: var(--accent); font-weight: 700;">${Math.floor(item.avgActiveSec / 60)}m ${item.avgActiveSec % 60}s</span></td>
                        <td><small style="color: var(--label-2);">${Math.floor(item.avgBgSec / 60)}m ${item.avgBgSec % 60}s</small></td>
                        <td><span style="color: ${parseInt(item.abandonRate) > 30 ? 'var(--urgent)' : 'var(--label)'}; font-weight: 600;">${item.abandonRate}</span></td>
                        <td>
                            <div style="display: flex; align-items: center; gap: 0.4rem;">
                                <div style="flex: 1; height: 6px; background: var(--fill); border-radius: 999px; overflow: hidden; min-width: 3rem;">
                                    <div style="width: ${item.avgScrollPct}%; height: 100%; background: var(--accent);"></div>
                                </div>
                                <small>${item.avgScrollPct}%</small>
                            </div>
                        </td>
                        <td>
                            <span class="pill-tipo pill-tipo--prova">${item.actions} ações</span>
                        </td>
                    </tr>
                `).join('');
            }
        }

        // 3. Funil de Navegação (Sankey Steps)
        const fn = analytics.funnel;
        const base = Math.max(fn.step1_landing, 1);
        const p2 = Math.round((fn.step2_calendario / base) * 100);
        const p3 = Math.round((fn.step3_modal_details / base) * 100);
        const p4 = Math.round((fn.step4_provas_anteriores / base) * 100);
        const p5 = Math.round((fn.step5_download_action / base) * 100);

        const b2 = document.getElementById('bar-funnel-2');
        const b3 = document.getElementById('bar-funnel-3');
        const b4 = document.getElementById('bar-funnel-4');
        const b5 = document.getElementById('bar-funnel-5');

        if (b2) b2.style.width = `${Math.min(100, p2)}%`;
        if (b3) b3.style.width = `${Math.min(100, p3)}%`;
        if (b4) b4.style.width = `${Math.min(100, p4)}%`;
        if (b5) b5.style.width = `${Math.min(100, p5)}%`;

        const pct2 = document.getElementById('pct-funnel-2');
        const pct3 = document.getElementById('pct-funnel-3');
        const pct4 = document.getElementById('pct-funnel-4');
        const pct5 = document.getElementById('pct-funnel-5');

        if (pct2) pct2.textContent = `${p2}% (${fn.step2_calendario} alunos)`;
        if (pct3) pct3.textContent = `${p3}% (${fn.step3_modal_details} alunos)`;
        if (pct4) pct4.textContent = `${p4}% (${fn.step4_provas_anteriores} alunos)`;
        if (pct5) pct5.textContent = `${p5}% (${fn.step5_download_action} downloads)`;

        // 4. Relatório Territorial & Provedores
        if (listTopUfs) {
            const ufs = Object.entries(analytics.ufDist).sort((a, b) => b[1] - a[1]);
            if (ufs.length === 0) {
                listTopUfs.innerHTML = '<li><span>Nenhum estado registrado</span></li>';
            } else {
                listTopUfs.innerHTML = ufs.slice(0, 6).map(([uf, count]) => `
                    <li>
                        <span>Estado / Região: <strong>${uf}</strong></span>
                        <span class="val">${count} acessos</span>
                    </li>
                `).join('');
            }
        }

        if (listRealIsps) {
            const isps = Object.entries(analytics.realIsps).sort((a, b) => b[1] - a[1]);
            if (isps.length === 0) {
                listRealIsps.innerHTML = '<li><span>Nenhuma operadora registrada</span></li>';
            } else {
                listRealIsps.innerHTML = isps.slice(0, 5).map(([isp, count]) => `
                    <li>
                        <span><strong>${isp.length > 28 ? isp.substring(0, 28) + '…' : isp}</strong></span>
                        <span class="val">${count}</span>
                    </li>
                `).join('');
            }
        }

        if (listVpnProviders) {
            const vpns = Object.entries(analytics.vpnAsns).sort((a, b) => b[1] - a[1]);
            if (vpns.length === 0) {
                listVpnProviders.innerHTML = '<li><span style="color: var(--open);">Nenhuma VPN detectada</span></li>';
            } else {
                listVpnProviders.innerHTML = vpns.slice(0, 5).map(([vpn, count]) => `
                    <li>
                        <span><strong>${vpn.length > 28 ? vpn.substring(0, 28) + '…' : vpn}</strong></span>
                        <span class="val" style="color: var(--urgent);">${count} tentativas</span>
                    </li>
                `).join('');
            }
        }

        // 5. Tabela de Trocas de Identidade
        if (tbodyIdentitySwitches) {
            if (analytics.identitySwitches.length === 0) {
                tbodyIdentitySwitches.innerHTML = `
                    <tr>
                        <td colspan="6" style="text-align: center; color: var(--label-3); padding: 1.5rem;">
                            Nenhuma troca de identidade (VPN desligada) registrada nesta sessão.
                        </td>
                    </tr>
                `;
            } else {
                tbodyIdentitySwitches.innerHTML = analytics.identitySwitches.map(ev => `
                    <tr>
                        <td><code>${ev.student_hash || 'estudante_anon'}</code></td>
                        <td><strong style="color: var(--accent);">${ev.time_to_disable_vpn_sec}s</strong></td>
                        <td><span class="pill-tipo pill-tipo--prova">${ev.fake_country}</span> <small>${ev.fake_isp_asn}</small></td>
                        <td><span class="pill-tipo pill-tipo--inscricao">BR (${ev.real_uf || 'BR'})</span> <small>${ev.real_isp_asn}</small></td>
                        <td>${ev.device_type || 'Desktop'}</td>
                        <td><time>${ev.local_time || '—'}</time></td>
                    </tr>
                `).join('');
            }
        }

        // 6. Tabela de Bloqueios e Fronteira
        if (tbodyBlockedAccess) {
            const combined = [...analytics.blockedList, ...analytics.borderReports].sort((a, b) => b.timestamp_utc.localeCompare(a.timestamp_utc));
            if (combined.length === 0) {
                tbodyBlockedAccess.innerHTML = `
                    <tr>
                        <td colspan="7" style="text-align: center; color: var(--label-3); padding: 1.5rem;">
                            Nenhum bloqueio registrado recentemente.
                        </td>
                    </tr>
                `;
            } else {
                tbodyBlockedAccess.innerHTML = combined.map(ev => {
                    const isReport = ev.type === 'border_false_positive_report';
                    return `
                        <tr>
                            <td><code>${ev.student_hash || 'estudante_anon'}</code></td>
                            <td>
                                <span class="badge-status ${isReport ? 'badge-status--open' : 'badge-status--urgent'}">
                                    ${isReport ? 'Falso-Positivo Fronteira' : (ev.block_reason || 'Bloqueio')}
                                </span>
                            </td>
                            <td>${ev.blocked_country || ev.detected_country || '—'}</td>
                            <td><small>${ev.blocked_isp_asn || ev.detected_isp_asn || '—'}</small></td>
                            <td>${ev.user_claimed_city_uf || '—'}</td>
                            <td>
                                ${ev.temporary_pass_granted ? '<strong style="color: var(--open);">✓ Emitido (7d)</strong>' : '<span style="color: var(--label-3);">Não</span>'}
                            </td>
                            <td>
                                <button type="button" class="btn btn--tinted btn--small btn-whitelist-asn" data-asn="${ev.blocked_isp_asn || ev.detected_isp_asn || ''}">
                                    Homologar ASN
                                </button>
                            </td>
                        </tr>
                    `;
                }).join('');

                // Whitelist click handlers
                tbodyBlockedAccess.querySelectorAll('.btn-whitelist-asn').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const asn = btn.dataset.asn;
                        showToast(`Provedor ${asn} homologado na Whitelist de Fronteira!`, 'success');
                        btn.textContent = 'Homologado ✓';
                        btn.disabled = true;
                    });
                });
            }
        }

        // 7. Hardware & Desigualdade Digital
        if (statDeviceDist) {
            const d = analytics.devices;
            statDeviceDist.innerHTML = `
                Mobile: <strong>${d.Mobile || 0}</strong> • Desktop: <strong>${d.Desktop || 0}</strong> • Tablet: <strong>${d.Tablet || 0}</strong>
            `;
        }

        if (statRamDist) {
            const r = analytics.ramDist;
            statRamDist.innerHTML = `
                Entrada (&lt;4GB): <strong>${r['Menos de 4GB (Entrada)'] || 0}</strong> • 4GB-8GB: <strong>${r['4GB a 8GB (Intermediário)'] || 0}</strong> • &gt;8GB: <strong>${r['Mais de 8GB (Avançado)'] || 0}</strong>
            `;
        }

        if (statNetDist) {
            const n = analytics.netDist;
            statNetDist.innerHTML = `
                4G/5G: <strong>${n['4G / Rápida'] || 0}</strong> • 3G/Móvel: <strong>${n['3G / Móvel'] || 0}</strong> • Wi-Fi/Fibra: <strong>${n['Wi-Fi / Fibra'] || 0}</strong>
            `;
        }
    }

    if (tabNavOlimpiadas) tabNavOlimpiadas.addEventListener('click', () => switchAdminView('olimpiadas'));
    if (tabNavTelemetria) tabNavTelemetria.addEventListener('click', () => switchAdminView('telemetria'));

    if (btnSeedTelemetry) {
        btnSeedTelemetry.addEventListener('click', () => {
            if (window.CalendarioTelemetry) {
                const count = window.CalendarioTelemetry.seedObservatoryDemonstrationData();
                renderTelemetryDashboard();
                showToast(`Base demonstrativa com ${count} registros reais carregada com sucesso!`, 'success');
            }
        });
    }

    if (btnRefreshTelemetry) {
        btnRefreshTelemetry.addEventListener('click', () => {
            renderTelemetryDashboard();
            showToast('Dados do Observatório atualizados em tempo real.', 'info');
        });
    }

    if (btnExportTelemetry) btnExportTelemetry.addEventListener('click', () => {
        if (window.CalendarioTelemetry) window.CalendarioTelemetry.exportEventsJson();
    });

    if (btnClearTelemetry) btnClearTelemetry.addEventListener('click', () => {
        if (confirm('Deseja limpar todos os registros de telemetria desta sessão?')) {
            if (window.CalendarioTelemetry) window.CalendarioTelemetry.clearEvents();
            renderTelemetryDashboard();
            showToast('Histórico de telemetria limpo.', 'info');
        }
    });

    // Simulators
    if (simBtnUs) {
        simBtnUs.addEventListener('click', () => {
            if (window.CalendarioSecurity) {
                window.CalendarioSecurity.simulateGeo({ country: 'US', region: 'CA', city: 'Los Angeles', asn: 15169, isp: 'Google LLC Datacenter' });
            }
        });
    }
    if (simBtnVpn) {
        simBtnVpn.addEventListener('click', () => {
            if (window.CalendarioSecurity) {
                window.CalendarioSecurity.simulateGeo({ country: 'NL', region: 'NH', city: 'Amsterdam', asn: 9009, isp: 'M247 Ltd (ProtonVPN)' });
            }
        });
    }
    if (simBtnBorder) {
        simBtnBorder.addEventListener('click', () => {
            if (window.CalendarioSecurity) {
                window.CalendarioSecurity.simulateGeo({ country: 'PY', region: 'ASU', city: 'Ciudad del Este / Foz', asn: 27653, isp: 'Personal Paraguay (Fronteira)' });
            }
        });
    }
    if (simBtnReset) {
        simBtnReset.addEventListener('click', () => {
            if (window.CalendarioSecurity) {
                window.CalendarioSecurity.simulateGeo(null);
            }
        });
    }

    // ═══════════════════════════════════════════════════════
    // Boot
    // ═══════════════════════════════════════════════════════
    if (isAuthenticated()) {
        showAdminScreen();
        loadData();
    } else {
        showLoginScreen();
    }

})();
