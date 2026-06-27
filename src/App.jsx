import React, { useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, RotateCcw, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";



const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December"
];

const weekdayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getCalendarDays(year, monthIndex) {
  const first = new Date(year, monthIndex, 1);
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const mondayBasedStart = (first.getDay() + 6) % 7;
  const cells = [];

  for (let i = 0; i < mondayBasedStart; i++) {
    cells.push(null);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(new Date(year, monthIndex, day));
  }

  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  return cells;
}

function WisdomCard({ message, title = "Today’s Wisdom" }) {
  if (!message) {
    return (
      <Card className="rounded-2xl border-[#e7dcc8] bg-[#fffdf7] shadow-sm">
        <CardContent className="p-6 text-center">
          <p className="text-sm uppercase tracking-[0.25em] text-[#9b8565]">
            {title}
          </p>
          <p className="mt-4 font-serif text-2xl text-[#2f2a24]">
            No message available for this date.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl border-[#e7dcc8] bg-[#fffdf7] shadow-sm">
      <CardContent className="p-5 sm:p-7 md:p-9">
        <p className="text-sm uppercase tracking-[0.25em] text-[#9b8565]">
          {title}
        </p>

        <h2 className="mt-2 font-serif text-2xl text-[#2f2a24] sm:text-3xl">
          {message.displayDate}
        </h2>

        <div className="mt-7 border-l-2 border-[#b89b5e] pl-5">
          {message.textDevanagari && (
  <div className="mt-7 border-l-2 border-[#b89b5e] pl-5">
    <p className="text-xs uppercase tracking-[0.25em] text-[#9b8565]">
      Hindi
    </p>

    <p className="mt-3 font-serif text-xl leading-relaxed text-[#2f2a24] sm:text-2xl md:text-3xl">
      “{message.textDevanagari}”
    </p>
  </div>
)}

<div className="mt-7 border-l-2 border-[#d8c9ad] pl-5">
  {/* <p className="text-xs uppercase tracking-[0.25em] text-[#9b8565]">
    Transliteration
  </p> */}

  <p className="mt-3 font-serif text-lg leading-relaxed text-[#4d4236] sm:text-xl md:text-2xl">
    “{message.text}”
  </p>
</div>
        </div>

        <p className="mt-5 text-sm text-[#7a6a58]">{message.closing}</p>
      </CardContent>
    </Card>
  );
}

export default function App() {
  const today = new Date();
  const todayKey = toDateKey(today);

  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [selectedYear, setSelectedYear] = useState(today.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth());
  const [selectedDateKey, setSelectedDateKey] = useState(todayKey);

  useEffect(() => {
    async function loadMessages() {
      try {
        const response = await fetch("./public/data/messages.json");

        if (!response.ok) {
          throw new Error(`Failed to load messages.json. Status: ${response.status}`);
        }

        const data = await response.json();
        const parsedMessages = data.messages || [];

        setMessages(parsedMessages);

        if (parsedMessages.length > 0) {
          const latestMessage = parsedMessages[parsedMessages.length - 1];
          const [year, month] = latestMessage.date.split("-").map(Number);

          setSelectedDateKey(latestMessage.date);
          setSelectedYear(year);
          setSelectedMonth(month - 1);
        }
      } catch (error) {
        console.error("Failed to load messages.json", error);
        setLoadError("Unable to load wisdom messages. Please check public/data/messages.json.");
      } finally {
        setLoading(false);
      }
    }

    loadMessages();
  }, []);

  const messageByDate = useMemo(() => {
    return messages.reduce((acc, item) => {
      acc[item.date] = item;
      return acc;
    }, {});
  }, [messages]);

  const selectedMessage = messageByDate[selectedDateKey];
  const todayMessage =
  messageByDate[todayKey] || messages[messages.length - 1] || null;


  const calendarDays = getCalendarDays(selectedYear, selectedMonth);

  const availableYears = useMemo(() => {
  const years = Array.from(
    new Set(messages.map((m) => Number(m.year || m.date.slice(0, 4))))
  ).sort((a, b) => b - a);

  return years.length ? years : [today.getFullYear()];
}, [messages, today]);


  const onThisDayMessages = useMemo(() => {
    const [, selectedMonthPart, selectedDayPart] = selectedDateKey.split("-");

    return messages
      .filter((m) => m.date.slice(5) === `${selectedMonthPart}-${selectedDayPart}`)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [messages, selectedDateKey]);

  function moveMonth(delta) {
    const next = new Date(selectedYear, selectedMonth + delta, 1);
    setSelectedYear(next.getFullYear());
    setSelectedMonth(next.getMonth());
  }

  function pickDate(date) {
    if (!date) return;
    setSelectedDateKey(toDateKey(date));
  }

  function selectRandomWisdom() {
    if (!messages.length) return;

    const next = messages[Math.floor(Math.random() * messages.length)];
    const [year, month] = next.date.split("-").map(Number);

    setSelectedDateKey(next.date);
    setSelectedYear(year);
    setSelectedMonth(month - 1);
  }

  if (loading) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#faf7ef] px-4 text-center text-[#2f2a24]">
      <div>
        <p className="font-serif text-3xl">Loading wisdom messages...</p>
        <p className="mt-3 text-sm text-[#7a6a58]">
          Preparing The Wisdom Calendar.
        </p>
      </div>
    </div>
  );
}

if (loadError) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#faf7ef] px-4 text-center text-[#2f2a24]">
      <div className="max-w-md rounded-2xl border border-[#e7dcc8] bg-[#fffdf7] p-6 shadow-sm">
        <p className="font-serif text-2xl">Messages could not be loaded</p>
        <p className="mt-3 text-sm leading-6 text-[#7a6a58]">{loadError}</p>
      </div>
    </div>
  );
}

return (
  <div className="min-h-screen bg-[#faf7ef] text-[#2f2a24]">
      <div className="mx-auto max-w-6xl px-3 py-5 sm:px-5 sm:py-7 md:px-8 md:py-12">
        <div className="mb-1 text-center -mt-1">
  <span className="inline-block rounded px-3 py-0.5 text-xs tracking-wide text-[#9b8565]">
    ॐ श्री गुरवे नमः
  </span>
</div>
        <header className="mb-7 border-b border-[#e6dcc8] pb-6 text-center md:text-left">
          <div className="mb-3 flex items-center justify-center gap-2 text-[#9b8565] md:justify-start">
            <Sparkles className="h-4 w-4" />
            
            <span className="text-[10px] uppercase tracking-[0.24em] sm:text-xs sm:tracking-[0.35em] text-[#9b8565]">
              A Daily Archive of Self Knowledge From Gurudev
            </span>
          </div>

          <h1 className="font-serif text-4xl leading-tight tracking-tight text-[#2f2a24] sm:text-5xl md:text-7xl">
            The Wisdom Calendar
          </h1>

          <p className="mt-4 max-w-2xl text-base leading-7 text-[#7a6a58] md:text-lg">
            Morning messages preserved with simplicity, reverence, and space for quiet contemplation.
          </p>
        </header>

        <main className="grid gap-8 pb-10">
          <section className="grid gap-5 md:grid-cols-[1.2fr_0.8fr]">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <WisdomCard message={todayMessage} title="Today’s Wisdom" />
            </motion.div>

            <Card className="rounded-2xl border-[#e7dcc8] bg-[#fffdf7] shadow-sm">
              <CardContent className="flex h-full flex-col justify-between p-5 sm:p-7">
                <div>
                  <p className="text-sm uppercase tracking-[0.25em] text-[#9b8565]">
                    Begin Here
                  </p>

                  <h3 className="mt-3 font-serif text-3xl">
                    Read. Pause. Return.
                  </h3>

                  <p className="mt-4 leading-7 text-[#7a6a58]">
                    Read one message at a time. Let it settle.<br/>
                    Return when you are called again.
                  </p>
                </div>

                <div className="mt-6 flex flex-wrap gap-3">
                  <Button
                    onClick={() =>
                      document.getElementById("calendar")?.scrollIntoView({
                        behavior: "smooth"
                      })
                    }
                    className="rounded-full bg-[#2f2a24] px-5 text-[#fffdf7] hover:bg-[#4a3f33]"
                  >
                    <CalendarDays className="mr-2 h-4 w-4" />
                    Browse Calendar
                  </Button>

                  <Button
                    onClick={selectRandomWisdom}
                    className="rounded-full border border-[#d8c9ad] bg-transparent px-5 text-[#4d4236] hover:bg-[#f5ecd8]"
                  >
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Random Wisdom
                  </Button>
                </div>
              </CardContent>
            </Card>
          </section>

          <section id="calendar" className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">
            <Card className="rounded-2xl border-[#e7dcc8] bg-[#fffdf7] shadow-sm">
              <CardContent className="p-4 sm:p-6 md:p-8">
                <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm uppercase tracking-[0.25em] text-[#9b8565]">
                      Browse Archive
                    </p>

                    <h2 className="mt-2 font-serif text-3xl">
                      {monthNames[selectedMonth]} {selectedYear}
                    </h2>
                  </div>

                  <div className="grid grid-cols-[auto_1fr_1fr_auto] items-center gap-2 sm:flex sm:flex-wrap">
                    <Button
                      onClick={() => moveMonth(-1)}
                      className="rounded-full border border-[#d8c9ad] bg-transparent hover:bg-[#f5ecd8]"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>

                    <select
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(Number(e.target.value))}
                      className="min-w-0 rounded-full border border-[#d8c9ad] bg-[#fffdf7] px-3 py-2 text-sm outline-none"
                    >
                      {monthNames.map((month, index) => (
                        <option key={month} value={index}>
                          {month}
                        </option>
                      ))}
                    </select>

                    <select
                      value={selectedYear}
                      onChange={(e) => setSelectedYear(Number(e.target.value))}
                      className="min-w-0 rounded-full border border-[#d8c9ad] bg-[#fffdf7] px-3 py-2 text-sm outline-none"
                    >
                      {availableYears.map((year) => (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      ))}
                    </select>

                    <Button
                      onClick={() => moveMonth(1)}
                      className="rounded-full border border-[#d8c9ad] bg-transparent hover:bg-[#f5ecd8]"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-7 gap-1 text-center text-[10px] uppercase tracking-widest text-[#9b8565] sm:gap-2 sm:text-xs">
                  {weekdayLabels.map((day) => (
                    <div key={day} className="py-2">
                      {day}
                    </div>
                  ))}
                </div>

                <div className="mt-2 grid grid-cols-7 gap-1 sm:gap-2">
                  {calendarDays.map((date, index) => {
                    const key = date ? toDateKey(date) : `empty-${index}`;
                    const dateKey = date ? toDateKey(date) : null;
                    const hasMessage = dateKey && messageByDate[dateKey];
                    const isSelected = dateKey === selectedDateKey;

                    return (
                      <button
                        key={key}
                        disabled={!date}
                        onClick={() => pickDate(date)}
                        className={`relative aspect-square min-h-10 rounded-xl border p-1 text-xs transition sm:min-h-14 sm:rounded-2xl sm:p-2 sm:text-sm ${
                          !date
                            ? "border-transparent opacity-0"
                            : "border-[#eadfca] hover:bg-[#f6eddc]"
                        } ${
                          isSelected
                            ? "bg-[#f3e8c8] shadow-sm"
                            : "bg-[#fffdf7]"
                        }`}
                      >
                        {date && <span>{date.getDate()}</span>}

                        {hasMessage && (
                          <span className="absolute bottom-2 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-[#b89b5e]" />
                        )}
                      </button>
                    );
                  })}
                </div>

                <p className="mt-5 text-sm text-[#7a6a58]">
                  <span className="inline-block h-2 w-2 rounded-full bg-[#b89b5e]" />{" "}
                  indicates a message is available.
                </p>
              </CardContent>
            </Card>

            <div className="grid gap-6">
              <WisdomCard message={selectedMessage} title="Selected Message" />

              <Card className="rounded-2xl border-[#e7dcc8] bg-[#fffdf7] shadow-sm">
                <CardContent className="p-4 sm:p-6 md:p-8">
                  <p className="text-sm uppercase tracking-[0.25em] text-[#9b8565]">
                    On This Day
                  </p>

                  <h2 className="mt-2 font-serif text-3xl">
                    Through the Years
                  </h2>

                  <div className="mt-6 grid gap-4">
                    {onThisDayMessages.length ? (
                      onThisDayMessages.map((message) => (
                        <button
                          key={message.id}
                          onClick={() => setSelectedDateKey(message.date)}
                          className="rounded-2xl border border-[#eadfca] bg-[#fffaf0] p-5 text-left hover:bg-[#f6eddc]"
                        >
                          <div className="mb-2 flex items-center justify-between gap-3">
                            <span className="font-serif text-xl">
                              {message.year}
                            </span>
                            <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs text-amber-800">
                              {message.closing}
                            </span>
                          </div>

                          <p className="line-clamp-3 font-serif text-lg leading-relaxed text-[#4d4236]">
                            “{message.text}”
                          </p>
                        </button>
                      ))
                    ) : (
                      <p className="rounded-2xl border border-[#eadfca] bg-[#fffaf0] p-5 text-[#7a6a58]">
                        No other messages found for this date.
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}