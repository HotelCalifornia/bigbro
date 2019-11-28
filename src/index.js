import { Client, MessageEmbed } from 'discord.js';
import { MongoClient } from 'mongodb';
import { inspect } from 'util';

const client = new Client();
const token = process.env.BIGBRO_TOKEN;
const dbUri = process.env.BIGBRO_DB;
const mongoOptions = {
  retryWrites: true,
  reconnectTries: Number.MAX_VALUE,
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
const commands = {};

let helpDescription = `\`${prefix}help\`: Provides information about all commands.`;

let db, messages;

const clean = text => {
  if (typeof text === 'string') {
    return text.replace(/`/g, '`' + String.fromCharCode(8203)).replace(/@/g, '@' + String.fromCharCode(8203)).slice(0, 1990);
  }
  return text;
};

const handleCommand = async message => {
  const slice = message.content.indexOf(' ');
  const cmd = message.content.slice(prefix.length, (slice < 0) ? message.content.length : slice);
  const args = (slice < 0) ? '' : message.content.slice(slice);

  if (commands[cmd]) {
    commands[cmd](message, args);
  } else if (cmd === 'help') {
    const embed = new MessageEmbed()
      .setColor('RANDOM')
      .setTitle('Commands')
      .setDescription(helpDescription);
    message.channel.send({embed})
      .then(reply => addFooter(message, embed, reply))
      .catch(console.error);
  } else if (cmd === 'eval') {
    if (message.author.id === '197781934116569088') {
      try {
        let evaled = /\s*await\s+/.test(args) ? (await eval(`const f = async () => {\n${args}\n};\nf();`)) : eval(args);
        if (typeof evaled !== 'string') {
          evaled = inspect(evaled);
        }
        message.channel.send(clean(evaled), {code: 'xl'}).catch(console.error);
      } catch (error) {
        message.channel.send(`\`ERROR\` \`\`\`xl\n${clean(error)}\`\`\``).catch(console.error);
      }
    } else {
      message.reply(`you don't have permission to run \`${cmd}\`.`).catch(console.error);
    }
  } else if (cmd === 'restart') {
    if (message.author.id === '197781934116569088') {
      restart();
    } else {
      message.reply(`you don't have permission to run \`${cmd}\`.`).catch(console.error);
    }
  }
};

const addFooter = (message, embed, reply) => {
  const author = message.member ? message.member.displayName : message.author.username;

  embed.setFooter(`Triggered by ${author}`, message.author.displayAvatarURL())
    .setTimestamp(message.createdAt);
  reply.edit({embed});
};

const log = (message, type) => {
  if (message.guild && !message.author.bot) {
    let color;
    switch (type) {
    case 'updated':
      color = 'GREEN';
      break;
    case 'deleted':
      color = 'RED';
      break;
    default:
      color = 'BLUE';
      break;
    }
    const embed = new MessageEmbed()
      .setColor(color)
      .setDescription(`${message.member}\n${message.content}`)
      .setTimestamp(message.createdAt);

    if (message.attachments.size) {
      embed.attachFiles(message.attachments.map(attachment => attachment.proxyURL));
    }
    const logChannel = message.guild.channels.get('263385335105323015');
    if (logChannel) {
      logChannel.send(`Message ${type} in ${message.channel}:`, {embed}).catch(console.error);
    }
  }
};

const login = () => client.login(token).catch(console.error);

const restart = () => {
  client.destroy();
  login();
};

client.on('ready', async () => {
  console.log('Ready!');
  client.user.setActivity(`${prefix}help`, {url: 'https://github.com/jtkiesel/bigbro', type: 'PLAYING'});
  try {
    await messages.updateGuilds();
  } catch (err) {
    console.error(err);
  }
  console.log('Done updating messages.');
});

client.on('resume', () => console.log('Resume.'));

client.on('channelCreate', channel => messages.updateChannel(channel));

client.on('guildMemberAdd', member => member.guild.systemChannel.send(`Welcome, ${member}! To access this server, one of the <@&197816965899747328> must verify you.\nPlease take a moment to read our server <#197777408198180864>, then send a message here with your name (or username) and team ID (such as "Kayley, 24B" or "Jordan, BNS"), and/or ask one of the <@&197816965899747328> for help.`));

client.on('message', message => {
  const mentions = message.mentions.members;
  if (mentions && mentions.size > 10) {
    message.member.kick(`Mentioned ${mentions.size} users`);
  }
  if (message.content.startsWith(prefix)) {
    handleCommand(message);
  }
  if (message.guild) {
    messages.upsertMessageInDb(message);
  }
});

client.on('messageDelete', message => {
  if (message.guild) {
    log(message, 'deleted');
    messages.upsertMessageInDb(message, -1);
  }
});

client.on('messageUpdate', (oldMessage, newMessage) => {
  if (oldMessage.guild && oldMessage.content !== newMessage.content) {
    log(oldMessage, 'updated');
  }
});

client.on('messageDeleteBulk', messageCollection => {
  messageCollection.forEach(message => {
    if (message.guild) {
      log(message, 'bulk deleted');
      messages.upsertMessageInDb(message, -1);
    }
  });
});

client.on('disconnect', event => {
  console.error('Disconnect.');
  console.error(JSON.stringify(event));
  restart();
});

client.on('reconnecting', () => console.log('Reconnecting.'));

client.on('error', console.error);

client.on('warn', console.warn);

MongoClient.connect(dbUri, mongoOptions).then(mongoClient => {
  db = mongoClient.db('bigbro');
  module.exports.db = db;

  Object.entries(commandInfo).forEach(([name, desc]) => {
    commands[name] = require('./commands/' + name).default;
    helpDescription += `\n\`${prefix}${name}\`: ${desc}`;
  });

  messages = require('./messages');
  login();
}).catch(console.error);

export {
  addFooter,
  client
};
