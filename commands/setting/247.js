const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { logger } = require("../../utils/logger.js");
const Reconnect = require("../../schemas/247Connection");
const config = require("../../config");

module.exports = {
	data: new SlashCommandBuilder()
   		.setName("247")
   		.setDescription("Set the current player session to 24/7")
   		.setDMPermission(false),

	run: async ({ client, interaction }) => {
		const embed = new EmbedBuilder().setColor(config.default_color);

		try {
			const player = client.riffy.players.get(interaction.guildId);

			if (!player) {
                return interaction.reply({ 
                    embeds: [embed.setDescription("\`❌\` | No player found in this server.")],  
                    ephemeral: true 
                });
            }

			await interaction.deferReply({ ephemeral: false });
			const data = await Reconnect.findOne({ GuildId: interaction.guildId });

			if (data) {
				await data.deleteOne();
				return interaction.editReply({ embeds: [embed.setDescription("\`📻\` | 247 Mode has been: \`Disabled\`")] });
			} else if (!data) {
				const newData = await Reconnect.create({
					GuildId: interaction.guildId,
					TextChannelId: player.textChannel,
					VoiceChannelId: player.voiceChannel,
				});

				await newData.save();
				return interaction.editReply({ embeds: [embed.setDescription("\`📻\` | 247 Mode has been: \`Enabled\`")] });
			}
		} catch (err) {
			logger(err, "error");
			return interaction.editReply({ 
				embeds: [embed.setDescription(`\`❌\` | An error occurred: ${err.message}`)], 
				ephemeral: true 
			});
		}
	},
	options: {
		inVoice: true,
		sameVoice: true,
	}
};