const { Command } = require('discord.js-commando');
const { getQueue } = require('../../music.js');

module.exports = class ProfileCommand extends Command {
	constructor(client) {
		super(client, {
			name: 'queue',
			group: 'music',
			memberName: 'queue',
			description: 'Current music queue.',
			guildOnly: true
		});
	}

	run(msg) {
		getQueue(msg.guild.id);
	}
};
