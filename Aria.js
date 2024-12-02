const http = require('http');
const { 
    Client, 
    GatewayIntentBits, 
    GatewayDispatchEvents 
} = require("discord.js");
const { readdirSync } = require("fs");
const { CommandKit } = require("commandkit");
const { Spotify } = require("riffy-spotify");
const { connect } = require("mongoose");
const { logger } = require("./utils/logger");
const { Riffy } = require("riffy");
const config = require("./config");
const path = require("path");

// CREATING DISCORD CLIENT
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ],
});

// CREATING COMMAND & EVENT HANDLER (COMMANDKIT)
new CommandKit({
    client,
    commandsPath: path.join(__dirname, "commands"),
    eventsPath: path.join(__dirname, "./events/botEvents"),
    validationsPath: path.join(__dirname, "validations"),
    devGuildIds: config.developer_guild,
    devUserIds: config.developer_id,
    bulkRegister: false,
});

// CREATING RIFFY CLIENT
const spotify = new Spotify({
    clientId: config.spotify.ClientId,
    clientSecret: config.spotify.ClientSecret
});

client.riffy = new Riffy(client, config.nodes, {
    send: (payload) => {
        const guild = client.guilds.cache.get(payload.d.guild_id);
        if (guild) guild.shard.send(payload);
    },
    defaultSearchPlatform: config.defaultSearchPlatform,
    reconnectTries: 15,
    restVersion: "v4",
    plugin: [spotify]
});
module.exports = client;

// LOGIN TO THE BOT
client.login(config.client_token);
client.on("raw", (d) => {
    if (![GatewayDispatchEvents.VoiceStateUpdate, GatewayDispatchEvents.VoiceServerUpdate].includes(d.t)) return;
    client.riffy.updateVoiceState(d);
});

// FUNCTION TO LOAD MONGODB 
async function load_db() {
    await connect(config.mongodb_url)
        .then(() => {
            logger(`Successfully connected to MongoDB!`, "debug");
        })
}

// FUNCTION TO INITIATE RIFFY CLIENT
async function load_riffy() {
    logger("Initiating Riffy Events", "warn");
    readdirSync('./events/riffyEvents').forEach(async dir => {
        const lavalink = readdirSync(`./events/riffyEvents/${dir}`).filter(file => file.endsWith('.js'));
        for (let file of lavalink) {
            try {
                let pull = require(`./events/riffyEvents/${dir}/${file}`);
                if (pull.name && typeof pull.name !== 'string') {
                    logger(`Couldn't load the riffy event ${file}, error: Property event should be string.`, "error");
                    continue;
                }
            } catch (err) {
                logger(`Couldn't load the riffy event ${file}, error: ${err}`, "error");
                continue;
            }
        }
    });
};

// CHECK CONFIGURATION
(async () => {
    await checkConfig();
    await load_riffy();
    await load_db();
})()

async function checkConfig() {
    const requiredFields = [
        'client_token',
        'client_id',
        'default_color',
        'mongodb_url',
        'developer_id',
        'developer_guild',
        'defaultSearchPlatform',
        'spotify.ClientId',
        'spotify.ClientSecret',
        'nodes'
    ];
    const missingFields = [];
    requiredFields.forEach(field => {
        const keys = field.split('.');
        let value = config;
        for (const key of keys) {
            value = value[key];
            if (value === undefined) break;
        }
        if (value === "" || value === null || (Array.isArray(value) && value.length === 0)) {
            missingFields.push(field);
        }
    });
    if (missingFields.length > 0) {
        logger(`Missing required configuration fields: ${missingFields.join(', ')}`, "error");
        process.exit(1);
    } else {
        logger("All required configuration fields are filled", "success");
    }
}

// SIMPLE HTTP SERVER FOR RENDER
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Discord Bot is Running\n');
}).listen(PORT, () => {
    logger(`Web server is running on port ${PORT}`, "success");
});
