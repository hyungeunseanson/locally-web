import { Profile } from './index';

export type AdminTaskType = 'DAILY_LOG' | 'TODO' | 'MEMO';
export type AdminTaskStatus = 'Done' | 'Progress';

export interface AdminTask {
  id: string;
  created_at: string;
  type: AdminTaskType;
  content: string;
  is_completed: boolean;
  author_id: string;
  author_name: string;
  metadata: {
    note?: string;
    status_text?: AdminTaskStatus;
  };
}

export interface AdminComment {
  id: string;
  task_id: string;
  content: string;
  author_name: string;
  created_at: string;
}

export interface AdminBooking extends Omit<any, 'experiences' | 'profiles'> {
  id: string;
  created_at: string;
  experience_id: number;
  user_id: string;
  amount: number;
  status: string;
  date: string;
  time: string;
  contact_name?: string;
  contact_phone?: string;
  guests?: number;
  experiences: {
    title: string;
    host_id: string;
    profiles: {
      name: string;
    };
  };
  profiles: {
    email: string;
    name: string;
  };
}

export interface HostApplication {
  id: string;
  created_at: string;
  user_id: string;
  name: string;
  email: string;
  status: 'pending' | 'approved' | 'rejected' | 'revision';
  content: any;
}

export interface AdminDashboardState {
  apps: HostApplication[];
  exps: any[];
  users: Profile[];
  bookings: AdminBooking[];
  reviews: any[];
  onlineUsers: any[];
  isLoading: boolean;
}
