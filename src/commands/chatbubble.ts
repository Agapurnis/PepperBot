import * as contributors from "../../constants/contributors.json"
import { Attachment, AttachmentBuilder, Collection, Message } from "discord.js";
import { Command, CommandCategory, CommandOption, CommandOptionType, CommandResponse } from "../lib/classes/command";
import * as action from "../lib/discord_action";
import sharp from "sharp";
import { evaluate } from "mathjs";
import * as log from "../lib/log";

const VALID_GRAVITY = ["north", "south"] as const;
type Gravity = typeof VALID_GRAVITY[number];

const command = new Command(
    {
        name: 'chatbubble',
        description: 'creates a chatbubble out of the provided image or url',
        long_description: 'creates a chatbubble out of the provided image or url. you can specify where the chatbubble should be placed.',
        category: CommandCategory.Utility,
        pipable_to: [],
        argument_order: "any",
        contributors: [
            contributors.reidlab,
            contributors.ayeuhugyu,
        ],
        options: [
            new CommandOption({
                name: 'image',
                description: 'the image to create a chatbubble out of',
                required: false,
                long_requirements: "if url is undefined",
                type: CommandOptionType.Attachment
            }),
            new CommandOption({
                name: 'url',
                description: 'url of the image to create a chatbubble out of',
                required: false,
                long_requirements: "if image is undefined",
                type: CommandOptionType.String
            }),
            new CommandOption({
                name: 'x',
                description: 'x position of the chatbubble',
                required: false,
                type: CommandOptionType.String
            }),
            new CommandOption({
                name: 'y',
                description: 'y position of the chatbubble',
                required: false,
                type: CommandOptionType.String
            }),
            // new CommandOption({
            //     name: 'gravity',
            //     description: 'gravity of the chatbubble',
            //     required: false,
            //     type: CommandOptionType.String,
            //     choices: VALID_GRAVITY.map(value => ({ value, name: value }))
            // }),
        ],
        example_usage: ["p/chatbubble x=1/3 y=1/4 https://example.com/image.png", "p/chatbubble x=0.5, y=0.25 <attach your image>", "p/chatbubble left <attach your image>"],
        aliases: ["cb", "sb", "speechbubble", "bubble"]
    }, 
    async function getArguments ({ message, command_name_used, guild_config }) {
        const commandLength = `${guild_config.other.prefix}${command_name_used}`.length;
        const text = message.content.slice(commandLength)?.trim();
        return {
            url: text.match(/https?:\/\/[^\s]+/g)?.[0],
            gravity: text.match(/south|north/)?.[0] as Gravity | undefined,
            x: text.match(/ x=([^\s]+)/)?.[1] ?? text.match(/left|center|right/)?.[0],
            y: text.match(/ y=([^\s]+)/)?.[1],
            image: message.attachments.first()
        }
    },
    async function execute ({ invoker, piped_data, args, guild_config }) {
        
        const ephemeral = guild_config.other.use_ephemeral_replies;
        let x = args.x;
        let y = args.y;
        switch (x) {
            case "left": { x = "1/4"; break }
            case "center": { x = "1/2"; break }
            case "right": { x = "3/4"; break }
        }
        const xPos = evaluate(x || "") || (1 / 3);
        const yPos = evaluate(y || "") || (1 / 4);
        if (args.gravity && !VALID_GRAVITY.includes(args.gravity as Gravity)) {
            await action.reply(invoker, { content: "invalid gravity; must be \"south\" or \"north\", not " + args.gravity, ephemeral });
            return new CommandResponse({});
        }
        const gravity = args.gravity as Gravity ?? "north";
        if (!args.url && !args.image && !piped_data?.data?.chatbubble_url) {
            await action.reply(invoker, { content: "i cant make the air into a chatbubble, gimme an image", ephemeral });
            return new CommandResponse({});
        }

        const url = args.url ?? args.image?.url ?? piped_data?.data?.chatbubble_url;
        const inputImageBuffer = await fetch(url).then(res => res.arrayBuffer());
        const inputImage = await sharp(inputImageBuffer, { animated: true });
        
        let metadata: sharp.Metadata;
        try {
            metadata = await sharp(inputImageBuffer).metadata();
        } catch (err) {
            log.error(err);
            action.reply(invoker, { content: "uh oh! invalid image?", ephemeral });
            return;
        }
        
        // i don't think it's possible for this to be null/undefined
        // i am ignoring it for now 😊
        const width = metadata.width as number;
        const height = metadata.height as number;
        
        const tailCurveDepth = 5 / 8;
        const tailWidth = 40;
        const tailShift = (xPos <= (1/3) || xPos >= (2/3)) ? Math.round(xPos) : xPos;

        const overlayFlipped = gravity === "south";
        const overlaySvg = `
            <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
                <path d="
                    M 0, ${overlayFlipped ? height : 0}
                    Q
                        ${width / 2},
                        ${height * (overlayFlipped ? (1 - yPos * tailCurveDepth) : yPos * tailCurveDepth)} ${width},
                        ${overlayFlipped ? height : 0}
                " fill="white" stroke="none"/>
                <polygon points="
                    ${width * tailShift - tailWidth}, ${overlayFlipped ? height : 0}
                    ${width * tailShift + tailWidth}, ${overlayFlipped ? height : 0}
                    ${width * xPos}, ${height * (overlayFlipped ? (1 - yPos) : (yPos))}
                " fill="white" stroke="none"/>
            </svg>
        `;
        
        const overlayBuffer = await sharp(Buffer.from(overlaySvg))
            .png()
            .toBuffer();
        
        const outputBuffer = await inputImage
            .composite([{
                input: overlayBuffer,
                blend: "dest-out",
                gravity: "center",
                tile: true,
            }])
            .toFormat("gif")
            .toBuffer();
        
        action.reply(invoker, { 
            content: "here's your chat bubble",
            files: [new AttachmentBuilder(outputBuffer, { name: "bubble.gif" })]
        })
    }
);

export default command;
