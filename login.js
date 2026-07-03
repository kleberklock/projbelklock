/**
 * BelKlock Semijoias - Login Logic
 */

const loginApp = {
  apiUrl: "http://localhost:5000/api",

  obterLojaId: function() {
    const params = new URLSearchParams(window.location.search);
    let lojaId = params.get("loja") || params.get("lojaId");
    if (!lojaId) {
      lojaId = localStorage.getItem("belklock_loja_id");
    }
    if (!lojaId) {
      lojaId = "default-loja"; // Fallback para a loja padrão
    }
    return lojaId;
  },

  init: async function() {
    // Carrega configurações da loja primeiro para aplicar tema e marca
    await this.carregarConfiguracoesLoja();

    // Verifica se já existe sessão ativa
    const token = localStorage.getItem("belklock_token");
    const usuarioJson = localStorage.getItem("belklock_usuario");

    if (token && usuarioJson) {
      try {
        const usuario = JSON.parse(usuarioJson);
        this.redirecionarPorPerfil(usuario.role);
        return;
      } catch (e) {
        localStorage.clear();
      }
    }

    this.registrarEventos();
  },

  carregarConfiguracoesLoja: async function() {
    try {
      const lojaId = this.obterLojaId();
      const response = await fetch(`${this.apiUrl}/config`, {
        headers: { "x-loja-id": lojaId }
      });
      if (response.ok) {
        const config = await response.json();
        this.aplicarConfiguracoes(config);
        
        // Grava no localStorage para uso offline em outras telas
        localStorage.setItem("belklock_nome_empresa", config.nomeEmpresa);
        localStorage.setItem("belklock_logo_url", config.logoUrl || "");
        localStorage.setItem("belklock_cor_primaria", config.corPrimaria);
        localStorage.setItem("belklock_cor_secundaria", config.corSecundaria);
        localStorage.setItem("belklock_bg_primary", config.bgPrimary);
        localStorage.setItem("belklock_bg_card", config.bgCard);
        localStorage.setItem("belklock_loja_id", config.lojaId); // Persiste a loja ativa
        return;
      }
    } catch (error) {
      console.warn("Não foi possível carregar as configurações do servidor. Usando cache local.");
    }

    // Fallback do localStorage ou padrão
    const configLocal = {
      nomeEmpresa: localStorage.getItem("belklock_nome_empresa") || "BelKlock Semijoias",
      logoUrl: localStorage.getItem("belklock_logo_url") || "",
      corPrimaria: localStorage.getItem("belklock_cor_primaria") || "#d4af37",
      corSecundaria: localStorage.getItem("belklock_cor_secundaria") || "#111111",
      bgPrimary: localStorage.getItem("belklock_bg_primary") || "#0a0a0a",
      bgCard: localStorage.getItem("belklock_bg_card") || "#121212",
      lojaId: localStorage.getItem("belklock_loja_id") || "default-loja"
    };
    this.aplicarConfiguracoes(configLocal);
  },

  aplicarConfiguracoes: function(config) {
    if (!config) return;
    
    // Atualizar Title
    document.title = `${config.nomeEmpresa} - Login Premium`;
    
    // Atualizar Logo
    const logoImg = document.getElementById("login-logo-img");
    if (logoImg) {
      logoImg.src = config.logoUrl || "assets/logo.svg";
      logoImg.alt = config.nomeEmpresa;
    }
    
    // Atualizar Placeholder
    const inputEmail = document.getElementById("login-email");
    if (inputEmail) {
      const dominio = config.nomeEmpresa.toLowerCase().replace(/[^a-z0-9]/g, "") || "loja";
      inputEmail.placeholder = `exemplo@${dominio}.com ou 1234`;
    }
    
    // Atualizar Rodapé
    const footerText = document.getElementById("login-footer-text");
    if (footerText) {
      footerText.innerHTML = `${config.nomeEmpresa} &copy; 2026 - Controle de Luxo`;
    }
    
    // Aplicar Paleta de Cores CSS
    aplicarTemaLoja(config);
  },

  registrarEventos: function() {
    const btnLogin = document.getElementById("btn-executar-login");
    if (btnLogin) {
      btnLogin.addEventListener("click", () => this.fazerLogin());
    }

    const btnSignup = document.getElementById("btn-executar-cadastro");
    if (btnSignup) {
      btnSignup.addEventListener("click", () => this.fazerCadastro());
    }

    // Links de alternância
    const linkIrCadastro = document.getElementById("link-ir-para-cadastro");
    const linkIrLogin = document.getElementById("link-ir-para-login");
    const loginCard = document.getElementById("login-card");
    const signupCard = document.getElementById("signup-card");

    if (linkIrCadastro && loginCard && signupCard) {
      linkIrCadastro.addEventListener("click", (e) => {
        e.preventDefault();
        loginCard.style.display = "none";
        signupCard.style.display = "block";
      });
    }

    if (linkIrLogin && loginCard && signupCard) {
      linkIrLogin.addEventListener("click", (e) => {
        e.preventDefault();
        signupCard.style.display = "none";
        loginCard.style.display = "block";
      });
    }

    const inputEmail = document.getElementById("login-email");
    const inputSenha = document.getElementById("login-senha");

    const enterHandler = (e) => {
      if (e.key === "Enter") this.fazerLogin();
    };

    if (inputEmail) inputEmail.addEventListener("keypress", enterHandler);
    if (inputSenha) inputSenha.addEventListener("keypress", enterHandler);

    // Tecla Enter no Cadastro
    const inputSignupName = document.getElementById("signup-name");
    const inputSignupEmail = document.getElementById("signup-email");
    const inputSignupLoja = document.getElementById("signup-loja");
    const inputSignupSenha = document.getElementById("signup-senha");

    const signupEnterHandler = (e) => {
      if (e.key === "Enter") this.fazerCadastro();
    };

    if (inputSignupName) inputSignupName.addEventListener("keypress", signupEnterHandler);
    if (inputSignupEmail) inputSignupEmail.addEventListener("keypress", signupEnterHandler);
    if (inputSignupLoja) inputSignupLoja.addEventListener("keypress", signupEnterHandler);
    if (inputSignupSenha) inputSignupSenha.addEventListener("keypress", signupEnterHandler);
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
      const response = await fetch(`${this.apiUrl}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, senha })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erro ao tentar realizar login.");
      }

      // Salva dados no LocalStorage
      localStorage.setItem("belklock_token", data.token);
      localStorage.setItem("belklock_usuario", JSON.stringify(data.usuario));
      localStorage.setItem("belklock_loja_id", data.usuario.lojaId);

      this.redirecionarPorPerfil(data.usuario.role);
    } catch (error) {
      console.error(error);
      
      // LOGICA DE FALLBACK OFFLINE (Modo de Demonstração):
      const conexaoFalhou = error instanceof TypeError || 
                            error.message.includes("Failed to fetch") || 
                            error.message.includes("fetch") || 
                            error.message.includes("Failed to execute");
      
      if (conexaoFalhou) {
        if ((email === "superadmin@plataforma.com" || email === "0001") && senha === "admin0001") {
          console.warn("Servidor offline. Iniciando em Modo de Demonstração (SuperAdmin local).");
          const userMock = {
            id: "superadmin_local",
            nome: "Super Admin Local",
            email: "superadmin@plataforma.com",
            pin: "0001",
            role: "SuperAdmin",
            comissao: 0.0
          };
          localStorage.setItem("belklock_token", "mock_superadmin_token_" + Date.now());
          localStorage.setItem("belklock_usuario", JSON.stringify(userMock));
          
          this.redirecionarPorPerfil(userMock.role);
          return;
        } else if ((email === "admin@belklock.com" || email === "0002") && senha === "belklock") {
          console.warn("Servidor offline. Iniciando em Modo de Demonstração (Gestora local).");
          const userMock = {
            id: "admin_local",
            nome: "Admin Local",
            email: "admin@belklock.com",
            pin: "0002",
            role: "Manager",
            comissao: 0.0
          };
          localStorage.setItem("belklock_token", "mock_admin_token_" + Date.now());
          localStorage.setItem("belklock_usuario", JSON.stringify(userMock));
          
          this.redirecionarPorPerfil(userMock.role);
          return;
        } else if (email === "2120" && senha === "belklock") {
          console.warn("Servidor offline. Iniciando em Modo de Demonstração (Consultora local).");
          const userMock = {
            id: "rev_local_junior",
            nome: "junior",
            email: "junior_254@loja.com",
            pin: "2120",
            role: "Consultant",
            comissao: 30.0
          };
          localStorage.setItem("belklock_token", "mock_rev_token_" + Date.now());
          localStorage.setItem("belklock_usuario", JSON.stringify(userMock));
          
          this.redirecionarPorPerfil(userMock.role);
          return;
        }
      }

      errorBox.innerText = error.message || "Erro de conexão com o servidor local.";
      errorBox.style.display = "block";
    } finally {
      btnLogin.disabled = false;
      btnLogin.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Entrar na Plataforma';
    }
  },

  redirecionarPorPerfil: function(role) {
    if (role === 'SuperAdmin') {
      // SuperAdmin é redirecionado para o painel de admin com flag especial
      sessionStorage.setItem('saas_super_admin', 'true');
      window.location.href = "superadmin.html";
    } else if (role === 'Manager') {
      window.location.href = "superadmin.html";
    } else {
      window.location.href = "manager.html";
    }
  },

  fazerCadastro: async function() {
    const nome = document.getElementById("signup-name").value.trim();
    const email = document.getElementById("signup-email").value.trim();
    const nomeLoja = document.getElementById("signup-loja").value.trim();
    const senha = document.getElementById("signup-senha").value.trim();
    const errorBox = document.getElementById("signup-error-msg");
    const successBox = document.getElementById("signup-success-msg");

    if (!nome || !email || !nomeLoja || !senha) {
      errorBox.innerText = "Por favor, preencha todos os campos obrigatórios.";
      errorBox.style.display = "block";
      successBox.style.display = "none";
      return;
    }

    errorBox.style.display = "none";
    successBox.style.display = "none";

    const btnSignup = document.getElementById("btn-executar-cadastro");
    btnSignup.disabled = true;
    btnSignup.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Registrando...';

    try {
      const response = await fetch(`${this.apiUrl}/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, email, senha, nomeLoja })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erro ao tentar realizar o cadastro.");
      }

      successBox.innerText = "Cadastro realizado com sucesso! Redirecionando...";
      successBox.style.display = "block";

      // Salva dados no LocalStorage
      localStorage.setItem("belklock_token", data.token);
      localStorage.setItem("belklock_usuario", JSON.stringify(data.usuario));
      localStorage.setItem("belklock_loja_id", data.usuario.lojaId);

      setTimeout(() => {
        this.redirecionarPorPerfil(data.usuario.role);
      }, 1500);

    } catch (error) {
      console.error(error);

      // LÓGICA DE FALLBACK OFFLINE (Modo de Demonstração):
      const conexaoFalhou = error instanceof TypeError || 
                            error.message.includes("Failed to fetch") || 
                            error.message.includes("fetch") || 
                            error.message.includes("Failed to execute");

      if (conexaoFalhou) {
        console.warn("Servidor offline. Registrando Gestora em Modo de Demonstração local.");
        const userMock = {
          id: "gestora_local_mock_" + Date.now(),
          nome: nome,
          email: email,
          pin: "0002",
          role: "Manager",
          lojaId: "default-loja",
          comissao: 0.0
        };
        localStorage.setItem("belklock_token", "mock_admin_token_" + Date.now());
        localStorage.setItem("belklock_usuario", JSON.stringify(userMock));
        localStorage.setItem("belklock_nome_empresa", nomeLoja);

        successBox.innerText = "Modo de Demonstração: Cadastro simulado localmente. Redirecionando...";
        successBox.style.display = "block";

        setTimeout(() => {
          this.redirecionarPorPerfil(userMock.role);
        }, 1500);
        return;
      }

      errorBox.innerText = error.message || "Erro de conexão com o servidor local.";
      errorBox.style.display = "block";
    } finally {
      btnSignup.disabled = false;
      btnSignup.innerHTML = '<i class="fa-solid fa-user-plus"></i> Registrar e Iniciar';
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

window.addEventListener("DOMContentLoaded", () => loginApp.init());
