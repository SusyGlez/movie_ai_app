import fs from "fs";
import { EJSON } from "bson";
import { embeddingModel, supabase } from "./config.js";
import recentMovies from "./recentMovies.js";

const rawData = fs.readFileSync("./allMovies.json", "utf-8");
const mongoMovies = rawData
  .trim()
  .split("\n")
  .map((line) => EJSON.parse(line));

const allMovies = [...mongoMovies, ...recentMovies];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

async function getExistingTitles() {
  const { data, error } = await supabase.from("documents").select("title");
  if (error) {
    console.error("Error fetching existing titles:", error);
    return [];
  }
  return data.map((row) => row.title);
}

async function embedMovie(movie) {
  const textForEmbedding = `${movie.title}. Genres: ${(movie.genres || []).join(", ")}. Plot: ${movie.plot}`;
  const result = await embeddingModel.embedContent(textForEmbedding);

  return {
    title: movie.title,
    release_year: String(movie.year),
    content: textForEmbedding,
    duration_minutes: movie.runtime,
    embedding: result.embedding.values,
  };
}

async function seedDatabase() {
  const existingTitles = await getExistingTitles();
  console.log(`You already have ${existingTitles.length} movies saved.`);

  const usableMovies = allMovies.filter(
    (m) =>
      m.plot &&
      m.runtime &&
      m.year &&
      m.imdb?.rating &&
      !existingTitles.includes(m.title),
  );

  console.log(
    `${usableMovies.length} movies available to choose from (after removing duplicates).`,
  );

  const moviesToSeed = shuffleArray(usableMovies).slice(0, 100);

  const batchSize = 50;
  const allData = [];

  for (let i = 0; i < moviesToSeed.length; i += batchSize) {
    const batch = moviesToSeed.slice(i, i + batchSize);
    console.log(`Processing batch ${i / batchSize + 1}...`);

    const batchData = await Promise.all(batch.map(embedMovie));
    allData.push(...batchData);

    if (i + batchSize < moviesToSeed.length) {
      await sleep(60000);
    }
  }

  const { error } = await supabase.from("documents").insert(allData);
  if (error) {
    console.error("Error inserting:", error);
    return;
  }
  console.log(`${allData.length} movies inserted successfully!`);
}

seedDatabase();
