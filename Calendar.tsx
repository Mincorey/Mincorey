import React, { useState } from 'react';

interface CalendarProps {
    selectedDates: Date[];
    onSelect: (dates: Date[]) => void;
}

const Calendar: React.FC<CalendarProps> = ({ selectedDates, onSelect }) => {
    const [currentMonth, setCurrentMonth] = useState(new Date());

    const getDaysInMonth = (date: Date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const days = new Date(year, month + 1, 0).getDate();
        return Array.from({ length: days }, (_, i) => new Date(year, month, i + 1));
    };

    const isSameDay = (d1: Date, d2: Date) => {
        return d1.getFullYear() === d2.getFullYear() &&
               d1.getMonth() === d2.getMonth() &&
               d1.getDate() === d2.getDate();
    };

    const handleDateClick = (date: Date) => {
        const isSelected = selectedDates.some(d => isSameDay(d, date));
        if (isSelected) {
            onSelect(selectedDates.filter(d => !isSameDay(d, date)));
        } else {
            onSelect([...selectedDates, date]);
        }
    };

    const prevMonth = () => {
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
    };

    const nextMonth = () => {
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
    };

    const days = getDaysInMonth(currentMonth);
    const firstDay = days[0].getDay(); // 0 (Sun) - 6 (Sat)
    // Adjust for Monday start (1) -> 0, Sunday (0) -> 6
    const startOffset = firstDay === 0 ? 6 : firstDay - 1; 
    const blanks = Array.from({ length: startOffset }, () => null);

    const monthNames = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
        "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"
    ];

    return (
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-lg w-full max-w-md mx-auto border border-gray-300 dark:border-gray-700">
            <div className="flex justify-between items-center mb-4">
                <button onClick={prevMonth} className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                    ◀
                </button>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                    {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                </h3>
                <button onClick={nextMonth} className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                    ▶
                </button>
            </div>
            
            <div className="grid grid-cols-7 gap-1 mb-2 text-center">
                {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map(day => (
                    <div key={day} className="text-gray-500 dark:text-gray-400 text-sm font-semibold py-1">
                        {day}
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
                {blanks.map((_, i) => (
                    <div key={`blank-${i}`} className="h-10"></div>
                ))}
                {days.map(date => {
                    const isSelected = selectedDates.some(d => isSameDay(d, date));
                    const isToday = isSameDay(new Date(), date);
                    
                    return (
                        <button
                            key={date.toISOString()}
                            onClick={() => handleDateClick(date)}
                            className={`h-10 w-10 rounded-full flex items-center justify-center text-sm font-medium transition-all
                                ${isSelected 
                                    ? 'bg-indigo-600 text-white shadow-md scale-110' 
                                    : 'text-gray-900 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white'}
                                ${isToday && !isSelected ? 'border border-indigo-500 text-indigo-600 dark:text-indigo-400' : ''}
                            `}
                        >
                            {date.getDate()}
                        </button>
                    );
                })}
            </div>
            
            <div className="mt-4 text-center text-gray-500 dark:text-gray-400 text-sm">
                Выбрано дат: <span className="text-gray-900 dark:text-white font-bold">{selectedDates.length}</span>
            </div>
        </div>
    );
};

export default Calendar;
