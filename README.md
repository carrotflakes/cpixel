# cpixel

Simple pixel-art editor.

## Features

- Drawing tools: Brush, Eraser, Fill (Bucket), Eyedropper, Line, Rectangle, Selection (Rect/Lasso/Magic Wand)
- Color modes: Indexed (palette, max 256) and Truecolor
- Multiple Layers Support
- Undo / Redo (Stroke-by-Stroke)
- Import/Export: PNG (composited) / Aseprite (partial)
- Google Drive Integration Saving/Loading
- Platform: supports PC, tablet, and smartphone

## Development

- Vite + React + TypeScript + Tailwind CSS

Run
1. Install deps
   pnpm install
2. Dev server
   pnpm dev
3. Build
   pnpm build

### Google Drive integration (optional)

To enable saving/loading JSON to Google Drive:

- Create an OAuth 2.0 Client ID (Web application) in Google Cloud Console.
- Add Authorized JavaScript origins for your dev/prod URLs (e.g., http://localhost:5173).
- Set the environment variable with your client ID:

   - For local dev, create `.env.local` with:

      VITE_GOOGLE_CLIENT_ID=your-oauth-client-id.apps.googleusercontent.com

- Scope used: drive.file (app-created files).

In the app, open More → Google Drive to sign in, Open, or Save.
