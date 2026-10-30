"use client";
import { useEffect, useState } from "react";

export default function Home() {
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [target, setTarget] = useState(0);
  const [gameState, setGameState] = useState<"idle" | "playing" | "won">("idle");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const check = setInterval(() => {
        if (window.Telegram?.WebApp) {
          window.Telegram.WebApp.ready();
          clearInterval(check);
        }
      }, 100);
      return () => clearInterval(check);
    }
  }, []);

  const startGame = () => {
    setScore(0);
    setCombo(0);
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
        alert(`✅ Успешно! Вы заработали ${score} очков!`);
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
      <h1 className="text-3xl font-bold mb-4">🎮 Combo Game</h1>

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
          <p className="text-xl mb-2">Комбо: {combo} 🔥</p>
          <p className="text-xl mb-8">Очки: {score}</p>

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
          <p className="mt-4 text-gray-400 text-sm">Нажми на 👆 как можно быстрее!</p>
        </div>
      )}

      {gameState === "won" && (
        <div className="text-center">
          <h2 className="text-2xl text-red-500 mb-4">Комбо сброшено!</h2>
          <p className="text-xl mb-6">Ваш счёт: {score} очков</p>
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
