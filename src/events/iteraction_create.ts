import { ChatInputCommandInteraction, Events, Interaction } from "discord.js";
import { Command, CommandInput, FormattedCommandInteraction } from "../lib/classes/command";
import commands from "../lib/command_manager";
import * as log from "../lib/log";

async function commandHandler(interaction: ChatInputCommandInteraction) {
    const command = commands.get(interaction.commandName);
    if (!command) {
        log.warn(`invalid interaction command "${interaction.commandName}"`);
        return;
    }

    const args = {} as Record<string, unknown>

    for (const option of interaction.options.data) {
        args[option.name] = option.value;
    }

    const authored = Object.assign(interaction, { author: interaction.user }) as FormattedCommandInteraction;
    const input = await CommandInput.new(authored, command as Command<any>, args, { will_be_piped: false })
    
    command?.execute(input);
}

export default {
    name: Events.InteractionCreate,
    async execute(interaction: Interaction) {
        if (interaction.isChatInputCommand()) {
            return commandHandler(interaction)
        }
    }
}