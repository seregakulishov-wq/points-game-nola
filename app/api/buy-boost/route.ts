import { NextRequest, NextResponse } from 'next/server'
import { kv } from '@vercel/kv'

export async function POST(req: NextRequest) {
    try {
        const { userId, boostType } = await req.json()
        if (!userId || !boostType) {
            return NextResponse.json({ error: 'userId и boostType обязательны' }, { status: 400 })
        }

        const userIdStr = userId.toString()
        const now = Date.now()
        
        // Проверяем, есть ли уже активный буст
        const existingBoost = await kv.get<number>(`boost:${userIdStr}`)
        if (existingBoost && existingBoost > now) {
            return NextResponse.json({ error: 'Буст уже активен' }, { status: 400 })
        }

        // Устанавливаем буст на 5 минут (300000 мс)
        const boostEnd = now + 5 * 60 * 1000
        await kv.set(`boost:${userIdStr}`, boostEnd)

        return NextResponse.json({
            success: true,
            boostEnd,
            message: 'Буст активирован! x2 очков на 5 минут.'
        })
    } catch (error) {
        return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
    }
}

export async function GET(req: NextRequest) {
    const url = new URL(req.url)
    const userId = url.searchParams.get('userId')
    if (!userId) return NextResponse.json({ error: 'userId обязателен' }, { status: 400 })

    const boostEnd = await kv.get<number>(`boost:${userId}`)
    const now = Date.now()
    
    if (boostEnd && boostEnd > now) {
        const minutesLeft = Math.ceil((boostEnd - now) / 60000)
        return NextResponse.json({ active: true, minutesLeft })
    }
    
    return NextResponse.json({ active: false })
}
