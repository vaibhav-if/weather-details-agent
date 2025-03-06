import axios from "axios";
import dotenv from "dotenv";
import OpenAI from "openai";
import readlineSync from "readline-sync";

dotenv.config();

async function llmChat() {
  // cache response
  const storedResponse = {};

  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  // Tools
  async function getWeatherDetails(city = "") {
    const result = storedResponse[city];
    if (!result) {
      const options = {
        method: "GET",
        url: `https://api.weatherstack.com/current?access_key=${process.env.WEATHER_API_KEY}`,
        params: {
          query: city,
        },
      };

      try {
        const response = await axios.request(options);
        storedResponse[city] = response.data;
        // console.log(response.data);
        return response.data;
      } catch (error) {
        console.error(error);
        return error.JSON;
      }
    } else {
      return result;
    }
  }

  const tools = {
    getWeatherDetails: getWeatherDetails,
  };

  const SYSTEM_PROMPT = `
  You are an AI Assistant with START, PLAN, ACTION, OBSERVATION and OUTPUT State.
  Wait for the user prompt and first PLAN using available tools.
  After planning take the ACTION with appropriate tools and wait for OBSERVATION based on action.
  Once you get the OBSERVATIONS return the AI response based on START prompt and observations.

  Strictly follow the JSON output format as in examples

  Avaiable Tools:
  - function getWeatherDetails(city: string): JSON
  getWeatherDetails is a function that accepts a city name in string format and returns the weather details in json format

  Example (Giving an hint as to what to do, not an exact example):
  START
  {"type": "user", "user": "What is the weather of Surat?"}
  {"type": "plan", "plan": "I will check if the city name is correct or any modification is needed, then I will call the getWeatherDetails with the city name"}
  {"type": "action", "function": "getWeatherDetails", "input":"surat"}
  {"type": "observation", "observation": "Interpret the results from the response received, an example resonse is like this 
    {
      request: { type: 'City', query: 'Surat, India', language: 'en', unit: 'm' },
      location: {
        name: 'Surat',
        country: 'India',
        region: 'Gujarat',
        lat: '20.967',
        lon: '72.900',
        timezone_id: 'Asia/Kolkata',
        localtime: '2025-03-06 12:28',
        localtime_epoch: 1741264080,
        utc_offset: '5.50'
      },
      current: {
        observation_time: '06:58 AM',
        temperature: 32,
        weather_code: 113,
        weather_icons: [
          'https://cdn.worldweatheronline.com/images/wsymbols01_png_64/wsymbol_0001_sunny.png'
        ],
        weather_descriptions: [ 'Sunny' ],
        wind_speed: 13,
        wind_degree: 338,
        wind_dir: 'NNW',
        pressure: 1014,
        precip: 0,
        humidity: 17,
        cloudcover: 0,
        feelslike: 30,
        uv_index: 10,
        visibility: 10,
        is_day: 'yes'
      }
    }"}
  {"type": "output", "output": "Output the interpreted results in a concise and simple manner"}
  `;

  const messages = [{ role: "system", content: SYSTEM_PROMPT }];

  while (true) {
    const query = readlineSync.question(">> ");
    const q = { type: "user", content: query };
    messages.push({ role: "user", content: JSON.stringify(q) });

    while (true) {
      const chat = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: messages,
        response_format: { type: "json_object" },
      });

      const result = chat.choices[0].message.content;
      messages.push({ role: "assistant", content: result });

      // console.log(
      //   "\n\n=================== AI RESPONSE START ==================="
      // );
      // console.log(result);
      // console.log(
      //   "=================== AI RESPONSE END ===================\n\n"
      // );

      const call = JSON.parse(result);

      if (call.type == "output") {
        console.log(`Output: ${call.output}`);
        break;
      } else if (call.type == "action") {
        const fn = tools[call.function];
        const observation = await fn(call.input);
        const obs = { type: "observation", observation: observation };
        messages.push({ role: "developer", content: JSON.stringify(obs) });
      }
    }
  }
}

llmChat();
