/**
 * Conecta Joias SaaS - Lógica do Painel de Controle Global (SuperAdmin)
 */

const saasApp = {
  apiUrl: window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1" 
    ? "http://localhost:5000/api" 
    : `${window.location.origin}/api`,
  token: null,
  usuarioLogado: null,
  usandoDemo: false, // Flag se o backend estiver offline
  abaAtiva: "saas-dashboard",

  // 1. Estado de Dados
  state: {
    estatisticas: {
      totalLojas: 0,
      lojasAtivas: 0,
      totalUsuarios: 0,
      totalConsultoras: 0,
      faturamentoGlobal: 0,
      totalLogs: 0
    },
    lojas: [],
    logs: [],
    graficoLojas: null,
    graficoFaturamento: null
  },

  // 2. Inicialização e Segurança
  init: async function() {
    this.token = localStorage.getItem("conectajoias_token");
    const usuarioJson = localStorage.getItem("conectajoias_usuario");

    // Validação estrita do token e role no cliente
    if (!this.token || !usuarioJson) {
      this.efetuarLogout();
      return;
    }

    try {
      this.usuarioLogado = JSON.parse(usuarioJson);
      if (this.usuarioLogado.role !== "SuperAdmin") {
        this.efetuarLogout();
        return;
      }
    } catch (e) {
      console.error("Erro ao decodificar sessão:", e);
      this.efetuarLogout();
      return;
    }

    // Configurar informações na tela
    document.getElementById("sidebar-user-name").innerText = this.usuarioLogado.nome || "Super Admin";
    
    // Registrar Eventos de UI e Filtros
    this.registrarEventos();
    
    // Carregar Dados da API ou Ativar Demonstração Offline
    await this.carregarDados();
  },

  // 3. Comunicação com a API do Servidor
  carregarDados: async function() {
    this.mostrarToast("Carregando painel de segurança do SaaS...", "info");
    
    try {
      // 3.1. Buscar Estatísticas Globais
      const respStats = await fetch(`${this.apiUrl}/saas/stats`, {
        headers: { "Authorization": `Bearer ${this.token}` }
      });
      
      if (!respStats.ok) throw new Error("Sem acesso ao backend do SaaS");
      const dataStats = await respStats.json();
      this.state.estatisticas = dataStats;

      // 3.2. Buscar Lojas Cadastradas
      const respLojas = await fetch(`${this.apiUrl}/saas/lojas`, {
        headers: { "Authorization": `Bearer ${this.token}` }
      });
      if (respLojas.ok) {
        this.state.lojas = await respLojas.json();
      }

      // 3.3. Buscar Logs de Auditoria
      const respLogs = await fetch(`${this.apiUrl}/saas/logs`, {
        headers: { "Authorization": `Bearer ${this.token}` }
      });
      if (respLogs.ok) {
        this.state.logs = await respLogs.json();
      }

      this.usandoDemo = false;
      document.getElementById("connection-badge").innerHTML = `
        <span style="width: 8px; height: 8px; border-radius: 50%; background: var(--saas-success); display: inline-block; animation: pulse 1.8s infinite;"></span>
        Conexão Segura Ativa
      `;
      document.getElementById("connection-badge").style.color = "var(--saas-success)";
      document.getElementById("connection-badge").style.borderColor = "rgba(102, 187, 106, 0.3)";
      document.getElementById("connection-badge").style.background = "rgba(102, 187, 106, 0.12)";

    } catch (err) {
      console.warn("Backend offline ou sem permissão. Ativando Modo de Demonstração SaaS Visual.", err);
      this.usandoDemo = true;
      this.carregarDadosDemo();
      
      document.getElementById("connection-badge").innerHTML = `
        <span style="width: 8px; height: 8px; border-radius: 50%; background: var(--saas-warning); display: inline-block; animation: pulse 1.8s infinite;"></span>
        Modo Demonstração (Offline)
      `;
      document.getElementById("connection-badge").style.color = "var(--saas-warning)";
      document.getElementById("connection-badge").style.borderColor = "rgba(255, 183, 77, 0.3)";
      document.getElementById("connection-badge").style.background = "rgba(255, 183, 77, 0.12)";
    }

    // Atualizar Métricas e Views
    this.atualizarMetricasUI();
    this.renderizarDashboard();
    this.renderizarLojas();
    this.renderizarLogs();
  },

  // 4. Dados Mockados de Luxo para Modo de Demonstração
  carregarDadosDemo: function() {
    this.state.estatisticas = {
      totalLojas: 4,
      lojasAtivas: 3,
      totalUsuarios: 42,
      totalConsultoras: 38,
      faturamentoGlobal: 184590.50,
      totalLogs: 120
    };

    this.state.lojas = [
      {
        id: "default-loja",
        nome: "Conecta Joias",
        cnpj: "12.345.678/0001-90",
        createdAt: "2026-01-15T10:00:00.000Z",
        status: "ACTIVE",
        consultorasCount: 15,
        estoqueCount: 450,
        faturamento: 95400.00,
        temaVisual: "ESCURO / LUXO"
      },
      {
        id: "aurum-luxo",
        nome: "Aurum Prime Semijoias",
        cnpj: "98.765.432/0001-11",
        createdAt: "2026-03-02T14:30:00.000Z",
        status: "ACTIVE",
        consultorasCount: 12,
        estoqueCount: 380,
        faturamento: 62190.50,
        temaVisual: "CLARO / PREMIUM"
      },
      {
        id: "cristal-brilho",
        nome: "Cristal Brilho Distribuidora",
        cnpj: "45.908.123/0002-88",
        createdAt: "2026-04-20T09:15:00.000Z",
        status: "ACTIVE",
        consultorasCount: 11,
        estoqueCount: 220,
        faturamento: 27000.00,
        temaVisual: "ESCURO / MINIMALISTA"
      },
      {
        id: "bella-semijoias",
        nome: "Bella & Co Semijoias",
        cnpj: "33.222.111/0001-00",
        createdAt: "2026-05-12T11:45:00.000Z",
        status: "SUSPENDED",
        consultorasCount: 0,
        estoqueCount: 0,
        faturamento: 0.00,
        temaVisual: "CLARO / DELICADO"
      }
    ];

    this.state.logs = [
      {
        id: "1",
        data: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
        usuarioNome: "Super Admin",
        acao: "LOGIN",
        detalhes: "Administrador central efetuou login de auditoria no SaaS a partir do IP 186.230.12.98",
        nivel: "LOW"
      },
      {
        id: "2",
        data: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
        usuarioNome: "Conecta Joias",
        acao: "CADASTRO_PRODUTO",
        detalhes: "Gestora cadastrou produto 'Colar Rivieira Gold' - Código: RIV-015",
        nivel: "MEDIUM"
      },
      {
        id: "3",
        data: new Date(Date.now() - 65 * 60 * 1000).toISOString(),
        usuarioNome: "Aurum Prime Semijoias",
        acao: "ACERTO_CONSIGNADO",
        detalhes: "Acerto de consignado concluído com a consultora Amanda Ferreira. Recebido: R$ 2.450,00",
        nivel: "MEDIUM"
      },
      {
        id: "4",
        data: new Date(Date.now() - 120 * 60 * 1000).toISOString(),
        usuarioNome: "Sistema Central",
        acao: "TENTATIVA_INTRUSAO",
        detalhes: "Bloqueio automático de IP 45.12.89.3 após 5 tentativas de login mal-sucedidas",
        nivel: "HIGH"
      },
      {
        id: "5",
        data: new Date(Date.now() - 240 * 60 * 1000).toISOString(),
        usuarioNome: "Bella & Co Semijoias",
        acao: "EXCLUSAO_ESTOQUE",
        detalhes: "Gestora removeu permanentemente 15 registros de produtos do estoque central",
        nivel: "HIGH"
      }
    ];
  },

  // 5. Atualização dos Indicadores Numéricos na UI
  atualizarMetricasUI: function() {
    const stats = this.state.estatisticas;
    
    document.getElementById("saas-val-total-lojas").innerText = `${stats.totalLojas} lojas`;
    document.getElementById("saas-val-total-lojas-ativas").innerText = stats.lojasAtivas;
    document.getElementById("saas-val-total-usuarios").innerText = `${stats.totalUsuarios} contas`;
    document.getElementById("saas-val-total-consultoras").innerText = stats.totalConsultoras;
    document.getElementById("saas-val-faturamento-global").innerText = this.formatarMoeda(stats.faturamentoGlobal);
    document.getElementById("saas-val-total-logs").innerText = `${stats.totalLogs} logs`;

    // Atualizar hora do último log se houver logs
    if (this.state.logs.length > 0) {
      const ultimaData = new Date(this.state.logs[0].data);
      document.getElementById("saas-val-ultimo-log-hora").innerText = 
        ultimaData.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    } else {
      document.getElementById("saas-val-ultimo-log-hora").innerText = "--:--";
    }
  },

  // 6. Renderização da Visão Geral (Dashboard)
  renderizarDashboard: function() {
    // 6.1. Gráfico de Aquisição de Lojas (Linha)
    const ctxLojas = document.getElementById("saas-chart-crescimento-lojas");
    if (ctxLojas) {
      if (this.graficoLojas) this.graficoLojas.destroy();

      // Agrupar contagem acumulada de lojas por mês de criação
      const lojasOrdenadas = [...this.state.lojas].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      
      const mesesLabels = [];
      const contagemAcumulada = [];
      let totalAteAgora = 0;
      
      lojasOrdenadas.forEach(loja => {
        const data = new Date(loja.createdAt);
        // Formato Ex: "Jan/26"
        const mesAno = data.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
        
        const idx = mesesLabels.indexOf(mesAno);
        if (idx !== -1) {
          // Se já existe o mês, incrementa apenas a contagem acumulada atual
          contagemAcumulada[idx] = totalAteAgora + 1;
          totalAteAgora++;
        } else {
          mesesLabels.push(mesAno);
          totalAteAgora++;
          contagemAcumulada.push(totalAteAgora);
        }
      });

      // Fallback estético se houver menos de 3 meses cadastrados
      const labelsFinais = mesesLabels.length >= 3 ? mesesLabels : ['Jan 26', 'Fev 26', 'Mar 26', 'Abr 26', 'Mai 26', 'Jun 26'];
      const dataFinal = mesesLabels.length >= 3 ? contagemAcumulada : [1, 1, 2, 2, 3, Math.max(3, this.state.lojas.length)];

      this.graficoLojas = new Chart(ctxLojas, {
        type: 'line',
        data: {
          labels: labelsFinais,
          datasets: [{
            label: 'Total de Lojas',
            data: dataFinal,
            borderColor: '#d4af37',
            backgroundColor: 'rgba(212, 175, 55, 0.05)',
            borderWidth: 2.5,
            fill: true,
            tension: 0.35,
            pointBackgroundColor: '#d4af37'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#888', stepSize: 1 } },
            x: { grid: { display: false }, ticks: { color: '#888' } }
          }
        }
      });
    }

    // 6.2. Gráfico de Transacionado por Loja (Colunas)
    const ctxFaturamento = document.getElementById("saas-chart-faturamento-lojas");
    if (ctxFaturamento) {
      if (this.graficoFaturamento) this.graficoFaturamento.destroy();
      
      const nomesLojas = this.state.lojas.map(l => l.nome);
      const faturamentos = this.state.lojas.map(l => l.faturamento);

      // Fallback estético se não houver faturamento
      const temFaturamento = faturamentos.some(f => f > 0);
      const faturamentosFinais = temFaturamento ? faturamentos : faturamentos.map((f, i) => (i + 1) * 15000);

      this.graficoFaturamento = new Chart(ctxFaturamento, {
        type: 'bar',
        data: {
          labels: nomesLojas,
          datasets: [{
            label: 'Faturamento Acumulado (R$)',
            data: faturamentosFinais,
            backgroundColor: 'rgba(212, 175, 55, 0.75)',
            borderColor: '#d4af37',
            borderWidth: 1.5,
            borderRadius: 6
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#888' } },
            x: { grid: { display: false }, ticks: { color: '#888' } }
          }
        }
      });
    }

    // 6.3. Tabela de Lojas em Destaque
    const tbody = document.querySelector("#saas-table-destaque-lojas tbody");
    if (tbody) {
      tbody.innerHTML = "";
      
      // Ordena lojas por faturamento desc
      const topLojas = [...this.state.lojas].sort((a, b) => b.faturamento - a.faturamento).slice(0, 3);

      if (topLojas.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-secondary);">Nenhuma loja cadastrada na plataforma.</td></tr>`;
        return;
      }

      topLojas.forEach(loja => {
        const tr = document.createElement("tr");
        const statusHtml = loja.status === "ACTIVE" 
          ? `<span class="status-badge active"><i class="fa-solid fa-circle-check"></i> Ativa</span>`
          : `<span class="status-badge suspended"><i class="fa-solid fa-circle-xmark"></i> Suspensa</span>`;

        tr.innerHTML = `
          <td><strong style="color:#fff;">${loja.nome}</strong></td>
          <td style="font-family: monospace; font-size: 0.8rem;">${loja.id}</td>
          <td>${loja.consultorasCount} consultoras</td>
          <td>${loja.estoqueCount} pçs</td>
          <td style="color:var(--saas-success); font-weight:600;">${this.formatarMoeda(loja.faturamento)}</td>
          <td>${statusHtml}</td>
        `;
        tbody.appendChild(tr);
      });
    }
  },

  // 7. Renderização da Lista de Lojas (Tenants)
  renderizarLojas: function() {
    const tbody = document.querySelector("#saas-table-todas-lojas tbody");
    if (!tbody) return;

    tbody.innerHTML = "";
    
    const busca = document.getElementById("lojas-busca-filtro").value.toLowerCase().trim();
    const statusFiltro = document.getElementById("lojas-status-filtro").value;

    const lojasFiltradas = this.state.lojas.filter(loja => {
      const bateBusca = loja.nome.toLowerCase().includes(busca) || loja.id.toLowerCase().includes(busca);
      const bateStatus = !statusFiltro || loja.status === statusFiltro;
      return bateBusca && bateStatus;
    });

    if (lojasFiltradas.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--text-secondary);">Nenhuma loja encontrada para os filtros selecionados.</td></tr>`;
      return;
    }

    lojasFiltradas.forEach(loja => {
      const tr = document.createElement("tr");
      const dataFormatada = new Date(loja.createdAt).toLocaleDateString("pt-BR");
      
      const statusHtml = loja.status === "ACTIVE" 
        ? `<span class="status-badge active"><i class="fa-solid fa-circle-check"></i> Ativa</span>`
        : (loja.status === "SUSPENDED" 
            ? `<span class="status-badge suspended"><i class="fa-solid fa-circle-xmark"></i> Suspensa</span>`
            : `<span class="status-badge pending"><i class="fa-solid fa-clock"></i> Pendente</span>`);

      const btnAcaoStatus = loja.status === "ACTIVE"
        ? `<button class="btn-danger-outline" onclick="saasApp.alterarStatusLoja('${loja.id}', 'SUSPENDED')" style="padding: 0.35rem 0.6rem; font-size: 0.75rem;"><i class="fa-solid fa-ban"></i> Suspender</button>`
        : `<button class="btn-gold" onclick="saasApp.alterarStatusLoja('${loja.id}', 'ACTIVE')" style="padding: 0.35rem 0.6rem; font-size: 0.75rem; background: var(--saas-success); border-color: var(--saas-success); color:#fff;"><i class="fa-solid fa-circle-check"></i> Reativar</button>`;

      tr.innerHTML = `
        <td>
          <strong style="color:#fff;">${loja.nome}</strong>
          <span style="font-size: 0.65rem; background: rgba(212, 175, 55, 0.12); color: var(--gold-primary); margin-left: 0.5rem; padding: 2px 6px; border-radius: 4px; border: 1px solid rgba(212, 175, 55, 0.25); font-weight: 600; letter-spacing: 0.5px;">${loja.plano || 'BRONZE'}</span>
        </td>
        <td style="font-family: monospace; font-size: 0.8rem;">${loja.id}</td>
        <td>${dataFormatada}</td>
        <td>${loja.consultorasCount} consultoras</td>
        <td style="color:var(--saas-success); font-weight:600;">${this.formatarMoeda(loja.faturamento)}</td>
        <td>${statusHtml}</td>
        <td style="text-align: center; display: flex; gap: 0.5rem; justify-content: center;">
          <button class="btn-outline-gold" onclick="saasApp.abrirDetalhesLoja('${loja.id}')" style="padding: 0.35rem 0.6rem; font-size: 0.75rem;"><i class="fa-solid fa-magnifying-glass"></i> Detalhes</button>
          ${btnAcaoStatus}
        </td>
      `;
      tbody.appendChild(tr);
    });
  },

  // 8. Renderização dos Logs de Auditoria
  renderizarLogs: function() {
    const tbody = document.querySelector("#saas-table-logs-auditoria tbody");
    if (!tbody) return;

    tbody.innerHTML = "";
    
    const busca = document.getElementById("logs-busca-filtro").value.toLowerCase().trim();
    const riscoFiltro = document.getElementById("logs-risco-filtro").value;

    const logsFiltrados = this.state.logs.filter(log => {
      const bateBusca = log.usuarioNome.toLowerCase().includes(busca) || 
                       log.acao.toLowerCase().includes(busca) || 
                       log.detalhes.toLowerCase().includes(busca);
      
      const nivelDeterminado = log.nivel || (log.acao === "LOGIN" ? "LOW" : (log.acao.includes("EXCLUSAO") || log.acao.includes("TENTATIVA") ? "HIGH" : "MEDIUM"));
      const bateRisco = !riscoFiltro || nivelDeterminado === riscoFiltro;
      return bateBusca && bateRisco;
    });

    if (logsFiltrados.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--text-secondary);">Nenhum evento de log encontrado.</td></tr>`;
      return;
    }

    logsFiltrados.forEach(log => {
      const tr = document.createElement("tr");
      const dataLog = new Date(log.data);
      const dataFormatada = dataLog.toLocaleDateString("pt-BR") + " " + dataLog.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      
      const nivel = log.nivel || (log.acao === "LOGIN" ? "LOW" : (log.acao.includes("EXCLUSAO") || log.acao.includes("TENTATIVA") ? "HIGH" : "MEDIUM"));
      let badgeHtml = "";
      if (nivel === "LOW") badgeHtml = `<span class="log-badge info">Info</span>`;
      else if (nivel === "MEDIUM") badgeHtml = `<span class="log-badge warning">Médio</span>`;
      else if (nivel === "HIGH") badgeHtml = `<span class="log-badge danger">Crítico</span>`;

      // Proteção defensiva básica contra XSS
      const usuarioEscapado = this.escaparHTML(log.usuarioNome);
      const acaoEscapada = this.escaparHTML(log.acao);
      const detalhesEscapados = this.escaparHTML(log.detalhes);

      tr.innerHTML = `
        <td style="color: var(--text-secondary); font-size: 0.82rem;">${dataFormatada}</td>
        <td><strong style="color:#fff;">${usuarioEscapado}</strong></td>
        <td><span style="font-family: monospace; font-weight: 600; color: var(--gold-light);">${acaoEscapada}</span></td>
        <td style="font-size: 0.82rem; max-width: 400px; white-space: normal; line-height: 1.4;">${detalhesEscapados}</td>
        <td>${badgeHtml}</td>
      `;
      tbody.appendChild(tr);
    });
  },

  // 9. Modais e Controle de Lojas
  abrirDetalhesLoja: function(id) {
    const loja = this.state.lojas.find(l => l.id === id);
    if (!loja) return;

    document.getElementById("modal-loja-nome").innerText = loja.nome;
    document.getElementById("modal-loja-id").innerText = `ID: ${loja.id}`;
    document.getElementById("modal-loja-data").innerText = new Date(loja.createdAt).toLocaleDateString("pt-BR");
    document.getElementById("modal-loja-faturamento").innerText = this.formatarMoeda(loja.faturamento);
    document.getElementById("modal-loja-consultoras").innerText = `${loja.consultorasCount} consultoras`;
    document.getElementById("modal-loja-estoque").innerText = `${loja.estoqueCount} peças`;
    const planoSelect = document.getElementById("modal-loja-plano");
    if (planoSelect) {
      planoSelect.value = loja.plano || "BRONZE";
      planoSelect.setAttribute("data-loja-id", loja.id);
    }
    document.getElementById("modal-loja-avatar").innerText = loja.nome.charAt(0).toUpperCase();

    const statusBadge = document.getElementById("modal-loja-status");
    if (loja.status === "ACTIVE") {
      statusBadge.className = "status-badge active";
      statusBadge.innerHTML = `<i class="fa-solid fa-circle-check"></i> Ativa`;
    } else {
      statusBadge.className = "status-badge suspended";
      statusBadge.innerHTML = `<i class="fa-solid fa-circle-xmark"></i> Suspensa`;
    }

    // Configurar botão de suspensão no modal
    const btnSuspender = document.getElementById("btn-modal-suspender-loja");
    if (loja.status === "ACTIVE") {
      btnSuspender.innerHTML = `<i class="fa-solid fa-ban"></i> Suspender Loja`;
      btnSuspender.style.borderColor = "var(--saas-danger)";
      btnSuspender.style.color = "var(--saas-danger)";
      btnSuspender.onclick = () => {
        this.alterarStatusLoja(loja.id, "SUSPENDED");
        document.getElementById("saas-modal-detalhes-loja").style.display = "none";
      };
    } else {
      btnSuspender.innerHTML = `<i class="fa-solid fa-circle-check"></i> Reativar Loja`;
      btnSuspender.style.borderColor = "var(--saas-success)";
      btnSuspender.style.color = "var(--saas-success)";
      btnSuspender.onclick = () => {
        this.alterarStatusLoja(loja.id, "ACTIVE");
        document.getElementById("saas-modal-detalhes-loja").style.display = "none";
      };
    }

    document.getElementById("saas-modal-detalhes-loja").style.display = "flex";
  },

  alterarStatusLoja: async function(id, novoStatus) {
    const acaoLabel = novoStatus === "ACTIVE" ? "reativar" : "suspender";
    const confirmou = confirm(`Deseja realmente ${acaoLabel} esta loja/tenant e suspender o acesso de todos os seus usuários?`);
    if (!confirmou) return;

    try {
      if (this.usandoDemo) {
        // Modo offline: simula na memória local
        const loja = this.state.lojas.find(l => l.id === id);
        if (loja) {
          loja.status = novoStatus;
          if (novoStatus === "SUSPENDED") {
            this.state.estatisticas.lojasAtivas--;
            this.state.logs.unshift({
              id: Date.now().toString(),
              data: new Date().toISOString(),
              usuarioNome: "Super Admin",
              acao: "LOJA_SUSPENSA",
              detalhes: `Assinatura da loja '${loja.nome}' suspensa com sucesso pelo administrador.`,
              nivel: "HIGH"
            });
          } else {
            this.state.estatisticas.lojasAtivas++;
            this.state.logs.unshift({
              id: Date.now().toString(),
              data: new Date().toISOString(),
              usuarioNome: "Super Admin",
              acao: "LOJA_REATIVADA",
              detalhes: `Assinatura da loja '${loja.nome}' reativada com sucesso.`,
              nivel: "HIGH"
            });
          }
          this.mostrarToast(`Loja ${loja.nome} foi ${novoStatus === "ACTIVE" ? 'reativada' : 'suspensa'} com sucesso (Modo Demo).`, "success");
        }
      } else {
        // Backend Real
        const response = await fetch(`${this.apiUrl}/saas/lojas/${id}/status`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${this.token}`
          },
          body: JSON.stringify({ status: novoStatus })
        });
        
        if (!response.ok) {
          const dataErr = await response.json();
          throw new Error(dataErr.error || "Erro ao atualizar status da loja");
        }
        
        this.mostrarToast(`Status da loja atualizado com sucesso no banco de dados.`, "success");
        await this.carregarDados(); // Recarrega dados reais
      }

      this.atualizarMetricasUI();
      this.renderizarDashboard();
      this.renderizarLojas();
      this.renderizarLogs();

    } catch (error) {
      console.error(error);
      this.mostrarToast("Erro ao tentar atualizar status da loja: " + error.message, "error");
    }
  },

  atualizarPlanoLojaAPI: async function() {
    const select = document.getElementById("modal-loja-plano");
    const id = select.getAttribute("data-loja-id");
    const novoPlano = select.value;

    if (!id || !novoPlano) return;

    this.mostrarToast(`Atualizando plano para ${novoPlano}...`, "info");

    try {
      if (this.usandoDemo) {
        const loja = this.state.lojas.find(l => l.id === id);
        if (loja) {
          loja.plano = novoPlano;
          this.mostrarToast(`Plano da loja ${loja.nome} atualizado para ${novoPlano} (Modo Demo).`, "success");
        }
      } else {
        const response = await fetch(`${this.apiUrl}/saas/lojas/${id}/plano`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${this.token}`
          },
          body: JSON.stringify({ plano: novoPlano })
        });

        if (!response.ok) {
          const dataErr = await response.json();
          throw new Error(dataErr.error || "Erro ao atualizar plano da loja");
        }

        this.mostrarToast(`Plano atualizado com sucesso no banco de dados!`, "success");
        await this.carregarDados();
      }

      this.renderizarLojas();
    } catch (error) {
      console.error(error);
      this.mostrarToast("Erro ao tentar atualizar o plano: " + error.message, "error");
    }
  },

  // 10. Funções Auxiliares de UI, Criptografia e Segurança
  registrarEventos: function() {
    // Alternância de Abas SPA
    const navItems = document.querySelectorAll(".nav-menu .nav-item");
    navItems.forEach(item => {
      item.addEventListener("click", () => {
        navItems.forEach(i => i.classList.remove("active"));
        item.classList.add("active");
        
        const target = item.getAttribute("data-target");
        this.mudarAba(target);
      });
    });

    // Filtros de Lojas
    const btnFiltroLojas = document.getElementById("btn-filtro-lojas");
    if (btnFiltroLojas) {
      btnFiltroLojas.addEventListener("click", () => this.renderizarLojas());
    }
    const inputBuscaLojas = document.getElementById("lojas-busca-filtro");
    if (inputBuscaLojas) {
      inputBuscaLojas.addEventListener("keyup", (e) => {
        if (e.key === "Enter") this.renderizarLojas();
      });
    }

    // Filtros de Logs
    const btnFiltroLogs = document.getElementById("btn-filtro-logs");
    if (btnFiltroLogs) {
      btnFiltroLogs.addEventListener("click", () => this.renderizarLogs());
    }
    const inputBuscaLogs = document.getElementById("logs-busca-filtro");
    if (inputBuscaLogs) {
      inputBuscaLogs.addEventListener("keyup", (e) => {
        if (e.key === "Enter") this.renderizarLogs();
      });
    }

    // Modal Fechar
    document.getElementById("btn-close-modal-loja").addEventListener("click", () => {
      document.getElementById("saas-modal-detalhes-loja").style.display = "none";
    });
    document.getElementById("btn-modal-fechar").addEventListener("click", () => {
      document.getElementById("saas-modal-detalhes-loja").style.display = "none";
    });

    // Limpar logs visuais
    document.getElementById("btn-limpar-logs-visuais").addEventListener("click", () => {
      if (confirm("Deseja limpar localmente o histórico de logs visível? Os logs no banco de dados serão mantidos por segurança.")) {
        this.state.logs = [];
        this.renderizarLogs();
        this.mostrarToast("Histórico de auditoria limpo na exibição local.", "success");
      }
    });

    // Logout
    document.getElementById("btn-logout").addEventListener("click", () => {
      this.efetuarLogout();
    });

    // Backup e Teste de BD
    document.getElementById("btn-backup-agora").addEventListener("click", async () => {
      this.mostrarToast("Iniciando rotina de backup de segurança do SQLite...", "info");
      
      if (this.usandoDemo) {
        setTimeout(() => {
          this.mostrarToast("Backup simulado gerado com sucesso (Modo Demo): backup-local.db", "success");
        }, 1200);
        return;
      }

      try {
        const response = await fetch(`${this.apiUrl}/saas/backup`, {
          method: "POST",
          headers: { "Authorization": `Bearer ${this.token}` }
        });
        
        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.error || "Erro no servidor ao gerar backup");
        }
        
        const data = await response.json();
        this.mostrarToast(`Backup gerado com sucesso! Arquivo: ${data.filename} (${(data.sizeBytes/1024).toFixed(1)} KB)`, "success");
        
        // Recarregar os logs de auditoria reais
        await this.carregarDados();
      } catch (error) {
        console.error(error);
        this.mostrarToast("Erro ao tentar executar backup físico: " + error.message, "error");
      }
    });

    document.getElementById("btn-testar-db").addEventListener("click", async () => {
      this.mostrarToast("Executando auto-diagnóstico do banco central...", "info");

      if (this.usandoDemo) {
        setTimeout(() => {
          this.mostrarToast("Integridade do SQLite estrutural: 100% OK (Simulado).", "success");
        }, 1000);
        return;
      }

      try {
        const response = await fetch(`${this.apiUrl}/saas/diagnostico`, {
          headers: { "Authorization": `Bearer ${this.token}` }
        });
        
        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.error || "Erro no servidor ao diagnosticar");
        }
        
        const data = await response.json();
        this.mostrarToast(`Diagnóstico concluído: Banco ${data.dbStatus} (${data.provedor})`, "success");
      } catch (error) {
        console.error(error);
        this.mostrarToast("Erro ao diagnosticar banco central: " + error.message, "error");
      }
    });
  },

  toggleSidebarMobile: function() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (sidebar) sidebar.classList.toggle('active');
    if (overlay) overlay.classList.toggle('active');
    document.body.classList.toggle('sidebar-open');
  },

  fecharSidebarMobile: function() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (sidebar) sidebar.classList.remove('active');
    if (overlay) overlay.classList.remove('active');
    document.body.classList.remove('sidebar-open');
  },

  mudarAba: function(targetId) {
    this.abaAtiva = targetId;
    this.fecharSidebarMobile();
    const sections = document.querySelectorAll(".app-section");
    sections.forEach(sec => {
      sec.classList.remove("active");
      if (sec.id === targetId) sec.classList.add("active");
    });
  },

  efetuarLogout: function() {
    this.state = {};
    localStorage.clear();
    sessionStorage.clear();
    document.documentElement.removeAttribute('style');
    this.mostrarToast("Sessão de segurança encerrada.", "info");
    setTimeout(() => {
      window.location.href = "login.html";
    }, 800);
  },

  mostrarToast: function(message, type = "info") {
    const container = document.getElementById("toast-container");
    if (!container) return;

    const toast = document.createElement("div");
    toast.style.cssText = `
      background: ${type === 'success' ? '#2e7d32' : (type === 'error' ? '#c62828' : (type === 'warning' ? '#ef6c00' : '#1565c0'))};
      color: #fff; padding: 0.8rem 1.4rem; border-radius: 8px; font-size: 0.85rem;
      min-width: 250px; box-shadow: 0 4px 12px rgba(0,0,0,0.5); display: flex; align-items: center;
      gap: 0.8rem; transform: translateY(20px); opacity: 0; transition: all 0.3s ease;
      font-weight: 500; border-left: 4px solid rgba(255,255,255,0.4);
    `;
    
    let icon = '<i class="fa-solid fa-circle-info"></i>';
    if (type === 'success') icon = '<i class="fa-solid fa-circle-check"></i>';
    if (type === 'error') icon = '<i class="fa-solid fa-triangle-exclamation"></i>';
    
    toast.innerHTML = `${icon} <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.transform = "translateY(0)";
      toast.style.opacity = "1";
    }, 50);

    setTimeout(() => {
      toast.style.transform = "translateY(20px)";
      toast.style.opacity = "0";
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  },

  formatarMoeda: function(valor) {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor || 0);
  },

  escaparHTML: function(str) {
    if (!str) return "";
    return str.replace(/[&<>'"]/g, 
      tag => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
      }[tag] || tag)
    );
  }
};

// Inicializar ao carregar o DOM
window.addEventListener("DOMContentLoaded", () => {
  saasApp.init();
});
