import { embeddingModel, supabase } from "./config.js";
import movies from "./content.js";

// Convierte "3 hr 10 min" a minutos totales
function parseDuration(content) {
  const match = content.match(/\((\d+)\s*hr(?:\s*(\d+)\s*min)?/);
  if (!match) return null;
  const hours = parseInt(match[1]);
  const minutes = match[2] ? parseInt(match[2]) : 0;
  return hours * 60 + minutes;
}

async function seedDatabase() {
  const data = await Promise.all(
    movies.map(async (movie) => {
      const result = await embeddingModel.embedContent(movie.content);
      const embeddingVector = result.embedding.values;

      return {
        title: movie.title,
        release_year: movie.releaseYear,
        content: movie.content,
        duration_minutes: parseDuration(movie.content),
        embedding: embeddingVector,
      };
    }),
  );

  const { error } = await supabase.from("documents").insert(data);
  if (error) {
    console.error("Error al insertar:", error);
    return;
  }
  console.log(`¡${data.length} películas insertadas con éxito!`);
}

seedDatabase();
