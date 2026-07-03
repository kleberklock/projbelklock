// Usando a API fetch global nativa do Node.js 18+
const API_URL = 'http://localhost:5000/api';

async function test() {
  console.log("=== INICIANDO TESTE DE INTEGRAÇÃO DA API ===");
  try {
    // 1. Fazer Login
    console.log("Tentando realizar login...");
    const loginRes = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@belklock.com', senha: 'belklock' })
    });
    
    if (!loginRes.ok) {
      const err = await loginRes.json();
      throw new Error(`Falha no login: ${err.error}`);
    }
    
    const loginData = await loginRes.json();
    const token = loginData.token;
    console.log("✅ Login efetuado com sucesso! Token obtido.");

    const headers = {
      'Authorization': `Bearer ${token}`,
      'x-loja-id': 'default-loja'
    };

    // 2. Testar Endpoint de Revendedoras (usado na aba Notas Fiscais)
    console.log("\nRequisitando revendedoras...");
    const revRes = await fetch(`${API_URL}/revendedoras`, { headers });
    if (!revRes.ok) throw new Error(`Falha ao carregar revendedoras: ${revRes.status}`);
    const revendedoras = await revRes.json();
    console.log(`✅ Revendedoras carregadas! Total: ${revendedoras.length}`);
    if (revendedoras.length > 0) {
      console.log(`   Exemplo: ${revendedoras[0].nome} (Historico acertos: ${revendedoras[0].historico?.length || 0})`);
    }

    // 3. Testar Endpoint da Fila do WhatsApp
    console.log("\nRequisitando fila de WhatsApp...");
    const waRes = await fetch(`${API_URL}/whatsapp/fila`, { headers });
    if (!waRes.ok) throw new Error(`Falha ao carregar fila do WhatsApp: ${waRes.status}`);
    const fila = await waRes.json();
    console.log(`✅ Fila do WhatsApp carregada! Total: ${fila.length}`);
    if (fila.length > 0) {
      console.log(`   Exemplo de mensagem: "${fila[0].mensagem}" para ${fila[0].numero}`);
    }

    // 4. Testar Endpoint de Treinamentos
    console.log("\nRequisitando treinamentos...");
    const treinRes = await fetch(`${API_URL}/treinamentos`, { headers });
    if (!treinRes.ok) throw new Error(`Falha ao carregar treinamentos: ${treinRes.status}`);
    const treinamentos = await treinRes.json();
    console.log(`✅ Treinamentos carregados! Total: ${treinamentos.length}`);
    if (treinamentos.length > 0) {
      console.log(`   Exemplo de treinamento: "${treinamentos[0].titulo}" (${treinamentos[0].tipo})`);
    }

    console.log("\n🎉 TODOS OS ENDPOINTS RESPONDERAM COM SUCESSO!");
  } catch (error) {
    console.error("❌ ERRO NO TESTE DE INTEGRAÇÃO:", error.message);
  }
}

test();
