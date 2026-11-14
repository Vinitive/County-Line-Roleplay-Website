local QBCore = exports['qb-core']:GetCoreObject()
local isOpen = false

local function setOpen(state)
  isOpen = state
  SetNuiFocus(state, state)
  SendNUIMessage({ action = state and 'open' or 'close' })
  if state then
    TriggerServerEvent('clrp-cad:server:open')
  end
end


-- Force the NUI closed after its browser has finished loading. FiveM can start
-- the Lua resource before the NUI page is ready to receive the first message.
local function forceCloseNui()
  isOpen = false
  SetNuiFocus(false, false)
  SetNuiFocusKeepInput(false)
  SendNUIMessage({ action = 'close' })
end

AddEventHandler('onClientResourceStart', function(resourceName)
  if resourceName ~= GetCurrentResourceName() then return end
  forceCloseNui()
  CreateThread(function()
    Wait(500)
    forceCloseNui()
    Wait(1000)
    forceCloseNui()
  end)
end)

-- Also release focus and hide the page when the resource is stopped/restarted.
AddEventHandler('onClientResourceStop', function(resourceName)
  if resourceName ~= GetCurrentResourceName() then return end
  forceCloseNui()
end)

RegisterCommand(Config.Command, function()
  setOpen(not isOpen)
end, false)

RegisterKeyMapping(Config.Command, 'Open County Line CAD/MDT', 'keyboard', Config.Keybind)

RegisterNetEvent('clrp-cad:client:open', function()
  setOpen(true)
end)

RegisterNetEvent('clrp-cad:client:deny', function()
  setOpen(false)
end)

RegisterNetEvent('clrp-cad:client:bootstrap', function(payload)
  SendNUIMessage({ action = 'bootstrap', data = payload })
end)

RegisterNetEvent('clrp-cad:client:result', function(requestId, payload)
  SendNUIMessage({ action = 'result', requestId = requestId, data = payload })
  if payload and payload.refresh then
    TriggerServerEvent('clrp-cad:server:open')
  end
end)

RegisterNUICallback('close', function(_, cb)
  setOpen(false)
  cb({ ok = true })
end)

RegisterNUICallback('request', function(data, cb)
  TriggerServerEvent('clrp-cad:server:request', data or {})
  cb({ ok = true })
end)

RegisterNUICallback('setStatus', function(data, cb)
  TriggerServerEvent('clrp-cad:server:setStatus', data or {})
  cb({ ok = true })
end)

RegisterNUICallback('createCall', function(data, cb)
  TriggerServerEvent('clrp-cad:server:createCall', data or {})
  cb({ ok = true })
end)

RegisterNUICallback('assignCall', function(data, cb)
  TriggerServerEvent('clrp-cad:server:assignCall', data or {})
  cb({ ok = true })
end)

RegisterNUICallback('updateCall', function(data, cb)
  TriggerServerEvent('clrp-cad:server:updateCall', data or {})
  cb({ ok = true })
end)

RegisterNUICallback('search', function(data, cb)
  TriggerServerEvent('clrp-cad:server:search', data or {})
  cb({ ok = true })
end)

RegisterNUICallback('createRecord', function(data, cb)
  TriggerServerEvent('clrp-cad:server:createRecord', data or {})
  cb({ ok = true })
end)

RegisterNUICallback('createBolo', function(data, cb)
  TriggerServerEvent('clrp-cad:server:createBolo', data or {})
  cb({ ok = true })
end)

RegisterNetEvent('QBCore:Client:OnPlayerUnload', function()
  if isOpen then setOpen(false) end
end)

CreateThread(function()
  while true do
    Wait(30000)
    if isOpen then TriggerServerEvent('clrp-cad:server:open') end
  end
end)
