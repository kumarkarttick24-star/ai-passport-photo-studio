 "use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";

type Tab = "ai" | "edit" | "border" | "export";

const PRESETS = [
  { label: "India Passport", w: 35, h: 45, unit: "mm" },
  { label: "US Passport", w: 2, h: 2, unit: "in" },
  { label: "Custom", w: 35, h: 45, unit: "mm" }
];

function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function Home() {
  const [tab, setTab] = useState<Tab>("ai");
  const [original, setOriginal] = useState<string>("");
  const [result, setResult] = useState<string>("");
  const [prompt, setPrompt] = useState("Create a professional Indian passport-style portrait from this photo. Use a plain pure white background and even studio lighting. Keep the person's identity, facial structure, skin tone, eyes, nose, lips, age, and expression as close to the original as possible. Keep the head facing forward. Do not beautify or alter facial features. Do not add text, jewellery, or accessories. Preserve natural photographic detail.");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [background, setBackground] = useState("#ffffff");
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturation, setSaturation] = useState(100);
  const [borderColor, setBorderColor] = useState("#34423a");
  const [borderSize, setBorderSize] = useState(2);
  const [shadowSize, setShadowSize] = useState(0);
  const [widthMm, setWidthMm] = useState(35);
  const [heightMm, setHeightMm] = useState(45);
  const [dpi, setDpi] = useState(300);
  const [targetKb, setTargetKb] = useState(100);
  const [filename, setFilename] = useState("passport-photo");
  const [format, setFormat] = useState<"jpeg" | "png">("jpeg");
  const [sheet, setSheet] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const activeImage = result || original;
  const pixelWidth = useMemo(() => Math.max(1, Math.round(widthMm / 25.4 * dpi)), [widthMm, dpi]);
  const pixelHeight = useMemo(() => Math.max(1, Math.round(heightMm / 25.4 * dpi)), [heightMm, dpi]);

  useEffect(() => {
    if (!activeImage || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const image = new Image();
    image.onload = () => {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Cover-crop to the selected aspect ratio. Adjust the image in the Crop step by changing dimensions.
      const scale = Math.max(canvas.width / image.width, canvas.height / image.height);
      const dw = image.width * scale;
      const dh = image.height * scale;
      ctx.save();
      ctx.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`;
      ctx.drawImage(image, (canvas.width - dw) / 2, (canvas.height - dh) / 2, dw, dh);
      ctx.restore();

      if (borderSize > 0) {
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = Math.max(1, borderSize * dpi / 100);
        ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, canvas.width - ctx.lineWidth, canvas.height - ctx.lineWidth);
      }
      if (shadowSize > 0) {
        // Preview/export uses a subtle inset border; a real drop shadow is not included in the passport image.
      }
    };
    image.src = activeImage;
  }, [activeImage, pixelWidth, pixelHeight, background, brightness, contrast, saturation, borderColor, borderSize, dpi, shadowSize]);

  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError("");
    setResult("");
    setStatus("");
    if (!file.type.startsWith("image/")) {
      setError("Please choose a JPG, PNG, or another supported image file.");
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      setError("Image must be 12 MB or smaller. Please resize it before uploading.");
      return;
    }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    setOriginal(dataUrl);
    setFilename(file.name.replace(/\.[^.]+$/, "").replace(/[^a-z0-9-_]+/gi, "-") || "passport-photo");
    setStatus("Photo loaded. You can generate an AI edit or continue with manual controls.");
  }

  async function generate() {
    if (!original) {
      setError("Upload a photo first.");
      return;
    }
    if (!prompt.trim()) {
      setError("Enter an editing prompt.");
      return;
    }
    setBusy(true);
    setError("");
    setStatus("Sending your photo to the AI image-editing API...");
    try {
      const response = await fetch("/api/edit-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageDataUrl: original, prompt })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Image generation failed.");
      setResult(payload.imageDataUrl);
      setStatus("AI edit generated. Review the face carefully, then adjust the passport settings.");
      setTab("edit");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setStatus("");
    } finally {
      setBusy(false);
    }
  }

  function useOriginal() {
    setResult("");
    setStatus("Original photo selected.");
  }

  async function exportImage() {
    const canvas = canvasRef.current;
    if (!canvas || !activeImage) {
      setError("Upload or generate a photo first.");
      return;
    }
    setError("");
    const mime = format === "png" ? "image/png" : "image/jpeg";
    const safeName = (filename.trim() || "passport-photo").replace(/[\\/:*?"<>|]+/g, "-");
    const makeBlob = (quality: number) => new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Could not export image.")), mime, quality);
    });
    try {
      let blob = await makeBlob(0.94);
      if (format === "jpeg" && targetKb > 0) {
        // Approximate target size by reducing JPEG quality. Exact size depends on image content and browser encoder.
        let low = 0.15, high = 0.94;
        for (let i = 0; i < 9; i++) {
          const mid = (low + high) / 2;
          const candidate = await makeBlob(mid);
          blob = candidate;
          if (candidate.size > targetKb * 1024) high = mid;
          else low = mid;
        }
      }
      if (sheet) {
        const printCanvas = document.createElement("canvas");
        const columns = 5, rows = 2, gap = Math.round(dpi * 0.04);
        printCanvas.width = columns * canvas.width + (columns + 1) * gap;
        printCanvas.height = rows * canvas.height + (rows + 1) * gap;
        const pctx = printCanvas.getContext("2d");
        if (!pctx) throw new Error("Could not create print sheet.");
        pctx.fillStyle = "#ffffff";
        pctx.fillRect(0, 0, printCanvas.width, printCanvas.height);
        for (let r = 0; r < rows; r++) for (let c = 0; c < columns; c++) {
          pctx.drawImage(canvas, gap + c * (canvas.width + gap), gap + r * (canvas.height + gap));
        }
        const sheetBlob = await new Promise<Blob>((resolve, reject) => printCanvas.toBlob(b => b ? resolve(b) : reject(new Error("Could not export sheet.")), "image/jpeg", 0.94));
        downloadBlob(sheetBlob, `${safeName}-print-sheet.jpg`);
      } else {
        downloadBlob(blob, `${safeName}.${format === "png" ? "png" : "jpg"}`);
      }
      setStatus(sheet ? "Print sheet downloaded." : `Image downloaded (${Math.round(blob.size / 1024)} KB). Target size is approximate.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed.");
    }
  }

  function choosePreset(label: string) {
    if (label === "India Passport") { setWidthMm(35); setHeightMm(45); }
    else if (label === "US Passport") { setWidthMm(50.8); setHeightMm(50.8); }
  }

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: "ai", label: "AI Generate", icon: "✦" },
    { id: "edit", label: "Photo Editor", icon: "◫" },
    { id: "border", label: "Border & Colour", icon: "▣" },
    { id: "export", label: "Resize & Download", icon: "↓" }
  ];

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-mark">P</div>
        <div>
          <div className="brand-title">Pi7 Passport Studio</div>
          <div className="brand-subtitle">AI photo generation · Manual passport photo controls</div>
        </div>
        <span className="local-pill">Browser-based editor</span>
      </header>

      <section className="hero">
        <div>
          <div className="eyebrow">YOUR PHOTO WORKFLOW, IN ONE PLACE</div>
          <h1>Make a passport photo.<br /><span>Keep the controls yours.</span></h1>
          <p>Upload a photo, describe the AI edit, then manually control dimensions, colour, borders, file size and export.</p>
        </div>
        <div className="hero-icon" aria-hidden="true"><span>✦</span><i>▣</i></div>
      </section>

      <nav className="step-tabs" aria-label="Photo workflow">
        {tabs.map((item, index) => (
          <button key={item.id} className={`step-tab ${tab === item.id ? "active" : ""}`} onClick={() => setTab(item.id)}>
            <span className="step-number">{item.icon}</span><span>{item.label}</span><small>{String(index + 1).padStart(2, "0")}</small>
          </button>
        ))}
      </nav>

      <section className="workspace">
        <div className="editor-panel">
          {tab === "ai" && <>
            <div className="section-heading"><div className="section-icon">✦</div><div><h2>AI Photo Generator</h2><p>Upload your photo and describe exactly what you want changed.</p></div></div>
            <label className="upload-box">
              <input ref={fileRef} type="file" accept="image/*" onChange={onFile} />
              <span className="upload-symbol">↑</span>
              <strong>{original ? "Choose a different photo" : "Select or drag a photo"}</strong>
              <span>JPG or PNG · Maximum 12 MB</span>
            </label>
            <label className="field-label" htmlFor="prompt">Your editing prompt</label>
            <textarea id="prompt" value={prompt} onChange={e => setPrompt(e.target.value)} rows={6} placeholder="Describe the edits you want..." />
            <div className="helper-text">Tip: ask for background or clothing edits. AI may alter small facial details, so compare the result with your original.</div>
            <button className="primary-button full" onClick={generate} disabled={busy || !original}>{busy ? <><span className="spinner" /> Generating photo...</> : "✦ Generate with AI"}</button>
            <button className="text-button" onClick={useOriginal} disabled={!original}>Skip AI and use original photo</button>
          </>}

          {tab === "edit" && <>
            <div className="section-heading"><div className="section-icon">◫</div><div><h2>Passport Photo Editor</h2><p>Set the final dimensions and image appearance.</p></div></div>
            <div className="field-grid">
              <label className="field-label">Passport preset<select onChange={e => choosePreset(e.target.value)} defaultValue="India Passport">{PRESETS.map(p => <option key={p.label}>{p.label}</option>)}</select></label>
              <label className="field-label">DPI<input type="number" min="72" max="1200" value={dpi} onChange={e => setDpi(Math.min(1200, Math.max(72, Number(e.target.value) || 300)))} /></label>
              <label className="field-label">Width (mm)<input type="number" min="10" max="200" step="0.1" value={widthMm} onChange={e => setWidthMm(Math.min(200, Math.max(10, Number(e.target.value) || 35)))} /></label>
              <label className="field-label">Height (mm)<input type="number" min="10" max="200" step="0.1" value={heightMm} onChange={e => setHeightMm(Math.min(200, Math.max(10, Number(e.target.value) || 45)))} /></label>
            </div>
            <div className="dimension-note">Output: {pixelWidth} × {pixelHeight} pixels at {dpi} DPI. Passport rules vary by application, so confirm the required dimensions before submitting.</div>
            <div className="control-block"><div className="control-head"><label htmlFor="brightness">Brightness</label><output>{brightness}%</output></div><input id="brightness" type="range" min="50" max="150" value={brightness} onChange={e => setBrightness(Number(e.target.value))} /></div>
            <div className="control-block"><div className="control-head"><label htmlFor="contrast">Contrast</label><output>{contrast}%</output></div><input id="contrast" type="range" min="50" max="150" value={contrast} onChange={e => setContrast(Number(e.target.value))} /></div>
            <div className="control-block"><div className="control-head"><label htmlFor="saturation">Saturation</label><output>{saturation}%</output></div><input id="saturation" type="range" min="0" max="160" value={saturation} onChange={e => setSaturation(Number(e.target.value))} /></div>
            <label className="field-label">Background colour<div className="color-row"><input type="color" value={background} onChange={e => setBackground(e.target.value)} /><input value={background} onChange={e => setBackground(e.target.value)} maxLength={7} /></div></label>
            <div className="button-row"><button className="secondary-button" onClick={() => {setBrightness(100);setContrast(100);setSaturation(100);setBackground("#ffffff");}}>Reset adjustments</button><button className="primary-button" onClick={() => setTab("border")}>Continue to border →</button></div>
          </>}

          {tab === "border" && <>
            <div className="section-heading"><div className="section-icon">▣</div><div><h2>Border & Colour Studio</h2><p>Set a border colour and thickness manually.</p></div></div>
            <label className="field-label">Border colour<div className="color-row"><input type="color" value={borderColor} onChange={e => setBorderColor(e.target.value)} /><input value={borderColor} onChange={e => setBorderColor(e.target.value)} maxLength={7} /></div></label>
            <div className="control-block"><div className="control-head"><label htmlFor="borderSize">Border thickness</label><output>{borderSize} px</output></div><input id="borderSize" type="range" min="0" max="12" value={borderSize} onChange={e => setBorderSize(Number(e.target.value))} /></div>
            <div className="control-block"><div className="control-head"><label htmlFor="shadowSize">Shadow preview</label><output>{shadowSize}</output></div><input id="shadowSize" type="range" min="0" max="20" value={shadowSize} onChange={e => setShadowSize(Number(e.target.value))} /><p className="helper-text">Shadow is a preview control only. Passport images should normally use a clean, unadorned edge.</p></div>
            <div className="swatches"><span>Quick colours</span>{["#ffffff","#000000","#34423a","#1d4ed8","#dc2626","#f59e0b","#7c3aed"].map(c => <button aria-label={`Choose ${c}`} key={c} style={{background:c}} onClick={() => setBorderColor(c)} />)}</div>
            <div className="button-row"><button className="secondary-button" onClick={() => setTab("edit")}>← Back</button><button className="primary-button" onClick={() => setTab("export")}>Continue to export →</button></div>
          </>}

          {tab === "export" && <>
            <div className="section-heading"><div className="section-icon">↓</div><div><h2>Resize, Rename & Download</h2><p>Choose your file settings and export locally.</p></div></div>
            <label className="field-label">Output filename<input value={filename} onChange={e => setFilename(e.target.value)} placeholder="passport-photo" /></label>
            <div className="field-grid">
              <label className="field-label">File format<select value={format} onChange={e => setFormat(e.target.value as "jpeg" | "png")}><option value="jpeg">JPG / JPEG</option><option value="png">PNG</option></select></label>
              <label className="field-label">Target size (KB)<input type="number" min="5" max="10000" value={targetKb} disabled={format === "png"} onChange={e => setTargetKb(Math.max(5, Number(e.target.value) || 100))} /></label>
            </div>
            <p className="helper-text">JPEG target size is approximate. If the image cannot be compressed to your target while retaining acceptable quality, the final file may be larger. PNG uses lossless encoding and ignores the KB target.</p>
            <label className="check-row"><input type="checkbox" checked={sheet} onChange={e => setSheet(e.target.checked)} /><span><strong>Make a 10-photo print sheet</strong><small>Creates a 5 × 2 sheet as a JPEG file.</small></span></label>
            <div className="export-summary"><div><span>Dimensions</span><strong>{pixelWidth} × {pixelHeight} px</strong></div><div><span>Resolution</span><strong>{dpi} DPI</strong></div><div><span>Target file size</span><strong>{format === "png" ? "Not applicable" : `${targetKb} KB (approx.)`}</strong></div></div>
            <button className="primary-button full" onClick={exportImage} disabled={!activeImage}>↓ Download {sheet ? "print sheet" : "final photo"}</button>
            <button className="secondary-button full" onClick={() => {setTab("ai");setResult("");setOriginal("");setStatus("");setError("");}}>Start a new photo</button>
          </>}
          {error && <div className="alert error">{error}</div>}
          {status && <div className="alert success">{status}</div>}
        </div>

        <aside className="preview-panel">
          <div className="preview-top"><div><h2>Live preview</h2><p>{result ? "AI-generated version" : original ? "Original photo" : "Your photo will appear here"}</p></div><span className="live-dot" /></div>
          <div className="preview-stage">
            {activeImage ? <canvas ref={canvasRef} className="passport-canvas" aria-label="Passport photo preview" /> : <div className="empty-preview"><div className="empty-icon">▧</div><strong>No photo selected</strong><span>Upload a portrait in the AI Generate section.</span><button className="secondary-button" onClick={() => {setTab("ai");fileRef.current?.click();}}>Select a photo</button></div>}
          </div>
          <div className="preview-meta"><div><span>Output size</span><strong>{pixelWidth} × {pixelHeight} px</strong></div><div><span>Photo ratio</span><strong>{(widthMm / heightMm).toFixed(3)} : 1</strong></div></div>
          {original && <div className="compare-actions"><button className={!result ? "selected" : ""} onClick={useOriginal}>Use original</button><button className={result ? "selected" : ""} onClick={() => result && setStatus("AI-generated version selected.")} disabled={!result}>Use AI result</button></div>}
          <div className="privacy-note"><span>◈</span><p><strong>Privacy note</strong><br />Manual adjustments and export run in your browser. When you request AI generation, your photo is sent to the configured OpenAI API for processing.</p></div>
        </aside>
      </section>
      <footer><span>Pi7 Passport Studio</span><span>Review the final image and official photo requirements before submitting.</span></footer>
    </main>
  );
}
