// netlify/functions/generateReply.js
// Этот файл выполняется на сервере Netlify (Node.js)

const fetch = require('node-fetch'); // Импортируем node-fetch для HTTP-запросов
// require('dotenv').config(); // Эта строка нужна только если вы используете .env файл локально.
                           // На Netlify переменные окружения доступны через process.env

exports.handler = async function(event, context) {
  // Получаем Hugging Face API токен из переменных окружения Netlify
  const HUGGING_FACE_API_TOKEN = process.env.HUGGING_FACE_API_TOKEN;
  const API_URL = 'https://api-inference.huggingface.co/models/openai-community/gpt2'; // Убедитесь, что это модель, которую вы хотите использовать

  // Проверка наличия API токена (ВАЖНО для безопасности!)
  if (!HUGGING_FACE_API_TOKEN) {
    console.error('HUGGING_FACE_API_TOKEN is not set in Netlify Environment Variables.');
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Серверная ошибка: API токен не настроен.' }),
    };
  }

  // Проверяем, что запрос пришел методом POST и содержит тело
  if (event.httpMethod !== 'POST' || !event.body) {
    return {
      statusCode: 405, // Method Not Allowed
      body: JSON.stringify({ error: 'Требуется метод POST и тело запроса.' }),
    };
  }

  let requestBody;
  try {
    requestBody = JSON.parse(event.body);
  } catch (e) {
    return {
      statusCode: 400, // Bad Request
      body: JSON.stringify({ error: 'Некорректный формат JSON в теле запроса.' }),
    };
  }

  const { prompt } = requestBody;

  // Проверяем, что промпт (сообщение пользователя) передан
  if (!prompt) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Промпт не указан в теле запроса.' }),
    };
  }

  try {
    // Вызов Hugging Face API
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${HUGGING_FACE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: prompt, // Отправляем полученный промпт
        parameters: {
          max_new_tokens: 150,     // Максимальное количество новых токенов
          temperature: 0.7,        // Степень случайности/креативности
          top_p: 0.9,              // Выборка токенов с кумулятивной вероятностью
          do_sample: true,         // Включение случайной выборки
          return_full_text: false, // Возвращать только сгенерированный текст
        },
        options: { wait_for_model: true }, // Дождаться загрузки модели
      }),
    });

    // Проверка статуса ответа от Hugging Face API
    if (!response.ok) {
      let errorMessage = '';
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || response.statusText;
      } catch (e) {
        errorMessage = response.statusText || 'Неизвестная ошибка от Hugging Face';
      }
      throw new Error(`Hugging Face API: ${response.status} - ${errorMessage}`);
    }

    // Парсинг ответа от Hugging Face
    const data = await response.json();
    let generatedText = '';
    if (Array.isArray(data) && data[0] && data[0].generated_text) {
      generatedText = data[0].generated_text;
    } else if (data && data.generated_text) {
      generatedText = data.generated_text;
    }

    // Очистка сгенерированного текста (удаление промпта, мусора)
    if (generatedText.startsWith(prompt)) {
      generatedText = generatedText.substring(prompt.length).trim();
    }
    generatedText = generatedText.replace(/Пользователь:\s*/g, '').replace(/Loli-GPT:\s*/g, '').trim();
    const newLineIndex = generatedText.indexOf('\n');
    if (newLineIndex !== -1) {
      generatedText = generatedText.substring(0, newLineIndex).trim();
    }

    // Возвращаем ответ обратно на фронтенд
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*' // Разрешить запросы с любого домена (CORS)
      },
      body: JSON.stringify({ reply: generatedText || 'Нет ответа от ИИ.' }),
    };
  } catch (error) {
    console.error('Ошибка в Netlify Function:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*' // Разрешить запросы с любого домена (CORS)
      },
      body: JSON.stringify({ error: `Серверная ошибка: ${error.message}` }),
    };
  }
};
