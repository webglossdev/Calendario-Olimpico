// ═══════════════════════════════════════════════════════════════
// Calendário Olímpico — security.js
// Solução Problema 4: Bloqueio Geográfico, Detecção de VPN e
// Mecanismo de Rastreamento de "Troca de Identidade" (identity_switch)
// com Tratamento Anti-Injustiça para Regiões de Fronteira.
// ═══════════════════════════════════════════════════════════════

(function () {
    'use strict';

    const PENDING_SWITCH_KEY = 'pending_vpn_switch';
    const BORDER_PASS_KEY    = 'calolimpico_border_pass';
    const SIMULATED_GEO_KEY  = 'calolimpico_simulated_geo';
    const PASS_VALIDITY_DAYS = 7;
    const SWITCH_WINDOW_MS   = 15 * 60 * 1000; // 15 minutes correlation window

    // Known Datacenter / VPN ASNs (M247, Choopa, Datacamp, Nord, Proton, Surfshark, AWS, GCP, Tor, Cloudflare WARP)
    const KNOWN_VPN_ASNS = new Set([
        9009,   // M247 Ltd (Proton, Surfshark, etc.)
        20473,  // Choopa / The Constant Company (Vultr)
        209242, // Cloudflare WARP
        60068,  // Datacamp Limited
        16276,  // OVH SAS
        14061,  // DigitalOcean
        16509,  // Amazon AWS
        15169,  // Google Cloud
        13335,  // Cloudflare Datacenter
        396982, // Google Cloud Enterprise
        212238, // Datacamp Europe
        206092, // NordVPN Infrastructure
        51852,  // Private Internet Access
        62240   // Clouvider
    ]);

    // Brazilian Frontier Cities list for instant relief form
    const FRONTIER_CITIES = [
        { city: 'Foz do Iguaçu', uf: 'PR', country_border: 'Paraguai / Argentina' },
        { city: 'Ponta Porã', uf: 'MS', country_border: 'Paraguai' },
        { city: 'Corumbá', uf: 'MS', country_border: 'Bolívia' },
        { city: 'Santana do Livramento', uf: 'RS', country_border: 'Uruguai' },
        { city: 'Uruguaiana', uf: 'RS', country_border: 'Argentina' },
        { city: 'Jaguarão', uf: 'RS', country_border: 'Uruguai' },
        { city: 'Chuí', uf: 'RS', country_border: 'Uruguai' },
        { city: 'Tabatinga', uf: 'AM', country_border: 'Colômbia / Peru' },
        { city: 'Pacaraima', uf: 'RR', country_border: 'Venezuela' },
        { city: 'Epitaciolândia / Brasiléia', uf: 'AC', country_border: 'Bolívia' },
        { city: 'Guajará-Mirim', uf: 'RO', country_border: 'Bolívia' },
        { city: 'Outra Cidade de Fronteira', uf: 'BR', country_border: 'América do Sul' }
    ];

    // Brazilian Timezone validation
    const BRAZIL_TIMEZONES = new Set([
        'America/Sao_Paulo',
        'America/Campo_Grande',
        'America/Cuiaba',
        'America/Manaus',
        'America/Belem',
        'America/Fortaleza',
        'America/Recife',
        'America/Porto_Velho',
        'America/Rio_Branco',
        'America/Boa_Vista',
        'America/Maceio',
        'America/Bahia',
        'America/Noronha',
        'America/Araguaina',
        'America/Santarem'
    ]);

    // ─── Helpers ─────────────────────────────────────────────────
    function getCookie(name) {
        const match = document.cookie.match(new RegExp('(^|;\\s*)(' + name + ')=([^;]*)'));
        return match ? decodeURIComponent(match[3]) : null;
    }

    function setCookie(name, value, days) {
        const expires = new Date(Date.now() + days * 864e5).toUTCString();
        document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
    }

    // ─── Border Pass Management ──────────────────────────────────
    function getActiveBorderPass() {
        try {
            const raw = localStorage.getItem(BORDER_PASS_KEY) || getCookie(BORDER_PASS_KEY);
            if (!raw) return null;
            const pass = JSON.parse(raw);
            if (pass.expires_at && pass.expires_at > Date.now()) {
                return pass;
            }
            // Expired
            localStorage.removeItem(BORDER_PASS_KEY);
        } catch (_) {}
        return null;
    }

    function issueBorderPass(cityName, uf) {
        const expiresAt = Date.now() + (PASS_VALIDITY_DAYS * 24 * 60 * 60 * 1000);
        const pass = {
            id: 'pass_' + Math.random().toString(36).substring(2, 9),
            issued_at: Date.now(),
            expires_at: expiresAt,
            city: cityName,
            uf: uf,
            reason: 'FRONTIER_VERIFIED'
        };
        const passJson = JSON.stringify(pass);
        try {
            localStorage.setItem(BORDER_PASS_KEY, passJson);
            setCookie(BORDER_PASS_KEY, passJson, PASS_VALIDITY_DAYS);
        } catch (_) {}
        return pass;
    }

    // ─── Geo Probe & Headers Reader ──────────────────────────────
    async function resolveNetworkGeo() {
        // 1. Check for manual developer/admin simulation in localStorage
        const sim = localStorage.getItem(SIMULATED_GEO_KEY);
        if (sim) {
            try { return JSON.parse(sim); } catch (_) {}
        }

        // 2. Check injected Cloudflare/Vercel headers or Vercel Edge route (/api/geo)
        if (window.__CF_GEO) {
            return window.__CF_GEO;
        }

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 1800);
            const resEdge = await fetch('/api/geo', {
                signal: controller.signal,
                headers: { 'Accept': 'application/json' }
            });
            clearTimeout(timeoutId);
            if (resEdge.ok) {
                const dataEdge = await resEdge.json();
                if (dataEdge && dataEdge.country) {
                    return {
                        country: dataEdge.country,
                        region: dataEdge.region || 'SP',
                        city: dataEdge.city || 'São Paulo',
                        asn: dataEdge.asn ? parseInt(String(dataEdge.asn).replace(/\D/g, ''), 10) : 28573,
                        isp: dataEdge.isp || 'Operadora Nacional',
                        ip: 'ANONYMIZED_AT_EDGE'
                    };
                }
            }
        } catch (_) {}

        // 3. Fallback client probe via Cloudflare trace endpoint
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2500);

            const res = await fetch('https://speed.cloudflare.com/meta', {
                signal: controller.signal,
                headers: { 'Accept': 'application/json' }
            });
            clearTimeout(timeoutId);

            if (res.ok) {
                const data = await res.json();
                return {
                    country: data.country || 'BR',
                    region: data.region || 'SP',
                    city: data.city || 'São Paulo',
                    asn: data.asn ? parseInt(data.asn, 10) : 28573,
                    isp: data.asOrganization || 'Operadora Brasileira',
                    ip: 'ANONYMIZED_AT_EDGE'
                };
            }
        } catch (_) {}

        // 4. Fallback inference from browser signals
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
        const lang = (navigator.languages && navigator.languages[0]) || navigator.language || '';
        const isLikelyBr = BRAZIL_TIMEZONES.has(tz) || lang.includes('pt');

        return {
            country: isLikelyBr ? 'BR' : 'US',
            region: isLikelyBr ? 'SP' : 'CA',
            city: isLikelyBr ? 'São Paulo' : 'San Francisco',
            asn: isLikelyBr ? 28573 : 15169,
            isp: isLikelyBr ? 'Provedora Residencial Brasil' : 'Datacenter Proxy',
            ip: 'ANONYMIZED_AT_EDGE'
        };
    }

    // ─── Restriction Modal Renderer ──────────────────────────────
    function showRestrictedModal({ country, asn, isp, reason }) {
        // Remove previous instance if any
        const existing = document.getElementById('territorial-block-modal');
        if (existing) existing.remove();

        const isVpn = reason === 'VPN_ASN_DETECTED';
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Desconhecido';
        const isTzBrazil = BRAZIL_TIMEZONES.has(tz);

        const modalHtml = `
            <div id="territorial-block-modal" class="scrim" style="z-index: 9999; backdrop-filter: blur(28px); background: rgba(10, 12, 16, 0.85);" role="alertdialog" aria-modal="true" aria-labelledby="geo-block-title">
                <div class="sheet sheet--compact" style="max-width: 32rem; animation: sheet-in 0.4s cubic-bezier(0.16, 1, 0.3, 1) both; box-shadow: 0 24px 60px -12px rgba(0,0,0,0.7); border: 1px solid rgba(255, 255, 255, 0.12);">
                    <header class="sheet__header" style="padding-top: 1.5rem; padding-bottom: 0.75rem; border-bottom: 1px solid var(--separator);">
                        <div style="display: flex; align-items: center; gap: 0.75rem;">
                            <span style="display: grid; place-items: center; width: 44px; height: 44px; border-radius: 50%; background: rgba(255, 149, 0, 0.15); color: #FF9500; font-size: 1.35rem;" aria-hidden="true">
                                🛡️
                            </span>
                            <div>
                                <h2 id="geo-block-title" style="margin: 0; font-size: 1.15rem; font-weight: 700; color: var(--label);">Acesso Restrito ao Território Nacional</h2>
                                <p style="margin: 0.15rem 0 0; font-size: 0.8rem; color: var(--label-2);">Plataforma oficial de competições científicas do Brasil</p>
                            </div>
                        </div>
                    </header>

                    <div class="sheet__body" style="padding: 1.25rem 1.5rem; display: grid; gap: 1rem;">
                        <p style="margin: 0; font-size: 0.925rem; line-height: 1.55; color: var(--label-2);">
                            ${isVpn
                                ? `Identificamos que sua conexão passa por uma <strong>VPN, Proxy ou Datacenter</strong> (<code>AS${asn} — ${isp}</code>). Por motivos de segurança e gratuidade dos servidores, o acesso é exclusivo para conexões residenciais e escolares do Brasil sem intermediários.`
                                : `Identificamos uma conexão originada fora do Brasil (País detectado: <strong>${country}</strong>). O Calendário Olímpico é um projeto voltado aos estudantes e professores em território brasileiro.`
                            }
                        </p>

                        <div style="padding: 0.85rem 1rem; border-radius: var(--r-sm); background: var(--fill); border: 1px solid var(--separator); font-size: 0.825rem; display: grid; gap: 0.3rem;">
                            <div style="display: flex; justify-content: space-between; color: var(--label-2);">
                                <span>Origem Detectada:</span>
                                <strong style="color: var(--label);">${country} ${isVpn ? '(Rede VPN / Servidor)' : ''}</strong>
                            </div>
                            <div style="display: flex; justify-content: space-between; color: var(--label-2);">
                                <span>Provedora de Tráfego:</span>
                                <strong style="color: var(--label); max-width: 16ch; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${isp || `AS${asn}`}</strong>
                            </div>
                            <div style="display: flex; justify-content: space-between; color: var(--label-2);">
                                <span>Fuso Horário Local:</span>
                                <strong style="color: var(--label);">${tz}</strong>
                            </div>
                        </div>

                        <div style="display: grid; gap: 0.6rem; margin-top: 0.5rem;">
                            <button type="button" id="btn-reload-after-vpn" class="btn btn--prominent" style="width: 100%; justify-content: center; min-height: 44px; font-weight: 700;">
                                Já desliguei minha VPN / Tentar Novamente
                            </button>
                        </div>

                        <!-- Anti-Injustice Frontier Section -->
                        <details id="frontier-details" style="border-top: 1px solid var(--separator); padding-top: 0.75rem; font-size: 0.85rem; color: var(--label-2);">
                            <summary style="cursor: pointer; font-weight: 600; color: var(--accent); user-select: none;">
                                🇧🇷 Estou no Brasil ou em região de fronteira e fui bloqueado por engano
                            </summary>

                            <div style="margin-top: 0.85rem; display: grid; gap: 0.75rem; background: var(--bg); padding: 1rem; border-radius: var(--r-sm); border: 1px solid var(--separator);">
                                <p style="margin: 0; font-size: 0.8rem; line-height: 1.45;">
                                    Operadoras locais em cidades de fronteira (como Foz do Iguaçu, Ponta Porã ou Santana do Livramento) muitas vezes roteiam tráfego por cabos vizinhos. Validamos seu fuso horário (<strong>${tz}</strong>):
                                    <span style="color: ${isTzBrazil ? 'var(--open)' : 'var(--urgent)'}; font-weight: 700;">
                                        ${isTzBrazil ? '✓ Compatível com o Brasil' : '⚠️ Fuso externo'}
                                    </span>.
                                </p>

                                <div class="field" style="display: grid; gap: 0.25rem;">
                                    <label for="frontier-city-select" style="font-size: 0.75rem; font-weight: 600; text-transform: uppercase; color: var(--label-2);">Sua Cidade / Município Real:</label>
                                    <select id="frontier-city-select" style="min-height: 40px; padding: 0.4rem 0.6rem; border-radius: var(--r-sm); border: 1px solid var(--separator); background: var(--surface); color: var(--label); font-size: 0.85rem;">
                                        ${FRONTIER_CITIES.map(c => `<option value="${c.city} - ${c.uf}">${c.city} (${c.uf}) — Fronteira ${c.country_border}</option>`).join('')}
                                    </select>
                                </div>

                                <button type="button" id="btn-request-border-pass" class="btn btn--tinted" style="width: 100%; justify-content: center; min-height: 40px; font-weight: 600;">
                                    Emitir Passe Temporário de Fronteira (7 dias)
                                </button>
                            </div>
                        </details>
                    </div>

                    <footer class="sheet__footer" style="padding: 0.75rem 1.5rem; justify-content: center; background: transparent; border-top: 1px solid var(--separator);">
                        <a href="privacidade.html" style="font-size: 0.8rem; color: var(--label-2); text-decoration: underline;">
                            Saiba por que este controle existe em nossa Política de Privacidade & LGPD
                        </a>
                    </footer>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // Bind events
        const reloadBtn = document.getElementById('btn-reload-after-vpn');
        if (reloadBtn) {
            reloadBtn.addEventListener('click', () => {
                window.location.reload();
            });
        }

        const borderPassBtn = document.getElementById('btn-request-border-pass');
        const citySelect = document.getElementById('frontier-city-select');
        if (borderPassBtn && citySelect) {
            borderPassBtn.addEventListener('click', () => {
                const [cityName, uf] = citySelect.value.split(' - ');
                issueBorderPass(cityName, uf || 'BR');

                // Track in telemetry
                if (window.CalendarioTelemetry) {
                    window.CalendarioTelemetry.trackBorderReport({
                        detected_country: country,
                        detected_isp_asn: `AS${asn} - ${isp}`,
                        user_claimed_city_uf: citySelect.value,
                        temporary_pass_granted: true
                    });
                }

                // Remove modal
                const modalEl = document.getElementById('territorial-block-modal');
                if (modalEl) modalEl.remove();

                if (window.CalendarioTelemetry && window.CalendarioTelemetry.trackSessionStart) {
                    window.CalendarioTelemetry.trackSessionStart({ country: 'BR (Passe Fronteira)', region: uf, city: cityName, isp: isp, asn: asn });
                }

                showWelcomeToast(`✓ Passe de fronteira emitido para ${cityName}! Acesso liberado por 7 dias.`);
            });
        }
    }

    function showWelcomeToast(msg) {
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            container.className = 'toasts';
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        toast.className = 'toast-message';
        toast.innerHTML = `<span style="color:#5BD67A;">●</span><span>${msg}</span>`;
        container.appendChild(toast);
        setTimeout(() => toast.remove(), 4000);
    }

    // ─── Identity Switch Check ───────────────────────────────────
    function checkIdentitySwitch(realGeo) {
        let pendingRaw = localStorage.getItem(PENDING_SWITCH_KEY) || getCookie(PENDING_SWITCH_KEY);
        if (!pendingRaw) return;

        try {
            const pending = JSON.parse(pendingRaw);
            const now = Date.now();
            const timeDiff = now - pending.timestamp;

            if (timeDiff <= SWITCH_WINDOW_MS) {
                const timeToDisableVpnSec = Math.max(1, Math.round(timeDiff / 1000));

                // Log the identity_switch event
                if (window.CalendarioTelemetry) {
                    window.CalendarioTelemetry.trackIdentitySwitch({
                        time_to_disable_vpn_sec: timeToDisableVpnSec,
                        fake_country: pending.masked_country,
                        fake_isp_asn: pending.masked_isp_asn,
                        real_country: realGeo.country || 'BR',
                        real_uf: realGeo.region || 'BR',
                        real_city: realGeo.city || 'Brasil',
                        real_isp_asn: `AS${realGeo.asn || '28573'} - ${realGeo.isp || 'Provedor Real'}`
                    });
                }

                showWelcomeToast(`VPN desativada com sucesso! Conexão real reconhecida em ${timeToDisableVpnSec}s.`);
            }

            // Clear pending record
            localStorage.removeItem(PENDING_SWITCH_KEY);
            setCookie(PENDING_SWITCH_KEY, '', -1);
        } catch (e) {
            console.error('Error processing identity_switch:', e);
        }
    }

    // ─── Main Security Pipeline ──────────────────────────────────
    async function enforceTerritorialSecurity() {
        // 1. Check for valid 7-day border pass
        const borderPass = getActiveBorderPass();
        if (borderPass) {
            // User has an active border pass, allow without block
            return;
        }

        // 2. Resolve Geo & Network
        const geo = await resolveNetworkGeo();

        const isForeign = (geo.country || 'BR') !== 'BR';
        const isVpnAsn = geo.asn && KNOWN_VPN_ASNS.has(parseInt(geo.asn, 10));

        if (isForeign || isVpnAsn) {
            const blockReason = isVpnAsn ? 'VPN_ASN_DETECTED' : 'FOREIGN_IP';
            const maskedIspAsn = `AS${geo.asn || 'N/D'} - ${geo.isp || 'Desconhecida'}`;

            // Step 1: Save Pending Switch Package
            const pendingPayload = {
                timestamp: Date.now(),
                masked_country: geo.country || 'EXTERIOR',
                masked_isp_asn: maskedIspAsn,
                block_reason: blockReason
            };

            const payloadStr = JSON.stringify(pendingPayload);
            try {
                localStorage.setItem(PENDING_SWITCH_KEY, payloadStr);
                setCookie(PENDING_SWITCH_KEY, payloadStr, 1);
            } catch (_) {}

            // Track access_blocked in telemetry
            if (window.CalendarioTelemetry) {
                window.CalendarioTelemetry.trackAccessBlocked({
                    blocked_country: geo.country,
                    blocked_region: geo.region,
                    blocked_isp_asn: maskedIspAsn,
                    block_reason: blockReason
                });
            }

            // Step 2: Render Territorial Restriction Page
            showRestrictedModal({
                country: geo.country,
                asn: geo.asn,
                isp: geo.isp,
                reason: blockReason
            });
            return;
        }

        // If not blocked, check if user just switched from VPN to Real Connection (Step 3)
        checkIdentitySwitch(geo);

        // Track session start with real geo
        if (window.CalendarioTelemetry) {
            window.CalendarioTelemetry.trackSessionStart(geo);
        }
    }

    // Expose simulation helper for admin dashboard
    window.CalendarioSecurity = {
        simulateGeo(geoData) {
            if (!geoData) {
                localStorage.removeItem(SIMULATED_GEO_KEY);
            } else {
                localStorage.setItem(SIMULATED_GEO_KEY, JSON.stringify(geoData));
            }
            window.location.reload();
        },
        getActiveBorderPass,
        issueBorderPass,
        clearBorderPass() {
            localStorage.removeItem(BORDER_PASS_KEY);
            setCookie(BORDER_PASS_KEY, '', -1);
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', enforceTerritorialSecurity);
    } else {
        enforceTerritorialSecurity();
    }
})();
