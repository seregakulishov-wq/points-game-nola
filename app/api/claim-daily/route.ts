import { NextRequest, NextResponse } from 'next/server'

// Общее хранилище очков (должно быть общим с save-score!)
// В идеале — вынести в отдельный файл, но для простоты дублируем
const userScores = new Map<string, number>()
const lastClaimTimes = new Map<string, number>()

export async function POST(req: NextRequest) {
    try {
        const { userId } = await req.json()

        if (!userId) {
            return NextResponse.json({ error: 'userId обязателен' }, { status: 400 })
        }

        const userIdStr = userId.toString()
        const now = Date.now()
        const lastClaim = lastClaimTimes.get(userIdStr)

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

        // Начисляем 100 очков
        const dailyPoints = 100
        lastClaimTimes.set(userIdStr, now)
        
        const current = userScores.get(userIdStr) || 0
        const newBalance = current + dailyPoints
        userScores.set(userIdStr, newBalance)

        return NextResponse.json({
            success: true,
            points: dailyPoints,
            newBalance: newBalance,
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

    const userIdStr = userId.toString()
    const lastClaim = lastClaimTimes.get(userIdStr)
    const now = Date.now()

    if (!lastClaim) {
        return NextResponse.json({ canClaim: true })
    }

    const hoursSinceLastClaim = (now - lastClaim) / (1000 * 60 * 60)
    const canClaim = hoursSinceLastClaim >= 24

    if (canClaim) {
        return NextResponse.json({ canClaim: true })
    }

    const totalMinutesRemaining = (24 - hoursSinceLastClaim) * 60
    const hoursRemaining = Math.floor(totalMinutesRemaining / 60)
    const minutesRemaining = Math.floor(totalMinutesRemaining % 60)

    return NextResponse.json({
        canClaim: false,
        hoursRemaining,
        minutesRemaining
    })
}