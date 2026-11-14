import SharedProfilePage from '@deltatv/ui/ProfilePage';
import { api, logout, updateAuthUser } from './api.js';
export default function ProfilePage() { return <SharedProfilePage variant="admin" api={api} logout={logout} updateAuthUser={updateAuthUser}/>; }
