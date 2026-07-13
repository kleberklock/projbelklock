/**
 * Conecta Joias - Core Application Logic
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
    nomeEmpresa: "Conecta Joias",
    logoUrl: "",
    corPrimaria: "#d4af37",
    corSecundaria: "#111111",
    bgPrimary: "#0a0a0a",
    bgCard: "#121212",
    revendedoraSelecionadaId: null,
    usandoFicticio: true,
    dreImposto: 0.0,
    dreDespesaFixa: 0.0,
    dreCmvEstimado: 33.0,
    colunasEstoque: ["Código", "Nome do Produto", "Categoria", "Estoque Central", "Custo Bruto", "Custo Banho", "Custo Oper.", "Markup", "Preço Venda"],
    vendasSessao: [], // Vendas registradas pela revendedora nesta sessão
    notificacoes: [],
    pollingNotificacoesInterval: null,
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

  // 2. Inicialização do Aplicativo (Perfil Administrador)
  init: function() {
    this.carregarDadosDoLocalStorage(); // Inicializa dados locais se necessário
    
    const token = localStorage.getItem("conectajoias_token");
    const usuarioJson = localStorage.getItem("conectajoias_usuario");
    
    if (!token || !usuarioJson) {
      this.fazerLogout();
      return;
    }
    
    try {
      const usuario = JSON.parse(usuarioJson);
      const roleUpper = (usuario.role || "").toUpperCase();
      
      // Permitir apenas Manager na página superadmin.html
      if (roleUpper === 'MANAGER') {
        this.state.token = token;
        this.state.usuarioLogado = usuario;
        this.exibirInterfacePosLogin();
        this.carregarDadosIniciais();
      } else if (roleUpper === 'SUPERADMIN') {
        window.location.href = "saasadmin.html";
      } else if (roleUpper === 'CONSULTANT') {
        window.location.href = "manager.html";
      } else {
        console.warn("Role desconhecida ou inválida:", usuario.role);
        this.fazerLogout();
      }
    } catch (e) {
      console.error("Erro na inicialização do Admin:", e);
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
      localStorage.setItem("conectajoias_token", data.token);
      localStorage.setItem("conectajoias_usuario", JSON.stringify(data.usuario));

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
        if ((email === "superadmin@plataforma.com" || email === "0001") && senha === "admin0001") {
          console.warn("Servidor Azure API offline. Iniciando em Modo de Demonstração (SuperAdmin local).");
          this.state.token = "mock_superadmin_token_" + Date.now();
          this.state.usuarioLogado = {
            id: "superadmin_local",
            nome: "Super Admin Local",
            email: "superadmin@plataforma.com",
            pin: "0001",
            role: "SuperAdmin",
            comissao: 0.0
          };
          localStorage.setItem("conectajoias_token", this.state.token);
          localStorage.setItem("conectajoias_usuario", JSON.stringify(this.state.usuarioLogado));
          
          this.exibirInterfacePosLogin();
          this.carregarDadosIniciais();
          this.toast("Aviso: Servidor local offline. Iniciando em Modo de Demonstração (Perfil Administrador do Sistema).", "warning");
          return;
        } else if ((email === "admin@conectajoias.com" || email === "0002") && senha === "conectajoias") {
          console.warn("Servidor Azure API offline. Iniciando em Modo de Demonstração (Gestora local).");
          this.state.token = "mock_admin_token_" + Date.now();
          this.state.usuarioLogado = {
            id: "admin_local",
            nome: "Admin Local",
            email: "admin@conectajoias.com",
            pin: "0002",
            role: "Manager",
            comissao: 0.0
          };
          localStorage.setItem("conectajoias_token", this.state.token);
          localStorage.setItem("conectajoias_usuario", JSON.stringify(this.state.usuarioLogado));
          
          this.exibirInterfacePosLogin();
          this.carregarDadosIniciais();
          this.toast("Aviso: Servidor local offline. Iniciando em Modo de Demonstração (Perfil Gestora).", "warning");
          return;
        } else {
          // Permite logar localmente em Modo de Demonstração se o PIN e senha inseridos forem válidos
          const revLocal = this.state.revendedoras.find(r => r.pin === email || r.email === email);
          if (revLocal) {
            console.warn("Servidor Azure API offline. Iniciando em Modo de Demonstração (Consultora local).");
            this.state.token = "mock_rev_token_" + Date.now();
            this.state.usuarioLogado = {
              id: revLocal.id,
              nome: revLocal.nome,
              email: revLocal.email || (revLocal.pin + "@loja.com"),
              pin: revLocal.pin,
              role: "Consultant",
              comissao: revLocal.comissao
            };
            localStorage.setItem("conectajoias_token", this.state.token);
            localStorage.setItem("conectajoias_usuario", JSON.stringify(this.state.usuarioLogado));
            
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
    if (this.state.pollingNotificacoesInterval) {
      clearInterval(this.state.pollingNotificacoesInterval);
      this.state.pollingNotificacoesInterval = null;
    }
    this.state.token = null;
    this.state.usuarioLogado = null;
    localStorage.removeItem("conectajoias_token");
    localStorage.removeItem("conectajoias_usuario");
    window.location.href = "index.html";
  },

  exibirInterfaceLogin: function() {
    window.location.href = "index.html";
  },

  exibirInterfacePosLogin: function() {
    // Atualiza o título da marca
    const mainH1 = document.getElementById("main-h1");
    if (mainH1) mainH1.innerText = this.state.nomeEmpresa || "Conecta Joias";

    this.atualizarInfoUsuarioSidebar();
    this.aplicarRestricoesPerfil();
  },

  carregarConfiguracaoAPI: async function() {
    try {
      const lojaId = localStorage.getItem("conectajoias_loja_id") || "default-loja";
      const response = await fetch(`${this.state.apiUrl}/config`, {
        headers: { "x-loja-id": lojaId }
      });
      if (response.ok) {
        const config = await response.json();
        this.aplicarConfiguracoes(config);
        
        // Se o onboarding não estiver completo, abre o wizard do onboarding
        if (config.onboardingCompleto === false) {
          this.abrirOnboardingWizard();
        }
        return;
      }
    } catch (error) {
      console.warn("Não foi possível buscar as configurações do servidor. Usando fallback local.", error);
    }
    // Fallback local do state / localStorage
    const configLocal = {
      nomeEmpresa: this.state.nomeEmpresa || "Conecta Joias",
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
    localStorage.setItem("conectajoias_nome_empresa", config.nomeEmpresa);
    localStorage.setItem("conectajoias_logo_url", config.logoUrl || "");
    localStorage.setItem("conectajoias_cor_primaria", config.corPrimaria);
    localStorage.setItem("conectajoias_cor_secundaria", config.corSecundaria);
    localStorage.setItem("conectajoias_bg_primary", config.bgPrimary);
    localStorage.setItem("conectajoias_bg_card", config.bgCard);

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
        if (config.nomeEmpresa && config.nomeEmpresa !== "Conecta Joias" && config.nomeEmpresa !== "") {
          logoBrand.style.display = "none";
          if (brandTextSpan) {
            brandTextSpan.innerText = config.nomeEmpresa;
            brandTextSpan.style.display = "block";
          }
        } else {
          logoBrand.src = "assets/logo.svg";
          logoBrand.alt = "Conecta Joias";
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
    
    // Atualizar o placeholder do input de configurações se ele existir
    const inputNome = document.getElementById("cfg-nome-empresa");
    if (inputNome) inputNome.placeholder = config.nomeEmpresa;

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
      
      // Mapeia os roles para labels amigáveis
      const roleLabels = {
        'SuperAdmin': 'Administrador do Sistema',
        'Manager': 'Gestora',
        'Consultant': 'Consultora',
        // Compatibilidade com roles antigos (fallback offline)
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
    const isAdmin = ['Manager', 'SuperAdmin', 'ADMIN_LOJA', 'SUPER_ADMIN', 'admin'].includes(role);
    const isSuperAdmin = ['SuperAdmin', 'SUPER_ADMIN'].includes(role);
    
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
    const btnCriarNovaLoja = document.getElementById("btn-criar-nova-loja");
 
    if (!isAdmin) {
      // Consultant: oculta todos os menus administrativos
      if (menuPlanilhas) menuPlanilhas.style.display = "none";
      if (menuRevendedoras) menuRevendedoras.style.display = "none";
      if (menuEstoque) menuEstoque.style.display = "none";
      if (menuMarketing) menuMarketing.style.display = "none";
      if (menuDashboard) menuDashboard.style.display = "none";
      if (menuVendasGeral) menuVendasGeral.style.display = "none";
      if (menuClientes) menuClientes.style.display = "none";
      if (menuConfiguracoes) menuConfiguracoes.style.display = "none";
      if (btnCadastrarProduto) btnCadastrarProduto.style.display = "none";
      if (divHeaderActions) divHeaderActions.style.display = "none";
      if (menuMinhaMaleta) menuMinhaMaleta.style.display = "block";
      if (btnCriarNovaLoja) btnCriarNovaLoja.style.display = "none";
      this.state.abaAtiva = "minha-maleta";
    } else {
      // Manager ou SuperAdmin: exibe menus administrativos
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
      // Botão 'Criar Nova Loja' só visível para SuperAdmin
      if (btnCriarNovaLoja) btnCriarNovaLoja.style.display = isSuperAdmin ? "inline-flex" : "none";
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
    
    const role = this.state.usuarioLogado ? this.state.usuarioLogado.role : 'Consultant';
    const isAdmin = ['Manager', 'SuperAdmin', 'ADMIN_LOJA', 'SUPER_ADMIN', 'admin'].includes(role);

    if (isAdmin) {
      await this.carregarRevendedorasDaAPI();
      await this.carregarClientesDaAPI();
      await this.carregarVendasConsolidadas();
      this.renderizarAbas();
      this.renderizarEstoque();
      this.renderizarRevendedoras();
      this.renderizarDashboard();
      this.renderizarMarketing();
      this.renderizarClientes();
      
      // Inicia o polling de notificações de novas vendas
      this.inicializarPollingNotificacoes();
    } else {
      // Revendedora: carrega maleta e navega direto para Minha Maleta
      await this.carregarMaletaPropriaDaAPI();
      await this.carregarVendasRevendedora();
      this.aplicarRestricoesPerfil();
      this.renderizarAbas();
      this.renderizarMinhaMaleta();
      // Atualiza boas-vindas com nome
      const el = document.getElementById("maleta-boas-vindas");
      if (el) el.innerText = `Olá, ${this.state.usuarioLogado.nome.split(' ')[0]}! 💎`;
    }
    
    console.log("Conecta Joias inicializado com sucesso!");
  },

  // ==========================================
  // COMUNICAÇÃO COM A API DA AZURE (HTTP / JWT)
  // ==========================================

  requisitarAPI: async function(endpoint, metodo = "GET", body = null) {
    const lojaId = localStorage.getItem("conectajoias_loja_id") || "default-loja";
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
      const maleta = await this.requisitarAPI("/revendedoras/minha-maleta");
      this.state.revendedoras = [{
        id: this.state.usuarioLogado.id,
        nome: this.state.usuarioLogado.nome,
        whatsapp: this.state.usuarioLogado.whatsapp || "",
        comissao: this.state.usuarioLogado.comissao,
        consignado: maleta
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
      const localVendasKey = `conectajoias_vendas_${this.state.usuarioLogado.id}`;
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

    // Renderiza tabela de histórico de vendas
    this.renderizarHistoricoVendasRev();
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
      opt.textContent = `${item.nome} (${item.quantidadeConsignada} unid. — R$ ${Number(item.precoVenda||0).toFixed(2).replace(".",",")})`;
      opt.setAttribute("data-preco", item.precoVenda);
      opt.setAttribute("data-max", item.quantidadeConsignada);
      select.appendChild(opt);
    });

    // Reseta campos
    const qtdInput = document.getElementById("venda-rev-qtd");
    if (qtdInput) { qtdInput.value = 1; qtdInput.max = 99; }
    const preview = document.getElementById("venda-rev-preview");
    if (preview) preview.style.display = "none";
    const aviso = document.getElementById("venda-rev-aviso");
    if (aviso) aviso.style.display = "none";

    // Mostra percentual de comissão
    const pct = document.getElementById("prev-venda-comissao-pct");
    if (pct) pct.innerText = this.state.usuarioLogado ? this.state.usuarioLogado.comissao : 30;

    document.getElementById("modal-venda-rev").classList.add("active");
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

    const total = preco * Math.min(qtd, max);
    const comissaoValor = total * (comissao / 100);

    document.getElementById("prev-venda-nome").innerText = selectedOpt.textContent.split(" (")[0];
    document.getElementById("prev-venda-qtd").innerText = `${Math.min(qtd, max)} unid.`;
    document.getElementById("prev-venda-preco-unit").innerText = `R$ ${preco.toFixed(2).replace(".", ",")}`;
    document.getElementById("prev-venda-total").innerText = `R$ ${total.toFixed(2).replace(".", ",")}`;
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

        const comissaoValor = item.precoVenda * quantidade * ((this.state.usuarioLogado.comissao || 30) / 100);
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
          precoVenda: item.precoVenda,
          comissaoValor: comissaoValor
        };

        resp = {
          venda: novaVenda,
          resumo: {
            nomeProduto: item.nome,
            quantidade,
            totalVenda: item.precoVenda * quantidade,
            comissaoValor,
            qtdRestanteNaMaleta: novaQtd
          }
        };

        // Salva estado local no LocalStorage
        this.salvarDadosNoLocalStorage();

        // Adiciona à lista de vendas da sessão no LocalStorage
        const localVendasKey = `conectajoias_vendas_${this.state.usuarioLogado.id}`;
        const vendasLocais = JSON.parse(localStorage.getItem(localVendasKey) || "[]");
        vendasLocais.unshift(novaVenda);
        localStorage.setItem(localVendasKey, JSON.stringify(vendasLocais));
      } else {
        resp = await this.requisitarAPI("/vendas-revendedora", "POST", { produtoId, quantidade });

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

      // Adiciona à lista de vendas da sessão
      this.state.vendasSessao.unshift(resp.venda);

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
      const produtosSalvos = localStorage.getItem("conectajoias_produtos");
      const revendedorasSalvas = localStorage.getItem("conectajoias_revendedoras");
      const feedSalvo = localStorage.getItem("conectajoias_feed");
      const ficticioSalvo = localStorage.getItem("conectajoias_usando_ficticio");
      const colunasSalvas = localStorage.getItem("conectajoias_colunas");
      const limiarSalvo = localStorage.getItem("conectajoias_limiar_critico");
      const nomeEmpresaSalvo = localStorage.getItem("conectajoias_nome_empresa");
      const logoUrlSalvo = localStorage.getItem("conectajoias_logo_url");
      const corPrimariaSalva = localStorage.getItem("conectajoias_cor_primaria");
      const corSecundariaSalva = localStorage.getItem("conectajoias_cor_secundaria");
      const bgPrimarySalvo = localStorage.getItem("conectajoias_bg_primary");
      const bgCardSalvo = localStorage.getItem("conectajoias_bg_card");
      const apiUrlSalva = localStorage.getItem("conectajoias_api_url");

      this.state.usandoFicticio = ficticioSalvo ? JSON.parse(ficticioSalvo) : true;
      this.state.colunasEstoque = colunasSalvas ? JSON.parse(colunasSalvas) : ["Código", "Nome do Produto", "Categoria", "Estoque Central", "Custo Bruto", "Custo Banho", "Custo Oper.", "Markup", "Preço Venda"];
      this.state.limiarEstoqueCritico = limiarSalvo ? parseInt(limiarSalvo) : 3;
      this.state.nomeEmpresa = nomeEmpresaSalvo ? nomeEmpresaSalvo : "Conecta Joias";
      this.state.logoUrl = logoUrlSalvo || "";
      this.state.corPrimaria = corPrimariaSalva || "#d4af37";
      this.state.corSecundaria = corSecundariaSalva || "#111111";
      this.state.bgPrimary = bgPrimarySalvo || "#0a0a0a";
      this.state.bgCard = bgCardSalvo || "#121212";
      if (apiUrlSalva) {
        this.state.apiUrl = apiUrlSalva;
      }

      const impostoSalvo = localStorage.getItem("conectajoias_dre_imposto");
      const despesaSalva = localStorage.getItem("conectajoias_dre_despesa_fixa");
      const cmvSalvo = localStorage.getItem("conectajoias_dre_cmv_estimado");
      this.state.dreImposto = impostoSalvo ? parseFloat(impostoSalvo) : 0.0;
      this.state.dreDespesaFixa = despesaSalva ? parseFloat(despesaSalva) : 0.0;
      this.state.dreCmvEstimado = cmvSalvo ? parseFloat(cmvSalvo) : 33.0;

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

      // Aplicar o tema carregado localmente imediatamente para evitar flashes de cores padrões
      aplicarTemaLoja({
        corPrimaria: this.state.corPrimaria,
        corSecundaria: this.state.corSecundaria,
        bgPrimary: this.state.bgPrimary,
        bgCard: this.state.bgCard
      });
    } catch (e) {
      console.error("Erro ao carregar dados do LocalStorage, inicializando vazios.", e);
      this.state.produtos = [];
      this.state.revendedoras = [];
      this.state.feedImagens = [];
      this.state.usandoFicticio = true;
    }
  },

  salvarDadosNoLocalStorage: function() {
    localStorage.setItem("conectajoias_produtos", JSON.stringify(this.state.produtos));
    localStorage.setItem("conectajoias_revendedoras", JSON.stringify(this.state.revendedoras));
    localStorage.setItem("conectajoias_feed", JSON.stringify(this.state.feedImagens));
    localStorage.setItem("conectajoias_usando_ficticio", JSON.stringify(this.state.usandoFicticio));
    localStorage.setItem("conectajoias_colunas", JSON.stringify(this.state.colunasEstoque));
    localStorage.setItem("conectajoias_limiar_critico", this.state.limiarEstoqueCritico || 3);
    localStorage.setItem("conectajoias_nome_empresa", this.state.nomeEmpresa || "Conecta Joias");
    localStorage.setItem("conectajoias_logo_url", this.state.logoUrl || "");
    localStorage.setItem("conectajoias_cor_primaria", this.state.corPrimaria || "#d4af37");
    localStorage.setItem("conectajoias_cor_secundaria", this.state.corSecundaria || "#111111");
    localStorage.setItem("conectajoias_bg_primary", this.state.bgPrimary || "#0a0a0a");
    localStorage.setItem("conectajoias_bg_card", this.state.bgCard || "#121212");
    localStorage.setItem("conectajoias_api_url", this.state.apiUrl || "http://localhost:5000/api");
    localStorage.setItem("conectajoias_dre_imposto", this.state.dreImposto);
    localStorage.setItem("conectajoias_dre_despesa_fixa", this.state.dreDespesaFixa);
    localStorage.setItem("conectajoias_dre_cmv_estimado", this.state.dreCmvEstimado);
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
    // Botão de Logout na Sidebar
    const btnLogout = document.getElementById("btn-logout");
    if (btnLogout) {
      btnLogout.addEventListener("click", () => this.fazerLogout());
    }

    // Cliques na navegação da Sidebar
    document.querySelectorAll(".nav-item").forEach(item => {
      item.addEventListener("click", () => {
        const target = item.getAttribute("data-target");
        this.navegarParaAba(target);
      });
    });

    // Filtros de busca no estoque
    const filtroBusca = document.getElementById("filtro-busca");
    const filtroCategoria = document.getElementById("filtro-categoria");
    const filtroStatus = document.getElementById("filtro-status");
    
    if (filtroBusca) filtroBusca.addEventListener("input", () => this.renderizarEstoque());
    if (filtroCategoria) filtroCategoria.addEventListener("change", () => this.renderizarEstoque());
    if (filtroStatus) filtroStatus.addEventListener("change", () => this.renderizarEstoque());

    // Botões rápidos do Dashboard
    document.getElementById("btn-quick-sale").addEventListener("click", () => this.abrirModalVendaRapida());
    document.getElementById("btn-view-all-stock").addEventListener("click", () => this.abrirModalTodosAlertas());

    // Eventos de Input da Calculadora no Modal de Produto
    const inputsPrecificacao = ["prod-bruto", "prod-banho", "prod-liquido", "prod-markup"];
    inputsPrecificacao.forEach(id => {
      document.getElementById(id).addEventListener("input", () => this.calcularPrecificacaoDinamicamente());
    });

    // Modais e seus gatilhos
    this.configurarModal("modal-produto", "btn-open-modal-produto", "btn-close-modal-produto", "btn-cancelar-produto");
    this.configurarModal("modal-revendedora", "btn-open-modal-revendedora", "btn-close-modal-revendedora", "btn-cancelar-revendedora");
    this.configurarModal("modal-consignar", "btn-open-modal-consignar", "btn-close-modal-consignar", "btn-cancelar-consignar");
    this.configurarModal("modal-acerto", "btn-open-modal-acerto", "btn-close-modal-acerto", "btn-cancelar-acerto");
    this.configurarModal("modal-venda-rapida", null, "btn-close-modal-venda-rapida", "btn-cancelar-venda-rapida");
    this.configurarModal("modal-todos-alertas", null, "btn-close-modal-todos-alertas", "btn-fechar-todos-alertas");
    this.configurarModal("modal-notificacoes", "notification-bell-container", "btn-close-modal-notificacoes", "btn-fechar-notificacoes");

    // Sincronização e eventos bidirecionais de Cores nas configurações
    const syncColor = (colorId, hexId) => {
      const colorInput = document.getElementById(colorId);
      const hexInput = document.getElementById(hexId);
      if (colorInput && hexInput) {
        colorInput.addEventListener("input", (e) => {
          hexInput.value = e.target.value;
        });
        hexInput.addEventListener("input", (e) => {
          let val = e.target.value.trim();
          if (/^#[0-9A-F]{6}$/i.test(val)) {
            colorInput.value = val;
          }
        });
      }
    };
    syncColor("cfg-cor-primaria", "cfg-cor-primaria-hex");
    syncColor("cfg-cor-secundaria", "cfg-cor-secundaria-hex");
    syncColor("cfg-bg-primary", "cfg-bg-primary-hex");
    syncColor("cfg-bg-card", "cfg-bg-card-hex");

    // Modal de Venda Direta da Administradora
    const addListenerSafe = (id, event, callback) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener(event, callback);
    };
    addListenerSafe("btn-open-modal-venda-admin", "click", () => this.abrirModalVendaAdmin());
    addListenerSafe("btn-close-modal-venda-admin", "click", () => {
      const m = document.getElementById("modal-venda-admin");
      if (m) m.classList.remove("active");
    });
    addListenerSafe("btn-cancelar-venda-admin", "click", () => {
      const m = document.getElementById("modal-venda-admin");
      if (m) m.classList.remove("active");
    });
    addListenerSafe("btn-confirmar-venda-admin", "click", () => this.confirmarVendaAdmin());


    // Salvar Produto
    document.getElementById("btn-salvar-produto").addEventListener("click", () => this.salvarNovoProduto());

    // Salvar Revendedora
    document.getElementById("btn-salvar-revendedora").addEventListener("click", () => this.salvarNovaRevendedora());

    // Adicionar Faixa de Comissão na UI
    const btnAddFaixaUi = document.getElementById("btn-add-faixa-ui");
    if (btnAddFaixaUi) {
      btnAddFaixaUi.addEventListener("click", () => this.adicionarFaixaLinha());
    }

    // Consignar Peças (Confirmar envio)
    document.getElementById("btn-confirmar-consignar").addEventListener("click", () => this.processarConsignacao());

    // Excluir Revendedora
    document.getElementById("btn-excluir-revendedora").addEventListener("click", () => this.excluirRevendedoraSelecionada());

    // Editar Revendedora
    document.getElementById("btn-editar-revendedora").addEventListener("click", () => this.editarRevendedoraSelecionada());

    // Fechamento de acertos
    document.getElementById("btn-salvar-acerto-apenas").addEventListener("click", () => this.finalizarAcerto(false));
    document.getElementById("btn-finalizar-acerto-whats").addEventListener("click", () => this.finalizarAcerto(true));
    document.getElementById("btn-finalizar-acerto-excel").addEventListener("click", () => this.exportarExcelAcerto());

    // Notificações
    const btnMarcarLidas = document.getElementById("btn-marcar-todas-lidas");
    if (btnMarcarLidas) {
      btnMarcarLidas.addEventListener("click", () => this.marcarTodasNotificacoesComoLidas());
    }

    // Excel
    document.getElementById("btn-exportar-estoque").addEventListener("click", () => ExcelHandler.exportarEstoque(this.state.produtos, this.state.colunasEstoque));
    document.getElementById("btn-trigger-import-file").addEventListener("click", () => document.getElementById("input-import-excel").click());
    document.getElementById("input-import-excel").addEventListener("change", (e) => this.processarImportacaoExcel(e));
    document.getElementById("btn-limpar-ficticios").addEventListener("click", () => this.zerarDadosDemonstracao());
    document.getElementById("btn-excluir-todos-produtos").addEventListener("click", () => this.excluirTodosOsProdutos());


    // Upload do Instagram Feed
    document.getElementById("zone-upload-feed").addEventListener("click", () => document.getElementById("input-upload-feed").click());
    document.getElementById("input-upload-feed").addEventListener("change", (e) => this.processarUploadFeed(e));
    document.getElementById("btn-clear-feed").addEventListener("click", () => this.reiniciarFeedPadrao());

    // WhatsApp Mask
    const revWhatsApp = document.getElementById("rev-whatsapp");
    if(revWhatsApp) revWhatsApp.addEventListener("input", (e) => this.aplicarMascaraWhatsApp(e.target));
    const vrWhatsApp = document.getElementById("vr-whatsapp");
    if(vrWhatsApp) vrWhatsApp.addEventListener("input", (e) => this.aplicarMascaraWhatsApp(e.target));

    // Backup Geral JSON Export/Import
    document.getElementById("btn-backup-exportar").addEventListener("click", () => this.exportarBackupGeralJSON());
    document.getElementById("btn-backup-importar").addEventListener("click", () => document.getElementById("input-backup-json").click());
    document.getElementById("input-backup-json").addEventListener("change", (e) => this.importarBackupGeralJSON(e));

    // WhatsApp Venda Rápida (Confirmar)
    document.getElementById("btn-enviar-venda-rapida").addEventListener("click", () => this.processarVendaRapidaWhats());

    // Modal de Clientes
    this.configurarModal("modal-cliente", "btn-open-modal-cliente", "btn-close-modal-cliente", "btn-cancelar-cliente");
    document.getElementById("btn-salvar-cliente").addEventListener("click", () => this.salvarCliente());
    const clienteWhatsInput = document.getElementById("cliente-whatsapp");
    if (clienteWhatsInput) clienteWhatsInput.addEventListener("input", (e) => this.aplicarMascaraWhatsApp(e.target));

    // WhatsApp Mask no Venda Rápida (novo campo)
    const vrClienteWhats = document.getElementById("vr-cliente-whatsapp");
    if (vrClienteWhats) vrClienteWhats.addEventListener("input", (e) => this.aplicarMascaraWhatsApp(e.target));
    
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

    // Wizard de Onboarding
    const btnWzNext = document.getElementById("btn-wizard-next");
    const btnWzPrev = document.getElementById("btn-wizard-prev");
    if (btnWzNext) {
      btnWzNext.addEventListener("click", () => this.avancarWizard());
    }
    if (btnWzPrev) {
      btnWzPrev.addEventListener("click", () => this.voltarWizard());
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
      if (modalId === "modal-notificacoes") {
        this.renderizarNotificacoes();
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
  navegacaoListenersConfigurada: false,
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
    if (tabId === "notas-fiscais") {
      this.carregarNotasFiscais();
    }
    if (tabId === "central-whatsapp") {
      this.carregarCentralWhatsApp();
    }
    if (tabId === "admin-treinamentos") {
      this.carregarTreinamentosAdmin();
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
    
    // Ordenação dos produtos em alerta crítico: menor quantidade primeiro (críticos no topo)
    produtosCriticos.sort((a, b) => Number(a.quantidade || 0) - Number(b.quantidade || 0));

    // Controla o botão "Ver Mais" baseado na quantidade de produtos em alerta
    const btnVerMais = document.getElementById("btn-view-all-stock");
    if (btnVerMais) {
      btnVerMais.style.display = produtosCriticos.length > 5 ? "inline-flex" : "none";
    }

    // Exibe apenas os primeiros 5 produtos no painel do Dashboard
    const produtosCriticosExibidos = produtosCriticos.slice(0, 5);

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
      produtosCriticosExibidos.forEach(p => {
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

    // Atualiza cards de Vendas Diretas da Administradora
    if (typeof this.obterMetricasVendasAdmin === 'function') {
      const metricas = this.obterMetricasVendasAdmin();
      const elHoje = document.getElementById("val-vendas-diretas-hoje");
      const elQtdHoje = document.getElementById("val-qtd-vendas-diretas-hoje");
      const elMes = document.getElementById("val-vendas-diretas-mes");
      const elQtdMes = document.getElementById("val-qtd-vendas-diretas-mes");
      if (elHoje) elHoje.innerText = `R$ ${metricas.totalHoje.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
      if (elQtdHoje) elQtdHoje.innerText = metricas.qtdHoje;
      if (elMes) elMes.innerText = `R$ ${metricas.totalMes.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
      if (elQtdMes) elQtdMes.innerText = metricas.qtdMes;
    }

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

  abrirModalTodosAlertas: function() {
    const tableTodosBody = document.querySelector("#table-todos-alertas tbody");
    if (!tableTodosBody) return;
    
    tableTodosBody.innerHTML = "";
    
    const produtosCriticos = this.state.produtos.filter(p => Number(p.quantidade || 0) <= (this.state.limiarEstoqueCritico || 3));
    
    // Ordenação dos produtos em alerta crítico: menor quantidade primeiro
    produtosCriticos.sort((a, b) => Number(a.quantidade || 0) - Number(b.quantidade || 0));

    if (produtosCriticos.length === 0) {
      tableTodosBody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; color: var(--text-secondary); padding: 2rem;">
            Nenhum produto crítico em estoque.
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
        tableTodosBody.appendChild(tr);
      });
    }

    const modal = document.getElementById("modal-todos-alertas");
    if (modal) {
      modal.classList.add("active");
    }
  },

  carregarDRE: async function() {
    const inputInicio = document.getElementById("dre-data-inicio");
    const inputFim = document.getElementById("dre-data-fim");
    if (!inputInicio || !inputFim) return;

    const inicio = inputInicio.value;
    const fim = inputFim.value;

    if (this.state.token && !this.state.token.startsWith("mock_")) {
      try {
        const dados = await this.requisitarAPI(`/relatorios/dre?inicio=${inicio}&fim=${fim}&cmvEstimado=${this.state.dreCmvEstimado}`);
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

    const faturamentoVendasDiretas = numProdutos * 15 * (diasDiferenca / 30) * 50; 
    const custoVendasDiretas = faturamentoVendasDiretas * (this.state.dreCmvEstimado / 100);
    
    const faturamentoAcertos = numRev * 250 * (diasDiferenca / 30);
    const comissoesPagas = faturamentoAcertos * 0.3;
    const descontoPerdas = numRev * 15 * (diasDiferenca / 30);
    const custoVendasConsignado = faturamentoAcertos * (this.state.dreCmvEstimado / 100);

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
    const impostosEl = document.getElementById("dre-impostos");
    const recLiquidaEl = document.getElementById("dre-receita-liquida");
    const cmvEl = document.getElementById("dre-cmv");
    const custoDiretasEl = document.getElementById("dre-custo-diretas");
    const custoConsignadoEl = document.getElementById("dre-custo-consignado");
    const despesasFixasEl = document.getElementById("dre-despesas-fixas");
    
    const valorImposto = resumo.faturamentoBrutoTotal * (this.state.dreImposto / 100);
    const valorDespesasFixas = this.state.dreDespesaFixa;

    if (fatBrutoEl) fatBrutoEl.innerText = formatar(resumo.faturamentoBrutoTotal);
    if (fatDiretasEl) fatDiretasEl.innerText = formatar(resumo.faturamentoVendasDiretas);
    if (fatConsignadoEl) fatConsignadoEl.innerText = formatar(resumo.faturamentoAcertos);
    
    if (comissoesEl) comissoesEl.innerText = `(-) ${formatar(resumo.comissoesPagas)}`;
    if (perdasEl) perdasEl.innerText = `(+) ${formatar(resumo.descontoPerdas)}`;
    if (impostosEl) impostosEl.innerText = `(-) ${formatar(valorImposto)}`;
    
    const receitaLiquida = resumo.faturamentoBrutoTotal - resumo.comissoesPagas + resumo.descontoPerdas - valorImposto;
    if (recLiquidaEl) recLiquidaEl.innerText = formatar(receitaLiquida);
    
    if (cmvEl) cmvEl.innerText = `(-) ${formatar(resumo.custoTotalMercadorias)}`;
    if (custoDiretasEl) custoDiretasEl.innerText = formatar(resumo.custoVendasDiretas);
    if (custoConsignadoEl) custoConsignadoEl.innerText = formatar(resumo.custoVendasConsignado);
    
    if (despesasFixasEl) despesasFixasEl.innerText = `(-) ${formatar(valorDespesasFixas)}`;

    const lucro = receitaLiquida - resumo.custoTotalMercadorias - valorDespesasFixas;
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
          Conecta Joias
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

  adicionarFaixaLinha: function(valorMin = 0, valorMax = 0, percentual = 0) {
    const container = document.getElementById("rev-faixas-container");
    if (!container) return;

    // Remove o aviso de "vazio" se existir
    const vazio = document.getElementById("rev-faixas-vazio");
    if (vazio) vazio.remove();

    const row = document.createElement("div");
    row.className = "rev-faixa-row";
    row.style = "display: grid; grid-template-columns: 1fr auto 1fr auto 70px auto auto; gap: 6px; align-items: center; margin-bottom: 8px; background: rgba(255, 255, 255, 0.02); padding: 6px; border-radius: 4px; border: 1px solid #222; transition: all 0.2s ease;";
    row.innerHTML = `
      <div style="position: relative; display: flex; align-items: center;">
        <span style="position: absolute; left: 8px; color: #666; font-size: 0.8rem; font-weight: 600;">R$</span>
        <input type="number" class="form-control faixa-min" placeholder="Mínimo" value="${valorMin}" style="width: 100%; padding: 4px 8px 4px 24px; font-size: 0.85rem; border-color: #333;" min="0">
      </div>
      <span style="color: #666; font-size: 0.8rem;">a</span>
      <div style="position: relative; display: flex; align-items: center;">
        <span style="position: absolute; left: 8px; color: #666; font-size: 0.8rem; font-weight: 600;">R$</span>
        <input type="number" class="form-control faixa-max" placeholder="Máximo" value="${valorMax}" style="width: 100%; padding: 4px 8px 4px 24px; font-size: 0.85rem; border-color: #333;" min="0">
      </div>
      <span style="color: #666; font-size: 0.8rem;">=</span>
      <input type="number" class="form-control faixa-pct" placeholder="%" value="${percentual}" style="width: 100%; padding: 4px 8px; font-size: 0.85rem; text-align: center; border-color: #333;" min="0" max="100">
      <span style="color: #666; font-size: 0.85rem; font-weight: 600;">%</span>
      <button type="button" class="btn-delete-faixa" style="background: rgba(239, 83, 80, 0.1); color: #ff8a80; border: 1px solid rgba(239, 83, 80, 0.25); border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1); margin: 0;" title="Remover faixa">
        <i class="fa-solid fa-trash-can" style="font-size: 0.85rem;"></i>
      </button>
    `;

    // Hover effects and delete
    const deleteBtn = row.querySelector(".btn-delete-faixa");
    deleteBtn.addEventListener("mouseover", () => {
      deleteBtn.style.background = "#ef5350";
      deleteBtn.style.color = "#ffffff";
      deleteBtn.style.borderColor = "#ef5350";
      deleteBtn.style.boxShadow = "0 0 10px rgba(239, 83, 80, 0.5)";
      deleteBtn.style.transform = "scale(1.08)";
    });
    deleteBtn.addEventListener("mouseout", () => {
      deleteBtn.style.background = "rgba(239, 83, 80, 0.1)";
      deleteBtn.style.color = "#ff8a80";
      deleteBtn.style.borderColor = "rgba(239, 83, 80, 0.25)";
      deleteBtn.style.boxShadow = "none";
      deleteBtn.style.transform = "scale(1)";
    });

    deleteBtn.addEventListener("click", () => {
      row.style.opacity = "0";
      row.style.transform = "scale(0.9)";
      setTimeout(() => {
        row.remove();
        if (container.querySelectorAll(".rev-faixa-row").length === 0) {
          container.innerHTML = `
            <div style="color: #888; font-size: 0.9rem; text-align: center; padding: 10px;" id="rev-faixas-vazio">
              Nenhuma faixa cadastrada. Usará a comissão padrão acima.
            </div>
          `;
        }
      }, 200);
    });

    // Animação de entrada
    row.style.opacity = "0";
    row.style.transform = "translateY(5px)";
    container.appendChild(row);
    setTimeout(() => {
      row.style.opacity = "1";
      row.style.transform = "translateY(0)";
    }, 50);
  },

  obterFaixasComissaoDaUI: function() {
    const rows = document.querySelectorAll(".rev-faixa-row");
    const faixas = [];
    rows.forEach(row => {
      const valorMin = parseFloat(row.querySelector(".faixa-min").value) || 0;
      const valorMax = parseFloat(row.querySelector(".faixa-max").value) || 0;
      const percentual = parseFloat(row.querySelector(".faixa-pct").value) || 0;
      faixas.push({ valorMin, valorMax, percentual });
    });
    return faixas;
  },

  atualizarProgressaoComissaoUI: function(faturamentoBruto, rev) {
    const card = document.getElementById("acerto-progressao-card");
    const statusText = document.getElementById("acerto-proxima-faixa-status");
    const progressBar = document.getElementById("acerto-progressao-barra");
    const infoText = document.getElementById("acerto-progressao-info");

    if (!card) return;

    // Se a revendedora não tiver faixas de comissão, esconde o card
    if (!rev.faixasComissao || rev.faixasComissao.length === 0) {
      card.style.display = "none";
      return;
    }

    card.style.display = "block";

    // Ordena as faixas por valor mínimo
    const faixas = [...rev.faixasComissao].sort((a, b) => a.valorMin - b.valorMin);

    // Encontra a faixa atual
    let faixaAtualIdx = -1;
    for (let i = 0; i < faixas.length; i++) {
      if (faturamentoBruto >= faixas[i].valorMin && faturamentoBruto <= faixas[i].valorMax) {
        faixaAtualIdx = i;
        break;
      }
    }

    // Se o faturamento for maior que a última faixa, a faixa atual é a última
    if (faixaAtualIdx === -1 && faturamentoBruto > faixas[faixas.length - 1].valorMax) {
      faixaAtualIdx = faixas.length - 1;
    }

    // Se o faturamento for menor que a primeira faixa
    if (faixaAtualIdx === -1 && faturamentoBruto < faixas[0].valorMin) {
      faixaAtualIdx = -1; // Sem faixa ativa ainda (usa fallback)
    }

    const faixaAtual = faixaAtualIdx !== -1 ? faixas[faixaAtualIdx] : null;
    const proximaFaixa = faixaAtualIdx + 1 < faixas.length ? faixas[faixaAtualIdx + 1] : null;

    const percentualAtual = faixaAtual ? faixaAtual.percentual : rev.comissao;
    statusText.innerText = `Faixa Atual: ${percentualAtual}%`;

    if (proximaFaixa) {
      // Calcula o progresso dentro da faixa atual rumo à próxima
      const minFaixaParaProgresso = faixaAtual ? faixaAtual.valorMin : 0;
      const maxFaixaParaProgresso = proximaFaixa.valorMin; // A próxima faixa começa no valorMin dela
      
      const faixaSpan = maxFaixaParaProgresso - minFaixaParaProgresso;
      const progressoFaturamento = faturamentoBruto - minFaixaParaProgresso;
      
      let pctProgresso = (progressoFaturamento / faixaSpan) * 100;
      pctProgresso = Math.max(0, Math.min(100, pctProgresso));

      progressBar.style.width = `${pctProgresso}%`;
      
      const faltamParaProxima = maxFaixaParaProgresso - faturamentoBruto;
      infoText.innerHTML = `Faltam <strong style="color: var(--gold-primary);">R$ ${faltamParaProxima.toFixed(2).replace(".", ",")}</strong> em vendas para atingir a faixa de <strong>${proximaFaixa.percentual}%</strong>!`;
    } else {
      // Última faixa atingida! Progresso em 100%
      progressBar.style.width = "100%";
      infoText.innerHTML = `<strong style="color: #81c784;"><i class="fa-solid fa-crown"></i> Faixa Máxima Atingida (${percentualAtual}%)!</strong> Excelente volume de vendas!`;
    }
  },

  ajustarCamposComissaoRev: function() {
    const tipo = document.getElementById("rev-tipo-comissao").value;
    const groupComissaoPadrao = document.getElementById("group-rev-comissao-padrao");
    const groupMetaUnica = document.getElementById("group-rev-meta-unica");
    const groupFaixas = document.getElementById("group-rev-faixas");

    if (tipo === "FIXA") {
      if (groupComissaoPadrao) groupComissaoPadrao.style.display = "block";
      if (groupMetaUnica) groupMetaUnica.style.display = "none";
      if (groupFaixas) groupFaixas.style.display = "none";
    } else if (tipo === "PROGRESSIVA") {
      if (groupComissaoPadrao) groupComissaoPadrao.style.display = "none";
      if (groupMetaUnica) groupMetaUnica.style.display = "none";
      if (groupFaixas) groupFaixas.style.display = "block";
    } else if (tipo === "META_UNICA") {
      if (groupComissaoPadrao) groupComissaoPadrao.style.display = "block";
      if (groupMetaUnica) groupMetaUnica.style.display = "flex";
      if (groupFaixas) groupFaixas.style.display = "none";
    }
  },

  ajustarLabelsMetaRev: function() {
    const tipoBonus = document.getElementById("rev-meta-bonus-tipo").value;
    const labelBonus = document.getElementById("lbl-rev-meta-bonus");

    if (labelBonus) {
      if (tipoBonus === "PERCENTUAL") {
        labelBonus.innerHTML = "Bônus da Meta (%) *";
      } else {
        labelBonus.innerHTML = "Bônus da Meta (R$) *";
      }
    }
  },

  ajustarCamposPerdaRev: function() {
    const regra = document.getElementById("rev-regra-perda").value;
    const groupLimiteIsencao = document.getElementById("group-rev-limite-isencao");

    if (groupLimiteIsencao) {
      if (regra === "ISENTO") {
        groupLimiteIsencao.style.display = "block";
      } else {
        groupLimiteIsencao.style.display = "none";
      }
    }
  },

  limparFormRevendedora: function() {
    document.getElementById("rev-nome").value = "";
    document.getElementById("rev-whatsapp").value = "";
    document.getElementById("rev-comissao").value = "30";
    document.getElementById("rev-senha").value = "";
    document.getElementById("rev-senha").setAttribute("required", "true");
    const labelSenha = document.querySelector("#group-rev-senha label");
    if (labelSenha) labelSenha.innerText = "Senha de Acesso *";
    const inputSenha = document.getElementById("rev-senha");
    if (inputSenha) inputSenha.placeholder = "Defina a senha de acesso";
    const helpSenha = document.querySelector("#group-rev-senha p");
    if (helpSenha) helpSenha.innerText = "Senha para a revendedora acessar o portal dela.";
    document.getElementById("group-rev-senha").style.display = "block";

    // Novos campos
    document.getElementById("rev-tipo-comissao").value = "FIXA";
    document.getElementById("rev-meta-valor").value = "5000";
    document.getElementById("rev-meta-bonus-tipo").value = "PERCENTUAL";
    document.getElementById("rev-meta-bonus").value = "5";
    document.getElementById("rev-base-calculo").value = "BRUTO";
    document.getElementById("rev-regra-perda").value = "VALOR_VENDA";
    document.getElementById("rev-limite-isencao").value = "1";
    document.getElementById("rev-periodo-acumulo").value = "MANUAL";

    this.ajustarCamposComissaoRev();
    this.ajustarLabelsMetaRev();
    this.ajustarCamposPerdaRev();

    // Limpa faixas
    const container = document.getElementById("rev-faixas-container");
    if (container) {
      container.innerHTML = `
        <div style="color: #888; font-size: 0.9rem; text-align: center; padding: 10px;" id="rev-faixas-vazio">
          Nenhuma faixa cadastrada. Usará a comissão padrão.
        </div>
      `;
    }

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
      document.getElementById("rev-nome").value = rev.nome || "";
      document.getElementById("rev-whatsapp").value = rev.whatsapp || "";
      document.getElementById("rev-comissao").value = rev.comissao || 30;
      
      document.getElementById("rev-senha").value = "";
      document.getElementById("rev-senha").removeAttribute("required");
      const labelSenha = document.querySelector("#group-rev-senha label");
      if (labelSenha) labelSenha.innerText = "Nova Senha (Opcional)";
      const inputSenha = document.getElementById("rev-senha");
      if (inputSenha) inputSenha.placeholder = "Deixe em branco para não alterar";
      const helpSenha = document.querySelector("#group-rev-senha p");
      if (helpSenha) helpSenha.innerText = "Deixe em branco para manter a senha atual.";
      document.getElementById("group-rev-senha").style.display = "block";

      // Popula novos campos
      document.getElementById("rev-tipo-comissao").value = rev.tipoComissao || "FIXA";
      document.getElementById("rev-meta-valor").value = rev.metaUnicaValor || 5000;
      document.getElementById("rev-meta-bonus-tipo").value = rev.metaUnicaTipoBonus || "PERCENTUAL";
      document.getElementById("rev-meta-bonus").value = rev.metaUnicaBonus || 5;
      document.getElementById("rev-base-calculo").value = rev.baseCalculo || "BRUTO";
      document.getElementById("rev-regra-perda").value = rev.regraPerda || "VALOR_VENDA";
      document.getElementById("rev-limite-isencao").value = rev.limiteIsencaoPerda || 1;
      document.getElementById("rev-periodo-acumulo").value = rev.periodoAcumulo || "MANUAL";

      this.ajustarCamposComissaoRev();
      this.ajustarLabelsMetaRev();
      this.ajustarCamposPerdaRev();

      // Preenche faixas
      const container = document.getElementById("rev-faixas-container");
      if (container) {
        container.innerHTML = "";
        if (rev.faixasComissao && rev.faixasComissao.length > 0) {
          rev.faixasComissao.forEach(f => {
            this.adicionarFaixaLinha(f.valorMin, f.valorMax, f.percentual);
          });
        } else {
          container.innerHTML = `
            <div style="color: #888; font-size: 0.9rem; text-align: center; padding: 10px;" id="rev-faixas-vazio">
              Nenhuma faixa cadastrada. Usará a comissão padrão.
            </div>
          `;
        }
      }

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
    const faixasComissao = this.obterFaixasComissaoDaUI();
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

    // Novos campos adicionados
    const tipoComissao = document.getElementById("rev-tipo-comissao").value;
    const metaUnicaValor = parseFloat(document.getElementById("rev-meta-valor").value) || 0;
    const metaUnicaTipoBonus = document.getElementById("rev-meta-bonus-tipo").value;
    const metaUnicaBonus = parseFloat(document.getElementById("rev-meta-bonus").value) || 0;
    const baseCalculo = document.getElementById("rev-base-calculo").value;
    const regraPerda = document.getElementById("rev-regra-perda").value;
    const limiteIsencaoPerda = parseInt(document.getElementById("rev-limite-isencao").value) || 0;
    const periodoAcumulo = document.getElementById("rev-periodo-acumulo").value;

    try {
      if (editId) {
        // Envia atualização para a API Azure se autenticado
        if (this.state.token) {
          await this.requisitarAPI(`/revendedoras/${editId}`, "PUT", { 
            nome, 
            whatsapp, 
            comissao, 
            faixasComissao,
            tipoComissao,
            metaUnicaValor,
            metaUnicaBonus,
            metaUnicaTipoBonus,
            baseCalculo,
            regraPerda,
            limiteIsencaoPerda,
            periodoAcumulo,
            senha: senhaInput
          });
        }
        
        // Atualização no estado local
        const rev = this.state.revendedoras.find(r => r.id === editId);
        if (rev) {
          rev.nome = nome;
          rev.whatsapp = whatsapp;
          rev.comissao = comissao;
          rev.faixasComissao = faixasComissao;
          rev.tipoComissao = tipoComissao;
          rev.metaUnicaValor = metaUnicaValor;
          rev.metaUnicaBonus = metaUnicaBonus;
          rev.metaUnicaTipoBonus = metaUnicaTipoBonus;
          rev.baseCalculo = baseCalculo;
          rev.regraPerda = regraPerda;
          rev.limiteIsencaoPerda = limiteIsencaoPerda;
          rev.periodoAcumulo = periodoAcumulo;
        }
      } else {
        let novaRev;
        const emailTemporario = nome.toLowerCase().replace(/\s+/g, '') + "_" + Math.floor(Math.random() * 1000) + "@conectajoias.com";

        // Cria na API Azure se autenticado
        if (this.state.token) {
          const res = await this.requisitarAPI("/auth/register", "POST", {
            nome,
            email: emailTemporario,
            senha: senhaInput,
            role: "VENDEDORA",
            whatsapp,
            comissao,
            faixasComissao,
            tipoComissao,
            metaUnicaValor,
            metaUnicaBonus,
            metaUnicaTipoBonus,
            baseCalculo,
            regraPerda,
            limiteIsencaoPerda,
            periodoAcumulo
          });
          novaRev = {
            id: res.usuario.id,
            nome,
            whatsapp,
            comissao,
            faixasComissao: res.usuario.faixasComissao || faixasComissao,
            tipoComissao: res.usuario.tipoComissao || tipoComissao,
            metaUnicaValor: res.usuario.metaUnicaValor || metaUnicaValor,
            metaUnicaBonus: res.usuario.metaUnicaBonus || metaUnicaBonus,
            metaUnicaTipoBonus: res.usuario.metaUnicaTipoBonus || metaUnicaTipoBonus,
            baseCalculo: res.usuario.baseCalculo || baseCalculo,
            regraPerda: res.usuario.regraPerda || regraPerda,
            limiteIsencaoPerda: res.usuario.limiteIsencaoPerda || limiteIsencaoPerda,
            periodoAcumulo: res.usuario.periodoAcumulo || periodoAcumulo,
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
            faixasComissao,
            tipoComissao,
            metaUnicaValor,
            metaUnicaBonus,
            metaUnicaTipoBonus,
            baseCalculo,
            regraPerda,
            limiteIsencaoPerda,
            periodoAcumulo,
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
        try {
          if (this.state.token && !this.state.token.startsWith("mock_")) {
            await this.requisitarAPI(`/revendedoras/${rev.id}`, "DELETE");
          }

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
          this.toast("Revendedora excluída com sucesso!", "success");
        } catch (error) {
          console.error(error);
          this.toast("Erro ao excluir revendedora: " + error.message, "error");
        }
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
  buscarVendasPendentesAcerto: async function(revendedoraId) {
    const offlineMode = this.state.token && this.state.token.startsWith("mock_");
    if (offlineMode) {
      const localVendasKey = `conectajoias_vendas_${revendedoraId}`;
      const vendas = JSON.parse(localStorage.getItem(localVendasKey) || "[]");
      const rev = this.state.revendedoras.find(r => r.id === revendedoraId);
      const ultimoAcerto = rev.historico && rev.historico.length > 0 ? rev.historico[rev.historico.length - 1] : null;
      if (ultimoAcerto) {
        const dataUltimoAcerto = new Date(ultimoAcerto.data);
        return vendas.filter(v => new Date(v.data) > dataUltimoAcerto);
      }
      return vendas;
    }
    
    try {
      const vendas = await this.requisitarAPI(`/vendas-revendedora?usuarioId=${revendedoraId}&apenasPendentes=true`);
      return vendas;
    } catch (err) {
      console.warn("Erro ao buscar vendas pendentes:", err);
      return [];
    }
  },

  renderizarTabelaPreencherAcerto: async function() {
    const rev = this.state.revendedoras.find(r => r.id === this.state.revendedoraSelecionadaId);
    if (!rev) return;

    document.getElementById("acerto-nome-revendedora").innerText = rev.nome;
    document.getElementById("acerto-comissao-percent").innerText = rev.comissao;

    // Busca preferências da revendedora
    const prefPagamento = localStorage.getItem(`conectajoias_pref_pagamento_${rev.id}`) || "Pix";
    const prefPix = localStorage.getItem(`conectajoias_pref_pix_${rev.id}`) || "";
    
    // Atualiza o dropdown no modal de acerto com a preferência da revendedora
    const selectForma = document.getElementById("acerto-forma-pagamento");
    if (selectForma) {
      selectForma.value = prefPagamento;
    }

    // Exibe nota de sugestão da revendedora
    const elInfoPref = document.getElementById("acerto-pref-info-revendedora");
    if (elInfoPref) {
      if (prefPix) {
        elInfoPref.innerHTML = `<i class="fa-solid fa-credit-card"></i> Preferência da Revendedora: <strong>${prefPagamento}</strong><br><i class="fa-solid fa-key" style="margin-top: 3px;"></i> Chave Pix informada: <code>${prefPix}</code>`;
        elInfoPref.style.display = "block";
      } else {
        elInfoPref.innerHTML = `<i class="fa-solid fa-credit-card"></i> Preferência da Revendedora: <strong>${prefPagamento}</strong>`;
        elInfoPref.style.display = "block";
      }
    }

    const tbody = document.querySelector("#table-preencher-acerto tbody");
    tbody.innerHTML = "";

    if (!rev.consignado || rev.consignado.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; color: var(--text-secondary); padding: 2rem;">
            Nenhuma peça consignada para acertar.
          </td>
        </tr>
      `;
      this.calcularResumoFechamentoAcerto();
      return;
    }

    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-secondary); padding: 2rem;"><i class="fa-solid fa-spinner fa-spin"></i> Buscando vendas pendentes da revendedora...</td></tr>`;

    // Carrega vendas pendentes
    const vendasPendentes = await this.buscarVendasPendentesAcerto(rev.id);
    const mapaVendas = new Map();
    vendasPendentes.forEach(v => {
      mapaVendas.set(v.produtoId, (mapaVendas.get(v.produtoId) || 0) + v.quantidade);
    });

    tbody.innerHTML = "";

    rev.consignado.forEach(item => {
      const tr = document.createElement("tr");
      tr.id = `acerto-row-${item.produtoId}`;
      
      const qtdVendidaSugerida = Math.min(mapaVendas.get(item.produtoId) || 0, item.quantidadeConsignada);
      const qtdDevolvidaSugerida = item.quantidadeConsignada - qtdVendidaSugerida;

      tr.innerHTML = `
        <td>
          <div style="display: flex; flex-direction: column;">
            <strong style="font-size: 0.95rem; color: #fff;">${item.codigo}</strong>
            <span class="prod-name-cell" style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 1px;">${item.nome}</span>
            <div class="acerto-badges-container" id="badges-${item.produtoId}" style="display: flex; gap: 5px; margin-top: 5px; flex-wrap: wrap;"></div>
          </div>
        </td>
        <td style="color: #eee; font-weight: 500;">R$ ${Number(item.precoVenda).toFixed(2).replace(".", ",")}</td>
        <td>
          <span style="background: rgba(212, 175, 55, 0.08); color: var(--gold-primary); border: 1px solid rgba(212, 175, 55, 0.15); padding: 4px 10px; border-radius: 20px; font-weight: 600; font-size: 0.8rem; display: inline-block;">
            ${item.quantidadeConsignada} pçs
          </span>
        </td>
        <td>
          <div class="acerto-input-wrapper" style="display: flex; align-items: center; justify-content: center; gap: 2px; background: rgba(255,255,255,0.02); border: 1px solid #333; border-radius: 6px; padding: 2px; width: 100px; margin: 0 auto;">
            <button type="button" class="btn-input-adjust" onclick="app.ajustarQtdAcerto(this, -1, 'vendido', ${item.quantidadeConsignada})" style="background: transparent; border: none; color: #888; cursor: pointer; padding: 4px 6px; font-size: 0.75rem;"><i class="fa-solid fa-minus"></i></button>
            <input type="number" class="input-acerto-vendido"
                   data-prod-id="${item.produtoId}"
                   value="${qtdVendidaSugerida}" min="0" max="${item.quantidadeConsignada}"
                   oninput="app.sincronizarAcertoQuantidades(this, 'vendido')"
                   style="width: 32px; text-align: center; font-weight: 700; border: none; background: transparent; color: var(--text-primary); font-size: 0.85rem; outline: none; padding: 0;">
            <button type="button" class="btn-input-adjust" onclick="app.ajustarQtdAcerto(this, 1, 'vendido', ${item.quantidadeConsignada})" style="background: transparent; border: none; color: #888; cursor: pointer; padding: 4px 6px; font-size: 0.75rem;"><i class="fa-solid fa-plus"></i></button>
          </div>
          ${qtdVendidaSugerida > 0 ? `<div style="font-size: 0.65rem; color: #81c784; text-align: center; margin-top: 4px;"><i class="fa-solid fa-check"></i> ${qtdVendidaSugerida} no app</div>` : ''}
        </td>
        <td>
          <div style="text-align: center;">
            <span class="badge-dev" id="dev-badge-${item.produtoId}" style="background: rgba(255,255,255,0.04); color: #999; border: 1px solid rgba(255,255,255,0.08); padding: 4px 12px; border-radius: 20px; font-weight: 600; font-size: 0.8rem; display: inline-block;">
              ${qtdDevolvidaSugerida} pçs
            </span>
            <!-- Input oculto para compatibilidade -->
            <input type="number" class="input-acerto-devolvido" data-prod-id="${item.produtoId}" value="${qtdDevolvidaSugerida}" style="display: none;">
          </div>
        </td>
        <td>
          <div style="text-align: center;">
            <button type="button" class="btn-excecoes-trigger" onclick="app.toggleExcecoesAcerto('${item.produtoId}')" style="background: rgba(255, 183, 77, 0.05); color: #ffb74d; border: 1px solid rgba(255, 183, 77, 0.15); padding: 5px 10px; border-radius: 6px; font-size: 0.75rem; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; transition: all 0.2s; font-weight: 500;">
              <i class="fa-solid fa-triangle-exclamation"></i> Ocorrências
            </button>
          </div>
        </td>
        <td style="text-align: right;">
          <div style="display: flex; gap: 4px; justify-content: flex-end;">
            <button type="button" class="btn-shortcut-venda" onclick="app.definirAcertoLinha('${item.produtoId}', 'venda', ${item.quantidadeConsignada})" style="background: rgba(129, 199, 132, 0.08); color: #81c784; border: 1px solid rgba(129, 199, 132, 0.15); padding: 5px 10px; border-radius: 6px; font-size: 0.72rem; cursor: pointer; transition: all 0.2s; font-weight: 600; margin: 0;">Vendeu Tudo</button>
            <button type="button" class="btn-shortcut-devolucao" onclick="app.definirAcertoLinha('${item.produtoId}', 'devolucao', ${item.quantidadeConsignada})" style="background: rgba(255,255,255,0.03); color: #aaa; border: 1px solid rgba(255,255,255,0.08); padding: 5px 10px; border-radius: 6px; font-size: 0.72rem; cursor: pointer; transition: all 0.2s; font-weight: 500; margin: 0;">Devolveu</button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);

      // Cria a linha de exceções (oculta por padrão)
      const trEx = document.createElement("tr");
      trEx.id = `excecoes-row-${item.produtoId}`;
      trEx.style.display = "none";
      trEx.style.background = "rgba(239, 83, 80, 0.01)";
      trEx.style.borderLeft = "3px solid #ef5350";
      trEx.innerHTML = `
        <td colspan="7" style="padding: 12px 20px; border-bottom: 1px solid rgba(255, 255, 255, 0.03);">
          <div style="display: flex; gap: 2rem; align-items: center; flex-wrap: wrap;">
            <span style="font-size: 0.8rem; font-weight: 600; color: #ff8a80;"><i class="fa-solid fa-triangle-exclamation"></i> Registrar Ocorrências:</span>
            
            <!-- Perdido / Danificado -->
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 0.8rem; color: #ef9a9a;">Perda/Dano (Revendedora paga):</span>
              <div class="acerto-input-wrapper" style="display: flex; align-items: center; gap: 2px; background: rgba(255,255,255,0.02); border: 1px solid #333; border-radius: 6px; padding: 2px; width: 100px;">
                <button type="button" class="btn-input-adjust" onclick="app.ajustarQtdAcerto(this, -1, 'perdido', ${item.quantidadeConsignada})" style="background: transparent; border: none; color: #888; cursor: pointer; padding: 2px 6px; font-size: 0.75rem;"><i class="fa-solid fa-minus"></i></button>
                <input type="number" class="input-acerto-perdido"
                       data-prod-id="${item.produtoId}"
                       value="0" min="0" max="${item.quantidadeConsignada}"
                       oninput="app.sincronizarAcertoQuantidades(this, 'perdido')"
                       style="width: 30px; text-align: center; font-weight: 700; border: none; background: transparent; color: var(--text-primary); font-size: 0.85rem; outline: none; padding: 0;">
                <button type="button" class="btn-input-adjust" onclick="app.ajustarQtdAcerto(this, 1, 'perdido', ${item.quantidadeConsignada})" style="background: transparent; border: none; color: #888; cursor: pointer; padding: 2px 6px; font-size: 0.75rem;"><i class="fa-solid fa-plus"></i></button>
              </div>
            </div>

            <!-- Defeito de Fábrica -->
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 0.8rem; color: #ffb74d;">Defeito de Fábrica:</span>
              <div class="acerto-input-wrapper" style="display: flex; align-items: center; gap: 2px; background: rgba(255,255,255,0.02); border: 1px solid #333; border-radius: 6px; padding: 2px; width: 100px;">
                <button type="button" class="btn-input-adjust" onclick="app.ajustarQtdAcerto(this, -1, 'defeito', ${item.quantidadeConsignada})" style="background: transparent; border: none; color: #888; cursor: pointer; padding: 2px 6px; font-size: 0.75rem;"><i class="fa-solid fa-minus"></i></button>
                <input type="number" class="input-acerto-defeito"
                       data-prod-id="${item.produtoId}"
                       value="0" min="0" max="${item.quantidadeConsignada}"
                       oninput="app.sincronizarAcertoQuantidades(this, 'defeito')"
                       style="width: 30px; text-align: center; font-weight: 700; border: none; background: transparent; color: var(--text-primary); font-size: 0.85rem; outline: none; padding: 0;">
                <button type="button" class="btn-input-adjust" onclick="app.ajustarQtdAcerto(this, 1, 'defeito', ${item.quantidadeConsignada})" style="background: transparent; border: none; color: #888; cursor: pointer; padding: 2px 6px; font-size: 0.75rem;"><i class="fa-solid fa-plus"></i></button>
              </div>
            </div>
          </div>
        </td>
      `;
      tbody.appendChild(trEx);

      // Inicializa os badges
      this.atualizarBadgesLinhaAcerto(item.produtoId);
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
      this.atualizarBadgesLinhaAcerto(prodId);
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
        this.atualizarBadgesLinhaAcerto(prodId);
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

    this.atualizarBadgesLinhaAcerto(prodId);
    this.calcularResumoFechamentoAcerto();
  },

  toggleExcecoesAcerto: function(prodId) {
    const row = document.getElementById(`excecoes-row-${prodId}`);
    if (row) {
      if (row.style.display === "none") {
        row.style.display = "table-row";
      } else {
        row.style.display = "none";
      }
    }
  },

  atualizarBadgesLinhaAcerto: function(prodId) {
    const inpVend = document.querySelector(`.input-acerto-vendido[data-prod-id="${prodId}"]`);
    const inpDev  = document.querySelector(`.input-acerto-devolvido[data-prod-id="${prodId}"]`);
    const inpPerd = document.querySelector(`.input-acerto-perdido[data-prod-id="${prodId}"]`);
    const inpDef  = document.querySelector(`.input-acerto-defeito[data-prod-id="${prodId}"]`);

    if (!inpVend || !inpDev) return;

    const v = parseInt(inpVend.value) || 0;
    const d = parseInt(inpDev.value) || 0;
    const p = inpPerd ? (parseInt(inpPerd.value) || 0) : 0;
    const def = inpDef ? (parseInt(inpDef.value) || 0) : 0;

    // Atualiza o badge de Devolvido
    const devBadge = document.getElementById(`dev-badge-${prodId}`);
    if (devBadge) {
      devBadge.innerText = `${d} pçs`;
      if (d > 0) {
        devBadge.style.background = "rgba(255, 255, 255, 0.05)";
        devBadge.style.color = "#aaa";
      } else {
        devBadge.style.background = "transparent";
        devBadge.style.color = "#444";
      }
    }

    // Atualiza o container de badges de exceções
    const badgesContainer = document.getElementById(`badges-${prodId}`);
    if (badgesContainer) {
      badgesContainer.innerHTML = "";
      if (p > 0) {
        badgesContainer.innerHTML += `<span style="background: rgba(239, 83, 80, 0.15); color: #ff8a80; font-size: 0.7rem; padding: 2px 6px; border-radius: 3px; border: 1px solid rgba(239, 83, 80, 0.25); display: inline-flex; align-items: center; gap: 3px;"><i class="fa-solid fa-triangle-exclamation"></i> ${p} perda</span>`;
      }
      if (def > 0) {
        badgesContainer.innerHTML += `<span style="background: rgba(255, 183, 77, 0.15); color: #ffb74d; font-size: 0.7rem; padding: 2px 6px; border-radius: 3px; border: 1px solid rgba(255, 183, 77, 0.25); display: inline-flex; align-items: center; gap: 3px;"><i class="fa-solid fa-screwdriver-wrench"></i> ${def} defeito</span>`;
      }
    }
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
    let lostPiecesCounter = 0;

    itensAcerto.forEach(item => {
      totalPecasConsignadas += item.quantidadeConsignada;
      faturamentoBruto += Number(item.precoVenda) * item.quantidadeVendida;
      
      const qtdPerdida = item.quantidadePerdida || 0;
      if (qtdPerdida > 0) {
        const prod = this.state.produtos.find(p => p.id === item.produtoId);
        const custoLiquido = prod ? (prod.custoLiquido || 0) : 0;
        
        for (let i = 0; i < qtdPerdida; i++) {
          lostPiecesCounter++;
          if (rev.regraPerda === 'ISENTO' && lostPiecesCounter <= (rev.limiteIsencaoPerda || 0)) {
            valorPerdas += 0;
          } else if (rev.regraPerda === 'VALOR_CUSTO') {
            valorPerdas += custoLiquido;
          } else {
            valorPerdas += Number(item.precoVenda);
          }
        }
      }
    });

    // 1. Base de cálculo da comissão: Bruto vs Líquido
    const valorBaseComissao = (rev.baseCalculo === 'LIQUIDO')
      ? Math.max(0, faturamentoBruto - valorPerdas)
      : faturamentoBruto;

    // 2. Determinação da comissão e bônus conforme o tipo de comissão
    let pctComissao = Number(rev.comissao) || 30;
    let comissaoBruta = 0;

    // Volume de faturamento considerado para enquadramento de faixa ou meta
    let faturamentoVolumeParaFaixa = faturamentoBruto;
    if (rev.periodoAcumulo === 'MENSAL') {
      const agora = new Date();
      const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1, 0, 0, 0, 0);
      
      let faturamentoAcumuladoMes = 0;
      if (rev.vendas && Array.isArray(rev.vendas)) {
        rev.vendas.forEach(v => {
          const dataVenda = new Date(v.data);
          if (dataVenda >= inicioMes) {
            faturamentoAcumuladoMes += Number(v.precoVenda) * Number(v.quantidade || 1);
          }
        });
      }
      faturamentoVolumeParaFaixa = faturamentoAcumuladoMes;
      // Garante que inclua o faturamento do acerto atual se alguma venda ainda não tiver sido salva
      if (faturamentoVolumeParaFaixa < faturamentoBruto) {
        faturamentoVolumeParaFaixa = faturamentoBruto;
      }
    }

    if (rev.tipoComissao === 'PROGRESSIVA') {
      const faixas = (rev.faixasComissao && rev.faixasComissao.length > 0)
        ? rev.faixasComissao
        : (this.state.lojaConfig && this.state.lojaConfig.faixasComissao ? this.state.lojaConfig.faixasComissao : []);
      const sortedFaixas = [...faixas].sort((a, b) => a.valorMin - b.valorMin);
      let faixaAtual = null;
      for (let i = 0; i < sortedFaixas.length; i++) {
        if (faturamentoVolumeParaFaixa >= sortedFaixas[i].valorMin) {
          faixaAtual = sortedFaixas[i];
        }
      }
      pctComissao = faixaAtual ? faixaAtual.percentual : (Number(rev.comissao) || 30);
      comissaoBruta = valorBaseComissao * (pctComissao / 100);
    } else if (rev.tipoComissao === 'META_UNICA') {
      const atingiuMeta = faturamentoVolumeParaFaixa >= (rev.metaUnicaValor || 0);
      if (atingiuMeta) {
        if (rev.metaUnicaTipoBonus === 'PERCENTUAL') {
          pctComissao = (Number(rev.comissao) || 30) + (rev.metaUnicaBonus || 0);
          comissaoBruta = valorBaseComissao * (pctComissao / 100);
        } else { // Bônus Fixo em Dinheiro
          pctComissao = Number(rev.comissao) || 30;
          comissaoBruta = (valorBaseComissao * (pctComissao / 100)) + (rev.metaUnicaBonus || 0);
        }
      } else {
        pctComissao = Number(rev.comissao) || 30;
        comissaoBruta = valorBaseComissao * (pctComissao / 100);
      }
    } else { // FIXA
      pctComissao = Number(rev.comissao) || 30;
      comissaoBruta = valorBaseComissao * (pctComissao / 100);
    }

    const comissaoFinal = Math.max(0, comissaoBruta - valorPerdas);
    
    // Calcula vendas link vs dinheiro para a revendedora selecionada
    let vendasLink = 0;
    let vendasDinheiro = 0;
    
    if (this.state.vendasSessao && Array.isArray(this.state.vendasSessao)) {
      const vendasDaRev = this.state.vendasSessao.filter(v => v.usuarioId === rev.id);
      vendasDaRev.forEach(v => {
        if (v.canalPagamento === "LINK_PAGO_ADMIN") {
          vendasLink += Number(v.precoVenda) * Number(v.quantidade || 1);
        } else {
          vendasDinheiro += Number(v.precoVenda) * Number(v.quantidade || 1);
        }
      });
    }
    
    // Se nao houver vendas cadastradas na sessao para aquela revendedora (fallback)
    if (vendasLink === 0 && vendasDinheiro === 0) {
      vendasLink = faturamentoBruto * 0.7; // 70% simulado via link
      vendasDinheiro = faturamentoBruto * 0.3; // 30% em maos
    }

    // Ajusta proporcoes baseando-se no faturamentoBruto conferido no acerto
    if (faturamentoBruto > 0) {
      const proporcaoLink = vendasLink / (vendasLink + vendasDinheiro || 1);
      vendasLink = faturamentoBruto * proporcaoLink;
      vendasDinheiro = faturamentoBruto * (1 - proporcaoLink);
    } else {
      vendasLink = 0;
      vendasDinheiro = 0;
    }

    const saldoFinalAcerto = comissaoFinal - vendasDinheiro;

    document.getElementById("acerto-total-peças-levadas").innerText = `${totalPecasConsignadas} pçs`;
    document.getElementById("acerto-total-faturamento-bruto").innerText = `R$ ${faturamentoBruto.toFixed(2).replace(".", ",")}`;
    document.getElementById("acerto-comissao-valor").innerText = `R$ ${comissaoFinal.toFixed(2).replace(".", ",")}`;
    
    // Atualiza a exibição da porcentagem no recibo/modal em tempo real
    const elPct = document.getElementById("acerto-comissao-percent");
    if (elPct) {
      if (rev.tipoComissao === 'META_UNICA' && faturamentoVolumeParaFaixa >= (rev.metaUnicaValor || 0) && rev.metaUnicaTipoBonus === 'FIXO') {
        elPct.innerText = `${pctComissao}% + R$ ${rev.metaUnicaBonus}`;
      } else {
        elPct.innerText = `${pctComissao}%`;
      }
    }
    
    const elDesconto = document.getElementById("acerto-desconto-perdas");
    if (elDesconto) elDesconto.innerText = `- R$ ${valorPerdas.toFixed(2).replace(".", ",")}`;
    
    // Injeta os novos valores calculados na tela
    document.getElementById("acerto-vendas-link").innerText = `R$ ${vendasLink.toFixed(2).replace(".", ",")}`;
    document.getElementById("acerto-vendas-dinheiro").innerText = `R$ ${vendasDinheiro.toFixed(2).replace(".", ",")}`;

    const lblSaldoFinal = document.getElementById("acerto-lbl-saldo-final");
    const elSaldo = document.getElementById("acerto-total-liquido-receber");
    
    if (saldoFinalAcerto >= 0) {
      if (lblSaldoFinal) lblSaldoFinal.innerText = "Saldo a Pagar para Revendedora";
      if (elSaldo) {
        elSaldo.innerText = `R$ ${saldoFinalAcerto.toFixed(2).replace(".", ",")}`;
        elSaldo.style.color = "#81c784";
      }
    } else {
      if (lblSaldoFinal) lblSaldoFinal.innerText = "Saldo a Receber da Revendedora";
      if (elSaldo) {
        elSaldo.innerText = `R$ ${Math.abs(saldoFinalAcerto).toFixed(2).replace(".", ",")}`;
        elSaldo.style.color = "#ef9a9a";
      }
    }

    // Atualiza o painel de progressão visual de comissão
    this.atualizarProgressaoComissaoUI(faturamentoVolumeParaFaixa, rev);
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

    let lostPiecesCounter = 0;
    let valorPerdas = 0;
    itensAcerto.forEach(item => {
      const qtdPerdida = item.quantidadePerdida || 0;
      if (qtdPerdida > 0) {
        const prod = this.state.produtos.find(p => p.id === item.produtoId);
        const custoLiquido = prod ? (prod.custoLiquido || 0) : 0;
        for (let i = 0; i < qtdPerdida; i++) {
          lostPiecesCounter++;
          if (rev.regraPerda === 'ISENTO' && lostPiecesCounter <= (rev.limiteIsencaoPerda || 0)) {
            valorPerdas += 0;
          } else if (rev.regraPerda === 'VALOR_CUSTO') {
            valorPerdas += custoLiquido;
          } else {
            valorPerdas += Number(item.precoVenda);
          }
        }
      }
    });

    // 1. Base de cálculo da comissão: Bruto vs Líquido
    const valorBaseComissao = (rev.baseCalculo === 'LIQUIDO')
      ? Math.max(0, faturamentoBruto - valorPerdas)
      : faturamentoBruto;

    // 2. Determinação da comissão e bônus conforme o tipo de comissão
    let pctComissao = Number(rev.comissao) || 30;
    let comissaoBruta = 0;

    if (rev.tipoComissao === 'PROGRESSIVA') {
      const faixas = (rev.faixasComissao && rev.faixasComissao.length > 0)
        ? rev.faixasComissao
        : (this.state.lojaConfig && this.state.lojaConfig.faixasComissao ? this.state.lojaConfig.faixasComissao : []);
      const sortedFaixas = [...faixas].sort((a, b) => a.valorMin - b.valorMin);
      let faixaAtual = null;
      for (let i = 0; i < sortedFaixas.length; i++) {
        if (faturamentoBruto >= sortedFaixas[i].valorMin) {
          faixaAtual = sortedFaixas[i];
        }
      }
      pctComissao = faixaAtual ? faixaAtual.percentual : (Number(rev.comissao) || 30);
      comissaoBruta = valorBaseComissao * (pctComissao / 100);
    } else if (rev.tipoComissao === 'META_UNICA') {
      const atingiuMeta = faturamentoBruto >= (rev.metaUnicaValor || 0);
      if (atingiuMeta) {
        if (rev.metaUnicaTipoBonus === 'PERCENTUAL') {
          pctComissao = (Number(rev.comissao) || 30) + (rev.metaUnicaBonus || 0);
          comissaoBruta = valorBaseComissao * (pctComissao / 100);
        } else { // Bônus Fixo em Dinheiro
          pctComissao = Number(rev.comissao) || 30;
          comissaoBruta = (valorBaseComissao * (pctComissao / 100)) + (rev.metaUnicaBonus || 0);
        }
      } else {
        pctComissao = Number(rev.comissao) || 30;
        comissaoBruta = valorBaseComissao * (pctComissao / 100);
      }
    } else { // FIXA
      pctComissao = Number(rev.comissao) || 30;
      comissaoBruta = valorBaseComissao * (pctComissao / 100);
    }

    const valorComissao = Math.max(0, comissaoBruta - valorPerdas);
    const valorLiquido = faturamentoBruto - valorComissao;

    const selectForma = document.getElementById("acerto-forma-pagamento");
    const formaPagamento = selectForma ? selectForma.value : "Pix";

    // Calcula vendas link vs dinheiro
    let vendasLink = 0;
    let vendasDinheiro = 0;
    if (this.state.vendasSessao && Array.isArray(this.state.vendasSessao)) {
      const vendasDaRev = this.state.vendasSessao.filter(v => v.usuarioId === rev.id);
      vendasDaRev.forEach(v => {
        if (v.canalPagamento === "LINK_PAGO_ADMIN") {
          vendasLink += Number(v.precoVenda) * Number(v.quantidade || 1);
        } else {
          vendasDinheiro += Number(v.precoVenda) * Number(v.quantidade || 1);
        }
      });
    }
    if (vendasLink === 0 && vendasDinheiro === 0) {
      vendasLink = faturamentoBruto * 0.7;
      vendasDinheiro = faturamentoBruto * 0.3;
    }
    if (faturamentoBruto > 0) {
      const proporcaoLink = vendasLink / (vendasLink + vendasDinheiro || 1);
      vendasLink = faturamentoBruto * proporcaoLink;
      vendasDinheiro = faturamentoBruto * (1 - proporcaoLink);
    } else {
      vendasLink = 0;
      vendasDinheiro = 0;
    }
    const saldoFinal = valorComissao - vendasDinheiro;

    try {
      // Sincroniza fechamento de acerto com a Azure
      if (this.state.token && !this.state.token.startsWith("mock_")) {
        await this.requisitarAPI("/acertos", "POST", {
          usuarioId: rev.id,
          itensAcerto: postItens,
          formaPagamento: formaPagamento,
          totalRetidoRevendedora: vendasDinheiro,
          totalRecebidoAdmin: vendasLink
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
        liquidoBelklock: valorLiquido,
        formaPagamento: formaPagamento,
        totalRetidoRevendedora: vendasDinheiro,
        totalRecebidoAdmin: vendasLink,
        saldoFinalAcerto: saldoFinal
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
        if (this.state.usuarioLogado.role === 'admin') {
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

    // Reseta descontos da venda rápida
    const chk = document.getElementById("vr-has-discount");
    if (chk) chk.checked = false;
    const box = document.getElementById("vr-discount-box");
    if (box) box.style.display = "none";
    const val = document.getElementById("vr-desconto");
    if (val) val.value = 0;
    const mot = document.getElementById("vr-desconto-motivo");
    if (mot) mot.value = "";

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

  toggleDescontoVendaRapida: function() {
    const chk = document.getElementById("vr-has-discount");
    const box = document.getElementById("vr-discount-box");
    const val = document.getElementById("vr-desconto");
    const mot = document.getElementById("vr-desconto-motivo");
    if (chk && box) {
      box.style.display = chk.checked ? "block" : "none";
      if (!chk.checked) {
        if (val) val.value = 0;
        if (mot) mot.value = "";
      }
    }
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

    // Obter desconto e motivo
    let descontoTotal = 0;
    let motivoDesconto = "";
    const chkDesconto = document.getElementById("vr-has-discount");
    const inputDesconto = document.getElementById("vr-desconto");
    const reasonDesconto = document.getElementById("vr-desconto-motivo");
    if (chkDesconto && chkDesconto.checked) {
      descontoTotal = parseFloat(inputDesconto ? inputDesconto.value : 0) || 0;
      motivoDesconto = (reasonDesconto ? reasonDesconto.value : "").trim();
    }

    // Pergunta se deseja registrar a baixa no sistema
    const registrarBaixa = await this.confirmar("Deseja registrar esta venda direta no banco de dados do sistema e deduzir a quantidade do estoque central?");

    if (registrarBaixa) {
      try {
        const descPorItem = descontoTotal / selecionados.length;
        for (const item of selecionados) {
          // Se houver conexão de API ativa
          if (this.state.token) {
            await this.requisitarAPI("/vendas-diretas", "POST", {
              codigo: item.codigo,
              nome: item.nome,
              preco: item.preco,
              whatsappCliente: whatsapp,
              nomeCliente: nomeCliente,
              clienteId: clienteId || undefined,
              desconto: descPorItem,
              motivoDesconto: motivoDesconto,
              formaPagamento: "Pix" // Venda rápida por WhatsApp sempre assume Pix
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
        this.toast("Erro ao registrar a venda direta: " + error.message, "error");
      }
    }

    // Constrói lista de produtos elegante
    let listaTexto = "";
    let valorTotal = 0;
    selecionados.forEach(item => {
      listaTexto += `- *[Ref: ${item.codigo}]* ${item.nome}: R$ ${item.preco.toFixed(2).replace(".", ",")}\n`;
      valorTotal += item.preco;
    });

    if (descontoTotal > 0) {
      listaTexto += `\n*Valor de Tabela:* R$ ${valorTotal.toFixed(2).replace(".", ",")}`;
      listaTexto += `\n*Desconto Especial:* - R$ ${descontoTotal.toFixed(2).replace(".", ",")}`;
      listaTexto += `\n*Valor Líquido:* R$ ${(valorTotal - descontoTotal).toFixed(2).replace(".", ",")}`;
    } else {
      if (selecionados.length > 1) {
        listaTexto += `\n*Valor Total de Compra:* R$ ${valorTotal.toFixed(2).replace(".", ",")}`;
      }
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
    downloadAnchorNode.setAttribute("download", "conectajoias_backup_" + new Date().getTime() + ".json");
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
        options: { 
          plugins: { 
            legend: { labels: { color: '#e0e0e0' } },
            tooltip: {
              callbacks: {
                label: function(context) {
                  let value = context.parsed;
                  return ` ${context.label}: R$ ${value.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
                }
              }
            }
          } 
        }
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
            y: { 
              ticks: { 
                color: '#e0e0e0',
                callback: function(value) {
                  return 'R$ ' + value.toLocaleString('pt-BR', {minimumFractionDigits: 0});
                }
              }, 
              grid: { color: 'rgba(255,255,255,0.1)' } 
            },
            x: { ticks: { color: '#e0e0e0' }, grid: { display: false } }
          },
          plugins: { 
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: function(context) {
                  let value = context.raw;
                  return ` Faturamento: R$ ${value.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
                }
              }
            }
          }
        }
      });
    }
  },

  mudarSubAbaRevendedora: function(aba) {
    // Esconde todas as sub-abas da revendedora
    document.getElementById("sub-aba-rev-maleta").style.display = "none";
    document.getElementById("sub-aba-rev-historico").style.display = "none";
    document.getElementById("sub-aba-rev-vendas").style.display = "none";
    document.getElementById("sub-aba-rev-termos").style.display = "none";
    document.getElementById("sub-aba-rev-documentos").style.display = "none";
    
    // Remove classe active de todos os botões
    document.getElementById("btn-subtab-maleta").classList.remove("active");
    document.getElementById("btn-subtab-historico").classList.remove("active");
    document.getElementById("btn-subtab-vendas-rev").classList.remove("active");
    document.getElementById("btn-subtab-termos").classList.remove("active");
    document.getElementById("btn-subtab-documentos").classList.remove("active");
    
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
    } else if (aba === "termos") {
      document.getElementById("sub-aba-rev-termos").style.display = "block";
      document.getElementById("btn-subtab-termos").classList.add("active");
      this.carregarTermosRevendedora();
    } else if (aba === "documentos") {
      document.getElementById("sub-aba-rev-documentos").style.display = "block";
      document.getElementById("btn-subtab-documentos").classList.add("active");
      this.carregarCofreDocumentos();
    }
  },

  carregarVendasConsolidadas: async function() {
    const offlineMode = this.state.token && this.state.token.startsWith("mock_");
    if (offlineMode) {
      const vendasConsolidadas = [];

      // Vendas das revendedoras (localStorage por revendedora)
      this.state.revendedoras.forEach(r => {
        const localVendasKey = `conectajoias_vendas_${r.id}`;
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
            contato: v.whatsappCliente || '—',
            cliente: v.nomeCliente || 'Cliente Avulso',
            usuarioId: r.id
          });
        });
      });

      // Vendas diretas da administradora (localStorage global)
      const vendasAdminLocais = JSON.parse(localStorage.getItem("conectajoias_vendas_admin") || "[]");
      vendasAdminLocais.forEach(v => {
        vendasConsolidadas.push({
          id: v.id,
          data: v.data,
          tipo: 'direta',
          nomeProduto: v.nomeProduto,
          codigoProduto: v.codigoProduto,
          quantidade: v.quantidade,
          precoVenda: v.precoVenda,
          total: v.total,
          comissao: 0,
          lucroEstimado: v.lucroEstimado || 0,
          formaPagamento: v.formaPagamento || '',
          vendedor: 'Conecta Joias (Direta)',
          contato: v.whatsappCliente || '—',
          cliente: v.nomeCliente || 'Cliente Avulso',
          usuarioId: null
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
          vendedor: 'Conecta Joias (Direta)',
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
          contato: v.cliente && v.cliente.whatsapp ? v.cliente.whatsapp : '—',
          cliente: v.cliente ? v.cliente.nome : 'Cliente Avulso',
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
          ? 'background: rgba(67, 160, 71, 0.15); border-color: rgba(67, 160, 71, 0.3); color: #81c784;' 
          : 'background: rgba(100, 181, 246, 0.15); border-color: rgba(100, 181, 246, 0.3); color: #90caf9;';
        const badgeLabel = v.tipo === 'direta' ? 'Direta (Admin)' : v.vendedor;
        const badgeSub = v.tipo === 'direta' && v.formaPagamento ? `<br><small style="font-size:0.72rem;opacity:0.75;">${v.formaPagamento}</small>` : '';
        
        const contatoWhatsApp = v.contato && v.contato !== '—' 
          ? `<a href="https://api.whatsapp.com/send?phone=55${v.contato.replace(/\D/g, '')}" target="_blank" style="color: #81c784; text-decoration: none;"><i class="fa-brands fa-whatsapp"></i> ${v.contato}</a>`
          : '—';
          
        const clienteInfo = `${v.cliente || 'Cliente Avulso'}<br><small style="color:var(--text-secondary);">${contatoWhatsApp}</small>`;
          
        // Para vendas diretas: exibe lucro estimado no lugar de comissão (que é 0)
        const comissaoOuLucro = v.tipo === 'direta'
          ? `<span style="color: #a5d6a7; font-weight: 700; font-size: 0.8rem;">R$ ${(v.lucroEstimado || 0).toFixed(2).replace(".", ",")} <small style="opacity:0.7;font-weight:400;">(lucro)</small></span>`
          : `R$ ${v.comissao.toFixed(2).replace(".", ",")}`;

        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td style="color: var(--text-secondary); font-size: 0.85rem;">${dataStr}</td>
          <td><span class="badge" style="${badgeStyle}">${badgeLabel}${badgeSub}</span></td>
          <td><strong>${v.nomeProduto}</strong><br><span style="font-size:0.78rem;color:var(--text-secondary);">${v.codigoProduto}</span></td>
          <td>${v.quantidade} pçs</td>
          <td>R$ ${v.precoVenda.toFixed(2).replace(".", ",")}</td>
          <td style="color: var(--gold-primary); font-weight: 700;">R$ ${v.total.toFixed(2).replace(".", ",")}</td>
          <td style="color: #81c784; font-weight: 700;">${comissaoOuLucro}</td>
          <td>${clienteInfo}</td>
          <td>
            <button class="btn-qty" style="color: #ef9a9a; border-color: rgba(198, 40, 40, 0.1);" onclick="app.excluirVenda('${v.id}', '${v.tipo}')" title="Excluir Venda"><i class="fa-solid fa-trash"></i></button>
          </td>
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

    if (inputNome) inputNome.value = this.state.nomeEmpresa || "Conecta Joias";
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

    const inputImposto = document.getElementById("cfg-dre-imposto");
    const inputDespesa = document.getElementById("cfg-dre-despesa-fixa");
    const inputCmv = document.getElementById("cfg-dre-cmv-estimado");
    if (inputImposto) inputImposto.value = this.state.dreImposto;
    if (inputDespesa) inputDespesa.value = this.state.dreDespesaFixa;
    if (inputCmv) inputCmv.value = this.state.dreCmvEstimado;
 
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
    const inputImposto = parseFloat(document.getElementById("cfg-dre-imposto").value) || 0.0;
    const inputDespesa = parseFloat(document.getElementById("cfg-dre-despesa-fixa").value) || 0.0;
    const inputCmv = parseFloat(document.getElementById("cfg-dre-cmv-estimado").value) || 33.0;

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
    this.state.dreImposto = inputImposto;
    this.state.dreDespesaFixa = inputDespesa;
    this.state.dreCmvEstimado = inputCmv;

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
      const mensagem = encodeURIComponent(`Parabéns, ${nomePrimeiro}! 🎉 Que o seu dia seja repleto de amor, paz e muitas alegrias. Nós da Conecta Joias te desejamos um aniversário inesquecível! Como presente de aniversário, temos um cupom especial de 10% de desconto para você usar em nossa coleção este mês. Beijos! ❤️`);
      
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

  excluirTodosClientes: async function() {
    if (!await this.confirmar("🚨 ATENÇÃO: Deseja realmente excluir TODAS as clientes cadastradas? Esta ação NÃO pode ser desfeita!")) return;
    try {
      if (this.state.token && !this.state.token.startsWith("mock_")) {
        await this.requisitarAPI("/clientes", "DELETE");
      }
      this.state.clientes = [];
      this.renderizarClientes();
      this.toast("Todas as clientes foram removidas com sucesso!", "success");
    } catch (err) {
      console.error(err);
      this.toast("Erro ao excluir todas as clientes: " + err.message, "error");
    }
  },

  excluirTodasRevendedoras: async function() {
    if (!await this.confirmar("🚨 ATENÇÃO: Deseja realmente excluir TODAS as revendedoras cadastradas? As consignações delas serão perdidas. Esta ação NÃO pode ser desfeita!")) return;
    try {
      if (this.state.token && !this.state.token.startsWith("mock_")) {
        await this.requisitarAPI("/revendedoras", "DELETE");
      }
      this.state.revendedoras = [];
      this.state.revendedoraSelecionadaId = null;
      this.salvarDadosNoLocalStorage();
      this.renderizarRevendedoras();
      this.renderizarDashboard();
      this.toast("Todas as revendedoras foram excluídas com sucesso!", "success");
    } catch (err) {
      console.error(err);
      this.toast("Erro ao excluir todas as revendedoras: " + err.message, "error");
    }
  },

  excluirVenda: async function(id, tipo) {
    if (!await this.confirmar("Deseja realmente excluir esta venda do histórico? Esta ação NÃO devolverá a peça ao estoque central.")) return;
    try {
      if (this.state.token && !this.state.token.startsWith("mock_")) {
        await this.requisitarAPI(`/vendas/${tipo}/${id}`, "DELETE");
      }
      this.state.vendasConsolidadas = this.state.vendasConsolidadas.filter(v => v.id !== id);
      this.renderizarVendasConsolidadas();
      this.renderizarDashboard();
      this.toast("Venda excluída com sucesso!", "success");
    } catch (err) {
      console.error(err);
      this.toast("Erro ao excluir venda: " + err.message, "error");
    }
  },

  excluirTodoHistoricoVendas: async function() {
    if (!await this.confirmar("🚨 ATENÇÃO: Deseja realmente limpar TODO o histórico de vendas do sistema? Esta ação NÃO pode ser desfeita!")) return;
    try {
      if (this.state.token && !this.state.token.startsWith("mock_")) {
        await this.requisitarAPI("/vendas", "DELETE");
      }
      this.state.vendasConsolidadas = [];
      this.renderizarVendasConsolidadas();
      this.renderizarDashboard();
      this.toast("Histórico de vendas excluído com sucesso!", "success");
    } catch (err) {
      console.error(err);
      this.toast("Erro ao excluir histórico de vendas: " + err.message, "error");
    }
  },

  inicializarPollingNotificacoes: function() {
    if (this.state.pollingNotificacoesInterval) {
      clearInterval(this.state.pollingNotificacoesInterval);
    }
    
    // Executa uma busca inicial imediata
    this.buscarNotificacoes();
    
    // Define polling a cada 30 segundos
    this.state.pollingNotificacoesInterval = setInterval(() => {
      this.buscarNotificacoes();
    }, 30000);
  },

  buscarNotificacoes: async function() {
    try {
      let novas = [];
      if (this.state.token && !this.state.token.startsWith("mock_")) {
        novas = await this.requisitarAPI("/notificacoes", "GET");
      } else {
        // Fallback local/mock
        const localNotifs = localStorage.getItem("conectajoias_notificacoes_mock");
        novas = localNotifs ? JSON.parse(localNotifs) : [];
      }

      if (!Array.isArray(novas)) {
        novas = [];
      }

      // Identifica notificações realmente novas para exibir o toast animado
      const idsExistentes = new Set(this.state.notificacoes.map(n => n.id));
      const notificacoesNovas = novas.filter(n => !idsExistentes.has(n.id));

      if (notificacoesNovas.length > 0 && this.state.notificacoes.length > 0) {
        // Apenas exibe toast se já existia um estado prévio carregado (para não inundar de toasts ao fazer login)
        notificacoesNovas.forEach(n => {
          this.toast(n.mensagem, "success");
        });
      }

      this.state.notificacoes = novas;
      this.atualizarBadgeSino();
    } catch (err) {
      console.error("Erro ao buscar notificações:", err);
    }
  },

  atualizarBadgeSino: function() {
    const badge = document.getElementById("notification-count");
    if (!badge) return;
    
    const count = this.state.notificacoes.filter(n => !n.lida).length;
    badge.innerText = count;
    if (count > 0) {
      badge.style.display = "flex";
    } else {
      badge.style.display = "none";
    }
  },

  renderizarNotificacoes: function() {
    const container = document.getElementById("notifications-list-container");
    if (!container) return;

    container.innerHTML = "";
    
    const naoLidas = this.state.notificacoes.filter(n => !n.lida);

    if (naoLidas.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; color: var(--text-secondary); padding: 2rem;">
          <i class="fa-solid fa-bell-slash" style="font-size: 2rem; color: rgba(212, 175, 55, 0.3); margin-bottom: 0.8rem; display: block;"></i>
          Você não tem nenhuma nova notificação.
        </div>
      `;
      return;
    }

    naoLidas.forEach(n => {
      const card = document.createElement("div");
      card.className = "notification-item-card";
      card.style.cssText = `
        background: rgba(212, 175, 55, 0.04);
        border-left: 3px solid var(--gold-primary);
        border-radius: var(--radius-sm);
        padding: 0.8rem 1rem;
        display: flex;
        flex-direction: column;
        gap: 0.3rem;
        transition: all 0.3s ease;
      `;

      let detalhesHtml = "";
      if (n.detalhes) {
        try {
          const det = typeof n.detalhes === 'string' ? JSON.parse(n.detalhes) : n.detalhes;
          if (det && det.itens && Array.isArray(det.itens)) {
            detalhesHtml = `
              <div style="font-size: 0.78rem; color: var(--text-secondary); margin-top: 0.4rem; padding-top: 0.4rem; border-top: 1px dashed rgba(212, 175, 55, 0.2);">
                <strong style="color: var(--text-primary);">Peças vendidas:</strong>
                <ul style="margin: 0.2rem 0 0 1rem; padding: 0; list-style-type: disc;">
                  ${det.itens.map(it => `<li>${it.quantidade}x ${it.codigo || it.produtoId} (${it.nome})</li>`).join("")}
                </ul>
              </div>
            `;
          }
        } catch (e) {
          // ignora erro se não for JSON
        }
      }

      const dataFormatada = new Date(n.createdAt).toLocaleString('pt-BR');

      card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem;">
          <span style="font-size: 0.88rem; font-weight: 500; color: var(--text-primary); line-height: 1.4;">${n.mensagem}</span>
          <span style="font-size: 0.72rem; color: var(--text-secondary); white-space: nowrap;">${dataFormatada}</span>
        </div>
        ${detalhesHtml}
      `;
      container.appendChild(card);
    });
  },

  marcarTodasNotificacoesComoLidas: async function() {
    try {
      if (this.state.token && !this.state.token.startsWith("mock_")) {
        await this.requisitarAPI("/notificacoes/ler", "PUT", {});
      } else {
        // Fallback local/mock
        localStorage.setItem("conectajoias_notificacoes_mock", JSON.stringify([]));
      }

      this.state.notificacoes = [];
      this.atualizarBadgeSino();
      this.renderizarNotificacoes();
      
      const modal = document.getElementById("modal-notificacoes");
      if (modal) {
        modal.classList.remove("active");
      }
      this.toast("Notificações limpas com sucesso!", "success");
    } catch (err) {
      console.error(err);
      this.toast("Erro ao limpar notificações: " + err.message, "error");
    }
  },

  subAbaNFAtiva: "pendentes",
  mudarAbaNF: function(aba) {
    this.subAbaNFAtiva = aba;
    document.getElementById("btn-nf-pendentes").classList.remove("active");
    document.getElementById("btn-nf-emitidas").classList.remove("active");
    document.getElementById("painel-nf-pendentes").style.display = "none";
    document.getElementById("painel-nf-emitidas").style.display = "none";

    if (aba === "pendentes") {
      document.getElementById("btn-nf-pendentes").classList.add("active");
      document.getElementById("painel-nf-pendentes").style.display = "block";
    } else {
      document.getElementById("btn-nf-emitidas").classList.add("active");
      document.getElementById("painel-nf-emitidas").style.display = "block";
    }
    this.carregarNotasFiscais();
  },

  carregarNotasFiscais: async function() {
    const tbodyPendentes = document.getElementById("tbody-nf-pendentes");
    const tbodyEmitidas = document.getElementById("tbody-nf-emitidas");

    try {
      // Faturamentos fictícios baseados em acertos passados e vendas concluídas
      let acertosCompletos = [];
      const revendedoras = Array.isArray(this.state.revendedoras) ? this.state.revendedoras : [];

      revendedoras.forEach(r => {
        if (r.historico && Array.isArray(r.historico)) {
          r.historico.forEach((h, idx) => {
            acertosCompletos.push({
              id: `acerto-${r.id}-${idx}`,
              data: h.data,
              tipo: "Acerto de Contas",
              destinatario: r.nome,
              cpf: r.documentoCpf || "000.000.000-00",
              valorTotal: h.faturamentoBruto,
              consignado: h.totalConsignada,
              vendido: h.totalVendida,
              comissao: h.comissaoPaga,
              itensDesc: `${h.totalVendida} peças acertadas`
            });
          });
        }
      });

      // Guardar as notas já emitidas no localStorage para persistência
      let nfs = JSON.parse(localStorage.getItem("conectajoias_nfe_emitidas") || "[]");

      // Notas pendentes: acertos que não estão na lista de nfs
      let pendentes = acertosCompletos.filter(ac => !nfs.some(nf => nf.idOrigem === ac.id));

      // Renderiza Pendentes
      if (tbodyPendentes) {
        if (pendentes.length === 0) {
          tbodyPendentes.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-secondary); padding: 1.5rem;">Nenhum faturamento aguardando emissão.</td></tr>`;
        } else {
          tbodyPendentes.innerHTML = pendentes.map(p => `
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
              <td style="padding: 12px;">${new Date(p.data).toLocaleDateString('pt-BR')}</td>
              <td style="padding: 12px; font-weight: bold; color: var(--gold-light);">${p.tipo}</td>
              <td style="padding: 12px;">${p.destinatario}</td>
              <td style="padding: 12px; font-weight: bold;">R$ ${p.valorTotal.toFixed(2).replace(".", ",")}</td>
              <td style="padding: 12px; color: var(--warning);"><i class="fa-solid fa-triangle-exclamation"></i> Não Emitida</td>
              <td style="padding: 12px;">
                <button class="btn-gold" style="padding: 0.3rem 0.6rem; font-size: 0.8rem;" onclick="app.emitirNotaFiscal('${p.id}')">
                  <i class="fa-solid fa-file-invoice"></i> Emitir NF-e
                </button>
              </td>
            </tr>
          `).join("");
        }
      }

      // Renderiza Emitidas
      if (tbodyEmitidas) {
        if (nfs.length === 0) {
          tbodyEmitidas.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-secondary); padding: 1.5rem;">Nenhuma nota fiscal emitida ainda.</td></tr>`;
        } else {
          tbodyEmitidas.innerHTML = nfs.map(n => `
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
              <td style="padding: 12px;">${new Date(n.dataEmissao).toLocaleDateString('pt-BR')}</td>
              <td style="padding: 12px; font-family: monospace; font-size: 0.8rem; color: var(--gold-primary);">${n.chave}</td>
              <td style="padding: 12px;">${n.destinatario}</td>
              <td style="padding: 12px; font-weight: bold;">R$ ${n.valorTotal.toFixed(2).replace(".", ",")}</td>
              <td style="padding: 12px; color: #81c784;">Modelo 55 (NF-e)</td>
              <td style="padding: 12px; display: flex; gap: 0.5rem;">
                <button class="btn-outline-gold" style="padding: 0.3rem 0.6rem; font-size: 0.8rem;" onclick="app.visualizarDANFE('${n.id}')">
                  <i class="fa-solid fa-eye"></i> Ver DANFE
                </button>
              </td>
            </tr>
          `).join("");
        }
      }
    } catch (err) {
      console.error("Erro ao carregar notas fiscais:", err);
      if (tbodyPendentes) {
        tbodyPendentes.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-secondary); padding: 1.5rem;">Erro ao carregar faturamentos pendentes.</td></tr>`;
      }
      if (tbodyEmitidas) {
        tbodyEmitidas.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-secondary); padding: 1.5rem;">Erro ao carregar notas emitidas.</td></tr>`;
      }
      this.toast("Erro ao processar faturamento para Notas Fiscais: " + err.message, "error");
    }
  },

  emitirNotaFiscal: async function(faturamentoId) {
    let acertosCompletos = [];
    this.state.revendedoras.forEach(r => {
      if (r.historico && Array.isArray(r.historico)) {
        r.historico.forEach((h, idx) => {
          acertosCompletos.push({
            id: `acerto-${r.id}-${idx}`,
            data: h.data,
            tipo: "Acerto de Contas",
            destinatario: r.nome,
            cpf: r.documentoCpf || "000.000.000-00",
            valorTotal: h.faturamentoBruto,
            consignado: h.totalConsignada,
            vendido: h.totalVendida,
            comissao: h.comissaoPaga,
            itensDesc: `${h.totalVendida} peças acertadas`
          });
        });
      }
    });

    const fat = acertosCompletos.find(f => f.id === faturamentoId);
    if (!fat) return;

    // Simulação visual de emissão na SEFAZ
    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop active";
    backdrop.style.zIndex = 10000;
    backdrop.innerHTML = `
      <div class="modal-card" style="max-width: 450px; text-align: center; padding: 2rem; background: var(--bg-card); border: var(--border-gold); border-radius: var(--radius-lg);">
        <i class="fa-solid fa-server fa-spin" style="font-size: 3rem; color: var(--gold-primary); margin-bottom: 1.5rem;"></i>
        <h3 style="font-family: var(--font-title); color: var(--gold-light); margin-bottom: 0.5rem;">Processando Transmissão</h3>
        <p style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 1rem;">Conectando com o servidor da SEFAZ autorizadora...</p>
        <div style="width: 100%; height: 6px; background: #222; border-radius: 3px; overflow: hidden; margin-top: 1rem;">
          <div id="sefaz-progress" style="width: 0%; height: 100%; background: var(--gold-gradient); border-radius: 3px; transition: width 0.3s ease;"></div>
        </div>
        <span id="sefaz-status" style="font-size: 0.75rem; color: var(--text-muted); display: block; margin-top: 0.5rem;">Assinando documento digitalmente...</span>
      </div>
    `;
    document.body.appendChild(backdrop);

    const progress = backdrop.querySelector("#sefaz-progress");
    const status = backdrop.querySelector("#sefaz-status");

    setTimeout(() => { progress.style.width = "30%"; status.innerText = "Validando dados fiscais do destinatário..."; }, 600);
    setTimeout(() => { progress.style.width = "65%"; status.innerText = "Transmitindo XML de lote para a SEFAZ São Paulo..."; }, 1200);
    setTimeout(() => { progress.style.width = "90%"; status.innerText = "Aguardando autorização de uso..."; }, 1800);
    
    setTimeout(async () => {
      progress.style.width = "100%"; 
      status.innerText = "Autorização de Uso concedida!"; 

      let nfs = JSON.parse(localStorage.getItem("conectajoias_nfe_emitidas") || "[]");
      const numNota = Math.floor(100000 + Math.random() * 900000);
      const chaveAcesso = "352606" + "12345678000199" + "55" + "001" + numNota.toString().padStart(9, "0") + "1" + Math.floor(100000000 + Math.random() * 900000000).toString();

      const novaNota = {
        id: `nf-${Date.now()}`,
        idOrigem: fat.id,
        dataEmissao: new Date().toISOString(),
        chave: chaveAcesso,
        destinatario: fat.destinatario,
        cpf: fat.cpf,
        valorTotal: fat.valorTotal,
        numNota,
        itensDesc: fat.itensDesc
      };

      nfs.push(novaNota);
      localStorage.setItem("conectajoias_nfe_emitidas", JSON.stringify(nfs));

      backdrop.remove();
      this.toast(`Nota Fiscal Nº ${numNota} autorizada e emitida com sucesso!`, "success");
      this.carregarNotasFiscais();
    }, 2500);
  },

  visualizarDANFE: function(notaId) {
    let nfs = JSON.parse(localStorage.getItem("conectajoias_nfe_emitidas") || "[]");
    const nf = nfs.find(n => n.id === notaId);
    if (!nf) return;

    document.getElementById("danfe-chave").innerText = nf.chave.replace(/(.{4})/g, '$1 ');
    document.getElementById("danfe-dest-nome").innerText = nf.destinatario.toUpperCase();
    document.getElementById("danfe-dest-cpf").innerText = nf.cpf;
    document.getElementById("danfe-data-emissao").innerText = new Date(nf.dataEmissao).toLocaleDateString('pt-BR');
    document.getElementById("danfe-valor-total").innerText = `R$ ${nf.valorTotal.toFixed(2).replace(".", ",")}`;

    const tbody = document.getElementById("danfe-itens-tbody");
    tbody.innerHTML = `
      <tr>
        <td style="padding: 5px 0;">001</td>
        <td style="padding: 5px 0;">COMISSAO / ACERTO DE CONSIGNACAO DE SEMIJOIAS - ${nf.itensDesc.toUpperCase()}</td>
        <td style="padding: 5px 0; text-align: center;">1</td>
        <td style="padding: 5px 0;">R$ ${nf.valorTotal.toFixed(2).replace(".", ",")}</td>
        <td style="padding: 5px 0; text-align: right;">R$ ${nf.valorTotal.toFixed(2).replace(".", ",")}</td>
      </tr>
    `;

    const modal = document.getElementById("modal-danfe");
    modal.style.display = "flex";
    modal.classList.add("active");

    document.getElementById("btn-close-modal-danfe").onclick = () => {
      modal.style.display = "none";
      modal.classList.remove("active");
    };
  },

  carregarCentralWhatsApp: async function() {
    const tbody = document.getElementById("tbody-whatsapp-fila");
    if (!tbody) return;

    try {
      let fila = [];
      if (this.state.token && !this.state.token.startsWith("mock_")) {
        fila = await this.requisitarAPI("/whatsapp/fila");
      } else {
        fila = JSON.parse(localStorage.getItem("conectajoias_whatsapp_mock") || "[]");
      }

      if (fila.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-secondary); padding: 1.5rem;">Nenhuma notificação na fila do WhatsApp.</td></tr>`;
      } else {
        tbody.innerHTML = fila.map(m => {
          const statusCor = m.status === "PENDENTE" ? "var(--warning)" : "#81c784";
          const statusTxt = m.status === "PENDENTE" ? "Pendente" : "Enviado";
          
          let acaoBtn = "";
          if (m.status === "PENDENTE") {
            acaoBtn = `
              <button class="btn-gold" style="padding: 0.3rem 0.6rem; font-size: 0.8rem; background: linear-gradient(135deg, #2e7d32, #43a047); border-color: #43a047; color: white;" onclick="app.dispararMensagemFila('${m.id}', '${m.numero}', '${encodeURIComponent(m.mensagem)}')">
                <i class="fa-brands fa-whatsapp"></i> Disparar Link
              </button>
            `;
          } else {
            acaoBtn = `<span style="font-size: 0.8rem; color: var(--text-muted);"><i class="fa-solid fa-circle-check"></i> Disparado</span>`;
          }

          return `
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
              <td style="padding: 12px; font-size: 0.8rem; color: var(--text-secondary);">${new Date(m.createdAt).toLocaleString('pt-BR')}</td>
              <td style="padding: 12px; font-weight: bold;">${m.numero}</td>
              <td style="padding: 12px; color: var(--gold-light); font-size: 0.85rem;">${m.tipo}</td>
              <td style="padding: 12px; max-width: 250px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${m.mensagem}">${m.mensagem}</td>
              <td style="padding: 12px; color: ${statusCor}; font-weight: 500;">${statusTxt}</td>
              <td style="padding: 12px;">${acaoBtn}</td>
            </tr>
          `;
        }).join("");
      }
    } catch (error) {
      console.error(error);
      this.toast("Erro ao carregar fila do WhatsApp: " + error.message, "error");
    }
  },

  dispararMensagemFila: async function(id, numero, msgEnc) {
    const msg = decodeURIComponent(msgEnc);
    const phoneClean = numero.replace(/\D/g, "");
    const waUrl = `https://api.whatsapp.com/send?phone=55${phoneClean}&text=${encodeURIComponent(msg)}`;
    window.open(waUrl, "_blank");

    try {
      if (this.state.token && !this.state.token.startsWith("mock_")) {
        await this.requisitarAPI(`/whatsapp/enviar/${id}`, "POST");
      } else {
        let mockFila = JSON.parse(localStorage.getItem("conectajoias_whatsapp_mock") || "[]");
        const foundIdx = mockFila.findIndex(m => m.id === id);
        if (foundIdx !== -1) {
          mockFila[foundIdx].status = "ENVIADO";
          localStorage.setItem("conectajoias_whatsapp_mock", JSON.stringify(mockFila));
        }
      }
      this.toast("Mensagem marcada como disparada!", "success");
      this.carregarCentralWhatsApp();
    } catch (e) {
      this.toast("Erro ao marcar envio no servidor: " + e.message, "error");
    }
  },

  carregarTreinamentosAdmin: async function() {
    const tbody = document.getElementById("tbody-admin-treinamentos");
    if (!tbody) return;

    try {
      let lista = [];
      if (this.state.token && !this.state.token.startsWith("mock_")) {
        lista = await this.requisitarAPI("/treinamentos");
      } else {
        lista = JSON.parse(localStorage.getItem("conectajoias_treinamentos_mock") || "[]");
      }

      if (lista.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-secondary); padding: 1.5rem;">Nenhum treinamento cadastrado.</td></tr>`;
      } else {
        tbody.innerHTML = lista.map(t => `
          <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
            <td style="padding: 12px; font-weight: bold;">${t.titulo}</td>
            <td style="padding: 12px; color: var(--gold-light); font-size: 0.85rem;">${t.tipo}</td>
            <td style="padding: 12px; max-width: 250px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;"><a href="${t.url}" target="_blank" style="color: var(--gold-primary);">${t.url}</a></td>
            <td style="padding: 12px;">
              <button class="btn-danger-outline" style="padding: 0.3rem 0.6rem; font-size: 0.8rem;" onclick="app.excluirTreinamento('${t.id}')">
                <i class="fa-solid fa-trash"></i> Excluir
              </button>
            </td>
          </tr>
        `).join("");
      }
    } catch (error) {
      console.error(error);
    }
  },

  cadastrarTreinamento: async function() {
    const titulo = document.getElementById("trein-titulo").value.trim();
    const descricao = document.getElementById("trein-desc").value.trim();
    const tipo = document.getElementById("trein-tipo").value;
    const url = document.getElementById("trein-url").value.trim();

    if (!titulo || !url) {
      this.toast("Título e URL são obrigatórios.", "warning");
      return;
    }

    try {
      if (this.state.token && !this.state.token.startsWith("mock_")) {
        await this.requisitarAPI("/treinamentos", "POST", { titulo, descricao, tipo, url });
      } else {
        let mockList = JSON.parse(localStorage.getItem("conectajoias_treinamentos_mock") || "[]");
        mockList.push({ id: `t-${Date.now()}`, titulo, descricao, tipo, url });
        localStorage.setItem("conectajoias_treinamentos_mock", JSON.stringify(mockList));
      }

      this.toast("Treinamento cadastrado com sucesso!", "success");
      document.getElementById("trein-titulo").value = "";
      document.getElementById("trein-desc").value = "";
      document.getElementById("trein-url").value = "";
      this.carregarTreinamentosAdmin();
    } catch (e) {
      this.toast("Erro ao cadastrar treinamento: " + e.message, "error");
    }
  },

  excluirTreinamento: async function(id) {
    if (!await this.confirmar("Deseja realmente excluir este conteúdo de treinamento?")) return;

    try {
      if (this.state.token && !this.state.token.startsWith("mock_")) {
        await this.requisitarAPI(`/treinamentos/${id}`, "DELETE");
      } else {
        let mockList = JSON.parse(localStorage.getItem("conectajoias_treinamentos_mock") || "[]");
        mockList = mockList.filter(t => t.id !== id);
        localStorage.setItem("conectajoias_treinamentos_mock", JSON.stringify(mockList));
      }
      this.toast("Conteúdo removido!", "success");
      this.carregarTreinamentosAdmin();
    } catch (e) {
      this.toast("Erro ao excluir: " + e.message, "error");
    }
  },

  carregarCofreDocumentos: async function() {
    const containerRespostas = document.getElementById("onboarding-respostas-container");
    const containerDocs = document.getElementById("cofre-documentos-list");
    const revId = this.state.revendedoraSelecionadaId;
    if (!revId) return;

    try {
      let data = null;
      if (this.state.token && !this.state.token.startsWith("mock_")) {
        data = await this.requisitarAPI(`/usuarios/${revId}/documentos`);
      }

      if (containerRespostas) {
        if (data && data.respostaOnboarding) {
          const res = data.respostaOnboarding;
          containerRespostas.innerHTML = `
            <p style="margin-bottom: 0.5rem;"><strong>Quem Indicou:</strong> ${res.vendedoraPrincipal}</p>
            <p style="margin-bottom: 0.5rem;"><strong>Como Conheceu a Marca:</strong> ${res.comoConheceu}</p>
            <p style="margin-bottom: 0.5rem;"><strong>Experiência com Vendas:</strong> ${res.experienciaVendas}</p>
            <p style="margin-bottom: 0.5rem;"><strong>Comentários:</strong> ${res.comentarios || "Sem comentários"}</p>
          `;
        } else {
          containerRespostas.innerHTML = `
            <p style="margin-bottom: 0.5rem;"><strong>Quem Indicou:</strong> Conecta Joias Principal</p>
            <p style="margin-bottom: 0.5rem;"><strong>Como Conheceu a Marca:</strong> Indicação Direta</p>
            <p style="margin-bottom: 0.5rem;"><strong>Experiência com Vendas:</strong> Experiente (Vende cosméticos)</p>
            <p style="margin-bottom: 0.5rem;"><strong>Comentários:</strong> Deseja focar em brincos e colares cravejados.</p>
          `;
        }
      }

      if (containerDocs) {
        if (data && data.documentos && data.documentos.length > 0) {
          containerDocs.innerHTML = data.documentos.map(doc => `
            <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); padding: 0.8rem; border-radius: var(--radius-sm);">
              <div>
                <strong>${doc.tipo}</strong><br>
                <small style="color: var(--text-muted);">${doc.nomeArquivo}</small>
              </div>
              <a href="http://localhost:5000${doc.caminhoUrl}" target="_blank" class="btn-qty" style="color: var(--gold-primary); text-decoration: none; padding: 4px 8px; display: inline-flex; align-items: center; gap: 5px;">
                <i class="fa-solid fa-download"></i> Baixar
              </a>
            </div>
          `).join("");
        } else {
          containerDocs.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); padding: 0.8rem; border-radius: var(--radius-sm);">
              <div>
                <strong>RG (Frente/Verso)</strong><br>
                <small style="color: var(--text-muted);">rg_revendedora.jpg</small>
              </div>
              <a href="#" onclick="alert('Fazendo download fictício do RG...'); return false;" class="btn-qty" style="color: var(--gold-primary); text-decoration: none; padding: 4px 8px; display: inline-flex; align-items: center; gap: 5px;">
                <i class="fa-solid fa-download"></i> Baixar
              </a>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); padding: 0.8rem; border-radius: var(--radius-sm);">
              <div>
                <strong>Comprovante Residência</strong><br>
                <small style="color: var(--text-muted);">comprovante_endereco.pdf</small>
              </div>
              <a href="#" onclick="alert('Fazendo download fictício do comprovante...'); return false;" class="btn-qty" style="color: var(--gold-primary); text-decoration: none; padding: 4px 8px; display: inline-flex; align-items: center; gap: 5px;">
                <i class="fa-solid fa-download"></i> Baixar
              </a>
            </div>
          `;
        }
      }

    } catch (e) {
      console.error(e);
    }
  },

  carregarTermosRevendedora: async function() {
    const tbody = document.getElementById("tbody-termos-consignacao");
    if (!tbody) return;
    
    const revId = this.state.revendedoraSelecionadaId;
    if (!revId) return;

    try {
      let termos = [];
      if (this.state.token && !this.state.token.startsWith("mock_")) {
        termos = await this.requisitarAPI("/termos");
        termos = termos.filter(t => t.usuarioId === revId);
      } else {
        termos = JSON.parse(localStorage.getItem("conectajoias_termos_mock") || "[]");
        termos = termos.filter(t => t.usuarioId === revId);
      }

      if (termos.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-secondary); padding: 1.5rem;">Nenhum termo de consignação gerado ainda.</td></tr>`;
      } else {
        tbody.innerHTML = termos.map(t => {
          const statusCor = t.status === "PENDENTE" ? "var(--warning)" : "#81c784";
          const statusTxt = t.status === "PENDENTE" ? "Pendente" : "Assinado";
          const assinadoPor = t.assinaturaNome ? `${t.assinaturaNome} (${t.assinaturaCpf})` : "-";

          let acaoBtn = "";
          if (t.status === "ASSINADO") {
            acaoBtn = `
              <button class="btn-qty" style="color: var(--gold-primary);" onclick="app.visualizarTermoAssinado('${t.id}')">
                <i class="fa-solid fa-eye"></i> Ver Assinatura
              </button>
            `;
          } else {
            const linkAssinatura = `termo_assinatura.html?id=${t.id}`;
            acaoBtn = `
              <button class="btn-qty" style="color: var(--gold-light);" onclick="navigator.clipboard.writeText('${window.location.origin}/${linkAssinatura}').then(() => alert('Link copiado!'));" title="Copiar Link de Assinatura">
                <i class="fa-solid fa-copy"></i> Copiar Link
              </button>
            `;
          }

          return `
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
              <td style="padding: 10px 8px;">${new Date(t.createdAt).toLocaleDateString('pt-BR')}</td>
              <td style="padding: 10px 8px; font-weight: bold; max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${t.titulo}">${t.titulo}</td>
              <td style="padding: 10px 8px; color: ${statusCor}; font-weight: 600;">${statusTxt}</td>
              <td style="padding: 10px 8px; font-size: 0.8rem;">${assinadoPor}</td>
              <td style="padding: 10px 8px;">${acaoBtn}</td>
            </tr>
          `;
        }).join("");
      }
    } catch (e) {
      console.error(e);
    }
  },

  gerarTermoConsignacao: async function() {
    const revId = this.state.revendedoraSelecionadaId;
    if (!revId) return;

    const titulo = document.getElementById("termo-titulo").value.trim();
    const prazo = document.getElementById("termo-prazo").value;
    const conteudo = document.getElementById("termo-conteudo").value.trim();

    if (!titulo || !conteudo) {
      this.toast("Título e conteúdo do termo são obrigatórios.", "warning");
      return;
    }

    try {
      if (this.state.token && !this.state.token.startsWith("mock_")) {
        await this.requisitarAPI("/termos/gerar", "POST", {
          usuarioId: revId,
          titulo,
          conteudo,
          prazoDevolucao: prazo || null
        });
      } else {
        let mockTermos = JSON.parse(localStorage.getItem("conectajoias_termos_mock") || "[]");
        mockTermos.push({
          id: `termo-${Date.now()}`,
          usuarioId: revId,
          titulo,
          conteudo,
          status: "PENDENTE",
          createdAt: new Date().toISOString(),
          prazoDevolucao: prazo ? new Date(prazo).toISOString() : null
        });
        localStorage.setItem("conectajoias_termos_mock", JSON.stringify(mockTermos));
      }

      this.toast("Termo de consignação gerado com sucesso!", "success");
      document.getElementById("termo-prazo").value = "";
      this.carregarTermosRevendedora();

    } catch (e) {
      this.toast("Erro ao gerar termo: " + e.message, "error");
    }
  },

  visualizarTermoAssinado: async function(termoId) {
    let termos = [];
    if (this.state.token && !this.state.token.startsWith("mock_")) {
      termos = await this.requisitarAPI("/termos");
    } else {
      termos = JSON.parse(localStorage.getItem("conectajoias_termos_mock") || "[]");
    }

    const t = termos.find(item => item.id === termoId);
    if (!t) return;

    document.getElementById("ver-termo-titulo").innerText = t.titulo;
    document.getElementById("ver-termo-nome").innerText = t.assinaturaNome || "-";
    document.getElementById("ver-termo-cpf").innerText = t.assinaturaCpf || "-";
    document.getElementById("ver-termo-ip").innerText = t.assinaturaIp || "-";
    document.getElementById("ver-termo-data").innerText = t.dataAssinatura ? new Date(t.dataAssinatura).toLocaleString('pt-BR') : "-";
    
    const img = document.getElementById("ver-termo-assinatura-img");
    img.src = t.assinaturaImg || "https://images.unsplash.com/photo-1598257006458-087169a1f08d?q=80&w=150";

    const modal = document.getElementById("modal-ver-termo");
    modal.style.display = "flex";
    modal.classList.add("active");

    document.getElementById("btn-close-modal-ver-termo").onclick = () => {
      modal.style.display = "none";
      modal.classList.remove("active");
    };
  },

  reiniciarComissoesRevendedora: async function() {
    const revId = this.state.revendedoraSelecionadaId;
    if (!revId) return;

    if (!await this.confirmar("Deseja realmente reiniciar o ciclo de comissões/metas desta revendedora? Isso agendará uma notificação no WhatsApp dela.")) {
      return;
    }

    try {
      if (this.state.token && !this.state.token.startsWith("mock_")) {
        await this.requisitarAPI(`/revendedoras/${revId}/reiniciar-comissoes`, "POST");
      } else {
        const rev = this.state.revendedoras.find(r => r.id === revId);
        let mockFila = JSON.parse(localStorage.getItem("conectajoias_whatsapp_mock") || "[]");
        mockFila.push({
          id: `w-${Date.now()}`,
          numero: rev.whatsapp || "000000000",
          mensagem: `Olá ${rev.nome}! O ciclo de metas e comissões da Conecta Joias foi reiniciado hoje. Suas vendas do período foram liquidadas e você já pode cadastrar novos clientes e vendas. Boa sorte! 💼💎`,
          tipo: "REINICIO_COMISSAO",
          status: "PENDENTE",
          createdAt: new Date().toISOString()
        });
        localStorage.setItem("conectajoias_whatsapp_mock", JSON.stringify(mockFila));
      }
      this.toast("Ciclo de comissões reiniciado e WhatsApp agendado!", "success");
    } catch (e) {
      this.toast("Erro ao reiniciar ciclo: " + e.message, "error");
    }
  },

  wizardStep: 1,

  abrirOnboardingWizard: function() {
    this.wizardStep = 1;
    this.atualizarPassoWizard();
    document.getElementById("modal-onboarding-wizard").style.display = "flex";
  },

  atualizarPassoWizard: function() {
    for (let i = 1; i <= 3; i++) {
      const stepEl = document.getElementById(`wizard-step-${i}`);
      if (stepEl) stepEl.style.display = "none";
    }
    const currentStepEl = document.getElementById(`wizard-step-${this.wizardStep}`);
    if (currentStepEl) currentStepEl.style.display = "block";
    
    const dots = document.querySelectorAll("#wizard-steps-indicator .step-dot");
    dots.forEach((dot, idx) => {
      if (idx === this.wizardStep - 1) {
        dot.classList.add("active");
        dot.style.background = "var(--gold-primary)";
      } else {
        dot.classList.remove("active");
        dot.style.background = "rgba(255,255,255,0.2)";
      }
    });

    const btnPrev = document.getElementById("btn-wizard-prev");
    const btnNext = document.getElementById("btn-wizard-next");
    
    if (this.wizardStep === 1) {
      if (btnPrev) btnPrev.style.visibility = "hidden";
    } else {
      if (btnPrev) btnPrev.style.visibility = "visible";
    }
    
    if (btnNext) {
      if (this.wizardStep === 3) {
        btnNext.innerHTML = '<i class="fa-solid fa-check"></i> Concluir';
      } else {
        btnNext.innerHTML = 'Avançar <i class="fa-solid fa-chevron-right"></i>';
      }
    }
  },

  avancarWizard: async function() {
    if (this.wizardStep < 3) {
      this.wizardStep++;
      this.atualizarPassoWizard();
    } else {
      const nomeComercial = document.getElementById("wz-nome-comercial").value.trim();
      const whatsapp = document.getElementById("wz-whatsapp").value.trim();
      
      if (!nomeComercial) {
        this.toast("Por favor, preencha o Nome Comercial da sua marca.", "warning");
        this.wizardStep = 1;
        this.atualizarPassoWizard();
        return;
      }
      
      if (!whatsapp) {
        this.toast("Por favor, preencha o WhatsApp de Atendimento.", "warning");
        this.wizardStep = 2;
        this.atualizarPassoWizard();
        return;
      }

      const btnNext = document.getElementById("btn-wizard-next");
      if (btnNext) {
        btnNext.disabled = true;
        btnNext.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Salvando...';
      }

      try {
        const segmento = document.getElementById("wz-segmento").value;
        const estiloLoja = document.getElementById("wz-estilo-visual").value;
        const temaPref = document.getElementById("wz-tema").value;
        const corPrimaria = document.getElementById("wz-cor-primaria").value;
        const corSecundaria = document.getElementById("wz-cor-secundaria").value;
        
        let logoUrl = "";
        const logoFile = document.getElementById("wz-logo-file").files[0];
        if (logoFile) {
          const formData = new FormData();
          formData.append("imagem", logoFile);
          
          const uploadResp = await fetch(`${this.state.apiUrl}/uploads`, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${this.state.token}`
            },
            body: formData
          });
          if (uploadResp.ok) {
            const uploadData = await uploadResp.json();
            logoUrl = uploadData.url;
          }
        }

        const body = {
          nomeEmpresa: nomeComercial,
          logoUrl,
          corPrimaria,
          corSecundaria,
          whatsappAtendimento: whatsapp,
          temaPref,
          segmento,
          estiloLoja,
          onboardingCompleto: true
        };

        const response = await fetch(`${this.state.apiUrl}/config`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${this.state.token}`,
            "x-loja-id": localStorage.getItem("conectajoias_loja_id") || "default-loja"
          },
          body: JSON.stringify(body)
        });

        if (response.ok) {
          const configSalva = await response.json();
          this.aplicarConfiguracoes(configSalva);
          document.getElementById("modal-onboarding-wizard").style.display = "none";
          this.toast("Sua loja foi personalizada com sucesso! ✨ Recomendamos recarregar para aplicar o tema.", "success");
        } else {
          const err = await response.json();
          throw new Error(err.error || "Erro ao salvar configuração.");
        }
      } catch (error) {
        console.error("Erro no onboarding wizard:", error);
        this.toast("Erro ao salvar personalização: " + error.message, "error");
      } finally {
        if (btnNext) {
          btnNext.disabled = false;
          btnNext.innerHTML = '<i class="fa-solid fa-check"></i> Concluir';
        }
      }
    }
  },

  voltarWizard: function() {
    if (this.wizardStep > 1) {
      this.wizardStep--;
      this.atualizarPassoWizard();
    }
  }

};

// Funções auxiliares para manipulação de cores HEX e aplicação de tema visual white-label

function aplicarTemaLoja(tema) {
  if (!tema) return;

  const temaPrefUpper = (tema.temaPref || '').toUpperCase();
  const isLight = (temaPrefUpper === 'CLARO' || temaPrefUpper === 'LIGHT') || 
                  ((temaPrefUpper === 'SISTEMA' || temaPrefUpper === 'SYSTEM' || !temaPrefUpper) && 
                   window.matchMedia && !window.matchMedia('(prefers-color-scheme: dark)').matches);

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

  const defaultBgPrimary = isLight ? '#f5f5f5' : '#0a0a0a';
  const defaultBgCard = isLight ? '#ffffff' : '#121212';

  const bgPrimary = tema.bgPrimary && tema.bgPrimary !== '#0a0a0a' ? tema.bgPrimary : defaultBgPrimary;
  const bgCard = tema.bgCard && tema.bgCard !== '#121212' ? tema.bgCard : defaultBgCard;
  const bgAbsolute = alterarBrilhoHex(bgPrimary, -10);

  document.documentElement.style.setProperty('--bg-primary', bgPrimary);
  document.documentElement.style.setProperty('--bg-absolute', bgAbsolute);
  document.documentElement.style.setProperty('--bg-card', bgCard);
  document.documentElement.style.setProperty('--bg-card-hover', alterarBrilhoHex(bgCard, isLight ? -8 : 8));
  document.documentElement.style.setProperty('--bg-modal', alterarBrilhoHex(bgCard, isLight ? -5 : 5));

  if (isLight) {
    document.documentElement.style.setProperty('--text-primary', '#111111');
    document.documentElement.style.setProperty('--text-secondary', '#495057');
    document.documentElement.style.setProperty('--text-muted', '#868e96');
    document.documentElement.style.setProperty('--text-dark', '#ffffff');
  } else {
    document.documentElement.style.setProperty('--text-primary', '#f5f5f5');
    document.documentElement.style.setProperty('--text-secondary', '#a0a0a0');
    document.documentElement.style.setProperty('--text-muted', '#666666');
    document.documentElement.style.setProperty('--text-dark', '#0a0a0a');
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
