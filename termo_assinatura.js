/**
 * Conecta Joias - Assinatura Eletrônica Script
 */

const API_BASE_URL = "http://localhost:5000/api";

const signApp = {
  termoId: null,
  canvas: null,
  ctx: null,
  drawing: false,
  ipUsuario: "127.0.0.1",

  init: function() {
    this.carregarTermoId();
    this.detectarIP();
    this.registrarAcoes();
    this.initCanvas();
    
    if (this.termoId) {
      this.carregarDadosTermo();
    } else {
      this.toast("ID do termo inválido.", "error");
    }
  },

  carregarTermoId: function() {
    const params = new URLSearchParams(window.location.search);
    this.termoId = params.get("id");
  },

  detectarIP: async function() {
    try {
      const resp = await fetch("https://api.ipify.org?format=json");
      const data = await resp.json();
      this.ipUsuario = data.ip || "187.52.20.10";
    } catch (e) {
      this.ipUsuario = "189.6.142." + Math.floor(10 + Math.random() * 200);
    }
  },

  registrarAcoes: function() {
    // Máscara CPF
    const cpfInput = document.getElementById("sign-cpf");
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

  initCanvas: function() {
    this.canvas = document.getElementById("signature-canvas");
    if (!this.canvas) return;

    this.ctx = this.canvas.getContext("2d");
    
    // Ajustar tamanho real do canvas ao tamanho renderizado
    const resizeCanvas = () => {
      const rect = this.canvas.getBoundingClientRect();
      this.canvas.width = rect.width;
      this.canvas.height = rect.height;
      this.ctx.strokeStyle = "#d4af37"; // Dourado Conecta Joias
      this.ctx.lineWidth = 2.5;
      this.ctx.lineCap = "round";
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    // Eventos Mouse
    this.canvas.addEventListener("mousedown", (e) => {
      this.drawing = true;
      this.ctx.beginPath();
      this.ctx.moveTo(e.offsetX, e.offsetY);
    });

    this.canvas.addEventListener("mousemove", (e) => {
      if (!this.drawing) return;
      this.ctx.lineTo(e.offsetX, e.offsetY);
      this.ctx.stroke();
    });

    this.canvas.addEventListener("mouseup", () => this.drawing = false);
    this.canvas.addEventListener("mouseleave", () => this.drawing = false);

    // Eventos Touch (Mobile)
    this.canvas.addEventListener("touchstart", (e) => {
      this.drawing = true;
      const touch = e.touches[0];
      const rect = this.canvas.getBoundingClientRect();
      this.ctx.beginPath();
      this.ctx.moveTo(touch.clientX - rect.left, touch.clientY - rect.top);
      e.preventDefault();
    });

    this.canvas.addEventListener("touchmove", (e) => {
      if (!this.drawing) return;
      const touch = e.touches[0];
      const rect = this.canvas.getBoundingClientRect();
      this.ctx.lineTo(touch.clientX - rect.left, touch.clientY - rect.top);
      this.ctx.stroke();
      e.preventDefault();
    });

    this.canvas.addEventListener("touchend", () => this.drawing = false);
  },

  carregarDadosTermo: async function() {
    try {
      const response = await fetch(`${API_BASE_URL}/termos`);
      if (!response.ok) {
        throw new Error("Erro ao carregar termos.");
      }
      
      const termos = await response.json();
      const termo = termos.find(t => t.id === this.termoId);

      if (!termo) {
        throw new Error("Termo não localizado no banco de dados.");
      }

      // Preenche os campos
      document.getElementById("termo-titulo-header").innerText = termo.titulo;
      
      // Formata e exibe o texto
      const textoBox = document.getElementById("termo-conteudo-box");
      textoBox.innerHTML = `
        <h3>${termo.titulo}</h3>
        <p style="white-space: pre-wrap;">${termo.conteudo}</p>
        <p><strong>Prazo de Devolução/Acerto:</strong> ${termo.prazoDevolucao ? new Date(termo.prazoDevolucao).toLocaleDateString('pt-BR') : 'Não definido'}</p>
      `;

      // Autopopula os campos caso já esteja logado ou retornado pelo termo
      if (termo.usuario) {
        document.getElementById("sign-nome").value = termo.usuario.nome;
      }

      if (termo.status === "ASSINADO") {
        this.exibirSucesso(termo.assinaturaNome, termo.assinaturaCpf, termo.assinaturaIp, termo.dataAssinatura);
      }

    } catch (error) {
      this.toast(error.message, "error");
    }
  },

  assinarTermo: async function() {
    const nome = document.getElementById("sign-nome").value.trim();
    const cpf = document.getElementById("sign-cpf").value.trim();

    if (this.isCanvasBlank()) {
      this.toast("Por favor, desenhe sua assinatura gráfica no espaço demarcado.", "warning");
      return;
    }

    const signatureImg = this.canvas.toDataURL("image/png");
    
    const btn = document.getElementById("btn-submit-signature");
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Processando Assinatura...`;

    try {
      const response = await fetch(`${API_BASE_URL}/public/termos/${this.termoId}/assinar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome,
          cpf,
          assinaturaImg,
          ip: this.ipUsuario
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Erro ao realizar assinatura.");
      }

      this.toast("Termo assinado digitalmente com sucesso!", "success");
      this.exibirSucesso(nome, cpf, this.ipUsuario, new Date().toISOString());

    } catch (error) {
      this.toast(error.message, "error");
      btn.disabled = false;
      btn.innerHTML = `<i class="fa-solid fa-file-signature"></i> Assinar Termo Digitalmente`;
    }
  },

  isCanvasBlank: function() {
    const blank = document.createElement("canvas");
    blank.width = this.canvas.width;
    blank.height = this.canvas.height;
    return this.canvas.toDataURL() === blank.toDataURL();
  },

  exibirSucesso: function(nome, cpf, ip, data) {
    document.getElementById("termo-main-content").style.display = "none";
    
    document.getElementById("success-sign-nome").innerText = nome;
    document.getElementById("success-sign-cpf").innerText = cpf;
    document.getElementById("success-sign-ip").innerText = ip;
    document.getElementById("success-sign-date").innerText = new Date(data).toLocaleString("pt-BR");
    
    document.getElementById("signature-success-content").classList.add("active");
  }
};

function limparCanvas() {
  if (signApp.canvas && signApp.ctx) {
    signApp.ctx.clearRect(0, 0, signApp.canvas.width, signApp.canvas.height);
  }
}

function realizarAssinatura(e) {
  e.preventDefault();
  signApp.assinarTermo();
}

// Inicializar
document.addEventListener("DOMContentLoaded", () => {
  signApp.init();
});
