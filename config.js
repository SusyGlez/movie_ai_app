import "dotenv/config";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import { GoogleGenerativeAI } from "@google/generative-ai";

/** OpenAI (DeepSeek) config */
if (!process.env.DEEPSEEK_API_KEY)
  throw new Error("OpenAI API key is missing or invalid.");
export const deepseek = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: "https://api.deepseek.com",
});

/** Supabase config */
const privateKey = process.env.SUPABASE_API_KEY;
if (!privateKey) throw new Error(`Expected env var SUPABASE_API_KEY`);
const url = process.env.SUPABASE_URL;
if (!url) throw new Error(`Expected env var SUPABASE_URL`);
export const supabase = createClient(url, privateKey);

/** Gemini config */
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
export const embeddingModel = genAI.getGenerativeModel({
  model: "gemini-embedding-001",
});
