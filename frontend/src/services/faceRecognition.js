/**
 * Face Recognition Service (Browser-side)
 * 
 * Uses face-api.js with real neural network models to:
 * - Detect faces in webcam frames
 * - Extract 128-dimensional face descriptors
 * - Perform liveness checks (basic)
 * 
 * The descriptors are then sent to the backend for storage/matching in Pinecone.
 */

import * as faceapi from 'face-api.js';

const MODEL_CDN = 'https://justadudewhohacks.github.io/face-api.js/models';

let modelsLoaded = false;
let loadingPromise = null;

/**
 * Load face-api.js models (SSD MobileNet + landmarks + recognition).
 * Returns a promise that resolves when all models are ready.
 * Safe to call multiple times — only loads once.
 */
export async function loadFaceModels() {
  if (modelsLoaded) return true;

  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    try {
      console.log('[FACE-REC] Loading face recognition models from CDN...');
      await Promise.all([
        faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_CDN),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_CDN),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_CDN),
      ]);
      modelsLoaded = true;
      console.log('[FACE-REC] ✅ All face recognition models loaded');
      return true;
    } catch (err) {
      console.error('[FACE-REC] ❌ Failed to load models:', err);
      loadingPromise = null;
      throw new Error('Failed to load face recognition models');
    }
  })();

  return loadingPromise;
}

/**
 * Check if models are loaded.
 */
export function areModelsLoaded() {
  return modelsLoaded;
}

/**
 * Detect a single face in a base64 image and return its 128-dim descriptor.
 * 
 * @param {string} base64Image - The base64-encoded image (with or without data URI prefix)
 * @returns {Promise<{descriptor: number[], detection: object} | null>}
 *          Returns null if no face detected.
 */
export async function extractDescriptor(base64Image) {
  if (!modelsLoaded) {
    await loadFaceModels();
  }

  // Create an HTMLImageElement from the base64 string
  const img = await createImageElement(base64Image);

  // Detect single face with landmarks + descriptor
  const result = await faceapi
    .detectSingleFace(img, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
    .withFaceLandmarks()
    .withFaceDescriptor();

  if (!result) {
    console.log('[FACE-REC] No face detected in image');
    return null;
  }

  console.log(`[FACE-REC] Face detected: confidence=${result.detection.score.toFixed(3)}, descriptor dim=${result.descriptor.length}`);

  return {
    descriptor: Array.from(result.descriptor), // Float32Array → regular array
    detection: {
      score: result.detection.score,
      box: result.detection.box,
    },
  };
}

/**
 * Extract descriptors from multiple images (for registration).
 * Returns an array of 128-dim descriptor arrays.
 * Throws if any image has no detectable face.
 * 
 * @param {string[]} images - Array of base64 images
 * @returns {Promise<number[][]>} Array of descriptor arrays
 */
export async function extractDescriptors(images) {
  if (!modelsLoaded) {
    await loadFaceModels();
  }

  const descriptors = [];

  for (let i = 0; i < images.length; i++) {
    const result = await extractDescriptor(images[i]);
    if (!result) {
      throw new Error(`No face detected in image ${i + 1}. Please ensure your face is clearly visible.`);
    }
    descriptors.push(result.descriptor);
    console.log(`[FACE-REC] Image ${i + 1}/${images.length}: descriptor extracted (confidence=${result.detection.score.toFixed(3)})`);
  }

  return descriptors;
}

/**
 * Perform a basic liveness check on a video element.
 * Checks that exactly ONE face is detected with reasonable confidence.
 * 
 * @param {HTMLVideoElement|HTMLImageElement} input - The video/image element
 * @returns {Promise<{alive: boolean, message: string}>}
 */
export async function livenessCheck(input) {
  if (!modelsLoaded) {
    await loadFaceModels();
  }

  const detections = await faceapi
    .detectAllFaces(input, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
    .withFaceLandmarks();

  if (detections.length === 0) {
    return { alive: false, message: 'No face detected' };
  }

  if (detections.length > 1) {
    return { alive: false, message: 'Multiple faces detected' };
  }

  const face = detections[0];

  // Check face detection confidence
  if (face.detection.score < 0.7) {
    return { alive: false, message: 'Face not clear enough' };
  }

  // Basic eye openness check using landmark positions
  const landmarks = face.landmarks;
  const leftEye = landmarks.getLeftEye();
  const rightEye = landmarks.getRightEye();
  
  const leftEAR = eyeAspectRatio(leftEye);
  const rightEAR = eyeAspectRatio(rightEye);
  const avgEAR = (leftEAR + rightEAR) / 2;

  if (avgEAR < 0.18) {
    return { alive: false, message: 'Eyes appear closed' };
  }

  return { alive: true, message: 'Liveness check passed' };
}

/**
 * Calculate Eye Aspect Ratio (EAR) for liveness detection.
 * Uses the 6-point eye landmark model from face-api.js.
 */
function eyeAspectRatio(eyePoints) {
  // eyePoints: array of {x, y} for 6 landmarks around the eye
  // EAR = (||p2-p6|| + ||p3-p5||) / (2 * ||p1-p4||)
  const p1 = eyePoints[0];
  const p2 = eyePoints[1];
  const p3 = eyePoints[2];
  const p4 = eyePoints[3];
  const p5 = eyePoints[4];
  const p6 = eyePoints[5];

  const a = Math.sqrt((p2.x - p6.x) ** 2 + (p2.y - p6.y) ** 2);
  const b = Math.sqrt((p3.x - p5.x) ** 2 + (p3.y - p5.y) ** 2);
  const c = Math.sqrt((p1.x - p4.x) ** 2 + (p1.y - p4.y) ** 2);

  return (a + b) / (2.0 * c + 1e-6);
}

/**
 * Create an HTMLImageElement from a base64 string.
 */
function createImageElement(base64) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(new Error('Failed to load image'));
    // Ensure data URI prefix
    if (base64.startsWith('data:')) {
      img.src = base64;
    } else {
      img.src = `data:image/jpeg;base64,${base64}`;
    }
  });
}
