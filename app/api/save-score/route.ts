import { NextRequest, NextResponse } from 'next/server'
import { kv } from '@vercel/kv'

export async function POST(req: NextRequest) {
    try {
        const { userId, score, firstName } = await req.json()
        if (!userId || typeof score !== 'number') {
            return NextResponse.json({ error: 'userId и score обязательны' }, { status: 400 })
        }

        const userIdStr = userId.toString()
        const now = Date.now()
        const lastLoginKey = `lastLogin:${userIdStr}`
        const lastLogin = await kv.get<number>(lastLoginKey)
        
        let dailyBonus = 0
        let streak = 0

        // Проверяем ежедневный вход (раз в 24 часа)
        if (!lastLogin || (now - lastLogin) > 24 * 60 * 60 * 1000) {
            // Если заходил вчера или сегодня первый раз — даем бонус
            const lastStreakKey = `streak:${userIdStr}`
            const currentStreak = await kv.get<number>(lastStreakKey) || 0
            
            // Проверяем, был ли он вчера (в пределах 48 часов)
            if (lastLogin && (now - lastLogin) < 48 * 60 * 60 * 1000) {
                streak = currentStreak + 1
            } else {
                streak = 1
            }
            
            // Бонус растет с каждым днем: 50, 100, 150, 200, 250 (макс)
            dailyBonus = Math.min(50 * streak, 250)
            
            await kv.set(lastLoginKey, now)
            await kv.set(lastStreakKey, streak)
        } else {
            // Если заходил меньше 24 часов назад, просто берем текущий стрик
            streak = await kv.get<number>(`streak:${userIdStr}`) || 1
        }

        // Проверяем буст
        const boostEnd = await kv.get<number>(`boost:${userIdStr}`)
        const hasBoost = boostEnd && boostEnd > now
        const finalScore = (hasBoost ? score * 2 : score) + dailyBonus

        const current = (await kv.get<number>(`score:${userIdStr}`)) || 0
        const newBalance = current + finalScore
        await kv.set(`score:${userIdStr}`, newBalance)

        if (firstName) {
            await kv.set(`name:${userIdStr}`, firstName)
        }

        // @ts-ignore
        await kv.zadd('leaderboard', { score: newBalance, member: userIdStr })

        return NextResponse.json({ 
            success: true, 
            earned: finalScore, 
            newBalance,
            boostApplied: hasBoost,
            dailyBonus,
            streak
        })
    } catch (error) {
        return NextResponse.json({ error: 'Failed to save score' }, { status: 500 })
    }
}

export async function GET(req: NextRequest) {
    const url = new URL(req.url)
    const userId = url.searchParams.get('userId')
    if (!userId) return NextResponse.json({ error: 'userId обязателен' }, { status: 400 })

    const current = (await kv.get<number>(`score:${userId}`)) || 0
    const streak = (await kv.get<number>(`streak:${userId}`)) || 0
    return NextResponse.json({ balance: current, streak })
}