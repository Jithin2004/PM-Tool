import React from 'react';

export function DailyHeader({ greeting }: { greeting: { name: string; message: string; subMessage: string } }) {
  return (
    <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-4 pt-2">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">{greeting.message}</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">{greeting.subMessage}</p>
      </div>
    </div>
  );
}
