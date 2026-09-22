import "dotenv/config";
import express from "express";
import cors from "cors";
import { deepseek, embeddingModel, supabase } from "./config.js";

const app = express();
app.use(cors());
app.use(express.json());

app.post("/recommend", async (req, res) => {
  try {
    const profiles = req.body.people;

    // 1. Combine the profiles into a summary, using DeepSeek
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
          content:
            "Combine the preferences of multiple people into a single short paragraph describing what kind of movie the group would enjoy together.",
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

    const availableMinutes = req.body.availableMinutes;
    const filteredCandidates = candidates.filter(
      (movie) => movie.duration_minutes <= availableMinutes,
    );

    const finalPicks = filteredCandidates.slice(0, 5); // Recommends up to 5, never forces 5 recommendations
    const picksWithDescriptions = await Promise.all(
      finalPicks.map(async (movie) => {
        const descriptionResponse = await deepseek.chat.completions.create({
          model: "deepseek-chat",
          messages: [
            {
              role: "system",
              content:
                "Write a short, engaging one-sentence description of this movie for a recommendation app. Do not include the title, year, or rating.",
            },
            { role: "user", content: movie.content },
          ],
        });

        return {
          title: movie.title,
          releaseYear: movie.release_year,
          durationMinutes: movie.duration_minutes,
          description: descriptionResponse.choices[0].message.content,
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
