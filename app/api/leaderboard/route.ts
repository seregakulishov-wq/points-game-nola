import { NextResponse } from 'next/server'
import { kv } from '@vercel/kv'

export async function GET() {
    try {
        // Получаем топ-10 игроков с их очками
        // @ts-ignore - используем sorted set команду
        const topPlayers = await kv.zrange('leaderboard', 0, 9, { rev: true, withScores: true })

        // Преобразуем плоский массив [player1, score1, player2, score2...] в объекты
        const players = []
        for (let i = 0; i < topPlayers.length; i += 2) {
            players.push({
                userId: topPlayers[i],
                score: Number(topPlayers[i + 1])
            })
        }

        return NextResponse.json({ players })
    } catch (error) {
        console.error('Leaderboard error:', error)
        return NextResponse.json({ players: [] })
    }
}
