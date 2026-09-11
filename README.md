# DuoArena V3 — polished build

Что исправлено в этой версии:

- `Unknown` в истории матчей:
  - GitHub-пользователь повторно синхронизируется с SQLite при каждом активном сеансе;
  - в матч сохраняется snapshot логина и аватара победителя/проигравшего;
  - старая база автоматически мигрируется без ручного удаления.
- После каждого раунда теперь появляется крупное окно результата:
  - ПОБЕДА / ПОРАЖЕНИЕ / НИЧЬЯ;
  - имя победителя;
  - его аватар;
  - лучший результат;
  - кнопка реванша.
- Полностью переработан визуальный стиль:
  - новый hub;
  - профиль игрока с W/L/WR;
  - понятнее карточки режимов;
  - компактное лобби;
  - новый лидерборд;
  - подробные карточки матчей с результатами обоих игроков.
- `/api/stats` теперь отдаёт summary: players / matches / top player.
- Сохранена текущая GitHub OAuth + Socket.IO room architecture.

## Замена

Распаковать содержимое архива в корень репозитория с заменой файлов.

```bash
git add .
git commit -m "polish DuoArena UI and fix match history"
git push origin main
```

Render:

```text
Build: pip install -r requirements.txt
Start: gunicorn -w 1 --threads 100 --bind 0.0.0.0:$PORT app:app
```

Environment Variables остаются прежними:

```text
BASE_URL=https://duoarena.onrender.com
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
SECRET_KEY=...
```

## Почему раньше победитель был Unknown

Render мог перезапустить приложение/базу, а browser session GitHub оставалась валидной.
В итоге игрок всё ещё считался авторизованным, но строки этого пользователя в
`github_users` уже не было. `game_matches` содержал GitHub ID победителя, а JOIN
не находил имя и показывал `Unknown`.

V3 автоматически восстанавливает запись пользователя из Flask session и также
сохраняет имя/аватар непосредственно в строке матча.
