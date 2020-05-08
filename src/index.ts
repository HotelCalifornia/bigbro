import { Client, ColorResolvable, Constants, Message, MessageEmbed, PartialMessage, TextChannel } from 'discord.js';
import { Db, MongoClient } from 'mongodb';
import { inspect } from 'util';

import * as messages from './messages';

export interface Command {
  execute(message: Message, args: string): Promise<void>;
}

export const client = new Client();
const token = process.env.BIGBRO_TOKEN;
const dbUri = process.env.BIGBRO_DB;
const ownerId = process.env.DISCORD_ID;
const mongoOptions = {
  retryWrites: true,
  useNewUrlParser: true,
  useUnifiedTopology: true
};
const prefix = '%';
const commandInfo = {
  ping: 'Pong!',
  uptime: 'Time since bot last restarted.',
  leaderboard: 'Users with the most messages on the server.',
  profile: 'Information about a user.',
  play: 'Audio from a YouTube video.',
  search: 'Search YouTube to play audio from a video.',
  queue: 'Current music queue.'
};
const commands: { [key: string]: Command } = {};

let helpDescription = `\`${prefix}help\`: Provides information about all commands.`;
let _db: Db;

export const db = (): Db => _db; 

const clean = (text: string): string => {
  return text.replace(/`/g, '`' + String.fromCharCode(8203)).replace(/@/g, '@' + String.fromCharCode(8203)).slice(0, 1990);
};

export const addFooter = (message: Message, reply: Message): void => {
  const author = message.member ? message.member.displayName : message.author.username;
  const embed = reply.embeds[0].setFooter(`Triggered by ${author}`, message.author.displayAvatarURL())
    .setTimestamp(message.createdAt);
  reply.edit(embed).catch(console.error);
};

const login = (): void => {
  client.login(token).catch(console.error);
};

const restart = (): void => {
  client.destroy();
  login();
};

const handleCommand = async (message: Message): Promise<void> => {
  const slice = message.content.indexOf(' ');
  const cmd = message.content.slice(prefix.length, (slice < 0) ? message.content.length : slice);
  const args = (slice < 0) ? '' : message.content.slice(slice);

  if (commands[cmd]) {
    commands[cmd].execute(message, args).catch(console.error);
  } else if (cmd === 'help') {
    const embed = new MessageEmbed()
      .setColor('RANDOM')
      .setTitle('Commands')
      .setDescription(helpDescription);
    message.channel.send(embed)
      .then(reply => addFooter(message, reply))
      .catch(console.error);
  } else if (message.author.id === ownerId) {
    if (cmd === 'eval') {
      try {
        let evaled = /\s*await\s+/.test(args) ? (await eval(`const f = async () => {\n${args}\n};\nf();`)) : eval(args);
        if (typeof evaled !== 'string') {
          evaled = inspect(evaled);
        }
        message.channel.send(clean(evaled), {code: 'xl'}).catch(console.error);
      } catch (error) {
        message.channel.send(`\`ERROR\` \`\`\`xl\n${clean(error)}\`\`\``).catch(console.error);
      }
    } else if (cmd === 'restart') {
      restart();
    }
  }
};

const log = (message: Message | PartialMessage, type: string): void => {
  if (!message.guild || message.author.bot) {
    return;
  }
  let color: ColorResolvable;
  switch (type) {
  case 'updated':
    color = Constants.Colors.GREEN;
    break;
  case 'deleted':
    color = Constants.Colors.RED;
    break;
  default:
    color = Constants.Colors.BLUE;
    break;
  }
  const embed = new MessageEmbed()
    .setColor(color)
    .setDescription(`${message.member}\n${message.content}`)
    .setTimestamp(message.createdAt);

  if (message.attachments.size) {
    embed.attachFiles(message.attachments.map(attachment => attachment.proxyURL));
  }
  const logChannel = message.guild.channels.cache.get('263385335105323015') as TextChannel;
  if (logChannel) {
    logChannel.send(`Message ${type} in ${message.channel}:`, embed).catch(console.error);
  }
};

client.on(Constants.Events.CLIENT_READY, () => {
  console.log(`Logged in as ${client.user.tag}`);
  client.user.setPresence({
    status: 'online',
    activity: {
      name: `${prefix}help`,
      type: 'PLAYING'
    }
  }).catch(console.error);
  messages.updateGuilds()
    .then(() => console.log('Done updating messages.'))
    .catch(console.error);
});

client.on(Constants.Events.CHANNEL_CREATE, channel => {
  if (channel.type === 'text') {
    messages.updateChannel(channel as TextChannel).catch(console.error);
  }
});

client.on(Constants.Events.GUILD_MEMBER_ADD, member => {
  member.guild.systemChannel.send(`Welcome, ${member}! To access this server, one of the <@&197816965899747328> must verify you.\nPlease take a moment to read our server <#197777408198180864>, then send a message here with your name (or username) and team ID (such as "Kayley, 24B" or "Jordan, BNS"), and/or ask one of the <@&197816965899747328> for help.`).catch(console.error);
});

client.on(Constants.Events.MESSAGE_CREATE, message => {
  const mentionCount = message.mentions.members?.size;
  if (mentionCount > 10) {
    message.member.kick(`Mentioned ${mentionCount} users`);
  }
  if (message.content.startsWith(prefix)) {
    handleCommand(message).catch(console.error);
  }
  if (message.guild) {
    messages.upsertMessageInDb(message).catch(console.error);
  }
});

client.on(Constants.Events.MESSAGE_DELETE, message => {
  if (message.guild) {
    log(message, 'deleted');
    messages.upsertMessageInDb(message, -1).catch(console.error);
  }
});

client.on(Constants.Events.MESSAGE_UPDATE, (oldMessage, newMessage) => {
  if (oldMessage.guild && oldMessage.content !== newMessage.content) {
    log(oldMessage, 'updated');
  }
});

client.on(Constants.Events.MESSAGE_BULK_DELETE, messageCollection => {
  messageCollection.forEach(message => {
    if (message.guild) {
      log(message, 'bulk deleted');
      messages.upsertMessageInDb(message, -1).catch(console.error);
    }
  });
});

client.on(Constants.Events.DISCONNECT, event => {
  console.error('Disconnect.');
  console.error(JSON.stringify(event));
  restart();
});

client.on(Constants.Events.ERROR, console.error);

client.on(Constants.Events.WARN, console.warn);

MongoClient.connect(dbUri, mongoOptions).then(mongoClient => {
  _db = mongoClient.db('bigbro');

  Object.entries(commandInfo).forEach(([name, desc]) => {
    commands[name] = require('./commands/' + name).default;
    helpDescription += `\n\`${prefix}${name}\`: ${desc}`;
  });

  login();
}).catch(console.error);