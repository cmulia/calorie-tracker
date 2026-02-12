import { useEffect, useMemo, useState } from "react";
import "./App.css";

const DAILY_LIMIT = 1200;

const MEALS = [
  { key: "breakfast", label: "Breakfast" },
  { key: "lunch", label: "Lunch" },
  { key: "dinner", label: "Dinner" },
];

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function clampCalories(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.round(n));
}

export default function App() {
  const [data, setData] = useState(() => {
    const saved = localStorage.getItem("calorieTrackerPink_v1");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === "object") return parsed;
      } catch {}
    }
    return {
      breakfast: [],
      lunch: [],
      dinner: [],
      limit: DAILY_LIMIT,
      lastResetISO: new Date().toISOString().slice(0, 10),
    };
  });

  const [activeMeal, setActiveMeal] = useState("breakfast");
  const [name, setName] = useState("");
  const [calories, setCalories] = useState("");

  // Auto-save
  useEffect(() => {
    localStorage.setItem("calorieTrackerPink_v1", JSON.stringify(data));
  }, [data]);

  const totalUsed = useMemo(() => {
    return MEALS.reduce((sum, m) => {
      const items = data[m.key] || [];
      return sum + items.reduce((s, it) => s + (Number(it.calories) || 0), 0);
    }, 0);
  }, [data]);

  const remaining = (data.limit ?? DAILY_LIMIT) - totalUsed;
  const todayLabel = useMemo(
    () =>
      new Date().toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      }),
    [],
  );

  function addItem(e) {
    e.preventDefault();
    const trimmed = name.trim();
    const cals = clampCalories(calories);

    if (!trimmed) return;
    if (cals <= 0) return;

    const item = { id: uid(), name: trimmed, calories: cals, createdAt: Date.now() };

    setData((prev) => ({
      ...prev,
      [activeMeal]: [item, ...(prev[activeMeal] || [])],
    }));

    setName("");
    setCalories("");
  }

  function removeItem(mealKey, id) {
    setData((prev) => ({
      ...prev,
      [mealKey]: (prev[mealKey] || []).filter((it) => it.id !== id),
    }));
  }

  function resetDay() {
    const today = new Date().toISOString().slice(0, 10);
    setData((prev) => ({
      ...prev,
      breakfast: [],
      lunch: [],
      dinner: [],
      limit: prev.limit ?? DAILY_LIMIT,
      lastResetISO: today,
    }));
  }

  function setLimit(v) {
    const n = clampCalories(v);
    setData((prev) => ({ ...prev, limit: n || DAILY_LIMIT }));
  }

  return (
    <div className="page">
      <div className="bgGlow" aria-hidden="true" />
      <header className="header">
        <div>
          <h1 className="title">Calorie Tracker</h1>
          <p className="todayDate">{todayLabel}</p>
          <p className="subtitle">
            Add ingredients to meals. It subtracts from your daily limit.
          </p>
        </div>

        <div className="statsCard">
          <div className="statRow">
            <span className="statLabel">Daily limit</span>
            <div className="limitEdit">
              <input
                className="input small"
                inputMode="numeric"
                value={data.limit ?? DAILY_LIMIT}
                onChange={(e) => setLimit(e.target.value)}
                aria-label="Daily calorie limit"
              />
              <span className="unit">kcal</span>
            </div>
          </div>

          <div className="statRow">
            <span className="statLabel">Used</span>
            <span className="statValue">{totalUsed} kcal</span>
          </div>

          <div className="statRow big">
            <span className="statLabel">Remaining</span>
            <span className={remaining >= 0 ? "statRemain ok" : "statRemain bad"}>
              {remaining} kcal
            </span>
          </div>

          <button className="btn ghost" onClick={resetDay}>
            Reset day
          </button>
          <div className="tiny">
            Last reset: <b>{data.lastResetISO}</b>
          </div>
        </div>
      </header>

      <main className="main">
        <section className="card">
          <h2 className="cardTitle">Add ingredient</h2>

          <div className="mealTabs" role="tablist" aria-label="Meals">
            {MEALS.map((m) => (
              <button
                key={m.key}
                className={activeMeal === m.key ? "tab active" : "tab"}
                onClick={() => setActiveMeal(m.key)}
                role="tab"
                aria-selected={activeMeal === m.key}
              >
                {m.label}
              </button>
            ))}
          </div>

          <form className="form" onSubmit={addItem}>
            <label className="field">
              <span className="label">Ingredient</span>
              <input
                className="input"
                placeholder="e.g. 2 eggs"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>

            <label className="field">
              <span className="label">Calories (kcal)</span>
              <input
                className="input"
                inputMode="numeric"
                placeholder="e.g. 140"
                value={calories}
                onChange={(e) => setCalories(e.target.value)}
              />
            </label>

            <button className="btn primary" type="submit">
              Add
            </button>
          </form>

          <p className="hint">
            Tip: If you go negative, you’re over your daily limit.
          </p>
        </section>

        <section className="mealsGrid">
          {MEALS.map((m) => {
            const items = data[m.key] || [];
            const mealTotal = items.reduce((s, it) => s + (Number(it.calories) || 0), 0);

            return (
              <div className="card" key={m.key}>
                <div className="mealHeader">
                  <h2 className="cardTitle">{m.label}</h2>
                  <div className="pill">{mealTotal} kcal</div>
                </div>

                {items.length === 0 ? (
                  <div className="empty">No ingredients yet.</div>
                ) : (
                  <ul className="list">
                    {items.map((it) => (
                      <li className="listItem" key={it.id}>
                        <div className="itemMain">
                          <div className="itemName">{it.name}</div>
                          <div className="itemCals">{it.calories} kcal</div>
                        </div>
                        <button
                          className="iconBtn"
                          onClick={() => removeItem(m.key, it.id)}
                          aria-label={`Delete ${it.name}`}
                          title="Delete"
                        >
                          ✕
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </section>
      </main>

      <footer className="footer">
        <span>
          Saves automatically in your browser. Works offline after the first load.
        </span>
      </footer>
    </div>
  );
}
