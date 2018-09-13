const { Command } = require('discord.js-commando');
const { validateURL } = require('ytdl-core');

const { newVideo, search } = require('../../music');

module.exports = class PlayCommand extends Command {
	constructor(client) {
		super(client, {
			name: 'play',
			group: 'music',
			memberName: 'play',
			description: 'Plays audio from a YouTube video in a voice channel.',
			examples: ['play Darude - Sandstorm', 'play https://youtu.be/y6120QOlsfU'],
			guildOnly: true,
			args: [
				{
					key: 'query',
					prompt: 'What video would you like to play?',
					type: 'string'
				}
			]
		});
	}

	run(msg, { query }) {
		if (validateURL(query)) {
			return newVideo(msg, query);
		} else {
			return search(query, 1).then(videos => newVideo(msg, videos[0].id.videoId)).catch(console.error);
		}
	}
};
