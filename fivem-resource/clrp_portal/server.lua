local QBCore = exports['qb-core']:GetCoreObject()
local API = (Config.ApiUrl or ''):gsub('/+$', '')
local SECRET = Config.ApiSecret or ''

local function log(message)
    print(('[clrp_portal] %s'):format(message))
end

local function notify(src, message, kind)
    TriggerClientEvent('QBCore:Notify', src, message, kind or 'primary', 7000)
end

local function requestApi(path, payload, callback)
    if API == '' or SECRET == '' then
        if callback then callback(false, 'Portal API URL or server secret is missing.') end
        return
    end

    PerformHttpRequest(API .. path, function(status, body)
        local decoded = nil
        if body and body ~= '' then
            local ok, result = pcall(json.decode, body)
            if ok then decoded = result end
        end

        if status >= 200 and status < 300 then
            if callback then callback(true, decoded or {}) end
        else
            local message = decoded and decoded.error or ('HTTP ' .. tostring(status))
            if callback then callback(false, message) end
        end
    end, 'POST', json.encode(payload or {}), {
        ['Content-Type'] = 'application/json',
        ['Authorization'] = 'Bearer ' .. SECRET
    })
end

local function safeQuery(query, params)
    local ok, result = pcall(function()
        return MySQL.query.await(query, params or {})
    end)
    if not ok then
        log('Optional database query failed: ' .. tostring(result))
        return {}
    end
    return result or {}
end

local function getName(charinfo)
    local first = tostring(charinfo.firstname or '')
    local last = tostring(charinfo.lastname or '')
    return (first .. ' ' .. last):gsub('^%s+', ''):gsub('%s+$', '')
end

local function getVehicles(citizenid)
    local rows = safeQuery([[
        SELECT vehicle, plate, garage, state
        FROM player_vehicles
        WHERE citizenid = ?
        ORDER BY vehicle ASC
        LIMIT ?
    ]], { citizenid, Config.MaxVehicles })

    local vehicles = {}
    for _, row in ipairs(rows) do
        local model = tostring(row.vehicle or '')
        local shared = QBCore.Shared and QBCore.Shared.Vehicles and QBCore.Shared.Vehicles[model]
        vehicles[#vehicles + 1] = {
            model = model,
            label = shared and (shared.name or shared.brand or model) or model,
            plate = row.plate,
            garage = row.garage,
            state = row.state
        }
    end
    return vehicles
end

local function getHouses(citizenid)
    if not Config.Housing.enabled then return {} end

    local rows = safeQuery(([[
        SELECT ph.house AS house, hl.label AS label
        FROM %s ph
        LEFT JOIN %s hl ON ph.house = hl.name
        WHERE ph.citizenid = ?
    ]]):format(Config.Housing.ownershipTable, Config.Housing.locationsTable), { citizenid })

    local houses = {}
    for _, row in ipairs(rows) do
        houses[#houses + 1] = {
            id = row.house,
            label = row.label or row.house
        }
    end
    return houses
end

local function getPsMdtRecords(citizenid)
    if not Config.PsMdt.enabled or GetResourceState('ps-mdt') ~= 'started' then
        return { arrests = {}, charges = {}, fines = {} }
    end

    -- ps-mdt v3 schema. Warrants are intentionally never queried or returned.
    local charges = safeQuery([[
        SELECT r.id AS reportId, r.title, r.type, r.datecreated,
               c.charge, c.count, c.fine, c.time
        FROM mdt_reports_charges c
        INNER JOIN mdt_reports r ON r.id = c.reportid
        WHERE c.citizenid = ?
        ORDER BY r.datecreated DESC
        LIMIT ?
    ]], { citizenid, Config.MaxRecords })

    local arrests = safeQuery([[
        SELECT r.id AS reportId, r.title, r.datecreated, a.officer_name
        FROM mdt_arrests a
        INNER JOIN mdt_reports r ON r.id = a.reportid
        WHERE a.citizenid = ?
        ORDER BY a.created_at DESC
        LIMIT ?
    ]], { citizenid, Config.MaxRecords })

    local fines = {}
    for _, row in ipairs(charges) do
        local amount = tonumber(row.fine) or 0
        if amount > 0 then
            fines[#fines + 1] = {
                reportId = row.reportId,
                title = row.title,
                charge = row.charge,
                amount = amount,
                date = row.datecreated
            }
        end
    end

    return { arrests = arrests, charges = charges, fines = fines }
end

local function buildCharacter(player)
    local data = player.PlayerData
    local charinfo = data.charinfo or {}
    local job = data.job or {}
    local gang = data.gang or {}
    local money = data.money or {}
    local grade = job.grade or {}
    local gangGrade = gang.grade or {}

    local records = getPsMdtRecords(data.citizenid)

    return {
        citizenid = data.citizenid,
        characterName = getName(charinfo),
        profile = {
            firstname = charinfo.firstname,
            lastname = charinfo.lastname,
            birthdate = charinfo.birthdate,
            gender = charinfo.gender,
            nationality = charinfo.nationality,
            phone = charinfo.phone
        },
        money = {
            cash = tonumber(money.cash) or 0,
            bank = tonumber(money.bank) or 0
        },
        job = {
            name = job.name,
            label = job.label or job.name,
            grade = grade.level or grade,
            gradeName = grade.name,
            onduty = job.onduty == true
        },
        gang = {
            name = gang.name,
            label = gang.label or gang.name,
            grade = gangGrade.level or gangGrade,
            gradeName = gangGrade.name
        },
        vehicles = getVehicles(data.citizenid),
        houses = getHouses(data.citizenid),
        records = records,
        syncedAt = os.time()
    }
end

RegisterCommand(Config.LinkCommand, function(source, args)
    if source == 0 then
        log(('Use /%s CODE in-game, not from the server console.'):format(Config.LinkCommand))
        return
    end

    local code = tostring(args[1] or ''):gsub('%s+', '')
    if not code:match('^%d%d%d%d%d%d%d%d$') then
        notify(source, ('Usage: /%s 8-DIGIT-CODE'):format(Config.LinkCommand), 'error')
        return
    end

    local player = QBCore.Functions.GetPlayer(source)
    if not player or not player.PlayerData or not player.PlayerData.citizenid then
        notify(source, 'Your character could not be identified. Try again after loading in.', 'error')
        return
    end

    local data = player.PlayerData
    requestApi('/api/server/link', {
        code = code,
        citizenid = data.citizenid,
        characterName = getName(data.charinfo or {})
    }, function(ok, result)
        if ok then
            notify(source, 'Your character has been linked to your County Line website account!', 'success')
            log(('Linked citizenid %s to a portal account.'):format(data.citizenid))
        else
            notify(source, 'Character linking failed: ' .. tostring(result), 'error')
        end
    end)
end, false)

local function syncOnlineCharacters()
    if API == '' or SECRET == '' then
        log('Sync skipped: set clrp_portal_api_url and clrp_portal_api_secret in server.cfg.')
        return
    end

    local characters = {}
    for _, sourceId in ipairs(QBCore.Functions.GetPlayers()) do
        local player = QBCore.Functions.GetPlayer(sourceId)
        if player and player.PlayerData and player.PlayerData.citizenid then
            local ok, character = pcall(buildCharacter, player)
            if ok and character then
                characters[#characters + 1] = character
            else
                log(('Could not build character snapshot for player %s: %s'):format(sourceId, tostring(character)))
            end
        end
    end

    requestApi('/api/server/sync', {
        characters = characters,
        server = {
            name = GetConvar('sv_hostname', 'County Line Roleplay'),
            players = GetNumPlayerIndices(),
            maxPlayers = tonumber(GetConvar('sv_maxclients', '32')) or 32
        }
    }, function(ok, result)
        if not ok then
            log('Sync failed: ' .. tostring(result))
        elseif result and result.updated and result.updated > 0 then
            log(('Synced %s linked online character(s).'):format(result.updated))
        end
    end)
end

CreateThread(function()
    Wait(15000)
    log('Resource started. Online character sync interval: ' .. tostring(Config.SyncInterval) .. 'ms.')
    while true do
        syncOnlineCharacters()
        Wait(Config.SyncInterval)
    end
end)

AddEventHandler('onResourceStart', function(resourceName)
    if resourceName ~= GetCurrentResourceName() then return end
    if GetResourceState('qb-core') ~= 'started' then
        log('WARNING: qb-core is not started.')
    end
    if GetResourceState('oxmysql') ~= 'started' then
        log('WARNING: oxmysql is not started.')
    end
end)
