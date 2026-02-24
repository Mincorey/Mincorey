
import React, { useEffect, useState, useRef } from 'react';
import { createNewWorkbook, workbookToArrayBuffer, addShiftEntry, deleteShiftEntry, findShiftRowForToday, saveTankMeasurements, saveExcelFile, getTankMeasurements, saveTzaIssue, saveFuelReceipt, saveVsIssue, findUnclosedShift, closeShiftEntry, saveJdcMeasurement, generateBalanceReport, getBalanceReportData, getPriemReportData, getTzaReportData, getVsReportData, getSmenaReportData } from './excelUtils';
import { saveFileToDB, loadFileFromDB, clearFileFromDB } from './storageUtils';
import ExcelJS from 'exceljs';
import { shareElementAsImage, saveElementAsImage } from './shareUtils';
import Calendar from './Calendar';
// Типы экранов приложения
type Screen = 'selection' | 'mainMenu' | 'fuelMeasurement' | 'tankEntry' | 'tzaSelection' | 'tzaReservoirSelection' | 'tzaEntry' | 'priemReservoirSelection' | 'priemEntry' | 'vsTzaSelection' | 'vsEntry' | 'jdcEntry' | 'reportsMenu' | 'reportOstatki' | 'reportPriem' | 'reportTza' | 'reportVs' | 'reportSmena' | 'adminPanel';

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
  const [employees, setEmployees] = useState<string[]>(() => {
    const savedEmployees = localStorage.getItem('employees');
    return savedEmployees ? JSON.parse(savedEmployees) : ['Гулуа Т. Д.', 'Адлейба А. С.', 'Курт-Оглы Р. Г.', 'Дочия А. Д.'];
  });

  useEffect(() => {
    localStorage.setItem('employees', JSON.stringify(employees));
  }, [employees]);
  
  const [workbook, setWorkbook] = useState<ExcelJS.Workbook | null>(null);
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
  const tzaResultRef = useRef<HTMLDivElement>(null);

  const [selectedPriemTank, setSelectedPriemTank] = useState<string>('');
  const [priemFormData, setPriemFormData] = useState<{ start: string; end: string }>({ start: '', end: '' });
  const [priemResult, setPriemResult] = useState<FlowResult | null>(null);
  const [showPriemModal, setShowPriemModal] = useState<boolean>(false);
  const priemResultRef = useRef<HTMLDivElement>(null);

  const [selectedVsTza, setSelectedVsTza] = useState<string>('');
  const [vsFormData, setVsFormData] = useState<{ coupon: string; start: string; end: string; density: string }>({ coupon: '', start: '', end: '', density: '' });
  const [vsResult, setVsResult] = useState<FlowResult | null>(null);
  const [showVsModal, setShowVsModal] = useState<boolean>(false);
  const vsResultRef = useRef<HTMLDivElement>(null);
  
  const [jdcFormData, setJdcFormData] = useState<JdcFormData>({ type: '', number: '', m1: '', m2: '', m3: '', density: '', temp: '' });
  const [jdcResult, setJdcResult] = useState<{ volume: number, mass: number, density: number } | null>(null);
  const [showJdcModal, setShowJdcModal] = useState<boolean>(false);
  const jdcResultRef = useRef<HTMLDivElement>(null);

  const [calculationResult, setCalculationResult] = useState<CalculationResult | null>(null);
  const [showResultModal, setShowResultModal] = useState<boolean>(false);
  const tankResultRef = useRef<HTMLDivElement>(null);

  const [showAdminPasswordModal, setShowAdminPasswordModal] = useState<boolean>(false);
  const [adminPassword, setAdminPassword] = useState<string>('');
  
  const [smenaReportData, setSmenaReportData] = useState<{ rows: any[], totals: any } | null>(null);
  const [showSmenaReportModal, setShowSmenaReportModal] = useState<boolean>(false);
  const smenaReportRef = useRef<HTMLDivElement>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
      if (typeof window !== 'undefined') {
          return localStorage.getItem('theme') as 'light' | 'dark' || 'dark';
      }
      return 'dark';
  });

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);
  const [showAddEmployeeModal, setShowAddEmployeeModal] = useState<boolean>(false);
  const [newEmployeeName, setNewEmployeeName] = useState<string>('');
  const [showDeleteEmployeeModal, setShowDeleteEmployeeModal] = useState<boolean>(false);
  const [employeeToDelete, setEmployeeToDelete] = useState<string | null>(null);

  const [reportSelectionType, setReportSelectionType] = useState<'all' | 'all50' | 'all100' | 'custom' | null>(null);
  const [selectedReportTanks, setSelectedReportTanks] = useState<string[]>([]);
  const [ostatkiReportData, setOstatkiReportData] = useState<any | null>(null);
  const [showOstatkiModal, setShowOstatkiModal] = useState<boolean>(false);
  const ostatkiReportRef = useRef<HTMLDivElement>(null);

  const [selectedReportDates, setSelectedReportDates] = useState<Date[]>([]);
  const [priemReportData, setPriemReportData] = useState<any | null>(null);
  const [showPriemReportModal, setShowPriemReportModal] = useState<boolean>(false);
  const priemReportRef = useRef<HTMLDivElement>(null);

  const [tzaReportData, setTzaReportData] = useState<any | null>(null);
  const [showTzaReportModal, setShowTzaReportModal] = useState<boolean>(false);
  const tzaReportRef = useRef<HTMLDivElement>(null);

  const [vsReportData, setVsReportData] = useState<any | null>(null);
  const [showVsReportModal, setShowVsReportModal] = useState<boolean>(false);
  const vsReportRef = useRef<HTMLDivElement>(null);

  const handleAdminPasswordSubmit = () => {
    if (adminPassword === '190787') {
      setShowAdminPasswordModal(false);
      setAdminPassword('');
      setCurrentScreen('adminPanel');
    } else {
      alert('Неверный пароль');
      setAdminPassword('');
    }
  };

  const handleAddEmployee = () => {
    if (newEmployeeName.trim() === '') {
      alert('Имя сотрудника не может быть пустым');
      return;
    }
    setEmployees(prev => [...prev, newEmployeeName.trim()]);
    setNewEmployeeName('');
    setShowAddEmployeeModal(false);
  };

  const handleDeleteEmployee = () => {
    if (employeeToDelete) {
      setEmployees(prev => prev.filter(emp => emp !== employeeToDelete));
      setEmployeeToDelete(null);
      setShowDeleteEmployeeModal(false);
    }
  };

  const renderAdminPasswordModal = () => (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-80 z-50 animate-fade-in">
      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-2xl w-80 text-center relative">
        <h4 className="text-gray-700 dark:text-gray-300 font-bold mb-6 border-b border-gray-300 dark:border-gray-600 pb-2">Вход в панель администратора</h4>
        <input 
          type="password"
          value={adminPassword}
          onChange={(e) => setAdminPassword(e.target.value)}
          className="w-full bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 rounded-lg p-3 text-lg mb-4"
          placeholder="Введите пароль"
        />
        <div className="flex gap-4">
          <button onClick={handleAdminPasswordSubmit} className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-lg shadow-md transition-all active:scale-98">ОК</button>
          <button onClick={() => setShowAdminPasswordModal(false)} className="flex-1 bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 rounded-lg shadow-md transition-all active:scale-98">Назад</button>
        </div>
      </div>
    </div>
  );

  const renderAddEmployeeModal = () => (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-80 z-50 animate-fade-in">
      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-2xl w-80 text-center relative">
        <h4 className="text-gray-700 dark:text-gray-300 font-bold mb-6 border-b border-gray-300 dark:border-gray-600 pb-2">Добавление авиатехника</h4>
        <input 
          type="text"
          value={newEmployeeName}
          onChange={(e) => setNewEmployeeName(e.target.value)}
          className="w-full bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 rounded-lg p-3 text-lg mb-4"
          placeholder="Ф. И. О. сотрудника"
        />
        <div className="flex gap-4">
          <button onClick={handleAddEmployee} className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-lg shadow-md transition-all active:scale-98">Добавить</button>
          <button onClick={() => setShowAddEmployeeModal(false)} className="flex-1 bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 rounded-lg shadow-md transition-all active:scale-98">Отмена</button>
        </div>
      </div>
    </div>
  );

  const renderDeleteEmployeeModal = () => (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-80 z-50 animate-fade-in">
      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-2xl w-96 text-center relative">
        <h4 className="text-gray-700 dark:text-gray-300 font-bold mb-6 border-b border-gray-300 dark:border-gray-600 pb-2">Удаление авиатехника</h4>
        <div className="flex flex-col gap-4 mb-6">
          {employees.map(emp => (
            <button key={emp} onClick={() => setEmployeeToDelete(emp)} className={`w-full text-white font-bold py-3 px-6 rounded-lg shadow-lg transition-all active:scale-98 ${employeeToDelete === emp ? 'bg-red-700 ring-2 ring-red-400' : 'bg-red-900/80 hover:bg-red-800'}`}>
              {emp}
            </button>
          ))}
        </div>
        <div className="flex gap-4">
          <button onClick={handleDeleteEmployee} disabled={!employeeToDelete} className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-lg shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-98">Удалить</button>
          <button onClick={() => {setShowDeleteEmployeeModal(false); setEmployeeToDelete(null);}} className="flex-1 bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 rounded-lg shadow-md transition-all active:scale-98">Отмена</button>
        </div>
      </div>
    </div>
  );

  const renderAdminPanel = () => (
    <div className="w-full max-w-4xl text-center animate-fade-in">
      <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">Панель администратора</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto mb-10">
        <button onClick={() => document.getElementById('manual-upload-input')?.click()} className="bg-blue-700 hover:bg-blue-600 text-white font-bold py-4 px-6 rounded-xl shadow-lg transform hover:scale-102 transition-all active:scale-98">📥 Импорт базы (XLSX)</button>
        <input type="file" id="manual-upload-input" accept=".xlsx, .xls" onChange={handleManualUpload} className="hidden" />
        <button onClick={handleDownloadReport} className="bg-green-700 hover:bg-green-600 text-white font-bold py-4 px-6 rounded-xl shadow-lg transform hover:scale-102 transition-all active:scale-98">💾 Скачать копию</button>
        <button onClick={handleResetDatabase} className="bg-red-900/80 hover:bg-red-800 text-red-200 font-bold py-4 px-6 rounded-xl shadow-lg transform hover:scale-102 transition-all border border-red-800 active:scale-98">🔄 Полный сброс (Reset)</button>
        <button onClick={() => setShowAddEmployeeModal(true)} className="bg-sky-600 hover:bg-sky-700 text-white font-bold py-4 px-6 rounded-xl shadow-lg transform hover:scale-102 transition-all active:scale-98">👤 Добавить сотрудника</button>
        <button onClick={() => setShowDeleteEmployeeModal(true)} className="bg-rose-800 hover:bg-rose-900 text-white font-bold py-4 px-6 rounded-xl shadow-lg transform hover:scale-102 transition-all active:scale-98">🗑️ Удалить сотрудника</button>
      </div>
      <div className="max-w-2xl mx-auto text-left text-gray-600 dark:text-gray-400 text-sm space-y-4 mb-10">
        <p><strong className="text-green-600 dark:text-green-400">💾 Скачать копию:</strong> Эта кнопка позволяет скачать текущую версию файла базы данных (ZAMER_main_.xlsx) в том виде, в котором она хранится в вашем браузере. Это полезно для создания резервных копий.</p>
        <p><strong className="text-red-600 dark:text-red-400">🔄 Полный сброс:</strong> Эта кнопка полностью удаляет локальную базу данных из вашего браузера. После сброса приложение попытается загрузить "чистую" версию ZAMER_main_.xlsx из корневой папки. Используйте с осторожностью, так как все несохраненные данные будут потеряны.</p>
      </div>
      <button onClick={() => setCurrentScreen('selection')} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 px-8 rounded-lg shadow-md transition-all active:scale-98">Назад</button>

      {showAddEmployeeModal && renderAddEmployeeModal()}
      {showDeleteEmployeeModal && renderDeleteEmployeeModal()}
    </div>
  );

  const persistWorkbook = async (wb: ExcelJS.Workbook) => {
      try {
          const buffer = await workbookToArrayBuffer(wb);
          await saveFileToDB(buffer);
      } catch (e) {
          console.error("Ошибка сохранения:", e);
      }
  };

  const checkForUnclosedShifts = (wb: ExcelJS.Workbook) => {
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
        let wb: ExcelJS.Workbook | null = null;
        
        // 1. Пытаемся загрузить из локальной БД
        try {
            const storedFile = await loadFileFromDB();
            if (storedFile) {
                console.log("Загружено из локальной БД");
                wb = new ExcelJS.Workbook();
                await wb.xlsx.load(storedFile);
            }
        } catch (dbError) {
            console.warn("Локальная БД пуста или ошибка чтения:", dbError);
        }

        // 2. Если в БД пусто, пытаемся скачать "Мастер-файл"
        if (!wb) {
            try {
                console.log("Попытка загрузки ZAMER_main_.xlsx из корня...");
                const response = await fetch('/ZAMER_main_.xlsx');
                if (response.ok) {
                    const arrayBuffer = await response.arrayBuffer();
                    wb = new ExcelJS.Workbook();
                    await wb.xlsx.load(arrayBuffer);
                    await persistWorkbook(wb);
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
    
    initExcel();
  }, []);

  const handleManualUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
          setIsLoading(true);
          try {
              const arrayBuffer = await file.arrayBuffer();
              const wb = new ExcelJS.Workbook();
              await wb.xlsx.load(arrayBuffer);
              setWorkbook(wb);
              checkForUnclosedShifts(wb);
              await saveFileToDB(arrayBuffer);
              setStatusMessage("База данных обновлена вручную!");
              setStatusType('success');
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

  const handleDownloadReport = async () => {
      if (workbook) {
          const dateStr = new Date().toISOString().slice(0,10);
          await saveExcelFile(workbook, `ZAMER_Report_${dateStr}.xlsx`);
      }
  };

  const handleDownloadSpecificReport = (reportType: string) => {
      if (reportType === 'Ostatki') {
          setReportSelectionType(null);
          setSelectedReportTanks([]);
          setCurrentScreen('reportOstatki');
          return;
      }
      if (reportType === 'Prihod') {
          setSelectedReportDates([]);
          setCurrentScreen('reportPriem');
          return;
      }
      if (reportType === 'Vidacha_TZA') {
          setSelectedReportDates([]);
          setCurrentScreen('reportTza');
          return;
      }
      if (reportType === 'Vidacha_VS') {
          setSelectedReportDates([]);
          setCurrentScreen('reportVs');
          return;
      }
      // For now, we just download the full report with a specific name hint
      // In a real implementation, we might filter sheets or generate a PDF
      if (workbook) {
          const dateStr = new Date().toISOString().slice(0,10);
          saveExcelFile(workbook, `ZAMER_${reportType}_${dateStr}.xlsx`);
      }
  };

  const handleReportGroupSelect = (type: 'all' | 'all50' | 'all100') => {
      setReportSelectionType(type);
      setSelectedReportTanks([]);
  };

  const handleReportTankToggle = (tankName: string) => {
      setReportSelectionType('custom');
      setSelectedReportTanks(prev => {
          if (prev.includes(tankName)) return prev.filter(t => t !== tankName);
          return [...prev, tankName];
      });
  };

  const handleGenerateOstatkiReport = () => {
      if (!workbook) return;
      let tanksToReport: string[] = [];
      
      const tanks50 = [1, 2, 3, 4, 5, 6, 7, 8].map(n => `РГС-50 №${n}`);
      const tanks100 = [1, 2, 3, 4].map(n => `РГС-100 №${n}`);

      if (reportSelectionType === 'all') {
          tanksToReport = [...tanks50, ...tanks100];
      } else if (reportSelectionType === 'all50') {
          tanksToReport = tanks50;
      } else if (reportSelectionType === 'all100') {
          tanksToReport = tanks100;
      } else if (reportSelectionType === 'custom') {
          tanksToReport = selectedReportTanks;
      }

      if (tanksToReport.length === 0) {
          alert('Выберите резервуары для отчета');
          return;
      }

      const data = getBalanceReportData(workbook, tanksToReport, reportSelectionType || 'custom');
      setOstatkiReportData(data);
      setShowOstatkiModal(true);
  };

  const handleGeneratePriemReport = () => {
      if (!workbook || selectedReportDates.length === 0) {
          alert('Выберите даты для отчета');
          return;
      }
      const data = getPriemReportData(workbook, selectedReportDates);
      setPriemReportData(data);
      setShowPriemReportModal(true);
  };

  const handleGenerateTzaReport = () => {
      if (!workbook || selectedReportDates.length === 0) {
          alert('Выберите даты для отчета');
          return;
      }
      const data = getTzaReportData(workbook, selectedReportDates);
      setTzaReportData(data);
      setShowTzaReportModal(true);
  };

  const handleGenerateVsReport = () => {
      if (!workbook || selectedReportDates.length === 0) {
          alert('Выберите даты для отчета');
          return;
      }
      const data = getVsReportData(workbook, selectedReportDates);
      setVsReportData(data);
      setShowVsReportModal(true);
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

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      alert("Текст скопирован в буфер обмена");
    }).catch(err => {
      console.error('Failed to copy: ', err);
    });
  };

  const renderSelectionScreen = () => (
    <div className="w-full max-w-4xl text-center animate-fade-in relative min-h-[400px] flex flex-col justify-center">

      <svg className="w-16 h-16 mx-auto mb-3 text-violet-600 dark:text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
      </svg>
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Система автоматизации службы ГСМ</h1>
      <p className="text-base text-gray-600 dark:text-gray-400 mb-6">Международный Аэропорт "Сухум"</p>
      
      {unclosedShiftInfo && (
          <div className="mb-4 p-3 bg-orange-100 dark:bg-orange-900/40 border border-orange-300 dark:border-orange-700 rounded-xl animate-bounce mx-auto max-w-md">
              <h3 className="text-orange-800 dark:text-orange-300 font-bold text-base">⚠️ Обнаружена незакрытая смена!</h3>
              <p className="text-orange-700 dark:text-orange-200 text-sm">{unclosedShiftInfo.employee} от {unclosedShiftInfo.date}</p>
          </div>
      )}

      <p className="text-lg font-semibold mb-6 text-gray-500 dark:text-gray-400 text-center">Выберите сотрудника на смене</p>
      
      {isLoading ? (
        <div className="text-yellow-600 dark:text-yellow-400 animate-pulse mb-4 font-bold text-lg">Загрузка базы данных...</div>
      ) : (
        <>
          {statusMessage && (
            <div className={`mb-4 p-3 border rounded-lg mx-auto max-w-md ${statusType === 'error' ? 'bg-red-100 dark:bg-red-900 border-red-300 dark:border-red-700 text-red-800 dark:text-red-200' : 'bg-green-100 dark:bg-gray-800 border-green-300 dark:border-gray-700 text-green-800 dark:text-green-400'}`}>
              {statusMessage}
            </div>
          )}
          <div className="flex flex-col items-center gap-3 mb-6">
            {employees.map((employee) => (
              <button key={employee} onClick={() => handleEmployeeSelect(employee)}
                className="w-64 bg-white dark:bg-violet-600 hover:bg-gray-100 dark:hover:bg-violet-700 text-gray-900 dark:text-white border-2 border-gray-300 dark:border-transparent font-bold py-2 px-4 rounded-lg shadow-sm dark:shadow-lg transition-all active:scale-98 text-sm">
                {employee}
              </button>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center mt-6 w-full max-w-md mx-auto border-t border-gray-300 dark:border-gray-800 pt-4">
              <button
                onClick={() => setCurrentScreen('reportsMenu')}
                className="flex-1 bg-white dark:bg-teal-800 hover:bg-gray-100 dark:hover:bg-teal-700 text-gray-900 dark:text-teal-100 border-2 border-gray-300 dark:border-transparent font-bold py-2 px-4 rounded-lg shadow-sm dark:shadow-lg transition-all flex items-center justify-center gap-2 active:scale-98 text-sm"
              >
                📊 Отчеты/Журналы
              </button>
              <button
                onClick={() => setShowAdminPasswordModal(true)}
                className="flex-1 bg-white dark:bg-slate-700 hover:bg-gray-100 dark:hover:bg-slate-600 text-gray-900 dark:text-gray-200 border-2 border-gray-300 dark:border-transparent font-bold py-2 px-4 rounded-lg shadow-sm dark:shadow-lg transition-all flex items-center justify-center gap-2 active:scale-98 text-sm"
              >
                ⚙️ Панель Админа
              </button>
          </div>

          {showAdminPasswordModal && renderAdminPasswordModal()}
        </>
      )}
    </div>
  );

  const renderMainMenu = () => (
    <div className="w-full max-w-4xl text-center animate-fade-in">
      <div className="mb-4">
        <h2 className="text-lg text-gray-500 dark:text-gray-400">Текущая смена:</h2>
        <div className="flex items-center justify-center gap-4 mt-1">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{currentEmployee}</h1>
            <span className="text-2xl text-violet-600 dark:text-violet-400 font-medium border-l border-gray-300 dark:border-gray-700 pl-4">{currentShiftDate}</span>
        </div>
      </div>
      <div className="flex flex-col items-center gap-3 mb-4">
        <button onClick={() => setCurrentScreen('fuelMeasurement')} className="w-64 bg-white dark:bg-blue-600 hover:bg-gray-100 dark:hover:bg-blue-700 text-gray-900 dark:text-white border-2 border-gray-300 dark:border-transparent font-bold py-3 px-6 rounded-xl shadow-sm dark:shadow-lg transform hover:scale-102 transition-all">📏 Замер топлива</button>
        <button onClick={() => setCurrentScreen('priemReservoirSelection')} className="w-64 bg-white dark:bg-blue-600 hover:bg-gray-100 dark:hover:bg-blue-700 text-gray-900 dark:text-white border-2 border-gray-300 dark:border-transparent font-bold py-3 px-6 rounded-xl shadow-sm dark:shadow-lg transform hover:scale-102 transition-all">📥 Прием топлива</button>
        <button onClick={() => setCurrentScreen('tzaSelection')} className="w-64 bg-white dark:bg-blue-600 hover:bg-gray-100 dark:hover:bg-blue-700 text-gray-900 dark:text-white border-2 border-gray-300 dark:border-transparent font-bold py-3 px-6 rounded-xl shadow-sm dark:shadow-lg transform hover:scale-102 transition-all">🚛 Выдача в ТЗА</button>
        <button onClick={() => setCurrentScreen('vsTzaSelection')} className="w-64 bg-white dark:bg-blue-600 hover:bg-gray-100 dark:hover:bg-blue-700 text-gray-900 dark:text-white border-2 border-gray-300 dark:border-transparent font-bold py-3 px-6 rounded-xl shadow-sm dark:shadow-lg transform hover:scale-102 transition-all">✈️ Выдача в ВС</button>
        <button onClick={() => setCurrentScreen('jdcEntry')} className="w-64 bg-white dark:bg-blue-600 hover:bg-gray-100 dark:hover:bg-blue-700 text-gray-900 dark:text-white border-2 border-gray-300 dark:border-transparent font-bold py-3 px-6 rounded-xl shadow-sm dark:shadow-lg transform hover:scale-102 transition-all">🚂 Замер ЖДЦ</button>
      </div>
      <div className="flex flex-col items-center gap-2 mt-4 pt-2 border-t border-gray-300 dark:border-gray-700">
        <button onClick={handleDownloadReport} className="w-60 bg-white dark:bg-teal-600 hover:bg-gray-100 dark:hover:bg-teal-700 text-gray-900 dark:text-white border-2 border-gray-300 dark:border-transparent font-bold py-2 px-6 rounded-lg shadow-sm dark:shadow-md transition-all flex items-center justify-center gap-2 transform hover:scale-102">
            📊 Скачать отчет
        </button>
        <button onClick={handleEndShift} className="w-60 bg-white dark:bg-emerald-600 hover:bg-gray-100 dark:hover:bg-emerald-700 text-gray-900 dark:text-white border-2 border-gray-300 dark:border-transparent font-bold py-2 px-6 rounded-lg shadow-sm dark:shadow-md transition-all transform hover:scale-102">🏁 Закрыть смену</button>
        <button onClick={handleDeleteShift} className="w-60 bg-red-50 dark:bg-red-900/50 hover:bg-red-100 dark:hover:bg-red-800 text-red-800 dark:text-red-200 font-bold py-2 px-6 rounded-lg shadow-sm dark:shadow-md transition-all border border-red-300 dark:border-red-800 transform hover:scale-102">🗑️ Удалить запись</button>
      </div>
    </div>
  );

  const renderFuelMeasurementScreen = () => {
    const tanks50 = [1, 2, 3, 4, 5, 6, 7, 8];
    const tanks100 = [1, 2, 3, 4];
    return (
      <div className="w-full max-w-5xl text-center animate-fade-in">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">Выбор резервуара</h2>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg dark:shadow-2xl border border-gray-200 dark:border-gray-700 mb-8">
          <h3 className="text-xl text-gray-600 dark:text-gray-300 mb-4 text-left border-b border-gray-300 dark:border-gray-600 pb-2 font-bold">РГС-50</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            {tanks50.map(num => <button key={`50-${num}`} onClick={() => handleTankSelect(`РГС-50 №${num}`)} className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-4 rounded-lg shadow-md transition-all active:scale-98">№{num}</button>)}
          </div>
          <h3 className="text-xl text-gray-600 dark:text-gray-300 mb-4 text-left border-b border-gray-300 dark:border-gray-600 pb-2 font-bold">РГС-100</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {tanks100.map(num => <button key={`100-${num}`} onClick={() => handleTankSelect(`РГС-100 №${num}`)} className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-4 rounded-lg shadow-md transition-all active:scale-98">№{num}</button>)}
          </div>
        </div>
        <button onClick={() => setCurrentScreen('mainMenu')} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 px-8 rounded-lg shadow-md transition-all active:scale-98">Назад</button>
      </div>
    );
  };

  const renderTankEntryScreen = () => (
    <div className="w-full max-w-lg text-center animate-fade-in p-4 relative">
        {showResultModal && calculationResult && (
            <div className="absolute inset-0 z-50 flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-black bg-opacity-80 backdrop-blur-sm rounded-xl"></div>
                <div className="bg-gray-800 border border-teal-500 p-6 rounded-2xl shadow-2xl relative z-10 w-full max-w-md animate-fade-in-up">
                    <div ref={tankResultRef} className="bg-gray-800 p-4 rounded-xl">
                        <h3 className="text-2xl font-bold text-white mb-6">Результаты замера</h3>
                        <div className="space-y-4 text-left text-lg">
                            <div className="flex justify-between border-b border-gray-700 pb-2"><span className="text-gray-400">Резервуар:</span><span className="font-bold text-teal-400">{selectedTank}</span></div>
                            <div className="flex justify-between border-b border-gray-700 pb-2"><span className="text-gray-400">Плотность:</span><span className="font-bold text-white">{tankFormData.density} г/см³</span></div>
                            <div className="flex justify-between border-b border-gray-700 pb-2"><span className="text-gray-400">Ср. взлив:</span><span className="font-bold text-white">{calculationResult.average} мм</span></div>
                            <div className="flex justify-between border-b border-gray-700 pb-2"><span className="text-gray-400">Объем:</span><span className="font-bold text-blue-400">{calculationResult.volume} л</span></div>
                            <div className="flex justify-between border-b border-gray-700 pb-2"><span className="text-gray-400">Масса:</span><span className="font-bold text-green-400">{calculationResult.mass} кг</span></div>
                        </div>
                    </div>
                    <div className="flex flex-col gap-3 mt-8">
                        <div className="flex gap-3">
                            <button onClick={() => tankResultRef.current && shareElementAsImage(tankResultRef.current, `Zamer_${selectedTank}.png`)} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition-all active:scale-98 flex items-center justify-center gap-2">
                               📤 Отправить
                            </button>
                            <button onClick={() => tankResultRef.current && saveElementAsImage(tankResultRef.current, `Zamer_${selectedTank}.png`)} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-lg transition-all active:scale-98 flex items-center justify-center gap-2">
                               💾 Сохранить
                            </button>
                        </div>
                        <button onClick={() => {
                            const text = `${selectedTank}\nЗамер ср.\t${calculationResult.average} мм.\nПлотность\t${tankFormData.density} г/см. куб.\nТемпература\t${tankFormData.temp} гр. Ц.\nОбъем\t\t${calculationResult.volume} л.\nМасса\t\t${calculationResult.mass} кг.`;
                            copyToClipboard(text);
                        }} className="w-full bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 rounded-lg shadow-lg active:scale-98 flex items-center justify-center gap-2">
                            📋 Скопировать текст
                        </button>
                        <button onClick={() => { setShowResultModal(false); setCurrentScreen('fuelMeasurement'); }} className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-3 rounded-lg transition-all active:scale-98">Закрыть</button>
                    </div>
                </div>
            </div>
        )}
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Ввод данных: {selectedTank}</h2>
        {formError && <div className="mb-4 p-3 bg-red-100 dark:bg-red-900 border border-red-300 dark:border-red-700 rounded-lg text-red-800 dark:text-red-200">{formError}</div>}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg dark:shadow-2xl border border-gray-200 dark:border-gray-700 space-y-4">
          {[1, 2, 3].map(num => (
            <div key={`m${num}`} className="flex flex-col text-left">
              <label className="text-gray-500 dark:text-gray-400 text-xs mb-1">Замер №{num} (мм)</label>
              <input type="text" value={tankFormData[`m${num}` as keyof TankFormData]} onChange={(e) => handleInputChange(`m${num}` as keyof TankFormData, e.target.value)} placeholder="0000" maxLength={4} className="w-full bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 rounded-lg p-3 text-lg" />
            </div>
          ))}
          <div className="flex flex-col text-left"><label className="text-gray-500 dark:text-gray-400 text-xs mb-1">Плотность (г/см³)</label><input type="number" step="0.0001" value={tankFormData.density} onChange={(e) => handleInputChange('density', e.target.value)} placeholder="0.0000" className="w-full bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 rounded-lg p-3 text-lg" /></div>
          <div className="flex flex-col text-left"><label className="text-gray-500 dark:text-gray-400 text-xs mb-1">Температура (°C)</label><input type="number" step="0.1" value={tankFormData.temp} onChange={(e) => handleInputChange('temp', e.target.value)} placeholder="0.0" className="w-full bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 rounded-lg p-3 text-lg" /></div>
        </div>
        <div className="flex flex-wrap justify-center gap-4 mt-8">
          <button onClick={handleSubmitTankData} className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded-lg shadow-md transition-all active:scale-98">💾 Сохранить</button>
          <button onClick={() => setCurrentScreen('fuelMeasurement')} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 px-8 rounded-lg shadow-md transition-all active:scale-98">Назад</button>
        </div>
    </div>
  );

  const renderTzaSelection = () => (
      <div className="w-full max-w-4xl text-center animate-fade-in">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">Выбор ТЗА</h2>
          <div className="flex flex-col md:flex-row justify-center gap-6 mb-12">
              <button onClick={() => handleTzaSelect('173')} className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-6 px-12 rounded-xl text-2xl shadow-lg transition-all active:scale-98">173</button>
              <button onClick={() => handleTzaSelect('174')} className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-6 px-12 rounded-xl text-2xl shadow-lg transition-all active:scale-98">174</button>
          </div>
          <button onClick={() => setCurrentScreen('mainMenu')} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 px-8 rounded-lg transition-all active:scale-98">Назад</button>
      </div>
  );

  const renderTzaReservoirSelection = () => {
      const tanks50 = [1, 2, 3, 4, 5, 6, 7, 8];
      return (
          <div className="w-full max-w-5xl text-center animate-fade-in p-2">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Расходный резервуар</h2>
            <p className="text-gray-500 dark:text-gray-400 mb-8">Выбран ТЗА: {selectedTza}</p>
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg dark:shadow-2xl border border-gray-200 dark:border-gray-700 mb-8">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {tanks50.map(num => <button key={`50-${num}`} onClick={() => handleTzaReservoirSelect(`РГС-50 №${num}`)} className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-4 rounded-lg transition-all active:scale-98">РГС-50 №{num}</button>)}
              </div>
            </div>
            <button onClick={() => setCurrentScreen('tzaSelection')} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 px-8 rounded-lg shadow-md transition-all active:scale-98">Назад</button>
          </div>
      );
  };

  const renderTzaEntry = () => (
      <div className="w-full max-w-lg text-center animate-fade-in p-4 relative">
          {showTzaModal && tzaResult && (
            <div className="absolute inset-0 z-50 flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-black bg-opacity-80 backdrop-blur-sm rounded-xl"></div>
                <div className="bg-gray-800 border border-green-500 p-6 rounded-2xl shadow-2xl relative z-10 w-full max-w-md animate-fade-in-up">
                    <div ref={tzaResultRef} className="bg-gray-800 p-4 rounded-xl">
                        <h3 className="text-2xl font-bold text-white mb-6">Выдача подтверждена</h3>
                        <div className="space-y-4 text-left text-lg">
                            <div className="flex justify-between border-b border-gray-700 pb-2"><span className="text-gray-400">ТЗА | Рез:</span><span className="font-bold text-white">{selectedTza} | {selectedTzaReservoir}</span></div>
                            <div className="flex justify-between border-b border-gray-700 pb-2"><span className="text-gray-400">Литры:</span><span className="font-bold text-blue-400">{tzaResult.issuedL} л</span></div>
                            <div className="flex justify-between border-b border-gray-700 pb-2"><span className="text-gray-400">Масса:</span><span className="font-bold text-green-400">{tzaResult.issuedKg} кг</span></div>
                        </div>
                    </div>
                    <div className="flex flex-col gap-3 mt-8">
                        <div className="flex gap-3">
                            <button onClick={() => tzaResultRef.current && shareElementAsImage(tzaResultRef.current, `TZA_${selectedTza}.png`)} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg shadow-lg active:scale-98 flex items-center justify-center gap-2">
                               📤 Отправить
                            </button>
                            <button onClick={() => tzaResultRef.current && saveElementAsImage(tzaResultRef.current, `TZA_${selectedTza}.png`)} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-lg shadow-lg active:scale-98 flex items-center justify-center gap-2">
                               💾 Сохранить
                            </button>
                        </div>
                        <button onClick={() => {
                            const text = `ТЗА | Рез: ${selectedTza} | ${selectedTzaReservoir}\nЛитры:\t\t${tzaResult.issuedL} л.\nМасса:\t\t${tzaResult.issuedKg} кг.`;
                            copyToClipboard(text);
                        }} className="w-full bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 rounded-lg shadow-lg active:scale-98 flex items-center justify-center gap-2">
                            📋 Скопировать текст
                        </button>
                        <button onClick={() => { setShowTzaModal(false); setCurrentScreen('mainMenu'); }} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-lg shadow-lg active:scale-98">ОК</button>
                    </div>
                </div>
            </div>
        )}
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Показания счетчика</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-6">{selectedTza} | {selectedTzaReservoir}</p>
          {formError && <div className="mb-4 p-3 bg-red-100 dark:bg-red-900 border border-red-300 dark:border-red-700 rounded-lg text-red-800 dark:text-red-200">{formError}</div>}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg dark:shadow-2xl border border-gray-200 dark:border-gray-700 space-y-6">
              <div className="flex flex-col text-left"><label className="text-gray-500 dark:text-gray-400 text-xs mb-1">Счетчик ДО</label><input type="number" value={tzaFormData.start} onChange={(e) => setTzaFormData(p => ({...p, start: e.target.value}))} placeholder="000000" className="w-full bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 rounded-lg p-3 text-xl font-mono" /></div>
              <div className="flex flex-col text-left"><label className="text-gray-500 dark:text-gray-400 text-xs mb-1">Счетчик ПОСЛЕ</label><input type="number" value={tzaFormData.end} onChange={(e) => setTzaFormData(p => ({...p, end: e.target.value}))} placeholder="000000" className="w-full bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 rounded-lg p-3 text-xl font-mono" /></div>
          </div>
          <div className="flex flex-wrap justify-center gap-4 mt-8">
            <button onClick={handleSubmitTzaData} className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded-lg shadow-md transition-all active:scale-98">Внести данные</button>
            <button onClick={() => setCurrentScreen('tzaReservoirSelection')} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 px-8 rounded-lg transition-all active:scale-98">Назад</button>
          </div>
      </div>
  );

  const renderPriemReservoirSelection = () => {
    const tanks50 = [1, 2, 3, 4, 5, 6, 7, 8];
    const tanks100 = [1, 2, 3, 4];
    return (
      <div className="w-full max-w-5xl text-center animate-fade-in">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">Выбор приемного резервуара</h2>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg dark:shadow-2xl border border-gray-200 dark:border-gray-700 mb-8">
          <h3 className="text-xl text-gray-600 dark:text-gray-300 mb-4 text-left border-b border-gray-300 dark:border-gray-600 pb-2 font-bold">РГС-50</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            {tanks50.map(num => <button key={`priem-50-${num}`} onClick={() => handlePriemTankSelect(`РГС-50 №${num}`)} className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-4 rounded-lg transition-all active:scale-98">№{num}</button>)}
          </div>
          <h3 className="text-xl text-gray-600 dark:text-gray-300 mb-4 text-left border-b border-gray-300 dark:border-gray-600 pb-2 font-bold">РГС-100</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {tanks100.map(num => <button key={`priem-100-${num}`} onClick={() => handlePriemTankSelect(`РГС-100 №${num}`)} className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-4 rounded-lg transition-all active:scale-98">№{num}</button>)}
          </div>
        </div>
        <button onClick={() => setCurrentScreen('mainMenu')} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 px-8 rounded-lg shadow-md transition-all active:scale-98">Назад</button>
      </div>
    );
  };

  const renderPriemEntry = () => (
    <div className="w-full max-w-lg text-center animate-fade-in p-4 relative">
        {showPriemModal && priemResult && (
            <div className="absolute inset-0 z-50 flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-black bg-opacity-80 backdrop-blur-sm rounded-xl"></div>
                <div className="bg-gray-800 border border-blue-500 p-6 rounded-2xl shadow-2xl relative z-10 w-full max-w-md animate-fade-in-up">
                    <div ref={priemResultRef} className="bg-gray-800 p-4 rounded-xl">
                        <h3 className="text-2xl font-bold text-white mb-6">Прием подтвержден</h3>
                        <div className="space-y-4 text-left text-lg">
                            <div className="flex justify-between border-b border-gray-700 pb-2"><span className="text-gray-400">Резервуар:</span><span className="font-bold text-white">{selectedPriemTank}</span></div>
                            <div className="flex justify-between border-b border-gray-700 pb-2"><span className="text-gray-400">Принято (л):</span><span className="font-bold text-blue-400">{priemResult.receivedL} л</span></div>
                            <div className="flex justify-between border-b border-gray-700 pb-2"><span className="text-gray-400">Принято (кг):</span><span className="font-bold text-green-400">{priemResult.receivedKg} кг</span></div>
                        </div>
                    </div>
                    <div className="flex flex-col gap-3 mt-8">
                        <div className="flex gap-3">
                            <button onClick={() => priemResultRef.current && shareElementAsImage(priemResultRef.current, `Priem_${selectedPriemTank}.png`)} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg shadow-lg active:scale-98 flex items-center justify-center gap-2">
                               📤 Отправить
                            </button>
                            <button onClick={() => priemResultRef.current && saveElementAsImage(priemResultRef.current, `Priem_${selectedPriemTank}.png`)} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-lg shadow-lg active:scale-98 flex items-center justify-center gap-2">
                               💾 Сохранить
                            </button>
                        </div>
                        <button onClick={() => {
                            const text = `Резервуар:\t${selectedPriemTank}\nПринято:\t${priemResult.receivedL} л.\nМасса:\t\t${priemResult.receivedKg} кг.`;
                            copyToClipboard(text);
                        }} className="w-full bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 rounded-lg shadow-lg active:scale-98 flex items-center justify-center gap-2">
                            📋 Скопировать текст
                        </button>
                        <button onClick={() => { setShowPriemModal(false); setCurrentScreen('mainMenu'); }} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg shadow-lg active:scale-98">ОК</button>
                    </div>
                </div>
            </div>
        )}
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Ввод счетчиков (Прием)</h2>
        <p className="text-gray-500 dark:text-gray-400 mb-6">{selectedPriemTank}</p>
        {formError && <div className="mb-4 p-3 bg-red-100 dark:bg-red-900 border border-red-300 dark:border-red-700 rounded-lg text-red-800 dark:text-red-200">{formError}</div>}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg dark:shadow-2xl border border-gray-200 dark:border-gray-700 space-y-6">
            <div className="flex flex-col text-left">
                <label className="text-gray-500 dark:text-gray-400 text-xs mb-1">Счетчик ДО</label>
                <input type="number" step="1" value={priemFormData.start} onChange={(e) => setPriemFormData(p => ({...p, start: e.target.value}))} placeholder="0" className="w-full bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 rounded-lg p-3 text-xl font-mono" />
            </div>
            <div className="flex flex-col text-left">
                <label className="text-gray-500 dark:text-gray-400 text-xs mb-1">Счетчик ПОСЛЕ</label>
                <input type="number" step="1" value={priemFormData.end} onChange={(e) => setPriemFormData(p => ({...p, end: e.target.value}))} placeholder="0" className="w-full bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 rounded-lg p-3 text-xl font-mono" />
            </div>
        </div>
        <div className="flex flex-wrap justify-center gap-4 mt-8">
          <button onClick={handleSubmitPriemData} className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded-lg shadow-md transition-all active:scale-98">Внести данные</button>
          <button onClick={() => setCurrentScreen('priemReservoirSelection')} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 px-8 rounded-lg shadow-md transition-all active:scale-98">Назад</button>
        </div>
    </div>
  );

  const renderVsTzaSelection = () => (
      <div className="w-full max-w-4xl text-center animate-fade-in">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">Выбор ТЗА (Выдача в ВС)</h2>
          <div className="flex flex-col md:flex-row justify-center gap-6 mb-12">
              <button onClick={() => handleVsTzaSelect('173')} className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-6 px-12 rounded-xl text-2xl shadow-lg transition-all active:scale-98">173</button>
              <button onClick={() => handleVsTzaSelect('174')} className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-6 px-12 rounded-xl text-2xl shadow-lg transition-all active:scale-98">174</button>
          </div>
          <button onClick={() => setCurrentScreen('mainMenu')} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 px-8 rounded-lg transition-all active:scale-98">Назад</button>
      </div>
  );

  const renderVsEntry = () => (
      <div className="w-full max-w-lg text-center animate-fade-in p-4 relative">
          {showVsModal && vsResult && (
            <div className="absolute inset-0 z-50 flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-black bg-opacity-80 backdrop-blur-sm rounded-xl"></div>
                <div className="bg-gray-800 border border-green-500 p-6 rounded-2xl shadow-2xl relative z-10 w-full max-w-md animate-fade-in-up">
                    <div ref={vsResultRef} className="bg-gray-800 p-4 rounded-xl">
                        <h3 className="text-2xl font-bold text-white mb-6">Заправка ВС завершена</h3>
                        <div className="space-y-4 text-left text-lg">
                            <div className="flex justify-between border-b border-gray-700 pb-2"><span className="text-gray-400">ТЗА:</span><span className="font-bold text-white">{selectedVsTza}</span></div>
                            <div className="flex justify-between border-b border-gray-700 pb-2"><span className="text-gray-400">Талон №:</span><span className="font-bold text-white">{vsFormData.coupon}</span></div>
                            <div className="flex justify-between border-b border-gray-700 pb-2"><span className="text-gray-400">Плотность:</span><span className="font-bold text-white">{vsFormData.density} г/см³</span></div>
                            <div className="flex justify-between border-b border-gray-700 pb-2"><span className="text-gray-400">Литры:</span><span className="font-bold text-blue-400">{vsResult.issuedL} л</span></div>
                            <div className="flex justify-between border-b border-gray-700 pb-2"><span className="text-gray-400">Масса:</span><span className="font-bold text-green-400">{vsResult.issuedKg} кг</span></div>
                        </div>
                    </div>
                    <div className="flex flex-col gap-3 mt-8">
                        <div className="flex gap-3">
                            <button onClick={() => vsResultRef.current && shareElementAsImage(vsResultRef.current, `VS_${selectedVsTza}_${vsFormData.coupon}.png`)} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg shadow-lg active:scale-98 flex items-center justify-center gap-2">
                               📤 Отправить
                            </button>
                            <button onClick={() => vsResultRef.current && saveElementAsImage(vsResultRef.current, `VS_${selectedVsTza}_${vsFormData.coupon}.png`)} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-lg shadow-lg active:scale-98 flex items-center justify-center gap-2">
                               💾 Сохранить
                            </button>
                        </div>
                        <button onClick={() => {
                            const text = `ТЗА:\t\t${selectedVsTza}\nТалон №:\t${vsFormData.coupon}\nПлотность:\t${vsFormData.density} г/см. куб.\nЛитры:\t\t${vsResult.issuedL} л.\nМасса:\t\t${vsResult.issuedKg} кг.`;
                            copyToClipboard(text);
                        }} className="w-full bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 rounded-lg shadow-lg active:scale-98 flex items-center justify-center gap-2">
                            📋 Скопировать текст
                        </button>
                        <button onClick={() => { setShowVsModal(false); setCurrentScreen('mainMenu'); }} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-lg shadow-lg active:scale-98">ОК</button>
                    </div>
                </div>
            </div>
        )}
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Выдача в ВС</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-6">Выбран ТЗА: {selectedVsTza}</p>
          {formError && <div className="mb-4 p-3 bg-red-100 dark:bg-red-900 border border-red-300 dark:border-red-700 rounded-lg text-red-800 dark:text-red-200">{formError}</div>}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg dark:shadow-2xl border border-gray-200 dark:border-gray-700 space-y-4">
              <div className="flex flex-col text-left">
                  <label className="text-gray-500 dark:text-gray-400 text-xs mb-1">Номер контрольного талона</label>
                  <input type="number" value={vsFormData.coupon} onChange={(e) => setVsFormData(p => ({...p, coupon: e.target.value}))} placeholder="0" className="w-full bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 rounded-lg p-3 text-lg" />
              </div>
              <div className="flex flex-col text-left">
                  <label className="text-gray-500 dark:text-gray-400 text-xs mb-1">Счетчик ДО</label>
                  <input type="number" value={vsFormData.start} onChange={(e) => setVsFormData(p => ({...p, start: e.target.value}))} placeholder="0" className="w-full bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 rounded-lg p-3 text-lg font-mono" />
              </div>
              <div className="flex flex-col text-left">
                  <label className="text-gray-500 dark:text-gray-400 text-xs mb-1">Счетчик ПОСЛЕ</label>
                  <input type="number" value={vsFormData.end} onChange={(e) => setVsFormData(p => ({...p, end: e.target.value}))} placeholder="0" className="w-full bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 rounded-lg p-3 text-lg font-mono" />
              </div>
              <div className="flex flex-col text-left">
                  <label className="text-gray-500 dark:text-gray-400 text-xs mb-1">Плотность талона (г/см³)</label>
                  <input type="number" step="0.0001" value={vsFormData.density} onChange={(e) => setVsFormData(p => ({...p, density: e.target.value}))} placeholder="0.0000" className="w-full bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 rounded-lg p-3 text-lg" />
              </div>
          </div>
          <div className="flex flex-wrap justify-center gap-4 mt-8">
            <button onClick={handleSubmitVsData} className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded-lg shadow-md transition-all active:scale-98">Внести данные</button>
            <button onClick={() => setCurrentScreen('mainMenu')} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 px-8 rounded-lg transition-all active:scale-98">Отменить</button>
          </div>
      </div>
  );

  const renderJdcEntry = () => (
      <div className="w-full max-w-lg text-center animate-fade-in p-4 relative">
          {showJdcModal && jdcResult && (
            <div className="absolute inset-0 z-50 flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-black bg-opacity-80 backdrop-blur-sm rounded-xl"></div>
                <div className="bg-gray-800 border border-green-500 p-6 rounded-2xl shadow-2xl relative z-10 w-full max-w-md animate-fade-in-up">
                    <div ref={jdcResultRef} className="bg-gray-800 p-4 rounded-xl">
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
                    </div>
                    <div className="flex flex-col gap-3 mt-8">
                        <div className="flex gap-3">
                            <button onClick={() => jdcResultRef.current && shareElementAsImage(jdcResultRef.current, `JDC_${jdcFormData.number}.png`)} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg shadow-lg active:scale-98 flex items-center justify-center gap-2">
                               📤 Отправить
                            </button>
                            <button onClick={() => jdcResultRef.current && saveElementAsImage(jdcResultRef.current, `JDC_${jdcFormData.number}.png`)} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-lg shadow-lg active:scale-98 flex items-center justify-center gap-2">
                               💾 Сохранить
                            </button>
                        </div>
                        <button onClick={() => {
                            const text = `Вагон №:\t${jdcFormData.number}\nТип:\t\t${jdcFormData.type}\nПлотность:\t${jdcResult.density} г/см. куб.\nОбъем:\t\t${jdcResult.volume} л.\nМасса:\t\t${jdcResult.mass} кг.`;
                            copyToClipboard(text);
                        }} className="w-full bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 rounded-lg shadow-lg active:scale-98 flex items-center justify-center gap-2">
                            📋 Скопировать текст
                        </button>
                        <button onClick={() => { setShowJdcModal(false); setCurrentScreen('mainMenu'); }} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-lg shadow-lg active:scale-98">ОК</button>
                    </div>
                </div>
            </div>
          )}
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Замеры железнодорожной цистерны</h2>
          
          {formError && <div className="mb-4 p-3 bg-red-100 dark:bg-red-900 border border-red-300 dark:border-red-700 rounded-lg text-red-800 dark:text-red-200">{formError}</div>}
          
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg dark:shadow-2xl border border-gray-200 dark:border-gray-700 space-y-4">
              {/* Type Selection */}
              <div className="flex flex-col text-left">
                  <label className="text-gray-500 dark:text-gray-400 text-xs mb-2">Тип вагона</label>
                  <div className="flex flex-wrap gap-2 justify-between">
                      {['66', '72', '81', '90', '92'].map((type) => (
                          <button 
                            key={type} 
                            onClick={() => handleJdcTypeSelect(type)}
                            className={`flex-1 py-2 px-1 rounded font-bold text-sm transition-all ${jdcFormData.type === type ? 'bg-indigo-600 text-white ring-2 ring-indigo-400' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'}`}
                          >
                              {type}
                          </button>
                      ))}
                  </div>
              </div>

              <div className="flex flex-col text-left">
                  <label className="text-gray-500 dark:text-gray-400 text-xs mb-1">Номер вагона</label>
                  <input type="text" value={jdcFormData.number} onChange={(e) => handleJdcInputChange('number', e.target.value)} placeholder="00000000" maxLength={8} className="w-full bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 rounded-lg p-3 text-lg font-mono" />
              </div>

              <div className="grid grid-cols-3 gap-3">
                  {[1, 2, 3].map(num => (
                    <div key={`m${num}`} className="flex flex-col text-left">
                      <label className="text-gray-500 dark:text-gray-400 text-xs mb-1">Замер №{num}</label>
                      <input type="text" value={jdcFormData[`m${num}` as keyof JdcFormData]} onChange={(e) => handleJdcInputChange(`m${num}` as keyof JdcFormData, e.target.value)} placeholder="0000" maxLength={4} className="w-full bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 rounded-lg p-3 text-lg text-center" />
                    </div>
                  ))}
              </div>

              <div className="flex flex-col text-left">
                  <label className="text-gray-500 dark:text-gray-400 text-xs mb-1">Плотность ГСМ (г/см³)</label>
                  <input type="number" step="0.0001" value={jdcFormData.density} onChange={(e) => handleJdcInputChange('density', e.target.value)} placeholder="0.0000" className="w-full bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 rounded-lg p-3 text-lg" />
              </div>
              <div className="flex flex-col text-left">
                  <label className="text-gray-500 dark:text-gray-400 text-xs mb-1">Температура (°C)</label>
                  <input type="number" step="0.1" value={jdcFormData.temp} onChange={(e) => handleJdcInputChange('temp', e.target.value)} placeholder="00.0" className="w-full bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 rounded-lg p-3 text-lg" />
              </div>
          </div>
          <div className="flex flex-wrap justify-center gap-4 mt-8">
            <button onClick={handleSubmitJdcData} className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded-lg shadow-md transition-all active:scale-98">Внести данные</button>
            <button onClick={handleJdcBack} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 px-8 rounded-lg shadow-md transition-all active:scale-98">Назад</button>
          </div>
      </div>
  );

  const renderReportOstatkiScreen = () => {
      const tanks50 = [1, 2, 3, 4, 5, 6, 7, 8];
      const tanks100 = [1, 2, 3, 4];
      
      return (
          <div className="w-full max-w-5xl text-center animate-fade-in p-4 relative">
              {showOstatkiModal && ostatkiReportData && (
                  <div className="absolute inset-0 z-50 flex items-center justify-center p-4">
                      <div className="absolute inset-0 bg-black bg-opacity-80 backdrop-blur-sm rounded-xl"></div>
                      <div className="bg-gray-800 border border-cyan-500 p-6 rounded-2xl shadow-2xl relative z-10 w-full max-w-2xl animate-fade-in-up max-h-[90vh] overflow-y-auto flex flex-col">
                          <div ref={ostatkiReportRef} className="bg-gray-800 p-4 rounded-xl flex-1">
                              <h3 className="text-2xl font-bold text-white mb-6 text-center border-b border-gray-700 pb-4">Остатки на складе</h3>
                              <div className="space-y-6">
                                  {ostatkiReportData.tanks.map((tank: any, idx: number) => (
                                      <div key={idx} className="border-b border-gray-700 pb-4 last:border-0">
                                          <h4 className="text-lg font-bold text-teal-400 mb-2">{tank.name}</h4>
                                          <div className="flex flex-col gap-2 text-sm">
                                              <div className="flex justify-between border-b border-gray-700/50 pb-1"><span className="text-gray-400">Взлив:</span><span className="text-white font-mono">{tank.average} мм</span></div>
                                              <div className="flex justify-between border-b border-gray-700/50 pb-1"><span className="text-gray-400">Плотность:</span><span className="text-white font-mono">{tank.density}</span></div>
                                              <div className="flex justify-between border-b border-gray-700/50 pb-1"><span className="text-gray-400">Температура:</span><span className="text-white font-mono">{tank.temp}°C</span></div>
                                              <div className="flex justify-between border-b border-gray-700/50 pb-1"><span className="text-gray-400">Объем:</span><span className="text-blue-300 font-mono">{tank.volume} л</span></div>
                                              <div className="flex justify-between"><span className="text-gray-400">Масса:</span><span className="text-green-300 font-mono">{tank.mass} кг</span></div>
                                          </div>
                                      </div>
                                  ))}
                                  
                                  <div className="mt-6 pt-4 border-t-2 border-gray-600 bg-gray-900/50 p-4 rounded-lg">
                                      <h4 className="text-xl font-bold text-white mb-3 text-center">ИТОГО ПО СКЛАДУ</h4>
                                      <div className="space-y-2 text-base">
                                          <div className="flex justify-between"><span className="text-gray-400">Объем итого:</span><span className="text-blue-400 font-bold text-lg">{ostatkiReportData.totals.volume} л</span></div>
                                          <div className="flex justify-between"><span className="text-gray-400">Масса итого:</span><span className="text-green-400 font-bold text-lg">{ostatkiReportData.totals.mass} кг</span></div>
                                          <div className="flex justify-between"><span className="text-gray-400">Плотность ср.:</span><span className="text-white font-bold">{ostatkiReportData.totals.avgDensity} г/см³</span></div>
                                          <div className="flex justify-between"><span className="text-gray-400">Температура ср.:</span><span className="text-white font-bold">{ostatkiReportData.totals.avgTemp}°C</span></div>
                                      </div>
                                  </div>
                              </div>
                          </div>
                          <div className="flex flex-col gap-3 mt-6 pt-4 border-t border-gray-700 bg-gray-800 sticky bottom-0">
                              <div className="flex gap-3">
                                  <button onClick={() => ostatkiReportRef.current && shareElementAsImage(ostatkiReportRef.current, `Ostatki_Report.png`)} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg shadow-lg active:scale-98 flex items-center justify-center gap-2">
                                     📤 Отправить
                                  </button>
                                  <button onClick={() => ostatkiReportRef.current && saveElementAsImage(ostatkiReportRef.current, `Ostatki_Report.png`)} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-lg shadow-lg active:scale-98 flex items-center justify-center gap-2">
                                     💾 Скачать
                                  </button>
                              </div>
                              <button onClick={() => {
                                  let text = "Остатки на складе\n\n";
                                  ostatkiReportData.tanks.forEach((tank: any) => {
                                      text += `${tank.name}\nВзлив:\t${tank.average} мм\nПлотность:\t${tank.density}\nТемпература:\t${tank.temp}°C\nОбъем:\t${tank.volume} л\nМасса:\t${tank.mass} кг\n\n`;
                                  });
                                  text += `ИТОГО ПО СКЛАДУ\nОбъем итого:\t${ostatkiReportData.totals.volume} л\nМасса итого:\t${ostatkiReportData.totals.mass} кг\nПлотность ср.:\t${ostatkiReportData.totals.avgDensity} г/см³\nТемпература ср.:\t${ostatkiReportData.totals.avgTemp}°C`;
                                  copyToClipboard(text);
                              }} className="w-full bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 rounded-lg shadow-lg active:scale-98 flex items-center justify-center gap-2">
                                  📋 Скопировать текст
                              </button>
                              <button onClick={() => setShowOstatkiModal(false)} className="w-full bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 rounded-lg shadow-lg active:scale-98">Закрыть</button>
                          </div>
                      </div>
                  </div>
              )}
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">Отчет: Остатки на складе</h2>
              
              <div className="flex flex-col gap-4 mb-8">
                  <button 
                      onClick={() => handleReportGroupSelect('all')}
                      className={`py-4 px-6 rounded-xl font-bold text-lg shadow-lg transition-all ${reportSelectionType === 'all' ? 'bg-indigo-600 ring-4 ring-indigo-400 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'}`}
                  >
                      Остатки по всем РГС
                  </button>
                  <div className="flex gap-4">
                      <button 
                          onClick={() => handleReportGroupSelect('all50')}
                          className={`flex-1 py-4 px-6 rounded-xl font-bold text-lg shadow-lg transition-all ${reportSelectionType === 'all50' ? 'bg-indigo-600 ring-4 ring-indigo-400 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'}`}
                      >
                          Остатки по РГС-50
                      </button>
                      <button 
                          onClick={() => handleReportGroupSelect('all100')}
                          className={`flex-1 py-4 px-6 rounded-xl font-bold text-lg shadow-lg transition-all ${reportSelectionType === 'all100' ? 'bg-indigo-600 ring-4 ring-indigo-400 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'}`}
                      >
                          Остатки по РГС-100
                      </button>
                  </div>
              </div>

              <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg dark:shadow-2xl border border-gray-200 dark:border-gray-700 mb-8">
                  <h3 className="text-xl text-gray-600 dark:text-gray-300 mb-4 text-left border-b border-gray-300 dark:border-gray-600 pb-2 font-bold">Выбор отдельных резервуаров</h3>
                  
                  <div className="mb-6">
                      <h4 className="text-gray-500 dark:text-gray-400 text-sm mb-2 text-left">РГС-50</h4>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          {tanks50.map(num => {
                              const name = `РГС-50 №${num}`;
                              const isSelected = selectedReportTanks.includes(name);
                              const isDisabled = reportSelectionType !== 'custom' && reportSelectionType !== null;
                              return (
                                  <button 
                                      key={name} 
                                      onClick={() => handleReportTankToggle(name)}
                                      disabled={isDisabled}
                                      className={`py-3 rounded-lg font-semibold transition-all ${
                                          isDisabled ? 'opacity-50 cursor-not-allowed bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500' :
                                          isSelected ? 'bg-teal-600 text-white ring-2 ring-teal-400' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                                      }`}
                                  >
                                      №{num}
                                  </button>
                              );
                          })}
                      </div>
                  </div>

                  <div>
                      <h4 className="text-gray-500 dark:text-gray-400 text-sm mb-2 text-left">РГС-100</h4>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          {tanks100.map(num => {
                              const name = `РГС-100 №${num}`;
                              const isSelected = selectedReportTanks.includes(name);
                              const isDisabled = reportSelectionType !== 'custom' && reportSelectionType !== null;
                              return (
                                  <button 
                                      key={name} 
                                      onClick={() => handleReportTankToggle(name)}
                                      disabled={isDisabled}
                                      className={`py-3 rounded-lg font-semibold transition-all ${
                                          isDisabled ? 'opacity-50 cursor-not-allowed bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500' :
                                          isSelected ? 'bg-teal-600 text-white ring-2 ring-teal-400' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                                      }`}
                                  >
                                      №{num}
                                  </button>
                              );
                          })}
                      </div>
                  </div>
              </div>

              <div className="flex flex-col gap-4 max-w-md mx-auto">
                  <button onClick={handleGenerateOstatkiReport} className="bg-green-600 hover:bg-green-700 text-white font-bold py-4 px-8 rounded-xl shadow-lg transform hover:scale-102 transition-all">
                      📄 Сформировать отчет
                  </button>
                  <button onClick={() => setCurrentScreen('reportsMenu')} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 px-8 rounded-lg shadow-md transition-all">
                      Назад
                  </button>
              </div>
          </div>
      );
  };

  const renderReportPriemScreen = () => (
      <div className="w-full max-w-4xl text-center animate-fade-in p-4 relative">
          {showPriemReportModal && priemReportData && (
              <div className="absolute inset-0 z-50 flex items-center justify-center p-4">
                  <div className="absolute inset-0 bg-black bg-opacity-80 backdrop-blur-sm rounded-xl"></div>
                  <div className="bg-gray-800 border border-cyan-500 p-6 rounded-2xl shadow-2xl relative z-10 w-full max-w-2xl animate-fade-in-up max-h-[90vh] overflow-y-auto flex flex-col">
                      <div ref={priemReportRef} className="bg-gray-800 p-4 rounded-xl flex-1">
                          <h3 className="text-2xl font-bold text-white mb-6 text-center border-b border-gray-700 pb-4">Отчет по приходам</h3>
                          <div className="space-y-4">
                              {priemReportData.rows.map((row: any, idx: number) => (
                                  <div key={idx} className="border-b border-gray-700 pb-4 last:border-0">
                                      <div className="flex flex-col gap-2 text-sm">
                                          <div className="flex justify-between border-b border-gray-700/50 pb-1"><span className="text-gray-400">Дата:</span><span className="text-white font-mono">{row.date}</span></div>
                                          <div className="flex justify-between border-b border-gray-700/50 pb-1"><span className="text-gray-400">Смена:</span><span className="text-white font-mono">{row.employee || 'Неизвестно'}</span></div>
                                          <div className="flex justify-between border-b border-gray-700/50 pb-1"><span className="text-gray-400">Резервуар:</span><span className="text-white font-mono">{row.tank}</span></div>
                                          <div className="flex justify-between border-b border-gray-700/50 pb-1"><span className="text-gray-400">Принято (л):</span><span className="text-blue-300 font-mono">{row.l}</span></div>
                                          <div className="flex justify-between"><span className="text-gray-400">Принято (кг):</span><span className="text-green-300 font-mono">{row.kg}</span></div>
                                      </div>
                                  </div>
                              ))}
                              
                              <div className="mt-6 pt-4 border-t-2 border-gray-600 bg-gray-900/50 p-4 rounded-lg">
                                  <h4 className="text-xl font-bold text-white mb-3 text-center">ИТОГО</h4>
                                  <div className="space-y-2 text-base">
                                      <div className="flex justify-between"><span className="text-gray-400">Итого (л):</span><span className="text-blue-400 font-bold text-lg">{priemReportData.totals.l} л</span></div>
                                      <div className="flex justify-between"><span className="text-gray-400">Итого (кг):</span><span className="text-green-400 font-bold text-lg">{priemReportData.totals.kg} кг</span></div>
                                  </div>
                              </div>
                          </div>
                      </div>
                      <div className="flex flex-col gap-3 mt-6 pt-4 border-t border-gray-700 bg-gray-800 sticky bottom-0">
                          <div className="flex gap-3">
                              <button onClick={() => priemReportRef.current && shareElementAsImage(priemReportRef.current, `Priem_Report.png`)} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg shadow-lg active:scale-98 flex items-center justify-center gap-2">📤 Отправить</button>
                              <button onClick={() => priemReportRef.current && saveElementAsImage(priemReportRef.current, `Priem_Report.png`)} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-lg shadow-lg active:scale-98 flex items-center justify-center gap-2">💾 Скачать</button>
                          </div>
                          <button onClick={() => {
                              let text = "Отчет по приходам\n\n";
                              priemReportData.rows.forEach((row: any) => {
                                  text += `Дата:\t${row.date}\nСмена:\t${row.employee || 'Неизвестно'}\nРезервуар:\t${row.tank}\nПринято (л):\t${row.l}\nПринято (кг):\t${row.kg}\n\n`;
                              });
                              text += `ИТОГО\nИтого (л):\t${priemReportData.totals.l} л\nИтого (кг):\t${priemReportData.totals.kg} кг`;
                              copyToClipboard(text);
                          }} className="w-full bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 rounded-lg shadow-lg active:scale-98 flex items-center justify-center gap-2">
                              📋 Скопировать текст
                          </button>
                          <button onClick={() => setShowPriemReportModal(false)} className="w-full bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 rounded-lg shadow-lg active:scale-98">Закрыть</button>
                      </div>
                  </div>
              </div>
          )}

          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">Отчет по приходам</h2>
          <div className="mb-8">
              <Calendar selectedDates={selectedReportDates} onSelect={setSelectedReportDates} />
          </div>
          <div className="flex flex-col gap-4 max-w-xs mx-auto">
              <button onClick={handleGeneratePriemReport} className="bg-green-600 hover:bg-green-700 text-white font-bold py-4 px-8 rounded-xl shadow-lg transform hover:scale-102 transition-all">📄 Сформировать отчет</button>
              <button onClick={() => setCurrentScreen('reportsMenu')} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 px-8 rounded-lg shadow-md transition-all">Назад</button>
          </div>
      </div>
  );

  const renderReportTzaScreen = () => (
      <div className="w-full max-w-4xl text-center animate-fade-in p-4 relative">
          {showTzaReportModal && tzaReportData && (
              <div className="absolute inset-0 z-50 flex items-center justify-center p-4">
                  <div className="absolute inset-0 bg-black bg-opacity-80 backdrop-blur-sm rounded-xl"></div>
                  <div className="bg-gray-800 border border-cyan-500 p-6 rounded-2xl shadow-2xl relative z-10 w-full max-w-2xl animate-fade-in-up max-h-[90vh] overflow-y-auto flex flex-col">
                      <div ref={tzaReportRef} className="bg-gray-800 p-4 rounded-xl flex-1">
                          <h3 className="text-2xl font-bold text-white mb-6 text-center border-b border-gray-700 pb-4">Отчет по выдаче в ТЗА</h3>
                          <div className="space-y-4">
                              {tzaReportData.rows.map((row: any, idx: number) => (
                                  <div key={idx} className="border-b border-gray-700 pb-4 last:border-0">
                                      <div className="flex flex-col gap-2 text-sm">
                                          <div className="flex justify-between border-b border-gray-700/50 pb-1"><span className="text-gray-400">Дата:</span><span className="text-white font-mono">{row.date}</span></div>
                                          <div className="flex justify-between border-b border-gray-700/50 pb-1"><span className="text-gray-400">Смена:</span><span className="text-white font-mono">{row.employee || 'Неизвестно'}</span></div>
                                          <div className="flex justify-between border-b border-gray-700/50 pb-1"><span className="text-gray-400">ТЗА №:</span><span className="text-white font-mono">{row.tza}</span></div>
                                          <div className="flex justify-between border-b border-gray-700/50 pb-1"><span className="text-gray-400">Резервуар:</span><span className="text-white font-mono">{row.tank}</span></div>
                                          <div className="flex justify-between border-b border-gray-700/50 pb-1"><span className="text-gray-400">Выдано (л):</span><span className="text-blue-300 font-mono">{row.l}</span></div>
                                          <div className="flex justify-between"><span className="text-gray-400">Выдано (кг):</span><span className="text-green-300 font-mono">{row.kg}</span></div>
                                      </div>
                                  </div>
                              ))}
                              
                              <div className="mt-6 pt-4 border-t-2 border-gray-600 bg-gray-900/50 p-4 rounded-lg">
                                  <h4 className="text-xl font-bold text-white mb-3 text-center">ИТОГО</h4>
                                  <div className="space-y-2 text-base">
                                      <div className="flex justify-between"><span className="text-gray-400">Итого (л):</span><span className="text-blue-400 font-bold text-lg">{tzaReportData.totals.l} л</span></div>
                                      <div className="flex justify-between"><span className="text-gray-400">Итого (кг):</span><span className="text-green-400 font-bold text-lg">{tzaReportData.totals.kg} кг</span></div>
                                  </div>
                              </div>
                          </div>
                      </div>
                      <div className="flex flex-col gap-3 mt-6 pt-4 border-t border-gray-700 bg-gray-800 sticky bottom-0">
                          <div className="flex gap-3">
                              <button onClick={() => tzaReportRef.current && shareElementAsImage(tzaReportRef.current, `TZA_Report.png`)} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg shadow-lg active:scale-98 flex items-center justify-center gap-2">📤 Отправить</button>
                              <button onClick={() => tzaReportRef.current && saveElementAsImage(tzaReportRef.current, `TZA_Report.png`)} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-lg shadow-lg active:scale-98 flex items-center justify-center gap-2">💾 Скачать</button>
                          </div>
                          <button onClick={() => {
                              let text = "Отчет по выдаче в ТЗА\n\n";
                              tzaReportData.rows.forEach((row: any) => {
                                  text += `Дата:\t${row.date}\nСмена:\t${row.employee || 'Неизвестно'}\nТЗА №:\t${row.tza}\nРезервуар:\t${row.tank}\nВыдано (л):\t${row.l}\nВыдано (кг):\t${row.kg}\n\n`;
                              });
                              text += `ИТОГО\nИтого (л):\t${tzaReportData.totals.l} л\nИтого (кг):\t${tzaReportData.totals.kg} кг`;
                              copyToClipboard(text);
                          }} className="w-full bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 rounded-lg shadow-lg active:scale-98 flex items-center justify-center gap-2">
                              📋 Скопировать текст
                          </button>
                          <button onClick={() => setShowTzaReportModal(false)} className="w-full bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 rounded-lg shadow-lg active:scale-98">Закрыть</button>
                      </div>
                  </div>
              </div>
          )}

          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">Отчет по выдаче в ТЗА</h2>
          <div className="mb-8">
              <Calendar selectedDates={selectedReportDates} onSelect={setSelectedReportDates} />
          </div>
          <div className="flex flex-col gap-4 max-w-xs mx-auto">
              <button onClick={handleGenerateTzaReport} className="bg-green-600 hover:bg-green-700 text-white font-bold py-4 px-8 rounded-xl shadow-lg transform hover:scale-102 transition-all">📄 Сформировать отчет</button>
              <button onClick={() => setCurrentScreen('reportsMenu')} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 px-8 rounded-lg shadow-md transition-all">Назад</button>
          </div>
      </div>
  );

  const renderReportVsScreen = () => (
      <div className="w-full max-w-4xl text-center animate-fade-in p-4 relative">
          {showVsReportModal && vsReportData && (
              <div className="absolute inset-0 z-50 flex items-center justify-center p-4">
                  <div className="absolute inset-0 bg-black bg-opacity-80 backdrop-blur-sm rounded-xl"></div>
                  <div className="bg-gray-800 border border-cyan-500 p-6 rounded-2xl shadow-2xl relative z-10 w-full max-w-2xl animate-fade-in-up max-h-[90vh] overflow-y-auto flex flex-col">
                      <div ref={vsReportRef} className="bg-gray-800 p-4 rounded-xl flex-1">
                          <h3 className="text-2xl font-bold text-white mb-6 text-center border-b border-gray-700 pb-4">Отчет по выдаче в ВС</h3>
                          <div className="space-y-4">
                              {vsReportData.rows.map((row: any, idx: number) => (
                                  <div key={idx} className="border-b border-gray-700 pb-4 last:border-0">
                                      <div className="flex flex-col gap-2 text-sm">
                                          <div className="flex justify-between border-b border-gray-700/50 pb-1"><span className="text-gray-400">Дата:</span><span className="text-white font-mono">{row.date}</span></div>
                                          <div className="flex justify-between border-b border-gray-700/50 pb-1"><span className="text-gray-400">Смена:</span><span className="text-white font-mono">{row.employee || 'Неизвестно'}</span></div>
                                          <div className="flex justify-between border-b border-gray-700/50 pb-1"><span className="text-gray-400">ТЗА №:</span><span className="text-white font-mono">{row.tza}</span></div>
                                          <div className="flex justify-between border-b border-gray-700/50 pb-1"><span className="text-gray-400">Талон №:</span><span className="text-white font-mono">{row.coupon}</span></div>
                                          <div className="flex justify-between border-b border-gray-700/50 pb-1"><span className="text-gray-400">Выдано (л):</span><span className="text-blue-300 font-mono">{row.l}</span></div>
                                          <div className="flex justify-between"><span className="text-gray-400">Выдано (кг):</span><span className="text-green-300 font-mono">{row.kg}</span></div>
                                      </div>
                                  </div>
                              ))}
                              
                              <div className="mt-6 pt-4 border-t-2 border-gray-600 bg-gray-900/50 p-4 rounded-lg">
                                  <h4 className="text-xl font-bold text-white mb-3 text-center">ИТОГО</h4>
                                  <div className="space-y-2 text-base">
                                      <div className="flex justify-between"><span className="text-gray-400">Итого (л):</span><span className="text-blue-400 font-bold text-lg">{vsReportData.totals.l} л</span></div>
                                      <div className="flex justify-between"><span className="text-gray-400">Итого (кг):</span><span className="text-green-400 font-bold text-lg">{vsReportData.totals.kg} кг</span></div>
                                  </div>
                              </div>
                          </div>
                      </div>
                      <div className="flex flex-col gap-3 mt-6 pt-4 border-t border-gray-700 bg-gray-800 sticky bottom-0">
                          <div className="flex gap-3">
                              <button onClick={() => vsReportRef.current && shareElementAsImage(vsReportRef.current, `VS_Report.png`)} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg shadow-lg active:scale-98 flex items-center justify-center gap-2">📤 Отправить</button>
                              <button onClick={() => vsReportRef.current && saveElementAsImage(vsReportRef.current, `VS_Report.png`)} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-lg shadow-lg active:scale-98 flex items-center justify-center gap-2">💾 Скачать</button>
                          </div>
                          <button onClick={() => {
                              let text = "Отчет по выдаче в ВС\n\n";
                              vsReportData.rows.forEach((row: any) => {
                                  text += `Дата:\t${row.date}\nСмена:\t${row.employee || 'Неизвестно'}\nТЗА №:\t${row.tza}\nТалон №:\t${row.coupon}\nВыдано (л):\t${row.l}\nВыдано (кг):\t${row.kg}\n\n`;
                              });
                              text += `ИТОГО\nИтого (л):\t${vsReportData.totals.l} л\nИтого (кг):\t${vsReportData.totals.kg} кг`;
                              copyToClipboard(text);
                          }} className="w-full bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 rounded-lg shadow-lg active:scale-98 flex items-center justify-center gap-2">
                              📋 Скопировать текст
                          </button>
                          <button onClick={() => setShowVsReportModal(false)} className="w-full bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 rounded-lg shadow-lg active:scale-98">Закрыть</button>
                      </div>
                  </div>
              </div>
          )}

          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">Отчет по выдаче в ВС</h2>
          <div className="mb-8">
              <Calendar selectedDates={selectedReportDates} onSelect={setSelectedReportDates} />
          </div>
          <div className="flex flex-col gap-4 max-w-xs mx-auto">
              <button onClick={handleGenerateVsReport} className="bg-green-600 hover:bg-green-700 text-white font-bold py-4 px-8 rounded-xl shadow-lg transform hover:scale-102 transition-all">📄 Сформировать отчет</button>
              <button onClick={() => setCurrentScreen('reportsMenu')} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 px-8 rounded-lg shadow-md transition-all">Назад</button>
          </div>
      </div>
  );

  const handleGenerateSmenaReport = () => {
    if (!workbook) return;
    const data = getSmenaReportData(workbook, selectedReportDates);
    setSmenaReportData(data);
    setShowSmenaReportModal(true);
  };

  const renderReportSmenaScreen = () => (
      <div className="w-full max-w-4xl text-center animate-fade-in p-4 relative">
          {showSmenaReportModal && smenaReportData && (
              <div className="absolute inset-0 z-50 flex items-center justify-center p-4">
                  <div className="absolute inset-0 bg-black bg-opacity-80 backdrop-blur-sm rounded-xl"></div>
                  <div className="bg-gray-800 border border-cyan-500 p-6 rounded-2xl shadow-2xl relative z-10 w-full max-w-2xl animate-fade-in-up max-h-[90vh] overflow-y-auto flex flex-col">
                      <div ref={smenaReportRef} className="bg-gray-800 p-4 rounded-xl flex-1">
                          <h3 className="text-2xl font-bold text-white mb-6 text-center border-b border-gray-700 pb-4">Сменный отчет</h3>
                          <div className="space-y-4">
                              {smenaReportData.rows.map((row: any, idx: number) => (
                                  <div key={idx} className="border-b border-gray-700 pb-4 last:border-0">
                                      <div className="flex flex-col gap-2 text-sm">
                                          <div className="flex justify-between border-b border-gray-700/50 pb-1"><span className="text-gray-400">Дата:</span><span className="text-white font-mono">{row.date}</span></div>
                                          <div className="flex justify-between border-b border-gray-700/50 pb-1"><span className="text-gray-400">Ф.И.О.:</span><span className="text-white font-mono">{row.employee}</span></div>
                                          
                                          <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2">
                                            <div className="text-left text-gray-400 text-xs col-span-2">Принято за смену:</div>
                                            <div className="flex justify-between"><span className="text-gray-500">Литры:</span><span className="text-blue-300 font-mono">{row.receivedL}</span></div>
                                            <div className="flex justify-between"><span className="text-gray-500">Кг:</span><span className="text-green-300 font-mono">{row.receivedKg}</span></div>
                                            
                                            <div className="text-left text-gray-400 text-xs col-span-2 mt-1">Выдано в ТЗА:</div>
                                            <div className="flex justify-between"><span className="text-gray-500">Литры:</span><span className="text-blue-300 font-mono">{row.issuedTzaL}</span></div>
                                            <div className="flex justify-between"><span className="text-gray-500">Кг:</span><span className="text-green-300 font-mono">{row.issuedTzaKg}</span></div>

                                            <div className="text-left text-gray-400 text-xs col-span-2 mt-1">Выдано в ВС:</div>
                                            <div className="flex justify-between"><span className="text-gray-500">Литры:</span><span className="text-blue-300 font-mono">{row.issuedVsL}</span></div>
                                            <div className="flex justify-between"><span className="text-gray-500">Кг:</span><span className="text-green-300 font-mono">{row.issuedVsKg}</span></div>
                                          </div>
                                      </div>
                                  </div>
                              ))}
                              
                              <div className="mt-6 pt-4 border-t-2 border-gray-600 bg-gray-900/50 p-4 rounded-lg">
                                  <h4 className="text-xl font-bold text-white mb-3 text-center">ИТОГО ЗА ПЕРИОД</h4>
                                  <div className="grid grid-cols-2 gap-4 text-sm">
                                      <div>
                                          <div className="text-gray-400 text-xs mb-1">Принято:</div>
                                          <div className="text-blue-400 font-bold">{smenaReportData.totals.receivedL} л</div>
                                          <div className="text-green-400 font-bold">{smenaReportData.totals.receivedKg} кг</div>
                                      </div>
                                      <div>
                                          <div className="text-gray-400 text-xs mb-1">Выдано ТЗА:</div>
                                          <div className="text-blue-400 font-bold">{smenaReportData.totals.issuedTzaL} л</div>
                                          <div className="text-green-400 font-bold">{smenaReportData.totals.issuedTzaKg} кг</div>
                                      </div>
                                      <div className="col-span-2 border-t border-gray-700 pt-2 mt-1">
                                          <div className="text-gray-400 text-xs mb-1">Выдано ВС:</div>
                                          <div className="flex justify-between px-4"><span className="text-blue-400 font-bold">{smenaReportData.totals.issuedVsL} л</span> <span className="text-green-400 font-bold">{smenaReportData.totals.issuedVsKg} кг</span></div>
                                      </div>
                                  </div>
                              </div>
                          </div>
                      </div>
                      <div className="flex flex-col gap-3 mt-6 pt-4 border-t border-gray-700 bg-gray-800 sticky bottom-0">
                          <div className="flex gap-3">
                              <button onClick={() => smenaReportRef.current && shareElementAsImage(smenaReportRef.current, `Smena_Report.png`)} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg shadow-lg active:scale-98 flex items-center justify-center gap-2">📤 Отправить</button>
                              <button onClick={() => smenaReportRef.current && saveElementAsImage(smenaReportRef.current, `Smena_Report.png`)} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-lg shadow-lg active:scale-98 flex items-center justify-center gap-2">💾 Скачать</button>
                          </div>
                          <button onClick={() => {
                              let text = "Сменный отчет\n\n";
                              smenaReportData.rows.forEach((row: any) => {
                                  text += `Дата:\t${row.date}\nФ.И.О.:\t${row.employee}\nПринято за смену:\nЛитры:\t${row.receivedL}\nКг:\t${row.receivedKg}\nВыдано в ТЗА:\nЛитры:\t${row.issuedTzaL}\nКг:\t${row.issuedTzaKg}\nВыдано в ВС:\nЛитры:\t${row.issuedVsL}\nКг:\t${row.issuedVsKg}\n\n`;
                              });
                              text += `ИТОГО ЗА ПЕРИОД\nПринято:\n${smenaReportData.totals.receivedL} л\n${smenaReportData.totals.receivedKg} кг\nВыдано ТЗА:\n${smenaReportData.totals.issuedTzaL} л\n${smenaReportData.totals.issuedTzaKg} кг\nВыдано ВС:\n${smenaReportData.totals.issuedVsL} л\n${smenaReportData.totals.issuedVsKg} кг`;
                              copyToClipboard(text);
                          }} className="w-full bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 rounded-lg shadow-lg active:scale-98 flex items-center justify-center gap-2">
                              📋 Скопировать текст
                          </button>
                          <button onClick={() => setShowSmenaReportModal(false)} className="w-full bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 rounded-lg shadow-lg active:scale-98">Закрыть</button>
                      </div>
                  </div>
              </div>
          )}

          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">Сменный отчет</h2>
          <div className="mb-8">
              <Calendar selectedDates={selectedReportDates} onSelect={setSelectedReportDates} />
          </div>
          <div className="flex flex-col gap-4 max-w-xs mx-auto">
              <button onClick={handleGenerateSmenaReport} className="bg-green-600 hover:bg-green-700 text-white font-bold py-4 px-8 rounded-xl shadow-lg transform hover:scale-102 transition-all">📄 Сформировать отчет</button>
              <button onClick={() => setCurrentScreen('reportsMenu')} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 px-8 rounded-lg shadow-md transition-all">Назад</button>
          </div>
      </div>
  );

  const renderReportsMenu = () => (
      <div className="w-full max-w-4xl text-center animate-fade-in relative min-h-[500px] flex flex-col justify-center">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">Отчеты и Журналы</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto mb-8">
              <button onClick={() => handleDownloadSpecificReport('Ostatki')} className="bg-white dark:bg-cyan-700 hover:bg-gray-100 dark:hover:bg-cyan-600 text-gray-900 dark:text-white border-2 border-gray-300 dark:border-transparent font-bold py-3 px-6 rounded-xl shadow-sm dark:shadow-lg transform hover:scale-102 transition-all flex items-center justify-center gap-3">
                  📦 Остатки на складе
              </button>
              <button onClick={() => handleDownloadSpecificReport('Prihod')} className="bg-white dark:bg-cyan-700 hover:bg-gray-100 dark:hover:bg-cyan-600 text-gray-900 dark:text-white border-2 border-gray-300 dark:border-transparent font-bold py-3 px-6 rounded-xl shadow-sm dark:shadow-lg transform hover:scale-102 transition-all flex items-center justify-center gap-3">
                  📥 Отчет по приходам
              </button>
              <button onClick={() => handleDownloadSpecificReport('Vidacha_TZA')} className="bg-white dark:bg-cyan-700 hover:bg-gray-100 dark:hover:bg-cyan-600 text-gray-900 dark:text-white border-2 border-gray-300 dark:border-transparent font-bold py-3 px-6 rounded-xl shadow-sm dark:shadow-lg transform hover:scale-102 transition-all flex items-center justify-center gap-3">
                  🚛 Отчет по выдаче в ТЗА
              </button>
              <button onClick={() => handleDownloadSpecificReport('Vidacha_VS')} className="bg-white dark:bg-cyan-700 hover:bg-gray-100 dark:hover:bg-cyan-600 text-gray-900 dark:text-white border-2 border-gray-300 dark:border-transparent font-bold py-3 px-6 rounded-xl shadow-sm dark:shadow-lg transform hover:scale-102 transition-all flex items-center justify-center gap-3">
                  ✈️ Отчет по выдаче в ВС
              </button>
              <button onClick={() => setCurrentScreen('reportSmena')} className="bg-white dark:bg-emerald-700 hover:bg-gray-100 dark:hover:bg-emerald-600 text-gray-900 dark:text-white border-2 border-gray-300 dark:border-transparent font-bold py-3 px-6 rounded-xl shadow-sm dark:shadow-lg transform hover:scale-102 transition-all md:col-span-2 flex items-center justify-center gap-3">
                  📝 Сменный отчет
              </button>
          </div>
          <button onClick={() => setCurrentScreen('selection')} className="bg-white dark:bg-gray-600 hover:bg-gray-100 dark:hover:bg-gray-500 text-gray-900 dark:text-white border-2 border-gray-300 dark:border-transparent font-bold py-3 px-8 rounded-lg shadow-sm dark:shadow-md transition-all w-full max-w-xs mx-auto">
              Назад
          </button>
      </div>
  );

  return (
    <div className={`${theme} min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-white flex flex-col items-center justify-center p-4 selection:bg-violet-500 selection:text-white transition-colors duration-300 overflow-hidden`}>
      <div className="w-full h-full flex flex-col items-center justify-center max-h-screen overflow-y-auto">
      {currentScreen === 'selection' && renderSelectionScreen()}
      {currentScreen === 'reportsMenu' && renderReportsMenu()}
      {currentScreen === 'reportOstatki' && renderReportOstatkiScreen()}
      {currentScreen === 'reportPriem' && renderReportPriemScreen()}
      {currentScreen === 'reportTza' && renderReportTzaScreen()}
      {currentScreen === 'reportVs' && renderReportVsScreen()}
      {currentScreen === 'reportSmena' && renderReportSmenaScreen()}
      {currentScreen === 'adminPanel' && renderAdminPanel()}
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
    </div>
  );
};

export default App;
