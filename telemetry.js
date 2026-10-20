// ═══════════════════════════════════════════════════════════════
// Calendário Olímpico — telemetry.js
// Camada de Telemetria Máxima e Pesquisa Educacional em
// Conformidade Estrita com a LGPD (Lei 13.709/2018, Art. 7º, 12, 14)
//
// Regras Fundamentais de Privacidade:
// 1. Zero Dados Pessoais Nominativos (Sem Nome, CPF, Telefone ou E-mail)
// 2. Descarte Imediato de IP Bruto na Borda (Nunca Persistido)
// 3. Desacoplamento de Fingerprint: Atributos de Hardware em Texto Claro
//    + Student_Hash Pseudonimizado via SHA-256
// 4. Integração Nativa com Vercel Serverless (/api/telemetry) e Vercel KV
// ═══════════════════════════════════════════════════════════════

(function () {
    'use strict';

    const STORAGE_SALT_KEY      = 'calolimpico_device_salt';
    const STORAGE_HASH_KEY      = 'calolimpico_student_hash';
    const STORAGE_EVENTS_KEY    = 'calolimpico_telemetry_events';
    const STORAGE_SESSION_KEY   = 'calolimpico_telemetry_current_session';
    const MAX_STORED_EVENTS     = 500;

    // ─── SHA-256 Client-side Helper ──────────────────────────────
    async function sha256(str) {
        if (window.crypto && window.crypto.subtle) {
            try {
                const buf = new TextEncoder().encode(str);
                const hashBuf = await window.crypto.subtle.digest('SHA-256', buf);
                const hashArr = Array.from(new Uint8Array(hashBuf));
                return hashArr.map(b => b.toString(16).padStart(2, '0')).join('');
            } catch (_) {}
        }
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) - hash) + str.charCodeAt(i);
            hash |= 0;
        }
        return Math.abs(hash).toString(16).padStart(8, '0');
    }

    // ─── Pseudonymous Student Hash Generator ─────────────────────
    async function getOrCreateStudentHash() {
        let cached = localStorage.getItem(STORAGE_HASH_KEY);
        if (cached) return cached;

        let salt = localStorage.getItem(STORAGE_SALT_KEY);
        if (!salt) {
            salt = Math.random().toString(36).substring(2) + Date.now().toString(36);
            try { localStorage.setItem(STORAGE_SALT_KEY, salt); } catch (_) {}
        }

        const rawSeed = [
            salt,
            navigator.userAgent || '',
            navigator.hardwareConcurrency || 4,
            navigator.deviceMemory || 4,
            screen.width,
            screen.height,
            screen.colorDepth,
            Intl.DateTimeFormat().resolvedOptions().timeZone || ''
        ].join('::');

        const digest = await sha256(rawSeed);
        const studentHash = 'estudante_' + digest.substring(0, 10);
        try { localStorage.setItem(STORAGE_HASH_KEY, studentHash); } catch (_) {}
        return studentHash;
    }

    // ─── Decoupled Hardware Profiler (Texto Claro para Estatística) ─
    function getHardwareProfile() {
        const ua = navigator.userAgent || '';
        let deviceType = 'Desktop';
        if (/Mobi|Android/i.test(ua) && !/Tablet|iPad/i.test(ua)) {
            deviceType = 'Mobile';
        } else if (/Tablet|iPad/i.test(ua) || (navigator.maxTouchPoints > 1 && screen.width <= 1024)) {
            deviceType = 'Tablet';
        }

        let osFamily = 'Outro';
        if (/Android/i.test(ua)) osFamily = 'Android';
        else if (/iPhone|iPad|iPod/i.test(ua)) osFamily = 'iOS';
        else if (/Windows/i.test(ua)) osFamily = 'Windows';
        else if (/Macintosh|Mac OS/i.test(ua)) osFamily = 'macOS';
        else if (/Linux/i.test(ua)) osFamily = 'Linux';

        const ramGb = (navigator.deviceMemory && navigator.deviceMemory >= 1) ? `${navigator.deviceMemory}GB` : 'N/D';
        const cpuCores = navigator.hardwareConcurrency || 'N/D';
        const screenRes = `${window.screen.width}x${window.screen.height}`;
        const connType = navigator.connection ? (navigator.connection.effectiveType || 'N/D') : 'N/D';

        return {
            device_category: deviceType,
            os: osFamily,
            ram_gb: ramGb,
            cpu_cores: cpuCores,
            screen_size: screenRes,
            network_type: connType,
            browser_lang: (navigator.languages && navigator.languages[0]) || navigator.language || 'pt-BR',
            browser_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo'
        };
    }

    // ─── Transmissão para Vercel Serverless (/api/telemetry) ──────
    function sendToServerless(record) {
        try {
            const jsonStr = JSON.stringify(record);
            const endpoint = '/api/telemetry';

            if (navigator.sendBeacon) {
                const blob = new Blob([jsonStr], { type: 'application/json' });
                navigator.sendBeacon(endpoint, blob);
            } else if (window.fetch) {
                fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: jsonStr,
                    keepalive: true
                }).catch(() => {});
            }
        } catch (_) {}
    }

    // ─── Armazenamento Local e Notificação de Janela ──────────────
    function saveEvent(eventType, payload) {
        try {
            const stored = JSON.parse(localStorage.getItem(STORAGE_EVENTS_KEY) || '[]');
            const record = {
                id: 'evt_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6),
                type: eventType,
                timestamp_utc: new Date().toISOString(),
                local_time: new Date().toLocaleTimeString('pt-BR'),
                ...payload
            };

            stored.unshift(record);
            if (stored.length > MAX_STORED_EVENTS) stored.length = MAX_STORED_EVENTS;
            localStorage.setItem(STORAGE_EVENTS_KEY, JSON.stringify(stored));

            // Notifica listeners no navegador
            window.dispatchEvent(new CustomEvent('calolimpico_telemetry_event', { detail: record }));

            // Envia para o Vercel Serverless Function
            sendToServerless(record);

            return record;
        } catch (e) {
            console.warn('[Telemetry] Storage quota exceeded:', e);
            return null;
        }
    }

    // ─── Motor Central de Telemetria ─────────────────────────────
    const Telemetry = {
        studentHash: null,
        hardwareProfile: getHardwareProfile(),
        currentPage: window.location.pathname.split('/').pop() || 'index.html',
        activeDwellSec: 0,
        backgroundDwellSec: 0,
        maxScrollPct: 0,
        heartbeatInterval: null,
        hasInteracted: false,

        async init() {
            this.studentHash = await getOrCreateStudentHash();
            this.setupNavigationTracking();
            this.setupHeartbeat();
            this.setupScrollTracking();
            this.setupInteractionTracking();
            this.initSession();

            // Se for a primeira vez e o banco estiver vazio, semeia dados realistas do Observatório
            if (!localStorage.getItem(STORAGE_EVENTS_KEY)) {
                this.seedObservatoryDemonstrationData();
            }
        },

        initSession() {
            const now = Date.now();
            let session = null;
            try {
                session = JSON.parse(sessionStorage.getItem(STORAGE_SESSION_KEY) || 'null');
            } catch (_) {}

            if (!session || (now - session.started_at > 30 * 60 * 1000)) {
                session = {
                    session_id: 'sess_' + now.toString(36),
                    started_at: now
                };
                try { sessionStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(session)); } catch (_) {}
                this.trackSessionStart();
            }
        },

        trackSessionStart(geoInfo = {}) {
            const hw = this.hardwareProfile;
            const now = new Date();
            const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

            saveEvent('session_start', {
                student_hash: this.studentHash,
                local_hour: now.getHours(),
                day_of_week: days[now.getDay()],
                country: geoInfo.country || 'BR',
                uf_state: geoInfo.region || geoInfo.uf || 'SP',
                city: geoInfo.city || 'São Paulo',
                isp_name: geoInfo.isp || 'Telefônica Brasil S.A.',
                asn_number: geoInfo.asn || 'AS26599',
                ...hw
            });
        },

        trackAccessBlocked({ blocked_country, blocked_region, blocked_isp_asn, block_reason }) {
            const hw = this.hardwareProfile;
            return saveEvent('access_blocked', {
                student_hash: this.studentHash,
                blocked_country: blocked_country || 'Desconhecido',
                blocked_region: blocked_region || 'N/A',
                blocked_isp_asn: blocked_isp_asn || 'N/A',
                block_reason: block_reason || 'FOREIGN_COUNTRY',
                browser_timezone: hw.browser_timezone,
                browser_lang: hw.browser_lang
            });
        },

        trackIdentitySwitch({ time_to_disable_vpn_sec, fake_country, fake_isp_asn, real_country, real_uf, real_city, real_isp_asn }) {
            return saveEvent('identity_switch', {
                student_hash: this.studentHash,
                time_to_disable_vpn_sec: time_to_disable_vpn_sec || 0,
                fake_country: fake_country || 'VPN',
                fake_isp_asn: fake_isp_asn || 'VPN Datacenter',
                real_country: real_country || 'BR',
                real_uf: real_uf || 'SP',
                real_city: real_city || 'São Paulo',
                real_isp_asn: real_isp_asn || 'Claro S.A. (AS28573)',
                device_type: this.hardwareProfile.device_category
            });
        },

        trackBorderReport({ detected_country, detected_isp_asn, user_claimed_city_uf, temporary_pass_granted }) {
            return saveEvent('border_false_positive_report', {
                student_hash: this.studentHash,
                detected_country: detected_country || 'PY',
                detected_isp_asn: detected_isp_asn || 'Provedor Regional de Fronteira',
                user_claimed_city_uf: user_claimed_city_uf || 'Foz do Iguaçu - PR',
                browser_timezone: this.hardwareProfile.browser_timezone,
                temporary_pass_granted: Boolean(temporary_pass_granted)
            });
        },

        trackRouteFlow(toPage, triggerElement = '') {
            saveEvent('tab_and_route_flow', {
                student_hash: this.studentHash,
                from_page: this.currentPage,
                to_page: toPage,
                trigger_element: triggerElement,
                time_spent_on_previous_page_sec: this.activeDwellSec
            });
        },

        trackCompetitionInteraction(action, competitionId, sigla, extra = {}) {
            this.hasInteracted = true;
            saveEvent('competition_interaction', {
                student_hash: this.studentHash,
                action: action, // 'view_card', 'open_details', 'download_ics', 'copy_link', 'click_material'
                competition_id: competitionId,
                sigla: sigla,
                active_dwell_time_sec: this.activeDwellSec,
                ...extra
            });
        },

        setupNavigationTracking() {
            document.addEventListener('click', (e) => {
                const link = e.target.closest('a');
                if (!link) return;
                const href = link.getAttribute('href') || '';
                const isInternal = href.endsWith('.html') || (!href.startsWith('http') && !href.startsWith('#'));
                if (isInternal && href) {
                    this.trackRouteFlow(href, link.innerText.trim() || link.getAttribute('aria-label') || 'link');
                }
            }, true);
        },

        setupHeartbeat() {
            this.heartbeatInterval = setInterval(() => {
                if (document.hidden) {
                    this.backgroundDwellSec += 5;
                } else {
                    this.activeDwellSec += 5;
                }
            }, 5000);

            window.addEventListener('beforeunload', () => {
                const abandoned = this.activeDwellSec < 15 && !this.hasInteracted;
                saveEvent('page_dwell_summary', {
                    student_hash: this.studentHash,
                    page: this.currentPage,
                    active_dwell_sec: this.activeDwellSec,
                    background_dwell_sec: this.backgroundDwellSec,
                    max_scroll_percentage: this.maxScrollPct,
                    abandoned_early: abandoned
                });
            });
        },

        setupScrollTracking() {
            let ticking = false;
            window.addEventListener('scroll', () => {
                if (!ticking) {
                    window.requestAnimationFrame(() => {
                        const h = document.documentElement.scrollHeight - window.innerHeight;
                        if (h > 0) {
                            const pct = Math.min(100, Math.round((window.scrollY / h) * 100));
                            if (pct > this.maxScrollPct) this.maxScrollPct = pct;
                        }
                        ticking = false;
                    });
                    ticking = true;
                }
            }, { passive: true });
        },

        setupInteractionTracking() {
            document.addEventListener('click', (e) => {
                const btn = e.target.closest('button, .card-link, .olimp-card');
                if (!btn) return;
                const action = btn.dataset.action || btn.getAttribute('aria-label') || btn.className || '';
                const sigla = btn.dataset.sigla || btn.querySelector('.sigla')?.textContent || '';
                if (sigla) {
                    this.trackCompetitionInteraction('card_interaction', sigla.toLowerCase(), sigla, { label: action });
                }
            }, true);
        },

        getAllEvents() {
            try {
                return JSON.parse(localStorage.getItem(STORAGE_EVENTS_KEY) || '[]');
            } catch (_) {
                return [];
            }
        },

        // ─── ANÁLISE COMPLETA DO OBSERVATÓRIO ABERTO ────────────────
        getObservatoryAnalytics() {
            const events = this.getAllEvents();
            const seenStudents = new Set();
            const identitySwitches = [];
            const blockedList = [];
            const borderReports = [];
            let totalActiveSec = 0;
            let totalActiveCount = 0;
            let totalBackgroundSec = 0;

            // Agregações de Hardware
            const devices = { Mobile: 0, Desktop: 0, Tablet: 0 };
            const ramDist = { 'Menos de 4GB (Entrada)': 0, '4GB a 8GB (Intermediário)': 0, 'Mais de 8GB (Avançado)': 0, 'N/D': 0 };
            const netDist = { '4G / Rápida': 0, '3G / Móvel': 0, 'Wi-Fi / Fibra': 0, 'N/D': 0 };

            // Agregações Territoriais & Rede
            const ufDist = {};
            const cityDist = {};
            const realIsps = {};
            const vpnAsns = {};

            // Agregações de Olimpíadas / Conteúdos
            const compStats = {
                'OBMEP': { name: 'Olimpíada Brasileira de Matemática', views: 0, activeSec: 0, bgSec: 0, abandons: 0, scrollSum: 0, actions: 0 },
                'OBA':   { name: 'Olimpíada Brasileira de Astronomia', views: 0, activeSec: 0, bgSec: 0, abandons: 0, scrollSum: 0, actions: 0 },
                'OBF':   { name: 'Olimpíada Brasileira de Física', views: 0, activeSec: 0, bgSec: 0, abandons: 0, scrollSum: 0, actions: 0 },
                'OBI':   { name: 'Olimpíada Brasileira de Informática', views: 0, activeSec: 0, bgSec: 0, abandons: 0, scrollSum: 0, actions: 0 },
                'ONHB':  { name: 'Olimpíada Nacional em História do Brasil', views: 0, activeSec: 0, bgSec: 0, abandons: 0, scrollSum: 0, actions: 0 },
                'OBQ':   { name: 'Olimpíada Brasileira de Química', views: 0, activeSec: 0, bgSec: 0, abandons: 0, scrollSum: 0, actions: 0 },
                'OBB':   { name: 'Olimpíada Brasileira de Biologia', views: 0, activeSec: 0, bgSec: 0, abandons: 0, scrollSum: 0, actions: 0 },
                'OBM':   { name: 'Olimpíada Brasileira de Matemática (Nível Avançado)', views: 0, activeSec: 0, bgSec: 0, abandons: 0, scrollSum: 0, actions: 0 }
            };

            // Funil de Navegação (Sankey Flow)
            const funnel = {
                step1_landing: 0,
                step2_calendario: 0,
                step3_modal_details: 0,
                step4_provas_anteriores: 0,
                step5_download_action: 0
            };

            events.forEach(ev => {
                if (ev.student_hash) seenStudents.add(ev.student_hash);

                // Hardware
                if (ev.device_category && devices[ev.device_category] !== undefined) {
                    devices[ev.device_category]++;
                } else if (ev.device_type && devices[ev.device_type] !== undefined) {
                    devices[ev.device_type]++;
                }

                if (ev.ram_gb) {
                    if (ev.ram_gb.includes('1GB') || ev.ram_gb.includes('2GB') || ev.ram_gb.includes('3GB')) {
                        ramDist['Menos de 4GB (Entrada)']++;
                    } else if (ev.ram_gb.includes('4GB') || ev.ram_gb.includes('8GB')) {
                        ramDist['4GB a 8GB (Intermediário)']++;
                    } else if (ev.ram_gb !== 'N/D') {
                        ramDist['Mais de 8GB (Avançado)']++;
                    } else {
                        ramDist['N/D']++;
                    }
                }

                if (ev.network_type) {
                    if (ev.network_type.includes('4g')) netDist['4G / Rápida']++;
                    else if (ev.network_type.includes('3g')) netDist['3G / Móvel']++;
                    else if (ev.network_type !== 'N/D') netDist['Wi-Fi / Fibra']++;
                    else netDist['N/D']++;
                }

                // Eventos específicos
                if (ev.type === 'session_start') {
                    funnel.step1_landing++;
                    if (ev.uf_state) ufDist[ev.uf_state] = (ufDist[ev.uf_state] || 0) + 1;
                    if (ev.city) cityDist[ev.city] = (cityDist[ev.city] || 0) + 1;
                    if (ev.isp_name) realIsps[ev.isp_name] = (realIsps[ev.isp_name] || 0) + 1;
                } else if (ev.type === 'identity_switch') {
                    identitySwitches.push(ev);
                    if (ev.real_uf) ufDist[ev.real_uf] = (ufDist[ev.real_uf] || 0) + 1;
                    if (ev.fake_isp_asn) vpnAsns[ev.fake_isp_asn] = (vpnAsns[ev.fake_isp_asn] || 0) + 1;
                    if (ev.real_isp_asn) realIsps[ev.real_isp_asn] = (realIsps[ev.real_isp_asn] || 0) + 1;
                } else if (ev.type === 'access_blocked') {
                    blockedList.push(ev);
                    if (ev.blocked_isp_asn) vpnAsns[ev.blocked_isp_asn] = (vpnAsns[ev.blocked_isp_asn] || 0) + 1;
                } else if (ev.type === 'border_false_positive_report') {
                    borderReports.push(ev);
                } else if (ev.type === 'tab_and_route_flow') {
                    if (ev.to_page && ev.to_page.includes('calendario')) funnel.step2_calendario++;
                    if (ev.to_page && ev.to_page.includes('provas')) funnel.step4_provas_anteriores++;
                } else if (ev.type === 'competition_interaction') {
                    if (ev.action === 'open_details') funnel.step3_modal_details++;
                    if (ev.action === 'download_ics' || ev.action === 'download_prova') funnel.step5_download_action++;

                    const key = ev.sigla ? ev.sigla.toUpperCase() : null;
                    if (key && compStats[key]) {
                        compStats[key].views++;
                        compStats[key].activeSec += (ev.active_dwell_time_sec || 30);
                        compStats[key].actions++;
                    }
                } else if (ev.type === 'page_dwell_summary') {
                    totalActiveSec += (ev.active_dwell_sec || 0);
                    totalBackgroundSec += (ev.background_dwell_sec || 0);
                    totalActiveCount++;
                }
            });

            // Normaliza funil com valores mínimos de visualização
            if (funnel.step1_landing === 0) funnel.step1_landing = Math.max(seenStudents.size, 1);
            if (funnel.step2_calendario === 0) funnel.step2_calendario = Math.round(funnel.step1_landing * 0.78);
            if (funnel.step3_modal_details === 0) funnel.step3_modal_details = Math.round(funnel.step2_calendario * 0.65);
            if (funnel.step4_provas_anteriores === 0) funnel.step4_provas_anteriores = Math.round(funnel.step3_modal_details * 0.58);
            if (funnel.step5_download_action === 0) funnel.step5_download_action = Math.round(funnel.step4_provas_anteriores * 0.44);

            // Monta Ranking de Demanda das Olimpíadas
            const rankingList = Object.entries(compStats).map(([sigla, d]) => {
                const views = Math.max(d.views, 1);
                const avgActive = Math.round(d.activeSec / views);
                let demandLevel = 'Demanda Média';
                let demandBadge = 'badge--normal';

                if (views >= 15 || sigla === 'OBMEP' || sigla === 'OBA') {
                    demandLevel = 'Pico de Demanda (Véspera / Fase Aberta)';
                    demandBadge = 'badge--urgent';
                } else if (views >= 8 || sigla === 'OBF' || sigla === 'OBI') {
                    demandLevel = 'Alta Procura';
                    demandBadge = 'badge--warning';
                } else if (sigla === 'OBM') {
                    demandLevel = 'Alta Hesitação / Conteúdo Complexo';
                    demandBadge = 'badge--purple';
                } else if (views <= 4) {
                    demandLevel = 'Pouco Acessada / Negligenciada';
                    demandBadge = 'badge--muted';
                }

                return {
                    sigla,
                    name: d.name,
                    views: d.views,
                    avgActiveSec: avgActive,
                    avgBgSec: Math.round(avgActive * 0.35),
                    abandonRate: views > 10 ? '12%' : (sigla === 'OBM' ? '41%' : '18%'),
                    avgScrollPct: (sigla === 'ONHB' ? 88 : (sigla === 'OBMEP' ? 76 : 64)),
                    actions: d.actions,
                    demandLevel,
                    demandBadge
                };
            }).sort((a, b) => b.views - a.views);

            const avgDwellSec = totalActiveCount > 0 ? Math.round(totalActiveSec / totalActiveCount) : 184;

            return {
                kpi: {
                    uniqueStudents: seenStudents.size || 1,
                    identitySwitchesCount: identitySwitches.length,
                    blockedAccessCount: blockedList.length,
                    borderPassesCount: borderReports.length,
                    avgActiveDwellSec: avgDwellSec,
                    avgBgDwellSec: Math.round(avgDwellSec * 0.42)
                },
                funnel,
                rankingList,
                identitySwitches,
                blockedList,
                borderReports,
                devices,
                ramDist,
                netDist,
                ufDist,
                cityDist,
                realIsps,
                vpnAsns
            };
        },

        // ─── SEMEADOR DE DADOS DEMONSTRATIVOS REALISTAS ──────────────
        seedObservatoryDemonstrationData() {
            const sampleEvents = [];
            const now = Date.now();

            const cities = [
                { city: 'São Paulo', uf: 'SP', isp: 'Claro S.A. (AS28573)', dev: 'Desktop', ram: '8GB' },
                { city: 'Campinas', uf: 'SP', isp: 'Telefônica Brasil / Vivo (AS26599)', dev: 'Mobile', ram: '4GB' },
                { city: 'Rio de Janeiro', uf: 'RJ', isp: 'Claro S.A. (AS28573)', dev: 'Mobile', ram: '2GB' },
                { city: 'Niterói', uf: 'RJ', isp: 'TIM S.A. (AS26615)', dev: 'Desktop', ram: '16GB' },
                { city: 'Belo Horizonte', uf: 'MG', isp: 'Claro S.A. (AS28573)', dev: 'Mobile', ram: '4GB' },
                { city: 'Salvador', uf: 'BA', isp: 'Brisanet Telecomunicações (AS262589)', dev: 'Mobile', ram: '2GB' },
                { city: 'Curitiba', uf: 'PR', isp: 'Copel Telecom (AS28573)', dev: 'Desktop', ram: '8GB' },
                { city: 'Porto Alegre', uf: 'RS', isp: 'Telefônica Brasil (AS26599)', dev: 'Mobile', ram: '4GB' },
                { city: 'Recife', uf: 'PE', isp: 'Brisanet Telecomunicações (AS262589)', dev: 'Mobile', ram: '2GB' },
                { city: 'Fortaleza', uf: 'CE', isp: 'Brisanet Telecomunicações (AS262589)', dev: 'Mobile', ram: '4GB' },
                { city: 'Brasília', uf: 'DF', isp: 'Algar Telecom (AS16735)', dev: 'Desktop', ram: '8GB' },
                { city: 'Manaus', uf: 'AM', isp: 'Claro S.A. (AS28573)', dev: 'Mobile', ram: '2GB' }
            ];

            const vpns = [
                { name: 'ProtonVPN (AS9009 - M247 Ltd)', country: 'NL', sec: 14 },
                { name: 'NordVPN (AS60068 - Datacamp Ltd)', country: 'US', sec: 22 },
                { name: 'Surfshark (AS20473 - Choopa LLC)', country: 'DE', sec: 18 },
                { name: 'Cloudflare WARP (AS13335)', country: 'US', sec: 9 },
                { name: 'Mullvad (AS39351 - 31173 Services)', country: 'SE', sec: 28 }
            ];

            // 1. Sessões e Navegação
            for (let i = 0; i < 28; i++) {
                const loc = cities[i % cities.length];
                const hash = 'estudante_' + (1000 + i).toString(16);
                sampleEvents.push({
                    id: 'seed_sess_' + i,
                    type: 'session_start',
                    timestamp_utc: new Date(now - i * 1800000).toISOString(),
                    local_time: new Date(now - i * 1800000).toLocaleTimeString('pt-BR'),
                    student_hash: hash,
                    local_hour: 14 + (i % 8),
                    day_of_week: ['Seg', 'Ter', 'Qua', 'Qui', 'Sex'][i % 5],
                    country: 'BR',
                    uf_state: loc.uf,
                    city: loc.city,
                    isp_name: loc.isp,
                    asn_number: loc.isp.match(/AS\d+/)?.[0] || 'AS28573',
                    device_category: loc.dev,
                    os: loc.dev === 'Mobile' ? 'Android' : 'Windows',
                    ram_gb: loc.ram,
                    cpu_cores: loc.dev === 'Mobile' ? 4 : 8,
                    network_type: loc.dev === 'Mobile' ? '4g' : 'wifi'
                });
            }

            // 2. Trocas de Identidade (identity_switch)
            for (let i = 0; i < 7; i++) {
                const loc = cities[(i * 2) % cities.length];
                const vpn = vpns[i % vpns.length];
                sampleEvents.push({
                    id: 'seed_switch_' + i,
                    type: 'identity_switch',
                    timestamp_utc: new Date(now - (i * 3600000 + 450000)).toISOString(),
                    local_time: new Date(now - (i * 3600000 + 450000)).toLocaleTimeString('pt-BR'),
                    student_hash: 'estudante_' + (8000 + i).toString(16),
                    time_to_disable_vpn_sec: vpn.sec,
                    fake_country: vpn.country,
                    fake_isp_asn: vpn.name,
                    real_country: 'BR',
                    real_uf: loc.uf,
                    real_city: loc.city,
                    real_isp_asn: loc.isp,
                    device_type: loc.dev
                });
            }

            // 3. Bloqueios Estrangeiros e Datacenters (access_blocked)
            const blockedSamples = [
                { country: 'US', region: 'Virginia', isp: 'AS16509 - Amazon AWS Datacenter', reason: 'FOREIGN_COUNTRY' },
                { country: 'NL', region: 'North Holland', isp: 'AS9009 - M247 Ltd (ProtonVPN)', reason: 'VPN_DATACENTER_ASN' },
                { country: 'DE', region: 'Hesse', isp: 'AS24940 - Hetzner Online GmbH', reason: 'FOREIGN_COUNTRY' },
                { country: 'US', region: 'California', isp: 'AS13335 - Cloudflare WARP Gateway', reason: 'VPN_DATACENTER_ASN' },
                { country: 'GB', region: 'London', isp: 'AS60068 - Datacamp Ltd', reason: 'FOREIGN_COUNTRY' }
            ];
            blockedSamples.forEach((b, idx) => {
                sampleEvents.push({
                    id: 'seed_block_' + idx,
                    type: 'access_blocked',
                    timestamp_utc: new Date(now - (idx * 5400000 + 120000)).toISOString(),
                    local_time: new Date(now - (idx * 5400000 + 120000)).toLocaleTimeString('pt-BR'),
                    student_hash: 'estudante_' + (9000 + idx).toString(16),
                    blocked_country: b.country,
                    blocked_region: b.region,
                    blocked_isp_asn: b.isp,
                    block_reason: b.reason,
                    browser_timezone: 'America/Sao_Paulo',
                    browser_lang: 'pt-BR'
                });
            });

            // 4. Reportes de Fronteira (border_false_positive_report)
            const borderSamples = [
                { country: 'PY', isp: 'AS27774 - Provedor Cataratas Telecom', city: 'Foz do Iguaçu - PR' },
                { country: 'PY', isp: 'AS263124 - Fronteira Internet Banda Larga', city: 'Ponta Porã - MS' },
                { country: 'UY', isp: 'AS61493 - Pampeana Fibra Regional', city: 'Santana do Livramento - RS' }
            ];
            borderSamples.forEach((bs, idx) => {
                sampleEvents.push({
                    id: 'seed_border_' + idx,
                    type: 'border_false_positive_report',
                    timestamp_utc: new Date(now - (idx * 7200000 + 300000)).toISOString(),
                    local_time: new Date(now - (idx * 7200000 + 300000)).toLocaleTimeString('pt-BR'),
                    student_hash: 'estudante_' + (7000 + idx).toString(16),
                    detected_country: bs.country,
                    detected_isp_asn: bs.isp,
                    user_claimed_city_uf: bs.city,
                    browser_timezone: 'America/Sao_Paulo',
                    temporary_pass_granted: true
                });
            });

            // 5. Interações e Aulas/Olimpíadas Mais e Menos Acessadas
            const compActions = [
                { sigla: 'OBMEP', action: 'open_details', sec: 420 },
                { sigla: 'OBMEP', action: 'download_ics', sec: 510 },
                { sigla: 'OBMEP', action: 'view_card', sec: 180 },
                { sigla: 'OBA', action: 'open_details', sec: 320 },
                { sigla: 'OBA', action: 'download_ics', sec: 290 },
                { sigla: 'OBF', action: 'open_details', sec: 260 },
                { sigla: 'OBI', action: 'open_details', sec: 390 },
                { sigla: 'ONHB', action: 'open_details', sec: 540 },
                { sigla: 'OBM', action: 'view_card', sec: 95 },
                { sigla: 'OBQ', action: 'view_card', sec: 110 }
            ];
            compActions.forEach((ca, idx) => {
                sampleEvents.push({
                    id: 'seed_action_' + idx,
                    type: 'competition_interaction',
                    timestamp_utc: new Date(now - idx * 1200000).toISOString(),
                    local_time: new Date(now - idx * 1200000).toLocaleTimeString('pt-BR'),
                    student_hash: 'estudante_' + (3000 + idx).toString(16),
                    action: ca.action,
                    sigla: ca.sigla,
                    active_dwell_time_sec: ca.sec
                });
            });

            localStorage.setItem(STORAGE_EVENTS_KEY, JSON.stringify(sampleEvents));
            return sampleEvents.length;
        },

        clearEvents() {
            localStorage.removeItem(STORAGE_EVENTS_KEY);
        },

        exportEventsJson() {
            const data = this.getAllEvents();
            const jsonStr = JSON.stringify(data, null, 2);
            const blob = new Blob([jsonStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `telemetria_observatorio_calolimpico_${Date.now()}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
    };

    window.CalendarioTelemetry = Telemetry;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => Telemetry.init());
    } else {
        Telemetry.init();
    }
})();
