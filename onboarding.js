/**
 * Conecta Joias - Cadastro & Onboarding Script
 */

const API_BASE_URL = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1" 
  ? "http://localhost:5000/api" 
  : `${window.location.origin}/api`;

const onboarding = {
  currentStep: 1,
  totalSteps: 4,

  init: function() {
    this.aplicarMascaras();
    this.carregarConfiguracao();
  },

  carregarConfiguracao: async function() {
    const params = new URLSearchParams(window.location.search);
    const lojaId = params.get("loja") || "default-loja";
    try {
      const response = await fetch(`${API_BASE_URL}/config`, {
        headers: { "x-loja-id": lojaId }
      });
      if (response.ok) {
        const config = await response.json();
        this.aplicarConfiguracaoLoja(config);
      }
    } catch (e) {
      console.warn("Erro ao buscar configurações da loja para onboarding:", e);
    }
  },

  aplicarConfiguracaoLoja: function(config) {
    const titleEl = document.getElementById("onboarding-title");
    const pageTitleEl = document.getElementById("onboarding-page-title");
    const subtitleEl = document.getElementById("onboarding-subtitle");
    const descTextEl = document.getElementById("onboarding-desc-text");
    const whyTitleEl = document.getElementById("onboarding-why-title");
    const labelComoConheceuEl = document.getElementById("label-como-conheceu");
    const comentariosEl = document.getElementById("comentarios");
    const welcomeTitleEl = document.getElementById("onboarding-welcome-title");
    const logoImg = document.getElementById("onboarding-logo");

    const nomeLoja = config.nomeEmpresa || "Conecta Joias";

    if (titleEl) titleEl.innerText = nomeLoja;
    if (pageTitleEl) pageTitleEl.innerText = `${nomeLoja} - Cadastro & Onboarding Premium`;
    if (subtitleEl) subtitleEl.innerText = `Cadastre-se para se tornar uma Revendedora ${nomeLoja}`;
    if (descTextEl) {
      descTextEl.innerText = `A ${nomeLoja} oferece a você peças de altíssima qualidade, com banhos nobres de Ouro 18k e Ródio, design exclusivo e garantia estendida. Veja alguns de nossos produtos que fazem mais sucesso:`;
    }
    if (whyTitleEl) whyTitleEl.innerHTML = `<i class="fa-solid fa-gem"></i> Por que revender ${nomeLoja}?`;
    if (labelComoConheceuEl) labelComoConheceuEl.innerText = `Como você conheceu a ${nomeLoja}? *`;
    if (comentariosEl) comentariosEl.placeholder = `Fale um pouco sobre você ou o que você busca na ${nomeLoja}...`;
    if (welcomeTitleEl) welcomeTitleEl.innerText = `Seja Bem-Vinda à Família ${nomeLoja}!`;

    if (config.logoUrl && logoImg) {
      logoImg.src = config.logoUrl;
    }

    if (config.corPrimaria) {
      document.documentElement.style.setProperty('--gold-primary', config.corPrimaria);
    }
  },

  aplicarMascaras: function() {
    // Máscara WhatsApp
    const whatsappInput = document.getElementById("whatsapp");
    if (whatsappInput) {
      whatsappInput.addEventListener("input", (e) => {
        let value = e.target.value.replace(/\D/g, "");
        if (value.length > 11) value = value.slice(0, 11);
        
        if (value.length > 6) {
          e.target.value = `(${value.slice(0, 2)}) ${value.slice(2, 7)}-${value.slice(7)}`;
        } else if (value.length > 2) {
          e.target.value = `(${value.slice(0, 2)}) ${value.slice(2)}`;
        } else if (value.length > 0) {
          e.target.value = `(${value}`;
        }
      });
    }

    // Máscara CPF
    const cpfInput = document.getElementById("cpf");
    if (cpfInput) {
      cpfInput.addEventListener("input", (e) => {
        let value = e.target.value.replace(/\D/g, "");
        if (value.length > 11) value = value.slice(0, 11);
        
        if (value.length > 9) {
          e.target.value = `${value.slice(0, 3)}.${value.slice(3, 6)}.${value.slice(6, 9)}-${value.slice(9)}`;
        } else if (value.length > 6) {
          e.target.value = `${value.slice(0, 3)}.${value.slice(3, 6)}.${value.slice(6)}`;
        } else if (value.length > 3) {
          e.target.value = `${value.slice(0, 3)}.${value.slice(3)}`;
        }
      });
    }
  },

  toast: function(message, type = "info") {
    const container = document.getElementById("toast-container");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = `custom-toast ${type} show`;
    
    let icon = "fa-circle-info";
    if (type === "success") icon = "fa-circle-check";
    if (type === "error") icon = "fa-circle-xmark";
    if (type === "warning") icon = "fa-triangle-exclamation";

    toast.innerHTML = `
      <i class="fa-solid ${icon}"></i>
      <span class="custom-toast-message">${message}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.remove("show");
      setTimeout(() => toast.remove(), 400);
    }, 4000);
  },

  validarPasso: function(step) {
    if (step === 1) return true; // Somente leitura/showcase
    
    if (step === 2) {
      const nome = document.getElementById("nome").value.trim();
      const email = document.getElementById("email").value.trim();
      const whatsapp = document.getElementById("whatsapp").value.trim();
      const cpf = document.getElementById("cpf").value.trim();
      
      if (!nome || !email || !whatsapp || !cpf) {
        this.toast("Por favor, preencha todos os campos obrigatórios (*)", "warning");
        return false;
      }
      if (!/\S+@\S+\.\S+/.test(email)) {
        this.toast("Digite um e-mail válido.", "warning");
        return false;
      }
      if (whatsapp.length < 14) {
        this.toast("Digite um número de WhatsApp válido.", "warning");
        return false;
      }
      if (cpf.length < 14) {
        this.toast("Digite um CPF válido.", "warning");
        return false;
      }
      return true;
    }

    if (step === 3) {
      const vendedora = document.getElementById("vendedoraPrincipal").value.trim();
      const comoConheceu = document.getElementById("comoConheceu").value;
      const experiencia = document.getElementById("experienciaVendas").value;

      if (!vendedora || !comoConheceu || !experiencia) {
        this.toast("Por favor, responda todas as perguntas obrigatórias do questionário.", "warning");
        return false;
      }
      return true;
    }

    if (step === 4) {
      const enderecoFile = document.getElementById("enderecoFile").files[0];
      if (!enderecoFile) {
        this.toast("Por favor, anexe o comprovante de residência atual.", "warning");
        return false;
      }
      
      const aceiteLgpd = document.getElementById("aceite-termos-lgpd");
      if (aceiteLgpd && !aceiteLgpd.checked) {
        this.toast("Você precisa aceitar os Termos de Uso e a Política de Privacidade (LGPD) para prosseguir.", "warning");
        return false;
      }
      return true;
    }

    return true;
  },

  navegarEtapa: function(direcao) {
    const proximoPasso = this.currentStep + direcao;

    if (direcao > 0 && !this.validarPasso(this.currentStep)) {
      return;
    }

    if (proximoPasso > this.totalSteps) {
      this.submeterFormulario();
      return;
    }

    // Ocultar etapa atual
    document.getElementById(`step-content-${this.currentStep}`).classList.remove("active");
    document.getElementById(`step-node-${this.currentStep}`).classList.remove("active");
    if (proximoPasso < this.currentStep) {
      document.getElementById(`step-node-${this.currentStep}`).classList.remove("completed");
    } else {
      document.getElementById(`step-node-${this.currentStep}`).classList.add("completed");
    }

    // Mostrar nova etapa
    this.currentStep = proximoPasso;
    document.getElementById(`step-content-${this.currentStep}`).classList.add("active");
    document.getElementById(`step-node-${this.currentStep}`).classList.add("active");

    // Gerenciar visibilidade dos botões
    const btnBack = document.getElementById("btn-back");
    const btnNext = document.getElementById("btn-next");

    if (this.currentStep === 1) {
      btnBack.style.display = "none";
    } else {
      btnBack.style.display = "flex";
    }

    if (this.currentStep === this.totalSteps) {
      btnNext.innerHTML = `Finalizar Cadastro <i class="fa-solid fa-check"></i>`;
    } else {
      btnNext.innerHTML = `Avançar <i class="fa-solid fa-chevron-right"></i>`;
    }
  },

  submeterFormulario: async function() {
    const form = document.getElementById("onboarding-form");
    const formData = new FormData(form);
    
    // Pegar lojaId da URL se houver
    const params = new URLSearchParams(window.location.search);
    const lojaId = params.get("loja") || "default-loja";
    formData.append("lojaId", lojaId);

    const btnNext = document.getElementById("btn-next");
    btnNext.disabled = true;
    btnNext.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Processando...`;

    try {
      const response = await fetch(`${API_BASE_URL}/public/onboarding`, {
        method: "POST",
        body: formData
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Erro no servidor ao salvar cadastro.");
      }

      // Sucesso
      this.toast("Cadastro concluído com sucesso!", "success");
      
      // Preencher credenciais na tela
      document.getElementById("cred-pin").innerText = result.pin;
      document.getElementById("cred-senha").innerText = result.senha;

      // Ocultar interface de etapas e botões
      document.getElementById(`step-content-${this.currentStep}`).classList.remove("active");
      document.getElementById("step-content-success").classList.add("active");
      document.getElementById("onboarding-buttons-footer").style.display = "none";
      document.getElementById("step-node-4").classList.add("completed");

    } catch (error) {
      this.toast(error.message, "error");
      btnNext.disabled = false;
      btnNext.innerHTML = `Finalizar Cadastro <i class="fa-solid fa-check"></i>`;
    }
  }
};

function proximaEtapa() {
  onboarding.navegarEtapa(1);
}

function navegarEtapa(direcao) {
  onboarding.navegarEtapa(direcao);
}

function atualizarStatusArquivo(input, statusId) {
  const box = input.previousElementSibling;
  const statusEl = document.getElementById(statusId);
  const file = input.files[0];

  if (file) {
    statusEl.querySelector(".file-name").innerText = `${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`;
    statusEl.style.display = "flex";
    box.style.borderColor = "#81c784";
    box.style.background = "rgba(129, 199, 132, 0.02)";
  } else {
    statusEl.style.display = "none";
    box.style.borderColor = "rgba(212, 175, 55, 0.2)";
    box.style.background = "rgba(0, 0, 0, 0.2)";
  }
}

function irParaPortal() {
  window.location.href = "manager.html";
}

// Inicializar
document.addEventListener("DOMContentLoaded", () => {
  onboarding.init();
});
