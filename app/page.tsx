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
  const [leaderboard, setLeaderboard] = useState<{ userId: string; name: string; score: number }[]>([]);
  const [boostActive, setBoostActive] = useState(false);
  const [boostMinutes, setBoostMinutes] = useState(0);
  const [roundsPlayed, setRoundsPlayed] = useState(0);

  const getUserId = () => window.Telegram?.WebApp?.initDataUnsafe?.user?.id || 1;
  const getFirstName = () => window.Telegram?.WebApp?.initDataUnsafe?.user?.first_name || "Игрок";

  useEffect(() => {
    if (typeof window !== "undefined") {
      const check = setInterval(() => {
        if (window.Telegram?.WebApp) {
          window.Telegram.WebApp.ready();
          clearInterval(check);
          
          const userId = getUserId();
          fetch(`/api/save-score?userId=${userId}`).then(res => res.json()).then(data => setBalance(data.balance || 0));
          fetch(`/api/claim-daily?userId=${userId}`).then(res => res.json()).then(data => {
            if (data.canClaim) setDailyState("available");
            else { setDailyState("claimed"); setDailyTimer(`${data.hoursRemaining}ч ${data.minutesRemaining}м`); }
          });
          fetch('/api/leaderboard').then(res => res.json()).then(data => setLeaderboard(data.players || []));
          fetch(`/api/buy-boost?userId=${userId}`).then(res => res.json()).then(data => {
            if (data.active) { setBoostActive(true); setBoostMinutes(data.minutesLeft); }
          });
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
      setScore(score + 10 * newCombo);
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
        alert(`✅ Вы заработали ${data.earned} очков! Общий баланс: ${data.newBalance}${data.boostApplied ? ' (с бустом x2)' : ''}`);
        setGameState("idle"); setScore(0); setCombo(0);
        fetch('/api/leaderboard').then(res => res.json()).then(data => setLeaderboard(data.players || []));
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
        fetch('/api/leaderboard').then(res => res.json()).then(data => setLeaderboard(data.players || []));
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

  const getMedal = (index: number) => {
    if (index === 0) return "🥇";
    if (index === 1) return "🥈";
    if (index === 2) return "🥉";
    return `#${index + 1}`;
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-900 text-white p-4">
      <h1 className="text-3xl font-bold mb-2">🎮 Combo Game</h1>
      <p className="text-xl mb-4 text-yellow-400">Ваш баланс: {balance} очков</p>

      {boostActive && <p className="text-green-400 mb-2">🚀 Буст x2 активен: {boostMinutes} мин</p>}

      {showLeaderboard ? (
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
          <div className="mb-6 flex flex-col items-center gap-2">
            {dailyState === "loading" && <p className="text-gray-400">Загрузка награды...</p>}
            {dailyState === "available" && (
              <button onClick={claimDaily} className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-lg">🎁 Забрать 100 очков (ежедневно)</button>
            )}
            {dailyState === "claimed" && <p className="text-gray-400">🎁 Следующая награда через: {dailyTimer}</p>}
            
            {!boostActive && (
              <button onClick={buyBoost} className="bg-orange-600 hover:bg-orange-700 text-white font-bold py-2 px-4 rounded-lg">🚀 Купить буст x2 (10 Stars)</button>
            )}

            {/* Ежедневный квест */}
            <div className="mt-2 text-center bg-gray-800 p-3 rounded-lg w-full max-w-xs">
              <p className="text-sm text-gray-300 mb-1">🎯 Квест: Сыграй 3 раунда</p>
              <div className="w-full bg-gray-700 rounded-full h-2.5">
                <div className="bg-green-500 h-2.5 rounded-full" style={{ width: `${Math.min(roundsPlayed / 3 * 100, 100)}%` }}></div>
              </div>
              <p className="text-xs text-gray-400 mt-1">{roundsPlayed}/3</p>
              {roundsPlayed >= 3 && <p className="text-green-400 text-sm mt-1">Квест выполнен! (Награда: +500 очков)</p>}
            </div>
          </div>

          {gameState === "idle" && (
            <div className="flex flex-col gap-4">
              <button onClick={startGame} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg text-xl">Начать игру</button>
              <button onClick={() => setShowLeaderboard(true)} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg">🏆 Лидерборд</button>
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
