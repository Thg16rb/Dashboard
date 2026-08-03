import { ReactNode } from 'react';
import Shell from './Shell';

export default function AppLayout({ children }: { children: ReactNode }) {
  return <Shell>{children}</Shell>;
}
