import { NextResponse } from 'next/server'
import { kv } from '@vercel/kv'

export async function GET() {
    try {
        // @ts-ignore
        const topPlayers = await kv.zrange('leaderboard', 0, 9, { rev: true, withScores: true })

        const players = []
        for (let i = 0; i < topPlayers.length; i += 2) {
            const userId = topPlayers[i] as string
            const score = Number(topPlayers[i + 1])
            
            // Получаем имя игрока
            const name = (await kv.get<string>(`name:${userId}`)) || `ID: ${userId}`

            players.push({ userId, name, score })
        }

        return NextResponse.json({ players })
    } catch (error) {
        console.error('Leaderboard error:', error)
        return NextResponse.json({ players: [] })
    }
}
