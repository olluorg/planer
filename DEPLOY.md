# Как выпустить релиз 1.0

Пошаговый чек-лист: что сделать руками, в каком порядке и как проверить.
Всё, что делается кодом, уже сделано — здесь только настройки, аккаунты и
решения, которые может принять только владелец.

**Итоговая схема:**

```
planer (приватный)            thedad-releases (публичный)
  код, CI  ──── сборка ────►    gh-pages  → сайт thedad.ru
                                releases  → установщик Windows, расширение
                                docs/     → документация для пользователей
                                issues    → обратная связь

sync-сервер (дома/VPS) — не нужен для 1.0, см. deploy/server/README.md
```

Порядок важен: пункты 3–6 зависят от предыдущих.

---

## 1. Решения, которые никто кроме вас не примет

- [ ] **Лицензия.** Сейчас в репозитории AGPL-3.0 — это открытая лицензия, она
      обещает пользователям доступ к исходникам. С закрытым кодом это обещание
      ложно. Варианты: заменить `LICENSE` на проприетарное пользовательское
      соглашение (EULA), убрать AGPL из `package.json` и бейдж из `README.md` —
      или оставить AGPL и код открытым. Смешивать нельзя.
- [ ] **Ссылки на покупку.** В `public/marketplace/catalog.json` у обеих программ
      `buyUrl` ведёт на `boosty.to/CHANGE_ME/...`. Заменить на настоящие.
- [ ] **Сертификат подписи для Windows** — по желанию, но без него каждый
      пользователь увидит предупреждение SmartScreen «неизвестный издатель».
      Покупается у Sectigo/Certum и т. п.; подключается секретами `CSC_LINK` и
      `CSC_KEY_PASSWORD` без изменения кода.

## 2. Публичный репозиторий релизов

Содержимое уже подготовлено в соседней папке `../thedad-releases` (README,
документация, политика конфиденциальности, CHANGELOG, шаблоны issue).

```bash
cd ../thedad-releases
git init -b main && git add -A && git commit -m "THEDAD: релизы и документация"
gh repo create uyellowline/thedad-releases --public --source . --push
```

- [ ] Репозиторий создан, README открывается на GitHub.
- [ ] Settings → General → Features: **Issues включены**, Wiki и Projects можно
      выключить.

## 3. Токен для публикации

CI в приватном `planer` пушит в публичный `thedad-releases` — встроенный токен
Actions туда не дотягивается, нужен свой.

GitHub → аватар → Settings → Developer settings → **Fine-grained tokens** →
Generate new token:

- Repository access: **Only select repositories** → `thedad-releases`
- Permissions → Repository → **Contents: Read and write**
- Срок — год, в календарь напоминание перевыпустить

Скопировать токен → репозиторий `planer` → Settings → Secrets and variables →
Actions → **Secrets** → New repository secret: имя `RELEASES_TOKEN`.

- [ ] Секрет `RELEASES_TOKEN` создан.

## 4. Копия в Google Диск (по желанию, можно после релиза)

Без этого шага приложение работает, раздел просто скажет, что не настроен.

1. console.cloud.google.com → создать проект `thedad`.
2. APIs & Services → Library → **Google Drive API** → Enable.
3. OAuth consent screen: External; название THEDAD; домен `thedad.ru`; ссылка на
   политику — `https://github.com/uyellowline/thedad-releases/blob/main/PRIVACY.md`;
   scope — `.../auth/drive.appdata`.
4. Credentials → Create credentials → **OAuth client ID** → Web application →
   Authorized JavaScript origins: `https://thedad.ru`.
   Для расширения — в тот же клиент, в **Authorized redirect URIs**, добавить
   `https://<ID расширения>.chromiumapp.org/` (ID — после публикации в Chrome
   Web Store, в адресе его страницы). Без этого вход в расширении ответит
   «redirect_uri_mismatch».
5. Скопировать Client ID → `planer` → Settings → Secrets and variables → Actions →
   **Variables** → `VITE_GOOGLE_CLIENT_ID`.

Пока экран согласия в режиме «Testing», войти смогут только до 100 адресов,
вписанных вручную. Для всех — кнопка **Publish app** и проверка Google
(подтверждение домена и политики; для `drive.appdata` дорогой аудит
безопасности не требуется, но проверка занимает от нескольких дней).

Возможная сложность: создание проектов в Google Cloud из России иногда
ограничивают. Если консоль не даёт создать проект — функцию можно отложить,
остальное приложение от неё не зависит.

- [ ] (по желанию) `VITE_GOOGLE_CLIENT_ID` задан.

## 5. Сделать код закрытым и переключить сайт

Порядок важен: домен может быть привязан только к одному Pages-сайту сразу.

1. `planer` → Settings → Pages → **Unpublish** / отключить Pages (если был включён).
2. `planer` → Settings → General → Danger Zone → **Change visibility → Private**.
3. Слить ветку и запустить сборку:

   ```bash
   git checkout main && git merge redesign && git push
   ```

   Actions → workflow **Deploy** должен пройти зелёным: `publish-site`,
   `release-extension`, `release-desktop`.
4. `thedad-releases` → Settings → Pages → Source: **Deploy from a branch** →
   `gh-pages` / `root` → Save. Custom domain: `thedad.ru` → Save.
   Когда появится галочка — **Enforce HTTPS**.
5. DNS у регистратора `thedad.ru`: если сайт уже был на Pages — записи правильные
   и менять ничего не надо. Если нет — четыре A-записи для `@`:
   `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`.

- [ ] `planer` приватный.
- [ ] Deploy прошёл зелёным.
- [ ] `https://thedad.ru` открывается, замок в адресной строке.

## 6. Проверка после выкатки

С телефона и с компьютера, **в режиме инкогнито** (чтобы не мешал старый кэш):

- [ ] `https://thedad.ru` открывается, мастер первого запуска появляется.
- [ ] `https://thedad.ru/goals` — прямая ссылка открывает приложение, а не 404.
- [ ] Создать цель, отметить прогресс, закрыть вкладку, открыть снова — всё на месте.
- [ ] Выключить интернет, обновить страницу — приложение открывается (офлайн).
- [ ] Значок установки в адресной строке → приложение ставится отдельным окном.
- [ ] Релиз в `thedad-releases/releases`: `THEDAD Setup 1.0.0.exe`,
      `-portable.exe`, `latest.yml`, `planer-extension.zip`, контрольная сумма.
- [ ] Установщик ставится, приложение запускается, крестик сворачивает в трей.
- [ ] Расширение загружается в `chrome://extensions` и открывается в новой вкладке.

## 7. Магазин расширений (по желанию, можно после)

- [ ] Аккаунт разработчика Chrome Web Store (разовый взнос $5).
- [ ] Загрузить `planer-extension.zip`, описание, скриншоты.
- [ ] Privacy practices: ссылка на `PRIVACY.md`, обоснование разрешений:
      `alarms`/`notifications` — напоминания, `storage` — настройки,
      `tabs` — открыть уже открытую вкладку приложения вместо новой,
      `identity` — вход в Google для копии в Диск.
- [ ] После публикации: ID расширения — в `ALLOWED_ORIGINS` сервера (когда он будет).

## 8. Прибрать

- [ ] Архивировать старый репозиторий `planer-desktop` (Settings → Archive):
      десктоп теперь собирается из `planer`, а форк отстал и путает.
- [ ] Локально удалить `planer-desktop` — 2 ГБ на диске.

---

## Когда дойдёте до Plus

1. Поднять sync-сервер по [`deploy/server/README.md`](deploy/server/README.md).
2. Variables: `VITE_SYNC_SERVER_URL=https://sync.thedad.ru`, `VITE_FEATURE_PLUS=1`.
3. Push в `main`.

## Если что-то пошло не так

| Симптом | Что проверить |
|---|---|
| Deploy падает на `publish-site` с 403 | Токен `RELEASES_TOKEN`: выдан ли на `thedad-releases`, есть ли Contents: Read and write, не истёк ли |
| thedad.ru показывает 404 GitHub | Pages в `thedad-releases` смотрит на ветку `gh-pages`; в ветке есть `CNAME` с `thedad.ru` |
| Сайт открылся, но старая версия | Service worker: закрыть все вкладки сайта и открыть снова — появится тост «Доступно обновление» |
| «Domain is already taken» при привязке домена | Pages в `planer` ещё включён — отключить (шаг 5.1) |
| `release-desktop` падает | Actions → лог шага; чаще всего не собрался `desktop:icon` из-за `public/logo-dark.png` |
