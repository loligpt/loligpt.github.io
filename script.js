document.addEventListener('DOMContentLoaded', () => {
    // Получаем ссылки на DOM-элементы
    const chatbox = document.getElementById('chatbox');
    const userInput = document.getElementById('userinput');
    const sendBtn = document.getElementById('sendbtn');

    // !!! ВСТАВЬТЕ ВАШ АКТУАЛЬНЫЙ API-ТОКЕН HUGGING FACE ЗДЕСЬ !!!
    // Получите его на https://huggingface.co/settings/tokens
    const HUGGING_FACE_API_TOKEN = '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'; 

    // Конечная точка Hugging Face Inference API для более доступной модели
    // GPT-Neo 1.3B - хорошая модель для начала, GPT-J-6B может быть недоступна/слишком медленной для free tier.
    const API_URL = 'https://api-inference.huggingface.co/models/EleutherAI/gpt-neo-1.3B';

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
            // 5. Генерируем ответ от Loli-GPT через Hugging Face API
            // Для GPT-Neo 1.3B (и подобных) лучше передавать только последний промпт,
            // или очень короткую историю, иначе модель может "забыть" суть.
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
     * Отправляет запрос к Hugging Face API для генерации ответа.
     * @param {string} textPrompt - Текст для отправки в модель (последнее сообщение пользователя).
     * @returns {Promise<string>} Сгенерированный текст ответа.
     */
    async function generateReply(textPrompt) {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${HUGGING_FACE_API_TOKEN}`, // Ваш API-токен
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                inputs: textPrompt, // Отправляем только последнее сообщение пользователя как input
                parameters: {
                    max_new_tokens: 150,     // Максимальное количество новых токенов
                    temperature: 0.7,        // Степень случайности/креативности (от 0.0 до 1.0)
                    top_p: 0.9,              // Выборка токенов с кумулятивной вероятностью до 0.9
                    do_sample: true,         // Включение случайной выборки
                    return_full_text: false  // Возвращать только сгенерированный текст, без входного промпта
                },
                options: {
                    wait_for_model: true // Важно: дождаться загрузки модели, если она спит (для free tier)
                }
            })
        });

        // Проверяем статус ответа от API
        if (!response.ok) {
            let errorMessage = '';
            try {
                const errorData = await response.json();
                errorMessage = errorData.error || response.statusText;
            } catch (e) {
                errorMessage = response.statusText || 'Неизвестная ошибка';
            }
            throw new Error(`API: ${response.status} - ${errorMessage}`);
        }

        const data = await response.json();
        let generatedText = '';

        // Hugging Face Inference API может возвращать ответ в разных форматах,
        // в зависимости от модели и версии API. Парсим результат.
        if (Array.isArray(data) && data[0] && data[0].generated_text) {
             generatedText = data[0].generated_text;
        } else if (data && data.generated_text) {
             generatedText = data.generated_text;
        }

        // Пост-обработка: удаляем из начала сгенерированного текста входной промпт,
        // т.к. return_full_text: false не всегда работает идеально для всех моделей.
        if (generatedText.startsWith(textPrompt)) {
            generatedText = generatedText.substring(textPrompt.length).trim();
        }

        // Дополнительная очистка от мусора, который иногда генерируют LLM (например, "Пользователь:")
        generatedText = generatedText.replace(/Пользователь:\s*/g, '')
                                     .replace(/Loli-GPT:\s*/g, '')
                                     .trim();

        // Возвращаем сгенерированный текст или сообщение по умолчанию
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
