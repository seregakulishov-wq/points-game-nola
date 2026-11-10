import { NextRequest, NextResponse } from 'next/server'

// Store payment receipts for refunds (in production, use a database)
const paymentReceipts = new Map<string, any>()

export async function POST(req: NextRequest) {
    const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!
    const APP_URL = process.env.NEXT_PUBLIC_APP_URL!

    try {
        const update = await req.json()

        // Handle pre-checkout query (payment confirmation)
        if (update.pre_checkout_query) {
            const query = update.pre_checkout_query

            // Always approve in this demo
            await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerPreCheckoutQuery`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    pre_checkout_query_id: query.id,
                    ok: true
                })
            })

            return NextResponse.json({ ok: true })
        }

        // Handle successful payment
        if (update.message?.successful_payment) {
            const payment = update.message.successful_payment
            const userId = update.message.from.id
            const payload = JSON.parse(payment.invoice_payload)

            // Store payment receipt
            paymentReceipts.set(payment.telegram_payment_charge_id, {
                userId,
                amount: payload.amount,
                price: payload.price,
                timestamp: Date.now()
            })

            // Send confirmation message
            await sendTelegramMessage(
                userId,
                `✅ *Payment Successful!*\n\n` +
                `You purchased *${payload.amount.toLocaleString()} points* for *${payload.price} Stars*!\n\n` +
                `Receipt ID: \`${payment.telegram_payment_charge_id}\`\n\n` +
                `_To test refunds, use:_\n` +
                `\`/refund ${payment.telegram_payment_charge_id}\``,
                { parse_mode: 'Markdown' }
            )

            return NextResponse.json({ ok: true })
        }

        // Handle /refund command
        if (update.message?.text?.startsWith('/refund')) {
            const parts = update.message.text.split(' ')
            const receiptId = parts[1]
            const userId = update.message.from.id

            if (!receiptId) {
                await sendTelegramMessage(
                    userId,
                    '❌ Please provide a receipt ID:\n`/refund YOUR_RECEIPT_ID`',
                    { parse_mode: 'Markdown' }
                )
                return NextResponse.json({ ok: true })
            }

            // Check if receipt exists
            const payment = paymentReceipts.get(receiptId)
            if (!payment) {
                await sendTelegramMessage(
                    userId,
                    '❌ Receipt not found. Make sure you copied the correct ID.',
                    { parse_mode: 'Markdown' }
                )
                return NextResponse.json({ ok: true })
            }

            // Check if user owns this payment
            if (payment.userId !== userId) {
                await sendTelegramMessage(
                    userId,
                    '❌ This receipt does not belong to you.',
                    { parse_mode: 'Markdown' }
                )
                return NextResponse.json({ ok: true })
            }

            // Process refund
            const refundResponse = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/refundStarPayment`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: userId,
                    telegram_payment_charge_id: receiptId
                })
            })

            const refundData = await refundResponse.json()

            if (refundData.ok) {
                // Remove from receipts
                paymentReceipts.delete(receiptId)

                await sendTelegramMessage(
                    userId,
                    `✅ *Refund Successful!*\n\n` +
                    `Your *${payment.price} Stars* have been refunded.\n\n` +
                    `_Thank you for testing the payment system!_`,
                    { parse_mode: 'Markdown' }
                )
            } else {
                await sendTelegramMessage(
                    userId,
                    `❌ Refund failed: ${refundData.description || 'Unknown error'}`,
                    { parse_mode: 'Markdown' }
                )
            }

            return NextResponse.json({ ok: true })
        }

        // Handle /start command (with optional referral: /start ref_<userId>)
        if (update.message?.text?.startsWith('/start')) {
            const parts = update.message.text.split(' ')
            const param = parts[1] // e.g. "ref_123456"
            const newUserId = update.message.from.id

            let webAppUrl = APP_URL
            if (param?.startsWith('ref_')) {
                // Pass the referral param through to the Mini App
                webAppUrl = `${APP_URL}?startapp=${param}`
            }

            await sendTelegramMessage(
                update.message.chat.id,
                '🎮 *Welcome to Combo Game!*\n\n' +
                'Collect points and compete with friends!\n\n' +
                '🎁 Daily rewards\n' +
                '💎 Buy boosts with Stars\n' +
                '👥 Invite friends and earn +500 points\n\n' +
                'Tap the button below to play!',
                {
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [[
                            { text: '🎮 Play Game', web_app: { url: webAppUrl } }
                        ]]
                    }
                }
            )
        }

        // Handle /help command
        if (update.message?.text === '/help') {
            const result = await sendTelegramMessage(
                update.message.chat.id,
                '❓ *How to Play*\n\n' +
                '1️⃣ Open the game from the button\n' +
                '2️⃣ Claim daily points\n' +
                '3️⃣ Buy more points with Stars\n' +
                '4️⃣ Test refunds with receipt ID\n\n' +
                '*Commands:*\n' +
                '/start - Start the game\n' +
                '/help - Show this help\n' +
                '/refund RECEIPT\\_ID - Refund a payment',  // Escaped underscore
                { parse_mode: 'Markdown' }
            )
        }

        return NextResponse.json({ ok: true })
    } catch (error) {
        console.error('Webhook error:', error)
        return NextResponse.json({ error: 'Error' }, { status: 500 })
    }
}

async function sendTelegramMessage(chatId: number, text: string, extra?: any) {
    const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!

    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: chatId,
            text,
            ...extra
        })
    })

    const data = await response.json()

    if (!data.ok) {
        console.error('Telegram API error:', data)
    }

    return data
}