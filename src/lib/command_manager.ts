import { Collection } from "discord.js";
import fs from "fs";
import { Command, ValidationCheck } from "./classes/command";
import * as log from "./log";

const enum CommandEntryType {
    /**
     * A non-aliased identifier for a command; the primary name of the command.
     */
    Command = "command",

    /**
     * An alias that points to a command.
     */
    CommandAlias = "command alias",

    /**
     * An "subcommand root alias" refers to an alias which points to a command's subcommand.
     * 
     * For example, if you had a `p/warn` command that had a subcommand of `view <user>` to view warnings of a user,
     * you could add an absolute alias of `p/warns` to the `view` subcommand so that `p/warns <user>` would be equivalent
     * to `p/warn view <user>`.
     */
    SubcommandRootAlias = "subcommand root alias",
}

/**
 * Greater indices have greater priority; that means the last element is the most prioritized.
 */
const COMMAND_ENTRY_TYPE_ORDERING = Object.seal([
    CommandEntryType.SubcommandRootAlias,
    CommandEntryType.CommandAlias,
    CommandEntryType.Command,
] as const);

interface CommandEntry {
    command: Command,
    type: CommandEntryType,
}

export class CommandManager {
    mappings = new Collection<string, CommandEntry>();
    get(name: string): Command | undefined {
        return this.mappings.get(name)?.command
    };
    
    async load() {
        if (this.mappings.size > 0) return; // avoids circular dependency
        const start = performance.now();
        const files = fs
            .readdirSync("src/commands")
            .filter(file => file.endsWith(".ts"));

        for (const file of files) {
            const start = performance.now();
            const command = (await import(`../commands/${file}`))?.default as unknown;

            if (!command) { log.error(`command ${file} has no default export`); continue; }
            if (!(command instanceof Command)) { log.error(`command ${file} has a default export that isn't a command`); continue; }
            
            if (command.validation_errors.length > 0 && command.validation_errors.some((error: ValidationCheck) => error.unrecoverable)) {
                log.error(`unrecoverable validation errors found in ${command.name}; skipping cache; errors: ${command.validation_errors.map((error: ValidationCheck) => error.message).join(", ")}`);
                continue;
            }
            
            this.assign(command, CommandEntryType.Command, command.name)

            for (const alias of command.aliases) {
                this.assign(command, CommandEntryType.CommandAlias, alias)
            }

            const subcommandDescendants = Array.from(command.subcommands); // shallow clone so deeper instances can be appended as a queue

            while (subcommandDescendants.length !== 0) {
                const subcommand = subcommandDescendants.pop()!;

                for (const alias of subcommand.root_aliases) {
                    this.assign(subcommand, CommandEntryType.SubcommandRootAlias, alias);
                }

                subcommandDescendants.push(...subcommand.subcommands);
            }
         
            log.info(`loaded command ${command.name} in ${(performance.now() - start).toFixed(3)}ms`);
        }

        log.info(`loaded all commands in ${(performance.now() - start).toFixed(3)}ms`);
    }

    /**
     * @returns whether assignment was successful
     */
    private assign(command: Command, type: CommandEntryType, name: string) {
        const existing = this.mappings.get(name);
        if (existing) {
            const priority = COMMAND_ENTRY_TYPE_ORDERING.indexOf(type);
            const priorityExisting = COMMAND_ENTRY_TYPE_ORDERING.indexOf(existing.type);
            const lesserPriority = priorityExisting > priority;
            if (lesserPriority || (priorityExisting === priority)) {
                console.error(
                    `cannot add a ${type} w/ name "${name}" because it already exists as a ${existing.type}` +
                    (lesserPriority ? `, which takes priority.` : ".") + " keeping previous assignment"
                );
                return false;
            }
        };

        this.mappings.set(name, { command, type });
        return true
    }
}

const manager = new CommandManager();
await manager.load();

export default manager;