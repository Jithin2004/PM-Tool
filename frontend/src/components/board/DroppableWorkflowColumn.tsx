import React, { useRef, useState } from 'react';

interface DroppableWorkflowColumnProps {
  stateId: string;
  onDrop: (taskId: string, targetStateId: string) => void;
  children: React.ReactNode;
}

export const DroppableWorkflowColumn: React.FC<DroppableWorkflowColumnProps> = ({ stateId, onDrop, children }) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); // Necessary to allow dropping
    e.dataTransfer.dropEffect = 'move';
    if (!isDragOver) setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    // In DraggableWorkItem, we should set data transfer:
    // e.dataTransfer.setData('application/json', JSON.stringify({ type: 'task', id: task.id }));
    const dataString = e.dataTransfer.getData('application/json');
    if (dataString) {
      try {
        const data = JSON.parse(dataString);
        if (data.type === 'task' && data.id) {
          onDrop(data.id, stateId);
        }
      } catch (err) {
        console.error('Failed to parse dropped task data', err);
      }
    }
  };

  return (
    <div
      ref={dropRef}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`flex flex-col min-w-[300px] h-full transition-colors duration-200 rounded-lg p-1 ${
        isDragOver ? 'bg-indigo-500/10 border-2 border-dashed border-indigo-400' : 'border-2 border-transparent'
      }`}
    >
      {children}
    </div>
  );
};
