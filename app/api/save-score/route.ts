import { NextRequest, NextResponse } from 'next/server'

const userScores = new Map<string, number>()

export async function POST(req: NextRequest) {
    try {
        const { userId, score } = await req.json()

        if (!userId || typeof score !== 'number') {
            return NextResponse.json({ error: 'userId и score обязательны' }, { status: 400 })
        }

        const userIdStr = userId.toString()
        const current = userScores.get(userIdStr) || 0
        const newBalance = current + score
        userScores.set(userIdStr, newBalance)

        return NextResponse.json({
            success: true,
            earned: score,
            newBalance: newBalance
        })
    } catch (error) {
        return NextResponse.json({ error: 'Failed to save score' }, { status: 500 })
    }
}

export async function GET(req: NextRequest) {
    const url = new URL(req.url)
    const userId = url.searchParams.get('userId')

    if (!userId) {
        return NextResponse.json({ error: 'userId обязателен' }, { status: 400 })
    }

    const current = userScores.get(userId.toString()) || 0
    return NextResponse.json({ balance: current })
          }
