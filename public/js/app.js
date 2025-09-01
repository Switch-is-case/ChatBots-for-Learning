document.addEventListener('DOMContentLoaded', async () => {
    // --- DOM Element References ---
    const agentList = document.getElementById('agent-list');
    const iframeContainer = document.getElementById('iframe-container');
    const userSession = document.getElementById('user-session');
    const usernameDisplay = document.getElementById('username-display');
    const logoutButton = document.getElementById('logout-button');

    // --- State ---
    let currentUser = null;
    let currentAgentId = null;
    let currentConversationId = null;
    let welcomeShown = false;

    // --- Auth Functions ---
    async function checkAuth() {
        try {
            const response = await fetch('/api/auth/status', {
                headers: {
                    'Accept': 'application/json',
                }
            });

            if (response.status === 401) {
                // Не авторизован, перенаправляем на страницу входа
                window.location.href = '/login.html';
                return;
            }

            if (!response.ok) {
                throw new Error('Failed to fetch auth status');
            }

            const data = await response.json();
            if (data.isAuthenticated && data.user) {
                currentUser = data.user;
                setupAuthenticatedUI();
            } else {
                window.location.href = '/login.html';
            }
        } catch (error) {
            console.error('Auth check failed:', error);
            // В случае ошибки также перенаправляем на логин
            window.location.href = '/login.html';
        }
    }

    function setupAuthenticatedUI() {
        // Показываем информацию о пользователе и кнопку выхода
        usernameDisplay.textContent = `Привет, ${currentUser.username}!`;
        userSession.style.display = 'flex';

        // Навешиваем событие на кнопку выхода
        logoutButton.addEventListener('click', async () => {
            await fetch('/api/auth/logout', { method: 'POST' });
            window.location.href = '/login.html';
        });
    }

    // --- Chat UI Functions ---
    function showChatInput(agentId, conversationId) {
        const chatInputArea = document.getElementById('chat-input-area');
        const chatHeader = document.getElementById('chat-header');
        const currentAgentName = document.getElementById('current-agent-name');
        chatInputArea.style.display = 'block';
        chatHeader.style.display = 'block';
        currentAgentId = agentId;
        currentConversationId = conversationId || null;
        document.getElementById('chat-message').value = '';
        // Update agent name in header
        if (agentId) {
            const agentNames = {
                'agent1': 'IELTS Writing Assistant',
                'agent2': 'SAT Math Coach',
                'agent3': 'NUET QuizBot',
                'agent4': 'Grammar Corrector & Explainer',
                'agent5': 'Speaking Partner for IELTS',
                'agent6': 'Vocabulary Trainer',
                'agent7': 'Essay Topic Generator & Outliner',
                'agent8': 'Smart Vocabulary Trainer (IELTS & SAT)'
            };
            currentAgentName.textContent = agentNames[agentId] || 'Неизвестный агент';
        }
    }
    function hideChatInput() {
        const chatInputArea = document.getElementById('chat-input-area');
        const chatHeader = document.getElementById('chat-header');
        chatInputArea.style.display = 'none';
        chatHeader.style.display = 'none';
        currentAgentId = null;
        currentConversationId = null;
    }

    // --- Get welcome message from Dify ---
    async function getWelcomeMessage(agentId) {
        try {
            const response = await fetch('/api/chat/welcome', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ agentId })
            });
            if (!response.ok) throw new Error('Failed to get welcome message');
            const data = await response.json();
            return data.welcomeMessage;
        } catch (error) {
            console.error('Error getting welcome message:', error);
            return 'Привет! Чем могу помочь?';
        }
    }

    // --- Main App Logic ---
    function initializeAgentSelector() {
        // --- КОНФИГУРАЦИЯ ---
        const agentIframeUrls = {
            'agent1': 'https://udify.app/chatbot/PI3BPMWba7oybhLe',
            'agent2': 'https://udify.app/chatbot/bCVQLyW4bXmX3vVC',
            'agent3': 'https://udify.app/chatbot/pdJFQ0RnU3pu6DKG',
            'agent4': 'https://udify.app/chatbot/RXGv91LAl52EVNRD',
            'agent5': 'https://udify.app/chatbot/oSkFDDaW3vWIcQHH',
            'agent6': 'https://udify.app/chatbot/1zghNfnEuJLBBOfQ',
            'agent7': 'https://udify.app/chatbot/E55YvEk6zXbY4sej',
            'agent8': 'https://udify.app/chatbot/5mjyXffnGKaIhEnw'
        };

        agentList.addEventListener('click', async (event) => {
            event.preventDefault();
            const agentElement = event.target.closest('.list-group-item');

            if (agentElement) {
                const currentActive = agentList.querySelector('.active');
                if (currentActive) {
                    currentActive.classList.remove('active');
                }
                agentElement.classList.add('active');

                const agentId = agentElement.dataset.agentId;
                currentAgentId = agentId;
                currentConversationId = null;
                welcomeShown = false;
                await renderEmptyChatWithWelcome(agentId);
                showChatInput(agentId, null);
            }
        });
    }

    async function renderEmptyChatWithWelcome(agentId) {
        const chatMessagesArea = document.getElementById('chat-messages-area');
        if (chatMessagesArea) {
            chatMessagesArea.innerHTML = '';
            chatMessagesArea.style.overflowY = 'auto';
            chatMessagesArea.style.maxHeight = '400px';
            chatMessagesArea.style.minHeight = '200px';
            chatMessagesArea.style.padding = '10px';
            // Get and show welcome message from Dify
            const welcomeMessage = await getWelcomeMessage(agentId);
            const welcomeDiv = document.createElement('div');
            welcomeDiv.className = 'mb-2 p-2 rounded bg-light border';
            welcomeDiv.style.maxWidth = '80%';
            welcomeDiv.style.marginLeft = '0';
            welcomeDiv.innerHTML = `<div>${welcomeMessage}</div><div class='text-end'><small>AI</small></div>`;
            chatMessagesArea.appendChild(welcomeDiv);
            welcomeShown = true;
            // Auto-scroll to bottom
            chatMessagesArea.scrollTop = chatMessagesArea.scrollHeight;
        }
    }

    // --- Chat Send Logic ---
    const chatForm = document.getElementById('chat-form');
    const chatMessageInput = document.getElementById('chat-message');

    chatForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await sendChatMessage();
    });

    chatMessageInput.addEventListener('keydown', async (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            await sendChatMessage();
        }
    });

    // --- Add file input to chat input area (right side, inside input group) ---
    const chatInputArea = document.getElementById('chat-input-area');
    if (chatInputArea && !document.getElementById('chat-file')) {
        // Remove previous file input div if exists
        const oldDiv = document.getElementById('chat-file-group');
        if (oldDiv) oldDiv.remove();
        // Create input group
        const inputGroupDiv = document.createElement('div');
        inputGroupDiv.className = 'input-group';
        inputGroupDiv.id = 'chat-file-group';
        inputGroupDiv.innerHTML = `
            <textarea id="chat-message" class="form-control" rows="1" placeholder="Введите сообщение..." required style="resize:none;border-radius:0.375rem 0 0 0.375rem;"></textarea>
            <input type="file" id="chat-file" style="display:none;" />
            <button type="button" id="chat-file-btn" class="btn btn-outline-secondary" title="Прикрепить файл" style="border-radius:0;border-left:0;"><i class="bi bi-paperclip"></i></button>
            <button type="submit" class="btn btn-primary" style="border-radius:0 0.375rem 0.375rem 0;"><i class="bi bi-send"></i></button>
        `;
        // Replace old form content
        const chatForm = document.getElementById('chat-form');
        chatForm.innerHTML = '';
        chatForm.appendChild(inputGroupDiv);
        // File input logic
        const fileInput = document.getElementById('chat-file');
        const fileBtn = document.getElementById('chat-file-btn');
        let selectedFile = null;
        fileBtn.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', () => {
            if (fileInput.files && fileInput.files[0]) {
                selectedFile = fileInput.files[0];
                fileBtn.classList.add('text-success');
                fileBtn.title = fileInput.files[0].name;
            } else {
                selectedFile = null;
                fileBtn.classList.remove('text-success');
                fileBtn.title = 'Прикрепить файл';
            }
        });
        // Modify sendChatMessage to handle file upload
        const origSendChatMessage = sendChatMessage;
        sendChatMessage = async function() {
            if (selectedFile) {
                const formData = new FormData();
                formData.append('file', selectedFile);
                try {
                    const uploadRes = await fetch('/api/upload', {
                        method: 'POST',
                        body: formData
                    });
                    if (!uploadRes.ok) throw new Error('Ошибка загрузки файла');
                    const fileData = await uploadRes.json();
                    document.getElementById('chat-message').value = `[file:${fileData.fileId}:${fileData.originalName}:${fileData.mimetype}]`;
                    fileInput.value = '';
                    fileBtn.classList.remove('text-success');
                    fileBtn.title = 'Прикрепить файл';
                    selectedFile = null;
                } catch (e) {
                    renderAIMessage('Ошибка загрузки файла.');
                    return;
                }
            }
            await origSendChatMessage();
        }
    }

    async function sendChatMessage() {
        const message = chatMessageInput.value.trim();
        if (!message || !currentAgentId) return;
        chatMessageInput.value = '';
        // Show loading
        renderSendingMessage(message);
        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message,
                    agentId: currentAgentId,
                    conversationId: currentConversationId
                })
            });
            if (!response.ok) throw new Error('Ошибка отправки сообщения');
            const data = await response.json();
            if (data.newConversationId) {
                currentConversationId = data.newConversationId;
            }
            if (data.answer) {
                renderAIMessage(data.answer);
            }
            fetchChatHistory();
            if (currentConversationId) {
                await loadConversationMessages(currentConversationId);
            }
        } catch (error) {
            renderAIMessage('Ошибка отправки сообщения.');
            console.error(error);
        }
    }

    async function loadConversationMessages(conversationId) {
        try {
            const response = await fetch(`/api/conversations/${conversationId}`, {
                headers: { 'Accept': 'application/json' }
            });
            if (!response.ok) throw new Error('Failed to fetch conversation');
            const conversation = await response.json();
            renderConversationMessages(conversation);
            showChatInput(conversation.agentId, conversation._id);
        } catch (error) {
            console.error('Error loading conversation:', error);
        }
    }

    function renderConversationMessages(conversation) {
        const chatMessagesArea = document.getElementById('chat-messages-area');
        if (!chatMessagesArea) return;
        chatMessagesArea.innerHTML = '';
        chatMessagesArea.style.overflowY = 'auto';
        chatMessagesArea.style.maxHeight = '400px';
        chatMessagesArea.style.minHeight = '200px';
        chatMessagesArea.style.padding = '10px';
        if (!conversation.messages.length) {
            chatMessagesArea.innerHTML = '<div class="text-muted">Нет сообщений в этом чате.</div>';
        } else {
            conversation.messages.forEach(msg => {
                const msgDiv = document.createElement('div');
                msgDiv.className = `mb-2 p-2 rounded ${msg.sender === 'user' ? 'bg-primary text-white' : 'bg-light border'}`;
                msgDiv.style.maxWidth = '80%';
                msgDiv.style.marginLeft = msg.sender === 'user' ? 'auto' : '0';
                // Check for file message
                const fileMatch = msg.text.match(/^\[file:([^:]+):([^:]+):([^\]]+)\]$/);
                if (fileMatch) {
                    const fileId = fileMatch[1];
                    const originalName = fileMatch[2];
                    const mimetype = fileMatch[3];
                    if (mimetype.startsWith('image/')) {
                        msgDiv.innerHTML = `<div><a href="/api/file/${fileId}" target="_blank"><img src="/api/file/${fileId}" alt="${originalName}" style="max-width:200px;max-height:200px;" /></a></div><div class='text-end'><small>${originalName}</small></div>`;
                    } else {
                        msgDiv.innerHTML = `<div><a href="/api/file/${fileId}" target="_blank">📄 ${originalName}</a></div><div class='text-end'><small>Документ</small></div>`;
                    }
                } else {
                    msgDiv.innerHTML = `<div>${msg.text}</div><div class='text-end'><small>${new Date(msg.timestamp).toLocaleString()}</small></div>`;
                }
                chatMessagesArea.appendChild(msgDiv);
            });
        }
        // Auto-scroll to bottom
        chatMessagesArea.scrollTop = chatMessagesArea.scrollHeight;
    }

    function renderSendingMessage(message) {
        const chatMessagesArea = document.getElementById('chat-messages-area');
        if (chatMessagesArea) {
            const msgDiv = document.createElement('div');
            msgDiv.className = 'mb-2 p-2 rounded bg-primary text-white opacity-50';
            msgDiv.style.maxWidth = '80%';
            msgDiv.style.marginLeft = 'auto';
            msgDiv.innerHTML = `<div>${message}</div><div class='text-end'><small>Отправка...</small></div>`;
            chatMessagesArea.appendChild(msgDiv);
            chatMessagesArea.scrollTop = chatMessagesArea.scrollHeight;
        }
    }
    function renderAIMessage(message) {
        const chatMessagesArea = document.getElementById('chat-messages-area');
        if (chatMessagesArea) {
            const msgDiv = document.createElement('div');
            msgDiv.className = 'mb-2 p-2 rounded bg-light border';
            msgDiv.style.maxWidth = '80%';
            msgDiv.style.marginLeft = '0';
            msgDiv.innerHTML = `<div>${message}</div><div class='text-end'><small>AI</small></div>`;
            chatMessagesArea.appendChild(msgDiv);
            chatMessagesArea.scrollTop = chatMessagesArea.scrollHeight;
        }
    }

    // --- Chat History Functions ---
    async function fetchChatHistory() {
        try {
            const response = await fetch('/api/conversations', {
                headers: { 'Accept': 'application/json' }
            });
            if (!response.ok) throw new Error('Failed to fetch chat history');
            const conversations = await response.json();
            renderChatHistory(conversations);
        } catch (error) {
            console.error('Error fetching chat history:', error);
        }
    }

    function renderChatHistory(conversations) {
        const chatHistoryList = document.getElementById('chat-history-list');
        chatHistoryList.innerHTML = '';
        if (!conversations.length) {
            const emptyDiv = document.createElement('div');
            emptyDiv.className = 'list-group-item text-muted';
            emptyDiv.textContent = 'Нет истории чатов';
            chatHistoryList.appendChild(emptyDiv);
            return;
        }
        conversations.forEach(conv => {
            const item = document.createElement('div');
            item.className = 'list-group-item d-flex justify-content-between align-items-start';
            item.dataset.conversationId = conv._id;
            
            const contentDiv = document.createElement('div');
            contentDiv.className = 'flex-grow-1';
            contentDiv.style.cursor = 'pointer';
            contentDiv.innerHTML = `<b>${conv.title}</b><br><small>${conv.agentName} | ${new Date(conv.createdAt).toLocaleString()}</small>`;
            contentDiv.addEventListener('click', (e) => {
                e.preventDefault();
                loadConversationMessages(conv._id);
            });
            
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'btn btn-outline-danger btn-sm ms-2';
            deleteBtn.innerHTML = '<i class="bi bi-trash"></i>';
            deleteBtn.title = 'Удалить чат';
            deleteBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                if (confirm('Вы уверены, что хотите удалить этот чат?')) {
                    try {
                        const response = await fetch(`/api/conversations/${conv._id}`, {
                            method: 'DELETE',
                            headers: { 'Accept': 'application/json' }
                        });
                        if (response.ok) {
                            // Remove from current view if it's the active conversation
                            if (currentConversationId === conv._id) {
                                currentConversationId = null;
                                const chatMessagesArea = document.getElementById('chat-messages-area');
                                if (chatMessagesArea) {
                                    chatMessagesArea.innerHTML = '<h5 class="text-muted">Выберите чат из истории или начните новый.</h5>';
                                }
                            }
                            // Refresh chat history
                            fetchChatHistory();
                        } else {
                            alert('Ошибка при удалении чата.');
                        }
                    } catch (error) {
                        console.error('Error deleting conversation:', error);
                        alert('Ошибка при удалении чата.');
                    }
                }
            });
            
            item.appendChild(contentDiv);
            item.appendChild(deleteBtn);
            chatHistoryList.appendChild(item);
        });
    }

    // --- Initialization ---
    await checkAuth();
    // Если проверка пройдена, инициализируем остальную часть приложения
    if (currentUser) {
        initializeAgentSelector();
        fetchChatHistory();
        // Show default message when no agent is selected
        const chatMessagesArea = document.getElementById('chat-messages-area');
        if (chatMessagesArea) {
            chatMessagesArea.innerHTML = '<div class="d-flex justify-content-center align-items-center h-100"><h5 class="text-muted">Выберите бота из списка слева, чтобы начать чат</h5></div>';
        }
    }
});