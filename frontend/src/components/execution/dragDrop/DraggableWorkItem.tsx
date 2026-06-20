import React from 'react';

interface DraggableWorkItemProps {
  id: string;
  type: 'task' | 'story' | 'epic';
  data: any;
  children: React.ReactNode;
  className?: string;
  isDisabled?: boolean;
}

export const DraggableWorkItem: React.FC<DraggableWorkItemProps> = ({
  id,
  type,
  data,
  children,
  className = '',
  isDisabled = false
}) => {
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    if (isDisabled) {
      e.preventDefault();
      return;
    }
    
    // Store type and ID
    e.dataTransfer.setData('application/json', JSON.stringify({ id, type, data }));
    e.dataTransfer.effectAllowed = 'move';
    
    // Optional styling while dragging
    setTimeout(() => {
      if (e.target instanceof HTMLElement) {
        e.target.classList.add('opacity-50', 'ring-2', 'ring-indigo-500');
      }
    }, 0);
  };

  const handleDragEnd = (e: React.DragEvent<HTMLDivElement>) => {
    if (e.target instanceof HTMLElement) {
      e.target.classList.remove('opacity-50', 'ring-2', 'ring-indigo-500');
    }
  };

  return (
    <div
      draggable={!isDisabled}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      className={`${isDisabled ? 'cursor-not-allowed opacity-75' : 'cursor-grab active:cursor-grabbing'} ${className}`}
    >
      {children}
    </div>
  );
};
