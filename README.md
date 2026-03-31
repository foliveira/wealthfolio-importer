# Wealthfolio Importer

Extract transactions from brokerage PDFs and images using AI vision models, then import them into [Wealthfolio](https://wealthfolio.app).

Available as a **Wealthfolio addon** (direct import) or a **standalone web app** (CSV export).

## Wealthfolio Addon

The addon runs inside Wealthfolio and imports transactions directly into your portfolio — no CSV step needed.

### Install

1. Download `ai-importer.zip` from the [latest release](../../releases/latest)
2. Install via the Wealthfolio addon manager, or extract to your addons directory

For self-hosted instances, set `WF_ADDONS_DIR` and extract the ZIP there.

### Features

- Upload a PDF or image of a brokerage statement
- AI extracts transactions automatically
- Review and edit in an editable table
- Select a Wealthfolio account and import directly
- Duplicate detection prevents re-importing

### Development

```bash
cd addon
npm install
npm run dev:server    # hot-reload on port 3001
```

Enable addon dev mode in Wealthfolio with `VITE_ENABLE_ADDON_DEV_MODE=true`.

## Standalone Web App

A client-side SPA that extracts transactions and downloads a Wealthfolio-compatible CSV.

### Run Locally

```bash
npm install
npm run dev
```

### Build & Deploy

```bash
npm run build
```

The `build/` directory is a static site ready for GitHub Pages, Netlify, or Vercel.

## AI Providers

You need an API key from one of:

- [OpenAI](https://platform.openai.com/api-keys) (GPT-5.4-mini)
- [Anthropic](https://console.anthropic.com/) (Claude Sonnet)

Both providers support vision-based document extraction with structured output.

## Supported Activity Types

BUY, SELL, SPLIT, DIVIDEND, DEPOSIT, WITHDRAWAL, TRANSFER_IN, TRANSFER_OUT, INTEREST, CREDIT, FEE, TAX, ADJUSTMENT

## Privacy

- The web app runs entirely in your browser — documents never leave your machine
- The addon runs inside Wealthfolio's desktop environment
- API keys are stored locally (browser localStorage or Wealthfolio's secure secrets storage) and only sent to the AI provider you select

## Releases

Pushing a version tag (e.g., `v0.5.0`) triggers a GitHub Actions workflow that builds the addon and attaches `ai-importer.zip` to the release.

```bash
git tag v0.5.0
git push origin v0.5.0
```
