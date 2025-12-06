export interface ImageDimensions {
  width: number;
  height: number;
}

/**
 * Compress an image file to reduce size before converting to data URL.
 * @param file - The image file to compress
 * @param maxWidth - Maximum width (default: 1920)
 * @param maxHeight - Maximum height (default: 1080)
 * @param quality - JPEG quality 0-1 (default: 0.8)
 */
export function compressImage(
  file: File,
  maxWidth: number = 1920,
  maxHeight: number = 1080,
  quality: number = 0.8
): Promise<File> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;

        // Calculate new dimensions while maintaining aspect ratio
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width *= ratio;
          height *= ratio;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Failed to compress image'));
              return;
            }
            // Create a new File from the blob
            const compressedFile = new File([blob], file.name, {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });
            resolve(compressedFile);
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

/**
 * Convert a File object into a data URL that can be stored in Firestore.
 * Automatically compresses the image if it's too large.
 */
export async function fileToDataUrl(file: File): Promise<string> {
  // Compress image if it's larger than 1MB (more aggressive compression)
  let processedFile = file;
  if (file.size > 1 * 1024 * 1024) {
    try {
      // More aggressive compression: max 1200x900, 70% quality
      processedFile = await compressImage(file, 1200, 900, 0.7);
      console.log(`Compressed image from ${(file.size / 1024 / 1024).toFixed(2)}MB to ${(processedFile.size / 1024 / 1024).toFixed(2)}MB`);
    } catch (error) {
      console.warn('Failed to compress image, using original:', error);
    }
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Unable to read file as data URL'));
      }
    };
    reader.onerror = () => reject(reader.error ?? new Error('File read failed'));
    reader.readAsDataURL(processedFile);
  });
}

/**
 * Load an image and resolve its natural dimensions so we can size cards sensibly.
 */
export function getImageDimensions(src: string): Promise<ImageDimensions> {
  return new Promise((resolve) => {
    if (typeof Image === 'undefined') {
      resolve({ width: 256, height: 200 });
      return;
    }

    const img = new Image();
    img.onload = () => {
      resolve({
        width: img.naturalWidth || img.width || 256,
        height: img.naturalHeight || img.height || 200,
      });
    };
    img.onerror = () => {
      resolve({ width: 256, height: 200 });
    };
    img.src = src;
  });
}
