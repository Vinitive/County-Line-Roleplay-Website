local QBCore = exports['qb-core']:GetCoreObject()
local API = Config.ApiUrl:gsub('/+$', '')
local activeUnits = {}

local function getAccess(src)
  local Player = QBCore.Functions.GetPlayer(src)
  if not Player then return nil end
  local job = Player.PlayerData.job or {}
  local jobName = string.lower(job.name or '')
  local onDuty = job.onduty == true
  local leo = Config.LawEnforcementJobs[jobName] == true
  local dispatch = Config.DispatchJobs[jobName] == true
  if Config.RequireOnDuty and not onDuty then return nil end
  if leo then return 'leo', Player end
  if dispatch then return 'dispatch', Player end
  return nil
end

local function identity(Player)
  local data = Player.PlayerData
  local char = data.charinfo or {}
  return {
    citizenid = data.citizenid,
    name = ((char.firstname or '') .. ' ' .. (char.lastname or '')):gsub('^%s*(.-)%s*$', '%1'),
    callsign = (data.metadata and data.metadata.callsign) or '',
    job = (data.job and data.job.label) or (data.job and data.job.name) or 'Unit'
  }
end

local function callApi(src, action, payload, cb)
  local access, Player = getAccess(src)
  if not access or not Player then
    if cb then cb({ error = 'You are not authorized or are off duty.' }) end
    return
  end
  local secret = GetConvar(Config.ServerSecretConvar, '')
  if secret == '' then
    if cb then cb({ error = 'CAD server secret is not configured.' }) end
    return
  end

  payload = payload or {}
  payload.action = action
  payload.access = access
  payload.officer = identity(Player)
  payload.source = src

  PerformHttpRequest(API .. '/api/server/cad', function(status, body)
    local result = {}
    if body and body ~= '' then
      local ok, decoded = pcall(json.decode, body)
      if ok and type(decoded) == 'table' then result = decoded end
    end
    if status < 200 or status >= 300 then
      result.error = result.error or ('CAD service error (' .. tostring(status) .. ').')
    end
    if cb then cb(result) end
  end, 'POST', json.encode(payload), {
    ['Content-Type'] = 'application/json',
    ['Authorization'] = 'Bearer ' .. secret
  })
end

RegisterNetEvent('clrp-cad:server:open', function()
  local src = source
  local access = getAccess(src)
  if not access then
    TriggerClientEvent('QBCore:Notify', src, 'CAD access requires an authorized on-duty unit.', 'error')
    return
  end
  callApi(src, 'bootstrap', {}, function(result)
    if result.error then
      TriggerClientEvent('QBCore:Notify', src, result.error, 'error')
      return
    end
    TriggerClientEvent('clrp-cad:client:bootstrap', src, result)
  end)
end)

RegisterNetEvent('clrp-cad:server:request', function(data)
  local src = source
  callApi(src, data.action or 'bootstrap', data, function(result)
    TriggerClientEvent('clrp-cad:client:result', src, data.requestId, result)
  end)
end)

RegisterNetEvent('clrp-cad:server:setStatus', function(data)
  local src = source
  callApi(src, 'setStatus', data, function(result)
    TriggerClientEvent('clrp-cad:client:result', src, data.requestId, result)
  end)
end)

RegisterNetEvent('clrp-cad:server:createCall', function(data)
  local src = source
  callApi(src, 'createCall', data, function(result)
    TriggerClientEvent('clrp-cad:client:result', src, data.requestId, result)
  end)
end)

RegisterNetEvent('clrp-cad:server:assignCall', function(data)
  local src = source
  callApi(src, 'assignCall', data, function(result)
    TriggerClientEvent('clrp-cad:client:result', src, data.requestId, result)
  end)
end)

RegisterNetEvent('clrp-cad:server:updateCall', function(data)
  local src = source
  callApi(src, 'updateCall', data, function(result)
    TriggerClientEvent('clrp-cad:client:result', src, data.requestId, result)
  end)
end)

RegisterNetEvent('clrp-cad:server:search', function(data)
  local src = source
  callApi(src, 'search', data, function(result)
    TriggerClientEvent('clrp-cad:client:result', src, data.requestId, result)
  end)
end)

RegisterNetEvent('clrp-cad:server:createRecord', function(data)
  local src = source
  callApi(src, 'createRecord', data, function(result)
    TriggerClientEvent('clrp-cad:client:result', src, data.requestId, result)
  end)
end)

RegisterNetEvent('clrp-cad:server:createBolo', function(data)
  local src = source
  callApi(src, 'createBolo', data, function(result)
    TriggerClientEvent('clrp-cad:client:result', src, data.requestId, result)
  end)
end)

AddEventHandler('playerDropped', function()
  activeUnits[source] = nil
end)
