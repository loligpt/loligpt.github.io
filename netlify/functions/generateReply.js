// netlify/functions/generateReply.js
// Этот файл выполняется на сервере Netlify (Node.js)

const fetch = require('node-fetch');
const https = require('https'); // <-- Добавляем импорт модуля https

// Создаем агента HTTPS, который будет игнорировать ошибки SSL-сертификата
const agent = new https.Agent({
  rejectUnauthorized: false, // <-- ЭТО САМОЕ ГЛАВНОЕ: отключаем проверку сертификатов
});

// Глобальная переменная для хранения Access Token и времени его истечения
let accessToken = null;
let tokenExpiryTime = 0; // Время истечения токена в миллисекундах (Unix timestamp)

// Ваш Authorization key для GigaChat
const GIGACHAT_AUTHORIZATION_KEY = process.env.GIGACHAT_AUTHORIZATION_KEY;

// URLs для GigaChat API
const GIGACHAT_AUTH_URL = 'https://ngw.devices.sberbank.ru:9443/api/v2/oauth';
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
        'Authorization': `Basic ${GIGACHAT_AUTHORIZATION_KEY}`
      },
      body: 'scope=GIGACHAT_API_PERS',
      agent: agent // <-- Добавляем агента для игнорирования SSL-ошибок
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Ошибка получения токена: ${response.status} - ${errorData.message || response.statusText}`);
    }

    const data = await response.json();
    accessToken = data.access_token;
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
  if (!GIGACHAT_AUTHORIZATION_KEY) {
    console.error('GIGACHAT_AUTHORIZATION_KEY is not set in Netlify Environment Variables.');
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Серверная ошибка: GigaChat Authorization key не настроен.' }),
    };
  }

  if (event.httpMethod !== 'POST' || !event.body) {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Требуется метод POST и тело запроса.' }),
    };
  }

  let requestBody;
  try {
    requestBody = JSON.parse(event.body);
  } catch (e) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Некорректный формат JSON в теле запроса.' }),
    };
  }

  const { prompt } = requestBody;

  if (!prompt) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Промпт не указан в теле запроса.' }),
    };
  }

  try {
    const currentAccessToken = await getAccessToken();

    // Отправляем запрос к GigaChat API для генерации текста
    const response = await fetch(GIGACHAT_COMPLETION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${currentAccessToken}`
      },
      body: JSON.stringify({
        model: "GigaChat", // Имя модели, если требуется
        messages: [{
          role: "user",
          content: prompt
        }],
      }),
      agent: agent // <-- Добавляем агента и сюда для игнорирования SSL-ошибок
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Ошибка GigaChat API: ${response.status} - ${errorData.message || response.statusText}`);
    }

    const data = await response.json();
    const generatedText = data.choices[0]?.message?.content || "Не удалось получить ответ от GigaChat.";

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
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
