import OpenAI from 'openai';
import { config } from '../config';

// Initialize OpenAI client with API key from config
const apiKey = config.get('openaiApiKey');
if (!apiKey) {
  console.error('OpenAI API key not found. Please set it in your .env file or configuration.');
}

export const openai = new OpenAI({
  apiKey: apiKey
});

export async function analyzeImage(base64Image: string, mode: 'search' | 'assignment'): Promise<string> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OpenAI API key not found');
  }

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const searchPrompt = `You are an AI assistant analyzing screenshots to help users find relevant information.

If the image shows a multiple choice question:
1. Start with "Answer: Option X"
2. Follow with a single-line explanation
3. Be extremely concise
4. Do not repeat the question or other options

If the image shows a programming question:
1. Analyze the requirements carefully
2. Provide working, tested code that solves the problem
3. Include necessary imports and dependencies
4. Add brief comments explaining key parts
5. Ensure proper error handling
6. Test edge cases
7. Format code with proper indentation

For any other content:
- Be concise and direct in your responses
- Focus on key information only`;

  const assignmentPrompt = `You are an AI assistant analyzing screenshots to help users complete assignments.

If the image shows a multiple choice question:
1. Start with "Answer: Option X"
2. Follow with a single-line explanation
3. Be extremely concise
4. Do not repeat the question or other options

If the image shows a programming assignment:
1. Break down the problem requirements
2. Provide complete, working code solution
3. Include all necessary imports and setup
4. Add clear comments explaining the logic
5. Handle edge cases and errors
6. Show example usage if relevant
7. Format code properly for readability

For other types of assignments:
- Provide clear, step-by-step guidance
- Focus on methodology and key concepts
- Include relevant examples`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a technical expert focused on accuracy. For different types of questions:

1. For multiple choice questions:
   - First line: The answer in bold using markdown (**answer**)
   - Second line: A single precise technical explanation

2. For programming questions:
   - Start with "**Solution:**"
   - Provide complete, working code that solves the problem
   - Include all necessary imports at the top
   - Add brief comments explaining key logic
   - Include proper error handling
   - Test edge cases in the code
   - End with a simple example usage as a comment

Keep all responses extremely concise and technically accurate.`
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Analyze this and provide a technically accurate answer with working code if it's a programming question." },
            {
              type: "image_url",
              image_url: {
                url: `data:image/png;base64,${base64Image}`
              }
            }
          ]
        }
      ],
      max_tokens: 500,
    });

    console.log('OpenAI Response:', response);
    
    // Extract the response text from the completion
    const responseText = response.choices[0]?.message?.content;
    if (!responseText) {
      throw new Error('No response content from OpenAI');
    }
    
    // Ensure we return a clean string
    return responseText.trim();
  } catch (error) {
    console.error('Error analyzing image with OpenAI:', error);
    throw error;
  }
} 