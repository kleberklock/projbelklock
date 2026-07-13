const fs = require('fs');
const path = require('path');

// Configurações de exportação
const OUTPUT_FILE = path.join(__dirname, 'codigo_conecta_joias.md');
const IGNORED_DIRS = ['node_modules', '.git', '.vscode', 'uploads', 'assets'];
const IGNORED_FILES = ['dev.db', 'package-lock.json', 'codigo_conecta_joias.md', 'export-code.js'];
const ALLOWED_EXTENSIONS = ['.js', '.html', '.css', '.prisma', '.bat', '.json'];

let fileCount = 0;
let outputContent = `# Código Fonte Completo - Conecta Joias\n\nEste documento contém o código-fonte consolidado do projeto Conecta Joias. Ele está estruturado para facilitar a leitura e análise em chats de inteligência artificial (como o Gemini).\n\n`;

function shouldProcessFile(filePath, fileName) {
  // Ignorar arquivos temporários ou de lock volumosos
  if (IGNORED_FILES.includes(fileName)) return false;
  
  const ext = path.extname(filePath);
  return ALLOWED_EXTENSIONS.includes(ext);
}

function processDirectory(dirPath) {
  const items = fs.readdirSync(dirPath);

  for (const item of items) {
    const fullPath = path.join(dirPath, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      if (!IGNORED_DIRS.includes(item)) {
        processDirectory(fullPath);
      }
    } else if (stat.isFile()) {
      if (shouldProcessFile(fullPath, item)) {
        const relativePath = path.relative(__dirname, fullPath).replace(/\\/g, '/');
        console.log(`Processando: ${relativePath}`);
        
        try {
          const content = fs.readFileSync(fullPath, 'utf8');
          const ext = path.extname(fullPath).substring(1);
          
          outputContent += `## Arquivo: ${relativePath}\n\n`;
          outputContent += `\`\`\`${ext || 'text'}\n`;
          outputContent += content;
          outputContent += `\n\`\`\`\n\n---\n\n`;
          fileCount++;
        } catch (err) {
          console.error(`Erro ao ler ${relativePath}:`, err.message);
        }
      }
    }
  }
}

console.log("Iniciando a exportação do código fonte...");
processDirectory(__dirname);

fs.writeFileSync(OUTPUT_FILE, outputContent, 'utf8');
console.log(`\nPronto! O código de ${fileCount} arquivos foi exportado com sucesso para:`);
console.log(OUTPUT_FILE);
console.log("Você pode abrir este arquivo e copiar seu conteúdo ou fazer o upload dele no chat do Gemini.");
