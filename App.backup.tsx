
import React, { useEffect, useState } from 'react';
import { createNewWorkbook, workbookToArrayBuffer, addShiftEntry, deleteShiftEntry, findShiftRowForToday, saveTankMeasurements, saveExcelFile, getTankMeasurements, saveTzaIssue, saveFuelReceipt, saveVsIssue, findUnclosedShift, closeShiftEntry, saveJdcMeasurement } from './excelUtils';
import { saveFileToDB, loadFileFromDB, clearFileFromDB } from './storageUtils';
import * as XLSX from 'xlsx-js-style';

// Типы экранов приложения
type Screen = 'selection' | 'mainMenu' | 'fuelMeasurement' | 'tankEntry' | 'tzaSelection' | 'tzaReservoirSelection' | 'tzaEntry' | 'priemReservoirSelection' | 'priemEntry' | 'vsTzaSelection' | 'vsEntry' | 'jdcEntry';

// Интерфейс для данных формы замера
interface TankFormData {
  m1: string; m2: string; m3: string; density: string; temp: string;
}

interface JdcFormData {
    type: string;
    number: string;
    m1: string;
    m2: string;
    m3: string;
    density: string;
    temp: string;
}

// Интерфейс результатов замера
interface CalculationResult {
    average: number; volume: number; mass: number;
}

// Интерфейс результатов выдачи ТЗА / Приема / ВС
interface FlowResult {
    issuedL?: number;
    receivedL?: number;
    density: number;
    issuedKg?: number;
    receivedKg?: number;
}

interface ActiveShiftInfo {
    employee: string;
    date: string;
}

const App: React.FC = () => {
  const employees = ['Гулуа Т. Д.', 'Адлейба А. С.', 'Курт-Оглы Р. Г.', 'Дочия А. Д.'];
  
  // Используем any для workbook, так как типы из модуля недоступны при глобальной загрузке
  const [workbook, setWorkbook] = useState<any | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [statusType, setStatusType] = useState<'success' | 'error'>('success');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  
  const [currentScreen, setCurrentScreen] = useState<Screen>('selection');
  const [currentEmployee, setCurrentEmployee] = useState<string>('');
  const [currentShiftDate, setCurrentShiftDate] = useState<string>('');
  const [currentShiftRow, setCurrentShiftRow] = useState<number | null>(null);
  const [unclosedShiftInfo, setUnclosedShiftInfo] = useState<ActiveShiftInfo | null>(null);
  
  const [selectedTank, setSelectedTank] = useState<string>('');
  const [tankFormData, setTankFormData] = useState<TankFormData>({
    m1: '', m2: '', m3: '', density: '', temp: ''
  });
  const [formError, setFormError] = useState<string>('');
  
  const [selectedTza, setSelectedTza] = useState<string>('');
  const [selectedTzaReservoir, setSelectedTzaReservoir] = useState<string>('');
  const [tzaFormData, setTzaFormData] = useState<{ start: string; end: string }>({ start: '', end: '' });
  const [tzaResult, setTzaResult] = useState<FlowResult | null>(null);
  const [showTzaModal, setShowTzaModal] = useState<boolean>(false);

  const [selectedPriemTank, setSelectedPriemTank] = useState<string>('');
  const [priemFormData, setPriemFormData] = useState<{ start: string; end: string }>({ start: '', end: '' });
  const [priemResult, setPriemResult] = useState<FlowResult | null>(null);
  const [showPriemModal, setShowPriemModal] = useState<boolean>(false);

  const [selectedVsTza, setSelectedVsTza] = useState<string>('');
  const [vsFormData, setVsFormData] = useState<{ coupon: string; start: string; end: string; density: string }>({ coupon: '', start: '', end: '', density: '' });
  const [vsResult, setVsResult] = useState<FlowResult | null>(null);
  const [showVsModal, setShowVsModal] = useState<boolean>(false);
  
  const [jdcFormData, setJdcFormData] = useState<JdcFormData>({ type: '', number: '', m1: '', m2: '', m3: '', density: '', temp: '' });
  const [jdcResult, setJdcResult] = useState<{ volume: number, mass: number, density: number } | null>(null);
  const [showJdcModal, setShowJdcModal] = useState<boolean>(false);

  const [calculationResult, setCalculationResult] = useState<CalculationResult | null>(null);
  const [showResultModal, setShowResultModal] = useState<boolean>(false);

  const [showAdminPanel, setShowAdminPanel] = useState<boolean>(false);

  const persistWorkbook = async (wb: any) => {
      try {
          const buffer = workbookToArrayBuffer(wb);
          await saveFileToDB(buffer);
      } catch (e) {
          console.error("Ошибка сохранения:", e);
      }
  };

  const checkForUnclosedShifts = (wb: any) => {
    const unclosed = findUnclosedShift(wb);
    if (unclosed) {
        setUnclosedShiftInfo({ employee: unclosed.employee, date: unclosed.date });
    } else {
        setUnclosedShiftInfo(null);
    }
  };

  useEffect(() => {
    const initExcel = async () => {
      try {
        let wb: any;
        
        // 1. Пытаемся загрузить из локальной БД (самый приоритетный вариант, если мы уже работали)
        try {
            const storedFile = await loadFileFromDB();
            if (storedFile) {
                console.log("Загружено из локальной БД");
                wb = XLSX.read(storedFile, { type: 'array', cellDates: true });
            }
        } catch (dbError) {
            console.warn("Локальная БД пуста или ошибка чтения:", dbError);
        }

        // 2. Если в БД пусто, пытаемся скачать "Мастер-файл" из корня (ZAMER_main_.xlsx)
        if (!wb) {
            try {
                console.log("Попытка загрузки ZAMER_main_.xlsx из корня...");
                const response = await fetch('./ZAMER_main_.xlsx');
                if (response.ok) {
                    const arrayBuffer = await response.arrayBuffer();
                    wb = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
                    await persistWorkbook(wb); // Сразу сохраняем в БД, чтобы потом грузить оттуда
                    console.log("Успешно инициализировано из ZAMER_main_.xlsx");
                } else {
                    console.warn("Файл ZAMER_main_.xlsx не найден в корне.");
                }
            } catch (fetchError) {
                console.warn("Ошибка при загрузке файла из корня:", fetchError);
            }
        }

        // 3. Если ничего не помогло, создаем новый чистый файл
        if (!wb) {
             console.log("Создаем новый пустой файл");
             wb = createNewWorkbook();
             await persistWorkbook(wb);
        }

        setWorkbook(wb);
        checkForUnclosedShifts(wb);

        const todayShift = findShiftRowForToday(wb);
        if (todayShift) {
            setCurrentEmployee(todayShift.employee);
            setCurrentShiftRow(todayShift.row);
            setCurrentShiftDate(new Date().toLocaleDateString('ru-RU'));
            setCurrentScreen('mainMenu');
        }
        
      } catch (criticalError: any) {
          console.error("Critical Init Error:", criticalError);
          setStatusMessage("Ошибка инициализации Excel: " + (criticalError.message || "Unknown error"));
          setStatusType('error');
      } finally {
          setIsLoading(false);
      }
    };
    
    // Небольшая задержка, чтобы убедиться, что глобальный скрипт загрузился
    if (typeof XLSX !== 'undefined') {
        initExcel();
    } else {
        const interval = setInterval(() => {
            if (typeof XLSX !== 'undefined') {
                clearInterval(interval);
                initExcel();
            }
        }, 100);
        // Timeout safety
        setTimeout(() => {
            clearInterval(interval);
            if (isLoading) {
                 setStatusMessage("Ошибка: Библиотека Excel не загрузилась. Проверьте интернет.");
                 setStatusType('error');
                 setIsLoading(false);
            }
        }, 5000);
    }
  }, []);

  const handleManualUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
          setIsLoading(true);
          try {
              const arrayBuffer = await file.arrayBuffer();
              const wb = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
              setWorkbook(wb);
              checkForUnclosedShifts(wb);
              await saveFileToDB(arrayBuffer);
              setStatusMessage("База данных обновлена вручную!");
              setStatusType('success');
              // Скрываем сообщение через 3 секунды
              setTimeout(() => setStatusMessage(''), 3000);
          } catch (error) {
              setStatusMessage("Ошибка импорта файла.");
              setStatusType('error');
          } finally {
              setIsLoading(false);
          }
      }
  };

  const handleResetDatabase = async () => {
      if (window.confirm("Вы уверены? Это удалит текущую локальную базу и попытается загрузить ZAMER_main_.xlsx заново.")) {
          await clearFileFromDB();
          window.location.reload();
      }
  };

  const handleEmployeeSelect = (employeeName: string) => {
    if (!workbook) return;
    try {
      const active = findUnclosedShift(workbook);
      if (active) {
        if (active.employee === employeeName) {
           setCurrentShiftRow(active.row);
           setCurrentEmployee(employeeName);
           setCurrentShiftDate(active.date);
           setCurrentScreen('mainMenu');
        } else {
           setStatusMessage(`Ошибка: Смена сотрудника ${active.employee} от ${active.date} не закрыта!`);
           setStatusType('error');
        }
      } else {
        const rowNumber = addShiftEntry(workbook, employeeName);
        setCurrentShiftRow(rowNumber);
        setCurrentEmployee(employeeName);
        setCurrentShiftDate(new Date().toLocaleDateString('ru-RU'));
        setCurrentScreen('mainMenu');
        persistWorkbook(workbook);
        setUnclosedShiftInfo(null);
      }
    } catch (error) {
      console.error(error);
      setStatusMessage("Ошибка при открытии смены.");
      setStatusType('error');
    }
  };

  const handleEndShift = () => {
    if (workbook && currentShiftRow !== null) {
        closeShiftEntry(workbook, currentShiftRow);
        persistWorkbook(workbook);
    }
    setCurrentScreen('selection');
    setCurrentEmployee('');
    setCurrentShiftDate('');
    setCurrentShiftRow(null);
    setUnclosedShiftInfo(null);
    setStatusMessage("✅ Смена завершена и сохранена в журнале");
    setStatusType('success');
    // Скрываем сообщение через 3 секунды
    setTimeout(() => setStatusMessage(''), 3000);
  };

  const handleDeleteShift = () => {
    if (workbook && currentShiftRow !== null) {
      deleteShiftEntry(workbook, currentShiftRow);
      persistWorkbook(workbook);
      setCurrentScreen('selection');
      setCurrentEmployee('');
      setCurrentShiftDate('');
      setCurrentShiftRow(null);
      setUnclosedShiftInfo(null);
    }
  };

  const handleDownloadReport = () => {
      if (workbook) {
          const dateStr = new Date().toISOString().slice(0,10);
          saveExcelFile(workbook, `ZAMER_Report_${dateStr}.xlsx`);
      }
  };

  const handleTankSelect = (tankName: string) => {
    setSelectedTank(tankName);
    setFormError('');
    if (workbook) {
        const existingData = getTankMeasurements(workbook, tankName);
        setTankFormData(existingData);
    }
    setCurrentScreen('tankEntry');
  };

  const handleInputChange = (field: keyof TankFormData, value: string) => {
    setTankFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmitTankData = () => {
    const { m1, m2, m3 } = tankFormData;
    const digitRegex = /^\d{1,4}$/;
    if (!digitRegex.test(m1) || !digitRegex.test(m2) || !digitRegex.test(m3)) {
      setFormError("Замеры должны быть числом (1-4 цифры)");
      return;
    }
    if (workbook) {
        const result = saveTankMeasurements(workbook, selectedTank, tankFormData);
        persistWorkbook(workbook);
        if (result) {
            setCalculationResult(result);
            setShowResultModal(true);
        }
    }
  };

  const handleTzaSelect = (tza: string) => {
      setSelectedTza(tza);
      setCurrentScreen('tzaReservoirSelection');
  };

  const handleTzaReservoirSelect = (tank: string) => {
      setSelectedTzaReservoir(tank);
      setTzaFormData({ start: '', end: '' });
      setCurrentScreen('tzaEntry');
  };

  const handleSubmitTzaData = () => {
      if (!tzaFormData.start || !tzaFormData.end) {
          setFormError('Заполните счетчики');
          return;
      }
      if (workbook) {
          const result = saveTzaIssue(workbook, selectedTza, selectedTzaReservoir, tzaFormData.start, tzaFormData.end);
          persistWorkbook(workbook);
          setTzaResult(result);
          setShowTzaModal(true);
      }
  };

  const handlePriemTankSelect = (tank: string) => {
      setSelectedPriemTank(tank);
      setPriemFormData({ start: '', end: '' });
      setFormError('');
      setCurrentScreen('priemEntry');
  };

  const handleSubmitPriemData = () => {
      if (!priemFormData.start || !priemFormData.end) {
          setFormError('Заполните счетчики');
          return;
      }
      if (workbook) {
          const result = saveFuelReceipt(workbook, selectedPriemTank, priemFormData.start, priemFormData.end);
          persistWorkbook(workbook);
          setPriemResult(result);
          setShowPriemModal(true);
      }
  };

  const handleVsTzaSelect = (tza: string) => {
      setSelectedVsTza(tza);
      setVsFormData({ coupon: '', start: '', end: '', density: '' });
      setFormError('');
      setCurrentScreen('vsEntry');
  };

  const handleSubmitVsData = () => {
      if (!vsFormData.coupon || !vsFormData.start || !vsFormData.end || !vsFormData.density) {
          setFormError('Заполните все поля');
          return;
      }
      if (workbook) {
          const result = saveVsIssue(workbook, selectedVsTza, vsFormData.coupon, vsFormData.start, vsFormData.end, vsFormData.density);
          persistWorkbook(workbook);
          setVsResult(result);
          setShowVsModal(true);
      }
  };

  // --- Logic for JDC (Railway Tanker) ---
  const handleJdcTypeSelect = (type: string) => {
      setJdcFormData(prev => ({ ...prev, type }));
  };

  const handleJdcInputChange = (field: keyof JdcFormData, value: string) => {
      // Basic validation for numbers
      if (field === 'number') {
          // Allow only digits, max 8 chars
          const cleaned = value.replace(/\D/g, '').slice(0, 8);
          setJdcFormData(prev => ({ ...prev, [field]: cleaned }));
      } else if (field === 'm1' || field === 'm2' || field === 'm3') {
          // Allow only digits, max 4 chars
          const cleaned = value.replace(/\D/g, '').slice(0, 4);
          setJdcFormData(prev => ({ ...prev, [field]: cleaned }));
      } else {
          setJdcFormData(prev => ({ ...prev, [field]: value }));
      }
  };

  const handleSubmitJdcData = () => {
      if (!jdcFormData.type) { setFormError("Выберите тип вагона"); return; }
      if (!jdcFormData.number) { setFormError("Введите номер вагона"); return; }
      if (!jdcFormData.m1 || !jdcFormData.m2 || !jdcFormData.m3) { setFormError("Заполните все замеры"); return; }
      if (!jdcFormData.density) { setFormError("Введите плотность"); return; }
      if (!jdcFormData.temp) { setFormError("Введите температуру"); return; }

      if (workbook) {
          // Calls the updated function in excelUtils
          const result = saveJdcMeasurement(workbook, jdcFormData);
          persistWorkbook(workbook);
          setJdcResult({ ...result, density: parseFloat(jdcFormData.density) });
          setShowJdcModal(true);
      }
  };

  const handleJdcBack = () => {
      setJdcFormData({ type: '', number: '', m1: '', m2: '', m3: '', density: '', temp: '' });
      setFormError('');
      setCurrentScreen('mainMenu');
  };

  const renderSelectionScreen = () => (
    <div className="w-full max-w-4xl text-center animate-fade-in relative min-h-[500px] flex flex-col justify-center">
      <svg className="w-20 h-20 mx-auto mb-4 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
      </svg>
      <h1 className="text-2xl font-bold mb-2 text-white">Система СГСМ</h1>
      
      {unclosedShiftInfo && (
          <div className="mb-6 p-4 bg-orange-900/40 border border-orange-700 rounded-xl animate-bounce mx-auto max-w-md">
              <h3 className="text-orange-300 font-bold text-lg">⚠️ Обнаружена незакрытая смена!</h3>
              <p className="text-orange-200">{unclosedShiftInfo.employee} от {unclosedShiftInfo.date}</p>
          </div>
      )}

      <p className="text-xl font-semibold mb-8 text-gray-400 text-center">Выберите сотрудника на смене</p>
      
      {isLoading ? (
        <div className="text-yellow-400 animate-pulse mb-4 font-bold text-xl">Загрузка базы данных...</div>
      ) : (
        <>
          {statusMessage && (
            <div className={`mb-6 p-4 border rounded-lg mx-auto max-w-md ${statusType === 'error' ? 'bg-red-900 border-red-700 text-red-200' : 'bg-gray-800 border-gray-700 text-green-400'}`}>
              {statusMessage}
            </div>
          )}
          <div className="flex flex-wrap justify-center gap-4 mb-8">
            {employees.map((employee) => (
              <button key={employee} onClick={() => handleEmployeeSelect(employee)}
                className="w-52 bg-violet-600 hover:bg-violet-700 text-white font-bold py-3 px-6 rounded-lg shadow-lg transition-all active:scale-95">
                {employee}
              </button>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8 w-full max-w-md mx-auto border-t border-gray-800 pt-6">
              <button
                onClick={handleDownloadReport}
                className="flex-1 bg-teal-800 hover:bg-teal-700 text-teal-100 font-bold py-3 px-4 rounded-lg shadow transition-all flex items-center justify-center gap-2 active:scale-95"
              >
                📊 Отчеты/Журналы
              </button>
              <button
                onClick={() => setShowAdminPanel(!showAdminPanel)}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-gray-200 font-bold py-3 px-4 rounded-lg shadow transition-all flex items-center justify-center gap-2 active:scale-95"
              >
                ⚙️ Панель Админа
              </button>
          </div>

          {showAdminPanel && (
              <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-80 z-50 animate-fade-in">
                  <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-2xl w-80 text-center relative">
                      <button onClick={() => setShowAdminPanel(false)} className="absolute top-2 right-3 text-gray-400 hover:text-white text-2xl">&times;</button>
                      <h4 className="text-gray-300 font-bold mb-6 border-b border-gray-600 pb-2">Администрирование БД</h4>
                      <div className="flex flex-col gap-4">
                         <label className="cursor-pointer bg-blue-700 hover:bg-blue-600 text-white py-3 px-4 rounded-lg shadow-md transition-all">
                            📥 Импорт базы (XLSX)
                            <input type="file" accept=".xlsx, .xls" onChange={handleManualUpload} className="hidden" />
                         </label>
                         <button onClick={handleDownloadReport} className="bg-green-700 hover:bg-green-600 text-white py-3 px-4 rounded-lg shadow-md transition-all">
                            💾 Скачать копию
                         </button>
                         <button onClick={handleResetDatabase} className="bg-red-900/80 hover:bg-red-800 text-red-200 py-3 px-4 rounded-lg shadow-md transition-all border border-red-800">
                            🔄 Полный сброс (Reset)
                         </button>
                      </div>
                  </div>
              </div>
          )}
        </>
      )}
    </div>
  );

  const renderMainMenu = () => (
    <div className="w-full max-w-4xl text-center animate-fade-in">
      <div className="mb-8">
        <h2 className="text-xl text-gray-400">Текущая смена:</h2>
        <div className="flex items-center justify-center gap-4 mt-1">
            <h1 className="text-3xl font-bold text-white">{currentEmployee}</h1>
            <span className="text-2xl text-violet-400 font-medium border-l border-gray-700 pl-4">{currentShiftDate}</span>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto mb-10">
        <button onClick={() => setCurrentScreen('fuelMeasurement')} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-6 rounded-xl shadow-lg transform hover:scale-105 transition-all">📏 Замер топлива</button>
        <button onClick={() => setCurrentScreen('priemReservoirSelection')} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-6 rounded-xl shadow-lg transform hover:scale-105 transition-all">📥 Прием топлива</button>
        <button onClick={() => setCurrentScreen('tzaSelection')} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-6 rounded-xl shadow-lg transform hover:scale-105 transition-all">🚛 Выдача в ТЗА</button>
        <button onClick={() => setCurrentScreen('vsTzaSelection')} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-6 rounded-xl shadow-lg transform hover:scale-105 transition-all">✈️ Выдача в ВС</button>
        <button onClick={() => setCurrentScreen('jdcEntry')} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-6 rounded-xl shadow-lg transform hover:scale-105 transition-all md:col-span-2">🚂 Замер ЖДЦ</button>
      </div>
      <div className="flex flex-wrap justify-center gap-4 mt-8 pt-6 border-t border-gray-700">
        <button onClick={handleDownloadReport} className="bg-teal-600 hover:bg-teal-700 text-white font-bold py-3 px-6 rounded-lg shadow-md transition-all flex items-center gap-2 transform hover:scale-105">
            📊 Скачать отчет
        </button>
        <button onClick={handleEndShift} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-12 rounded-lg shadow-md transition-all text-lg transform hover:scale-105">🏁 Закрыть смену</button>
        <button onClick={handleDeleteShift} className="bg-red-900/50 hover:bg-red-800 text-red-200 font-bold py-3 px-6 rounded-lg shadow-md transition-all border border-red-800 transform hover:scale-105">🗑️ Удалить запись</button>
      </div>
    </div>
  );

  const renderFuelMeasurementScreen = () => {
    const tanks50 = [1, 2, 3, 4, 5, 6, 7, 8];
    const tanks100 = [1, 2, 3, 4];
    return (
      <div className="w-full max-w-5xl text-center animate-fade-in">
        <h2 className="text-3xl font-bold text-white mb-8">Выбор резервуара</h2>
        <div className="bg-gray-800 p-6 rounded-xl shadow-2xl border border-gray-700 mb-8">
          <h3 className="text-xl text-gray-300 mb-4 text-left border-b border-gray-600 pb-2 font-bold">РГС-50</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            {tanks50.map(num => <button key={`50-${num}`} onClick={() => handleTankSelect(`РГС-50 №${num}`)} className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-4 rounded-lg shadow-md transition-all">№{num}</button>)}
          </div>
          <h3 className="text-xl text-gray-300 mb-4 text-left border-b border-gray-600 pb-2 font-bold">РГС-100</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {tanks100.map(num => <button key={`100-${num}`} onClick={() => handleTankSelect(`РГС-100 №${num}`)} className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-4 rounded-lg shadow-md transition-all">№{num}</button>)}
          </div>
        </div>
        <button onClick={() => setCurrentScreen('mainMenu')} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 px-8 rounded-lg">Назад</button>
      </div>
    );
  };

  const renderTankEntryScreen = () => (
    <div className="w-full max-w-lg text-center animate-fade-in p-4 relative">
        {showResultModal && calculationResult && (
            <div className="absolute inset-0 z-50 flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-black bg-opacity-80 backdrop-blur-sm rounded-xl"></div>
                <div className="bg-gray-800 border border-teal-500 p-6 rounded-2xl shadow-2xl relative z-10 w-full max-w-md animate-fade-in-up">
                    <h3 className="text-2xl font-bold text-white mb-6">Результаты замера</h3>
                    <div className="space-y-4 text-left text-lg">
                        <div className="flex justify-between border-b border-gray-700 pb-2"><span className="text-gray-400">Резервуар:</span><span className="font-bold text-teal-400">{selectedTank}</span></div>
                        <div className="flex justify-between border-b border-gray-700 pb-2"><span className="text-gray-400">Плотность:</span><span className="font-bold text-white">{tankFormData.density} г/см³</span></div>
                        <div className="flex justify-between border-b border-gray-700 pb-2"><span className="text-gray-400">Ср. взлив:</span><span className="font-bold text-white">{calculationResult.average} мм</span></div>
                        <div className="flex justify-between border-b border-gray-700 pb-2"><span className="text-gray-400">Объем:</span><span className="font-bold text-blue-400">{calculationResult.volume} л</span></div>
                        <div className="flex justify-between border-b border-gray-700 pb-2"><span className="text-gray-400">Масса:</span><span className="font-bold text-green-400">{calculationResult.mass} кг</span></div>
                    </div>
                    <button onClick={() => { setShowResultModal(false); setCurrentScreen('fuelMeasurement'); }} className="mt-8 w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-3 rounded-lg transition-all active:scale-95">Закрыть</button>
                </div>
            </div>
        )}
        <h2 className="text-2xl font-bold text-white mb-6">Ввод данных: {selectedTank}</h2>
        {formError && <div className="mb-4 p-3 bg-red-900 border border-red-700 rounded-lg text-red-200">{formError}</div>}
        <div className="bg-gray-800 p-6 rounded-xl shadow-2xl border border-gray-700 space-y-4">
          {[1, 2, 3].map(num => (
            <div key={`m${num}`} className="flex flex-col text-left">
              <label className="text-gray-400 text-xs mb-1">Замер №{num} (мм)</label>
              <input type="text" value={tankFormData[`m${num}` as keyof TankFormData]} onChange={(e) => handleInputChange(`m${num}` as keyof TankFormData, e.target.value)} placeholder="0000" maxLength={4} className="w-full bg-gray-700 text-white border border-gray-600 rounded-lg p-3 text-lg" />
            </div>
          ))}
          <div className="flex flex-col text-left"><label className="text-gray-400 text-xs mb-1">Плотность (г/см³)</label><input type="number" step="0.0001" value={tankFormData.density} onChange={(e) => handleInputChange('density', e.target.value)} placeholder="0.0000" className="w-full bg-gray-700 text-white border border-gray-600 rounded-lg p-3 text-lg" /></div>
          <div className="flex flex-col text-left"><label className="text-gray-400 text-xs mb-1">Температура (°C)</label><input type="number" step="0.1" value={tankFormData.temp} onChange={(e) => handleInputChange('temp', e.target.value)} placeholder="0.0" className="w-full bg-gray-700 text-white border border-gray-600 rounded-lg p-3 text-lg" /></div>
        </div>
        <div className="flex flex-wrap justify-center gap-4 mt-8">
          <button onClick={handleSubmitTankData} className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded-lg shadow-md transition-all active:scale-95">💾 Сохранить</button>
          <button onClick={() => setCurrentScreen('fuelMeasurement')} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 px-8 rounded-lg shadow-md transition-all">Назад</button>
        </div>
    </div>
  );

  const renderTzaSelection = () => (
      <div className="w-full max-w-4xl text-center animate-fade-in">
          <h2 className="text-3xl font-bold text-white mb-8">Выбор ТЗА</h2>
          <div className="flex flex-col md:flex-row justify-center gap-6 mb-12">
              <button onClick={() => handleTzaSelect('173')} className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-6 px-12 rounded-xl text-2xl shadow-lg transition-all active:scale-95">173</button>
              <button onClick={() => handleTzaSelect('174')} className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-6 px-12 rounded-xl text-2xl shadow-lg transition-all active:scale-95">174</button>
          </div>
          <button onClick={() => setCurrentScreen('mainMenu')} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 px-8 rounded-lg transition-all">Назад</button>
      </div>
  );

  const renderTzaReservoirSelection = () => {
      const tanks50 = [1, 2, 3, 4, 5, 6, 7, 8];
      return (
          <div className="w-full max-w-5xl text-center animate-fade-in p-2">
            <h2 className="text-3xl font-bold text-white mb-2">Расходный резервуар</h2>
            <p className="text-gray-400 mb-8">Выбран ТЗА: {selectedTza}</p>
            <div className="bg-gray-800 p-6 rounded-xl shadow-2xl border border-gray-700 mb-8">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {tanks50.map(num => <button key={`50-${num}`} onClick={() => handleTzaReservoirSelect(`РГС-50 №${num}`)} className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-4 rounded-lg transition-all">РГС-50 №{num}</button>)}
              </div>
            </div>
            <button onClick={() => setCurrentScreen('tzaSelection')} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 px-8 rounded-lg shadow-md transition-all">Назад</button>
          </div>
      );
  };

  const renderTzaEntry = () => (
      <div className="w-full max-w-lg text-center animate-fade-in p-4 relative">
          {showTzaModal && tzaResult && (
            <div className="absolute inset-0 z-50 flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-black bg-opacity-80 backdrop-blur-sm rounded-xl"></div>
                <div className="bg-gray-800 border border-green-500 p-6 rounded-2xl shadow-2xl relative z-10 w-full max-w-md animate-fade-in-up">
                    <h3 className="text-2xl font-bold text-white mb-6">Выдача подтверждена</h3>
                    <div className="space-y-4 text-left text-lg">
                        <div className="flex justify-between border-b border-gray-700 pb-2"><span className="text-gray-400">ТЗА | Рез:</span><span className="font-bold text-white">{selectedTza} | {selectedTzaReservoir}</span></div>
                        <div className="flex justify-between border-b border-gray-700 pb-2"><span className="text-gray-400">Литры:</span><span className="font-bold text-blue-400">{tzaResult.issuedL} л</span></div>
                        <div className="flex justify-between border-b border-gray-700 pb-2"><span className="text-gray-400">Масса:</span><span className="font-bold text-green-400">{tzaResult.issuedKg} кг</span></div>
                    </div>
                    <button onClick={() => { setShowTzaModal(false); setCurrentScreen('mainMenu'); }} className="mt-8 w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-lg shadow-lg active:scale-95">ОК</button>
                </div>
            </div>
        )}
          <h2 className="text-2xl font-bold text-white mb-2">Показания счетчика</h2>
          <p className="text-gray-400 mb-6">{selectedTza} | {selectedTzaReservoir}</p>
          {formError && <div className="mb-4 p-3 bg-red-900 border border-red-700 rounded-lg text-red-200">{formError}</div>}
          <div className="bg-gray-800 p-6 rounded-xl shadow-2xl border border-gray-700 space-y-6">
              <div className="flex flex-col text-left"><label className="text-gray-400 text-xs mb-1">Счетчик ДО</label><input type="number" value={tzaFormData.start} onChange={(e) => setTzaFormData(p => ({...p, start: e.target.value}))} placeholder="000000" className="w-full bg-gray-700 text-white border border-gray-600 rounded-lg p-3 text-xl font-mono" /></div>
              <div className="flex flex-col text-left"><label className="text-gray-400 text-xs mb-1">Счетчик ПОСЛЕ</label><input type="number" value={tzaFormData.end} onChange={(e) => setTzaFormData(p => ({...p, end: e.target.value}))} placeholder="000000" className="w-full bg-gray-700 text-white border border-gray-600 rounded-lg p-3 text-xl font-mono" /></div>
          </div>
          <div className="flex flex-wrap justify-center gap-4 mt-8">
            <button onClick={handleSubmitTzaData} className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded-lg shadow-md transition-all active:scale-95">Внести данные</button>
            <button onClick={() => setCurrentScreen('tzaReservoirSelection')} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 px-8 rounded-lg transition-all">Назад</button>
          </div>
      </div>
  );

  const renderPriemReservoirSelection = () => {
    const tanks50 = [1, 2, 3, 4, 5, 6, 7, 8];
    const tanks100 = [1, 2, 3, 4];
    return (
      <div className="w-full max-w-5xl text-center animate-fade-in">
        <h2 className="text-3xl font-bold text-white mb-8">Выбор приемного резервуара</h2>
        <div className="bg-gray-800 p-6 rounded-xl shadow-2xl border border-gray-700 mb-8">
          <h3 className="text-xl text-gray-300 mb-4 text-left border-b border-gray-600 pb-2 font-bold">РГС-50</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            {tanks50.map(num => <button key={`priem-50-${num}`} onClick={() => handlePriemTankSelect(`РГС-50 №${num}`)} className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-4 rounded-lg transition-all">№{num}</button>)}
          </div>
          <h3 className="text-xl text-gray-300 mb-4 text-left border-b border-gray-600 pb-2 font-bold">РГС-100</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {tanks100.map(num => <button key={`priem-100-${num}`} onClick={() => handlePriemTankSelect(`РГС-100 №${num}`)} className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-4 rounded-lg transition-all">№{num}</button>)}
          </div>
        </div>
        <button onClick={() => setCurrentScreen('mainMenu')} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 px-8 rounded-lg">Назад</button>
      </div>
    );
  };

  const renderPriemEntry = () => (
    <div className="w-full max-w-lg text-center animate-fade-in p-4 relative">
        {showPriemModal && priemResult && (
            <div className="absolute inset-0 z-50 flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-black bg-opacity-80 backdrop-blur-sm rounded-xl"></div>
                <div className="bg-gray-800 border border-blue-500 p-6 rounded-2xl shadow-2xl relative z-10 w-full max-w-md animate-fade-in-up">
                    <h3 className="text-2xl font-bold text-white mb-6">Прием подтвержден</h3>
                    <div className="space-y-4 text-left text-lg">
                        <div className="flex justify-between border-b border-gray-700 pb-2"><span className="text-gray-400">Резервуар:</span><span className="font-bold text-white">{selectedPriemTank}</span></div>
                        <div className="flex justify-between border-b border-gray-700 pb-2"><span className="text-gray-400">Принято (л):</span><span className="font-bold text-blue-400">{priemResult.receivedL} л</span></div>
                        <div className="flex justify-between border-b border-gray-700 pb-2"><span className="text-gray-400">Принято (кг):</span><span className="font-bold text-green-400">{priemResult.receivedKg} кг</span></div>
                    </div>
                    <button onClick={() => { setShowPriemModal(false); setCurrentScreen('mainMenu'); }} className="mt-8 w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg shadow-lg active:scale-95">ОК</button>
                </div>
            </div>
        )}
        <h2 className="text-2xl font-bold text-white mb-2">Ввод счетчиков (Прием)</h2>
        <p className="text-gray-400 mb-6">{selectedPriemTank}</p>
        {formError && <div className="mb-4 p-3 bg-red-900 border border-red-700 rounded-lg text-red-200">{formError}</div>}
        <div className="bg-gray-800 p-6 rounded-xl shadow-2xl border border-gray-700 space-y-6">
            <div className="flex flex-col text-left">
                <label className="text-gray-400 text-xs mb-1">Счетчик ДО</label>
                <input type="number" step="1" value={priemFormData.start} onChange={(e) => setPriemFormData(p => ({...p, start: e.target.value}))} placeholder="0" className="w-full bg-gray-700 text-white border border-gray-600 rounded-lg p-3 text-xl font-mono" />
            </div>
            <div className="flex flex-col text-left">
                <label className="text-gray-400 text-xs mb-1">Счетчик ПОСЛЕ</label>
                <input type="number" step="1" value={priemFormData.end} onChange={(e) => setPriemFormData(p => ({...p, end: e.target.value}))} placeholder="0" className="w-full bg-gray-700 text-white border border-gray-600 rounded-lg p-3 text-xl font-mono" />
            </div>
        </div>
        <div className="flex flex-wrap justify-center gap-4 mt-8">
          <button onClick={handleSubmitPriemData} className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded-lg shadow-md transition-all active:scale-95">Внести данные</button>
          <button onClick={() => setCurrentScreen('priemReservoirSelection')} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 px-8 rounded-lg transition-all">Назад</button>
        </div>
    </div>
  );

  const renderVsTzaSelection = () => (
      <div className="w-full max-w-4xl text-center animate-fade-in">
          <h2 className="text-3xl font-bold text-white mb-8">Выбор ТЗА (Выдача в ВС)</h2>
          <div className="flex flex-col md:flex-row justify-center gap-6 mb-12">
              <button onClick={() => handleVsTzaSelect('173')} className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-6 px-12 rounded-xl text-2xl shadow-lg transition-all active:scale-95">173</button>
              <button onClick={() => handleVsTzaSelect('174')} className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-6 px-12 rounded-xl text-2xl shadow-lg transition-all active:scale-95">174</button>
          </div>
          <button onClick={() => setCurrentScreen('mainMenu')} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 px-8 rounded-lg transition-all">Назад</button>
      </div>
  );

  const renderVsEntry = () => (
      <div className="w-full max-w-lg text-center animate-fade-in p-4 relative">
          {showVsModal && vsResult && (
            <div className="absolute inset-0 z-50 flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-black bg-opacity-80 backdrop-blur-sm rounded-xl"></div>
                <div className="bg-gray-800 border border-green-500 p-6 rounded-2xl shadow-2xl relative z-10 w-full max-w-md animate-fade-in-up">
                    <h3 className="text-2xl font-bold text-white mb-6">Заправка ВС завершена</h3>
                    <div className="space-y-4 text-left text-lg">
                        <div className="flex justify-between border-b border-gray-700 pb-2"><span className="text-gray-400">ТЗА:</span><span className="font-bold text-white">{selectedVsTza}</span></div>
                        <div className="flex justify-between border-b border-gray-700 pb-2"><span className="text-gray-400">Талон №:</span><span className="font-bold text-white">{vsFormData.coupon}</span></div>
                        <div className="flex justify-between border-b border-gray-700 pb-2"><span className="text-gray-400">Плотность:</span><span className="font-bold text-white">{vsFormData.density} г/см³</span></div>
                        <div className="flex justify-between border-b border-gray-700 pb-2"><span className="text-gray-400">Литры:</span><span className="font-bold text-blue-400">{vsResult.issuedL} л</span></div>
                        <div className="flex justify-between border-b border-gray-700 pb-2"><span className="text-gray-400">Масса:</span><span className="font-bold text-green-400">{vsResult.issuedKg} кг</span></div>
                    </div>
                    <button onClick={() => { setShowVsModal(false); setCurrentScreen('mainMenu'); }} className="mt-8 w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-lg shadow-lg active:scale-95">ОК</button>
                </div>
            </div>
        )}
          <h2 className="text-2xl font-bold text-white mb-2">Выдача в ВС</h2>
          <p className="text-gray-400 mb-6">Выбран ТЗА: {selectedVsTza}</p>
          {formError && <div className="mb-4 p-3 bg-red-900 border border-red-700 rounded-lg text-red-200">{formError}</div>}
          <div className="bg-gray-800 p-6 rounded-xl shadow-2xl border border-gray-700 space-y-4">
              <div className="flex flex-col text-left">
                  <label className="text-gray-400 text-xs mb-1">Номер контрольного талона</label>
                  <input type="number" value={vsFormData.coupon} onChange={(e) => setVsFormData(p => ({...p, coupon: e.target.value}))} placeholder="0" className="w-full bg-gray-700 text-white border border-gray-600 rounded-lg p-3 text-lg" />
              </div>
              <div className="flex flex-col text-left">
                  <label className="text-gray-400 text-xs mb-1">Счетчик ДО</label>
                  <input type="number" value={vsFormData.start} onChange={(e) => setVsFormData(p => ({...p, start: e.target.value}))} placeholder="0" className="w-full bg-gray-700 text-white border border-gray-600 rounded-lg p-3 text-lg font-mono" />
              </div>
              <div className="flex flex-col text-left">
                  <label className="text-gray-400 text-xs mb-1">Счетчик ПОСЛЕ</label>
                  <input type="number" value={vsFormData.end} onChange={(e) => setVsFormData(p => ({...p, end: e.target.value}))} placeholder="0" className="w-full bg-gray-700 text-white border border-gray-600 rounded-lg p-3 text-lg font-mono" />
              </div>
              <div className="flex flex-col text-left">
                  <label className="text-gray-400 text-xs mb-1">Плотность талона (г/см³)</label>
                  <input type="number" step="0.0001" value={vsFormData.density} onChange={(e) => setVsFormData(p => ({...p, density: e.target.value}))} placeholder="0.0000" className="w-full bg-gray-700 text-white border border-gray-600 rounded-lg p-3 text-lg" />
              </div>
          </div>
          <div className="flex flex-wrap justify-center gap-4 mt-8">
            <button onClick={handleSubmitVsData} className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded-lg shadow-md transition-all active:scale-95">Внести данные</button>
            <button onClick={() => setCurrentScreen('mainMenu')} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 px-8 rounded-lg transition-all">Отменить</button>
          </div>
      </div>
  );

  const renderJdcEntry = () => (
      <div className="w-full max-w-lg text-center animate-fade-in p-4 relative">
          {showJdcModal && jdcResult && (
            <div className="absolute inset-0 z-50 flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-black bg-opacity-80 backdrop-blur-sm rounded-xl"></div>
                <div className="bg-gray-800 border border-green-500 p-6 rounded-2xl shadow-2xl relative z-10 w-full max-w-md animate-fade-in-up">
                    <h3 className="text-2xl font-bold text-white mb-6">Замер ЖДЦ сохранен</h3>
                    <div className="space-y-4 text-left text-lg">
                        <div className="flex justify-between border-b border-gray-700 pb-2"><span className="text-gray-400">Вагон №:</span><span className="font-bold text-white">{jdcFormData.number}</span></div>
                        <div className="flex justify-between border-b border-gray-700 pb-2"><span className="text-gray-400">Тип:</span><span className="font-bold text-blue-400">{jdcFormData.type}</span></div>
                        {jdcResult.volume > 0 && (
                            <>
                                <div className="flex justify-between border-b border-gray-700 pb-2"><span className="text-gray-400">Плотность:</span><span className="font-bold text-white">{jdcResult.density} г/см³</span></div>
                                <div className="flex justify-between border-b border-gray-700 pb-2"><span className="text-gray-400">Объем:</span><span className="font-bold text-emerald-400">{jdcResult.volume} л</span></div>
                                <div className="flex justify-between border-b border-gray-700 pb-2"><span className="text-gray-400">Масса:</span><span className="font-bold text-yellow-400">{jdcResult.mass} кг</span></div>
                            </>
                        )}
                    </div>
                    <button onClick={() => { setShowJdcModal(false); setCurrentScreen('mainMenu'); }} className="mt-8 w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-lg shadow-lg active:scale-95">ОК</button>
                </div>
            </div>
          )}
          <h2 className="text-2xl font-bold text-white mb-4">Замеры железнодорожной цистерны</h2>
          
          {formError && <div className="mb-4 p-3 bg-red-900 border border-red-700 rounded-lg text-red-200">{formError}</div>}
          
          <div className="bg-gray-800 p-6 rounded-xl shadow-2xl border border-gray-700 space-y-4">
              {/* Type Selection */}
              <div className="flex flex-col text-left">
                  <label className="text-gray-400 text-xs mb-2">Тип вагона</label>
                  <div className="flex flex-wrap gap-2 justify-between">
                      {['66', '72', '81', '90', '92'].map((type) => (
                          <button 
                            key={type} 
                            onClick={() => handleJdcTypeSelect(type)}
                            className={`flex-1 py-2 px-1 rounded font-bold text-sm transition-all ${jdcFormData.type === type ? 'bg-indigo-600 text-white ring-2 ring-indigo-400' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                          >
                              {type}
                          </button>
                      ))}
                  </div>
              </div>

              <div className="flex flex-col text-left">
                  <label className="text-gray-400 text-xs mb-1">Номер вагона</label>
                  <input type="text" value={jdcFormData.number} onChange={(e) => handleJdcInputChange('number', e.target.value)} placeholder="00000000" maxLength={8} className="w-full bg-gray-700 text-white border border-gray-600 rounded-lg p-3 text-lg font-mono" />
              </div>

              <div className="grid grid-cols-3 gap-3">
                  {[1, 2, 3].map(num => (
                    <div key={`jdc-m${num}`} className="flex flex-col text-left">
                      <label className="text-gray-400 text-xs mb-1">Замер {num}</label>
                      <input type="text" value={jdcFormData[`m${num}` as keyof JdcFormData]} onChange={(e) => handleJdcInputChange(`m${num}` as keyof JdcFormData, e.target.value)} placeholder="0" maxLength={4} className="w-full bg-gray-700 text-white border border-gray-600 rounded-lg p-2 text-lg text-center" />
                    </div>
                  ))}
              </div>

              <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col text-left">
                      <label className="text-gray-400 text-xs mb-1">Плотность</label>
                      <input type="number" step="0.0001" value={jdcFormData.density} onChange={(e) => handleJdcInputChange('density', e.target.value)} placeholder="0.0000" className="w-full bg-gray-700 text-white border border-gray-600 rounded-lg p-3 text-lg" />
                  </div>
                  <div className="flex flex-col text-left">
                      <label className="text-gray-400 text-xs mb-1">Температура</label>
                      <input type="number" step="0.1" value={jdcFormData.temp} onChange={(e) => handleJdcInputChange('temp', e.target.value)} placeholder="0.0" className="w-full bg-gray-700 text-white border border-gray-600 rounded-lg p-3 text-lg" />
                  </div>
              </div>
          </div>
          
          <div className="flex flex-wrap justify-center gap-4 mt-8">
            <button onClick={handleSubmitJdcData} className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded-lg shadow-md transition-all active:scale-95">💾 Сохранить</button>
            <button onClick={handleJdcBack} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 px-8 rounded-lg shadow-md transition-all">Назад</button>
          </div>
      </div>
  );

  return (
    <div className="min-h-screen bg-gray-900 text-white font-sans flex items-center justify-center p-4">
      {currentScreen === 'selection' && renderSelectionScreen()}
      {currentScreen === 'mainMenu' && renderMainMenu()}
      {currentScreen === 'fuelMeasurement' && renderFuelMeasurementScreen()}
      {currentScreen === 'tankEntry' && renderTankEntryScreen()}
      {currentScreen === 'tzaSelection' && renderTzaSelection()}
      {currentScreen === 'tzaReservoirSelection' && renderTzaReservoirSelection()}
      {currentScreen === 'tzaEntry' && renderTzaEntry()}
      {currentScreen === 'priemReservoirSelection' && renderPriemReservoirSelection()}
      {currentScreen === 'priemEntry' && renderPriemEntry()}
      {currentScreen === 'vsTzaSelection' && renderVsTzaSelection()}
      {currentScreen === 'vsEntry' && renderVsEntry()}
      {currentScreen === 'jdcEntry' && renderJdcEntry()}
    </div>
  );
};

export default App;
