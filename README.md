# DuoArena V6

Полная пересборка frontend + backend.

## Главное

- Google / GitHub / Guest.
- Авто RU/EN по языку браузера.
- RU/EN можно переключать вручную.
- Dark / Light / System.
- Новый DuoArena icon + favicon + web manifest.
- Manrope для интерфейса.
- JetBrains Mono только для кодов, таймеров и игровых чисел.
- Новый единый room flow:
  `lobby -> countdown -> playing -> finished -> rematch`.
- Серия побед внутри одной комнаты.
- 60 секунд grace period для reconnect.

## Ссылка-приглашение

После создания комнаты копируется ссылка:

`https://duoarena.onrender.com/r/ABCDE`

Если человек не вошёл:
1. DuoArena отправит его на login.
2. После Google / GitHub / Guest он вернётся на `/r/ABCDE`.
3. Сервер определит режим комнаты.
4. Откроется правильная игра.
5. Клиент автоматически войдёт в комнату.

## Игровая логика

### Reaction
- сигнал выбирает сервер;
- сервер считает reaction time;
- ранний клик = false start;
- есть timeout.

### Typing
- фраза выбирается сервером;
- есть RU и EN phrase pools;
- ошибки не блокируют завершение раунда;
- сервер считает elapsed time, WPM и accuracy;
- итоговый score = WPM * accuracy;
- оба игрока видят progress;
- paste отключён.

### CPS
- сервер открывает окно ровно на 10 секунд;
- каждый клик отправляется на сервер;
- итоговый count считает сервер.

### Aim
- сервер генерирует одну последовательность из 15 целей;
- оба игрока получают одинаковые координаты;
- сервер проверяет порядок hit index;
- pace считается сервером.

### Blind Timing
- начало раунда фиксирует сервер;
- сервер считает отклонение от 5.000 секунд.

## Render

Build:

`pip install -r requirements.txt`

Start:

`gunicorn -w 1 --threads 100 --bind 0.0.0.0:$PORT app:app`

OAuth callbacks:

GitHub:
`https://duoarena.onrender.com/auth/github/callback`

Google:
`https://duoarena.onrender.com/auth/google/callback`

## Проверка перед деплоем

Изменения v6 находятся в отдельной ветке. Полный аудит, протокол и ограничения: [QA_V6.md](QA_V6.md).

```bash
python -m unittest discover -s tests -v
node --test tests/room-client.test.cjs
python -m pip install websocket-client
python tests/gunicorn_smoke.py
```

После автоматических проверок нужен прогон в двух независимых браузерах на тестовом Render-сервисе. Основной сервис не обновлялся в рамках этого исправления.

## Восстановление соединения

При обрыве связи во время раунда сервер отменяет его для обоих игроков, сохраняя комнату и счёт серии. После возврата оба снова нажимают «Готов». Окно возврата — 60 секунд (`RECONNECT_GRACE`), срок жизни комнаты — два часа (`ROOM_TTL`). После перезапуска процесса комнаты исчезают.

## Render Free

Оставьте **один** Gunicorn worker. Несколько workers/инстансов не разделяют комнаты в памяти. SQLite не является постоянным хранилищем без persistent disk. Для сохранения истории между деплоями потребуется постоянное хранилище.

`SECRET_KEY` должен быть задан стабильным значением через окружение. Не храните его в Git. Debug по умолчанию отключён.
