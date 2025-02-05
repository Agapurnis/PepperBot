import { Command, CommandCategory, CommandOption, CommandOptionType, CommandResponse, InvokerType } from "../lib/classes/command";
import * as action from "../lib/discord_action";

const command = new Command(
    {
        name: 'grep',
        description: 'searches for a string in the piped text',
        long_description: 'searches for a string in the piped text. this command is purely for piping to, and will not work on its own.',
        category: CommandCategory.Utility,
        input_types: [InvokerType.Message],
        options: [
            new CommandOption({
                name: 'search',
                description: 'the text to search for',
                type: CommandOptionType.String,
                required: true,
            })
        ],
        pipable_to: ['grep'],
        example_usage: "p/git log | grep months",
    }, 
    async function getArguments ({ message, command, guild_config }) {
        const commandLength = `${guild_config.other.prefix}${command.name}`.length;
        const search = message.content.slice(commandLength)?.trim();
        return { search }
    },
    async function execute ({ invoker, piped_data, guild_config, args }) {
        const ephemeral = guild_config.other.use_ephemeral_replies;
        if (!piped_data?.data) {
            await action.reply(invoker, { content: "this command must be piped", ephemeral})
            return new CommandResponse({ pipe_data: { grep_text: "this command must be piped" } });
        }
        if (piped_data.data.grep_text) {
            const lines = piped_data.data.grep_text.split("\n");
            let search = args.search;
            if (!search) {
                await action.reply(invoker, { content: "no search term provided", ephemeral });
                return new CommandResponse({ pipe_data: { grep_text: "no search term provided" } });
            }
            let count = false;
            if (search.includes("-c") && !search.includes("\\-c")) {
                search = search.replace("-c", "");
                count = true
            }
            const regex = /\/(.*?)\//g;
            const regexMatches = [...search.matchAll(regex)].map(match => match[1]);
            if (regexMatches.length > 0) {
                const regexSearch = regexMatches[0];
                try {
                    const r = new RegExp(regexSearch);
                    const found = lines.filter((line: string) => line.match(r));
                    await action.reply(invoker, { content: found.join("\n"), ephemeral });
                    return new CommandResponse({ pipe_data: { grep_text: found.join("\n") } });
                } catch (e: any) {
                    await action.reply(invoker, { content: "invalid regex: " + e.message, ephemeral });
                    return new CommandResponse({ pipe_data: { grep_text: "invalid regex: " + e.message } });
                }
            }
            const found = lines.filter((line: string) => line.includes(search));
            await action.reply(invoker, { content: found.join("\n"), ephemeral });
            return new CommandResponse({ pipe_data: { grep_text: found.join("\n") } });
        } else {
            await action.reply(invoker, { content: "no grep text found", ephemeral });
            return new CommandResponse({ pipe_data: { grep_text: "no grep text found" } });
        }
    }
);

export default command;