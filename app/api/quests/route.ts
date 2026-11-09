import { NextRequest, NextResponse } from 'next/server'
import { kv } from '@vercel/kv'

// Список возможных квестов
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
    const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD
    
    // Получаем текущий квест на сегодня
    const questKey = `dailyQuest:${userIdStr}:${today}`
    let questId = await kv.get<string>(questKey)
    
    if (!questId) {
        // Выбираем случайный квест
        const randomQuest = QUESTS[Math.floor(Math.random() * QUESTS.length)]
        questId = randomQuest.id
        await kv.set(questKey, questId)
    }

    const quest = QUESTS.find(q => q.id === questId)!
    
    // Получаем прогресс
    const progressKey = `questProgress:${userIdStr}:${today}`
    const progress = (await kv.get<number>(progressKey)) || 0
    
    // Получаем статус выполнения
    const completedKey = `questCompleted:${userIdStr}:${today}`
    const isCompleted = (await kv.get<boolean>(completedKey)) || false

    return NextResponse.json({ quest, progress, isCompleted })
}

export async function POST(req: NextRequest) {
    try {
        const { userId, questType, value } = await req.json()
        if (!userId) return NextResponse.json({ error: 'userId обязателен' }, { status: 400 })

        const userIdStr = userId.toString()
        const today = new Date().toISOString().split('T')[0]
        
        const questKey = `dailyQuest:${userIdStr}:${today}`
        const questId = await kv.get<string>(questKey)
        if (!questId) return NextResponse.json({ error: 'Квест не найден' }, { status: 400 })

        const quest = QUESTS.find(q => q.id === questId)!
        
        // Обновляем прогресс в зависимости от типа
        const progressKey = `questProgress:${userIdStr}:${today}`
        let currentProgress = (await kv.get<number>(progressKey)) || 0

        if (quest.type === 'rounds') {
            currentProgress += value; // value = +1 за раунд
        } else if (quest.type === 'score') {
            if (value > currentProgress) currentProgress = value; // value = счёт за раунд
        } else if (quest.type === 'combo') {
            if (value > currentProgress) currentProgress = value; // value = комбо
        }

        await kv.set(progressKey, currentProgress)

        // Проверяем выполнение
        let isCompleted = (await kv.get<boolean>(`questCompleted:${userIdStr}:${today}`)) || false
        
        if (currentProgress >= quest.target && !isCompleted) {
            await kv.set(`questCompleted:${userIdStr}:${today}`, true)
            
            // Начисляем награду
            const currentBalance = (await kv.get<number>(`score:${userIdStr}`)) || 0
            const newBalance = currentBalance + quest.reward
            await kv.set(`score:${userIdStr}`, newBalance)
            // @ts-ignore
            await kv.zadd('leaderboard', { score: newBalance, member: userIdStr })

            return NextResponse.json({ success: true, completed: true, reward: quest.reward, newBalance })
        }

        return NextResponse.json({ success: true, completed: false, progress: currentProgress })
    } catch (error) {
        return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
    }
}
