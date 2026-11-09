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

        // Ежедневный вход
        if (!lastLogin || (now - lastLogin) > 24 * 60 * 60 * 1000) {
            const lastStreakKey = `streak:${userIdStr}`
            const currentStreak = await kv.get<number>(lastStreakKey) || 0
            if (lastLogin && (now - lastLogin) < 48 * 60 * 60 * 1000) {
                streak = currentStreak + 1
            } else {
                streak = 1
            }
            dailyBonus = Math.min(50 * streak, 250)
            await kv.set(lastLoginKey, now)
            await kv.set(lastStreakKey, streak)
        } else {
            streak = await kv.get<number>(`streak:${userIdStr}`) || 1
        }

        // Проверяем бусты
        const boostEnd = await kv.get<number>(`boost:${userIdStr}`)
        const hasBoost = boostEnd && boostEnd > now
        
        const comboBoostEnd = await kv.get<number>(`comboboost:${userIdStr}`)
        const hasComboBoost = comboBoostEnd && comboBoostEnd > now

        // Применяем буст к очкам за раунд
        let roundScore = score
        if (hasComboBoost) {
            roundScore = Math.floor(roundScore * 1.5)
        }
        if (hasBoost) {
            roundScore = roundScore * 2
        }

        const finalScore = roundScore + dailyBonus

        const current = (await kv.get<number>(`score:${userIdStr}`)) || 0
        const newBalance = current + finalScore
        await kv.set(`score:${userIdStr}`, newBalance)

        // Статистика
        const totalRoundsKey = `totalRounds:${userIdStr}`
        const bestRoundKey = `bestRound:${userIdStr}`
        const totalRounds = (await kv.get<number>(totalRoundsKey)) || 0
        await kv.set(totalRoundsKey, totalRounds + 1)
        const bestRound = (await kv.get<number>(bestRoundKey)) || 0
        if (score > bestRound) await kv.set(bestRoundKey, score)

        if (firstName) await kv.set(`name:${userIdStr}`, firstName)

        // @ts-ignore
        await kv.zadd('leaderboard', { score: newBalance, member: userIdStr })

        // Достижения (проверяем только если они ещё не получены)
        const newAchievements: string[] = []
        if (totalRounds + 1 >= 1 && !(await kv.get(`ach:firstRound:${userIdStr}`))) {
            newAchievements.push("Первый раунд!");
            await kv.set(`ach:firstRound:${userIdStr}`, 1);
        }
        if (newBalance >= 10000 && !(await kv.get(`ach:10k:${userIdStr}`))) {
            newAchievements.push("10 000 очков!");
            await kv.set(`ach:10k:${userIdStr}`, 1);
        }
        // @ts-ignore
        const top1 = await kv.zrange('leaderboard', 0, 0, { rev: true });
        if (top1[0] === userIdStr && !(await kv.get(`ach:top1:${userIdStr}`))) {
            newAchievements.push("Топ-1 в лидерборде!");
            await kv.set(`ach:top1:${userIdStr}`, 1);
        }

        let achBonus = 0;
        if (newAchievements.length > 0) {
            achBonus = newAchievements.length * 100;
            const updatedBalance = newBalance + achBonus;
            await kv.set(`score:${userIdStr}`, updatedBalance);
            // @ts-ignore
            await kv.zadd('leaderboard', { score: updatedBalance, member: userIdStr });
            
            return NextResponse.json({ 
                success: true, 
                earned: finalScore, 
                newBalance: updatedBalance,
                boostApplied: hasBoost,
                comboBoostApplied: hasComboBoost,
                dailyBonus,
                streak,
                achievements: newAchievements,
                achBonus
            })
        }

        return NextResponse.json({ 
            success: true, 
            earned: finalScore, 
            newBalance,
            boostApplied: hasBoost,
            comboBoostApplied: hasComboBoost,
            dailyBonus,
            streak,
            achievements: [],
            achBonus: 0
        })
    } catch (error) {
        return NextResponse.json({ error: 'Failed to save score' }, { status: 500 })
    }
}

export async function GET(req: NextRequest) {
    const url = new URL(req.url)
    const userId = url.searchParams.get('userId')
    if (!userId) return NextResponse.json({ error: 'userId обязателен' }, { status: 400 })

    const userIdStr = userId.toString()
    const balance = (await kv.get<number>(`score:${userIdStr}`)) || 0
    const streak = (await kv.get<number>(`streak:${userIdStr}`)) || 0
    const totalRounds = (await kv.get<number>(`totalRounds:${userIdStr}`)) || 0
    const bestRound = (await kv.get<number>(`bestRound:${userIdStr}`)) || 0
    const name = (await kv.get<string>(`name:${userIdStr}`)) || `ID: ${userIdStr}`

    return NextResponse.json({ balance, streak, totalRounds, bestRound, name })
}