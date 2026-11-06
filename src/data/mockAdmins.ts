import { AdminUser } from '../types';

export const INITIAL_MOCK_ADMINS: AdminUser[] = [
  {
    id: 'ADM-001',
    name: 'Aditya Sharma',
    email: 'admin@vfwallet.com',
    phone: '9876543210',
    role: 'admin',
    adminRoleTitle: 'Super Administrator',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
  },
  {
    id: 'ADM-002',
    name: 'Pooja Verma',
    email: 'ops@vfwallet.com',
    phone: '9876543211',
    role: 'admin',
    adminRoleTitle: 'Operations Head',
    avatarUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150',
  },
  {
    id: 'ADM-003',
    name: 'Rajesh Kumar',
    email: 'finance@vfwallet.com',
    phone: '9876543212',
    role: 'admin',
    adminRoleTitle: 'Finance Manager',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
  },
  {
    id: 'ADM-004',
    name: 'Sneha Patel',
    email: 'compliance@vfwallet.com',
    phone: '9876543213',
    role: 'admin',
    adminRoleTitle: 'Compliance Officer',
    avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150',
  },
];

