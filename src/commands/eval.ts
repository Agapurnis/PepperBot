import * as contributors from "../../constants/contributors.json";
import * as discord from "discord.js";
import { Command, CommandAccess, CommandCategory, CommandOption, CommandOptionType, CommandResponse, InvokerType } from "../lib/classes/command";
import * as action from "../lib/discord_action";
import fsExtra from "fs-extra";
import fs from "node:fs";
import process from "process";
import shell from "shelljs";

const modules = {
    discord,
    action,
    fsExtra,
    fs,
    process,
    shell
} // this is some weird hacky thing to make bun not omit the modules due to them being unused

const command = new Command(
    {
        name: 'eval',
        description: 'evaluates the provided code',
        category: CommandCategory.Debug,
        options: [
            new CommandOption({
                name: 'code',
                description: 'the code to evaluate',
                type: CommandOptionType.String,
                required: true
            })
        ],
        input_types: [InvokerType.Message],
        access: new CommandAccess({
            users: [
                contributors.ayeuhugyu.user_id,
                contributors.homomorphist.user_id,
            ]
        }, {}),
        pipable_to: ['grep'],
        example_usage: "p/eval console.log(\"hello world\")",
        aliases: ["evaluate"]
    }, 
    async function getArguments ({ command, message, guild_config }) {
        const commandLength = `${guild_config.other.prefix}${command.name}`.length;
        const code = message.content.slice(commandLength)?.trim();
        return { code }
    },
    async function execute ({ invoker, args }) {
        const { code } = args;
        if (!code) {
            action.reply(invoker, "tf u want me to eval");
            return new CommandResponse({ pipe_data: { grep_text: "tf u want me to eval" }});
        }
        try {
            const result = await (async function () {
                return await eval(code);
            })();
            if (result !== undefined) {
                action.reply(invoker, `result: \`\`\`${result}\`\`\``);
                return new CommandResponse({ pipe_data: { grep_text: `result: \`\`\`${result}\`\`\`` }});
            }
            action.reply(invoker, "no error generated, no result returned.");
            return;
        } catch (e) {
            action.reply(invoker, `\`\`\`${e}\`\`\``);
            return new CommandResponse({ pipe_data: { grep_text: `\`\`\`${e}\`\`\`` }});
        }
    }
);

export default command;