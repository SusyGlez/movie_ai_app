import "dotenv/config";
import express from "express";
import cors from "cors";
import { deepseek, embeddingModel, supabase } from "./config.js";

const app = express();
app.use(cors());
app.use(express.json());

async function fetchPoster(title) {
  const response = await fetch(
    `http://www.omdbapi.com/?t=${encodeURIComponent(title)}&apikey=${process.env.OMDB_API_KEY}`,
  );
  const data = await response.json();

  if (data.Response === "False" || !data.Poster || data.Poster === "N/A") {
    return null;
  }

  return data.Poster;
}

const genreKeywords = {
  horror: [
    "horror",
    "scary",
    "terrifying",
    "werewolf",
    "monster",
    "ghost",
    "haunted",
    "slasher",
    "zombie",
    "demon",
    "possession",
  ],
  comedy: ["comedy", "comedic", "hilarious", "funny"],
  drama: ["drama", "dramatic"],
  action: ["action", "explosive", "fight"],
  romance: ["romance", "romantic", "love story"],
  thriller: ["thriller", "suspense", "suspenseful"],
  scifi: ["sci-fi", "science fiction", "space", "alien", "futuristic"],
  fantasy: ["fantasy", "magic", "magical", "mythical"],
  animation: ["animation", "animated"],
  documentary: ["documentary", "documentaries"],
  mystery: ["mystery", "whodunit", "detective", "investigation", "sleuth"],
};

function expandGenre(genre) {
  const normalized = genre.toLowerCase().trim();
  return genreKeywords[normalized] || [normalized];
}

app.post("/recommend", async (req, res) => {
  try {
    const profiles = req.body.people;
    const availableMinutes = req.body.availableMinutes;

    // 1. Calculate an explicit, objective mood count
    const moodCounts = profiles.reduce((counts, p) => {
      counts[p.mood] = (counts[p.mood] || 0) + 1;
      return counts;
    }, {});

    const moodSummary = Object.entries(moodCounts)
      .map(([mood, count]) => `${count}x ${mood}`)
      .join(", ");

    const profilesText = profiles
      .map(
        (p, i) =>
          `Person ${i + 1}: mood=${p.mood}, favoriteMovie=${p.favoriteMovie}`,
      )
      .join("\n");

    const summaryResponse = await deepseek.chat.completions.create({
      model: "deepseek-chat",
      messages: [
        {
          role: "system",
          content: `Combine the preferences of multiple people into a single short paragraph describing what kind of movie the group would enjoy together.

IMPORTANT: Weigh every person's mood equally, regardless of how much detail they wrote. A person who wrote a long explanation should NOT count more than someone who only wrote a short answer. The group mood tally is: ${moodSummary}. This tally reflects the group's true preference and should be the PRIMARY signal — treat individual favorite movies and explanations as secondary flavor, not as override signals.

If the group has different moods (e.g. some want Comedy, others want Horror), don't just pick one — look for a genre blend that satisfies multiple preferences at once (e.g. comedy-horror, action-comedy, romantic thriller). The goal is to find common ground, not to favor the loudest or most detailed opinion.`,
        },
        { role: "user", content: profilesText },
      ],
    });

    const summaryText = summaryResponse.choices[0].message.content;
    console.log("Group summary:", summaryText);

    // 2. Generate the embedding of that summary
    const embeddingResult = await embeddingModel.embedContent(summaryText);
    const queryEmbedding = embeddingResult.embedding.values;

    // 3. Search for candidate movies by similarity
    const { data: candidates, error } = await supabase.rpc("match_documents", {
      query_embedding: queryEmbedding,
      match_threshold: 0.3,
      match_count: 20,
    });

    if (error) {
      console.error("Search error:", error);
      return res.status(500).json({ error: "Error searching for movies" });
    }

    const genresToAvoid = profiles
      .map((p) => p.genreToAvoid)
      .filter((g) => g && g.length > 0)
      .flatMap((g) => expandGenre(g));

    const genreFilteredCandidates = candidates.filter((movie) => {
      const movieContentLower = movie.content.toLowerCase();
      return !genresToAvoid.some((keyword) =>
        movieContentLower.includes(keyword),
      );
    });

    const filteredCandidates = genreFilteredCandidates.filter(
      (movie) => movie.duration_minutes <= availableMinutes,
    );

    const finalPicks = filteredCandidates.slice(0, 5); // Recommends up to 5, never forces 5 recommendations
    const picksWithDescriptions = await Promise.all(
      finalPicks.map(async (movie) => {
        const [descriptionResponse, posterUrl] = await Promise.all([
          deepseek.chat.completions.create({
            model: "deepseek-chat",
            messages: [
              {
                role: "system",
                content:
                  "Write a short, engaging one-sentence description of this movie for a recommendation app. Do not include the title, year, or rating.",
              },
              { role: "user", content: movie.content },
            ],
          }),
          fetchPoster(movie.title),
        ]);

        return {
          title: movie.title,
          releaseYear: movie.release_year,
          durationMinutes: movie.duration_minutes,
          description: descriptionResponse.choices[0].message.content,
          posterUrl,
        };
      }),
    );

    console.log(
      `Found ${candidates.length} candidates, ${filteredCandidates.length} fit the time available. Returning ${picksWithDescriptions.length}.`,
    );
    res.json({
      summaryText,
      picks: picksWithDescriptions,
      count: picksWithDescriptions.length,
    });
  } catch (err) {
    console.error("Error in /recommend:", err);
    res.status(500).json({ error: "Something went wrong" });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
