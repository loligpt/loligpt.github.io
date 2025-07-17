document.addEventListener('DOMContentLoaded', () => {
    const chatbox = document.getElementById('chatbox');
    const userInput = document.getElementById('userinput');
    const sendBtn = document.getElementById('sendbtn');

    // !!! Вставьте ваш API-токен Hugging Face здесь !!!
    // Как мы договорились, мы не беспокоимся о его безопасности на данном этапе.
    const HUGGING_FACE_API_TOKEN = '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'; // <--- ЗАМЕНИТЕ ЭТО НА ВАШ ТОКЕН

    // Конечная точка Hugging Face Inference API для GPT-J
    const HUGGING_FACE_API_URL = 'https://api-inference.huggingface.co/models/EleutherAI/gpt-j-6B';

    // Массив для хранения истории диалога
    let chatHistory = [];

    // Функция для добавления сообщения в чат
    function addMessage(text, sender) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', sender);
        messageDiv.textContent = text;
        chatbox.appendChild(messageDiv);
        // Прокрутка чата вниз
        chatbox.scrollTop = chatbox.scrollHeight;
    }

    // Функция для отправки сообщения пользователя
    async function sendMessage() {
        const userMsg = userInput.value.trim();
        if (userMsg === '') {
            return; // Не отправляем пустое сообщение
        }

        // Добавляем сообщение пользователя в чат
        addMessage(userMsg, 'user');
        // Добавляем сообщение пользователя в историю для отправки API
        chatHistory.push({ role: 'user', content: userMsg });

        // Очищаем поле ввода
        userInput.value = '';

        // Добавляем временное сообщение о том, что бот "печатает..."
        addMessage('Loli-GPT печатает...', 'bot thinking');
        chatbox.scrollTop = chatbox.scrollHeight; // Прокрутка вниз

        // Генерируем ответ от Loli-GPT
        try {
            const botReply = await generateReply(chatHistory);
            // Удаляем временное сообщение "печатает..."
            const thinkingMessage = chatbox.querySelector('.bot.thinking');
            if (thinkingMessage) {
                thinkingMessage.remove();
            }
            addMessage(botReply, 'bot');
            // Добавляем ответ бота в историю
            chatHistory.push({ role: 'bot', content: botReply });
        } catch (error) {
            console.error('Ошибка при получении ответа от Loli-GPT:', error);
            // Удаляем временное сообщение "печатает..."
            const thinkingMessage = chatbox.querySelector('.bot.thinking');
            if (thinkingMessage) {
                thinkingMessage.remove();
            }
            addMessage('Произошла ошибка при получении ответа. Пожалуйста, попробуйте еще раз.', 'bot error');
        }
    }

    // Функция для генерации ответа от Hugging Face API
    async function generateReply(history) {
        // Hugging Face GPT-J не поддерживает массив сообщений напрямую.
        // Мы формируем один длинный промпт из всей истории.
        // Это упрощенный подход, который работает для GPT-J, но может быть неоптимален для других моделей.
        const fullPrompt = history.map(msg => {
            if (msg.role === 'user') {
                return `Пользователь: ${msg.content}`;
            } else {
                return `Loli-GPT: ${msg.content}`;
            }
        }).join('\n') + '\nLoli-GPT:'; // Добавляем 'Loli-GPT:' в конце, чтобы модель продолжила за себя

        const response = await fetch(HUGGING_FACE_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${HUGGING_FACE_API_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                inputs: fullPrompt,
                parameters: {
                    max_new_tokens: 150, // Максимальное количество токенов в ответе
                    temperature: 0.7,    // Креативность ответов (0.0-1.0)
                    top_p: 0.9,          // Отсечение по вероятности
                    do_sample: true,     // Включить семплирование (случайность)
                    return_full_text: false // Не возвращать полный промпт, только сгенерированный текст
                }
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`API error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`);
        }

        const data = await response.json();
        // Hugging Face API возвращает массив с объектом, содержащим 'generated_text'
        // Мы берем только сгенерированную часть, и обрезаем ее, чтобы избавиться от возможного повторения промпта
        let generatedText = data[0].generated_text;

        // Пост-обработка: удаляем из начала сгенерированного текста часть промпта,
        // если модель случайно его повторила, и обрезаем до первого "Пользователь:" или конца предложения.
        const promptEndIndex = fullPrompt.lastIndexOf('Loli-GPT:');
        if (generatedText.startsWith(fullPrompt.substring(promptEndIndex))) {
            generatedText = generatedText.substring(fullPrompt.substring(promptEndIndex).length).trim();
        }

        // Ограничиваем ответ до первого переноса строки или до первого вхождения "Пользователь:"
        const newLineIndex = generatedText.indexOf('\n');
        const userPrefixIndex = generatedText.indexOf('Пользователь:');
        let trimIndex = generatedText.length;

        if (newLineIndex !== -1 && newLineIndex < trimIndex) {
            trimIndex = newLineIndex;
        }
        if (userPrefixIndex !== -1 && userPrefixIndex < trimIndex) {
            trimIndex = userPrefixIndex;
        }
        generatedText = generatedText.substring(0, trimIndex).trim();

        return generatedText || "Я не смог сгенерировать ответ.";
    }

    // Обработчики событий
    sendBtn.addEventListener('click', sendMessage);
    userInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            sendMessage();
        }
    });

    // Приветственное сообщение
    addMessage('Привет! Я Loli-GPT. Чем могу помочь?', 'bot');
});