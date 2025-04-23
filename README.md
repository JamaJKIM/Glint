# Glint - Intelligent Screenshot-Based Assistant

Glint is a smart productivity application that helps you extract insights and solutions from visual content on your screen using AI-powered analysis.

## Features

- 🔍 Precision screen capture with customizable hotkey
- 🤖 Dual AI model system (Assignment Mode & Search Mode)
- 🖼️ Seamless image-to-AI processing pipeline
- 💡 Minimal, non-intrusive overlay display
- 🔒 Local + Cloud model support

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/glint.git
cd glint
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory and add your OpenAI API key:
```
OPENAI_API_KEY=your_api_key_here
```

4. Build and start the application:
```bash
npm run build
npm start
```

## Usage

1. Press `Command+Shift+Control+Space` (Mac) or `Ctrl+Shift+Alt+Space` (Windows/Linux) to activate the screenshot tool
2. Click and drag to select the area you want to analyze
3. Choose between Search Mode (quick answers) or Assignment Mode (detailed analysis)
4. View the AI-generated response in the overlay

## Development

To run the application in development mode:
```bash
npm run dev
```

This will start the application with hot-reloading enabled.

## License

MIT License - see LICENSE file for details 