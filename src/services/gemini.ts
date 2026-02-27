import { GoogleGenAI, Type } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;

export const generateAIResponse = async (history: { role: string; parts: { text: string }[] }[], systemInstruction: string) => {
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");

  const ai = new GoogleGenAI({ apiKey });
  const model = ai.models.generateContent({
    model: "gemini-1.5-flash", // Using flash for low latency in chat
    contents: history as any,
    config: {
      systemInstruction,
    },
  });

  const response = await model;
  return response.text;
};

export const extractLeadData = async (conversationText: string) => {
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");

  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: "gemini-1.5-flash",
    contents: `Extract lead information from the following conversation:
    
    ${conversationText}
    
    Return the data in the specified JSON format.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          region: { type: Type.STRING },
          propertyType: { type: Type.STRING },
          bedrooms: { type: Type.STRING },
          budgetRange: { type: Type.STRING },
          paymentType: { type: Type.STRING },
          incomeEstimate: { type: Type.STRING },
          downPayment: { type: Type.STRING },
          purchaseTimeline: { type: Type.STRING },
          missingFields: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
      },
    },
  });

  return JSON.parse(response.text || "{}");
};

export const generateAnalyticsInsights = async (dataSummary: string) => {
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");

  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: "gemini-1.5-pro", // Pro for better analysis
    contents: `Analyze these real estate metrics and provide 3 key behavioral insights and 3 agent recommendations:
    
    ${dataSummary}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          insights: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                description: { type: Type.STRING },
              },
            },
          },
          recommendations: {
            type: Type.ARRAY,
            items: {
              type: Type.STRING,
            },
          },
        },
      },
    },
  });

  return JSON.parse(response.text || "{}");
};
