let statusCheckInterval = null;

document.addEventListener("DOMContentLoaded", () => {
    console.log('✅ DOM carregado');
    setTimeout(() => {
        checkBotStatus();
        statusCheckInterval = setInterval(checkBotStatus, 5000);
    }, 200);
});

if (typeof showSuccess === 'undefined') {
    console.error('❌ modal.js não foi carregado!');
}

// DEPOIS SUBSTITUA AS FUNÇÕES:

async function startBot() {
    try {
        const response = await fetch('/whatsapp/start', { method: 'POST' });
        const data = await response.json();

        if (data.success) {
            showSuccess('Bot Iniciado', data.message, () => checkBotStatus());
        } else {
            showWarning('Aviso', data.message);
        }
    } catch (error) {
        showError('Erro ao Iniciar', 'Não foi possível iniciar o bot: ' + error.message);
    }
}

async function stopBot() {
    showConfirm(
        'Parar Bot',
        'Deseja realmente parar o bot?',
        async () => {
            try {
                const response = await fetch('/whatsapp/stop', { method: 'POST' });
                const data = await response.json();

                if (data.success) {
                    showSuccess('Bot Parado', data.message, () => checkBotStatus());
                } else {
                    showWarning('Aviso', data.message);
                }
            } catch (error) {
                showError('Erro ao Parar', 'Não foi possível parar o bot: ' + error.message);
            }
        }
    );
}

async function restartBot() {
    showConfirm(
        'Reiniciar Bot',
        'Deseja reiniciar o bot? Isso pode levar alguns segundos.',
        async () => {
            try {
                const response = await fetch('/whatsapp/restart', { method: 'POST' });
                const data = await response.json();

                if (data.success) {
                    showSuccess('Bot Reiniciado', data.message, () => {
                        setTimeout(checkBotStatus, 2000);
                    });
                } else {
                    showError('Erro', 'Não foi possível reiniciar o bot');
                }
            } catch (error) {
                showError('Erro ao Reiniciar', error.message);
            }
        }
    );
}

async function disconnectBot() {
    showDangerConfirm(
        'Desconectar WhatsApp',
        '<p>Isso irá:</p><ul><li>Parar o bot automaticamente</li><li>Remover a sessão do WhatsApp</li><li>Você precisará escanear o QR Code novamente</li></ul><p><strong>Deseja continuar?</strong></p>',
        'Desconectar',
        async () => {
            const btnDisconnect = document.getElementById('btn-disconnect');
            const originalText = btnDisconnect ? btnDisconnect.textContent : '';

            if (btnDisconnect) {
                btnDisconnect.innerHTML = '<span class="modal-spinner"></span> Desconectando...';
                btnDisconnect.disabled = true;
            }

            try {
                const response = await fetch('/whatsapp/disconnect', { method: 'POST' });
                const data = await response.json();

                if (response.ok && data.success) {
                    let message = '<p>' + data.message + '</p>';
                    if (data.removed && data.removed.length > 0) {
                        message += '<p><strong>Ações realizadas:</strong></p><ul>';
                        data.removed.forEach(item => {
                            message += '<li>' + item + '</li>';
                        });
                        message += '</ul>';
                    }
                    message += '<p>💡 Clique em "Iniciar Bot" para conectar novamente.</p>';

                    showSuccess('Desconectado', message, () => checkBotStatus());
                } else {
                    showError('Erro ao Desconectar', data.detail || data.message || 'Erro desconhecido');
                }
            } catch (error) {
                showError('Erro', 'Não foi possível desconectar: ' + error.message);
            } finally {
                if (btnDisconnect) {
                    btnDisconnect.textContent = originalText;
                    btnDisconnect.disabled = false;
                }
            }
        }
    );
}

async function refreshQRCode() {
    try {
        await fetch('/whatsapp/clear-qr', { method: 'POST' });
        showSuccess('QR Code Atualizado', 'O QR Code será atualizado em breve...', () => {
            setTimeout(checkBotStatus, 2000);
        });
    } catch (error) {
        showError('Erro', 'Não foi possível atualizar o QR Code');
    }
}

window.addEventListener('beforeunload', () => {
    if (statusCheckInterval) {
        clearInterval(statusCheckInterval);
    }
});

async function checkBotStatus() {
    try {
        const response = await fetch('/whatsapp/status');
        const data = await response.json();
        console.log('📊 Status:', data);
        updateStatusUI(data);
    } catch (error) {
        console.error('❌ Erro ao verificar status:', error);
    }
}

function updateStatusUI(data) {
    try {
        // Buscar elementos
        const statusWrapper = document.querySelector('.status-indicator-wrapper');
        const statusText = document.getElementById('status-text');
        const statusDetail = document.getElementById('status-detail');
        const qrContainer = document.getElementById('qr-container');
        const connectedInfo = document.getElementById('connected-info');
        const connectedPhone = document.getElementById('connected-phone');
        const connectedBotType = document.getElementById('connected-bot-type');
        const btnRestart = document.getElementById('btn-restart-bot');
        const btnDisconnect = document.getElementById('btn-disconnect');

        // Verificação de segurança
        if (!statusText || !statusDetail) {
            console.warn('⚠️ Elementos não encontrados');
            return;
        }

        // Ícones
        const icons = {
            connected: `<svg class="status-icon connected" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`,
            qrPending: `<svg class="status-icon qr-pending" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>`,
            disconnected: `<svg class="status-icon disconnected" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`,
            loading: `<svg class="status-icon loading" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line></svg>`
        };

        // Limpar classes
        if (statusWrapper) {
            statusWrapper.className = 'status-indicator-wrapper';
        }

        // Atualizar botão
        if (btnRestart) {
            if (data.is_running) {
                btnRestart.textContent = 'Parar Bot';
                btnRestart.onclick = stopBot;
                btnRestart.className = 'button-danger';
            } else {
                btnRestart.textContent = 'Iniciar Bot';
                btnRestart.onclick = startBot;
                btnRestart.className = 'button-primary';
            }
        }

        // Atualizar UI
        if (!data.is_running) {
            if (statusWrapper) statusWrapper.classList.add('status-disconnected-wrapper');
            statusText.innerHTML = icons.disconnected + '<span>Desconectado</span>';
            statusDetail.textContent = 'Clique em "Iniciar Bot" para começar';
            if (qrContainer) qrContainer.style.display = 'none';
            if (connectedInfo) connectedInfo.style.display = 'none';
            if (btnDisconnect) btnDisconnect.style.display = 'none';
        } else if (data.status === 'connected') {
            if (statusWrapper) statusWrapper.classList.add('status-connected-wrapper');
            statusText.innerHTML = icons.connected + '<span>Conectado</span>';
            statusDetail.textContent = 'Bot está ativo e pronto para receber mensagens';
            if (qrContainer) qrContainer.style.display = 'none';
            if (connectedInfo) connectedInfo.style.display = 'block';
            if (btnDisconnect) btnDisconnect.style.display = 'inline-block';
            if (data.phone_number && connectedPhone) connectedPhone.textContent = data.phone_number;
            if (data.bot_type && connectedBotType) connectedBotType.textContent = data.bot_type === 'rule' ? 'Programado' : 'IA';
        } else if (data.status === 'qr_pending') {
            if (statusWrapper) statusWrapper.classList.add('status-qr-wrapper');
            statusText.innerHTML = icons.qrPending + '<span>Aguardando Conexão</span>';
            statusDetail.textContent = 'Escaneie o QR Code para conectar';
            if (qrContainer) qrContainer.style.display = 'block';
            if (connectedInfo) connectedInfo.style.display = 'none';
            if (btnDisconnect) btnDisconnect.style.display = 'none';
            if (data.qr_code) {
                const qrImage = document.getElementById('qr-image');
                if (qrImage) qrImage.src = `data:image/png;base64,${data.qr_code}`;
            }
        } else {
            if (statusWrapper) statusWrapper.classList.add('status-qr-wrapper');
            statusText.innerHTML = icons.loading + '<span>Iniciando...</span>';
            statusDetail.textContent = 'Bot está iniciando, aguarde o QR Code aparecer';
            if (qrContainer) qrContainer.style.display = 'none';
            if (connectedInfo) connectedInfo.style.display = 'none';
            if (btnDisconnect) btnDisconnect.style.display = 'none';
        }

        console.log('✅ UI atualizada');
    } catch (error) {
        console.error('❌ Erro no updateStatusUI:', error);
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
        alert('❌ Erro: ' + error.message);
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
        alert('❌ Erro: ' + error.message);
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
        }
    } catch (error) {
        alert('❌ Erro: ' + error.message);
    }
}

async function disconnectBot() {
    if (!confirm('⚠️ DESCONECTAR WHATSAPP\n\nIsso irá:\n• Parar o bot automaticamente\n• Remover a sessão do WhatsApp\n• Você precisará escanear o QR Code novamente\n\nDeseja continuar?')) return;

    const btnDisconnect = document.getElementById('btn-disconnect');
    const originalText = btnDisconnect ? btnDisconnect.textContent : '';
    if (btnDisconnect) {
        btnDisconnect.textContent = 'Desconectando...';
        btnDisconnect.disabled = true;
    }

    try {
        const response = await fetch('/whatsapp/disconnect', { method: 'POST' });
        const data = await response.json();
        if (response.ok && data.success) {
            let msg = '✅ ' + data.message + '\n\n';
            if (data.removed && data.removed.length > 0) {
                msg += 'Ações:\n' + data.removed.map(i => '• ' + i).join('\n') + '\n\n';
            }
            msg += '💡 Clique em "Iniciar Bot" para conectar novamente.';
            alert(msg);
            checkBotStatus();
        } else {
            alert('❌ ' + (data.detail || data.message || 'Erro'));
        }
    } catch (error) {
        alert('❌ Erro: ' + error.message);
    } finally {
        if (btnDisconnect) {
            btnDisconnect.textContent = originalText;
            btnDisconnect.disabled = false;
        }
    }
}

async function refreshQRCode() {
    try {
        await fetch('/whatsapp/clear-qr', { method: 'POST' });
        alert('✅ QR Code será atualizado...');
        setTimeout(checkBotStatus, 2000);
    } catch (error) {
        alert('❌ Erro ao atualizar QR');
    }
}