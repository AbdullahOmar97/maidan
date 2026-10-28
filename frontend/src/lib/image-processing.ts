/**
 * Utility for client-side image processing.
 * Automatically removes paper / solid light backgrounds from uploaded official stamps and signatures.
 */

export interface ProcessedImageResult {
  file: File;
  dataUrl: string;
}

export function removeImageBackground(
  file: File,
  options?: {
    threshold?: number; // Distance threshold for full transparency (default: 45)
    feather?: number; // Distance range for feathered anti-aliasing (default: 35)
  }
): Promise<ProcessedImageResult> {
  const threshold = options?.threshold ?? 45;
  const feather = options?.feather ?? 35;

  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("الملف المحدد ليس صورة صالحة"));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error("فشل قراءة ملف الصورة"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("فشل تحميل الصورة في المتصفح"));
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          const width = img.naturalWidth || img.width;
          const height = img.naturalHeight || img.height;
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext("2d", { willReadFrequently: true });
          if (!ctx) {
            reject(new Error("فشل إنشاء سياق الرسم للـ Canvas"));
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);
          const imgData = ctx.getImageData(0, 0, width, height);
          const data = imgData.data;

          // Sample 4 corners to detect actual paper / background tint
          const sampleCoords = [
            0, // top-left
            (width - 1) * 4, // top-right
            ((height - 1) * width) * 4, // bottom-left
            ((height - 1) * width + (width - 1)) * 4, // bottom-right
          ];

          let bgR = 0, bgG = 0, bgB = 0;
          let validSamples = 0;

          for (const idx of sampleCoords) {
            if (idx >= 0 && idx + 2 < data.length) {
              bgR += data[idx];
              bgG += data[idx + 1];
              bgB += data[idx + 2];
              validSamples++;
            }
          }

          if (validSamples > 0) {
            bgR /= validSamples;
            bgG /= validSamples;
            bgB /= validSamples;
          } else {
            bgR = 255;
            bgG = 255;
            bgB = 255;
          }

          // Fallback if corners are dark (e.g. cropped tightly)
          const cornerBrightness = 0.299 * bgR + 0.587 * bgG + 0.114 * bgB;
          const targetR = cornerBrightness > 160 ? bgR : 255;
          const targetG = cornerBrightness > 160 ? bgG : 255;
          const targetB = cornerBrightness > 160 ? bgB : 255;

          const len = data.length;
          for (let i = 0; i < len; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const a = data[i + 3];

            if (a === 0) continue; // Already transparent

            // Distance to detected background color
            const dr = r - targetR;
            const dg = g - targetG;
            const db = b - targetB;
            const dist = Math.sqrt(dr * dr + dg * dg + db * db);

            // Also check absolute lightness (pure or near white)
            const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
            const isNearWhite = r > 225 && g > 225 && b > 225;

            if (dist <= threshold || (isNearWhite && brightness > 228)) {
              // Completely transparent
              data[i + 3] = 0;
            } else if (dist < threshold + feather) {
              // Smooth feathering to avoid jagged halo artifacts
              const factor = (dist - threshold) / feather;
              data[i + 3] = Math.min(a, Math.round(a * Math.max(0, Math.min(1, factor))));
            }
          }

          ctx.putImageData(imgData, 0, 0);

          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error("فشل تحويل الصورة الشفافة إلى ملف"));
                return;
              }

              const cleanBaseName = file.name.replace(/\.[^/.]+$/, "") || "transparent";
              const processedFile = new File([blob], `${cleanBaseName}_transparent.png`, {
                type: "image/png",
                lastModified: Date.now(),
              });

              const dataUrl = canvas.toDataURL("image/png");
              resolve({
                file: processedFile,
                dataUrl,
              });
            },
            "image/png",
            1.0
          );
        } catch (err) {
          reject(err);
        }
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
