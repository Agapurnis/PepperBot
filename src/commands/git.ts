import { Command, CommandCategory, CommandOption, CommandOptionType, CommandResponse } from "../lib/classes/command";
import * as action from "../lib/discord_action";
import simpleGit from "simple-git";
import { textToAttachment } from "../lib/attachment_manager";

const git_log = new Command({
        name: 'log',
        description: 'returns the git log of the repo',
        long_description: 'creates a graph of all commits to the github repository',
        category: CommandCategory.Info,
        pipable_to: ['grep'],
        root_aliases: ['gitlog'],
        subcommands: []
    }, 
    async function getArguments () {
        return undefined;
    },
    async function execute ({ invoker, guild_config }) {
        const git = simpleGit();
        const log = await git.log(['--graph', '--abbrev-commit', '--decorate', '--format=format:"%C(bold blue)%h%C(reset) - %C(bold green)(%ar)%C(reset) %C(white)%s%C(reset) %C(dim white)- %an%C(reset)%C(auto)%d%C(reset)"', '--all']);
        const logString = log.all[0].hash
        const attachment = textToAttachment(logString, 'git_log.txt', "text-based graph of commit history");
        await action.reply(invoker, { content: "here's a log of commits to the repo", files: [attachment], ephemeral: guild_config.other.use_ephemeral_replies });
        return new CommandResponse({ pipe_data: { grep_text: `here's a log of commits to the repo\n${logString}` } });
    }
);

const command = new Command(
    {
        name: 'git',
        description: 'returns the github repo for the bot',
        category: CommandCategory.Info,
        pipable_to: ['grep'],
        subcommands: [git_log],
        options: [
            new CommandOption({
                name: 'subcommand',
                description: 'which subcommand to evaluate',
                type: CommandOptionType.String,
                choices: [{ name: "log", value: "log" }]
            })
        ],
    }, 
    async function getArguments ({ message, guild_config }) {
        const commandLength = `${guild_config.other.prefix}${guild_config.name}`.length;
        const subcommand = message.content.slice(commandLength)?.trim();
        return { subcommand }
    },
    async function execute ({ invoker: message, guild_config, args }) {
        const content = (args.subcommand ? `${args.subcommand} isn't a valid subcommand. anyways, ` : "") + "the public repo for this bot can be found at https://github.com/ayeuhugyu/PepperBot/";
        await action.reply(message, { content: content, ephemeral: guild_config.other.use_ephemeral_replies });
        return new CommandResponse({ pipe_data: { grep_text: "the public repo for this bot can be found at https://github.com/ayeuhugyu/PepperBot/" }});
    }
);

export default command;