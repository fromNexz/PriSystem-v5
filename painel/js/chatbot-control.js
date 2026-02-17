// Arquivo: prisystem/painel/js/chatbot-control.js

let statusCheckInterval = null;

document.addEventListener("DOMContentLoaded", () => {
    checkBotStatus();
    statusCheckInterval = setInterval(checkBotStatus, 5000);
});

window.addEventListener('beforeunload', () => {
    if (statusCheckInterval) {
        clearInterval(statusCheckInterval);
    }
});

async function checkBotStatus() {
    try {
        const response = await fetch('/whatsapp/status');
        const data = await response.json();
        updateStatusUI(data);
    } catch (error) {
        console.error('Erro ao verificar status:', error);
        updateStatusUI({ status: 'disconnected' });
    }
}

function updateStatusUI(data) {
    const indicator = document.getElementById('status-indicator');
    const statusText = document.getElementById('status-text');
    const statusDetail = document.getElementById('status-detail');
    const qrContainer = document.getElementById('qr-container');
    const connectedInfo = document.getElementById('connected-info');
    const connectedPhone = document.getElementById('connected-phone');
    const connectedBotType = document.getElementById('connected-bot-type');
    const btnDisconnect = document.getElementById('btn-disconnect');
    
    indicator.className = '';
    
    switch (data.status) {
        case 'connected':
            indicator.classList.add('status-connected');
            statusText.textContent = 'Conectado';
            statusDetail.textContent = 'Bot está ativo e pronto para receber mensagens';
            qrContainer.style.display = 'none';
            connectedInfo.style.display = 'block';
            btnDisconnect.style.display = 'inline-block';
            
            if (data.phone_number) {
                connectedPhone.textContent = data.phone_number;
            }
            if (data.bot_type) {
                connectedBotType.textContent = data.bot_type === 'rule' ? 'Programado' : 'IA';
            }
            break;
            
        case 'qr_pending':
            indicator.classList.add('status-qr');
            statusText.textContent = 'Aguardando Conexão';
            statusDetail.textContent = 'Escaneie o QR Code para conectar';
            qrContainer.style.display = 'block';
            connectedInfo.style.display = 'none';
            btnDisconnect.style.display = 'none';
            
            if (data.qr_code) {
                const qrImage = document.getElementById('qr-image');
                qrImage.src = `data:image/png;base64,${data.qr_code}`;
            }
            break;
            
        case 'disconnected':
        default:
            indicator.classList.add('status-disconnected');
            statusText.textContent = 'Desconectado';
            statusDetail.textContent = 'Bot não está rodando. Execute "node chatbot.js" no servidor';
            qrContainer.style.display = 'none';
            connectedInfo.style.display = 'none';
            btnDisconnect.style.display = 'none';
            break;
    }
}

async function refreshQRCode() {
    try {
        await fetch('/whatsapp/clear-qr', { method: 'POST' });
        alert('QR Code será atualizado em breve. Aguarde alguns segundos...');
        setTimeout(checkBotStatus, 2000);
    } catch (error) {
        console.error('Erro ao atualizar QR:', error);
        alert('Erro ao atualizar QR Code');
    }
}

function restartBot() {
    alert('Para iniciar o bot, execute no terminal:\n\ncd prisystem/chatbot/bot_rule\nnode chatbot.js');
}

function disconnectBot() {
    alert('Para desconectar, pare o processo do chatbot.js no servidor (Ctrl+C)');
}
