import React from 'react';

interface AvatarProps {
  name: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export function getInitials(name: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length > 1) {
    const first = parts[0][0] || '';
    const second = parts[1][0] || '';
    return (first + second).toUpperCase();
  }
  return (parts[0][0] || '?').toUpperCase();
}

export function getAvatarColors(name: string) {
  const colors = [
    { bg: 'bg-indigo-100', text: 'text-indigo-700', border: 'border-indigo-200' },
    { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200' },
    { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200' },
    { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-200' },
    { bg: 'bg-teal-100', text: 'text-teal-700', border: 'border-teal-200' },
    { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200' },
  ];
  if (!name) return colors[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % colors.length;
  return colors[index];
}

export default function Avatar({ name, size = 'md', className = '' }: AvatarProps) {
  const initials = getInitials(name);
  const colors = getAvatarColors(name);

  const sizeClasses = {
    xs: 'w-6 h-6 text-[10px] font-bold',
    sm: 'w-8 h-8 text-xs font-bold',
    md: 'w-10 h-10 text-sm font-semibold',
    lg: 'w-12 h-12 text-base font-semibold',
    xl: 'w-16 h-16 text-xl font-bold',
  };

  return (
    <div
      className={`rounded-full flex items-center justify-center border select-none shrink-0 ${colors.bg} ${colors.text} ${colors.border} ${sizeClasses[size]} ${className}`}
      title={name}
    >
      {initials}
    </div>
  );
}
