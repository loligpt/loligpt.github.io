// netlify/functions/generateReply.js
// Этот файл выполняется на сервере Netlify (Node.js)

const fetch = require('node-fetch');
const https = require('https');
const { randomUUID } = require('crypto'); // Импортируем для генерации RqUID

// Создаем агента HTTPS, который будет игнорировать ошибки SSL-сертификата
const agent = new https.Agent({
  rejectUnauthorized: false, // Отключаем проверку сертификатов
});

// Глобальная переменная для хранения Access Token и времени его истечения
let accessToken = null;
let tokenExpiryTime = 0; // Время истечения токена в миллисекундах (Unix timestamp)

// Ваш Authorization key для GigaChat (из переменных окружения Netlify)
const GIGACHAT_AUTHORIZATION_KEY = process.env.GIGACHAT_AUTHORIZATION_KEY;

// URLs для GigaChat API
const GIGACHAT_AUTH_URL = 'https://ngw.devices.sberbank.ru:9443/api/v2/oauth';
// Этот URL для генерации текста нужно будет найти в документации GigaChat
// Пока используем гипотетический URL.
const GIGACHAT_COMPLETION_URL = 'https://ngw.devices.sberbank.ru:9443/api/v1/chat/completions'; 

// Функция для получения Access Token
async function getAccessToken() {
  // Проверяем, есть ли валидный токен (действителен еще хотя бы 5 минут до истечения)
  if (accessToken && (Date.now() < tokenExpiryTime - 5 * 60 * 1000)) {
    console.log('Использую существующий Access Token.');
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
        'RqUID': randomUUID(), // Генерируем уникальный RqUID
        'Authorization': `Basic ${GIGACHAT_AUTHORIZATION_KEY}` // Ваш Authorization key
      },
      body: 'scope=GIGACHAT_API_PERS', // Тело запроса
      agent: agent // Использование агента для игнорирования SSL-ошибок
    });

    console.log('Статус ответа от GigaChat OAuth:', response.status);

    // Всегда читаем сырой текст ответа, чтобы отладить, что приходит
    const rawResponseText = await response.text();
    console.log('Сырой текст ответа от GigaChat OAuth:', rawResponseText);

    if (!response.ok) {
      // Если статус ответа не OK (например, 4xx или 5xx)
      try {
        const errorData = JSON.parse(rawResponseText);
        throw new Error(`Ошибка получения токена: ${response.status} - ${errorData.message || 'Неизвестная ошибка'}`);
      } catch (jsonParseError) {
        // Если не удалось распарсить как JSON, значит, rawResponseText - это и есть сообщение об ошибке
        throw new Error(`Ошибка получения токена: ${response.status} - Не JSON ответ: ${rawResponseText}`);
      }
    }

    // Если ответ OK, то пытаемся его распарсить
    const data = JSON.parse(rawResponseText); // Здесь происходит ошибка "Unexpected end of JSON input"
    accessToken = data.access_token;
    // GigaChat токен действует 30 минут, expires_at - это Unix timestamp
    // Date.now() возвращает миллисекунды, expires_at - секунды, поэтому * 1000
    tokenExpiryTime = (data.expires_at || (Date.now() / 1000 + 30 * 60)) * 1000; 
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
      }),
      agent: agent // Использование агента для игнорирования SSL-ошибок
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
