import os
import requests
import time
import discord
import asyncio  # Import asyncio for async sleep
from dotenv import load_dotenv

load_dotenv()
DISCORD_BOT_TOKEN = os.getenv('DISCORD_BOT_TOKEN')

intents = discord.Intents.default()
intents.messages = True  # Enable message-related events
intents.guilds = True  # Enable guild-related events
intents.message_content = True  # Enable access to message content


# Set up the Discord client with intents
client = discord.Client(intents=intents)

# Function to fetch user IDs from GitHub
def fetch_user_ids_from_github(github_url):
    response = requests.get(github_url)
    if response.status_code == 200:
        data = response.json()
        return data['ids']  # Return the list of IDs from the JSON structure
    else:
        raise Exception(f"Failed to fetch user IDs from GitHub. Status: {response.status_code}")

# Fetch player's avatar headshot URL using user ID
def get_user_thumbnail(user_id):
    url = f"https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds={user_id}&format=Png&size=150x150"
    response = requests.get(url)
    if response.status_code == 200:
        data = response.json()
        return data['data'][0]['imageUrl']
    else:
        raise Exception(f"Failed to fetch thumbnail for user ID: {user_id}")

# Fetch username from user ID
def get_username_from_user_id(user_id):
    url = f"https://users.roblox.com/v1/users/{user_id}"
    response = requests.get(url)
    if response.status_code == 200:
        data = response.json()
        return data['name']  # Return the username
    else:
        raise Exception(f"Failed to fetch username for user ID: {user_id}")

# Fetch game servers, paginate using cursor
def get_server_list(place_id, cursor=""):
    url = f"https://games.roblox.com/v1/games/{place_id}/servers/Public?limit=100"
    if cursor:
        url += f"&cursor={cursor}"
    
    response = requests.get(url)

    if response.status_code == 200:
        return response.json()
    else:
        raise Exception(f"Failed to fetch servers for place ID {place_id}. Status: {response.status_code}, Response: {response.text}")

# Fetch player thumbnails using player tokens
def fetch_thumbnails(player_tokens):
    url = "https://thumbnails.roblox.com/v1/batch"
    body = [
        {
            "requestId": f"0:{token}:AvatarHeadshot:150x150:png:regular",
            "type": "AvatarHeadShot",
            "targetId": 0,
            "token": token,
            "format": "png",
            "size": "150x150"
        }
        for token in player_tokens
    ]

    response = requests.post(url, json=body)
    if response.status_code == 200:
        return response.json()["data"]
    else:
        raise Exception("Failed to fetch thumbnails")

async def send_embed_to_discord_channel(channel_id, username, avatar_url, role_id, place_id):
    channel = client.get_channel(channel_id)
    if channel:
        # First, send a text message pinging the role
        await channel.send(f"<@&{role_id}>")

        # Generate the link to the game using the Place ID
        game_link = f"https://www.roblox.com/games/{place_id}"

        # Then, send the embedded message
        embed = discord.Embed(title="Found player in-game", color=0x00ff00)  # Green color
        embed.add_field(name="Username", value=username, inline=True)  # Include player username field
        embed.set_thumbnail(url=avatar_url)  # Avatar thumbnail on the right

        # Add "Click here to join" link in the description
        embed.description = f"[Link to the game]({game_link})"

        await channel.send(embed=embed)
    else:
        print(f"Channel with ID {channel_id} not found.")

# Main search function
async def search_player_in_game(user_id, place_id, channel_id, found_users):
    try:
        target_thumb_url = get_user_thumbnail(user_id)
        username = get_username_from_user_id(user_id)
        print(f"Searching for user ID: {user_id} with thumbnail: {target_thumb_url}")

        searching = True
        cursor = ""
        all_player_tokens = []

        while searching:
            servers = get_server_list(place_id, cursor)
            cursor = servers.get("nextPageCursor")

            for server in servers['data']:
                all_player_tokens.extend(server["playerTokens"])

            if not cursor:
                break

        chunk_size = 100
        found = False
        i = 0
        role_id = "1293593686998913076"

        while i < len(all_player_tokens) and not found:
            chunk = all_player_tokens[i:i + chunk_size]
            i += chunk_size

            server_thumbs = fetch_thumbnails(chunk)
            for thumb in server_thumbs:
                if thumb['imageUrl'] == target_thumb_url:
                    found = True
                    print(f"Found user ID: {user_id} in the game!")

                    if not found_users.get(user_id, False):
                        await send_embed_to_discord_channel(channel_id, username, target_thumb_url, role_id, place_id)  # Send embed message with join link
                    found_users[user_id] = True
                    break

            await asyncio.sleep(1)

        if not found:
            print(f"User ID: {user_id} not found in any server.")
            found_users[user_id] = False
        else:
            print("Player search complete.")

    except Exception as e:
        print(f"Error: {str(e)}")

# Function to run searches for all user IDs in a loop
async def search_multiple_users(place_id, channel_id, delay_between_users=30, delay_between_rounds=120):
    found_users = {}  # Dictionary to track found status of user IDs
    github_url = "https://raw.githubusercontent.com/sixtyninee/rahruh/refs/heads/main/koslist.json"

    while True:
        print("Fetching updated user IDs from GitHub...")
        user_ids = fetch_user_ids_from_github(github_url)  # Fetch fresh user IDs

        print("Starting new search round...")
        for user_id in user_ids:
            await search_player_in_game(user_id, place_id, channel_id, found_users)
            print(f"Waiting {delay_between_users} seconds before searching for the next user...")
            await asyncio.sleep(delay_between_users)  # Use async sleep instead of time.sleep

        print(f"Completed round of searches. Waiting {delay_between_rounds} seconds before starting over...")
        await asyncio.sleep(delay_between_rounds)  # Use async sleep instead of time.sleep

# Start the Discord bot
@client.event
async def on_ready():
    print(f'Logged in as {client.user}!')
    place_id = "2988554876"  # Replace with the Place ID of the game
    discord_channel_id = 1293410574239273011  # Replace with your Discord channel ID you want messages to be in
    await search_multiple_users(place_id, discord_channel_id)


client.run(DISCORD_BOT_TOKEN)
