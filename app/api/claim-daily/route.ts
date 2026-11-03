import { NextRequest, NextResponse } from 'next/server'
import { kv } from '@vercel/kv'

export async function POST(req: NextRequest) {
    try {
        const { userId } = await req.json()
        if (!userId) return NextResponse.json({ error: 'userId обязателен' }, { status: 400 })

        const userIdStr = userId.toString()
        const lastClaimKey = `lastClaim:${userIdStr}`
        const lastClaim = await kv.get<number>(lastClaimKey)
        const now = Date.now()

        if (lastClaim) {
            const hoursSinceLastClaim = (now - lastClaim) / (1000 * 60 * 60)
            if (hoursSinceLastClaim < 24) {
                const totalMinutesRemaining = (24 - hoursSinceLastClaim) * 60
                const hoursRemaining = Math.floor(totalMinutesRemaining / 60)
                const minutesRemaining = Math.floor(totalMinutesRemaining % 60)
                return NextResponse.json({
                    error: 'Already claimed',
                    message: `Уже забрали! Возвращайтесь через ${hoursRemaining}ч ${minutesRemaining}м`,
                }, { status: 400 })
            }
        }

        const dailyPoints = 100
        await kv.set(lastClaimKey, now)
        
        const scoreKey = `score:${userIdStr}`
        const current = (await kv.get<number>(scoreKey)) || 0
        const newBalance = current + dailyPoints
        await kv.set(scoreKey, newBalance)

        return NextResponse.json({
            success: true,
            points: dailyPoints,
            newBalance,
            message: `Вы получили ${dailyPoints} очков!`
        })
    } catch (error) {
        return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
    }
}

export async function GET(req: NextRequest) {
    const url = new URL(req.url)
    const userId = url.searchParams.get('userId')
    if (!userId) return NextResponse.json({ error: 'userId обязателен' }, { status: 400 })

    const lastClaim = await kv.get<number>(`lastClaim:${userId}`)
    const now = Date.now()

    if (!lastClaim) return NextResponse.json({ canClaim: true })

    const hoursSinceLastClaim = (now - lastClaim) / (1000 * 60 * 60)
    if (hoursSinceLastClaim >= 24) return NextResponse.json({ canClaim: true })

    const totalMinutesRemaining = (24 - hoursSinceLastClaim) * 60
    const hoursRemaining = Math.floor(totalMinutesRemaining / 60)
    const minutesRemaining = Math.floor(totalMinutesRemaining % 60)

    return NextResponse.json({
        canClaim: false,
        hoursRemaining,
        minutesRemaining
    })
}
