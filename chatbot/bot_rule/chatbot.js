const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const qr = require('qrcode');

// ==================== CONFIGURAÇÃO ====================

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const IMAGE_DIR = path.join(DATA_DIR, 'image');
const QR_PATH = path.join(IMAGE_DIR, 'whatsapp_qr.png');
const STATUS_PATH = path.join(DATA_DIR, 'bot_status.json');

[DATA_DIR, IMAGE_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`✅ Diretório criado: ${dir}`);
    }
});

console.log('📂 Configuração de pastas:');
console.log('  QR será salvo em:', QR_PATH);
console.log('  Status em:', STATUS_PATH);

// ==================== BANCO DE DADOS ====================

const pool = new Pool({
    host: '204.157.124.199',
    port: 5432,
    user: 'postgres',
    password: '003289',
    database: 'pri_system'
});

pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('❌ Erro ao conectar no banco:', err.message);
    } else {
        console.log('✅ Conectado ao PostgreSQL:', res.rows[0].now);
    }
});

// ==================== CLIENT CONFIG ====================

const client = new Client({
    authStrategy: new LocalAuth({
        clientId: 'primalzoni-bot-rule',
        dataPath: path.join(DATA_DIR, '.wwebjs_auth_rule')
    }),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu'
        ]
    }
});

// ==================== DADOS DOS SERVIÇOS ====================

const SERVICOS = {
    1: { nome: 'BrowLaminations', preco: 'R$ 150,00' },
    2: { nome: 'Design de Sobrancelhas', preco: 'R$ 35,00' },
    3: { nome: 'Design em sobrancelhas micropigmentadas', preco: 'R$ 30,00' },
    4: { nome: 'Drenagem Linfática (10 sessões)', preco: 'R$ 750,00' },
    5: { nome: 'Drenagem Linfática (5 sessões)', preco: 'R$ 400,00' },
    6: { nome: 'Drenagem Linfática (1 sessão)', preco: 'R$ 90,00' },
    7: { nome: 'Epilação Buço', preco: 'R$ 10,00' },
    8: { nome: 'Epilação Facial', preco: 'R$ 60,00' },
    9: { nome: 'Epilação Buço e queixo', preco: 'R$ 20,00' },
    10: { nome: 'SPA Lips - esfoliação e hidratação labial', preco: 'R$ 40,00' },
    11: { nome: 'Hidragloss 1 sessão', preco: 'R$ 150,00' },
    12: { nome: 'Lash Lifting', preco: 'R$ 120,00' },
    13: { nome: 'Limpeza de pele', preco: 'R$ 150,00' },
    14: { nome: 'Massagem modeladora (1 sessão)', preco: 'R$ 90,00' },
    15: { nome: 'Massagem modeladora (10 sessões)', preco: 'R$ 750,00' },
    16: { nome: 'Massagem modeladora (5 sessões)', preco: 'R$ 400,00' },
    17: { nome: 'Massagem Terapêutica (1 sessão)', preco: 'R$ 90,00' },
    18: { nome: 'Massagem Terapêutica (10 sessões)', preco: 'R$ 750,00' },
    19: { nome: 'Massagem Terapêutica (5 sessões)', preco: 'R$ 400,00' },
    20: { nome: 'Micropigmentação Labial (duas sessões)', preco: 'R$ 575,00' },
    21: { nome: 'Micropigmentação Labial (uma sessão)', preco: 'R$ 290,00' },
    22: { nome: 'Micropigmentação sobrancelhas - fio a fio ou Shadow (duas sessões)', preco: 'R$ 430,00' },
    23: { nome: 'Micropigmentação sobrancelhas - fio a fio ou Shadow (uma sessão)', preco: 'R$ 250,00' },
    24: { nome: 'Remoção e hidratação dos cílios', preco: 'R$ 40,00' },
    25: { nome: 'Alongamento de cílios volume Express Soft', preco: 'R$ 120,00' },
    26: { nome: 'Design e Henna', preco: 'R$ 50,00' }
};

// ==================== VARIÁVEIS GLOBAIS ====================

let MENSAGENS_PROGRAMADAS = [];
let CHATBOT_SETTINGS = null;
let conversasAtivas = {};
let conversasEncerradas = new Set();
let PALAVRA_CHAVE_REATIVAR = 'atendimento';

const delay = ms => new Promise(res => setTimeout(res, ms));
let lastQrGeneration = 0;
const QR_GENERATION_INTERVAL = 60000;

// ==================== FUNÇÕES DE STATUS ====================

async function saveStatus(status, phoneNumber = null) {
    const statusData = {
        status: status,
        phone_number: phoneNumber,
        bot_type: 'rule',
        last_update: new Date().toISOString()
    };
    
    try {
        fs.writeFileSync(STATUS_PATH, JSON.stringify(statusData, null, 2));
        console.log(`📊 Status salvo: ${status}`);
    } catch (error) {
        console.error('❌ Erro ao salvar status:', error);
    }
}

// ==================== FUNÇÕES DE BANCO ====================

async function loadChatbotSettings() {
    try {
        const result = await pool.query(`
            SELECT * FROM chatbot_settings
            WHERE active_bot_type = 'rule'
            ORDER BY id
            LIMIT 1
        `);
        
        if (result.rows.length > 0) {
            CHATBOT_SETTINGS = result.rows[0];
            console.log(`⚙️ Configurações carregadas: Bot tipo ${CHATBOT_SETTINGS.active_bot_type}`);
        }
    } catch (error) {
        console.error('❌ Erro ao carregar configurações:', error);
    }
}

async function loadProgrammedMessages() {
    try {
        const result = await pool.query(`
            SELECT * FROM chatbot_messages
            WHERE is_active = true
            ORDER BY order_position ASC
        `);
        
        MENSAGENS_PROGRAMADAS = result.rows;
        console.log(`📋 ${MENSAGENS_PROGRAMADAS.length} mensagens programadas carregadas`);
    } catch (error) {
        console.error('❌ Erro ao carregar mensagens:', error);
    }
}

async function saveCustomer(phone, name, email = null) {
    try {
        const result = await pool.query(`
            INSERT INTO customers (phone, name, email, channel, created_at)
            VALUES ($1, $2, $3, 'whatsapp', NOW())
            ON CONFLICT (phone) 
            DO UPDATE SET name = EXCLUDED.name, email = EXCLUDED.email
            RETURNING id
        `, [phone, name, email]);
        
        return result.rows[0].id;
    } catch (error) {
        console.error('❌ Erro ao salvar cliente:', error);
        return null;
    }
}

async function checkCustomerBlocked(phone) {
    try {
        const result = await pool.query(`
            SELECT is_blocked FROM customers WHERE phone = $1
        `, [phone]);
        
        if (result.rows.length > 0) {
            return result.rows[0].is_blocked;
        }
        return false;
    } catch (error) {
        console.error('❌ Erro ao verificar bloqueio:', error);
        return false;
    }
}

// ==================== EVENTOS DE CONEXÃO ====================

client.on('qr', async (qrString) => {
    const now = Date.now();
    
    if (now - lastQrGeneration < QR_GENERATION_INTERVAL) {
        console.log('⏭️ QR recente, aguardando intervalo...');
        return;
    }
    
    lastQrGeneration = now;
    console.log('📱 QR_GENERATED');
    
    await saveStatus('qr_pending');
    
    try {
        await qr.toFile(QR_PATH, qrString, {
            color: { dark: '#000000', light: '#FFFFFF' },
            width: 300
        });
        console.log(`📸 QR Code salvo em: ${QR_PATH}`);
    } catch (error) {
        console.error('❌ Erro ao salvar QR:', error.message);
    }
});

client.on('authenticated', () => {
    console.log('✅ AUTENTICADO COM SUCESSO');
});

client.on('ready', async () => {
    console.log('✅ WHATSAPP CONECTADO - BOT RULE ATIVO!');
    console.log('📱 Número:', client.info.wid.user);
    
    await saveStatus('connected', client.info.wid.user);
    
    await loadChatbotSettings();
    await loadProgrammedMessages();
    
    try {
        if (fs.existsSync(QR_PATH)) {
            fs.unlinkSync(QR_PATH);
            console.log('🗑️ QR Code removido');
        }
    } catch (error) {
        console.error('⚠️ Erro ao remover QR:', error.message);
    }
});

client.on('auth_failure', async (msg) => {
    console.error('❌ FALHA NA AUTENTICAÇÃO:', msg);
    await saveStatus('disconnected');
});

client.on('disconnected', async (reason) => {
    console.log('❌ DESCONECTADO:', reason);
    await saveStatus('disconnected');
});

// ==================== SISTEMA DE CONVERSAS ====================

function resetarConversa(numeroTelefone) {
    if (conversasAtivas[numeroTelefone]) {
        delete conversasAtivas[numeroTelefone];
    }
    console.log(`🔄 Conversa resetada: ${numeroTelefone}`);
}

function encerrarConversa(numeroTelefone) {
    conversasEncerradas.add(numeroTelefone);
    if (conversasAtivas[numeroTelefone]) {
        conversasAtivas[numeroTelefone].encerrada = true;
    }
    console.log(`🔒 Conversa encerrada: ${numeroTelefone}`);
}

function reativarConversa(numeroTelefone) {
    conversasEncerradas.delete(numeroTelefone);
    resetarConversa(numeroTelefone);
    console.log(`🔓 Conversa reativada: ${numeroTelefone}`);
}

// ==================== FLUXO PADRÃO ====================

async function iniciarConversaPadrao(msg) {
    await delay(1000);
    
    const boas_vindas = CHATBOT_SETTINGS?.welcome_message || 
        `Olá, seja muito bem-vinda! 🤍\n\n` +
        `Aqui é a assistente virtual da *Pri Malzoni Estética*.\n` +
        `Vou te orientar no agendamento de forma rápida e organizada ✨\n\n` +
        `Para começarmos, poderia me informar, por favor,\n` +
        `seu *nome e sobrenome*? 🤍`;
    
    await client.sendMessage(msg.from, boas_vindas);
    
    conversasAtivas[msg.from] = {
        aguardandoNome: true,
        dados: {}
    };
    
    console.log(`🆕 Nova conversa iniciada: ${msg.from}`);
}

async function processarRespostaPadrao(msg, mensagem, conversa) {
    if (conversa.aguardandoNome) {
        conversa.dados.nome = mensagem;
        conversa.aguardandoNome = false;
        
        await client.sendMessage(msg.from,
            `Obrigada, ${mensagem}! ✨\n\n` +
            `Em qual período você prefere atendimento?\n\n` +
            `⏰ *Manhã*: das 8h às 12h\n` +
            `⏰ *Tarde*: das 14h às 18h\n\n` +
            `_Por favor, responda com *manhã* ou *tarde*_`
        );
        
        conversa.aguardandoPeriodo = true;
        return;
    }
    
    if (conversa.aguardandoPeriodo) {
        const mensagemLower = mensagem.toLowerCase().trim();
        
        if (mensagemLower.includes('manhã') || mensagemLower.includes('manha')) {
            conversa.dados.periodo = 'Manhã (8h às 12h)';
        } else if (mensagemLower.includes('tarde')) {
            conversa.dados.periodo = 'Tarde (14h às 18h)';
        } else {
            await client.sendMessage(msg.from, `Por favor, informe *manhã* ou *tarde* 🤍`);
            return;
        }
        
        conversa.aguardandoPeriodo = false;
        
        let mensagemServicos = `Perfeito! 🤍\n\nQual procedimento você deseja realizar?\n\n`;
        
        Object.keys(SERVICOS).forEach(id => {
            const servico = SERVICOS[id];
            mensagemServicos += `*${id}* - ${servico.nome} ${servico.preco}\n`;
        });
        
        mensagemServicos += `\n_Digite o número do procedimento desejado_`;
        
        await client.sendMessage(msg.from, mensagemServicos);
        conversa.aguardandoServico = true;
        return;
    }
    
    if (conversa.aguardandoServico) {
        const numeroServico = parseInt(mensagem.trim());
        
        if (SERVICOS[numeroServico]) {
            const servico = SERVICOS[numeroServico];
            conversa.dados.servico = `${servico.nome} - ${servico.preco}`;
            
            const phone = msg.from.replace('@c.us', '');
            await saveCustomer(phone, conversa.dados.nome);
            
            await client.sendMessage(msg.from,
                `━━━━━━━━━━━━━━━\n` +
                `📋 *Resumo da sua solicitação:*\n` +
                `👤 Nome: ${conversa.dados.nome}\n` +
                `⏰ Período: ${conversa.dados.periodo}\n` +
                `💆 Serviço: ${conversa.dados.servico}\n` +
                `━━━━━━━━━━━━━━━\n\n` +
                `✅ Seu atendimento foi registrado!\n\n` +
                `_Digite *${PALAVRA_CHAVE_REATIVAR}* para novo atendimento_`
            );
            
            encerrarConversa(msg.from);
        } else {
            await client.sendMessage(msg.from, `Número inválido. Escolha entre 1 e 26 🤍`);
        }
    }
}

// ==================== HANDLER PRINCIPAL ====================

async function handleMessage(msg) {
    try {
        if (msg.from.includes('@g.us') || 
            msg.from.includes('@newsletter') || 
            msg.from.includes('@broadcast') ||
            msg.fromMe || 
            !msg.body || 
            msg.body.trim() === '') {
            return;
        }
        
        const mensagem = msg.body.trim();
        const mensagemLower = mensagem.toLowerCase();
        const phone = msg.from.replace('@c.us', '');
        
        const isBlocked = await checkCustomerBlocked(phone);
        if (isBlocked) {
            console.log(`🚫 Cliente bloqueado: ${msg.from}`);
            return;
        }
        
        if (conversasEncerradas.has(msg.from)) {
            if (mensagemLower === PALAVRA_CHAVE_REATIVAR) {
                reativarConversa(msg.from);
                await iniciarConversaPadrao(msg);
            }
            return;
        }
        
        console.log(`🔔 MENSAGEM de ${msg.from}: "${mensagem}"`);
        
        const conversa = conversasAtivas[msg.from];
        
        if (!conversa) {
            await iniciarConversaPadrao(msg);
            return;
        }
        
        await processarRespostaPadrao(msg, mensagem, conversa);
        
    } catch (error) {
        console.error('❌ ERRO no handleMessage:', error);
        resetarConversa(msg.from);
    }
}

client.on('message_create', handleMessage);

// ==================== INICIALIZAÇÃO ====================

(async () => {
    console.log('🚀 Iniciando Bot WhatsApp - MODO PROGRAMADO');
    console.log('📱 Aguardando autenticação...\n');
    
    await saveStatus('disconnected');
    await loadChatbotSettings();
    await loadProgrammedMessages();
    
    console.log(`💆 ${Object.keys(SERVICOS).length} serviços carregados`);
    
    client.initialize();
    
    console.log('\n✨ Bot Rule configurado e pronto!\n');
    console.log(`🔑 Palavra-chave para reativar: "${PALAVRA_CHAVE_REATIVAR}"`);
})();

process.on('unhandledRejection', (reason) => {
    console.error('❌ Unhandled Rejection:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
});