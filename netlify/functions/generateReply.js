// netlify/functions/generateReply.js
const fetch = require('node-fetch'); // Import node-fetch
require('dotenv').config(); // Load environment variables if using .env

exports.handler = async function(event, context) {
  // Get the Hugging Face API token from environment variables
  const HUGGING_FACE_API_TOKEN = process.env.HUGGING_FACE_API_TOKEN;
  const API_URL = 'https://api-inference.huggingface.co/models/EleutherAI/gpt-neo-1.3B';

  // Check if the API token is available
  if (!HUGGING_FACE_API_TOKEN) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Missing Hugging Face API token. Make sure to set the HUGGING_FACE_API_TOKEN environment variable in Netlify.' }),
    };
  }

  // Extract the prompt from the request body
  const { prompt } = JSON.parse(event.body);

  // Check if the prompt is available
  if (!prompt) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing prompt in request body.' }),
    };
  }

  try {
    // Call the Hugging Face API
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${HUGGING_FACE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: {
          max_new_tokens: 150,
          temperature: 0.7,
          top_p: 0.9,
          do_sample: true,
          return_full_text: false,
        },
        options: { wait_for_model: true },
      }),
    });

    // Check if the response is ok
    if (!response.ok) {
      let errorMessage = '';
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || response.statusText;
      } catch (e) {
        errorMessage = response.statusText || 'Unknown error';
      }
      throw new Error(`Hugging Face API error: ${response.status} - ${errorMessage}`);
    }

    // Parse the response
    const data = await response.json();
    let generatedText = '';
    if (Array.isArray(data) && data[0] && data[0].generated_text) {
      generatedText = data[0].generated_text;
    } else if (data && data.generated_text) {
      generatedText = data.generated_text;
    }

    // Clean up the generated text
    generatedText = generatedText.replace(prompt, '').trim();
    generatedText = generatedText.replace(/Пользователь:\s*/g, '').replace(/Loli-GPT:\s*/g, '').trim();
    const newLineIndex = generatedText.indexOf('\n');
    if (newLineIndex !== -1) {
        generatedText = generatedText.substring(0, newLineIndex).trim();
    }

    // Return the generated text
    return {
      statusCode: 200,
      body: JSON.stringify({ reply: generatedText || 'No response from AI.' }),
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
