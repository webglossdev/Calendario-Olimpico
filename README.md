# Calendário Olímpico 2026 🇧🇷🏅

> **A plataforma definitiva para estudantes brasileiros descobrirem, se prepararem e conquistarem medalhas nas principais olimpíadas científicas do país.**

O **Calendário Olímpico** é um projeto educacional de código aberto licenciado sob a **GNU Affero General Public License v3.0 (GNU AGPLv3)**, desenvolvido para democratizar o acesso a informações, cronogramas, provas anteriores e materiais de estudo das maiores olimpíadas do Brasil (como OBMEP, OBA, OBF, OBI, ONHB, OBM, OBQ, OBB e muitas outras).

O projeto conta com arquitetura de alta performance (Vanilla HTML5, CSS Apple Human Interface Guidelines, JavaScript ES6+ e Borda Serverless na **Vercel**), implementando **Controle Territorial Inteligente (Anti-VPN & Cidades de Fronteira)**, **Telemetria com Máxima Conformidade LGPD (Observatório Aberto)** e uma **API Pública** aberta para integração com outros sistemas e escolas.

---

## 🌟 Principais Funcionalidades

### 1. Experiência do Estudante (Páginas Públicas)
- 📅 **Calendário Interativo (`calendario.html`):** Visualização dinâmica de prazos de inscrição, fases de prova e divulgação de resultados, com filtros por matéria, nível escolar (Fundamental I, II e Médio) e status.
- 📚 **Acervo de Provas Anteriores (`provas.html`):** Acesso organizado a enunciados de edições passadas, gabaritos comentados e links diretos para materiais de estudo e simulados oficiais.
- 🏠 **Portal de Início (`index.html`):** Contagem regressiva para as próximas provas, sistema de favoritos local, curiosidades sobre competições e links de inscrição rápida.
- 🎨 **Design System Inspirado nas Apple Human Interface Guidelines (HIG):**
  - Tipografia moderna (Inter + JetBrains Mono) e glassmorphism refinado.
  - Suporte automático a **Modo Claro** e **Modo Escuro** (`prefers-color-scheme`).
  - Navegação móvel ergonômica com Tab Bar inferior nativa para celulares e tablets.

---

### 2. Painel de Gestão & Observatório (`admin.html`)
Painel protegido por senha mestra com verificação criptográfica SHA-256 no client e bloqueio de força bruta:
- ✍️ **Gestão Completa de Olimpíadas:** Adição, edição em modal multi-etapas, busca instantânea e remoção de competições.
- 💾 **Exportação JSON Direta:** Permite gerar o arquivo `dados.json` consolidado com 1 clique para versionamento no GitHub.
- 📊 **Aba de Gestão Territorial & Observatório LGPD:**
  - **Ranking ao Vivo de Conteúdos:** Indicadores de demanda (picos em véspera de prova vs tópicos negligenciados), tempo de estudo ativo e taxa de abandono.
  - **Funil de Navegação (Fluxo Sankey):** Conversão de estudantes desde a Landing Page até o download de materiais e calendários `.ics`.
  - **Relatório Territorial:** Top Unidades Federativas (UFs) e comparativo de provedores reais do Brasil vs serviços de VPN bloqueados.
  - **Simulador de Rede Integrado:** Botões para testar em tempo real a experiência de bloqueio (EUA, ProtonVPN, Fronteira com Paraguai e Conexão Normal).
  - **Homologação de Provedores de Fronteira:** Aprovação imediata de ASNs regionais na Whitelist.

---

### 3. API Pública REST de Olimpíadas (`/api/olimpiadas`)
Uma API aberta e rápida para desenvolvedores, escolas, secretarias de educação e plataformas de estudo consumirem todo o catálogo de olimpíadas científicas em tempo real:
- **Endpoint Principal:** `GET /api/olimpiadas`
- **Filtros por Query String:**
  - `?sigla=OBMEP` — Filtra por sigla da competição.
  - `?materia=Matemática` — Filtra por disciplina específica.
  - `?nivel=Médio` — Filtra por nível escolar (Fundamental I, II ou Médio).
  - `?modalidade=Presencial` — Filtra por modalidade (Presencial / Online / Híbrida).
  - `?search=astronomia` — Busca textual em nome, sigla e descrição.
- **Exemplo de Resposta:**
  ```json
  {
    "api": "Calendário Olímpico REST API",
    "version": "1.0.0",
    "license": "GNU Affero General Public License v3.0 (GNU AGPLv3)",
    "terms_and_notice": "O uso desta API em serviços de rede exige que o serviço derivado mantenha seu código aberto sob a GNU AGPLv3 (Seção 13).",
    "total_items": 1,
    "results": [
      {
        "id": "obmep2026",
        "sigla": "OBMEP",
        "nome": "Olimpíada Brasileira de Matemática das Escolas Públicas",
        "materias": ["Matemática"],
        "nivel_escolar": ["Ensino Fundamental II", "Ensino Médio"],
        "eventos": [ ... ]
      }
    ]
  }
  ```

---

### 4. Segurança Territorial & Detecção de VPN (`security.js` e `api/geo.js`)
O site é exclusivo para estudantes em território nacional brasileiro, implementando proteção na borda a custo zero:
- 🛡️ **Filtro Duplo na Borda:**
  - **Regra 1 (País):** Bloqueia conexões com `cf-ipcountry !== 'BR'` ou `x-vercel-ip-country !== 'BR'`.
  - **Regra 2 (VPN no Brasil):** Bloqueia IPs de datacenters e serviços conhecidos de VPN (M247/Proton, Datacamp/NordVPN, Choopa/Surfshark, Cloudflare WARP, AWS, Google Cloud, etc.).
- 🔄 **Mecanismo de "Troca de Identidade" (`identity_switch`):**
  - Quando o aluno tenta acessar com VPN ligada, vê uma tela explicativa e o navegador grava um carimbo temporário (`pending_vpn_switch`).
  - Ao desligar a VPN e entrar com sua operadora real (ex: Claro, Vivo, TIM), o sistema calcula os segundos levados para desativar a ferramenta (`time_to_disable_vpn_sec`) e registra o evento estatístico na telemetria.
- 📍 **Tratamento Anti-Injustiça para Cidades de Fronteira:**
  - Verificação automática de fuso horário brasileiro (`America/...`) e idioma nativo (`pt-BR`).
  - Seleção de cidades fronteiriças (*Foz do Iguaçu - PR, Ponta Porã - MS, Santana do Livramento - RS, Uruguaiana - RS, Corumbá - MS, Tabatinga - AM*).
  - Emissão de **Passe Temporário de Fronteira de 7 dias** (`border_pass`) com envio para fila de auditoria administrativa.

---

### 5. Telemetria Educacional & Blindagem LGPD/ANPD (`telemetry.js` e `privacidade.html`)
Telemetria voltada exclusivamente para a ciência aberta e melhoria do ensino público brasileiro (Arts. 7º, IV e IX, 11, 12, 13 e 14 da Lei nº 13.709/2018):
- 🚫 **Descarte Imediato de IP Bruto na Borda:** O número IP nunca é gravado no banco de dados, em logs ou em arquivos.
- 🔒 **Identificador Pseudonimizado (`student_hash`):** Hash SHA-256 gerado a partir de atributos de hardware com salt local persistente sem vínculo a dados nominativos (sem nome, CPF, e-mail ou telefone).
- 📱 **Diagnóstico de Desigualdade Digital:** Análise de tipos de aparelhos (Mobile vs Desktop), memória RAM (aparelhos de entrada com menos de 4GB) e tipo de conexão (4G/5G vs redes instáveis).
- ⚖️ **Trava de $k$-Anonimato ($N \ge 30$):** Dados municipais só aparecem no Observatório se houver no mínimo 30 estudantes, impedindo qualquer reidentificação individual.
- 📜 **Página de Privacidade em Duas Camadas (`privacidade.html`):** Visual Law acessível para estudantes e nota técnica com enquadramento legal detalhado.

---

## 🏗️ Arquitetura do Repositório (Deploy Vercel)

```text
├── index.html              # Landing Page pública com destaques e contagem regressiva
├── calendario.html         # Calendário interativo de provas e inscrições
├── provas.html             # Repositório de provas anteriores e caminhos de estudo
├── admin.html              # Painel Administrativo e Observatório LGPD
├── privacidade.html        # Política de Privacidade (Visual Law + Nota Jurídica LGPD)
├── programas.html          # Guia de Programas de Incentivo Científico, Bolsas e Vagas Olímpicas
├── styles.css              # Design System Apple HIG completo (Modo Claro/Escuro)
├── dados.json / dados.js   # Base central de dados de todas as olimpíadas cadastradas
├── app.js                  # Lógica da Landing Page (filtros, busca, favoritos)
├── calendario.js           # Lógica do Calendário (renderização de meses e eventos)
├── provas.js               # Lógica do acervo de provas anteriores
├── admin.js                # Lógica do Painel Administrativo, CRUD e Observatório
├── security.js             # Motor de segurança territorial, anti-VPN e passes de fronteira
├── telemetry.js            # Motor de telemetria educacional pseudonimizada
├── vercel.json             # Configurações de deploy e cabeçalhos de segurança na Vercel
└── api/                    # Rotas Serverless na Vercel
    ├── olimpiadas.js       # API REST Pública para consulta de competições
    ├── geo.js              # Resolução de país, estado, cidade e ASN na borda
    ├── telemetry.js        # Ingestão de beacons LGPD e persistência em Vercel KV / Redis
    └── stats.js            # Endpoint de consulta consolidada para o painel admin
```

---

## 🚀 Como Rodar Localmente

Como a aplicação é construída com tecnologias web puras (Vanilla HTML/CSS/JS), você não precisa compilar nem instalar dependências pesadas:

1. **Clone o repositório:**
   ```bash
   git clone https://github.com/SEU-USUARIO/Calendario-Olimpico.git
   cd Calendario-Olimpico
   ```

2. **Abra em qualquer servidor estático local:**
   - Com a extensão **Live Server** no VS Code / IDE.
   - Ou via Python:
     ```bash
     python -m http.server 8000
     ```
   - Ou via Node:
     ```bash
     npx serve .
     ```

3. Acesse `http://localhost:8000` no seu navegador.

---

## ☁️ Deploy no Vercel (GitHub Integration)

1. Conecte este repositório no seu painel da [Vercel](https://vercel.com).
2. O Vercel detectará automaticamente o projeto estático e as rotas dentro da pasta `api/` como funções serverless.
3. **(Opcional para persistência remota da telemetria):**
   - No painel do projeto na Vercel, acesse a aba **Storage** e crie um **Vercel KV (Upstash Redis)** com 1 clique (100% gratuito no Free Tier até 10.000 comandos/dia).
   - A Vercel injetará automaticamente as variáveis de ambiente `KV_REST_API_URL` e `KV_REST_API_TOKEN`.
   - Se você não ativar o Vercel KV, o sistema funcionará normalmente utilizando o cache enriquecido de borda do navegador.

---

## 📊 Estrutura dos Dados das Olimpíadas (`dados.json`)

O arquivo `dados.json` segue um formato padronizado e simples de editar manualmente ou pelo próprio Painel de Gestão:

```json
[
  {
    "id": "obmep2026",
    "sigla": "OBMEP",
    "nome": "Olimpíada Brasileira de Matemática das Escolas Públicas",
    "nivel_escolar": [
      "Ensino Fundamental II",
      "Ensino Médio"
    ],
    "materias": [
      "Matemática"
    ],
    "modalidade": "Presencial",
    "descricao": "Maior olimpíada científica do país, aberta a estudantes do 6º ano ao Ensino Médio.",
    "eventos": [
      {
        "tipo": "Inscrição",
        "data": "2026-03-15",
        "descricao": "Prazo final para inscrições pelas escolas"
      },
      {
        "tipo": "Prova",
        "data": "2026-06-02",
        "descricao": "1ª Fase — Aplicação das provas na própria escola"
      }
    ],
    "materiais_estudo": [
      {
        "titulo": "Portal Oficial da OBMEP — Banco de Questões",
        "url": "https://www.obmep.org.br"
      }
    ]
  }
]
```

---

## 🤝 Como Contribuir

Contribuições são muito bem-vindas! Você pode ajudar de diversas formas:
- 📌 **Cadastrando novas olimpíadas:** Envie PRs atualizando o arquivo `dados.json`.
- ✏️ **Atualizando datas e prazos:** Correções de calendários oficiais são prioridade constante.
- 💡 **Sugerindo melhorias de UI/UX:** Abra uma issue com ideias para enriquecer o caminho de estudo dos alunos.

---

## 📄 Licença — GNU Affero General Public License v3.0 (GNU AGPLv3)

Este projeto é software livre licenciado sob a **GNU Affero General Public License v3.0 (GNU AGPLv3)**. Consulte o arquivo [LICENSE](LICENSE) para obter o texto integral.

### 🌐 Por que a GNU AGPLv3? (Proteção Copyleft de Rede)
Ao contrário da GPL tradicional (onde o dever de compartilhamento de código só é ativado na distribuição física ou download de binários), a **GNU AGPLv3 contém a Seção 13 (Interação Remota por Rede)**:

> **Se qualquer pessoa, empresa, edtech ou instituição utilizar este código, base de dados ou API para construir ou alimentar um serviço online, plataforma web, SaaS ou API própria, é ESTRITAMENTE OBRIGADA por lei a disponibilizar TODO o código-fonte correspondente do serviço derivado de forma aberta, pública e gratuita sob a mesma licença GNU AGPLv3.**

Dessa forma, o ecossistema do **Calendário Olímpico** fica legalmente blindado contra apropriação fechada por terceiros, garantindo que qualquer evolução permaneça sempre livre e pública para todos os estudantes do Brasil.
