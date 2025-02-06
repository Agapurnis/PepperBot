import { BaseChannel, ChannelType, Collection, GuildMember, Message, StageChannel, VoiceChannel } from "discord.js";
import { Command, CommandCategory, CommandOption, CommandOptionType, CommandResponse, SubcommandDeploymentApproach } from "../lib/classes/command";
import * as action from "../lib/discord_action";
import * as voice from "../lib/voice";

const leave = new Command(
    {
        name: 'leave',
        description: 'leave a voice channel',
        long_description: 'make the bot leave the current voice channel',
        category: CommandCategory.Voice,
        example_usage: "p/vc leave",
        allow_external_guild: false,
    },
    async function getArguments () {
        return undefined;
    },
    async function execute ({ invoker, guild_config }) {
        const voiceManager = voice.getVoiceManager(invoker.guild?.id || "");
        if (voiceManager) {
            if (!voice.checkMemberPermissionsForVoiceChannel(invoker.member as GuildMember, voiceManager.channel as VoiceChannel | StageChannel)) {
                action.reply(invoker, {
                    content: "you don't have permission to make me leave the voice channel",
                    ephemeral: guild_config.other.use_ephemeral_replies
                })
                return new CommandResponse({});
            }
            action.reply(invoker, {
                content: "left voice channel <#" + voiceManager.channel?.id + ">",
                ephemeral: guild_config.other.use_ephemeral_replies
            })
            voice.leaveVoiceChannel(invoker.guild?.id || "");
        } else {
            action.reply(invoker, {
                content: "im not in a voice channel",
                ephemeral: guild_config.other.use_ephemeral_replies
            })
        }
        return new CommandResponse({});
    }
);


const join = new Command(
    {
        name: 'join',
        description: 'join a voice channel',
        long_description: 'make the bot join a voice channel. defaults to the one you are in',
        category: CommandCategory.Voice,
        example_usage: "p/vc join general",
        allow_external_guild: false,
        options: [new CommandOption({
            name: "channel",
            type: CommandOptionType.Channel,
            channel_types: [ChannelType.GuildVoice, ChannelType.GuildStageVoice],
        })]
    },
    async function getArguments({ message, command_name_used, guild_config }) {
        const before = `${guild_config.other.prefix}${command_name_used} join`.length;
        return { channel: message.content.slice(before).trim() }
    },
    async function execute({ self, invoker, message, interaction, args, guild_config }) {
        const channel = (typeof args.channel === "object") ? args.channel : await (async () => {
            const input = (args.channel as string | undefined)?.trim();
            const numeric = input?.match(/\d+/)?.[0];

            if (numeric && !Number.isNaN(numeric)) {
                return await invoker.guild!.channels.fetch(numeric);
            }

            if (input) {
                const query = input.toLowerCase();
                return invoker.guild!.channels.cache.find(channel => {
                    return channel.name.toLowerCase().startsWith(query)
                });
            }

            const member = self.is_interaction()
                ? await interaction!.guild!.members.fetch(interaction!.author.id)
                : message!.member!

            return member.voice.channel
        })()

        if (!channel) {
            action.reply(invoker, {
                content: args.channel ? "channel could not be found" : "please supply a voice channel",
                ephemeral: guild_config.other.use_ephemeral_replies
            });
            return
        }

        if (!channel.isVoiceBased()) {
            action.reply(invoker, {
                content: "invalid channel type!!",
                ephemeral: guild_config.other.use_ephemeral_replies
            });
            return
        }

        voice.joinVoiceChannel(channel);
        action.reply(invoker, {
            content: "joined voice channel: <#" + channel.id + ">",
            ephemeral: guild_config.other.use_ephemeral_replies
        })
    }
);

const command = new Command(
    {
        name: 'vc',
        description: 'join / leave a vc',
        long_description: 'make the bot join or leave a specific voice channel',
        category: CommandCategory.Voice,
        example_usage: "p/vc join",
        subcommands: {
            deploy: SubcommandDeploymentApproach.Split,
            list: [join, leave],
            self: null
        },
        allow_external_guild: false,
        options: [
            new CommandOption({
                name: 'subcommand',
                description: 'subcommand',
                choices: ["join", "leave"].map((value) => ({ name: value, value })),
                type: CommandOptionType.String,
                required: true,
            }),
        ],
    }, 
    async function getArguments ({ message, command_name_used, guild_config }) {
        const commandLength = `${guild_config.other.prefix}${command_name_used}`.length;
        const subcommand = message.content.slice(commandLength).trim().split(" ")[0];
        return { subcommand }
    },
    async function execute ({ invoker, args, guild_config }) {
        const ephemeral = guild_config.other.use_ephemeral_replies;

        if (args.subcommand) {
            action.reply(invoker, {
                content: "invalid subcommand: " + args.subcommand,
                ephemeral
            })
            return;
        }

        console.log(args)

        action.reply(invoker, {
            content: "this command does nothing if you don't supply a subcommand",
            ephemeral
        })
    }
);

export default command;