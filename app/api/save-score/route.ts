import { NextRequest, NextResponse } from 'next/server'
import { kv } from '@vercel/kv'

export async function POST(req: NextRequest) {
    try {
        const { userId, score, firstName } = await req.json()
        if (!userId || typeof score !== 'number') {
            return NextResponse.json({ error: 'userId и score обязательны' }, { status: 400 })
        }

        const userIdStr = userId.toString()
        const current = (await kv.get<number>(`score:${userIdStr}`)) || 0
        const newBalance = current + score
        await kv.set(`score:${userIdStr}`, newBalance)

        // Сохраняем имя игрока (если передано)
        if (firstName) {
            await kv.set(`name:${userIdStr}`, firstName)
        }

        // Обновляем лидерборд
        // @ts-ignore
        await kv.zadd('leaderboard', { score: newBalance, member: userIdStr })

        return NextResponse.json({ success: true, earned: score, newBalance })
    } catch (error) {
        return NextResponse.json({ error: 'Failed to save score' }, { status: 500 })
    }
}

export async function GET(req: NextRequest) {
    const url = new URL(req.url)
    const userId = url.searchParams.get('userId')
    if (!userId) return NextResponse.json({ error: 'userId обязателен' }, { status: 400 })

    const current = (await kv.get<number>(`score:${userId}`)) || 0
    return NextResponse.json({ balance: current })
        }
