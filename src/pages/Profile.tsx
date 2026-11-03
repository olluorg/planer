import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, ArrowRight, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageContainer } from '@/components/ui/page-container';
import { useStore } from '@/lib/store';
import { getUserName, setUserName } from '@/lib/onboarding';
import { getProfilePhoto, getProfileRole, setProfilePhoto, setProfileRole } from '@/lib/profileIdentity';
import { compressImage } from '@/lib/imageCompress';
import { toast } from '@/lib/toast';

export const ProfilePage: React.FC = () => {
  const nav = useNavigate();
  const tasks = useStore(s => s.tasks);
  const goals = useStore(s => s.goals);
  const habits = useStore(s => s.habits);
  const [name, setName] = useState(getUserName);
  const [role, setRole] = useState(getProfileRole);
  const [photo, setPhoto] = useState(getProfilePhoto);
  const [error, setError] = useState('');
  const activeGoals = goals.filter(g => g.status === 'active' && !g.parent_id);
  const doneTasks = tasks.filter(t => t.status === 'done').length;
  const save = () => {
    if (!name.trim()) {setError('Укажите имя.'); return;}
    try {setUserName(name.slice(0, 60)); setProfileRole(role.slice(0, 100)); setError(''); toast.success('Профиль сохранён');}
    catch {setError('Не удалось сохранить профиль на устройстве.');}
  };
  const uploadPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {setError('Выберите файл изображения.'); return;}
    try {const data = await compressImage(file, 512, .8); setProfilePhoto(data); setPhoto(data); setError('');}
    catch {setError('Не удалось открыть или сохранить фотографию.');}
  };
  const removePhoto = () => {
    try {setProfilePhoto(''); setPhoto(''); setError('');}
    catch {setError('Не удалось удалить фотографию.');}
  };
  return <PageContainer className="py-6 sm:py-10 profile-page">
    <div className="profile-heading"><div><p>Личное пространство</p><h1>Профиль</h1></div><Button variant="soft" onClick={() => nav('/settings')}>Настройки <ArrowRight className="h-4 w-4" /></Button></div>
    <div className="profile-grid">
      <section className="profile-identity" aria-labelledby="identity-title">
        <div className="profile-avatar">{photo ? <img src={photo} alt="Фото профиля" /> : <span aria-hidden="true">{(name.trim() || 'д').slice(0,1).toUpperCase()}</span>}</div>
        <h2 id="identity-title">Личные данные</h2>
        <p>Имя используется в интерфейсе планера.</p>
        <div className="profile-photo-actions"><label className="profile-upload"><Camera size={16} /> {photo ? 'Заменить фото' : 'Добавить фото'}<input type="file" accept="image/*" className="sr-only" onChange={uploadPhoto} /></label>{photo && <button type="button" onClick={removePhoto} aria-label="Удалить фото профиля"><Trash2 size={16}/></button>}</div>
        <label className="profile-field">Имя<Input value={name} maxLength={60} onChange={e => setName(e.target.value)} /></label>
        <label className="profile-field">Занятие или роль <span>(необязательно)</span><Input value={role} maxLength={100} onChange={e => setRole(e.target.value)} placeholder="Например, дизайнер" /></label>
        {error && <p role="alert" className="text-danger text-sm mt-2">{error}</p>}
        <Button className="mt-4" onClick={save}>Сохранить профиль</Button>
        <p className="profile-storage">Имя, роль и фото хранятся в этом браузере. Их можно перенести через копию личных данных в настройках; в копию базы и синхронизацию они не входят.</p>
      </section>
      <div className="profile-main">
        <section className="profile-summary" aria-labelledby="summary-title">
          <div className="profile-section-head"><div><h2 id="summary-title">Обзор</h2><p>Ваши данные в планере на данный момент</p></div></div>
          <div className="profile-stats">
            <div><strong>{doneTasks}</strong><span>Выполнено задач</span></div>
            <div><strong>{activeGoals.length}</strong><span>Активных целей</span></div>
            <div><strong>{habits.length}</strong><span>Привычек</span></div>
          </div>
        </section>
        <section className="profile-goals" aria-labelledby="profile-goals-title">
          <div className="profile-section-head"><div><h2 id="profile-goals-title">Активные цели</h2><p>Текущие значения из ваших целей</p></div><button type="button" onClick={() => nav('/goals')}>Все цели <ArrowRight size={15}/></button></div>
          {activeGoals.length === 0 ? <div className="profile-empty"><p>Целей пока нет.</p><button type="button" onClick={() => nav('/goals')}>Создать цель</button></div> : <ul>{activeGoals.slice(0, 4).map(g => {
            const range = g.target_value - g.start_value;
            const percent = range ? Math.round(Math.max(0, Math.min(1, (g.current_value - g.start_value) / range)) * 100) : null;
            return <li key={g.id}><div className="profile-goal-top"><span>{g.title}</span><strong>{percent === null ? '—' : `${percent}%`}</strong></div><div className="profile-progress" role="progressbar" aria-label={`Прогресс: ${g.title}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent ?? undefined}><span style={{width:`${percent ?? 0}%`}} /></div><p>{g.current_value} / {g.target_value}{g.unit ? ` ${g.unit}` : ''}</p></li>;
          })}</ul>}
        </section>
      </div>
    </div>
  </PageContainer>;
};
