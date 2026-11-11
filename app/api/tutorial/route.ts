import { NextRequest, NextResponse } from 'next/server'
import { kv } from '@vercel/kv'

export async function GET(req: NextRequest) {
    const url = new URL(req.url)
    const userId = url.searchParams.get('userId')
    if (!userId) return NextResponse.json({ error: 'userId обязателен' }, { status: 400 })

    const seen = (await kv.get<boolean>(`tutorialSeen:${userId}`)) || false
    return NextResponse.json({ seen })
}

export async function POST(req: NextRequest) {
    try {
        const { userId } = await req.json()
        if (!userId) return NextResponse.json({ error: 'userId обязателен' }, { status: 400 })

        await kv.set(`tutorialSeen:${userId}`, true)
        return NextResponse.json({ success: true })
    } catch (error) {
        return NextResponse.json({ error: 'Failed to save tutorial flag' }, { status: 500 })
    }
}
