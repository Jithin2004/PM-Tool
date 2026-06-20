import React, { useState } from 'react';

interface DroppableSprintZoneProps {
  id: string;
  accepts: ('task' | 'story' | 'epic')[];
  onDrop: (item: { id: string; type: string; data: any }) => void;
  children: React.ReactNode;
  className?: string;
  activeClassName?: string;
}

export const DroppableSprintZone: React.FC<DroppableSprintZoneProps> = ({
  id,
  accepts,
  onDrop,
  children,
  className = '',
  activeClassName = 'bg-indigo-500/10 border-indigo-500/50 border-dashed'
}) => {
  const [isOver, setIsOver] = useState(false);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (!isOver) setIsOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsOver(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsOver(false);
    
    try {
      const rawData = e.dataTransfer.getData('application/json');
      if (!rawData) return;
      
      const payload = JSON.parse(rawData);
      if (accepts.includes(payload.type as any)) {
        onDrop(payload);
      }
    } catch (err) {
      console.error('Failed to parse dropped data', err);
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`transition-colors duration-200 ${className} ${isOver ? activeClassName : ''}`}
    >
      {children}
    </div>
  );
};
