import { NextRequest, NextResponse } from 'next/server'
import { kv } from '@vercel/kv'

export async function POST(req: NextRequest) {
    try {
        const { userId } = await req.json()
        if (!userId) return NextResponse.json({ error: 'userId обязателен' }, { status: 400 })

        const userIdStr = userId.toString()
        // Проверяем, есть ли активный буст времени
        const existing = await kv.get<number>(`timeboost:${userIdStr}`)
        const now = Date.now()
        if (existing && existing > now) {
            return NextResponse.json({ error: 'Буст времени уже активен' }, { status: 400 })
        }

        // Активируем буст на 10 секунд
        const boostEnd = now + 10 * 1000
        await kv.set(`timeboost:${userIdStr}`, boostEnd)

        return NextResponse.json({ success: true, boostEnd, message: '+10 секунд к таймеру!' })
    } catch (error) {
        return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
    }
}

export async function GET(req: NextRequest) {
    const url = new URL(req.url)
    const userId = url.searchParams.get('userId')
    if (!userId) return NextResponse.json({ error: 'userId обязателен' }, { status: 400 })

    const boostEnd = await kv.get<number>(`timeboost:${userId}`)
    const now = Date.now()
    if (boostEnd && boostEnd > now) {
        return NextResponse.json({ active: true, secondsLeft: Math.ceil((boostEnd - now) / 1000) })
    }
    return NextResponse.json({ active: false })
}
