/**
 * Utility for client-side image processing.
 * Automatically removes paper, grey tints, and solid backgrounds from uploaded
 * official stamps and signatures using adaptive Otsu thresholding and smooth anti-aliasing.
 */

export interface ProcessedImageResult {
  file: File;
  dataUrl: string;
}

export function removeImageBackground(
  file: File,
  options?: {
    threshold?: number;
    feather?: number;
  }
): Promise<ProcessedImageResult> {
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
          const totalPixels = width * height;

          // 1. Check if the image already has transparent areas (> 1.5% pixels transparent)
          let existingTransparentPixels = 0;
          for (let i = 3; i < data.length; i += 4) {
            if (data[i] < 128) existingTransparentPixels++;
          }
          const isAlreadyTransparent = existingTransparentPixels > totalPixels * 0.015;

          // 2. Sample perimeter margins (inset by 5%) to detect true paper color without edge border artifacts
          const insetX = Math.max(2, Math.floor(width * 0.05));
          const insetY = Math.max(2, Math.floor(height * 0.05));
          const periSamplesR: number[] = [];
          const periSamplesG: number[] = [];
          const periSamplesB: number[] = [];

          const step = Math.max(1, Math.floor(width / 50));
          for (let x = insetX; x < width - insetX; x += step) {
            const topIdx = (insetY * width + x) * 4;
            const btmIdx = ((height - insetY - 1) * width + x) * 4;
            periSamplesR.push(data[topIdx], data[btmIdx]);
            periSamplesG.push(data[topIdx + 1], data[btmIdx + 1]);
            periSamplesB.push(data[topIdx + 2], data[btmIdx + 2]);
          }
          for (let y = insetY; y < height - insetY; y += step) {
            const leftIdx = (y * width + insetX) * 4;
            const rightIdx = (y * width + (width - insetX - 1)) * 4;
            periSamplesR.push(data[leftIdx], data[rightIdx]);
            periSamplesG.push(data[leftIdx + 1], data[rightIdx + 1]);
            periSamplesB.push(data[leftIdx + 2], data[rightIdx + 2]);
          }

          const getMedian = (arr: number[]) => {
            if (arr.length === 0) return 255;
            const sorted = [...arr].sort((a, b) => a - b);
            return sorted[Math.floor(sorted.length / 2)];
          };

          const periMedR = getMedian(periSamplesR);
          const periMedG = getMedian(periSamplesG);
          const periMedB = getMedian(periSamplesB);

          // 3. Build luminance histogram for Otsu thresholding
          const hist = new Int32Array(256);
          let sumTotalLum = 0;
          let opaqueCount = 0;

          for (let i = 0; i < data.length; i += 4) {
            if (data[i + 3] === 0) continue;
            const lum = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
            hist[lum]++;
            sumTotalLum += lum;
            opaqueCount++;
          }

          if (opaqueCount === 0) {
            resolve({ file, dataUrl: canvas.toDataURL("image/png") });
            return;
          }

          // 4. Calculate Otsu's optimal threshold separating foreground (ink) from background (paper)
          let sumB = 0;
          let weightB = 0;
          let maxVariance = 0;
          let otsuThreshold = 128;

          for (let t = 0; t < 256; t++) {
            weightB += hist[t];
            if (weightB === 0) continue;
            const weightF = opaqueCount - weightB;
            if (weightF === 0) break;

            sumB += t * hist[t];
            const meanB = sumB / weightB;
            const meanF = (sumTotalLum - sumB) / weightF;
            const variance = weightB * weightF * ((meanB - meanF) ** 2);

            if (variance > maxVariance) {
              maxVariance = variance;
              otsuThreshold = t;
            }
          }

          // 5. Compute median luminance for ink (foreground) and paper (background)
          const fgCount = hist.slice(0, otsuThreshold).reduce((a, b) => a + b, 0);
          const bgCount = hist.slice(otsuThreshold).reduce((a, b) => a + b, 0);

          let inkLum = 35;
          let accFg = 0;
          for (let t = 0; t < otsuThreshold; t++) {
            accFg += hist[t];
            if (accFg >= fgCount / 2) {
              inkLum = t;
              break;
            }
          }

          let paperLum = 220;
          let accBg = 0;
          for (let t = otsuThreshold; t < 256; t++) {
            accBg += hist[t];
            if (accBg >= bgCount / 2) {
              paperLum = t;
              break;
            }
          }

          // 6. Refine background color from background cluster
          let bgRSum = 0, bgGSum = 0, bgBSum = 0, bgSamplesCount = 0;
          for (let i = 0; i < data.length; i += 4) {
            if (data[i + 3] === 0) continue;
            const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
            if (Math.abs(lum - paperLum) < 15) {
              bgRSum += data[i];
              bgGSum += data[i + 1];
              bgBSum += data[i + 2];
              bgSamplesCount++;
            }
          }

          const targetR = bgSamplesCount > 0 ? bgRSum / bgSamplesCount : periMedR;
          const targetG = bgSamplesCount > 0 ? bgGSum / bgSamplesCount : periMedG;
          const targetB = bgSamplesCount > 0 ? bgBSum / bgSamplesCount : periMedB;

          // Transition ranges
          const tHigh = Math.max(paperLum - 8, otsuThreshold + Math.floor((paperLum - otsuThreshold) * 0.45));
          const tLow = Math.min(inkLum + 12, otsuThreshold - Math.floor((otsuThreshold - inkLum) * 0.35));

          // 7. Apply transparency & feathering
          const len = data.length;
          for (let i = 0; i < len; i += 4) {
            const a = data[i + 3];
            if (a === 0) continue;

            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];

            const lum = 0.299 * r + 0.587 * g + 0.114 * b;
            const dr = r - targetR;
            const dg = g - targetG;
            const db = b - targetB;
            const colorDist = Math.sqrt(dr * dr + dg * dg + db * db);
            const maxChromaDiff = Math.max(Math.abs(dr), Math.abs(dg), Math.abs(db));

            // Colored ink (e.g. red / blue official stamps)
            const isColoredInk = colorDist > 38 && maxChromaDiff > 25;

            // Near-white or background paper
            const isPaperBg =
              (lum >= tHigh && !isColoredInk) ||
              (colorDist < 25 && lum > otsuThreshold - 15) ||
              (lum > 225 && r > 220 && g > 220 && b > 220);

            if (isPaperBg && !isAlreadyTransparent) {
              data[i + 3] = 0;
            } else if (lum <= tLow || isColoredInk) {
              // Full opacity ink
              data[i + 3] = a;

              // Darken and enrich neutral ink to eliminate grey paper wash
              if (!isColoredInk && maxChromaDiff < 30) {
                const scale = Math.min(1.0, lum / Math.max(paperLum, 1));
                data[i] = Math.round(r * scale);
                data[i + 1] = Math.round(g * scale);
                data[i + 2] = Math.round(b * scale);
              }
            } else {
              // Smooth feathering zone
              const factor = (tHigh - lum) / Math.max(1, tHigh - tLow);
              const clamped = Math.max(0, Math.min(1, factor));
              // Hermite smoothstep for anti-aliased pen edges
              const smoothFactor = clamped * clamped * (3 - 2 * clamped);
              const newAlpha = Math.round(a * smoothFactor);

              data[i + 3] = newAlpha;

              if (newAlpha > 0 && !isColoredInk && maxChromaDiff < 30) {
                const scale = Math.min(1.0, lum / Math.max(paperLum, 1));
                data[i] = Math.round(r * scale);
                data[i + 1] = Math.round(g * scale);
                data[i + 2] = Math.round(b * scale);
              }
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
