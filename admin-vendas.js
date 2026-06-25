/**
 * BelKlock Semijoias - Módulo de Vendas Diretas da Administradora
 * 
 * Gerencia o fluxo completo de registro de vendas diretas pelo perfil Admin:
 * seleção de produto do estoque central, cliente, quantidade, forma de pagamento,
 * preview financeiro e integração com o histórico consolidado.
 */

// ==========================================
// MÓDULO DE VENDAS ADMIN (estende o objeto app)
// ==========================================

Object.assign(app, {

  // ==========================================
  // ABRIR MODAL DE VENDA DIRETA (ADMIN)
  // ==========================================

  abrirModalVendaAdmin: function() {
    const modal = document.getElementById("modal-venda-admin");
    if (!modal) return;

    // Popula o select de produtos do estoque central
    this._popularSelectProdutosVendaAdmin();

    // Popula o select de clientes
    this._popularSelectClientesVendaAdmin();

    // Reseta campos
    const selectProduto = document.getElementById("venda-admin-produto");
    if (selectProduto) selectProduto.value = "";

    const qtdInput = document.getElementById("venda-admin-qtd");
    if (qtdInput) { qtdInput.value = 1; qtdInput.max = 99; }

    const selectPagamento = document.getElementById("venda-admin-pagamento");
    if (selectPagamento) selectPagamento.value = "Pix";

    const obsInput = document.getElementById("venda-admin-observacoes");
    if (obsInput) obsInput.value = "";

    const clienteNomeInput = document.getElementById("venda-admin-cliente-nome");
    if (clienteNomeInput) clienteNomeInput.value = "";

    const clienteWhatsInput = document.getElementById("venda-admin-cliente-whatsapp");
    if (clienteWhatsInput) clienteWhatsInput.value = "";

    const previewBox = document.getElementById("venda-admin-preview");
    if (previewBox) previewBox.style.display = "none";

    const avisoBox = document.getElementById("venda-admin-aviso");
    if (avisoBox) avisoBox.style.display = "none";

    // Garante que a dica esteja visível no início
    const dicaBox = document.getElementById("venda-admin-dica");
    if (dicaBox) dicaBox.style.display = "block";

    // Garante que o box de cliente avulso comece oculto
    const novoClienteBox = document.getElementById("venda-admin-novo-cliente-box");
    if (novoClienteBox) novoClienteBox.style.display = "none";

    modal.classList.add("active");
  },

  _popularSelectProdutosVendaAdmin: function() {
    const select = document.getElementById("venda-admin-produto");
    if (!select) return;

    const produtos = this.state.produtos.filter(p => Number(p.quantidade || 0) > 0);

    select.innerHTML = "<option value=''>— Selecione um produto do estoque —</option>";
    produtos.forEach(p => {
      const custoTotal = (Number(p.custoBruto || 0) + Number(p.custoBanho || 0) + Number(p.custoLiquido || 0));
      const precoVenda = p.precoVenda || (custoTotal * (p.markup || 3.0));
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = `${p.codigo ? p.codigo + ' — ' : ''}${p.nome} (${p.quantidade} unid. disp. — R$ ${precoVenda.toFixed(2).replace('.', ',')})`;
      opt.setAttribute("data-preco", precoVenda.toFixed(2));
      opt.setAttribute("data-max", p.quantidade);
      opt.setAttribute("data-custo", custoTotal.toFixed(2));
      opt.setAttribute("data-nome", p.nome);
      opt.setAttribute("data-codigo", p.codigo || "");
      select.appendChild(opt);
    });
  },

  _popularSelectClientesVendaAdmin: function() {
    const select = document.getElementById("venda-admin-cliente");
    if (!select) return;

    select.innerHTML = `
      <option value="avulso">— Cliente Avulsa (sem cadastro) —</option>
      <option value="novo">[ + Cadastrar Nova Cliente ]</option>
    `;
    (this.state.clientes || []).forEach(c => {
      const opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = `${c.nome}${c.whatsapp ? ' — ' + c.whatsapp : ''}`;
      opt.setAttribute("data-whatsapp", c.whatsapp || "");
      select.appendChild(opt);
    });

    // Ao mudar cliente, mostrar/ocultar campo de cliente avulso
    const novoBox = document.getElementById("venda-admin-novo-cliente-box");
    if (select && novoBox) {
      // Como o padrão é "avulso", começa oculto
      novoBox.style.display = "none";
      
      select.onchange = () => {
        novoBox.style.display = select.value === "novo" ? "block" : "none";
      };
    }
  },

  // ==========================================
  // ATUALIZAR PREVIEW DA VENDA ADMIN
  // ==========================================

  atualizarPreviewVendaAdmin: function() {
    const select = document.getElementById("venda-admin-produto");
    const qtdInput = document.getElementById("venda-admin-qtd");
    const previewBox = document.getElementById("venda-admin-preview");
    const avisoBox = document.getElementById("venda-admin-aviso");
    const dicaBox = document.getElementById("venda-admin-dica");

    if (!select || !qtdInput || !previewBox) return;

    const selectedOpt = select.options[select.selectedIndex];
    if (!selectedOpt || !selectedOpt.value) {
      previewBox.style.display = "none";
      if (dicaBox) dicaBox.style.display = "block";
      return;
    }

    // Oculta a dica e mostra o preview
    if (dicaBox) dicaBox.style.display = "none";

    const preco = parseFloat(selectedOpt.getAttribute("data-preco") || 0);
    const custo = parseFloat(selectedOpt.getAttribute("data-custo") || 0);
    const max = parseInt(selectedOpt.getAttribute("data-max") || 99);
    const qtd = parseInt(qtdInput.value) || 1;

    qtdInput.max = max;

    // Aviso de quantidade excedida
    if (avisoBox) {
      if (qtd > max) {
        avisoBox.style.display = "block";
        const avisoTexto = document.getElementById("venda-admin-aviso-texto");
        if (avisoTexto) avisoTexto.innerText = `Estoque insuficiente. Apenas ${max} unidade(s) disponíveis.`;
      } else {
        avisoBox.style.display = "none";
      }
    }

    const qtdReal = Math.min(qtd, max);
    const total = preco * qtdReal;
    const custoTotal = custo * qtdReal;
    const lucroEstimado = total - custoTotal;
    const margemLucro = total > 0 ? ((lucroEstimado / total) * 100).toFixed(1) : 0;

    const nomeProduto = selectedOpt.getAttribute("data-nome") || selectedOpt.textContent.split(" (")[0];

    const elNome = document.getElementById("venda-admin-prev-nome");
    const elQtd = document.getElementById("venda-admin-prev-qtd");
    const elPrecoUnit = document.getElementById("venda-admin-prev-preco-unit");
    const elTotal = document.getElementById("venda-admin-prev-total");
    const elLucro = document.getElementById("venda-admin-prev-lucro");
    const elMargem = document.getElementById("venda-admin-prev-margem");

    if (elNome) elNome.innerText = nomeProduto;
    if (elQtd) elQtd.innerText = `${qtdReal} unid.`;
    if (elPrecoUnit) elPrecoUnit.innerText = `R$ ${preco.toFixed(2).replace('.', ',')}`;
    if (elTotal) elTotal.innerText = `R$ ${total.toFixed(2).replace('.', ',')}`;
    if (elLucro) elLucro.innerText = `R$ ${lucroEstimado.toFixed(2).replace('.', ',')}`;
    if (elMargem) elMargem.innerText = `${margemLucro}%`;

    previewBox.style.display = "block";
  },

  // ==========================================
  // AJUSTAR QUANTIDADE DA VENDA ADMIN (+/-)
  // ==========================================

  ajustarQtdVendaAdmin: function(delta) {
    const input = document.getElementById("venda-admin-qtd");
    if (!input) return;
    let val = parseInt(input.value) || 1;
    const max = parseInt(input.max) || 99;
    val = Math.min(Math.max(val + delta, 1), max);
    input.value = val;
    this.atualizarPreviewVendaAdmin();
  },

  // ==========================================
  // CONFIRMAR VENDA DIRETA (ADMIN)
  // ==========================================

  confirmarVendaAdmin: async function() {
    const selectProduto = document.getElementById("venda-admin-produto");
    const selectCliente = document.getElementById("venda-admin-cliente");
    const qtdInput = document.getElementById("venda-admin-qtd");
    const pagamentoInput = document.getElementById("venda-admin-pagamento");
    const obsInput = document.getElementById("venda-admin-observacoes");

    if (!selectProduto || !qtdInput) return;

    const produtoId = selectProduto.value;
    const quantidade = parseInt(qtdInput.value) || 0;

    if (!produtoId) {
      this.toast("Por favor, selecione um produto para registrar a venda.", "warning");
      return;
    }
    if (quantidade < 1) {
      this.toast("A quantidade deve ser pelo menos 1.", "warning");
      return;
    }

    const selectedOpt = selectProduto.options[selectProduto.selectedIndex];
    const max = parseInt(selectedOpt.getAttribute("data-max") || 0);
    if (quantidade > max) {
      this.toast(`Estoque insuficiente. Disponível: ${max} unidade(s).`, "warning");
      return;
    }

    const btnConfirmar = document.getElementById("btn-confirmar-venda-admin");
    if (btnConfirmar) {
      btnConfirmar.disabled = true;
      btnConfirmar.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Registrando...';
    }

    const offlineMode = this.state.token && this.state.token.startsWith("mock_");

    try {
      const preco = parseFloat(selectedOpt.getAttribute("data-preco") || 0);
      const custo = parseFloat(selectedOpt.getAttribute("data-custo") || 0);
      const nomeProduto = selectedOpt.getAttribute("data-nome") || "";
      const codigoProduto = selectedOpt.getAttribute("data-codigo") || "";
      const formaPagamento = pagamentoInput ? pagamentoInput.value : "Pix";
      const observacoes = obsInput ? obsInput.value.trim() : "";

      // Dados do cliente
      let clienteId = selectCliente ? selectCliente.value : "avulso";
      let nomeCliente = "Cliente Avulso";
      let whatsappCliente = "";

      if (clienteId && clienteId !== "avulso" && clienteId !== "novo") {
        const clienteOpt = selectCliente.options[selectCliente.selectedIndex];
        nomeCliente = clienteOpt.textContent.split(" — ")[0];
        whatsappCliente = clienteOpt.getAttribute("data-whatsapp") || "";
      } else if (clienteId === "novo") {
        // Novo cliente digitado manualmente
        const nomeAvulso = document.getElementById("venda-admin-cliente-nome");
        const whatsAvulso = document.getElementById("venda-admin-cliente-whatsapp");
        if (nomeAvulso && nomeAvulso.value.trim()) {
          nomeCliente = nomeAvulso.value.trim();
        }
        if (whatsAvulso && whatsAvulso.value.trim()) {
          whatsappCliente = whatsAvulso.value.trim();
        }

        // Se informou Nome e WhatsApp, registra nova cliente na API antes se estiver online
        if (!offlineMode && this.state.token && !this.state.token.startsWith("mock_") && nomeCliente !== "Cliente Avulso" && whatsappCliente) {
          try {
            const novaCliente = await this.requisitarAPI("/clientes", "POST", { nome: nomeCliente, whatsapp: whatsappCliente });
            clienteId = novaCliente.id;
            if (!this.state.clientes) this.state.clientes = [];
            this.state.clientes.push(novaCliente);
            // Atualiza select para refletir a nova cliente cadastrada
            this._popularSelectClientesVendaAdmin();
            const selectClienteElement = document.getElementById("venda-admin-cliente");
            if (selectClienteElement) selectClienteElement.value = clienteId;
          } catch(e) {
            console.warn("Não foi possível salvar a cliente automaticamente:", e.message);
          }
        }
      }

      const totalVenda = preco * quantidade;
      const custoTotalVenda = custo * quantidade;
      const lucroEstimado = totalVenda - custoTotalVenda;

      let novaVenda;

      if (offlineMode) {
        // ====== MODO OFFLINE (localStorage) ======
        novaVenda = {
          id: "mock_venda_admin_" + Date.now(),
          data: new Date().toISOString(),
          tipo: "direta",
          produtoId: produtoId,
          nomeProduto: nomeProduto,
          codigoProduto: codigoProduto,
          quantidade: quantidade,
          precoVenda: preco,
          custoUnitario: custo,
          total: totalVenda,
          custoTotal: custoTotalVenda,
          lucroEstimado: lucroEstimado,
          comissao: 0,
          formaPagamento: formaPagamento,
          observacoes: observacoes,
          clienteId: clienteId || null,
          nomeCliente: nomeCliente,
          whatsappCliente: whatsappCliente,
          vendedor: "BelKlock (Direta)",
          contato: whatsappCliente || "—",
          cliente: nomeCliente,
          usuarioId: null
        };

        // Deduz do estoque local
        const prodIdx = this.state.produtos.findIndex(p => p.id === produtoId);
        if (prodIdx !== -1) {
          this.state.produtos[prodIdx].quantidade = Math.max(0, this.state.produtos[prodIdx].quantidade - quantidade);
        }

        // Persiste no localStorage
        this.salvarDadosNoLocalStorage();

        const localVendasKey = "belklock_vendas_admin";
        const vendasAdminLocais = JSON.parse(localStorage.getItem(localVendasKey) || "[]");
        vendasAdminLocais.unshift(novaVenda);
        localStorage.setItem(localVendasKey, JSON.stringify(vendasAdminLocais));

      } else {
        // ====== MODO ONLINE (API) ======
        const body = {
          produtoId,
          codigo: codigoProduto,
          nome: nomeProduto,
          quantidade,
          preco,
          nomeCliente,
          whatsappCliente,
          clienteId: (clienteId && clienteId !== "avulso" && clienteId !== "novo") ? clienteId : null,
          formaPagamento,
          observacoes
        };

        const resp = await this.requisitarAPI("/vendas-diretas", "POST", body);

        novaVenda = {
          id: resp.id || ("venda_admin_" + Date.now()),
          data: resp.data || new Date().toISOString(),
          tipo: "direta",
          produtoId: produtoId,
          nomeProduto: resp.nomeProduto || nomeProduto,
          codigoProduto: resp.codigoProduto || codigoProduto,
          quantidade: quantidade,
          precoVenda: preco,
          custoUnitario: custo,
          total: totalVenda,
          custoTotal: custoTotalVenda,
          lucroEstimado: lucroEstimado,
          comissao: 0,
          formaPagamento: formaPagamento,
          observacoes: observacoes,
          clienteId: clienteId || null,
          nomeCliente: nomeCliente,
          whatsappCliente: whatsappCliente,
          vendedor: "BelKlock (Direta)",
          contato: whatsappCliente || "—",
          cliente: nomeCliente,
          usuarioId: null
        };

        // Atualiza estoque local a partir da resposta da API
        const prodIdx = this.state.produtos.findIndex(p => p.id === produtoId);
        if (prodIdx !== -1) {
          const novaQtd = resp.estoqueRestante !== undefined
            ? resp.estoqueRestante
            : Math.max(0, this.state.produtos[prodIdx].quantidade - quantidade);
          this.state.produtos[prodIdx].quantidade = novaQtd;
        }
      }

      // Adiciona à lista de vendas consolidadas em memória
      if (!this.state.vendasConsolidadas) this.state.vendasConsolidadas = [];
      this.state.vendasConsolidadas.unshift(novaVenda);

      // Fecha o modal
      const modal = document.getElementById("modal-venda-admin");
      if (modal) modal.classList.remove("active");

      // Re-renderiza as telas afetadas
      this.renderizarDashboard();
      if (this.state.abaAtiva === "vendas-geral") {
        this.renderizarVendasConsolidadas();
      }
      if (this.state.abaAtiva === "estoque") {
        this.renderizarEstoque();
      }

      // Feedback de sucesso
      this.toast(
        `✅ Venda registrada! ${nomeProduto} — ${quantidade} pç(s). Total: R$ ${totalVenda.toFixed(2).replace(".", ",")}`,
        "success"
      );

    } catch (error) {
      console.error("Erro ao registrar venda da admin:", error);
      this.toast("Erro ao registrar a venda: " + error.message, "error");
    } finally {
      if (btnConfirmar) {
        btnConfirmar.disabled = false;
        btnConfirmar.innerHTML = '<i class="fa-solid fa-check"></i> Confirmar Venda';
      }
    }
  },

  // ==========================================
  // MÉTRICAS DE VENDAS DIRETAS PARA O DASHBOARD
  // ==========================================

  obterMetricasVendasAdmin: function() {
    const vendas = this.state.vendasConsolidadas || [];
    const hoje = new Date();
    const hojeStr = hoje.toDateString();

    const vendasDiretas = vendas.filter(v => v.tipo === "direta");
    const vendasHoje = vendasDiretas.filter(v => new Date(v.data).toDateString() === hojeStr);
    const vendasMes = vendasDiretas.filter(v => {
      const d = new Date(v.data);
      return d.getMonth() === hoje.getMonth() && d.getFullYear() === hoje.getFullYear();
    });

    return {
      totalHoje: vendasHoje.reduce((s, v) => s + (v.total || 0), 0),
      qtdHoje: vendasHoje.length,
      totalMes: vendasMes.reduce((s, v) => s + (v.total || 0), 0),
      qtdMes: vendasMes.length,
      lucroMes: vendasMes.reduce((s, v) => s + (v.lucroEstimado || 0), 0)
    };
  },

  // ==========================================
  // INTEGRAR VENDAS ADMIN NO MODO OFFLINE
  // ==========================================

  carregarVendasAdminOffline: function() {
    const localVendasKey = "belklock_vendas_admin";
    const vendasAdminLocais = JSON.parse(localStorage.getItem(localVendasKey) || "[]");
    return vendasAdminLocais;
  }

});

// ==========================================
// INICIALIZAÇÃO DOS EVENTOS DO MÓDULO ADMIN VENDAS
// ==========================================

document.addEventListener("DOMContentLoaded", function() {
  // Os eventos são registrados via registrarEventosUI() no app principal
  // Este listener garante fallback se o modal já estiver no DOM
  const btnAbrir = document.getElementById("btn-open-modal-venda-admin");
  if (btnAbrir && !btnAbrir._vendasAdminListenerAttached) {
    btnAbrir.addEventListener("click", () => app.abrirModalVendaAdmin());
    btnAbrir._vendasAdminListenerAttached = true;
  }
});
