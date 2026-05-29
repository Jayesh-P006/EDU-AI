import {GoogleGenAI} from '@google/genai';

// Lazy initialization to ensure dotenv is loaded first
let client=null;
function getClient()
{
    const apiKey=process.env.GEMINI_API_KEY;
    if (!apiKey)
    {
        console.warn('⚠️  GEMINI_API_KEY not found in environment variables');
        console.warn('   Get your free API key from https://makersuite.google.com/app/apikey');
        return null;
    }

    if (!client)
    {
        client=new GoogleGenAI({apiKey});
        console.log('✅ Gemini AI initialized');
    }
    return client;
}

class GeminiAIService
{
    async generateResponse(messages, systemInstruction="You are Spec AI, a helpful AI assistant.")
    {
        try
        {
            const genAI=getClient();
            if (!genAI)
            {
                throw new Error('Gemini AI not initialized - API key missing');
            }

            // Convert messages to text prompt
            const prompt=messages.map(msg =>
            {
                const role=msg.role==='model'? 'AI':'User';
                const content=msg.content||msg.parts?.[0]?.text||'';
                return `${role}: ${content}`;
            }).join('\n');

            const fullPrompt = systemInstruction
                ? `System Instructions: ${systemInstruction}\n\n${prompt}`
                : prompt;

            const response=await genAI.models.generateContent({
                model: "gemini-2.0-flash",
                contents: fullPrompt,
                config: {
                    temperature: 0.7,
                    maxOutputTokens: 2048,
                }
            });

            return response.text||"I apologize, but I'm having trouble generating a response.";
        } catch (error)
        {
            console.error('Gemini AI Error:', error.message||JSON.stringify(error));
            return "I apologize, but I'm having trouble generating a response right now. Please try again.";
        }
    }

    async generateEmbedding(text)
    {
        try
        {
            const genAI=getClient();
            if (!genAI)
            {
                throw new Error('Gemini AI not initialized - API key missing');
            }

            const response=await genAI.models.embedContent({
                model: "text-embedding-004",
                contents: text
            });

            // Handle different possible response structures
            let values=null;
            if (response.embeddings?.[0]?.values)
            {
                values=response.embeddings[0].values;
            } else if (response.embedding?.values)
            {
                values=response.embedding.values;
            } else if (Array.isArray(response.embeddings?.[0]))
            {
                values=response.embeddings[0];
            } else if (Array.isArray(response.embedding))
            {
                values=response.embedding;
            } else if (Array.isArray(response.values))
            {
                values=response.values;
            } else if (Array.isArray(response))
            {
                values=response;
            }

            if (!Array.isArray(values)||values.length===0)
            {
                console.error('Invalid embedding response structure:', response);
                throw new Error('Failed to generate embeddings - unexpected response format');
            }

            return values;
        } catch (error)
        {
            console.error('Embedding Generation Error:', error.message||JSON.stringify(error));
            // Return a zero vector as fallback
            return new Array(768).fill(0);
        }
    }
}

export default new GeminiAIService();
