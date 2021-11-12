const logger = require('pino')({ level: 'info', transport: { target: 'pino-pretty' }});

const { Client,	Collection,	Intents,	MessageActionRow,	MessageButton } = require('discord.js');
const client = new Client({
    intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES, Intents.FLAGS.GUILD_MESSAGE_REACTIONS]
});

const redis = require("redis");
const db = redis.createClient({
    url: process.env.REDIS_URL
});

const token = process.env.TOKEN;
const channels = process.env.CHANNEL;
const automessage = process.env.AUTOMSG;
const reaction = process.env.REACT
const authrole = process.env.ROLE

client.once('ready', () => {
    logger.info(`Logged in as ${client.user.tag}!`);
});

client.on('messageCreate', async message => {
    if (message.content == `<@!${client.user.id}> close`) {
        db.get(message.channel.id, async function(err, reply) {
            if (err) {
                logger.error(err);
            } else {
                if (reply == message.author.id || message.member.roles.cache.some(role => role.name === authrole)) {
                    try {
                        await message.channel.setArchived(true);
                        logger.info(`Archived thread: ${message.channel.name}`);
                        const msg = await message.channel.fetchStarterMessage();
                        await msg.react(reaction);
                    } catch (error) {
                        logger.error(error);
                    }
                } else {
                    await message.reply("Unauthorized");
                }
            }
        });
    }

    if (channels.indexOf(message.channelId) > -1 && message.content) {
        try {
            const starter = message.content.substring(0,80)
            const thread = await message.startThread({
                name: `"❓- "${starter.substring(0, starter.lastIndexOf(" "))}`,
                autoArchiveDuration: 1440,
                reason: 'Thread automation'
            });
            const row = new MessageActionRow()
                .addComponents(
                    new MessageButton()
                    .setCustomId('archive')
                    .setLabel('Archive 🔓')
                    .setStyle('SECONDARY'),
                );
            db.set(thread.id, message.author.id, async function(err, reply) {
                if (err) {
                    logger.error(err);
                }
            });
            await thread.send({
                content: automessage,
                components: [row]
            })
            logger.info(`Created thread: ${thread.name}`);
        } catch (error) {
            logger.error(error)
        }
    }
});

client.on('threadUpdate', async (thread, thread1) => {
    if (thread.archived == true && thread1.archived == false) {
        const row = new MessageActionRow()
            .addComponents(
                new MessageButton()
                .setCustomId('archive')
                .setLabel('Archive 🔒')
                .setStyle('SECONDARY'),
            );
        try {
            const newthread = await thread1.fetch()
            if (newthread.archived == false) {
                await newthread.send({
                    content: 'Thread has been unarchived.',
                    components: [row]
                });
                logger.info(`Unarchived thread: ${thread.name}`);
                const msg = await thread.fetchStarterMessage();
                await msg.reactions.removeAll();
            }
        } catch (error) {
            logger.error(error);
        }
    }
});

client.on('interactionCreate', async interaction => {
    if (interaction.isButton()) {
        const row = new MessageActionRow()
            .addComponents(
                new MessageButton()
                .setCustomId('archived')
                .setLabel('Archived 🔒')
                .setStyle('SECONDARY')
                .setDisabled(true),
            );
        db.get(interaction.channel.id, async function(err, reply) {
            if (err) {
                logger.error(err);
            } else {
                if (reply == interaction.user.id || interaction.member.roles.cache.some(role => role.name === authrole)) {
                    try {
                        await interaction.update({
                            components: [row]
                        });
                        await interaction.channel.setArchived(true);
                        logger.info(`Archived thread: ${interaction.channel.name}`);
                        const msg = await interaction.channel.fetchStarterMessage();
                        await msg.react(reaction);
                    } catch (error) {
                        logger.error(error);
                    }
                } else {
                    await interaction.reply({
                        content: "Unauthorized",
                        ephemeral: true
                    });
                }
            }
        });
    }
});

db.once('ready', () => {
    logger.info(`Database Connected`);
    client.login(token);
});
