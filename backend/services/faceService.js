/**
 * Face Recognition Service using Pinecone Vector Database
 *
 * Stores raw 128-dim face descriptors from face-api.js in Pinecone.
 * Verification uses Euclidean distance in the original 128-dim space —
 * the metric face-api.js was trained on (same person < 0.5, different > 0.6).
 * Pinecone is used only for approximate nearest-neighbour candidate retrieval.
 */

import {Pinecone} from '@pinecone-database/pinecone';

const INDEX_DIMENSION = parseInt(process.env.PINECONE_FACE_DIMENSION || '512', 10);
const DESCRIPTOR_DIMENSION = 128;
// face-api.js Euclidean threshold: <0.5 strict, <0.6 lenient
const EUCLIDEAN_THRESHOLD = parseFloat(process.env.FACE_EUCLIDEAN_THRESHOLD || '0.50');

let pineconeIndex = null;
let initError = null;

// ── Initialize Pinecone connection ──────────────────────────────────
async function getIndex()
{
  if (pineconeIndex) return pineconeIndex;
  if (initError) throw new Error(initError);

  const apiKey = process.env.PINECONE_FACE_API_KEY;
  const indexName = process.env.PINECONE_FACE_INDEX;
  const host = process.env.PINECONE_FACE_HOST;

  if (!apiKey)
  {
    initError = 'Missing PINECONE_FACE_API_KEY';
    throw new Error(initError);
  }

  try
  {
    const pc = new Pinecone({apiKey});
    pineconeIndex = host ? pc.index(indexName, host) : pc.index(indexName);
    console.log(`[FACE-SERVICE] ✅ Connected to Pinecone index: ${indexName}`);
    return pineconeIndex;
  } catch (err)
  {
    initError = `Pinecone init failed: ${err.message}`;
    console.error(`[FACE-SERVICE] ❌ ${initError}`);
    throw new Error(initError);
  }
}

// ── Validate a descriptor array ─────────────────────────────────────
function validateDescriptor(descriptor)
{
  if (!Array.isArray(descriptor)) return false;
  if (descriptor.length !== DESCRIPTOR_DIMENSION) return false;
  return descriptor.every(v => typeof v === 'number' && isFinite(v));
}

// ── Pad a 128-dim descriptor to match the Pinecone index dimension ──
function padToIndexDimension(vector)
{
  if (vector.length === INDEX_DIMENSION) return vector;
  const padded = new Array(INDEX_DIMENSION).fill(0);
  for (let i = 0; i < vector.length; i++) padded[i] = vector[i];
  return padded;
}

// ── Euclidean distance in 128-dim space ─────────────────────────────
// face-api.js was trained on Euclidean distance: same person < 0.6, different > 0.6
function euclideanDistance(a, b)
{
  let sum = 0;
  for (let i = 0; i < DESCRIPTOR_DIMENSION; i++)
  {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

// ── Register face descriptors for a user ────────────────────────────
/**
 * @param {string} userId
 * @param {number[][]} descriptors - Array of 128-dim raw face descriptors from face-api.js
 */
export async function registerFace(userId, descriptors)
{
  if (!descriptors || descriptors.length === 0)
    return {result: null, error: 'No face descriptors provided'};

  for (let i = 0; i < descriptors.length; i++)
  {
    if (!validateDescriptor(descriptors[i]))
    {
      console.error(`[FACE-SERVICE] Descriptor ${i} invalid: length=${descriptors[i]?.length}`);
      return {result: null, error: `Invalid descriptor at index ${i}`};
    }
  }

  const index = await getIndex();

  // Store the raw frontal (first/center) descriptor — no normalization.
  // face-api.js Euclidean distance works on raw vectors; normalizing changes the metric.
  const rawDescriptor = Array.from(descriptors[0]);
  const paddedDescriptor = padToIndexDimension(rawDescriptor);

  const metadata = {
    user_id: userId,
    samples: descriptors.length,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  try
  {
    await index.upsert([{id: userId, values: paddedDescriptor, metadata}]);
    console.log(`[FACE-SERVICE] ✅ Registered face for ${userId} (raw 128-dim frontal descriptor)`);
    return {result: {user_id: userId, samples: descriptors.length}, error: null};
  } catch (err)
  {
    console.error(`[FACE-SERVICE] ❌ Pinecone upsert failed: ${err.message}`);
    return {result: null, error: `Pinecone error: ${err.message}`};
  }
}

// ── Check if a face already exists ──────────────────────────────────
/**
 * @param {number[]} descriptor - A single 128-dim face descriptor
 */
export async function checkFaceExists(descriptor)
{
  try
  {
    if (!validateDescriptor(descriptor))
      return {exists: false, userId: null, error: 'Invalid descriptor'};

    const index = await getIndex();

    const queryResult = await index.query({
      vector: padToIndexDimension(Array.from(descriptor)),
      topK: 1,
      includeMetadata: true,
      includeValues: true,
    });

    const matches = queryResult.matches || [];
    if (matches.length === 0) return {exists: false, userId: null, error: null};

    const best = matches[0];
    const storedRaw = best.values?.slice(0, DESCRIPTOR_DIMENSION);

    if (!storedRaw || storedRaw.length !== DESCRIPTOR_DIMENSION)
      return {exists: false, userId: null, error: null};

    const dist = euclideanDistance(descriptor, storedRaw);
    console.log(`[FACE-SERVICE] Face check: euclidean dist=${dist.toFixed(4)}, threshold=${EUCLIDEAN_THRESHOLD}`);

    if (dist < EUCLIDEAN_THRESHOLD)
    {
      const userId = best.metadata?.user_id || best.id;
      return {exists: true, userId, error: null};
    }

    return {exists: false, userId: null, error: null};
  } catch (err)
  {
    console.error(`[FACE-SERVICE] checkFaceExists error: ${err.message}`);
    return {exists: false, userId: null, error: err.message};
  }
}

// ── Verify a face (login) ───────────────────────────────────────────
/**
 * @param {number[]} descriptor - A single 128-dim face descriptor from face-api.js
 */
export async function verifyFace(descriptor)
{
  try
  {
    if (!validateDescriptor(descriptor))
    {
      return {result: null, error: `Invalid descriptor (got length=${descriptor?.length}, expected=${DESCRIPTOR_DIMENSION})`};
    }

    const index = await getIndex();

    // Retrieve top candidates AND their stored raw vectors for Euclidean comparison
    const queryResult = await index.query({
      vector: padToIndexDimension(Array.from(descriptor)),
      topK: 5,
      includeMetadata: true,
      includeValues: true,
    });

    const matches = queryResult.matches || [];
    console.log(`[FACE-SERVICE] Verify: ${matches.length} candidates found`);

    if (matches.length === 0)
      return {result: null, error: 'No registered faces found'};

    // Find the candidate with the lowest Euclidean distance
    let bestMatch = null;
    let bestDist = Infinity;

    for (const match of matches)
    {
      const storedRaw = match.values?.slice(0, DESCRIPTOR_DIMENSION);
      if (!storedRaw || storedRaw.length !== DESCRIPTOR_DIMENSION) continue;

      const dist = euclideanDistance(descriptor, storedRaw);
      const userId = match.metadata?.user_id || match.id;
      console.log(`[FACE-SERVICE]   Candidate: id=${match.id}, euclidean_dist=${dist.toFixed(4)}, user=${userId}`);

      if (dist < bestDist)
      {
        bestDist = dist;
        bestMatch = match;
      }
    }

    if (!bestMatch)
      return {result: null, error: 'Could not retrieve stored face data'};

    if (bestDist >= EUCLIDEAN_THRESHOLD)
    {
      console.log(`[FACE-SERVICE] Rejected: best dist=${bestDist.toFixed(4)} >= threshold=${EUCLIDEAN_THRESHOLD}`);
      return {result: null, error: 'Face not recognized. Please try again or use password login.'};
    }

    const userId = bestMatch.metadata?.user_id || bestMatch.id;
    console.log(`[FACE-SERVICE] ✅ Face verified: ${userId}, euclidean dist=${bestDist.toFixed(4)}`);

    return {
      result: {user_id: userId, score: parseFloat((1 - bestDist).toFixed(4))},
      error: null,
    };
  } catch (err)
  {
    console.error(`[FACE-SERVICE] verifyFace error: ${err.message}`);
    return {result: null, error: err.message};
  }
}

// ── Delete a user's face data ───────────────────────────────────────
export async function deleteFace(userId)
{
  try
  {
    const index = await getIndex();
    await index.deleteOne(userId);
    console.log(`[FACE-SERVICE] Deleted face data for ${userId}`);
    return {success: true};
  } catch (err)
  {
    console.error(`[FACE-SERVICE] deleteFace error: ${err.message}`);
    return {success: false, error: err.message};
  }
}
