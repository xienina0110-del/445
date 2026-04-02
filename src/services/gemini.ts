import { GoogleGenAI, Type } from "@google/genai";
import { Question, SimilarQuestion } from "../types";

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function recognizeQuestion(base64Image: string): Promise<Partial<Question>> {
  const model = genAI.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      {
        parts: [
          { inlineData: { data: base64Image.split(',')[1], mimeType: "image/jpeg" } },
          { text: "请识别图片中的题目。提取题目正文、选项（如果有）、用户原答案（如果有）、标准答案（如果有）。同时判断该题目的核心知识点（如'一元二次方程'）。请以JSON格式返回，包含字段：content, options (数组), userAnswer, standardAnswer, knowledgePoint, subject。" }
        ]
      }
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          content: { type: Type.STRING },
          options: { type: Type.ARRAY, items: { type: Type.STRING } },
          userAnswer: { type: Type.STRING },
          standardAnswer: { type: Type.STRING },
          knowledgePoint: { type: Type.STRING },
          subject: { type: Type.STRING }
        },
        required: ["content", "knowledgePoint"]
      }
    }
  });

  const result = await model;
  return JSON.parse(result.text || "{}");
}

export async function generateSimilarQuestions(knowledgePoint: string, originalQuestion: string): Promise<SimilarQuestion[]> {
  const model = genAI.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `基于知识点“${knowledgePoint}”，参考原题“${originalQuestion}”，生成3道类似的举一反三题目。
    要求：
    1. 难度相当或略有提升。
    2. 每道题包含：题目内容、选项（如适用）、正确答案、详细解析。
    3. 解析侧重于“易错点分析”。
    请以JSON数组格式返回，每个对象包含：content, options (数组, 可选), answer, explanation, commonMistakes。`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            content: { type: Type.STRING },
            options: { type: Type.ARRAY, items: { type: Type.STRING } },
            answer: { type: Type.STRING },
            explanation: { type: Type.STRING },
            commonMistakes: { type: Type.STRING }
          },
          required: ["content", "answer", "explanation", "commonMistakes"]
        }
      }
    }
  });

  const result = await model;
  return JSON.parse(result.text || "[]");
}
