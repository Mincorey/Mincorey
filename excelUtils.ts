
import { RGS_50_TABLE, RGS_100_TABLE, GT_66_TABLE, GT_72_TABLE, GT_81_TABLE, GT_90_TABLE, GT_92_TABLE, RK_1_TABLE, getVolume } from './calibrationData';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

// ... (STYLES and MAPPINGS)

export const getInventoryMeasurementsData = (workbook: ExcelJS.Workbook) => {
    const ws = workbook.getWorksheet('Zamer_INVENT');
    if (!ws) return null;

    const getData = (tankName: string) => {
        const cells = TANK_CELLS_MAPPING[tankName];
        const avgCell = AVERAGE_MAPPING[tankName];
        const volCell = VOLUME_MAPPING[tankName];
        const massCell = MASS_MAPPING[tankName];

        return {
            name: tankName,
            m1: getCellValue(workbook, 'Zamer_INVENT', cells[0]),
            m2: getCellValue(workbook, 'Zamer_INVENT', cells[1]),
            m3: getCellValue(workbook, 'Zamer_INVENT', cells[2]),
            avg: getCellValue(workbook, 'Zamer_INVENT', avgCell),
            density: getCellValue(workbook, 'Zamer_INVENT', cells[3]),
            temp: getCellValue(workbook, 'Zamer_INVENT', cells[4]),
            volume: getCellValue(workbook, 'Zamer_INVENT', volCell),
            mass: getCellValue(workbook, 'Zamer_INVENT', massCell),
        };
    };

    const tanks50 = ['РГС-50 №1', 'РГС-50 №2', 'РГС-50 №3', 'РГС-50 №4', 'РГС-50 №5', 'РГС-50 №6', 'РГС-50 №7', 'РГС-50 №8'].map(getData);
    const tanks100 = ['РГС-100 №1', 'РГС-100 №2', 'РГС-100 №3', 'РГС-100 №4'].map(getData);

    const rk1 = {
        measurement: getCellValue(workbook, 'Zamer_INVENT', 'N25'),
        volume: getCellValue(workbook, 'Zamer_INVENT', 'N26'),
        mass: getCellValue(workbook, 'Zamer_INVENT', 'N27'),
    };

    const total50 = {
        volume: getCellValue(workbook, 'Zamer_INVENT', TOTALS_MAPPING_50.volume),
        mass: getCellValue(workbook, 'Zamer_INVENT', TOTALS_MAPPING_50.mass),
        avgDensity: getCellValue(workbook, 'Zamer_INVENT', TOTALS_MAPPING_50.avgDensity),
        avgTemp: getCellValue(workbook, 'Zamer_INVENT', TOTALS_MAPPING_50.avgTemp),
    };

    const total100 = {
        volume: getCellValue(workbook, 'Zamer_INVENT', TOTALS_MAPPING_100.volume),
        mass: getCellValue(workbook, 'Zamer_INVENT', TOTALS_MAPPING_100.mass),
        avgDensity: getCellValue(workbook, 'Zamer_INVENT', TOTALS_MAPPING_100.avgDensity),
        avgTemp: getCellValue(workbook, 'Zamer_INVENT', TOTALS_MAPPING_100.avgTemp),
    };

    const totalAll = {
        volume: getCellValue(workbook, 'Zamer_INVENT', TOTALS_MAPPING_ALL.volume),
        mass: getCellValue(workbook, 'Zamer_INVENT', TOTALS_MAPPING_ALL.mass),
        avgDensity: getCellValue(workbook, 'Zamer_INVENT', TOTALS_MAPPING_ALL.avgDensity),
        avgTemp: getCellValue(workbook, 'Zamer_INVENT', TOTALS_MAPPING_ALL.avgTemp),
    };
    
    // Calculate Total with RK-1
    const totalVolWithRk1 = (Number(totalAll.volume) || 0) + (Number(rk1.volume) || 0);
    const totalMassWithRk1 = (Number(totalAll.mass) || 0) + (Number(rk1.mass) || 0);

    return { tanks50, tanks100, rk1, total50, total100, totalAll, totalWithRk1: { volume: totalVolWithRk1, mass: totalMassWithRk1 } };
};

export const generateInventoryMeasurementsReport = async (workbook: ExcelJS.Workbook) => {
    const data = getInventoryMeasurementsData(workbook);
    if (!data) return;

    const reportWb = new ExcelJS.Workbook();
    const ws = reportWb.addWorksheet('Отчет');

    // Setup Columns (approximate widths based on image)
    ws.columns = [
        { width: 15 }, { width: 12 }, { width: 8 }, // Block 1
        { width: 15 }, { width: 12 }, { width: 8 }, // Block 2
        { width: 15 }, { width: 12 }, { width: 8 }, // Block 3
        { width: 15 }, { width: 12 }, { width: 8 }, // Block 4
    ];

    // Title
    ws.mergeCells('A1:K1');
    const titleCell = ws.getCell('A1');
    titleCell.value = 'КОНТРОЛЬНО-МЕТРОЛОГИЧЕСКИЕ ХАРАКТЕРИСТИКИ РЕЗЕРВУАРОВ СГСМ';
    titleCell.font = { bold: true, size: 14 };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC6EFCE' } }; // Light Green
    titleCell.border = { top: { style: 'medium' }, bottom: { style: 'medium' }, left: { style: 'medium' }, right: { style: 'medium' } };

    ws.getCell('L1').value = `Дата: ${new Date().toLocaleDateString('ru-RU')}`;
    ws.getCell('L1').font = { bold: true };
    ws.getCell('L1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC6EFCE' } };
    ws.getCell('L1').border = { top: { style: 'medium' }, bottom: { style: 'medium' }, left: { style: 'medium' }, right: { style: 'medium' } };

    // Helper to draw a tank block
    const drawTankBlock = (startRow: number, startCol: number, tankData: any) => {
        const r = startRow;
        const c = startCol;
        
        // Header
        ws.mergeCells(r, c, r, c + 2);
        const header = ws.getCell(r, c);
        header.value = tankData.name;
        header.style = STYLES.tankTitle; // Reuse existing style or define new
        header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC6EFCE' } }; // Light Green from image
        header.font = { bold: true, color: { argb: 'FF000000' } };
        header.border = { top: { style: 'medium' }, bottom: { style: 'medium' }, left: { style: 'medium' }, right: { style: 'medium' } };

        // Rows
        const rows = [
            { label: 'Взлив №1', value: tankData.m1, unit: 'мм.' },
            { label: 'Взлив №2', value: tankData.m2, unit: 'мм.' },
            { label: 'Взлив №3', value: tankData.m3, unit: 'мм.' },
            { label: 'Взлив ср.', value: tankData.avg, unit: 'мм.' },
            { label: 'Плотность', value: tankData.density, unit: 'г/см.куб.' },
            { label: 'Температура', value: tankData.temp, unit: 'гр.С' },
            { label: 'Объем', value: tankData.volume, unit: 'л.', bold: true },
            { label: 'Масса', value: tankData.mass, unit: 'кг.', bold: true },
        ];

        rows.forEach((row, idx) => {
            const currentRow = r + 1 + idx;
            const labelCell = ws.getCell(currentRow, c);
            const valueCell = ws.getCell(currentRow, c + 1);
            const unitCell = ws.getCell(currentRow, c + 2);

            labelCell.value = row.label;
            labelCell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'medium' }, right: { style: 'thin' } };
            if (row.bold) labelCell.font = { bold: true };

            valueCell.value = row.value;
            valueCell.alignment = { horizontal: 'right' };
            valueCell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
            if (row.bold) valueCell.font = { bold: true };

            unitCell.value = row.unit;
            unitCell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'medium' } };
        });
        
        // Bottom border for the block
        const lastRow = r + rows.length;
        ws.getCell(lastRow, c).border = { top: { style: 'thin' }, bottom: { style: 'medium' }, left: { style: 'medium' }, right: { style: 'thin' } };
        ws.getCell(lastRow, c+1).border = { top: { style: 'thin' }, bottom: { style: 'medium' }, left: { style: 'thin' }, right: { style: 'thin' } };
        ws.getCell(lastRow, c+2).border = { top: { style: 'thin' }, bottom: { style: 'medium' }, left: { style: 'thin' }, right: { style: 'medium' } };
    };

    // Draw RGS-50 (Rows 1-4)
    data.tanks50.slice(0, 4).forEach((tank, i) => drawTankBlock(3, 1 + i * 3, tank));
    // Draw RGS-50 (Rows 5-8)
    data.tanks50.slice(4, 8).forEach((tank, i) => drawTankBlock(13, 1 + i * 3, tank));

    // Draw Totals RGS-50
    const drawTotalBlock = (r: number, c: number, title: string, data: any, color: string) => {
        ws.mergeCells(r, c, r, c + 2);
        const h = ws.getCell(r, c);
        h.value = title;
        h.font = { bold: true };
        h.alignment = { horizontal: 'center' };
        h.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
        h.border = { top: { style: 'medium' }, bottom: { style: 'medium' }, left: { style: 'medium' }, right: { style: 'medium' } };

        const rows = [
            { label: 'ИТОГО Объем', value: data.volume, unit: 'л.' },
            { label: 'ИТОГО Масса', value: data.mass, unit: 'кг.' },
            { label: 'Средняя плотность', value: data.avgDensity, unit: 'г/см.куб.' },
            { label: 'Средняя температура', value: data.avgTemp, unit: 'гр.С' },
        ];

        rows.forEach((row, idx) => {
            const cr = r + 1 + idx;
            ws.getCell(cr, c).value = row.label;
            ws.getCell(cr, c).font = { bold: true };
            ws.getCell(cr, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
            ws.getCell(cr, c).border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'medium' }, right: { style: 'thin' } };

            ws.getCell(cr, c + 1).value = row.value;
            ws.getCell(cr, c + 1).alignment = { horizontal: 'right' };
            ws.getCell(cr, c + 1).font = { bold: true };
            ws.getCell(cr, c + 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
            ws.getCell(cr, c + 1).border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };

            ws.getCell(cr, c + 2).value = row.unit;
            ws.getCell(cr, c + 2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
            ws.getCell(cr, c + 2).border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'medium' } };
        });
        
        // Bottom border
        const lastRow = r + rows.length;
        ws.getCell(lastRow, c).border = { top: { style: 'thin' }, bottom: { style: 'medium' }, left: { style: 'medium' }, right: { style: 'thin' } };
        ws.getCell(lastRow, c+1).border = { top: { style: 'thin' }, bottom: { style: 'medium' }, left: { style: 'thin' }, right: { style: 'thin' } };
        ws.getCell(lastRow, c+2).border = { top: { style: 'thin' }, bottom: { style: 'medium' }, left: { style: 'thin' }, right: { style: 'medium' } };
    };

    drawTotalBlock(23, 1, 'ИТОГО ПО РГС-50', data.total50, 'FF6B8E23'); // Olive Drab

    // Draw RK-1
    const drawRk1Block = (r: number, c: number) => {
        ws.mergeCells(r, c, r, c + 2);
        const h = ws.getCell(r, c);
        h.value = 'РК-1';
        h.font = { bold: true };
        h.alignment = { horizontal: 'center' };
        h.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC6EFCE' } };
        h.border = { top: { style: 'medium' }, bottom: { style: 'medium' }, left: { style: 'medium' }, right: { style: 'medium' } };

        const rows = [
            { label: 'Взлив:', value: data.rk1.measurement, unit: 'мм.' },
            { label: 'Объем', value: data.rk1.volume, unit: 'л.', bold: true },
            { label: 'Масса', value: data.rk1.mass, unit: 'кг.', bold: true },
        ];

        rows.forEach((row, idx) => {
            const cr = r + 1 + idx;
            ws.getCell(cr, c).value = row.label;
            ws.getCell(cr, c).border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'medium' }, right: { style: 'thin' } };
            
            ws.getCell(cr, c + 1).value = row.value;
            ws.getCell(cr, c + 1).alignment = { horizontal: 'right' };
            if (row.bold) {
                ws.getCell(cr, c + 1).font = { bold: true };
                ws.getCell(cr, c).font = { bold: true };
                ws.getCell(cr, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE0B2' } }; // Light Orange
                ws.getCell(cr, c + 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE0B2' } };
                ws.getCell(cr, c + 2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE0B2' } };
            }
            ws.getCell(cr, c + 1).border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };

            ws.getCell(cr, c + 2).value = row.unit;
            ws.getCell(cr, c + 2).border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'medium' } };
        });
        
        // Fix borders for RK-1 block
        const lastRow = r + rows.length;
        ws.getCell(lastRow, c).border = { top: { style: 'thin' }, bottom: { style: 'medium' }, left: { style: 'medium' }, right: { style: 'thin' } };
        ws.getCell(lastRow, c+1).border = { top: { style: 'thin' }, bottom: { style: 'medium' }, left: { style: 'thin' }, right: { style: 'thin' } };
        ws.getCell(lastRow, c+2).border = { top: { style: 'thin' }, bottom: { style: 'medium' }, left: { style: 'thin' }, right: { style: 'medium' } };
    };

    drawRk1Block(23, 10);

    // Draw RGS-100 (Rows 1-4)
    data.tanks100.forEach((tank, i) => drawTankBlock(28, 1 + i * 3, tank));

    // Draw Totals RGS-100
    drawTotalBlock(38, 1, 'ИТОГО ПО РГС-100', data.total100, 'FF6B8E23');

    // Draw Total All
    const drawSimpleTotal = (r: number, c: number, title: string, vol: any, mass: any, den: any, temp: any, color: string) => {
        ws.mergeCells(r, c, r, c + 2);
        const h = ws.getCell(r, c);
        h.value = title;
        h.font = { bold: true };
        h.alignment = { horizontal: 'center' };
        h.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
        h.border = { top: { style: 'medium' }, bottom: { style: 'medium' }, left: { style: 'medium' }, right: { style: 'medium' } };

        const rows = [
            { label: 'ОБЪЕМ', value: vol, unit: 'л.' },
            { label: 'МАССА', value: mass, unit: 'кг.' },
        ];
        if (den) rows.push({ label: 'ПЛОТНОСТЬ СРЕДНЯЯ', value: den, unit: 'г/см.куб.' });
        if (temp) rows.push({ label: 'ТЕМПЕРАТУРА СРЕДНЯЯ', value: temp, unit: 'гр.С' });

        rows.forEach((row, idx) => {
            const cr = r + 1 + idx;
            ws.getCell(cr, c).value = row.label;
            ws.getCell(cr, c).font = { bold: true };
            ws.getCell(cr, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFBFEFFF' } }; // Light Blue
            ws.getCell(cr, c).border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'medium' }, right: { style: 'thin' } };

            ws.getCell(cr, c + 1).value = row.value;
            ws.getCell(cr, c + 1).alignment = { horizontal: 'right' };
            ws.getCell(cr, c + 1).font = { bold: true };
            ws.getCell(cr, c + 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFBFEFFF' } };
            ws.getCell(cr, c + 1).border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };

            ws.getCell(cr, c + 2).value = row.unit;
            ws.getCell(cr, c + 2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFBFEFFF' } };
            ws.getCell(cr, c + 2).border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'medium' } };
        });
        
        // Bottom border
        const lastRow = r + rows.length;
        ws.getCell(lastRow, c).border = { top: { style: 'thin' }, bottom: { style: 'medium' }, left: { style: 'medium' }, right: { style: 'thin' } };
        ws.getCell(lastRow, c+1).border = { top: { style: 'thin' }, bottom: { style: 'medium' }, left: { style: 'thin' }, right: { style: 'thin' } };
        ws.getCell(lastRow, c+2).border = { top: { style: 'thin' }, bottom: { style: 'medium' }, left: { style: 'thin' }, right: { style: 'medium' } };
    };

    drawSimpleTotal(38, 4, 'ИТОГО ПО ВСЕМ РГС', data.totalAll.volume, data.totalAll.mass, data.totalAll.avgDensity, data.totalAll.avgTemp, 'FF00BFFF'); // Deep Sky Blue
    
    // Draw Total with RK-1
    const drawRk1Total = (r: number, c: number, title: string, vol: any, mass: any) => {
        ws.mergeCells(r, c, r, c + 2);
        const h = ws.getCell(r, c);
        h.value = title;
        h.font = { bold: true };
        h.alignment = { horizontal: 'center' };
        h.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFD700' } }; // Gold
        h.border = { top: { style: 'medium' }, bottom: { style: 'medium' }, left: { style: 'medium' }, right: { style: 'medium' } };

        const rows = [
            { label: 'ОБЪЕМ', value: vol, unit: 'л.' },
            { label: 'МАССА', value: mass, unit: 'кг.' },
        ];

        rows.forEach((row, idx) => {
            const cr = r + 1 + idx;
            ws.getCell(cr, c).value = row.label;
            ws.getCell(cr, c).font = { bold: true };
            ws.getCell(cr, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF8DC' } }; // Cornsilk
            ws.getCell(cr, c).border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'medium' }, right: { style: 'thin' } };

            ws.getCell(cr, c + 1).value = row.value;
            ws.getCell(cr, c + 1).alignment = { horizontal: 'right' };
            ws.getCell(cr, c + 1).font = { bold: true };
            ws.getCell(cr, c + 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF8DC' } };
            ws.getCell(cr, c + 1).border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };

            ws.getCell(cr, c + 2).value = row.unit;
            ws.getCell(cr, c + 2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF8DC' } };
            ws.getCell(cr, c + 2).border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'medium' } };
        });
        
        // Bottom border
        const lastRow = r + rows.length;
        ws.getCell(lastRow, c).border = { top: { style: 'thin' }, bottom: { style: 'medium' }, left: { style: 'medium' }, right: { style: 'thin' } };
        ws.getCell(lastRow, c+1).border = { top: { style: 'thin' }, bottom: { style: 'medium' }, left: { style: 'thin' }, right: { style: 'thin' } };
        ws.getCell(lastRow, c+2).border = { top: { style: 'thin' }, bottom: { style: 'medium' }, left: { style: 'thin' }, right: { style: 'medium' } };
    };

    drawRk1Total(38, 7, 'ИТОГО С РК-1', data.totalWithRk1.volume, data.totalWithRk1.mass);

    // Save
    const buffer = await reportWb.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `Invent_Report_${new Date().toLocaleDateString('ru-RU')}.xlsx`);
};

// ... (existing code)

export const getPriemReportData = (workbook: ExcelJS.Workbook, dates: Date[]) => {
    const sheet = workbook.getWorksheet('Priem');
    if (!sheet) return { rows: [], totals: { l: 0, kg: 0 } };

    const rows: any[] = [];
    let totalL = 0;
    let totalKg = 0;

    sheet.eachRow((row, rowNumber) => {
        if (rowNumber < 3) return;
        const dateCell = row.getCell(1);
        const tankCell = row.getCell(2);
        const lCell = row.getCell(5);
        const kgCell = row.getCell(6);

        if (!dateCell.value) return;

        const rowDate = dateCell.value instanceof Date ? dateCell.value : new Date(String(dateCell.value));
        if (isNaN(rowDate.getTime())) return;

        const isMatch = dates.some(d => 
            d.getFullYear() === rowDate.getFullYear() &&
            d.getMonth() === rowDate.getMonth() &&
            d.getDate() === rowDate.getDate()
        );

        if (isMatch) {
            const l = Number(lCell.value) || 0;
            const kg = Number(kgCell.value) || 0;
            totalL += l;
            totalKg += kg;

            rows.push({
                date: rowDate.toLocaleDateString('ru-RU'),
                employee: getEmployeeForDate(workbook, rowDate),
                tank: String(tankCell.value),
                l,
                kg
            });
        }
    });

    return { rows, totals: { l: parseFloat(totalL.toFixed(2)), kg: parseFloat(totalKg.toFixed(2)) } };
};

export const getTzaReportData = (workbook: ExcelJS.Workbook, dates: Date[]) => {
    const sheet = workbook.getWorksheet('Vidacha_TZA');
    if (!sheet) return { rows: [], totals: { l: 0, kg: 0 } };

    const rows: any[] = [];
    let totalL = 0;
    let totalKg = 0;

    sheet.eachRow((row, rowNumber) => {
        if (rowNumber < 3) return;
        const dateCell = row.getCell(1);
        const tzaCell = row.getCell(2);
        const tankCell = row.getCell(3);
        const lCell = row.getCell(6);
        const kgCell = row.getCell(7);

        if (!dateCell.value) return;

        const rowDate = dateCell.value instanceof Date ? dateCell.value : new Date(String(dateCell.value));
        if (isNaN(rowDate.getTime())) return;

        const isMatch = dates.some(d => 
            d.getFullYear() === rowDate.getFullYear() &&
            d.getMonth() === rowDate.getMonth() &&
            d.getDate() === rowDate.getDate()
        );

        if (isMatch) {
            const l = Number(lCell.value) || 0;
            const kg = Number(kgCell.value) || 0;
            totalL += l;
            totalKg += kg;

            rows.push({
                date: rowDate.toLocaleDateString('ru-RU'),
                employee: getEmployeeForDate(workbook, rowDate),
                tza: String(tzaCell.value),
                tank: String(tankCell.value),
                l,
                kg
            });
        }
    });

    return { rows, totals: { l: parseFloat(totalL.toFixed(2)), kg: parseFloat(totalKg.toFixed(2)) } };
};

export const getVsReportData = (workbook: ExcelJS.Workbook, dates: Date[]) => {
    const sheet = workbook.getWorksheet('Vidacha_VS');
    if (!sheet) return { rows: [], totals: { l: 0, kg: 0 } };

    const rows: any[] = [];
    let totalL = 0;
    let totalKg = 0;

    sheet.eachRow((row, rowNumber) => {
        if (rowNumber < 3) return;
        const dateCell = row.getCell(1);
        const tzaCell = row.getCell(2);
        const couponCell = row.getCell(3);
        const lCell = row.getCell(7);
        const kgCell = row.getCell(8);

        if (!dateCell.value) return;

        const rowDate = dateCell.value instanceof Date ? dateCell.value : new Date(String(dateCell.value));
        if (isNaN(rowDate.getTime())) return;

        const isMatch = dates.some(d => 
            d.getFullYear() === rowDate.getFullYear() &&
            d.getMonth() === rowDate.getMonth() &&
            d.getDate() === rowDate.getDate()
        );

        if (isMatch) {
            const l = Number(lCell.value) || 0;
            const kg = Number(kgCell.value) || 0;
            totalL += l;
            totalKg += kg;

            rows.push({
                date: rowDate.toLocaleDateString('ru-RU'),
                employee: getEmployeeForDate(workbook, rowDate),
                tza: String(tzaCell.value),
                coupon: String(couponCell.value),
                l,
                kg
            });
        }
    });

    return { rows, totals: { l: parseFloat(totalL.toFixed(2)), kg: parseFloat(totalKg.toFixed(2)) } };
};

export const getSmenaReportData = (workbook: ExcelJS.Workbook, dates: Date[]) => {
    const sheet = workbook.getWorksheet('SMENA');
    if (!sheet) return { rows: [], totals: { receivedL: 0, receivedKg: 0, issuedTzaL: 0, issuedTzaKg: 0, issuedVsL: 0, issuedVsKg: 0 } };

    const rows: any[] = [];
    let totalReceivedL = 0;
    let totalReceivedKg = 0;
    let totalIssuedTzaL = 0;
    let totalIssuedTzaKg = 0;
    let totalIssuedVsL = 0;
    let totalIssuedVsKg = 0;

    sheet.eachRow((row, rowNumber) => {
        if (rowNumber < 3) return;
        const dateCell = row.getCell(1);
        
        if (!dateCell.value) return;

        const rowDate = dateCell.value instanceof Date ? dateCell.value : new Date(String(dateCell.value));
        if (isNaN(rowDate.getTime())) return;

        const isMatch = dates.some(d => 
            d.getFullYear() === rowDate.getFullYear() &&
            d.getMonth() === rowDate.getMonth() &&
            d.getDate() === rowDate.getDate()
        );

        if (isMatch) {
            const employee = String(row.getCell(2).value || 'Неизвестно');
            const receivedL = Number(row.getCell(3).value) || 0;
            const receivedKg = Number(row.getCell(4).value) || 0;
            const issuedTzaL = Number(row.getCell(5).value) || 0;
            const issuedTzaKg = Number(row.getCell(6).value) || 0;
            const issuedVsL = Number(row.getCell(7).value) || 0;
            const issuedVsKg = Number(row.getCell(8).value) || 0;

            totalReceivedL += receivedL;
            totalReceivedKg += receivedKg;
            totalIssuedTzaL += issuedTzaL;
            totalIssuedTzaKg += issuedTzaKg;
            totalIssuedVsL += issuedVsL;
            totalIssuedVsKg += issuedVsKg;

            rows.push({
                date: rowDate.toLocaleDateString('ru-RU'),
                employee,
                receivedL,
                receivedKg,
                issuedTzaL,
                issuedTzaKg,
                issuedVsL,
                issuedVsKg
            });
        }
    });

    return { 
        rows, 
        totals: { 
            receivedL: parseFloat(totalReceivedL.toFixed(2)), 
            receivedKg: parseFloat(totalReceivedKg.toFixed(2)),
            issuedTzaL: parseFloat(totalIssuedTzaL.toFixed(2)),
            issuedTzaKg: parseFloat(totalIssuedTzaKg.toFixed(2)),
            issuedVsL: parseFloat(totalIssuedVsL.toFixed(2)),
            issuedVsKg: parseFloat(totalIssuedVsKg.toFixed(2))
        } 
    };
};

export const getBalanceReportData = (workbook: ExcelJS.Workbook, tanks: string[], reportType: 'all' | 'all50' | 'all100' | 'custom') => {
    const reportData = tanks.map(tank => getTankFullData(workbook, tank));
    
    // Calculate totals manually for ALL cases as per user request (formulas don't work)
    
    let totalVolume = 0;
    let totalMass = 0;
    let avgDensity = 0;
    let avgTemp = 0;

    // Sum volumes and masses
    totalVolume = reportData.reduce((acc, item) => acc + (item.volume || 0), 0);
    totalMass = reportData.reduce((acc, item) => acc + (item.mass || 0), 0);

    // Average density and temp (excluding zeros/empty if needed, but simple average for now as per request "Средняя ... по этим ... резервуарам")
    // We filter out items with 0 density for the average calculation to avoid skewing results with empty tanks
    
    const validDensityItems = reportData.filter(item => Number(item.density) > 0);
    const validTempItems = reportData.filter(item => Number(item.density) > 0); // Assuming if density > 0, temp is valid measurement.

    if (validDensityItems.length > 0) {
        avgDensity = validDensityItems.reduce((acc, item) => acc + Number(item.density), 0) / validDensityItems.length;
    }

    if (validTempItems.length > 0) {
        avgTemp = validTempItems.reduce((acc, item) => acc + Number(item.temp), 0) / validTempItems.length;
    }

    // Rounding
    totalVolume = parseFloat(totalVolume.toFixed(2));
    totalMass = parseFloat(totalMass.toFixed(2));
    avgDensity = parseFloat(avgDensity.toFixed(4));
    avgTemp = parseFloat(avgTemp.toFixed(1));

    return {
        tanks: reportData,
        totals: {
            volume: totalVolume,
            mass: totalMass,
            avgDensity,
            avgTemp
        }
    };
};

// Helper to get column letter from index (1-based)
// ExcelJS handles this internally usually, but for mapping logic we might need it.
// Actually ExcelJS works fine with 'A1' strings.

export const initZamerSheet = (wb: ExcelJS.Workbook, sheetName: string) => {
    const wsZamer = wb.addWorksheet(sheetName);
    wsZamer.columns = [
        { width: 18 }, { width: 12 }, { width: 5 },
        { width: 18 }, { width: 12 }, { width: 5 },
        { width: 18 }, { width: 12 }, { width: 5 },
        { width: 18 }, { width: 12 }
    ];
    wsZamer.getCell('A1').value = sheetName === 'Zamer_INVENT' ? 'ЛИСТ ИНВЕНТАРИЗАЦИИ' : 'ЛИСТ ЗАМЕРОВ ТОПЛИВА (ОСТАТКИ)';
    wsZamer.getCell('A1').font = { bold: true, size: 16, color: { argb: "FF4338CA" } };

    Object.keys(TANK_CELLS_MAPPING).forEach(tankName => {
        const inputCells = TANK_CELLS_MAPPING[tankName];
        // Parse first cell to find anchor
        const firstCell = wsZamer.getCell(inputCells[0]);
        const startRow = Number(firstCell.row);
        const dataCol = Number(firstCell.col);
        const labelCol = dataCol - 1;

        // Title
        const titleRow = startRow - 1;
        const titleCell = wsZamer.getCell(titleRow, labelCol);
        titleCell.value = tankName;
        titleCell.style = STYLES.tankTitle;
        wsZamer.mergeCells(titleRow, labelCol, titleRow, dataCol);

        // Labels
        const labels = ['Метршток 1 (мм)', 'Метршток 2 (мм)', 'Метршток 3 (мм)'];
        inputCells.slice(0, 3).forEach((addr, idx) => {
            const cell = wsZamer.getCell(addr);
            const labelCell = wsZamer.getCell(Number(cell.row), labelCol);
            labelCell.value = labels[idx];
            labelCell.style = STYLES.labelRight;
            cell.style = STYLES.cellNormal;
        });

        // Average
        const avgAddr = AVERAGE_MAPPING[tankName];
        if (avgAddr) {
            const cell = wsZamer.getCell(avgAddr);
            const labelCell = wsZamer.getCell(Number(cell.row), labelCol);
            labelCell.value = 'СРЕДНЕЕ (мм)';
            labelCell.font = { bold: true };
            labelCell.alignment = { horizontal: 'right' };
            cell.style = STYLES.cellHighlight;
        }

        // Density & Temp
        const denAddr = inputCells[3];
        const tempAddr = inputCells[4];
        
        const denCell = wsZamer.getCell(denAddr);
        wsZamer.getCell(Number(denCell.row), labelCol).value = 'Плотность';
        wsZamer.getCell(Number(denCell.row), labelCol).style = STYLES.labelRight;
        denCell.style = STYLES.cellNormal;

        const tempCell = wsZamer.getCell(tempAddr);
        wsZamer.getCell(Number(tempCell.row), labelCol).value = 'Температура';
        wsZamer.getCell(Number(tempCell.row), labelCol).style = STYLES.labelRight;
        tempCell.style = STYLES.cellNormal;

        // Volume & Mass
        const volAddr = VOLUME_MAPPING[tankName];
        const massAddr = MASS_MAPPING[tankName];

        if (volAddr) {
            const cell = wsZamer.getCell(volAddr);
            const labelCell = wsZamer.getCell(Number(cell.row), labelCol);
            labelCell.value = 'ОБЪЕМ (Л)';
            labelCell.font = { bold: true, color: { argb: "FF059669" } };
            labelCell.alignment = { horizontal: 'right' };
            cell.style = STYLES.cellHighlight;
        }
        if (massAddr) {
            const cell = wsZamer.getCell(massAddr);
            const labelCell = wsZamer.getCell(Number(cell.row), labelCol);
            labelCell.value = 'МАССА (КГ)';
            labelCell.font = { bold: true, color: { argb: "FFD97706" } };
            labelCell.alignment = { horizontal: 'right' };
            cell.style = STYLES.cellHighlight;
        }
    });
};

export const ensureInventorySheet = (wb: ExcelJS.Workbook): boolean => {
    const sheetName = 'Zamer_INVENT';
    if (!wb.getWorksheet(sheetName)) {
        initZamerSheet(wb, sheetName);
        return true;
    }
    return false;
};

export const ensureRk1Sheet = (wb: ExcelJS.Workbook): boolean => {
    let ws = wb.getWorksheet('RK_1');
    if (!ws) {
        ws = wb.addWorksheet('RK_1');
        ws.columns = [
            { header: 'Взлив (мм)', key: 'mm', width: 15 },
            { header: 'Объем (л)', key: 'liters', width: 15 }
        ];
    }
    
    // Check if we need to repopulate. 
    // The correct table has 800 entries + 1 header = 801 rows.
    // If it differs, we repopulate.
    const expectedRows = Object.keys(RK_1_TABLE).length + 1;
    
    if (ws.rowCount !== expectedRows) {
        console.log(`Updating RK_1 sheet. Current rows: ${ws.rowCount}, Expected: ${expectedRows}`);
        // Clear existing rows (keep header)
        if (ws.rowCount > 1) {
            ws.spliceRows(2, ws.rowCount - 1);
        }
        
        // Populate with real data from RK_1_TABLE
        Object.entries(RK_1_TABLE).forEach(([mm, liters]) => {
            ws!.addRow({ mm: Number(mm), liters: liters });
        });
        return true;
    }
    return false;
};

export const createNewWorkbook = (): ExcelJS.Workbook => {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'SGSM App';
    wb.created = new Date();

    // 1. Лист SMENA
    const wsSmena = wb.addWorksheet('SMENA');
    wsSmena.columns = [
        { key: 'date', width: 15 },
        { key: 'employee', width: 25 },
        { key: 'receivedL', width: 15 },
        { key: 'receivedKg', width: 15 },
        { key: 'issuedTzaL', width: 18 },
        { key: 'issuedTzaKg', width: 18 },
        { key: 'issuedVsL', width: 18 },
        { key: 'issuedVsKg', width: 18 },
        { key: 'status', width: 12 }
    ];
    
    // Add Title Row manually at row 1
    wsSmena.getRow(1).values = ['СВОДНЫЙ ЖУРНАЛ СМЕН'];
    wsSmena.mergeCells('A1:I1');
    wsSmena.getCell('A1').font = { bold: true, size: 14 };
    wsSmena.getCell('A1').alignment = { horizontal: 'center' };

    // Header Row at row 2
    wsSmena.getRow(2).values = ['Дата', 'Сотрудник', 'Принято (л)', 'Принято (кг)', 'Выдано ТЗА (л)', 'Выдано ТЗА (кг)', 'Выдано ВС (л)', 'Выдано ВС (кг)', 'Статус'];
    wsSmena.getRow(2).eachCell((cell) => {
        cell.style = STYLES.header;
    });

    // 2. Лист Zamer
    initZamerSheet(wb, 'Zamer');

    // 3. Лист Vidacha_TZA
    const wsTza = wb.addWorksheet('Vidacha_TZA');
    wsTza.columns = [
        { width: 12 }, { width: 10 }, { width: 15 }, { width: 15 }, { width: 15 }, { width: 12 }, { width: 12 }
    ];
    wsTza.getCell('A1').value = 'ЖУРНАЛ ВЫДАЧИ В ТЗА';
    wsTza.getCell('A1').font = { bold: true, size: 14 };
    wsTza.getRow(2).values = ['Дата', 'ТЗА №', 'Резервуар', 'Счетчик ДО', 'Счетчик ПОСЛЕ', 'Выдано (л)', 'Выдано (кг)'];
    wsTza.getRow(2).eachCell(cell => cell.style = STYLES.header);

    // 4. Лист Priem
    const wsPriem = wb.addWorksheet('Priem');
    wsPriem.columns = [
        { width: 12 }, { width: 15 }, { width: 15 }, { width: 15 }, { width: 15 }, { width: 15 }
    ];
    wsPriem.getCell('A1').value = 'ЖУРНАЛ ПРИЕМА ТОПЛИВА';
    wsPriem.getCell('A1').font = { bold: true, size: 14 };
    wsPriem.getRow(2).values = ['Дата', 'Резервуар', 'Счетчик ДО', 'Счетчик ПОСЛЕ', 'Принято (л)', 'Принято (кг)'];
    wsPriem.getRow(2).eachCell(cell => cell.style = STYLES.header);

    // 5. Лист Vidacha_VS
    const wsVs = wb.addWorksheet('Vidacha_VS');
    wsVs.columns = [
        { width: 12 }, { width: 10 }, { width: 10 }, { width: 15 }, { width: 15 }, { width: 10 }, { width: 12 }, { width: 12 }
    ];
    wsVs.getCell('A1').value = 'ЖУРНАЛ ВЫДАЧИ В ВС';
    wsVs.getCell('A1').font = { bold: true, size: 14 };
    wsVs.getRow(2).values = ['Дата', '№ ТЗА', 'Талон №', 'Счетчик ДО', 'Счетчик ПОСЛЕ', 'Плотность', 'Выдано (л)', 'Выдано (кг)'];
    wsVs.getRow(2).eachCell(cell => cell.style = STYLES.header);

    // 6. Лист Priem_Vagon
    const wsJdc = wb.addWorksheet('Priem_Vagon');
    wsJdc.columns = [
        { width: 12 }, { width: 8 }, { width: 12 }, { width: 15 }, { width: 15 }, { width: 12 }, { width: 12 }, { width: 15 }, { width: 15 }
    ];
    wsJdc.getCell('A1').value = 'ЖУРНАЛ ЗАМЕРОВ ЖД ЦИСТЕРН';
    wsJdc.getCell('A1').font = { bold: true, size: 14 };
    wsJdc.getRow(2).values = ['Дата', 'Время', 'Тип вагона', '№ Вагона', 'Взлив средний', 'Плотность', 'Температура', 'Объем (л)', 'Масса (кг)'];
    wsJdc.getRow(2).eachCell(cell => cell.style = STYLES.header);

    // 7. Лист RK_1 (Калибровочная таблица)
    const wsRk1 = wb.addWorksheet('RK_1');
    wsRk1.columns = [
        { header: 'Взлив (мм)', key: 'mm', width: 15 },
        { header: 'Объем (л)', key: 'liters', width: 15 }
    ];
    
    // Populate with real data from RK_1_TABLE
    Object.entries(RK_1_TABLE).forEach(([mm, liters]) => {
        wsRk1.addRow({ mm: Number(mm), liters: liters });
    });

    return wb;
};

export const saveRk1Measurement = (workbook: ExcelJS.Workbook, measurementMm: number): { volume: number, mass: number, avgDensity: number } | null => {
    const wsInvent = workbook.getWorksheet('Zamer_INVENT');
    const wsRk1 = workbook.getWorksheet('RK_1');
    
    if (!wsInvent || !wsRk1) return null;

    // 1. Save measurement to N25
    setCellValue(workbook, 'Zamer_INVENT', 'N25', measurementMm, STYLES.cellNormal);

    // 2. Lookup volume in RK_1
    let volume = 0;
    let found = false;
    wsRk1.eachRow((row, rowNumber) => {
        if (found) return;
        const mmCell = row.getCell(1);
        const volCell = row.getCell(2);
        if (mmCell.value == measurementMm) {
            volume = Number(volCell.value) || 0;
            found = true;
        }
    });

    // If not found exact match, maybe interpolation? 
    // For now, simple lookup as requested "ищется в этом столбце это значение"
    
    // Round volume to 2 decimal places
    volume = parseFloat(volume.toFixed(2));
    
    // 3. Save volume to N26
    setCellValue(workbook, 'Zamer_INVENT', 'N26', volume, STYLES.cellHighlight);

    // 4. Calculate average density from Zamer_INVENT
    let totalDensity = 0;
    let count = 0;
    
    // Iterate through all tanks in TANK_CELLS_MAPPING to find densities
    Object.keys(TANK_CELLS_MAPPING).forEach(tankName => {
        const cells = TANK_CELLS_MAPPING[tankName];
        const denAddr = cells[3]; // Density cell address
        const denVal = getCellValue(workbook, 'Zamer_INVENT', denAddr);
        const den = parseFloat(String(denVal));
        if (!isNaN(den) && den > 0) {
            totalDensity += den;
            count++;
        }
    });

    const avgDensity = count > 0 ? totalDensity / count : 0;

    // 5. Calculate Mass
    const mass = parseFloat((volume * avgDensity).toFixed(2));

    // 6. Save mass to N27
    setCellValue(workbook, 'Zamer_INVENT', 'N27', mass, STYLES.cellHighlight);

    return { volume, mass, avgDensity };
};

export const workbookToArrayBuffer = async (workbook: ExcelJS.Workbook): Promise<ArrayBuffer> => {
    const buffer = await workbook.xlsx.writeBuffer();
    // In browser, exceljs might return ArrayBuffer directly or a Buffer polyfill
    if (buffer instanceof ArrayBuffer) {
        return buffer;
    }
    // If it's a Buffer/Uint8Array, extract the ArrayBuffer
    return new Uint8Array(buffer).buffer;
};

export const getCellValue = (workbook: ExcelJS.Workbook, sheetName: string, cellAddress: string) => {
  const sheet = workbook.getWorksheet(sheetName);
  if (!sheet) return null;
  const cell = sheet.getCell(cellAddress);
  return cell ? cell.value : null;
};

export const setCellValue = (workbook: ExcelJS.Workbook, sheetName: string, cellAddress: string, value: any, style?: Partial<ExcelJS.Style>) => {
    let sheet = workbook.getWorksheet(sheetName);
    if (!sheet) {
        sheet = workbook.addWorksheet(sheetName);
    }
    const cell = sheet.getCell(cellAddress);
    cell.value = value;
    
    if (style) {
        cell.style = { ...cell.style, ...style };
    } else {
        if (sheetName !== 'Zamer') {
            cell.style = { ...cell.style, ...STYLES.cellNormal };
        }
    }
};

export const saveExcelFile = async (workbook: ExcelJS.Workbook, filename: string) => {
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, filename);
};

export const findUnclosedShift = (workbook: ExcelJS.Workbook): { row: number, employee: string, date: string } | null => {
    const sheet = workbook.getWorksheet('SMENA');
    if (!sheet) return null;
    
    let result = null;
    sheet.eachRow((row, rowNumber) => {
        if (rowNumber < 3) return;
        const dateCell = row.getCell(1); // A
        const nameCell = row.getCell(2); // B
        const statusCell = row.getCell(9); // I
        
        if (statusCell.value === 'Открыта') {
            let dStr = "Неизвестная дата";
            if (dateCell.value instanceof Date) dStr = dateCell.value.toLocaleDateString('ru-RU');
            else if (typeof dateCell.value === 'string') dStr = dateCell.value;
            
            result = {
                row: rowNumber,
                employee: String(nameCell.value),
                date: dStr
            };
        }
    });
    return result;
};

export const findShiftRowForToday = (workbook: ExcelJS.Workbook): { row: number, employee: string } | null => {
    const sheet = workbook.getWorksheet('SMENA');
    if (!sheet) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let result = null;
    sheet.eachRow((row, rowNumber) => {
        if (rowNumber < 3) return;
        const dateCell = row.getCell(1);
        const employeeCell = row.getCell(2);
        const statusCell = row.getCell(9);
        
        if (!dateCell.value) return;
        let cellDate: Date | null = null;
        if (dateCell.value instanceof Date) cellDate = new Date(dateCell.value);
        else if (typeof dateCell.value === 'string') {
            const parsed = Date.parse(dateCell.value);
            if (!isNaN(parsed)) cellDate = new Date(parsed);
        }
        
        if (cellDate) {
            cellDate.setHours(0, 0, 0, 0);
            if (cellDate.getTime() === today.getTime() && statusCell.value === 'Открыта') {
                result = { row: rowNumber, employee: employeeCell.value ? String(employeeCell.value) : "Неизвестный" };
            }
        }
    });
    return result;
};

const isSameDate = (date1: any, date2: Date): boolean => {
    if (!date1) return false;
    let d1: Date | null = null;
    if (date1 instanceof Date) d1 = date1;
    else if (typeof date1 === 'string') {
        // Handle dd.mm.yyyy format from ru-RU locale
        const parts = date1.split('.');
        if (parts.length === 3) {
            const parsed = Date.parse(`${parts[2]}-${parts[1]}-${parts[0]}`);
            if (!isNaN(parsed)) d1 = new Date(parsed);
        } else {
            const parsed = Date.parse(date1);
            if (!isNaN(parsed)) d1 = new Date(parsed);
        }
    }
    
    if (d1) {
        d1.setHours(0, 0, 0, 0);
        const d2 = new Date(date2);
        d2.setHours(0, 0, 0, 0);
        return d1.getTime() === d2.getTime();
    }
    return false;
};

const getEmployeeForDate = (workbook: ExcelJS.Workbook, date: Date): string => {
    const sheet = workbook.getWorksheet('SMENA');
    if (!sheet) return 'Неизвестно';

    let employee = 'Не найдено';
    sheet.eachRow((row, rowNumber) => {
        if (rowNumber < 3) return;
        const dateCell = row.getCell(1);
        if (isSameDate(dateCell.value, date)) {
            employee = String(row.getCell(2).value) || 'Неизвестно';
        }
    });
    return employee;
};

const recalculateShiftTotals = (workbook: ExcelJS.Workbook, targetDate: Date) => {
    const sheetSmena = workbook.getWorksheet('SMENA');
    if (!sheetSmena) return;

    let targetRow = -1;
    sheetSmena.eachRow((row, rowNumber) => {
        if (rowNumber < 3) return;
        const cell = row.getCell(1);
        if (isSameDate(cell.value, targetDate)) {
            targetRow = rowNumber;
        }
    });
    if (targetRow === -1) return;

    let totalPriemL = 0;
    let totalPriemKg = 0;
    const sheetPriem = workbook.getWorksheet('Priem');
    if (sheetPriem) {
        sheetPriem.eachRow((row, rowNumber) => {
            if (rowNumber < 3) return;
            const dateCell = row.getCell(1);
            if (isSameDate(dateCell.value, targetDate)) {
                const valL = row.getCell(5).value;
                const valKg = row.getCell(6).value;
                if (typeof valL === 'number') totalPriemL += valL;
                if (typeof valKg === 'number') totalPriemKg += valKg;
            }
        });
    }

    let totalTzaL = 0;
    let totalTzaKg = 0;
    const sheetTza = workbook.getWorksheet('Vidacha_TZA');
    if (sheetTza) {
        sheetTza.eachRow((row, rowNumber) => {
            if (rowNumber < 3) return;
            const dateCell = row.getCell(1);
            if (isSameDate(dateCell.value, targetDate)) {
                const valL = row.getCell(6).value;
                const valKg = row.getCell(7).value;
                if (typeof valL === 'number') totalTzaL += valL;
                if (typeof valKg === 'number') totalTzaKg += valKg;
            }
        });
    }

    let totalVsL = 0;
    let totalVsKg = 0;
    const sheetVs = workbook.getWorksheet('Vidacha_VS');
    if (sheetVs) {
        sheetVs.eachRow((row, rowNumber) => {
            if (rowNumber < 3) return;
            const dateCell = row.getCell(1);
            if (isSameDate(dateCell.value, targetDate)) {
                const valL = row.getCell(7).value;
                const valKg = row.getCell(8).value;
                if (typeof valL === 'number') totalVsL += valL;
                if (typeof valKg === 'number') totalVsKg += valKg;
            }
        });
    }

    setCellValue(workbook, 'SMENA', `C${targetRow}`, totalPriemL, STYLES.cellNormal);
    setCellValue(workbook, 'SMENA', `D${targetRow}`, parseFloat(totalPriemKg.toFixed(2)), STYLES.cellNormal);
    setCellValue(workbook, 'SMENA', `E${targetRow}`, totalTzaL, STYLES.cellNormal);
    setCellValue(workbook, 'SMENA', `F${targetRow}`, parseFloat(totalTzaKg.toFixed(2)), STYLES.cellNormal);
    setCellValue(workbook, 'SMENA', `G${targetRow}`, totalVsL, STYLES.cellNormal);
    setCellValue(workbook, 'SMENA', `H${targetRow}`, parseFloat(totalVsKg.toFixed(2)), STYLES.cellNormal);
};

export const addShiftEntry = (workbook: ExcelJS.Workbook, employeeName: string): number => {
    const SHEET_NAME = 'SMENA';
    let sheet = workbook.getWorksheet(SHEET_NAME);
    if (!sheet) sheet = workbook.addWorksheet(SHEET_NAME);
    
    // Find last row
    let rowIndex = 3;
    sheet.eachRow((row, rowNumber) => {
        if (rowNumber >= rowIndex) rowIndex = rowNumber + 1;
    });

    const currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);
    
    setCellValue(workbook, SHEET_NAME, `A${rowIndex}`, currentDate, STYLES.cellNormal);
    setCellValue(workbook, SHEET_NAME, `B${rowIndex}`, employeeName, STYLES.cellNormal);
    
    setCellValue(workbook, SHEET_NAME, `C${rowIndex}`, 0, STYLES.cellNormal);
    setCellValue(workbook, SHEET_NAME, `D${rowIndex}`, 0, STYLES.cellNormal);
    setCellValue(workbook, SHEET_NAME, `E${rowIndex}`, 0, STYLES.cellNormal);
    setCellValue(workbook, SHEET_NAME, `F${rowIndex}`, 0, STYLES.cellNormal);
    setCellValue(workbook, SHEET_NAME, `G${rowIndex}`, 0, STYLES.cellNormal);
    setCellValue(workbook, SHEET_NAME, `H${rowIndex}`, 0, STYLES.cellNormal);
    
    setCellValue(workbook, SHEET_NAME, `I${rowIndex}`, 'Открыта', STYLES.cellNormal);
    return rowIndex;
};

export const closeShiftEntry = (workbook: ExcelJS.Workbook, rowIndex: number) => {
    setCellValue(workbook, 'SMENA', `I${rowIndex}`, 'Закрыта', STYLES.cellNormal);
};

export const deleteShiftEntry = (workbook: ExcelJS.Workbook, rowIndex: number) => {
    const sheet = workbook.getWorksheet('SMENA');
    if (!sheet) return;
    // ExcelJS doesn't have "delete row content" easily without shifting.
    // We can just clear values.
    const row = sheet.getRow(rowIndex);
    row.values = [];
    row.commit();
};

interface CalculationResult { average: number; volume: number; mass: number; }

export const getTankMeasurements = (workbook: ExcelJS.Workbook, tankName: string, sheetName: string = 'Zamer') => {
    const cells = TANK_CELLS_MAPPING[tankName];
    if (!cells) return { m1: '', m2: '', m3: '', density: '', temp: '' };
    const getVal = (addr: string): string => {
        const val = getCellValue(workbook, sheetName, addr);
        return val !== null && val !== undefined ? String(val) : '';
    };
    return { m1: getVal(cells[0]), m2: getVal(cells[1]), m3: getVal(cells[2]), density: getVal(cells[3]), temp: getVal(cells[4]) };
};

export const getTankFullData = (workbook: ExcelJS.Workbook, tankName: string, sheetName: string = 'Zamer') => {
    const measurements = getTankMeasurements(workbook, tankName, sheetName);
    
    const avgAddr = AVERAGE_MAPPING[tankName];
    const volAddr = VOLUME_MAPPING[tankName];
    const massAddr = MASS_MAPPING[tankName];

    const average = avgAddr ? Number(getCellValue(workbook, sheetName, avgAddr)) || 0 : 0;
    const volume = volAddr ? Number(getCellValue(workbook, sheetName, volAddr)) || 0 : 0;
    const mass = massAddr ? Number(getCellValue(workbook, sheetName, massAddr)) || 0 : 0;

    return {
        name: tankName,
        ...measurements,
        average,
        volume,
        mass
    };
};

export const generateBalanceReport = async (workbook: ExcelJS.Workbook, tanks: string[]): Promise<void> => {
    const reportWb = new ExcelJS.Workbook();
    const sheet = reportWb.addWorksheet('Остатки');

    sheet.columns = [
        { header: 'Резервуар', key: 'name', width: 15 },
        { header: 'Взлив (мм)', key: 'average', width: 12 },
        { header: 'Плотность', key: 'density', width: 12 },
        { header: 'Температура', key: 'temp', width: 12 },
        { header: 'Объем (л)', key: 'volume', width: 15 },
        { header: 'Масса (кг)', key: 'mass', width: 15 },
    ];

    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).alignment = { horizontal: 'center' };

    tanks.forEach(tank => {
        const data = getTankFullData(workbook, tank);
        sheet.addRow({
            name: data.name,
            average: data.average,
            density: Number(data.density) || 0,
            temp: Number(data.temp) || 0,
            volume: data.volume,
            mass: data.mass
        });
    });

    // Add totals
    const totalVolume = tanks.reduce((acc, tank) => acc + (getTankFullData(workbook, tank).volume || 0), 0);
    const totalMass = tanks.reduce((acc, tank) => acc + (getTankFullData(workbook, tank).mass || 0), 0);

    sheet.addRow({});
    const totalRow = sheet.addRow({
        name: 'ИТОГО:',
        volume: totalVolume,
        mass: totalMass
    });
    totalRow.font = { bold: true };

    const dateStr = new Date().toISOString().slice(0,10);
    await saveExcelFile(reportWb, `Ostatki_Report_${dateStr}.xlsx`);
};

export const saveTankMeasurements = (workbook: ExcelJS.Workbook, tankName: string, data: any, sheetName: string = 'Zamer'): CalculationResult | null => {
  const SHEET_NAME = sheetName;
  const cells = TANK_CELLS_MAPPING[tankName];
  if (!cells) return null;

  const m1 = parseFloat(data.m1), m2 = parseFloat(data.m2), m3 = parseFloat(data.m3);
  const den = parseFloat(data.density), t = parseFloat(data.temp);

  setCellValue(workbook, SHEET_NAME, cells[0], isNaN(m1) ? data.m1 : m1, STYLES.cellNormal);
  setCellValue(workbook, SHEET_NAME, cells[1], isNaN(m2) ? data.m2 : m2, STYLES.cellNormal);
  setCellValue(workbook, SHEET_NAME, cells[2], isNaN(m3) ? data.m3 : m3, STYLES.cellNormal);
  setCellValue(workbook, SHEET_NAME, cells[3], isNaN(den) ? data.density : den, STYLES.cellNormal);
  setCellValue(workbook, SHEET_NAME, cells[4], isNaN(t) ? data.temp : t, STYLES.cellNormal);

  const result: CalculationResult = { average: 0, volume: 0, mass: 0 };
  if (!isNaN(m1) && !isNaN(m2) && !isNaN(m3)) {
      const average = Math.round((m1 + m2 + m3) / 3);
      result.average = average;
      const avgCell = AVERAGE_MAPPING[tankName];
      if (avgCell) {
          setCellValue(workbook, SHEET_NAME, avgCell, average, STYLES.cellHighlight);
          let volume = 0;
          if (tankName.includes('РГС-50')) volume = getVolume(RGS_50_TABLE, average);
          else if (tankName.includes('РГС-100')) volume = getVolume(RGS_100_TABLE, average);
          volume = parseFloat(volume.toFixed(2));
          const volCell = VOLUME_MAPPING[tankName];
          if (volCell) {
             result.volume = volume;
             setCellValue(workbook, SHEET_NAME, volCell, volume, STYLES.cellHighlight);
             if (!isNaN(den)) {
                 const mass = parseFloat((volume * den).toFixed(2));
                 result.mass = mass;
                 const massCell = MASS_MAPPING[tankName];
                 if (massCell) setCellValue(workbook, SHEET_NAME, massCell, mass, STYLES.cellHighlight);
             }
          }
      }
  }
  return result;
};

export const saveTzaIssue = (workbook: ExcelJS.Workbook, tzaNumber: string, tankName: string, meterStart: string, meterEnd: string): any => {
    const SHEET_NAME = 'Vidacha_TZA';
    let sheet = workbook.getWorksheet(SHEET_NAME);
    if (!sheet) sheet = workbook.addWorksheet(SHEET_NAME);
    
    let rowIndex = 3;
    sheet.eachRow((row, rowNumber) => {
        if (rowNumber >= rowIndex) rowIndex = rowNumber + 1;
    });

    const densityCellAddr = DENSITY_CELL_MAPPING[tankName];
    let density = 0;
    if (densityCellAddr) {
        const denVal = getCellValue(workbook, 'Zamer', densityCellAddr);
        density = typeof denVal === 'number' ? denVal : parseFloat(String(denVal)) || 0;
    }

    const start = parseInt(meterStart, 10) || 0, end = parseInt(meterEnd, 10) || 0;
    const issuedL = end - start;
    const issuedKg = parseFloat((issuedL * density).toFixed(2));

    const currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);
    setCellValue(workbook, SHEET_NAME, `A${rowIndex}`, currentDate, STYLES.cellNormal);
    setCellValue(workbook, SHEET_NAME, `B${rowIndex}`, tzaNumber, STYLES.cellNormal);
    setCellValue(workbook, SHEET_NAME, `C${rowIndex}`, tankName, STYLES.cellNormal);
    setCellValue(workbook, SHEET_NAME, `D${rowIndex}`, start, STYLES.cellNormal);
    setCellValue(workbook, SHEET_NAME, `E${rowIndex}`, end, STYLES.cellNormal);
    setCellValue(workbook, SHEET_NAME, `F${rowIndex}`, issuedL, STYLES.cellNormal);
    setCellValue(workbook, SHEET_NAME, `G${rowIndex}`, issuedKg, STYLES.cellNormal);

    recalculateShiftTotals(workbook, currentDate);

    return { issuedL, density, issuedKg };
};

export const saveFuelReceipt = (workbook: ExcelJS.Workbook, tankName: string, meterStart: string, meterEnd: string): any => {
    const SHEET_NAME = 'Priem';
    let sheet = workbook.getWorksheet(SHEET_NAME);
    if (!sheet) sheet = workbook.addWorksheet(SHEET_NAME);
    
    let rowIndex = 3;
    sheet.eachRow((row, rowNumber) => {
        if (rowNumber >= rowIndex) rowIndex = rowNumber + 1;
    });

    const densityCellAddr = DENSITY_CELL_MAPPING[tankName];
    let density = 0;
    if (densityCellAddr) {
        const denVal = getCellValue(workbook, 'Zamer', densityCellAddr);
        density = typeof denVal === 'number' ? denVal : parseFloat(String(denVal)) || 0;
    }

    const start = parseInt(meterStart, 10) || 0, end = parseInt(meterEnd, 10) || 0;
    const receivedL = end - start;
    const receivedKg = parseFloat((receivedL * density).toFixed(2));

    const currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);
    setCellValue(workbook, SHEET_NAME, `A${rowIndex}`, currentDate, STYLES.cellNormal);
    setCellValue(workbook, SHEET_NAME, `B${rowIndex}`, tankName, STYLES.cellNormal); 
    setCellValue(workbook, SHEET_NAME, `C${rowIndex}`, start, STYLES.cellNormal);    
    setCellValue(workbook, SHEET_NAME, `D${rowIndex}`, end, STYLES.cellNormal);      
    setCellValue(workbook, SHEET_NAME, `E${rowIndex}`, receivedL, STYLES.cellNormal); 
    setCellValue(workbook, SHEET_NAME, `F${rowIndex}`, receivedKg, STYLES.cellNormal); 

    const volCellAddr = VOLUME_MAPPING[tankName];
    if (volCellAddr) {
        const currentVol = parseFloat(String(getCellValue(workbook, 'Zamer', volCellAddr))) || 0;
        const newVol = parseFloat((currentVol + receivedL).toFixed(2));
        setCellValue(workbook, 'Zamer', volCellAddr, newVol, STYLES.cellHighlight);
    }

    const massCellAddr = MASS_MAPPING[tankName];
    if (massCellAddr) {
        const currentMass = parseFloat(String(getCellValue(workbook, 'Zamer', massCellAddr))) || 0;
        const newMass = parseFloat((currentMass + receivedKg).toFixed(2));
        setCellValue(workbook, 'Zamer', massCellAddr, newMass, STYLES.cellHighlight);
    }

    recalculateShiftTotals(workbook, currentDate);

    return { receivedL, density, receivedKg };
};

export const saveVsIssue = (workbook: ExcelJS.Workbook, tzaNumber: string, coupon: string, startMeter: string, endMeter: string, densityStr: string): any => {
    const SHEET_NAME = 'Vidacha_VS';
    let sheet = workbook.getWorksheet(SHEET_NAME);
    if (!sheet) sheet = workbook.addWorksheet(SHEET_NAME);
    
    let rowIndex = 3;
    sheet.eachRow((row, rowNumber) => {
        if (rowNumber >= rowIndex) rowIndex = rowNumber + 1;
    });

    const start = parseInt(startMeter, 10) || 0;
    const end = parseInt(endMeter, 10) || 0;
    const density = parseFloat(densityStr) || 0;
    
    const issuedL = end - start;
    const issuedKg = parseFloat((issuedL * density).toFixed(2));

    const currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);

    setCellValue(workbook, SHEET_NAME, `A${rowIndex}`, currentDate, STYLES.cellNormal);
    setCellValue(workbook, SHEET_NAME, `B${rowIndex}`, tzaNumber, STYLES.cellNormal);
    setCellValue(workbook, SHEET_NAME, `C${rowIndex}`, coupon, STYLES.cellNormal);
    setCellValue(workbook, SHEET_NAME, `D${rowIndex}`, start, STYLES.cellNormal);
    setCellValue(workbook, SHEET_NAME, `E${rowIndex}`, end, STYLES.cellNormal);
    setCellValue(workbook, SHEET_NAME, `F${rowIndex}`, density, STYLES.cellNormal);
    setCellValue(workbook, SHEET_NAME, `G${rowIndex}`, issuedL, STYLES.cellNormal);
    setCellValue(workbook, SHEET_NAME, `H${rowIndex}`, issuedKg, STYLES.cellNormal);

    recalculateShiftTotals(workbook, currentDate);

    return { issuedL, issuedKg, density };
};

export const saveJdcMeasurement = (workbook: ExcelJS.Workbook, data: { type: string, number: string, m1: string, m2: string, m3: string, density: string, temp: string }): any => {
    const SHEET_NAME = 'Priem_Vagon';
    let sheet = workbook.getWorksheet(SHEET_NAME);
    
    if (!sheet) {
        sheet = workbook.addWorksheet(SHEET_NAME);
        sheet.columns = [
            { width: 12 }, { width: 8 }, { width: 12 }, 
            { width: 15 }, { width: 15 }, { width: 12 }, 
            { width: 12 }, { width: 15 }, { width: 15 }
        ];
        sheet.getCell('A1').value = 'ЖУРНАЛ ЗАМЕРОВ ЖД ЦИСТЕРН';
        sheet.getCell('A1').font = { bold: true, size: 14 };
        sheet.getRow(2).values = ['Дата', 'Время', 'Тип вагона', '№ Вагона', 'Взлив средний', 'Плотность', 'Температура', 'Объем (л)', 'Масса (кг)'];
        sheet.getRow(2).eachCell(cell => cell.style = STYLES.header);
    }

    let rowIndex = 3;
    sheet.eachRow((row, rowNumber) => {
        if (rowNumber >= rowIndex) rowIndex = rowNumber + 1;
    });

    const currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);
    const currentTime = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

    const m1 = parseInt(data.m1, 10) || 0;
    const m2 = parseInt(data.m2, 10) || 0;
    const m3 = parseInt(data.m3, 10) || 0;
    const density = parseFloat(data.density) || 0;
    const temp = parseFloat(data.temp) || 0;

    let volume = 0;
    let mass = 0;
    const average = Math.round((m1 + m2 + m3) / 3);

    if (['66', '72', '81', '90', '92'].includes(data.type)) {
        let table = GT_66_TABLE;
        if (data.type === '72') table = GT_72_TABLE;
        if (data.type === '81') table = GT_81_TABLE;
        if (data.type === '90') table = GT_90_TABLE;
        if (data.type === '92') table = GT_92_TABLE;
        
        volume = getVolume(table, average);
        mass = parseFloat((volume * density).toFixed(2));
    }

    setCellValue(workbook, SHEET_NAME, `A${rowIndex}`, currentDate, STYLES.cellNormal);
    setCellValue(workbook, SHEET_NAME, `B${rowIndex}`, currentTime, STYLES.cellNormal);
    setCellValue(workbook, SHEET_NAME, `C${rowIndex}`, data.type, STYLES.cellNormal);
    setCellValue(workbook, SHEET_NAME, `D${rowIndex}`, data.number, STYLES.cellNormal);
    setCellValue(workbook, SHEET_NAME, `E${rowIndex}`, average, STYLES.cellNormal);
    setCellValue(workbook, SHEET_NAME, `F${rowIndex}`, density, STYLES.cellNormal);
    setCellValue(workbook, SHEET_NAME, `G${rowIndex}`, temp, STYLES.cellNormal);
    setCellValue(workbook, SHEET_NAME, `H${rowIndex}`, volume, STYLES.cellHighlight);
    setCellValue(workbook, SHEET_NAME, `I${rowIndex}`, mass, STYLES.cellHighlight);

    return { volume, mass };
};
