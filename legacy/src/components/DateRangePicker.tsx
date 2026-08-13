import React, { useState, useMemo } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Lock, 
  Flame, 
  Sparkles, 
  Info, 
  AlertTriangle, 
  RotateCcw,
  Calendar as CalendarIcon,
  CheckCircle2,
  TrendingDown
} from 'lucide-react';
import { Property, Booking, AvailabilityBlock } from '../types/nest.js';
import { formatCurrency } from '../lib/money.js';

interface DateRangePickerProps {
  property: Property;
  checkinDate?: string;
  checkoutDate?: string;
  existingBookings?: Booking[];
  availabilityBlocks?: AvailabilityBlock[];
  onChange: (checkin: string, checkout: string, totalNights: number, totalAmountMinor: number) => void;
}

export interface DayHeatInfo {
  dateStr: string;         // YYYY-MM-DD
  dayNum: number;
  isCurrentMonth: boolean;
  isPast: boolean;
  isToday: boolean;
  isBooked: boolean;
  heatLevel: 1 | 2 | 3;   // 1 = Low Demand/Value, 2 = Standard, 3 = Peak Surge
  heatLabel: string;
  priceMinor: number;
}

export const DateRangePicker: React.FC<DateRangePickerProps> = ({
  property,
  checkinDate: initialCheckin = '',
  checkoutDate: initialCheckout = '',
  existingBookings = [],
  availabilityBlocks = [],
  onChange,
}) => {
  // Get Today's YYYY-MM-DD in local time
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = formatDateISO(today);

  // Month navigation state (0-indexed month)
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());

  // Range selection state
  const [checkin, setCheckin] = useState<string>(initialCheckin);
  const [checkout, setCheckout] = useState<string>(initialCheckout);
  const [hoverDate, setHoverDate] = useState<string | null>(null);
  const [showHeatMap, setShowHeatMap] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Date Helper Functions
  function formatDateISO(d: Date): string {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  function parseDateISO(s: string): Date {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  // Check if date falls in active booking or block
  const isDateBooked = (dateStr: string): boolean => {
    const target = parseDateISO(dateStr).getTime();

    // Check bookings
    const booked = existingBookings.some(b => {
      if (['cancelled', 'rejected'].includes(b.status)) return false;
      if (b.property_id !== property.id) return false;
      const bStart = parseDateISO(b.checkin).getTime();
      const bEnd = parseDateISO(b.checkout).getTime();
      return target >= bStart && target < bEnd;
    });
    if (booked) return true;

    // Check manual blocks
    const blocked = availabilityBlocks.some(block => {
      if (block.property_id !== property.id) return false;
      const bStart = parseDateISO(block.start_date).getTime();
      const bEnd = parseDateISO(block.end_date).getTime();
      return target >= bStart && target < bEnd;
    });
    return blocked;
  };

  // Calculate Heat Level and Dynamic Rate for a given date
  const getDayHeat = (dateStr: string, isPast: boolean): DayHeatInfo => {
    const dateObj = parseDateISO(dateStr);
    const dayOfWeek = dateObj.getDay(); // 0 = Sun, 5 = Fri, 6 = Sat
    const dayNum = dateObj.getDate();
    const booked = isDateBooked(dateStr);

    let heatLevel: 1 | 2 | 3 = 2;
    let multiplier = 1.0;
    let heatLabel = 'Standard Rate';

    if (dayOfWeek === 5 || dayOfWeek === 6) {
      // Weekend Peak Surge
      heatLevel = 3;
      multiplier = 1.30;
      heatLabel = 'Peak Weekend Surge (+30%)';
    } else if (dayOfWeek === 2 || dayOfWeek === 3) {
      // Mid-week Value
      heatLevel = 1;
      multiplier = 0.85;
      heatLabel = 'Value Weekday (-15%)';
    }

    const priceMinor = Math.round(property.base_price_minor * multiplier);

    return {
      dateStr,
      dayNum,
      isCurrentMonth: true,
      isPast,
      isToday: dateStr === todayStr,
      isBooked: booked,
      heatLevel,
      heatLabel,
      priceMinor,
    };
  };

  // Build Grid Matrix for the visible month
  const calendarDays = useMemo(() => {
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
    const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0);
    const startingDayOfWeek = firstDayOfMonth.getDay(); // 0 (Sun) to 6 (Sat)
    const daysInMonth = lastDayOfMonth.getDate();

    const days: DayHeatInfo[] = [];

    // Padding for days before start of month
    const prevMonthLastDay = new Date(currentYear, currentMonth, 0).getDate();
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      const pDay = prevMonthLastDay - i;
      const pDate = new Date(currentYear, currentMonth - 1, pDay);
      const pDateStr = formatDateISO(pDate);
      const isPast = pDateStr < todayStr;
      const heat = getDayHeat(pDateStr, isPast);
      heat.isCurrentMonth = false;
      days.push(heat);
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      const cDate = new Date(currentYear, currentMonth, d);
      const cDateStr = formatDateISO(cDate);
      const isPast = cDateStr < todayStr;
      const heat = getDayHeat(cDateStr, isPast);
      days.push(heat);
    }

    // Trailing padding to complete 35 or 42 grid cells
    const remainingGrid = 42 - days.length;
    for (let t = 1; t <= remainingGrid; t++) {
      const tDate = new Date(currentYear, currentMonth + 1, t);
      const tDateStr = formatDateISO(tDate);
      const isPast = tDateStr < todayStr;
      const heat = getDayHeat(tDateStr, isPast);
      heat.isCurrentMonth = false;
      days.push(heat);
    }

    return days;
  }, [currentYear, currentMonth, property, existingBookings, availabilityBlocks, todayStr]);

  // Handle Day Click Selection
  const handleDateClick = (day: DayHeatInfo) => {
    setErrorMessage(null);

    // Rule 1: Cannot select past dates
    if (day.isPast) {
      setErrorMessage('Cannot select past dates.');
      return;
    }

    // Rule 2: Cannot pick booked start date
    if (day.isBooked) {
      setErrorMessage('This date is unavailable or reserved by another guest.');
      return;
    }

    if (!checkin || (checkin && checkout)) {
      // Step 1: Start fresh selection with checkin
      setCheckin(day.dateStr);
      setCheckout('');
    } else if (checkin && !checkout) {
      // Step 2: Selecting checkout
      if (day.dateStr <= checkin) {
        // Reset checkin to newer earlier/same date
        setCheckin(day.dateStr);
        setCheckout('');
      } else {
        // Check if any intermediate date in range [checkin, day.dateStr) is booked
        let isValidRange = true;
        const cur = parseDateISO(checkin);
        const end = parseDateISO(day.dateStr);

        while (cur < end) {
          const dStr = formatDateISO(cur);
          if (isDateBooked(dStr)) {
            isValidRange = false;
            break;
          }
          cur.setDate(cur.getDate() + 1);
        }

        if (!isValidRange) {
          setErrorMessage('Selected stay spans over reserved dates. Please pick continuous available days.');
          return;
        }

        setCheckout(day.dateStr);
        computeAndEmit(checkin, day.dateStr);
      }
    }
  };

  const computeAndEmit = (startISO: string, endISO: string) => {
    const start = parseDateISO(startISO);
    const end = parseDateISO(endISO);
    let nights = 0;
    let totalStayMinor = 0;

    const cur = new Date(start);
    while (cur < end) {
      const dStr = formatDateISO(cur);
      const heat = getDayHeat(dStr, false);
      totalStayMinor += heat.priceMinor;
      nights += 1;
      cur.setDate(cur.getDate() + 1);
    }

    onChange(startISO, endISO, nights, totalStayMinor);
  };

  const handleClear = () => {
    setCheckin('');
    setCheckout('');
    setErrorMessage(null);
    onChange('', '', 0, 0);
  };

  // Month navigation guards
  const isPrevDisabled = currentYear < today.getFullYear() || (currentYear === today.getFullYear() && currentMonth <= today.getMonth());

  const handlePrevMonth = () => {
    if (isPrevDisabled) return;
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(y => y - 1);
    } else {
      setCurrentMonth(m => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(y => y + 1);
    } else {
      setCurrentMonth(m => m + 1);
    }
  };

  const handleToday = () => {
    setCurrentYear(today.getFullYear());
    setCurrentMonth(today.getMonth());
  };

  // Calculate selected range summary stats
  const rangeStats = useMemo(() => {
    if (!checkin || !checkout) return null;
    const start = parseDateISO(checkin);
    const end = parseDateISO(checkout);
    if (end <= start) return null;

    let nights = 0;
    let nightlyTotalMinor = 0;
    const cur = new Date(start);
    while (cur < end) {
      const dStr = formatDateISO(cur);
      const heat = getDayHeat(dStr, false);
      nightlyTotalMinor += heat.priceMinor;
      nights += 1;
      cur.setDate(cur.getDate() + 1);
    }

    const cleaningFee = property.cleaning_fee_minor || 0;
    const estimatedTax = Math.round((nightlyTotalMinor + cleaningFee) * 0.10);
    const grandTotalMinor = nightlyTotalMinor + cleaningFee + estimatedTax;

    return {
      nights,
      nightlyTotalMinor,
      cleaningFee,
      estimatedTax,
      grandTotalMinor,
      avgPerNightMinor: Math.round(nightlyTotalMinor / nights),
    };
  }, [checkin, checkout, property]);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  return (
    <div className="bg-[#1C242F] border border-[#2A3441] rounded-2xl p-5 space-y-4 text-left">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#2A3441]">
        <div className="flex items-center gap-2">
          <CalendarIcon className="w-5 h-5 text-[#14B8A6]" />
          <div>
            <h3 className="font-bold text-sm text-[#F5F7FA]">Reservation Date Range & Availability Heat Map</h3>
            <p className="text-[11px] text-[#B4BCC8]">Past dates blocked. Colors indicate real-time demand & price tiers.</p>
          </div>
        </div>

        {/* Heat Map Legend Toggle */}
        <div className="flex items-center gap-2 bg-[#0B0F14] p-1 rounded-xl border border-[#2A3441]">
          <button
            type="button"
            onClick={() => setShowHeatMap(!showHeatMap)}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              showHeatMap
                ? 'bg-[#14B8A6] text-black shadow'
                : 'text-[#7A8494] hover:text-[#F5F7FA]'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            {showHeatMap ? 'Demand Heat ON' : 'Standard View'}
          </button>
        </div>
      </div>

      {/* Heat Map Legend Bar */}
      {showHeatMap && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-[#0B0F14] p-3 rounded-xl border border-[#2A3441] text-[11px]">
          <div className="flex items-center gap-1.5 text-[#5EEAD4]">
            <div className="w-3 h-3 rounded-full bg-[#14B8A6]/30 border border-[#14B8A6]" />
            <span>🟢 Value Night (-15%)</span>
          </div>
          <div className="flex items-center gap-1.5 text-[#F5B841]">
            <div className="w-3 h-3 rounded-full bg-[#F5B841]/30 border border-[#F5B841]" />
            <span>🟡 Standard Rate</span>
          </div>
          <div className="flex items-center gap-1.5 text-[#FFB067]">
            <div className="w-3 h-3 rounded-full bg-[#FF7A45]/30 border border-[#FF7A45]" />
            <span>🟠 Peak Surge (+30%)</span>
          </div>
          <div className="flex items-center gap-1.5 text-[#7A8494]">
            <div className="w-3 h-3 rounded-full bg-[#2A3441] border border-[#7A8494]" />
            <span>⛔ Booked / Blocked</span>
          </div>
        </div>
      )}

      {/* Month Navigation & Title */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={handlePrevMonth}
          disabled={isPrevDisabled}
          className="p-2 rounded-xl bg-[#0B0F14] border border-[#2A3441] text-[#F5F7FA] hover:border-[#14B8A6] transition-colors disabled:opacity-30 disabled:pointer-events-none"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3">
          <span className="font-extrabold text-sm text-[#F5F7FA]">
            {monthNames[currentMonth]} {currentYear}
          </span>
          <button
            type="button"
            onClick={handleToday}
            className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#14B8A6]/20 text-[#5EEAD4] border border-[#14B8A6]/30 hover:bg-[#14B8A6]/30"
          >
            Today
          </button>
        </div>

        <button
          type="button"
          onClick={handleNextMonth}
          className="p-2 rounded-xl bg-[#0B0F14] border border-[#2A3441] text-[#F5F7FA] hover:border-[#14B8A6] transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Day Headers */}
      <div className="grid grid-cols-7 gap-1 text-center font-bold text-[11px] text-[#7A8494] pb-1">
        <span>Sun</span>
        <span>Mon</span>
        <span>Tue</span>
        <span>Wed</span>
        <span>Thu</span>
        <span>Fri</span>
        <span>Sat</span>
      </div>

      {/* Calendar Grid Matrix */}
      <div className="grid grid-cols-7 gap-1.5">
        {calendarDays.map((day, idx) => {
          const isCheckin = day.dateStr === checkin;
          const isCheckout = day.dateStr === checkout;
          
          const inSelectedRange = Boolean(
            checkin && checkout && day.dateStr >= checkin && day.dateStr <= checkout
          );

          const inHoverRange = Boolean(
            checkin && !checkout && hoverDate && day.dateStr >= checkin && day.dateStr <= hoverDate && !day.isBooked && !day.isPast
          );

          // Heat level background styling
          let heatClasses = 'border-[#2A3441] bg-[#0B0F14] text-[#F5F7FA]';
          if (showHeatMap && !day.isPast && !day.isBooked && day.isCurrentMonth) {
            if (day.heatLevel === 1) {
              heatClasses = 'border-[#14B8A6]/40 bg-[#14B8A6]/10 text-[#5EEAD4] hover:border-[#14B8A6]';
            } else if (day.heatLevel === 2) {
              heatClasses = 'border-[#F5B841]/40 bg-[#F5B841]/10 text-[#F5B841] hover:border-[#F5B841]';
            } else if (day.heatLevel === 3) {
              heatClasses = 'border-[#FF7A45]/40 bg-[#FF7A45]/10 text-[#FFB067] hover:border-[#FF7A45]';
            }
          }

          // Specific states
          let dayStateClasses = heatClasses;

          if (!day.isCurrentMonth) {
            dayStateClasses = 'opacity-25 bg-[#0B0F14]/50 border-transparent text-[#7A8494] pointer-events-none';
          } else if (day.isPast) {
            dayStateClasses = 'opacity-40 bg-[#0B0F14] border-dashed border-[#2A3441] text-[#7A8494] cursor-not-allowed';
          } else if (day.isBooked) {
            dayStateClasses = 'bg-[#141B24] border-[#2A3441] text-[#7A8494] cursor-not-allowed line-through opacity-60';
          } else if (isCheckin || isCheckout) {
            dayStateClasses = 'bg-[#14B8A6] border-[#5EEAD4] text-black font-extrabold shadow-lg shadow-[#14B8A6]/30 scale-105 z-10';
          } else if (inSelectedRange) {
            dayStateClasses = 'bg-[#14B8A6]/25 border-[#14B8A6]/60 text-[#5EEAD4] font-bold';
          } else if (inHoverRange) {
            dayStateClasses = 'bg-[#14B8A6]/15 border-[#14B8A6]/40 text-[#5EEAD4]';
          }

          return (
            <button
              key={`${day.dateStr}-${idx}`}
              type="button"
              disabled={day.isPast || day.isBooked || !day.isCurrentMonth}
              onClick={() => handleDateClick(day)}
              onMouseEnter={() => !day.isPast && !day.isBooked && setHoverDate(day.dateStr)}
              onMouseLeave={() => setHoverDate(null)}
              className={`relative h-14 rounded-xl border p-1 flex flex-col justify-between items-center transition-all duration-200 focus:outline-none ${dayStateClasses}`}
              title={
                day.isPast
                  ? 'Past date (blocked)'
                  : day.isBooked
                  ? 'Reserved / Blocked'
                  : `${day.dateStr}: ${formatCurrency(day.priceMinor)}/night (${day.heatLabel})`
              }
            >
              {/* Day Number Header */}
              <div className="w-full flex items-center justify-between text-[11px]">
                <span className="font-bold">{day.dayNum}</span>
                {day.isPast && <Lock className="w-2.5 h-2.5 text-[#7A8494]" />}
                {day.isToday && !isCheckin && !isCheckout && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[#14B8A6] animate-pulse" />
                )}
              </div>

              {/* Price / Status Tag */}
              {day.isCurrentMonth && (
                <div className="text-[9px] font-medium leading-none">
                  {day.isPast ? (
                    <span className="text-[8px] text-[#7A8494]">Past</span>
                  ) : day.isBooked ? (
                    <span className="text-[8px] text-red-400 font-bold">Booked</span>
                  ) : (
                    <span>{formatCurrency(day.priceMinor).split('.')[0]}</span>
                  )}
                </div>
              )}

              {/* Checkin / Checkout badges */}
              {isCheckin && (
                <span className="absolute -bottom-1.5 bg-black text-[#5EEAD4] border border-[#14B8A6] text-[8px] px-1 rounded-full font-bold">
                  IN
                </span>
              )}
              {isCheckout && (
                <span className="absolute -bottom-1.5 bg-black text-[#FFB067] border border-[#FF7A45] text-[8px] px-1 rounded-full font-bold">
                  OUT
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Error / Validation Warning */}
      {errorMessage && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-300 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Selected Dates & Dynamic Quote Summary */}
      <div className="bg-[#0B0F14] p-4 rounded-xl border border-[#2A3441] space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div>
            <span className="text-[#7A8494] block text-[10px] uppercase font-bold">Selected Check-In</span>
            <span className="font-bold text-[#F5F7FA]">
              {checkin ? checkin : 'Select Check-In Date'}
            </span>
          </div>
          <div className="sm:text-right">
            <span className="text-[#7A8494] block text-[10px] uppercase font-bold">Selected Check-Out</span>
            <span className="font-bold text-[#F5F7FA]">
              {checkout ? checkout : 'Select Check-Out Date'}
            </span>
          </div>
          {(checkin || checkout) && (
            <button
              type="button"
              onClick={handleClear}
              className="text-xs text-[#7A8494] hover:text-[#FFB067] flex items-center gap-1 transition-colors self-start sm:self-center"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Clear
            </button>
          )}
        </div>

        {/* Dynamic Pricing Line Breakdown */}
        {rangeStats ? (
          <div className="pt-3 border-t border-[#2A3441] space-y-1.5 text-xs text-[#B4BCC8]">
            <div className="flex items-center justify-between">
              <span>Heat Map Stay Subtotal ({rangeStats.nights} {rangeStats.nights === 1 ? 'night' : 'nights'} @ ~{formatCurrency(rangeStats.avgPerNightMinor)}/night):</span>
              <span className="font-semibold text-[#F5F7FA]">{formatCurrency(rangeStats.nightlyTotalMinor)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Cleaning & Sanitization Fee:</span>
              <span className="font-semibold text-[#F5F7FA]">{formatCurrency(rangeStats.cleaningFee)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Estimated Occupancy Taxes (10%):</span>
              <span className="font-semibold text-[#F5F7FA]">{formatCurrency(rangeStats.estimatedTax)}</span>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-[#2A3441] text-sm font-extrabold text-[#5EEAD4]">
              <span>Estimated Grand Total:</span>
              <span>{formatCurrency(rangeStats.grandTotalMinor)}</span>
            </div>
          </div>
        ) : (
          <div className="text-[11px] text-[#7A8494] text-center pt-2">
            {!checkin ? '👈 Click an available date in green/yellow/orange above to set Check-In' : '👉 Now click a check-out date'}
          </div>
        )}
      </div>
    </div>
  );
};
