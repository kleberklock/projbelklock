const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const { PrismaClient } = require('@prisma/client');
const { BlobServiceClient } = require('@azure/storage-blob');
const rateLimit = require('express-rate-limit');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
const { criarCobranca, obterQrCodePix, obterCodigoBarrasBoleto } = require('./asaas-service');
const crypto = require('crypto');

// Função de segurança que garante um JWT_SECRET robusto gravado no .env
function garantirChaveJwtSegura() {
  const envPath = path.resolve(__dirname, '.env');
  let envContent = '';
  
  try {
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
    } else {
      envContent = `PORT=5000\nJWT_SECRET=\n`;
    }
  } catch (err) {
    console.error('Erro ao ler arquivo .env:', err.message);
    return;
  }

  const jwtInseguros = [
    'sua_chave_secreta_super_segura_de_producao',
    'conectajoias_super_secret_key_2026',
    'defina_uma_chave_secreta_super_segura_aqui',
    'insira_uma_chave_secreta_aqui'
  ];

  let currentSecret = process.env.JWT_SECRET || '';

  if (!currentSecret || jwtInseguros.includes(currentSecret.trim())) {
    console.log('🛡️ Gerando chave JWT_SECRET criptográfica robusta...');
    const novaChave = crypto.randomBytes(32).toString('hex');
    process.env.JWT_SECRET = novaChave;

    if (envContent.includes('JWT_SECRET=')) {
      envContent = envContent.replace(/JWT_SECRET=.*/, `JWT_SECRET=${novaChave}`);
    } else {
      envContent += `\nJWT_SECRET=${novaChave}\n`;
    }
    
    try {
      fs.writeFileSync(envPath, envContent, 'utf8');
      console.log('✅ Nova chave JWT_SECRET gravada com sucesso no arquivo .env.');
    } catch (err) {
      console.error('Erro ao gravar nova chave no .env:', err.message);
    }
  }
}

garantirChaveJwtSegura();

const app = express();
const prisma = new PrismaClient();
const lojasSuspensas = new Set();
const PORT = process.env.PORT || 5000;

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error("ERRO CRÍTICO: JWT_SECRET inválido.");
  process.exit(1);
}

// Configuração de CORS restrita ao frontend (inclui as portas de desenvolvimento local 5500 e 8080 e subdomínios)
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5500';
const CORS_ORIGINS = [
  frontendUrl,
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'http://localhost:8080',
  'http://127.0.0.1:8080'
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    
    const isAllowed = CORS_ORIGINS.some(allowed => {
      if (allowed === origin) return true;
      const allowedDomain = allowed.replace(/^https?:\/\//, '');
      const originDomain = origin.replace(/^https?:\/\//, '');
      return originDomain === allowedDomain || originDomain.endsWith('.' + allowedDomain);
    });

    if (isAllowed) {
      callback(null, true);
    } else {
      callback(new Error('Bloqueado pelo CORS do Conecta Joias'));
    }
  },
  credentials: true
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Criação automática das pastas de uploads locais
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const DOCUMENTOS_DIR = path.join(UPLOADS_DIR, 'documentos');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
if (!fs.existsSync(DOCUMENTOS_DIR)) {
  fs.mkdirSync(DOCUMENTOS_DIR, { recursive: true });
}

// Servir a pasta uploads de forma estática
app.use('/uploads', express.static(UPLOADS_DIR));

// Configuração do Multer para Imagens em Memória
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 } // limite de 5MB
});

// Configuração do Multer para Documentos em Disco
const docStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, DOCUMENTOS_DIR);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});
const uploadDocs = multer({
  storage: docStorage,
  limits: { fileSize: 10 * 1024 * 1024 } // limite de 10MB para documentos
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

// Middleware opcional: decodifica o JWT se presente, mas não bloqueia se ausente.
// Usado em rotas públicas que também atendem usuários autenticados (ex: /api/config).
const autenticarJWTOpcional = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      req.user = jwt.verify(token, JWT_SECRET);
    } catch (_) {
      // Token inválido: ignora silenciosamente e continua como anônimo
      req.user = null;
    }
  }
  next();
};

const autorizarRole = (rolesAutorizadas) => {
  return (req, res, next) => {
    if (!req.user || !rolesAutorizadas.includes(req.user.role)) {
      return res.status(403).json({ error: 'Acesso negado. Você não tem permissão para realizar esta ação.' });
    }
    next();
  };
};

const identificarLoja = (req, res, next) => {
  // SuperAdmin não exige lojaId fixo — pode operar em nome de qualquer loja via header
  if (req.user && req.user.role === 'SuperAdmin') {
    // Aceita o lojaId do token (se tiver) ou do header (para operar como uma loja específica)
    req.lojaId = req.user.lojaId || req.headers['x-loja-id'] || null;
    return next();
  }

  // Para Manager e Consultant: lojaId é obrigatório e vem do token
  let lojaId = req.headers['x-loja-id'];
  if (req.user && req.user.lojaId) {
    lojaId = req.user.lojaId; // Token tem prioridade sobre o header
  }

  // Tratamento defensivo contra null ou "null" enviado pelo frontend
  if (!lojaId || lojaId === 'null' || lojaId === 'undefined') {
    lojaId = 'default-loja';
  }

  // Bloqueio de Lojas Suspensas para Manager e Consultant
  if (lojaId && lojasSuspensas.has(lojaId)) {
    return res.status(403).json({ error: 'Acesso negado. A assinatura da sua loja está suspensa. Entre em contato com a administração central.' });
  }

  req.lojaId = lojaId;
  next();
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

// Limiter para criação de novas marcas/tenants (máximo 5 cadastros por hora por IP)
const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { error: 'Limite de criação de marcas excedido. Tente novamente em uma hora.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Limiter para processamento de pagamentos/checkout (máximo 10 tentativas a cada 30 minutos por IP)
const paymentLimiter = rateLimit({
  windowMs: 30 * 60 * 1000,
  max: 10,
  message: { error: 'Muitas tentativas de pagamento por este endereço. Tente novamente em 30 minutos.' },
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

// Função para encontrar a faixa de comissão onde o faturamento se encaixa
function encontrarFaixaComissao(faturamentoBruto, faixas) {
  if (!faixas || !Array.isArray(faixas)) return null;
  return faixas.find(f => faturamentoBruto >= f.valorMin && faturamentoBruto <= f.valorMax);
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

    // Verifica se a loja do usuário está suspensa (bloqueia se o tenant estiver suspenso)
    if (usuario.lojaId && lojasSuspensas.has(usuario.lojaId)) {
      return res.status(403).json({ error: 'Acesso negado. A assinatura da sua loja está suspensa. Entre em contato com a administração central.' });
    }

    // Gera Token JWT
    const token = jwt.sign(
      { id: usuario.id, nome: usuario.nome, email: usuario.email, pin: usuario.pin, role: usuario.role, lojaId: usuario.lojaId },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Busca as configurações visuais da loja para retornar junto com o login
    // (garante que a revendedora herde as cores corretas sem uma segunda requisição)
    let configLoja = null;
    if (usuario.lojaId) {
      try {
        configLoja = await prisma.configuracao.findFirst({
          where: { lojaId: usuario.lojaId }
        });
      } catch (configErr) {
        console.warn('Aviso: não foi possível buscar config da loja no login:', configErr.message);
      }
    }

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
        comissao: usuario.comissao,
        lojaId: usuario.lojaId
      },
      // Configurações visuais da loja para aplicação imediata no frontend
      configLoja: configLoja ? {
        nomeEmpresa: configLoja.nomeEmpresa,
        logoUrl: configLoja.logoUrl,
        corPrimaria: configLoja.corPrimaria,
        corSecundaria: configLoja.corSecundaria,
        bgPrimary: configLoja.bgPrimary,
        bgCard: configLoja.bgCard,
        temaPref: configLoja.temaPref
      } : null
    });
  } catch (error) {
    res.status(500).json({ error: 'Erro interno no servidor ao tentar logar.' });
  }
});


// Auto-cadastro público de Gestora (Manager)
app.post('/api/auth/signup', signupLimiter, async (req, res) => {
  const { nome, email, senha, nomeLoja } = req.body;
  if (!nome || !email || !senha || !nomeLoja) {
    return res.status(400).json({ error: 'Campos obrigatórios ausentes: nome, email, senha e nomeLoja.' });
  }

  try {
    const emailExiste = await prisma.usuario.findUnique({ where: { email } });
    if (emailExiste) {
      return res.status(400).json({ error: 'Este e-mail já está cadastrado.' });
    }

    // Criar uma nova loja/marca para a gestora
    const lojaIdLimpo = nomeLoja.toLowerCase().replace(/[^a-z0-9]/g, "-") + "-" + Math.floor(1000 + Math.random() * 9000);

    const novaLoja = await prisma.loja.create({
      data: {
        id: lojaIdLimpo,
        nome: nomeLoja
      }
    });

    // Criar configuração visual padrão para a nova loja
    await prisma.configuracao.create({
      data: {
        lojaId: novaLoja.id,
        nomeEmpresa: nomeLoja,
        logoUrl: "",
        corPrimaria: "#d4af37",
        corSecundaria: "#111111",
        bgPrimary: "#0a0a0a",
        bgCard: "#121212"
      }
    });

    const pin = await gerarPinUnico();
    const senhaHash = await bcrypt.hash(senha, 10);

    const novaGestora = await prisma.usuario.create({
      data: {
        nome,
        email,
        pin,
        senhaHash,
        role: 'Manager',
        lojaId: novaLoja.id,
        comissao: 0.0
      }
    });

    // Gerar Token JWT para logar imediatamente
    const token = jwt.sign(
      { id: novaGestora.id, nome: novaGestora.nome, email: novaGestora.email, role: novaGestora.role, lojaId: novaGestora.lojaId },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'Gestora e Marca registradas com sucesso!',
      token,
      pin,
      usuario: {
        id: novaGestora.id,
        nome: novaGestora.nome,
        email: novaGestora.email,
        role: novaGestora.role,
        lojaId: novaGestora.lojaId,
        pin: pin
      }
    });
  } catch (error) {
    console.error('Erro no auto-cadastro de gestora:', error);
    res.status(500).json({ error: 'Erro interno no servidor ao tentar realizar cadastro.' });
  }
});

// GET /api/auth/pre-login-config - Obter configuração de tema pública do usuário (PIN ou E-mail) para a tela de login
app.get('/api/auth/pre-login-config', async (req, res) => {
  const { identificador } = req.query;
  if (!identificador) {
    return res.status(400).json({ error: 'Identificador ausente.' });
  }

  try {
    let usuario;
    if (/^\d{4}$/.test(identificador)) {
      usuario = await prisma.usuario.findUnique({ where: { pin: identificador } });
    } else {
      usuario = await prisma.usuario.findUnique({ where: { email: identificador } });
    }

    if (!usuario) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    // Busca as configurações da loja do usuário
    const config = await prisma.configuracao.findFirst({
      where: { lojaId: usuario.lojaId }
    });

    if (!config) {
      return res.status(404).json({ error: 'Configuração da loja não encontrada.' });
    }

    // Retorna apenas dados de tema visual públicos e seguros
    res.json({
      nomeEmpresa: config.nomeEmpresa,
      logoUrl: config.logoUrl,
      corPrimaria: config.corPrimaria,
      corSecundaria: config.corSecundaria,
      bgPrimary: config.bgPrimary,
      bgCard: config.bgCard,
      temaPref: config.temaPref
    });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao carregar pré-configuração de login.' });
  }
});

// Admin cria novos usuários (Revendedoras ou outros Admins)
app.post('/api/auth/register', autenticarJWT, autorizarRole(['Manager', 'SuperAdmin']), identificarLoja, async (req, res) => {
  const { nome, email, senha, role, whatsapp, comissao, faixasComissao, tipoComissao, metaUnicaValor, metaUnicaBonus, metaUnicaTipoBonus, baseCalculo, regraPerda, limiteIsencaoPerda, periodoAcumulo, ciclo } = req.body;
  if (!nome || !email || !senha || !role) {
    return res.status(400).json({ error: 'Campos obrigatórios ausentes.' });
  }

  // Normaliza a role para maiúsculas e mapeia valores antigos
  let normalizedRole = role.toUpperCase();
  if (normalizedRole === 'CONSULTANT' || normalizedRole === 'REVENDEDORA' || normalizedRole === 'VENDEDORA') {
    normalizedRole = 'Consultant';
  } else if (normalizedRole === 'ADMIN' || normalizedRole === 'MANAGER') {
    normalizedRole = 'Manager';
  }

  try {
    const emailExiste = await prisma.usuario.findUnique({ where: { email } });
    if (emailExiste) {
      return res.status(400).json({ error: 'Este e-mail já está cadastrado.' });
    }

    // Validação de limite de plano de assinatura para consultoras (SaaS)
    if (normalizedRole === 'Consultant') {
      const loja = await prisma.loja.findUnique({ where: { id: req.lojaId } });
      const plano = loja ? (loja.plano || 'BRONZE').toUpperCase() : 'BRONZE';

      const totalConsultoras = await prisma.usuario.count({
        where: { role: 'Consultant', lojaId: req.lojaId }
      });

      if (plano === 'BRONZE' && totalConsultoras >= 5) {
        return res.status(403).json({ error: 'Limite do plano Bronze atingido (máximo 5 consultoras). Faça o upgrade da sua assinatura para cadastrar mais.' });
      }
      if (plano === 'GOLD' && totalConsultoras >= 25) {
        return res.status(403).json({ error: 'Limite do plano Gold atingido (máximo 25 consultoras). Faça o upgrade da sua assinatura para cadastrar mais.' });
      }
    }

    const senhaHash = await bcrypt.hash(senha, 10);

    let pin = null;
    if (normalizedRole === 'Consultant') {
      pin = await gerarPinUnico();
    }

    const novoUsuario = await prisma.usuario.create({
      data: {
        nome,
        email,
        pin,
        senhaHash,
        role: normalizedRole,
        whatsapp,
        comissao: parseFloat(comissao) || 30.0,
        tipoComissao: tipoComissao || "FIXA",
        metaUnicaValor: parseFloat(metaUnicaValor) || 0.0,
        metaUnicaBonus: parseFloat(metaUnicaBonus) || 0.0,
        metaUnicaTipoBonus: metaUnicaTipoBonus || "PERCENTUAL",
        baseCalculo: baseCalculo || "BRUTO",
        regraPerda: regraPerda || "VALOR_VENDA",
        limiteIsencaoPerda: parseInt(limiteIsencaoPerda) || 0,
        periodoAcumulo: periodoAcumulo || "MANUAL",
        ciclo: ciclo ? JSON.stringify(ciclo) : null,
        lojaId: req.lojaId,
        faixasComissao: faixasComissao && Array.isArray(faixasComissao) ? {
          create: faixasComissao.map(f => ({
            valorMin: parseFloat(f.valorMin) || 0.0,
            valorMax: parseFloat(f.valorMax) || 0.0,
            percentual: parseFloat(f.percentual) || 0.0,
            lojaId: req.lojaId
          }))
        } : undefined
      },
      include: {
        faixasComissao: true
      }
    });

    // Se o usuário criado for uma consultora (revendedora), cria mensagem de boas-vindas na fila do WhatsApp
    if (normalizedRole === 'Consultant') {
      const msgTexto = `Olá ${nome}, seja muito bem-vinda à Conecta Joias! ✨ Seu cadastro de Consultora foi realizado com sucesso. Aqui estão suas credenciais para entrar no portal: Login (PIN): ${pin} | Senha Temporária: ${senha} | Link do portal: ${frontendUrl}/manager.html`;
      try {
        await prisma.mensagemWhatsapp.create({
          data: {
            numero: whatsapp,
            mensagem: msgTexto,
            tipo: 'BOAS_VINDAS',
            status: 'PENDENTE',
            lojaId: req.lojaId
          }
        });
      } catch (wsErr) {
        console.error("Erro ao agendar WhatsApp de boas-vindas no cadastro manual:", wsErr);
      }
    }

    res.status(201).json({
      message: 'Usuário cadastrado com sucesso!',
      usuario: {
        id: novoUsuario.id,
        nome: novoUsuario.nome,
        email: novoUsuario.email,
        pin: novoUsuario.pin,
        role: novoUsuario.role,
        comissao: novoUsuario.comissao,
        faixasComissao: novoUsuario.faixasComissao,
        tipoComissao: novoUsuario.tipoComissao,
        metaUnicaValor: novoUsuario.metaUnicaValor,
        metaUnicaBonus: novoUsuario.metaUnicaBonus,
        metaUnicaTipoBonus: novoUsuario.metaUnicaTipoBonus,
        baseCalculo: novoUsuario.baseCalculo,
        regraPerda: novoUsuario.regraPerda,
        limiteIsencaoPerda: novoUsuario.limiteIsencaoPerda,
        periodoAcumulo: novoUsuario.periodoAcumulo
      }
    });
  } catch (error) {
    console.error("Erro detalhado ao cadastrar usuário:", error);
    res.status(500).json({ error: `Erro ao cadastrar usuário: ${error.message}` });
  }
});

// ==========================================
// ROTAS DE GESTÃO DE ESTOQUE (PRODUTOS)
// ==========================================

// Listar Produtos (com filtro de segurança para revendedoras)
app.get('/api/produtos', autenticarJWT, identificarLoja, async (req, res) => {
  try {
    const produtos = await prisma.produto.findMany({
      where: { lojaId: req.lojaId },
      orderBy: { nome: 'asc' }
    });

    // Se o usuário logado for revendedora, removemos os custos por segurança comercial
    if (req.user.role === 'Consultant') {
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
app.get('/api/produtos/defeitos', autenticarJWT, autorizarRole(['Manager', 'SuperAdmin']), identificarLoja, async (req, res) => {
  try {
    const produtosComDefeito = await prisma.produto.findMany({
      where: {
        lojaId: req.lojaId,
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
app.post('/api/produtos', autenticarJWT, autorizarRole(['Manager', 'SuperAdmin']), identificarLoja, async (req, res) => {
  const { codigo, nome, categoria, quantidade, custoBruto, custoBanho, custoLiquido, markup, fotoUrl, quantidadeDefeito } = req.body;
  if (!nome || !categoria) {
    return res.status(400).json({ error: 'Nome e categoria são obrigatórios.' });
  }

  const cod = codigo || 'REF-' + Math.floor(1000 + Math.random() * 9000);

  try {
    // Validação de limite de peças no estoque baseado no plano da loja (SaaS)
    const loja = await prisma.loja.findUnique({ where: { id: req.lojaId } });
    const plano = loja ? (loja.plano || 'BRONZE').toUpperCase() : 'BRONZE';

    if (plano !== 'PLATINUM') {
      const totalProdutos = await prisma.produto.aggregate({
        where: { lojaId: req.lojaId },
        _sum: {
          quantidade: true
        }
      });
      const totalEstoqueAtual = totalProdutos._sum.quantidade || 0;
      const limite = plano === 'BRONZE' ? 300 : 1500;
      const novoTotal = totalEstoqueAtual + (parseInt(quantidade) || 0);

      if (novoTotal > limite) {
        return res.status(403).json({ error: `Limite de peças do plano ${plano} atingido (${totalEstoqueAtual}/${limite} peças em estoque central). Não é possível cadastrar mais ${quantidade} peças sem fazer o upgrade do seu plano.` });
      }
    }
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
        quantidadeDefeito: parseInt(quantidadeDefeito) || 0,
        lojaId: req.lojaId
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
app.put('/api/produtos/:id', autenticarJWT, autorizarRole(['Manager', 'SuperAdmin']), identificarLoja, async (req, res) => {
  const { id } = req.params;
  const { codigo, nome, categoria, quantidade, custoBruto, custoBanho, custoLiquido, markup, fotoUrl, quantidadeDefeito } = req.body;

  try {
    const prod = await prisma.produto.findFirst({ where: { id, lojaId: req.lojaId } });
    if (!prod) {
      return res.status(403).json({ error: 'Acesso negado ou produto não encontrado nesta loja.' });
    }

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
app.delete('/api/produtos/:id', autenticarJWT, autorizarRole(['Manager', 'SuperAdmin']), identificarLoja, async (req, res) => {
  const { id } = req.params;
  try {
    const prod = await prisma.produto.findFirst({ where: { id, lojaId: req.lojaId } });
    if (!prod) {
      return res.status(403).json({ error: 'Acesso negado ou produto não encontrado nesta loja.' });
    }

    await prisma.produto.delete({ where: { id } });

    registrarLog(req, "PRODUTO_EXCLUIR", `Excluiu o produto ${prod.nome} (${prod.codigo}).`);

    res.json({ message: 'Produto removido com sucesso!' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao excluir produto.' });
  }
});

// Excluir Todos os Produtos (Admin)
app.delete('/api/produtos', autenticarJWT, autorizarRole(['Manager', 'SuperAdmin']), identificarLoja, async (req, res) => {
  try {
    await prisma.$transaction([
      prisma.consignado.deleteMany({ where: { lojaId: req.lojaId } }), // Limpa os consignados relacionados desta loja
      prisma.produto.deleteMany({ where: { lojaId: req.lojaId } })
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
app.get('/api/revendedoras', autenticarJWT, autorizarRole(['Manager', 'SuperAdmin']), identificarLoja, async (req, res) => {
  try {
    const revendedoras = await prisma.usuario.findMany({
      where: { role: 'Consultant', lojaId: req.lojaId },
      select: {
        id: true,
        nome: true,
        email: true,
        pin: true,
        whatsapp: true,
        comissao: true,
        faixasComissao: true,
        tipoComissao: true,
        metaUnicaValor: true,
        metaUnicaBonus: true,
        metaUnicaTipoBonus: true,
        baseCalculo: true,
        regraPerda: true,
        limiteIsencaoPerda: true,
        periodoAcumulo: true,
        ciclo: true,
        createdAt: true,
        consignados: {
          where: { lojaId: req.lojaId },
          include: {
            produto: true
          }
        },
        vendas: {
          where: { lojaId: req.lojaId },
          select: {
            data: true,
            precoVenda: true,
            quantidade: true
          }
        },
        historico: {
          where: { lojaId: req.lojaId }
        }
      },
      orderBy: { nome: 'asc' }
    });
    
    // Desserializa o ciclo para devolver como objeto
    const revendedorasFormatadas = revendedoras.map(r => ({
      ...r,
      ciclo: r.ciclo ? JSON.parse(r.ciclo) : null
    }));

    res.json(revendedorasFormatadas);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao listar revendedoras.' });
  }
});

// Editar Revendedora (Admin)
app.put('/api/revendedoras/:id', autenticarJWT, autorizarRole(['Manager', 'SuperAdmin']), identificarLoja, async (req, res) => {
  const { id } = req.params;
  const { nome, email, whatsapp, comissao, faixasComissao, tipoComissao, metaUnicaValor, metaUnicaBonus, metaUnicaTipoBonus, baseCalculo, regraPerda, limiteIsencaoPerda, periodoAcumulo, senha, ciclo } = req.body;

  try {
    const revendedora = await prisma.usuario.findFirst({
      where: { id, role: 'Consultant', lojaId: req.lojaId }
    });

    if (!revendedora) {
      return res.status(403).json({ error: 'Acesso negado ou revendedora não encontrada nesta loja.' });
    }

    const updateData = {
      nome,
      email,
      whatsapp,
      comissao: parseFloat(comissao) || 30.0,
      tipoComissao: tipoComissao || "FIXA",
      metaUnicaValor: parseFloat(metaUnicaValor) || 0.0,
      metaUnicaBonus: parseFloat(metaUnicaBonus) || 0.0,
      metaUnicaTipoBonus: metaUnicaTipoBonus || "PERCENTUAL",
      baseCalculo: baseCalculo || "BRUTO",
      regraPerda: regraPerda || "VALOR_VENDA",
      limiteIsencaoPerda: parseInt(limiteIsencaoPerda) || 0,
      periodoAcumulo: periodoAcumulo || "MANUAL",
      ciclo: ciclo ? JSON.stringify(ciclo) : undefined
    };

    if (senha && senha.trim() !== '') {
      updateData.senhaHash = await bcrypt.hash(senha, 10);
    }

    if (faixasComissao && Array.isArray(faixasComissao)) {
      updateData.faixasComissao = {
        deleteMany: {},
        create: faixasComissao.map(f => ({
          valorMin: parseFloat(f.valorMin) || 0.0,
          valorMax: parseFloat(f.valorMax) || 0.0,
          percentual: parseFloat(f.percentual) || 0.0,
          lojaId: req.lojaId
        }))
      };
    }

    const revendedoraAtualizada = await prisma.usuario.update({
      where: { id },
      data: updateData,
      include: {
        faixasComissao: true
      }
    });
    res.json(revendedoraAtualizada);
  } catch (error) {
    console.error("Erro detalhado ao atualizar dados da revendedora:", error);
    res.status(500).json({ error: `Erro ao atualizar dados da revendedora: ${error.message}` });
  }
});

// Regenerar PIN e Senha da Revendedora (Admin)
app.put('/api/revendedoras/:id/reset-pin', autenticarJWT, autorizarRole(['Manager', 'SuperAdmin']), identificarLoja, async (req, res) => {
  const { id } = req.params;

  try {
    const usuario = await prisma.usuario.findFirst({
      where: { id, role: 'Consultant', lojaId: req.lojaId }
    });

    if (!usuario) {
      return res.status(404).json({ error: 'Revendedora não encontrada nesta loja.' });
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
app.delete('/api/revendedoras/:id', autenticarJWT, autorizarRole(['Manager', 'SuperAdmin']), identificarLoja, async (req, res) => {
  const { id } = req.params;
  try {
    const revendedora = await prisma.usuario.findFirst({
      where: { id, role: 'Consultant', lojaId: req.lojaId }
    });

    if (!revendedora) {
      return res.status(403).json({ error: 'Acesso negado ou revendedora não encontrada nesta loja.' });
    }

    await prisma.usuario.delete({
      where: { id }
    });
    res.json({ message: 'Revendedora excluída com sucesso!' });
  } catch (error) {
    console.error("Erro ao excluir revendedora:", error);
    res.status(500).json({ error: 'Erro ao excluir revendedora.' });
  }
});

// Excluir todas as Revendedoras (Admin)
app.delete('/api/revendedoras', autenticarJWT, autorizarRole(['Manager', 'SuperAdmin']), identificarLoja, async (req, res) => {
  try {
    await prisma.usuario.deleteMany({
      where: {
        role: 'Consultant',
        lojaId: req.lojaId
      }
    });
    res.json({ message: 'Todas as revendedoras foram excluídas com sucesso!' });
  } catch (error) {
    console.error("Erro ao excluir todas as revendedoras:", error);
    res.status(500).json({ error: 'Erro ao excluir todas as revendedoras.' });
  }
});

// Obter Maleta Própria (Revendedora logada)
app.get('/api/revendedoras/minha-maleta', autenticarJWT, identificarLoja, async (req, res) => {
  try {
    const consignados = await prisma.consignado.findMany({
      where: { usuarioId: req.user.id, lojaId: req.lojaId },
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

    // Busca faixas de comissão da revendedora
    let faixas = await prisma.faixaComissao.findMany({
      where: { usuarioId: req.user.id },
      orderBy: { valorMin: 'asc' }
    });

    // Fallback: busca faixas da loja se a revendedora não tiver faixas específicas
    if (faixas.length === 0) {
      faixas = await prisma.faixaComissao.findMany({
        where: { lojaId: req.lojaId, usuarioId: null },
        orderBy: { valorMin: 'asc' }
      });
    }

    // Busca configurações adicionais do usuário
    const usuarioConfig = await prisma.usuario.findUnique({
      where: { id: req.user.id },
      select: {
        tipoComissao: true,
        metaUnicaValor: true,
        metaUnicaBonus: true,
        metaUnicaTipoBonus: true,
        baseCalculo: true,
        regraPerda: true,
        limiteIsencaoPerda: true,
        periodoAcumulo: true
      }
    });

    res.json({
      consignado: maletaFormatada,
      faixasComissao: faixas,
      config: usuarioConfig
    });
  } catch (error) {
    console.error("Erro ao carregar maleta própria:", error);
    res.status(500).json({ error: 'Erro ao carregar dados da maleta.' });
  }
});

// ==========================================
// ROTAS DE CONSIGNAÇÕES E ACERTOS
// ==========================================

// Enviar Peças para a Maleta (Consignar - Admin)
app.post('/api/consignacoes', autenticarJWT, autorizarRole(['Manager', 'SuperAdmin']), identificarLoja, async (req, res) => {
  const { usuarioId, produtoId, quantidade } = req.body;
  if (!usuarioId || !produtoId || !quantidade || quantidade <= 0) {
    return res.status(400).json({ error: 'Dados incompletos para consignação.' });
  }

  try {
    const produto = await prisma.produto.findFirst({ where: { id: produtoId, lojaId: req.lojaId } });
    if (!produto) {
      return res.status(404).json({ error: 'Produto não encontrado nesta loja.' });
    }
    if (produto.quantidade < quantidade) {
      return res.status(400).json({ error: 'Estoque central insuficiente para esta semijoia.' });
    }

    const revendedora = await prisma.usuario.findFirst({ where: { id: usuarioId, role: 'Consultant', lojaId: req.lojaId } });
    if (!revendedora) {
      return res.status(404).json({ error: 'Revendedora não encontrada nesta loja.' });
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
    const consignadoExistente = await prisma.consignado.findFirst({
      where: {
        usuarioId,
        produtoId,
        lojaId: req.lojaId
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
          precoVenda: precoVendaCalculado,
          lojaId: req.lojaId
        }
      });
    }

    const nomeRevendedora = revendedora.nome;
    registrarLog(req, "CONSIGNACAO_CRIAR", `Consignou ${quantidade} unidades do produto ${produto.nome} (${produto.codigo}) para a revendedora ${nomeRevendedora}.`);

    // Dispara mensagem automática de consignação para a revendedora (Opção A)
    try {
      if (revendedora.whatsapp && revendedora.whatsapp.trim() !== '') {
        const msgConsignar = `Olá, *${revendedora.nome}*! ✨\nNovas semijoias foram adicionadas à sua maleta consignada pela administradora!\n\n*Novas Peças Recebidas:*\n- Produto: ${produto.nome} (${produto.codigo})\n- Quantidade: ${quantidade} unid.\n- Preço de venda sugerido: R$ ${precoVendaCalculado.toFixed(2).replace('.', ',')}\n- Valor total adicionado: R$ ${(precoVendaCalculado * quantidade).toFixed(2).replace('.', ',')}\n\nBoas vendas! Sucesso! 💎💼`;
        
        await prisma.mensagemWhatsapp.create({
          data: {
            numero: revendedora.whatsapp,
            mensagem: msgConsignar,
            tipo: 'CONSIGNACAO_ENTREGA',
            status: 'PENDENTE',
            lojaId: req.lojaId
          }
        });
      }
    } catch (wsErr) {
      console.error("Erro ao agendar WhatsApp de consignacao (Opcao A):", wsErr);
    }

    res.json(consignacao);
  } catch (error) {
    console.error('Erro ao consignar:', error);
    res.status(500).json({ error: 'Erro ao registrar consignação.' });
  }
});

// Finalizar Acerto de Contas (Admin)
app.post('/api/acertos', autenticarJWT, autorizarRole(['Manager', 'SuperAdmin']), identificarLoja, async (req, res) => {
  // itensAcerto: [{ produtoId, quantidadeVendida, quantidadeDevolvida, quantidadePerdida, quantidadeDefeito }]
  const { usuarioId, itensAcerto, formaPagamento } = req.body;

  if (!usuarioId || !itensAcerto || itensAcerto.length === 0) {
    return res.status(400).json({ error: 'Falta dados para o fechamento.' });
  }

  try {
    const revendedora = await prisma.usuario.findFirst({
      where: { id: usuarioId, role: 'Consultant', lojaId: req.lojaId },
      include: {
        faixasComissao: true,
        loja: {
          include: {
            faixasComissao: true
          }
        }
      }
    });
    if (!revendedora) return res.status(404).json({ error: 'Revendedora não encontrada nesta loja.' });

    let faturamentoBruto = 0;
    let totalConsignada = 0;
    let totalVendida = 0;
    let totalDevolvida = 0;
    let totalPerdida = 0;
    let totalDefeito = 0;
    let valorDescontoPerda = 0;
    let lostPiecesCounter = 0;

    for (const item of itensAcerto) {
      const consignado = await prisma.consignado.findFirst({
        where: {
          usuarioId,
          produtoId: item.produtoId,
          lojaId: req.lojaId
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

        // Valor das perdas: calcula com base na regra de perda personalizada da revendedora
        let itemPerdaValor = 0;
        if (qtdPerdida > 0) {
          let custoLiquido = 0;
          if (revendedora.regraPerda === 'VALOR_CUSTO') {
            const produto = await prisma.produto.findUnique({ where: { id: item.produtoId } });
            custoLiquido = produto ? (produto.custoLiquido || 0) : 0;
          }

          for (let i = 0; i < qtdPerdida; i++) {
            lostPiecesCounter++;
            if (revendedora.regraPerda === 'ISENTO' && lostPiecesCounter <= (revendedora.limiteIsencaoPerda || 0)) {
              itemPerdaValor += 0;
            } else if (revendedora.regraPerda === 'VALOR_CUSTO') {
              itemPerdaValor += custoLiquido;
            } else {
              itemPerdaValor += consignado.precoVenda;
            }
          }
        }
        valorDescontoPerda += itemPerdaValor;

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

    // 1. Base de cálculo da comissão: Bruto vs Líquido
    const valorBaseComissao = (revendedora.baseCalculo === 'LIQUIDO')
      ? Math.max(0, faturamentoBruto - valorDescontoPerda)
      : faturamentoBruto;

    // 2. Determinação da comissão e bônus conforme o tipo de comissão
    let percentualComissao = revendedora.comissao;
    let comissaoBruta = 0;

    // Volume de faturamento para fins de enquadramento de faixa ou meta
    let faturamentoVolumeParaFaixa = faturamentoBruto;
    if (revendedora.periodoAcumulo === 'MENSAL') {
      const agora = new Date();
      const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1, 0, 0, 0, 0);
      const vendasMes = await prisma.vendaRevendedora.findMany({
        where: {
          usuarioId,
          lojaId: req.lojaId,
          data: {
            gte: inicioMes
          }
        }
      });
      faturamentoVolumeParaFaixa = vendasMes.reduce((acc, v) => acc + (v.precoVenda * v.quantidade), 0);
      // Garante que inclua o faturamento do acerto atual se alguma venda ainda não tiver sido salva
      if (faturamentoVolumeParaFaixa < faturamentoBruto) {
        faturamentoVolumeParaFaixa = faturamentoBruto;
      }
    }

    if (revendedora.tipoComissao === 'PROGRESSIVA') {
      const faixas = (revendedora.faixasComissao && revendedora.faixasComissao.length > 0)
        ? revendedora.faixasComissao
        : (revendedora.loja && revendedora.loja.faixasComissao ? revendedora.loja.faixasComissao : []);
      const faixa = encontrarFaixaComissao(faturamentoVolumeParaFaixa, faixas);
      percentualComissao = faixa ? faixa.percentual : revendedora.comissao;
      comissaoBruta = valorBaseComissao * (percentualComissao / 100);
    } else if (revendedora.tipoComissao === 'META_UNICA') {
      const atingiuMeta = faturamentoVolumeParaFaixa >= (revendedora.metaUnicaValor || 0);
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

    const comissaoPaga = Math.max(0, comissaoBruta - valorDescontoPerda);
    const liquidoConectaJoias = faturamentoBruto - comissaoPaga;
    const totalRetidoRev = parseFloat(req.body.totalRetidoRevendedora) || 0.0;
    const totalRecAdmin = parseFloat(req.body.totalRecebidoAdmin) || 0.0;
    const saldoFinal = comissaoPaga - totalRetidoRev;

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
        liquidoConectaJoias,
        formaPagamento: formaPagamento || "Pix",
        totalRetidoRevendedora: totalRetidoRev,
        totalRecebidoAdmin: totalRecAdmin,
        saldoFinalAcerto: saldoFinal,
        lojaId: req.lojaId
      }
    });

    // Enviar mensagem de WhatsApp ao realizar acerto de contas (criar na fila)
    const msgTexto = `Olá ${revendedora.nome}! Seu acerto de contas da Conecta Joias foi concluído com sucesso. Resumo do acerto: Faturamento Bruto: R$ ${faturamentoBruto.toFixed(2)} | Comissão Devida: R$ ${comissaoPaga.toFixed(2)} | Retido em Mãos: R$ ${totalRetidoRev.toFixed(2)} | Saldo Final: R$ ${Math.abs(saldoFinal).toFixed(2)} (${saldoFinal >= 0 ? 'A receber da Conecta Joias' : 'A repassar para a Conecta Joias'}). Obrigado pela parceria! ✨`;

    await prisma.mensagemWhatsapp.create({
      data: {
        numero: revendedora.whatsapp,
        mensagem: msgTexto,
        tipo: 'ACERTO',
        status: 'PENDENTE',
        lojaId: req.lojaId
      }
    });

    registrarLog(req, "ACERTO_CONCLUIR", `Concluiu acerto de contas com a revendedora ${revendedora.nome}. Pagamento: ${formaPagamento || "Pix"}. Vendido: ${totalVendida}, Devolvido: ${totalDevolvida}, Perda: ${totalPerdida}, Defeito: ${totalDefeito}. Faturamento Bruto: R$ ${faturamentoBruto.toFixed(2)}, Líquido Empresa: R$ ${liquidoConectaJoias.toFixed(2)}.`);

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
app.get('/api/acertos/historico', autenticarJWT, identificarLoja, async (req, res) => {
  try {
    let queryOptions = {
      where: { lojaId: req.lojaId },
      orderBy: { data: 'desc' }
    };

    // Revendedoras só veem o seu próprio histórico. Admins veem tudo.
    if (req.user.role === 'Consultant') {
      queryOptions.where.usuarioId = req.user.id;
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

app.post('/api/vendas-diretas', autenticarJWT, autorizarRole(['Manager', 'SuperAdmin']), identificarLoja, async (req, res) => {
  let { codigo, nome, preco, whatsappCliente, nomeCliente, clienteId, quantidade, produtoId, desconto, motivoDesconto, formaPagamento } = req.body;

  // Se veio produtoId e não veio codigo/nome, busca no estoque central
  if (produtoId && (!codigo || !nome)) {
    try {
      const prod = await prisma.produto.findFirst({ where: { id: produtoId, lojaId: req.lojaId } });
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

  if (clienteId) {
    try {
      const cliente = await prisma.cliente.findFirst({ where: { id: clienteId, lojaId: req.lojaId } });
      if (!cliente) {
        return res.status(403).json({ error: 'Cliente não encontrado nesta loja.' });
      }
    } catch (e) {
      console.error("Erro ao buscar cliente na venda direta:", e);
    }
  }

  const qtd = parseInt(quantidade) || 1;
  const descTotal = parseFloat(desconto) || 0.0;
  const descPorItem = descTotal / qtd;
  const motivo = motivoDesconto || null;
  const forma = formaPagamento || "Pix";

  try {
    let ultimaVendaCreated = null;

    // Cria tantas vendas diretas quanto a quantidade especificada
    for (let i = 0; i < qtd; i++) {
      const venda = await prisma.vendaDireta.create({
        data: {
          codigo,
          nome,
          preco: parseFloat(preco) - descPorItem,
          whatsappCliente,
          nomeCliente,
          clienteId: clienteId || null,
          lojaId: req.lojaId,
          desconto: descPorItem,
          motivoDesconto: motivo,
          formaPagamento: forma
        }
      });
      ultimaVendaCreated = venda;
    }

    // Deduz a quantidade do estoque central se houver essa peça disponível
    const produto = await prisma.produto.findFirst({ where: { codigo, lojaId: req.lojaId } });
    if (produto) {
      const novaQtd = Math.max(0, produto.quantidade - qtd);
      await prisma.produto.update({
        where: { id: produto.id },
        data: { quantidade: novaQtd }
      });
    }

    res.status(201).json(ultimaVendaCreated);
  } catch (error) {
    console.error("Erro ao registrar venda direta:", error);
    res.status(500).json({ error: 'Erro ao registrar venda direta.' });
  }
});

app.get('/api/vendas-diretas', autenticarJWT, autorizarRole(['Manager', 'SuperAdmin']), identificarLoja, async (req, res) => {
  try {
    const vendas = await prisma.vendaDireta.findMany({
      where: { lojaId: req.lojaId },
      orderBy: { data: 'desc' }
    });
    res.json(vendas);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao obter vendas diretas.' });
  }
});

// Excluir uma venda (Admin)
app.delete('/api/vendas/:tipo/:id', autenticarJWT, autorizarRole(['Manager', 'SuperAdmin']), identificarLoja, async (req, res) => {
  const { tipo, id } = req.params;
  try {
    if (tipo === 'direta') {
      const venda = await prisma.vendaDireta.findFirst({ where: { id, lojaId: req.lojaId } });
      if (!venda) return res.status(403).json({ error: 'Venda direta não encontrada nesta loja.' });
      await prisma.vendaDireta.delete({ where: { id } });
    } else if (tipo === 'revendedora') {
      const venda = await prisma.vendaRevendedora.findFirst({ where: { id, lojaId: req.lojaId } });
      if (!venda) return res.status(403).json({ error: 'Venda de revendedora não encontrada nesta loja.' });
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
app.delete('/api/vendas', autenticarJWT, autorizarRole(['Manager', 'SuperAdmin']), identificarLoja, async (req, res) => {
  try {
    await prisma.$transaction([
      prisma.vendaDireta.deleteMany({ where: { lojaId: req.lojaId } }),
      prisma.vendaRevendedora.deleteMany({ where: { lojaId: req.lojaId } })
    ]);
    res.json({ message: 'Todo o histórico de vendas foi excluído com sucesso!' });
  } catch (error) {
    console.error("Erro ao excluir todo o histórico de vendas:", error);
    res.status(500).json({ error: 'Erro ao excluir todo o histórico de vendas.' });
  }
});

// Relatório DRE Simplificado (Admin)
app.get('/api/relatorios/dre', autenticarJWT, autorizarRole(['Manager', 'SuperAdmin']), identificarLoja, async (req, res) => {
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
        lojaId: req.lojaId,
        data: {
          gte: dataInicio,
          lte: dataFim
        }
      }
    });

    const acertos = await prisma.historicoAcerto.findMany({
      where: {
        lojaId: req.lojaId,
        data: {
          gte: dataInicio,
          lte: dataFim
        }
      }
    });

    const vendasRevendedora = await prisma.vendaRevendedora.findMany({
      where: {
        lojaId: req.lojaId,
        data: {
          gte: dataInicio,
          lte: dataFim
        }
      }
    });

    const produtos = await prisma.produto.findMany({
      where: { lojaId: req.lojaId }
    });
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

app.post('/api/vendas-revendedora', autenticarJWT, autorizarRole(['Consultant']), identificarLoja, async (req, res) => {
  const { produtoId, quantidade, desconto, motivoDesconto, formaPagamento, clienteId } = req.body;
  const usuarioId = req.user.id;

  if (!produtoId || !quantidade || quantidade <= 0) {
    return res.status(400).json({ error: 'Dados incompletos para registrar a venda.' });
  }

  try {
    // Busca o item consignado desta revendedora
    const consignado = await prisma.consignado.findFirst({
      where: {
        usuarioId,
        produtoId,
        lojaId: req.lojaId
      },
      include: { produto: true, usuario: true }
    });

    if (!consignado) {
      return res.status(404).json({ error: 'Este produto não está na sua maleta.' });
    }

    if (consignado.quantidadeConsignada < quantidade) {
      return res.status(400).json({ error: `Quantidade insuficiente na maleta. Você tem apenas ${consignado.quantidadeConsignada} unidade(s).` });
    }

    const descTotal = parseFloat(desconto) || 0.0;
    const descPorItem = descTotal / quantidade;
    const precoFinal = consignado.precoVenda - descPorItem;
    const comissaoValor = precoFinal * quantidade * (consignado.usuario.comissao / 100);

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
        precoVenda: precoFinal,
        comissaoValor,
        lojaId: req.lojaId,
        desconto: descPorItem,
        motivoDesconto: motivoDesconto || null,
        formaPagamento: formaPagamento || "Dinheiro",
        clienteId: clienteId || null
      }
    });

    // Cria notificação de venda para o Admin
    try {
      const valorTotal = precoFinal * quantidade;
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
            precoVenda: precoFinal,
            valorTotal,
            comissaoValor,
            data: venda.data
          }),
          lojaId: req.lojaId
        }
      });
    } catch (notifErr) {
      console.error("Erro ao gerar notificação de venda no backend:", notifErr);
    }

    // Dispara mensagens automáticas no WhatsApp para Administradora e Cliente (Etapa 3)
    try {
      const config = await prisma.configuracao.findFirst({ where: { lojaId: req.lojaId } });
      const whatsappAdmin = config?.whatsappAtendimento;
      
      let nomeCliente = 'Cliente Avulso';
      let telCliente = null;

      if (clienteId) {
        const cliente = await prisma.cliente.findUnique({ where: { id: clienteId } });
        if (cliente) {
          nomeCliente = cliente.nome;
          telCliente = cliente.whatsapp;
        }
      }

      const valorTotal = precoFinal * quantidade;

      // 1. WhatsApp para a Administradora (se configurado)
      if (whatsappAdmin && whatsappAdmin.trim() !== '') {
        const msgAdmin = `📢 *Nova Venda Registrada!*\nA consultora *${consignado.usuario.nome}* registrou uma venda no sistema.\n\n*Detalhes da Venda:*\n- Produto: ${consignado.produto.nome} (${consignado.produto.codigo})\n- Quantidade: ${quantidade} unid.\n- Preço unitário: R$ ${precoFinal.toFixed(2).replace('.', ',')}\n- Valor total: R$ ${valorTotal.toFixed(2).replace('.', ',')}\n- Forma de pagamento: ${formaPagamento || 'Dinheiro'}\n- Cliente: ${nomeCliente}`;

        await prisma.mensagemWhatsapp.create({
          data: {
            numero: whatsappAdmin,
            mensagem: msgAdmin,
            tipo: 'NOTIFICACAO_VENDA_ADMIN',
            status: 'PENDENTE',
            lojaId: req.lojaId
          }
        });
      }

      // 2. WhatsApp para o Cliente (somente se clienteId estiver cadastrado e tiver WhatsApp)
      if (clienteId && telCliente && telCliente.trim() !== '') {
        const msgCliente = `Olá, *${nomeCliente}*! ✨\nAgradecemos a sua compra com a nossa consultora *${consignado.usuario.nome}*!\n\n*Resumo da sua Compra:*\n- Produto: ${consignado.produto.nome}\n- Quantidade: ${quantidade} unid.\n- Valor total: R$ ${valorTotal.toFixed(2).replace('.', ',')}\n- Forma de pagamento: ${formaPagamento || 'Dinheiro'}\n\nQualquer dúvida, estamos à disposição! 💖`;

        await prisma.mensagemWhatsapp.create({
          data: {
            numero: telCliente,
            mensagem: msgCliente,
            tipo: 'NOTIFICACAO_VENDA_CLIENTE',
            status: 'PENDENTE',
            lojaId: req.lojaId
          }
        });
      }
    } catch (wsErr) {
      console.error("Erro ao agendar notificações de WhatsApp da venda:", wsErr);
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
app.get('/api/vendas-revendedora', autenticarJWT, identificarLoja, async (req, res) => {
  try {
    let where = { lojaId: req.lojaId };
    if (!['Manager', 'SuperAdmin'].includes(req.user.role)) {
      where.usuarioId = req.user.id;
    } else if (req.query.usuarioId) {
      const revendedora = await prisma.usuario.findFirst({
        where: { id: req.query.usuarioId, lojaId: req.lojaId }
      });
      if (!revendedora) {
        return res.status(403).json({ error: 'Usuário não encontrado nesta loja.' });
      }
      where.usuarioId = req.query.usuarioId;
    }

    // Se solicitado apenas pendentes e temos um usuarioId definido
    if (req.query.apenasPendentes === 'true' && where.usuarioId) {
      // Busca o último acerto deste usuário
      const ultimoAcerto = await prisma.historicoAcerto.findFirst({
        where: { usuarioId: where.usuarioId, lojaId: req.lojaId },
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

app.post('/api/importar', autenticarJWT, autorizarRole(['Manager', 'SuperAdmin']), identificarLoja, async (req, res) => {
  const { produtos, revendedoras, substituirTudo } = req.body;

  try {
    if (substituirTudo) {
      // Limpa todas as tabelas (exceto administradores) da loja atual
      await prisma.$transaction([
        prisma.consignado.deleteMany({ where: { lojaId: req.lojaId } }),
        prisma.historicoAcerto.deleteMany({ where: { lojaId: req.lojaId } }),
        prisma.vendaDireta.deleteMany({ where: { lojaId: req.lojaId } }),
        prisma.vendaRevendedora.deleteMany({ where: { lojaId: req.lojaId } }),
        prisma.produto.deleteMany({ where: { lojaId: req.lojaId } }),
        prisma.usuario.deleteMany({ where: { role: 'Consultant', lojaId: req.lojaId } })
      ]);
    }

    // Importa Produtos
    if (produtos && produtos.length > 0) {
      for (const p of produtos) {
        const existente = await prisma.produto.findFirst({ where: { codigo: p.codigo, lojaId: req.lojaId } });

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
              markup: parseFloat(p.markup) || 3.0,
              lojaId: req.lojaId
            }
          });
        }
      }
    }

    // Importa Revendedoras
    const novasRevendedorasSenhas = [];
    if (revendedoras && revendedoras.length > 0) {
      for (const r of revendedoras) {
        const emailTemporario = r.email || (r.nome.toLowerCase().replace(/\s+/g, '') + "_" + Math.floor(Math.random() * 1000) + "@conectajoias.com");

        let existente = await prisma.usuario.findFirst({
          where: {
            lojaId: req.lojaId,
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
              role: 'Consultant',
              whatsapp: r.whatsapp,
              comissao: parseFloat(r.comissao) || 30.0,
              lojaId: req.lojaId
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
            const prod = await prisma.produto.findFirst({ where: { codigo: c.codigo, lojaId: req.lojaId } });
            if (prod) {
              const consExistente = await prisma.consignado.findFirst({
                where: {
                  usuarioId: revendedoraId,
                  produtoId: prod.id,
                  lojaId: req.lojaId
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
                    precoVenda: parseFloat(c.precoVenda) || (prod.custoBruto + prod.custoBanho + prod.custoLiquido) * prod.markup,
                    lojaId: req.lojaId
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
app.get('/api/clientes', autenticarJWT, autorizarRole(['Consultant', 'Manager', 'SuperAdmin']), identificarLoja, async (req, res) => {
  try {
    let where = { lojaId: req.lojaId };
    // Consultoras só veem os clientes que cadastraram
    if (req.user.role === 'Consultant') {
      where.usuarioId = req.user.id;
    }
    const clientes = await prisma.cliente.findMany({
      where,
      orderBy: { nome: 'asc' }
    });
    res.json(clientes);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao listar clientes.' });
  }
});

// Criar Cliente
app.post('/api/clientes', autenticarJWT, autorizarRole(['Consultant', 'Manager', 'SuperAdmin']), identificarLoja, async (req, res) => {
  const { nome, whatsapp, dataNascimento, observacoes } = req.body;
  if (!nome || !whatsapp) {
    return res.status(400).json({ error: 'Nome e WhatsApp são obrigatórios.' });
  }

  const isConsultant = req.user.role === 'Consultant';
  const userFilter = isConsultant ? req.user.id : null;

  try {
    // Validar se o cliente já existe para este mesmo usuário (ou loja para admin)
    const existente = await prisma.cliente.findFirst({
      where: {
        lojaId: req.lojaId,
        whatsapp,
        usuarioId: userFilter
      }
    });

    if (existente) {
      return res.status(400).json({ error: 'Já existe uma cliente cadastrada com este WhatsApp.' });
    }

    const cliente = await prisma.cliente.create({
      data: {
        nome,
        whatsapp,
        dataNascimento: dataNascimento || null,
        observacoes: observacoes || null,
        lojaId: req.lojaId,
        usuarioId: userFilter
      }
    });
    res.status(201).json(cliente);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao cadastrar cliente.' });
  }
});

// Editar Cliente
app.put('/api/clientes/:id', autenticarJWT, autorizarRole(['Consultant', 'Manager', 'SuperAdmin']), identificarLoja, async (req, res) => {
  const { id } = req.params;
  const { nome, whatsapp, dataNascimento, observacoes } = req.body;

  let searchWhere = { id, lojaId: req.lojaId };
  if (req.user.role === 'Consultant') {
    searchWhere.usuarioId = req.user.id;
  }

  try {
    const cliente = await prisma.cliente.findFirst({ where: searchWhere });
    if (!cliente) {
      return res.status(403).json({ error: 'Acesso negado ou cliente não encontrada.' });
    }

    // Se mudou whatsapp, garante que não colide com outra cliente do mesmo usuário/loja
    if (whatsapp && whatsapp !== cliente.whatsapp) {
      const colide = await prisma.cliente.findFirst({
        where: {
          lojaId: req.lojaId,
          whatsapp,
          usuarioId: req.user.role === 'Consultant' ? req.user.id : null,
          id: { not: id }
        }
      });
      if (colide) {
        return res.status(400).json({ error: 'Já existe outra cliente cadastrada com este WhatsApp.' });
      }
    }

    const clienteAtualizado = await prisma.cliente.update({
      where: { id },
      data: { nome, whatsapp, dataNascimento: dataNascimento || null, observacoes: observacoes || null }
    });
    res.json(clienteAtualizado);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar cliente.' });
  }
});

// Excluir Cliente
app.delete('/api/clientes/:id', autenticarJWT, autorizarRole(['Consultant', 'Manager', 'SuperAdmin']), identificarLoja, async (req, res) => {
  const { id } = req.params;

  let searchWhere = { id, lojaId: req.lojaId };
  if (req.user.role === 'Consultant') {
    searchWhere.usuarioId = req.user.id;
  }

  try {
    const cliente = await prisma.cliente.findFirst({ where: searchWhere });
    if (!cliente) {
      return res.status(403).json({ error: 'Acesso negado ou cliente não encontrada.' });
    }

    await prisma.cliente.delete({ where: { id } });
    res.json({ message: 'Cliente removida com sucesso!' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao excluir cliente.' });
  }
});

// Excluir todas as clientes
app.delete('/api/clientes', autenticarJWT, autorizarRole(['Manager', 'SuperAdmin']), identificarLoja, async (req, res) => {
  try {
    await prisma.cliente.deleteMany({
      where: { lojaId: req.lojaId }
    });
    res.json({ message: 'Todas as clientes foram removidas com sucesso!' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao excluir todas as clientes.' });
  }
});

// ==========================================
// ROTAS DE NOTIFICAÇÕES (ADMIN)
// ==========================================

// Listar notificações não lidas
app.get('/api/notificacoes', autenticarJWT, autorizarRole(['Consultant', 'Manager', 'SuperAdmin']), identificarLoja, async (req, res) => {
  try {
    const notificacoes = await prisma.notificacao.findMany({
      where: { lida: false, lojaId: req.lojaId },
      orderBy: { createdAt: 'desc' }
    });
    res.json(notificacoes);
  } catch (error) {
    console.error('Erro ao buscar notificações:', error);
    res.status(500).json({ error: 'Erro ao buscar notificações.' });
  }
});

// Marcar notificações como lidas
app.put('/api/notificacoes/ler', autenticarJWT, autorizarRole(['Consultant', 'Manager', 'SuperAdmin']), identificarLoja, async (req, res) => {
  const { ids } = req.body;
  try {
    if (ids && Array.isArray(ids) && ids.length > 0) {
      await prisma.notificacao.updateMany({
        where: { id: { in: ids }, lojaId: req.lojaId },
        data: { lida: true }
      });
    } else {
      await prisma.notificacao.updateMany({
        where: { lida: false, lojaId: req.lojaId },
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
// ROTAS DE CONFIGURAÇÃO (WHITE-LABEL)
// ==========================================

// GET /api/config - Buscar configuração pública da loja
app.get('/api/config', autenticarJWTOpcional, identificarLoja, async (req, res) => {
  try {
    let config = await prisma.configuracao.findFirst({
      where: { lojaId: req.lojaId }
    });
    if (!config) {
      config = await prisma.configuracao.create({
        data: {
          lojaId: req.lojaId,
          nomeEmpresa: 'Conecta Joias',
          logoUrl: '',
          corPrimaria: '#d4af37',
          corSecundaria: '#111111',
          bgPrimary: '#0a0a0a',
          bgCard: '#121212',
          whatsappAtendimento: '',
          temaPref: 'Escuro',
          segmento: 'Semijoias',
          estiloLoja: 'Premium',
          onboardingCompleto: false
        }
      });
    }
    res.json(config);
  } catch (error) {
    console.error('Erro ao buscar configuração:', error);
    res.status(500).json({ error: 'Erro ao carregar configurações da loja.' });
  }
});

// PUT /api/config - Atualizar configuração da loja (Somente Admin)
app.put('/api/config', autenticarJWT, autorizarRole(['Manager', 'SuperAdmin']), identificarLoja, async (req, res) => {
  const { nomeEmpresa, logoUrl, corPrimaria, corSecundaria, bgPrimary, bgCard, whatsappAtendimento, temaPref, segmento, estiloLoja, instagram, tiktok, site, onboardingCompleto } = req.body;
  try {
    let config = await prisma.configuracao.findFirst({
      where: { lojaId: req.lojaId }
    });
    if (!config) {
      config = await prisma.configuracao.create({
        data: {
          lojaId: req.lojaId,
          nomeEmpresa: nomeEmpresa || 'Conecta Joias',
          logoUrl: logoUrl || '',
          corPrimaria: corPrimaria || '#d4af37',
          corSecundaria: corSecundaria || '#111111',
          bgPrimary: bgPrimary || '#0a0a0a',
          bgCard: bgCard || '#121212',
          whatsappAtendimento: whatsappAtendimento || '',
          temaPref: temaPref || 'Escuro',
          segmento: segmento || 'Semijoias',
          estiloLoja: estiloLoja || 'Premium',
          onboardingCompleto: onboardingCompleto !== undefined ? onboardingCompleto : false
        }
      });
    } else {
      config = await prisma.configuracao.update({
        where: { id: config.id },
        data: {
          nomeEmpresa: nomeEmpresa !== undefined ? nomeEmpresa : config.nomeEmpresa,
          logoUrl: logoUrl !== undefined ? logoUrl : config.logoUrl,
          corPrimaria: corPrimaria !== undefined ? corPrimaria : config.corPrimaria,
          corSecundaria: corSecundaria !== undefined ? corSecundaria : config.corSecundaria,
          bgPrimary: bgPrimary !== undefined ? bgPrimary : config.bgPrimary,
          bgCard: bgCard !== undefined ? bgCard : config.bgCard,
          whatsappAtendimento: whatsappAtendimento !== undefined ? whatsappAtendimento : config.whatsappAtendimento,
          temaPref: temaPref !== undefined ? temaPref : config.temaPref,
          segmento: segmento !== undefined ? segmento : config.segmento,
          estiloLoja: estiloLoja !== undefined ? estiloLoja : config.estiloLoja,
          instagram: instagram !== undefined ? instagram : (config.instagram || ''),
          tiktok: tiktok !== undefined ? tiktok : (config.tiktok || ''),
          site: site !== undefined ? site : (config.site || ''),
          onboardingCompleto: onboardingCompleto !== undefined ? onboardingCompleto : config.onboardingCompleto
        }
      });
    }
    await registrarLog(req, 'Atualizar Configurações', `Configuração alterada: ${JSON.stringify(config)}`);
    res.json(config);
  } catch (error) {
    console.error('Erro ao atualizar configuração:', error);
    res.status(500).json({ error: 'Erro ao atualizar configurações da loja.' });
  }
});

// ==========================================
// ROTAS EXCLUSIVAS DO SuperAdmin (Gestão Global de Lojas)
// ==========================================

// Listar todas as lojas (apenas SuperAdmin)
app.get('/api/admin/lojas', autenticarJWT, autorizarRole(['SuperAdmin']), async (req, res) => {
  try {
    const lojas = await prisma.loja.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { usuarios: true, produtos: true }
        }
      }
    });
    res.json(lojas);
  } catch (error) {
    console.error('Erro ao listar lojas:', error);
    res.status(500).json({ error: 'Erro ao listar lojas.' });
  }
});

// Criar nova loja (apenas SuperAdmin)
app.post('/api/admin/lojas', autenticarJWT, autorizarRole(['SuperAdmin']), async (req, res) => {
  const { nome, cnpj } = req.body;
  if (!nome) {
    return res.status(400).json({ error: 'O nome da loja é obrigatório.' });
  }
  try {
    const novaLoja = await prisma.loja.create({
      data: { nome, cnpj: cnpj || null }
    });
    // Cria a configuração padrão da nova loja
    await prisma.configuracao.create({
      data: {
        lojaId: novaLoja.id,
        nomeEmpresa: nome,
        logoUrl: '',
        corPrimaria: '#d4af37',
        corSecundaria: '#111111',
        bgPrimary: '#0a0a0a',
        bgCard: '#121212',
      }
    });
    await registrarLog(req, 'CRIAR_LOJA', `SuperAdmin criou a loja: ${nome} (ID: ${novaLoja.id})`);
    res.status(201).json(novaLoja);
  } catch (error) {
    console.error('Erro ao criar loja:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Já existe uma loja com este CNPJ.' });
    }
    res.status(500).json({ error: 'Erro ao criar loja.' });
  }
});

// Obter detalhes de uma loja específica (SuperAdmin)
app.get('/api/admin/lojas/:id', autenticarJWT, autorizarRole(['SuperAdmin']), async (req, res) => {
  const { id } = req.params;
  try {
    const loja = await prisma.loja.findUnique({
      where: { id },
      include: {
        configuracao: true,
        _count: { select: { usuarios: true, produtos: true, vendasDireta: true } }
      }
    });
    if (!loja) {
      return res.status(404).json({ error: 'Loja não encontrada.' });
    }
    res.json(loja);
  } catch (error) {
    console.error('Erro ao buscar loja:', error);
    res.status(500).json({ error: 'Erro ao buscar loja.' });
  }
});


// ==========================================
// NOVAS ROTAS - GESTÃO DE REVENDEDORAS E PAGAMENTOS
// ==========================================

// 1. Onboarding público de revendedora (Sem autenticação)
app.post('/api/public/onboarding', signupLimiter, uploadDocs.fields([
  { name: 'rgFile', maxCount: 1 },
  { name: 'cpfFile', maxCount: 1 },
  { name: 'enderecoFile', maxCount: 1 }
]), async (req, res) => {
  const { nome, email, whatsapp, cpf, rg, endereco, vendedoraPrincipal, comoConheceu, experienciaVendas, comentarios, lojaId } = req.body;

  if (!nome || !email || !whatsapp || !cpf) {
    return res.status(400).json({ error: 'Campos obrigatórios ausentes: nome, e-mail, whatsapp e CPF.' });
  }

  const lid = lojaId || 'default-loja';

  try {
    // Verifica e-mail ou cpf existente
    const usuarioExiste = await prisma.usuario.findFirst({
      where: {
        OR: [
          { email },
          { pin: whatsapp.replace(/\D/g, '').slice(-4) }
        ]
      }
    });

    if (usuarioExiste) {
      return res.status(400).json({ error: 'Este e-mail ou um número com final de WhatsApp semelhante já possui cadastro.' });
    }

    const pin = await gerarPinUnico();
    const senhaProvisoria = Math.floor(100000 + Math.random() * 900000).toString(); // senha provisória de 6 dígitos
    const senhaHash = await bcrypt.hash(senhaProvisoria, 10);

    const novoUsuario = await prisma.usuario.create({
      data: {
        nome,
        email,
        whatsapp,
        pin,
        senhaHash,
        role: 'Consultant',
        documentoCpf: cpf,
        documentoRg: rg,
        documentoEndereco: endereco,
        lojaId: lid,
        respostaOnboarding: {
          create: {
            vendedoraPrincipal,
            comoConheceu,
            experienciaVendas,
            comentarios
          }
        }
      }
    });

    // Salvar caminhos dos arquivos do upload no cofre virtual
    const arquivos = req.files;
    if (arquivos) {
      const docsToCreate = [];
      if (arquivos.rgFile && arquivos.rgFile[0]) {
        docsToCreate.push({
          tipo: 'RG',
          nomeArquivo: arquivos.rgFile[0].originalname,
          caminhoUrl: `/uploads/documentos/${arquivos.rgFile[0].filename}`
        });
      }
      if (arquivos.cpfFile && arquivos.cpfFile[0]) {
        docsToCreate.push({
          tipo: 'CPF',
          nomeArquivo: arquivos.cpfFile[0].originalname,
          caminhoUrl: `/uploads/documentos/${arquivos.cpfFile[0].filename}`
        });
      }
      if (arquivos.enderecoFile && arquivos.enderecoFile[0]) {
        docsToCreate.push({
          tipo: 'COMPROVANTE_RESIDENCIA',
          nomeArquivo: arquivos.enderecoFile[0].originalname,
          caminhoUrl: `/uploads/documentos/${arquivos.enderecoFile[0].filename}`
        });
      }

      if (docsToCreate.length > 0) {
        for (const doc of docsToCreate) {
          await prisma.documentoUsuario.create({
            data: {
              usuarioId: novoUsuario.id,
              tipo: doc.tipo,
              nomeArquivo: doc.nomeArquivo,
              caminhoUrl: doc.caminhoUrl
            }
          });
        }
      }
    }

    // Criar mensagem de boas-vindas na fila do WhatsApp
    const mensagemTexto = `Olá ${nome}, seja muito bem-vinda à Conecta Joias! ✨ Seu cadastro de Consultora foi realizado com sucesso. Aqui estão suas credenciais para entrar no portal: Login (PIN): ${pin} | Senha Temporária: ${senhaProvisoria} | Link do portal: ${frontendUrl}/manager.html`;

    await prisma.mensagemWhatsapp.create({
      data: {
        numero: whatsapp,
        mensagem: mensagemTexto,
        tipo: 'BOAS_VINDAS',
        status: 'PENDENTE',
        lojaId: lid
      }
    });

    // Log de auditoria
    await prisma.logAcao.create({
      data: {
        usuarioId: novoUsuario.id,
        usuarioNome: nome,
        acao: 'VENDEDORA_ONBOARDING',
        detalhes: `Revendedora preencheu o questionário e cadastrou-se pelo link de onboarding. PIN: ${pin}`
      }
    });

    res.status(201).json({
      message: 'Onboarding realizado com sucesso!',
      pin,
      senha: senhaProvisoria
    });

  } catch (error) {
    console.error('Erro no onboarding público:', error);
    res.status(500).json({ error: `Erro no processamento do cadastro: ${error.message}` });
  }
});

// 2. Listar documentos do Cofre Virtual de uma revendedora específica (Admin)
app.get('/api/usuarios/:id/documentos', autenticarJWT, autorizarRole(['Manager', 'SuperAdmin']), async (req, res) => {
  const { id } = req.params;
  try {
    const documentos = await prisma.documentoUsuario.findMany({
      where: { usuarioId: id }
    });
    const respostaOnb = await prisma.respostaOnboarding.findUnique({
      where: { usuarioId: id }
    });
    res.json({ documentos, respostaOnboarding: respostaOnb });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao listar documentos.' });
  }
});

// 3. Criar link de pagamento (Revendedora ou Admin)
app.post('/api/pagamentos/link', autenticarJWT, identificarLoja, async (req, res) => {
  const { clienteId, valor, formaEnvio, vendaId } = req.body;
  if (!valor || !formaEnvio) {
    return res.status(400).json({ error: 'Valor e Forma de Envio (PIX, BOLETO, CARTAO) são obrigatórios.' });
  }

  try {
    const linkId = Math.random().toString(36).substring(2, 15);
    const linkSimulado = `${frontendUrl}/pagamento.html?id=${linkId}`;

    const link = await prisma.linkPagamento.create({
      data: {
        id: linkId,
        usuarioId: req.user.id,
        clienteId: clienteId || null,
        valor: parseFloat(valor),
        formaEnvio,
        status: 'PENDENTE',
        linkSimulado,
        vendaId: vendaId || null
      }
    });

    // Se houver uma vendaId, vamos atualizar a venda para apontar para o link e marcar como não paga temporariamente
    if (vendaId) {
      await prisma.vendaRevendedora.updateMany({
        where: { id: vendaId },
        data: {
          pago: false,
          linkPagamentoId: linkId
        }
      });
    }

    res.status(201).json(link);
  } catch (error) {
    console.error('Erro ao gerar link de pagamento:', error);
    res.status(500).json({ error: 'Erro ao gerar link de pagamento.' });
  }
});

// Buscar detalhes de um link de pagamento (Público - sem JWT para o cliente final)
app.get('/api/public/pagamento/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const link = await prisma.linkPagamento.findUnique({
      where: { id },
      include: {
        usuario: { select: { nome: true } },
        cliente: { select: { nome: true, whatsapp: true } }
      }
    });
    if (!link) {
      return res.status(404).json({ error: 'Link de pagamento não encontrado.' });
    }

    const responseData = { ...link };

    // Se já tiver uma transação ASAAS e for PIX ou BOLETO e ainda estiver pendente,
    // busca os dados mais atualizados de QR Code/Linha digitável
    if (link.asaasPaymentId && link.status === 'PENDENTE') {
      try {
        if (link.formaEnvio === 'PIX') {
          const pixInfo = await obterQrCodePix(link.asaasPaymentId);
          responseData.pixQrCode = pixInfo.encodedImage;
          responseData.pixCopiaCola = pixInfo.payload;
        } else if (link.formaEnvio === 'BOLETO') {
          const boletoInfo = await obterCodigoBarrasBoleto(link.asaasPaymentId);
          responseData.boletoLinhaDigitavel = boletoInfo.identificationField;
          responseData.boletoCodigoBarras = boletoInfo.barCode;
        }
      } catch (err) {
        console.error('Erro ao recuperar dados dinâmicos do ASAAS:', err.message);
      }
    }

    res.json(responseData);
  } catch (error) {
    console.error('Erro ao buscar link de pagamento:', error);
    res.status(500).json({ error: 'Erro ao buscar link de pagamento.' });
  }
});

// Processar pagamento real via ASAAS (Público)
app.post('/api/public/pagamento/:id/processar', paymentLimiter, async (req, res) => {
  const { id } = req.params;
  const {
    formaEnvio,
    clienteNome,
    clienteCpfCnpj,
    clienteEmail,
    clienteWhatsapp,
    cartaoDados,
    enderecoDados
  } = req.body;

  if (!formaEnvio) {
    return res.status(400).json({ error: 'Forma de envio/pagamento é obrigatória.' });
  }

  try {
    const link = await prisma.linkPagamento.findUnique({
      where: { id },
      include: {
        cliente: true
      }
    });

    if (!link) {
      return res.status(404).json({ error: 'Link de pagamento não encontrado.' });
    }

    if (link.status === 'PAGO') {
      return res.status(400).json({ error: 'Este link de pagamento já foi pago.' });
    }

    // Chama o serviço ASAAS para criar a cobrança
    const cobranca = await criarCobranca({
      clienteNome: clienteNome || (link.cliente ? link.cliente.nome : 'Cliente Conecta Joias'),
      clienteCpfCnpj,
      clienteEmail,
      clienteWhatsapp: clienteWhatsapp || (link.cliente ? link.cliente.whatsapp : ''),
      valor: link.valor,
      formaEnvio,
      vendaId: link.vendaId,
      linkId: link.id,
      cartaoDados,
      enderecoDados
    });

    // Se for pagamento por Cartão e a transação já foi confirmada
    let statusNovo = 'PENDENTE';
    if (cobranca.status === 'RECEIVED' || cobranca.status === 'CONFIRMED') {
      statusNovo = 'PAGO';
    }

    // Atualiza nosso link local com a referência do ASAAS
    const linkAtualizado = await prisma.linkPagamento.update({
      where: { id },
      data: {
        formaEnvio,
        status: statusNovo,
        asaasPaymentId: cobranca.id,
        asaasInvoiceUrl: cobranca.bankSlipUrl || cobranca.invoiceUrl || null
      }
    });

    // Se for Cartão e deu certo, faz a baixa automática agora
    if (statusNovo === 'PAGO' && link.vendaId) {
      await prisma.vendaRevendedora.updateMany({
        where: { id: link.vendaId },
        data: {
          pago: true,
          canalPagamento: 'LINK_PAGO_ADMIN'
        }
      });

      // Gravar log
      await prisma.logAcao.create({
        data: {
          usuarioId: link.usuarioId,
          acao: 'VENDA_BAIXA_AUTOMATICA',
          detalhes: `Baixa automática executada via webhook/cartão para a venda ${link.vendaId} após cobrança ASAAS: ${cobranca.id}.`
        }
      });
    }

    // Prepara resposta com dados específicos de PIX ou Boleto
    const resposta = {
      status: statusNovo,
      asaasPaymentId: cobranca.id,
      invoiceUrl: cobranca.bankSlipUrl || cobranca.invoiceUrl || null
    };

    if (formaEnvio === 'PIX') {
      const pixInfo = await obterQrCodePix(cobranca.id);
      resposta.pixQrCode = pixInfo.encodedImage;
      resposta.pixCopiaCola = pixInfo.payload;
    } else if (formaEnvio === 'BOLETO') {
      const boletoInfo = await obterCodigoBarrasBoleto(cobranca.id);
      resposta.boletoLinhaDigitavel = boletoInfo.identificationField;
      resposta.boletoCodigoBarras = boletoInfo.barCode;
    }

    res.json(resposta);
  } catch (error) {
    console.error('Erro ao processar pagamento no backend:', error.message);
    res.status(500).json({ error: error.message || 'Erro ao processar pagamento.' });
  }
});

// Listar links de pagamento da revendedora
app.get('/api/pagamentos/link', autenticarJWT, async (req, res) => {
  try {
    const links = await prisma.linkPagamento.findMany({
      where: { usuarioId: req.user.id },
      include: {
        cliente: { select: { nome: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(links);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar links de pagamento.' });
  }
});

// Simular confirmação de pagamento (Webhook / Baixa Automática)
app.post('/api/public/pagamento/:id/confirmar', async (req, res) => {
  const { id } = req.params;
  try {
    const link = await prisma.linkPagamento.findUnique({ where: { id } });
    if (!link) {
      return res.status(404).json({ error: 'Link de pagamento não encontrado.' });
    }

    if (link.status === 'PAGO') {
      return res.json({ message: 'Este link já foi pago anteriormente.', link });
    }

    // Atualiza o link para PAGO
    const linkAtualizado = await prisma.linkPagamento.update({
      where: { id },
      data: { status: 'PAGO' }
    });

    // Se estiver associado a uma venda, dá a baixa automática
    if (link.vendaId) {
      await prisma.vendaRevendedora.updateMany({
        where: { id: link.vendaId },
        data: {
          pago: true,
          canalPagamento: 'LINK_PAGO_ADMIN'
        }
      });

      // Registrar logs de auditoria
      await prisma.logAcao.create({
        data: {
          usuarioId: link.usuarioId,
          acao: 'VENDA_BAIXA_AUTOMATICA',
          detalhes: `Baixa automática executada para a venda ${link.vendaId} após compensação do link de pagamento (${link.formaEnvio}) de R$ ${link.valor.toFixed(2)}.`
        }
      });
    }

    res.json({ message: 'Pagamento confirmado e baixa automática realizada!', link: linkAtualizado });
  } catch (error) {
    console.error('Erro ao confirmar pagamento:', error);
    res.status(500).json({ error: 'Erro ao processar a confirmação de pagamento.' });
  }
});

// Webhook público para receber eventos de pagamento do ASAAS
app.post('/api/webhooks/asaas', async (req, res) => {
  const { event, payment } = req.body;

  if (!event || !payment) {
    return res.status(400).json({ error: 'Payload do webhook inválido.' });
  }

  console.log(`[Webhook ASAAS] Evento recebido: ${event} para o pagamento ${payment.id}`);

  // Eventos de sucesso de pagamento
  if (event === 'PAYMENT_RECEIVED' || event === 'PAYMENT_CONFIRMED') {
    try {
      // 1. Localizar o link correspondente
      const linkId = payment.externalReference;
      
      let link = null;
      if (linkId) {
        link = await prisma.linkPagamento.findUnique({ where: { id: linkId } });
      }

      // Fallback: busca por asaasPaymentId
      if (!link) {
        link = await prisma.linkPagamento.findFirst({
          where: { asaasPaymentId: payment.id }
        });
      }

      if (!link) {
        console.warn(`[Webhook ASAAS] Link de pagamento correspondente não foi encontrado para o pagamento ${payment.id}`);
        return res.status(200).json({ message: 'Evento recebido, mas nenhum link local correspondente foi encontrado.' });
      }

      if (link.status === 'PAGO') {
        return res.status(200).json({ message: 'Este pagamento já havia sido baixado anteriormente.' });
      }

      // 2. Atualizar o status do link para PAGO
      await prisma.linkPagamento.update({
        where: { id: link.id },
        data: { status: 'PAGO' }
      });

      // 3. Dar baixa automática na venda
      if (link.vendaId) {
        await prisma.vendaRevendedora.updateMany({
          where: { id: link.vendaId },
          data: {
            pago: true,
            canalPagamento: 'LINK_PAGO_ADMIN'
          }
        });

        // Registrar log de auditoria
        await prisma.logAcao.create({
          data: {
            usuarioId: link.usuarioId,
            acao: 'VENDA_BAIXA_AUTOMATICA_WEBHOOK',
            detalhes: `Baixa automática via Webhook ASAAS (${event}) executada para a venda ${link.vendaId} após recebimento de R$ ${payment.value.toFixed(2)}.`
          }
        });

        // Criar notificação para o gestor
        const usuario = await prisma.usuario.findUnique({
          where: { id: link.usuarioId },
          select: { lojaId: true }
        });

        const lojaId = usuario?.lojaId || 'default-loja';

        await prisma.notificacao.create({
          data: {
            lojaId,
            tipo: 'venda_revendedora',
            mensagem: `Venda ${link.vendaId} paga automaticamente via link (${payment.billingType}).`,
            detalhes: JSON.stringify({
              linkId: link.id,
              vendaId: link.vendaId,
              valor: payment.value,
              netValue: payment.netValue,
              asaasPaymentId: payment.id
            })
          }
        });
      }

      return res.json({ success: true, message: 'Baixa processada com sucesso!' });
    } catch (error) {
      console.error('[Webhook ASAAS] Erro ao processar baixa de pagamento:', error);
      return res.status(500).json({ error: 'Erro interno ao processar baixa de pagamento no webhook.' });
    }
  }

  // Eventos de falha de pagamento (Opção C)
  if (event === 'PAYMENT_REFUSED' || event === 'PAYMENT_OVERDUE') {
    try {
      const linkId = payment.externalReference;
      let link = linkId ? await prisma.linkPagamento.findUnique({ where: { id: linkId } }) : null;
      if (!link) {
        link = await prisma.linkPagamento.findFirst({
          where: { asaasPaymentId: payment.id }
        });
      }

      if (link) {
        const revendedora = await prisma.usuario.findUnique({
          where: { id: link.usuarioId }
        });

        if (revendedora && revendedora.whatsapp && revendedora.whatsapp.trim() !== '') {
          const motivo = event === 'PAYMENT_REFUSED' ? 'Transação Recusada (Cartão de Crédito)' : 'Link de pagamento expirado (Pix/Boleto)';
          
          let nomeCli = 'Cliente Avulso';
          if (link.clienteId) {
            const cliente = await prisma.cliente.findUnique({ where: { id: link.clienteId } });
            if (cliente) {
              nomeCli = cliente.nome;
            }
          }

          const msgRecusa = `Olá, *${revendedora.nome}*! ⚠️\nO link de pagamento enviado para o cliente *${nomeCli}* no valor de R$ ${link.valor.toFixed(2).replace('.', ',')} não pôde ser concluído.\n\n*Motivo:* ${motivo}.\nVocê pode gerar um novo link ou tentar outra forma de cobrança no painel.`;

          await prisma.mensagemWhatsapp.create({
            data: {
              numero: revendedora.whatsapp,
              mensagem: msgRecusa,
              tipo: 'LINK_PAGAMENTO_FALHA',
              status: 'PENDENTE',
              lojaId: revendedora.lojaId || 'default-loja'
            }
          });
          
          console.log(`[Webhook ASAAS] WhatsApp de falha de pagamento agendado para a revendedora ${revendedora.nome}.`);
        }
      }
    } catch (err) {
      console.error('[Webhook ASAAS] Erro ao agendar mensagem de falha de pagamento:', err);
    }
  }

  // Resposta padrão para outros tipos de eventos
  res.json({ received: true });
});

// 4. Criar Termo de Responsabilidade/Consignação (Admin)
app.post('/api/termos/gerar', autenticarJWT, autorizarRole(['Manager', 'SuperAdmin']), identificarLoja, async (req, res) => {
  const { usuarioId, titulo, conteudo, prazoDevolucao } = req.body;
  if (!usuarioId || !titulo || !conteudo) {
    return res.status(400).json({ error: 'Revendedora, título e conteúdo do termo são obrigatórios.' });
  }

  try {
    const termo = await prisma.termoConsignacao.create({
      data: {
        usuarioId,
        titulo,
        conteudo,
        prazoDevolucao: prazoDevolucao ? new Date(prazoDevolucao) : null,
        status: 'PENDENTE'
      }
    });

    res.status(201).json(termo);
  } catch (error) {
    console.error('Erro ao criar termo:', error);
    res.status(500).json({ error: 'Erro ao gerar termo de consignação.' });
  }
});

// Listar Termos de Consignação (Geral/Admin)
app.get('/api/termos', autenticarJWT, identificarLoja, async (req, res) => {
  try {
    let where = {};
    if (req.user.role === 'Consultant') {
      where.usuarioId = req.user.id;
    }
    const termos = await prisma.termoConsignacao.findMany({
      where,
      include: {
        usuario: { select: { nome: true, pin: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(termos);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao listar termos de consignação.' });
  }
});

// Assinar Termo Digitalmente
app.post('/api/public/termos/:id/assinar', async (req, res) => {
  const { id } = req.params;
  const { nome, cpf, assinaturaImg, ip } = req.body;
  if (!nome || !cpf || !assinaturaImg) {
    return res.status(400).json({ error: 'Nome, CPF e Assinatura Gráfica são obrigatórios.' });
  }

  try {
    const termo = await prisma.termoConsignacao.findUnique({ where: { id } });
    if (!termo) {
      return res.status(404).json({ error: 'Termo de consignação não encontrado.' });
    }

    const termoAssinado = await prisma.termoConsignacao.update({
      where: { id },
      data: {
        status: 'ASSINADO',
        assinaturaNome: nome,
        assinaturaCpf: cpf,
        assinaturaIp: ip || '127.0.0.1',
        dataAssinatura: new Date()
      }
    });

    // Atualiza status no usuário também
    await prisma.usuario.update({
      where: { id: termo.usuarioId },
      data: { termoAssinado: true }
    });

    // Grava no log de auditoria
    await prisma.logAcao.create({
      data: {
        usuarioId: termo.usuarioId,
        acao: 'TERMO_ASSINATURA_DIGITAL',
        detalhes: `Termo de Consignação "${termo.titulo}" assinado eletronicamente por ${nome} (CPF: ${cpf}) sob o IP ${ip || '127.0.0.1'}.`
      }
    });

    res.json({ message: 'Termo assinado com sucesso!', termo: termoAssinado });
  } catch (error) {
    console.error('Erro ao assinar termo:', error);
    res.status(500).json({ error: 'Erro ao processar assinatura eletrônica.' });
  }
});

// 5. Listar fila de mensagens pendentes do WhatsApp (Admin)
app.get('/api/whatsapp/fila', autenticarJWT, autorizarRole(['Manager', 'SuperAdmin']), identificarLoja, async (req, res) => {
  try {
    const fila = await prisma.mensagemWhatsapp.findMany({
      where: { lojaId: req.lojaId },
      orderBy: { createdAt: 'desc' }
    });
    res.json(fila);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao obter fila de mensagens.' });
  }
});

// Marcar mensagem do WhatsApp como enviada (Admin)
app.post('/api/whatsapp/enviar/:id', autenticarJWT, autorizarRole(['Manager', 'SuperAdmin']), async (req, res) => {
  const { id } = req.params;
  try {
    const msg = await prisma.mensagemWhatsapp.update({
      where: { id },
      data: { status: 'ENVIADO' }
    });
    res.json({ message: 'Mensagem marcada como enviada com sucesso.', msg });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar status da mensagem.' });
  }
});

// 6. Listar treinamentos cadastrados
app.get('/api/treinamentos', autenticarJWT, async (req, res) => {
  try {
    const treinamentos = await prisma.treinamento.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.json(treinamentos);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao carregar treinamentos.' });
  }
});

// Adicionar treinamento (Admin)
app.post('/api/treinamentos', autenticarJWT, autorizarRole(['Manager', 'SuperAdmin']), identificarLoja, async (req, res) => {
  const { titulo, descricao, tipo, url } = req.body;
  if (!titulo || !tipo || !url) {
    return res.status(400).json({ error: 'Título, Tipo (VIDEO, PDF) e URL do conteúdo são obrigatórios.' });
  }

  try {
    const novoTreinamento = await prisma.treinamento.create({
      data: {
        titulo,
        descricao,
        tipo,
        url,
        lojaId: req.lojaId
      }
    });
    res.status(201).json(novoTreinamento);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao cadastrar treinamento.' });
  }
});

// Excluir treinamento (Admin)
app.delete('/api/treinamentos/:id', autenticarJWT, autorizarRole(['Manager', 'SuperAdmin']), async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.treinamento.delete({ where: { id } });
    res.json({ message: 'Treinamento excluído com sucesso!' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao excluir treinamento.' });
  }
});

// 7. Reiniciar ciclo de comissões/metas e alertar a revendedora via WhatsApp (Admin)
app.post('/api/revendedoras/:id/reiniciar-comissoes', autenticarJWT, autorizarRole(['Manager', 'SuperAdmin']), identificarLoja, async (req, res) => {
  const { id } = req.params;
  try {
    const rev = await prisma.usuario.findFirst({ where: { id, role: 'Consultant', lojaId: req.lojaId } });
    if (!rev) {
      return res.status(404).json({ error: 'Revendedora não encontrada nesta loja.' });
    }

    const dataAtual = new Date().toLocaleDateString('pt-BR');
    const msgTexto = `Olá ${rev.nome}! O ciclo de metas e comissões da Conecta Joias foi reiniciado hoje (${dataAtual}). Suas vendas do período foram liquidadas e você já pode cadastrar novos clientes e vendas. Boa sorte e boas vendas no novo ciclo! 💼💎`;

    await prisma.mensagemWhatsapp.create({
      data: {
        numero: rev.whatsapp,
        mensagem: msgTexto,
        tipo: 'REINICIO_COMISSAO',
        status: 'PENDENTE',
        lojaId: req.lojaId
      }
    });

    await prisma.logAcao.create({
      data: {
        usuarioId: id,
        acao: 'REVENDEDORA_REINICIO_COMISSAO',
        detalhes: `Reinício do ciclo de comissões da revendedora ${rev.nome} executado. Mensagem de WhatsApp agendada.`
      }
    });

    res.json({ message: 'Ciclo de comissões reiniciado e WhatsApp agendado com sucesso!' });
  } catch (error) {
    console.error('Erro ao reiniciar comissão:', error);
    res.status(500).json({ error: 'Erro ao processar o reinício da comissão.' });
  }
});

// ==========================================
// ROTAS DE ADMINISTRAÇÃO GLOBAL DO SAAS (SUPERADMIN)
// ==========================================


// Buscar estatísticas globais do SaaS
app.get('/api/saas/stats', autenticarJWT, autorizarRole(['SuperAdmin']), async (req, res) => {
  try {
    const totalLojas = await prisma.loja.count();
    const lojasAtivas = Math.max(0, totalLojas - lojasSuspensas.size);
    const totalUsuarios = await prisma.usuario.count();
    const totalConsultoras = await prisma.usuario.count({ where: { role: 'Consultant' } });
    const totalLogs = await prisma.logAcao.count();

    // Calcular faturamento global a partir de todas as vendas no banco de dados
    const totalDiretasAgg = await prisma.vendaDireta.aggregate({ _sum: { preco: true } });
    const totalRevendedorasAgg = await prisma.vendaRevendedora.aggregate({ _sum: { precoVenda: true } });
    
    const faturamentoGlobal = (totalDiretasAgg._sum.preco || 0) + (totalRevendedorasAgg._sum.precoVenda || 0);

    res.json({
      totalLojas,
      lojasAtivas,
      totalUsuarios,
      totalConsultoras,
      faturamentoGlobal,
      totalLogs
    });
  } catch (error) {
    console.error("Erro ao buscar estatísticas do SaaS:", error);
    res.status(500).json({ error: 'Erro interno ao processar dados analíticos do SaaS.' });
  }
});

// Listar todas as lojas do ecossistema SaaS
app.get('/api/saas/lojas', autenticarJWT, autorizarRole(['SuperAdmin']), async (req, res) => {
  try {
    const lojas = await prisma.loja.findMany({
      include: {
        _count: {
          select: {
            usuarios: { where: { role: 'Consultant' } },
            produtos: true
          }
        },
        vendasDireta: true,
        vendasRev: true
      },
      orderBy: { createdAt: 'desc' }
    });

    const resultado = lojas.map(loja => {
      // Faturamento da loja
      const totalDireta = loja.vendasDireta.reduce((acc, v) => acc + (v.preco || 0), 0);
      const totalRev = loja.vendasRev.reduce((acc, v) => acc + ((v.precoVenda * (v.quantidade || 1)) || 0), 0);
      const faturamento = totalDireta + totalRev;

      return {
        id: loja.id,
        nome: loja.nome,
        cnpj: loja.cnpj || "Não Informado",
        plano: loja.plano || "BRONZE",
        createdAt: loja.createdAt,
        status: lojasSuspensas.has(loja.id) ? 'SUSPENDED' : 'ACTIVE',
        consultorasCount: loja._count.usuarios,
        estoqueCount: loja._count.produtos,
        faturamento,
        temaVisual: 'ESCURO / LUXO'
      };
    });

    res.json(resultado);
  } catch (error) {
    console.error("Erro ao buscar lista de lojas do SaaS:", error);
    res.status(500).json({ error: 'Erro ao carregar lojas cadastradas.' });
  }
});

// Listar logs de auditoria globais do SaaS
app.get('/api/saas/logs', autenticarJWT, autorizarRole(['SuperAdmin']), async (req, res) => {
  try {
    const logs = await prisma.logAcao.findMany({
      orderBy: { data: 'desc' },
      take: 100 // Proteção: limita o consumo de dados da tabela de auditoria a 100 linhas por busca
    });
    res.json(logs);
  } catch (error) {
    console.error("Erro ao buscar logs de auditoria do SaaS:", error);
    res.status(500).json({ error: 'Erro ao carregar logs de segurança.' });
  }
});

// Alterar status de uma loja (Suspender / Reativar)
app.put('/api/saas/lojas/:id/status', autenticarJWT, autorizarRole(['SuperAdmin']), async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (status !== 'ACTIVE' && status !== 'SUSPENDED') {
    return res.status(400).json({ error: 'Status inválido. Deve ser ACTIVE ou SUSPENDED.' });
  }

  try {
    const lojaExiste = await prisma.loja.findUnique({ where: { id } });
    if (!lojaExiste) {
      return res.status(404).json({ error: 'Loja não encontrada na base de dados.' });
    }

    if (status === 'SUSPENDED') {
      lojasSuspensas.add(id);
    } else {
      lojasSuspensas.delete(id);
    }

    // Grava log de segurança da ação crítica realizada pelo Super Admin
    await prisma.logAcao.create({
      data: {
        usuarioId: req.user.id,
        usuarioNome: req.user.nome,
        acao: status === 'SUSPENDED' ? 'LOJA_SUSPENSA' : 'LOJA_REATIVADA',
        detalhes: `Super Admin ${req.user.nome} alterou o status da loja ${lojaExiste.nome} (ID: ${id}) para ${status}.`
      }
    });

    res.json({ message: `Status da loja ${lojaExiste.nome} alterado com sucesso!`, status });
  } catch (error) {
    console.error("Erro ao atualizar status da loja:", error);
    res.status(500).json({ error: 'Erro interno ao tentar atualizar status do tenant.' });
  }
});

// Alterar plano de uma loja (Bronze / Gold / Platinum)
app.put('/api/saas/lojas/:id/plano', autenticarJWT, autorizarRole(['SuperAdmin']), async (req, res) => {
  const { id } = req.params;
  const { plano } = req.body;

  const planosPermitidos = ['BRONZE', 'GOLD', 'PLATINUM'];
  if (!plano || !planosPermitidos.includes(plano.toUpperCase())) {
    return res.status(400).json({ error: 'Plano inválido. Deve ser BRONZE, GOLD ou PLATINUM.' });
  }

  try {
    const lojaExiste = await prisma.loja.findUnique({ where: { id } });
    if (!lojaExiste) {
      return res.status(404).json({ error: 'Loja não encontrada na base de dados.' });
    }

    const lojaAtualizada = await prisma.loja.update({
      where: { id },
      data: { plano: plano.toUpperCase() }
    });

    // Grava log de segurança
    await prisma.logAcao.create({
      data: {
        usuarioId: req.user.id,
        usuarioNome: req.user.nome,
        acao: 'LOJA_PLANO_ALTERADO',
        detalhes: `Super Admin ${req.user.nome} alterou o plano da loja ${lojaExiste.nome} (ID: ${id}) para ${plano.toUpperCase()}.`
      }
    });

    res.json({ message: `Plano da loja ${lojaExiste.nome} atualizado com sucesso para ${plano.toUpperCase()}!`, loja: lojaAtualizada });
  } catch (error) {
    console.error("Erro ao atualizar plano da loja:", error);
    res.status(500).json({ error: 'Erro interno ao tentar atualizar plano do tenant.' });
  }
});

// Forçar backup físico do banco SQLite
app.post('/api/saas/backup', autenticarJWT, autorizarRole(['SuperAdmin']), async (req, res) => {
  try {
    const BACKUPS_DIR = path.join(UPLOADS_DIR, 'backups');
    if (!fs.existsSync(BACKUPS_DIR)) {
      fs.mkdirSync(BACKUPS_DIR, { recursive: true });
    }

    const dbPath = path.join(__dirname, 'dev.db');
    const backupName = `backup-${Date.now()}.db`;
    const backupPath = path.join(BACKUPS_DIR, backupName);

    if (!fs.existsSync(dbPath)) {
      return res.status(400).json({ error: 'Arquivo do banco de dados dev.db não encontrado.' });
    }

    // Copia fisicamente o banco
    fs.copyFileSync(dbPath, backupPath);

    // Grava log de auditoria
    await prisma.logAcao.create({
      data: {
        usuarioId: req.user.id,
        usuarioNome: req.user.nome,
        acao: 'BACKUP_GERADO',
        detalhes: `Super Admin ${req.user.nome} realizou backup físico do banco de dados (Arquivo: ${backupName}).`
      }
    });

    res.json({ message: 'Backup gerado com sucesso!', filename: backupName, sizeBytes: fs.statSync(backupPath).size });
  } catch (error) {
    console.error("Erro ao gerar backup físico:", error);
    res.status(500).json({ error: 'Falha interna ao realizar cópia física de segurança do banco.' });
  }
});

// Auto-diagnóstico de integridade estrutural do banco de dados
app.get('/api/saas/diagnostico', autenticarJWT, autorizarRole(['SuperAdmin']), async (req, res) => {
  try {
    let statusIntegridade = 'INTEGRO';
    let provedor = 'PostgreSQL';

    const dbUrl = process.env.DATABASE_URL || '';
    if (dbUrl.includes('file:') || dbUrl.includes('.db')) {
      provedor = 'SQLite';
      const resultado = await prisma.$queryRawUnsafe('PRAGMA integrity_check');
      statusIntegridade = resultado && resultado[0] && Object.values(resultado[0])[0] === 'ok' ? 'INTEGRO' : 'FALHA';
    } else {
      // Para PostgreSQL / Outros provedores
      await prisma.$queryRawUnsafe('SELECT 1');
      statusIntegridade = 'INTEGRO';
    }

    res.json({
      status: 'ONLINE',
      dbStatus: statusIntegridade,
      provedor: provedor,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Erro no diagnóstico do banco de dados:", error);
    res.status(500).json({ error: 'Falha ao executar rotina de auto-diagnóstico.' });
  }
});


// Função para garantir que a loja padrão, a configuração padrão e o SuperAdmin existam no banco
async function inicializarLojaPadrao() {
  try {
    let loja = await prisma.loja.findUnique({ where: { id: 'default-loja' } });
    if (!loja) {
      loja = await prisma.loja.create({
        data: {
          id: 'default-loja',
          nome: process.env.NOME_EMPRESA_PADRAO || 'Loja Padrão',
          cnpj: '00000000000000'
        }
      });
      console.log('Loja padrão criada com sucesso!');
    }

    // Garante que a configuração da loja padrão exista
    const config = await prisma.configuracao.findFirst({ where: { lojaId: 'default-loja' } });
    if (!config) {
      await prisma.configuracao.create({
        data: {
          lojaId: 'default-loja',
          nomeEmpresa: process.env.NOME_EMPRESA_PADRAO || 'Minha Loja',
          logoUrl: '',
          corPrimaria: '#d4af37',
          corSecundaria: '#111111',
          bgPrimary: '#0a0a0a',
          bgCard: '#121212',
        }
      });
      console.log('Configuração da loja padrão criada com sucesso!');
    }

    // Garante que o SuperAdmin global exista
    const superAdminEmail = process.env.SUPER_ADMIN_EMAIL;
    const superAdminSenha = process.env.SUPER_ADMIN_SENHA;
    const superAdminPin = process.env.SUPER_ADMIN_PIN || '0001';

    if (superAdminEmail && superAdminSenha) {
      const superAdminExiste = await prisma.usuario.findUnique({ where: { email: superAdminEmail } });
      const senhaHash = await bcrypt.hash(superAdminSenha, 10);

      if (!superAdminExiste) {
        await prisma.usuario.create({
          data: {
            nome: 'Super Admin',
            email: superAdminEmail,
            pin: superAdminPin,
            senhaHash,
            role: 'SuperAdmin',
            lojaId: null, // SuperAdmin não pertence a nenhuma loja específica
            comissao: 0.0
          }
        });
        console.log(`SuperAdmin criado: ${superAdminEmail} com PIN ${superAdminPin}`);
      } else {
        // Atualiza PIN e Senha se mudaram no .env
        await prisma.usuario.update({
          where: { email: superAdminEmail },
          data: {
            pin: superAdminPin,
            senhaHash
          }
        });
        console.log(`SuperAdmin atualizado com PIN ${superAdminPin}`);
      }
    } else {
      console.warn('AVISO: SUPER_ADMIN_EMAIL e/ou SUPER_ADMIN_SENHA não definidos no .env. O SuperAdmin não foi criado automaticamente.');
    }
  } catch (error) {
    console.error('Erro ao inicializar loja/configuração padrão:', error);
  }
}

// Processador automático em segundo plano para envio da fila de mensagens do WhatsApp
async function processarFilaWhatsApp() {
  const url = process.env.WHATSAPP_API_URL || '';
  const token = process.env.WHATSAPP_API_KEY || '';
  const eSimulado = !url || !token;

  try {
    const fila = await prisma.mensagemWhatsapp.findMany({
      where: { status: 'PENDENTE' },
      orderBy: { createdAt: 'asc' },
      take: 5
    });

    if (fila.length === 0) return;

    for (const msg of fila) {
      console.log(`[WhatsApp Worker] Processando mensagem ID: ${msg.id} para o número: ${msg.numero}...`);
      
      const numeroLimpo = msg.numero.replace(/\D/g, '');
      const ddiPhone = (numeroLimpo.startsWith('55') || numeroLimpo.length < 10) 
        ? numeroLimpo 
        : '55' + numeroLimpo;

      if (eSimulado) {
        console.log(`--------------------------------------------------`);
        console.log(`📢 [WHATSAPP SIMULADO]`);
        console.log(`Para: ${ddiPhone}`);
        console.log(`Tipo: ${msg.tipo}`);
        console.log(`Mensagem: "${msg.mensagem}"`);
        console.log(`--------------------------------------------------`);

        await prisma.mensagemWhatsapp.update({
          where: { id: msg.id },
          data: { status: 'ENVIADO' }
        });
      } else {
        try {
          const payload = {
            phone: ddiPhone,
            message: msg.mensagem
          };

          const headers = {
            'Content-Type': 'application/json'
          };
          if (token) {
            headers['Authorization'] = `Bearer ${token}`;
            headers['access_token'] = token;
            headers['x-api-key'] = token;
          }

          const response = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload)
          });

          if (!response.ok) {
            const errBody = await response.text();
            throw new Error(`Erro na resposta da API: ${response.status} - ${errBody}`);
          }

          await prisma.mensagemWhatsapp.update({
            where: { id: msg.id },
            data: { status: 'ENVIADO' }
          });
          console.log(`✅ [WhatsApp Worker] Mensagem enviada com sucesso para ${ddiPhone}.`);
        } catch (apiErr) {
          console.error(`❌ [WhatsApp Worker] Falha ao enviar mensagem real para ${ddiPhone}:`, apiErr.message);
          await prisma.mensagemWhatsapp.update({
            where: { id: msg.id },
            data: { status: 'ERRO' }
          });
        }
      }
    }
  } catch (error) {
    console.error('[WhatsApp Worker] Erro geral ao processar fila do WhatsApp:', error.message);
  }
}

// Job diário para verificar janelas de ciclo de acerto e disparar notificações no WhatsApp (Nível 1)
async function verificarCiclosENotificarRevendedoras() {
  console.log('[Ciclo Worker] Iniciando verificação diária de ciclos de acerto...');
  try {
    const revendedoras = await prisma.usuario.findMany({
      where: { role: 'Consultant' }
    });

    const diaHoje = new Date().getDate();

    for (const rev of revendedoras) {
      if (!rev.ciclo || !rev.whatsapp || rev.whatsapp.trim() === '') continue;

      let ciclo = null;
      try {
        ciclo = JSON.parse(rev.ciclo);
      } catch (e) {
        continue;
      }

      if (!ciclo || !ciclo.ativo) continue;

      const { diaInicioAcerto, diaFimAcerto } = ciclo;
      if (!diaInicioAcerto || !diaFimAcerto) continue;

      // 1. Lembrete do primeiro dia da Janela de Acerto
      if (diaHoje === parseInt(diaInicioAcerto)) {
        const msgAbertura = `Olá, *${rev.nome}*! 📋\nA sua janela mensal de acerto de contas da Conecta Joias iniciou hoje e vai até o dia *${diaFimAcerto}*.\n\nPor favor, separe as peças vendidas e as de devolução e acesse o painel ou entre em contato com a administradora para realizar o fechamento do seu acerto. 💎🤝`;

        // Verifica se já não criamos mensagem idêntica nas últimas 12 horas para evitar duplicados
        const hojeMenos12h = new Date(Date.now() - 12 * 60 * 60 * 1000);
        const jaExiste = await prisma.mensagemWhatsapp.findFirst({
          where: {
            numero: rev.whatsapp,
            tipo: 'LEMBRETE_CICLO_ABERTO',
            createdAt: { gte: hojeMenos12h }
          }
        });

        if (!jaExiste) {
          await prisma.mensagemWhatsapp.create({
            data: {
              numero: rev.whatsapp,
              mensagem: msgAbertura,
              tipo: 'LEMBRETE_CICLO_ABERTO',
              status: 'PENDENTE',
              lojaId: rev.lojaId || 'default-loja'
            }
          });
          console.log(`[Ciclo Worker] Agendado lembrete de janela aberta para ${rev.nome}`);
        }
      }

      // 2. Lembrete de Atraso no Acerto (primeiro dia após o encerramento da janela)
      const diaAtraso = parseInt(diaFimAcerto) === 31 ? 1 : parseInt(diaFimAcerto) + 1;
      if (diaHoje === diaAtraso) {
        // Verifica se ela realmente tem peças consignadas (maleta não vazia) para cobrar acerto
        const totalConsignado = await prisma.consignado.count({
          where: { usuarioId: rev.id }
        });

        if (totalConsignado > 0) {
          const msgAtraso = `Olá, *${rev.nome}*! ⚠️\nIdentificamos que o prazo para o acerto do seu ciclo expirou ontem (dia *${diaFimAcerto}*).\n\nPor favor, entre em contato com a administradora o quanto antes para regularizar o saldo de peças e fechar o seu acerto. Agradecemos a colaboração! 💼✨`;

          const hojeMenos12h = new Date(Date.now() - 12 * 60 * 60 * 1000);
          const jaExiste = await prisma.mensagemWhatsapp.findFirst({
            where: {
              numero: rev.whatsapp,
              tipo: 'LEMBRETE_CICLO_ATRASADO',
              createdAt: { gte: hojeMenos12h }
            }
          });

          if (!jaExiste) {
            await prisma.mensagemWhatsapp.create({
              data: {
                numero: rev.whatsapp,
                mensagem: msgAtraso,
                tipo: 'LEMBRETE_CICLO_ATRASADO',
                status: 'PENDENTE',
                lojaId: rev.lojaId || 'default-loja'
              }
            });
            console.log(`[Ciclo Worker] Agendado aviso de acerto atrasado para ${rev.nome}`);
          }
        }
      }
    }
  } catch (err) {
    console.error('[Ciclo Worker] Erro ao verificar ciclos mensais das revendedoras:', err);
  }
}

// ==========================================
// INICIALIZAÇÃO
// ==========================================
app.listen(PORT, () => {
  console.log(`Servidor rodando com sucesso na porta ${PORT}`);
  inicializarLojaPadrao();
  // Iniciar worker de processamento do WhatsApp a cada 10 segundos
  setInterval(processarFilaWhatsApp, 10000);
  
  // Rodar a verificação de ciclos 5 segundos após a inicialização e depois a cada 24 horas
  setTimeout(verificarCiclosENotificarRevendedoras, 5000);
  setInterval(verificarCiclosENotificarRevendedoras, 24 * 60 * 60 * 1000);
});

