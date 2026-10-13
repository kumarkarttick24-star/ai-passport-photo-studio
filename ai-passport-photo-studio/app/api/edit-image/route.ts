import OpenAI from "openai";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 120;

function dataUrlToBuffer(dataUrl: string) {
  const match = dataUrl.match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!match) throw new Error("Unsupported image data. Please upload a PNG, JPG, or WebP image.");
  const mime = match[1];
  const buffer = Buffer.from(match[2], "base64");
  if (buffer.length > 12 * 1024 * 1024) throw new Error("Image must be 12 MB or smaller.");
  return { mime, buffer };
}

export async function POST(request: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is missing. Add it to .env.local and restart the development server." },
        { status: 500 }
      );
    }
    const body = await request.json();
    const imageDataUrl = String(body.imageDataUrl || "");
    const prompt = String(body.prompt || "").trim();
    if (!imageDataUrl || !prompt) return NextResponse.json({ error: "An image and prompt are required." }, { status: 400 });
    if (prompt.length > 4000) return NextResponse.json({ error: "Prompt must be 4,000 characters or fewer." }, { status: 400 });

    const { mime, buffer } = dataUrlToBuffer(imageDataUrl);
    const client = new OpenAI({ apiKey });
    const model = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1.5";
    const imageFile = new File([new Uint8Array(buffer)], mime === "image/png" ? "input.png" : mime === "image/webp" ? "input.webp" : "input.jpg", { type: mime });

    const response = await client.images.edit({
      model,
      image: imageFile,
      prompt: `Edit the provided image according to these instructions: ${prompt}\n\nImportant: preserve the subject's identity and natural facial features as closely as possible. Do not invent text, logos, or watermarks.`
    });

    const b64 = response.data?.[0]?.b64_json;
    if (!b64) return NextResponse.json({ error: "The image API returned no image. Check model access and API billing." }, { status: 502 });
    return NextResponse.json({ imageDataUrl: `data:image/png;base64,${b64}` });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Image editing failed.";
    // Avoid returning stack traces or server internals.
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
