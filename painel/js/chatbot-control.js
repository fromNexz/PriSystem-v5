let statusCheckInterval = null;

document.addEventListener("DOMContentLoaded", () => {
    checkBotStatus();
    statusCheckInterval = setInterval(checkBotStatus, 3000);
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
        updateStatusUI({ status: 'disconnected', is_running: false });
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
    const btnRestart = document.getElementById('btn-restart-bot');
    const btnDisconnect = document.getElementById('btn-disconnect');

    indicator.className = '';

    // Atualizar texto do botão baseado no status de execução
    if (data.is_running) {
        btnRestart.textContent = 'Parar Bot';
        btnRestart.onclick = stopBot;
        btnRestart.className = 'button-danger';
    } else {
        btnRestart.textContent = 'Iniciar Bot';
        btnRestart.onclick = startBot;
        btnRestart.className = 'button-primary';
    }

    // Lógica de status
    if (!data.is_running) {
        // BOT PARADO - sempre mostrar desconectado
        indicator.classList.add('status-disconnected');
        statusText.textContent = '⭕ Desconectado';
        statusDetail.textContent = 'Clique em "Iniciar Bot" para começar';
        qrContainer.style.display = 'none';
        connectedInfo.style.display = 'none';
        btnDisconnect.style.display = 'none';
    } else {
        // BOT RODANDO - verificar status de conexão
        switch (data.status) {
            case 'connected':
                indicator.classList.add('status-connected');
                statusText.textContent = '✅ Conectado';
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
                statusText.textContent = '⏳ Aguardando Conexão';
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
                // Bot rodando mas ainda iniciando
                indicator.classList.add('status-qr');
                statusText.textContent = '🔄 Iniciando...';
                statusDetail.textContent = 'Bot está iniciando, aguarde o QR Code aparecer';
                qrContainer.style.display = 'none';
                connectedInfo.style.display = 'none';
                btnDisconnect.style.display = 'none';
                break;
        }
    }
}

async function startBot() {
    try {
        const response = await fetch('/whatsapp/start', { method: 'POST' });
        const data = await response.json();

        if (data.success) {
            alert('✅ ' + data.message);
            checkBotStatus();
        } else {
            alert('ℹ️ ' + data.message);
        }
    } catch (error) {
        console.error('Erro ao iniciar bot:', error);
        alert('❌ Erro ao iniciar bot: ' + error.message);
    }
}

async function stopBot() {
    if (!confirm('Deseja parar o bot?')) return;

    try {
        const response = await fetch('/whatsapp/stop', { method: 'POST' });
        const data = await response.json();

        if (data.success) {
            alert('✅ ' + data.message);
            checkBotStatus();
        } else {
            alert('ℹ️ ' + data.message);
        }
    } catch (error) {
        console.error('Erro ao parar bot:', error);
        alert('❌ Erro ao parar bot: ' + error.message);
    }
}

async function restartBot() {
    if (!confirm('Deseja reiniciar o bot?')) return;

    try {
        const response = await fetch('/whatsapp/restart', { method: 'POST' });
        const data = await response.json();

        if (data.success) {
            alert('✅ ' + data.message);
            setTimeout(checkBotStatus, 2000);
        } else {
            alert('❌ Erro ao reiniciar bot');
        }
    } catch (error) {
        console.error('Erro ao reiniciar bot:', error);
        alert('❌ Erro ao reiniciar bot: ' + error.message);
    }
}

async function disconnectBot() {
    const confirmacao = confirm(
        '⚠️ DESCONECTAR WHATSAPP\n\n' +
        'Isso irá:\n' +
        '• Parar o bot automaticamente\n' +
        '• Remover a sessão do WhatsApp\n' +
        '• Você precisará escanear o QR Code novamente\n\n' +
        'Deseja continuar?'
    );

    if (!confirmacao) return;

    // Mostrar que está processando
    const btnDisconnect = document.getElementById('btn-disconnect');
    const originalText = btnDisconnect.textContent;
    btnDisconnect.textContent = 'Desconectando...';
    btnDisconnect.disabled = true;

    try {
        const response = await fetch('/whatsapp/disconnect', { method: 'POST' });
        const data = await response.json();

        if (response.ok && data.success) {
            let message = '✅ ' + data.message + '\n\n';

            if (data.removed && data.removed.length > 0) {
                message += 'Ações realizadas:\n' + data.removed.map(item => '• ' + item).join('\n') + '\n\n';
            }

            message += '💡 Clique em "Iniciar Bot" quando quiser conectar novamente.';

            alert(message);
            checkBotStatus();
        } else {
            alert('❌ ' + (data.detail || data.message || 'Erro desconhecido'));
        }
    } catch (error) {
        console.error('Erro ao desconectar:', error);
        alert('❌ Erro ao desconectar: ' + error.message);
    } finally {
        // Restaurar botão
        btnDisconnect.textContent = originalText;
        btnDisconnect.disabled = false;
    }
}

async function refreshQRCode() {
    try {
        await fetch('/whatsapp/clear-qr', { method: 'POST' });
        alert('✅ QR Code será atualizado em breve...');
        setTimeout(checkBotStatus, 2000);
    } catch (error) {
        console.error('Erro ao atualizar QR:', error);
        alert('❌ Erro ao atualizar QR Code');
    }
}