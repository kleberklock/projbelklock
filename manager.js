/**
 * BelKlock Semijoias - Core Application Logic
 * Gerenciamento de estado, reatividade de precificação, controle de estoque, 
 * gestão de revendedoras (consignado), WhatsApp API, feed do Instagram e localStorage.
 */

const app = {
  // 1. Estado da Aplicação
  state: {
    apiUrl: "http://localhost:5000/api",
    token: null,
    usuarioLogado: null,
    produtos: [],
    revendedoras: [],
    clientes: [],
    feedImagens: [],
    abaAtiva: "dashboard",
    subAbaMktAtiva: "feed",
    subAbaEstoqueAtiva: "geral",
    subAbaClientesAtiva: "todos",
    produtosComDefeito: [],
    limiarEstoqueCritico: 3,
    nomeEmpresa: "BelKlock Semijoias",
    logoUrl: "",
    corPrimaria: "#d4af37",
    corSecundaria: "#111111",
    bgPrimary: "#0a0a0a",
    bgCard: "#121212",
    revendedoraSelecionadaId: null,
    usandoFicticio: true,
    colunasEstoque: ["Código", "Nome do Produto", "Categoria", "Estoque Central", "Custo Bruto", "Custo Banho", "Custo Oper.", "Markup", "Preço Venda"],
    vendasSessao: [], // Vendas registradas pela revendedora nesta sessão
    ordenacao: {
      estoque: { coluna: null, direcao: "asc" },
      clientes: { coluna: null, direcao: "asc" },
      vendas: { coluna: null, direcao: "asc" },
      defeitos: { coluna: null, direcao: "asc" }
    }
  },

  // Sistema de Toast premium
  toast: function(message, type = "info") {
    const container = document.getElementById("toast-container");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = `custom-toast ${type}`;
    
    let icon = "fa-circle-info";
    if (type === "success") icon = "fa-circle-check";
    if (type === "error") icon = "fa-circle-xmark";
    if (type === "warning") icon = "fa-triangle-exclamation";

    toast.innerHTML = `
      <i class="fa-solid ${icon}"></i>
      <span class="custom-toast-message">${message}</span>
    `;

    container.appendChild(toast);

    // Forçar reflow para ativar animação de entrada
    setTimeout(() => {
      toast.classList.add("show");
    }, 10);

    // Remover após 4 segundos
    setTimeout(() => {
      toast.classList.remove("show");
      setTimeout(() => {
        toast.remove();
      }, 400);
    }, 4000);
  },

  // Modal de Confirmação personalizado assíncrono (substitui o confirm nativo)
  confirmar: function(message, title = "Confirmar Ação") {
    return new Promise((resolve) => {
      const modal = document.getElementById("custom-confirm-modal");
      const titleEl = document.getElementById("confirm-title");
      const messageEl = document.getElementById("confirm-message");
      const btnYes = document.getElementById("btn-confirm-yes");
      const btnNo = document.getElementById("btn-confirm-no");

      if (!modal || !titleEl || !messageEl || !btnYes || !btnNo) {
        // Fallback para confirm se o DOM não tiver o modal por algum motivo
        resolve(confirm(message));
        return;
      }

      titleEl.innerText = title;
      messageEl.innerText = message;
      modal.style.display = "flex";

      const handleConfirm = () => {
        modal.style.display = "none";
        btnYes.removeEventListener("click", handleConfirm);
        btnNo.removeEventListener("click", handleCancel);
        resolve(true);
      };

      const handleCancel = () => {
        modal.style.display = "none";
        btnYes.removeEventListener("click", handleConfirm);
        btnNo.removeEventListener("click", handleCancel);
        resolve(false);
      };

      btnYes.addEventListener("click", handleConfirm);
      btnNo.addEventListener("click", handleCancel);
    });
  },

  // Método genérico para ordenação de tabelas
  ordenarTabela: function(tabela, coluna) {
    if (!this.state.ordenacao) {
      this.state.ordenacao = {
        estoque: { coluna: null, direcao: "asc" },
        clientes: { coluna: null, direcao: "asc" },
        vendas: { coluna: null, direcao: "asc" },
        defeitos: { coluna: null, direcao: "asc" }
      };
    }

    const ord = this.state.ordenacao[tabela];
    if (ord.coluna === coluna) {
      ord.direcao = ord.direcao === "asc" ? "desc" : "asc";
    } else {
      ord.coluna = coluna;
      ord.direcao = "asc";
    }

    if (tabela === "estoque") {
      this.renderizarEstoque();
    } else if (tabela === "clientes") {
      this.renderizarClientes();
    } else if (tabela === "vendas") {
      this.renderizarVendasConsolidadas();
    } else if (tabela === "defeitos") {
      this.renderizarDefeitos();
    }
  },

  // Pré-visualização de fotos no modal de produtos
  atualizarPreviewFotoProduto: function() {
    const urlInput = document.getElementById("prod-foto-url");
    const container = document.getElementById("prod-foto-preview-container");
    const img = document.getElementById("prod-foto-preview");

    if (!urlInput || !container || !img) return;

    const url = urlInput.value.trim();
    if (url) {
      img.src = url;
      container.style.display = "block";
    } else {
      img.src = "";
      container.style.display = "none";
    }
  },

  // 2. Inicialização do Aplicativo (Perfil Revendedora)
  init: function() {
    this.carregarDadosDoLocalStorage(); // Inicializa dados locais se necessário
    
    const token = localStorage.getItem("belklock_token");
    const usuarioJson = localStorage.getItem("belklock_usuario");
    
    if (!token || !usuarioJson) {
      this.fazerLogout();
      return;
    }
    
    try {
      const usuario = JSON.parse(usuarioJson);
      const roleUpper = (usuario.role || "").toUpperCase();
      
      // Permitir Consultant na página manager.html
      if (roleUpper === 'CONSULTANT') {
        this.state.token = token;
        this.state.usuarioLogado = usuario;
        this.exibirInterfacePosLogin();
        this.carregarDadosIniciais();
      } else if (roleUpper === 'MANAGER' || roleUpper === 'SUPERADMIN') {
        window.location.href = "superadmin.html";
      } else {
        console.warn("Role desconhecida ou inválida:", usuario.role);
        this.fazerLogout();
      }
    } catch (e) {
      console.error("Erro na inicialização da Consultora:", e);
      this.fazerLogout();
    }
  },

  registrarEventosLogin: function() {
    const btnLogin = document.getElementById("btn-executar-login");
    if (btnLogin) {
      btnLogin.addEventListener("click", () => this.fazerLogin());
    }

    const inputEmail = document.getElementById("login-email");
    const inputSenha = document.getElementById("login-senha");

    const enterHandler = (e) => {
      if (e.key === "Enter") this.fazerLogin();
    };

    if (inputEmail) inputEmail.addEventListener("keypress", enterHandler);
    if (inputSenha) inputSenha.addEventListener("keypress", enterHandler);
    
    // Botão de Logout na Sidebar
    const btnLogout = document.getElementById("btn-logout");
    if (btnLogout) {
      btnLogout.addEventListener("click", () => this.fazerLogout());
    }
  },

  fazerLogin: async function() {
    const email = document.getElementById("login-email").value.trim();
    const senha = document.getElementById("login-senha").value.trim();
    const errorBox = document.getElementById("login-error-msg");

    if (!email || !senha) {
      errorBox.innerText = "Por favor, preencha todos os campos.";
      errorBox.style.display = "block";
      return;
    }

    errorBox.style.display = "none";
    const btnLogin = document.getElementById("btn-executar-login");
    btnLogin.disabled = true;
    btnLogin.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Conectando...';

    try {
      const response = await fetch(`${this.state.apiUrl}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, senha })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erro ao tentar realizar login.");
      }

      // Salva dados no estado e no LocalStorage
      this.state.token = data.token;
      this.state.usuarioLogado = data.usuario;
      localStorage.setItem("belklock_token", data.token);
      localStorage.setItem("belklock_usuario", JSON.stringify(data.usuario));

      this.exibirInterfacePosLogin();
      this.carregarDadosIniciais();
    } catch (error) {
      console.error(error);
      
      // LOGICA DE FALLBACK OFFLINE (Modo de Demonstração):
      // Se a conexão com o servidor local falhar, permite logar localmente com credenciais mocadas para testar o visual!
      const conexaoFalhou = error instanceof TypeError || 
                            error.message.includes("Failed to fetch") || 
                            error.message.includes("fetch") || 
                            error.message.includes("Failed to execute") || 
                            error.message.includes("Você está offline");
      
      if (conexaoFalhou) {
        if ((email === "admin@belklock.com" || email === "0001") && senha === "belklock") {
          console.warn("Servidor Azure API offline. Iniciando em Modo de Demonstração (Admin local).");
          this.state.token = "mock_admin_token_" + Date.now();
          this.state.usuarioLogado = {
            id: "admin_local",
            nome: "Bel Klock Admin (Local)",
            email: "admin@belklock.com",
            pin: "0001",
            role: "admin",
            comissao: 0.0
          };
          localStorage.setItem("belklock_token", this.state.token);
          localStorage.setItem("belklock_usuario", JSON.stringify(this.state.usuarioLogado));
          
          this.exibirInterfacePosLogin();
          this.carregarDadosIniciais();
          this.toast("Aviso: Servidor local offline. Iniciando em Modo de Demonstração (Perfil Gestora).", "warning");
          return;
        } else {
          // Permite logar localmente em Modo de Demonstração se o PIN e senha inseridos forem válidos
          const revLocal = this.state.revendedoras.find(r => r.pin === email || r.email === email);
          if (revLocal) {
            console.warn("Servidor Azure API offline. Iniciando em Modo de Demonstração (Revendedora local).");
            this.state.token = "mock_rev_token_" + Date.now();
            this.state.usuarioLogado = {
              id: revLocal.id,
              nome: revLocal.nome,
              email: revLocal.email || (revLocal.pin + "@belklock.com"),
              pin: revLocal.pin,
              role: "Consultant",
              comissao: revLocal.comissao
            };
            localStorage.setItem("belklock_token", this.state.token);
            localStorage.setItem("belklock_usuario", JSON.stringify(this.state.usuarioLogado));
            
            this.exibirInterfacePosLogin();
            this.carregarDadosIniciais();
            this.toast(`Aviso: Servidor local offline. Iniciando em Modo de Demonstração (Perfil Consultora: ${revLocal.nome}).`, "warning");
            return;
          }
        }
      }

      errorBox.innerText = error.message || "Erro de conexão com o servidor da Azure.";
      errorBox.style.display = "block";
    } finally {
      btnLogin.disabled = false;
      btnLogin.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Entrar na Plataforma';
    }
  },

  fazerLogout: function() {
    this.state.token = null;
    this.state.usuarioLogado = null;
    localStorage.removeItem("belklock_token");
    localStorage.removeItem("belklock_usuario");
    window.location.href = "index.html";
  },

  exibirInterfaceLogin: function() {
    window.location.href = "index.html";
  },

  exibirInterfacePosLogin: function() {
    // Atualiza o título da marca
    const mainH1 = document.getElementById("main-h1");
    if (mainH1) mainH1.innerText = this.state.nomeEmpresa || "BelKlock Semijoias";

    this.atualizarInfoUsuarioSidebar();
    this.aplicarRestricoesPerfil();
  },

  carregarConfiguracaoAPI: async function() {
    try {
      const lojaId = localStorage.getItem("belklock_loja_id") || "default-loja";
      const response = await fetch(`${this.state.apiUrl}/config`, {
        headers: { "x-loja-id": lojaId }
      });
      if (response.ok) {
        const config = await response.json();
        this.aplicarConfiguracoes(config);
        return;
      }
    } catch (error) {
      console.warn("Não foi possível buscar as configurações do servidor. Usando fallback local.", error);
    }
    // Fallback local do state / localStorage
    const configLocal = {
      nomeEmpresa: this.state.nomeEmpresa || "BelKlock Semijoias",
      logoUrl: this.state.logoUrl || "",
      corPrimaria: this.state.corPrimaria || "#d4af37",
      corSecundaria: this.state.corSecundaria || "#111111",
      bgPrimary: this.state.bgPrimary || "#0a0a0a",
      bgCard: this.state.bgCard || "#121212"
    };
    this.aplicarConfiguracoes(configLocal);
  },

  aplicarConfiguracoes: function(config) {
    if (!config) return;
    
    // Atualizar no estado da aplicação
    this.state.nomeEmpresa = config.nomeEmpresa;
    this.state.logoUrl = config.logoUrl || "";
    this.state.corPrimaria = config.corPrimaria;
    this.state.corSecundaria = config.corSecundaria;
    this.state.bgPrimary = config.bgPrimary;
    this.state.bgCard = config.bgCard;
    
    // Salvar localmente no localStorage
    localStorage.setItem("belklock_nome_empresa", config.nomeEmpresa);
    localStorage.setItem("belklock_logo_url", config.logoUrl || "");
    localStorage.setItem("belklock_cor_primaria", config.corPrimaria);
    localStorage.setItem("belklock_cor_secundaria", config.corSecundaria);
    localStorage.setItem("belklock_bg_primary", config.bgPrimary);
    localStorage.setItem("belklock_bg_card", config.bgCard);

    // Atualizar Title
    document.title = `${config.nomeEmpresa} - Gestão Premium`;
    
    // Atualizar Logo da sidebar
    const logoBrand = document.getElementById("logo-brand");
    const brandTextSpan = document.getElementById("brand-text-span");
    if (logoBrand) {
      if (config.logoUrl && config.logoUrl !== "" && !config.logoUrl.includes("logo.svg")) {
        logoBrand.src = config.logoUrl;
        logoBrand.alt = config.nomeEmpresa;
        logoBrand.style.display = "block";
        if (brandTextSpan) brandTextSpan.style.display = "none";
      } else {
        if (config.nomeEmpresa && config.nomeEmpresa !== "BelKlock Semijoias" && config.nomeEmpresa !== "") {
          logoBrand.style.display = "none";
          if (brandTextSpan) {
            brandTextSpan.innerText = config.nomeEmpresa;
            brandTextSpan.style.display = "block";
          }
        } else {
          logoBrand.src = "assets/logo.svg";
          logoBrand.alt = "BelKlock Semijoias";
          logoBrand.style.display = "block";
          if (brandTextSpan) brandTextSpan.style.display = "none";
        }
      }
    }
    
    // Atualizar main H1
    const mainH1 = document.getElementById("main-h1");
    if (mainH1) mainH1.innerText = config.nomeEmpresa;
    
    // Atualizar outros rodapés e notas com IDs
    const sidebarVer = document.getElementById("sidebar-footer-version");
    if (sidebarVer) sidebarVer.innerText = `${config.nomeEmpresa} v1.0`;
    
    const sidebarCopy = document.getElementById("sidebar-footer-copy");
    if (sidebarCopy) sidebarCopy.innerHTML = `&copy; 2026 ${config.nomeEmpresa}`;
    
    const secNote = document.getElementById("cfg-security-note");
    if (secNote) secNote.innerText = `${config.nomeEmpresa} utiliza criptografia SSL ponta-a-ponta nas requisições da API e persistência reativa local para garantir a integridade dos seus dados em qualquer circunstância.`;
    
    // Atualizar tabela de acertos (coluna líquido) e textos "A pagar para"
    document.querySelectorAll(".lbl-liquido-empresa").forEach(el => el.innerText = `Líquido ${config.nomeEmpresa}`);
    document.querySelectorAll(".lbl-a-pagar-empresa").forEach(el => el.innerText = `A pagar para ${config.nomeEmpresa}`);

    // Aplicar CSS
    aplicarTemaLoja(config);
  },

  atualizarInfoUsuarioSidebar: function() {
    const infoContainer = document.getElementById("sidebar-user-info");
    const avatarEl = document.getElementById("sidebar-user-avatar");
    const nameEl = document.getElementById("sidebar-user-name");
    const roleEl = document.getElementById("sidebar-user-role");

    if (this.state.usuarioLogado) {
      const usuario = this.state.usuarioLogado;
      nameEl.innerText = usuario.nome || "Usuário";
      const roleLabels = {
        'SuperAdmin': 'Administrador do Sistema',
        'Manager': 'Gestora',
        'Consultant': 'Consultora',
        // Fallback para compatibilidade
        'SUPER_ADMIN': 'Administrador do Sistema',
        'ADMIN_LOJA': 'Gestora',
        'VENDEDORA': 'Consultora',
        'admin': 'Gestora',
        'revendedora': 'Consultora'
      };
      roleEl.innerText = roleLabels[usuario.role] || usuario.role;
      const inicial = usuario.nome ? usuario.nome.charAt(0) : "U";
      avatarEl.innerText = inicial;
      infoContainer.style.display = "flex";
    } else {
      infoContainer.style.display = "none";
    }
  },

  aplicarRestricoesPerfil: function() {
    const role = this.state.usuarioLogado ? this.state.usuarioLogado.role : "Consultant";
    
    const menuPlanilhas = document.querySelector('.nav-item[data-target="planilhas"]');
    const menuRevendedoras = document.querySelector('.nav-item[data-target="revendedoras"]');
    const menuMinhaMaleta = document.getElementById("menu-minha-maleta");
    const menuEstoque = document.querySelector('.nav-item[data-target="estoque"]');
    const menuMarketing = document.querySelector('.nav-item[data-target="marketing"]');
    const menuDashboard = document.querySelector('.nav-item[data-target="dashboard"]');
    const menuClientes = document.querySelector('.nav-item[data-target="clientes"]');
    const btnCadastrarProduto = document.getElementById("btn-open-modal-produto");
    const divHeaderActions = document.querySelector("#dashboard .header-actions");
    const menuVendasGeral = document.getElementById("menu-vendas-geral");
    const menuConfiguracoes = document.getElementById("menu-configuracoes");
 
    if (role === "Consultant" || role === "VENDEDORA" || role === "revendedora") {
      if (menuPlanilhas) menuPlanilhas.style.display = "none";
      if (menuRevendedoras) menuRevendedoras.style.display = "none";
      if (menuEstoque) menuEstoque.style.display = "none";
      if (menuMarketing) menuMarketing.style.display = "none";
      if (menuDashboard) menuDashboard.style.display = "none";
      if (menuVendasGeral) menuVendasGeral.style.display = "none";
      if (menuClientes) menuClientes.style.display = "block";
      if (menuConfiguracoes) menuConfiguracoes.style.display = "none";
      if (btnCadastrarProduto) btnCadastrarProduto.style.display = "none";
      if (divHeaderActions) divHeaderActions.style.display = "none";
      if (menuMinhaMaleta) menuMinhaMaleta.style.display = "block";
      this.state.abaAtiva = "minha-maleta";
    } else {
      if (menuPlanilhas) menuPlanilhas.style.display = "block";
      if (menuRevendedoras) menuRevendedoras.style.display = "block";
      if (menuEstoque) menuEstoque.style.display = "block";
      if (menuMarketing) menuMarketing.style.display = "block";
      if (menuDashboard) menuDashboard.style.display = "block";
      if (menuVendasGeral) menuVendasGeral.style.display = "block";
      if (menuClientes) menuClientes.style.display = "block";
      if (menuConfiguracoes) menuConfiguracoes.style.display = "block";
      if (menuMinhaMaleta) menuMinhaMaleta.style.display = "none";
      if (btnCadastrarProduto) btnCadastrarProduto.style.display = "inline-flex";
      if (divHeaderActions) divHeaderActions.style.display = "block";
      if (this.state.abaAtiva === "minha-maleta") {
        this.state.abaAtiva = "dashboard";
      }
    }
  },

  carregarDadosIniciais: async function() {
    this.registrarEventosUI();
    this.inicializarFeedPadrao();
    
    // Carrega a configuração da marca e tema do backend
    await this.carregarConfiguracaoAPI();

    // Dispara carregamento assíncrono dos dados da API
    await this.carregarProdutosDaAPI();
    
    if (['Manager', 'SuperAdmin', 'ADMIN_LOJA', 'SUPER_ADMIN', 'admin'].includes(this.state.usuarioLogado.role)) {
      await this.carregarRevendedorasDaAPI();
      await this.carregarClientesDaAPI();
      await this.carregarVendasConsolidadas();
      this.renderizarAbas();
      this.renderizarEstoque();
      this.renderizarRevendedoras();
      this.renderizarDashboard();
      this.renderizarMarketing();
      this.renderizarClientes();
    } else {
      // Revendedora: carrega maleta e navega direto para Minha Maleta
      await this.carregarMaletaPropriaDaAPI();
      await this.carregarVendasRevendedora();
      await this.carregarClientesDaAPI();
      try {
        this.state.vendasPendentes = await this.requisitarAPI("/vendas-revendedora?apenasPendentes=true");
      } catch (err) {
        console.warn("Falha ao carregar vendas pendentes:", err.message);
        this.state.vendasPendentes = [];
      }
      this.aplicarRestricoesPerfil();
      this.renderizarAbas();
      this.renderizarMinhaMaleta();
      this.renderizarClientes();
      // Atualiza boas-vindas com nome
      const el = document.getElementById("maleta-boas-vindas");
      if (el) el.innerText = `Olá, ${this.state.usuarioLogado.nome.split(' ')[0]}! 💎`;
      this.carregarPreferenciaPagamento();
      this.checarTermosPendentes();
    }
    
    console.log("BelKlock Semijoias inicializado com sucesso!");
  },

  // ==========================================
  // COMUNICAÇÃO COM A API DA AZURE (HTTP / JWT)
  // ==========================================

  requisitarAPI: async function(endpoint, metodo = "GET", body = null) {
    const lojaId = localStorage.getItem("belklock_loja_id") || "default-loja";
    const headers = {
      "Authorization": `Bearer ${this.state.token}`,
      "x-loja-id": lojaId
    };

    if (body && !(body instanceof FormData)) {
      headers["Content-Type"] = "application/json";
    }

    const config = {
      method: metodo,
      headers: headers
    };

    if (body) {
      config.body = body instanceof FormData ? body : JSON.stringify(body);
    }

    const response = await fetch(`${this.state.apiUrl}${endpoint}`, config);
    
    if (response.status === 401 || response.status === 403) {
      this.fazerLogout();
      throw new Error("Sua sessão expirou. Por favor, realize login novamente.");
    }

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Erro na comunicação com a API.");
    }
    return data;
  },

  carregarProdutosDaAPI: async function() {
    try {
      const produtos = await this.requisitarAPI("/produtos");
      this.state.produtos = produtos;
      this.state.usandoFicticio = false;
      
      // Garante _valoresDinamicos preenchidos para compatibilidade com renderizador dinâmico
      this.state.produtos.forEach(p => {
        const custoTotal = (p.custoBruto || 0) + (p.custoBanho || 0) + (p.custoLiquido || 0);
        const precoVendaCalculado = custoTotal * (p.markup || 3.0);
        p._valoresDinamicos = {
          "Código": p.codigo,
          "Nome do Produto": p.nome,
          "Categoria": p.categoria,
          "Estoque Central": p.quantidade,
          "Custo Bruto": p.custoBruto,
          "Custo Banho": p.custoBanho,
          "Custo Oper.": p.custoLiquido,
          "Markup": p.markup,
          "Preço Venda": p.precoVenda || precoVendaCalculado
        };
      });
    } catch (error) {
      console.warn("Falha ao obter produtos da API da Azure, usando dados locais de demonstração:", error.message);
      this.carregarDadosDoLocalStorage();
    }
  },

  carregarRevendedorasDaAPI: async function() {
    try {
      const revendedoras = await this.requisitarAPI("/revendedoras");
      this.state.revendedoras = revendedoras;
      
      // Mapeia revendedoras vindas da API para compatibilidade
      this.state.revendedoras.forEach(r => {
        r.consignado = r.consignados.map(c => ({
          produtoId: c.produtoId,
          codigo: c.produto.codigo,
          nome: c.produto.nome,
          quantidadeConsignada: c.quantidadeConsignada,
          precoVenda: c.precoVenda
        }));
      });
    } catch (error) {
      console.warn("Falha ao obter revendedoras da API, usando dados locais:", error.message);
      this.carregarDadosDoLocalStorage();
    }
  },

  carregarMaletaPropriaDaAPI: async function() {
    try {
      const res = await this.requisitarAPI("/revendedoras/minha-maleta");
      const maleta = res && res.consignado ? res.consignado : (Array.isArray(res) ? res : []);
      const faixas = res && res.faixasComissao ? res.faixasComissao : [];
      const config = res && res.config ? res.config : {};

      this.state.revendedoras = [{
        id: this.state.usuarioLogado.id,
        nome: this.state.usuarioLogado.nome,
        whatsapp: this.state.usuarioLogado.whatsapp || "",
        comissao: this.state.usuarioLogado.comissao,
        consignado: maleta,
        faixasComissao: faixas,
        tipoComissao: config.tipoComissao || "FIXA",
        metaUnicaValor: config.metaUnicaValor || 0.0,
        metaUnicaBonus: config.metaUnicaBonus || 0.0,
        metaUnicaTipoBonus: config.metaUnicaTipoBonus || "PERCENTUAL",
        baseCalculo: config.baseCalculo || "BRUTO",
        regraPerda: config.regraPerda || "VALOR_VENDA",
        limiteIsencaoPerda: config.limiteIsencaoPerda || 0,
        periodoAcumulo: config.periodoAcumulo || "MANUAL"
      }];
      this.state.revendedoraSelecionadaId = this.state.usuarioLogado.id;
    } catch (error) {
      console.warn("Falha ao obter maleta própria da API:", error.message);
      this.carregarDadosDoLocalStorage();
    }
  },

  carregarVendasRevendedora: async function() {
    const offlineMode = this.state.token && this.state.token.startsWith("mock_");
    if (offlineMode) {
      const localVendasKey = `belklock_vendas_${this.state.usuarioLogado.id}`;
      this.state.vendasSessao = JSON.parse(localStorage.getItem(localVendasKey) || "[]");
      return;
    }

    try {
      const vendas = await this.requisitarAPI("/vendas-revendedora");
      this.state.vendasSessao = vendas;
    } catch (error) {
      console.warn("Falha ao carregar vendas:", error.message);
      this.state.vendasSessao = [];
    }
  },

  // ==========================================
  // TELA MINHA MALETA (REVENDEDORA)
  // ==========================================

  renderizarMinhaMaleta: function() {
    const rev = this.state.revendedoras.find(r => r.id === (this.state.usuarioLogado ? this.state.usuarioLogado.id : null));
    const comissao = this.state.usuarioLogado ? Number(this.state.usuarioLogado.comissao || 30) : 30;
    const maleta = rev ? (rev.consignado || []) : [];

    // Calcula totais
    let totalPecas = 0;
    let valorTotal = 0;
    maleta.forEach(item => {
      totalPecas += Number(item.quantidadeConsignada || 0);
      valorTotal += Number(item.precoVenda || 0) * Number(item.quantidadeConsignada || 0);
    });
    const comissaoProjetada = valorTotal * (comissao / 100);

    // Atualiza cards
    const elPecas = document.getElementById("maleta-total-pecas");
    const elValor = document.getElementById("maleta-valor-total");
    const elComissao = document.getElementById("maleta-comissao-projetada");
    const elVendas = document.getElementById("maleta-vendas-hoje");
    if (elPecas) elPecas.innerText = `${totalPecas} pçs`;
    if (elValor) elValor.innerText = `R$ ${valorTotal.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
    if (elComissao) elComissao.innerText = `R$ ${comissaoProjetada.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
    if (elVendas) elVendas.innerText = this.state.vendasSessao.length;

    // Renderiza tabela de histórico de vendas
    this.renderizarHistoricoVendasRev();
    
    // Atualiza a barra de comissão progressiva da revendedora
    this.atualizarProgressaoComissaoVendedora();

    // Renderiza tabela de peças
    const tbody = document.getElementById("tbody-minha-maleta");
    if (!tbody) return;
    tbody.innerHTML = "";

    if (maleta.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align: center; color: var(--text-secondary); padding: 3rem;">
            <i class="fa-solid fa-briefcase" style="font-size: 2rem; opacity: 0.3; display: block; margin-bottom: 0.8rem;"></i>
            Você ainda não tem peças consignadas. Entre em contato com a administradora.
          </td>
        </tr>`;
      return;
    }

    maleta.forEach(item => {
      const subtotal = Number(item.precoVenda || 0) * Number(item.quantidadeConsignada || 0);
      const comissaoItem = subtotal * (comissao / 100);
      const tr = document.createElement("tr");
      tr.setAttribute("data-busca", `${item.codigo || ""} ${item.nome || ""}`.toLowerCase());
      tr.innerHTML = `
        <td><strong>${item.codigo || "—"}</strong></td>
        <td>${item.nome || "—"}</td>
        <td><span class="badge badge-ok" style="font-size:0.75rem;">${item.categoria || "—"}</span></td>
        <td><span style="font-size: 1.1rem; font-weight: 700; color: var(--gold-primary);">${item.quantidadeConsignada}</span></td>
        <td>R$ ${Number(item.precoVenda || 0).toFixed(2).replace(".", ",")}</td>
        <td style="color: var(--text-primary);">R$ ${subtotal.toFixed(2).replace(".", ",")}</td>
        <td style="color: #81c784; font-weight: 600;">R$ ${comissaoItem.toFixed(2).replace(".", ",")}</td>
        <td>
          <button class="btn-qty" style="background: rgba(67,160,71,0.15); border-color: rgba(67,160,71,0.4); color: #81c784; padding: 0.4rem 0.8rem; border-radius: 6px; font-size: 0.8rem; white-space: nowrap;"
            onclick="app.abrirModalVendaRevProduto('${item.produtoId}', '${(item.nome || "").replace(/'/g, "\\'")}', ${item.precoVenda}, ${item.quantidadeConsignada})">
            <i class="fa-solid fa-check"></i> Vendi!
          </button>
        </td>`;
      tbody.appendChild(tr);
    });
  },

  atualizarProgressaoComissaoVendedora: function() {
    const card = document.getElementById("vendedora-progressao-card");
    const progressBar = document.getElementById("vendedora-progressao-barra");
    const statusText = document.getElementById("vendedora-proxima-faixa-status");
    const infoText = document.getElementById("vendedora-progressao-info");

    if (!card) return;

    const rev = this.state.revendedoras.find(r => r.id === this.state.usuarioLogado.id);
    if (!rev) {
      card.style.display = "none";
      return;
    }

    // Calcula o total de vendas pendentes no período atual
    let totalVendidoPeriodo = 0;
    const vendasPendentes = this.state.vendasPendentes || [];
    vendasPendentes.forEach(v => {
      totalVendidoPeriodo += Number(v.precoVenda || 0) * Number(v.quantidade || 1);
    });

    card.style.display = "block";

    // Cenário 1: COMISSÃO FIXA
    if (!rev.tipoComissao || rev.tipoComissao === "FIXA") {
      // Para comissão fixa, mostramos o progresso de vendas em relação ao valor total da maleta (consignado + vendido)
      let totalConsignadoRestante = 0;
      const consignados = rev.consignado || [];
      consignados.forEach(c => {
        totalConsignadoRestante += Number(c.precoVenda || 0) * Number(c.quantidadeConsignada || 0);
      });

      const totalMaletaOriginal = totalVendidoPeriodo + totalConsignadoRestante;
      const pct = totalMaletaOriginal > 0 ? Math.min(100, Math.max(0, (totalVendidoPeriodo / totalMaletaOriginal) * 100)) : 0;
      
      progressBar.style.width = `${pct}%`;
      statusText.innerHTML = `Comissão Fixa: <strong>${rev.comissao || 30}%</strong>`;
      infoText.innerHTML = `Você já vendeu <strong>R$ ${totalVendidoPeriodo.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</strong> do total de <strong>R$ ${totalMaletaOriginal.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</strong> da sua maleta atual (<strong>${pct.toFixed(1)}%</strong> da maleta vendida).`;
      return;
    }

    // Cenário 2: META ÚNICA
    if (rev.tipoComissao === "META_UNICA") {
      const meta = rev.metaUnicaValor || 5000;
      const bonus = rev.metaUnicaBonus || 5;
      const tipoBonus = rev.metaUnicaTipoBonus || "PERCENTUAL";
      
      const atingiu = totalVendidoPeriodo >= meta;
      const pct = Math.min(100, Math.max(0, (totalVendidoPeriodo / meta) * 100));
      progressBar.style.width = `${pct}%`;

      if (atingiu) {
        statusText.innerHTML = `Meta Atingida! <strong>Parabéns!</strong>`;
        if (tipoBonus === "PERCENTUAL") {
          infoText.innerHTML = `<strong style="color: #81c784;"><i class="fa-solid fa-crown"></i> Meta de R$ ${meta.toLocaleString('pt-BR', {minimumFractionDigits: 2})} Superada!</strong> Sua comissão neste acerto subiu para <strong>${Number(rev.comissao || 30) + bonus}%</strong> (+${bonus}% de bônus).`;
        } else {
          infoText.innerHTML = `<strong style="color: #81c784;"><i class="fa-solid fa-crown"></i> Meta de R$ ${meta.toLocaleString('pt-BR', {minimumFractionDigits: 2})} Superada!</strong> Você garantiu um bônus extra de <strong>R$ ${bonus.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</strong> em dinheiro além da comissão de ${rev.comissao || 30}%.`;
        }
      } else {
        const faltam = meta - totalVendidoPeriodo;
        statusText.innerHTML = `Meta de Vendas: <strong>R$ ${meta.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</strong>`;
        if (tipoBonus === "PERCENTUAL") {
          infoText.innerHTML = `Você vendeu <strong>R$ ${totalVendidoPeriodo.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</strong>. Faltam <strong style="color: var(--gold-primary);">R$ ${faltam.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</strong> para atingir a meta e ganhar <strong>+${bonus}%</strong> de comissão!`;
        } else {
          infoText.innerHTML = `Você vendeu <strong>R$ ${totalVendidoPeriodo.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</strong>. Faltam <strong style="color: var(--gold-primary);">R$ ${faltam.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</strong> para atingir a meta e ganhar um bônus extra de <strong>R$ ${bonus.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</strong>!`;
        }
      }
      return;
    }

    // Cenário 3: COMISSÃO PROGRESSIVA
    if (rev.tipoComissao === "PROGRESSIVA") {
      const faixas = rev.faixasComissao || [];
      if (faixas.length === 0) {
        progressBar.style.width = "0%";
        statusText.innerHTML = `Sua Comissão: <strong>${rev.comissao || 30}%</strong>`;
        infoText.innerHTML = `Você já vendeu <strong>R$ ${totalVendidoPeriodo.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</strong> no acerto atual. Nenhuma faixa progressiva cadastrada.`;
        return;
      }

      // Ordena faixas por valorMin
      faixas.sort((a, b) => a.valorMin - b.valorMin);

      // Encontra a faixa atual
      let faixaAtual = null;
      for (let i = 0; i < faixas.length; i++) {
        if (totalVendidoPeriodo >= faixas[i].valorMin) {
          faixaAtual = faixas[i];
        }
      }

      const comissaoPadrao = rev.comissao || 30;
      const percentualAtual = faixaAtual ? faixaAtual.percentual : comissaoPadrao;

      // Encontra a próxima faixa
      let proximaFaixa = null;
      if (!faixaAtual) {
        proximaFaixa = faixas[0];
      } else {
        const indexAtual = faixas.indexOf(faixaAtual);
        if (indexAtual < faixas.length - 1) {
          proximaFaixa = faixas[indexAtual + 1];
        }
      }

      statusText.innerHTML = `Sua Comissão Atual: <strong>${percentualAtual}%</strong>`;

      if (proximaFaixa) {
        const faltamParaProxima = proximaFaixa.valorMin - totalVendidoPeriodo;
        const valorBase = faixaAtual ? faixaAtual.valorMin : 0;
        const totalNecessario = proximaFaixa.valorMin - valorBase;
        const progresso = totalVendidoPeriodo - valorBase;
        const pct = Math.min(100, Math.max(0, (progresso / totalNecessario) * 100));

        progressBar.style.width = `${pct}%`;
        infoText.innerHTML = `Você já vendeu <strong>R$ ${totalVendidoPeriodo.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</strong> no acerto atual. Faltam <strong style="color: var(--gold-primary);">R$ ${faltamParaProxima.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</strong> para você atingir a comissão de <strong>${proximaFaixa.percentual}%</strong>!`;
      } else {
        // Última faixa atingida! Progresso em 100%
        progressBar.style.width = "100%";
        infoText.innerHTML = `<strong style="color: #81c784;"><i class="fa-solid fa-crown"></i> Faixa Máxima Atingida (${percentualAtual}%)!</strong> Você já vendeu <strong>R$ ${totalVendidoPeriodo.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</strong> no acerto atual. Parabéns pelo excelente resultado!`;
      }
    }
  },

  renderizarHistoricoVendasRev: function() {
    const tbody = document.getElementById("tbody-vendas-revendedora");
    if (!tbody) return;
    tbody.innerHTML = "";

    const vendas = this.state.vendasSessao;
    if (!vendas || vendas.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--text-secondary);padding:3rem;">Nenhuma venda registrada ainda. Use o botão "Fiz uma Venda!" para começar.</td></tr>`;
      return;
    }

    vendas.forEach(v => {
      const totalVenda = Number(v.precoVenda || 0) * Number(v.quantidade || 0);
      const data = new Date(v.data).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td style="color: var(--text-secondary); font-size: 0.85rem;">${data}</td>
        <td><strong>${v.nomeProduto || "—"}</strong><br><span style="font-size:0.78rem;color:var(--text-secondary);">${v.codigoProduto || ""}</span></td>
        <td>${v.quantidade} unid.</td>
        <td>R$ ${Number(v.precoVenda || 0).toFixed(2).replace(".", ",")}</td>
        <td style="color: var(--gold-primary); font-weight: 700;">R$ ${totalVenda.toFixed(2).replace(".", ",")}</td>
        <td style="color: #81c784; font-weight: 700;">R$ ${Number(v.comissaoValor || 0).toFixed(2).replace(".", ",")}</td>`;
      tbody.appendChild(tr);
    });
  },

  filtrarMaletaPecas: function() {
    const busca = (document.getElementById("maleta-busca-peca").value || "").toLowerCase();
    document.querySelectorAll("#tbody-minha-maleta tr[data-busca]").forEach(tr => {
      const texto = tr.getAttribute("data-busca") || "";
      tr.style.display = texto.includes(busca) ? "" : "none";
    });
  },

  mudarSubAbaMaleta: function(aba) {
    document.getElementById("sub-maleta-pecas").style.display = aba === "pecas" ? "block" : "none";
    document.getElementById("sub-maleta-historico").style.display = aba === "historico" ? "block" : "none";
    document.getElementById("btn-subtab-maleta-rev").classList.toggle("active", aba === "pecas");
    document.getElementById("btn-subtab-historico-rev").classList.toggle("active", aba === "historico");

    if (aba === "historico") {
      this.renderizarHistoricoVendasRev();
    }
  },

  // Abre modal de venda a partir do botão da tabela (com produto pré-selecionado)
  abrirModalVendaRevProduto: function(produtoId, nome, preco, maxQtd) {
    this._abrirModalVendaRevInterno();
    const select = document.getElementById("venda-rev-produto");
    if (select) select.value = produtoId;
    const qtdInput = document.getElementById("venda-rev-qtd");
    if (qtdInput) { qtdInput.value = 1; qtdInput.max = maxQtd; }
    this.atualizarPreviewVendaRev();
  },

  _abrirModalVendaRevInterno: function() {
    const rev = this.state.revendedoras.find(r => r.id === (this.state.usuarioLogado ? this.state.usuarioLogado.id : null));
    const maleta = rev ? (rev.consignado || []) : [];
    const select = document.getElementById("venda-rev-produto");
    if (!select) return;

    // Popula o select com as peças da maleta
    select.innerHTML = "<option value=''>— Selecione uma peça da sua maleta —</option>";
    maleta.forEach(item => {
      const opt = document.createElement("option");
      opt.value = item.produtoId;
      opt.textContent = `[${item.codigo || '—'}] ${item.nome} (${item.quantidadeConsignada} unid. — R$ ${Number(item.precoVenda||0).toFixed(2).replace(".",",")})`;
      opt.setAttribute("data-preco", item.precoVenda);
      opt.setAttribute("data-max", item.quantidadeConsignada);
      select.appendChild(opt);
    });

    // Reseta campos
    const qtdInput = document.getElementById("venda-rev-qtd");
    if (qtdInput) { qtdInput.value = 1; qtdInput.max = 99; }
    
    const hasDiscount = document.getElementById("venda-rev-has-discount");
    if (hasDiscount) hasDiscount.checked = false;
    const discountBox = document.getElementById("venda-rev-discount-box");
    if (discountBox) discountBox.style.display = "none";
    const discountVal = document.getElementById("venda-rev-desconto");
    if (discountVal) discountVal.value = 0;
    const discountReason = document.getElementById("venda-rev-desconto-motivo");
    if (discountReason) discountReason.value = "";
    const paymentSelect = document.getElementById("venda-rev-pagamento");
    if (paymentSelect) paymentSelect.value = "Dinheiro";

    const preview = document.getElementById("venda-rev-preview");
    if (preview) preview.style.display = "none";
    const aviso = document.getElementById("venda-rev-aviso");
    if (aviso) aviso.style.display = "none";

    // Mostra percentual de comissão
    const pct = document.getElementById("prev-venda-comissao-pct");
    if (pct) pct.innerText = this.state.usuarioLogado ? this.state.usuarioLogado.comissao : 30;

    document.getElementById("modal-venda-rev").classList.add("active");
  },

  toggleDescontoVendaRev: function() {
    const hasDiscount = document.getElementById("venda-rev-has-discount");
    const box = document.getElementById("venda-rev-discount-box");
    const input = document.getElementById("venda-rev-desconto");
    const reason = document.getElementById("venda-rev-desconto-motivo");
    
    if (!box || !hasDiscount) return;
    
    if (hasDiscount.checked) {
      box.style.display = "block";
    } else {
      box.style.display = "none";
      if (input) input.value = 0;
      if (reason) reason.value = "";
    }
    this.atualizarPreviewVendaRev();
  },

  atualizarPreviewVendaRev: function() {
    const select = document.getElementById("venda-rev-produto");
    const qtdInput = document.getElementById("venda-rev-qtd");
    const preview = document.getElementById("venda-rev-preview");
    const aviso = document.getElementById("venda-rev-aviso");
    if (!select || !qtdInput || !preview) return;

    const selectedOpt = select.options[select.selectedIndex];
    if (!selectedOpt || !selectedOpt.value) {
      preview.style.display = "none";
      return;
    }

    const preco = parseFloat(selectedOpt.getAttribute("data-preco") || 0);
    const max = parseInt(selectedOpt.getAttribute("data-max") || 99);
    const qtd = parseInt(qtdInput.value) || 1;
    const comissao = this.state.usuarioLogado ? Number(this.state.usuarioLogado.comissao || 30) : 30;

    qtdInput.max = max;

    if (aviso) {
      if (qtd > max) {
        aviso.style.display = "block";
        document.getElementById("venda-rev-aviso-texto").innerText = `Você só tem ${max} unidade(s) desta peça na maleta.`;
      } else {
        aviso.style.display = "none";
      }
    }

    const totalBruto = preco * Math.min(qtd, max);
    
    let desconto = 0;
    const hasDiscount = document.getElementById("venda-rev-has-discount");
    const discountVal = document.getElementById("venda-rev-desconto");
    if (hasDiscount && hasDiscount.checked && discountVal) {
      desconto = parseFloat(discountVal.value) || 0;
      if (desconto > totalBruto) {
        desconto = totalBruto;
        discountVal.value = totalBruto.toFixed(2);
      }
    }
    
    const totalLiquido = totalBruto - desconto;
    const comissaoValor = totalLiquido * (comissao / 100);

    const textSplit = selectedOpt.textContent.split("] ");
    const nomeProduto = textSplit.length > 1 ? textSplit[1].split(" (")[0] : selectedOpt.textContent.split(" (")[0];

    document.getElementById("prev-venda-nome").innerText = nomeProduto;
    document.getElementById("prev-venda-qtd").innerText = `${Math.min(qtd, max)} unid.`;
    document.getElementById("prev-venda-preco-unit").innerText = `R$ ${preco.toFixed(2).replace(".", ",")}`;
    
    const descRow = document.getElementById("prev-venda-desconto-row");
    const descValSpan = document.getElementById("prev-venda-desconto-val");
    if (desconto > 0) {
      if (descRow) descRow.style.display = "flex";
      if (descValSpan) descValSpan.innerText = `- R$ ${desconto.toFixed(2).replace(".", ",")}`;
    } else {
      if (descRow) descRow.style.display = "none";
    }

    document.getElementById("prev-venda-total").innerText = `R$ ${totalLiquido.toFixed(2).replace(".", ",")}`;
    document.getElementById("prev-venda-comissao-valor").innerText = `R$ ${comissaoValor.toFixed(2).replace(".", ",")}`;

    preview.style.display = "block";
  },

  ajustarQtdVendaRev: function(delta) {
    const input = document.getElementById("venda-rev-qtd");
    if (!input) return;
    let val = parseInt(input.value) || 1;
    const max = parseInt(input.max) || 99;
    val = Math.min(Math.max(val + delta, 1), max);
    input.value = val;
    this.atualizarPreviewVendaRev();
  },

  confirmarVendaRevendedora: async function() {
    const select = document.getElementById("venda-rev-produto");
    const qtdInput = document.getElementById("venda-rev-qtd");
    if (!select || !qtdInput) return;

    const produtoId = select.value;
    const quantidade = parseInt(qtdInput.value) || 0;

    if (!produtoId) {
      this.toast("Por favor, selecione uma peça para registrar a venda.", "warning");
      return;
    }
    if (quantidade < 1) {
      this.toast("A quantidade deve ser pelo menos 1.", "warning");
      return;
    }

    // Capturar novos campos
    let desconto = 0;
    let motivoDesconto = "";
    const hasDiscount = document.getElementById("venda-rev-has-discount");
    const discountVal = document.getElementById("venda-rev-desconto");
    const discountReason = document.getElementById("venda-rev-desconto-motivo");
    if (hasDiscount && hasDiscount.checked) {
      desconto = parseFloat(discountVal ? discountVal.value : 0) || 0;
      motivoDesconto = (discountReason ? discountReason.value : "").trim();
    }
    const formaPagamentoSelect = document.getElementById("venda-rev-pagamento");
    const formaPagamento = formaPagamentoSelect ? formaPagamentoSelect.value : "Dinheiro";

    const btnConfirmar = document.getElementById("btn-confirmar-venda-rev");
    if (btnConfirmar) {
      btnConfirmar.disabled = true;
      btnConfirmar.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Registrando...';
    }

    const offlineMode = this.state.token && this.state.token.startsWith("mock_");

    try {
      let resp;
      if (offlineMode) {
        // Modo offline / demonstração
        const rev = this.state.revendedoras.find(r => r.id === this.state.usuarioLogado.id);
        if (!rev || !rev.consignado) throw new Error("Revendedora não encontrada localmente.");

        const idx = rev.consignado.findIndex(c => c.produtoId === produtoId);
        if (idx === -1) throw new Error("Este produto não está na sua maleta.");

        const item = rev.consignado[idx];
        if (item.quantidadeConsignada < quantidade) {
          throw new Error(`Quantidade insuficiente na maleta. Você tem apenas ${item.quantidadeConsignada} unidade(s).`);
        }

        const totalBruto = item.precoVenda * quantidade;
        const totalLiquido = totalBruto - desconto;
        const comissaoValor = totalLiquido * ((this.state.usuarioLogado.comissao || 30) / 100);
        const novaQtd = item.quantidadeConsignada - quantidade;

        if (novaQtd === 0) {
          rev.consignado.splice(idx, 1);
        } else {
          item.quantidadeConsignada = novaQtd;
        }

        const novaVenda = {
          id: "mock_venda_" + Date.now(),
          data: new Date().toISOString(),
          usuarioId: this.state.usuarioLogado.id,
          produtoId: produtoId,
          nomeProduto: item.nome,
          codigoProduto: item.codigo,
          quantidade: quantidade,
          precoVenda: item.precoVenda - (desconto / quantidade),
          comissaoValor: comissaoValor,
          desconto: desconto / quantidade,
          motivoDesconto: motivoDesconto,
          formaPagamento: formaPagamento
        };

        resp = {
          venda: novaVenda,
          resumo: {
            nomeProduto: item.nome,
            quantidade,
            totalVenda: totalLiquido,
            comissaoValor,
            qtdRestanteNaMaleta: novaQtd
          }
        };

        // Salva estado local no LocalStorage
        this.salvarDadosNoLocalStorage();

        // Adiciona à lista de vendas da sessão no LocalStorage
        const localVendasKey = `belklock_vendas_${this.state.usuarioLogado.id}`;
        const vendasLocais = JSON.parse(localStorage.getItem(localVendasKey) || "[]");
        vendasLocais.unshift(novaVenda);
        localStorage.setItem(localVendasKey, JSON.stringify(vendasLocais));

        // Adiciona notificação de demonstração
        const mockNotificacoes = JSON.parse(localStorage.getItem("belklock_notificacoes_mock") || "[]");
        mockNotificacoes.unshift({
          id: "notif_" + Date.now(),
          tipo: "venda_revendedora",
          mensagem: `Nova venda registrada por ${this.state.usuarioLogado.nome}: ${quantidade}x ${item.nome}`,
          detalhes: JSON.stringify({
            itens: [{
              produtoId: produtoId,
              codigo: item.codigo,
              nome: item.nome,
              quantidade: quantidade
            }]
          }),
          lida: false,
          createdAt: new Date().toISOString()
        });
        localStorage.setItem("belklock_notificacoes_mock", JSON.stringify(mockNotificacoes));
      } else {
        resp = await this.requisitarAPI("/vendas-revendedora", "POST", { produtoId, quantidade, desconto, motivoDesconto, formaPagamento });

        // Atualiza maleta local: reduz a quantidade consignada ou remove item
        const rev = this.state.revendedoras.find(r => r.id === this.state.usuarioLogado.id);
        if (rev && rev.consignado) {
          const idx = rev.consignado.findIndex(c => c.produtoId === produtoId);
          if (idx !== -1) {
            if (resp.resumo.qtdRestanteNaMaleta === 0) {
              rev.consignado.splice(idx, 1);
            } else {
              rev.consignado[idx].quantidadeConsignada = resp.resumo.qtdRestanteNaMaleta;
            }
          }
        }
      }

      // Adiciona à lista de vendas da sessão e às pendentes para a barra de comissão
      this.state.vendasSessao.unshift(resp.venda);
      if (!this.state.vendasPendentes) this.state.vendasPendentes = [];
      this.state.vendasPendentes.unshift(resp.venda);

      // Fecha modal e renderiza
      document.getElementById("modal-venda-rev").classList.remove("active");
      this.renderizarMinhaMaleta();

      // Feedback de sucesso
      const totalFmt = (resp.resumo.totalVenda || 0).toFixed(2).replace(".", ",");
      const comissaoFmt = (resp.resumo.comissaoValor || 0).toFixed(2).replace(".", ",");
      this.toast(`Venda registrada! 💎 ${resp.resumo.nomeProduto} (${resp.resumo.quantidade} pçs). Total: R$ ${totalFmt}. Comissão: R$ ${comissaoFmt}`, "success");
    } catch (error) {
      console.error(error);
      this.toast("Erro ao registrar a venda: " + error.message, "error");
    } finally {
      if (btnConfirmar) {
        btnConfirmar.disabled = false;
        btnConfirmar.innerHTML = '<i class="fa-solid fa-check"></i> Confirmar Venda';
      }
    }
  },

  // 3. Persistência de Dados (Métodos de fallback / legados mantidos para portabilidade)
  carregarDadosDoLocalStorage: function() {
    try {
      const produtosSalvos = localStorage.getItem("belklock_produtos");
      const revendedorasSalvas = localStorage.getItem("belklock_revendedoras");
      const feedSalvo = localStorage.getItem("belklock_feed");
      const ficticioSalvo = localStorage.getItem("belklock_usando_ficticio");
      const colunasSalvas = localStorage.getItem("belklock_colunas");
      const limiarSalvo = localStorage.getItem("belklock_limiar_critico");
      const nomeEmpresaSalvo = localStorage.getItem("belklock_nome_empresa");
      const logoUrlSalvo = localStorage.getItem("belklock_logo_url");
      const corPrimariaSalva = localStorage.getItem("belklock_cor_primaria");
      const corSecundariaSalva = localStorage.getItem("belklock_cor_secundaria");
      const bgPrimarySalvo = localStorage.getItem("belklock_bg_primary");
      const bgCardSalvo = localStorage.getItem("belklock_bg_card");
      const apiUrlSalva = localStorage.getItem("belklock_api_url");

      this.state.usandoFicticio = ficticioSalvo ? JSON.parse(ficticioSalvo) : true;
      this.state.colunasEstoque = colunasSalvas ? JSON.parse(colunasSalvas) : ["Código", "Nome do Produto", "Categoria", "Estoque Central", "Custo Bruto", "Custo Banho", "Custo Oper.", "Markup", "Preço Venda"];
      this.state.limiarEstoqueCritico = limiarSalvo ? parseInt(limiarSalvo) : 3;
      this.state.nomeEmpresa = nomeEmpresaSalvo ? nomeEmpresaSalvo : "BelKlock Semijoias";
      this.state.logoUrl = logoUrlSalvo || "";
      this.state.corPrimaria = corPrimariaSalva || "#d4af37";
      this.state.corSecundaria = corSecundariaSalva || "#111111";
      this.state.bgPrimary = bgPrimarySalvo || "#0a0a0a";
      this.state.bgCard = bgCardSalvo || "#121212";
      if (apiUrlSalva) {
        this.state.apiUrl = apiUrlSalva;
      }

      if (this.state.usandoFicticio && !produtosSalvos && !revendedorasSalvas) {
        this.state.produtos = this.obterProdutosMock();
        this.state.revendedoras = this.obterRevendedorasMock();
        
        // Alimenta _valoresDinamicos para os mocks
        this.state.produtos.forEach(p => {
          p._valoresDinamicos = {
            "Código": p.codigo,
            "Nome do Produto": p.nome,
            "Categoria": p.categoria,
            "Estoque Central": p.quantidade,
            "Custo Bruto": p.custoBruto,
            "Custo Banho": p.custoBanho,
            "Custo Oper.": p.custoLiquido,
            "Markup": p.markup,
            "Preço Venda": (p.custoBruto + p.custoBanho + p.custoLiquido) * p.markup
          };
        });
      } else {
        this.state.produtos = produtosSalvos ? JSON.parse(produtosSalvos) : [];
        this.state.revendedoras = revendedorasSalvas ? JSON.parse(revendedorasSalvas) : [];
      }
      
      this.state.feedImagens = feedSalvo ? JSON.parse(feedSalvo) : [];
    } catch (e) {
      console.error("Erro ao carregar dados do LocalStorage, inicializando vazios.", e);
      this.state.produtos = [];
      this.state.revendedoras = [];
      this.state.feedImagens = [];
      this.state.usandoFicticio = true;
    }
  },

  salvarDadosNoLocalStorage: function() {
    localStorage.setItem("belklock_produtos", JSON.stringify(this.state.produtos));
    localStorage.setItem("belklock_revendedoras", JSON.stringify(this.state.revendedoras));
    localStorage.setItem("belklock_feed", JSON.stringify(this.state.feedImagens));
    localStorage.setItem("belklock_usando_ficticio", JSON.stringify(this.state.usandoFicticio));
    localStorage.setItem("belklock_colunas", JSON.stringify(this.state.colunasEstoque));
    localStorage.setItem("belklock_limiar_critico", this.state.limiarEstoqueCritico || 3);
    localStorage.setItem("belklock_nome_empresa", this.state.nomeEmpresa || "BelKlock Semijoias");
    localStorage.setItem("belklock_logo_url", this.state.logoUrl || "");
    localStorage.setItem("belklock_cor_primaria", this.state.corPrimaria || "#d4af37");
    localStorage.setItem("belklock_cor_secundaria", this.state.corSecundaria || "#111111");
    localStorage.setItem("belklock_bg_primary", this.state.bgPrimary || "#0a0a0a");
    localStorage.setItem("belklock_bg_card", this.state.bgCard || "#121212");
    localStorage.setItem("belklock_api_url", this.state.apiUrl || "http://localhost:5000/api");
  },

  // 4. Cadastro de Mock de dados para demonstração sem placeholders vazios
  obterProdutosMock: function() {
    return [
      {
        id: "prod_1",
        codigo: "BR-010",
        nome: "Brinco Gota Fusion Cravejado",
        categoria: "Brincos",
        quantidade: 15,
        custoBruto: 12.50,
        custoBanho: 8.00,
        custoLiquido: 3.50,
        markup: 3.2
      },
      {
        id: "prod_2",
        codigo: "CO-055",
        nome: "Colar Riviera Ametista Luxo",
        categoria: "Colares",
        quantidade: 2, // Alerta de estoque baixo
        custoBruto: 28.00,
        custoBanho: 15.00,
        custoLiquido: 6.00,
        markup: 3.0
      },
      {
        id: "prod_3",
        codigo: "AN-004",
        nome: "Anel Solitário Ouro Cravejado",
        categoria: "Anéis",
        quantidade: 12,
        custoBruto: 9.00,
        custoBanho: 6.50,
        custoLiquido: 2.50,
        markup: 3.5
      },
      {
        id: "prod_4",
        codigo: "PU-080",
        nome: "Pulseira Elo Português 18k",
        categoria: "Pulseiras",
        quantidade: 8,
        custoBruto: 18.00,
        custoBanho: 11.00,
        custoLiquido: 4.50,
        markup: 3.0
      }
    ];
  },

  obterRevendedorasMock: function() {
    return [
      {
        id: "rev_1",
        nome: "Patrícia Medeiros",
        whatsapp: "(11) 98765-4321",
        comissao: 30,
        pin: "1234",
        consignado: [
          {
            produtoId: "prod_1",
            codigo: "BR-010",
            nome: "Brinco Gota Fusion Cravejado",
            quantidadeConsignada: 5,
            precoVenda: 76.80 // (12.5+8+3.5) * 3.2 = 24 * 3.2
          },
          {
            produtoId: "prod_3",
            codigo: "AN-004",
            nome: "Anel Solitário Ouro Cravejado",
            quantidadeConsignada: 3,
            precoVenda: 63.00 // (9+6.5+2.5) * 3.5 = 18 * 3.5
          }
        ]
      },
      {
        id: "rev_2",
        nome: "Juliana Frota",
        whatsapp: "(11) 99888-7777",
        comissao: 35,
        pin: "5678",
        consignado: []
      }
    ];
  },

  // Inicializa imagens padrões elegantes no feed do Instagram se estiver vazio
  inicializarFeedPadrao: function() {
    if (this.state.feedImagens.length === 0) {
      // Usaremos representações visuais CSS gradientes douradas requintadas para simular fotos de joias se não houver uploads
      this.state.feedImagens = [
        "linear-gradient(135deg, #1a1a1a 0%, #3a2c00 100%)", // Joias de fundo escuro
        "linear-gradient(135deg, #2c2c2c 0%, #aa7c11 100%)",
        "linear-gradient(135deg, #0d0d0d 0%, #d4af37 100%)",
        "linear-gradient(135deg, #222222 0%, #151515 100%)",
        "linear-gradient(135deg, #423004 0%, #d4af37 100%)",
        "linear-gradient(135deg, #111111 0%, #aa7c11 100%)",
        "linear-gradient(135deg, #1e1e1e 0%, #3e3200 100%)",
        "linear-gradient(135deg, #1c1c1c 0%, #2c2c2c 100%)",
        "linear-gradient(135deg, #000000 0%, #f3e5ab 100%)"
      ];
      this.salvarDadosNoLocalStorage();
    }
  },

  // 5. Registro e escuta de eventos na UI
  registrarEventosUI: function() {
    // Helper function para adicionar event listener apenas se o elemento existir
    const addListenerSafe = (id, event, callback) => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener(event, callback);
      }
    };

    // Botão de Logout na Sidebar
    addListenerSafe("btn-logout", "click", () => this.fazerLogout());

    // Cliques na navegação da Sidebar
    document.querySelectorAll(".nav-item").forEach(item => {
      item.addEventListener("click", () => {
        const target = item.getAttribute("data-target");
        this.navegarParaAba(target);
      });
    });

    // Filtros de busca no estoque
    addListenerSafe("filtro-busca", "input", () => this.renderizarEstoque());
    addListenerSafe("filtro-categoria", "change", () => this.renderizarEstoque());
    addListenerSafe("filtro-status", "change", () => this.renderizarEstoque());

    // Botões rápidos do Dashboard
    addListenerSafe("btn-quick-sale", "click", () => this.abrirModalVendaRapida());
    addListenerSafe("btn-view-all-stock", "click", () => this.navegarParaAba("estoque"));

    // Eventos de Input da Calculadora no Modal de Produto
    const inputsPrecificacao = ["prod-bruto", "prod-banho", "prod-liquido", "prod-markup"];
    inputsPrecificacao.forEach(id => {
      addListenerSafe(id, "input", () => this.calcularPrecificacaoDinamicamente());
    });

    // Modais e seus gatilhos
    this.configurarModal("modal-produto", "btn-open-modal-produto", "btn-close-modal-produto", "btn-cancelar-produto");
    this.configurarModal("modal-revendedora", "btn-open-modal-revendedora", "btn-close-modal-revendedora", "btn-cancelar-revendedora");
    this.configurarModal("modal-consignar", "btn-open-modal-consignar", "btn-close-modal-consignar", "btn-cancelar-consignar");
    this.configurarModal("modal-acerto", "btn-open-modal-acerto", "btn-close-modal-acerto", "btn-cancelar-acerto");
    this.configurarModal("modal-venda-rapida", null, "btn-close-modal-venda-rapida", "btn-cancelar-venda-rapida");

    // Modal de Venda da Revendedora
    addListenerSafe("btn-open-modal-venda-rev", "click", () => this._abrirModalVendaRevInterno());
    addListenerSafe("btn-close-modal-venda-rev", "click", () => {
      const modal = document.getElementById("modal-venda-rev");
      if (modal) modal.classList.remove("active");
    });
    addListenerSafe("btn-cancelar-venda-rev", "click", () => {
      const modal = document.getElementById("modal-venda-rev");
      if (modal) modal.classList.remove("active");
    });
    addListenerSafe("btn-confirmar-venda-rev", "click", () => this.confirmarVendaRevendedora());

    // Salvar Produto
    addListenerSafe("btn-salvar-produto", "click", () => this.salvarNovoProduto());

    // Salvar Revendedora
    addListenerSafe("btn-salvar-revendedora", "click", () => this.salvarNovaRevendedora());

    // Consignar Peças (Confirmar envio)
    addListenerSafe("btn-confirmar-consignar", "click", () => this.processarConsignacao());

    // Excluir Revendedora
    addListenerSafe("btn-excluir-revendedora", "click", () => this.excluirRevendedoraSelecionada());

    // Editar Revendedora
    addListenerSafe("btn-editar-revendedora", "click", () => this.editarRevendedoraSelecionada());

    // Fechamento de acertos
    addListenerSafe("btn-salvar-acerto-apenas", "click", () => this.finalizarAcerto(false));
    addListenerSafe("btn-finalizar-acerto-whats", "click", () => this.finalizarAcerto(true));
    addListenerSafe("btn-finalizar-acerto-excel", "click", () => this.exportarExcelAcerto());

    // Excel
    addListenerSafe("btn-exportar-estoque", "click", () => ExcelHandler.exportarEstoque(this.state.produtos, this.state.colunasEstoque));
    addListenerSafe("btn-trigger-import-file", "click", () => {
      const input = document.getElementById("input-import-excel");
      if (input) input.click();
    });
    addListenerSafe("input-import-excel", "change", (e) => this.processarImportacaoExcel(e));
    addListenerSafe("btn-limpar-ficticios", "click", () => this.zerarDadosDemonstracao());
    addListenerSafe("btn-excluir-todos-produtos", "click", () => this.excluirTodosOsProdutos());

    // Upload do Instagram Feed
    addListenerSafe("zone-upload-feed", "click", () => {
      const input = document.getElementById("input-upload-feed");
      if (input) input.click();
    });
    addListenerSafe("input-upload-feed", "change", (e) => this.processarUploadFeed(e));
    addListenerSafe("btn-clear-feed", "click", () => this.reiniciarFeedPadrao());

    // WhatsApp Mask
    addListenerSafe("rev-whatsapp", "input", (e) => this.aplicarMascaraWhatsApp(e.target));
    addListenerSafe("vr-whatsapp", "input", (e) => this.aplicarMascaraWhatsApp(e.target));

    // Backup Geral JSON Export/Import
    addListenerSafe("btn-backup-exportar", "click", () => this.exportarBackupGeralJSON());
    addListenerSafe("btn-backup-importar", "click", () => {
      const input = document.getElementById("input-backup-json");
      if (input) input.click();
    });
    addListenerSafe("input-backup-json", "change", (e) => this.importarBackupGeralJSON(e));

    // WhatsApp Venda Rápida (Confirmar)
    addListenerSafe("btn-enviar-venda-rapida", "click", () => this.processarVendaRapidaWhats());

    // Modal de Clientes
    this.configurarModal("modal-cliente", "btn-open-modal-cliente", "btn-close-modal-cliente", "btn-cancelar-cliente");
    addListenerSafe("btn-salvar-cliente", "click", () => this.salvarCliente());
    addListenerSafe("cliente-whatsapp", "input", (e) => this.aplicarMascaraWhatsApp(e.target));

    // WhatsApp Mask no Venda Rápida (novo campo)
    addListenerSafe("vr-cliente-whatsapp", "input", (e) => this.aplicarMascaraWhatsApp(e.target));
    
    // Selector de cliente na Venda Rápida: mostra/oculta box de novo cliente
    const vrSelect = document.getElementById("vr-cliente-select");
    if (vrSelect) {
      vrSelect.addEventListener("change", () => {
        const novoBox = document.getElementById("vr-novo-cliente-box");
        if (novoBox) novoBox.style.display = vrSelect.value ? "none" : "block";
      });
    }

    // Configuração Drag and Drop da planilha
    const dropzone = document.getElementById("dropzone-excel");
    if (dropzone) {
      dropzone.addEventListener("dragover", (e) => { e.preventDefault(); dropzone.style.borderColor = "var(--gold-primary)"; });
      dropzone.addEventListener("dragleave", () => { dropzone.style.borderColor = "rgba(212, 175, 55, 0.3)"; });
      dropzone.addEventListener("drop", (e) => {
        e.preventDefault();
        dropzone.style.borderColor = "rgba(212, 175, 55, 0.3)";
        if (e.dataTransfer.files.length > 0) {
          const file = e.dataTransfer.files[0];
          if (file.name.endsWith(".csv")) {
            ExcelHandler.importarEstoque(file, (produtos) => this.mesclarEstoqueImportado(produtos));
          } else {
            this.toast("Por favor, envie apenas planilhas no formato .csv", "warning");
          }
        }
      });
    }
  },

  configurarModal: function(modalId, triggerId, closeBtnId, cancelBtnId) {
    const modal = document.getElementById(modalId);
    const trigger = triggerId ? document.getElementById(triggerId) : null;
    const closeBtn = document.getElementById(closeBtnId);
    const cancelBtn = document.getElementById(cancelBtnId);

    const abrir = () => {
      modal.classList.add("active");
      if (modalId === "modal-produto") {
        this.limparFormProduto();
        this.calcularPrecificacaoDinamicamente();
      }
      if (modalId === "modal-revendedora") {
        this.limparFormRevendedora();
      }
      if (modalId === "modal-consignar") {
        const buscaInput = document.getElementById("consignar-busca");
        const filtroCat = document.getElementById("consignar-filtro-categoria");
        if (buscaInput) buscaInput.value = "";
        if (filtroCat) filtroCat.value = "";
        const totPecas = document.getElementById("consignar-total-pecas");
        const valTotal = document.getElementById("consignar-valor-total");
        if (totPecas) totPecas.innerText = "0 pçs";
        if (valTotal) valTotal.innerText = "R$ 0,00";
        this.renderizarTabelaSelecaoConsignado();
      }
      if (modalId === "modal-acerto") {
        const buscaInput = document.getElementById("acerto-busca");
        if (buscaInput) buscaInput.value = "";
        this.renderizarTabelaPreencherAcerto();
      }
    };

    const fechar = () => {
      modal.classList.remove("active");
    };

    if (trigger) trigger.addEventListener("click", abrir);
    if (closeBtn) closeBtn.addEventListener("click", fechar);
    if (cancelBtn) cancelBtn.addEventListener("click", fechar);
  },

  // Navegação SPA
  navegarParaAba: function(tabId) {
    this.state.abaAtiva = tabId;
    this.renderizarAbas();
    
    // Recarrega dados visuais
    if (tabId === "dashboard") this.renderizarDashboard();
    if (tabId === "estoque") {
      if (this.state.subAbaEstoqueAtiva === "geral") {
        this.renderizarEstoque();
      } else {
        this.carregarProdutosComDefeito().then(() => this.renderizarDefeitos());
      }
    }
    if (tabId === "revendedoras") this.renderizarRevendedoras();
    if (tabId === "marketing") this.renderizarMarketing();
    if (tabId === "clientes") {
      if (this.state.subAbaClientesAtiva === "aniversariantes") {
        this.renderizarAniversariantes();
      } else {
        this.renderizarClientes();
      }
    }
    if (tabId === "vendas-geral") {
      this.carregarVendasConsolidadas().then(() => this.renderizarVendasConsolidadas());
    }
    if (tabId === "configuracoes") {
      this.renderizarConfiguracoes();
    }
    if (tabId === "estoque-central") {
      this.carregarEstoqueCentral();
    }
    if (tabId === "links-pagamento") {
      this.carregarLinksPagamento();
    }
    if (tabId === "treinamento-demand") {
      this.carregarTreinamentosVendedora();
    }
  },

  renderizarAbas: function() {
    document.querySelectorAll(".nav-item").forEach(item => {
      if (item.getAttribute("data-target") === this.state.abaAtiva) {
        item.classList.add("active");
      } else {
        item.classList.remove("active");
      }
    });

    document.querySelectorAll(".app-section").forEach(sec => {
      if (sec.getAttribute("id") === this.state.abaAtiva) {
        sec.classList.add("active");
      } else {
        sec.classList.remove("active");
      }
    });
  },

  // 6. ABA: DASHBOARD LÓGICA
  renderizarDashboard: function() {
    // 1. Contagens
    let estoqueCentralTotal = 0;
    let capitalPecasCentral = 0;
    let estoqueConsignadoTotal = 0;
    let capitalPecasConsignado = 0;
    let retornoVendaProjetada = 0;

    // Estoque Central
    this.state.produtos.forEach(p => {
      const custoTotal = Number(p.custoBruto || 0) + Number(p.custoBanho || 0) + Number(p.custoLiquido || 0);
      estoqueCentralTotal += Number(p.quantidade || 0);
      capitalPecasCentral += custoTotal * Number(p.quantidade || 0);
      retornoVendaProjetada += (custoTotal * Number(p.markup || 1)) * Number(p.quantidade || 0);
    });

    // Consignado
    this.state.revendedoras.forEach(rev => {
      if (rev.consignado && rev.consignado.length > 0) {
        rev.consignado.forEach(item => {
          estoqueConsignadoTotal += Number(item.quantidadeConsignada || 0);
          
          // Encontra o produto de origem para ver o custo original
          const prodOrigem = this.state.produtos.find(p => p.id === item.produtoId);
          if (prodOrigem) {
            const custoTotal = Number(prodOrigem.custoBruto || 0) + Number(prodOrigem.custoBanho || 0) + Number(prodOrigem.custoLiquido || 0);
            capitalPecasConsignado += custoTotal * Number(item.quantidadeConsignada || 0);
          } else {
            // Fallback baseado no preço de venda e um markup médio de 3.0 se não achar o produto original
            capitalPecasConsignado += (Number(item.precoVenda || 0) / 3.0) * Number(item.quantidadeConsignada || 0);
          }

          // Faturamento bruto projetado das revendedoras
          retornoVendaProjetada += Number(item.precoVenda || 0) * Number(item.quantidadeConsignada || 0);
        });
      }
    });

    // Renderiza nos cards
    document.getElementById("val-estoque-central").innerText = `${estoqueCentralTotal} pçs`;
    document.getElementById("val-capital-pecas").innerText = `R$ ${capitalPecasCentral.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
    document.getElementById("val-capital-consignado").innerText = `R$ ${capitalPecasConsignado.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
    document.getElementById("val-retorno-estimado").innerText = `R$ ${retornoVendaProjetada.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;

    // 2. Alertas de estoque crítico (Qtd <= limiarEstoqueCritico)
    const tableAlertasBody = document.querySelector("#table-alertas tbody");
    tableAlertasBody.innerHTML = "";
    
    const produtosCriticos = this.state.produtos.filter(p => Number(p.quantidade || 0) <= (this.state.limiarEstoqueCritico || 3));

    if (produtosCriticos.length === 0) {
      tableAlertasBody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; color: var(--text-secondary); padding: 2rem;">
            <i class="fa-solid fa-square-check" style="color: #81c784; font-size: 1.5rem; margin-bottom: 0.5rem; display: block;"></i>
            Estoque Central 100% abastecido e seguro!
          </td>
        </tr>
      `;
    } else {
      produtosCriticos.forEach(p => {
        const custoTotal = Number(p.custoBruto || 0) + Number(p.custoBanho || 0) + Number(p.custoLiquido || 0);
        const precoVenda = custoTotal * Number(p.markup || 1);
        const statusText = p.quantidade === 0 ? "Esgotado" : "Crítico";
        const badgeClass = p.quantidade === 0 ? "badge-low" : "badge-low";

        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td><strong>${p.codigo || ""}</strong></td>
          <td>${p.nome || ""}</td>
          <td>${p.categoria || ""}</td>
          <td><strong style="color: var(--danger);">${p.quantidade}</strong> unid.</td>
          <td>R$ ${precoVenda.toFixed(2).replace(".", ",")}</td>
          <td><span class="badge ${badgeClass}">${statusText}</span></td>
        `;
        tableAlertasBody.appendChild(tr);
      });
    }

    // 3. Tabela Resumo Revendedoras Actives
    const tableResumoRevBody = document.querySelector("#table-resumo-revendedoras tbody");
    tableResumoRevBody.innerHTML = "";

    if (this.state.revendedoras.length === 0) {
      tableResumoRevBody.innerHTML = `
        <tr>
          <td colspan="3" style="text-align: center; color: var(--text-secondary); padding: 2rem;">Nenhuma revendedora cadastrada.</td>
        </tr>
      `;
    } else {
      this.state.revendedoras.forEach(rev => {
        let qtdConsignada = 0;
        let valorConsignado = 0;

        if (rev.consignado) {
          rev.consignado.forEach(item => {
            qtdConsignada += Number(item.quantidadeConsignada || 0);
            valorConsignado += Number(item.precoVenda || 0) * Number(item.quantidadeConsignada || 0);
          });
        }

        const tr = document.createElement("tr");
        tr.style.cursor = "pointer";
        tr.addEventListener("click", () => {
          this.state.revendedoraSelecionadaId = rev.id;
          this.navegarParaAba("revendedoras");
        });

        tr.innerHTML = `
          <td><strong>${rev.nome}</strong></td>
          <td>${qtdConsignada} pçs</td>
          <td style="color: var(--gold-primary); font-weight: 600;">R$ ${valorConsignado.toFixed(2).replace(".", ",")}</td>
        `;
        tableResumoRevBody.appendChild(tr);
      });
    }

    this.renderizarGraficosDashboard();

    // Inicializa datas do DRE se não estiverem preenchidas
    const inputInicio = document.getElementById("dre-data-inicio");
    const inputFim = document.getElementById("dre-data-fim");
    if (inputInicio && !inputInicio.value) {
      const hoje = new Date();
      const primeiroDiaMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
      inputInicio.value = primeiroDiaMes.toISOString().split('T')[0];
    }
    if (inputFim && !inputFim.value) {
      const hoje = new Date();
      inputFim.value = hoje.toISOString().split('T')[0];
    }

    this.carregarDRE();
  },

  carregarDRE: async function() {
    const inputInicio = document.getElementById("dre-data-inicio");
    const inputFim = document.getElementById("dre-data-fim");
    if (!inputInicio || !inputFim) return;

    const inicio = inputInicio.value;
    const fim = inputFim.value;

    if (this.state.token) {
      try {
        const dados = await this.requisitarAPI(`/relatorios/dre?inicio=${inicio}&fim=${fim}`);
        this.renderizarDadosDRE(dados.resumo);
      } catch (err) {
        console.error("Erro ao carregar DRE do servidor:", err);
        this.toast("Erro ao carregar DRE do servidor. Usando dados locais.", "error");
        this.gerarDRELocal(inicio, fim);
      }
    } else {
      this.gerarDRELocal(inicio, fim);
    }
  },

  gerarDRELocal: function(inicio, fim) {
    const dataInicio = inicio ? new Date(inicio) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const dataFim = fim ? new Date(fim) : new Date();
    dataFim.setHours(23, 59, 59, 999);

    const diasDiferenca = Math.max(1, Math.round((dataFim - dataInicio) / (1000 * 60 * 60 * 24)));
    
    const numProdutos = this.state.produtos.length || 10;
    const numRev = this.state.revendedoras.length || 3;

    const faturamentoVendasDiretas = numProdutos * 15 * (diasDiferenca / 30); 
    const custoVendasDiretas = faturamentoVendasDiretas / 3.0;
    
    const faturamentoAcertos = numRev * 250 * (diasDiferenca / 30);
    const comissoesPagas = faturamentoAcertos * 0.3;
    const descontoPerdas = numRev * 15 * (diasDiferenca / 30);
    const custoVendasConsignado = faturamentoAcertos * 0.28;

    const faturamentoBrutoTotal = faturamentoVendasDiretas + faturamentoAcertos;
    const custoTotalMercadorias = custoVendasDiretas + custoVendasConsignado;
    const lucroLiquidoEstimado = faturamentoBrutoTotal - comissoesPagas - custoTotalMercadorias + descontoPerdas;

    this.renderizarDadosDRE({
      faturamentoVendasDiretas,
      faturamentoAcertos,
      faturamentoBrutoTotal,
      comissoesPagas,
      descontoPerdas,
      custoVendasDiretas,
      custoVendasConsignado,
      custoTotalMercadorias,
      lucroLiquidoEstimado
    });
  },

  renderizarDadosDRE: function(resumo) {
    const formatar = (val) => `R$ ${val.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;

    const fatBrutoEl = document.getElementById("dre-fat-bruto");
    const fatDiretasEl = document.getElementById("dre-fat-diretas");
    const fatConsignadoEl = document.getElementById("dre-fat-consignado");
    const comissoesEl = document.getElementById("dre-comissoes");
    const perdasEl = document.getElementById("dre-perdas-ajuste");
    const recLiquidaEl = document.getElementById("dre-receita-liquida");
    const cmvEl = document.getElementById("dre-cmv");
    const custoDiretasEl = document.getElementById("dre-custo-diretas");
    const custoConsignadoEl = document.getElementById("dre-custo-consignado");
    
    if (fatBrutoEl) fatBrutoEl.innerText = formatar(resumo.faturamentoBrutoTotal);
    if (fatDiretasEl) fatDiretasEl.innerText = formatar(resumo.faturamentoVendasDiretas);
    if (fatConsignadoEl) fatConsignadoEl.innerText = formatar(resumo.faturamentoAcertos);
    
    if (comissoesEl) comissoesEl.innerText = `(-) ${formatar(resumo.comissoesPagas)}`;
    if (perdasEl) perdasEl.innerText = `(+) ${formatar(resumo.descontoPerdas)}`;
    
    const receitaLiquida = resumo.faturamentoBrutoTotal - resumo.comissoesPagas + resumo.descontoPerdas;
    if (recLiquidaEl) recLiquidaEl.innerText = formatar(receitaLiquida);
    
    if (cmvEl) cmvEl.innerText = `(-) ${formatar(resumo.custoTotalMercadorias)}`;
    if (custoDiretasEl) custoDiretasEl.innerText = formatar(resumo.custoVendasDiretas);
    if (custoConsignadoEl) custoConsignadoEl.innerText = formatar(resumo.custoVendasConsignado);
    
    const lucro = resumo.lucroLiquidoEstimado;
    const lucroEl = document.getElementById("dre-lucro-liquido");
    const resultadoValorEl = document.getElementById("dre-resultado-valor");
    const resultadoStatusEl = document.getElementById("dre-resultado-status");
    const lucroRow = document.getElementById("dre-lucro-row");

    if (lucroEl) lucroEl.innerText = formatar(lucro);
    if (resultadoValorEl) resultadoValorEl.innerText = formatar(lucro);

    const margem = resumo.faturamentoBrutoTotal > 0 ? (lucro / resumo.faturamentoBrutoTotal) * 100 : 0;
    const margemEl = document.getElementById("dre-margem-lucro");
    if (margemEl) margemEl.innerText = `${margem.toFixed(1)}%`;

    const markupMedio = resumo.custoTotalMercadorias > 0 ? (resumo.faturamentoBrutoTotal / resumo.custoTotalMercadorias) : 3.0;
    const markupEl = document.getElementById("dre-markup-medio");
    if (markupEl) markupEl.innerText = `${markupMedio.toFixed(1)}x`;

    if (lucro >= 0) {
      if (lucroEl) lucroEl.style.color = "#66bb6a";
      if (resultadoValorEl) resultadoValorEl.style.color = "#66bb6a";
      if (lucroRow) lucroRow.style.backgroundColor = "rgba(102, 187, 106, 0.05)";
      if (resultadoStatusEl) {
        resultadoStatusEl.innerText = "Parabéns! Sua empresa está operando no azul no período selecionado.";
        resultadoStatusEl.style.color = "#81c784";
      }
    } else {
      if (lucroEl) lucroEl.style.color = "#ef5350";
      if (resultadoValorEl) resultadoValorEl.style.color = "#ef5350";
      if (lucroRow) lucroRow.style.backgroundColor = "rgba(239, 83, 80, 0.05)";
      if (resultadoStatusEl) {
        resultadoStatusEl.innerText = "Atenção: Sua empresa operou com saldo negativo no período selecionado. Avalie seus custos.";
        resultadoStatusEl.style.color = "#e57373";
      }
    }
  },

  imprimirAcerto: function() {
    const revendedoraNome = document.getElementById("acerto-nome-revendedora")?.innerText || "Revendedora";
    
    const itens = [];
    document.querySelectorAll("#table-preencher-acerto tbody tr").forEach(tr => {
      const codigo = tr.cells[0]?.innerText;
      const nome = tr.cells[1]?.querySelector(".prod-name-cell")?.innerText || tr.cells[1]?.innerText;
      if (!codigo || !nome) return;

      const prodId = tr.querySelector(".input-acerto-venda")?.getAttribute("data-prod-id");
      const inpVenda = tr.querySelector(".input-acerto-venda");
      const inpDev = tr.querySelector(".input-acerto-devolucao");
      const inpPerd = tr.querySelector(".input-acerto-perda");
      const inpDef = tr.querySelector(".input-acerto-defeito");

      const qtdVenda = parseInt(inpVenda?.value) || 0;
      const qtdDev = parseInt(inpDev?.value) || 0;
      const qtdPerd = parseInt(inpPerd?.value) || 0;
      const qtdDef = parseInt(inpDef?.value) || 0;

      const precoUnit = parseFloat(tr.cells[2]?.innerText.replace("R$", "").replace(".", "").replace(",", ".").trim()) || 0;

      if (qtdVenda > 0 || qtdDev > 0 || qtdPerd > 0 || qtdDef > 0) {
        itens.push({
          codigo,
          nome,
          qtdVenda,
          qtdDev,
          qtdPerd,
          qtdDef,
          precoUnit,
          total: qtdVenda * precoUnit
        });
      }
    });

    const totalLevadas = document.getElementById("acerto-total-peças-levadas")?.innerText || "0 pçs";
    const totalFatBruto = document.getElementById("acerto-total-faturamento-bruto")?.innerText || "R$ 0,00";
    const comissaoPercent = document.getElementById("acerto-comissao-percent")?.innerText || "30";
    const comissaoValor = document.getElementById("acerto-comissao-valor")?.innerText || "R$ 0,00";
    const descontoPerdas = document.getElementById("acerto-desconto-perdas")?.innerText || "R$ 0,00";
    const totalReceber = document.getElementById("acerto-total-liquido-receber")?.innerText || "R$ 0,00";

    const dataAtual = new Date().toLocaleDateString('pt-BR');
    
    let itensHtml = "";
    itens.forEach(item => {
      itensHtml += `
        <tr>
          <td style="padding: 6px 4px; border-bottom: 1px solid #ddd;"><strong>${item.codigo}</strong></td>
          <td style="padding: 6px 4px; border-bottom: 1px solid #ddd;">${item.nome}</td>
          <td style="padding: 6px 4px; border-bottom: 1px solid #ddd;">R$ ${item.precoUnit.toFixed(2).replace(".", ",")}</td>
          <td style="padding: 6px 4px; border-bottom: 1px solid #ddd; text-align: center;">${item.qtdVenda}</td>
          <td style="padding: 6px 4px; border-bottom: 1px solid #ddd; text-align: center;">${item.qtdDev}</td>
          <td style="padding: 6px 4px; border-bottom: 1px solid #ddd; text-align: center;">${item.qtdPerd}</td>
          <td style="padding: 6px 4px; border-bottom: 1px solid #ddd; text-align: center;">${item.qtdDef}</td>
          <td style="padding: 6px 4px; border-bottom: 1px solid #ddd; text-align: right; font-weight: bold;">R$ ${item.total.toFixed(2).replace(".", ",")}</td>
        </tr>
      `;
    });

    const printContainer = document.createElement("div");
    printContainer.id = "print-receipt-container";
    printContainer.style.background = "white";
    printContainer.style.color = "black";
    printContainer.style.padding = "20px";
    printContainer.innerHTML = `
      <div style="text-align: center; margin-bottom: 2rem; border-bottom: 2px solid #000; padding-bottom: 1rem;">
        <h1 style="font-size: 1.8rem; margin: 0; font-family: sans-serif; color: #000; font-weight: bold;">BELKLOCK SEMIJOIAS</h1>
        <p style="margin: 0.3rem 0; font-size: 0.9rem;">Recibo de Acerto de Conta Consignada</p>
        <p style="margin: 0; font-size: 0.85rem; color: #666;">Data do Fechamento: ${dataAtual}</p>
      </div>

      <div style="margin-bottom: 1.5rem; font-size: 0.95rem; line-height: 1.5; color: black;">
        <p style="margin: 0.3rem 0;"><strong>Revendedora:</strong> ${revendedoraNome}</p>
      </div>

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 2rem; font-size: 0.85rem; color: black;">
        <thead>
          <tr style="border-bottom: 1px solid #000; text-align: left; font-weight: bold;">
            <th style="padding: 8px 4px;">Código</th>
            <th style="padding: 8px 4px;">Produto</th>
            <th style="padding: 8px 4px;">Preço Unit.</th>
            <th style="padding: 8px 4px; text-align: center;">Venda</th>
            <th style="padding: 8px 4px; text-align: center;">Devol.</th>
            <th style="padding: 8px 4px; text-align: center;">Perda</th>
            <th style="padding: 8px 4px; text-align: center;">Defeito</th>
            <th style="padding: 8px 4px; text-align: right;">Total Venda</th>
          </tr>
        </thead>
        <tbody>
          ${itensHtml || '<tr><td colspan="8" style="text-align: center; padding: 1rem;">Nenhum produto movimentado.</td></tr>'}
        </tbody>
      </table>

      <div style="display: flex; justify-content: flex-end; margin-bottom: 3rem; color: black;">
        <table style="width: 300px; font-size: 0.9rem; line-height: 1.6; border-collapse: collapse;">
          <tr>
            <td style="padding: 4px 0;">Peças Levadas:</td>
            <td style="text-align: right; padding: 4px 0;"><strong>${totalLevadas}</strong></td>
          </tr>
          <tr>
            <td style="padding: 4px 0;">Faturamento Bruto:</td>
            <td style="text-align: right; padding: 4px 0;"><strong>${totalFatBruto}</strong></td>
          </tr>
          <tr>
            <td style="padding: 4px 0;">Comissão (${comissaoPercent}%):</td>
            <td style="text-align: right; color: #555; padding: 4px 0;">- ${comissaoValor}</td>
          </tr>
          <tr style="color: #c62828;">
            <td style="padding: 4px 0;">Desconto Perdas:</td>
            <td style="text-align: right; padding: 4px 0;">- ${descontoPerdas}</td>
          </tr>
          <tr style="border-top: 1px solid #000; font-size: 1.05rem; font-weight: bold;">
            <td style="padding-top: 0.5rem;">Líquido a Pagar:</td>
            <td style="padding-top: 0.5rem; text-align: right;">${totalReceber}</td>
          </tr>
        </table>
      </div>

      <div style="display: flex; justify-content: space-between; margin-top: 5rem; font-size: 0.85rem; text-align: center; color: black;">
        <div style="width: 45%; border-top: 1px solid #000; padding-top: 0.5rem;">
          BelKlock Semijoias
        </div>
        <div style="width: 45%; border-top: 1px solid #000; padding-top: 0.5rem;">
          Assinatura Revendedora: ${revendedoraNome}
        </div>
      </div>
    `;

    document.body.appendChild(printContainer);

    document.body.classList.add("printing-receipt-mode");

    window.print();

    setTimeout(() => {
      document.body.classList.remove("printing-receipt-mode");
      printContainer.remove();
    }, 500);
  },

  // 7. ABA: ESTOQUE E PRECIFICAÇÃO LÓGICA
  renderizarEstoque: function() {
    const thead = document.querySelector("#table-estoque-completo thead");
    const tbody = document.querySelector("#table-estoque-completo tbody");

    // 1. Gera cabeçalho dinamicamente baseado em state.colunasEstoque
    thead.innerHTML = "";
    const trHead = document.createElement("tr");
    
    this.state.colunasEstoque.forEach(col => {
      const th = document.createElement("th");
      th.style.cursor = "pointer";
      
      const ordEstoque = this.state.ordenacao && this.state.ordenacao.estoque;
      if (ordEstoque && ordEstoque.coluna === col) {
        th.innerHTML = `${col} <i class="fa-solid ${ordEstoque.direcao === 'asc' ? 'fa-sort-up' : 'fa-sort-down'}" style="margin-left: 5px; color: var(--gold-primary);"></i>`;
      } else {
        th.innerHTML = `${col} <i class="fa-solid fa-sort" style="margin-left: 5px; opacity: 0.3;"></i>`;
      }
      
      th.addEventListener("click", () => this.ordenarTabela("estoque", col));
      trHead.appendChild(th);
    });
    
    const thAcoes = document.createElement("th");
    thAcoes.innerText = "Ações";
    trHead.appendChild(thAcoes);
    thead.appendChild(trHead);

    // 2. Filtros de busca no estoque
    const filtroBuscaVal = document.getElementById("filtro-busca").value.toLowerCase();
    const filtroCategoriaVal = document.getElementById("filtro-categoria").value;
    const filtroStatusVal = document.getElementById("filtro-status").value;

    let produtosFiltrados = this.state.produtos.filter(p => {
      const matchBusca = (p.nome || "").toLowerCase().includes(filtroBuscaVal) || (p.codigo || "").toLowerCase().includes(filtroBuscaVal);
      const matchCategoria = filtroCategoriaVal === "" || p.categoria === filtroCategoriaVal;
      
      let matchStatus = true;
      if (filtroStatusVal === "baixo") {
        matchStatus = Number(p.quantidade || 0) <= (this.state.limiarEstoqueCritico || 3);
      } else if (filtroStatusVal === "disponivel") {
        matchStatus = Number(p.quantidade || 0) > (this.state.limiarEstoqueCritico || 3);
      }

      return matchBusca && matchCategoria && matchStatus;
    });

    // Ordena produtosFiltrados se houver coluna de ordenação ativa
    const ordEstoque = this.state.ordenacao && this.state.ordenacao.estoque;
    if (ordEstoque && ordEstoque.coluna) {
      const col = ordEstoque.coluna;
      const dir = ordEstoque.direcao === 'asc' ? 1 : -1;
      
      produtosFiltrados.sort((a, b) => {
        let valA = a._valoresDinamicos && a._valoresDinamicos[col] !== undefined ? a._valoresDinamicos[col] : "";
        let valB = b._valoresDinamicos && b._valoresDinamicos[col] !== undefined ? b._valoresDinamicos[col] : "";
        
        // Se for uma coluna numérica/monetária, limpar e comparar como número
        const colLower = col.toLowerCase();
        if (colLower.includes("custo") || colLower.includes("preço") || colLower.includes("preco") || colLower.includes("venda") || colLower.includes("valor") || colLower.includes("qtd") || colLower.includes("quantidade") || colLower.includes("estoque") || colLower.includes("markup")) {
          const numA = ExcelHandler.limparNumeroExcel(valA);
          const numB = ExcelHandler.limparNumeroExcel(valB);
          if (!isNaN(numA) && !isNaN(numB)) {
            return (numA - numB) * dir;
          }
        }
        
        // Comparação default de strings
        valA = String(valA);
        valB = String(valB);
        return valA.localeCompare(valB, 'pt-BR', { sensitivity: 'base' }) * dir;
      });
    }

    tbody.innerHTML = "";

    if (produtosFiltrados.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="${this.state.colunasEstoque.length + 1}" style="text-align: center; color: var(--text-secondary); padding: 3rem;">
            Nenhum produto encontrado nos filtros selecionados.
          </td>
        </tr>
      `;
      return;
    }

    // 3. Renderiza linhas dinamicamente baseadas em state.colunasEstoque
    produtosFiltrados.forEach(p => {
      const tr = document.createElement("tr");

      this.state.colunasEstoque.forEach(col => {
        const td = document.createElement("td");
        
        // Puxa o valor da célula dinâmica original
        let valor = p._valoresDinamicos && p._valoresDinamicos[col] !== undefined ? p._valoresDinamicos[col] : "";
        
        // Verifica se é uma coluna monetária para estilizar
        const colLower = col.toLowerCase();
        if (colLower.includes("custo") || colLower.includes("preço") || colLower.includes("preco") || colLower.includes("venda") || colLower.includes("valor")) {
          let num = ExcelHandler.limparNumeroExcel(valor);
          if (num > 0) {
            td.innerHTML = `<span style="color: ${colLower.includes("venda") ? 'var(--gold-primary); font-weight: 700;' : 'var(--text-primary)'}">R$ ${num.toFixed(2).replace(".", ",")}</span>`;
          } else {
            td.innerText = valor || "R$ 0,00";
          }
        } else if (colLower.includes("qtd") || colLower.includes("quantidade") || colLower.includes("estoque") || colLower.includes("saldo") || colLower.includes("unidades")) {
          // Insere os botões de ajuste de quantidade reativos do estoque central
          td.innerHTML = `
            <div class="qtd-edit">
              <button class="btn-qty" onclick="app.alterarQtdEstoque('${p.id}', -1)"><i class="fa-solid fa-minus"></i></button>
              <span class="qty-val ${p.quantidade <= (this.state.limiarEstoqueCritico || 3) ? 'text-danger' : ''}" style="${p.quantidade <= (this.state.limiarEstoqueCritico || 3) ? 'color: var(--danger); font-weight: 700;' : ''}">${p.quantidade}</span>
              <button class="btn-qty" onclick="app.alterarQtdEstoque('${p.id}', 1)"><i class="fa-solid fa-plus"></i></button>
            </div>
          `;
        } else if (colLower.includes("código") || colLower.includes("codigo") || colLower.includes("ref") || colLower.includes("id")) {
          td.innerHTML = `<strong>${valor || p.codigo}</strong>`;
        } else {
          td.innerText = valor || p[col] || "";
        }
        
        tr.appendChild(td);
      });

      // Célula de Ações
      const tdAcoes = document.createElement("td");
      tdAcoes.innerHTML = `
        <div style="display: flex; gap: 0.4rem;">
          <button class="btn-qty" onclick="app.editarProduto('${p.id}')" title="Editar"><i class="fa-solid fa-pen"></i></button>
          <button class="btn-qty" style="color: #ef9a9a; border-color: rgba(198, 40, 40, 0.1);" onclick="app.excluirProduto('${p.id}')" title="Excluir"><i class="fa-solid fa-trash"></i></button>
        </div>
      `;
      tr.appendChild(tdAcoes);
      tbody.appendChild(tr);
    });
  },

  mudarSubAbaEstoque: function(subAbaId) {
    this.state.subAbaEstoqueAtiva = subAbaId;
    
    const btnGeral = document.getElementById("btn-subtab-estoque-geral");
    const btnDefeitos = document.getElementById("btn-subtab-estoque-defeitos");
    
    if (subAbaId === "geral") {
      if (btnGeral) btnGeral.classList.add("active");
      if (btnDefeitos) btnDefeitos.classList.remove("active");
      
      const contentGeral = document.getElementById("subtab-estoque-geral-content");
      const contentDefeitos = document.getElementById("subtab-estoque-defeitos-content");
      if (contentGeral) contentGeral.style.display = "block";
      if (contentDefeitos) contentDefeitos.style.display = "none";
      
      this.renderizarEstoque();
    } else {
      if (btnGeral) btnGeral.classList.remove("active");
      if (btnDefeitos) btnDefeitos.classList.add("active");
      
      const contentGeral = document.getElementById("subtab-estoque-geral-content");
      const contentDefeitos = document.getElementById("subtab-estoque-defeitos-content");
      if (contentGeral) contentGeral.style.display = "none";
      if (contentDefeitos) contentDefeitos.style.display = "block";
      
      this.carregarProdutosComDefeito().then(() => this.renderizarDefeitos());
    }
  },

  carregarProdutosComDefeito: async function() {
    if (this.state.token) {
      try {
        const defeitos = await this.requisitarAPI("/produtos/defeitos");
        this.state.produtosComDefeito = defeitos;
      } catch (err) {
        console.error("Erro ao carregar produtos com defeito:", err);
        this.toast("Erro ao carregar produtos com defeito da API", "error");
        this.state.produtosComDefeito = this.state.produtos.filter(p => (p.quantidadeDefeito || 0) > 0);
      }
    } else {
      this.state.produtosComDefeito = this.state.produtos.filter(p => (p.quantidadeDefeito || 0) > 0);
    }
  },

  renderizarDefeitos: function() {
    const tbody = document.querySelector("#table-estoque-defeitos tbody");
    if (!tbody) return;

    let defeitosFiltrados = [...this.state.produtosComDefeito];

    const ordDefeitos = this.state.ordenacao && this.state.ordenacao.defeitos;
    if (ordDefeitos && ordDefeitos.coluna) {
      const col = ordDefeitos.coluna;
      const dir = ordDefeitos.direcao === 'asc' ? 1 : -1;

      defeitosFiltrados.sort((a, b) => {
        let valA = a[col] !== undefined ? a[col] : "";
        let valB = b[col] !== undefined ? b[col] : "";

        if (col === "quantidade" || col === "quantidadeDefeito") {
          const numA = Number(valA) || 0;
          const numB = Number(valB) || 0;
          return (numA - numB) * dir;
        }

        valA = String(valA).toLowerCase();
        valB = String(valB).toLowerCase();
        return valA.localeCompare(valB, 'pt-BR', { sensitivity: 'base' }) * dir;
      });
    }

    tbody.innerHTML = "";

    if (defeitosFiltrados.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; color: var(--text-secondary); padding: 3rem;">
            Nenhuma peça com defeito registrada.
          </td>
        </tr>
      `;
      return;
    }

    defeitosFiltrados.forEach(p => {
      const tr = document.createElement("tr");

      tr.innerHTML = `
        <td><strong>${p.codigo}</strong></td>
        <td>${p.nome}</td>
        <td>${p.categoria}</td>
        <td>${p.quantidade}</td>
        <td style="color: var(--danger); font-weight: 700;">${p.quantidadeDefeito}</td>
        <td>
          <button class="btn-qty" style="color: var(--danger); border-color: rgba(244, 67, 54, 0.1);" 
                  onclick="app.darBaixaPecaDefeituosa('${p.id}')" title="Dar Baixa Definitiva (Registro Contábil)">
            <i class="fa-solid fa-trash-can"></i> Baixar
          </button>
        </td>
      `;

      tbody.appendChild(tr);
    });
  },

  darBaixaPecaDefeituosa: async function(prodId) {
    const confirmou = await this.confirmar("Deseja realmente dar baixa definitiva nesta peça com defeito? Isso removerá a peça do registro de defeitos de forma permanente.");
    if (!confirmou) return;

    const prod = this.state.produtos.find(p => p.id === prodId);
    if (!prod) return;

    const antigaQtdDefeito = prod.quantidadeDefeito || 0;
    prod.quantidadeDefeito = 0;

    // Atualiza _valoresDinamicos localmente
    if (prod._valoresDinamicos) {
      prod._valoresDinamicos["Qtd. com Defeito"] = 0;
    }

    if (this.state.token) {
      try {
        await this.requisitarAPI(`/produtos/${prodId}`, "PUT", {
          codigo: prod.codigo,
          nome: prod.nome,
          categoria: prod.categoria,
          quantidade: prod.quantidade,
          custoBruto: prod.custoBruto,
          custoBanho: prod.custoBanho,
          custoLiquido: prod.custoLiquido,
          markup: prod.markup,
          fotoUrl: prod.fotoUrl,
          quantidadeDefeito: 0
        });
        this.toast("Peça com defeito baixada com sucesso!", "success");
      } catch (err) {
        console.error("Erro ao baixar peça com defeito na API:", err);
        prod.quantidadeDefeito = antigaQtdDefeito;
        if (prod._valoresDinamicos) {
          prod._valoresDinamicos["Qtd. com Defeito"] = antigaQtdDefeito;
        }
        this.toast("Erro ao baixar peça com defeito no servidor.", "error");
        return;
      }
    } else {
      this.toast("Peça com defeito baixada com sucesso (modo local)!", "success");
    }

    this.salvarDadosNoLocalStorage();
    this.carregarProdutosComDefeito().then(() => this.renderizarDefeitos());
  },

  alterarQtdEstoque: async function(prodId, delta) {
    const prod = this.state.produtos.find(p => p.id === prodId);
    if (prod) {
      const novaQtd = Number(prod.quantidade || 0) + delta;
      if (novaQtd >= 0) {
        prod.quantidade = novaQtd;
        // Atualiza _valoresDinamicos localmente
        if (prod._valoresDinamicos) {
          prod._valoresDinamicos["Estoque Central"] = novaQtd;
        }
        // Persiste no servidor se autenticado
        if (this.state.token) {
          try {
            await this.requisitarAPI(`/produtos/${prodId}`, "PUT", {
              codigo: prod.codigo,
              nome: prod.nome,
              categoria: prod.categoria,
              quantidade: novaQtd,
              custoBruto: prod.custoBruto,
              custoBanho: prod.custoBanho,
              custoLiquido: prod.custoLiquido,
              markup: prod.markup,
              fotoUrl: prod.fotoUrl
            });
          } catch (err) {
            console.warn("Falha ao persistir quantidade na API:", err.message);
          }
        }
        this.salvarDadosNoLocalStorage();
        this.renderizarEstoque();
        this.renderizarDashboard();
      }
    }
  },

  // Precificação em tempo real no Modal
  calcularPrecificacaoDinamicamente: function() {
    const custoBruto = Number(document.getElementById("prod-bruto").value || 0);
    const custoBanho = Number(document.getElementById("prod-banho").value || 0);
    const custoLiquido = Number(document.getElementById("prod-liquido").value || 0);
    const markup = Number(document.getElementById("prod-markup").value || 1);

    const custoTotal = custoBruto + custoBanho + custoLiquido;
    const precoVenda = custoTotal * markup;
    const lucroLiquido = precoVenda - custoTotal;

    // Atualiza o Preview do Modal
    document.getElementById("calc-bruto").innerText = `R$ ${custoBruto.toFixed(2).replace(".", ",")}`;
    document.getElementById("calc-banho").innerText = `R$ ${custoBanho.toFixed(2).replace(".", ",")}`;
    document.getElementById("calc-liquido").innerText = `R$ ${custoLiquido.toFixed(2).replace(".", ",")}`;
    document.getElementById("calc-custo-total").innerText = `R$ ${custoTotal.toFixed(2).replace(".", ",")}`;
    document.getElementById("calc-markup").innerText = `${markup.toFixed(1)}x`;
    document.getElementById("calc-preco-venda").innerText = `R$ ${precoVenda.toFixed(2).replace(".", ",")}`;
    document.getElementById("calc-lucro-liquido").innerText = `R$ ${lucroLiquido.toFixed(2).replace(".", ",")}`;
  },

  limparFormProduto: function() {
    document.getElementById("prod-nome").value = "";
    document.getElementById("prod-codigo").value = "";
    document.getElementById("prod-categoria").value = "Brincos";
    document.getElementById("prod-quantidade").value = "5";
    document.getElementById("prod-bruto").value = "0.00";
    document.getElementById("prod-banho").value = "0.00";
    document.getElementById("prod-liquido").value = "0.00";
    document.getElementById("prod-markup").value = "3.0";
    document.getElementById("prod-foto-url").value = "";
    document.getElementById("prod-defeito").value = "0";
    this.atualizarPreviewFotoProduto();
    
    // Reseta id de edição
    document.getElementById("btn-salvar-produto").removeAttribute("data-edit-id");
    document.querySelector("#modal-produto h3").innerText = "Nova Semijoia";
  },

  salvarNovoProduto: async function() {
    const nome = document.getElementById("prod-nome").value.trim();
    const categoria = document.getElementById("prod-categoria").value;
    const quantidade = parseInt(document.getElementById("prod-quantidade").value) || 0;
    
    if (!nome) {
      this.toast("Por favor, preencha o nome do produto.", "warning");
      return;
    }

    const codigoInput = document.getElementById("prod-codigo").value.trim();
    const codigo = codigoInput ? codigoInput : "REF-" + Math.floor(1000 + Math.random() * 9000);
    
    const custoBruto = parseFloat(document.getElementById("prod-bruto").value) || 0;
    const custoBanho = parseFloat(document.getElementById("prod-banho").value) || 0;
    const custoLiquido = parseFloat(document.getElementById("prod-liquido").value) || 0;
    const markup = parseFloat(document.getElementById("prod-markup").value) || 1.0;
    const fotoUrl = document.getElementById("prod-foto-url").value.trim() || null;
    const quantidadeDefeito = parseInt(document.getElementById("prod-defeito").value) || 0;

    const editId = document.getElementById("btn-salvar-produto").getAttribute("data-edit-id");

    try {
      let produtoSalvo;

      const bodyData = {
        codigo,
        nome,
        categoria,
        quantidade,
        custoBruto,
        custoBanho,
        custoLiquido,
        markup,
        fotoUrl,
        quantidadeDefeito
      };

      if (editId) {
        // Envia para a API se logado
        if (this.state.token) {
          produtoSalvo = await this.requisitarAPI(`/produtos/${editId}`, "PUT", bodyData);
        } else {
          produtoSalvo = { id: editId, ...bodyData };
        }

        // Edição local
        const prod = this.state.produtos.find(p => p.id === editId);
        if (prod) {
          Object.assign(prod, produtoSalvo);
        }
      } else {
        // Novo Produto
        if (this.state.token) {
          produtoSalvo = await this.requisitarAPI("/produtos", "POST", bodyData);
        } else {
          produtoSalvo = {
            id: 'prod_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            ...bodyData
          };
        }
        this.state.produtos.push(produtoSalvo);
      }

      // Atualiza valores dinâmicos locais
      this.state.produtos.forEach(p => {
        const custoTotal = (p.custoBruto || 0) + (p.custoBanho || 0) + (p.custoLiquido || 0);
        const precoVendaCalculado = custoTotal * (p.markup || 3.0);
        p._valoresDinamicos = {
          "Código": p.codigo,
          "Nome do Produto": p.nome,
          "Categoria": p.categoria,
          "Estoque Central": p.quantidade,
          "Custo Bruto": p.custoBruto,
          "Custo Banho": p.custoBanho,
          "Custo Oper.": p.custoLiquido,
          "Markup": p.markup,
          "Preço Venda": p.precoVenda || precoVendaCalculado
        };
      });

      this.salvarDadosNoLocalStorage();
      this.renderizarEstoque();
      this.renderizarDashboard();
      
      document.getElementById("modal-produto").classList.remove("active");
      
      // Navega para aba de estoque para o usuário ver o produto que acabou de cadastrar/editar
      this.navegarParaAba("estoque");
      
      this.toast(editId ? "Produto atualizado com sucesso!" : "Produto cadastrado com sucesso!", "success");
    } catch (error) {
      console.error(error);
      this.toast("Erro ao salvar produto no banco de dados: " + error.message, "error");
    }
  },

  editarProduto: function(prodId) {
    const prod = this.state.produtos.find(p => p.id === prodId);
    if (prod) {
      document.getElementById("prod-nome").value = prod.nome;
      document.getElementById("prod-codigo").value = prod.codigo || "";
      document.getElementById("prod-categoria").value = prod.categoria || "Brincos";
      document.getElementById("prod-quantidade").value = prod.quantidade || 0;
      document.getElementById("prod-bruto").value = (prod.custoBruto || 0).toFixed(2);
      document.getElementById("prod-banho").value = (prod.custoBanho || 0).toFixed(2);
      document.getElementById("prod-liquido").value = (prod.custoLiquido || 0).toFixed(2);
      document.getElementById("prod-markup").value = (prod.markup || 3.0).toFixed(1);
      document.getElementById("prod-foto-url").value = prod.fotoUrl || "";
      document.getElementById("prod-defeito").value = prod.quantidadeDefeito || 0;
      this.atualizarPreviewFotoProduto();

      document.getElementById("btn-salvar-produto").setAttribute("data-edit-id", prodId);
      document.querySelector("#modal-produto h3").innerText = "Editar Semijoia";
      
      this.calcularPrecificacaoDinamicamente();
      document.getElementById("modal-produto").classList.add("active");
    }
  },

  excluirProduto: async function(prodId) {
    if (await this.confirmar("Tem certeza que deseja excluir esta semijoia do seu estoque?")) {
      try {
        if (this.state.token) {
          await this.requisitarAPI(`/produtos/${prodId}`, "DELETE");
        }

        this.state.produtos = this.state.produtos.filter(p => p.id !== prodId);
        this.salvarDadosNoLocalStorage();
        this.renderizarEstoque();
        this.renderizarDashboard();
        this.toast("Produto removido com sucesso!", "success");
      } catch (error) {
        console.error(error);
        this.toast("Erro ao excluir produto na Azure: " + error.message, "error");
      }
    }
  },

  // 8. ABA: GESTÃO DE REVENDEDORAS LÓGICA
  renderizarRevendedoras: function() {
    const listaContainer = document.getElementById("lista-revendedoras-container");
    listaContainer.innerHTML = "";

    if (this.state.revendedoras.length === 0) {
      listaContainer.innerHTML = `<p style="color: var(--text-secondary); text-align: center; padding: 2rem;">Nenhuma revendedora cadastrada.</p>`;
      document.getElementById("painel-detalhes-revendedora").style.display = "none";
      document.getElementById("placeholder-detalhes-revendedora").style.display = "flex";
      return;
    }

    this.state.revendedoras.forEach(rev => {
      let qtdConsignada = 0;
      let valorConsignado = 0;

      if (rev.consignado) {
        rev.consignado.forEach(item => {
          qtdConsignada += Number(item.quantidadeConsignada || 0);
          valorConsignado += Number(item.precoVenda || 0) * Number(item.quantidadeConsignada || 0);
        });
      }

      const itemDiv = document.createElement("div");
      itemDiv.className = `list-item ${this.state.revendedoraSelecionadaId === rev.id ? 'selected' : ''}`;
      itemDiv.addEventListener("click", () => {
        this.state.revendedoraSelecionadaId = rev.id;
        this.renderizarRevendedoras();
      });

      itemDiv.innerHTML = `
        <div class="list-item-info">
          <h4>${rev.nome}</h4>
          <p><i class="fa-brands fa-whatsapp"></i> ${rev.whatsapp}</p>
        </div>
        <div class="list-item-value">
          <span>R$ ${valorConsignado.toFixed(2).replace(".", ",")}</span>
          <small>${qtdConsignada} peças</small>
        </div>
      `;
      listaContainer.appendChild(itemDiv);
    });

    // Se houver uma selecionada, mostra os detalhes
    const revSelecionada = this.state.revendedoras.find(r => r.id === this.state.revendedoraSelecionadaId);
    
    if (revSelecionada) {
      document.getElementById("placeholder-detalhes-revendedora").style.display = "none";
      document.getElementById("painel-detalhes-revendedora").style.display = "block";

      document.getElementById("detalhe-nome-revendedora").innerText = revSelecionada.nome;
      document.getElementById("detalhe-whatsapp-revendedora").innerText = revSelecionada.whatsapp;
      document.getElementById("detalhe-comissao-revendedora").innerText = `${revSelecionada.comissao}%`;
      document.getElementById("detalhe-pin-revendedora").innerText = revSelecionada.pin || "N/A";

      // Atualiza indicadores internos
      let qtdConsignada = 0;
      let valorConsignado = 0;

      revSelecionada.consignado.forEach(item => {
        qtdConsignada += Number(item.quantidadeConsignada || 0);
        valorConsignado += Number(item.precoVenda || 0) * Number(item.quantidadeConsignada || 0);
      });

      const comissaoRev = valorConsignado * (Number(revSelecionada.comissao || 30) / 100);
      const liquidoBelklock = valorConsignado - comissaoRev;

      document.getElementById("detalhe-qtd-consignada").innerText = `${qtdConsignada} pçs`;
      document.getElementById("detalhe-valor-consignado").innerText = `R$ ${valorConsignado.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
      document.getElementById("detalhe-liquido-projetado").innerText = `R$ ${liquidoBelklock.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;

      // Preenche a tabela de peças na maleta
      const tableItensBody = document.querySelector("#table-itens-consignados tbody");
      tableItensBody.innerHTML = "";

      if (revSelecionada.consignado.length === 0) {
        tableItensBody.innerHTML = `
          <tr>
            <td colspan="5" style="text-align: center; color: var(--text-secondary); padding: 2rem;">
              Esta revendedora ainda não levou peças em consignação.
            </td>
          </tr>
        `;
      } else {
        revSelecionada.consignado.forEach(item => {
          const subtotal = Number(item.precoVenda || 0) * Number(item.quantidadeConsignada || 0);
          const tr = document.createElement("tr");
          tr.innerHTML = `
            <td><strong>${item.codigo}</strong></td>
            <td>${item.nome}</td>
            <td>${item.quantidadeConsignada} unidades</td>
            <td>R$ ${Number(item.precoVenda).toFixed(2).replace(".", ",")}</td>
            <td style="color: var(--gold-primary); font-weight: 600;">R$ ${subtotal.toFixed(2).replace(".", ",")}</td>
          `;
          tableItensBody.appendChild(tr);
        });
      }

      // Preenche a tabela do histórico
      const tableHistoricoBody = document.querySelector("#table-historico-acertos tbody");
      tableHistoricoBody.innerHTML = "";
      if(!revSelecionada.historico || revSelecionada.historico.length === 0) {
        tableHistoricoBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-secondary);">Nenhum acerto registrado para esta revendedora.</td></tr>`;
      } else {
        revSelecionada.historico.slice().reverse().forEach(hist => {
          const dataObj = new Date(hist.data);
          const dataStr = `${dataObj.getDate().toString().padStart(2, '0')}/${(dataObj.getMonth()+1).toString().padStart(2, '0')}/${dataObj.getFullYear()}`;
          const tr = document.createElement("tr");
          tr.innerHTML = `
            <td>${dataStr}</td>
            <td>${hist.totalConsignada} / ${hist.totalVendida} / ${hist.totalDevolvida}</td>
            <td style="color: var(--gold-primary);">R$ ${hist.faturamentoBruto.toFixed(2).replace(".", ",")}</td>
            <td>R$ ${hist.comissaoPaga.toFixed(2).replace(".", ",")}</td>
            <td style="color: #81c784; font-weight: 600;">R$ ${hist.liquidoBelklock.toFixed(2).replace(".", ",")}</td>
            <td><span class="badge badge-low" style="background: rgba(129, 199, 132, 0.1); color: #81c784;">Concluído</span></td>
          `;
          tableHistoricoBody.appendChild(tr);
        });
      }
    } else {
      document.getElementById("painel-detalhes-revendedora").style.display = "none";
      document.getElementById("placeholder-detalhes-revendedora").style.display = "flex";
    }
  },

  regenerarPINRevendedora: async function() {
    const revId = this.state.revendedoraSelecionadaId;
    if (!revId) return;

    const confirmou = await this.confirmar("Deseja realmente regenerar o PIN de acesso e a senha desta revendedora? O acesso dela anterior será invalidado imediatamente.");
    if (!confirmou) return;

    if (this.state.token) {
      try {
        const resp = await this.requisitarAPI(`/revendedoras/${revId}/reset-pin`, "PUT");
        
        const rev = this.state.revendedoras.find(r => r.id === revId);
        if (rev) {
          rev.pin = resp.pin;
        }

        alert(`NOVO PIN E SENHA GERADOS COM SUCESSO!\n\nPIN: ${resp.pin}\nSenha: ${resp.senha}\n\nCopie e anote estes dados com segurança antes de fechar este aviso.`);
        
        this.salvarDadosNoLocalStorage();
        this.renderizarRevendedoras();
      } catch (err) {
        console.error("Erro ao regenerar PIN na API:", err);
        this.toast("Erro ao tentar regenerar PIN e senha no servidor.", "error");
      }
    } else {
      const novoPin = String(Math.floor(1000 + Math.random() * 9000));
      const novaSenha = Math.random().toString(36).substring(2, 10);
      
      const rev = this.state.revendedoras.find(r => r.id === revId);
      if (rev) {
        rev.pin = novoPin;
      }
      
      alert(`[MODO LOCAL] NOVO PIN E SENHA GERADOS!\n\nPIN: ${novoPin}\nSenha: ${novaSenha}\n\n(Apenas local, não persistido no servidor).`);
      this.salvarDadosNoLocalStorage();
      this.renderizarRevendedoras();
    }
  },

  limparFormRevendedora: function() {
    document.getElementById("rev-nome").value = "";
    document.getElementById("rev-whatsapp").value = "";
    document.getElementById("rev-comissao").value = "30";
    document.getElementById("rev-senha").value = "";
    document.getElementById("group-rev-senha").style.display = "block";

    const btnSalvar = document.getElementById("btn-salvar-revendedora");
    if (btnSalvar) {
      btnSalvar.removeAttribute("data-edit-id");
      btnSalvar.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Cadastrar';
    }
    const modalTitle = document.querySelector("#modal-revendedora h3");
    if (modalTitle) modalTitle.innerText = "Nova Revendedora";
  },

  editarRevendedoraSelecionada: function() {
    const rev = this.state.revendedoras.find(r => r.id === this.state.revendedoraSelecionadaId);
    if (rev) {
      document.getElementById("rev-nome").value = rev.nome;
      document.getElementById("rev-whatsapp").value = rev.whatsapp;
      document.getElementById("rev-comissao").value = rev.comissao;
      document.getElementById("group-rev-senha").style.display = "none";

      const btnSalvar = document.getElementById("btn-salvar-revendedora");
      if (btnSalvar) {
        btnSalvar.setAttribute("data-edit-id", rev.id);
        btnSalvar.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Salvar Alterações';
      }
      const modalTitle = document.querySelector("#modal-revendedora h3");
      if (modalTitle) modalTitle.innerText = "Editar Revendedora";
      
      document.getElementById("modal-revendedora").classList.add("active");
    }
  },

  salvarNovaRevendedora: async function() {
    const nome = document.getElementById("rev-nome").value.trim();
    const whatsapp = document.getElementById("rev-whatsapp").value.trim();
    const comissao = parseInt(document.getElementById("rev-comissao").value) || 30;
    const editId = document.getElementById("btn-salvar-revendedora").getAttribute("data-edit-id");

    if (!nome || !whatsapp) {
      this.toast("Por favor, preencha o nome e o WhatsApp da revendedora.", "warning");
      return;
    }

    const senhaInput = document.getElementById("rev-senha").value.trim();
    if (!editId && !senhaInput) {
      this.toast("Por favor, defina uma senha de acesso para a revendedora.", "warning");
      return;
    }

    try {
      if (editId) {
        // Envia atualização para a API Azure se autenticado
        if (this.state.token) {
          await this.requisitarAPI(`/revendedoras/${editId}`, "PUT", { nome, whatsapp, comissao });
        }
        
        // Atualização no estado local
        const rev = this.state.revendedoras.find(r => r.id === editId);
        if (rev) {
          rev.nome = nome;
          rev.whatsapp = whatsapp;
          rev.comissao = comissao;
        }
      } else {
        let novaRev;
        const emailTemporario = nome.toLowerCase().replace(/\s+/g, '') + "_" + Math.floor(Math.random() * 1000) + "@belklock.com";

        // Cria na API Azure se autenticado
        if (this.state.token) {
          const res = await this.requisitarAPI("/auth/register", "POST", {
            nome,
            email: emailTemporario,
            senha: senhaInput,
            role: "revendedora",
            whatsapp,
            comissao
          });
          novaRev = {
            id: res.usuario.id,
            nome,
            whatsapp,
            comissao,
            pin: res.usuario.pin,
            consignado: [],
            historico: []
          };
        } else {
          // Fallback sem servidor
          novaRev = {
            id: 'rev_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            nome: nome,
            whatsapp: whatsapp,
            comissao: comissao,
            pin: Math.floor(1000 + Math.random() * 9000).toString(),
            consignado: [],
            historico: []
          };
        }
        this.state.revendedoras.push(novaRev);
        this.state.revendedoraSelecionadaId = novaRev.id;
      }

      this.salvarDadosNoLocalStorage();
      this.renderizarRevendedoras();
      this.renderizarDashboard();
      
      document.getElementById("modal-revendedora").classList.remove("active");
      
      if (editId) {
        this.toast("Cadastro de revendedora atualizado com sucesso!", "success");
      } else {
        const pinCriado = this.state.revendedoras.find(r => r.id === this.state.revendedoraSelecionadaId).pin;
        alert(`Revendedora cadastrada com sucesso!\n\n🔑 PIN de Acesso: ${pinCriado}\n🔒 Senha: ${senhaInput}\n\nInforme esses dados para a revendedora acessar o aplicativo.`);
      }
    } catch (error) {
      console.error(error);
      this.toast("Erro ao salvar dados da revendedora no banco de dados Azure: " + error.message, "error");
    }
  },

  excluirRevendedoraSelecionada: async function() {
    const rev = this.state.revendedoras.find(r => r.id === this.state.revendedoraSelecionadaId);
    if (rev) {
      if (await this.confirmar(`Deseja realmente excluir a revendedora ${rev.nome}? As peças atualmente com ela retornarão automaticamente ao Estoque Central.`)) {
        // Devolve peças consignadas ao estoque central antes de deletar
        rev.consignado.forEach(item => {
          const prod = this.state.produtos.find(p => p.id === item.produtoId);
          if (prod) {
            prod.quantidade = Number(prod.quantidade || 0) + Number(item.quantidadeConsignada || 0);
            // Atualiza _valoresDinamicos para refletir na tabela de estoque imediatamente
            if (prod._valoresDinamicos) {
              prod._valoresDinamicos["Estoque Central"] = prod.quantidade;
            }
          }
        });

        this.state.revendedoras = this.state.revendedoras.filter(r => r.id !== rev.id);
        this.state.revendedoraSelecionadaId = this.state.revendedoras.length > 0 ? this.state.revendedoras[0].id : null;
        
        this.salvarDadosNoLocalStorage();
        this.renderizarRevendedoras();
        this.renderizarEstoque();
        this.renderizarDashboard();
      }
    }
  },

  // 9. LÓGICA DE CONSIGNAÇÃO DE PRODUTOS (MODAL)
  renderizarTabelaSelecaoConsignado: function() {
    const rev = this.state.revendedoras.find(r => r.id === this.state.revendedoraSelecionadaId);
    if (!rev) return;

    document.getElementById("consignar-nome-revendedora").innerText = rev.nome;

    const tbody = document.querySelector("#table-selecionar-consignar tbody");
    tbody.innerHTML = "";

    // Filtra produtos que tenham estoque central > 0
    const produtosDisponiveis = this.state.produtos.filter(p => Number(p.quantidade || 0) > 0);

    if (produtosDisponiveis.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; color: var(--text-secondary); padding: 2rem;">
            Seu estoque central está zerado! Cadastre ou aumente o estoque das peças antes de consignar.
          </td>
        </tr>
      `;
      return;
    }

    produtosDisponiveis.forEach(p => {
      const custoTotal = Number(p.custoBruto || 0) + Number(p.custoBanho || 0) + Number(p.custoLiquido || 0);
      const precoVenda = custoTotal * Number(p.markup || 1);

      const tr = document.createElement("tr");
      tr.setAttribute("data-categoria", p.categoria);
      tr.innerHTML = `
        <td><strong>${p.codigo || ""}</strong></td>
        <td>${p.nome}</td>
        <td style="color: var(--gold-primary); font-weight: 600;">R$ ${precoVenda.toFixed(2).replace(".", ",")}</td>
        <td>${p.quantidade} pçs</td>
        <td>
          <div class="acerto-input-wrapper">
            <button class="btn-input-adjust" onclick="app.ajustarQtdInputConsignar(this, -1, ${p.quantidade})"><i class="fa-solid fa-minus"></i></button>
            <input type="number" class="input-consign-qty" data-prod-id="${p.id}" value="0" min="0" max="${p.quantidade}" oninput="app.validarESincronizarConsignar(this, ${p.quantidade})">
            <button class="btn-input-adjust" onclick="app.ajustarQtdInputConsignar(this, 1, ${p.quantidade})"><i class="fa-solid fa-plus"></i></button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
  },

  filtrarTabelaConsignar: function() {
    const busca = document.getElementById("consignar-busca").value.toLowerCase();
    const categoria = document.getElementById("consignar-filtro-categoria").value;
    const linhas = document.querySelectorAll("#table-selecionar-consignar tbody tr");
    
    linhas.forEach(tr => {
      const tdCodigo = tr.querySelector("td:nth-child(1)");
      const tdNome = tr.querySelector("td:nth-child(2)");
      if (!tdCodigo || !tdNome) return;
      
      const codigo = tdCodigo.textContent.toLowerCase();
      const nome = tdNome.textContent.toLowerCase();
      const cat = tr.getAttribute("data-categoria") || "";
      
      const matchBusca = codigo.includes(busca) || nome.includes(busca);
      const matchCategoria = !categoria || cat === categoria;
      
      if (matchBusca && matchCategoria) {
        tr.style.display = "";
      } else {
        tr.style.display = "none";
      }
    });
  },

  ajustarQtdInputConsignar: function(btn, delta, max) {
    const input = btn.parentElement.querySelector("input");
    if (input) {
      let val = parseInt(input.value) || 0;
      val = Math.min(Math.max(val + delta, 0), max);
      input.value = val;
      this.atualizarResumoConsignacao();
    }
  },

  validarESincronizarConsignar: function(input, max) {
    let val = parseInt(input.value) || 0;
    val = Math.min(Math.max(val, 0), max);
    input.value = val;
    this.atualizarResumoConsignacao();
  },

  atualizarResumoConsignacao: function() {
    let totalPecas = 0;
    let valorTotal = 0;
    
    document.querySelectorAll(".input-consign-qty").forEach(input => {
      const qtd = parseInt(input.value) || 0;
      if (qtd > 0) {
        totalPecas += qtd;
        const prodId = input.getAttribute("data-prod-id");
        const prod = this.state.produtos.find(p => p.id === prodId);
        if (prod) {
          const custoTotal = Number(prod.custoBruto || 0) + Number(prod.custoBanho || 0) + Number(prod.custoLiquido || 0);
          const precoVenda = custoTotal * Number(prod.markup || 1);
          valorTotal += precoVenda * qtd;
        }
      }
    });
    
    document.getElementById("consignar-total-pecas").innerText = `${totalPecas} pçs`;
    document.getElementById("consignar-valor-total").innerText = `R$ ${valorTotal.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
  },

  processarConsignacao: async function() {
    const rev = this.state.revendedoras.find(r => r.id === this.state.revendedoraSelecionadaId);
    if (!rev) return;

    let algumaPecaAdicionada = false;
    let hasError = false;

    // Primeiro passo de validação: checar estoque crítico
    document.querySelectorAll(".input-consign-qty").forEach(input => {
      const qtdConsignar = parseInt(input.value) || 0;
      const prodId = input.getAttribute("data-prod-id");

      if (qtdConsignar > 0) {
        const prod = this.state.produtos.find(p => p.id === prodId);
        if (prod && Number(prod.quantidade || 0) < qtdConsignar) {
          input.style.borderColor = "var(--danger)";
          input.style.color = "var(--danger)";
          hasError = true;
        } else {
          input.style.borderColor = "";
          input.style.color = "";
        }
      }
    });

    if(hasError) {
      this.toast("Estoque insuficiente para uma ou mais peças selecionadas. Verifique os campos em vermelho.", "error");
      return;
    }

    // Segundo passo: aplicar mudanças
    try {
      const inputs = document.querySelectorAll(".input-consign-qty");
      for (const input of inputs) {
        const qtdConsignar = parseInt(input.value) || 0;
        const prodId = input.getAttribute("data-prod-id");

        if (qtdConsignar > 0) {
          const prod = this.state.produtos.find(p => p.id === prodId);
          if (prod && Number(prod.quantidade || 0) >= qtdConsignar) {
            algumaPecaAdicionada = true;
            
            // Sincroniza com o banco Azure SQL
            if (this.state.token) {
              await this.requisitarAPI("/consignacoes", "POST", {
                usuarioId: rev.id,
                produtoId: prodId,
                quantidade: qtdConsignar
              });
            }

            // Deduz do estoque central localmente
            prod.quantidade -= qtdConsignar;
            // Atualiza _valoresDinamicos para refletir na tabela de estoque imediatamente
            if (prod._valoresDinamicos) {
              prod._valoresDinamicos["Estoque Central"] = prod.quantidade;
            }

            // Calcula preço de venda
            const custoTotal = Number(prod.custoBruto || 0) + Number(prod.custoBanho || 0) + Number(prod.custoLiquido || 0);
            const precoVenda = custoTotal * Number(prod.markup || 1);

            // Verifica se a revendedora já tem esse produto consignado na maleta
            const itemConsignado = rev.consignado.find(c => c.produtoId === prodId);
            if (itemConsignado) {
              itemConsignado.quantidadeConsignada += qtdConsignar;
            } else {
              rev.consignado.push({
                produtoId: prodId,
                codigo: prod.codigo,
                nome: prod.nome,
                quantidadeConsignada: qtdConsignar,
                precoVenda: precoVenda
              });
            }
          }
        }
      }

      if (algumaPecaAdicionada) {
        this.salvarDadosNoLocalStorage();
        this.renderizarRevendedoras();
        this.renderizarEstoque();
        this.renderizarDashboard();
        
        document.getElementById("modal-consignar").classList.remove("active");
        this.toast("Peças enviadas para a maleta da revendedora com sucesso!", "success");
      } else {
        this.toast("Por favor, digite uma quantidade válida maior que zero para consignar.", "warning");
      }
    } catch (error) {
      console.error(error);
      this.toast("Erro ao salvar consignação na Azure: " + error.message, "error");
    }
  },

  // 10. LÓGICA DE ACERTO DE CONTAS (MODAL)
  renderizarTabelaPreencherAcerto: function() {
    const rev = this.state.revendedoras.find(r => r.id === this.state.revendedoraSelecionadaId);
    if (!rev) return;

    document.getElementById("acerto-nome-revendedora").innerText = rev.nome;
    document.getElementById("acerto-comissao-percent").innerText = rev.comissao;

    const tbody = document.querySelector("#table-preencher-acerto tbody");
    tbody.innerHTML = "";

    if (!rev.consignado || rev.consignado.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align: center; color: var(--text-secondary); padding: 2rem;">
            Nenhuma peça consignada para acertar.
          </td>
        </tr>
      `;
      this.calcularResumoFechamentoAcerto();
      return;
    }

    rev.consignado.forEach(item => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>
          <strong>${item.codigo}</strong><br>
          <span style="font-size: 0.8rem; color: var(--text-secondary);">${item.nome}</span>
        </td>
        <td>R$ ${Number(item.precoVenda).toFixed(2).replace(".", ",")}</td>
        <td><strong>${item.quantidadeConsignada}</strong> pçs</td>
        <td>
          <div class="acerto-input-wrapper">
            <button class="btn-input-adjust" onclick="app.ajustarQtdAcerto(this, -1, 'vendido', ${item.quantidadeConsignada})"><i class="fa-solid fa-minus"></i></button>
            <input type="number" class="input-acerto-vendido"
                   data-prod-id="${item.produtoId}"
                   value="0" min="0" max="${item.quantidadeConsignada}"
                   oninput="app.sincronizarAcertoQuantidades(this, 'vendido')">
            <button class="btn-input-adjust" onclick="app.ajustarQtdAcerto(this, 1, 'vendido', ${item.quantidadeConsignada})"><i class="fa-solid fa-plus"></i></button>
          </div>
        </td>
        <td>
          <div class="acerto-input-wrapper">
            <button class="btn-input-adjust" onclick="app.ajustarQtdAcerto(this, -1, 'devolvido', ${item.quantidadeConsignada})"><i class="fa-solid fa-minus"></i></button>
            <input type="number" class="input-acerto-devolvido"
                   data-prod-id="${item.produtoId}"
                   value="${item.quantidadeConsignada}" min="0" max="${item.quantidadeConsignada}"
                   oninput="app.sincronizarAcertoQuantidades(this, 'devolvido')">
            <button class="btn-input-adjust" onclick="app.ajustarQtdAcerto(this, 1, 'devolvido', ${item.quantidadeConsignada})"><i class="fa-solid fa-plus"></i></button>
          </div>
        </td>
        <td>
          <div class="acerto-input-wrapper">
            <input type="number" class="input-acerto-perdido"
                   data-prod-id="${item.produtoId}"
                   value="0" min="0" max="${item.quantidadeConsignada}"
                   oninput="app.sincronizarAcertoQuantidades(this, 'perdido')"
                   style="border-color: rgba(239, 154, 154, 0.5);">
          </div>
        </td>
        <td>
          <div class="acerto-input-wrapper">
            <input type="number" class="input-acerto-defeito"
                   data-prod-id="${item.produtoId}"
                   value="0" min="0" max="${item.quantidadeConsignada}"
                   oninput="app.sincronizarAcertoQuantidades(this, 'defeito')"
                   style="border-color: rgba(255, 183, 77, 0.5);">
          </div>
        </td>
        <td style="text-align: right;">
          <div style="display: flex; gap: 0.3rem; justify-content: flex-end;">
            <button class="btn-shortcut" onclick="app.definirAcertoLinha('${item.produtoId}', 'venda', ${item.quantidadeConsignada})">Vendeu Tudo</button>
            <button class="btn-shortcut danger" onclick="app.definirAcertoLinha('${item.produtoId}', 'devolucao', ${item.quantidadeConsignada})">Devolveu Tudo</button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });

    this.calcularResumoFechamentoAcerto();
  },

  filtrarTabelaAcerto: function() {
    const busca = document.getElementById("acerto-busca").value.toLowerCase();
    const linhas = document.querySelectorAll("#table-preencher-acerto tbody tr");
    
    linhas.forEach(tr => {
      const tdInfo = tr.querySelector("td:nth-child(1)");
      if (!tdInfo) return;
      
      const texto = tdInfo.textContent.toLowerCase();
      if (texto.includes(busca)) {
        tr.style.display = "";
      } else {
        tr.style.display = "none";
      }
    });
  },

  ajustarQtdAcerto: function(btn, delta, acao, max) {
    const input = btn.parentElement.querySelector("input");
    if (input) {
      let val = parseInt(input.value) || 0;
      val = Math.min(Math.max(val + delta, 0), max);
      input.value = val;
      this.sincronizarAcertoQuantidades(input, acao);
    }
  },

  definirAcertoLinha: function(prodId, acao, max) {
    const inputVendido = document.querySelector(`.input-acerto-vendido[data-prod-id="${prodId}"]`);
    const inputDevolvido = document.querySelector(`.input-acerto-devolvido[data-prod-id="${prodId}"]`);
    const inputPerdido = document.querySelector(`.input-acerto-perdido[data-prod-id="${prodId}"]`);
    const inputDefeito = document.querySelector(`.input-acerto-defeito[data-prod-id="${prodId}"]`);
    if (inputVendido && inputDevolvido) {
      if (acao === 'venda') {
        inputVendido.value = max;
        inputDevolvido.value = 0;
        if (inputPerdido) inputPerdido.value = 0;
        if (inputDefeito) inputDefeito.value = 0;
      } else {
        inputVendido.value = 0;
        inputDevolvido.value = max;
        if (inputPerdido) inputPerdido.value = 0;
        if (inputDefeito) inputDefeito.value = 0;
      }
      this.calcularResumoFechamentoAcerto();
    }
  },

  marcarAcertoEmMassa: function(acao) {
    const rev = this.state.revendedoras.find(r => r.id === this.state.revendedoraSelecionadaId);
    if (!rev || !rev.consignado) return;
    
    rev.consignado.forEach(item => {
      const prodId = item.produtoId;
      const max = item.quantidadeConsignada;
      const inputVendido = document.querySelector(`.input-acerto-vendido[data-prod-id="${prodId}"]`);
      const inputDevolvido = document.querySelector(`.input-acerto-devolvido[data-prod-id="${prodId}"]`);
      const inputPerdido = document.querySelector(`.input-acerto-perdido[data-prod-id="${prodId}"]`);
      const inputDefeito = document.querySelector(`.input-acerto-defeito[data-prod-id="${prodId}"]`);
      if (inputVendido && inputDevolvido) {
        if (acao === 'vender_tudo') {
          inputVendido.value = max;
          inputDevolvido.value = 0;
          if (inputPerdido) inputPerdido.value = 0;
          if (inputDefeito) inputDefeito.value = 0;
        } else {
          inputVendido.value = 0;
          inputDevolvido.value = max;
          if (inputPerdido) inputPerdido.value = 0;
          if (inputDefeito) inputDefeito.value = 0;
        }
      }
    });
    this.calcularResumoFechamentoAcerto();
  },

  // Garante que Qtd Vendida + Qtd Devolvida + Qtd Perdida + Qtd Defeito = Qtd Consignada
  sincronizarAcertoQuantidades: function(input, acao) {
    const prodId = input.getAttribute("data-prod-id");
    let valor = parseInt(input.value) || 0;
    
    const rev = this.state.revendedoras.find(r => r.id === this.state.revendedoraSelecionadaId);
    const item = rev.consignado.find(c => c.produtoId === prodId);
    if (!item) return;
    
    const maxVal = item.quantidadeConsignada;
    
    const inpVend = document.querySelector(`.input-acerto-vendido[data-prod-id="${prodId}"]`);
    const inpDev  = document.querySelector(`.input-acerto-devolvido[data-prod-id="${prodId}"]`);
    const inpPerd = document.querySelector(`.input-acerto-perdido[data-prod-id="${prodId}"]`);
    const inpDef  = document.querySelector(`.input-acerto-defeito[data-prod-id="${prodId}"]`);
    
    let v   = parseInt(inpVend ? inpVend.value : 0) || 0;
    let d   = parseInt(inpDev  ? inpDev.value  : 0) || 0;
    let p   = parseInt(inpPerd ? inpPerd.value : 0) || 0;
    let def = parseInt(inpDef  ? inpDef.value  : 0) || 0;

    // A prioridade de ajuste automático vai para a devolução.
    if (acao === 'vendido') { v = Math.min(Math.max(valor, 0), maxVal); d = Math.max(0, maxVal - (v + p + def)); }
    else if (acao === 'perdido') { p = Math.min(Math.max(valor, 0), maxVal); d = Math.max(0, maxVal - (v + p + def)); }
    else if (acao === 'defeito') { def = Math.min(Math.max(valor, 0), maxVal); d = Math.max(0, maxVal - (v + p + def)); }
    else if (acao === 'devolvido') { 
      d = Math.min(Math.max(valor, 0), maxVal);
      if (v + d + p + def > maxVal) v = Math.max(0, maxVal - (d + p + def));
    }

    // Evita valores negativos
    if (d < 0) { d = 0; v = Math.max(0, maxVal - (d + p + def)); }
    if (v < 0) v = 0;

    if (inpVend) inpVend.value = v;
    if (inpDev)  inpDev.value  = d;
    if (inpPerd) inpPerd.value = p;
    if (inpDef)  inpDef.value  = def;

    this.calcularResumoFechamentoAcerto();
  },

  obterItensDoAcertoAtual: function() {
    const rev = this.state.revendedoras.find(r => r.id === this.state.revendedoraSelecionadaId);
    if (!rev) return [];

    const itens = [];
    document.querySelectorAll(".input-acerto-vendido").forEach(input => {
      const prodId = input.getAttribute("data-prod-id");
      const qtdVendida = parseInt(input.value) || 0;
      
      const inputDev  = document.querySelector(`.input-acerto-devolvido[data-prod-id="${prodId}"]`);
      const inputPerd = document.querySelector(`.input-acerto-perdido[data-prod-id="${prodId}"]`);
      const inputDef  = document.querySelector(`.input-acerto-defeito[data-prod-id="${prodId}"]`);
      const qtdDevolvida  = inputDev  ? (parseInt(inputDev.value)  || 0) : 0;
      const qtdPerdida    = inputPerd ? (parseInt(inputPerd.value) || 0) : 0;
      const qtdDefeito    = inputDef  ? (parseInt(inputDef.value)  || 0) : 0;
      
      const itemOrigem = rev.consignado.find(c => c.produtoId === prodId);
      if (itemOrigem) {
        itens.push({
          produtoId: prodId,
          codigo: itemOrigem.codigo,
          nome: itemOrigem.nome,
          quantidadeConsignada: itemOrigem.quantidadeConsignada,
          quantidadeVendida: qtdVendida,
          quantidadeDevolvida: qtdDevolvida,
          quantidadePerdida: qtdPerdida,
          quantidadeDefeito: qtdDefeito,
          precoVenda: itemOrigem.precoVenda
        });
      }
    });

    return itens;
  },

  calcularResumoFechamentoAcerto: function() {
    const rev = this.state.revendedoras.find(r => r.id === this.state.revendedoraSelecionadaId);
    if (!rev) return;

    const itensAcerto = this.obterItensDoAcertoAtual();
    
    let totalPecasConsignadas = 0;
    let faturamentoBruto = 0;
    let valorPerdas = 0;

    itensAcerto.forEach(item => {
      totalPecasConsignadas += item.quantidadeConsignada;
      faturamentoBruto += Number(item.precoVenda) * item.quantidadeVendida;
      valorPerdas += Number(item.precoVenda) * (item.quantidadePerdida || 0);
    });

    const comissaoBruta = faturamentoBruto * (Number(rev.comissao) / 100);
    const comissaoFinal = Math.max(0, comissaoBruta - valorPerdas);
    const liquidoReceber = faturamentoBruto - comissaoBruta + valorPerdas;

    document.getElementById("acerto-total-peças-levadas").innerText = `${totalPecasConsignadas} pçs`;
    document.getElementById("acerto-total-faturamento-bruto").innerText = `R$ ${faturamentoBruto.toFixed(2).replace(".", ",")}`;
    document.getElementById("acerto-comissao-valor").innerText = `R$ ${comissaoBruta.toFixed(2).replace(".", ",")}`;
    
    const elDesconto = document.getElementById("acerto-desconto-perdas");
    if (elDesconto) elDesconto.innerText = `- R$ ${valorPerdas.toFixed(2).replace(".", ",")}`;
    
    document.getElementById("acerto-total-liquido-receber").innerText = `R$ ${liquidoReceber.toFixed(2).replace(".", ",")}`;
  },

  finalizarAcerto: async function(abrirWhatsApp = false) {
    const rev = this.state.revendedoras.find(r => r.id === this.state.revendedoraSelecionadaId);
    if (!rev) return;

    const itensAcerto = this.obterItensDoAcertoAtual();
    if (itensAcerto.length === 0) {
      this.toast("Não há produtos consignados para fechar.", "warning");
      return;
    }

    let faturamentoBruto = 0;
    let totalConsignada = 0;
    let totalVendida = 0;
    let totalDevolvida = 0;
    let totalPerdida = 0;
    let totalDefeito = 0;

    const postItens = [];

    // Processa os itens no sistema
    itensAcerto.forEach(item => {
      totalConsignada += item.quantidadeConsignada;
      totalVendida += item.quantidadeVendida;
      totalDevolvida += item.quantidadeDevolvida;
      totalPerdida += (item.quantidadePerdida || 0);
      totalDefeito += (item.quantidadeDefeito || 0);
      
      faturamentoBruto += Number(item.precoVenda) * item.quantidadeVendida;

      postItens.push({
        produtoId: item.produtoId,
        quantidadeVendida: item.quantidadeVendida,
        quantidadeDevolvida: item.quantidadeDevolvida,
        quantidadePerdida: item.quantidadePerdida || 0,
        quantidadeDefeito: item.quantidadeDefeito || 0
      });

      // 1. As devoluções retornam ao Estoque Central localmente para reatividade
      if (item.quantidadeDevolvida > 0) {
        const prodOriginal = this.state.produtos.find(p => p.id === item.produtoId);
        if (prodOriginal) {
          prodOriginal.quantidade = Number(prodOriginal.quantidade || 0) + item.quantidadeDevolvida;
          // Atualiza _valoresDinamicos para refletir na tabela de estoque imediatamente
          if (prodOriginal._valoresDinamicos) {
            prodOriginal._valoresDinamicos["Estoque Central"] = prodOriginal.quantidade;
          }
        }
      }
    });

    const valorComissaoBruta = faturamentoBruto * (Number(rev.comissao) / 100);
    const valorPerdas = itensAcerto.reduce((acc, item) => acc + Number(item.precoVenda) * (item.quantidadePerdida || 0), 0);
    const valorComissao = Math.max(0, valorComissaoBruta - valorPerdas);
    const valorLiquido = faturamentoBruto - valorComissaoBruta + valorPerdas;

    try {
      // Sincroniza fechamento de acerto com a Azure
      if (this.state.token) {
        await this.requisitarAPI("/acertos", "POST", {
          usuarioId: rev.id,
          itensAcerto: postItens
        });
      }

      // Adiciona histórico local
      if(!rev.historico) rev.historico = [];
      rev.historico.push({
        data: new Date().toISOString(),
        totalConsignada,
        totalVendida,
        totalDevolvida,
        totalPerdida,
        totalDefeito,
        faturamentoBruto,
        valorDescontoPerda: valorPerdas,
        comissaoPaga: valorComissao,
        liquidoBelklock: valorLiquido
      });

      // Se deve abrir WhatsApp, gera e redireciona
      if (abrirWhatsApp) {
        let mensagemTemplate = MarketingData.whatsappTemplates.reciboAcerto;
        mensagemTemplate = mensagemTemplate
          .replace("{revendedora}", rev.nome)
          .replace("{data_acerto}", new Date().toLocaleDateString('pt-BR'))
          .replace("{qtd_consignada}", totalConsignada)
          .replace("{qtd_devolvida}", totalDevolvida)
          .replace("{qtd_vendida}", totalVendida)
          .replace("{valor_bruto}", faturamentoBruto.toFixed(2).replace(".", ","))
          .replace("{comissao_porc}", rev.comissao)
          .replace("{valor_comissao}", valorComissao.toFixed(2).replace(".", ","))
          .replace("{valor_liquido}", valorLiquido.toFixed(2).replace(".", ","));

        const whatsLink = `https://api.whatsapp.com/send?phone=55${rev.whatsapp.replace(/\D/g, '')}&text=${encodeURIComponent(mensagemTemplate)}`;
        window.open(whatsLink, "_blank");
      }

      // 2. Limpa a maleta de consignado da revendedora no estado (pois concluiu o acerto)
      rev.consignado = [];

      // Salva tudo
      this.salvarDadosNoLocalStorage();
      this.renderizarRevendedoras();
      this.renderizarEstoque();
      this.renderizarDashboard();

      document.getElementById("modal-acerto").classList.remove("active");
      
      this.toast(`Acerto com ${rev.nome} concluído com sucesso e gravado na Azure! Líquido a receber: R$ ${valorLiquido.toFixed(2).replace(".", ",")}`, "success");
    } catch (error) {
      console.error(error);
      this.toast("Erro ao finalizar o acerto na Azure: " + error.message, "error");
    }
  },

  exportarExcelAcerto: function() {
    const rev = this.state.revendedoras.find(r => r.id === this.state.revendedoraSelecionadaId);
    if (!rev) return;
    
    const itensAcerto = this.obterItensDoAcertoAtual();
    ExcelHandler.exportarAcertoRevendedora(rev, itensAcerto);
  },

  // 11. ABA: MARKETING & DIVULGAÇÃO
  renderizarMarketing: function() {
    // 1. Ativa a sub-aba selecionada
    document.querySelectorAll(".sub-aba-mkt").forEach(sec => {
      if (sec.getAttribute("id") === `sub-aba-${this.state.subAbaMktAtiva}`) {
        sec.classList.add("active");
        sec.style.display = "block";
      } else {
        sec.classList.remove("active");
        sec.style.display = "none";
      }
    });

    document.querySelectorAll(".mkt-tab-btn").forEach(btn => {
      if (btn.getAttribute("id") === `tab-btn-${this.state.subAbaMktAtiva}`) {
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
      }
    });

    // 2. Lógica da Sub-Aba de Feed (Organizar grade 3x3 do Insta)
    if (this.state.subAbaMktAtiva === "feed") {
      const feedGrid = document.getElementById("instagram-feed-grid");
      feedGrid.innerHTML = "";

      const totalPosts = this.state.feedImagens.length;
      document.getElementById("ig-posts-count").innerText = totalPosts;

      this.state.feedImagens.forEach((imgSrc, index) => {
        const postDiv = document.createElement("div");
        postDiv.className = "ig-post";
        
        // Se a string contiver 'gradient', estiliza com background inline
        if (imgSrc.startsWith("linear-gradient") || imgSrc.startsWith("radial-gradient")) {
          postDiv.style.background = imgSrc;
          postDiv.innerHTML = `
            <div class="ig-post-placeholder">
              <i class="fa-solid fa-ring"></i>
              <span>Brilho Bel</span>
            </div>
          `;
        } else {
          postDiv.innerHTML = `<img src="${imgSrc}" alt="Foto Joia">`;
        }

        // Evento para remover imagem do feed
        postDiv.addEventListener("click", async () => {
          if (await this.confirmar("Remover esta publicação do planejador de feed?")) {
            this.state.feedImagens.splice(index, 1);
            this.salvarDadosNoLocalStorage();
            this.renderizarMarketing();
            this.toast("Publicação removida com sucesso!", "success");
          }
        });

        feedGrid.appendChild(postDiv);
      });
    }

    // 3. Lógica do Calendário Editorial
    if (this.state.subAbaMktAtiva === "posts") {
      const ideiasContainer = document.getElementById("mkt-ideias-container");
      ideiasContainer.innerHTML = "";

      MarketingData.calendarioDivulgacao.forEach((cal, index) => {
        const card = document.createElement("div");
        card.className = "idea-card";
        card.innerHTML = `
          <div class="idea-header">
            <span class="idea-day">${cal.dia}</span>
            <span class="idea-channel"><i class="fa-solid fa-bullhorn"></i> ${cal.canal}</span>
          </div>
          <h4 class="idea-title">${cal.ideiaPost}</h4>
          <p style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 0.8rem;">
            <strong>Foco da Postagem:</strong> ${cal.foco}
          </p>
          <div class="caption-box" id="caption-text-${index}">
            ${cal.sugestaoLegenda}
            <button class="btn-copy" onclick="app.copiarTextoLegenda(${index})" title="Copiar Legenda"><i class="fa-regular fa-copy"></i></button>
          </div>
        `;
        ideiasContainer.appendChild(card);
      });
    }

    // 4. Lógica de Personas & Público-Alvo
    if (this.state.subAbaMktAtiva === "personas") {
      const personasContainer = document.getElementById("mkt-personas-container");
      personasContainer.innerHTML = "";

      MarketingData.personas.forEach(pers => {
        const card = document.createElement("div");
        card.className = "persona-card";
        card.innerHTML = `
          <div class="persona-header">
            <div class="persona-avatar">${pers.nome.charAt(0)}</div>
            <div class="persona-title">
              <h3>${pers.nome}</h3>
              <p>${pers.idade} anos • ${pers.profissao}</p>
            </div>
          </div>
          <div class="persona-detail">
            <strong>Perfil do Cliente</strong>
            <p>${pers.perfil}</p>
          </div>
          <div class="persona-detail">
            <strong>Estilo de Joias Favorito</strong>
            <p>${pers.estiloPref}</p>
          </div>
          <div class="persona-detail">
            <strong>Dor de Compra</strong>
            <p>${pers.dorPrincipal}</p>
          </div>
          <div class="persona-detail" style="border-top: 1px dashed rgba(212, 175, 55, 0.2); padding-top: 0.8rem; margin-top: 0.8rem;">
            <strong style="color: var(--gold-light);"><i class="fa-solid fa-lightbulb"></i> Como abordar para Venda:</strong>
            <p style="font-style: italic; color: var(--gold-light);">${pers.abordagem}</p>
          </div>
        `;
        personasContainer.appendChild(card);
      });
    }
  },

  mudarSubAbaMarketing: function(subAbaId) {
    this.state.subAbaMktAtiva = subAbaId;
    this.renderizarMarketing();
  },

  copiarTextoLegenda: function(index) {
    const container = document.getElementById(`caption-text-${index}`);
    
    // Pega o texto da legenda limpando o botão de cópia do texto final
    let texto = container.innerText.trim();
    
    navigator.clipboard.writeText(texto).then(() => {
      this.toast("Legenda copiada com sucesso! Pronta para postar no Instagram. ✨📲", "success");
    });
  },

  processarUploadFeed: async function(event) {
    const files = event.target.files;
    if (files.length === 0) return;

    const file = files[0];
    
    // Se o usuário estiver autenticado, tenta fazer upload para a Azure
    if (this.state.token) {
      try {
        const formData = new FormData();
        formData.append("imagem", file);

        const data = await this.requisitarAPI("/uploads", "POST", formData);
        
        this.state.feedImagens.unshift(data.url);
        if (this.state.feedImagens.length > 12) {
          this.state.feedImagens.pop();
        }

        this.salvarDadosNoLocalStorage();
        this.renderizarMarketing();
        this.toast("Imagem salva no contêiner da Azure com sucesso! Link público gerado.", "success");
        return;
      } catch (error) {
        console.warn("Falha no upload para Azure Blob Storage. Usando fallback Base64 local:", error.message);
      }
    }

    // Fallback: Salva no LocalStorage em Base64 comprimido
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const maxDim = 450;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxDim) {
            height *= maxDim / width;
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width *= maxDim / height;
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        const compressedBase64 = canvas.toDataURL("image/jpeg", 0.75);

        this.state.feedImagens.unshift(compressedBase64);
        if (this.state.feedImagens.length > 12) {
          this.state.feedImagens.pop();
        }

        this.salvarDadosNoLocalStorage();
        this.renderizarMarketing();
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  },

  reiniciarFeedPadrao: async function() {
    if (await this.confirmar("Deseja realmente resetar e voltar ao feed padrão inicial?")) {
      this.state.feedImagens = [];
      this.inicializarFeedPadrao();
      this.renderizarMarketing();
      this.toast("Feed reiniciado para o padrão com sucesso!", "success");
    }
  },

  // 12. LÓGICA DE INTEGRAÇÃO COM PLANILHAS EXCEL IMPORTAÇÃO
  processarImportacaoExcel: function(event) {
    const file = event.target.files[0];
    if (file) {
      ExcelHandler.importarEstoque(file, (produtos) => this.mesclarEstoqueImportado(produtos));
    }
  },

  mesclarEstoqueImportado: async function(resultadoImportacao) {
    let produtosImportados = [];
    let revendedorasImportadas = [];
    let novasColunas = null;

    // Suporta tanto o formato antigo (array direto de produtos) quanto o formato novo (objeto com produtos e revendedoras)
    if (Array.isArray(resultadoImportacao)) {
      produtosImportados = resultadoImportacao;
    } else if (resultadoImportacao && typeof resultadoImportacao === "object") {
      produtosImportados = resultadoImportacao.produtos || [];
      revendedorasImportadas = resultadoImportacao.revendedoras || [];
      novasColunas = resultadoImportacao.colunas || null;
    }

    if (produtosImportados && produtosImportados.length > 0) {
      let novosCount = 0;
      let atualizadosCount = 0;
      let revendedorasCount = revendedorasImportadas.length;

      // Pergunta se deseja limpar o estoque atual para iniciar do zero ou mesclar
      const substituirTudo = this.state.usandoFicticio || await this.confirmar("Deseja substituir todo o estoque atual do sistema pelas informações desta planilha?\n\n- Confirmar para apagar os produtos e revendedoras atuais e carregar apenas os dados da planilha.\n- Cancelar para apenas mesclar e atualizar os preços/estoques existentes de acordo com o arquivo.");

      // Se o servidor local estiver ativo, envia para persistência real no banco de dados SQLite
      if (this.state.token) {
        try {
          await this.requisitarAPI("/importar", "POST", {
            produtos: produtosImportados,
            revendedoras: revendedorasImportadas,
            substituirTudo: substituirTudo
          });
        } catch (error) {
          console.error(error);
          this.toast("Erro ao salvar os dados da planilha no servidor local: " + error.message, "error");
          return;
        }
      }

      if (substituirTudo) {
        this.state.produtos = [];
        this.state.revendedoras = [];
        this.state.usandoFicticio = false;
        
        // Substitui a lista de colunas ativas do estoque pela lista exata de colunas da planilha do usuário!
        if (novasColunas) {
          this.state.colunasEstoque = novasColunas;
        }

        novosCount = produtosImportados.length;
        this.state.produtos = produtosImportados;
        this.state.revendedoras = revendedorasImportadas;
      } else {
        // Mescla produtos (sobrescrevendo a quantidade em vez de somar para garantir atualização exata do inventário)
        produtosImportados.forEach(pImp => {
          const existente = this.state.produtos.find(p => p.codigo === pImp.codigo);
          if (existente) {
            existente.quantidade = pImp.quantidade; // Sobrescreve
            existente.custoBruto = pImp.custoBruto;
            existente.custoBanho = pImp.custoBanho;
            existente.custoLiquido = pImp.custoLiquido;
            existente.markup = pImp.markup;
            // Atualiza _valoresDinamicos para mesclagem correta
            if (pImp._valoresDinamicos) {
              existente._valoresDinamicos = pImp._valoresDinamicos;
            }
            atualizadosCount++;
          } else {
            this.state.produtos.push(pImp);
            novosCount++;
          }
        });

        // Se mesclar e vierem colunas novas, garante que a lista de colunas ativas contenha todas as colunas que já existiam e as que vieram agora!
        if (novasColunas) {
          novasColunas.forEach(c => {
            if (!this.state.colunasEstoque.includes(c)) {
              this.state.colunasEstoque.push(c);
            }
          });
        }

        // Mescla revendedoras
        revendedorasImportadas.forEach(rImp => {
          const existente = this.state.revendedoras.find(r => r.nome.toLowerCase() === rImp.nome.toLowerCase());
          if (existente) {
            rImp.consignado.forEach(cImp => {
              const itemExistente = existente.consignado.find(c => c.codigo === cImp.codigo);
              if (itemExistente) {
                itemExistente.quantidadeConsignada = cImp.quantidadeConsignada; // Sobrescreve
                itemExistente.precoVenda = cImp.precoVenda;
              } else {
                existente.consignado.push(cImp);
              }
            });
          } else {
            this.state.revendedoras.push(rImp);
          }
        });
      }

      // Se estiver conectado ao servidor, recarrega os dados diretamente do banco de dados para garantir sincronia total
      if (this.state.token) {
        await this.carregarProdutosDaAPI();
        if (['ADMIN_LOJA', 'SUPER_ADMIN', 'admin'].includes(this.state.usuarioLogado.role)) {
          await this.carregarRevendedorasDaAPI();
        }
      } else {
        this.salvarDadosNoLocalStorage();
      }

      this.renderizarEstoque();
      this.renderizarRevendedoras();
      this.renderizarDashboard();
      
      let mensagem = `Planilha importada com sucesso!\n\n`;
      if (substituirTudo) {
        mensagem += `O banco de dados foi limpo e atualizado com as informações reais da planilha.\n`;
        mensagem += `- ${novosCount} produtos reais carregados.\n`;
        if (revendedorasCount > 0) {
          mensagem += `- ${revendedorasCount} revendedoras reais importadas com suas maletas.\n`;
        }
      } else {
        mensagem += `- ${novosCount} novos produtos adicionados.\n`;
        mensagem += `- ${atualizadosCount} produtos existentes atualizados de acordo com a planilha.\n`;
        if (revendedorasCount > 0) {
          mensagem += `- ${revendedorasCount} revendedoras atualizadas.\n`;
        }
      }
      
      this.toast(mensagem, "success");
      this.navegarParaAba("estoque");
    }
  },

  zerarDadosDemonstracao: async function() {
    if (await this.confirmar("Deseja realmente zerar todos os dados fictícios de demonstração? Isso apagará as peças e revendedoras de exemplo e deixará o aplicativo limpo para seus dados reais.")) {
      this.state.produtos = [];
      this.state.revendedoras = [];
      this.state.usandoFicticio = false;
      this.salvarDadosNoLocalStorage();
      this.renderizarEstoque();
      this.renderizarRevendedoras();
      this.renderizarDashboard();
      this.toast("Todos os dados fictícios foram zerados com sucesso! Agora o sistema está limpo e pronto para receber suas informações reais.", "success");
    }
  },

  excluirTodosOsProdutos: async function() {
    const confirmacao1 = await this.confirmar("⚠️ ATENÇÃO: Isso excluirá permanentemente todos os produtos cadastrados no estoque central!");
    if (!confirmacao1) return;

    const confirmacao2 = await this.confirmar("🚨 VOCÊ TEM CERTEZA? Esta ação também apagará todos os itens em consignação ativas nas maletas das revendedoras. Essa ação NÃO pode ser desfeita!");
    if (!confirmacao2) return;

    try {
      // Se estiver conectado ao servidor local
      if (this.state.token) {
        await this.requisitarAPI("/produtos", "DELETE");
      }

      // Limpa no estado local
      this.state.produtos = [];
      this.state.revendedoras.forEach(r => {
        r.consignado = [];
      });

      this.salvarDadosNoLocalStorage();
      this.renderizarEstoque();
      this.renderizarRevendedoras();
      this.renderizarDashboard();

      this.toast("Estoque central e consignações correspondentes excluídos com sucesso!", "success");
    } catch (error) {
      console.error(error);
      this.toast("Erro ao excluir produtos no servidor: " + error.message, "error");
    }
  },

  // 13. VENDA RÁPIDA / COMPARTILHAR CATÁLOGO WHATSAPP (MODAL)
  abrirModalVendaRapida: function() {
    // Popular o select de clientes
    const vrSelect = document.getElementById("vr-cliente-select");
    if (vrSelect) {
      vrSelect.innerHTML = '<option value="">-- Cliente Avulsa (Não Registar) --</option>';
      this.state.clientes.forEach(c => {
        const opt = document.createElement("option");
        opt.value = c.id;
        opt.textContent = `${c.nome} (${c.whatsapp})`;
        vrSelect.appendChild(opt);
      });
    }
    // Limpa campos de novo cliente
    const nomeInput = document.getElementById("vr-cliente-nome");
    const whaInput  = document.getElementById("vr-cliente-whatsapp");
    if (nomeInput) nomeInput.value = "";
    if (whaInput)  whaInput.value  = "";
    // Mostra box de novo cliente por padrão (select em branco)
    const novoBox = document.getElementById("vr-novo-cliente-box");
    if (novoBox) novoBox.style.display = "block";

    const tbody = document.querySelector("#table-selecionar-venda-rapida tbody");
    tbody.innerHTML = "";

    if (this.state.produtos.length === 0) {
      tbody.innerHTML = `<tr><td colspan="3" style="text-align: center;">Estoque vazio! Cadastre produtos.</td></tr>`;
    } else {
      this.state.produtos.forEach(p => {
        const custoTotal = Number(p.custoBruto || 0) + Number(p.custoBanho || 0) + Number(p.custoLiquido || 0);
        const precoVenda = custoTotal * Number(p.markup || 1);

        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td style="padding: 0.5rem; text-align: center;">
            <input type="checkbox" class="chk-venda-rapida" data-codigo="${p.codigo}" data-nome="${p.nome}" data-preco="${precoVenda}">
          </td>
          <td style="padding: 0.5rem;"><strong>${p.codigo}</strong> - ${p.nome}</td>
          <td style="padding: 0.5rem; color: var(--gold-primary);">R$ ${precoVenda.toFixed(2).replace(".", ",")}</td>
        `;
        tbody.appendChild(tr);
      });
    }

    document.getElementById("modal-venda-rapida").classList.add("active");
  },

  processarVendaRapidaWhats: async function() {
    // Resolve dados do cliente
    const vrSelect = document.getElementById("vr-cliente-select");
    let clienteId = null;
    let nomeCliente = "Cliente Especial";
    let whatsapp = "";

    if (vrSelect && vrSelect.value) {
      // Cliente já existente selecionado
      clienteId = vrSelect.value;
      const clienteObj = this.state.clientes.find(c => c.id === clienteId);
      if (clienteObj) {
        nomeCliente = clienteObj.nome;
        whatsapp = clienteObj.whatsapp;
      }
    } else {
      // Novo cliente ou avulsa
      const nomeInput = document.getElementById("vr-cliente-nome");
      const whaInput  = document.getElementById("vr-cliente-whatsapp");
      nomeCliente = (nomeInput && nomeInput.value.trim()) || "Cliente Especial";
      whatsapp    = (whaInput  && whaInput.value.trim())  || "";

      // Se informou WhatsApp, regista nova cliente automaticamente
      if (whatsapp && nomeInput && nomeInput.value.trim()) {
        try {
          if (this.state.token && !this.state.token.startsWith("mock_")) {
            const novaCliente = await this.requisitarAPI("/clientes", "POST", { nome: nomeCliente, whatsapp });
            clienteId = novaCliente.id;
            this.state.clientes.push(novaCliente);
          }
        } catch(e) {
          console.warn("Não foi possível salvar cliente:", e.message);
        }
      }
    }

    if (!whatsapp) {
      this.toast("Por favor, selecione uma cliente ou informe o WhatsApp para enviar a mensagem.", "warning");
      return;
    }

    const selecionados = [];
    document.querySelectorAll(".chk-venda-rapida:checked").forEach(chk => {
      selecionados.push({
        codigo: chk.getAttribute("data-codigo"),
        nome: chk.getAttribute("data-nome"),
        preco: parseFloat(chk.getAttribute("data-preco"))
      });
    });

    if (selecionados.length === 0) {
      this.toast("Selecione pelo menos um produto para gerar a mensagem de venda.", "warning");
      return;
    }

    // Pergunta se deseja registrar a baixa no sistema
    const registrarBaixa = await this.confirmar("Deseja registrar esta venda direta no banco de dados do sistema e deduzir a quantidade do estoque central?");

    if (registrarBaixa) {
      try {
        for (const item of selecionados) {
          // Se houver conexão de API ativa
          if (this.state.token) {
            await this.requisitarAPI("/vendas-diretas", "POST", {
              codigo: item.codigo,
              nome: item.nome,
              preco: item.preco,
              whatsappCliente: whatsapp,
              nomeCliente: nomeCliente,
              clienteId: clienteId || undefined
            });
          }
          
          // Deduz localmente para reatividade imediata
          const prod = this.state.produtos.find(p => p.codigo === item.codigo);
          if (prod && prod.quantidade > 0) {
            prod.quantidade--;
          }
        }
        
        this.salvarDadosNoLocalStorage();
        this.renderizarEstoque();
        this.renderizarDashboard();
      } catch (error) {
        console.error(error);
        this.toast("Erro ao registrar a venda direta na Azure: " + error.message, "error");
      }
    }

    // Constrói lista de produtos elegante
    let listaTexto = "";
    let valorTotal = 0;
    selecionados.forEach(item => {
      listaTexto += `- *[Ref: ${item.codigo}]* ${item.nome}: R$ ${item.preco.toFixed(2).replace(".", ",")}\n`;
      valorTotal += item.preco;
    });

    if (selecionados.length > 1) {
      listaTexto += `\n*Valor Total de Compra:* R$ ${valorTotal.toFixed(2).replace(".", ",")}`;
    }

    let mensagem = MarketingData.whatsappTemplates.envioCatalogo;
    mensagem = mensagem
      .replace("{cliente}", nomeCliente)
      .replace("{lista_produtos}", listaTexto);

    const whatsLink = `https://api.whatsapp.com/send?phone=55${whatsapp.replace(/\D/g, '')}&text=${encodeURIComponent(mensagem)}`;
    window.open(whatsLink, "_blank");

    document.getElementById("modal-venda-rapida").classList.remove("active");
  },

  // 14. UTILITÁRIOS E EXTRAS (Máscaras, Gráficos, Backup e UI)
  aplicarMascaraWhatsApp: function(input) {
    let v = input.value.replace(/\D/g, "");
    if (v.length > 11) v = v.slice(0, 11);
    v = v.replace(/^(\d{2})(\d)/g, "($1) $2");
    v = v.replace(/(\d)(\d{4})$/, "$1-$2");
    input.value = v;
  },

  exportarBackupGeralJSON: function() {
    const backupData = {
      produtos: this.state.produtos,
      revendedoras: this.state.revendedoras,
      feedImagens: this.state.feedImagens,
      usandoFicticio: this.state.usandoFicticio,
      colunasEstoque: this.state.colunasEstoque
    };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "belklock_backup_" + new Date().getTime() + ".json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  },

  importarBackupGeralJSON: function(event) {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result);
          if (data.produtos && data.revendedoras) {
            this.state.produtos = data.produtos;
            this.state.revendedoras = data.revendedoras;
            this.state.feedImagens = data.feedImagens || [];
            this.state.usandoFicticio = data.usandoFicticio || false;
            this.state.colunasEstoque = data.colunasEstoque || ["Código", "Nome do Produto", "Categoria", "Estoque Central", "Custo Bruto", "Custo Banho", "Custo Oper.", "Markup", "Preço Venda"];
            this.salvarDadosNoLocalStorage();
            this.navegarParaAba("dashboard");
            this.toast("Backup geral JSON restaurado com sucesso!", "success");
          } else {
            this.toast("Arquivo JSON inválido ou incompatível.", "error");
          }
        } catch (error) {
          this.toast("Erro ao ler e interpretar o arquivo JSON.", "error");
        }
      };
      reader.readAsText(file);
    }
  },

  renderizarGraficosDashboard: function() {
    if(typeof Chart === 'undefined') return;

    if(window.chartCategorias) window.chartCategorias.destroy();
    if(window.chartRevendedoras) window.chartRevendedoras.destroy();

    const ctxCat = document.getElementById('chart-categorias');
    const ctxRev = document.getElementById('chart-revendedoras');

    if(ctxCat) {
      const catData = {};
      this.state.produtos.forEach(p => {
        const cat = p.categoria || "Outros";
        const val = (Number(p.custoBruto || 0) + Number(p.custoBanho || 0) + Number(p.custoLiquido || 0)) * Number(p.quantidade || 0);
        catData[cat] = (catData[cat] || 0) + val;
      });

      window.chartCategorias = new Chart(ctxCat, {
        type: 'doughnut',
        data: {
          labels: Object.keys(catData),
          datasets: [{
            data: Object.values(catData),
            backgroundColor: ['#d4af37', '#b38e24', '#f9e8a2', '#8c6d17', '#e2c668', '#423004'],
            borderColor: '#0a0a0a',
            borderWidth: 2
          }]
        },
        options: { plugins: { legend: { labels: { color: '#e0e0e0' } } } }
      });
    }

    if(ctxRev) {
      const revLabels = [];
      const revData = [];
      this.state.revendedoras.forEach(r => {
        let faturamentoBruto = 0;
        if(r.consignado) {
           r.consignado.forEach(c => {
             faturamentoBruto += Number(c.precoVenda || 0) * Number(c.quantidadeConsignada || 0);
           });
        }
        revLabels.push(r.nome.split(" ")[0]);
        revData.push(faturamentoBruto);
      });

      window.chartRevendedoras = new Chart(ctxRev, {
        type: 'bar',
        data: {
          labels: revLabels,
          datasets: [{
            label: 'Faturamento Bruto (R$)',
            data: revData,
            backgroundColor: '#d4af37',
            borderRadius: 4
          }]
        },
        options: { 
          scales: { 
            y: { ticks: { color: '#e0e0e0' }, grid: { color: 'rgba(255,255,255,0.1)' } },
            x: { ticks: { color: '#e0e0e0' }, grid: { display: false } }
          },
          plugins: { legend: { display: false } }
        }
      });
    }
  },

  mudarSubAbaRevendedora: function(aba) {
    // Esconde todas as sub-abas da revendedora
    document.getElementById("sub-aba-rev-maleta").style.display = "none";
    document.getElementById("sub-aba-rev-historico").style.display = "none";
    document.getElementById("sub-aba-rev-vendas").style.display = "none";
    
    // Remove classe active de todos os botões
    document.getElementById("btn-subtab-maleta").classList.remove("active");
    document.getElementById("btn-subtab-historico").classList.remove("active");
    document.getElementById("btn-subtab-vendas-rev").classList.remove("active");
    
    if (aba === "maleta") {
      document.getElementById("sub-aba-rev-maleta").style.display = "block";
      document.getElementById("btn-subtab-maleta").classList.add("active");
    } else if (aba === "vendas") {
      document.getElementById("sub-aba-rev-vendas").style.display = "block";
      document.getElementById("btn-subtab-vendas-rev").classList.add("active");
      this.renderizarVendasIndividuaisRevendedora();
    } else if (aba === "historico") {
      document.getElementById("sub-aba-rev-historico").style.display = "block";
      document.getElementById("btn-subtab-historico").classList.add("active");
    }
  },

  carregarVendasConsolidadas: async function() {
    const offlineMode = this.state.token && this.state.token.startsWith("mock_");
    if (offlineMode) {
      const vendasConsolidadas = [];
      
      this.state.revendedoras.forEach(r => {
        const localVendasKey = `belklock_vendas_${r.id}`;
        const localVendas = JSON.parse(localStorage.getItem(localVendasKey) || "[]");
        localVendas.forEach(v => {
          vendasConsolidadas.push({
            id: v.id,
            data: v.data,
            tipo: 'revendedora',
            nomeProduto: v.nomeProduto,
            codigoProduto: v.codigoProduto,
            quantidade: v.quantidade,
            precoVenda: v.precoVenda,
            total: v.precoVenda * v.quantidade,
            comissao: v.comissaoValor,
            vendedor: r.nome,
            contato: r.whatsapp || '—',
            cliente: '—',
            usuarioId: r.id
          });
        });
      });
      
      vendasConsolidadas.sort((a, b) => new Date(b.data) - new Date(a.data));
      this.state.vendasConsolidadas = vendasConsolidadas;
      this.atualizarSeletorFiltroRevendedoras();
      return;
    }

    try {
      const [vendasDiretas, vendasRevendedoras] = await Promise.all([
        this.requisitarAPI("/vendas-diretas"),
        this.requisitarAPI("/vendas-revendedora")
      ]);
      
      this.state.vendasDiretas = vendasDiretas;
      this.state.vendasRevendedoras = vendasRevendedoras;
      
      const vendasConsolidadas = [];
      
      vendasDiretas.forEach(v => {
        vendasConsolidadas.push({
          id: v.id,
          data: v.data,
          tipo: 'direta',
          nomeProduto: v.nome,
          codigoProduto: v.codigo,
          quantidade: 1,
          precoVenda: v.preco,
          total: v.preco,
          comissao: 0,
          vendedor: 'BelKlock (Direta)',
          contato: v.whatsappCliente || '—',
          cliente: v.nomeCliente || '—',
          usuarioId: null
        });
      });
      
      vendasRevendedoras.forEach(v => {
        vendasConsolidadas.push({
          id: v.id,
          data: v.data,
          tipo: 'revendedora',
          nomeProduto: v.nomeProduto,
          codigoProduto: v.codigoProduto,
          quantidade: v.quantidade,
          precoVenda: v.precoVenda,
          total: v.precoVenda * v.quantidade,
          comissao: v.comissaoValor,
          vendedor: v.usuario ? v.usuario.nome : 'Revendedora',
          contato: v.usuario && v.usuario.whatsapp ? v.usuario.whatsapp : '—',
          cliente: '—',
          usuarioId: v.usuarioId
        });
      });
      
      vendasConsolidadas.sort((a, b) => new Date(b.data) - new Date(a.data));
      this.state.vendasConsolidadas = vendasConsolidadas;
      
      this.atualizarSeletorFiltroRevendedoras();
    } catch (error) {
      console.warn("Falha ao carregar vendas consolidadas:", error.message);
      this.state.vendasConsolidadas = [];
    }
  },
  
  atualizarSeletorFiltroRevendedoras: function() {
    const select = document.getElementById("filtro-vendas-revendedora");
    if (!select) return;
    
    select.innerHTML = "<option value=''>Todas as Revendedoras</option>";
    
    this.state.revendedoras.forEach(r => {
      const opt = document.createElement("option");
      opt.value = r.id;
      opt.textContent = r.nome;
      select.appendChild(opt);
    });
  },

  renderizarVendasConsolidadas: function() {
    const tbody = document.getElementById("tbody-historico-vendas-geral");
    if (!tbody) return;

    // Configura cabeçalhos de ordenação dinamicamente
    const headers = document.querySelectorAll("#table-historico-vendas-geral thead th");
    const ordVendas = this.state.ordenacao && this.state.ordenacao.vendas;
    if (headers.length >= 7 && ordVendas) {
      headers[0].style.cursor = "pointer";
      headers[0].onclick = () => this.ordenarTabela("vendas", "data");
      headers[0].innerHTML = `Data ${ordVendas.coluna === 'data' ? `<i class="fa-solid ${ordVendas.direcao === 'asc' ? 'fa-sort-up' : 'fa-sort-down'}" style="color:var(--gold-primary);"></i>` : '<i class="fa-solid fa-sort" style="opacity:0.3;"></i>'}`;

      headers[2].style.cursor = "pointer";
      headers[2].onclick = () => this.ordenarTabela("vendas", "nomeProduto");
      headers[2].innerHTML = `Produto ${ordVendas.coluna === 'nomeProduto' ? `<i class="fa-solid ${ordVendas.direcao === 'asc' ? 'fa-sort-up' : 'fa-sort-down'}" style="color:var(--gold-primary);"></i>` : '<i class="fa-solid fa-sort" style="opacity:0.3;"></i>'}`;

      headers[5].style.cursor = "pointer";
      headers[5].onclick = () => this.ordenarTabela("vendas", "total");
      headers[5].innerHTML = `Valor Total ${ordVendas.coluna === 'total' ? `<i class="fa-solid ${ordVendas.direcao === 'asc' ? 'fa-sort-up' : 'fa-sort-down'}" style="color:var(--gold-primary);"></i>` : '<i class="fa-solid fa-sort" style="opacity:0.3;"></i>'}`;

      headers[6].style.cursor = "pointer";
      headers[6].onclick = () => this.ordenarTabela("vendas", "comissao");
      headers[6].innerHTML = `Comissão ${ordVendas.coluna === 'comissao' ? `<i class="fa-solid ${ordVendas.direcao === 'asc' ? 'fa-sort-up' : 'fa-sort-down'}" style="color:var(--gold-primary);"></i>` : '<i class="fa-solid fa-sort" style="opacity:0.3;"></i>'}`;
    }

    tbody.innerHTML = "";
    
    const buscaVal = (document.getElementById("filtro-vendas-busca").value || "").toLowerCase();
    const tipoVal = document.getElementById("filtro-vendas-tipo").value;
    const revendedoraVal = document.getElementById("filtro-vendas-revendedora").value;
    const periodoVal = document.getElementById("filtro-vendas-periodo").value;
    
    let faturamentoTotal = 0;
    let vendasDiretasTotal = 0;
    let vendasRevendedorasTotal = 0;
    let comissoesTotal = 0;
    
    const hoje = new Date();
    
    const filtradas = this.state.vendasConsolidadas.filter(v => {
      const matchBusca = v.nomeProduto.toLowerCase().includes(buscaVal) || 
                          v.codigoProduto.toLowerCase().includes(buscaVal) ||
                          v.vendedor.toLowerCase().includes(buscaVal);
                          
      const matchTipo = !tipoVal || v.tipo === tipoVal;
      const matchRevendedora = !revendedoraVal || v.usuarioId === revendedoraVal;
      
      let matchPeriodo = true;
      if (periodoVal) {
        const dataVenda = new Date(v.data);
        const diffTempo = Math.abs(hoje - dataVenda);
        const diffDias = Math.ceil(diffTempo / (1000 * 60 * 60 * 24));
        
        if (periodoVal === "hoje") {
          matchPeriodo = dataVenda.toDateString() === hoje.toDateString();
        } else if (periodoVal === "7dias") {
          matchPeriodo = diffDias <= 7;
        } else if (periodoVal === "30dias") {
          matchPeriodo = diffDias <= 30;
        } else if (periodoVal === "mes") {
          matchPeriodo = dataVenda.getMonth() === hoje.getMonth() && dataVenda.getFullYear() === hoje.getFullYear();
        }
      }
      
      return matchBusca && matchTipo && matchRevendedora && matchPeriodo;
    });

    // Lógica de Ordenação de Vendas
    if (ordVendas && ordVendas.coluna) {
      const col = ordVendas.coluna;
      const dir = ordVendas.direcao === 'asc' ? 1 : -1;
      filtradas.sort((a, b) => {
        let valA = a[col];
        let valB = b[col];

        if (col === 'data') {
          return (new Date(valA) - new Date(valB)) * dir;
        }
        if (typeof valA === 'number' && typeof valB === 'number') {
          return (valA - valB) * dir;
        }
        return String(valA).localeCompare(String(valB), 'pt-BR', { sensitivity: 'base' }) * dir;
      });
    }
    
    if (filtradas.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-secondary); padding: 3rem;">Nenhuma venda encontrada com os filtros selecionados.</td></tr>`;
    } else {
      filtradas.forEach(v => {
        faturamentoTotal += v.total;
        if (v.tipo === 'direta') {
          vendasDiretasTotal += v.total;
        } else {
          vendasRevendedorasTotal += v.total;
          comissoesTotal += v.comissao;
        }
        
        const dataStr = new Date(v.data).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
        
        const badgeStyle = v.tipo === 'direta' 
          ? 'background: rgba(212, 175, 55, 0.15); border-color: rgba(212, 175, 55, 0.3); color: var(--gold-light);' 
          : 'background: rgba(100, 181, 246, 0.15); border-color: rgba(100, 181, 246, 0.3); color: #90caf9;';
        const badgeLabel = v.tipo === 'direta' ? 'Direta (Admin)' : 'Revendedora';
        
        const contatoWhatsApp = v.contato !== '—' 
          ? `<a href="https://api.whatsapp.com/send?phone=55${v.contato.replace(/\D/g, '')}" target="_blank" style="color: #81c784; text-decoration: none;"><i class="fa-brands fa-whatsapp"></i> ${v.contato}</a>`
          : '—';
          
        const clienteInfo = v.tipo === 'direta' 
          ? `${v.cliente}<br><small style="color:var(--text-secondary);">${contatoWhatsApp}</small>`
          : `${v.vendedor}<br><small style="color:var(--text-secondary);">${contatoWhatsApp}</small>`;
          
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td style="color: var(--text-secondary); font-size: 0.85rem;">${dataStr}</td>
          <td><span class="badge" style="${badgeStyle}">${badgeLabel}</span></td>
          <td><strong>${v.nomeProduto}</strong><br><span style="font-size:0.78rem;color:var(--text-secondary);">${v.codigoProduto}</span></td>
          <td>${v.quantidade} pçs</td>
          <td>R$ ${v.precoVenda.toFixed(2).replace(".", ",")}</td>
          <td style="color: var(--gold-primary); font-weight: 700;">R$ ${v.total.toFixed(2).replace(".", ",")}</td>
          <td style="color: #81c784; font-weight: 700;">R$ ${v.comissao.toFixed(2).replace(".", ",")}</td>
          <td>${clienteInfo}</td>
        `;
        tbody.appendChild(tr);
      });
    }
    
    document.getElementById("vendas-geral-total").innerText = `R$ ${faturamentoTotal.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
    document.getElementById("vendas-geral-diretas").innerText = `R$ ${vendasDiretasTotal.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
    document.getElementById("vendas-geral-revendedoras").innerText = `R$ ${vendasRevendedorasTotal.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
    document.getElementById("vendas-geral-comissoes").innerText = `R$ ${comissoesTotal.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
  },

  renderizarVendasIndividuaisRevendedora: function() {
    const tbody = document.getElementById("tbody-vendas-individuais-revendedora");
    if (!tbody) return;
    tbody.innerHTML = "";
    
    const revId = this.state.revendedoraSelecionadaId;
    if (!revId) return;
    
    const vendasRev = this.state.vendasConsolidadas.filter(v => v.tipo === 'revendedora' && v.usuarioId === revId);
    
    if (vendasRev.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-secondary); padding: 2rem;">Nenhuma venda registrada para esta revendedora.</td></tr>`;
      return;
    }
    
    vendasRev.forEach(v => {
      const dataStr = new Date(v.data).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td style="color: var(--text-secondary); font-size: 0.85rem;">${dataStr}</td>
        <td><strong>${v.nomeProduto}</strong><br><span style="font-size:0.78rem;color:var(--text-secondary);">${v.codigoProduto}</span></td>
        <td>${v.quantidade} unid.</td>
        <td>R$ ${v.precoVenda.toFixed(2).replace(".", ",")}</td>
        <td style="color: var(--gold-primary); font-weight: 700;">R$ ${v.total.toFixed(2).replace(".", ",")}</td>
        <td style="color: #81c784; font-weight: 700;">R$ ${v.comissao.toFixed(2).replace(".", ",")}</td>
      `;
      tbody.appendChild(tr);
    });
  },

  // ==========================================
  // MÓDULO CONFIGURAÇÕES DO SISTEMA (Admin apenas)
  // ==========================================
  renderizarConfiguracoes: function() {
    const inputNome = document.getElementById("cfg-nome-empresa");
    const inputLogo = document.getElementById("cfg-logo-url");
    const inputCorPrimaria = document.getElementById("cfg-cor-primaria");
    const inputCorPrimariaHex = document.getElementById("cfg-cor-primaria-hex");
    const inputCorSecundaria = document.getElementById("cfg-cor-secundaria");
    const inputCorSecundariaHex = document.getElementById("cfg-cor-secundaria-hex");
    const inputBgPrimary = document.getElementById("cfg-bg-primary");
    const inputBgPrimaryHex = document.getElementById("cfg-bg-primary-hex");
    const inputBgCard = document.getElementById("cfg-bg-card");
    const inputBgCardHex = document.getElementById("cfg-bg-card-hex");
    
    const inputLimiar = document.getElementById("cfg-limiar-critico");
    const inputApi = document.getElementById("cfg-api-url");
    const statusConexao = document.getElementById("cfg-conexao-status");
    const statusModo = document.getElementById("cfg-modo-status");

    if (inputNome) inputNome.value = this.state.nomeEmpresa || "BelKlock Semijoias";
    if (inputLogo) inputLogo.value = this.state.logoUrl || "";
    if (inputCorPrimaria) inputCorPrimaria.value = this.state.corPrimaria || "#d4af37";
    if (inputCorPrimariaHex) inputCorPrimariaHex.value = this.state.corPrimaria || "#d4af37";
    if (inputCorSecundaria) inputCorSecundaria.value = this.state.corSecundaria || "#111111";
    if (inputCorSecundariaHex) inputCorSecundariaHex.value = this.state.corSecundaria || "#111111";
    if (inputBgPrimary) inputBgPrimary.value = this.state.bgPrimary || "#0a0a0a";
    if (inputBgPrimaryHex) inputBgPrimaryHex.value = this.state.bgPrimary || "#0a0a0a";
    if (inputBgCard) inputBgCard.value = this.state.bgCard || "#121212";
    if (inputBgCardHex) inputBgCardHex.value = this.state.bgCard || "#121212";
    
    if (inputLimiar) inputLimiar.value = this.state.limiarEstoqueCritico || 3;
    if (inputApi) inputApi.value = this.state.apiUrl || "http://localhost:5000/api";

    if (statusConexao) {
      if (this.state.token && !this.state.token.startsWith("mock_")) {
        statusConexao.innerText = "Conectado à API (Autenticado)";
        statusConexao.style.color = "#66bb6a";
      } else {
        statusConexao.innerText = "Desconectado (Apenas Local)";
        statusConexao.style.color = "#ef5350";
      }
    }

    if (statusModo) {
      if (this.state.token && !this.state.token.startsWith("mock_")) {
        statusModo.innerText = "Inativo (Operação Real)";
        statusModo.style.color = "#81c784";
      } else {
        statusModo.innerText = "Ativo (Demonstração / Offline)";
        statusModo.style.color = "var(--gold-primary)";
      }
    }
  },

  salvarConfiguracoes: async function() {
    const inputNome = document.getElementById("cfg-nome-empresa").value.trim();
    const inputLogo = document.getElementById("cfg-logo-url").value.trim();
    const inputCorPrimaria = document.getElementById("cfg-cor-primaria").value;
    const inputCorSecundaria = document.getElementById("cfg-cor-secundaria").value;
    const inputBgPrimary = document.getElementById("cfg-bg-primary").value;
    const inputBgCard = document.getElementById("cfg-bg-card").value;
    
    const inputLimiar = parseInt(document.getElementById("cfg-limiar-critico").value) || 3;
    const inputApi = document.getElementById("cfg-api-url").value.trim();

    if (!inputNome) {
      this.toast("O nome da empresa não pode ser vazio.", "warning");
      return;
    }

    const configData = {
      nomeEmpresa: inputNome,
      logoUrl: inputLogo,
      corPrimaria: inputCorPrimaria,
      corSecundaria: inputCorSecundaria,
      bgPrimary: inputBgPrimary,
      bgCard: inputBgCard
    };

    // Salva no backend
    try {
      if (this.state.token && !this.state.token.startsWith("mock_")) {
        await this.requisitarAPI("/config", "PUT", configData);
      }
    } catch (err) {
      console.warn("Erro ao salvar configurações na API:", err.message);
      this.toast("Salvo localmente (Servidor offline/indisponível).", "info");
    }

    // Aplica na interface imediatamente
    this.aplicarConfiguracoes(configData);

    this.state.limiarEstoqueCritico = inputLimiar;
    this.state.apiUrl = inputApi;

    this.salvarDadosNoLocalStorage();
    this.toast("Configurações salvas com sucesso!", "success");

    if (this.state.abaAtiva === "dashboard") {
      this.renderizarDashboard();
    }
  },

  // ==========================================
  // MÓDULO CLIENTES
  // ==========================================

  carregarClientesDaAPI: async function() {
    if (!this.state.token || this.state.token.startsWith("mock_")) return;
    try {
      const clientes = await this.requisitarAPI("/clientes");
      this.state.clientes = clientes || [];
    } catch (err) {
      console.warn("Não foi possível carregar clientes:", err.message);
      this.state.clientes = [];
    }
  },

  renderizarClientes: function() {
    const tbody = document.getElementById("tbody-clientes");
    if (!tbody) return;

    // Configura cabeçalhos de ordenação dinamicamente
    const headers = document.querySelectorAll("#table-clientes thead th");
    const ordClientes = this.state.ordenacao && this.state.ordenacao.clientes;
    if (headers.length >= 5 && ordClientes) {
      headers[0].style.cursor = "pointer";
      headers[0].onclick = () => this.ordenarTabela("clientes", "nome");
      headers[0].innerHTML = `Nome da Cliente ${ordClientes.coluna === 'nome' ? `<i class="fa-solid ${ordClientes.direcao === 'asc' ? 'fa-sort-up' : 'fa-sort-down'}" style="color:var(--gold-primary);"></i>` : '<i class="fa-solid fa-sort" style="opacity:0.3;"></i>'}`;

      headers[1].style.cursor = "pointer";
      headers[1].onclick = () => this.ordenarTabela("clientes", "whatsapp");
      headers[1].innerHTML = `WhatsApp ${ordClientes.coluna === 'whatsapp' ? `<i class="fa-solid ${ordClientes.direcao === 'asc' ? 'fa-sort-up' : 'fa-sort-down'}" style="color:var(--gold-primary);"></i>` : '<i class="fa-solid fa-sort" style="opacity:0.3;"></i>'}`;

      headers[2].style.cursor = "pointer";
      headers[2].onclick = () => this.ordenarTabela("clientes", "dataNascimento");
      headers[2].innerHTML = `Data de Nascimento ${ordClientes.coluna === 'dataNascimento' ? `<i class="fa-solid ${ordClientes.direcao === 'asc' ? 'fa-sort-up' : 'fa-sort-down'}" style="color:var(--gold-primary);"></i>` : '<i class="fa-solid fa-sort" style="opacity:0.3;"></i>'}`;

      headers[4].style.cursor = "pointer";
      headers[4].onclick = () => this.ordenarTabela("clientes", "createdAt");
      headers[4].innerHTML = `Cadastrada em ${ordClientes.coluna === 'createdAt' ? `<i class="fa-solid ${ordClientes.direcao === 'asc' ? 'fa-sort-up' : 'fa-sort-down'}" style="color:var(--gold-primary);"></i>` : '<i class="fa-solid fa-sort" style="opacity:0.3;"></i>'}`;
    }

    const busca = ((document.getElementById("filtro-clientes-busca") || {}).value || "").toLowerCase();

    let filtradas = this.state.clientes.filter(c =>
      c.nome.toLowerCase().includes(busca) || (c.whatsapp || "").toLowerCase().includes(busca)
    );

    // Lógica de Ordenação
    if (ordClientes && ordClientes.coluna) {
      const col = ordClientes.coluna;
      const dir = ordClientes.direcao === 'asc' ? 1 : -1;
      filtradas.sort((a, b) => {
        let valA = a[col] || "";
        let valB = b[col] || "";
        return String(valA).localeCompare(String(valB), 'pt-BR', { sensitivity: 'base' }) * dir;
      });
    }

    tbody.innerHTML = "";
    if (filtradas.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; color: var(--text-secondary); padding: 3rem;">
            <i class="fa-solid fa-address-book" style="font-size: 2rem; opacity: 0.3; display: block; margin-bottom: 0.8rem;"></i>
            ${busca ? "Nenhuma cliente encontrada para a busca." : "Nenhuma cliente cadastrada ainda."}
          </td>
        </tr>`;
      return;
    }

    filtradas.forEach(c => {
      const dataCadastro = new Date(c.createdAt).toLocaleDateString('pt-BR');
      let aniversarioStr = "—";
      if (c.dataNascimento) {
        const partes = c.dataNascimento.split("-");
        if (partes.length === 3) aniversarioStr = `${partes[2]}/${partes[1]}/${partes[0]}`;
        else aniversarioStr = c.dataNascimento;
      }
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><strong>${c.nome}</strong></td>
        <td>
          <a href="https://api.whatsapp.com/send?phone=55${(c.whatsapp || "").replace(/\D/g, '')}" target="_blank" style="color: #81c784; text-decoration: none;">
            <i class="fa-brands fa-whatsapp"></i> ${c.whatsapp || "—"}
          </a>
        </td>
        <td>${aniversarioStr}</td>
        <td style="max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${c.observacoes || "—"}</td>
        <td style="color: var(--text-secondary); font-size: 0.85rem;">${dataCadastro}</td>
        <td>
          <div style="display: flex; gap: 0.4rem;">
            <button class="btn-qty" onclick="app.abrirModalCliente('${c.id}')" title="Editar"><i class="fa-solid fa-pen"></i></button>
            <button class="btn-qty" style="color: #ef9a9a; border-color: rgba(198,40,40,0.1);" onclick="app.excluirCliente('${c.id}')" title="Excluir"><i class="fa-solid fa-trash"></i></button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
  },

  mudarSubAbaClientes: function(subAbaId) {
    this.state.subAbaClientesAtiva = subAbaId;
    
    const btnTodos = document.getElementById("btn-subtab-clientes-todos");
    const btnAniv = document.getElementById("btn-subtab-clientes-aniversariantes");
    
    if (subAbaId === "todos") {
      if (btnTodos) btnTodos.classList.add("active");
      if (btnAniv) btnAniv.classList.remove("active");
      
      const contentTodos = document.getElementById("subtab-clientes-todos-content");
      const contentAniv = document.getElementById("subtab-clientes-aniversariantes-content");
      if (contentTodos) contentTodos.style.display = "block";
      if (contentAniv) contentAniv.style.display = "none";
      
      this.renderizarClientes();
    } else {
      if (btnTodos) btnTodos.classList.remove("active");
      if (btnAniv) btnAniv.classList.add("active");
      
      const contentTodos = document.getElementById("subtab-clientes-todos-content");
      const contentAniv = document.getElementById("subtab-clientes-aniversariantes-content");
      if (contentTodos) contentTodos.style.display = "none";
      if (contentAniv) contentAniv.style.display = "block";
      
      this.renderizarAniversariantes();
    }
  },

  renderizarAniversariantes: function() {
    const tbody = document.getElementById("tbody-aniversariantes");
    if (!tbody) return;

    tbody.innerHTML = "";

    const mesAtual = String(new Date().getMonth() + 1).padStart(2, '0');
    
    const aniversariantes = this.state.clientes.filter(c => {
      if (!c.dataNascimento) return false;
      const partes = c.dataNascimento.split("-");
      if (partes.length === 3) {
        return partes[1] === mesAtual;
      }
      return false;
    });

    if (aniversariantes.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; color: var(--text-secondary); padding: 3rem;">
            Nenhuma cliente fazendo aniversário este mês.
          </td>
        </tr>
      `;
      return;
    }

    aniversariantes.forEach(c => {
      const partes = c.dataNascimento.split("-");
      const aniversarioStr = `${partes[2]}/${partes[1]}`;
      const nomePrimeiro = c.nome.split(" ")[0];
      const mensagem = encodeURIComponent(`Parabéns, ${nomePrimeiro}! 🎉 Que o seu dia seja repleto de amor, paz e muitas alegrias. Nós da BelKlock Semijoias te desejamos um aniversário inesquecível! Como presente de aniversário, temos um cupom especial de 10% de desconto para você usar em nossa coleção este mês. Beijos! ❤️`);
      
      const whatsappLink = `https://api.whatsapp.com/send?phone=55${(c.whatsapp || "").replace(/\D/g, '')}&text=${mensagem}`;
      
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><strong>${c.nome}</strong></td>
        <td>
          <a href="https://api.whatsapp.com/send?phone=55${(c.whatsapp || "").replace(/\D/g, '')}" target="_blank" style="color: #81c784; text-decoration: none;">
            <i class="fa-brands fa-whatsapp"></i> ${c.whatsapp || "—"}
          </a>
        </td>
        <td><i class="fa-solid fa-cake-candles" style="color: var(--gold-primary); margin-right: 5px;"></i> ${aniversarioStr}</td>
        <td style="max-width: 250px; font-size: 0.8rem; color: var(--text-secondary); text-overflow: ellipsis; overflow: hidden; white-space: nowrap;" title="Parabéns, ${nomePrimeiro}!...">
          Parabéns, ${nomePrimeiro}! 🎉 Que o seu dia seja repleto de amor...
        </td>
        <td>
          <a href="${whatsappLink}" target="_blank" class="btn-qty" style="color: #81c784; border-color: rgba(129, 199, 132, 0.2); text-decoration: none; display: inline-flex; align-items: center; justify-content: center; width: auto; padding: 0.4rem 0.8rem; gap: 5px;" title="Enviar parabéns">
            <i class="fa-brands fa-whatsapp"></i> Dar Parabéns
          </a>
        </td>
      `;
      tbody.appendChild(tr);
    });
  },

  abrirModalCliente: function(clienteId) {
    const modal = document.getElementById("modal-cliente");
    const titulo = document.getElementById("modal-cliente-titulo");
    const btnSalvar = document.getElementById("btn-salvar-cliente");

    document.getElementById("cliente-nome").value = "";
    document.getElementById("cliente-whatsapp").value = "";
    document.getElementById("cliente-nascimento").value = "";
    document.getElementById("cliente-observacoes").value = "";
    btnSalvar.removeAttribute("data-edit-id");

    if (clienteId) {
      const c = this.state.clientes.find(x => x.id === clienteId);
      if (c) {
        document.getElementById("cliente-nome").value = c.nome || "";
        document.getElementById("cliente-whatsapp").value = c.whatsapp || "";
        document.getElementById("cliente-nascimento").value = c.dataNascimento || "";
        document.getElementById("cliente-observacoes").value = c.observacoes || "";
        btnSalvar.setAttribute("data-edit-id", clienteId);
        titulo.innerHTML = '<i class="fa-solid fa-address-book"></i> Editar Cliente';
      }
    } else {
      titulo.innerHTML = '<i class="fa-solid fa-address-book"></i> Nova Cliente';
    }

    modal.classList.add("active");
  },

  salvarCliente: async function() {
    const nome = document.getElementById("cliente-nome").value.trim();
    const whatsapp = document.getElementById("cliente-whatsapp").value.trim();
    const dataNascimento = document.getElementById("cliente-nascimento").value || null;
    const observacoes = document.getElementById("cliente-observacoes").value.trim() || null;
    const editId = document.getElementById("btn-salvar-cliente").getAttribute("data-edit-id");

    if (!nome || !whatsapp) {
      this.toast("Por favor, preencha o nome e o WhatsApp da cliente.", "warning");
      return;
    }

    const body = { nome, whatsapp, dataNascimento, observacoes };

    try {
      if (editId) {
        // Editar
        let clienteAtualizado;
        if (this.state.token && !this.state.token.startsWith("mock_")) {
          clienteAtualizado = await this.requisitarAPI(`/clientes/${editId}`, "PUT", body);
        } else {
          clienteAtualizado = { id: editId, ...body, createdAt: new Date().toISOString() };
        }
        const idx = this.state.clientes.findIndex(c => c.id === editId);
        if (idx !== -1) this.state.clientes[idx] = clienteAtualizado;
        this.toast("Cliente atualizada com sucesso!", "success");
      } else {
        // Criar
        let novaCliente;
        if (this.state.token && !this.state.token.startsWith("mock_")) {
          novaCliente = await this.requisitarAPI("/clientes", "POST", body);
        } else {
          novaCliente = { id: 'cli_' + Date.now(), ...body, createdAt: new Date().toISOString() };
        }
        this.state.clientes.push(novaCliente);
        this.toast("Cliente cadastrada com sucesso!", "success");
      }

      document.getElementById("modal-cliente").classList.remove("active");
      this.renderizarClientes();
    } catch (err) {
      console.error(err);
      this.toast("Erro ao salvar cliente: " + err.message, "error");
    }
  },

  excluirCliente: async function(clienteId) {
    if (!await this.confirmar("Deseja realmente excluir esta cliente? O histórico de compras relacionado será mantido.")) return;
    try {
      if (this.state.token && !this.state.token.startsWith("mock_")) {
        await this.requisitarAPI(`/clientes/${clienteId}`, "DELETE");
      }
      this.state.clientes = this.state.clientes.filter(c => c.id !== clienteId);
      this.renderizarClientes();
      this.toast("Cliente removida com sucesso!", "success");
    } catch (err) {
      console.error(err);
      this.toast("Erro ao excluir cliente: " + err.message, "error");
    }
  },

  carregarPreferenciaPagamento: function() {
    const id = this.state.usuarioLogado ? this.state.usuarioLogado.id : "default";
    const prefForma = localStorage.getItem("belklock_pref_pagamento_" + id) || "Pix";
    const prefPix = localStorage.getItem("belklock_pref_pix_" + id) || "";
    
    const selectForma = document.getElementById("pref-forma-pagamento");
    const inputPix = document.getElementById("pref-chave-pix");
    
    if (selectForma) selectForma.value = prefForma;
    if (inputPix) inputPix.value = prefPix;
    
    this.ajustarCamposPreferenciaPagamento();
  },
  
  ajustarCamposPreferenciaPagamento: function() {
    const selectForma = document.getElementById("pref-forma-pagamento");
    const containerPix = document.getElementById("pref-chave-pix-container");
    if (selectForma && containerPix) {
      if (selectForma.value === "Pix") {
        containerPix.style.display = "block";
      } else {
        containerPix.style.display = "none";
      }
    }
  },
  
  salvarPreferenciaPagamento: function() {
    const id = this.state.usuarioLogado ? this.state.usuarioLogado.id : "default";
    const selectForma = document.getElementById("pref-forma-pagamento");
    const inputPix = document.getElementById("pref-chave-pix");
    
    if (selectForma) {
      localStorage.setItem("belklock_pref_pagamento_" + id, selectForma.value);
    }
    if (inputPix) {
      localStorage.setItem("belklock_pref_pix_" + id, inputPix.value.trim());
    }
    
    this.toast("Preferência de pagamento salva com sucesso!", "success");
  },

  checarTermosPendentes: async function() {
    const alerta = document.getElementById("alerta-termo-consignacao-pendente");
    const btnAssinar = document.getElementById("btn-assinar-termo-pendente");
    if (!alerta) return;

    try {
      let termos = [];
      if (this.state.token && !this.state.token.startsWith("mock_")) {
        termos = await this.requisitarAPI("/termos");
        termos = termos.filter(t => t.usuarioId === this.state.usuarioLogado.id && t.status === "PENDENTE");
      } else {
        termos = JSON.parse(localStorage.getItem("belklock_termos_mock") || "[]");
        termos = termos.filter(t => t.usuarioId === (this.state.usuarioLogado ? this.state.usuarioLogado.id : "default") && t.status === "PENDENTE");
      }

      if (termos.length > 0) {
        const termoPendente = termos[0];
        alerta.style.display = "flex";
        if (btnAssinar) {
          btnAssinar.href = `termo_assinatura.html?id=${termoPendente.id}`;
        }
      } else {
        alerta.style.display = "none";
      }
    } catch (e) {
      console.error("Erro ao checar termos pendentes:", e);
    }
  },

  renderizarEstoqueCentral: function() {
    const busca = document.getElementById("busca-estoque-central")?.value.toLowerCase() || "";
    const tbody = document.getElementById("tbody-estoque-central");
    if (!tbody) return;

    let filtrados = this.state.produtos.filter(p => {
      return p.nome.toLowerCase().includes(busca) || p.codigo.toLowerCase().includes(busca);
    });

    if (filtrados.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-secondary); padding: 1.5rem;">Nenhum produto correspondente no estoque central.</td></tr>`;
      return;
    }

    tbody.innerHTML = filtrados.map(p => `
      <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
        <td style="padding: 12px; font-weight: bold; color: var(--gold-light);">${p.codigo}</td>
        <td style="padding: 12px;">${p.nome}</td>
        <td style="padding: 12px;">${p.categoria || "Geral"}</td>
        <td style="padding: 12px; font-weight: bold;">R$ ${Number(p.precoVenda || 0).toFixed(2).replace(".", ",")}</td>
        <td style="padding: 12px;">${p.quantidade || 0} pçs</td>
      </tr>
    `).join("");
  },

  carregarEstoqueCentral: async function() {
    this.renderizarEstoqueCentral();
  },

  carregarLinksPagamento: async function() {
    const select = document.getElementById("link-cliente-id");
    if (select) {
      select.innerHTML = '<option value="">Selecione um cliente...</option>' + 
        this.state.clientes.map(c => `<option value="${c.id}">${c.nome}</option>`).join("");
    }

    const tbody = document.getElementById("tbody-links-pagamento");
    if (!tbody) return;

    try {
      let links = [];
      if (this.state.token && !this.state.token.startsWith("mock_")) {
        links = await this.requisitarAPI("/pagamentos/links");
      } else {
        links = JSON.parse(localStorage.getItem("belklock_links_pagamento_mock") || "[]");
        const revId = this.state.usuarioLogado ? this.state.usuarioLogado.id : "default";
        links = links.filter(l => l.usuarioId === revId);
      }

      if (links.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-secondary); padding: 1.5rem;">Nenhum link de pagamento gerado ainda.</td></tr>`;
      } else {
        tbody.innerHTML = links.map(l => {
          const statusCor = l.status === "PENDENTE" ? "var(--warning)" : "#81c784";
          const statusTxt = l.status === "PENDENTE" ? "Pendente" : "Compensado";
          
          let acoes = "";
          if (l.status === "PENDENTE") {
            const urlCheckout = `pagamento.html?id=${l.id}`;
            acoes = `
              <button class="btn-qty" style="color: var(--gold-primary);" onclick="navigator.clipboard.writeText('${window.location.origin}/${urlCheckout}').then(() => alert('Link de checkout copiado!'));" title="Copiar Link de Pagamento">
                <i class="fa-solid fa-copy"></i> Copiar
              </button>
              <a href="${urlCheckout}" target="_blank" class="btn-qty" style="color: var(--gold-light); text-decoration: none;" title="Abrir Checkout Externo">
                <i class="fa-solid fa-up-right-from-square"></i> Abrir
              </a>
            `;
          } else {
            acoes = `<span style="font-size: 0.8rem; color: var(--text-muted);"><i class="fa-solid fa-circle-check"></i> Pago</span>`;
          }

          return `
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
              <td style="padding: 12px; font-size: 0.8rem;">${new Date(l.createdAt).toLocaleDateString('pt-BR')}</td>
              <td style="padding: 12px; font-weight: bold;">${l.clienteNome}</td>
              <td style="padding: 12px; font-weight: bold;">R$ ${Number(l.valor).toFixed(2).replace(".", ",")}</td>
              <td style="padding: 12px; font-size: 0.85rem; color: var(--gold-light);">${l.forma}</td>
              <td style="padding: 12px; color: ${statusCor}; font-weight: 600;">${statusTxt}</td>
              <td style="padding: 12px; display: flex; gap: 0.5rem;">${acoes}</td>
            </tr>
          `;
        }).join("");
      }
    } catch (error) {
      console.error(error);
    }
  },

  gerarLinkPagamento: async function() {
    const clienteId = document.getElementById("link-cliente-id").value;
    const valor = Number(document.getElementById("link-valor").value);
    const forma = document.getElementById("link-forma").value;
    const descricao = document.getElementById("link-descricao").value.trim();

    if (!clienteId || !valor || valor <= 0) {
      this.toast("Selecione o cliente e informe um valor de cobrança válido.", "warning");
      return;
    }

    const cliente = this.state.clientes.find(c => c.id === clienteId);
    const clienteNome = cliente ? cliente.nome : "Cliente Avulso";

    try {
      if (this.state.token && !this.state.token.startsWith("mock_")) {
        await this.requisitarAPI("/pagamentos/link", "POST", {
          clienteId,
          valor,
          forma,
          descricao
        });
      } else {
        let mockLinks = JSON.parse(localStorage.getItem("belklock_links_pagamento_mock") || "[]");
        mockLinks.push({
          id: `link-${Date.now()}`,
          usuarioId: this.state.usuarioLogado ? this.state.usuarioLogado.id : "default",
          clienteId,
          clienteNome,
          valor,
          forma,
          descricao,
          status: "PENDENTE",
          createdAt: new Date().toISOString()
        });
        localStorage.setItem("belklock_links_pagamento_mock", JSON.stringify(mockLinks));
      }

      this.toast("Link de pagamento gerado com sucesso!", "success");
      document.getElementById("link-valor").value = "";
      document.getElementById("link-descricao").value = "";
      this.carregarLinksPagamento();
    } catch (e) {
      this.toast("Erro ao gerar link de pagamento: " + e.message, "error");
    }
  },

  carregarTreinamentosVendedora: async function() {
    const container = document.getElementById("treinamento-cards-container");
    if (!container) return;

    try {
      let lista = [];
      if (this.state.token && !this.state.token.startsWith("mock_")) {
        lista = await this.requisitarAPI("/treinamentos");
      } else {
        lista = JSON.parse(localStorage.getItem("belklock_treinamentos_mock") || "[]");
      }

      if (lista.length === 0) {
        container.innerHTML = `
          <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; background: rgba(0,0,0,0.2); border-radius: var(--radius-md); color: var(--text-secondary);">
            <i class="fa-solid fa-graduation-cap" style="font-size: 2.5rem; color: var(--gold-light); margin-bottom: 1rem; opacity: 0.3;"></i>
            <p>Nenhum conteúdo de treinamento ou manual foi cadastrado pela administração ainda.</p>
          </div>
        `;
        return;
      }

      container.innerHTML = lista.map(t => {
        let previewHtml = "";
        if (t.tipo === "VIDEO") {
          let videoId = "";
          if (t.url.includes("youtube.com/watch?v=")) {
            videoId = t.url.split("v=")[1]?.split("&")[0];
          } else if (t.url.includes("youtu.be/")) {
            videoId = t.url.split("youtu.be/")[1]?.split("?")[0];
          } else if (t.url.includes("embed/")) {
            videoId = t.url.split("embed/")[1]?.split("?")[0];
          }

          if (videoId) {
            previewHtml = `
              <div style="position: relative; width: 100%; padding-bottom: 56.25%; height: 0; overflow: hidden; border-radius: var(--radius-sm); margin-bottom: 1rem;">
                <iframe src="https://www.youtube.com/embed/${videoId}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: 0;" allowfullscreen></iframe>
              </div>
            `;
          } else {
            previewHtml = `
              <div style="background: #151515; height: 150px; display: flex; align-items: center; justify-content: center; border-radius: var(--radius-sm); margin-bottom: 1rem;">
                <a href="${t.url}" target="_blank" style="color: var(--gold-primary); text-decoration: none; display: flex; flex-direction: column; align-items: center; gap: 8px;">
                  <i class="fa-solid fa-circle-play" style="font-size: 2.5rem;"></i>
                  <span>Abrir Vídeo Externo</span>
                </a>
              </div>
            `;
          }
        } else {
          previewHtml = `
            <div style="background: rgba(212,175,55,0.05); height: 150px; display: flex; flex-direction: column; align-items: center; justify-content: center; border-radius: var(--radius-sm); margin-bottom: 1rem; border: 1px dashed rgba(212,175,55,0.2);">
              <i class="fa-solid fa-file-pdf" style="font-size: 3rem; color: #ff8a80; margin-bottom: 0.8rem;"></i>
              <a href="${t.url}" target="_blank" class="btn-outline-gold" style="padding: 0.35rem 0.8rem; font-size: 0.8rem; text-decoration: none;"><i class="fa-solid fa-download"></i> Baixar Manual PDF</a>
            </div>
          `;
        }

        return `
          <div class="dashboard-panel" style="display: flex; flex-direction: column; justify-content: space-between; border: 1px solid rgba(255,255,255,0.05);">
            <div>
              ${previewHtml}
              <h3 style="font-family: var(--font-title); font-size: 1.05rem; color: var(--gold-light); margin-bottom: 0.4rem;">${t.titulo}</h3>
              <p style="font-size: 0.82rem; color: var(--text-secondary); line-height: 1.4; margin-bottom: 1rem;">${t.descricao || "Instruções e dicas essenciais BelKlock."}</p>
            </div>
            <div style="border-top: 1px solid rgba(255,255,255,0.05); padding-top: 0.8rem; font-size: 0.72rem; color: var(--text-muted); display: flex; justify-content: space-between; align-items: center;">
              <span>TIPO: <strong>${t.tipo}</strong></span>
              <a href="${t.url}" target="_blank" style="color: var(--gold-primary);"><i class="fa-solid fa-arrow-up-right-from-square"></i> Link Completo</a>
            </div>
          </div>
        `;
      }).join("");
    } catch (e) {
      console.error(e);
    }
  }

};

// Funções auxiliares para manipulação de cores HEX e aplicação de tema visual white-label
function aplicarTemaLoja(tema) {
  if (!tema) return;
  if (tema.corPrimaria) {
    document.documentElement.style.setProperty('--gold-primary', tema.corPrimaria);
    document.documentElement.style.setProperty('--gold-light', alterarBrilhoHex(tema.corPrimaria, 30));
    document.documentElement.style.setProperty('--gold-dark', alterarBrilhoHex(tema.corPrimaria, -30));
    document.documentElement.style.setProperty('--gold-gradient', `linear-gradient(135deg, ${alterarBrilhoHex(tema.corPrimaria, -30)} 0%, ${tema.corPrimaria} 40%, ${alterarBrilhoHex(tema.corPrimaria, 30)} 75%, ${alterarBrilhoHex(tema.corPrimaria, -30)} 100%)`);
    document.documentElement.style.setProperty('--gold-translucent', hexToRgbA(tema.corPrimaria, 0.15));
    document.documentElement.style.setProperty('--gold-translucent-hover', hexToRgbA(tema.corPrimaria, 0.25));
    document.documentElement.style.setProperty('--border-gold', `1px solid ${hexToRgbA(tema.corPrimaria, 0.2)}`);
    document.documentElement.style.setProperty('--border-gold-focus', `1px solid ${hexToRgbA(tema.corPrimaria, 0.7)}`);
    
    document.documentElement.style.setProperty('--shadow-premium', `0 10px 30px rgba(0, 0, 0, 0.7), 0 0 15px ${hexToRgbA(tema.corPrimaria, 0.05)}`);
    document.documentElement.style.setProperty('--shadow-glow', `0 0 15px ${hexToRgbA(tema.corPrimaria, 0.25)}`);
  }
  
  if (tema.bgPrimary) {
    document.documentElement.style.setProperty('--bg-primary', tema.bgPrimary);
    document.documentElement.style.setProperty('--bg-absolute', alterarBrilhoHex(tema.bgPrimary, -10));
  }
  
  if (tema.bgCard) {
    document.documentElement.style.setProperty('--bg-card', tema.bgCard);
    document.documentElement.style.setProperty('--bg-card-hover', alterarBrilhoHex(tema.bgCard, 10));
    document.documentElement.style.setProperty('--bg-modal', alterarBrilhoHex(tema.bgCard, 5));
  }
}

function alterarBrilhoHex(hex, percent) {
  let num = parseInt(hex.replace("#",""), 16),
  amt = Math.round(2.55 * percent),
  R = (num >> 16) + amt,
  G = (num >> 8 & 0x00FF) + amt,
  B = (num & 0x0000FF) + amt;
  return "#" + (0x1000000 + (R<255?R<0?0:R:255)*0x10000 + (G<255?G<0?0:G:255)*0x100 + (B<255?B<0?0:B:255)).toString(16).slice(1);
}

function hexToRgbA(hex, alpha){
  let c;
  if(/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)){
    c= hex.substring(1).split('');
    if(c.length== 3){
      c= [c[0], c[0], c[1], c[1], c[2], c[2]];
    }
    c= '0x' + c.join('');
    return 'rgba('+[(c>>16)&255, (c>>8)&255, c&255].join(',')+','+alpha+')';
  }
  return hex;
}

// Inicializa a aplicação ao carregar a página
window.addEventListener("DOMContentLoaded", () => {
  app.init();
});
