# AI Importer for Wealthfolio

A [Wealthfolio](https://wealthfolio.app) addon that extracts investment transactions from brokerage PDFs and images using AI vision models, then imports them directly into your portfolio.

## How It Works

1. Upload a PDF or image of a brokerage statement
2. AI reads the document and extracts transactions automatically
3. Review and edit the results in an editable table
4. Select a Wealthfolio account and import — no CSV files, no copy-paste

## Install

1. Download `ai-importer.zip` from the [latest release](../../releases/latest)
2. Install via the Wealthfolio addon manager, or extract to your addons directory

For self-hosted instances, set `WF_ADDONS_DIR` and extract the ZIP there.

## AI Providers

You need an API key from one of:

- [OpenAI](https://platform.openai.com/api-keys) — GPT-5.4-mini
- [Anthropic](https://console.anthropic.com/) — Claude Sonnet

Both providers use vision-based document extraction with structured output. Configure your key in the addon's settings panel.

## What's Supported

**Document formats:** PDF and images (PNG, JPG, etc.). Multi-page PDFs are supported — each page is sent as a separate image to the AI model.

**Activity types:** BUY, SELL, SPLIT, DIVIDEND, DEPOSIT, WITHDRAWAL, TRANSFER_IN, TRANSFER_OUT, INTEREST, CREDIT, FEE, TAX, ADJUSTMENT

**Duplicate detection:** The addon checks for existing transactions before importing, so you won't accidentally re-import the same statement.

## What's Not Supported

- **Automatic symbol lookup** — the AI extracts ticker symbols as-is from the document. If your broker uses a non-standard symbol format, you may need to edit it in the review table.
- **Multi-currency FX conversion** — transactions are imported in the currency shown on the document. Cross-currency reconciliation is left to Wealthfolio.
- **Scanned/handwritten documents** — the AI works best with digitally generated PDFs and clear images. Poor scan quality will reduce extraction accuracy.

## Privacy

- The addon runs entirely inside Wealthfolio's desktop environment
- Your documents are converted to images in-memory and sent directly to the AI provider you choose — they never pass through any intermediary server
- API keys are stored in Wealthfolio's secure secrets storage and only sent to the selected AI provider

## Development

```bash
cd addon
npm install
npm run dev:server    # hot-reload on port 3001
```

Enable addon dev mode in Wealthfolio with `VITE_ENABLE_ADDON_DEV_MODE=true`.