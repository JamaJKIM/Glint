import { desktopCapturer, screen, DesktopCapturerSource } from 'electron';
import { OpenAI } from 'openai';
import sharp from 'sharp';
import { recognize } from 'tesseract.js';
import { config } from '../config';

interface Selection {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ProcessScreenshotParams {
  image: string;
  mode: 'search' | 'assignment';
}

// Initialize OpenAI client with API key from config
const openai = new OpenAI({
  apiKey: config.get('openaiApiKey')
});

export async function captureScreenshot(selection: Selection): Promise<string> {
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: screen.getPrimaryDisplay().size
  });

  const primarySource = sources.find((source: DesktopCapturerSource) => source.name === 'Entire Screen');
  if (!primarySource) throw new Error('Could not capture screen');

  // Convert the thumbnail to a buffer
  const imageBuffer = primarySource.thumbnail.toPNG();
  
  // Crop the image using sharp
  const croppedImage = await sharp(imageBuffer)
    .extract({
      left: selection.x,
      top: selection.y,
      width: selection.width,
      height: selection.height
    })
    .toBuffer();

  return croppedImage.toString('base64');
}

export async function processScreenshot(
  { image, mode }: ProcessScreenshotParams
): Promise<string> {
  try {
    // Check if we have an API key
    const apiKey = config.get('openaiApiKey');
    if (!apiKey) {
      throw new Error('OpenAI API key not found. Please set it in the configuration.');
    }

    // First, try OCR with Tesseract
    const { data: { text } } = await recognize(Buffer.from(image, 'base64'));

    // Prepare the prompt based on mode
    const prompt = mode === 'assignment'
      ? 'Please analyze this image and provide a detailed, accurate response. Focus on correctness and thoroughness.'
      : 'Please provide a quick, concise answer to the question or content in this image.';

    // Send to OpenAI Vision API
    const response = await openai.chat.completions.create({
      model: "gpt-4-vision-preview",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image_url",
              image_url: {
                url: `data:image/png;base64,${image}`
              }
            }
          ]
        }
      ],
      max_tokens: 1000
    });

    return response.choices[0].message.content || 'No response generated';
  } catch (error) {
    console.error('Error processing screenshot:', error);
    return 'Error processing the image. Please try again.';
  }
} 