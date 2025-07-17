// Функция для добавления сообщения в чат (возвращает созданный элемент)
    function addMessage(text, sender) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', sender); // 'sender' будет 'user' или 'bot'
        messageDiv.textContent = text;
        chatbox.appendChild(messageDiv);
        chatbox.scrollTop = chatbox.scrollHeight; // Прокрутка чата вниз
        return messageDiv; // Возвращаем созданный элемент
    }

    // ... внутри функции sendMessage ...

        // Добавляем временное сообщение о том, что бот "печатает..."
        // Теперь addMessage возвращает DOM-элемент, чтобы мы могли добавить к нему класс 'thinking'
        const thinkingMessageDiv = addMessage('Loli-GPT печатает...', 'bot');
        thinkingMessageDiv.classList.add('thinking'); // Добавляем класс 'thinking' отдельно
        chatbox.scrollTop = chatbox.scrollHeight; // Прокрутка вниз

        // Генерируем ответ от Loli-GPT
        try {
            const botReply = await generateReply(chatHistory);
            // Удаляем временное сообщение "печатает..." используя ссылку на элемент
            if (thinkingMessageDiv) {
                thinkingMessageDiv.remove();
            }
            addMessage(botReply, 'bot');
            // Добавляем ответ бота в историю
            chatHistory.push({ role: 'bot', content: botReply });
        } catch (error) {
            console.error('Ошибка при получении ответа от Loli-GPT:', error);
            // Удаляем временное сообщение "печатает..."
            if (thinkingMessageDiv) {
                thinkingMessageDiv.remove();
            }
            addMessage('Произошла ошибка при получении ответа. Пожалуйста, попробуйте еще раз.', 'bot error');
        }
    }