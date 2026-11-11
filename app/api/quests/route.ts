import { NextRequest, NextResponse } from 'next/server'
import { kv } from '@vercel/kv'

const QUESTS = [
    { id: 'rounds3', title: 'Сыграй 3 раунда', reward: 500, type: 'rounds', target: 3 },
    { id: 'score5000', title: 'Набери 5000 очков за раунд', reward: 1000, type: 'score', target: 5000 },
    { id: 'score10000', title: 'Набери 10000 очков за раунд', reward: 2000, type: 'score', target: 10000 },
    { id: 'combo10', title: 'Достигни комбо 10', reward: 700, type: 'combo', target: 10 },
    { id: 'rounds5', title: 'Сыграй 5 раундов', reward: 800, type: 'rounds', target: 5 },
]

export async function GET(req: NextRequest) {
    const url = new URL(req.url)
    const userId = url.searchParams.get('userId')
    if (!userId) return NextResponse.json({ error: 'userId обязателен' }, { status: 400 })

    const userIdStr = userId.toString()
    const today = new Date().toISOString().split('T')[0]

    const questKey = `selectedQuest:${userIdStr}:${today}`
    const questId = await kv.get<string>(questKey)

    // Игрок ещё не выбрал квест на сегодня — предлагаем 3 случайных варианта
    if (!questId) {
        const shuffled = [...QUESTS].sort(() => Math.random() - 0.5)
        const choices = shuffled.slice(0, 3)
        return NextResponse.json({ choices })
    }

    const quest = QUESTS.find(q => q.id === questId)!
    const progressKey = `questProgress:${userIdStr}:${today}`
    const progress = (await kv.get<number>(progressKey)) || 0
    const completedKey = `questCompleted:${userIdStr}:${today}`
    const isCompleted = (await kv.get<boolean>(completedKey)) || false

    return NextResponse.json({ quest, progress, isCompleted })
}

export async function POST(req: NextRequest) {
    try {
        const { userId, action, questId: selectedQuestId, questType, value } = await req.json()
        if (!userId) return NextResponse.json({ error: 'userId обязателен' }, { status: 400 })

        const userIdStr = userId.toString()
        const today = new Date().toISOString().split('T')[0]
        const questKey = `selectedQuest:${userIdStr}:${today}`

        // Выбор квеста на сегодня
        if (action === 'select') {
            if (!selectedQuestId || !QUESTS.find(q => q.id === selectedQuestId)) {
                return NextResponse.json({ error: 'Неверный квест' }, { status: 400 })
            }
            const existing = await kv.get<string>(questKey)
            if (existing) return NextResponse.json({ error: 'Квест уже выбран' }, { status: 400 })
            await kv.set(questKey, selectedQuestId)
            return NextResponse.json({ success: true, quest: QUESTS.find(q => q.id === selectedQuestId) })
        }

        const questId = await kv.get<string>(questKey)
        if (!questId) return NextResponse.json({ error: 'Квест не найден' }, { status: 400 })

        const quest = QUESTS.find(q => q.id === questId)!
        const progressKey = `questProgress:${userIdStr}:${today}`
        let currentProgress = (await kv.get<number>(progressKey)) || 0

        if (quest.type === 'rounds') {
            currentProgress += value
        } else if (quest.type === 'score') {
            if (value > currentProgress) currentProgress = value
        } else if (quest.type === 'combo') {
            if (value > currentProgress) currentProgress = value
        }

        await kv.set(progressKey, currentProgress)

        // Только обновляем прогресс, НЕ ставим completed
        return NextResponse.json({ success: true, progress: currentProgress })
    } catch (error) {
        return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
    }
}

// Отдельный эндпоинт для получения награды
export async function PUT(req: NextRequest) {
    try {
        const { userId } = await req.json()
        if (!userId) return NextResponse.json({ error: 'userId обязателен' }, { status: 400 })

        const userIdStr = userId.toString()
        const today = new Date().toISOString().split('T')[0]
        const questKey = `selectedQuest:${userIdStr}:${today}`
        const questId = await kv.get<string>(questKey)
        if (!questId) return NextResponse.json({ error: 'Квест не найден' }, { status: 400 })

        const quest = QUESTS.find(q => q.id === questId)!
        const progressKey = `questProgress:${userIdStr}:${today}`
        const progress = (await kv.get<number>(progressKey)) || 0
        const completedKey = `questCompleted:${userIdStr}:${today}`
        const isCompleted = (await kv.get<boolean>(completedKey)) || false

        if (progress < quest.target) return NextResponse.json({ error: 'Квест не выполнен' }, { status: 400 })
        if (isCompleted) return NextResponse.json({ error: 'Награда уже получена' }, { status: 400 })

        await kv.set(completedKey, true)

        const currentBalance = (await kv.get<number>(`score:${userIdStr}`)) || 0
        const newBalance = currentBalance + quest.reward
        await kv.set(`score:${userIdStr}`, newBalance)
        // @ts-ignore
        await kv.zadd('leaderboard', { score: newBalance, member: userIdStr })

        return NextResponse.json({ success: true, reward: quest.reward, newBalance })
    } catch (error) {
        return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
    }
}