// netlify/functions/generateReply.js
// Этот файл выполняется на сервере Netlify (Node.js)

const { HfInference } = require('@huggingface/inference'); // *** ИЗМЕНЕНО: Правильный импорт класса Inference
const fetch = require('node-fetch'); // node-fetch все еще нужен для HfInference

exports.handler = async function(event, context) {
  // Получаем Hugging Face API токен из переменных окружения Netlify
  const HUGGING_FACE_API_TOKEN = process.env.HUGGING_FACE_API_TOKEN;
  // Инициализация клиента Inference (используем HfInference)
  const client = new HfInference(HUGGING_FACE_API_TOKEN); // *** ИЗМЕНЕНО: Инициализация HfInference

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
    // Вызов Chat Completion через HfInference и провайдера Nebius
    const chatCompletion = await client.chatCompletion({
        provider: "nebius", // Указываем провайдера Nebius AI
        model: "mistralai/Mistral-Nemo-Instruct-2407", // Используем модель, поддерживаемую Nebius через HF
        messages: [
            { role: "user", content: prompt } // Передаем только текущее сообщение пользователя
        ],
        // Дополнительные параметры генерации, если поддерживаются этой моделью через chatCompletion
        parameters: {
            max_new_tokens: 150,     
            temperature: 0.7,        
            top_p: 0.9,              
            do_sample: true,         
        },
        options: { wait_for_model: true },
    });

    // Извлечение сгенерированного текста из ответа
    let generatedText = chatCompletion.choices[0]?.message?.content || "Не удалось получить ответ от ИИ.";

    // Возвращаем ответ обратно на фронтенд
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*' // Разрешить запросы с любого домена (CORS)
      },
      body: JSON.stringify({ reply: generatedText }),
    };
  } catch (error) {
    console.error('Ошибка в Netlify Function:', error);
    // Обработка ошибок, которые могут возникнуть от HfInference
    let errorMessage = "Серверная ошибка.";
    if (error.message) {
        errorMessage = `Серверная ошибка: ${error.message}`;
    } else if (error.response && error.response.status) {
        errorMessage = `Ошибка API: ${error.response.status} - ${error.response.statusText || 'Неизвестно'}`;
    }
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*' // Разрешить запросы с любого домена (CORS)
      },
      body: JSON.stringify({ error: errorMessage }),
    };
  }
};
