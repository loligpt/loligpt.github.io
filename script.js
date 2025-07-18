document.addEventListener('DOMContentLoaded', () => {
    // Получаем ссылки на DOM-элементы
    const chatbox = document.getElementById('chatbox');
    const userInput = document.getElementById('userinput');
    const sendBtn = document.getElementById('sendbtn');

    // API_URL теперь указывает на вашу Netlify Function, а не напрямую на Hugging Face
    const API_URL = '/.netlify/functions/generateReply';

    // Массив для хранения истории диалога.
    // Каждый объект содержит роль (user/bot) и контент сообщения.
    let chatHistory = [];

    /**
     * Добавляет новое сообщение в чат.
     * @param {string} text - Текст сообщения.
     * @param {string} sender - Отправитель сообщения ('user' или 'bot').
     * @param {string} [specialClass] - Дополнительный класс ('thinking' или 'error').
     * @returns {HTMLElement} Созданный DOM-элемент сообщения.
     */
    function addMessage(text, sender, specialClass = '') {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', sender); // Базовый класс и класс отправителя

        if (specialClass) { // Если передан дополнительный класс
            messageDiv.classList.add(specialClass);
        }

        messageDiv.textContent = text;       // Устанавливаем текстовое содержимое
        chatbox.appendChild(messageDiv);     // Добавляем сообщение в чатбокс

        // Прокручиваем чатбокс вниз, чтобы видеть последнее сообщение
        chatbox.scrollTop = chatbox.scrollHeight;

        return messageDiv; // Возвращаем ссылку на созданный div, чтобы его можно было удалить
    }

    /**
     * Обрабатывает отправку сообщения пользователем.
     */
    async function sendMessage() {
        const userMsg = userInput.value.trim(); // Получаем текст из поля ввода и удаляем лишние пробелы

        if (userMsg === '') {
            return; // Если сообщение пустое, ничего не делаем
        }

        // 1. Добавляем сообщение пользователя в чат
        addMessage(userMsg, 'user');
        // 2. Добавляем сообщение пользователя в историю диалога
        chatHistory.push({ role: 'user', content: userMsg });

        // 3. Очищаем поле ввода
        userInput.value = '';

        // 4. Добавляем временное сообщение "Loli-GPT печатает..."
        const thinkingMessageDiv = addMessage('Loli-GPT печатает...', 'bot', 'thinking');
        
        try {
            // 5. Генерируем ответ от Loli-GPT через Netlify Function
            const botReply = await generateReply(userMsg); 

            // 6. Удаляем временное сообщение "печатает..."
            if (thinkingMessageDiv) { // Проверяем, что div всё ещё существует
                thinkingMessageDiv.remove();
            }

            // 7. Добавляем ответ бота в чат
            addMessage(botReply, 'bot');
            // 8. Добавляем ответ бота в историю диалога
            chatHistory.push({ role: 'bot', content: botReply });

        } catch (error) {
            // Обработка ошибок при получении ответа от API
            console.error('Ошибка при получении ответа от Loli-GPT:', error);

            // Удаляем временное сообщение "печатает..." в случае ошибки
            if (thinkingMessageDiv) {
                thinkingMessageDiv.remove();
            }
            // 9. Выводим сообщение об ошибке в чат
            addMessage('Произошла ошибка: ' + error.message, 'bot', 'error');
        }
    }

    /**
     * Отправляет запрос к вашей Netlify Function для генерации ответа.
     * @param {string} textPrompt - Текст для отправки в модель (последнее сообщение пользователя).
     * @returns {Promise<string>} Сгенерированный текст ответа.
     */
    async function generateReply(textPrompt) {
        // Отправляем запрос на нашу Netlify Function
        const response = await fetch(API_URL, { // API_URL теперь указывает на вашу Netlify Function
            method: 'POST',
            headers: {
                'Content-Type': 'application/json' // Важно: Content-Type
            },
            // Отправляем только промпт, токен и параметры Hugging Face Function добавит сама
            body: JSON.stringify({ prompt: textPrompt })
        });

        // Обработка ответа от Netlify Function
        if (!response.ok) {
            let errorMessage = '';
            try {
                const errorData = await response.json();
                errorMessage = errorData.error || response.statusText;
            } catch (e) {
                errorMessage = response.statusText || 'Неизвестная ошибка';
            }
            throw new Error(`Ошибка от прокси-сервера: ${response.status} - ${errorMessage}`);
        }

        const data = await response.json();
        // Netlify Function возвращает объект с полем 'reply'
        return data.reply || "Я не смог сгенерировать ответ.";
    }

    // Обработчик события для кнопки "Отправить"
    sendBtn.addEventListener('click', sendMessage);

    // Обработчик события для клавиши Enter в поле ввода
    userInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            sendMessage();
        }
    });

    // Приветственное сообщение от бота при загрузке страницы
    addMessage('Привет! Я Loli-GPT. Чем могу помочь?', 'bot');
});
