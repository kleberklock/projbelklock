/**
 * BelKlock Semijoias - Login Logic
 */

const loginApp = {
  apiUrl: "http://localhost:5000/api",

  init: function() {
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

  registrarEventos: function() {
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

      this.redirecionarPorPerfil(data.usuario.role);
    } catch (error) {
      console.error(error);
      
      // LOGICA DE FALLBACK OFFLINE (Modo de Demonstração):
      const conexaoFalhou = error instanceof TypeError || 
                            error.message.includes("Failed to fetch") || 
                            error.message.includes("fetch") || 
                            error.message.includes("Failed to execute");
      
      if (conexaoFalhou) {
        if ((email === "admin@belklock.com" || email === "0001") && senha === "belklock") {
          console.warn("Servidor offline. Iniciando em Modo de Demonstração (Admin local).");
          const userMock = {
            id: "admin_local",
            nome: "Bel Klock Admin (Local)",
            email: "admin@belklock.com",
            pin: "0001",
            role: "admin",
            comissao: 0.0
          };
          localStorage.setItem("belklock_token", "mock_admin_token_" + Date.now());
          localStorage.setItem("belklock_usuario", JSON.stringify(userMock));
          
          this.redirecionarPorPerfil(userMock.role);
          return;
        } else if (email === "2120" && senha === "belklock") {
          // Permite logar localmente com a revendedora principal redefinida
          console.warn("Servidor offline. Iniciando em Modo de Demonstração (Revendedora local).");
          const userMock = {
            id: "rev_local_junior",
            nome: "junior",
            email: "junior_254@belklock.com",
            pin: "2120",
            role: "revendedora",
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
    if (role === 'admin') {
      window.location.href = "admin.html";
    } else {
      window.location.href = "vendedora.html";
    }
  }
};

window.addEventListener("DOMContentLoaded", () => loginApp.init());
