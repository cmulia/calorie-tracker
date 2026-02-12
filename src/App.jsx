import { useEffect, useMemo, useState } from "react";
import "./App.css";


const DAILY_LIMIT = 1200;

const MEALS = [
  { key: "breakfast", label: "Breakfast" },
  { key: "lunch", label: "Lunch" },
  { key: "dinner", label: "Dinner" },
];

function isoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateFromISO(iso) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function addDays(iso, days) {
  const d = dateFromISO(iso);
  d.setDate(d.getDate() + days);
  return isoDate(d);
}

function emptyDayEntries() {
  return {
    breakfast: [],
    lunch: [],
    dinner: [],
  };
}

function normalizeDayEntries(day) {
  return {
    breakfast: Array.isArray(day?.breakfast) ? day.breakfast : [],
    lunch: Array.isArray(day?.lunch) ? day.lunch : [],
    dinner: Array.isArray(day?.dinner) ? day.dinner : [],
  };
}

function getCurrentWeek(baseDate) {
  const start = new Date(baseDate);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - start.getDay());

  return Array.from({ length: 7 }, (_, idx) => {
    const d = new Date(start);
    d.setDate(start.getDate() + idx);
    return {
      iso: isoDate(d),
      dayLabel: d.toLocaleDateString(undefined, { weekday: "short" }),
      dayNumber: d.getDate(),
      fullLabel: d.toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
      }),
    };
  });
}

function getCurrentMonthCells(baseDate) {
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const leadingEmpty = firstOfMonth.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];

  for (let i = 0; i < leadingEmpty; i += 1) {
    cells.push(null);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const d = new Date(year, month, day);
    cells.push({
      iso: isoDate(d),
      dayNumber: day,
      fullLabel: d.toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
      }),
    });
  }

  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  return cells;
}

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function clampCalories(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.round(n));
}

function normalizeStoredData(raw) {
  const todayISO = isoDate(new Date());
  const base = raw && typeof raw === "object" ? raw : {};
  const entriesByDate = {};

  if (base.entriesByDate && typeof base.entriesByDate === "object") {
    Object.entries(base.entriesByDate).forEach(([dateKey, day]) => {
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
        entriesByDate[dateKey] = normalizeDayEntries(day);
      }
    });
  }

  if (Object.keys(entriesByDate).length === 0) {
    const fallbackDate = typeof base.lastResetISO === "string" ? base.lastResetISO : todayISO;
    entriesByDate[fallbackDate] = {
      breakfast: Array.isArray(base.breakfast) ? base.breakfast : [],
      lunch: Array.isArray(base.lunch) ? base.lunch : [],
      dinner: Array.isArray(base.dinner) ? base.dinner : [],
    };
  }

  return {
    entriesByDate,
    limit: clampCalories(base.limit) || DAILY_LIMIT,
    lastResetISO: typeof base.lastResetISO === "string" ? base.lastResetISO : todayISO,
  };
}

export default function App() {
  const currentTodayISO = isoDate(new Date());
  const [data, setData] = useState(() => {
    const saved = localStorage.getItem("calorieTrackerPink_v1");
    if (saved) {
      try {
        return normalizeStoredData(JSON.parse(saved));
      } catch {}
    }
    return normalizeStoredData(null);
  });
  const [selectedDateISO, setSelectedDateISO] = useState(currentTodayISO);

  const [activeMeal, setActiveMeal] = useState("breakfast");
  const [name, setName] = useState("");
  const [calories, setCalories] = useState("");
  const [isSuggestedCalories, setIsSuggestedCalories] = useState(false);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [aiNote, setAiNote] = useState("");
  const [aiError, setAiError] = useState("");
  const [typedAiText, setTypedAiText] = useState("");
  const aiMessage = aiError || aiNote;

  // Auto-save
  useEffect(() => {
    localStorage.setItem("calorieTrackerPink_v1", JSON.stringify(data));
  }, [data]);

  useEffect(() => {
    if (!aiMessage) {
      setTypedAiText("");
      return undefined;
    }

    let idx = 0;
    setTypedAiText("");

    const timer = setInterval(() => {
      idx += 1;
      setTypedAiText(aiMessage.slice(0, idx));
      if (idx >= aiMessage.length) {
        clearInterval(timer);
      }
    }, 18);

    return () => clearInterval(timer);
  }, [aiMessage]);

  const selectedDayEntries = useMemo(
    () => normalizeDayEntries(data.entriesByDate?.[selectedDateISO]),
    [data.entriesByDate, selectedDateISO],
  );

  const totalUsed = useMemo(() => {
    return MEALS.reduce((sum, m) => {
      const items = selectedDayEntries[m.key] || [];
      return sum + items.reduce((s, it) => s + (Number(it.calories) || 0), 0);
    }, 0);
  }, [selectedDayEntries]);

  const today = new Date();
  const todayISO = isoDate(today);
  const selectedDate = dateFromISO(selectedDateISO);
  const isViewingToday = selectedDateISO === todayISO;
  const remaining = (data.limit ?? DAILY_LIMIT) - totalUsed;
  const selectedDateLabel = selectedDate.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const week = useMemo(() => getCurrentWeek(today), [todayISO]);
  const monthCells = useMemo(() => getCurrentMonthCells(today), [todayISO]);
  const weekdayHeaders = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  function getStatusForDate(dayISO) {
    if (dayISO === todayISO) {
      return { statusClass: "today", statusText: "Today" };
    }

    const dayEntries = normalizeDayEntries(data.entriesByDate?.[dayISO]);
    const hasEntries = MEALS.some((m) => (dayEntries[m.key] || []).length > 0);
    if (!hasEntries) {
      return { statusClass: "noEntry", statusText: "No entry" };
    }

    const dayTotal = MEALS.reduce((sum, m) => {
      const mealItems = dayEntries[m.key] || [];
      return sum + mealItems.reduce((mealSum, it) => mealSum + (Number(it.calories) || 0), 0);
    }, 0);
    const isWithinLimit = dayTotal <= (data.limit ?? DAILY_LIMIT);

    if (isWithinLimit) {
      return { statusClass: "achieved", statusText: "Achieved" };
    }

    return {
      statusClass: "notAchieved",
      statusText: `Not achieved (over limit: ${dayTotal} kcal)`,
    };
  }

  function addItem(e) {
    e.preventDefault();
    const trimmed = name.trim();
    const cals = clampCalories(calories);

    if (!trimmed) return;
    if (cals <= 0) return;

    const item = { id: uid(), name: trimmed, calories: cals, createdAt: Date.now() };

    setData((prev) => {
      const currentDay = normalizeDayEntries(prev.entriesByDate?.[selectedDateISO]);
      return {
        ...prev,
        entriesByDate: {
          ...(prev.entriesByDate || {}),
          [selectedDateISO]: {
            ...currentDay,
            [activeMeal]: [item, ...(currentDay[activeMeal] || [])],
          },
        },
      };
    });

    setName("");
    setCalories("");
    setIsSuggestedCalories(false);
  }

  function removeItem(mealKey, id) {
    setData((prev) => {
      const currentDay = normalizeDayEntries(prev.entriesByDate?.[selectedDateISO]);
      return {
        ...prev,
        entriesByDate: {
          ...(prev.entriesByDate || {}),
          [selectedDateISO]: {
            ...currentDay,
            [mealKey]: (currentDay[mealKey] || []).filter((it) => it.id !== id),
          },
        },
      };
    });
  }

  function resetDay() {
    setData((prev) => ({
      ...prev,
      entriesByDate: {
        ...(prev.entriesByDate || {}),
        [selectedDateISO]: emptyDayEntries(),
      },
      limit: prev.limit ?? DAILY_LIMIT,
      lastResetISO: selectedDateISO,
    }));
  }

  function setLimit(v) {
    const n = clampCalories(v);
    setData((prev) => ({ ...prev, limit: n || DAILY_LIMIT }));
  }

  async function suggestCalories() {
    const ingredientText = name.trim();
    if (!ingredientText) return;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    setIsSuggesting(true);
    setAiError("");
    setAiNote("");

    try {
      const r = await fetch("/api/suggest-calories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: ingredientText }),
        signal: controller.signal,
      });

      let res = {};
      try {
        res = await r.json();
      } catch {}

      if (!r.ok) {
        throw new Error(res?.error || "Request failed");
      }

      const suggestedCalories = Number(res.calories);
      setCalories(Number.isFinite(suggestedCalories) ? String(Math.max(0, Math.round(suggestedCalories))) : "");
      setIsSuggestedCalories(true);
      setAiNote(res.notes || "");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setAiError("Suggestion timed out. Please try again.");
        return;
      }
      setAiError(
        error instanceof Error && error.message
          ? error.message
          : "Could not get a suggestion. Check your API key + redeploy."
      );
    } finally {
      clearTimeout(timeoutId);
      setIsSuggesting(false);
    }
  }

  function goToToday() {
    setSelectedDateISO(todayISO);
  }

  function goToPrevDate() {
    setSelectedDateISO((prev) => addDays(prev, -1));
  }

  function goToNextDate() {
    setSelectedDateISO((prev) => addDays(prev, 1));
  }

  return (
    <div className="page">
      <div className="bgGlow" aria-hidden="true" />
      <header className="header">
        <div>
          <h1 className="title">Calorie Tracker</h1>
          <div className="dateControls">
            <button
              type="button"
              className="dateArrowBtn"
              onClick={goToPrevDate}
              aria-label="Previous date"
            >
              ←
            </button>
            <p className="todayDate">{selectedDateLabel}</p>
            <button
              type="button"
              className="dateArrowBtn"
              onClick={goToNextDate}
              aria-label="Next date"
            >
              →
            </button>
            <button
              type="button"
              className="dateTodayBtn"
              onClick={goToToday}
              disabled={isViewingToday}
            >
              Today
            </button>
          </div>
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
            Reset selected day
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
              <div className="ingredientControlRow">
                <input
                  className="input"
                  placeholder="e.g. 2 eggs"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <button
                  type="button"
                  className="btn ghost analyseBtn"
                  onClick={suggestCalories}
                  disabled={isSuggesting || !name.trim()}
                >
                  {isSuggesting ? "Thinking..." : "Analyse"}
                </button>
              </div>
            </label>

            <label className="field caloriesField">
              <span className="label">Calories (kcal)</span>
              <input
                className={isSuggestedCalories ? "input suggestedInput" : "input"}
                inputMode="numeric"
                placeholder="e.g. 140"
                value={calories}
                onChange={(e) => {
                  setCalories(e.target.value);
                  setIsSuggestedCalories(false);
                }}
              />
            </label>

            <button className="btn primary" type="submit">
              Add
            </button>
            {isSuggesting || aiNote || aiError ? (
              <div className={isSuggesting ? "aiBox thinking" : "aiBox"} role="status" aria-live="polite">
                <div className="aiBoxTitle">AI Says</div>
                <div
                  className={`${aiError ? "aiBoxText error" : "aiBoxText"} ${
                    typedAiText.length < aiMessage.length ? "typing" : ""
                  }`}
                >
                  {isSuggesting ? "Thinking..." : typedAiText}
                </div>
              </div>
            ) : null}
          </form>
        </section>

        <section className="mealsGrid">
          {MEALS.map((m) => {
            const items = selectedDayEntries[m.key] || [];
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

      <section className="card weekMemory">
        <h2 className="cardTitle">This Week Goal Memory</h2>
        <table className="weekTable" aria-label="Weekly goal table">
          <tbody>
            <tr>
              {week.map((day) => {
                const isSelected = day.iso === selectedDateISO;
                const { statusClass, statusText } = getStatusForDate(day.iso);

                return (
                  <td key={day.iso} className={isSelected ? "isSelectedDay" : ""}>
                    <button
                      type="button"
                      className="weekCellBtn"
                      onClick={() => setSelectedDateISO(day.iso)}
                      title={statusText}
                      aria-label={`${day.fullLabel}: ${statusText}. View this date.`}
                    >
                      <div className="weekDay">{day.dayLabel}</div>
                      <span className={`statusDot ${statusClass}`} aria-hidden="true" />
                      <div className="weekDate">{day.dayNumber}</div>
                    </button>
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>

        <div className="monthBlock">
          <h3 className="monthTitle">This Month</h3>
          <table className="monthTable" aria-label="Monthly goal table">
            <thead>
              <tr>
                {weekdayHeaders.map((label) => (
                  <th key={label} scope="col">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: monthCells.length / 7 }, (_, rowIdx) => (
                <tr key={`month-row-${rowIdx}`}>
                  {monthCells.slice(rowIdx * 7, rowIdx * 7 + 7).map((day, colIdx) => {
                    if (!day) {
                      return <td key={`empty-${rowIdx}-${colIdx}`} className="monthEmpty" />;
                    }

                    const isSelected = day.iso === selectedDateISO;
                    const { statusClass, statusText } = getStatusForDate(day.iso);

                    return (
                      <td key={day.iso} className={isSelected ? "isSelectedDay" : ""}>
                        <button
                          type="button"
                          className="monthCellBtn"
                          onClick={() => setSelectedDateISO(day.iso)}
                          title={statusText}
                          aria-label={`${day.fullLabel}: ${statusText}. View this date.`}
                        >
                          <div className="monthDate">{day.dayNumber}</div>
                          <span className={`statusDot ${statusClass}`} aria-hidden="true" />
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="weekLegend" aria-label="Status legend">
          <span className="legendItem">
            <span className="legendDot achieved" aria-hidden="true" />
            Achieved
          </span>
          <span className="legendItem">
            <span className="legendDot notAchieved" aria-hidden="true" />
            Over limit
          </span>
          <span className="legendItem">
            <span className="legendDot noEntry" aria-hidden="true" />
            No entry
          </span>
          <span className="legendItem">
            <span className="legendDot today" aria-hidden="true" />
            Today
          </span>
        </div>
      </section>

      <footer className="footer">
        <span>
          Saves automatically in your browser. Works offline after the first load.
        </span>
      </footer>
    </div>
  );
}
