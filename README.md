# DuoArena V4 — Global Rebrand

Полный ребрендинг DuoArena.

## V4

- GitHub OAuth сохранён.
- Добавлен Google OAuth.
- Добавлен гостевой вход с ником.
- Язык определяется автоматически по языку браузера:
  - `ru*` → Русский;
  - остальные → English.
- В меню можно вручную переключать RU / EN.
- Темы: System / Dark / Light.
- Тема и язык сохраняются в `localStorage`.
- Основной шрифт: Inter.
- JetBrains Mono используется только для кодов, таймеров и чисел.
- Полностью новый login screen, hub, lobby, profile menu и statistics UI.
- Новая универсальная система пользователей: GitHub / Google / Guest.
- История матчей хранит snapshot имени, аватара и провайдера — больше не зависит от JOIN к текущей таблице пользователей.
- Старые GitHub-пользователи и матчи V3 мигрируются в V4 при старте.

## Render Environment

```text
BASE_URL=https://duoarena.onrender.com
SECRET_KEY=...

GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...

GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

## GitHub OAuth

Homepage:

```text
https://duoarena.onrender.com
```

Callback:

```text
https://duoarena.onrender.com/auth/github/callback
```

## Google OAuth

В Google Cloud Console создай **OAuth 2.0 Client ID → Web application**.

Authorized JavaScript origin:

```text
https://duoarena.onrender.com
```

Authorized redirect URI:

```text
https://duoarena.onrender.com/auth/google/callback
```

После этого добавь `GOOGLE_CLIENT_ID` и `GOOGLE_CLIENT_SECRET` в Render → Environment.

## Render

Build command:

```bash
pip install -r requirements.txt
```

Start command:

```bash
gunicorn -w 1 --threads 100 --bind 0.0.0.0:$PORT app:app
```

## Deploy

Распакуй архив в корень репозитория с заменой файлов:

```bash
git add .
git commit -m "DuoArena V4 global rebrand"
git push origin main
```

## Render Free

Комнаты живут в RAM, поэтому после рестарта процесса активные комнаты исчезают.
SQLite на free Render также не является постоянным хранилищем. Для полноценного публичного запуска лучше следующим этапом перенести данные в Postgres.
