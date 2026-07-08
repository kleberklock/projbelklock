// Dados de Marketing, Personas e Calendário Editorial para o aplicativo Conecta Joias

const MarketingData = {
  // 1. Definição do Público-Alvo & Personas
  personas: [
    {
      id: "executiva",
      nome: "Mariana Costa",
      idade: 34,
      profissao: "Advogada e Gestora",
      perfil: "Mulher independente, com rotina corporativa intensa. Busca praticidade, mas não abre mão da elegância e do profissionalismo. Prefere semijoias clássicas e duráveis.",
      estiloPref: "Acessórios discretos, brincos de argola clássicos, correntes finas com pingentes minimalistas, anéis delicados e peças banhadas a ouro 18k de alta durabilidade.",
      dorPrincipal: "Falta de tempo para escolher acessórios que combinem com tudo e medo de alergias por peças de baixa qualidade.",
      abordagem: "Apresente coleções clássicas com o argumento de 'praticidade com elegância'. Ofereça conjuntos prontos para reuniões de negócios e destaque a tecnologia antialérgica das peças."
    },
    {
      id: "socialite",
      nome: "Renata Vasconcellos",
      idade: 42,
      profissao: "Empresária e Organizadora de Eventos",
      perfil: "Frequenta jantares, coquetéis e reuniões sociais de alto padrão. Adora estar na moda e é vista como referência de bom gosto por suas amigas.",
      estiloPref: "Peças robustas e imponentes. Colares Riviera, brincos com zircônias grandes lapidadas, anéis solitários chamativos e peças com banho de ródio ou ouro rosé de destaque.",
      dorPrincipal: "Quer se sentir única nos eventos e evitar repetir acessórios marcantes muitas vezes.",
      abordagem: "Foque na exclusividade das peças. Faça um atendimento personalizado pelo WhatsApp enviando peças recém-chegadas antes de postar no Instagram. Use o termo 'Edição Limitada'."
    },
    {
      id: "jovem-moderna",
      nome: "Gabriela Martins",
      idade: 23,
      profissao: "Estudante e Influenciadora Digital",
      perfil: "Conectada às redes sociais, ama seguir tendências de blogueiras e busca peças modernas para compor looks fotogênicos do dia a dia.",
      estiloPref: "Mix de colares (layering), piercings de pressão (fakes), muitos anéis finos nos dedos, brincos geométricos e correntaria grossa moderna.",
      dorPrincipal: "Orçamento mais enxuto, mas ainda quer produtos bonitos e com aparência de joias caras para suas fotos.",
      abordagem: "Mostre combinações criativas de mix de peças acessíveis. Faça posts informais no Instagram com vídeos estilo 'arrume-se comigo'. Ofereça opções de parcelamento ou kits de mix com preço especial."
    }
  ],

  // 2. Ideias de Divulgação por Tema/Categoria do Dia
  calendarioDivulgacao: [
    {
      dia: "Segunda-feira",
      foco: "Autoridade e Cuidados",
      canal: "Stories & Feed",
      ideiaPost: "Como cuidar das suas semijoias para que o banho dure anos! Mostre na prática a limpeza correta.",
      sugestaoLegenda: "Você sabia que pequenos cuidados diários mantêm suas semijoias brilhando como novas por anos? ✨💍\n\nEvite borrifar perfume diretamente nas peças, retire-as antes do banho e guarde-as separadas para não riscar. Qual dessas dicas você já pratica por aí?\n\n#Conecta Joias #CuidadosComSemijoias #DicasDeModa #AcessoriosFinos #EstiloDourado",
      hashtags: ["#Conecta Joias", "#AcessoriosFinos", "#SemijoiasDeLuxo", "#SemijoiasDouradas", "#DicasDeModa", "#OrganizaJoias"]
    },
    {
      dia: "Terça-feira",
      foco: "Mix do Dia & Tendências",
      canal: "Reels / TikTok",
      ideiaPost: "Montando um 'Mix de Colares' perfeito para transformar uma camiseta básica preta em um look super chic.",
      sugestaoLegenda: "O poder de um mix de colares bem planejado! 🖤✨ Assista como transformamos um look básico em segundos usando nossa coleção clássica banhada a ouro 18k.\n\nTodos os colares do vídeo estão disponíveis em nosso estoque. Me chame no direct ou WhatsApp para garantir o seu! Link na bio.\n\n#MixDeColares #DouradoPremium #EstiloElegante #SemijoiasFinass #LookDoDia",
      hashtags: ["#MixDeColares", "#SemijoiasBanhadas", "#LookDoDia", "#AcessoriosFemininos", "#ModaFeminina", "#Elegancia"]
    },
    {
      dia: "Quarta-feira",
      foco: "Bastidores e Curiosidades",
      canal: "Stories",
      ideiaPost: "A caixinha da cliente! Grave empacotando um pedido com carinho, borrifando um perfume de assinatura e escrevendo uma cartinha à mão.",
      sugestaoLegenda: "Amamos preparar cada detalhe para que sua experiência de unboxing seja inesquecível! 📦💖 Cada peça vai limpa, perfumada e embalada como o verdadeiro presente que você merece.\n\nPara quem você daria um presente Conecta Joias hoje?\n\n#Unboxing #ExperienciaDoCliente #SemijoiasComAmor #DetalhesQueEncantam",
      hashtags: ["#Unboxing", "#SemijoiasComAmor", "#ExperienciaLuxo", "#PresenteEspecial"]
    },
    {
      dia: "Quinta-feira",
      foco: "Consignado e Oportunidades",
      canal: "WhatsApp & Instagram",
      ideiaPost: "Seja uma revendedora Conecta Joias! Mostre as vantagens de revender semijoias consignadas de alta qualidade e comissões excelentes.",
      sugestaoLegenda: "Que tal conquistar sua independência financeira revendendo semijoias de altíssimo padrão, sem precisar investir nada inicialmente? 💼💎\n\nNós fornecemos o mostruário completo consignado, suporte de marketing e comissões imperdíveis. Quer saber como funciona? Envie 'QUERO REVENDER' no nosso direct ou clique no link da bio!\n\n#RendaExtra #EmpreendedorismoFeminino #RevendaSemijoias #ConsignadoDeLuxo #SucessoFeminino",
      hashtags: ["#RevendaSemijoias", "#Consignado", "#EmpreendedorismoFeminino", "#IndependenciaFinanceira", "#RendaExtra"]
    },
    {
      dia: "Sexta-feira",
      foco: "Desejo e Fim de Semana",
      canal: "Feed & Stories",
      ideiaPost: "Foto macro (bem de perto) mostrando os detalhes das zircônias cravadas e o brilho do banho de ouro para o look de balada/jantar do final de semana.",
      sugestaoLegenda: "Sextou com o brilho que você merece! ✨🥂 Pronta para arrasar no fim de semana com essas argolas cravejadas luxuosas? O brilho das nossas zircônias de alta qualidade vai iluminar qualquer noite.\n\nDisponível à pronta entrega. Entregamos na sua casa!\n\n#BrilhoSemijoias #BrincoCravejado #FimDeSemana #ModaFesta #LuxoAcessivel",
      hashtags: ["#BrincoCravejado", "#ZirconiaFina", "#BrilhoAbsoluto", "#AcessoriosFesta", "#EstiloPremium"]
    }
  ],

  // 3. Modelos de Mensagens Rápidas do WhatsApp
  whatsappTemplates: {
    boasVindas: "Olá! Seja muito bem-vinda à *Conecta Joias*! 💎✨\n\nÉ um prazer ter você por aqui. Sou a Bel, sua consultora pessoal de estilo e semijoias. \n\nComo posso te ajudar hoje?\n1 - Ver o catálogo de peças disponíveis\n2 - Falar sobre revenda em consignado\n3 - Falar com uma atendente\n\nFique à vontade para me mandar sua mensagem!",
    
    envioCatalogo: "Olá, {cliente}! 🌸 Separei algumas novidades do nosso estoque que têm tudo a ver com o seu estilo clássico e elegante. \n\nConfira as peças selecionadas:\n\n{lista_produtos}\n\nQual delas fez seu coração bater mais forte? Se quiser ver mais detalhes ou fotos reais no corpo, é só me avisar por aqui! 💖💍",
    
    posVenda: "Olá, {cliente}! Passando para saber: suas semijoias Conecta Joias já chegaram por aí? 😍\n\nGostaria muito de saber o que achou da embalagem, do perfume e, claro, das peças no corpo! Sua opinião é preciosa para mim. \n\nLembre-se de nos marcar no Instagram quando for usá-las! Um super beijo e arrase! ✨📦",
    
    cobrancaConsignado: "Olá, {revendedora}! Espero que esteja tendo uma excelente semana de vendas! 🌸✨\n\nPassando para lembrar que o acerto do nosso kit consignado está agendado para o dia *{data_acerto}*. \n\nEstou preparando novidades incríveis para a sua próxima maleta! Se precisar que eu já adiante algum cálculo ou que envie fotos para suas clientes finais, conte comigo. Um grande abraço! 💼💍",
    
    reciboAcerto: "📝 *RECIBO DE ACERTO DE CONSIGNADO - BELKLOCK SEMIJOIAS* 📝\n\n*Revendedora:* {revendedora}\n*Data do Acerto:* {data_acerto}\n\n---------------------------------\n📊 *Resumo da Prestação de Contas:*\n- Peças Consignadas: {qtd_consignada} unid.\n- Peças Devolvidas: {qtd_devolvida} unid.\n- Peças Vendidas: {qtd_vendida} unid.\n\n💰 *Valores:*\n- Faturamento Total Bruto: *R$ {valor_bruto}*\n- Sua Comissão ({comissao_porc}%): *R$ {valor_comissao}*\n- *Líquido a Pagar para Conecta Joias: R$ {valor_liquido}*\n---------------------------------\n\nAgradecemos imensamente pela nossa parceria de sucesso! Que as próximas vendas sejam ainda mais abençoadas! 💎🙌✨"
  }
};
