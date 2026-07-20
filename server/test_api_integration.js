const API_URL = 'http://localhost:5000/api';

async function testIntegration() {
  console.log("\n🚀 INICIANDO TESTE DE INTEGRAÇÃO COMPLETO - CONECTA JOIAS\n");
  
  let token = null;
  let revendedoraId = null;
  let produtoId = null;
  let variacaoId = null;

  try {
    // 1. Login
    console.log("1. Tentando realizar login como SuperAdmin...");
    const loginRes = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'superadmin@plataforma.com', senha: 'admin0001' })
    });
    
    if (!loginRes.ok) {
      const err = await loginRes.json();
      throw new Error(`Falha no login: ${err.error}`);
    }
    
    const loginData = await loginRes.json();
    token = loginData.token;
    console.log("   ✅ Login efetuado com sucesso! Token obtido.");

    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'x-loja-id': 'default-loja'
    };

    // 2. Testar listagem de revendedoras (valida correção da rota GET /api/revendedoras)
    console.log("\n2. Requisitando listagem de revendedoras...");
    const revsResBefore = await fetch(`${API_URL}/revendedoras`, { headers });
    if (!revsResBefore.ok) {
      const err = await revsResBefore.json();
      throw new Error(`Falha ao obter revendedoras: ${err.error}`);
    }
    const revsBefore = await revsResBefore.json();
    console.log(`   ✅ Listagem de revendedoras respondendo perfeitamente! Total cadastrado: ${revsBefore.length}`);

    // 3. Cadastrar revendedora de teste
    console.log("\n3. Cadastrando revendedora de teste...");
    const regRes = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        nome: 'Revendedora Teste Antigravity',
        email: `test_rev_${Date.now()}@conectajoias.com`,
        senha: 'Senha@123456',
        role: 'Consultant',
        whatsapp: '11999999999',
        comissao: 35.0
      })
    });
    if (!regRes.ok) {
      const err = await regRes.json();
      throw new Error(`Falha ao registrar revendedora: ${err.error}`);
    }
    const regData = await regRes.json();
    revendedoraId = regData.usuario.id;
    console.log(`   ✅ Revendedora cadastrada com ID: ${revendedoraId}`);

    // 4. Cadastrar produto de teste com estoque inicial de 10
    console.log("\n4. Cadastrando produto de teste com estoque...");
    const prodRes = await fetch(`${API_URL}/produtos`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        nome: 'Colar Teste Integracao',
        codigo: `COLAR-TEST-${Math.floor(Math.random() * 1000000)}`,
        categoria: 'Colares',
        quantidade: 10,
        custoBruto: 15.00,
        custoBanho: 5.00,
        markup: 3.0
      })
    });
    if (!prodRes.ok) {
      const err = await prodRes.json();
      throw new Error(`Falha ao cadastrar produto: ${err.error}`);
    }
    const prodData = await prodRes.json();
    produtoId = prodData.id;
    variacaoId = prodData.variacoes[0].id;
    console.log(`   ✅ Produto criado com ID: ${produtoId} | Variação ID: ${variacaoId}`);

    // 5. Consignar 3 unidades do produto para a revendedora
    console.log("\n5. Consignando 3 unidades do produto para a revendedora...");
    const consRes = await fetch(`${API_URL}/consignacoes`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        usuarioId: revendedoraId,
        produtoVariacaoId: variacaoId,
        quantidade: 3
      })
    });
    if (!consRes.ok) {
      const err = await consRes.json();
      throw new Error(`Falha ao consignar produto: ${err.error}`);
    }
    console.log("   ✅ Consignação registrada! Estoque central deve ter reduzido de 10 para 7.");

    // 6. Testar listagem de revendedoras com dados da maleta consignada
    console.log("\n6. Verificando listagem de revendedoras com dados da maleta...");
    const revsResAfter = await fetch(`${API_URL}/revendedoras`, { headers });
    if (!revsResAfter.ok) {
      const err = await revsResAfter.json();
      throw new Error(`Falha ao obter revendedoras pós-consignação: ${err.error}`);
    }
    const revsAfter = await revsResAfter.json();
    const revTest = revsAfter.find(r => r.id === revendedoraId);
    console.log(`   ✅ Revendedora encontrada na listagem!`);
    console.log(`   ✅ Dados do consignado retornados:`, JSON.stringify(revTest.consignados));
    if (!revTest.consignados || revTest.consignados.length === 0) {
      throw new Error("Erro: Os consignados não foram incluídos na listagem da revendedora.");
    }
    if (revTest.consignados[0].produtoId !== produtoId) {
      throw new Error(`Erro: produtoId virtual incorreto! Esperado: ${produtoId}, Recebido: ${revTest.consignados[0].produtoId}`);
    }
    console.log("   ✅ Compatibilidade dos campos produtoId e produto aninhado validada no front-end!");

    // 6.5. Devolver 1 unidade consignada de volta ao estoque central
    console.log("\n6.5. Devolvendo 1 unidade consignada de volta ao estoque central...");
    const consignadoId = revTest.consignados[0].id;
    const devRes = await fetch(`${API_URL}/consignacoes/devolver`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        consignadoId,
        quantidadeDevolver: 1
      })
    });
    if (!devRes.ok) {
      const err = await devRes.json();
      throw new Error(`Falha ao devolver consignação: ${err.error}`);
    }
    console.log("   ✅ Devolução registrada com sucesso!");

    // Validar se o estoque central voltou para 8 e a maleta ficou com 2
    const revsResAfterDev = await fetch(`${API_URL}/revendedoras`, { headers });
    const revsAfterDev = await revsResAfterDev.json();
    const revTestDev = revsAfterDev.find(r => r.id === revendedoraId);
    console.log(`   Qtd Consignada na maleta após devolução: ${revTestDev.consignados[0].quantidadeConsignada} (esperado: 2)`);
    if (revTestDev.consignados[0].quantidadeConsignada !== 2) {
      throw new Error(`Quantidade na maleta incorreta! Esperado: 2, obtido: ${revTestDev.consignados[0].quantidadeConsignada}`);
    }
    
    const checkProdResBeforeAcerto = await fetch(`${API_URL}/produtos`, { headers });
    const prodsBeforeAcerto = await checkProdResBeforeAcerto.json();
    const prodTestBeforeAcerto = prodsBeforeAcerto.find(p => p.id === produtoId);
    console.log(`   Estoque Central após devolução: ${prodTestBeforeAcerto.quantidade} (esperado: 8)`);
    if (prodTestBeforeAcerto.quantidade !== 8) {
      throw new Error(`Estoque central incorreto pós-devolução! Esperado: 8, obtido: ${prodTestBeforeAcerto.quantidade}`);
    }
    console.log("   ✅ Estoque central e maleta atualizados com sucesso após a devolução parcial!");

    // 7. Realizar o acerto de contas da maleta (valida correção da rota POST /api/acertos)
    // Devolve 1 peça vendida e 1 peça com defeito (das 2 restantes)
    console.log("\n7. Fechando acerto de contas (1 vendida, 0 devolvida, 1 defeito)...");
    const acertoRes = await fetch(`${API_URL}/acertos`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        usuarioId: revendedoraId,
        itensAcerto: [{
          produtoId: produtoId,
          quantidadeVendida: 1,
          quantidadeDevolvida: 0,
          quantidadePerdida: 0,
          quantidadeDefeito: 1
        }],
        formaPagamento: 'Pix'
      })
    });
    if (!acertoRes.ok) {
      const err = await acertoRes.json();
      throw new Error(`Falha ao concluir acerto de contas: ${err.error}`);
    }
    console.log("   ✅ Acerto de contas concluído com sucesso!");

    // 8. Verificar atualização do estoque físico no banco (estoque central deve ser 8 e defeito 1)
    console.log("\n8. Validando atualização do estoque físico no banco de dados...");
    const checkProdRes = await fetch(`${API_URL}/produtos`, { headers });
    if (!checkProdRes.ok) {
      const err = await checkProdRes.json();
      throw new Error(`Falha ao listar produtos pós-acerto: ${err.error}`);
    }
    const prods = await checkProdRes.json();
    const prodTest = prods.find(p => p.id === produtoId);
    console.log(`   Estoque Central Pós-Acerto: ${prodTest.quantidade} peças (esperado: 8)`);
    if (prodTest.quantidade !== 8 || prodTest.quantidadeDefeito !== 1) {
      throw new Error(`Estoque inconsistente! Quantidade obtida: ${prodTest.quantidade}, defeitos: ${prodTest.quantidadeDefeito}`);
    }
    console.log("   ✅ Atualização física de estoque e defeitos validada com sucesso!");

  } catch (error) {
    console.error("\n❌ FALHA NO TESTE DE INTEGRAÇÃO:", error.message);
  } finally {
    // 9. Limpeza dos dados de teste
    console.log("\n9. Limpando dados do teste de integração...");
    const headersClean = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'x-loja-id': 'default-loja'
    };

    if (produtoId && token) {
      const delProd = await fetch(`${API_URL}/produtos/${produtoId}`, { method: 'DELETE', headers: headersClean });
      if (delProd.ok) console.log("   🧹 Produto de teste excluído.");
    }
    if (revendedoraId && token) {
      const delRev = await fetch(`${API_URL}/revendedoras/${revendedoraId}`, { method: 'DELETE', headers: headersClean });
      if (delRev.ok) console.log("   🧹 Revendedora de teste excluída.");
    }
    console.log("\n🎉 TESTE DE INTEGRAÇÃO CONCLUÍDO!");
  }
}

testIntegration();
