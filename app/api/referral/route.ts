import { NextRequest, NextResponse } from 'next/server'
import { kv } from '@vercel/kv'

const REFERRER_BONUS = 500
const REFEREE_BONUS = 200

export async function POST(req: NextRequest) {
    try {
        const { userId, referrerId } = await req.json()

        if (!userId || !referrerId) {
            return NextResponse.json({ error: 'userId and referrerId are required' }, { status: 400 })
        }

        const userIdStr = userId.toString()
        const referrerIdStr = referrerId.toString()

        if (userIdStr === referrerIdStr) {
            return NextResponse.json({ error: 'Cannot refer yourself' }, { status: 400 })
        }

        // Check if this user was already referred
        const alreadyReferred = await kv.get<boolean>(`referred:${userIdStr}`)
        if (alreadyReferred) {
            return NextResponse.json({ error: 'Already referred', alreadyReferred: true }, { status: 400 })
        }

        // Mark user as referred (no expiry — permanent)
        await kv.set(`referred:${userIdStr}`, true)

        // Credit points to both users
        const referrerBalance = (await kv.get<number>(`score:${referrerIdStr}`)) || 0
        const refereeBalance = (await kv.get<number>(`score:${userIdStr}`)) || 0

        const newReferrerBalance = referrerBalance + REFERRER_BONUS
        const newRefereeBalance = refereeBalance + REFEREE_BONUS

        await kv.set(`score:${referrerIdStr}`, newReferrerBalance)
        await kv.set(`score:${userIdStr}`, newRefereeBalance)

        // Keep leaderboard in sync
        // @ts-ignore
        await kv.zadd('leaderboard', { score: newReferrerBalance, member: referrerIdStr })
        // @ts-ignore
        await kv.zadd('leaderboard', { score: newRefereeBalance, member: userIdStr })

        // Notify referrer via bot
        const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
        if (BOT_TOKEN) {
            fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: referrerIdStr,
                    text: `🎉 A friend joined using your referral link!\n\nYou earned +${REFERRER_BONUS} bonus points!`
                })
            }).catch(() => {})
        }

        console.log(`
✅ Referral processed
=====================
New user:  ${userIdStr}  (+${REFEREE_BONUS} pts)
Referrer:  ${referrerIdStr}  (+${REFERRER_BONUS} pts)
        `)

        return NextResponse.json({
            success: true,
            refereeBonus: REFEREE_BONUS,
            referrerBonus: REFERRER_BONUS
        })
    } catch (error) {
        console.error('Referral error:', error)
        return NextResponse.json({ error: 'Failed to process referral' }, { status: 500 })
    }
}
