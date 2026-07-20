// server/services/ComissaoService.js

class ComissaoService {
  /**
   * Calcula a comissão final paga à revendedora
   * @param {Object} revendedora - Instância do usuário revendedora
   * @param {number} faturamentoBruto - Faturamento bruto das vendas do acerto
   * @param {number} faturamentoVolumeAcumulado - Faturamento do mês (para progressiva/metas)
   * @param {number} valorDescontoPerda - Total descontado por perdas de peças
   * @returns {Object} { percentualComissao, comissaoBruta, comissaoPaga, liquidoConectaJoias }
   */
  calcularComissao(revendedora, faturamentoBruto, faturamentoVolumeAcumulado, valorDescontoPerda) {
    const valorBaseComissao = (revendedora.baseCalculo === 'LIQUIDO')
      ? Math.max(0, faturamentoBruto - valorDescontoPerda)
      : faturamentoBruto;

    let percentualComissao = revendedora.comissao;
    let comissaoBruta = 0;

    if (revendedora.tipoComissao === 'PROGRESSIVA') {
      const faixas = (revendedora.faixasComissao && revendedora.faixasComissao.length > 0)
        ? revendedora.faixasComissao
        : (revendedora.loja && revendedora.loja.faixasComissao ? revendedora.loja.faixasComissao : []);
      
      const faixa = this.encontrarFaixaComissao(faturamentoVolumeAcumulado, faixas);
      percentualComissao = faixa ? faixa.percentual : revendedora.comissao;
      comissaoBruta = valorBaseComissao * (percentualComissao / 100);

    } else if (revendedora.tipoComissao === 'META_UNICA') {
      const atingiuMeta = faturamentoVolumeAcumulado >= (revendedora.metaUnicaValor || 0);
      if (atingiuMeta) {
        if (revendedora.metaUnicaTipoBonus === 'PERCENTUAL') {
          percentualComissao = revendedora.comissao + (revendedora.metaUnicaBonus || 0);
          comissaoBruta = valorBaseComissao * (percentualComissao / 100);
        } else { // Bônus Fixo em Dinheiro
          percentualComissao = revendedora.comissao;
          comissaoBruta = (valorBaseComissao * (percentualComissao / 100)) + (revendedora.metaUnicaBonus || 0);
        }
      } else {
        percentualComissao = revendedora.comissao;
        comissaoBruta = valorBaseComissao * (percentualComissao / 100);
      }
    } else { // FIXA
      percentualComissao = revendedora.comissao;
      comissaoBruta = valorBaseComissao * (percentualComissao / 100);
    }

    const comissaoPaga = (revendedora.baseCalculo === 'LIQUIDO')
      ? Math.max(0, comissaoBruta)
      : Math.max(0, comissaoBruta - valorDescontoPerda);
    const liquidoConectaJoias = faturamentoBruto - comissaoPaga;

    return {
      percentualComissao,
      comissaoBruta,
      comissaoPaga,
      liquidoConectaJoias
    };
  }

  encontrarFaixaComissao(faturamentoBruto, faixas) {
    if (!faixas || faixas.length === 0) return null;
    // Ordena faixas por valor mínimo para garantir a verificação correta
    const faixasOrdenadas = [...faixas].sort((a, b) => a.valorMin - b.valorMin);
    
    let faixaSelecionada = null;
    for (const f of faixasOrdenadas) {
      if (faturamentoBruto >= f.valorMin) {
        faixaSelecionada = f;
      }
    }
    return faixaSelecionada;
  }
}

module.exports = new ComissaoService();
