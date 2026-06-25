const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const { PrismaClient } = require('@prisma/client');
const { BlobServiceClient } = require('@azure/storage-blob');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 5000;

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET === 'belklock_super_secret_key_2026') {
  console.error("ERRO CRÍTICO: A variável de ambiente JWT_SECRET não está definida ou é a chave padrão insegura!");
  process.exit(1);
}

// Configuração de CORS restrita ao frontend (inclui as portas de desenvolvimento local 5500 e 8080)
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5500';
app.use(cors({
  origin: [
    frontendUrl, 
    'http://localhost:5500', 
    'http://127.0.0.1:5500',
    'http://localhost:8080',
    'http://127.0.0.1:8080'
  ],
  credentials: true
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Configuração do Multer (Upload de Imagens em Memória)
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 } // limite de 5MB
});

// Configuração do Azure Blob Storage (se houver Connection String)
let containerClient = null;
if (process.env.AZURE_STORAGE_CONNECTION_STRING) {
  try {
    const blobServiceClient = BlobServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING);
    containerClient = blobServiceClient.getContainerClient(process.env.AZURE_STORAGE_CONTAINER_NAME || 'semijoias');
  } catch (error) {
    console.error("Erro ao conectar com o Azure Blob Storage:", error.message);
  }
}

// ==========================================
// MIDDLEWARES DE AUTENTICAÇÃO E PERMISSÕES
// ==========================================

const autenticarJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Acesso negado. Token de autenticação não fornecido.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Token inválido ou expirado.' });
  }
};

const autorizarRole = (rolesAutorizadas) => {
  return (req, res, next) => {
    if (!req.user || !rolesAutorizadas.includes(req.user.role)) {
      return res.status(403).json({ error: 'Acesso negado. Você não tem permissão para realizar esta ação.' });
    }
    next();
  };
};

// Gravação de Logs de Auditoria
async function registrarLog(req, acao, detalhes, usuarioInfo = null) {
  try {
    let usuarioId = usuarioInfo ? usuarioInfo.id : (req.user ? req.user.id : null);
    let usuarioNome = usuarioInfo ? usuarioInfo.nome : (req.user ? req.user.nome : null);
    
    await prisma.logAcao.create({
      data: {
        usuarioId,
        usuarioNome,
        acao,
        detalhes
      }
    });
  } catch (error) {
    console.error("Erro ao gravar log de auditoria:", error);
  }
}

// ==========================================
// ROTAS DE AUTENTICAÇÃO (LOGIN / REGISTRO)
// ==========================================

// Limiter para rota de login (máximo 10 tentativas a cada 15 minutos por IP)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Muitas tentativas de login. Tente novamente em 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Função para gerar uma senha aleatória de 8 caracteres
function gerarSenhaAleatoria(tamanho = 8) {
  const caracteres = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%&*';
  let senha = '';
  for (let i = 0; i < tamanho; i++) {
    senha += caracteres.charAt(Math.floor(Math.random() * caracteres.length));
  }
  return senha;
}

// Função para gerar um PIN de 4 dígitos único
async function gerarPinUnico() {
  let pin;
  let pinExiste = true;
  while (pinExiste) {
    pin = Math.floor(1000 + Math.random() * 9000).toString(); // gera número de 4 dígitos (1000-9999)
    const usuario = await prisma.usuario.findUnique({ where: { pin } });
    if (!usuario) {
      pinExiste = false;
    }
  }
  return pin;
}

// Login Geral (E-mail ou PIN)
app.post('/api/auth/login', loginLimiter, async (req, res) => {
  const { email, senha } = req.body; // 'email' aqui pode ser o E-mail (Admin) ou PIN (Revendedora)
  if (!email || !senha) {
    return res.status(400).json({ error: 'Preencha todos os campos.' });
  }

  try {
    let usuario;
    // Se o identificador for um número de exatamente 4 dígitos, busca por PIN
    if (/^\d{4}$/.test(email)) {
      usuario = await prisma.usuario.findUnique({ where: { pin: email } });
    } else {
      usuario = await prisma.usuario.findUnique({ where: { email } });
    }

    if (!usuario) {
      return res.status(400).json({ error: 'Identificador (E-mail ou PIN) ou senha incorretos.' });
    }

    const senhaValida = await bcrypt.compare(senha, usuario.senhaHash);
    if (!senhaValida) {
      return res.status(400).json({ error: 'Identificador (E-mail ou PIN) ou senha incorretos.' });
    }

    // Gera Token JWT
    const token = jwt.sign(
      { id: usuario.id, nome: usuario.nome, email: usuario.email, pin: usuario.pin, role: usuario.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Registra log de auditoria
    registrarLog(req, "LOGIN", `Usuário realizou login com sucesso usando ${usuario.pin ? 'PIN' : 'E-mail'}.`, usuario);

    res.json({
      token,
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        pin: usuario.pin,
        role: usuario.role,
        comissao: usuario.comissao
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Erro interno no servidor ao tentar logar.' });
  }
});

// Admin cria novos usuários (Revendedoras ou outros Admins)
app.post('/api/auth/register', autenticarJWT, autorizarRole(['admin']), async (req, res) => {
  const { nome, email, senha, role, whatsapp, comissao } = req.body;
  if (!nome || !email || !senha || !role) {
    return res.status(400).json({ error: 'Campos obrigatórios ausentes.' });
  }

  try {
    const emailExiste = await prisma.usuario.findUnique({ where: { email } });
    if (emailExiste) {
      return res.status(400).json({ error: 'Este e-mail já está cadastrado.' });
    }

    const senhaHash = await bcrypt.hash(senha, 10);
    
    let pin = null;
    if (role === 'revendedora') {
      pin = await gerarPinUnico();
    }

    const novoUsuario = await prisma.usuario.create({
      data: {
        nome,
        email,
        pin,
        senhaHash,
        role,
        whatsapp,
        comissao: parseFloat(comissao) || 30.0
      }
    });

    res.status(201).json({
      message: 'Usuário cadastrado com sucesso!',
      usuario: { 
        id: novoUsuario.id, 
        nome: novoUsuario.nome, 
        email: novoUsuario.email, 
        pin: novoUsuario.pin, 
        role: novoUsuario.role 
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao cadastrar usuário.' });
  }
});

// ==========================================
// ROTAS DE GESTÃO DE ESTOQUE (PRODUTOS)
// ==========================================

// Listar Produtos (com filtro de segurança para revendedoras)
app.get('/api/produtos', autenticarJWT, async (req, res) => {
  try {
    const produtos = await prisma.produto.findMany({
      orderBy: { nome: 'asc' }
    });

    // Se o usuário logado for revendedora, removemos os custos por segurança comercial
    if (req.user.role === 'revendedora') {
      const produtosPublicos = produtos.map(p => {
        const custoTotal = p.custoBruto + p.custoBanho + p.custoLiquido;
        const precoVenda = custoTotal * p.markup;
        return {
          id: p.id,
          codigo: p.codigo,
          nome: p.nome,
          categoria: p.categoria,
          quantidade: p.quantidade,
          precoVenda: precoVenda > 0 ? precoVenda : 50.0,
          fotoUrl: p.fotoUrl
        };
      });
      return res.json(produtosPublicos);
    }

    // Admins recebem o estoque completo com custos e markup
    res.json(produtos);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao listar produtos.' });
  }
});

// Listar Produtos com Defeito (Admin)
app.get('/api/produtos/defeitos', autenticarJWT, autorizarRole(['admin']), async (req, res) => {
  try {
    const produtosComDefeito = await prisma.produto.findMany({
      where: {
        quantidadeDefeito: {
          gt: 0
        }
      },
      orderBy: { nome: 'asc' }
    });
    res.json(produtosComDefeito);
  } catch (error) {
    console.error("Erro ao listar produtos com defeito:", error);
    res.status(500).json({ error: 'Erro ao listar produtos com defeito.' });
  }
});

// Criar Produto (Admin)
app.post('/api/produtos', autenticarJWT, autorizarRole(['admin']), async (req, res) => {
  const { codigo, nome, categoria, quantidade, custoBruto, custoBanho, custoLiquido, markup, fotoUrl, quantidadeDefeito } = req.body;
  if (!nome || !categoria) {
    return res.status(400).json({ error: 'Nome e categoria são obrigatórios.' });
  }

  const cod = codigo || 'REF-' + Math.floor(1000 + Math.random() * 9000);

  try {
    const novoProduto = await prisma.produto.create({
      data: {
        codigo: cod,
        nome,
        categoria,
        quantidade: parseInt(quantidade) || 0,
        custoBruto: parseFloat(custoBruto) || 0.0,
        custoBanho: parseFloat(custoBanho) || 0.0,
        custoLiquido: parseFloat(custoLiquido) || 0.0,
        markup: parseFloat(markup) || 3.0,
        fotoUrl,
        quantidadeDefeito: parseInt(quantidadeDefeito) || 0
      }
    });

    registrarLog(req, "PRODUTO_CRIAR", `Criou o produto ${novoProduto.nome} (${novoProduto.codigo}) com estoque inicial de ${novoProduto.quantidade}.`);

    res.status(201).json(novoProduto);
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Já existe um produto cadastrado com este Código/Referência.' });
    }
    res.status(500).json({ error: 'Erro ao criar produto.' });
  }
});

// Editar Produto (Admin)
app.put('/api/produtos/:id', autenticarJWT, autorizarRole(['admin']), async (req, res) => {
  const { id } = req.params;
  const { codigo, nome, categoria, quantidade, custoBruto, custoBanho, custoLiquido, markup, fotoUrl, quantidadeDefeito } = req.body;

  try {
    const produtoAtualizado = await prisma.produto.update({
      where: { id },
      data: {
        codigo,
        nome,
        categoria,
        quantidade: parseInt(quantidade) || 0,
        custoBruto: parseFloat(custoBruto) || 0.0,
        custoBanho: parseFloat(custoBanho) || 0.0,
        custoLiquido: parseFloat(custoLiquido) || 0.0,
        markup: parseFloat(markup) || 3.0,
        fotoUrl,
        quantidadeDefeito: parseInt(quantidadeDefeito) || 0
      }
    });

    registrarLog(req, "PRODUTO_EDITAR", `Atualizou dados do produto ${produtoAtualizado.nome} (${produtoAtualizado.codigo}). Estoque: ${produtoAtualizado.quantidade}, Defeitos: ${produtoAtualizado.quantidadeDefeito}.`);

    res.json(produtoAtualizado);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar produto.' });
  }
});

// Excluir Produto (Admin)
app.delete('/api/produtos/:id', autenticarJWT, autorizarRole(['admin']), async (req, res) => {
  const { id } = req.params;
  try {
    const prod = await prisma.produto.findUnique({ where: { id } });
    await prisma.produto.delete({ where: { id } });
    
    if (prod) {
      registrarLog(req, "PRODUTO_EXCLUIR", `Excluiu o produto ${prod.nome} (${prod.codigo}).`);
    } else {
      registrarLog(req, "PRODUTO_EXCLUIR", `Excluiu o produto com ID ${id}.`);
    }

    res.json({ message: 'Produto removido com sucesso!' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao excluir produto.' });
  }
});

// Excluir Todos os Produtos (Admin)
app.delete('/api/produtos', autenticarJWT, autorizarRole(['admin']), async (req, res) => {
  try {
    await prisma.$transaction([
      prisma.consignado.deleteMany(), // Limpa os consignados relacionados
      prisma.produto.deleteMany()
    ]);
    res.json({ message: 'Todo o estoque e os consignados associados foram excluídos com sucesso!' });
  } catch (error) {
    console.error("Erro ao limpar estoque:", error);
    res.status(500).json({ error: 'Erro ao tentar excluir todos os produtos do estoque.' });
  }
});

// ==========================================
// ROTAS DE GESTÃO DE REVENDEDORAS
// ==========================================

// Listar Revendedoras (Admin)
app.get('/api/revendedoras', autenticarJWT, autorizarRole(['admin']), async (req, res) => {
  try {
    const revendedoras = await prisma.usuario.findMany({
      where: { role: 'revendedora' },
      select: {
        id: true,
        nome: true,
        email: true,
        pin: true,
        whatsapp: true,
        comissao: true,
        createdAt: true,
        consignados: {
          include: {
            produto: true
          }
        },
        historico: true
      },
      orderBy: { nome: 'asc' }
    });
    res.json(revendedoras);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao listar revendedoras.' });
  }
});

// Editar Revendedora (Admin)
app.put('/api/revendedoras/:id', autenticarJWT, autorizarRole(['admin']), async (req, res) => {
  const { id } = req.params;
  const { nome, email, whatsapp, comissao } = req.body;

  try {
    const revendedoraAtualizada = await prisma.usuario.update({
      where: { id },
      data: {
        nome,
        email,
        whatsapp,
        comissao: parseFloat(comissao) || 30.0
      }
    });
    res.json(revendedoraAtualizada);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar dados da revendedora.' });
  }
});

// Regenerar PIN e Senha da Revendedora (Admin)
app.put('/api/revendedoras/:id/reset-pin', autenticarJWT, autorizarRole(['admin']), async (req, res) => {
  const { id } = req.params;

  try {
    const usuario = await prisma.usuario.findFirst({
      where: { id, role: 'revendedora' }
    });

    if (!usuario) {
      return res.status(404).json({ error: 'Revendedora não encontrada.' });
    }

    const novoPin = await gerarPinUnico();
    const novaSenha = gerarSenhaAleatoria(8);
    const senhaHash = await bcrypt.hash(novaSenha, 10);

    await prisma.usuario.update({
      where: { id },
      data: {
        pin: novoPin,
        senhaHash: senhaHash
      }
    });

    res.json({
      message: 'PIN e senha temporária regenerados com sucesso!',
      pin: novoPin,
      senha: novaSenha
    });
  } catch (error) {
    console.error("Erro ao regenerar PIN/senha:", error);
    res.status(500).json({ error: 'Erro ao tentar regenerar PIN e senha da revendedora.' });
  }
});

// Excluir uma Revendedora (Admin)
app.delete('/api/revendedoras/:id', autenticarJWT, autorizarRole(['admin']), async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.usuario.delete({
      where: {
        id,
        role: 'revendedora'
      }
    });
    res.json({ message: 'Revendedora excluída com sucesso!' });
  } catch (error) {
    console.error("Erro ao excluir revendedora:", error);
    res.status(500).json({ error: 'Erro ao excluir revendedora.' });
  }
});

// Excluir todas as Revendedoras (Admin)
app.delete('/api/revendedoras', autenticarJWT, autorizarRole(['admin']), async (req, res) => {
  try {
    await prisma.usuario.deleteMany({
      where: {
        role: 'revendedora'
      }
    });
    res.json({ message: 'Todas as revendedoras foram excluídas com sucesso!' });
  } catch (error) {
    console.error("Erro ao excluir todas as revendedoras:", error);
    res.status(500).json({ error: 'Erro ao excluir todas as revendedoras.' });
  }
});

// Obter Maleta Própria (Revendedora logada)
app.get('/api/revendedoras/minha-maleta', autenticarJWT, async (req, res) => {
  try {
    const consignados = await prisma.consignado.findMany({
      where: { usuarioId: req.user.id },
      include: {
        produto: {
          select: {
            codigo: true,
            nome: true,
            categoria: true,
            fotoUrl: true
          }
        }
      }
    });
    
    const maletaFormatada = consignados.map(c => ({
      produtoId: c.produtoId,
      codigo: c.produto.codigo,
      nome: c.produto.nome,
      categoria: c.produto.categoria,
      quantidadeConsignada: c.quantidadeConsignada,
      precoVenda: c.precoVenda,
      fotoUrl: c.produto.fotoUrl
    }));

    res.json(maletaFormatada);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao carregar dados da maleta.' });
  }
});

// ==========================================
// ROTAS DE CONSIGNAÇÕES E ACERTOS
// ==========================================

// Enviar Peças para a Maleta (Consignar - Admin)
app.post('/api/consignacoes', autenticarJWT, autorizarRole(['admin']), async (req, res) => {
  const { usuarioId, produtoId, quantidade } = req.body;
  if (!usuarioId || !produtoId || !quantidade || quantidade <= 0) {
    return res.status(400).json({ error: 'Dados incompletos para consignação.' });
  }

  try {
    const produto = await prisma.produto.findUnique({ where: { id: produtoId } });
    if (!produto || produto.quantidade < quantidade) {
      return res.status(400).json({ error: 'Estoque central insuficiente para esta semijoia.' });
    }

    // Calcula preço de venda atualizado com base nos custos e markup
    const custoTotal = produto.custoBruto + produto.custoBanho + produto.custoLiquido;
    const precoVendaCalculado = custoTotal * produto.markup;

    // Deduz do estoque central
    await prisma.produto.update({
      where: { id: produtoId },
      data: { quantidade: produto.quantidade - quantidade }
    });

    // Cria ou atualiza o registro de consignação
    const consignadoExistente = await prisma.consignado.findUnique({
      where: {
        usuarioId_produtoId: { usuarioId, produtoId }
      }
    });

    let consignacao;
    if (consignadoExistente) {
      consignacao = await prisma.consignado.update({
        where: { id: consignadoExistente.id },
        data: {
          quantidadeConsignada: consignadoExistente.quantidadeConsignada + quantidade,
          precoVenda: precoVendaCalculado
        }
      });
    } else {
      consignacao = await prisma.consignado.create({
        data: {
          usuarioId,
          produtoId,
          quantidadeConsignada: quantidade,
          precoVenda: precoVendaCalculado
        }
      });
    }

    const revendedora = await prisma.usuario.findUnique({ where: { id: usuarioId } });
    const nomeRevendedora = revendedora ? revendedora.nome : `Revendedora ID ${usuarioId}`;
    registrarLog(req, "CONSIGNACAO_CRIAR", `Consignou ${quantidade} unidades do produto ${produto.nome} (${produto.codigo}) para a revendedora ${nomeRevendedora}.`);

    res.json(consignacao);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao registrar consignação.' });
  }
});

// Finalizar Acerto de Contas (Admin)
app.post('/api/acertos', autenticarJWT, autorizarRole(['admin']), async (req, res) => {
  // itensAcerto: [{ produtoId, quantidadeVendida, quantidadeDevolvida, quantidadePerdida, quantidadeDefeito }]
  const { usuarioId, itensAcerto, formaPagamento } = req.body;
  
  if (!usuarioId || !itensAcerto || itensAcerto.length === 0) {
    return res.status(400).json({ error: 'Falta dados para o fechamento.' });
  }

  try {
    const revendedora = await prisma.usuario.findUnique({ where: { id: usuarioId } });
    if (!revendedora) return res.status(404).json({ error: 'Revendedora não encontrada.' });

    let faturamentoBruto = 0;
    let totalConsignada = 0;
    let totalVendida = 0;
    let totalDevolvida = 0;
    let totalPerdida = 0;
    let totalDefeito = 0;
    let valorDescontoPerda = 0;

    for (const item of itensAcerto) {
      const consignado = await prisma.consignado.findUnique({
        where: {
          usuarioId_produtoId: { usuarioId, produtoId: item.produtoId }
        }
      });

      if (consignado) {
        const qtdPerdida = parseInt(item.quantidadePerdida) || 0;
        const qtdDefeito = parseInt(item.quantidadeDefeito) || 0;

        totalConsignada += consignado.quantidadeConsignada;
        totalVendida += parseInt(item.quantidadeVendida) || 0;
        totalDevolvida += parseInt(item.quantidadeDevolvida) || 0;
        totalPerdida += qtdPerdida;
        totalDefeito += qtdDefeito;
        faturamentoBruto += consignado.precoVenda * (parseInt(item.quantidadeVendida) || 0);

        // Valor das perdas: responsabilidade financeira da revendedora
        valorDescontoPerda += consignado.precoVenda * qtdPerdida;

        // 1. As devoluções normais retornam ao Estoque Central
        if (parseInt(item.quantidadeDevolvida) > 0) {
          await prisma.produto.update({
            where: { id: item.produtoId },
            data: { quantidade: { increment: parseInt(item.quantidadeDevolvida) } }
          });
        }

        // 2. Defeitos: incrementam o contador de defeito no produto (não voltam ao estoque normal)
        if (qtdDefeito > 0) {
          await prisma.produto.update({
            where: { id: item.produtoId },
            data: { quantidadeDefeito: { increment: qtdDefeito } }
          });
        }

        // 3. Remove o item consignado (limpa a maleta)
        await prisma.consignado.delete({ where: { id: consignado.id } });
      }
    }

    // A comissão é calculada sobre o faturamento bruto das vendas
    // O valor das perdas é descontado da comissão (a revendedora cobre o prejuízo)
    const comissaoBruta = faturamentoBruto * (revendedora.comissao / 100);
    const comissaoPaga = Math.max(0, comissaoBruta - valorDescontoPerda);
    const liquidoBelklock = faturamentoBruto - comissaoBruta + valorDescontoPerda;

    // Salva o histórico de acerto
    const acerto = await prisma.historicoAcerto.create({
      data: {
        usuarioId,
        totalConsignada,
        totalVendida,
        totalDevolvida,
        totalPerdida,
        totalDefeito,
        faturamentoBruto,
        valorDescontoPerda,
        comissaoPaga,
        liquidoBelklock,
        formaPagamento: formaPagamento || "Pix"
      }
    });

    registrarLog(req, "ACERTO_CONCLUIR", `Concluiu acerto de contas com a revendedora ${revendedora.nome}. Pagamento: ${formaPagamento || "Pix"}. Vendido: ${totalVendida}, Devolvido: ${totalDevolvida}, Perda: ${totalPerdida}, Defeito: ${totalDefeito}. Faturamento Bruto: R$ ${faturamentoBruto.toFixed(2)}, Líquido Belklock: R$ ${liquidoBelklock.toFixed(2)}.`);

    res.json({
      message: 'Acerto concluído com sucesso!',
      acerto
    });
  } catch (error) {
    console.error('Erro no acerto:', error);
    res.status(500).json({ error: 'Erro ao processar acerto no banco de dados.' });
  }
});

// Listar Histórico de Acertos
app.get('/api/acertos/historico', autenticarJWT, async (req, res) => {
  try {
    let queryOptions = {
      orderBy: { data: 'desc' }
    };

    // Revendedoras só veem o seu próprio histórico. Admins veem tudo.
    if (req.user.role === 'revendedora') {
      queryOptions.where = { usuarioId: req.user.id };
    } else {
      queryOptions.include = {
        usuario: { select: { nome: true } }
      };
    }

    const historico = await prisma.historicoAcerto.findMany(queryOptions);
    res.json(historico);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao carregar histórico.' });
  }
});

// ==========================================
// ROTAS DE VENDAS DIRETAS (ADMIN)
// ==========================================

app.post('/api/vendas-diretas', autenticarJWT, autorizarRole(['admin']), async (req, res) => {
  let { codigo, nome, preco, whatsappCliente, nomeCliente, clienteId, quantidade, produtoId } = req.body;

  // Se veio produtoId e não veio codigo/nome, busca no estoque central
  if (produtoId && (!codigo || !nome)) {
    try {
      const prod = await prisma.produto.findUnique({ where: { id: produtoId } });
      if (prod) {
        codigo = prod.codigo;
        nome = prod.nome;
      }
    } catch (e) {
      console.error("Erro ao buscar produto por ID na venda direta:", e);
    }
  }

  if (!codigo || !nome || !preco) {
    return res.status(400).json({ error: 'Informações da venda incompletas.' });
  }

  const qtd = parseInt(quantidade) || 1;

  try {
    let ultimaVendaCreated = null;
    
    // Cria tantas vendas diretas quanto a quantidade especificada
    for (let i = 0; i < qtd; i++) {
      const venda = await prisma.vendaDireta.create({
        data: {
          codigo,
          nome,
          preco: parseFloat(preco),
          whatsappCliente,
          nomeCliente,
          clienteId: clienteId || null
        }
      });
      ultimaVendaCreated = venda;
    }

    // Deduz a quantidade do estoque central se houver essa peça disponível
    const produto = await prisma.produto.findUnique({ where: { codigo } });
    if (produto) {
      const novaQtd = Math.max(0, produto.quantidade - qtd);
      await prisma.produto.update({
        where: { codigo },
        data: { quantidade: novaQtd }
      });
    }

    res.status(201).json(ultimaVendaCreated);
  } catch (error) {
    console.error("Erro ao registrar venda direta:", error);
    res.status(500).json({ error: 'Erro ao registrar venda direta.' });
  }
});

app.get('/api/vendas-diretas', autenticarJWT, autorizarRole(['admin']), async (req, res) => {
  try {
    const vendas = await prisma.vendaDireta.findMany({
      orderBy: { data: 'desc' }
    });
    res.json(vendas);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao obter vendas diretas.' });
  }
});

// Excluir uma venda (Admin)
app.delete('/api/vendas/:tipo/:id', autenticarJWT, autorizarRole(['admin']), async (req, res) => {
  const { tipo, id } = req.params;
  try {
    if (tipo === 'direta') {
      await prisma.vendaDireta.delete({ where: { id } });
    } else if (tipo === 'revendedora') {
      await prisma.vendaRevendedora.delete({ where: { id } });
    } else {
      return res.status(400).json({ error: 'Tipo de venda inválido.' });
    }
    res.json({ message: 'Venda excluída com sucesso!' });
  } catch (error) {
    console.error("Erro ao excluir venda:", error);
    res.status(500).json({ error: 'Erro ao excluir venda.' });
  }
});

// Excluir todas as vendas (Admin)
app.delete('/api/vendas', autenticarJWT, autorizarRole(['admin']), async (req, res) => {
  try {
    await prisma.$transaction([
      prisma.vendaDireta.deleteMany(),
      prisma.vendaRevendedora.deleteMany()
    ]);
    res.json({ message: 'Todo o histórico de vendas foi excluído com sucesso!' });
  } catch (error) {
    console.error("Erro ao excluir todo o histórico de vendas:", error);
    res.status(500).json({ error: 'Erro ao excluir todo o histórico de vendas.' });
  }
});

// Relatório DRE Simplificado (Admin)
app.get('/api/relatorios/dre', autenticarJWT, autorizarRole(['admin']), async (req, res) => {
  const { inicio, fim } = req.query;
  const cmvEstimado = parseFloat(req.query.cmvEstimado) || 33.0;

  try {
    // Validação robusta de datas para evitar erros no banco de dados se forem strings inválidas
    let dataInicio = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    if (inicio && inicio !== 'undefined' && inicio !== 'null' && inicio.trim() !== '') {
      const parsedInicio = new Date(inicio);
      if (!isNaN(parsedInicio.getTime())) {
        dataInicio = parsedInicio;
      }
    }

    let dataFim = new Date();
    if (fim && fim !== 'undefined' && fim !== 'null' && fim.trim() !== '') {
      const parsedFim = new Date(fim);
      if (!isNaN(parsedFim.getTime())) {
        dataFim = parsedFim;
      }
    }
    dataFim.setHours(23, 59, 59, 999);

    const vendasDiretas = await prisma.vendaDireta.findMany({
      where: {
        data: {
          gte: dataInicio,
          lte: dataFim
        }
      }
    });

    const acertos = await prisma.historicoAcerto.findMany({
      where: {
        data: {
          gte: dataInicio,
          lte: dataFim
        }
      }
    });

    const vendasRevendedora = await prisma.vendaRevendedora.findMany({
      where: {
        data: {
          gte: dataInicio,
          lte: dataFim
        }
      }
    });

    const produtos = await prisma.produto.findMany();
    const produtosMap = new Map(produtos.map(p => [p.codigo, p]));
    const produtosIdMap = new Map(produtos.map(p => [p.id, p]));

    let faturamentoVendasDiretas = 0;
    let custoVendasDiretas = 0;

    vendasDiretas.forEach(v => {
      faturamentoVendasDiretas += v.preco;
      const prod = produtosMap.get(v.codigo);
      const custoReal = prod ? (prod.custoBruto + prod.custoBanho + prod.custoLiquido) : 0;
      if (custoReal > 0) {
        custoVendasDiretas += custoReal;
      } else {
        custoVendasDiretas += v.preco * (cmvEstimado / 100);
      }
    });

    let faturamentoAcertos = 0;
    let comissoesPagas = 0;
    let descontoPerdas = 0;

    acertos.forEach(a => {
      faturamentoAcertos += a.faturamentoBruto;
      comissoesPagas += a.comissaoPaga;
      descontoPerdas += a.valorDescontoPerda;
    });

    let custoVendasConsignado = 0;
    vendasRevendedora.forEach(vr => {
      const prod = produtosIdMap.get(vr.produtoId) || produtosMap.get(vr.codigoProduto);
      const custoReal = prod ? (prod.custoBruto + prod.custoBanho + prod.custoLiquido) : 0;
      if (custoReal > 0) {
        custoVendasConsignado += custoReal * vr.quantidade;
      } else {
        custoVendasConsignado += vr.precoVenda * (cmvEstimado / 100) * vr.quantidade;
      }
    });

    if (custoVendasConsignado === 0 && faturamentoAcertos > 0) {
      custoVendasConsignado = faturamentoAcertos * (cmvEstimado / 100);
    }

    const faturamentoBrutoTotal = faturamentoVendasDiretas + faturamentoAcertos;
    const custoTotalMercadorias = custoVendasDiretas + custoVendasConsignado;
    const lucroLiquidoEstimado = faturamentoBrutoTotal - comissoesPagas - custoTotalMercadorias;

    res.json({
      periodo: {
        inicio: dataInicio,
        fim: dataFim
      },
      resumo: {
        faturamentoVendasDiretas,
        faturamentoAcertos,
        faturamentoBrutoTotal,
        comissoesPagas,
        descontoPerdas,
        custoVendasDiretas,
        custoVendasConsignado,
        custoTotalMercadorias,
        lucroLiquidoEstimado
      }
    });

  } catch (error) {
    console.error("Erro ao gerar DRE:", error);
    res.status(500).json({ error: 'Erro ao gerar o relatório DRE.' });
  }
});

// ==========================================
// ROTAS DE VENDAS DE REVENDEDORAS
// ==========================================

// Registrar venda (Revendedora registra venda de item da maleta)
app.post('/api/vendas-revendedora', autenticarJWT, autorizarRole(['revendedora']), async (req, res) => {
  const { produtoId, quantidade } = req.body;
  const usuarioId = req.user.id;

  if (!produtoId || !quantidade || quantidade <= 0) {
    return res.status(400).json({ error: 'Dados incompletos para registrar a venda.' });
  }

  try {
    // Busca o item consignado desta revendedora
    const consignado = await prisma.consignado.findUnique({
      where: { usuarioId_produtoId: { usuarioId, produtoId } },
      include: { produto: true, usuario: true }
    });

    if (!consignado) {
      return res.status(404).json({ error: 'Este produto não está na sua maleta.' });
    }

    if (consignado.quantidadeConsignada < quantidade) {
      return res.status(400).json({ error: `Quantidade insuficiente na maleta. Você tem apenas ${consignado.quantidadeConsignada} unidade(s).` });
    }

    const comissaoValor = consignado.precoVenda * quantidade * (consignado.usuario.comissao / 100);

    // Deduz da maleta ou remove o item se zerou
    const novaQtd = consignado.quantidadeConsignada - quantidade;
    if (novaQtd === 0) {
      await prisma.consignado.delete({ where: { id: consignado.id } });
    } else {
      await prisma.consignado.update({
        where: { id: consignado.id },
        data: { quantidadeConsignada: novaQtd }
      });
    }

    // Registra a venda
    const venda = await prisma.vendaRevendedora.create({
      data: {
        usuarioId,
        produtoId,
        nomeProduto: consignado.produto.nome,
        codigoProduto: consignado.produto.codigo,
        quantidade,
        precoVenda: consignado.precoVenda,
        comissaoValor
      }
    });

    // Cria notificação de venda para o Admin
    try {
      const valorTotal = consignado.precoVenda * quantidade;
      await prisma.notificacao.create({
        data: {
          tipo: 'venda_revendedora',
          mensagem: `A revendedora ${consignado.usuario.nome} vendeu ${quantidade}x ${consignado.produto.nome} (Código: ${consignado.produto.codigo}) no valor total de R$ ${valorTotal.toFixed(2).replace('.', ',')}.`,
          detalhes: JSON.stringify({
            vendaId: venda.id,
            revendedoraNome: consignado.usuario.nome,
            produtoNome: consignado.produto.nome,
            produtoCodigo: consignado.produto.codigo,
            quantidade,
            precoVenda: consignado.precoVenda,
            valorTotal,
            comissaoValor,
            data: venda.data
          })
        }
      });
    } catch (notifErr) {
      console.error("Erro ao gerar notificação de venda no backend:", notifErr);
    }

    res.status(201).json({
      venda,
      resumo: {
        nomeProduto: consignado.produto.nome,
        quantidade,
        totalVenda: consignado.precoVenda * quantidade,
        comissaoValor,
        qtdRestanteNaMaleta: novaQtd
      }
    });
  } catch (error) {
    console.error('Erro ao registrar venda da revendedora:', error);
    res.status(500).json({ error: 'Erro ao registrar venda.' });
  }
});

// Listar vendas da revendedora logada
app.get('/api/vendas-revendedora', autenticarJWT, async (req, res) => {
  try {
    let where = {};
    if (req.user.role !== 'admin') {
      where.usuarioId = req.user.id;
    } else if (req.query.usuarioId) {
      where.usuarioId = req.query.usuarioId;
    }

    // Se solicitado apenas pendentes e temos um usuarioId definido
    if (req.query.apenasPendentes === 'true' && where.usuarioId) {
      // Busca o último acerto deste usuário
      const ultimoAcerto = await prisma.historicoAcerto.findFirst({
        where: { usuarioId: where.usuarioId },
        orderBy: { data: 'desc' }
      });
      if (ultimoAcerto) {
        where.data = {
          gt: ultimoAcerto.data
        };
      }
    }

    const vendas = await prisma.vendaRevendedora.findMany({
      where,
      orderBy: { data: 'desc' },
      include: {
        usuario: { select: { nome: true, whatsapp: true } },
        cliente: { select: { nome: true, whatsapp: true } }
      }
    });
    res.json(vendas);
  } catch (error) {
    console.error('Erro ao listar vendas:', error);
    res.status(500).json({ error: 'Erro ao listar vendas.' });
  }
});


// ==========================================
// UPLOADS NO AZURE BLOB STORAGE
// ==========================================

app.post('/api/uploads', autenticarJWT, upload.single('imagem'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
  }

  // Se não estiver configurado o Azure Blob Storage, retorna fallback simulado ou erro
  if (!containerClient) {
    console.warn("Aviso: Azure Blob Storage não configurado. Utilizando link simulado temporariamente.");
    // Fallback: Simulador de link local para testes locais
    const blobNameSimulado = `fallback_${Date.now()}_${req.file.originalname}`;
    return res.json({ 
      url: `https://via.placeholder.com/450/423004/d4af37?text=${encodeURIComponent(blobNameSimulado)}` 
    });
  }

  try {
    const blobName = `semijoia_${Date.now()}_${Math.random().toString(36).substr(2, 5)}_${req.file.originalname.replace(/\s+/g, '_')}`;
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);
    
    // Faz o upload do buffer diretamente para o contêiner na Azure
    await blockBlobClient.upload(req.file.buffer, req.file.buffer.length, {
      blobHTTPHeaders: { blobContentType: req.file.mimetype }
    });

    // Retorna a URL pública
    res.json({ url: blockBlobClient.url });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao subir imagem no Azure Blob Storage.' });
  }
});

// ==========================================
// ROTA DE IMPORTAÇÃO EM MASSA (EXCEL/CSV)
// ==========================================

app.post('/api/importar', autenticarJWT, autorizarRole(['admin']), async (req, res) => {
  const { produtos, revendedoras, substituirTudo } = req.body;
  
  try {
    if (substituirTudo) {
      // Limpa todas as tabelas (exceto administradores)
      await prisma.$transaction([
        prisma.consignado.deleteMany(),
        prisma.historicoAcerto.deleteMany(),
        prisma.vendaDireta.deleteMany(),
        prisma.produto.deleteMany(),
        prisma.usuario.deleteMany({ where: { role: 'revendedora' } })
      ]);
    }

    // Importa Produtos
    if (produtos && produtos.length > 0) {
      for (const p of produtos) {
        const existente = await prisma.produto.findUnique({ where: { codigo: p.codigo } });
        
        if (existente) {
          if (!substituirTudo) {
            await prisma.produto.update({
              where: { id: existente.id },
              data: {
                quantidade: parseInt(p.quantidade) || 0,
                custoBruto: parseFloat(p.custoBruto) || 0.0,
                custoBanho: parseFloat(p.custoBanho) || 0.0,
                custoLiquido: parseFloat(p.custoLiquido) || 0.0,
                markup: parseFloat(p.markup) || 3.0
              }
            });
          }
        } else {
          await prisma.produto.create({
            data: {
              id: p.id && !p.id.startsWith('prod_') ? p.id : undefined,
              codigo: p.codigo,
              nome: p.nome,
              categoria: p.categoria || 'Outros',
              quantidade: parseInt(p.quantidade) || 0,
              custoBruto: parseFloat(p.custoBruto) || 0.0,
              custoBanho: parseFloat(p.custoBanho) || 0.0,
              custoLiquido: parseFloat(p.custoLiquido) || 0.0,
              markup: parseFloat(p.markup) || 3.0
            }
          });
        }
      }
    }

    // Importa Revendedoras
    const novasRevendedorasSenhas = [];
    if (revendedoras && revendedoras.length > 0) {
      for (const r of revendedoras) {
        const emailTemporario = r.email || (r.nome.toLowerCase().replace(/\s+/g, '') + "_" + Math.floor(Math.random() * 1000) + "@belklock.com");
        
        let existente = await prisma.usuario.findFirst({
          where: {
            OR: [
              { email: emailTemporario },
              { nome: { equals: r.nome } }
            ]
          }
        });

        let revendedoraId;

        if (existente) {
          revendedoraId = existente.id;
          if (!substituirTudo) {
            await prisma.usuario.update({
              where: { id: existente.id },
              data: {
                whatsapp: r.whatsapp,
                comissao: parseFloat(r.comissao) || 30.0
              }
            });
          }
        } else {
          const senhaGerada = gerarSenhaAleatoria(8);
          const senhaHash = await bcrypt.hash(senhaGerada, 10);
          const pin = r.pin || Math.floor(1000 + Math.random() * 9000).toString();
          
          const novaRev = await prisma.usuario.create({
            data: {
              id: r.id && !r.id.startsWith('rev_') ? r.id : undefined,
              nome: r.nome,
              email: emailTemporario,
              pin: pin,
              senhaHash: senhaHash,
              role: 'revendedora',
              whatsapp: r.whatsapp,
              comissao: parseFloat(r.comissao) || 30.0
            }
          });
          revendedoraId = novaRev.id;
          novasRevendedorasSenhas.push({
            nome: r.nome,
            email: emailTemporario,
            pin: pin,
            senha: senhaGerada
          });
        }

        // Importa itens consignados da maleta
        if (r.consignado && r.consignado.length > 0) {
          for (const c of r.consignado) {
            const prod = await prisma.produto.findUnique({ where: { codigo: c.codigo } });
            if (prod) {
              const consExistente = await prisma.consignado.findUnique({
                where: {
                  usuarioId_produtoId: { usuarioId: revendedoraId, produtoId: prod.id }
                }
              });

              if (consExistente) {
                await prisma.consignado.update({
                  where: { id: consExistente.id },
                  data: {
                    quantidadeConsignada: substituirTudo ? parseInt(c.quantidadeConsignada) : (consExistente.quantidadeConsignada + parseInt(c.quantidadeConsignada)),
                    precoVenda: parseFloat(c.precoVenda) || (prod.custoBruto + prod.custoBanho + prod.custoLiquido) * prod.markup
                  }
                });
              } else {
                await prisma.consignado.create({
                  data: {
                    usuarioId: revendedoraId,
                    produtoId: prod.id,
                    quantidadeConsignada: parseInt(c.quantidadeConsignada) || 0,
                    precoVenda: parseFloat(c.precoVenda) || (prod.custoBruto + prod.custoBanho + prod.custoLiquido) * prod.markup
                  }
                });
              }
            }
          }
        }
      }
    }

    res.json({ 
      message: 'Dados importados e sincronizados com sucesso no banco de dados SQLite!',
      novasRevendedoras: novasRevendedorasSenhas
    });
  } catch (error) {
    console.error("Erro na importação em massa:", error);
    res.status(500).json({ error: 'Erro ao processar importação no banco de dados.' });
  }
});

// ==========================================
// ROTAS DE CLIENTES
// ==========================================

// Listar Clientes
app.get('/api/clientes', autenticarJWT, autorizarRole(['admin']), async (req, res) => {
  try {
    const clientes = await prisma.cliente.findMany({
      orderBy: { nome: 'asc' }
    });
    res.json(clientes);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao listar clientes.' });
  }
});

// Criar Cliente
app.post('/api/clientes', autenticarJWT, autorizarRole(['admin']), async (req, res) => {
  const { nome, whatsapp, dataNascimento, observacoes } = req.body;
  if (!nome || !whatsapp) {
    return res.status(400).json({ error: 'Nome e WhatsApp são obrigatórios.' });
  }
  try {
    const cliente = await prisma.cliente.create({
      data: { nome, whatsapp, dataNascimento: dataNascimento || null, observacoes: observacoes || null }
    });
    res.status(201).json(cliente);
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Já existe uma cliente cadastrada com este WhatsApp.' });
    }
    res.status(500).json({ error: 'Erro ao cadastrar cliente.' });
  }
});

// Editar Cliente
app.put('/api/clientes/:id', autenticarJWT, autorizarRole(['admin']), async (req, res) => {
  const { id } = req.params;
  const { nome, whatsapp, dataNascimento, observacoes } = req.body;
  try {
    const cliente = await prisma.cliente.update({
      where: { id },
      data: { nome, whatsapp, dataNascimento: dataNascimento || null, observacoes: observacoes || null }
    });
    res.json(cliente);
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Já existe uma cliente cadastrada com este WhatsApp.' });
    }
    res.status(500).json({ error: 'Erro ao atualizar cliente.' });
  }
});

// Excluir Cliente
app.delete('/api/clientes/:id', autenticarJWT, autorizarRole(['admin']), async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.cliente.delete({ where: { id } });
    res.json({ message: 'Cliente removida com sucesso!' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao excluir cliente.' });
  }
});

// Excluir todas as clientes
app.delete('/api/clientes', autenticarJWT, autorizarRole(['admin']), async (req, res) => {
  try {
    await prisma.cliente.deleteMany();
    res.json({ message: 'Todas as clientes foram removidas com sucesso!' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao excluir todas as clientes.' });
  }
});

// ==========================================
// ROTAS DE NOTIFICAÇÕES (ADMIN)
// ==========================================

// Listar notificações não lidas
app.get('/api/notificacoes', autenticarJWT, autorizarRole(['admin']), async (req, res) => {
  try {
    const notificacoes = await prisma.notificacao.findMany({
      where: { lida: false },
      orderBy: { createdAt: 'desc' }
    });
    res.json(notificacoes);
  } catch (error) {
    console.error('Erro ao buscar notificações:', error);
    res.status(500).json({ error: 'Erro ao buscar notificações.' });
  }
});

// Marcar notificações como lidas
app.put('/api/notificacoes/ler', autenticarJWT, autorizarRole(['admin']), async (req, res) => {
  const { ids } = req.body;
  try {
    if (ids && Array.isArray(ids) && ids.length > 0) {
      await prisma.notificacao.updateMany({
        where: { id: { in: ids } },
        data: { lida: true }
      });
    } else {
      await prisma.notificacao.updateMany({
        where: { lida: false },
        data: { lida: true }
      });
    }
    res.json({ message: 'Notificações marcadas como lidas!' });
  } catch (error) {
    console.error('Erro ao marcar notificações como lidas:', error);
    res.status(500).json({ error: 'Erro ao marcar notificações.' });
  }
});

// ==========================================
// INICIALIZAÇÃO
// ==========================================
app.listen(PORT, () => {
  console.log(`Servidor BelKlock rodando com sucesso na porta ${PORT}`);
});
