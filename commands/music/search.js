const { MessageEmbed } = require('discord.js');
const { Command } = require('discord.js-commando');
const { getInfo } = require('ytdl-core');

const { client } = require('../..');
const music = require('../../music');

const searchEmojis = ['\u0031\u20E3', '\u0032\u20E3', '\u0033\u20E3', '\u0034\u20E3', '❌'];

module.exports = class SearchCommand extends Command {
	constructor(client) {
		super(client, {
			name: 'search',
			group: 'music',
			memberName: 'search',
			description: 'Search YouTube to play audio from a video to a voice channel.',
			examples: ['search Darude - Sandstorm'],
			guildOnly: true,
			args: [
				{
					key: 'query',
					prompt: 'What query would you like to search for?',
					type: 'string'
				}
			]
		});
	}

	async run(msg, { query }) {
		let videos;
		try {
			videos = await music.search(query, 4);
		} catch (err) {
			console.error(err);
		}
		if (videos) {
			const results = [];
			for (let video of videos) {
				let info;
				try {
					info = await getInfo(video.id.videoId);
				} catch (err) {
					console.error(err);
				}
				results.push({msg, info});
			}

			const embed = new MessageEmbed()
				.setColor('BLUE')
				.setDescription(results.map((video, index) => `${searchEmojis[index]} \`[${music.getDuration(video)}]\` [${music.getTitle(video)}](${music.getUrl(video)})`).join('\n'));
			let reply;
			try {
				reply = await msg.channel.send(`Search results for \`${query}\`:`, {embed});
			} catch (err) {
				console.error(err);
			}

			const collector = reply.createReactionCollector((reaction, user) => {
				return (user.id !== client.user.id) && searchEmojis.includes(reaction.emoji.name);
			});
			collector.on('collect', (reaction, user) => {
				if (user.id !== msg.author.id) {
					reaction.users.remove(user);
				} else {
					collector.stop();
				}
			});
			collector.on('end', () => {
				searchEmojis.forEach((emoji, index) => {
					const users = reply.reactions.get(emoji).users;
					users.forEach(user => {
						if (user.id === msg.author.id && index < (searchEmojis.length - 1)) {
							music.newVideo(msg, videos[index].id.videoId);
						}
						users.remove(user);
					});
				});
			});

			for (let emoji of searchEmojis) {
				try {
					await reply.react(emoji);
				} catch (err) {
					console.error(err);
				}
			}
		} else {
			msg.reply('no videos found for that query.');
		}
	}
};
