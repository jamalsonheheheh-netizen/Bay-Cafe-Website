-- Bay Café Game Activity Bridge
-- Put this Script in ServerScriptService when the Bay Café game releases.
-- Enable HTTP Requests in Game Settings > Security.
-- IMPORTANT: set API_URL and GAME_ACTIVITY_SECRET privately in Studio.

local Players = game:GetService("Players")
local HttpService = game:GetService("HttpService")

local API_URL = "https://bay-cafe-website-production-7514.up.railway.app/api/game/activity"
local GAME_ACTIVITY_SECRET = "PUT_YOUR_GAME_ACTIVITY_SECRET_HERE"

local function send(player, eventName)
    if GAME_ACTIVITY_SECRET == "PUT_YOUR_GAME_ACTIVITY_SECRET_HERE" then
        return
    end

    local body = HttpService:JSONEncode({
        robloxId = tostring(player.UserId),
        username = player.Name,
        event = eventName,
    })

    pcall(function()
        HttpService:RequestAsync({
            Url = API_URL,
            Method = "POST",
            Headers = {
                ["Content-Type"] = "application/json",
                ["x-bay-game-secret"] = GAME_ACTIVITY_SECRET,
            },
            Body = body,
        })
    end)
end

Players.PlayerAdded:Connect(function(player)
    send(player, "join")
end)

Players.PlayerRemoving:Connect(function(player)
    send(player, "leave")
end)

task.spawn(function()
    while true do
        task.wait(120)
        for _, player in ipairs(Players:GetPlayers()) do
            send(player, "heartbeat")
        end
    end
end)
