# Pi7 Passport Studio

A Next.js starter application for AI-assisted passport-style photo editing and manual export controls.

## Requirements

- Node.js 20 or newer
- An OpenAI API key with image editing access and billing enabled
- Internet connection for package installation and AI generation

## Run locally

1. Install Node.js from https://nodejs.org/
2. Extract this ZIP and open the extracted `ai-passport-photo-studio` folder in VS Code.
3. Open a terminal in that folder and run:

   ```bash
   npm install
   ```

4. Copy `.env.example` to `.env.local`.
5. Put your key in `.env.local`:

   ```env
   OPENAI_API_KEY=your_real_api_key
   OPENAI_IMAGE_MODEL=gpt-image-1.5
   ```

6. Start the website:

   ```bash
   npm run dev
   ```

7. Open http://localhost:3000

## Important notes

- Never commit `.env.local` or expose the API key in browser code.
- ChatGPT subscriptions and API billing are separate. API calls can incur charges.
- The AI image editing route sends the uploaded photo to OpenAI for processing.
- AI cannot guarantee perfect facial identity preservation. Compare the generated image with the original before using it for an official application.
- The current editor uses a centered cover crop. It does not yet provide a draggable crop rectangle or face-detection alignment.
- JPEG target KB is approximate, not guaranteed. The browser encoder may produce a file larger than the requested target.
- The print sheet is a 5 × 2 JPEG layout, not a print-calibrated PDF. For physical printing, confirm the output dimensions and printer scaling.
- Background colour in this starter is drawn behind the photo; it does not automatically remove the original background. Use the AI prompt to request background replacement.
- This is a functional starter project, not a certification that a photo meets every country's passport-photo requirements.
