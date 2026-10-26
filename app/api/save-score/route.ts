import { NextRequest, NextResponse } from 'next/server'

// Временное хранилище (в проде — база данных)
const userScores = new Map<string, number>()

export async function POST(req: NextRequest) {
    try {
        const { userId, score } = await req.json()

        if (!userId || typeof score !== 'number') {
            return NextResponse.json({ error: 'userId и score обязательны' }, { status: 400 })
        }

        const userIdStr = userId.toString()
        const current = userScores.get(userIdStr) || 0
        userScores.set(userIdStr, current + score)

        console.log(`
    ✅ Score Saved
    ==============
    User ID: ${userId}
    Earned: ${score}
    New balance: ${current + score}
        `)

        return NextResponse.json({
            success: true,
            earned: score,
            newBalance: current + score
        })
    } catch (error) {
        console.error('Save score error:', error)
        return NextResponse.json({ error: 'Failed to save score' }, { status: 500 })
    }
}
