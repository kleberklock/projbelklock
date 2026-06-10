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
    feedImagens: [],
    abaAtiva: "dashboard",
    subAbaMktAtiva: "feed",
    revendedoraSelecionadaId: null,
    usandoFicticio: true,
    colunasEstoque: ["Código", "Nome do Produto", "Categoria", "Estoque Central", "Custo Bruto", "Custo Banho", "Custo Oper.", "Markup", "Preço Venda"]
  },

  // 2. Inicialização do Aplicativo
  init: function() {
    this.registrarEventosLogin();
    
    // Verifica se há sessão ativa no LocalStorage
    const token = localStorage.getItem("belklock_token");
    const usuario = localStorage.getItem("belklock_usuario");
    
    if (token && usuario) {
      this.state.token = token;
      this.state.usuarioLogado = JSON.parse(usuario);
      this.exibirInterfacePosLogin();
      this.carregarDadosIniciais();
    } else {
      this.exibirInterfaceLogin();
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
        if (email === "admin@belklock.com" && senha === "admin123") {
          console.warn("Servidor Azure API offline. Iniciando em Modo de Demonstração (Admin local).");
          this.state.token = "mock_admin_token_" + Date.now();
          this.state.usuarioLogado = {
            id: "admin_local",
            nome: "Bel Klock Admin (Local)",
            email: "admin@belklock.com",
            role: "admin",
            comissao: 0.0
          };
          localStorage.setItem("belklock_token", this.state.token);
          localStorage.setItem("belklock_usuario", JSON.stringify(this.state.usuarioLogado));
          
          this.exibirInterfacePosLogin();
          this.carregarDadosIniciais();
          alert("Aviso: Servidor local offline. Iniciando em Modo de Demonstração (Perfil Administrador).");
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
              role: "revendedora",
              comissao: revLocal.comissao
            };
            localStorage.setItem("belklock_token", this.state.token);
            localStorage.setItem("belklock_usuario", JSON.stringify(this.state.usuarioLogado));
            
            this.exibirInterfacePosLogin();
            this.carregarDadosIniciais();
            alert(`Aviso: Servidor local offline. Iniciando em Modo de Demonstração (Perfil Revendedora: ${revLocal.nome}).`);
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
    
    this.exibirInterfaceLogin();
  },

  exibirInterfaceLogin: function() {
    document.getElementById("login-container").style.display = "flex";
    document.getElementById("app-main-container").style.display = "none";
    
    // Limpa campos de login
    document.getElementById("login-email").value = "";
    document.getElementById("login-senha").value = "";
    document.getElementById("login-error-msg").style.display = "none";
  },

  exibirInterfacePosLogin: function() {
    document.getElementById("login-container").style.display = "none";
    document.getElementById("app-main-container").style.display = "flex";
    
    // Ajusta visualização baseado no perfil
    this.aplicarRestricoesPerfil();
  },

  aplicarRestricoesPerfil: function() {
    const role = this.state.usuarioLogado ? this.state.usuarioLogado.role : "revendedora";
    
    const menuPlanilhas = document.querySelector('.nav-item[data-target="planilhas"]');
    const menuRevendedoras = document.querySelector('.nav-item[data-target="revendedoras"]');
    const btnCadastrarProduto = document.getElementById("btn-open-modal-produto");
    const divHeaderActions = document.querySelector("#dashboard .header-actions");

    if (role === "revendedora") {
      // Oculta itens restritos da Sidebar
      if (menuPlanilhas) menuPlanilhas.style.display = "none";
      if (menuRevendedoras) menuRevendedoras.style.display = "none";
      if (btnCadastrarProduto) btnCadastrarProduto.style.display = "none";
      if (divHeaderActions) divHeaderActions.style.display = "none";
      
      // Se a aba ativa for restrita, redireciona para o dashboard
      if (this.state.abaAtiva === "planilhas" || this.state.abaAtiva === "revendedoras") {
        this.state.abaAtiva = "dashboard";
      }
    } else {
      // Exibe itens para Admin
      if (menuPlanilhas) menuPlanilhas.style.display = "block";
      if (menuRevendedoras) menuRevendedoras.style.display = "block";
      if (btnCadastrarProduto) btnCadastrarProduto.style.display = "inline-flex";
      if (divHeaderActions) divHeaderActions.style.display = "block";
    }
  },

  carregarDadosIniciais: async function() {
    this.registrarEventosUI();
    this.inicializarFeedPadrao();
    
    // Dispara carregamento assíncrono dos dados da API
    await this.carregarProdutosDaAPI();
    
    if (this.state.usuarioLogado.role === 'admin') {
      await this.carregarRevendedorasDaAPI();
    } else {
      await this.carregarMaletaPropriaDaAPI();
    }
    
    this.renderizarAbas();
    this.renderizarEstoque();
    this.renderizarRevendedoras();
    this.renderizarDashboard();
    this.renderizarMarketing();
    
    console.log("BelKlock Semijoias inicializado com sucesso!");
  },

  // ==========================================
  // COMUNICAÇÃO COM A API DA AZURE (HTTP / JWT)
  // ==========================================

  requisitarAPI: async function(endpoint, metodo = "GET", body = null) {
    const headers = {
      "Authorization": `Bearer ${this.state.token}`
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

  // 3. Persistência de Dados (Métodos de fallback / legados mantidos para portabilidade)
  carregarDadosDoLocalStorage: function() {
    try {
      const produtosSalvos = localStorage.getItem("belklock_produtos");
      const revendedorasSalvas = localStorage.getItem("belklock_revendedoras");
      const feedSalvo = localStorage.getItem("belklock_feed");
      const ficticioSalvo = localStorage.getItem("belklock_usando_ficticio");
      const colunasSalvas = localStorage.getItem("belklock_colunas");

      this.state.usandoFicticio = ficticioSalvo ? JSON.parse(ficticioSalvo) : true;
      this.state.colunasEstoque = colunasSalvas ? JSON.parse(colunasSalvas) : ["Código", "Nome do Produto", "Categoria", "Estoque Central", "Custo Bruto", "Custo Banho", "Custo Oper.", "Markup", "Preço Venda"];

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
    document.getElementById("btn-view-all-stock").addEventListener("click", () => this.navegarParaAba("estoque"));

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

    // Salvar Produto
    document.getElementById("btn-salvar-produto").addEventListener("click", () => this.salvarNovoProduto());

    // Salvar Revendedora
    document.getElementById("btn-salvar-revendedora").addEventListener("click", () => this.salvarNovaRevendedora());

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

    // Excel
    document.getElementById("btn-exportar-estoque").addEventListener("click", () => ExcelHandler.exportarEstoque(this.state.produtos, this.state.colunasEstoque));
    document.getElementById("btn-trigger-import-file").addEventListener("click", () => document.getElementById("input-import-excel").click());
    document.getElementById("input-import-excel").addEventListener("change", (e) => this.processarImportacaoExcel(e));
    document.getElementById("btn-limpar-ficticios").addEventListener("click", () => this.zerarDadosDemonstracao());

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
          alert("Por favor, envie apenas planilhas no formato .csv");
        }
      }
    });
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
    if (tabId === "estoque") this.renderizarEstoque();
    if (tabId === "revendedoras") this.renderizarRevendedoras();
    if (tabId === "marketing") this.renderizarMarketing();
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

    // 2. Alertas de estoque crítico (Qtd <= 3)
    const tableAlertasBody = document.querySelector("#table-alertas tbody");
    tableAlertasBody.innerHTML = "";
    
    const produtosCriticos = this.state.produtos.filter(p => Number(p.quantidade || 0) <= 3);

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
      th.innerText = col;
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
        matchStatus = Number(p.quantidade || 0) <= 3;
      } else if (filtroStatusVal === "disponivel") {
        matchStatus = Number(p.quantidade || 0) > 3;
      }

      return matchBusca && matchCategoria && matchStatus;
    });

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
              <span class="qty-val ${p.quantidade <= 3 ? 'text-danger' : ''}" style="${p.quantidade <= 3 ? 'color: var(--danger); font-weight: 700;' : ''}">${p.quantidade}</span>
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

  alterarQtdEstoque: function(prodId, delta) {
    const prod = this.state.produtos.find(p => p.id === prodId);
    if (prod) {
      const novaQtd = Number(prod.quantidade || 0) + delta;
      if (novaQtd >= 0) {
        prod.quantidade = novaQtd;
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
    
    // Reseta id de edição
    document.getElementById("btn-salvar-produto").removeAttribute("data-edit-id");
    document.querySelector("#modal-produto h3").innerText = "Nova Semijoia";
  },

  salvarNovoProduto: async function() {
    const nome = document.getElementById("prod-nome").value.trim();
    const categoria = document.getElementById("prod-categoria").value;
    const quantidade = parseInt(document.getElementById("prod-quantidade").value) || 0;
    
    if (!nome) {
      alert("Por favor, preencha o nome do produto.");
      return;
    }

    const codigoInput = document.getElementById("prod-codigo").value.trim();
    const codigo = codigoInput ? codigoInput : "REF-" + Math.floor(1000 + Math.random() * 9000);
    
    const custoBruto = parseFloat(document.getElementById("prod-bruto").value) || 0;
    const custoBanho = parseFloat(document.getElementById("prod-banho").value) || 0;
    const custoLiquido = parseFloat(document.getElementById("prod-liquido").value) || 0;
    const markup = parseFloat(document.getElementById("prod-markup").value) || 1.0;

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
        markup
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
      alert(editId ? "Produto atualizado com sucesso!" : "Produto cadastrado com sucesso!");
    } catch (error) {
      console.error(error);
      alert("Erro ao salvar produto no banco de dados Azure: " + error.message);
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

      document.getElementById("btn-salvar-produto").setAttribute("data-edit-id", prodId);
      document.querySelector("#modal-produto h3").innerText = "Editar Semijoia";
      
      this.calcularPrecificacaoDinamicamente();
      document.getElementById("modal-produto").classList.add("active");
    }
  },

  excluirProduto: async function(prodId) {
    if (confirm("Tem certeza que deseja excluir esta semijoia do seu estoque?")) {
      try {
        if (this.state.token) {
          await this.requisitarAPI(`/produtos/${prodId}`, "DELETE");
        }

        this.state.produtos = this.state.produtos.filter(p => p.id !== prodId);
        this.salvarDadosNoLocalStorage();
        this.renderizarEstoque();
        this.renderizarDashboard();
        alert("Produto removido com sucesso!");
      } catch (error) {
        console.error(error);
        alert("Erro ao excluir produto na Azure: " + error.message);
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
      alert("Por favor, preencha o nome e o WhatsApp da revendedora.");
      return;
    }

    const senhaInput = document.getElementById("rev-senha").value.trim();
    if (!editId && !senhaInput) {
      alert("Por favor, defina uma senha de acesso para a revendedora.");
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
        alert("Cadastro de revendedora atualizado com sucesso!");
      } else {
        const pinCriado = this.state.revendedoras.find(r => r.id === this.state.revendedoraSelecionadaId).pin;
        alert(`Revendedora cadastrada com sucesso!\n\n🔑 PIN de Acesso: ${pinCriado}\n🔒 Senha: ${senhaInput}\n\nInforme esses dados para a revendedora acessar o aplicativo.`);
      }
    } catch (error) {
      console.error(error);
      alert("Erro ao salvar dados da revendedora no banco de dados Azure: " + error.message);
    }
  },

  excluirRevendedoraSelecionada: function() {
    const rev = this.state.revendedoras.find(r => r.id === this.state.revendedoraSelecionadaId);
    if (rev) {
      if (confirm(`Deseja realmente excluir a revendedora ${rev.nome}? As peças atualmente com ela retornarão automaticamente ao Estoque Central.`)) {
        // Devolve peças consignadas ao estoque central antes de deletar
        rev.consignado.forEach(item => {
          const prod = this.state.produtos.find(p => p.id === item.produtoId);
          if (prod) {
            prod.quantidade = Number(prod.quantidade || 0) + Number(item.quantidadeConsignada || 0);
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
      alert("Estoque insuficiente para uma ou mais peças selecionadas. Verifique os campos em vermelho.");
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
        alert("Peças enviadas para a maleta da revendedora com sucesso!");
      } else {
        alert("Por favor, digite uma quantidade válida maior que zero para consignar.");
      }
    } catch (error) {
      console.error(error);
      alert("Erro ao salvar consignação na Azure: " + error.message);
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
          <td colspan="6" style="text-align: center; color: var(--text-secondary); padding: 2rem;">
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
    if (inputVendido && inputDevolvido) {
      if (acao === 'venda') {
        inputVendido.value = max;
        inputDevolvido.value = 0;
      } else {
        inputVendido.value = 0;
        inputDevolvido.value = max;
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
      if (inputVendido && inputDevolvido) {
        if (acao === 'vender_tudo') {
          inputVendido.value = max;
          inputDevolvido.value = 0;
        } else {
          inputVendido.value = 0;
          inputDevolvido.value = max;
        }
      }
    });
    this.calcularResumoFechamentoAcerto();
  },

  // Garante que Qtd Vendida + Qtd Devolvida = Qtd Consignada
  sincronizarAcertoQuantidades: function(input, acao) {
    const prodId = input.getAttribute("data-prod-id");
    const valor = parseInt(input.value) || 0;
    
    const rev = this.state.revendedoras.find(r => r.id === this.state.revendedoraSelecionadaId);
    const item = rev.consignado.find(c => c.produtoId === prodId);
    
    if (!item) return;
    
    const maxVal = item.quantidadeConsignada;
    
    if (acao === 'vendido') {
      const valorAjustado = Math.min(Math.max(valor, 0), maxVal);
      input.value = valorAjustado;
      
      // Ajusta o correspondente devolvido
      const inputDevolvido = document.querySelector(`.input-acerto-devolvido[data-prod-id="${prodId}"]`);
      if (inputDevolvido) inputDevolvido.value = maxVal - valorAjustado;
    } else {
      const valorAjustado = Math.min(Math.max(valor, 0), maxVal);
      input.value = valorAjustado;
      
      // Ajusta o correspondente vendido
      const inputVendido = document.querySelector(`.input-acerto-vendido[data-prod-id="${prodId}"]`);
      if (inputVendido) inputVendido.value = maxVal - valorAjustado;
    }

    this.calcularResumoFechamentoAcerto();
  },

  obterItensDoAcertoAtual: function() {
    const rev = this.state.revendedoras.find(r => r.id === this.state.revendedoraSelecionadaId);
    if (!rev) return [];

    const itens = [];
    document.querySelectorAll(".input-acerto-vendido").forEach(input => {
      const prodId = input.getAttribute("data-prod-id");
      const qtdVendida = parseInt(input.value) || 0;
      
      const inputDev = document.querySelector(`.input-acerto-devolvido[data-prod-id="${prodId}"]`);
      const qtdDevolvida = inputDev ? (parseInt(inputDev.value) || 0) : 0;
      
      const itemOrigem = rev.consignado.find(c => c.produtoId === prodId);
      if (itemOrigem) {
        itens.push({
          produtoId: prodId,
          codigo: itemOrigem.codigo,
          nome: itemOrigem.nome,
          quantidadeConsignada: itemOrigem.quantidadeConsignada,
          quantidadeVendida: qtdVendida,
          quantidadeDevolvida: qtdDevolvida,
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

    itensAcerto.forEach(item => {
      totalPecasConsignadas += item.quantidadeConsignada;
      faturamentoBruto += Number(item.precoVenda) * item.quantidadeVendida;
    });

    const comissaoValor = faturamentoBruto * (Number(rev.comissao) / 100);
    const liquidoReceber = faturamentoBruto - comissaoValor;

    document.getElementById("acerto-total-peças-levadas").innerText = `${totalPecasConsignadas} pçs`;
    document.getElementById("acerto-total-faturamento-bruto").innerText = `R$ ${faturamentoBruto.toFixed(2).replace(".", ",")}`;
    document.getElementById("acerto-comissao-valor").innerText = `R$ ${comissaoValor.toFixed(2).replace(".", ",")}`;
    document.getElementById("acerto-total-liquido-receber").innerText = `R$ ${liquidoReceber.toFixed(2).replace(".", ",")}`;
  },

  finalizarAcerto: async function(abrirWhatsApp = false) {
    const rev = this.state.revendedoras.find(r => r.id === this.state.revendedoraSelecionadaId);
    if (!rev) return;

    const itensAcerto = this.obterItensDoAcertoAtual();
    if (itensAcerto.length === 0) {
      alert("Não há produtos consignados para fechar.");
      return;
    }

    let faturamentoBruto = 0;
    let totalConsignada = 0;
    let totalVendida = 0;
    let totalDevolvida = 0;

    const postItens = [];

    // Processa os itens no sistema
    itensAcerto.forEach(item => {
      totalConsignada += item.quantidadeConsignada;
      totalVendida += item.quantidadeVendida;
      totalDevolvida += item.quantidadeDevolvida;
      
      faturamentoBruto += Number(item.precoVenda) * item.quantidadeVendida;

      postItens.push({
        produtoId: item.produtoId,
        quantidadeVendida: item.quantidadeVendida,
        quantidadeDevolvida: item.quantidadeDevolvida
      });

      // 1. As devoluções retornam ao Estoque Central localmente para reatividade
      if (item.quantidadeDevolvida > 0) {
        const prodOriginal = this.state.produtos.find(p => p.id === item.produtoId);
        if (prodOriginal) {
          prodOriginal.quantidade = Number(prodOriginal.quantidade || 0) + item.quantidadeDevolvida;
        }
      }
    });

    const valorComissao = faturamentoBruto * (Number(rev.comissao) / 100);
    const valorLiquido = faturamentoBruto - valorComissao;

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
        totalConsignada: totalConsignada,
        totalVendida: totalVendida,
        totalDevolvida: totalDevolvida,
        faturamentoBruto: faturamentoBruto,
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
      
      alert(`Acerto com ${rev.nome} concluído com sucesso e gravado na Azure!\n\nLíquido a receber: R$ ${valorLiquido.toFixed(2).replace(".", ",")}`);
    } catch (error) {
      console.error(error);
      alert("Erro ao finalizar o acerto na Azure: " + error.message);
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
        postDiv.addEventListener("click", () => {
          if (confirm("Remover esta publicação do planejador de feed?")) {
            this.state.feedImagens.splice(index, 1);
            this.salvarDadosNoLocalStorage();
            this.renderizarMarketing();
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
      alert("Legenda copiada com sucesso! Pronta para postar no Instagram. ✨📲");
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
        alert("Imagem salva no contêiner da Azure com sucesso! Link público gerado.");
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

  reiniciarFeedPadrao: function() {
    if (confirm("Deseja realmente resetar e voltar ao feed padrão inicial?")) {
      this.state.feedImagens = [];
      this.inicializarFeedPadrao();
      this.renderizarMarketing();
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
      const substituirTudo = this.state.usandoFicticio || confirm("Deseja substituir todo o estoque atual do sistema pelas informações desta planilha?\n\n- Clique em OK para apagar os produtos e revendedoras atuais e carregar apenas os dados da planilha.\n- Clique em Cancelar para apenas mesclar e atualizar os preços/estoques existentes de acordo com o arquivo.");

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
          alert("Erro ao salvar os dados da planilha no servidor local: " + error.message);
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
      
      alert(mensagem);
      this.navegarParaAba("estoque");
    }
  },

  zerarDadosDemonstracao: function() {
    if (confirm("Deseja realmente zerar todos os dados fictícios de demonstração? Isso apagará as peças e revendedoras de exemplo e deixará o aplicativo limpo para seus dados reais.")) {
      this.state.produtos = [];
      this.state.revendedoras = [];
      this.state.usandoFicticio = false;
      this.salvarDadosNoLocalStorage();
      this.renderizarEstoque();
      this.renderizarRevendedoras();
      this.renderizarDashboard();
      alert("Todos os dados fictícios foram zerados com sucesso! Agora o sistema está limpo e pronto para receber suas informações reais.");
    }
  },

  // 13. VENDA RÁPIDA / COMPARTILHAR CATÁLOGO WHATSAPP (MODAL)
  abrirModalVendaRapida: function() {
    document.getElementById("vr-cliente").value = "";
    document.getElementById("vr-whatsapp").value = "";

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
    const nomeCliente = document.getElementById("vr-cliente").value.trim() || "Cliente Especial";
    const whatsapp = document.getElementById("vr-whatsapp").value.trim();

    if (!whatsapp) {
      alert("Por favor, informe o WhatsApp da cliente.");
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
      alert("Selecione pelo menos um produto para gerar a mensagem de venda.");
      return;
    }

    // Pergunta se deseja registrar a baixa no sistema
    const registrarBaixa = confirm("Deseja registrar esta venda direta no banco de dados do sistema e deduzir a quantidade do estoque central?");

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
              nomeCliente: nomeCliente
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
        alert("Erro ao registrar a venda direta na Azure: " + error.message);
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
            alert("Backup geral JSON restaurado com sucesso!");
          } else {
            alert("Arquivo JSON inválido ou incompatível.");
          }
        } catch (error) {
          alert("Erro ao ler e interpretar o arquivo JSON.");
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
    document.querySelectorAll(".sub-aba-rev").forEach(el => el.style.display = "none");
    document.querySelectorAll("#btn-subtab-maleta, #btn-subtab-historico").forEach(el => el.classList.remove("active"));
    
    if(aba === "maleta") {
      document.getElementById("sub-aba-rev-maleta").style.display = "block";
      document.getElementById("btn-subtab-maleta").classList.add("active");
    } else {
      document.getElementById("sub-aba-rev-historico").style.display = "block";
      document.getElementById("btn-subtab-historico").classList.add("active");
    }
  }

};

// Inicializa a aplicação ao carregar a página
window.addEventListener("DOMContentLoaded", () => {
  app.init();
});
