/**
 * Conecta Joias - Checkout de Pagamento Script (Real Integration with ASAAS)
 */

const API_BASE_URL = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1" 
  ? "http://localhost:5000/api" 
  : `${window.location.origin}/api`;

const checkout = {
  linkId: null,
  valor: 0,
  dadosLink: null,

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

        // Se clicar na aba PIX e não estiver gerado ainda, gera automaticamente
        if (targetTab === "pix" && this.dadosLink && !this.dadosLink.asaasPaymentId) {
          this.gerarPixAutomatico();
        }
      });
    });

    // Máscaras de Entrada do Cartão
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

    const cardNum = document.getElementById("card-number");
    if (cardNum) {
      cardNum.addEventListener("input", (e) => {
        let value = e.target.value.replace(/\D/g, "");
        if (value.length > 16) value = value.slice(0, 16);
        let parts = [];
        for (let i = 0; i < value.length; i += 4) {
          parts.push(value.substring(i, i + 4));
        }
        e.target.value = parts.join(" ");
      });
    }

    // Máscara de CEP
    const cep = document.getElementById("card-cep");
    if (cep) {
      cep.addEventListener("input", (e) => {
        let value = e.target.value.replace(/\D/g, "");
        if (value.length > 8) value = value.slice(0, 8);
        if (value.length > 5) {
          e.target.value = `${value.slice(0, 5)}-${value.slice(5)}`;
        } else {
          e.target.value = value;
        }
      });
    }

    // Máscaras de CPF
    const aplicarMascaraCpf = (inputEl) => {
      if (!inputEl) return;
      inputEl.addEventListener("input", (e) => {
        let value = e.target.value.replace(/\D/g, "");
        if (value.length > 14) value = value.slice(0, 14); // CPF ou CNPJ
        
        if (value.length <= 11) {
          // CPF: 000.000.000-00
          if (value.length > 9) {
            e.target.value = `${value.slice(0, 3)}.${value.slice(3, 6)}.${value.slice(6, 9)}-${value.slice(9)}`;
          } else if (value.length > 6) {
            e.target.value = `${value.slice(0, 3)}.${value.slice(3, 6)}.${value.slice(6)}`;
          } else if (value.length > 3) {
            e.target.value = `${value.slice(0, 3)}.${value.slice(3)}`;
          } else {
            e.target.value = value;
          }
        } else {
          // CNPJ: 00.000.000/0000-00
          if (value.length > 12) {
            e.target.value = `${value.slice(0, 2)}.${value.slice(2, 5)}.${value.slice(5, 8)}/${value.slice(8, 12)}-${value.slice(12)}`;
          } else if (value.length > 8) {
            e.target.value = `${value.slice(0, 2)}.${value.slice(2, 5)}.${value.slice(5, 8)}/${value.slice(8)}`;
          } else {
            e.target.value = value;
          }
        }
      });
    };

    aplicarMascaraCpf(document.getElementById("card-cpf"));
    aplicarMascaraCpf(document.getElementById("boleto-cpf"));
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
      this.dadosLink = linkData;
      this.valor = linkData.valor;

      // Preenche dados do recebedor/cliente na interface
      document.getElementById("pay-valor").innerText = `R$ ${linkData.valor.toFixed(2)}`;
      document.getElementById("pay-vendedora").innerText = linkData.usuario ? linkData.usuario.nome : "Conecta Joias";
      document.getElementById("pay-cliente").innerText = linkData.cliente ? linkData.cliente.nome : "Cliente Consumidor";

      // Se já estiver PAGO, redireciona para a tela de sucesso
      if (linkData.status === "PAGO") {
        this.exibirSucesso(this.linkId);
        return;
      }

      // Preenche os campos do pagador se já estiverem cadastrados no banco local
      if (linkData.cliente) {
        const boletoNome = document.getElementById("boleto-nome");
        if (boletoNome) boletoNome.value = linkData.cliente.nome || "";
        const cardEmail = document.getElementById("card-email");
        if (cardEmail) cardEmail.value = linkData.cliente.email || "";
        const boletoEmail = document.getElementById("boleto-email");
        if (boletoEmail) boletoEmail.value = linkData.cliente.email || "";
      }

      // Se já tiver gerado PIX anteriormente e reabriu a página
      if (linkData.asaasPaymentId && linkData.formaEnvio === "PIX" && linkData.pixQrCode) {
        this.renderizarPix(linkData.pixQrCode, linkData.pixCopiaCola);
      } else {
        // Gera PIX por padrão logo no início se o método padrão for PIX ou se não houver pagamento gerado ainda
        this.gerarPixAutomatico();
      }

      // Se já tiver gerado Boleto anteriormente
      if (linkData.asaasPaymentId && linkData.formaEnvio === "BOLETO" && linkData.boletoLinhaDigitavel) {
        this.renderizarBoleto(linkData.boletoLinhaDigitavel, linkData.asaasInvoiceUrl);
      }

    } catch (error) {
      this.toast(error.message, "error");
    }
  },

  gerarPixAutomatico: async function() {
    const loadingEl = document.getElementById("pix-loading-section");
    const contentEl = document.getElementById("pix-content-section");
    if (!loadingEl || !contentEl) return;

    // Se já estiver renderizado, não gera de novo
    if (contentEl.style.display === "block") return;

    try {
      loadingEl.style.display = "block";
      contentEl.style.display = "none";

      const res = await fetch(`${API_BASE_URL}/public/pagamento/${this.linkId}/processar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          formaEnvio: "PIX",
          clienteNome: this.dadosLink.cliente ? this.dadosLink.cliente.nome : "Cliente Conecta Joias",
          clienteWhatsapp: this.dadosLink.cliente ? this.dadosLink.cliente.whatsapp : ""
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Erro ao processar PIX no ASAAS");
      }

      this.renderizarPix(data.pixQrCode, data.pixCopiaCola);
      
      // Atualiza estado local
      this.dadosLink.asaasPaymentId = data.asaasPaymentId;
      this.dadosLink.formaEnvio = "PIX";

    } catch (error) {
      this.toast(error.message, "error");
      loadingEl.innerHTML = `<i class="fa-solid fa-circle-xmark" style="font-size: 2.5rem; color: #ef5350;"></i>
        <p style="margin-top: 1rem; color: #ef5350; font-size: 0.85rem;">Falha ao obter PIX do ASAAS.<br>${error.message}</p>`;
    }
  },

  renderizarPix: function(qrCodeBase64, copiaCola) {
    const loadingEl = document.getElementById("pix-loading-section");
    const contentEl = document.getElementById("pix-content-section");
    const qrImg = document.getElementById("pix-qr-img");
    const codeText = document.getElementById("pix-code-text");

    if (loadingEl) loadingEl.style.display = "none";
    if (contentEl) contentEl.style.display = "block";
    
    if (qrImg) {
      // Se já vier com cabeçalho de data url, usa direto, senão adiciona
      qrImg.src = qrCodeBase64.startsWith("data:") ? qrCodeBase64 : `data:image/png;base64,${qrCodeBase64}`;
    }
    if (codeText) {
      codeText.innerText = copiaCola;
    }
  },

  renderizarBoleto: function(linhaDigitavel, pdfUrl) {
    const inputSec = document.getElementById("boleto-input-section");
    const resultSec = document.getElementById("boleto-result-section");
    const codeText = document.getElementById("boleto-barcode-text");
    const pdfLink = document.getElementById("boleto-pdf-link");

    if (inputSec) inputSec.style.display = "none";
    if (resultSec) resultSec.style.display = "block";

    if (codeText) codeText.innerText = linhaDigitavel;
    if (pdfLink) {
      pdfLink.href = pdfUrl;
      pdfLink.target = "_blank";
    }
  },

  exibirSucesso: function(id) {
    document.getElementById("checkout-main-content").style.display = "none";
    document.getElementById("success-id").innerText = id.toUpperCase();
    document.getElementById("success-date").innerText = new Date().toLocaleString("pt-BR");
    document.getElementById("payment-success-content").classList.add("active");
  }
};

// Ações Globais chamadas pelo HTML

function copiarPix() {
  const code = document.getElementById("pix-code-text").innerText.trim();
  if (!code || code === "-") return;
  navigator.clipboard.writeText(code).then(() => {
    checkout.toast("Código PIX Copia e Cola copiado!", "success");
  });
}

function copiarBoleto() {
  const code = document.getElementById("boleto-barcode-text").innerText.trim();
  if (!code || code === "-") return;
  navigator.clipboard.writeText(code).then(() => {
    checkout.toast("Código de barras do boleto copiado!", "success");
  });
}

// Emissão de Boleto Real
async function gerarBoletoReal(e) {
  e.preventDefault();
  
  const nome = document.getElementById("boleto-nome").value.trim();
  const cpf = document.getElementById("boleto-cpf").value.trim();
  const email = document.getElementById("boleto-email").value.trim();

  if (!nome || !cpf || !email) {
    checkout.toast("Preencha todos os campos para gerar o boleto.", "warning");
    return;
  }

  const btn = document.getElementById("btn-submit-boleto");
  const originalHtml = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Emitindo...`;

  try {
    const res = await fetch(`${API_BASE_URL}/public/pagamento/${checkout.linkId}/processar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        formaEnvio: "BOLETO",
        clienteNome: nome,
        clienteCpfCnpj: cpf,
        clienteEmail: email
      })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Erro ao emitir boleto");
    }

    checkout.toast("Boleto emitido com sucesso!", "success");
    checkout.renderizarBoleto(data.boletoLinhaDigitavel, data.invoiceUrl);

  } catch (error) {
    checkout.toast(error.message, "error");
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalHtml;
  }
}

// Processamento de Cartão Real
async function confirmarCartaoReal(e) {
  e.preventDefault();

  const holder = document.getElementById("card-holder").value.trim();
  const number = document.getElementById("card-number").value.trim();
  const expiry = document.getElementById("card-expiry").value.trim();
  const cvv = document.getElementById("card-cvv").value.trim();
  const cpf = document.getElementById("card-cpf").value.trim();
  const email = document.getElementById("card-email").value.trim();
  const cep = document.getElementById("card-cep").value.trim();
  const numero = document.getElementById("card-num-end").value.trim();

  if (!holder || !number || !expiry || !cvv || !cpf || !email || !cep || !numero) {
    checkout.toast("Por favor, preencha todos os dados solicitados.", "warning");
    return;
  }

  const partsExpiry = expiry.split("/");
  if (partsExpiry.length !== 2) {
    checkout.toast("Validade do cartão inválida. Use MM/AA.", "warning");
    return;
  }

  const btn = document.getElementById("btn-submit-cartao");
  const originalHtml = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Processando pagamento...`;

  try {
    const res = await fetch(`${API_BASE_URL}/public/pagamento/${checkout.linkId}/processar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        formaEnvio: "CARTAO",
        clienteNome: holder,
        clienteCpfCnpj: cpf,
        clienteEmail: email,
        cartaoDados: {
          holderName: holder,
          number: number,
          expiryMonth: partsExpiry[0],
          expiryYear: "20" + partsExpiry[1], // MM/AA -> MM/20AA
          cvv: cvv
        },
        enderecoDados: {
          cep: cep,
          numero: numero
        }
      })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Pagamento recusado pela operadora.");
    }

    if (data.status === "PAGO") {
      checkout.toast("Pagamento aprovado com sucesso!", "success");
      checkout.exibirSucesso(checkout.linkId);
    } else {
      checkout.toast("A transação está pendente de análise no ASAAS.", "info");
    }

  } catch (error) {
    checkout.toast(error.message, "error");
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalHtml;
  }
}

// Inicializar na carga da página
document.addEventListener("DOMContentLoaded", () => {
  checkout.init();
});
