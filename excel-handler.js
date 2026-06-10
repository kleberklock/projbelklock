/**
 * Excel & CSV Handler - BelKlock Semijoias
 * Gerencia a importação e exportação de dados em formatos compatíveis com o Microsoft Excel.
 * O formato padrão brasileiro do Excel utiliza ponto e vírgula (;) como separador
 * e requer o BOM (Byte Order Mark) no início do arquivo UTF-8 para exibir acentos corretamente.
 */

const ExcelHandler = {
  /**
   * Exporta a lista de produtos em estoque para CSV compatível com Excel.
   * @param {Array} produtos Lista de produtos do estado da aplicação.
   */
  exportarEstoque: function(produtos, colunasEstoque = null) {
    if (!produtos || produtos.length === 0) {
      alert("Não há produtos no estoque para exportar.");
      return;
    }

    // Se o usuário usou uma planilha dinâmica, nós a exportamos exatamente com as colunas originais!
    let cabecalho = colunasEstoque || [
      "Código/Referência",
      "Nome do Produto",
      "Categoria",
      "Qtd. Estoque",
      "Custo Bruto (R$)",
      "Custo Banho (R$)",
      "Custo Líquido/Operacional (R$)",
      "Custo Total (R$)",
      "Markup",
      "Preço de Venda (R$)",
      "Lucro por Peça (R$)",
      "Faturamento Total Projetado (R$)"
    ];

    let linhas = [cabecalho.join(";")];

    produtos.forEach(p => {
      let linha = [];
      
      if (colunasEstoque) {
        // Exportação dinâmica mantendo exatamente as colunas e a ordem que vieram da planilha
        colunasEstoque.forEach(col => {
          let valor = p._valoresDinamicos && p._valoresDinamicos[col] !== undefined ? p._valoresDinamicos[col] : "";
          
          // Se o valor foi alterado via UI (ex: quantidade editada), nós atualizamos o valor da célula!
          const colLower = col.toLowerCase();
          if (colLower.includes("qtd") || colLower.includes("quantidade") || colLower.includes("estoque") || colLower.includes("saldo") || colLower.includes("unidades")) {
            valor = p.quantidade;
          } else if (colLower.includes("código") || colLower.includes("codigo") || colLower.includes("ref") || colLower.includes("id")) {
            valor = p.codigo;
          } else if (colLower.includes("nome") || colLower.includes("produto") || colLower.includes("peça") || colLower.includes("peca")) {
            valor = p.nome;
          }
          
          linha.push(valor);
        });
      } else {
        // Exportação estática clássica
        const custoTotal = Number(p.custoBruto || 0) + Number(p.custoBanho || 0) + Number(p.custoLiquido || 0);
        const precoVenda = custoTotal * Number(p.markup || 1);
        const lucroUnitario = precoVenda - custoTotal;
        const faturamentoTotal = precoVenda * Number(p.quantidade || 0);

        linha = [
          p.codigo || "",
          p.nome || "",
          p.categoria || "",
          p.quantidade || 0,
          this.formatarNumeroExcel(p.custoBruto),
          this.formatarNumeroExcel(p.custoBanho),
          this.formatarNumeroExcel(p.custoLiquido),
          this.formatarNumeroExcel(custoTotal),
          this.formatarNumeroExcel(p.markup),
          this.formatarNumeroExcel(precoVenda),
          this.formatarNumeroExcel(lucroUnitario),
          this.formatarNumeroExcel(faturamentoTotal)
        ];
      }

      linhas.push(linha.join(";"));
    });

    const csvContent = "\uFEFF" + linhas.join("\n"); // \uFEFF força o UTF-8 com BOM no Excel do Windows
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    
    const dataAtual = new Date().toISOString().split('T')[0];
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `estoque_belklock_${dataAtual}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },

  /**
   * Exporta o recibo e histórico de acertos da revendedora para CSV.
   * @param {Object} revendedora Dados da revendedora.
   * @param {Array} itensConsignados Itens atualmente consignados ou no acerto.
   */
  exportarAcertoRevendedora: function(revendedora, itensConsignados) {
    if (!itensConsignados || itensConsignados.length === 0) {
      alert("Não há dados de consignação para exportar.");
      return;
    }

    const cabecalho = [
      "Código",
      "Produto",
      "Quantidade Consignada",
      "Quantidade Vendida",
      "Quantidade Devolvida",
      "Preço de Venda Unitário (R$)",
      "Total Bruto (R$)",
      "Comissão Revendedora (R$)",
      "Valor Líquido BelKlock (R$)"
    ];

    let linhas = [];
    
    // Metadados do acerto
    linhas.push(`ACERTO DE CONSIGNADO;BELKLOCK SEMIJOIAS;;;;;;;`);
    linhas.push(`Revendedora:;${revendedora.nome};;;;;;;`);
    linhas.push(`WhatsApp:;${revendedora.whatsapp || ""};;;;;;;`);
    linhas.push(`Comissão acordada:;${revendedora.comissao || 30}%;;;;;;;`);
    linhas.push(`Data do acerto:;${new Date().toLocaleDateString('pt-BR')};;;;;;;`);
    linhas.push(``); // Linha em branco
    linhas.push(cabecalho.join(";"));

    let totalGeralBruto = 0;
    let totalGeralComissao = 0;
    let totalGeralLiquido = 0;

    itensConsignados.forEach(item => {
      const precoVenda = Number(item.precoVenda || 0);
      const qtdConsignada = Number(item.quantidadeConsignada || 0);
      const qtdVendida = Number(item.quantidadeVendida || 0);
      const qtdDevolvida = Number(item.quantidadeDevolvida || 0);
      
      const totalBrutoItem = precoVenda * qtdVendida;
      const comissaoItem = totalBrutoItem * (Number(revendedora.comissao || 30) / 100);
      const liquidoItem = totalBrutoItem - comissaoItem;

      totalGeralBruto += totalBrutoItem;
      totalGeralComissao += comissaoItem;
      totalGeralLiquido += liquidoItem;

      const line = [
        item.codigo || "",
        item.nome || "",
        qtdConsignada,
        qtdVendida,
        qtdDevolvida,
        this.formatarNumeroExcel(precoVenda),
        this.formatarNumeroExcel(totalBrutoItem),
        this.formatarNumeroExcel(comissaoItem),
        this.formatarNumeroExcel(liquidoItem)
      ];

      linhas.push(line.join(";"));
    });

    linhas.push(``);
    linhas.push(`TOTAL GERAL:;;;;;R$ ${this.formatarNumeroExcel(totalGeralBruto)};R$ ${this.formatarNumeroExcel(totalGeralComissao)};R$ ${this.formatarNumeroExcel(totalGeralLiquido)}`);

    const csvContent = "\uFEFF" + linhas.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `acerto_${revendedora.nome.toLowerCase().replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },

  /**
   * Lê e analisa um arquivo CSV importado pelo usuário para cadastrar produtos no estoque.
   * Cria colunas dinamicamente baseado nos cabeçalhos exatos da planilha do usuário.
   * @param {File} file Arquivo carregado do input file.
   * @param {Function} callbackFuncao Função de retorno.
   */
  importarEstoque: function(file, callbackFuncao) {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.data.length === 0) {
          alert("O arquivo importado parece estar vazio ou não foi reconhecido.");
          return;
        }

        // Pega as colunas originais do cabeçalho
        const cabecalhosOriginais = results.meta.fields || [];
        const cabecalhosNorm = cabecalhosOriginais.map(c => c.trim().toLowerCase());

        const produtosImportados = [];
        const revendedorasMapeadas = {};

        // Mapeamento flexível de índices com diversos sinônimos possíveis
        let idxCodigo = cabecalhosNorm.findIndex(c => 
          c === "código" || c === "codigo" || c === "ref" || c === "referência" || 
          c === "referencia" || c === "id" || c === "cod" || c === "sku" || c === "referencia/codigo"
        );
        if (idxCodigo === -1) {
          idxCodigo = cabecalhosNorm.findIndex(c => 
            c.includes("código") || c.includes("codigo") || c.includes("ref") || 
            c.includes("referência") || c.includes("referencia") || c.includes("id") || c.includes("sku")
          );
        }

        let idxNome = cabecalhosNorm.findIndex(c => 
          c === "nome" || c === "produto" || c === "peça" || c === "peca" || 
          c === "descrição" || c === "descricao" || c === "item" || c === "nome do produto" || c === "nome da peca"
        );
        if (idxNome === -1) {
          idxNome = cabecalhosNorm.findIndex(c => 
            c.includes("nome") || c.includes("produto") || c.includes("peça") || 
            c.includes("peca") || c.includes("descrição") || c.includes("descricao") || c.includes("item")
          );
        }

        let idxCategoria = cabecalhosNorm.findIndex(c => 
          c === "categoria" || c === "tipo" || c === "grupo" || c === "classe" || c === "subgrupo"
        );
        if (idxCategoria === -1) {
          idxCategoria = cabecalhosNorm.findIndex(c => 
            c.includes("categoria") || c.includes("tipo") || c.includes("grupo") || c.includes("classe")
          );
        }

        let idxQtd = cabecalhosNorm.findIndex(c => 
          c === "qtd" || c === "quantidade" || c === "estoque" || c === "unidades" || 
          c === "saldo" || c === "unid" || c === "central" || c === "estoque central" || c === "qnt" || c === "quant" || c === "saldo central"
        );
        if (idxQtd === -1) {
          idxQtd = cabecalhosNorm.findIndex(c => 
            c.includes("qtd") || c.includes("quantidade") || c.includes("estoque") || 
            c.includes("unidades") || c.includes("saldo") || c.includes("central") || c.includes("qnt")
          );
        }

        let idxBruto = cabecalhosNorm.findIndex(c => 
          c === "bruto" || c === "custo bruto" || c === "custo" || c === "compra" || c === "preço de custo" || c === "custo bruto (r$)"
        );
        if (idxBruto === -1) {
          idxBruto = cabecalhosNorm.findIndex(c => 
            c.includes("bruto") || (c.includes("custo") && !c.includes("banho") && !c.includes("líquido") && !c.includes("liquido") && !c.includes("total"))
          );
        }

        let idxBanho = cabecalhosNorm.findIndex(c => 
          c === "banho" || c === "custo banho" || c === "galvano" || c === "custo do banho" || c === "custo banho (r$)"
        );
        if (idxBanho === -1) {
          idxBanho = cabecalhosNorm.findIndex(c => c.includes("banho") || c.includes("galvano"));
        }

        let idxLiquido = cabecalhosNorm.findIndex(c => 
          c === "líquido" || c === "liquido" || c === "operacional" || c === "custo líquido" || 
          c === "custo liquido" || c === "embalagem" || c === "outros" || c === "custo operacional" || c === "custo líquido/operacional (r$)"
        );
        if (idxLiquido === -1) {
          idxLiquido = cabecalhosNorm.findIndex(c => 
            c.includes("líquido") || c.includes("liquido") || c.includes("operacional") || c.includes("embalagem")
          );
        }

        let idxMarkup = cabecalhosNorm.findIndex(c => 
          c === "markup" || c === "margem" || c === "mkp" || c === "multiplicador" || c === "lucro"
        );
        if (idxMarkup === -1) {
          idxMarkup = cabecalhosNorm.findIndex(c => c.includes("markup") || c.includes("margem") || c.includes("mkp"));
        }

        let idxPrecoVenda = cabecalhosNorm.findIndex(c => 
          c === "venda" || c === "preço de venda" || c === "preco de venda" || 
          c === "valor venda" || c === "sugerido" || c === "preco" || c === "preço" || c === "preço de venda (r$)"
        );
        if (idxPrecoVenda === -1) {
          idxPrecoVenda = cabecalhosNorm.findIndex(c => 
            c.includes("venda") || c.includes("preço") || c.includes("preco") || c.includes("valor")
          );
        }

        let idxRevNome = cabecalhosNorm.findIndex(c => c.includes("revendedora") || c.includes("nome revendedora") || c.includes("parceira") || c.includes("vendedora"));
        let idxRevWhats = cabecalhosNorm.findIndex(c => c.includes("whatsapp") || c.includes("tel revendedora") || c.includes("telefone revendedora") || c.includes("celular"));
        let idxRevComissao = cabecalhosNorm.findIndex(c => c.includes("comissao") || c.includes("comissão") || c.includes("porcentagem revendedora"));
        let idxRevQtdConsig = cabecalhosNorm.findIndex(c => c.includes("consignada") || c.includes("qtd consignada") || c.includes("quantidade consignada") || c.includes("na maleta"));

        results.data.forEach(row => {
          const produtoId = 'prod_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
          const produtoObjeto = {
            id: produtoId
          };

          const codigoVal = idxCodigo !== -1 ? row[cabecalhosOriginais[idxCodigo]] : null;
          const codigo = codigoVal ? codigoVal.toString().trim() : "REF-" + Math.floor(1000 + Math.random() * 9000);

          const nomeVal = idxNome !== -1 ? row[cabecalhosOriginais[idxNome]] : null;
          let nome = nomeVal ? nomeVal.toString().trim() : "";

          const categoriaVal = idxCategoria !== -1 ? row[cabecalhosOriginais[idxCategoria]] : null;
          const categoria = categoriaVal ? categoriaVal.toString().trim() : "Outros";

          const qtdVal = idxQtd !== -1 ? row[cabecalhosOriginais[idxQtd]] : null;
          const quantidade = qtdVal ? parseInt(qtdVal.toString().replace(/\D/g, '')) || 0 : 0;

          const brutoVal = idxBruto !== -1 ? row[cabecalhosOriginais[idxBruto]] : null;
          let custoBruto = brutoVal ? this.limparNumeroExcel(brutoVal) : 0;

          const banhoVal = idxBanho !== -1 ? row[cabecalhosOriginais[idxBanho]] : null;
          const custoBanho = banhoVal ? this.limparNumeroExcel(banhoVal) : 0;

          const liquidoVal = idxLiquido !== -1 ? row[cabecalhosOriginais[idxLiquido]] : null;
          const custoLiquido = liquidoVal ? this.limparNumeroExcel(liquidoVal) : 0;

          const precoVendaVal = idxPrecoVenda !== -1 ? row[cabecalhosOriginais[idxPrecoVenda]] : null;
          const precoVendaTabela = precoVendaVal ? this.limparNumeroExcel(precoVendaVal) : 0;

          const markupVal = idxMarkup !== -1 ? row[cabecalhosOriginais[idxMarkup]] : null;
          let markup = markupVal ? this.limparNumeroExcel(markupVal) : 0;

          // Ajustes inteligentes de fallbacks se o arquivo for incompleto ou em formato livre
          if (!nome) {
            nome = "Semijoia " + (codigo || "Importada");
          }

          const custoTotal = custoBruto + custoBanho + custoLiquido;

          if (custoTotal === 0 && precoVendaTabela > 0) {
            // Se o usuário colocou apenas o preço de venda, deduzimos os custos com base no markup de 3x
            custoBruto = precoVendaTabela / 3.0;
            markup = 3.0;
          } else if (precoVendaTabela > 0 && markup <= 1) {
            if (custoTotal > 0) {
              markup = precoVendaTabela / custoTotal;
            } else {
              markup = 3.0;
            }
          }
          if (markup <= 0) markup = 3.0;

          const precoVendaCalculado = (custoBruto + custoBanho + custoLiquido) * markup;

          produtoObjeto.codigo = codigo;
          produtoObjeto.nome = nome;
          produtoObjeto.categoria = categoria;
          produtoObjeto.quantidade = quantidade;
          produtoObjeto.custoBruto = custoBruto;
          produtoObjeto.custoBanho = custoBanho;
          produtoObjeto.custoLiquido = custoLiquido;
          produtoObjeto.markup = markup;

          // IMPORTANTE: Alimenta com os cabeçalhos padrão da interface do sistema, adaptando os valores da planilha do usuário
          produtoObjeto._valoresDinamicos = {
            "Código": codigo,
            "Nome do Produto": nome,
            "Categoria": categoria,
            "Estoque Central": quantidade,
            "Custo Bruto": custoBruto,
            "Custo Banho": custoBanho,
            "Custo Oper.": custoLiquido,
            "Markup": markup,
            "Preço Venda": precoVendaCalculado
          };

          if (nome) {
            produtosImportados.push(produtoObjeto);

            const revNomeVal = idxRevNome !== -1 ? row[cabecalhosOriginais[idxRevNome]] : null;
            if (revNomeVal && revNomeVal.toString().trim()) {
              const revNome = revNomeVal.toString().trim();
              const revWhatsVal = idxRevWhats !== -1 ? row[cabecalhosOriginais[idxRevWhats]] : null;
              const revWhats = revWhatsVal ? revWhatsVal.toString().trim() : "(00) 99999-9999";

              let revComissao = 30;
              const revComissaoVal = idxRevComissao !== -1 ? row[cabecalhosOriginais[idxRevComissao]] : null;
              if (revComissaoVal) {
                revComissao = parseInt(revComissaoVal.toString().replace("%", "")) || 30;
              }

              const revQtdVal = idxRevQtdConsig !== -1 ? row[cabecalhosOriginais[idxRevQtdConsig]] : null;
              const qtdConsignada = revQtdVal ? parseInt(revQtdVal.toString().replace(/\D/g, '')) || 0 : 0;

              if (qtdConsignada > 0) {
                if (!revendedorasMapeadas[revNome]) {
                  revendedorasMapeadas[revNome] = {
                    id: 'rev_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                    nome: revNome,
                    whatsapp: revWhats,
                    comissao: revComissao,
                    consignado: []
                  };
                }

                revendedorasMapeadas[revNome].consignado.push({
                  produtoId: produtoId,
                  codigo: codigo,
                  nome: nome,
                  quantidadeConsignada: qtdConsignada,
                  precoVenda: precoVendaCalculado > 0 ? precoVendaCalculado : (precoVendaTabela > 0 ? precoVendaTabela : 50.00)
                });
              }
            }
          }
        });

        // Retorna sempre o layout de colunas padrão da aplicação para manter o design premium intacto
        callbackFuncao({
          colunas: ["Código", "Nome do Produto", "Categoria", "Estoque Central", "Custo Bruto", "Custo Banho", "Custo Oper.", "Markup", "Preço Venda"],
          produtos: produtosImportados,
          revendedoras: Object.values(revendedorasMapeadas)
        });
      },
      error: (err) => {
        alert("Erro ao analisar o arquivo CSV/Excel: " + err.message);
      }
    });
  },

  /**
   * Converte número JS em string formatada brasileira de Excel (ex: 25.5 -> 25,50)
   */
  formatarNumeroExcel: function(numero) {
    if (numero === undefined || numero === null || isNaN(numero)) return "0,00";
    return Number(numero).toFixed(2).replace(".", ",");
  },

  /**
   * Converte string do Excel em número float JS de forma ultra robusta.
   */
  limparNumeroExcel: function(valorTexto) {
    if (valorTexto === undefined || valorTexto === null) return 0;
    let texto = valorTexto.toString().trim().replace("R$", "").replace(/\s/g, "");
    if (!texto) return 0;
    
    // Se contém vírgula e ponto (ex: 1.250,50 ou 1,250.50)
    if (texto.includes(",") && texto.includes(".")) {
      // Se a vírgula vem depois do ponto (formato BR: 1.250,50)
      if (texto.indexOf(".") < texto.indexOf(",")) {
        texto = texto.replace(/\./g, "").replace(",", ".");
      } else { // Formato US: 1,250.50
        texto = texto.replace(/,/g, "");
      }
    } else if (texto.includes(",")) {
      // Apenas vírgula (ex: 25,50) -> substitui por ponto
      texto = texto.replace(",", ".");
    }
    
    let num = parseFloat(texto);
    return isNaN(num) ? 0 : num;
  }
};
