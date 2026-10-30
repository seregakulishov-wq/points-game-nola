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

  useEffect(() => {
    if (typeof window !== "undefined") {
      const check = setInterval(() => {
        if (window.Telegram?.WebApp) {
          window.Telegram.WebApp.ready();
          clearInterval(check);
          
          const userId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id || 1;
          fetch(`/api/save-score?userId=${userId}`)
            .then(res => res.json())
            .then(data => setBalance(data.balance || 0))
            .catch(console.error);
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
    }
  }, [gameState, timeLeft]);

  const startGame = () => {
    setScore(0);
    setCombo(0);
    setTimeLeft(30);
    setGameState("playing");
    setTarget(Math.floor(Math.random() * 3));
  };

  const newTarget = () => {
    setTarget(Math.floor(Math.random() * 3));
  };

  const handleClick = (index: number) => {
    if (gameState !== "playing") return;
    if (index === target) {
      const newCombo = combo + 1;
      setCombo(newCombo);
      setScore(score + 10 * newCombo);
      newTarget();
    } else {
      setGameState("won");
    }
  };

  const claimReward = async () => {
    try {
      const userId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id || 1;

      const res = await fetch("/api/save-score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, score }),
      });

      const data = await res.json();

      if (res.ok) {
        setBalance(data.newBalance);
        alert(`✅ Успешно! Вы заработали ${score} очков! Ваш общий баланс: ${data.newBalance}`);
        setGameState("idle");
        setScore(0);
        setCombo(0);
      } else {
        alert(`❌ Ошибка: ${data.error || "Не удалось сохранить"}`);
      }
    } catch (e) {
      alert("❌ Ошибка сети.");
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-900 text-white p-4">
      <h1 className="text-3xl font-bold mb-2">🎮 Combo Game</h1>
      <p className="text-xl mb-6 text-yellow-400">Ваш баланс: {balance} очков</p>

      {gameState === "idle" && (
        <button
          onClick={startGame}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg text-xl"
        >
          Начать игру
        </button>
      )}

      {gameState === "playing" && (
        <div className="text-center">
          <p className="text-xl mb-2">⏱️ Время: {timeLeft} сек</p>
          <p className="text-xl mb-2">Комбо: {combo} 🔥</p>
          <p className="text-xl mb-8">Очки за раунд: {score}</p>

          <div className="flex gap-4">
            {[0, 1, 2].map((i) => (
              <button
                key={i}
                onClick={() => handleClick(i)}
                className={`w-20 h-20 rounded-xl text-2xl font-bold transition-colors ${
                  i === target ? "bg-green-500" : "bg-gray-700 hover:bg-gray-600"
                }`}
              >
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
          <button
            onClick={claimReward}
            className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg"
          >
            Забрать награду
          </button>
        </div>
      )}
    </main>
  );
}
