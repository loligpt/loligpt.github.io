document.addEventListener('DOMContentLoaded', () => {
    // Получаем ссылки на DOM-элементы
    const chatbox = document.getElementById('chatbox');
    const userInput = document.getElementById('userinput');
    const sendBtn = document.getElementById('sendbtn');

    // !!! Вставьте ваш API-токен Hugging Face здесь !!!
    // Убедитесь, что это ваш актуальный токен.
    const HUGGING_FACE_API_TOKEN = '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'; 

    // Конечная точка Hugging Face Inference API для модели EleutherAI/gpt-j-6B
    const HUGGING_FACE_API_URL = 'https://api-inference.huggingface.co/models/EleutherAI/gpt-j-6B';

    // Массив для хранения истории диалога. 
    // Каждый объект содержит роль (user/bot) и контент сообщения.
    let chatHistory = [];

    /**
     * Добавляет новое сообщение в чат.
     * @param {string} text - Текст сообщения.
     * @param {string} sender - Отправитель сообщения ('user' или 'bot').
     * @returns {HTMLElement} Созданный DOM-элемент сообщения.
     */
    function addMessage(text, sender) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message'); // Базовый класс для всех сообщений
        messageDiv.classList.add(sender);    // Класс отправителя ('user' или 'bot')
        messageDiv.textContent = text;       // Устанавливаем текстовое содержимое
        chatbox.appendChild(messageDiv);     // Добавляем сообщение в чатбокс

        // Прокручиваем чатбокс вниз, чтобы видеть последнее сообщение
        chatbox.scrollTop = chatbox.scrollHeight;

        return messageDiv; // Возвращаем ссылку на созданный div, это важно для "печатает..." индикатора
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

        // 4. Добавляем временное сообщение "Loli-GPT печатает..." и соответствующий класс
        const thinkingMessageDiv = addMessage('Loli-GPT печатает...', 'bot');
        thinkingMessageDiv.classList.add('thinking'); // Добавляем класс 'thinking' для анимации и стилизации

        try {
            // 5. Генерируем ответ от Loli-GPT через Hugging Face API
            const botReply = await generateReply(chatHistory);

            // 6. Удаляем временное сообщение "печатает..."
            if (thinkingMessageDiv) {
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
            addMessage('Произошла ошибка при получении ответа. Пожалуйста, попробуйте еще раз.', 'bot error');
        }
    }

    /**
     * Отправляет запрос к Hugging Face API для генерации ответа.
     * @param {Array<Object>} history - История диалога для формирования промпта.
     * @returns {Promise<string>} Сгенерированный текст ответа.
     */
    async function generateReply(history) {
        // Формируем единый промпт из всей истории диалога, 
        // так как GPT-J не поддерживает массив сообщений напрямую.
        const fullPrompt = history.map(msg => {
            if (msg.role === 'user') {
                return `Пользователь: ${msg.content}`;
            } else {
                return `Loli-GPT: ${msg.content}`;
            }
        }).join('\n') + '\nLoli-GPT:'; // Добавляем "Loli-GPT:" в конце, чтобы модель продолжила генерацию от своего имени

        // Отправляем POST-запрос к Hugging Face Inference API
        const response = await fetch(HUGGING_FACE_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${HUGGING_FACE_API_TOKEN}`, // Ваш API-токен
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                inputs: fullPrompt,
                parameters: {
                    max_new_tokens: 150,     // Максимальное количество новых токенов в ответе
                    temperature: 0.7,        // Степень случайности/креативности (от 0.0 до 1.0)
                    top_p: 0.9,              // Выборка токенов с кумулятивной вероятностью до 0.9
                    do_sample: true,         // Включение случайной выборки (для более разнообразных ответов)
                    return_full_text: false  // Возвращать только сгенерированный текст, без входного промпта
                }
            })
        });

        // Проверяем статус ответа от API
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`API error: ${response.status} ${response.statusText} - ${JSON.JSON.stringify(errorData)}`);
        }

        const data = await response.json();
        let generatedText = data[0].generated_text;

        // Пост-обработка сгенерированного текста:
        // Убираем возможные повторения промпта или начала следующего диалога.
        const promptEndIndex = fullPrompt.lastIndexOf('Loli-GPT:');
        if (generatedText.startsWith(fullPrompt.substring(promptEndIndex))) {
            generatedText = generatedText.length > fullPrompt.substring(promptEndIndex).length ? generatedText.substring(fullPrompt.substring(promptEndIndex).length).trim() : '';
        }

        // Обрезаем текст до первого переноса строки или до следующего "Пользователь:"
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