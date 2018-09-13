const { MessageEmbed } = require('discord.js');
const { Command } = require('discord.js-commando');

const { addFooter } = require('../..');

module.exports = class PingCommand extends Command {
	constructor(client) {
		super(client, {
			name: 'ping',
			group: 'util',
			memberName: 'ping',
			description: 'Bot\'s ping time with Discord.'
		});
	}

	async run(msg) {
		const ping = Date.now();
		const embed = new MessageEmbed()
			.setColor('RANDOM')
			.setDescription('🏓 Pong!');
		msg.channel.send({embed}).then(reply => {
			embed.setDescription(`${embed.description} \`${(Date.now() - ping) / 1000}s\``);
			reply.edit({embed}).then(reply => addFooter(msg, embed, reply)).catch(console.error);
		}).catch(console.error);
	}
};
