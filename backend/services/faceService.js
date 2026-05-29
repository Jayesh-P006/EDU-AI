/**
 * Face Recognition Service using Pinecone Vector Database
 * 
 * Receives pre-computed 128-dim face descriptors from the frontend
 * (extracted via face-api.js neural network models in the browser),
 * stores them in Pinecone, and queries for face verification during login.
 * 
 * Architecture:
 *   Browser (face-api.js) → 128-dim descriptor → Backend → Pinecone
 */

import {Pinecone} from '@pinecone-database/pinecone';

const INDEX_DIMENSION=parseInt(process.env.PINECONE_FACE_DIMENSION||'512', 10);
const DESCRIPTOR_DIMENSION=128;  // face-api.js always produces 128-dim
const MIN_SCORE=parseFloat(process.env.FACE_MIN_SCORE||'0.85');  // Raised from 0.4 for biometric security
const RATIO_THRESHOLD=parseFloat(process.env.FACE_RATIO_THRESHOLD||'0.05');  // Raised from 0.18 for stricter matching

let pineconeIndex=null;
let initError=null;

// ── Initialize Pinecone connection ──────────────────────────────────
async function getIndex()
{
  if (pineconeIndex) return pineconeIndex;
  if (initError) throw new Error(initError);

  const apiKey=process.env.PINECONE_FACE_API_KEY;
  const indexName=process.env.PINECONE_FACE_INDEX;
  const host=process.env.PINECONE_FACE_HOST;

  if (!apiKey)
  {
    initError='Missing PINECONE_FACE_API_KEY';
    throw new Error(initError);
  }

  try
  {
    const pc=new Pinecone({apiKey});

    if (host)
    {
      pineconeIndex=pc.index(indexName, host);
    } else
    {
      pineconeIndex=pc.index(indexName);
    }

    console.log(`[FACE-SERVICE] ✅ Connected to Pinecone index: ${indexName}`);
    return pineconeIndex;
  } catch (err)
  {
    initError=`Pinecone init failed: ${err.message}`;
    console.error(`[FACE-SERVICE] ❌ ${initError}`);
    throw new Error(initError);
  }
}

// ── Validate a descriptor array ─────────────────────────────────────
function validateDescriptor(descriptor)
{
  if (!Array.isArray(descriptor)) return false;
  if (descriptor.length!==DESCRIPTOR_DIMENSION) return false;
  return descriptor.every(v => typeof v==='number'&&isFinite(v));
}

// ── Pad a 128-dim descriptor to match the Pinecone index dimension ──
function padToIndexDimension(vector)
{
  if (vector.length===INDEX_DIMENSION) return vector;
  const padded=new Array(INDEX_DIMENSION).fill(0);
  for (let i=0;i<vector.length;i++)
  {
    padded[i]=vector[i];
  }
  return padded;
}

// ── L2 normalize a vector ───────────────────────────────────────────
function l2Normalize(vector)
{
  let norm=0;
  for (let i=0;i<vector.length;i++)
  {
    norm+=vector[i]*vector[i];
  }
  norm=Math.sqrt(norm)+1e-8;
  return vector.map(v => v/norm);
}

// ── Average multiple descriptors into a master descriptor ───────────
function averageDescriptors(descriptors)
{
  const avg=new Array(DESCRIPTOR_DIMENSION).fill(0);
  for (const desc of descriptors)
  {
    for (let i=0;i<DESCRIPTOR_DIMENSION;i++)
    {
      avg[i]+=desc[i];
    }
  }
  for (let i=0;i<DESCRIPTOR_DIMENSION;i++)
  {
    avg[i]/=descriptors.length;
  }
  return l2Normalize(avg);
}

// ── Register face descriptors for a user ────────────────────────────
/**
 * @param {string} userId - Unique user identifier
 * @param {number[][]} descriptors - Array of 128-dim face descriptor arrays
 *                                    (pre-computed by face-api.js in the browser)
 */
export async function registerFace(userId, descriptors)
{
  if (!descriptors||descriptors.length===0)
  {
    return {result: null, error: 'No face descriptors provided'};
  }

  // Validate all descriptors
  for (let i=0;i<descriptors.length;i++)
  {
    if (!validateDescriptor(descriptors[i]))
    {
      console.error(`[FACE-SERVICE] Descriptor ${i} invalid: length=${descriptors[i]?.length}, expected=${DESCRIPTOR_DIMENSION}`);
      return {result: null, error: `Invalid descriptor at index ${i}`};
    }
  }

  const index=await getIndex();

  // Average all descriptors into a single master descriptor
  const masterDescriptor=averageDescriptors(descriptors);

  const metadata={
    user_id: userId,
    samples: descriptors.length,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  try
  {
    const paddedDescriptor=padToIndexDimension(masterDescriptor);

    await index.upsert([{
      id: userId,
      values: paddedDescriptor,
      metadata,
    }]);

    console.log(`[FACE-SERVICE] ✅ Registered face for ${userId} with ${descriptors.length} samples (128→${INDEX_DIMENSION})`);
    return {
      result: {user_id: userId, samples: descriptors.length},
      error: null,
    };
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
    {
      return {exists: false, userId: null, error: 'Invalid descriptor'};
    }

    const index=await getIndex();
    const paddedDescriptor=padToIndexDimension(descriptor);

    const queryResult=await index.query({
      vector: paddedDescriptor,
      topK: 1,
      includeMetadata: true,
    });

    const matches=queryResult.matches||[];
    if (matches.length===0)
    {
      return {exists: false, userId: null, error: null};
    }

    const best=matches[0];
    const score=best.score||0;

    console.log(`[FACE-SERVICE] Face check: best score=${score.toFixed(4)}, threshold=${MIN_SCORE}`);

    if (score>=MIN_SCORE)
    {
      const userId=best.metadata?.user_id||best.id;
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
 * @param {number[]} descriptor - A single 128-dim face descriptor
 *                                (pre-computed by face-api.js in the browser)
 */
export async function verifyFace(descriptor)
{
  try
  {
    if (!validateDescriptor(descriptor))
    {
      return {result: null, error: `Invalid descriptor (got length=${descriptor?.length}, expected=${DESCRIPTOR_DIMENSION})`};
    }

    const index=await getIndex();
    const paddedDescriptor=padToIndexDimension(descriptor);

    const queryResult=await index.query({
      vector: paddedDescriptor,
      topK: 5,
      includeMetadata: true,
    });

    const matches=queryResult.matches||[];
    console.log(`[FACE-SERVICE] Verify: ${matches.length} matches found`);

    if (matches.length===0)
    {
      return {result: null, error: 'No match found'};
    }

    for (let i=0;i<Math.min(matches.length, 3);i++)
    {
      const m=matches[i];
      console.log(`[FACE-SERVICE]   Match ${i}: id=${m.id}, score=${(m.score||0).toFixed(4)}, user=${m.metadata?.user_id}`);
    }

    const best=matches[0];
    const score=best.score||0;

    if (score<MIN_SCORE)
    {
      console.log(`[FACE-SERVICE] Score ${score.toFixed(4)} below threshold ${MIN_SCORE}`);
      return {result: null, error: `Low similarity: ${score.toFixed(3)}. Face not recognized.`};
    }

    // Additional check: verify the gap between best and second-best match
    // If they're too close, the match is ambiguous
    if (matches.length>=2)
    {
      const secondScore=matches[1].score||0;
      const gap=score-secondScore;
      console.log(`[FACE-SERVICE] Score gap between top-2: ${gap.toFixed(4)}`);
      // If gap is very small and score isn't high, reject as ambiguous
      if (gap<0.05&&score<0.6)
      {
        return {result: null, error: 'Ambiguous match. Please try again with better lighting.'};
      }
    }

    const userId=best.metadata?.user_id||best.id;

    // Adaptive update: slightly shift the stored embedding toward the new descriptor
    try
    {
      const lr=0.05;
      const fetchResult=await index.fetch([userId]);
      const stored=fetchResult.records?.[userId];
      if (stored&&stored.values)
      {
        const paddedDesc=padToIndexDimension(descriptor);
        const updated=new Array(INDEX_DIMENSION);
        for (let i=0;i<INDEX_DIMENSION;i++)
        {
          updated[i]=(1-lr)*stored.values[i]+lr*paddedDesc[i];
        }
        const normalized=l2Normalize(updated);
        const meta={...(stored.metadata||{}), updated_at: new Date().toISOString()};
        await index.upsert([{id: userId, values: normalized, metadata: meta}]);
        console.log(`[FACE-SERVICE] Adaptive update applied for ${userId}`);
      }
    } catch (updateErr)
    {
      console.log(`[FACE-SERVICE] Adaptive update skipped: ${updateErr.message}`);
    }

    return {
      result: {user_id: userId, score},
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
    const index=await getIndex();
    await index.deleteOne(userId);
    console.log(`[FACE-SERVICE] Deleted face data for ${userId}`);
    return {success: true};
  } catch (err)
  {
    console.error(`[FACE-SERVICE] deleteFace error: ${err.message}`);
    return {success: false, error: err.message};
  }
}
