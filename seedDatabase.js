import fs from "fs";
import { embeddingModel, supabase } from "./config.js";

const rawData = fs.readFileSync("./allMovies.json", "utf-8");
const allMovies = JSON.parse(rawData);

// Only keep movies that have a plot and a runtime, then take a manageable sample
const usableMovies = allMovies.filter(
  (m) => m.plot && m.runtime && m.year && m.imdb?.rating,
);

const moviesToSeed = usableMovies
  .sort((a, b) => b.year - a.year || b.imdb.rating - a.imdb.rating)
  .slice(0, 300);

async function seedDatabase() {
  const data = await Promise.all(
    moviesToSeed.map(async (movie) => {
      const textForEmbedding = `${movie.title}. Genres: ${(movie.genres || []).join(", ")}. Plot: ${movie.plot}`;

      const result = await embeddingModel.embedContent(textForEmbedding);
      const embeddingVector = result.embedding.values;

      return {
        title: movie.title,
        release_year: String(movie.year),
        content: textForEmbedding,
        duration_minutes: movie.runtime,
        embedding: embeddingVector,
      };
    }),
  );

  const { error } = await supabase.from("documents").insert(data);
  if (error) {
    console.error("Error inserting:", error);
    return;
  }
  console.log(`${data.length} movies inserted successfully!`);
}

seedDatabase();
