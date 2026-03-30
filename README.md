# Wealthfolio Importer

Extract transactions from brokerage PDFs and images using AI, then download a CSV ready for [Wealthfolio](https://wealthfolio.app) import.

## How It Works

1. Enter your AI provider API key (OpenAI or Anthropic)
2. Upload a PDF statement or image
3. AI extracts transactions into a structured table
4. Review and edit the data
5. Download the CSV and import into Wealthfolio

## Features

- **AI-powered extraction** — uses vision models (GPT-4o or Claude) to read any brokerage statement format
- **Editable review table** — fix any extraction errors before exporting
- **Multi-provider support** — choose OpenAI or Anthropic based on what you have access to
- **Fully client-side** — your documents and API keys never touch our servers
- **PDF support** — renders multi-page PDFs to images for processing

## Requirements

You need an API key from one of:
- [OpenAI](https://platform.openai.com/api-keys) (GPT-4o)
- [Anthropic](https://console.anthropic.com/) (Claude)

## Development

```bash
npm install
npm run dev
```

## Build & Deploy

```bash
npm run build
```

The `build/` directory contains a static site ready to deploy to GitHub Pages, Netlify, Vercel, or any static host.

## Privacy

- All processing happens in your browser
- Your API key is stored in localStorage and only sent to the AI provider you select
- Documents are never uploaded to any server we control
