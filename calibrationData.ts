
import { RGS_50_TABLE } from './rgs50Table';
import { RGS_100_TABLE } from './rgs100Table';
import { GT_66_TABLE } from './gt66Table';
import { GT_72_TABLE } from './gt72Table';
import { GT_81_TABLE } from './gt81Table';
import { GT_90_TABLE } from './gt90Table';
import { GT_92_TABLE } from './gt92Table';

// Ре-экспорт таблиц для использования в других частях приложения (например, excelUtils)
export { RGS_50_TABLE, RGS_100_TABLE, GT_66_TABLE, GT_72_TABLE, GT_81_TABLE, GT_90_TABLE, GT_92_TABLE };

/**
 * Функция для получения объема по таблице.
 * Если точного значения высоты нет в таблице, выполняет линейную интерполяцию.
 */
export const getVolume = (table: Record<number, number>, level: number): number => {
    // 1. Если есть точное совпадение - возвращаем его
    if (table[level] !== undefined) {
        return table[level];
    }
    
    // Получаем список всех высот из таблицы
    const levels = Object.keys(table).map(Number).sort((a, b) => a - b);
    
    if (levels.length === 0) return 0;

    // Защита: если уровень меньше минимума или больше максимума
    if (level <= levels[0]) return table[levels[0]];
    if (level >= levels[levels.length - 1]) return table[levels[levels.length - 1]];

    // 2. Ищем ближайшие точки для интерполяции (lower < level < upper)
    let lower = -1;
    let upper = -1;

    for (let i = 0; i < levels.length - 1; i++) {
        if (level > levels[i] && level < levels[i+1]) {
            lower = levels[i];
            upper = levels[i+1];
            break;
        }
    }

    // Если не нашли диапазон, возвращаем 0
    if (lower === -1 || upper === -1) return 0;

    const valLower = table[lower];
    const valUpper = table[upper];

    // Линейная интерполяция
    const fraction = (level - lower) / (upper - lower);
    const interpolatedValue = valLower + (valUpper - valLower) * fraction;

    return parseFloat(interpolatedValue.toFixed(2));
};
