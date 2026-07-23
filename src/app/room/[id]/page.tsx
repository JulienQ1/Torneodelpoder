'use client';

import { use } from 'react';
import { RoomView } from '@/features/rooms/client/components/RoomView';

export default function RoomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <RoomView roomId={id} />;
}
