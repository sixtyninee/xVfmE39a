const { Client, GatewayIntentBits } = require("discord.js");
const https = require("https");
const cheerio = require("cheerio");
const express = require('express');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000; // Use the port provided by the hosting service or default to 3000

// Serve a basic webpage
app.get('/', (req, res) => {
    res.send('Discord bot is running!');
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});



// GitHub API configuration
const GITHUB_TOKEN = process.env.GITHUB_TOKEN; // Your GitHub token
const REPO_OWNER = "sixtyninee"; // Your GitHub username
const REPO_NAME = "rahruh"; // Your GitHub repository name
const FILE_PATH = "koslist.json"; // Path to the JSON file in the repo
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN; // Your Discord bot token
const ALLOWED_CHANNEL_ID = "1293410179123122347";

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent, // Required to read message content
    ],
});

// Function to check if a Roblox player exists
async function checkPlayerExists(playerId) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: "www.roblox.com",
            path: `/users/${playerId}/profile`,
            method: "GET",
        };

        const req = https.request(options, (res) => {
            let responseData = "";
            res.on("data", (chunk) => {
                responseData += chunk;
            });

            res.on("end", () => {
                if (res.statusCode === 200) {
                    const $ = cheerio.load(responseData);
                    const playerName = $("title").text(); // Modify this selector as needed
                    resolve(playerName.includes("Roblox")); // Example condition
                } else if (res.statusCode === 404) {
                    resolve(null); // Player does not exist
                } else {
                    reject(`Roblox profile page returned status code ${res.statusCode}`);
                }
            });
        });

        req.on("error", (error) => {
            reject(`Failed to check player existence: ${error.message}`);
        });

        req.end();
    });
}

// Function to update the JSON file with a new ID
async function updateFile(newId) {
    try {
        const currentContent = await getCurrentFileContent();
        let jsonContent = JSON.parse(currentContent);

        if (!jsonContent.ids) {
            jsonContent.ids = [];
        }

        // Check if the ID already exists
        if (jsonContent.ids.includes(newId)) {
            return "ID already exists.";
        }

        jsonContent.ids.push(newId);
        const updatedContent = JSON.stringify(jsonContent, null, 2);
        const sha = await getCurrentFileSHA();

        await updateFileContent(updatedContent, sha);
        return "ID added successfully!";
    } catch (error) {
        console.error("Error in updateFile:", error);
        return "An error occurred while updating the file.";
    }
}

// Function to remove an ID from the JSON file
async function removeFile(idToRemove) {
    try {
        const currentContent = await getCurrentFileContent();
        let jsonContent = JSON.parse(currentContent);

        if (!jsonContent.ids || !jsonContent.ids.includes(idToRemove)) {
            return "ID not found in the file.";
        }

        jsonContent.ids = jsonContent.ids.filter(id => id !== idToRemove);
        const updatedContent = JSON.stringify(jsonContent, null, 2);
        const sha = await getCurrentFileSHA();

        await updateFileContent(updatedContent, sha);
        return "ID removed successfully!";
    } catch (error) {
        console.error("Error in removeFile:", error);
        return "An error occurred while updating the file.";
    }
}

// Function to get the current content of the file
async function getCurrentFileContent() {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: "api.github.com",
            path: `/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`,
            method: "GET",
            headers: {
                Authorization: `token ${GITHUB_TOKEN}`,
                Accept: "application/vnd.github.v3+json",
                "User-Agent": "sixtyninee", // Add User-Agent header
            },
        };

        const req = https.request(options, (res) => {
            let responseData = "";
            res.on("data", (chunk) => {
                responseData += chunk;
            });

            res.on("end", () => {
                if (res.statusCode !== 200) {
                    reject(`GitHub API returned status code ${res.statusCode}: ${responseData}`);
                    return;
                }
                const jsonResponse = JSON.parse(responseData);
                const decodedContent = Buffer.from(jsonResponse.content, 'base64').toString('utf-8');
                resolve(decodedContent);
            });
        });

        req.on("error", (error) => {
            reject("Failed to fetch file content: " + error.message);
        });

        req.end();
    });
}

// Function to get the current file SHA
async function getCurrentFileSHA() {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: "api.github.com",
            path: `/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`,
            method: "GET",
            headers: {
                Authorization: `token ${GITHUB_TOKEN}`,
                Accept: "application/vnd.github.v3+json",
                "User-Agent": "sixtyninee",
            },
        };

        const req = https.request(options, (res) => {
            let responseData = "";
            res.on("data", (chunk) => {
                responseData += chunk;
            });

            res.on("end", () => {
                if (res.statusCode !== 200) {
                    reject(`GitHub API returned status code ${res.statusCode}: ${responseData}`);
                    return;
                }
                const jsonResponse = JSON.parse(responseData);
                resolve(jsonResponse.sha);
            });
        });

        req.on("error", (error) => {
            reject("Failed to fetch file SHA: " + error.message);
        });

        req.end();
    });
}

// Function to update the file content
async function updateFileContent(updatedContent, sha) {
    return new Promise((resolve, reject) => {
        const updateData = JSON.stringify({
            message: "Update JSON file with new ID",
            content: Buffer.from(updatedContent).toString("base64"),
            sha: sha,
        });

        const options = {
            hostname: "api.github.com",
            path: `/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`,
            method: "PUT",
            headers: {
                Authorization: `token ${GITHUB_TOKEN}`,
                Accept: "application/vnd.github.v3+json",
                "Content-Type": "application/json",
                "User-Agent": "sixtyninee",
                "Content-Length": Buffer.byteLength(updateData),
            },
        };

        const req = https.request(options, (res) => {
            let responseData = "";
            res.on("data", (chunk) => {
                responseData += chunk;
            });

            res.on("end", () => {
                if (res.statusCode !== 200) {
                    reject(`GitHub API returned status code ${res.statusCode}: ${responseData}`);
                    return;
                }
                resolve(responseData);
            });
        });

        req.on("error", (error) => {
            reject("Error updating file: " + error.message);
        });

        req.write(updateData);
        req.end();
    });
}

// When the bot is ready
client.once("ready", () => {
    console.log(`Logged in as ${client.user.tag}`);
});

// Listen for messages
client.on("messageCreate", async (message) => {
    // Check if the command is sent in the allowed channel
    if (message.channel.id !== ALLOWED_CHANNEL_ID || !message.content.startsWith("!") || message.author.bot) return;

    const args = message.content.slice(1).trim().split(" ");
    const command = args.shift().toLowerCase();

    // Command to add an ID
    if (command === "add" && args.length === 1) {
        const id = args[0];
        console.log(`Checking player existence for ID: ${id}`); // Added log

        // Check if the player exists before updating the file
        try {
            const playerExists = await checkPlayerExists(id);
            if (playerExists) {
                const resultMessage = await updateFile(id);
                message.channel.send(resultMessage);
            } else {
                message.channel.send("Player doesn't exist.");
            }
        } catch (error) {
            console.error("Error checking player existence:", error); // Improved error logging
            message.channel.send("Player does not exist.");
        }
    }

    // Command to remove an ID
    if (command === "remove" && args.length === 1) {
        const id = args[0];
        const resultMessage = await removeFile(id);
        message.channel.send(resultMessage);
    }

    // Command to display all IDs
    if (command === "display") {
        try {
            const currentContent = await getCurrentFileContent();
            const jsonContent = JSON.parse(currentContent);
            const ids = jsonContent.ids;

            if (ids && ids.length > 0) {
                message.channel.send(`Current IDs: ${ids.join(", ")}`);
            } else {
                message.channel.send("No IDs found.");
            }
        } catch (error) {
            console.error("Error fetching IDs:", error);
            message.channel.send("An error occurred while fetching the IDs.");
        }
    }
});


// Login to Discord
client.login(BOT_TOKEN);
