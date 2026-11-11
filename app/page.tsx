"use client";
import { useEffect, useState } from "react";

declare global {
  interface Window {
    Telegram?: any;
  }
}

export default function Home() {
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [target, setTarget] = useState(0);
  const [gameState, setGameState] = useState<"idle" | "playing" | "won">("idle");
  const [timeLeft, setTimeLeft] = useState(30);
  const [balance, setBalance] = useState(0);
  const [dailyState, setDailyState] = useState<"loading" | "available" | "claimed">("loading");
  const [dailyTimer, setDailyTimer] = useState("");
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [leaderboard, setLeaderboard] = useState<{ userId: string; name: string; score: number }[]>([]);
  const [boostActive, setBoostActive] = useState(false);
  const [boostMinutes, setBoostMinutes] = useState(0);
  const [comboBoostActive, setComboBoostActive] = useState(false);
  const [comboBoostMinutes, setComboBoostMinutes] = useState(0);
  const [roundsPlayed, setRoundsPlayed] = useState(0);
  const [timeBoostActive, setTimeBoostActive] = useState(false);
  const [timeBoostSeconds, setTimeBoostSeconds] = useState(0);
  const [streak, setStreak] = useState(0);
  const [profileData, setProfileData] = useState({ name: "", totalRounds: 0, bestRound: 0 });
  
  type Quest = { id: string; title: string; reward: number; type: string; target: number };
  const [quest, setQuest] = useState<Quest | null>(null);
  const [questChoices, setQuestChoices] = useState<Quest[]>([]);
  const [questProgress, setQuestProgress] = useState(0);
  const [questCompleted, setQuestCompleted] = useState(false);
  const [referralBonus, setReferralBonus] = useState<number | null>(null);
  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);

  // Игрок считается новичком, пока не сыграл ни одного раунда
  const hasPlayed = profileData.totalRounds > 0;

  const getUserId = () => window.Telegram?.WebApp?.initDataUnsafe?.user?.id || 1;
  const getFirstName = () => window.Telegram?.WebApp?.initDataUnsafe?.user?.first_name || "Игрок";

  const fetchData = () => {
    const userId = getUserId();
    fetch(`/api/save-score?userId=${userId}`).then(res => res.json()).then(data => {
      setBalance(data.balance || 0);
      setStreak(data.streak || 0);
      setProfileData({ name: data.name, totalRounds: data.totalRounds, bestRound: data.bestRound });
    });
    fetch(`/api/claim-daily?userId=${userId}`).then(res => res.json()).then(data => {
      if (data.canClaim) setDailyState("available");
      else { setDailyState("claimed"); setDailyTimer(`${data.hoursRemaining}ч ${data.minutesRemaining}м`); }
    });
    fetch('/api/leaderboard').then(res => res.json()).then(data => setLeaderboard(data.players || []));
    fetch(`/api/buy-boost?userId=${userId}`).then(res => res.json()).then(data => {
      if (data.active) { setBoostActive(true); setBoostMinutes(data.minutesLeft); }
    });
    fetch(`/api/buy-time?userId=${userId}`).then(res => res.json()).then(data => {
      if (data.active) { setTimeBoostActive(true); setTimeBoostSeconds(data.secondsLeft); }
    });
    fetch(`/api/buy-combo?userId=${userId}`).then(res => res.json()).then(data => {
      if (data.active) { setComboBoostActive(true); setComboBoostMinutes(data.minutesLeft); }
    });
    fetch(`/api/quests?userId=${userId}`).then(res => res.json()).then(data => {
      if (data.quest) {
        setQuest(data.quest);
        setQuestChoices([]);
        setQuestProgress(data.progress || 0);
        setQuestCompleted(data.isCompleted || false);
      } else if (data.choices) {
        setQuest(null);
        setQuestChoices(data.choices);
      }
    });
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      const check = setInterval(() => {
        if (window.Telegram?.WebApp) {
          window.Telegram.WebApp.ready();
          clearInterval(check);
          fetchData();

          // Онбординг: показываем при первом входе, если флаг ещё не сохранён
          const userId = getUserId();
          fetch(`/api/tutorial?userId=${userId}`).then(res => res.json()).then(data => {
            if (!data.seen) { setShowTutorial(true); setTutorialStep(0); }
          }).catch(() => {});

          // Handle referral: bot passes start_param=ref_<referrerId>
          const startParam: string | undefined = window.Telegram.WebApp.initDataUnsafe?.start_param;
          if (startParam?.startsWith("ref_")) {
            const referrerId = startParam.slice(4);
            const userId = window.Telegram.WebApp.initDataUnsafe?.user?.id;
            if (userId && referrerId && userId.toString() !== referrerId) {
              fetch("/api/referral", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId, referrerId }),
              })
                .then((res) => res.json())
                .then((data) => {
                  if (data.success) {
                    setReferralBonus(data.refereeBonus);
                    setBalance((prev) => prev + data.refereeBonus);
                  }
                })
                .catch(() => {});
            }
          }
        }
      }, 100);
      return () => clearInterval(check);
    }
  }, []);

  useEffect(() => {
    if (gameState === "playing" && timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    } else if (timeLeft === 0 && gameState === "playing") {
      setGameState("won");
      setRoundsPlayed(prev => prev + 1);
    }
  }, [gameState, timeLeft]);

  const startGame = () => { setScore(0); setCombo(0); setTimeLeft(30); setGameState("playing"); setTarget(Math.floor(Math.random() * 3)); };
  const newTarget = () => setTarget(Math.floor(Math.random() * 3));
  const handleClick = (index: number) => {
    if (gameState !== "playing") return;
    if (index === target) {
      const newCombo = combo + 1;
      setCombo(newCombo);
      let points = 10 * newCombo;
      if (comboBoostActive) points = Math.floor(points * 1.5);
      setScore(score + points);
      newTarget();
    } else { setGameState("won"); setRoundsPlayed(prev => prev + 1); }
  };

  const claimReward = async () => {
    try {
      const userId = getUserId();
      const firstName = getFirstName();
      const res = await fetch("/api/save-score", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId, score, firstName }) });
      const data = await res.json();
      if (res.ok) {
        setBalance(data.newBalance);
        setStreak(data.streak);
        
        // Обновляем прогресс квеста (только для текущего типа)
        if (quest) {
          if (quest.type === 'rounds') {
            await fetch("/api/quests", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ userId, questType: 'rounds', value: 1 })
            });
          } else if (quest.type === 'score') {
            await fetch("/api/quests", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ userId, questType: 'score', value: score })
            });
          } else if (quest.type === 'combo') {
            await fetch("/api/quests", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ userId, questType: 'combo', value: combo })
            });
          }
        }

        let msg = `✅ Вы заработали ${data.earned} очков! Общий баланс: ${data.newBalance}`;
        if (data.boostApplied) msg += ' (с бустом x2)';
        if (data.comboBoostApplied) msg += ' (с бустом комбо +50%)';
        if (data.dailyBonus > 0) msg += `\n🎁 Бонус за вход: +${data.dailyBonus} (День ${data.streak})`;
        if (data.achievements && data.achievements.length > 0) {
          msg += `\n\n🏆 Достижения:\n${data.achievements.join('\n')}\n+${data.achBonus} очков!`;
        }
        
        alert(msg);
        setGameState("idle"); setScore(0); setCombo(0);
        fetchData();
      } else { alert(`❌ Ошибка: ${data.error}`); }
    } catch (e) { alert("❌ Ошибка сети."); }
  };

  const claimDaily = async () => {
    try {
      const userId = getUserId();
      const res = await fetch("/api/claim-daily", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId }) });
      const data = await res.json();
      if (res.ok) {
        setBalance(data.newBalance);
        alert(`🎁 Вы получили 100 очков! Общий баланс: ${data.newBalance}`);
        setDailyState("claimed"); setDailyTimer("24ч 0м");
        fetchData();
      } else { alert(`❌ ${data.message || data.error}`); }
    } catch (e) { alert("❌ Ошибка сети."); }
  };

  const buyBoost = async () => {
    try {
      const userId = getUserId();
      const res = await fetch("/api/buy-boost", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId, boostType: 'x2' }) });
      const data = await res.json();
      if (res.ok) { setBoostActive(true); setBoostMinutes(5); alert(`🚀 Буст активирован! x2 очков на 5 минут.`); }
      else { alert(`❌ ${data.error}`); }
    } catch (e) { alert("❌ Ошибка сети."); }
  };

  const buyTimeBoost = async () => {
    try {
      const userId = getUserId();
      const res = await fetch("/api/buy-time", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId }) });
      const data = await res.json();
      if (res.ok) { 
        setTimeBoostActive(true); 
        setTimeBoostSeconds(10);
        setTimeLeft(prev => prev + 10);
        alert(`⏱️ +10 секунд к таймеру!`); 
      }
      else { alert(`❌ ${data.error}`); }
    } catch (e) { alert("❌ Ошибка сети."); }
  };

  const buyComboBoost = async () => {
    try {
      const userId = getUserId();
      const res = await fetch("/api/buy-combo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId }) });
      const data = await res.json();
      if (res.ok) { 
        setComboBoostActive(true); 
        setComboBoostMinutes(5);
        alert(`💥 Буст комбо активирован! +50% к очкам за комбо на 5 минут.`); 
      }
      else { alert(`❌ ${data.error}`); }
    } catch (e) { alert("❌ Ошибка сети."); }
  };

  const selectQuest = async (questId: string) => {
    try {
      const userId = getUserId();
      const res = await fetch("/api/quests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, action: 'select', questId })
      });
      const data = await res.json();
      if (res.ok) {
        fetchData();
      } else {
        alert(`❌ ${data.error}`);
      }
    } catch (e) { alert("❌ Ошибка сети."); }
  };

  const claimQuestReward = async () => {
    try {
      const userId = getUserId();
      const res = await fetch("/api/quests", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId })
      });
      const data = await res.json();
      if (res.ok) {
        setBalance(data.newBalance);
        alert(`🎁 Вы получили ${data.reward} очков за квест! Общий баланс: ${data.newBalance}`);
        fetchData();
      } else {
        alert(`❌ ${data.error}`);
      }
    } catch (e) { alert("❌ Ошибка сети."); }
  };

  const tutorialSlides = [
    {
      emoji: "👆",
      text: "Добро пожаловать в Combo Game! Нажимай на 👆, чтобы набирать очки. Чем больше комбо — тем больше очков.",
    },
    {
      emoji: "🚀",
      text: "За очки покупай бусты и выполняй квесты. Они дают ещё больше очков.",
    },
    {
      emoji: "🏆",
      text: "Приглашай друзей и соревнуйся в лидерборде. Удачи!",
    },
  ];

  const finishTutorial = () => {
    setShowTutorial(false);
    const userId = getUserId();
    fetch("/api/tutorial", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    }).catch(() => {});
  };

  const nextTutorialStep = () => {
    if (tutorialStep < tutorialSlides.length - 1) {
      setTutorialStep(tutorialStep + 1);
    } else {
      finishTutorial();
    }
  };

  const getMedal = (index: number) => {
    if (index === 0) return "🥇";
    if (index === 1) return "🥈";
    if (index === 2) return "🥉";
    return `#${index + 1}`;
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-900 text-white p-4">
      {showTutorial && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gray-900 p-6">
          <div className="w-full max-w-sm flex flex-col items-center text-center">
            <div className="text-7xl mb-6">{tutorialSlides[tutorialStep].emoji}</div>
            <p className="text-lg mb-8 min-h-[6rem]">{tutorialSlides[tutorialStep].text}</p>
            <div className="flex gap-2 mb-8">
              {tutorialSlides.map((_, i) => (
                <div
                  key={i}
                  className={`h-2 w-2 rounded-full ${i === tutorialStep ? "bg-blue-500" : "bg-gray-600"}`}
                />
              ))}
            </div>
            <div className="flex flex-col gap-3 w-full">
              <button
                onClick={nextTutorialStep}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg text-lg"
              >
                {tutorialStep < tutorialSlides.length - 1 ? "Далее" : "Начать"}
              </button>
              <button
                onClick={finishTutorial}
                className="text-gray-400 hover:text-gray-200 text-sm py-2"
              >
                Пропустить
              </button>
            </div>
          </div>
        </div>
      )}

      <h1 className="text-3xl font-bold mb-2">🎮 Combo Game</h1>
      
      <div className="text-center mb-4">
        <p className="text-xl text-yellow-400">Ваш баланс: {balance} очков</p>
        {streak > 0 && <p className="text-sm text-green-400 mt-1">🔥 Серия входов: {streak} дн.</p>}
      </div>

      {boostActive && <p className="text-green-400 mb-2">🚀 Буст x2 активен: {boostMinutes} мин</p>}
      {timeBoostActive && <p className="text-blue-400 mb-2">⏱️ Буст времени: +10 сек</p>}
      {comboBoostActive && <p className="text-pink-400 mb-2">💥 Буст комбо +50%: {comboBoostMinutes} мин</p>}

      {showProfile ? (
        <div className="w-full max-w-md">
          <button onClick={() => setShowProfile(false)} className="mb-4 bg-gray-700 px-4 py-2 rounded-lg">← Назад к игре</button>
          <h2 className="text-2xl font-bold mb-4 text-center">👤 Профиль игрока</h2>
          <div className="bg-gray-800 p-4 rounded-lg space-y-3">
            <p className="text-lg"><span className="text-gray-400">Имя:</span> {profileData.name}</p>
            <p className="text-lg"><span className="text-gray-400">Баланс:</span> {balance} очков</p>
            <p className="text-lg"><span className="text-gray-400">Серия входов:</span> {streak} дн.</p>
            <p className="text-lg"><span className="text-gray-400">Всего раундов:</span> {profileData.totalRounds}</p>
            <p className="text-lg"><span className="text-gray-400">Лучший результат:</span> {profileData.bestRound} очков</p>
          </div>
        </div>
      ) : showLeaderboard ? (
        <div className="w-full max-w-md">
          <button onClick={() => setShowLeaderboard(false)} className="mb-4 bg-gray-700 px-4 py-2 rounded-lg">← Назад к игре</button>
          <h2 className="text-2xl font-bold mb-4 text-center">🏆 Топ игроков</h2>
          <div className="space-y-2">
            {leaderboard.map((player, index) => (
              <div key={player.userId} className="flex justify-between items-center bg-gray-800 p-3 rounded-lg">
                <span className="font-bold text-lg w-12 text-center">{getMedal(index)}</span>
                <span className="text-gray-300 flex-1">{player.name}</span>
                <span className="text-yellow-400 font-bold">{player.score}</span>
              </div>
            ))}
            {leaderboard.length === 0 && <p className="text-center text-gray-400">Пока нет игроков</p>}
          </div>
        </div>
      ) : (
        <>
          {hasPlayed && (
          <div className="mb-6 flex flex-col items-center gap-2">
            {dailyState === "loading" && <p className="text-gray-400">Загрузка награды...</p>}
            {dailyState === "available" && (
              <button onClick={claimDaily} className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-lg">🎁 Забрать 100 очков (ежедневно)</button>
            )}
            {dailyState === "claimed" && <p className="text-gray-400">🎁 Следующая награда через: {dailyTimer}</p>}
            
            <div className="flex gap-2 flex-wrap justify-center">
              {!boostActive && (
                <button onClick={buyBoost} className="bg-orange-600 hover:bg-orange-700 text-white font-bold py-2 px-4 rounded-lg text-sm">🚀 Буст x2 (10 Stars)</button>
              )}
              {!timeBoostActive && (
                <button onClick={buyTimeBoost} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg text-sm">⏱️ +10 сек (5 Stars)</button>
              )}
              {!comboBoostActive && (
                <button onClick={buyComboBoost} className="bg-pink-600 hover:bg-pink-700 text-white font-bold py-2 px-4 rounded-lg text-sm">💥 Буст комбо (15 Stars)</button>
              )}
            </div>

            {!quest && questChoices.length > 0 && (
              <div className="mt-2 text-center bg-gray-800 p-3 rounded-lg w-full max-w-xs">
                <p className="text-sm text-gray-300 mb-2">🎯 Выбери квест на сегодня</p>
                <div className="flex flex-col gap-2">
                  {questChoices.map(choice => (
                    <button
                      key={choice.id}
                      onClick={() => selectQuest(choice.id)}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold py-2 px-3 rounded-lg"
                    >
                      {choice.title} (+{choice.reward})
                    </button>
                  ))}
                </div>
              </div>
            )}

            {quest && (
              <div className="mt-2 text-center bg-gray-800 p-3 rounded-lg w-full max-w-xs">
                <p className="text-sm text-gray-300 mb-1">🎯 {quest.title}</p>
                <div className="w-full bg-gray-700 rounded-full h-2.5">
                  <div className="bg-green-500 h-2.5 rounded-full" style={{ width: `${Math.min(questProgress / quest.target * 100, 100)}%` }}></div>
                </div>
                <p className="text-xs text-gray-400 mt-1">{questProgress}/{quest.target}</p>
                {questProgress >= quest.target && !questCompleted && (
                  <button onClick={claimQuestReward} className="mt-2 bg-green-600 hover:bg-green-700 text-white text-sm font-bold py-1 px-3 rounded-lg">🎁 Забрать {quest.reward} очков</button>
                )}
                {questCompleted && <p className="text-green-400 text-sm mt-1">✅ Квест выполнен</p>}
              </div>
            )}
          </div>
          )}

          {gameState === "idle" && (
            <div className="flex flex-col gap-4">
              {referralBonus !== null && (
                <div className="bg-green-800 border border-green-500 rounded-lg px-4 py-2 text-center text-green-200 text-sm">
                  🎉 Вы пришли по реферальной ссылке — +{referralBonus} очков!
                </div>
              )}
              <button onClick={startGame} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg text-xl">Начать игру</button>
              <div className="flex gap-2 justify-center">
                <button onClick={() => setShowLeaderboard(true)} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg">🏆 Лидерборд</button>
                {hasPlayed && (
                  <button onClick={() => setShowProfile(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg">👤 Профиль</button>
                )}
              </div>
              {hasPlayed && (
                <button
                  onClick={() => {
                    const userId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id;
                    if (!userId) return;
                    const botUsername = process.env.NEXT_PUBLIC_BOT_USERNAME;
                    const link = `https://t.me/${botUsername}?startapp=ref_${userId}`;
                    window.Telegram.WebApp.openTelegramLink(
                      `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent("Присоединяйся к Combo Game и получи 200 очков в подарок! 🎮")}`
                    );
                  }}
                  className="bg-teal-600 hover:bg-teal-700 text-white font-bold py-2 px-4 rounded-lg"
                >
                  👥 Пригласить друга (+500 очков)
                </button>
              )}
              {hasPlayed && (
                <button onClick={fetchData} className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg text-sm">🔄 Обновить данные</button>
              )}
            </div>
          )}

          {gameState === "playing" && (
            <div className="text-center">
              <p className="text-xl mb-2">⏱️ Время: {timeLeft} сек</p>
              <p className="text-xl mb-2">Комбо: {combo} 🔥</p>
              <p className="text-xl mb-8">Очки за раунд: {score}</p>
              <div className="flex gap-4">
                {[0, 1, 2].map((i) => (
                  <button key={i} onClick={() => handleClick(i)} className={`w-20 h-20 rounded-xl text-2xl font-bold transition-colors ${i === target ? "bg-green-500" : "bg-gray-700 hover:bg-gray-600"}`}>
                    {i === target ? "👆" : "❓"}
                  </button>
                ))}
              </div>
            </div>
          )}

          {gameState === "won" && (
            <div className="text-center">
              <h2 className="text-2xl text-red-500 mb-4">Время вышло!</h2>
              <p className="text-xl mb-6">Ваш счёт за раунд: {score} очков</p>
              <button onClick={claimReward} className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg">Забрать награду</button>
            </div>
          )}
        </>
      )}
    </main>
  );
}