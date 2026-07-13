/**
 * BelKlock Semijoias - Login Logic + Onboarding Wizard
 */

const loginApp = {
  apiUrl: "http://localhost:5000/api",
  wizardStep: 1,
  wizardTotalSteps: 7,
  _cadastroData: null, // guarda token/usuario pós-signup para usar após o wizard

  obterLojaId: function() {
    const params = new URLSearchParams(window.location.search);
    let lojaId = params.get("loja") || params.get("lojaId");
    if (!lojaId) lojaId = localStorage.getItem("conectajoias_loja_id");
    if (!lojaId) lojaId = "default-loja";
    return lojaId;
  },

  init: async function() {
    await this.carregarConfiguracoesLoja();

    const token = localStorage.getItem("conectajoias_token");
    const usuarioJson = localStorage.getItem("conectajoias_usuario");

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
    this.registrarEventosWizard();
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
        localStorage.setItem("conectajoias_nome_empresa", config.nomeEmpresa);
        localStorage.setItem("conectajoias_logo_url", config.logoUrl || "");
        localStorage.setItem("conectajoias_cor_primaria", config.corPrimaria);
        localStorage.setItem("conectajoias_cor_secundaria", config.corSecundaria);
        localStorage.setItem("conectajoias_bg_primary", config.bgPrimary);
        localStorage.setItem("conectajoias_bg_card", config.bgCard);
        localStorage.setItem("conectajoias_loja_id", config.lojaId);
        return;
      }
    } catch (error) {
      console.warn("Não foi possível carregar as configurações do servidor. Usando cache local.");
    }

    const configLocal = {
      nomeEmpresa: localStorage.getItem("conectajoias_nome_empresa") || "Conecta Joias",
      logoUrl: localStorage.getItem("conectajoias_logo_url") || "",
      corPrimaria: localStorage.getItem("conectajoias_cor_primaria") || "#d4af37",
      corSecundaria: localStorage.getItem("conectajoias_cor_secundaria") || "#111111",
      bgPrimary: localStorage.getItem("conectajoias_bg_primary") || "#0a0a0a",
      bgCard: localStorage.getItem("conectajoias_bg_card") || "#121212",
      lojaId: localStorage.getItem("conectajoias_loja_id") || "default-loja"
    };
    this.aplicarConfiguracoes(configLocal);
  },

  aplicarConfiguracoes: function(config) {
    if (!config) return;
    document.title = `${config.nomeEmpresa} - Login Premium`;
    const logoImg = document.getElementById("login-logo-img");
    if (logoImg) {
      logoImg.src = config.logoUrl || "assets/logo.svg";
      logoImg.alt = config.nomeEmpresa;
    }
    const inputEmail = document.getElementById("login-email");
    if (inputEmail) {
      const dominio = config.nomeEmpresa.toLowerCase().replace(/[^a-z0-9]/g, "") || "loja";
      inputEmail.placeholder = `exemplo@${dominio}.com ou 1234`;
    }
    const footerText = document.getElementById("login-footer-text");
    if (footerText) {
      footerText.innerHTML = `${config.nomeEmpresa} &copy; 2026 - Controle de Luxo`;
    }
    aplicarTemaLoja(config);
  },

  registrarEventos: function() {
    const btnLogin = document.getElementById("btn-executar-login");
    if (btnLogin) btnLogin.addEventListener("click", () => this.fazerLogin());

    const btnSignup = document.getElementById("btn-executar-cadastro");
    if (btnSignup) btnSignup.addEventListener("click", () => this.fazerCadastro());

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

    const enterHandler = (e) => { if (e.key === "Enter") this.fazerLogin(); };
    const inputEmail = document.getElementById("login-email");
    const inputSenha = document.getElementById("login-senha");
    if (inputEmail) inputEmail.addEventListener("keypress", enterHandler);
    if (inputSenha) inputSenha.addEventListener("keypress", enterHandler);

    const signupEnterHandler = (e) => { if (e.key === "Enter") this.fazerCadastro(); };
    ["signup-name","signup-email","signup-loja","signup-senha"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener("keypress", signupEnterHandler);
    });
  },

  registrarEventosWizard: function() {
    // Botões de navegação
    const btnNext = document.getElementById("wz-btn-next");
    const btnPrev = document.getElementById("wz-btn-prev");
    if (btnNext) btnNext.addEventListener("click", () => this.wizardAvancar());
    if (btnPrev) btnPrev.addEventListener("click", () => this.wizardVoltar());

    // Upload de logo — preview ao selecionar arquivo
    const logoFile = document.getElementById("wz-logo-file");
    if (logoFile) {
      logoFile.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
          const preview = document.getElementById("wz-logo-preview");
          const icon = document.getElementById("wz-logo-icon");
          const label = document.getElementById("wz-logo-label");
          if (preview) { preview.src = ev.target.result; preview.style.display = "block"; }
          if (icon) icon.style.display = "none";
          if (label) label.innerText = file.name;
        };
        reader.readAsDataURL(file);
      });
    }

    // Sincronizar color picker ↔ HEX primária
    const pickerPri = document.getElementById("wz-cor-primaria");
    const hexPri = document.getElementById("wz-cor-primaria-hex");
    if (pickerPri && hexPri) {
      pickerPri.addEventListener("input", () => { hexPri.value = pickerPri.value; });
      hexPri.addEventListener("input", () => {
        if (/^#[0-9A-Fa-f]{6}$/.test(hexPri.value)) pickerPri.value = hexPri.value;
      });
    }

    // Sincronizar color picker ↔ HEX secundária
    const pickerSec = document.getElementById("wz-cor-secundaria");
    const hexSec = document.getElementById("wz-cor-secundaria-hex");
    if (pickerSec && hexSec) {
      pickerSec.addEventListener("input", () => { hexSec.value = pickerSec.value; });
      hexSec.addEventListener("input", () => {
        if (/^#[0-9A-Fa-f]{6}$/.test(hexSec.value)) pickerSec.value = hexSec.value;
      });
    }

    // Botão "Entrar no Painel" na tela de credenciais
    const btnPainel = document.getElementById("btn-ir-para-painel");
    if (btnPainel) {
      btnPainel.addEventListener("click", () => {
        if (this._cadastroData) {
          this.redirecionarPorPerfil(this._cadastroData.usuario.role);
        }
      });
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  // WIZARD: navegação e lógica
  // ─────────────────────────────────────────────────────────────────────────

  wizardAtualizarUI: function() {
    const total = this.wizardTotalSteps;
    const current = this.wizardStep;

    // Passos
    for (let i = 1; i <= total; i++) {
      const el = document.getElementById(`wz-step-${i}`);
      if (el) el.classList.toggle("active", i === current);
    }

    // Barra de progresso
    const dots = document.querySelectorAll("#wz-progress-bar span");
    dots.forEach((dot, idx) => {
      dot.classList.remove("done", "active");
      if (idx < current - 1)     dot.classList.add("done");
      else if (idx === current - 1) dot.classList.add("active");
    });

    // Botão Anterior
    const btnPrev = document.getElementById("wz-btn-prev");
    if (btnPrev) btnPrev.style.display = current > 1 ? "block" : "none";

    // Botão Próximo / Concluir
    const btnNext = document.getElementById("wz-btn-next");
    if (btnNext) {
      if (current === total) {
        btnNext.innerHTML = '<i class="fa-solid fa-check"></i> Concluir e Ver Credenciais';
      } else {
        btnNext.innerHTML = 'Próximo <i class="fa-solid fa-chevron-right"></i>';
      }
    }
  },

  wizardValidarPasso: function() {
    if (this.wizardStep === 4) {
      const nome = (document.getElementById("wz-nome-comercial")?.value || "").trim();
      const zap  = (document.getElementById("wz-whatsapp")?.value || "").trim();
      if (!nome) { this.toast("Por favor, informe o Nome Comercial da sua marca.", "warning"); return false; }
      if (!zap)  { this.toast("Por favor, informe o WhatsApp de atendimento.", "warning"); return false; }
    }
    return true;
  },

  wizardAvancar: async function() {
    if (!this.wizardValidarPasso()) return;

    if (this.wizardStep < this.wizardTotalSteps) {
      this.wizardStep++;
      this.wizardAtualizarUI();
    } else {
      await this.wizardConcluir();
    }
  },

  wizardVoltar: function() {
    if (this.wizardStep > 1) {
      this.wizardStep--;
      this.wizardAtualizarUI();
    }
  },

  wizardConcluir: async function() {
    const btnNext = document.getElementById("wz-btn-next");
    if (btnNext) { btnNext.disabled = true; btnNext.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Salvando...'; }

    try {
      const token  = localStorage.getItem("conectajoias_token");
      const lojaId = localStorage.getItem("conectajoias_loja_id");

      // — Coleta os dados do wizard —
      const nomeComercial = document.getElementById("wz-nome-comercial")?.value.trim() || "";
      const whatsapp      = document.getElementById("wz-whatsapp")?.value.trim() || "";
      const corPrimaria   = document.getElementById("wz-cor-primaria-hex")?.value || "#d4af37";
      const corSecundaria = document.getElementById("wz-cor-secundaria-hex")?.value || "#111111";
      const temaPref      = document.querySelector('input[name="wz-tema"]:checked')?.value || "ESCURO";
      const segmento      = document.querySelector('input[name="wz-segmento"]:checked')?.value || "SEMIJOIAS";
      const estiloLoja    = document.querySelector('input[name="wz-estilo"]:checked')?.value || "LUXO";
      const instagram     = document.getElementById("wz-instagram")?.value.trim() || "";
      const tiktok        = document.getElementById("wz-tiktok")?.value.trim() || "";
      const site          = document.getElementById("wz-site")?.value.trim() || "";

      // — Upload da logo se houver —
      let logoUrl = "";
      const logoFile = document.getElementById("wz-logo-file")?.files?.[0];
      if (logoFile && token) {
        try {
          const formData = new FormData();
          formData.append("imagem", logoFile);
          const uploadResp = await fetch(`${this.apiUrl}/uploads`, {
            method: "POST",
            headers: { "Authorization": `Bearer ${token}` },
            body: formData
          });
          if (uploadResp.ok) {
            const uploadData = await uploadResp.json();
            logoUrl = uploadData.url || "";
          }
        } catch (upErr) {
          console.warn("Upload de logo falhou, continuando sem logo:", upErr);
        }
      }

      // — Salvar na API —
      const body = {
        nomeEmpresa: nomeComercial,
        logoUrl,
        corPrimaria,
        corSecundaria,
        whatsappAtendimento: whatsapp,
        temaPref,
        segmento,
        estiloLoja,
        instagram,
        tiktok,
        site,
        onboardingCompleto: true
      };

      if (token && lojaId) {
        const resp = await fetch(`${this.apiUrl}/config`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
            "x-loja-id": lojaId
          },
          body: JSON.stringify(body)
        });
      }

      // Salvar os dados visuais no localStorage para aplicação imediata nos painéis
      localStorage.setItem("conectajoias_nome_empresa", nomeComercial);
      if (this._cadastroData && this._cadastroData.usuario) {
        localStorage.setItem("conectajoias_loja_id", this._cadastroData.usuario.lojaId);
      }
      localStorage.setItem("conectajoias_cor_primaria", corPrimaria);
      localStorage.setItem("conectajoias_cor_secundaria", corSecundaria);
      
      const isLight = temaPref === 'CLARO';
      const bgPrimary = isLight ? '#f5f5f5' : '#0a0a0a';
      const bgCard = isLight ? '#ffffff' : '#121212';
      localStorage.setItem("conectajoias_bg_primary", bgPrimary);
      localStorage.setItem("conectajoias_bg_card", bgCard);

      aplicarTemaLoja({
        corPrimaria,
        corSecundaria,
        bgPrimary,
        bgCard,
        temaPref
      });

      // — Exibir tela de credenciais —
      this.mostrarCredenciais();

    } catch (err) {
      console.error("Erro ao concluir wizard:", err);
      // mesmo com erro, mostra credenciais para o usuário não ficar preso
      this.mostrarCredenciais();
    } finally {
      if (btnNext) { btnNext.disabled = false; }
    }
  },

  mostrarCredenciais: function() {
    const dados = this._cadastroData;

    document.getElementById("onboarding-wizard-card").style.display = "none";

    const credCard = document.getElementById("credentials-card");
    if (credCard) credCard.style.display = "block";

    if (dados) {
      const emailEl = document.getElementById("cred-email");
      const pinEl   = document.getElementById("cred-pin");
      const linkEl  = document.getElementById("cred-link");
      if (emailEl) emailEl.innerText = dados.usuario.email;
      if (pinEl)   pinEl.innerText   = dados.pin || "—";
      if (linkEl)  linkEl.innerText  = `${window.location.origin}${window.location.pathname}?loja=${dados.usuario.lojaId}`;
    }
  },

  // helper de toast (fallback simples)
  toast: function(msg, type) {
    const el = document.createElement("div");
    el.style.cssText = `position:fixed;bottom:2rem;left:50%;transform:translateX(-50%);
      background:${type==='warning'?'#f57c00':'#2e7d32'};color:#fff;
      padding:.7rem 1.4rem;border-radius:8px;font-size:.85rem;z-index:9999;
      box-shadow:0 4px 12px rgba(0,0,0,.4);`;
    el.innerText = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3500);
  },

  // ─────────────────────────────────────────────────────────────────────────
  // LOGIN
  // ─────────────────────────────────────────────────────────────────────────

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
      if (!response.ok) throw new Error(data.error || "Erro ao tentar realizar login.");

      localStorage.setItem("conectajoias_token", data.token);
      localStorage.setItem("conectajoias_usuario", JSON.stringify(data.usuario));
      localStorage.setItem("conectajoias_loja_id", data.usuario.lojaId);

      this.redirecionarPorPerfil(data.usuario.role);
    } catch (error) {
      console.error(error);
      const conexaoFalhou = error instanceof TypeError ||
        error.message.includes("Failed to fetch") ||
        error.message.includes("fetch") ||
        error.message.includes("Failed to execute");

      if (conexaoFalhou) {
        if ((email === "superadmin@plataforma.com" || email === "0001") && senha === "admin0001") {
          const userMock = { id:"superadmin_local", nome:"Super Admin Local", email:"superadmin@plataforma.com", pin:"0001", role:"SuperAdmin", comissao:0 };
          localStorage.setItem("conectajoias_token", "mock_superadmin_token_" + Date.now());
          localStorage.setItem("conectajoias_usuario", JSON.stringify(userMock));
          this.redirecionarPorPerfil(userMock.role); return;
        } else if ((email === "admin@conectajoias.com" || email === "0002") && senha === "conectajoias") {
          const userMock = { id:"admin_local", nome:"Admin Local", email:"admin@conectajoias.com", pin:"0002", role:"Manager", comissao:0 };
          localStorage.setItem("conectajoias_token", "mock_admin_token_" + Date.now());
          localStorage.setItem("conectajoias_usuario", JSON.stringify(userMock));
          this.redirecionarPorPerfil(userMock.role); return;
        } else if (email === "2120" && senha === "conectajoias") {
          const userMock = { id:"rev_local_junior", nome:"junior", email:"junior_254@loja.com", pin:"2120", role:"Consultant", comissao:30 };
          localStorage.setItem("conectajoias_token", "mock_rev_token_" + Date.now());
          localStorage.setItem("conectajoias_usuario", JSON.stringify(userMock));
          this.redirecionarPorPerfil(userMock.role); return;
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
      sessionStorage.setItem('saas_super_admin', 'true');
      window.location.href = "saasadmin.html";
    } else if (role === 'Manager') {
      window.location.href = "superadmin.html";
    } else {
      window.location.href = "manager.html";
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  // CADASTRO
  // ─────────────────────────────────────────────────────────────────────────

  fazerCadastro: async function() {
    const nome     = document.getElementById("signup-name").value.trim();
    const email    = document.getElementById("signup-email").value.trim();
    const nomeLoja = document.getElementById("signup-loja").value.trim();
    const senha    = document.getElementById("signup-senha").value.trim();
    const errorBox = document.getElementById("signup-error-msg");

    if (!nome || !email || !nomeLoja || !senha) {
      errorBox.innerText = "Por favor, preencha todos os campos obrigatórios.";
      errorBox.style.display = "block";
      return;
    }

    errorBox.style.display = "none";
    const btnSignup = document.getElementById("btn-executar-cadastro");
    btnSignup.disabled = true;
    btnSignup.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Criando conta...';

    try {
      const response = await fetch(`${this.apiUrl}/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, email, senha, nomeLoja })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Erro ao tentar realizar o cadastro.");

      // Salvar sessão
      localStorage.setItem("conectajoias_token", data.token);
      localStorage.setItem("conectajoias_usuario", JSON.stringify(data.usuario));
      localStorage.setItem("conectajoias_loja_id", data.usuario.lojaId);

      // Guardar para usar depois do wizard
      this._cadastroData = data;

      // Preencher nome comercial com nome da loja como sugestão no wizard
      const nomeComercialEl = document.getElementById("wz-nome-comercial");
      if (nomeComercialEl) nomeComercialEl.value = nomeLoja;

      // Ir para o Wizard
      this.iniciarWizard();

    } catch (error) {
      console.error(error);
      const conexaoFalhou = error instanceof TypeError ||
        error.message.includes("Failed to fetch") ||
        error.message.includes("fetch") ||
        error.message.includes("Failed to execute");

      if (conexaoFalhou) {
        console.warn("Servidor offline. Registrando em Modo de Demonstração.");
        const pinAleatorio = Math.floor(1000 + Math.random() * 9000).toString();
        const userMock = { id:"gestora_local_mock_"+Date.now(), nome, email, pin: pinAleatorio, role:"Manager", lojaId:"default-loja", comissao:0 };
        localStorage.setItem("conectajoias_token", "mock_admin_token_" + Date.now());
        localStorage.setItem("conectajoias_usuario", JSON.stringify(userMock));
        localStorage.setItem("conectajoias_loja_id", "default-loja");
        localStorage.setItem("conectajoias_nome_empresa", nomeLoja);
        this._cadastroData = { token:"mock", pin: pinAleatorio, usuario: userMock };

        const nomeComercialEl = document.getElementById("wz-nome-comercial");
        if (nomeComercialEl) nomeComercialEl.value = nomeLoja;

        this.iniciarWizard();
        return;
      }

      errorBox.innerText = error.message || "Erro de conexão com o servidor local.";
      errorBox.style.display = "block";
    } finally {
      btnSignup.disabled = false;
      btnSignup.innerHTML = '<i class="fa-solid fa-user-plus"></i> Criar Conta e Personalizar';
    }
  },

  iniciarWizard: function() {
    // Ocultar card de cadastro
    const signupCard = document.getElementById("signup-card");
    if (signupCard) signupCard.style.display = "none";

    // Exibir wizard
    const wizard = document.getElementById("onboarding-wizard-card");
    if (wizard) wizard.style.display = "block";

    // Inicializar passo 1
    this.wizardStep = 1;
    this.wizardAtualizarUI();
  }
};

// ─── Funções auxiliares para tema white-label ─────────────────────────────

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
    c = hex.substring(1).split('');
    if(c.length === 3) c = [c[0],c[0],c[1],c[1],c[2],c[2]];
    c = '0x' + c.join('');
    return 'rgba('+[(c>>16)&255,(c>>8)&255,c&255].join(',')+','+alpha+')';
  }
  return hex;
}

window.addEventListener("DOMContentLoaded", () => loginApp.init());

