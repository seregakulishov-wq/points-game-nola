import { NextRequest, NextResponse } from 'next/server'
import { kv } from '@vercel/kv'

export async function POST(req: NextRequest) {
    try {
        const { userId } = await req.json()
        if (!userId) return NextResponse.json({ error: 'userId обязателен' }, { status: 400 })

        const userIdStr = userId.toString()
        const existing = await kv.get<number>(`comboboost:${userIdStr}`)
        const now = Date.now()
        if (existing && existing > now) {
            return NextResponse.json({ error: 'Буст комбо уже активен' }, { status: 400 })
        }

        // Активируем на 5 минут
        const boostEnd = now + 5 * 60 * 1000
        await kv.set(`comboboost:${userIdStr}`, boostEnd)

        return NextResponse.json({ success: true, boostEnd, message: '+50% к комбо на 5 минут!' })
    } catch (error) {
        return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
    }
}

export async function GET(req: NextRequest) {
    const url = new URL(req.url)
    const userId = url.searchParams.get('userId')
    if (!userId) return NextResponse.json({ error: 'userId обязателен' }, { status: 400 })

    const boostEnd = await kv.get<number>(`comboboost:${userId}`)
    const now = Date.now()
    if (boostEnd && boostEnd > now) {
        return NextResponse.json({ active: true, minutesLeft: Math.ceil((boostEnd - now) / 60000) })
    }
    return NextResponse.json({ active: false })
}
