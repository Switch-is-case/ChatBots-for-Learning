// Загружаем переменные окружения из файла .env
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 3000;

// --- Middleware ---
app.use(cors({
    origin: 'http://localhost:3000', 
    credentials: true
}));
app.use(express.json());
app.use(cookieParser(process.env.COOKIE_SECRET));
app.use(express.static('public'));

// --- Подключение к MongoDB ---
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('Successfully connected to MongoDB'))
    .catch(err => console.error('MongoDB connection error:', err));

// --- Модель пользователя (User Schema) ---
const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        minlength: 3
    },
    password: {
        type: String,
        required: true
    }
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

// --- Модель диалога (Conversation Schema) ---
const messageSchema = new mongoose.Schema({
    sender: { type: String, required: true, enum: ['user', 'ai'] },
    text: { type: String, required: true },
    timestamp: { type: Date, default: Date.now }
});

const conversationSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    agentId: { type: String, required: true },
    agentName: { type: String, required: true },
    difyConversationId: { type: String },
    title: { type: String, required: true },
    messages: [messageSchema]
}, { timestamps: true });

const Conversation = mongoose.model('Conversation', conversationSchema);

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
}

// Multer storage config: save files with unique names
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadsDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, file.fieldname + '-' + uniqueSuffix + ext);
    }
});
const upload = multer({ storage });

// --- Middleware для проверки аутентификации ---
const requireAuth = async (req, res, next) => {
    const { sessionId } = req.signedCookies;
    if (!sessionId) {
        return res.status(401).json({ message: 'Authentication required.' });
    }
    try {
        const user = await User.findById(sessionId);
        if (!user) {
            return res.status(401).json({ message: 'Invalid session.' });
        }
        req.user = user; // Добавляем пользователя в объект запроса
        next();
    } catch (error) {
        res.status(500).json({ message: 'Server error during authentication check.' });
    }
};


// --- Эндпоинты для аутентификации ---

/**
 * @route   POST /api/auth/register
 * @desc    Регистрация нового пользователя
 * @access  Public
 */
app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, password } = req.body;

        // Проверка входных данных
        if (!username || !password || password.length < 6) {
            return res.status(400).json({ message: 'Please enter a username and a password of at least 6 characters.' });
        }

        // Проверка, существует ли пользователь
        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.status(400).json({ message: 'User with this username already exists.' });
        }

        // Хеширование пароля
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Создание нового пользователя
        const newUser = new User({ username, password: hashedPassword });
        await newUser.save();

        res.status(201).json({ message: 'User registered successfully!' });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ message: 'Server error during registration.' });
    }
});

/**
 * @route   POST /api/auth/login
 * @desc    Вход пользователя
 * @access  Public
 */
app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        // Проверка, существует ли пользователь
        const user = await User.findOne({ username });
        if (!user) {
            return res.status(400).json({ message: 'Invalid credentials.' });
        }

        // Проверка пароля
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials.' });
        }

        // Установка куки сессии
        res.cookie('sessionId', user._id.toString(), {
            httpOnly: true,
            signed: true,
            maxAge: 24 * 60 * 60 * 1000, // 1 день
            sameSite: 'lax'
        });

        res.json({ message: 'Logged in successfully!', user: { id: user._id, username: user.username } });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Server error during login.' });
    }
});

/**
 * @route   POST /api/auth/logout
 * @desc    Выход пользователя
 * @access  Private
 */
app.post('/api/auth/logout', (req, res) => {
    res.clearCookie('sessionId');
    res.json({ message: 'Logged out successfully.' });
});

/**
 * @route   GET /api/auth/status
 * @desc    Проверка статуса аутентификации
 * @access  Private
 */
app.get('/api/auth/status', async (req, res) => {
    try {
        const { sessionId } = req.signedCookies;
        if (!sessionId) {
            return res.status(401).json({ isAuthenticated: false });
        }

        const user = await User.findById(sessionId).select('-password');
        if (!user) {
            return res.status(401).json({ isAuthenticated: false });
        }

        res.json({ isAuthenticated: true, user: { id: user._id, username: user.username } });

    } catch (error) {
        res.status(500).json({ message: 'Server error.' });
    }
});

// --- Конфигурация для AI-агентов ---
const agentsConfig = {
    'agent1': {
        apiKey: process.env.DIFY_API_KEY_AGENT1,
        apiUrl: process.env.DIFY_API_URL_AGENT1,
        name: 'IELTS Writing Assistant'
    },
    'agent2': {
        apiKey: process.env.DIFY_API_KEY_AGENT2,
        apiUrl: process.env.DIFY_API_URL_AGENT2,
        name: 'SAT Math Coach'
    },
    'agent3': {
        apiKey: process.env.DIFY_API_KEY_AGENT3,
        apiUrl: process.env.DIFY_API_URL_AGENT3,
        name: 'NUET QuizBot'
    },
    'agent4': {
        apiKey: process.env.DIFY_API_KEY_AGENT4,
        apiUrl: process.env.DIFY_API_URL_AGENT4,
        name: 'Grammar Corrector & Explainer'
    },
    'agent5': {
        apiKey: process.env.DIFY_API_KEY_AGENT5,
        apiUrl: process.env.DIFY_API_URL_AGENT5,
        name: 'Speaking Partner for IELTS'
    },
    'agent6': {
        apiKey: process.env.DIFY_API_KEY_AGENT6,
        apiUrl: process.env.DIFY_API_URL_AGENT6,
        name: 'Vocabulary Trainer'
    },
    'agent7': {
        apiKey: process.env.DIFY_API_KEY_AGENT7,
        apiUrl: process.env.DIFY_API_URL_AGENT7,
        name: 'Essay Topic Generator & Outliner'
    },
    'agent8': {
        apiKey: process.env.DIFY_API_KEY_AGENT8,
        apiUrl: process.env.DIFY_API_URL_AGENT8,
        name: 'Smart Vocabulary Trainer (IELTS & SAT)'
    }
};

// --- Эндпоинты для чата ---

/**
 * @route   POST /api/chat
 * @desc    Обработка сообщений чата с Dify
 * @access  Private
 */
app.post('/api/chat', requireAuth, async (req, res) => {
    const { message, agentId, conversationId } = req.body;
    const userId = req.user._id;

    if (!message || !agentId) {
        return res.status(400).json({ error: 'Message and agentId are required.' });
    }

    const agent = agentsConfig[agentId];
    if (!agent) {
        return res.status(400).json({ error: 'Invalid agent ID.' });
    }

    try {
        let conv;
        if (conversationId) {
            conv = await Conversation.findById(conversationId);
            if (!conv) return res.status(404).json({ error: 'Conversation not found.' });
        } else {
            conv = new Conversation({
                userId,
                agentId,
                agentName: agent.name,
                title: message.substring(0, 40) + (message.length > 40 ? '...' : ''),
                messages: [],
            });
        }

        // Сохраняем сообщение пользователя
        conv.messages.push({ sender: 'user', text: message });
        await conv.save();

        // Отправляем запрос к Dify API в blocking (JSON) режиме
        const response = await require('axios').post(
            agent.apiUrl,
            {
                inputs: {},
                query: message,
                user: userId.toString(),
                response_mode: 'blocking',
                conversation_id: conv.difyConversationId || ''
            },
            {
                headers: { 'Authorization': `Bearer ${agent.apiKey}`, 'Content-Type': 'application/json' },
                responseType: 'json'
            }
        );

        // Получаем ответ от Dify
        const aiAnswer = response.data.answer || response.data.choices?.[0]?.message?.content || '';
        conv.difyConversationId = response.data.conversation_id || conv.difyConversationId;
        conv.messages.push({ sender: 'ai', text: aiAnswer });
        await conv.save();

        // Возвращаем обычный JSON-ответ клиенту
        res.json({ answer: aiAnswer, conversationId: conv.difyConversationId, newConversationId: !conversationId ? conv._id.toString() : undefined, title: conv.title });
    } catch (error) {
        console.error('Error in /api/chat:', error.message);
        res.status(500).json({ error: 'Failed to process chat message.' });
    }
});

/**
 * @route   GET /api/conversations
 * @desc    Получение списка диалогов пользователя
 * @access  Private
 */
app.get('/api/conversations', requireAuth, async (req, res) => {
    try {
        const conversations = await Conversation.find({ userId: req.user._id })
            .select('title agentName createdAt')
            .sort({ createdAt: -1 });
        res.json(conversations);
    } catch (error) {
        res.status(500).json({ message: 'Server error while fetching conversations.' });
    }
});

/**
 * @route   GET /api/conversations/:id
 * @desc    Получение сообщений конкретного диалога
 * @access  Private
 */
app.get('/api/conversations/:id', requireAuth, async (req, res) => {
    try {
        const conversation = await Conversation.findOne({
            _id: req.params.id,
            userId: req.user._id
        });
        if (!conversation) {
            return res.status(404).json({ message: 'Conversation not found.' });
        }
        res.json(conversation);
    } catch (error) {
        res.status(500).json({ message: 'Server error while fetching conversation details.' });
    }
});

/**
 * @route   DELETE /api/conversations/:id
 * @desc    Удаление конкретного диалога
 * @access  Private
 */
app.delete('/api/conversations/:id', requireAuth, async (req, res) => {
    try {
        const conversation = await Conversation.findOneAndDelete({
            _id: req.params.id,
            userId: req.user._id
        });
        if (!conversation) {
            return res.status(404).json({ message: 'Conversation not found.' });
        }
        res.json({ message: 'Conversation deleted successfully.' });
    } catch (error) {
        res.status(500).json({ message: 'Server error while deleting conversation.' });
    }
});

// Private file upload endpoint
app.post('/api/upload', requireAuth, upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded.' });
    }
    // Return only a file ID (not a public URL)
    res.json({ fileId: req.file.filename, originalName: req.file.originalname, mimetype: req.file.mimetype });
});

// Private file download endpoint
app.get('/api/file/:id', requireAuth, (req, res) => {
    const filePath = path.join(uploadsDir, req.params.id);
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'File not found.' });
    }
    res.download(filePath);
});

/**
 * @route   POST /api/chat/welcome
 * @desc    Получение приветственного сообщения от Dify бота
 * @access  Private
 */
app.post('/api/chat/welcome', requireAuth, async (req, res) => {
    const { agentId } = req.body;
    const userId = req.user._id;

    if (!agentId) {
        return res.status(400).json({ error: 'Agent ID is required.' });
    }

    const agent = agentsConfig[agentId];
    if (!agent) {
        return res.status(400).json({ error: 'Invalid agent ID.' });
    }

    try {
        // Отправляем запрос к Dify API для получения приветственного сообщения
        const response = await require('axios').post(
            agent.apiUrl,
            {
                inputs: {},
                query: "", // Пустое сообщение для получения приветствия
                user: userId.toString(),
                response_mode: 'blocking'
            },
            {
                headers: { 'Authorization': `Bearer ${agent.apiKey}`, 'Content-Type': 'application/json' },
                responseType: 'json'
            }
        );

        const welcomeMessage = response.data.answer || response.data.choices?.[0]?.message?.content || 'Привет! Чем могу помочь?';
        
        res.json({ welcomeMessage });
    } catch (error) {
        console.error('Error getting welcome message:', error.message);
        res.status(500).json({ error: 'Failed to get welcome message.' });
    }
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});