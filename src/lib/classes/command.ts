import { fetchGuildConfig, GuildConfig } from "../guild_config_manager";
import { ApplicationCommandType, ApplicationCommandOptionType, PermissionsBitField, ApplicationIntegrationType, InteractionContextType, ChannelType, Message, CommandInteraction, GuildMemberRoleManager, Role, PermissionFlagsBits, User, Channel, Attachment, Awaitable } from "discord.js";
import * as contributors from "../../../constants/contributors.json";
import * as action from "../discord_action";
import * as log from "../log";

type AnyObject = Record<any, any>
type EmptyObject = Record<any, never>

function pick<T, K extends keyof T>(value: T, keys: K[]): { [P in K]: T[P] } {
    const obj = {} as { [P in K]: T[P] }
    for (const key of keys) {
        obj[key] = value[key]
    }
    return obj
}

export class CommandResponse {
    error: boolean = false;
    message: string = "";
    pipe_data: any = {};
    from: string = "";
    constructor(data: Partial<CommandResponse>) {
        Object.assign(this, { ...data });
    }
}

export type CommandFunction<F extends AnyObject, P extends AnyObject, I extends InvokerType> = <II extends I>(input: CommandInput<F, P, II, false>) => any;
export type ExecuteFunction<F extends AnyObject, P extends AnyObject, I extends InvokerType> = <II extends I>(input: Omit<CommandInput<F, P, II, true>, "enrich">) => Awaitable<CommandResponse | void>;
export type GetArgumentsFunction<A extends AnyObject, I extends InvokerType> = I extends InvokerType.Message ? (input: CommandInput<AnyObject, AnyObject, InvokerType.Message, false>) => Awaitable<A> : undefined | null | (() => Awaitable<void | never | EmptyObject>)

export class PipedData {
    from: string | undefined = "";
    data: any = {};
    constructor(from: string | undefined, data: any) {
        this.from = from;
        this.data = data;
    }
}

export interface FormattedCommandInteraction extends CommandInteraction {
    author: Message["author"];
}


export const CommandOptionType = ApplicationCommandOptionType;
export type CommandOptionType = ApplicationCommandOptionType;
export namespace CommandOptionType {
    export type Value <T extends CommandOptionType> =
        | T extends ApplicationCommandOptionType.Subcommand ? never // unsupported
        : T extends ApplicationCommandOptionType.SubcommandGroup ? never // unsupported
        : T extends ApplicationCommandOptionType.String ? string
        : T extends ApplicationCommandOptionType.Integer ? number
        : T extends ApplicationCommandOptionType.Boolean ? boolean
        : T extends ApplicationCommandOptionType.User ? User
        : T extends ApplicationCommandOptionType.Channel ? Channel
        : T extends ApplicationCommandOptionType.Role ? Role
        : T extends ApplicationCommandOptionType.Mentionable ? User | Role
        : T extends ApplicationCommandOptionType.Number ? number
        : T extends ApplicationCommandOptionType.Attachment ? Attachment
        : never;

    export type Numeric =
        | ApplicationCommandOptionType.Number
        | ApplicationCommandOptionType.Integer

    export type ChoicesUsable = Numeric | ApplicationCommandOptionType.String
}

export enum CommandCategory {
    AI,
    Management,
    Fun,
    Utility,
    Info,
    Voice,
    Moderation,
    Debug,
    Other
}

export enum InvokerType {
    Interaction = "interaction",
    Message = "message",
}

export type CommandInvoker<T extends InvokerType = InvokerType> = {
    [InvokerType.Message]: Message<true>, // We wouldn't be able to see the message if it weren't in the guild
    [InvokerType.Interaction]: FormattedCommandInteraction
}[T]

interface ExtraCommandInputData {
    will_be_piped: boolean,
    piped_data?: PipedData,
    previous_response?: CommandResponse
}

export class CommandInput<
    F extends AnyObject = AnyObject,
    P extends AnyObject = AnyObject,
    I extends InvokerType = InvokerType,
    E extends boolean = true,
    A = E extends false
        ? I extends InvokerType.Message ? undefined : F & { [K in Exclude<keyof P, keyof F>]?: undefined }
        : I extends InvokerType.Message
            ? P & { [K in Exclude<keyof F, keyof P>]?: undefined }
            : F & { [K in Exclude<keyof P, keyof F>]?: undefined }
> implements ExtraCommandInputData {
    args: A;
    message: I extends InvokerType.Message ? Message<true> : null;
    interaction: I extends InvokerType.Interaction ? CommandInvoker : null;

    // async constructor
    public static async new<
        F extends AnyObject = AnyObject,
        P extends AnyObject = AnyObject,
        I extends InvokerType = InvokerType,
        E extends boolean = true,
        A = E extends false
            ? I extends InvokerType.Message ? undefined : F & { [K in Exclude<keyof P, keyof F>]?: undefined }
            : I extends InvokerType.Message
                ? P & { [K in Exclude<keyof F, keyof P>]?: undefined }
                : F & { [K in Exclude<keyof P, keyof F>]?: undefined }
    >(invoker: CommandInvoker<I>, command: Command<any, I, F, P>, args: A, extra: ExtraCommandInputData) {
        const input = new this(invoker, command, args, extra);
        input.guild_config = await fetchGuildConfig(invoker.guildId!);
        return input
    }
    
    private constructor(invoker: CommandInvoker<I>, public command: Command<any, I, F, P>, args: A, extra: ExtraCommandInputData) {
        this.args = args;
        this.invoker = invoker;
        this.invoker_type = ((invoker instanceof Message)
            ? InvokerType.Message
            : InvokerType.Interaction
        ) as I;

        this.message = (invoker instanceof Message ? invoker : null) as never;
        this.interaction =(invoker instanceof Message ? null : invoker) as never;

        Object.assign(this, extra)
    }

    enrich(parsed?: P | null | undefined | void): asserts this is CommandInput<F, P, I, true> {
        if (parsed) this.args = parsed as unknown as A;
    }
    
    is_message(): this is CommandInput<never, P, InvokerType.Message, E> { return this.invoker_type === InvokerType.Message }
    is_interaction(): this is CommandInput<F, never, InvokerType.Interaction, E> { return this.invoker_type === InvokerType.Interaction }

    invoker: CommandInvoker<I>;
    invoker_type: I;
    guild_config!: GuildConfig;
    self = this;

    previous_response: CommandResponse | undefined;
    piped_data?: PipedData;
    will_be_piped!: boolean;
}

export interface Contributor {
    name: string;
    user_id: string;
}

export interface ValidationCheck {
    condition: boolean;
    message: string;
    unrecoverable: boolean;
}

export type AccessList = {
    users: string[];
    roles: string[];
    channels: string[];
    guilds: string[];
};

export class CommandAccess {
    whitelist: AccessList;
    blacklist: AccessList;

    constructor(
        whitelist: Partial<AccessList> = { users: [], roles: [], channels: [], guilds: [] },
        blacklist: Partial<AccessList> = { users: [], roles: [], channels: [], guilds: [] }
    ) {
        this.whitelist = {
            users: whitelist.users || [],
            roles: whitelist.roles || [],
            channels: whitelist.channels || [],
            guilds: whitelist.guilds || []
        };
        this.blacklist = {
            users: blacklist.users || [],
            roles: blacklist.roles || [],
            channels: blacklist.channels || [],
            guilds: blacklist.guilds || []
        };
    }

    public test(message: Message | FormattedCommandInteraction) {
        const { author, member, channel, guild } = message;
        const userRoles = member?.roles instanceof GuildMemberRoleManager ? member.roles.cache.map(role => role.id) : [];
        const guildId = guild?.id || "";
        const channelId = channel?.id || "";
        const userId = author.id;

        const whitelistSpecified = Object.values(this.whitelist).some(list => list.length > 0);
        const whitelisted = !whitelistSpecified ||
            this.whitelist.users.includes(userId) ||
            this.whitelist.roles.some(role => userRoles.includes(role)) ||
            this.whitelist.channels.includes(channelId) ||
            this.whitelist.guilds.includes(guildId);

        const blacklistedSpecified = Object.values(this.blacklist).some(list => list.length > 0);
        const blacklisted = blacklistedSpecified && (
            this.blacklist.users.includes(userId) ||
            this.blacklist.roles.some(role => userRoles.includes(role)) ||
            this.blacklist.channels.includes(channelId) ||
            this.blacklist.guilds.includes(guildId)
        );

        return {
            whitelisted,
            blacklisted,
        }
    }
}

export interface CommandOptionChoice {
    name: string;
    value: string;
}

type RequiredCommandOptionProperties = "name" | "type"
export class CommandOption<
    const T extends CommandOptionType = CommandOptionType,
    const K extends string = string,
    const R extends boolean = false,
> {
    name!: K;
    type!: T;
    required: R = false as R;
    description = "no description";
    choices: T extends CommandOptionType.ChoicesUsable ? CommandOptionChoice[] : [] = [] as never;
    channel_types?: ChannelType[]

    /* ↑↑↑ discords shit ↓↓↓ my shit */
    deployed = true;
    long_description = "no description"
    validation_errors: ValidationCheck[] = []; // errors that occur during command validation, DO NOT ADD THINGS TO THIS! 

    constructor(
        data: 
            & Partial<Omit<CommandOption<T, K, R>, RequiredCommandOptionProperties>>
            & Pick<        CommandOption<T, K, R>, RequiredCommandOptionProperties>
    ) {
        if (!data.long_description && data.description) data.long_description = data.description;
        Object.assign(this, { ...data });
        
        const validationChecks = [
            { condition: this.name.length > 32, message: "command option name may not exceed 32 characters", unrecoverable: true },
            { condition: this.description.length > 100, message: "command option description may not exceed 100 characters", unrecoverable: true },
            { condition: (this.choices && this.choices.length > 25) || false, message: "command option cannot have more than 25 choices", unrecoverable: true },
        ];
        validationChecks.forEach(
            check => {
            if (check.condition) {
                this.validation_errors.push(check);
            }
        });

        if (this.validation_errors.length > 0) {
            return;
        }
    }

    toJSON() {
        return pick(this, ["name", "description", "type", "required", "choices", "channel_types"])
    }
}

namespace CommandOption {
    export type ToObject<T extends readonly CommandOption[], O = {}> =
        | T["length"] extends 0 ? O : T extends readonly [
            CommandOption<infer T, infer K, infer R>,
            ...infer L extends CommandOption[]
        ] ? ToObject<L, O & (R extends true
            ? { [P in K] : CommandOptionType.Value<T> }
            : { [P in K]?: CommandOptionType.Value<T> }
        )> : O
}


function defaultCommandFunction({ command = "" }) {
    log.error("undefined command function for " + command)
}

export class Command<
    const S extends CommandOption<CommandOptionType, string, any>[] = CommandOption[], // slash command argument definition
    const I extends InvokerType = InvokerType, // invocation methods 
    const F extends AnyObject = S["length"] extends 0 ? EmptyObject : CommandOption.ToObject<S>, // inferred arguments from slash command definition + subcommand
    const P extends AnyObject = F, // arguments from manual parsing
> {
    name!: string;
    type = ApplicationCommandType.ChatInput;
    description = "no description";
    options: S = [] as unknown as S;
    default_member_permissions?: PermissionsBitField;
    integration_types = [ ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall ];
    contexts = [ InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel ];
    nsfw = false
    /* ↑↑↑ discords shit ↓↓↓ my shit */
    aliases: string[] = [];
    /**
     * Top-level aliases to create for subcommands.
     * 
     * For example: if you had a `p/warn` command that had a subcommand of `view <user>` to view warnings of a user,
     * you could make add `root_aliases: ["warns"]` to the `view` subcommand so that so that `p/warns <user>` would
     * be equivalent to `p/warn view <user>`.
     */
    root_aliases: string[] = [];
    long_description = "no description";
    access = new CommandAccess();
    /**
     * Which ways this command can be invoked, such as through slash commands or a prefixed message.
     */
    input_types: I[] = [ InvokerType.Interaction, InvokerType.Message ] as I[];
    allow_external_guild = false; // should it be usable in guilds without administrator permission? (thats the only way to detect it)
    subcommands: Command<any, any, any, any>[] = [] as any;
    pipable_to: string[] = []; // array of command names which output may be piped to
    contributors: Contributor[] = [contributors.ayeuhugyu];
    subcommand_argument = "subcommand"
    validation_errors: ValidationCheck[] = []; // errors that occur during command validation, DO NOT ADD THINGS TO THIS! 
    category: CommandCategory = CommandCategory.Other;
    execute: CommandFunction<F, P, I> = defaultCommandFunction as never;

    toJSON() {
       return pick(this, ["name", "description", "type", "options", "default_member_permissions", "integration_types", ]);
    }

    constructor(
        data: Partial<Omit<Command<S, I, F, P>, "name">> & { name: string },
        private parse_arguments: GetArgumentsFunction<P, I>,
        private execute_internal: ExecuteFunction<F, P, I>
    ) {
        if (!data.long_description && data.description) data.long_description = data.description;
        Object.assign(this, { ...data });
        const validationChecks = [
            { condition: this.name.length > 32, message: "command name may not exceed 32 characters", unrecoverable: true },
            { condition: this.description.length > 100, message: "command description may not exceed 100 characters", unrecoverable: true },
            { condition: this.description.length === 0 && this.type !== ApplicationCommandType.User && this.type !== ApplicationCommandType.Message, message: "command description may not be empty if type is not User or Message", unrecoverable: true },
            { condition: (this.type === ApplicationCommandType.User || this.type === ApplicationCommandType.Message) && this.description.length > 0, message: "command description must be empty for User and Message types", unrecoverable: true },
            { condition: this.options.length > 25, message: "command options may not exceed 25", unrecoverable: true }
        ];
        validationChecks.forEach(
            check => {
            if (check.condition) {
                this.validation_errors.push(check);
            }
        });

        if (this.validation_errors.length > 0) {
            return;
        }
        // #region COMMAND EXECUTION
        this.execute = async (input: CommandInput<F, P, I, false>) => {
            log.info("executing command p/" + this.name + ((input.previous_response?.from !== undefined) ? " piped from p/" + input.previous_response?.from : ""));
            const start = performance.now();
            const { invoker } = input;
            if (!invoker) return log.error("invoker is undefined in command execution");

            const invoker_type = (invoker instanceof Message)
                ? InvokerType.Message
                : InvokerType.Interaction;

            const { whitelisted, blacklisted } = this.access.test(invoker);

            if (!whitelisted || blacklisted) {
                let accessReply = "access check failed: ";
                if (!whitelisted) accessReply += "user/channel/guild not in whitelist; ";
                if (blacklisted) accessReply += "user/channel/guild in blacklist; ";
                log.info(accessReply + "for command " + this.name);
                action.reply(invoker, { content: accessReply, ephemeral: true });
                return;
            }

            if (!this.input_types.includes(invoker_type as I)) {
                log.info("invalid input type " + invoker_type + " for command " + this.name);
                action.reply(invoker, { content: `input type \"${invoker_type}\" is not enabled for this command`, ephemeral: true });
                return;
            }

            if (!this.contexts.includes(InteractionContextType.Guild)) {
                if (invoker.guild) {
                    log.info("guild context is not enabled for command " + this.name);
                    action.reply(invoker, { content: "this command is not enabled in guilds", ephemeral: true });
                    return;
                }
            }
            // todo: add context checks for bot dm and private channel

            const bot_is_admin = invoker.guild?.members.me?.permissions.has(PermissionFlagsBits.Administrator) || false;

            if (!this.allow_external_guild && !bot_is_admin) {
                log.info("external guilds are not enabled for command " + this.name);
                action.reply(invoker, { content: "this command is not enabled in guilds where i don't have administrator", ephemeral: true });
                return;
            }

            input.enrich(input.is_message() ? (await this.parse_arguments?.(input) ?? {}) as P : undefined);
            input.piped_data = new PipedData(input.previous_response?.from, input.previous_response?.pipe_data)

            if (this.subcommand_argument in input.args) {
                const subcommand = this.subcommands.find(subcommand => (
                    subcommand.name === input.args[this.subcommand_argument] || 
                    subcommand.aliases.includes(input.args[this.subcommand_argument])
                ));
                
                if (subcommand === undefined) {
                    // pass to default executor
                    const response = await this.execute_internal(input);
                    log.info("executed command p/" + this.name + " in " + ((performance.now() - start).toFixed(3)) + "ms");
                    return response;
                }

                if (input.is_message()) {
                    input.enrich(subcommand.parse_arguments?.(input) ?? {})
                }

                log.info("executing subcommand p/" + this.name + " " + subcommand.name);
                const response = await subcommand.execute(input);
                log.info("executed subcommand p/" + this.name + " " + subcommand.name + " in " + ((performance.now() - start).toFixed(3)) + "ms");
                return response;
            }

            const response = await this.execute_internal(input);
            log.info("executed command p/" + this.name + " in " + ((performance.now() - start).toFixed(3)) + "ms");
            return response;
        };
    }
}