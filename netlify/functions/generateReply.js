// netlify/functions/generateReply.js
// Этот файл выполняется на сервере Netlify (Node.js)

// Для выполнения HTTP-запросов
const fetch = require('node-fetch');

// Глобальная переменная для хранения Access Token и времени его истечения
let accessToken = null;
let tokenExpiryTime = 0; // Время истечения токена в миллисекундах (Unix timestamp)

// Ваш Authorization key для GigaChat
const GIGACHAT_AUTHORIZATION_KEY = process.env.GIGACHAT_AUTHORIZATION_KEY;

// URLs для GigaChat API
const GIGACHAT_AUTH_URL = 'https://ngw.devices.sberbank.ru:9443/api/v2/oauth';
// Этот URL для генерации текста нужно будет найти в документации GigaChat
// В документации GigaChat ищите "Completion", "text generation" или "chat" endpoint.
// Я использую гипотетический URL, который нужно будет заменить на реальный из документации.
const GIGACHAT_COMPLETION_URL = 'https://ngw.devices.sberbank.ru:9443/api/v1/chat/completions'; // ГИПОТЕТИЧЕСКИЙ! ЗАМЕНИТЬ!

// Функция для получения Access Token
async function getAccessToken() {
  // Проверяем, есть ли валидный токен (действителен еще хотя бы 5 минут)
  if (accessToken && (Date.now() < tokenExpiryTime - 5 * 60 * 1000)) {
    return accessToken;
  }

  // Если токена нет или он просрочен, запрашиваем новый
  console.log('Запрашиваю новый Access Token для GigaChat...');
  try {
    const response = await fetch(GIGACHAT_AUTH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
        'RqUID': 'YOUR_UNIQUE_REQUEST_ID', // TODO: Замените на уникальный ID запроса (UUID)
        'Authorization': `Basic ${GIGACHAT_AUTHORIZATION_KEY}` // Ваш Authorization key
      },
      body: 'scope=GIGACHAT_API_PERS' // Scope, указанный в документации
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Ошибка получения токена: ${response.status} - ${errorData.message || response.statusText}`);
    }

    const data = await response.json();
    accessToken = data.access_token;
    // Токен действует 30 минут, преобразуем в миллисекунды для Date.now()
    tokenExpiryTime = Date.now() + (data.expires_at || 30 * 60) * 1000;
    console.log('Access Token успешно получен.');
    return accessToken;

  } catch (error) {
    console.error('Ошибка в getAccessToken:', error);
    throw new Error('Не удалось получить Access Token для GigaChat: ' + error.message);
  }
}

// Главная функция-обработчик для Netlify
exports.handler = async function(event, context) {
  // Проверка наличия Authorization key
  if (!GIGACHAT_AUTHORIZATION_KEY) {
    console.error('GIGACHAT_AUTHORIZATION_KEY is not set in Netlify Environment Variables.');
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Серверная ошибка: GigaChat Authorization key не настроен.' }),
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
    // 1. Получаем Access Token
    const currentAccessToken = await getAccessToken();

    // 2. Отправляем запрос к GigaChat API для генерации текста
    const response = await fetch(GIGACHAT_COMPLETION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${currentAccessToken}` // Используем полученный Access Token
      },
      // Формат тела запроса для генерации текста - это то, что нужно найти в документации
      // Это примерный формат для Chat Completion API.
      body: JSON.stringify({
        model: "GigaChat", // Имя модели, если требуется
        messages: [{
          role: "user",
          content: prompt
        }],
        // Другие параметры, если они есть и нужны
        // Например: temperature: 0.7, max_tokens: 150
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Ошибка GigaChat API: ${response.status} - ${errorData.message || response.statusText}`);
    }

    const data = await response.json();
    // Как получить сгенерированный текст из ответа GigaChat API - нужно смотреть в документации
    // Это примерный вариант для Chat Completion API.
    const generatedText = data.choices[0]?.message?.content || "Не удалось получить ответ от GigaChat.";

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
    return {
      statusCode: 500,
      body: JSON.stringify({ error: `Серверная ошибка: ${error.message}` }),
    };
  }
};
