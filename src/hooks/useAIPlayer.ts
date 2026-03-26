import { useEffect, useRef } from 'react'
import { useGameStore } from '../store/gameStore'
import { getAIAction, getAIRobberTile, getAIDiscardSelection } from '../utils/aiPlayer'
import { totalResources } from '../utils/gameLogic'
import type { ResourceType } from '../types/game'

const AI_DELAY_MS = 800

export function useAIPlayer() {
  const game = useGameStore(s => s.game)
  const rollDice = useGameStore(s => s.rollDice)
  const endTurn = useGameStore(s => s.endTurn)
  const buildRoute = useGameStore(s => s.buildRoute)
  const buildOutpost = useGameStore(s => s.buildOutpost)
  const buildBase = useGameStore(s => s.buildBase)
  const buyDevCard = useGameStore(s => s.buyDevCard)
  const bankTrade = useGameStore(s => s.bankTrade)
  const playDevCard = useGameStore(s => s.playDevCard)
  const clickVertex = useGameStore(s => s.clickVertex)
  const clickEdge = useGameStore(s => s.clickEdge)
  const clickTile = useGameStore(s => s.clickTile)
  const updateDiscardSelection = useGameStore(s => s.updateDiscardSelection)
  const confirmDiscard = useGameStore(s => s.confirmDiscard)
  const respondTrade = useGameStore(s => s.respondTrade)
  const discardTarget = useGameStore(s => s.discardTarget)

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isMultiplayer = useGameStore(s => s.isMultiplayer)
  const localPlayerId = useGameStore(s => s.localPlayerId)

  useEffect(() => {
    if (!game) return
    if (game.phase === 'game_over') return

    if (isMultiplayer && localPlayerId !== game.playerOrder[0]) return

    const currentPlayerId = game.playerOrder[game.currentPlayerIndex]
    const currentPlayer = game.players[currentPlayerId]

    if (game.phase === 'discard' && discardTarget) {
      const targetPlayer = game.players[discardTarget]
      if (!targetPlayer.isAI) return

      timerRef.current = setTimeout(() => {
        const selection = getAIDiscardSelection(game, discardTarget)
        for (const [res, amount] of Object.entries(selection) as [ResourceType, number][]) {
          for (let i = 0; i < amount; i++) {
            updateDiscardSelection(res, 1)
          }
        }
        setTimeout(() => {
          confirmDiscard()
        }, 200)
      }, AI_DELAY_MS)

      return () => { if (timerRef.current) clearTimeout(timerRef.current) }
    }

    if (game.phase === 'robber' && currentPlayer.isAI) {
      timerRef.current = setTimeout(() => {
        const tileId = getAIRobberTile(game, currentPlayerId)
        clickTile(tileId)
      }, AI_DELAY_MS)
      return () => { if (timerRef.current) clearTimeout(timerRef.current) }
    }

    if (game.activeTrade && !game.activeTrade.toPlayerId) {
      const aiResponders = game.playerOrder.filter(
        pid => pid !== game.activeTrade!.fromPlayerId && game.players[pid].isAI
      )
      if (aiResponders.length > 0) {
        timerRef.current = setTimeout(() => {
          const trade = useGameStore.getState().game?.activeTrade
          if (!trade) return

          for (const aiId of aiResponders) {
            const aiPlayer = game.players[aiId]
            const canAffordRequest = (Object.entries(trade.requesting) as [ResourceType, number][])
              .every(([r, amt]) => aiPlayer.resources[r] >= amt)

            if (canAffordRequest) {
              const gainValue = totalResources(trade.offering)
              const loseValue = totalResources(trade.requesting)
              if (gainValue >= loseValue) {
                const store = useGameStore.getState()
                if (store.game?.activeTrade) {
                  store.game.activeTrade.toPlayerId = aiId
                  store.respondTrade(true)
                }
                return
              }
            }
          }

          useGameStore.getState().respondTrade(false)
        }, AI_DELAY_MS)
        return () => { if (timerRef.current) clearTimeout(timerRef.current) }
      }
    }

    if (!currentPlayer.isAI) return

    if (game.phase === 'stealing') {
      timerRef.current = setTimeout(() => {
        const robberTile = game.tiles[game.robberTileId]
        if (!robberTile) return
        const adjVertices = Object.values(game.vertices).filter(
          v => v.hexIds.includes(robberTile.id) && v.building && v.building.playerId !== currentPlayerId
        )
        if (adjVertices.length > 0) {
          const victim = adjVertices[0].building!.playerId
          useGameStore.getState().stealResource(victim)
        }
      }, AI_DELAY_MS)
      return () => { if (timerRef.current) clearTimeout(timerRef.current) }
    }

    const action = getAIAction(game, currentPlayerId)
    if (!action) return

    timerRef.current = setTimeout(() => {
      switch (action.type) {
        case 'roll':
          rollDice()
          break
        case 'end_turn':
          endTurn()
          break
        case 'build_route':
          buildRoute(action.edgeId)
          break
        case 'build_outpost':
          buildOutpost(action.vertexId)
          break
        case 'build_base':
          buildBase(action.vertexId)
          break
        case 'buy_dev_card':
          buyDevCard()
          break
        case 'bank_trade':
          bankTrade(action.giving, action.receiving)
          break
        case 'play_soldier':
          playDevCard('soldier')
          break
        case 'play_road_building':
          playDevCard('road_building')
          break
        case 'setup_outpost':
          clickVertex(action.vertexId)
          break
        case 'setup_route':
          clickEdge(action.edgeId)
          break
      }
    }, AI_DELAY_MS)

    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [
    game,
    discardTarget, isMultiplayer, localPlayerId,
    rollDice, endTurn, buildRoute, buildOutpost, buildBase,
    buyDevCard, bankTrade, playDevCard, clickVertex, clickEdge, clickTile,
    updateDiscardSelection, confirmDiscard, respondTrade,
  ])
}
