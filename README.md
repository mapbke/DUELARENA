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
- 15 секунд grace period для reconnect.

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

## Deploy

Полностью заменить текущий проект содержимым архива.

```bash
git add .
git commit -m "DuoArena V6 complete rebuild"
git push origin main
```

## Render Free

Активные комнаты пока хранятся в RAM и исчезают после рестарта инстанса.
SQLite также не является постоянным хранилищем без persistent disk.

Если проект пойдёт в публичный запуск, следующий инфраструктурный шаг — Postgres + Redis.

## QA перед упаковкой

Проверено автоматически:

- Python syntax compile;
- все Jinja templates парсятся;
- весь JavaScript проходит `node --check`;
- все `getElementById()` указывают на реально существующие элементы;
- все клиентские `socket.emit()` имеют backend handler;
- invite flow `/r/<code>` сохраняет `next` через login и ведёт в правильный mode;
- favicon SVG + PNG 192/512 присутствуют;
- минимальный явный `font-size` в UI — 10px, основной body — 16px.

Runtime integration test в среде сборки не запускается, потому что в ней нет установленных Flask/Flask-SocketIO packages. На Render они устанавливаются из `requirements.txt`.
