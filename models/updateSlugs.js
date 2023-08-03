const db = require('../db');
const slugify = require('slugify');

async function updateSlugs() {
    try {
        // Fetch all games and their translations
        const { rows: games } = await db.query('SELECT id, name FROM games');

        for (const game of games) {
            const gameId = game.id;

            // Fetch translations for the game
            const { rows: translations } = await db.query('SELECT id, name, language_id FROM game_translations WHERE game_id = $1', [gameId]);

            for (const translation of translations) {
                const translationId = translation.id;
                const gameName = translation.name;

                // Generate the slug
                const gameSlug = slugify(gameName, { lower: true });

                // Update the game_slugs table
                await db.query(
                    `INSERT INTO game_slugs (game_id, language_id, slug)
                     VALUES ($1, $2, $3)
                     ON CONFLICT (game_id, language_id) DO UPDATE
                     SET slug = $3`,
                    [gameId, translation.language_id, gameSlug]
                );
            }
        }

        console.log('Slugs updated successfully!');
    } catch (err) {
        console.error('Error updating slugs:', err);
    }
}

updateSlugs();
