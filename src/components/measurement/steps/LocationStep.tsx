import React from 'react';
import { getCurrentDateString, getCurrentTimeString } from '../../../utils/calculations';

interface LocationStepProps {
  ranchName: string;
  setRanchName: (v: string) => void;
  location: string;
  setLocation: (v: string) => void;
  date: string;
  setDate: (v: string) => void;
  time: string;
  setTime: (v: string) => void;
  today: string;
  knownRanches: string[];
  recentLocations: string[];
  onEnterNext: () => void;
}

export const LocationStep: React.FC<LocationStepProps> = ({
  ranchName,
  setRanchName,
  location,
  setLocation,
  date,
  setDate,
  time,
  setTime,
  today,
  knownRanches,
  recentLocations,
  onEnterNext,
}) => {
  return (
    <div className="space-y-4">
      {/* 1. 측정 일시 */}
      <div className="rounded-2xl bg-[#F2F2F7]/70 dark:bg-[#2C2C2E]/60 p-3.5 sm:p-4 border border-black/5 dark:border-white/10">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-[#6E6E73] dark:text-[#8E8E93] flex items-center gap-1">
            <span className="material-symbols-outlined text-[16px]">schedule</span>
            측정 일시
          </span>
          <button
            type="button"
            onClick={() => {
              setDate(getCurrentDateString());
              setTime(getCurrentTimeString());
            }}
            className="text-xs font-semibold text-[#315C36] dark:text-[#34C759] hover:underline"
          >
            지금으로
          </button>
        </div>
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <input
            type="date"
            value={date}
            max={today}
            aria-label="측정 날짜"
            onChange={e => setDate(e.target.value)}
            className="min-w-0 h-11 rounded-xl bg-white dark:bg-[#2C2C2E] px-3 text-sm sm:text-base font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] tabular-nums border border-black/10 dark:border-white/10 focus:outline-none focus:border-[#315C36] dark:focus:border-[#34C759]"
          />
          <input
            type="time"
            value={time}
            aria-label="측정 시간"
            onChange={e => setTime(e.target.value)}
            className="h-11 rounded-xl bg-white dark:bg-[#2C2C2E] px-3 text-sm sm:text-base font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] tabular-nums border border-black/10 dark:border-white/10 focus:outline-none focus:border-[#315C36] dark:focus:border-[#34C759]"
          />
        </div>
      </div>

      {/* 2. 목장 */}
      <div>
        <label className="block text-xs font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] mb-1.5">
          목장명
        </label>
        <input
          type="text"
          value={ranchName}
          maxLength={30}
          onChange={e => setRanchName(e.target.value)}
          className="w-full h-11 bg-white dark:bg-[#2C2C2E] rounded-xl px-3.5 text-sm sm:text-base text-[#1D1D1F] dark:text-[#F5F5F7] border border-black/10 dark:border-white/10 focus:outline-none focus:border-[#315C36] dark:focus:border-[#34C759]"
          placeholder="목장 이름"
        />
        {knownRanches.length > 1 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {knownRanches.map(name => (
              <button
                key={name}
                type="button"
                onClick={() => setRanchName(name)}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-all active:scale-95 ${
                  name === ranchName
                    ? 'bg-[#315C36] text-white'
                    : 'bg-[#F2F2F7] dark:bg-[#2C2C2E] text-[#6E6E73] dark:text-[#8E8E93] hover:text-[#1D1D1F] dark:hover:text-[#FFFFFF]'
                }`}
              >
                {name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 3. 하역 장소 */}
      <div>
        <label className="block text-xs font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] mb-1.5">
          하역 장소 (세부 위치)
        </label>
        <div className="relative flex items-center">
          <span className="material-symbols-outlined absolute left-3.5 text-[18px] text-[#6E6E73] dark:text-[#8E8E93] pointer-events-none">
            location_on
          </span>
          <input
            type="text"
            value={location}
            maxLength={40}
            autoFocus={!location}
            placeholder="실제로 커피박을 내린 곳 (예: 퇴비사 A동 앞)"
            onChange={e => setLocation(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                onEnterNext();
              }
            }}
            className="w-full h-11 bg-white dark:bg-[#2C2C2E] rounded-xl pl-10 pr-3.5 text-sm sm:text-base text-[#1D1D1F] dark:text-[#F5F5F7] border border-black/10 dark:border-white/10 focus:outline-none focus:border-[#315C36] dark:focus:border-[#34C759]"
          />
        </div>

        {recentLocations.length > 0 && (
          <div className="mt-2">
            <span className="text-[11px] text-[#6E6E73] dark:text-[#8E8E93] block mb-1">최근 하역 장소</span>
            <div className="flex flex-wrap gap-1.5">
              {recentLocations.map(loc => (
                <button
                  key={loc}
                  type="button"
                  onClick={() => setLocation(loc)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition-all active:scale-95 ${
                    loc === location
                      ? 'bg-[#315C36] text-white'
                      : 'bg-[#F2F2F7] dark:bg-[#2C2C2E] text-[#6E6E73] dark:text-[#8E8E93] hover:text-[#1D1D1F] dark:hover:text-[#FFFFFF]'
                  }`}
                >
                  {loc}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
