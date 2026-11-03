import { PROFILE_CHANGED_EVENT } from './onboarding';

const ROLE_KEY = 'profile.role.v1';
const PHOTO_KEY = 'profile.photo.v1';
export const getProfileRole = () => localStorage.getItem(ROLE_KEY) ?? '';
export const getProfilePhoto = () => localStorage.getItem(PHOTO_KEY) ?? '';
export function setProfileRole(role: string) {
  const value = role.trim();
  if (value) localStorage.setItem(ROLE_KEY, value); else localStorage.removeItem(ROLE_KEY);
  window.dispatchEvent(new CustomEvent(PROFILE_CHANGED_EVENT));
}
export function setProfilePhoto(photo: string) {
  if (photo) localStorage.setItem(PHOTO_KEY, photo); else localStorage.removeItem(PHOTO_KEY);
  window.dispatchEvent(new CustomEvent(PROFILE_CHANGED_EVENT));
}
