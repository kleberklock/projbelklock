/**
 * Conecta Joias - Serviço de Integração ASAAS (Com fallback de simulação)
 */
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.resolve(__dirname, '.env') });

const ASAAS_API_KEY = process.env.ASAAS_API_KEY;
const ASAAS_API_URL = process.env.ASAAS_API_URL || 'https://sandbox.asaas.com/api/v3';

// Verifica se está rodando em modo simulação/local
const eModoSimulado = !ASAAS_API_KEY || 
                      ASAAS_API_KEY.includes('insira_sua_api_key') || 
                      ASAAS_API_KEY === 'CHAVE_AQUI' || 
                      ASAAS_API_KEY === '';

if (eModoSimulado) {
  console.log('💡 Conecta Joias: API Key do ASAAS não configurada. Ativando MODO SIMULADO para testes locais.');
}

// Helper para fazer requisições HTTP para o ASAAS
async function asaasRequest(endpoint, method = 'GET', body = null) {
  const url = `${ASAAS_API_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    'access_token': ASAAS_API_KEY
  };

  const config = {
    method,
    headers
  };

  if (body) {
    config.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(url, config);
    const data = await response.json();

    if (!response.ok) {
      const errorMsg = data.errors && data.errors[0] ? data.errors[0].description : 'Erro desconhecido na API do ASAAS';
      throw new Error(errorMsg);
    }

    return data;
  } catch (error) {
    console.error(`Erro na requisição ASAAS [${method}] ${endpoint}:`, error.message);
    throw error;
  }
}

/**
 * Cria ou busca um cliente no ASAAS com base no CPF/CNPJ
 */
async function obterOuCriarCliente(dados) {
  if (eModoSimulado) {
    return 'cus_mock_simulado_12345';
  }

  const { nome, cpfCnpj, email, whatsapp } = dados;
  const documentoLimpo = cpfCnpj ? cpfCnpj.replace(/\D/g, '') : '';
  const telefoneLimpo = whatsapp ? whatsapp.replace(/\D/g, '') : '';

  if (documentoLimpo) {
    try {
      const busca = await asaasRequest(`/customers?cpfCnpj=${documentoLimpo}`);
      if (busca.data && busca.data.length > 0) {
        return busca.data[0].id;
      }
    } catch (e) {
      console.warn('Erro ao buscar cliente por CPF/CNPJ no ASAAS, tentando criar...', e.message);
    }
  }

  const payload = {
    name: nome || 'Cliente Conecta Joias',
    cpfCnpj: documentoLimpo || undefined,
    email: email || undefined,
    mobilePhone: telefoneLimpo || undefined,
    notificationDisabled: false
  };

  const response = await asaasRequest('/customers', 'POST', payload);
  return response.id;
}

/**
 * Cria uma cobrança no ASAAS (PIX, BOLETO ou CARTÃO)
 */
async function criarCobranca(dados) {
  const {
    clienteNome,
    clienteCpfCnpj,
    clienteEmail,
    clienteWhatsapp,
    valor,
    formaEnvio, // "PIX" | "BOLETO" | "CARTAO"
    vendaId,
    linkId,
    cartaoDados, // Opcional, para pagamento direto com cartão
    enderecoDados // Opcional, para faturamento de cartão/boleto
  } = dados;

  if (eModoSimulado) {
    // Retorna resposta mockada com a mesma estrutura do ASAAS
    console.log(`[Simulação ASAAS] Cobrança de R$ ${valor} criada via ${formaEnvio}`);
    const payId = 'pay_mock_' + Math.random().toString(36).substring(2, 10);
    return {
      id: payId,
      status: formaEnvio === 'CARTAO' ? 'CONFIRMED' : 'PENDENTE',
      value: parseFloat(valor),
      billingType: formaEnvio === 'CARTAO' ? 'CREDIT_CARD' : (formaEnvio === 'BOLETO' ? 'BOLETO' : 'PIX'),
      bankSlipUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', // PDF simulado
      invoiceUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf'
    };
  }

  // 1. Obter ou Criar o Cliente no ASAAS
  const customerId = await obterOuCriarCliente({
    nome: clienteNome,
    cpfCnpj: clienteCpfCnpj,
    email: clienteEmail,
    whatsapp: clienteWhatsapp
  });

  let billingType = 'PIX';
  if (formaEnvio === 'BOLETO') billingType = 'BOLETO';
  if (formaEnvio === 'CARTAO') billingType = 'CREDIT_CARD';

  const dataVencimento = new Date();
  dataVencimento.setDate(dataVencimento.getDate() + 3);
  const dueDateStr = dataVencimento.toISOString().split('T')[0];

  const payload = {
    customer: customerId,
    billingType,
    value: parseFloat(valor),
    dueDate: dueDateStr,
    description: `Pagamento Conecta Joias - Ref Venda: ${vendaId || 'Sem Ref'}`,
    externalReference: linkId,
  };

  if (billingType === 'CREDIT_CARD' && cartaoDados) {
    payload.creditCard = {
      holderName: cartaoDados.holderName,
      number: cartaoDados.number.replace(/\s/g, ''),
      expiryMonth: cartaoDados.expiryMonth,
      expiryYear: cartaoDados.expiryYear,
      ccv: cartaoDados.cvv
    };

    const docLimpo = clienteCpfCnpj ? clienteCpfCnpj.replace(/\D/g, '') : '';
    const telLimpo = clienteWhatsapp ? clienteWhatsapp.replace(/\D/g, '') : '';

    payload.creditCardHolderInfo = {
      name: cartaoDados.holderName || clienteNome,
      email: clienteEmail || 'financeiro@conectajoias.com',
      cpfCnpj: docLimpo,
      postalCode: enderecoDados ? enderecoDados.cep.replace(/\D/g, '') : '01001000',
      addressNumber: enderecoDados ? enderecoDados.numero : 'S/N',
      addressComplement: enderecoDados ? enderecoDados.complemento : undefined,
      phone: telLimpo || '11999999999',
    };
  }

  const cobranca = await asaasRequest('/payments', 'POST', payload);
  return cobranca;
}

/**
 * Busca QR Code e chave Copia e Cola de um pagamento PIX
 */
async function obterQrCodePix(paymentId) {
  if (eModoSimulado) {
    // Retorna QR code de demonstração apontando para o link de simulação
    const mockData = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent('conectajoias-pix-simulado-id-' + paymentId)}`;
    
    // Para simplificar, buscamos a imagem do qrserver e convertemos ou apenas usamos um link de imagem do QR server
    // Vamos retornar uma imagem estática ou o próprio link como base64 ou imagem direta
    // Para o frontend, se enviarmos o link do qrserver como encodedImage, ele exibirá perfeitamente!
    return {
      encodedImage: mockData, // O frontend aceita imagens completas ou base64
      payload: '00020101021226850014br.gov.bcb.pix2563pix.conectajoias.com.br/qr/v2/mock-pay-pix-' + paymentId
    };
  }

  return await asaasRequest(`/payments/${paymentId}/pixQrCode`);
}

/**
 * Busca linha digitável e código de barras de um boleto
 */
async function obterCodigoBarrasBoleto(paymentId) {
  if (eModoSimulado) {
    return {
      identificationField: '34191.79001 01043.513184 91020.150008 7 96250000015000',
      barCode: '3419796250000015000'
    };
  }

  return await asaasRequest(`/payments/${paymentId}/identificationField`);
}

module.exports = {
  criarCobranca,
  obterQrCodePix,
  obterCodigoBarrasBoleto
};
