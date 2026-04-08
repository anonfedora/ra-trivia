import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from 'dotenv';

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

let lastQuotaErrorTime = 0;
const QUOTA_COOLDOWN_MS = 60000; // 1 minute cooldown on quota errors

export interface SupportTemplate {
    id: string;
    title: string;
    content: string;
}

export interface AISuggestion {
    templateId: string | null;
    confidence: number;
    reasoning: string;
    suggestedReply?: string;
}

/**
 * AI Service to handle support message analysis and suggestions using Gemini 1.5 Flash.
 */
export const aiService = {
    /**
     * Analyzes a candidate message and suggests the best matching template.
     */
    suggestTemplate: async (message: string, templates: SupportTemplate[]): Promise<AISuggestion> => {
        if (!process.env.GEMINI_API_KEY) {
            return aiService.fallbackSuggest(message, templates);
        }

        // Check if we are in a quota cooldown
        if (Date.now() - lastQuotaErrorTime < QUOTA_COOLDOWN_MS) {
            return aiService.fallbackSuggest(message, templates);
        }

        try {
            const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

            const prompt = `
                You are an AI Support Assistant for a professional quiz platform.
                Your task is to analyze a candidate's support message and suggest the best response from a set of predefined templates.

                Candidate Message: "${message}"

                Available Templates:
                ${templates.map(t => `ID: ${t.id} | Title: ${t.title} | Content: ${t.content}`).join('\n')}

                Instructions:
                1. Find the template that most accurately addresses the candidate's query.
                2. Provide a confidence score between 0 and 1.
                3. Briefly explain why this template was chosen.
                4. If no template fits well (confidence < 0.4), return null for templateId and suggest a custom reply based on the context.
                5. Return the result strictly in JSON format.

                Output Format:
                {
                    "templateId": "ID or null",
                    "confidence": 0.0 to 1.0,
                    "reasoning": "Brief explanation",
                    "suggestedReply": "Custom reply if no template fits, otherwise null"
                }
            `;

            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();
            
            // Extract JSON from the response (sometimes Gemini wraps it in markdown blocks)
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]) as AISuggestion;
            }

            throw new Error('Invalid AI response format');
        } catch (error: any) {
            // Log a friendly message for quota errors
            if (error.status === 429) {
                console.warn('[AI_SERVICE] Quota exceeded (429). Falling back to keyword matching.');
                lastQuotaErrorTime = Date.now();
            } else {
                console.error('[AI_SERVICE] Error generating suggestion:', error);
            }
            return aiService.fallbackSuggest(message, templates);
        }
    },

    /**
     * Fallback logic when AI is unavailable or fails.
     */
    fallbackSuggest: (message: string, templates: SupportTemplate[]): AISuggestion => {
        const lowerMsg = message.toLowerCase();
        
        // Comprehensive keyword-based fallback - increased confidence to 0.9 to trigger auto-reply
        if (lowerMsg.includes('login') || lowerMsg.includes('password') || lowerMsg.includes('sign in') || lowerMsg.includes('credential')) {
            return { templateId: '6', confidence: 0.9, reasoning: 'Keyword match: Login issues' };
        }
        if (lowerMsg.includes('otp') || lowerMsg.includes('code') || lowerMsg.includes('verify') || lowerMsg.includes('authentication') || lowerMsg.includes('activation')) {
            return { templateId: '7', confidence: 0.9, reasoning: 'Keyword match: OTP/Verification' };
        }
        if (lowerMsg.includes('result') || lowerMsg.includes('score') || lowerMsg.includes('mark') || lowerMsg.includes('passed') || lowerMsg.includes('failed') || lowerMsg.includes('certificate')) {
            return { templateId: '5', confidence: 0.9, reasoning: 'Keyword match: Results/Certificates' };
        }
        if (lowerMsg.includes('tech') || lowerMsg.includes('internet') || lowerMsg.includes('error') || lowerMsg.includes('freeze') || lowerMsg.includes('crash') || lowerMsg.includes('broken')) {
            return { templateId: '4', confidence: 0.9, reasoning: 'Keyword match: Technical issues' };
        }
        if (lowerMsg.includes('exam') || lowerMsg.includes('quiz') || lowerMsg.includes('test') || lowerMsg.includes('session') || lowerMsg.includes('missing')) {
            return { templateId: '8', confidence: 0.9, reasoning: 'Keyword match: Exam visibility' };
        }
        if (lowerMsg.includes('retake') || lowerMsg.includes('re-take') || lowerMsg.includes('try again') || lowerMsg.includes('attempt')) {
            return { templateId: '9', confidence: 0.9, reasoning: 'Keyword match: Retake policy' };
        }
        if (lowerMsg.includes('hi') || lowerMsg.includes('hello') || lowerMsg.includes('hey') || lowerMsg.includes('greeting')) {
            return { templateId: '1', confidence: 0.85, reasoning: 'Keyword match: Greeting' };
        }
        if (lowerMsg.includes('thanks') || lowerMsg.includes('thank you') || lowerMsg.includes('resolved') || lowerMsg.includes('fixed') || lowerMsg.includes('work now')) {
            return { templateId: '3', confidence: 0.85, reasoning: 'Keyword match: Resolution' };
        }

        return { templateId: null, confidence: 0, reasoning: 'No clear match found' };
    }
};
