/**
 * BelKlock Semijoias - Checkout de Pagamento Script
 */

const API_BASE_URL = "http://localhost:5000/api";

const checkout = {
  linkId: null,
  valor: 0,

  init: function() {
    this.carregarLinkId();
    this.registrarAcoes();
    
    if (this.linkId) {
      this.carregarDadosLink();
    } else {
      this.toast("ID do pagamento inválido.", "error");
    }
  },

  carregarLinkId: function() {
    const params = new URLSearchParams(window.location.search);
    this.linkId = params.get("id");
  },

  registrarAcoes: function() {
    // Alternar Abas
    const tabs = document.querySelectorAll(".pay-tab");
    tabs.forEach(tab => {
      tab.addEventListener("click", () => {
        tabs.forEach(t => t.classList.remove("active"));
        tab.classList.add("active");

        const targetTab = tab.getAttribute("data-tab");
        document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
        document.getElementById(`tab-content-${targetTab}`).classList.add("active");
      });
    });

    // Máscara validade cartão
    const expiry = document.getElementById("card-expiry");
    if (expiry) {
      expiry.addEventListener("input", (e) => {
        let value = e.target.value.replace(/\D/g, "");
        if (value.length > 4) value = value.slice(0, 4);
        if (value.length > 2) {
          e.target.value = `${value.slice(0, 2)}/${value.slice(2)}`;
        } else {
          e.target.value = value;
        }
      });
    }

    // Máscara número cartão
    const cardNum = document.getElementById("card-number");
    if (cardNum) {
      cardNum.addEventListener("input", (e) => {
        let value = e.target.value.replace(/\D/g, "");
        if (value.length > 16) value = value.slice(0, 16);
        let matches = value.match(/\d{4,16}/g);
        let match = matches && matches[0] || "";
        let parts = [];

        for (let i=0, len=match.length; i<len; i+=4) {
          parts.push(match.substring(i, i+4));
        }

        if (parts.length > 0) {
          e.target.value = parts.join(" ");
        } else {
          e.target.value = value;
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

  carregarDadosLink: async function() {
    try {
      const response = await fetch(`${API_BASE_URL}/public/pagamento/${this.linkId}`);
      if (!response.ok) {
        throw new Error("Não foi possível carregar os dados do link.");
      }

      const linkData = await response.json();
      this.valor = linkData.valor;

      // Preenche na tela
      document.getElementById("pay-valor").innerText = `R$ ${linkData.valor.toFixed(2)}`;
      document.getElementById("pay-vendedora").innerText = linkData.usuario ? linkData.usuario.nome : "BelKlock";
      document.getElementById("pay-cliente").innerText = linkData.cliente ? linkData.cliente.nome : "Cliente Consumidor";

      // QR Code PIX com valor dinâmico para simulação
      const qrImg = document.getElementById("pix-qr-img");
      if (qrImg) {
        qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent('pix-belklock-val-' + linkData.valor + '-id-' + this.linkId)}`;
      }

      // Se já estiver PAGO, exibe tela de sucesso direto
      if (linkData.status === "PAGO") {
        this.exibirSucesso(this.linkId);
      }

    } catch (error) {
      this.toast(error.message, "error");
    }
  },

  confirmarPagamento: async function() {
    try {
      const response = await fetch(`${API_BASE_URL}/public/pagamento/${this.linkId}/confirmar`, {
        method: "POST"
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Erro ao processar baixa.");
      }

      this.toast("Pagamento confirmado com sucesso!", "success");
      this.exibirSucesso(this.linkId);

    } catch (error) {
      this.toast(error.message, "error");
    }
  },

  exibirSucesso: function(id) {
    document.getElementById("checkout-main-content").style.display = "none";
    
    document.getElementById("success-id").innerText = id.toUpperCase();
    document.getElementById("success-date").innerText = new Date().toLocaleString("pt-BR");
    
    document.getElementById("payment-success-content").classList.add("active");
  }
};

function copiarPix() {
  const code = document.getElementById("pix-code-text").innerText.trim();
  navigator.clipboard.writeText(code).then(() => {
    checkout.toast("Código PIX Copia e Cola copiado!", "success");
  });
}

function copiarBoleto() {
  const code = document.getElementById("boleto-barcode-text").innerText.trim();
  navigator.clipboard.writeText(code).then(() => {
    checkout.toast("Código de barras do boleto copiado!", "success");
  });
}

function baixarBoletoPDF() {
  checkout.toast("Iniciando download do boleto em PDF...", "info");
  setTimeout(() => {
    checkout.toast("Download do boleto simulado concluído!", "success");
  }, 1500);
}

function confirmarPagamentoSimulado() {
  checkout.confirmarPagamento();
}

function confirmarCartao(e) {
  e.preventDefault();
  
  const holder = document.getElementById("card-holder").value.trim();
  const num = document.getElementById("card-number").value.trim();
  const exp = document.getElementById("card-expiry").value.trim();
  const cvv = document.getElementById("card-cvv").value.trim();

  if(!holder || num.length < 19 || exp.length < 5 || cvv.length < 3) {
    checkout.toast("Por favor, preencha os dados do cartão corretamente.", "warning");
    return;
  }

  const btn = document.getElementById("btn-submit-cartao");
  btn.disabled = true;
  btn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Processando...`;

  setTimeout(() => {
    checkout.confirmarPagamento();
  }, 2000);
}

// Inicializar
document.addEventListener("DOMContentLoaded", () => {
  checkout.init();
});
